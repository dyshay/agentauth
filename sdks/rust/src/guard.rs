use crate::headers::{format_capabilities, names as header_names};
use crate::token::{AgentAuthClaims, TokenError, TokenVerifier};

#[derive(Debug, Clone)]
pub struct GuardConfig {
    pub secret: String,
    pub min_score: f64,
}

impl GuardConfig {
    pub fn new(secret: impl Into<String>) -> Self {
        Self {
            secret: secret.into(),
            min_score: 0.7,
        }
    }

    pub fn with_min_score(mut self, min_score: f64) -> Self {
        self.min_score = min_score;
        self
    }
}

#[derive(Debug)]
pub struct GuardResult {
    pub claims: AgentAuthClaims,
    pub headers: Vec<(String, String)>,
}

#[derive(Debug, thiserror::Error)]
pub enum GuardError {
    #[error("Missing Authorization header")]
    MissingToken,
    #[error("Invalid token: {0}")]
    InvalidToken(#[from] TokenError),
    #[error("Insufficient capability score: {got:.2} < {min:.2}")]
    InsufficientScore { got: f64, min: f64 },
}

impl GuardError {
    pub fn status_code(&self) -> u16 {
        match self {
            GuardError::MissingToken | GuardError::InvalidToken(_) => 401,
            GuardError::InsufficientScore { .. } => 403,
        }
    }
}

/// Verify a Bearer token and check the minimum capability score.
pub fn verify_request(token: &str, config: &GuardConfig) -> Result<GuardResult, GuardError> {
    let verifier = TokenVerifier::new(&config.secret);
    let claims = verifier.verify(token)?;

    let caps = &claims.capabilities;
    let avg =
        (caps.reasoning + caps.execution + caps.autonomy + caps.speed + caps.consistency) / 5.0;

    if avg < config.min_score {
        return Err(GuardError::InsufficientScore {
            got: avg,
            min: config.min_score,
        });
    }

    let mut headers = vec![
        (header_names::STATUS.into(), "verified".into()),
        (header_names::SCORE.into(), format!("{avg:.2}")),
        (
            header_names::MODEL_FAMILY.into(),
            claims.model_family.clone(),
        ),
        (
            header_names::VERSION.into(),
            claims.agentauth_version.clone(),
        ),
        (
            header_names::CAPABILITIES.into(),
            format_capabilities(&claims.capabilities),
        ),
    ];
    if let Some(cid) = claims.challenge_ids.first() {
        headers.push((header_names::CHALLENGE_ID.into(), cid.clone()));
    }
    headers.push((header_names::TOKEN_EXPIRES.into(), claims.exp.to_string()));

    Ok(GuardResult { claims, headers })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::AgentCapabilityScore;
    use jsonwebtoken::{encode, EncodingKey, Header};
    use std::time::{SystemTime, UNIX_EPOCH};

    const SECRET: &str = "test-secret-key-for-agentauth!!";

    fn now_secs() -> u64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs()
    }

    fn sign_token(
        reasoning: f64,
        execution: f64,
        autonomy: f64,
        speed: f64,
        consistency: f64,
    ) -> String {
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

    #[test]
    fn test_sufficient_score() {
        let token = sign_token(0.9, 0.85, 0.8, 0.75, 0.88);
        let config = GuardConfig::new(SECRET);
        let result = verify_request(&token, &config).unwrap();
        assert_eq!(result.claims.sub, "agent-123");
        assert!(result
            .headers
            .iter()
            .any(|(k, v)| k == "AgentAuth-Status" && v == "verified"));
        // Check capabilities header is present and well-formed
        let caps_header = result
            .headers
            .iter()
            .find(|(k, _)| k == "AgentAuth-Capabilities")
            .expect("AgentAuth-Capabilities header must be present");
        assert!(caps_header.1.contains("reasoning=0.9"));
        assert!(caps_header.1.contains("execution=0.85"));
        assert!(caps_header.1.contains("autonomy=0.8"));
        assert!(caps_header.1.contains("speed=0.75"));
        assert!(caps_header.1.contains("consistency=0.88"));
        // Verify Challenge-Id uses correct casing (not Challenge-ID)
        let cid_header = result
            .headers
            .iter()
            .find(|(k, _)| k == "AgentAuth-Challenge-Id");
        assert!(
            cid_header.is_some(),
            "AgentAuth-Challenge-Id header must be present"
        );
    }

    #[test]
    fn test_insufficient_score() {
        let token = sign_token(0.1, 0.1, 0.1, 0.1, 0.1);
        let config = GuardConfig::new(SECRET);
        let err = verify_request(&token, &config).unwrap_err();
        assert!(matches!(err, GuardError::InsufficientScore { .. }));
        assert_eq!(err.status_code(), 403);
    }

    #[test]
    fn test_invalid_token() {
        let config = GuardConfig::new(SECRET);
        let err = verify_request("invalid.token.here", &config).unwrap_err();
        assert!(matches!(err, GuardError::InvalidToken(_)));
        assert_eq!(err.status_code(), 401);
    }
}
