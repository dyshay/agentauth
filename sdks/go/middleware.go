package xagentauth

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
)

type contextKey string

const claimsKey contextKey = "agentauth_claims"

// AgentAuthMiddleware returns an http.Handler middleware that validates
// AgentAuth Bearer tokens.
//
// Usage:
//
//	mux := http.NewServeMux()
//	mux.HandleFunc("/api/data", handler)
//	protected := xagentauth.AgentAuthMiddleware(xagentauth.GuardConfig{
//	    Secret:   "my-secret",
//	    MinScore: 0.7,
//	})(mux)
//	http.ListenAndServe(":8080", protected)
func AgentAuthMiddleware(config GuardConfig) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if !strings.HasPrefix(authHeader, "Bearer ") {
				writeJSONError(w, http.StatusUnauthorized, "Missing AgentAuth token")
				return
			}

			token := authHeader[7:]
			result, guardErr := VerifyRequest(token, &config)
			if guardErr != nil {
				writeJSONError(w, guardErr.StatusCode, guardErr.Message)
				return
			}

			// Set AgentAuth response headers
			for name, value := range result.Headers {
				w.Header().Set(name, value)
			}

			// Store claims in request context
			ctx := context.WithValue(r.Context(), claimsKey, result.Claims)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// ClaimsFromContext extracts AgentAuth claims from the request context.
// Returns nil if no claims are present (middleware not applied or auth failed).
func ClaimsFromContext(ctx context.Context) *AgentAuthClaims {
	claims, _ := ctx.Value(claimsKey).(*AgentAuthClaims)
	return claims
}

func writeJSONError(w http.ResponseWriter, status int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"error":  message,
		"status": status,
	})
}
