package xagentauth

import "encoding/json"

// Difficulty represents the difficulty level of a challenge.
type Difficulty string

const (
	DifficultyEasy        Difficulty = "easy"
	DifficultyMedium      Difficulty = "medium"
	DifficultyHard        Difficulty = "hard"
	DifficultyAdversarial Difficulty = "adversarial"
)

// ChallengeDimension represents a specific capability dimension being tested.
type ChallengeDimension string

const (
	DimensionReasoning ChallengeDimension = "reasoning"
	DimensionExecution ChallengeDimension = "execution"
	DimensionMemory    ChallengeDimension = "memory"
	DimensionAmbiguity ChallengeDimension = "ambiguity"
)

// AgentCapabilityScore represents an agent's capability scores across multiple dimensions.
type AgentCapabilityScore struct {
	Reasoning   float64 `json:"reasoning"`
	Execution   float64 `json:"execution"`
	Autonomy    float64 `json:"autonomy"`
	Speed       float64 `json:"speed"`
	Consistency float64 `json:"consistency"`
}

// ChallengePayload contains the challenge data and metadata.
type ChallengePayload struct {
	Type         string          `json:"type"`
	Instructions string          `json:"instructions"`
	Data         string          `json:"data"`
	Steps        int             `json:"steps"`
	Context      json.RawMessage `json:"context,omitempty"`
}

// InitChallengeRequest is the request to initialize a new challenge.
type InitChallengeRequest struct {
	Difficulty Difficulty           `json:"difficulty"`
	Dimensions []ChallengeDimension `json:"dimensions,omitempty"`
}

// InitChallengeResponse is the response from initializing a challenge.
type InitChallengeResponse struct {
	ID           string `json:"id"`
	SessionToken string `json:"session_token"`
	ExpiresAt    int64  `json:"expires_at"`
	TTLSeconds   int64  `json:"ttl_seconds"`
}

// ChallengeResponse contains the full challenge details.
type ChallengeResponse struct {
	ID         string             `json:"id"`
	Payload    ChallengePayload   `json:"payload"`
	Difficulty Difficulty         `json:"difficulty"`
	Dimensions []ChallengeDimension `json:"dimensions"`
	CreatedAt  int64              `json:"created_at"`
	ExpiresAt  int64              `json:"expires_at"`
}

// ModelIdentification contains information about the identified model.
type ModelIdentification struct {
	Family       string             `json:"family"`
	Confidence   float64            `json:"confidence"`
	Evidence     []CanaryEvidence   `json:"evidence"`
	Alternatives []ModelAlternative `json:"alternatives"`
}

// CanaryEvidence represents evidence from a canary token.
type CanaryEvidence struct {
	CanaryID               string  `json:"canary_id"`
	Observed               string  `json:"observed"`
	Expected               string  `json:"expected"`
	Match                  bool    `json:"match"`
	ConfidenceContribution float64 `json:"confidence_contribution"`
}

// ModelAlternative represents an alternative model identification.
type ModelAlternative struct {
	Family     string  `json:"family"`
	Confidence float64 `json:"confidence"`
}

// TimingAnalysis contains timing-based analysis of the solution.
type TimingAnalysis struct {
	ElapsedMs  float64 `json:"elapsed_ms"`
	Zone       string  `json:"zone"`
	Confidence float64 `json:"confidence"`
	ZScore     float64 `json:"z_score"`
	Penalty    float64 `json:"penalty"`
	Details    string  `json:"details"`
}

// SolveRequest is the request to solve a challenge.
type SolveRequest struct {
	Answer           string            `json:"answer"`
	HMAC             string            `json:"hmac"`
	CanaryResponses  map[string]string `json:"canary_responses,omitempty"`
	Metadata         *SolveMetadata    `json:"metadata,omitempty"`
}

// SolveMetadata contains optional metadata about the solving agent.
type SolveMetadata struct {
	Model     *string `json:"model,omitempty"`
	Framework *string `json:"framework,omitempty"`
}

// SolveResponse is the response from solving a challenge.
type SolveResponse struct {
	Success        bool                  `json:"success"`
	Score          AgentCapabilityScore  `json:"score"`
	Token          *string               `json:"token,omitempty"`
	Reason         *string               `json:"reason,omitempty"`
	ModelIdentity  *ModelIdentification  `json:"model_identity,omitempty"`
	TimingAnalysis *TimingAnalysis       `json:"timing_analysis,omitempty"`
}

// VerifyTokenResponse is the response from verifying a token.
type VerifyTokenResponse struct {
	Valid        bool                  `json:"valid"`
	Capabilities *AgentCapabilityScore `json:"capabilities,omitempty"`
	ModelFamily  *string               `json:"model_family,omitempty"`
	IssuedAt     *int64                `json:"issued_at,omitempty"`
	ExpiresAt    *int64                `json:"expires_at,omitempty"`
}

// AgentAuthHeaders contains authentication headers from the server.
type AgentAuthHeaders struct {
	Status         *string  `json:"status,omitempty"`
	ModelFamily    *string  `json:"model_family,omitempty"`
	Capabilities   *string  `json:"capabilities,omitempty"`
	Version        *string  `json:"version,omitempty"`
	ChallengeID    *string  `json:"challenge_id,omitempty"`
	Score          *float64 `json:"score,omitempty"`
	PomiConfidence *float64 `json:"pomi_confidence,omitempty"`
	TokenExpires   *int64   `json:"token_expires,omitempty"`
}

// AuthenticateResult contains the complete authentication result.
type AuthenticateResult struct {
	Success        bool                  `json:"success"`
	Token          *string               `json:"token,omitempty"`
	Score          AgentCapabilityScore  `json:"score"`
	ModelIdentity  *ModelIdentification  `json:"model_identity,omitempty"`
	TimingAnalysis *TimingAnalysis       `json:"timing_analysis,omitempty"`
	Reason         *string               `json:"reason,omitempty"`
	Headers        *AgentAuthHeaders     `json:"headers,omitempty"`
}

// ClientConfig contains configuration for the AgentAuth client.
type ClientConfig struct {
	BaseURL   string
	APIKey    string
	TimeoutMs int64
}

// SolverFunc is a function that solves a challenge and returns the answer,
// canary responses, and any error encountered.
type SolverFunc func(ChallengeResponse) (string, map[string]string, error)

// ---------------------------------------------------------------------------
// Server-side types
// ---------------------------------------------------------------------------

// FailReason represents why a challenge verification failed.
type FailReason string

const (
	FailWrongAnswer FailReason = "wrong_answer"
	FailExpired     FailReason = "expired"
	FailAlreadyUsed FailReason = "already_used"
	FailInvalidHmac FailReason = "invalid_hmac"
	FailTooFast     FailReason = "too_fast"
	FailTooSlow     FailReason = "too_slow"
	FailTimeout     FailReason = "timeout"
	FailRateLimited FailReason = "rate_limited"
)

// VerifyResult is the server-side result of challenge verification.
type VerifyResult struct {
	Success        bool                 `json:"success"`
	Score          AgentCapabilityScore `json:"score"`
	Token          string               `json:"token,omitempty"`
	Reason         FailReason           `json:"reason,omitempty"`
	ModelIdentity  *ModelIdentification `json:"model_identity,omitempty"`
	TimingAnalysis *TimingAnalysis      `json:"timing_analysis,omitempty"`
}

// InjectionMethod for PoMI canaries.
type InjectionMethod string

const (
	InjectionInline   InjectionMethod = "inline"
	InjectionPrefix   InjectionMethod = "prefix"
	InjectionSuffix   InjectionMethod = "suffix"
	InjectionEmbedded InjectionMethod = "embedded"
)

// Canary represents a PoMI canary for model fingerprinting.
type Canary struct {
	ID               string          `json:"id"`
	Prompt           string          `json:"prompt"`
	InjectionMethod  InjectionMethod `json:"injection_method"`
	Analysis         CanaryAnalysis  `json:"analysis"`
	ConfidenceWeight float64         `json:"confidence_weight"`
}

// CanaryAnalysis represents the analysis type for a canary.
type CanaryAnalysis struct {
	Type          string                  `json:"type"` // "exact_match", "pattern", "statistical"
	Expected      map[string]string       `json:"expected,omitempty"`
	Patterns      map[string]string       `json:"patterns,omitempty"`
	Distributions map[string]Distribution `json:"distributions,omitempty"`
}

// Distribution represents a statistical distribution.
type Distribution struct {
	Mean   float64 `json:"mean"`
	StdDev float64 `json:"stddev"`
}

// TimingZone represents a timing classification zone.
type TimingZone string

const (
	ZoneTooFast    TimingZone = "too_fast"
	ZoneAI         TimingZone = "ai_zone"
	ZoneSuspicious TimingZone = "suspicious"
	ZoneHuman      TimingZone = "human"
	ZoneTimeout    TimingZone = "timeout"
)

// TimingBaseline holds timing expectations for a challenge type+difficulty.
type TimingBaseline struct {
	ChallengeType string     `json:"challenge_type"`
	Difficulty    Difficulty `json:"difficulty"`
	MeanMs        float64    `json:"mean_ms"`
	StdMs         float64    `json:"std_ms"`
	TooFastMs     float64    `json:"too_fast_ms"`
	AILowerMs     float64    `json:"ai_lower_ms"`
	AIUpperMs     float64    `json:"ai_upper_ms"`
	HumanMs       float64    `json:"human_ms"`
	TimeoutMs     float64    `json:"timeout_ms"`
}

// TimingPatternAnalysis contains pattern analysis results for timing data.
type TimingPatternAnalysis struct {
	VarianceCoefficient float64 `json:"variance_coefficient"`
	Trend               string  `json:"trend"`
	RoundNumberRatio    float64 `json:"round_number_ratio"`
	Verdict             string  `json:"verdict"`
}

// SessionTimingAnomaly represents a timing anomaly detected in a session.
type SessionTimingAnomaly struct {
	Type        string `json:"type"`
	Description string `json:"description"`
	Severity    string `json:"severity"`
}

// PomiConfig holds PoMI system configuration.
type PomiConfig struct {
	Enabled              bool     `json:"enabled"`
	CanaryCount          int      `json:"canary_count"`
	ConfidenceThreshold  float64  `json:"confidence_threshold"`
	ModelFamilies        []string `json:"model_families,omitempty"`
}

// TimingConfig holds timing analysis configuration.
type TimingConfig struct {
	Enabled          bool             `json:"enabled"`
	Baselines        []TimingBaseline `json:"baselines,omitempty"`
	DefaultTooFastMs float64          `json:"default_too_fast_ms,omitempty"`
	DefaultAILowerMs float64          `json:"default_ai_lower_ms,omitempty"`
	DefaultAIUpperMs float64          `json:"default_ai_upper_ms,omitempty"`
	DefaultHumanMs   float64          `json:"default_human_ms,omitempty"`
	DefaultTimeoutMs float64          `json:"default_timeout_ms,omitempty"`
}

// EngineConfig holds the configuration for the AgentAuth engine.
type EngineConfig struct {
	Secret          string
	TTLSeconds      int64
	Difficulty      Difficulty
	Dimensions      []ChallengeDimension
	Pomi            PomiConfig
	Timing          TimingConfig
	TokenTTLSeconds int64
	MinScore        float64
}

// InitChallengeOptions configures a challenge initialization.
type InitChallengeOptions struct {
	Difficulty *Difficulty
	Dimensions []ChallengeDimension
}

// InitChallengeResult is the result of initializing a challenge (server-side).
type InitChallengeResult struct {
	ID           string `json:"id"`
	SessionToken string `json:"session_token"`
	ExpiresAt    int64  `json:"expires_at"`
	TTLSeconds   int64  `json:"ttl_seconds"`
}

// SolveInput contains the data submitted to solve a challenge (server-side).
type SolveInput struct {
	Answer          string            `json:"answer"`
	HMAC            string            `json:"hmac"`
	SessionToken    string            `json:"session_token"`
	CanaryResponses map[string]string `json:"canary_responses,omitempty"`
	StepTimings     []float64         `json:"step_timings,omitempty"`
	ClientRTTMs     float64           `json:"client_rtt_ms,omitempty"`
}

// VerifyTokenResult is the result of verifying a token (server-side).
type VerifyTokenResult struct {
	Valid        bool                  `json:"valid"`
	Capabilities *AgentCapabilityScore `json:"capabilities,omitempty"`
	ModelFamily  string                `json:"model_family,omitempty"`
	IssuedAt     int64                 `json:"issued_at,omitempty"`
	ExpiresAt    int64                 `json:"expires_at,omitempty"`
}

// ChallengeData is the stored data for an active challenge (server-side).
type ChallengeData struct {
	ID                string               `json:"id"`
	ChallengeType     string               `json:"challenge_type"`
	Difficulty        Difficulty            `json:"difficulty"`
	Dimensions        []ChallengeDimension `json:"dimensions"`
	Payload           ChallengePayload     `json:"payload"`
	AnswerHash        string               `json:"answer_hash"`
	SessionToken      string               `json:"session_token"`
	HmacSecret        string               `json:"hmac_secret"`
	CreatedAt         int64                `json:"created_at"`
	CreatedAtServerMs int64                `json:"created_at_server_ms"`
	ExpiresAt         int64                `json:"expires_at"`
	Used              bool                 `json:"used"`
	Canaries          []Canary             `json:"canaries,omitempty"`
}

// ChallengeInner is the public-facing challenge data returned to the client.
type ChallengeInner struct {
	ID         string               `json:"id"`
	Payload    ChallengePayload     `json:"payload"`
	Difficulty Difficulty            `json:"difficulty"`
	Dimensions []ChallengeDimension `json:"dimensions"`
	CreatedAt  int64                `json:"created_at"`
	ExpiresAt  int64                `json:"expires_at"`
}

// ChallengeStore is the interface for storing challenge data.
type ChallengeStore interface {
	Set(id string, data *ChallengeData, ttlSeconds int64) error
	Get(id string) (*ChallengeData, error)
	Delete(id string) error
}

// ChallengeDriver is the interface for challenge generation and verification.
type ChallengeDriver interface {
	Name() string
	Dimensions() []ChallengeDimension
	EstimatedHumanTimeMs() int64
	EstimatedAITimeMs() int64
	Generate(difficulty Difficulty) (*ChallengePayload, string, error) // payload, answerHash, error
	Verify(answerHash string, submitted string) (bool, error)
}
