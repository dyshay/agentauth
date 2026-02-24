use agentauth::{AgentAuthClient, ClientConfig};
use serde_json::json;
use wiremock::matchers::{method, path};
use wiremock::{Mock, MockServer, ResponseTemplate};

#[tokio::test]
async fn test_init_challenge() {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path("/v1/challenge/init"))
        .respond_with(ResponseTemplate::new(201).set_body_json(json!({
            "id": "ch_test123",
            "session_token": "st_token456",
            "expires_at": 1708784400u64,
            "ttl_seconds": 30u64
        })))
        .mount(&server)
        .await;

    let client = AgentAuthClient::new(ClientConfig {
        base_url: server.uri(),
        api_key: None,
        timeout_ms: None,
    })
    .unwrap();

    let result = client.init_challenge(None, None).await.unwrap();
    assert_eq!(result.id, "ch_test123");
    assert_eq!(result.session_token, "st_token456");
}

#[tokio::test]
async fn test_get_challenge() {
    let server = MockServer::start().await;
    Mock::given(method("GET"))
        .and(path("/v1/challenge/ch_test123"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "id": "ch_test123",
            "payload": {
                "type": "crypto-nl",
                "instructions": "XOR each byte with 0xFF",
                "data": "AQID",
                "steps": 1
            },
            "difficulty": "easy",
            "dimensions": ["reasoning", "execution"],
            "created_at": 1708784000u64,
            "expires_at": 1708784400u64
        })))
        .mount(&server)
        .await;

    let client = AgentAuthClient::new(ClientConfig {
        base_url: server.uri(),
        api_key: None,
        timeout_ms: None,
    })
    .unwrap();

    let result = client
        .get_challenge("ch_test123", "st_token")
        .await
        .unwrap();
    assert_eq!(result.id, "ch_test123");
    assert_eq!(result.payload.challenge_type, "crypto-nl");
}

#[tokio::test]
async fn test_solve_wrong_answer() {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path("/v1/challenge/ch_test123/solve"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "success": false,
            "score": {
                "reasoning": 0.0,
                "execution": 0.0,
                "autonomy": 0.0,
                "speed": 0.0,
                "consistency": 0.0
            },
            "reason": "wrong_answer"
        })))
        .mount(&server)
        .await;

    let client = AgentAuthClient::new(ClientConfig {
        base_url: server.uri(),
        api_key: None,
        timeout_ms: None,
    })
    .unwrap();

    let (result, _headers) = client
        .solve("ch_test123", "wrong", "st_token", None, None)
        .await
        .unwrap();
    assert!(!result.success);
    assert_eq!(result.reason.unwrap(), "wrong_answer");
}

#[tokio::test]
async fn test_http_error() {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path("/v1/challenge/init"))
        .respond_with(ResponseTemplate::new(500).set_body_string("Internal Server Error"))
        .mount(&server)
        .await;

    let client = AgentAuthClient::new(ClientConfig {
        base_url: server.uri(),
        api_key: None,
        timeout_ms: None,
    })
    .unwrap();

    let result = client.init_challenge(None, None).await;
    assert!(result.is_err());
}
