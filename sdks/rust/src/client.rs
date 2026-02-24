use crate::crypto::hmac_sha256_hex;
use crate::error::AgentAuthError;
use crate::types::*;
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION, CONTENT_TYPE};
use std::collections::HashMap;
use std::time::Duration;

pub struct AgentAuthClient {
    http: reqwest::Client,
    base_url: String,
    api_key: Option<String>,
}

impl AgentAuthClient {
    pub fn new(config: ClientConfig) -> Result<Self, AgentAuthError> {
        let timeout = config.timeout_ms.unwrap_or(30000);
        let http = reqwest::Client::builder()
            .timeout(Duration::from_millis(timeout))
            .build()?;

        Ok(Self {
            http,
            base_url: config.base_url.trim_end_matches('/').to_string(),
            api_key: config.api_key,
        })
    }

    fn default_headers(&self) -> HeaderMap {
        let mut headers = HeaderMap::new();
        headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
        if let Some(ref key) = self.api_key {
            if let Ok(val) = HeaderValue::from_str(key) {
                headers.insert("X-API-Key", val);
            }
        }
        headers
    }

    pub async fn init_challenge(
        &self,
        difficulty: Option<Difficulty>,
        dimensions: Option<Vec<ChallengeDimension>>,
    ) -> Result<InitChallengeResponse, AgentAuthError> {
        let url = format!("{}/v1/challenge/init", self.base_url);
        let body = InitChallengeRequest {
            difficulty,
            dimensions,
        };

        let resp = self
            .http
            .post(&url)
            .headers(self.default_headers())
            .json(&body)
            .send()
            .await?;

        if !resp.status().is_success() {
            let status = resp.status().as_u16();
            let text = resp.text().await.unwrap_or_default();
            return Err(AgentAuthError::Http {
                status,
                message: text,
                error_type: None,
            });
        }

        Ok(resp.json().await?)
    }

    pub async fn get_challenge(
        &self,
        id: &str,
        session_token: &str,
    ) -> Result<ChallengeResponse, AgentAuthError> {
        let url = format!("{}/v1/challenge/{}", self.base_url, id);

        let resp = self
            .http
            .get(&url)
            .headers(self.default_headers())
            .header(AUTHORIZATION, format!("Bearer {}", session_token))
            .send()
            .await?;

        if !resp.status().is_success() {
            let status = resp.status().as_u16();
            let text = resp.text().await.unwrap_or_default();
            return Err(AgentAuthError::Http {
                status,
                message: text,
                error_type: None,
            });
        }

        Ok(resp.json().await?)
    }

    pub async fn solve(
        &self,
        id: &str,
        answer: &str,
        session_token: &str,
        canary_responses: Option<HashMap<String, String>>,
        metadata: Option<SolveMetadata>,
    ) -> Result<(SolveResponse, AgentAuthHeaders), AgentAuthError> {
        let url = format!("{}/v1/challenge/{}/solve", self.base_url, id);
        let hmac = hmac_sha256_hex(answer, session_token);

        let body = SolveRequest {
            answer: answer.to_string(),
            hmac,
            canary_responses,
            metadata,
        };

        let resp = self
            .http
            .post(&url)
            .headers(self.default_headers())
            .json(&body)
            .send()
            .await?;

        let headers = Self::extract_headers(resp.headers());

        if !resp.status().is_success() {
            let status = resp.status().as_u16();
            let text = resp.text().await.unwrap_or_default();
            return Err(AgentAuthError::Http {
                status,
                message: text,
                error_type: None,
            });
        }

        let data: SolveResponse = resp.json().await?;
        Ok((data, headers))
    }

    pub async fn verify_token(&self, token: &str) -> Result<VerifyTokenResponse, AgentAuthError> {
        let url = format!("{}/v1/token/verify", self.base_url);

        let resp = self
            .http
            .get(&url)
            .headers(self.default_headers())
            .header(AUTHORIZATION, format!("Bearer {}", token))
            .send()
            .await?;

        if !resp.status().is_success() {
            let status = resp.status().as_u16();
            let text = resp.text().await.unwrap_or_default();
            return Err(AgentAuthError::Http {
                status,
                message: text,
                error_type: None,
            });
        }

        Ok(resp.json().await?)
    }

    pub async fn authenticate<F, Fut>(
        &self,
        difficulty: Option<Difficulty>,
        dimensions: Option<Vec<ChallengeDimension>>,
        solver: F,
    ) -> Result<AuthenticateResult, AgentAuthError>
    where
        F: FnOnce(ChallengeResponse) -> Fut,
        Fut: std::future::Future<
            Output = Result<(String, Option<HashMap<String, String>>), AgentAuthError>,
        >,
    {
        let init = self.init_challenge(difficulty, dimensions).await?;
        let challenge = self.get_challenge(&init.id, &init.session_token).await?;
        let (answer, canary_responses) = solver(challenge).await?;
        let (result, headers) = self
            .solve(
                &init.id,
                &answer,
                &init.session_token,
                canary_responses,
                None,
            )
            .await?;

        Ok(AuthenticateResult {
            success: result.success,
            token: result.token,
            score: result.score,
            model_identity: result.model_identity,
            timing_analysis: result.timing_analysis,
            reason: result.reason,
            headers: Some(headers),
        })
    }

    fn extract_headers(headers: &HeaderMap) -> AgentAuthHeaders {
        AgentAuthHeaders {
            status: headers
                .get("agentauth-status")
                .and_then(|v| v.to_str().ok())
                .map(String::from),
            score: headers
                .get("agentauth-score")
                .and_then(|v| v.to_str().ok())
                .and_then(|v| v.parse().ok()),
            model_family: headers
                .get("agentauth-model-family")
                .and_then(|v| v.to_str().ok())
                .map(String::from),
            pomi_confidence: headers
                .get("agentauth-pomi-confidence")
                .and_then(|v| v.to_str().ok())
                .and_then(|v| v.parse().ok()),
            capabilities: headers
                .get("agentauth-capabilities")
                .and_then(|v| v.to_str().ok())
                .map(String::from),
            version: headers
                .get("agentauth-version")
                .and_then(|v| v.to_str().ok())
                .map(String::from),
            challenge_id: headers
                .get("agentauth-challenge-id")
                .and_then(|v| v.to_str().ok())
                .map(String::from),
            token_expires: headers
                .get("agentauth-token-expires")
                .and_then(|v| v.to_str().ok())
                .and_then(|v| v.parse().ok()),
        }
    }
}
