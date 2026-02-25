use jsonwebtoken::{
    decode, encode, Algorithm, DecodingKey, EncodingKey, Header, TokenData, Validation,
};
use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};

use crate::types::AgentCapabilityScore;

/// Input for signing a new AgentAuth JWT token.
#[derive(Debug, Clone)]
pub struct TokenSignInput {
    pub sub: String,
    pub capabilities: AgentCapabilityScore,
    pub model_family: String,
    pub challenge_ids: Vec<String>,
}

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

    /// Sign a new AgentAuth JWT token.
    ///
    /// Produces an HS256 JWT with the given claims, a generated JTI,
    /// and an expiration based on `ttl_seconds` (defaults to 3600).
    pub fn sign(
        &self,
        input: &TokenSignInput,
        ttl_seconds: Option<u64>,
    ) -> Result<String, TokenError> {
        let ttl = ttl_seconds.unwrap_or(3600);
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|e| TokenError::Invalid(e.to_string()))?;
        let iat = now.as_secs();
        let exp = iat + ttl;
        let jti = format!("{:032x}", now.as_nanos());

        let claims = AgentAuthClaims {
            sub: input.sub.clone(),
            iss: "agentauth".into(),
            iat,
            exp,
            jti,
            capabilities: input.capabilities.clone(),
            model_family: input.model_family.clone(),
            challenge_ids: input.challenge_ids.clone(),
            agentauth_version: "1".into(),
        };

        let key = EncodingKey::from_secret(&self.secret);
        encode(&Header::default(), &claims, &key).map_err(|e| TokenError::Invalid(e.to_string()))
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

    fn test_sign_input() -> TokenSignInput {
        TokenSignInput {
            sub: "agent-456".into(),
            capabilities: AgentCapabilityScore {
                reasoning: 0.9,
                execution: 0.85,
                autonomy: 0.8,
                speed: 0.75,
                consistency: 0.88,
            },
            model_family: "claude-3".into(),
            challenge_ids: vec!["ch-001".into(), "ch-002".into()],
        }
    }

    #[test]
    fn test_sign_produces_verifiable_token() {
        let verifier = TokenVerifier::new(SECRET);
        let input = test_sign_input();

        let token = verifier.sign(&input, None).unwrap();
        let claims = verifier.verify(&token).unwrap();

        assert_eq!(claims.sub, "agent-456");
        assert_eq!(claims.iss, "agentauth");
        assert_eq!(claims.model_family, "claude-3");
        assert_eq!(claims.agentauth_version, "1");
        assert_eq!(claims.challenge_ids, vec!["ch-001", "ch-002"]);
        assert!((claims.capabilities.reasoning - 0.9).abs() < f64::EPSILON);
        assert!((claims.capabilities.execution - 0.85).abs() < f64::EPSILON);
    }

    #[test]
    fn test_sign_with_custom_ttl() {
        let verifier = TokenVerifier::new(SECRET);
        let input = test_sign_input();

        let token = verifier.sign(&input, Some(120)).unwrap();
        let claims = verifier.decode_unchecked(&token).unwrap();

        assert_eq!(claims.exp - claims.iat, 120);
    }

    #[test]
    fn test_sign_generates_unique_jti() {
        let verifier = TokenVerifier::new(SECRET);
        let input = test_sign_input();

        let token1 = verifier.sign(&input, None).unwrap();
        // Small delay to ensure different nanosecond timestamps
        std::thread::sleep(std::time::Duration::from_millis(1));
        let token2 = verifier.sign(&input, None).unwrap();

        let claims1 = verifier.decode_unchecked(&token1).unwrap();
        let claims2 = verifier.decode_unchecked(&token2).unwrap();

        assert_ne!(claims1.jti, claims2.jti);
    }
}
