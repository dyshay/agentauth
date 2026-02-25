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
