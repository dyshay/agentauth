package xagentauth

import "fmt"

// AgentAuthError represents an error from the AgentAuth API.
type AgentAuthError struct {
	StatusCode int
	Message    string
	ErrorType  string
}

// Error implements the error interface.
func (e *AgentAuthError) Error() string {
	if e.ErrorType != "" {
		return fmt.Sprintf("AgentAuth error [%d] %s: %s", e.StatusCode, e.ErrorType, e.Message)
	}
	return fmt.Sprintf("AgentAuth error [%d]: %s", e.StatusCode, e.Message)
}

// NewAgentAuthError creates a new AgentAuthError.
func NewAgentAuthError(statusCode int, message, errorType string) *AgentAuthError {
	return &AgentAuthError{
		StatusCode: statusCode,
		Message:    message,
		ErrorType:  errorType,
	}
}
