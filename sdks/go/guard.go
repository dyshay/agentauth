package xagentauth

import "fmt"

// GuardConfig holds configuration for the AgentAuth guard middleware.
type GuardConfig struct {
	Secret   string
	MinScore float64 // default 0.7 if zero
}

// GuardResult holds the verified claims and response headers.
type GuardResult struct {
	Claims  *AgentAuthClaims
	Headers map[string]string
}

// GuardError represents an error from the guard verification.
type GuardError struct {
	StatusCode int
	Message    string
	ErrorType  string
}

func (e *GuardError) Error() string {
	return fmt.Sprintf("AgentAuth guard error [%d]: %s", e.StatusCode, e.Message)
}

// VerifyRequest verifies a Bearer token and checks the minimum capability score.
// Returns a GuardResult on success, or a GuardError on failure (401 for invalid
// tokens, 403 for insufficient scores).
func VerifyRequest(token string, config *GuardConfig) (*GuardResult, *GuardError) {
	minScore := config.MinScore
	if minScore == 0 {
		minScore = 0.7
	}

	verifier := NewTokenVerifier(config.Secret)
	claims, err := verifier.Verify(token)
	if err != nil {
		agentErr, ok := err.(*AgentAuthError)
		if ok {
			return nil, &GuardError{
				StatusCode: agentErr.StatusCode,
				Message:    agentErr.Message,
				ErrorType:  agentErr.ErrorType,
			}
		}
		return nil, &GuardError{StatusCode: 401, Message: err.Error(), ErrorType: "invalid_token"}
	}

	caps := claims.Capabilities
	avg := (caps.Reasoning + caps.Execution + caps.Autonomy + caps.Speed + caps.Consistency) / 5.0

	if avg < minScore {
		return nil, &GuardError{
			StatusCode: 403,
			Message:    fmt.Sprintf("insufficient capability score: %.2f < %.2f", avg, minScore),
			ErrorType:  "insufficient_score",
		}
	}

	headers := map[string]string{
		HeaderStatus:       "verified",
		HeaderScore:        fmt.Sprintf("%.2f", avg),
		HeaderModelFamily:  claims.ModelFamily,
		HeaderCapabilities: FormatCapabilities(claims.Capabilities),
		HeaderVersion:      claims.AgentAuthVersion,
		HeaderTokenExpires: fmt.Sprintf("%d", claims.Exp),
	}
	if len(claims.ChallengeIDs) > 0 {
		headers[HeaderChallengeID] = claims.ChallengeIDs[0]
	}

	return &GuardResult{Claims: claims, Headers: headers}, nil
}
