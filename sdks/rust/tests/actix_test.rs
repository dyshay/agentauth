use actix_web::{test, web, App, HttpResponse};
use jsonwebtoken::{encode, EncodingKey, Header};
use std::time::{SystemTime, UNIX_EPOCH};
use xagentauth::guard::GuardConfig;
use xagentauth::middleware::actix::{AgentAuthMiddleware, AgentAuthToken};
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

async fn protected_handler() -> HttpResponse {
    HttpResponse::Ok().body("ok")
}

async fn claims_handler(token: AgentAuthToken) -> HttpResponse {
    HttpResponse::Ok().body(format!("model:{}", token.0.model_family))
}

#[actix_rt::test]
async fn test_returns_401_without_token() {
    let config = GuardConfig::new(SECRET);
    let app = test::init_service(
        App::new()
            .wrap(AgentAuthMiddleware::new(config))
            .route("/protected", web::get().to(protected_handler)),
    )
    .await;

    let req = test::TestRequest::get().uri("/protected").to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 401);
}

#[actix_rt::test]
async fn test_returns_200_with_valid_token() {
    let config = GuardConfig::new(SECRET);
    let app = test::init_service(
        App::new()
            .wrap(AgentAuthMiddleware::new(config))
            .route("/protected", web::get().to(protected_handler)),
    )
    .await;

    let token = sign_token(0.9, 0.85, 0.8, 0.75, 0.88);
    let req = test::TestRequest::get()
        .uri("/protected")
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);
    assert_eq!(
        resp.headers().get("AgentAuth-Status").unwrap().to_str().unwrap(),
        "verified"
    );
    assert_eq!(
        resp.headers().get("AgentAuth-Model-Family").unwrap().to_str().unwrap(),
        "gpt-4"
    );
}

#[actix_rt::test]
async fn test_claims_extractor_works() {
    let config = GuardConfig::new(SECRET);
    let app = test::init_service(
        App::new()
            .wrap(AgentAuthMiddleware::new(config))
            .route("/claims", web::get().to(claims_handler)),
    )
    .await;

    let token = sign_token(0.9, 0.85, 0.8, 0.75, 0.88);
    let req = test::TestRequest::get()
        .uri("/claims")
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);

    let body = test::read_body(resp).await;
    assert_eq!(String::from_utf8(body.to_vec()).unwrap(), "model:gpt-4");
}
