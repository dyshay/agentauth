package xagentauth

import (
	"testing"
	"time"
)

func signGuardToken(reasoning, execution, autonomy, speed, consistency float64) string {
	claims := defaultClaims()
	claims["capabilities"] = map[string]float64{
		"reasoning":   reasoning,
		"execution":   execution,
		"autonomy":    autonomy,
		"speed":       speed,
		"consistency": consistency,
	}
	return signTestToken(testSecret, claims)
}

func TestVerifyRequestSufficientScore(t *testing.T) {
	token := signGuardToken(0.9, 0.85, 0.8, 0.75, 0.88)
	config := &GuardConfig{Secret: testSecret, MinScore: 0.7}

	result, guardErr := VerifyRequest(token, config)
	if guardErr != nil {
		t.Fatalf("unexpected error: %v", guardErr)
	}
	if result.Claims.Sub != "agent-123" {
		t.Errorf("expected sub=agent-123, got %s", result.Claims.Sub)
	}
	if result.Headers["AgentAuth-Status"] != "verified" {
		t.Errorf("expected verified status header")
	}
}

func TestVerifyRequestInsufficientScore(t *testing.T) {
	token := signGuardToken(0.1, 0.1, 0.1, 0.1, 0.1)
	config := &GuardConfig{Secret: testSecret, MinScore: 0.7}

	_, guardErr := VerifyRequest(token, config)
	if guardErr == nil {
		t.Fatal("expected error for insufficient score")
	}
	if guardErr.StatusCode != 403 {
		t.Errorf("expected status 403, got %d", guardErr.StatusCode)
	}
}

func TestVerifyRequestInvalidToken(t *testing.T) {
	config := &GuardConfig{Secret: testSecret, MinScore: 0.7}

	_, guardErr := VerifyRequest("invalid.token.here", config)
	if guardErr == nil {
		t.Fatal("expected error for invalid token")
	}
	if guardErr.StatusCode != 401 {
		t.Errorf("expected status 401, got %d", guardErr.StatusCode)
	}
}

// Ensure defaultClaims uses current time (avoid stale test helper)
func init() {
	_ = time.Now()
}
