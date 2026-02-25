use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Difficulty {
    Easy,
    #[default]
    Medium,
    Hard,
    Adversarial,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ChallengeDimension {
    Reasoning,
    Execution,
    Memory,
    Ambiguity,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentCapabilityScore {
    pub reasoning: f64,
    pub execution: f64,
    pub autonomy: f64,
    pub speed: f64,
    pub consistency: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChallengePayload {
    #[serde(rename = "type")]
    pub challenge_type: String,
    pub instructions: String,
    pub data: String,
    pub steps: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub context: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize)]
pub struct InitChallengeRequest {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub difficulty: Option<Difficulty>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dimensions: Option<Vec<ChallengeDimension>>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct InitChallengeResponse {
    pub id: String,
    pub session_token: String,
    pub expires_at: u64,
    pub ttl_seconds: u64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ChallengeResponse {
    pub id: String,
    pub payload: ChallengePayload,
    pub difficulty: Difficulty,
    pub dimensions: Vec<ChallengeDimension>,
    pub created_at: u64,
    pub expires_at: u64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ModelIdentification {
    pub family: String,
    pub confidence: f64,
    #[serde(default)]
    pub evidence: Vec<CanaryEvidence>,
    #[serde(default)]
    pub alternatives: Vec<ModelAlternative>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CanaryEvidence {
    pub canary_id: String,
    pub observed: String,
    pub expected: String,
    #[serde(rename = "match")]
    pub is_match: bool,
    pub confidence_contribution: f64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ModelAlternative {
    pub family: String,
    pub confidence: f64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct TimingAnalysis {
    pub elapsed_ms: f64,
    pub zone: String,
    pub confidence: f64,
    pub z_score: f64,
    pub penalty: f64,
    pub details: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct SolveRequest {
    pub answer: String,
    pub hmac: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub canary_responses: Option<HashMap<String, String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<SolveMetadata>,
}

#[derive(Debug, Clone, Serialize)]
pub struct SolveMetadata {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub framework: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct SolveResponse {
    pub success: bool,
    pub score: AgentCapabilityScore,
    pub token: Option<String>,
    pub reason: Option<String>,
    pub model_identity: Option<ModelIdentification>,
    pub timing_analysis: Option<TimingAnalysis>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct VerifyTokenResponse {
    pub valid: bool,
    pub capabilities: Option<AgentCapabilityScore>,
    pub model_family: Option<String>,
    pub issued_at: Option<u64>,
    pub expires_at: Option<u64>,
}

#[derive(Debug, Clone, Default)]
pub struct AgentAuthHeaders {
    pub status: Option<String>,
    pub score: Option<f64>,
    pub model_family: Option<String>,
    pub pomi_confidence: Option<f64>,
    pub capabilities: Option<String>,
    pub version: Option<String>,
    pub challenge_id: Option<String>,
    pub token_expires: Option<u64>,
}

#[derive(Debug, Clone)]
pub struct AuthenticateResult {
    pub success: bool,
    pub token: Option<String>,
    pub score: AgentCapabilityScore,
    pub model_identity: Option<ModelIdentification>,
    pub timing_analysis: Option<TimingAnalysis>,
    pub reason: Option<String>,
    pub headers: Option<AgentAuthHeaders>,
}

pub struct ClientConfig {
    pub base_url: String,
    pub api_key: Option<String>,
    pub timeout_ms: Option<u64>,
}
