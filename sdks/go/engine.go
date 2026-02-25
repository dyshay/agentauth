package xagentauth

import (
	"fmt"
	"math"
	"time"
)

// Engine is the server-side AgentAuth challenge engine.
// It coordinates challenge generation, verification, PoMI model identification,
// timing analysis, and token issuance.
type Engine struct {
	config   EngineConfig
	registry *ChallengeRegistry
	store    ChallengeStore
	verifier *TokenVerifier

	// pomiEnabled tracks whether PoMI is active
	pomiEnabled bool
	// timingEnabled tracks whether timing analysis is active
	timingEnabled bool

	// These are interfaces so subpackages can provide implementations
	// without import cycles. The engine calls them through function fields.
	pomiInjectFunc     func(payload ChallengePayload, count int) (ChallengePayload, []Canary)
	pomiClassifyFunc   func(canaries []Canary, responses map[string]string) ModelIdentification
	timingAnalyzeFunc  func(elapsedMs float64, challengeType string, difficulty Difficulty, rttMs float64) TimingAnalysis
	timingPatternFunc  func(stepTimings []float64) TimingPatternAnalysis
	sessionRecordFunc  func(sessionID string, elapsedMs float64, zone TimingZone)
	sessionAnalyzeFunc func(sessionID string) []SessionTimingAnomaly
}

// NewEngine creates a new Engine with the given configuration and store.
func NewEngine(config EngineConfig, store ChallengeStore) *Engine {
	if config.TTLSeconds == 0 {
		config.TTLSeconds = 30
	}
	if config.TokenTTLSeconds == 0 {
		config.TokenTTLSeconds = 3600
	}
	if config.Difficulty == "" {
		config.Difficulty = DifficultyMedium
	}
	if config.MinScore == 0 {
		config.MinScore = 0.7
	}

	return &Engine{
		config:   config,
		registry: NewChallengeRegistry(),
		store:    store,
		verifier: NewTokenVerifier(config.Secret),
	}
}

// RegisterDriver registers a challenge driver with the engine.
func (e *Engine) RegisterDriver(driver ChallengeDriver) {
	e.registry.Register(driver)
}

// SetPomiHandlers sets the PoMI inject and classify functions.
// This allows the pomi subpackage to provide its implementations
// without creating import cycles.
func (e *Engine) SetPomiHandlers(
	inject func(payload ChallengePayload, count int) (ChallengePayload, []Canary),
	classify func(canaries []Canary, responses map[string]string) ModelIdentification,
) {
	e.pomiEnabled = true
	e.pomiInjectFunc = inject
	e.pomiClassifyFunc = classify
}

// SetTimingHandlers sets the timing analysis functions.
func (e *Engine) SetTimingHandlers(
	analyze func(elapsedMs float64, challengeType string, difficulty Difficulty, rttMs float64) TimingAnalysis,
	pattern func(stepTimings []float64) TimingPatternAnalysis,
	sessionRecord func(sessionID string, elapsedMs float64, zone TimingZone),
	sessionAnalyze func(sessionID string) []SessionTimingAnomaly,
) {
	e.timingEnabled = true
	e.timingAnalyzeFunc = analyze
	e.timingPatternFunc = pattern
	e.sessionRecordFunc = sessionRecord
	e.sessionAnalyzeFunc = sessionAnalyze
}

// InitChallenge creates a new challenge, stores it, and returns the init result.
func (e *Engine) InitChallenge(options *InitChallengeOptions) (*InitChallengeResult, error) {
	difficulty := e.config.Difficulty
	var dimensions []ChallengeDimension

	if options != nil {
		if options.Difficulty != nil {
			difficulty = *options.Difficulty
		}
		dimensions = options.Dimensions
	}

	// Select a driver
	selected := e.registry.Select(dimensions, 1)
	if len(selected) == 0 {
		return nil, fmt.Errorf("no challenge drivers registered")
	}
	driver := selected[0]

	id := GenerateID()
	sessionToken := GenerateSessionToken()
	now := time.Now().Unix()
	expiresAt := now + e.config.TTLSeconds

	// Generate challenge
	payload, answerHash, err := driver.Generate(difficulty)
	if err != nil {
		return nil, fmt.Errorf("failed to generate challenge: %w", err)
	}

	// Inject canaries if PoMI is enabled
	var injectedCanaries []Canary
	if e.pomiEnabled && e.pomiInjectFunc != nil && e.config.Pomi.CanaryCount > 0 {
		newPayload, canaries := e.pomiInjectFunc(*payload, e.config.Pomi.CanaryCount)
		payload = &newPayload
		injectedCanaries = canaries
	}

	// Store challenge data
	challengeData := &ChallengeData{
		ID:                id,
		ChallengeType:     driver.Name(),
		Difficulty:        difficulty,
		Dimensions:        driver.Dimensions(),
		Payload:           *payload,
		AnswerHash:        answerHash,
		SessionToken:      sessionToken,
		HmacSecret:        sessionToken,
		CreatedAt:         now,
		CreatedAtServerMs: time.Now().UnixMilli(),
		ExpiresAt:         expiresAt,
		Used:              false,
		Canaries:          injectedCanaries,
	}

	if err := e.store.Set(id, challengeData, e.config.TTLSeconds); err != nil {
		return nil, fmt.Errorf("failed to store challenge: %w", err)
	}

	return &InitChallengeResult{
		ID:           id,
		SessionToken: sessionToken,
		ExpiresAt:    expiresAt,
		TTLSeconds:   e.config.TTLSeconds,
	}, nil
}

// GetChallenge retrieves a challenge by ID, validating the session token.
// Returns the public-facing challenge data without internal secrets.
func (e *Engine) GetChallenge(id, sessionToken string) (*ChallengeInner, error) {
	data, err := e.store.Get(id)
	if err != nil {
		return nil, fmt.Errorf("failed to get challenge: %w", err)
	}
	if data == nil {
		return nil, nil
	}

	// Validate session token
	if !TimingSafeEqual(data.SessionToken, sessionToken) {
		return nil, nil
	}

	// Return public challenge data (strip context and session_token)
	publicPayload := data.Payload
	publicPayload.Context = nil

	return &ChallengeInner{
		ID:         data.ID,
		Payload:    publicPayload,
		Difficulty: data.Difficulty,
		Dimensions: data.Dimensions,
		CreatedAt:  data.CreatedAt,
		ExpiresAt:  data.ExpiresAt,
	}, nil
}

// SolveChallenge verifies a challenge solution, performs timing analysis
// and model identification, scores the result, and issues a token.
func (e *Engine) SolveChallenge(id string, input *SolveInput) (*VerifyResult, error) {
	zeroScore := AgentCapabilityScore{}

	data, err := e.store.Get(id)
	if err != nil {
		return nil, fmt.Errorf("failed to get challenge: %w", err)
	}
	if data == nil {
		return &VerifyResult{Success: false, Score: zeroScore, Reason: FailExpired}, nil
	}

	// Verify HMAC
	expectedHmac := HmacSHA256Hex(input.Answer, data.SessionToken)
	if !TimingSafeEqual(expectedHmac, input.HMAC) {
		return &VerifyResult{Success: false, Score: zeroScore, Reason: FailInvalidHmac}, nil
	}

	// Delete challenge from store (single-use)
	if err := e.store.Delete(id); err != nil {
		return nil, fmt.Errorf("failed to delete challenge: %w", err)
	}

	// Verify answer
	driver := e.registry.Get(data.ChallengeType)
	if driver == nil {
		return &VerifyResult{Success: false, Score: zeroScore, Reason: FailWrongAnswer}, nil
	}

	correct, err := driver.Verify(data.AnswerHash, input.Answer)
	if err != nil {
		return nil, fmt.Errorf("failed to verify answer: %w", err)
	}
	if !correct {
		return &VerifyResult{Success: false, Score: zeroScore, Reason: FailWrongAnswer}, nil
	}

	// Compute timing analysis
	var timingAnalysis *TimingAnalysis
	if e.timingEnabled && e.timingAnalyzeFunc != nil {
		now := time.Now().UnixMilli()
		baseElapsed := float64(now - data.CreatedAtServerMs)

		// RTT compensation: subtract client RTT, capped at 50% of elapsed
		rttMs := 0.0
		if input.ClientRTTMs > 0 {
			rttMs = math.Min(input.ClientRTTMs, baseElapsed*0.5)
		}
		elapsedMs := baseElapsed - rttMs

		ta := e.timingAnalyzeFunc(elapsedMs, data.ChallengeType, data.Difficulty, rttMs)
		timingAnalysis = &ta

		// Reject too_fast and timeout
		if ta.Zone == string(ZoneTooFast) {
			return &VerifyResult{Success: false, Score: zeroScore, Reason: FailTooFast, TimingAnalysis: timingAnalysis}, nil
		}
		if ta.Zone == string(ZoneTimeout) {
			return &VerifyResult{Success: false, Score: zeroScore, Reason: FailTimeout, TimingAnalysis: timingAnalysis}, nil
		}
	}

	// Analyze per-step timing patterns
	var patternAnalysis *TimingPatternAnalysis
	if e.timingEnabled && e.timingPatternFunc != nil && len(input.StepTimings) > 0 {
		pa := e.timingPatternFunc(input.StepTimings)
		patternAnalysis = &pa
	}

	// Compute capability score
	score := e.computeScore(data, timingAnalysis, patternAnalysis)

	// Classify model identity if PoMI is enabled
	var modelIdentity *ModelIdentification
	if e.pomiEnabled && e.pomiClassifyFunc != nil && len(data.Canaries) > 0 {
		mi := e.pomiClassifyFunc(data.Canaries, input.CanaryResponses)
		modelIdentity = &mi
	}

	// Determine model family for token
	modelFamily := "unknown"
	if modelIdentity != nil && modelIdentity.Family != "unknown" {
		modelFamily = modelIdentity.Family
	}

	// Sign JWT token
	token, err := e.verifier.Sign(&TokenSignInput{
		Sub:          id,
		Capabilities: score,
		ModelFamily:  modelFamily,
		ChallengeIDs: []string{id},
	}, e.config.TokenTTLSeconds)
	if err != nil {
		return nil, fmt.Errorf("failed to sign token: %w", err)
	}

	return &VerifyResult{
		Success:        true,
		Score:          score,
		Token:          token,
		ModelIdentity:  modelIdentity,
		TimingAnalysis: timingAnalysis,
	}, nil
}

// VerifyToken verifies a JWT token and returns the decoded claims.
func (e *Engine) VerifyToken(token string) (*VerifyTokenResult, error) {
	claims, err := e.verifier.Verify(token)
	if err != nil {
		return &VerifyTokenResult{Valid: false}, nil
	}
	return &VerifyTokenResult{
		Valid:        true,
		Capabilities: &claims.Capabilities,
		ModelFamily:  claims.ModelFamily,
		IssuedAt:     claims.Iat,
		ExpiresAt:    claims.Exp,
	}, nil
}

func (e *Engine) computeScore(data *ChallengeData, timingAnalysis *TimingAnalysis, patternAnalysis *TimingPatternAnalysis) AgentCapabilityScore {
	dims := data.Dimensions
	penalty := 0.0
	zone := ""
	if timingAnalysis != nil {
		penalty = timingAnalysis.Penalty
		zone = timingAnalysis.Zone
	}

	patternPenalty := 0.0
	if patternAnalysis != nil && patternAnalysis.Verdict == "artificial" {
		patternPenalty = 0.3
	}

	hasDim := func(dim ChallengeDimension) bool {
		for _, d := range dims {
			if d == dim {
				return true
			}
		}
		return false
	}

	reasoning := 0.5
	if hasDim(DimensionReasoning) {
		reasoning = 0.9
	}

	execution := 0.5
	if hasDim(DimensionExecution) {
		execution = 0.95
	}

	speed := math.Round((1-penalty)*0.95*1000) / 1000

	autonomy := 0.9
	if zone == string(ZoneHuman) || zone == string(ZoneSuspicious) {
		autonomy = (1 - penalty) * 0.9
	}
	autonomy = math.Round(autonomy*(1-patternPenalty)*1000) / 1000

	consistency := 0.9
	if hasDim(DimensionMemory) {
		consistency = 0.92
	}
	consistency = math.Round(consistency*(1-patternPenalty)*1000) / 1000

	return AgentCapabilityScore{
		Reasoning:   reasoning,
		Execution:   execution,
		Speed:       speed,
		Autonomy:    autonomy,
		Consistency: consistency,
	}
}
