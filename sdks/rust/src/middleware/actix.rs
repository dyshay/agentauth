use std::{
    future::{ready, Future, Ready},
    pin::Pin,
    rc::Rc,
};

use actix_web::{
    body::EitherBody,
    dev::{forward_ready, Service, ServiceRequest, ServiceResponse, Transform},
    Error, HttpMessage, HttpResponse,
};

use crate::guard::{verify_request, GuardConfig, GuardError};
use crate::token::AgentAuthClaims;

// --- Extractor ---

/// Actix-web extractor that provides AgentAuth claims to handlers.
///
/// Claims are inserted into request extensions by [`AgentAuthMiddleware`].
///
/// ```ignore
/// async fn handler(claims: AgentAuthToken) -> impl Responder {
///     format!("Hello, agent {} (model: {})", claims.0.sub, claims.0.model_family)
/// }
/// ```
#[derive(Debug, Clone)]
pub struct AgentAuthToken(pub AgentAuthClaims);

impl actix_web::FromRequest for AgentAuthToken {
    type Error = Error;
    type Future = Ready<Result<Self, Self::Error>>;

    fn from_request(
        req: &actix_web::HttpRequest,
        _payload: &mut actix_web::dev::Payload,
    ) -> Self::Future {
        let result = req
            .extensions()
            .get::<AgentAuthClaims>()
            .cloned()
            .map(AgentAuthToken)
            .ok_or_else(|| {
                actix_web::error::ErrorInternalServerError(
                    "AgentAuth claims not found — is AgentAuthMiddleware applied?",
                )
            });
        ready(result)
    }
}

// --- Middleware Factory (Transform) ---

/// Actix-web middleware that validates AgentAuth Bearer tokens.
///
/// ```ignore
/// let config = GuardConfig::new("my-secret");
/// App::new()
///     .wrap(AgentAuthMiddleware::new(config))
///     .route("/protected", web::get().to(handler))
/// ```
pub struct AgentAuthMiddleware {
    config: Rc<GuardConfig>,
}

impl AgentAuthMiddleware {
    pub fn new(config: GuardConfig) -> Self {
        Self {
            config: Rc::new(config),
        }
    }
}

impl<S, B> Transform<S, ServiceRequest> for AgentAuthMiddleware
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    B: 'static,
{
    type Response = ServiceResponse<EitherBody<B>>;
    type Error = Error;
    type Transform = AgentAuthMiddlewareService<S>;
    type InitError = ();
    type Future = Ready<Result<Self::Transform, Self::InitError>>;

    fn new_transform(&self, service: S) -> Self::Future {
        ready(Ok(AgentAuthMiddlewareService {
            service: Rc::new(service),
            config: Rc::clone(&self.config),
        }))
    }
}

// --- Middleware Service ---

pub struct AgentAuthMiddlewareService<S> {
    service: Rc<S>,
    config: Rc<GuardConfig>,
}

impl<S, B> Service<ServiceRequest> for AgentAuthMiddlewareService<S>
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    B: 'static,
{
    type Response = ServiceResponse<EitherBody<B>>;
    type Error = Error;
    type Future = Pin<Box<dyn Future<Output = Result<Self::Response, Self::Error>>>>;

    forward_ready!(service);

    fn call(&self, req: ServiceRequest) -> Self::Future {
        let service = Rc::clone(&self.service);
        let config = Rc::clone(&self.config);

        Box::pin(async move {
            // Extract the Bearer token from the Authorization header
            let token = req
                .headers()
                .get("Authorization")
                .and_then(|v| v.to_str().ok())
                .and_then(|v| v.strip_prefix("Bearer "))
                .map(|s| s.to_owned());

            let token = match token {
                Some(t) => t,
                None => {
                    let resp = guard_error_response(&GuardError::MissingToken);
                    return Ok(req.into_response(resp).map_into_right_body());
                }
            };

            match verify_request(&token, &config) {
                Ok(result) => {
                    // Store claims in request extensions for the extractor
                    req.extensions_mut().insert(result.claims);

                    let mut resp = service.call(req).await?.map_into_left_body();

                    // Set AgentAuth response headers
                    for (name, value) in &result.headers {
                        if let Ok(v) = actix_web::http::header::HeaderValue::from_str(value) {
                            if let Ok(n) =
                                actix_web::http::header::HeaderName::from_bytes(name.as_bytes())
                            {
                                resp.headers_mut().insert(n, v);
                            }
                        }
                    }

                    Ok(resp)
                }
                Err(e) => {
                    let resp = guard_error_response(&e);
                    Ok(req.into_response(resp).map_into_right_body())
                }
            }
        })
    }
}

fn guard_error_response(error: &GuardError) -> HttpResponse {
    let status = match error.status_code() {
        401 => actix_web::http::StatusCode::UNAUTHORIZED,
        403 => actix_web::http::StatusCode::FORBIDDEN,
        _ => actix_web::http::StatusCode::INTERNAL_SERVER_ERROR,
    };

    let body = serde_json::json!({
        "error": error.to_string(),
        "status": error.status_code(),
    });

    HttpResponse::build(status)
        .content_type("application/json")
        .body(body.to_string())
}
