use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ---------------------------------------------------------------------------
// Core enums
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum Difficulty {
    Easy,
    #[default]
    Medium,
    Hard,
    Adversarial,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
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

// ---------------------------------------------------------------------------
// Challenge payload (used in both client and server)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Client-side request / response types (unchanged)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// FailReason enum
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum FailReason {
    WrongAnswer,
    Expired,
    AlreadyUsed,
    InvalidHmac,
    TooFast,
    TooSlow,
    Timeout,
    RateLimited,
}

// ---------------------------------------------------------------------------
// PoMI (Proof of Model Identity) types
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum InjectionMethod {
    Inline,
    Prefix,
    Suffix,
    Embedded,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum CanaryAnalysis {
    ExactMatch {
        expected: HashMap<String, String>,
    },
    Pattern {
        patterns: HashMap<String, String>,
    },
    Statistical {
        distributions: HashMap<String, Distribution>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Distribution {
    pub mean: f64,
    pub stddev: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Canary {
    pub id: String,
    pub prompt: String,
    pub injection_method: InjectionMethod,
    pub analysis: CanaryAnalysis,
    pub confidence_weight: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CanaryEvidence {
    pub canary_id: String,
    pub observed: String,
    pub expected: String,
    #[serde(rename = "match")]
    pub is_match: bool,
    pub confidence_contribution: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelAlternative {
    pub family: String,
    pub confidence: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelIdentification {
    pub family: String,
    pub confidence: f64,
    #[serde(default)]
    pub evidence: Vec<CanaryEvidence>,
    #[serde(default)]
    pub alternatives: Vec<ModelAlternative>,
}

// ---------------------------------------------------------------------------
// Timing types
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum TimingZone {
    TooFast,
    AiZone,
    Suspicious,
    Human,
    Timeout,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimingBaseline {
    pub challenge_type: String,
    pub difficulty: Difficulty,
    pub mean_ms: f64,
    pub std_ms: f64,
    pub too_fast_ms: f64,
    pub ai_lower_ms: f64,
    pub ai_upper_ms: f64,
    pub human_ms: f64,
    pub timeout_ms: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimingAnalysis {
    pub elapsed_ms: f64,
    pub zone: TimingZone,
    pub confidence: f64,
    pub z_score: f64,
    pub penalty: f64,
    pub details: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum TimingTrend {
    Constant,
    Increasing,
    Decreasing,
    Variable,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum TimingVerdict {
    Natural,
    Artificial,
    Inconclusive,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimingPatternAnalysis {
    pub variance_coefficient: f64,
    pub trend: TimingTrend,
    pub round_number_ratio: f64,
    pub verdict: TimingVerdict,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum SessionAnomalySeverity {
    Low,
    Medium,
    High,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionTimingAnomaly {
    #[serde(rename = "type")]
    pub anomaly_type: String,
    pub description: String,
    pub severity: SessionAnomalySeverity,
}

// ---------------------------------------------------------------------------
// Server-side verification result
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerifyResult {
    pub success: bool,
    pub score: AgentCapabilityScore,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub token: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<FailReason>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model_identity: Option<ModelIdentification>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub timing_analysis: Option<TimingAnalysis>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pattern_analysis: Option<TimingPatternAnalysis>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session_anomalies: Option<Vec<SessionTimingAnomaly>>,
}

// ---------------------------------------------------------------------------
// Server-side config types
// ---------------------------------------------------------------------------

#[derive(Debug, Clone)]
pub struct PomiConfig {
    pub enabled: bool,
    pub canaries_per_challenge: usize,
    pub model_families: Vec<String>,
    pub confidence_threshold: f64,
}

impl Default for PomiConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            canaries_per_challenge: 2,
            model_families: vec![
                "gpt-4-class".into(),
                "claude-3-class".into(),
                "gemini-class".into(),
                "llama-class".into(),
                "mistral-class".into(),
            ],
            confidence_threshold: 0.5,
        }
    }
}

#[derive(Debug, Clone)]
pub struct TimingConfig {
    pub enabled: bool,
    pub baselines: Option<Vec<TimingBaseline>>,
    pub default_too_fast_ms: f64,
    pub default_ai_lower_ms: f64,
    pub default_ai_upper_ms: f64,
    pub default_human_ms: f64,
    pub default_timeout_ms: f64,
    pub session_tracking_enabled: bool,
}

impl Default for TimingConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            baselines: None,
            default_too_fast_ms: 50.0,
            default_ai_lower_ms: 50.0,
            default_ai_upper_ms: 2000.0,
            default_human_ms: 10000.0,
            default_timeout_ms: 30000.0,
            session_tracking_enabled: false,
        }
    }
}

// ---------------------------------------------------------------------------
// Server-side challenge data (stored in ChallengeStore)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChallengeData {
    pub challenge: ChallengeInner,
    pub answer_hash: String,
    pub attempts: u32,
    pub max_attempts: u32,
    pub created_at: u64,
    pub created_at_server_ms: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub injected_canaries: Option<Vec<Canary>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChallengeInner {
    pub id: String,
    pub session_token: String,
    pub payload: ChallengePayload,
    pub difficulty: Difficulty,
    pub dimensions: Vec<ChallengeDimension>,
    pub created_at: u64,
    pub expires_at: u64,
}

// ---------------------------------------------------------------------------
// Server-side solve input
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SolveInput {
    pub answer: String,
    pub hmac: String,
    #[serde(default)]
    pub canary_responses: Option<HashMap<String, String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<SolveInputMetadata>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub client_rtt_ms: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub step_timings: Option<Vec<f64>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SolveInputMetadata {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub framework: Option<String>,
}

// ---------------------------------------------------------------------------
// Server-side verify token result
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerifyTokenResult {
    pub valid: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub capabilities: Option<AgentCapabilityScore>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model_family: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub issued_at: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expires_at: Option<u64>,
}

// ---------------------------------------------------------------------------
// ChallengeStore trait — pluggable backends
// ---------------------------------------------------------------------------

#[async_trait]
pub trait ChallengeStore: Send + Sync {
    async fn set(&self, id: &str, data: ChallengeData, ttl_seconds: u64) -> Result<(), String>;
    async fn get(&self, id: &str) -> Result<Option<ChallengeData>, String>;
    async fn delete(&self, id: &str) -> Result<(), String>;
}

// ---------------------------------------------------------------------------
// ChallengeDriver trait — pluggable challenge generators
// ---------------------------------------------------------------------------

/// A challenge driver generates challenges and verifies answers.
///
/// The `generate` method produces a `ChallengePayload` and a pre-computed
/// `answer_hash` (SHA-256 of the correct answer string). The `verify` method
/// checks whether `sha256(submitted_answer) == answer_hash`.
pub trait ChallengeDriver: Send + Sync {
    fn name(&self) -> &str;
    fn dimensions(&self) -> Vec<ChallengeDimension>;
    fn estimated_human_time_ms(&self) -> u64;
    fn estimated_ai_time_ms(&self) -> u64;
    /// Generate a challenge. Returns (payload, answer_hash).
    fn generate(&self, difficulty: &Difficulty) -> Result<(ChallengePayload, String), String>;
    /// Verify an answer against the stored answer hash.
    fn verify(&self, answer_hash: &str, submitted: &serde_json::Value) -> Result<bool, String>;
}
