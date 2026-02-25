package xagentauth

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
)

func protectedHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"ok": true})
}

func claimsHandler(w http.ResponseWriter, r *http.Request) {
	claims := ClaimsFromContext(r.Context())
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"model": claims.ModelFamily,
		"sub":   claims.Sub,
	})
}

func buildTestServer() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/protected", protectedHandler)
	mux.HandleFunc("/claims", claimsHandler)
	return AgentAuthMiddleware(GuardConfig{Secret: testSecret, MinScore: 0.7})(mux)
}

func TestMiddlewareReturns401WithoutToken(t *testing.T) {
	server := buildTestServer()
	req := httptest.NewRequest("GET", "/protected", nil)
	w := httptest.NewRecorder()

	server.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", w.Code)
	}
}

func TestMiddlewareReturns200WithValidToken(t *testing.T) {
	server := buildTestServer()
	token := signGuardToken(0.9, 0.85, 0.8, 0.75, 0.88)
	req := httptest.NewRequest("GET", "/protected", nil)
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
	w := httptest.NewRecorder()

	server.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
	if w.Header().Get("AgentAuth-Status") != "verified" {
		t.Error("expected AgentAuth-Status=verified header")
	}
	if w.Header().Get("AgentAuth-Model-Family") != "gpt-4" {
		t.Error("expected AgentAuth-Model-Family=gpt-4 header")
	}
}

func TestMiddlewareClaimsFromContext(t *testing.T) {
	server := buildTestServer()
	token := signGuardToken(0.9, 0.85, 0.8, 0.75, 0.88)
	req := httptest.NewRequest("GET", "/claims", nil)
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
	w := httptest.NewRecorder()

	server.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}

	var body map[string]string
	json.NewDecoder(w.Body).Decode(&body)
	if body["model"] != "gpt-4" {
		t.Errorf("expected model=gpt-4, got %s", body["model"])
	}
	if body["sub"] != "agent-123" {
		t.Errorf("expected sub=agent-123, got %s", body["sub"])
	}
}
