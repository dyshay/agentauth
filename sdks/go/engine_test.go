package xagentauth

import (
	"testing"
)

// simpleStore implements ChallengeStore in-memory for testing.
type simpleStore struct {
	data map[string]*ChallengeData
}

func newSimpleStore() *simpleStore {
	return &simpleStore{data: make(map[string]*ChallengeData)}
}

func (s *simpleStore) Set(id string, data *ChallengeData, ttlSeconds int64) error {
	s.data[id] = data
	return nil
}

func (s *simpleStore) Get(id string) (*ChallengeData, error) {
	return s.data[id], nil
}

func (s *simpleStore) Delete(id string) error {
	delete(s.data, id)
	return nil
}

// testDriver is a minimal challenge driver for engine tests.
type testDriver struct{}

func (d *testDriver) Name() string { return "test" }
func (d *testDriver) Dimensions() []ChallengeDimension {
	return []ChallengeDimension{DimensionReasoning, DimensionExecution}
}
func (d *testDriver) EstimatedHumanTimeMs() int64 { return 60000 }
func (d *testDriver) EstimatedAITimeMs() int64    { return 500 }

func (d *testDriver) Generate(difficulty Difficulty) (*ChallengePayload, string, error) {
	answer := "correct_answer"
	answerHash := SHA256Hex([]byte(answer))
	return &ChallengePayload{
		Type:         "test",
		Instructions: "This is a test challenge",
		Data:         "dGVzdA==",
		Steps:        1,
	}, answerHash, nil
}

func (d *testDriver) Verify(answerHash string, submitted string) (bool, error) {
	submittedHash := SHA256Hex([]byte(submitted))
	return TimingSafeEqual(answerHash, submittedHash), nil
}

func newTestEngine() *Engine {
	store := newSimpleStore()
	engine := NewEngine(EngineConfig{
		Secret:          "test-secret-key",
		TTLSeconds:      30,
		TokenTTLSeconds: 3600,
		Difficulty:      DifficultyMedium,
	}, store)
	engine.RegisterDriver(&testDriver{})
	return engine
}

func TestEngine_InitChallenge(t *testing.T) {
	engine := newTestEngine()

	result, err := engine.InitChallenge(nil)
	if err != nil {
		t.Fatalf("InitChallenge failed: %v", err)
	}
	if result.ID == "" {
		t.Error("Expected non-empty challenge ID")
	}
	if result.SessionToken == "" {
		t.Error("Expected non-empty session token")
	}
	if result.ExpiresAt == 0 {
		t.Error("Expected non-zero expires_at")
	}
	if result.TTLSeconds != 30 {
		t.Errorf("Expected TTL 30, got %d", result.TTLSeconds)
	}
}

func TestEngine_InitChallengeNoDrivers(t *testing.T) {
	store := newSimpleStore()
	engine := NewEngine(EngineConfig{Secret: "test"}, store)

	_, err := engine.InitChallenge(nil)
	if err == nil {
		t.Error("Expected error when no drivers registered")
	}
}

func TestEngine_GetChallenge(t *testing.T) {
	engine := newTestEngine()

	initResult, err := engine.InitChallenge(nil)
	if err != nil {
		t.Fatalf("InitChallenge failed: %v", err)
	}

	challenge, err := engine.GetChallenge(initResult.ID, initResult.SessionToken)
	if err != nil {
		t.Fatalf("GetChallenge failed: %v", err)
	}
	if challenge == nil {
		t.Fatal("Expected challenge, got nil")
	}
	if challenge.ID != initResult.ID {
		t.Errorf("Expected ID %s, got %s", initResult.ID, challenge.ID)
	}
	if challenge.Payload.Context != nil {
		t.Error("Expected context to be stripped from public challenge")
	}
}

func TestEngine_GetChallengeWrongToken(t *testing.T) {
	engine := newTestEngine()

	initResult, _ := engine.InitChallenge(nil)
	challenge, _ := engine.GetChallenge(initResult.ID, "wrong_token")
	if challenge != nil {
		t.Error("Expected nil for wrong session token")
	}
}

func TestEngine_GetChallengeMissing(t *testing.T) {
	engine := newTestEngine()
	challenge, _ := engine.GetChallenge("nonexistent", "token")
	if challenge != nil {
		t.Error("Expected nil for missing challenge")
	}
}

func TestEngine_SolveChallenge(t *testing.T) {
	engine := newTestEngine()

	initResult, _ := engine.InitChallenge(nil)

	answer := "correct_answer"
	hmac := HmacSHA256Hex(answer, initResult.SessionToken)

	result, err := engine.SolveChallenge(initResult.ID, &SolveInput{
		Answer:       answer,
		HMAC:         hmac,
		SessionToken: initResult.SessionToken,
	})
	if err != nil {
		t.Fatalf("SolveChallenge failed: %v", err)
	}
	if !result.Success {
		t.Errorf("Expected success, got failure with reason: %s", result.Reason)
	}
	if result.Token == "" {
		t.Error("Expected non-empty token")
	}
	if result.Score.Reasoning != 0.9 {
		t.Errorf("Expected reasoning 0.9, got %f", result.Score.Reasoning)
	}
}

func TestEngine_SolveChallenge_WrongAnswer(t *testing.T) {
	engine := newTestEngine()

	initResult, _ := engine.InitChallenge(nil)

	answer := "wrong_answer"
	hmac := HmacSHA256Hex(answer, initResult.SessionToken)

	result, err := engine.SolveChallenge(initResult.ID, &SolveInput{
		Answer:       answer,
		HMAC:         hmac,
		SessionToken: initResult.SessionToken,
	})
	if err != nil {
		t.Fatalf("SolveChallenge failed: %v", err)
	}
	if result.Success {
		t.Error("Expected failure for wrong answer")
	}
	if result.Reason != FailWrongAnswer {
		t.Errorf("Expected reason wrong_answer, got %s", result.Reason)
	}
}

func TestEngine_SolveChallenge_InvalidHmac(t *testing.T) {
	engine := newTestEngine()

	initResult, _ := engine.InitChallenge(nil)

	result, err := engine.SolveChallenge(initResult.ID, &SolveInput{
		Answer:       "correct_answer",
		HMAC:         "invalid_hmac",
		SessionToken: initResult.SessionToken,
	})
	if err != nil {
		t.Fatalf("SolveChallenge failed: %v", err)
	}
	if result.Success {
		t.Error("Expected failure for invalid HMAC")
	}
	if result.Reason != FailInvalidHmac {
		t.Errorf("Expected reason invalid_hmac, got %s", result.Reason)
	}
}

func TestEngine_VerifyToken(t *testing.T) {
	engine := newTestEngine()

	// Create a challenge and solve it to get a token
	initResult, _ := engine.InitChallenge(nil)
	answer := "correct_answer"
	hmac := HmacSHA256Hex(answer, initResult.SessionToken)
	solveResult, _ := engine.SolveChallenge(initResult.ID, &SolveInput{
		Answer: answer,
		HMAC:   hmac,
	})

	if !solveResult.Success {
		t.Fatal("Expected solve to succeed")
	}

	// Verify the token
	verifyResult, err := engine.VerifyToken(solveResult.Token)
	if err != nil {
		t.Fatalf("VerifyToken failed: %v", err)
	}
	if !verifyResult.Valid {
		t.Error("Expected token to be valid")
	}
	if verifyResult.Capabilities == nil {
		t.Error("Expected capabilities in verify result")
	}
}

func TestEngine_VerifyToken_Invalid(t *testing.T) {
	engine := newTestEngine()

	result, err := engine.VerifyToken("invalid.token.here")
	if err != nil {
		t.Fatalf("VerifyToken failed: %v", err)
	}
	if result.Valid {
		t.Error("Expected token to be invalid")
	}
}

func TestEngine_SolveChallenge_SingleUse(t *testing.T) {
	engine := newTestEngine()

	initResult, _ := engine.InitChallenge(nil)
	answer := "correct_answer"
	hmac := HmacSHA256Hex(answer, initResult.SessionToken)

	// First solve should succeed
	result1, _ := engine.SolveChallenge(initResult.ID, &SolveInput{
		Answer: answer,
		HMAC:   hmac,
	})
	if !result1.Success {
		t.Fatal("Expected first solve to succeed")
	}

	// Second solve should fail (challenge deleted)
	result2, _ := engine.SolveChallenge(initResult.ID, &SolveInput{
		Answer: answer,
		HMAC:   hmac,
	})
	if result2.Success {
		t.Error("Expected second solve to fail (single-use)")
	}
	if result2.Reason != FailExpired {
		t.Errorf("Expected reason expired, got %s", result2.Reason)
	}
}
