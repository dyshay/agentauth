use axum::{routing::get, Router};
use http::{Request, StatusCode};
use jsonwebtoken::{encode, EncodingKey, Header};
use std::time::{SystemTime, UNIX_EPOCH};
use tower::ServiceExt;
use xagentauth::guard::GuardConfig;
use xagentauth::middleware::axum::{agentauth_layer, AgentAuthToken};
use xagentauth::token::AgentAuthClaims;
use xagentauth::types::AgentCapabilityScore;

const SECRET: &str = "test-secret-key-for-agentauth!!";

fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs()
}

fn sign_token(reasoning: f64, execution: f64, autonomy: f64, speed: f64, consistency: f64) -> String {
    let claims = AgentAuthClaims {
        sub: "agent-123".into(),
        iss: "agentauth".into(),
        iat: now_secs(),
        exp: now_secs() + 3600,
        jti: "test-jti-001".into(),
        capabilities: AgentCapabilityScore {
            reasoning,
            execution,
            autonomy,
            speed,
            consistency,
        },
        model_family: "gpt-4".into(),
        challenge_ids: vec!["ch-001".into()],
        agentauth_version: "1".into(),
    };
    let key = EncodingKey::from_secret(SECRET.as_bytes());
    encode(&Header::default(), &claims, &key).unwrap()
}

async fn protected_handler() -> &'static str {
    "ok"
}

async fn claims_handler(token: AgentAuthToken) -> String {
    format!("model:{}", token.0.model_family)
}

fn build_app() -> Router {
    let config = GuardConfig::new(SECRET);
    Router::new()
        .route("/protected", get(protected_handler))
        .route("/claims", get(claims_handler))
        .layer(agentauth_layer(config))
}

#[tokio::test]
async fn test_returns_401_without_token() {
    let app = build_app();
    let req = Request::builder()
        .uri("/protected")
        .body(axum::body::Body::empty())
        .unwrap();

    let resp = app.oneshot(req).await.unwrap();
    assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn test_returns_200_with_valid_token() {
    let app = build_app();
    let token = sign_token(0.9, 0.85, 0.8, 0.75, 0.88);
    let req = Request::builder()
        .uri("/protected")
        .header("Authorization", format!("Bearer {}", token))
        .body(axum::body::Body::empty())
        .unwrap();

    let resp = app.oneshot(req).await.unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
    assert_eq!(
        resp.headers().get("AgentAuth-Status").unwrap().to_str().unwrap(),
        "verified"
    );
    assert_eq!(
        resp.headers().get("AgentAuth-Model-Family").unwrap().to_str().unwrap(),
        "gpt-4"
    );
}

#[tokio::test]
async fn test_claims_extractor_works() {
    let app = build_app();
    let token = sign_token(0.9, 0.85, 0.8, 0.75, 0.88);
    let req = Request::builder()
        .uri("/claims")
        .header("Authorization", format!("Bearer {}", token))
        .body(axum::body::Body::empty())
        .unwrap();

    let resp = app.oneshot(req).await.unwrap();
    assert_eq!(resp.status(), StatusCode::OK);

    let body = axum::body::to_bytes(resp.into_body(), usize::MAX).await.unwrap();
    let text = String::from_utf8(body.to_vec()).unwrap();
    assert_eq!(text, "model:gpt-4");
}
