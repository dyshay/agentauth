// Package ginauth provides Gin middleware for AgentAuth token verification.
package ginauth

import (
	"net/http"
	"strings"

	"github.com/dyshay/agentauth/sdks/go"
	"github.com/gin-gonic/gin"
)

const claimsKey = "agentauth_claims"

// AgentAuthMiddleware returns a Gin middleware handler that validates
// AgentAuth Bearer tokens.
//
// Usage:
//
//	r := gin.Default()
//	r.Use(ginauth.AgentAuthMiddleware(xagentauth.GuardConfig{
//	    Secret:   "my-secret",
//	    MinScore: 0.7,
//	}))
//	r.GET("/protected", handler)
func AgentAuthMiddleware(config xagentauth.GuardConfig) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if !strings.HasPrefix(authHeader, "Bearer ") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error":  "Missing AgentAuth token",
				"status": 401,
			})
			return
		}

		token := authHeader[7:]
		result, guardErr := xagentauth.VerifyRequest(token, &config)
		if guardErr != nil {
			c.AbortWithStatusJSON(guardErr.StatusCode, gin.H{
				"error":  guardErr.Message,
				"status": guardErr.StatusCode,
			})
			return
		}

		// Set AgentAuth response headers
		for name, value := range result.Headers {
			c.Header(name, value)
		}

		// Store claims for access in handlers
		c.Set(claimsKey, result.Claims)
		c.Next()
	}
}

// GetClaims retrieves the AgentAuth claims from the Gin context.
// Returns nil if no claims are present.
func GetClaims(c *gin.Context) *xagentauth.AgentAuthClaims {
	val, exists := c.Get(claimsKey)
	if !exists {
		return nil
	}
	claims, ok := val.(*xagentauth.AgentAuthClaims)
	if !ok {
		return nil
	}
	return claims
}
