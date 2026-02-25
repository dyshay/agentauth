use jsonwebtoken::{decode, Algorithm, DecodingKey, TokenData, Validation};
use serde::{Deserialize, Serialize};

use crate::types::AgentCapabilityScore;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentAuthClaims {
    pub sub: String,
    pub iss: String,
    pub iat: u64,
    pub exp: u64,
    pub jti: String,
    pub capabilities: AgentCapabilityScore,
    pub model_family: String,
    pub challenge_ids: Vec<String>,
    pub agentauth_version: String,
}

#[derive(Debug, thiserror::Error)]
pub enum TokenError {
    #[error("Token has expired")]
    Expired,
    #[error("Invalid token issuer")]
    InvalidIssuer,
    #[error("Invalid token signature")]
    InvalidSignature,
    #[error("Invalid token: {0}")]
    Invalid(String),
}

pub struct TokenVerifier {
    secret: Vec<u8>,
}

impl TokenVerifier {
    pub fn new(secret: &str) -> Self {
        Self {
            secret: secret.as_bytes().to_vec(),
        }
    }

    /// Verify JWT signature, issuer, and expiration. Returns claims on success.
    pub fn verify(&self, token: &str) -> Result<AgentAuthClaims, TokenError> {
        let key = DecodingKey::from_secret(&self.secret);
        let mut validation = Validation::new(Algorithm::HS256);
        validation.set_issuer(&["agentauth"]);
        validation.set_required_spec_claims(&["exp", "iss", "sub", "iat"]);

        let token_data: TokenData<AgentAuthClaims> =
            decode(token, &key, &validation).map_err(|e| match e.kind() {
                jsonwebtoken::errors::ErrorKind::ExpiredSignature => TokenError::Expired,
                jsonwebtoken::errors::ErrorKind::InvalidIssuer => TokenError::InvalidIssuer,
                jsonwebtoken::errors::ErrorKind::InvalidSignature => TokenError::InvalidSignature,
                _ => TokenError::Invalid(e.to_string()),
            })?;

        Ok(token_data.claims)
    }

    /// Decode JWT without signature verification. Useful for inspecting tokens.
    pub fn decode_unchecked(&self, token: &str) -> Result<AgentAuthClaims, TokenError> {
        let key = DecodingKey::from_secret(&[]);
        let mut validation = Validation::new(Algorithm::HS256);
        validation.insecure_disable_signature_validation();
        validation.validate_exp = false;
        validation.set_required_spec_claims::<&str>(&[]);
        validation.validate_aud = false;

        let token_data: TokenData<AgentAuthClaims> =
            decode(token, &key, &validation).map_err(|e| TokenError::Invalid(e.to_string()))?;

        Ok(token_data.claims)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use jsonwebtoken::{encode, EncodingKey, Header};
    use std::time::{SystemTime, UNIX_EPOCH};

    const SECRET: &str = "test-secret-key-for-agentauth!!";

    fn now_secs() -> u64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs()
    }

    fn test_claims(exp: u64, iss: &str) -> AgentAuthClaims {
        AgentAuthClaims {
            sub: "agent-123".into(),
            iss: iss.into(),
            iat: now_secs(),
            exp,
            jti: "test-jti-001".into(),
            capabilities: AgentCapabilityScore {
                reasoning: 0.9,
                execution: 0.85,
                autonomy: 0.8,
                speed: 0.75,
                consistency: 0.88,
            },
            model_family: "gpt-4".into(),
            challenge_ids: vec!["ch-001".into()],
            agentauth_version: "1".into(),
        }
    }

    fn sign_token(secret: &str, claims: &AgentAuthClaims) -> String {
        let key = EncodingKey::from_secret(secret.as_bytes());
        encode(&Header::default(), claims, &key).unwrap()
    }

    #[test]
    fn test_verify_valid_token() {
        let claims = test_claims(now_secs() + 3600, "agentauth");
        let token = sign_token(SECRET, &claims);
        let verifier = TokenVerifier::new(SECRET);

        let result = verifier.verify(&token).unwrap();
        assert_eq!(result.sub, "agent-123");
        assert_eq!(result.model_family, "gpt-4");
        assert!((result.capabilities.reasoning - 0.9).abs() < f64::EPSILON);
    }

    #[test]
    fn test_verify_expired_token() {
        let claims = test_claims(now_secs() - 100, "agentauth");
        let token = sign_token(SECRET, &claims);
        let verifier = TokenVerifier::new(SECRET);

        assert!(matches!(verifier.verify(&token), Err(TokenError::Expired)));
    }

    #[test]
    fn test_verify_wrong_secret() {
        let claims = test_claims(now_secs() + 3600, "agentauth");
        let token = sign_token(SECRET, &claims);
        let verifier = TokenVerifier::new("wrong-secret-key-for-testing!!");

        assert!(matches!(
            verifier.verify(&token),
            Err(TokenError::InvalidSignature)
        ));
    }

    #[test]
    fn test_verify_wrong_issuer() {
        let claims = test_claims(now_secs() + 3600, "not-agentauth");
        let token = sign_token(SECRET, &claims);
        let verifier = TokenVerifier::new(SECRET);

        assert!(matches!(
            verifier.verify(&token),
            Err(TokenError::InvalidIssuer)
        ));
    }

    #[test]
    fn test_decode_unchecked() {
        let claims = test_claims(now_secs() + 3600, "agentauth");
        let token = sign_token("different-secret-not-the-real!!", &claims);
        let verifier = TokenVerifier::new(SECRET);

        let result = verifier.decode_unchecked(&token).unwrap();
        assert_eq!(result.sub, "agent-123");
        assert_eq!(result.model_family, "gpt-4");
    }
}
