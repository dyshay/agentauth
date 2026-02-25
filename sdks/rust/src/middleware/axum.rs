use std::{
    future::Future,
    pin::Pin,
    sync::Arc,
    task::{Context, Poll},
};

use axum_core::{
    extract::FromRequestParts,
    response::{IntoResponse, Response},
};
use http::{request::Parts, HeaderValue, StatusCode};
use pin_project_lite::pin_project;
use tower_layer::Layer;
use tower_service::Service;

use crate::guard::{verify_request, GuardConfig, GuardError};
use crate::token::AgentAuthClaims;

// --- Extractor ---

/// Axum extractor that provides AgentAuth claims to handlers.
///
/// Claims are inserted into request extensions by [`AgentAuthLayer`].
///
/// ```ignore
/// async fn handler(claims: AgentAuthToken) -> impl IntoResponse {
///     format!("Hello, agent {} (model: {})", claims.0.sub, claims.0.model_family)
/// }
/// ```
#[derive(Debug, Clone)]
pub struct AgentAuthToken(pub AgentAuthClaims);

impl<S: Send + Sync> FromRequestParts<S> for AgentAuthToken {
    type Rejection = (StatusCode, String);

    fn from_request_parts(
        parts: &mut Parts,
        _state: &S,
    ) -> impl Future<Output = Result<Self, Self::Rejection>> + Send {
        let result = parts
            .extensions
            .get::<AgentAuthClaims>()
            .cloned()
            .map(AgentAuthToken)
            .ok_or((
                StatusCode::INTERNAL_SERVER_ERROR,
                "AgentAuth claims not found — is AgentAuthLayer applied?".into(),
            ));
        std::future::ready(result)
    }
}

// --- Layer ---

/// Tower layer that validates AgentAuth Bearer tokens.
///
/// ```ignore
/// let config = GuardConfig::new("my-secret");
/// let app = Router::new()
///     .route("/protected", get(handler))
///     .layer(agentauth_layer(config));
/// ```
#[derive(Clone)]
pub struct AgentAuthLayer {
    config: Arc<GuardConfig>,
}

/// Create an Axum/Tower layer that validates AgentAuth Bearer tokens.
pub fn agentauth_layer(config: GuardConfig) -> AgentAuthLayer {
    AgentAuthLayer {
        config: Arc::new(config),
    }
}

impl<S> Layer<S> for AgentAuthLayer {
    type Service = AgentAuthService<S>;

    fn layer(&self, inner: S) -> Self::Service {
        AgentAuthService {
            inner,
            config: Arc::clone(&self.config),
        }
    }
}

// --- Service ---

#[derive(Clone)]
pub struct AgentAuthService<S> {
    inner: S,
    config: Arc<GuardConfig>,
}

impl<S, B> Service<http::Request<B>> for AgentAuthService<S>
where
    S: Service<http::Request<B>, Response = Response> + Clone + Send + 'static,
    S::Future: Send + 'static,
    B: Send + 'static,
{
    type Response = Response;
    type Error = S::Error;
    type Future = AgentAuthFuture<S, B>;

    fn poll_ready(&mut self, cx: &mut Context<'_>) -> Poll<Result<(), Self::Error>> {
        self.inner.poll_ready(cx)
    }

    fn call(&mut self, mut req: http::Request<B>) -> Self::Future {
        // Extract the Bearer token from the Authorization header
        let token = req
            .headers()
            .get(http::header::AUTHORIZATION)
            .and_then(|v| v.to_str().ok())
            .and_then(|v| v.strip_prefix("Bearer "))
            .map(|s| s.to_owned());

        let token = match token {
            Some(t) => t,
            None => {
                return AgentAuthFuture::Error {
                    response: Some(guard_error_response(&GuardError::MissingToken)),
                };
            }
        };

        match verify_request(&token, &self.config) {
            Ok(result) => {
                // Store claims in request extensions for the extractor
                req.extensions_mut().insert(result.claims);

                let mut inner = self.inner.clone();
                let headers_to_set: Vec<(String, String)> = result.headers;

                AgentAuthFuture::Inner {
                    future: inner.call(req),
                    headers: Some(headers_to_set),
                }
            }
            Err(e) => AgentAuthFuture::Error {
                response: Some(guard_error_response(&e)),
            },
        }
    }
}

pin_project! {
    #[project = AgentAuthFutureProj]
    pub enum AgentAuthFuture<S: Service<http::Request<B>>, B> {
        Inner {
            #[pin]
            future: S::Future,
            headers: Option<Vec<(String, String)>>,
        },
        Error {
            response: Option<Response>,
        },
    }
}

impl<S, B> Future for AgentAuthFuture<S, B>
where
    S: Service<http::Request<B>, Response = Response>,
{
    type Output = Result<Response, S::Error>;

    fn poll(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Self::Output> {
        match self.project() {
            AgentAuthFutureProj::Inner { future, headers } => {
                let mut response = std::task::ready!(future.poll(cx))?;
                if let Some(hdrs) = headers.take() {
                    for (name, value) in hdrs {
                        if let Ok(v) = HeaderValue::from_str(&value) {
                            if let Ok(n) = http::header::HeaderName::from_bytes(name.as_bytes()) {
                                response.headers_mut().insert(n, v);
                            }
                        }
                    }
                }
                Poll::Ready(Ok(response))
            }
            AgentAuthFutureProj::Error { response } => Poll::Ready(Ok(response.take().unwrap())),
        }
    }
}

fn guard_error_response(error: &GuardError) -> Response {
    let status = match error.status_code() {
        401 => StatusCode::UNAUTHORIZED,
        403 => StatusCode::FORBIDDEN,
        _ => StatusCode::INTERNAL_SERVER_ERROR,
    };

    let body = serde_json::json!({
        "error": error.to_string(),
        "status": error.status_code(),
    });

    (status, body.to_string()).into_response()
}
