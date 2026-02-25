package xagentauth

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"strings"
	"testing"
	"time"
)

const testSecret = "test-secret-key-for-agentauth!!"

func signTestToken(secret string, claims map[string]interface{}) string {
	header := map[string]string{"alg": "HS256", "typ": "JWT"}
	headerJSON, _ := json.Marshal(header)
	claimsJSON, _ := json.Marshal(claims)

	headerB64 := base64.RawURLEncoding.EncodeToString(headerJSON)
	claimsB64 := base64.RawURLEncoding.EncodeToString(claimsJSON)

	signingInput := headerB64 + "." + claimsB64
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(signingInput))
	sig := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))

	return signingInput + "." + sig
}

func defaultClaims() map[string]interface{} {
	now := time.Now().Unix()
	return map[string]interface{}{
		"sub": "agent-123",
		"iss": "agentauth",
		"iat": now,
		"exp": now + 3600,
		"jti": "test-jti-001",
		"capabilities": map[string]float64{
			"reasoning":   0.9,
			"execution":   0.85,
			"autonomy":    0.8,
			"speed":       0.75,
			"consistency":  0.88,
		},
		"model_family":      "gpt-4",
		"challenge_ids":     []string{"ch-001"},
		"agentauth_version": "1",
	}
}

func TestVerifyValidToken(t *testing.T) {
	token := signTestToken(testSecret, defaultClaims())
	v := NewTokenVerifier(testSecret)

	claims, err := v.Verify(token)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if claims.Sub != "agent-123" {
		t.Errorf("expected sub=agent-123, got %s", claims.Sub)
	}
	if claims.ModelFamily != "gpt-4" {
		t.Errorf("expected model_family=gpt-4, got %s", claims.ModelFamily)
	}
	if claims.Capabilities.Reasoning != 0.9 {
		t.Errorf("expected reasoning=0.9, got %f", claims.Capabilities.Reasoning)
	}
}

func TestVerifyExpiredToken(t *testing.T) {
	claims := defaultClaims()
	claims["exp"] = time.Now().Unix() - 100
	token := signTestToken(testSecret, claims)
	v := NewTokenVerifier(testSecret)

	_, err := v.Verify(token)
	if err == nil {
		t.Fatal("expected error for expired token")
	}
	agentErr, ok := err.(*AgentAuthError)
	if !ok {
		t.Fatalf("expected AgentAuthError, got %T", err)
	}
	if !strings.Contains(agentErr.Message, "expired") {
		t.Errorf("expected expired error, got: %s", agentErr.Message)
	}
}

func TestVerifyWrongSecret(t *testing.T) {
	token := signTestToken(testSecret, defaultClaims())
	v := NewTokenVerifier("wrong-secret-key-for-testing!!")

	_, err := v.Verify(token)
	if err == nil {
		t.Fatal("expected error for wrong secret")
	}
	agentErr, ok := err.(*AgentAuthError)
	if !ok {
		t.Fatalf("expected AgentAuthError, got %T", err)
	}
	if !strings.Contains(agentErr.Message, "signature") {
		t.Errorf("expected signature error, got: %s", agentErr.Message)
	}
}

func TestVerifyWrongIssuer(t *testing.T) {
	claims := defaultClaims()
	claims["iss"] = "not-agentauth"
	token := signTestToken(testSecret, claims)
	v := NewTokenVerifier(testSecret)

	_, err := v.Verify(token)
	if err == nil {
		t.Fatal("expected error for wrong issuer")
	}
	agentErr, ok := err.(*AgentAuthError)
	if !ok {
		t.Fatalf("expected AgentAuthError, got %T", err)
	}
	if !strings.Contains(agentErr.Message, "issuer") {
		t.Errorf("expected issuer error, got: %s", agentErr.Message)
	}
}

func TestDecodeWithoutVerification(t *testing.T) {
	token := signTestToken("different-secret-not-real!!", defaultClaims())
	v := NewTokenVerifier(testSecret)

	claims, err := v.Decode(token)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if claims.Sub != "agent-123" {
		t.Errorf("expected sub=agent-123, got %s", claims.Sub)
	}
	_ = fmt.Sprintf("decoded: %+v", claims)
}

func TestSignProducesVerifiableToken(t *testing.T) {
	v := NewTokenVerifier(testSecret)
	input := &TokenSignInput{
		Sub: "agent-456",
		Capabilities: AgentCapabilityScore{
			Reasoning: 0.9, Execution: 0.85, Autonomy: 0.8, Speed: 0.75, Consistency: 0.88,
		},
		ModelFamily:  "gpt-4",
		ChallengeIDs: []string{"ch-001"},
	}

	token, err := v.Sign(input, 3600)
	if err != nil {
		t.Fatalf("unexpected sign error: %v", err)
	}

	claims, err := v.Verify(token)
	if err != nil {
		t.Fatalf("unexpected verify error: %v", err)
	}
	if claims.Sub != "agent-456" {
		t.Errorf("expected sub=agent-456, got %s", claims.Sub)
	}
	if claims.ModelFamily != "gpt-4" {
		t.Errorf("expected model_family=gpt-4, got %s", claims.ModelFamily)
	}
	if claims.Iss != "agentauth" {
		t.Errorf("expected iss=agentauth, got %s", claims.Iss)
	}
	if claims.AgentAuthVersion != "1" {
		t.Errorf("expected version=1, got %s", claims.AgentAuthVersion)
	}
	if claims.Capabilities.Reasoning != 0.9 {
		t.Errorf("expected reasoning=0.9, got %f", claims.Capabilities.Reasoning)
	}
}

func TestSignWithCustomTTL(t *testing.T) {
	v := NewTokenVerifier(testSecret)
	input := &TokenSignInput{
		Sub: "agent-456",
		Capabilities: AgentCapabilityScore{
			Reasoning: 0.9, Execution: 0.85, Autonomy: 0.8, Speed: 0.75, Consistency: 0.88,
		},
		ModelFamily:  "gpt-4",
		ChallengeIDs: []string{"ch-001"},
	}

	token, err := v.Sign(input, 120)
	if err != nil {
		t.Fatalf("unexpected sign error: %v", err)
	}

	claims, err := v.Decode(token)
	if err != nil {
		t.Fatalf("unexpected decode error: %v", err)
	}
	if claims.Exp-claims.Iat != 120 {
		t.Errorf("expected TTL=120, got %d", claims.Exp-claims.Iat)
	}
}

func TestSignGeneratesUniqueJTI(t *testing.T) {
	v := NewTokenVerifier(testSecret)
	input := &TokenSignInput{
		Sub: "agent-456",
		Capabilities: AgentCapabilityScore{
			Reasoning: 0.9, Execution: 0.85, Autonomy: 0.8, Speed: 0.75, Consistency: 0.88,
		},
		ModelFamily:  "gpt-4",
		ChallengeIDs: []string{"ch-001"},
	}

	token1, _ := v.Sign(input, 3600)
	time.Sleep(time.Millisecond)
	token2, _ := v.Sign(input, 3600)

	claims1, _ := v.Decode(token1)
	claims2, _ := v.Decode(token2)

	if claims1.Jti == claims2.Jti {
		t.Errorf("expected unique JTIs, both got %s", claims1.Jti)
	}
}
