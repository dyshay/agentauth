package ginauth

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	xagentauth "github.com/dyshay/agentauth/sdks/go"
	"github.com/gin-gonic/gin"
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
			"consistency": 0.88,
		},
		"model_family":      "gpt-4",
		"challenge_ids":     []string{"ch-001"},
		"agentauth_version": "1",
	}
}

func validToken() string {
	return signTestToken(testSecret, defaultClaims())
}

func buildTestRouter() *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(AgentAuthMiddleware(xagentauth.GuardConfig{Secret: testSecret, MinScore: 0.7}))
	r.GET("/protected", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})
	r.GET("/claims", func(c *gin.Context) {
		claims := GetClaims(c)
		c.JSON(http.StatusOK, gin.H{
			"model": claims.ModelFamily,
			"sub":   claims.Sub,
		})
	})
	return r
}

func TestGinReturns401WithoutToken(t *testing.T) {
	r := buildTestRouter()
	req := httptest.NewRequest("GET", "/protected", nil)
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", w.Code)
	}
}

func TestGinReturns200WithValidToken(t *testing.T) {
	r := buildTestRouter()
	req := httptest.NewRequest("GET", "/protected", nil)
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", validToken()))
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
	if w.Header().Get("AgentAuth-Status") != "verified" {
		t.Error("expected AgentAuth-Status=verified header")
	}
}

func TestGinGetClaims(t *testing.T) {
	r := buildTestRouter()
	req := httptest.NewRequest("GET", "/claims", nil)
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", validToken()))
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)

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
