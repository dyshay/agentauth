package xagentauth

import (
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

// AgentAuthClaims represents the JWT claims from an AgentAuth token.
type AgentAuthClaims struct {
	Sub              string               `json:"sub"`
	Iss              string               `json:"iss"`
	Iat              int64                `json:"iat"`
	Exp              int64                `json:"exp"`
	Jti              string               `json:"jti"`
	Capabilities     AgentCapabilityScore `json:"capabilities"`
	ModelFamily      string               `json:"model_family"`
	ChallengeIDs     []string             `json:"challenge_ids"`
	AgentAuthVersion string               `json:"agentauth_version"`
}

// TokenVerifier provides local HS256 JWT verification using only stdlib.
type TokenVerifier struct {
	secret []byte
}

// NewTokenVerifier creates a new TokenVerifier with the given secret.
func NewTokenVerifier(secret string) *TokenVerifier {
	return &TokenVerifier{secret: []byte(secret)}
}

// jwtHeader represents the JWT header we expect.
type jwtHeader struct {
	Alg string `json:"alg"`
	Typ string `json:"typ"`
}

// Verify validates the JWT signature, issuer, and expiration.
// Returns the decoded claims or an error.
func (v *TokenVerifier) Verify(token string) (*AgentAuthClaims, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return nil, NewAgentAuthError(401, "invalid token format", "invalid_token")
	}

	// Decode header
	headerBytes, err := base64URLDecode(parts[0])
	if err != nil {
		return nil, NewAgentAuthError(401, "invalid token header", "invalid_token")
	}

	var header jwtHeader
	if err := json.Unmarshal(headerBytes, &header); err != nil {
		return nil, NewAgentAuthError(401, "invalid token header", "invalid_token")
	}

	if header.Alg != "HS256" {
		return nil, NewAgentAuthError(401, fmt.Sprintf("unsupported algorithm: %s", header.Alg), "invalid_token")
	}

	// Verify signature
	signingInput := parts[0] + "." + parts[1]
	mac := hmac.New(sha256.New, v.secret)
	mac.Write([]byte(signingInput))
	expectedSig := mac.Sum(nil)

	actualSig, err := base64URLDecode(parts[2])
	if err != nil {
		return nil, NewAgentAuthError(401, "invalid token signature encoding", "invalid_signature")
	}

	if subtle.ConstantTimeCompare(expectedSig, actualSig) != 1 {
		return nil, NewAgentAuthError(401, "invalid token signature", "invalid_signature")
	}

	// Decode payload
	payloadBytes, err := base64URLDecode(parts[1])
	if err != nil {
		return nil, NewAgentAuthError(401, "invalid token payload", "invalid_token")
	}

	var claims AgentAuthClaims
	if err := json.Unmarshal(payloadBytes, &claims); err != nil {
		return nil, NewAgentAuthError(401, "invalid token payload", "invalid_token")
	}

	// Validate issuer
	if claims.Iss != "agentauth" {
		return nil, NewAgentAuthError(401, "invalid token issuer", "invalid_issuer")
	}

	// Validate expiration
	if time.Now().Unix() > claims.Exp {
		return nil, NewAgentAuthError(401, "token has expired", "token_expired")
	}

	return &claims, nil
}

// Decode decodes the JWT payload without verifying the signature.
// Useful for inspecting tokens.
func (v *TokenVerifier) Decode(token string) (*AgentAuthClaims, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return nil, NewAgentAuthError(400, "invalid token format", "decode_error")
	}

	payloadBytes, err := base64URLDecode(parts[1])
	if err != nil {
		return nil, NewAgentAuthError(400, "invalid token payload", "decode_error")
	}

	var claims AgentAuthClaims
	if err := json.Unmarshal(payloadBytes, &claims); err != nil {
		return nil, NewAgentAuthError(400, "invalid token payload", "decode_error")
	}

	return &claims, nil
}

// TokenSignInput contains the fields needed to sign a new AgentAuth JWT.
type TokenSignInput struct {
	Sub          string
	Capabilities AgentCapabilityScore
	ModelFamily  string
	ChallengeIDs []string
}

// Sign creates a new HS256 JWT token with the given claims.
// ttlSeconds defaults to 3600 (1 hour) if set to 0.
func (v *TokenVerifier) Sign(input *TokenSignInput, ttlSeconds int64) (string, error) {
	if ttlSeconds == 0 {
		ttlSeconds = 3600
	}

	now := time.Now().Unix()
	jti := fmt.Sprintf("%016x%016x", time.Now().UnixNano(), time.Now().UnixNano()%1000000)

	claims := AgentAuthClaims{
		Sub:              input.Sub,
		Iss:              "agentauth",
		Iat:              now,
		Exp:              now + ttlSeconds,
		Jti:              jti,
		Capabilities:     input.Capabilities,
		ModelFamily:      input.ModelFamily,
		ChallengeIDs:     input.ChallengeIDs,
		AgentAuthVersion: "1",
	}

	// Encode header
	header := jwtHeader{Alg: "HS256", Typ: "JWT"}
	headerJSON, err := json.Marshal(header)
	if err != nil {
		return "", fmt.Errorf("failed to marshal header: %w", err)
	}

	claimsJSON, err := json.Marshal(claims)
	if err != nil {
		return "", fmt.Errorf("failed to marshal claims: %w", err)
	}

	headerB64 := base64.RawURLEncoding.EncodeToString(headerJSON)
	claimsB64 := base64.RawURLEncoding.EncodeToString(claimsJSON)

	signingInput := headerB64 + "." + claimsB64
	mac := hmac.New(sha256.New, v.secret)
	mac.Write([]byte(signingInput))
	sig := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))

	return signingInput + "." + sig, nil
}

// base64URLDecode decodes a base64url-encoded string (with or without padding).
func base64URLDecode(s string) ([]byte, error) {
	// Add padding if necessary
	switch len(s) % 4 {
	case 2:
		s += "=="
	case 3:
		s += "="
	}
	return base64.URLEncoding.DecodeString(s)
}
