# xagentauth

**AgentAuth SDK for Go** — authenticate AI agents and protect your endpoints.

Zero external dependencies for the core module (stdlib only).

## Installation

```bash
go get github.com/dyshay/agentauth/sdks/go
```

With Gin middleware (separate module):
```bash
go get github.com/dyshay/agentauth/sdks/go/ginauth
```

## Client — Authenticate Agents

```go
package main

import (
    "fmt"
    "log"

    xagentauth "github.com/dyshay/agentauth/sdks/go"
)

func main() {
    client := xagentauth.NewClient(xagentauth.ClientConfig{
        BaseURL: "https://auth.example.com",
        APIKey:  "your-api-key",
    })

    solver := func(challenge xagentauth.ChallengeResponse) (string, map[string]string, error) {
        answer := solveChallenge(challenge.Payload)
        return answer, nil, nil
    }

    result, err := client.Authenticate(
        xagentauth.DifficultyMedium,
        []xagentauth.ChallengeDimension{xagentauth.DimensionReasoning},
        solver,
    )
    if err != nil {
        log.Fatalf("Authentication failed: %v", err)
    }

    fmt.Printf("Token: %s\n", *result.Token)
}
```

### Step-by-step API

```go
init, err := client.InitChallenge(xagentauth.DifficultyMedium, dimensions)
challenge, err := client.GetChallenge(init.ID, init.SessionToken)

answer := solveChallenge(challenge.Payload)

result, headers, err := client.Solve(init.ID, answer, init.SessionToken, nil, nil)
fmt.Printf("Token: %s\n", *result.Token)
```

## Server — Protect Endpoints

### Token Verification

Verify AgentAuth JWTs locally (no network round-trip, stdlib only):

```go
verifier := xagentauth.NewTokenVerifier("your-shared-secret")

// Verify signature, issuer, and expiration
claims, err := verifier.Verify(token)
fmt.Println(claims.ModelFamily)      // "gpt-4"
fmt.Println(claims.Capabilities)     // {Reasoning: 0.9, ...}

// Decode without verification (for inspection)
claims, err = verifier.Decode(token)
```

### Guard Logic

Framework-agnostic request verification with minimum score enforcement:

```go
config := &xagentauth.GuardConfig{Secret: "your-shared-secret", MinScore: 0.8}
result, guardErr := xagentauth.VerifyRequest(token, config)
if guardErr != nil {
    // guardErr.StatusCode is 401 (invalid token) or 403 (low score)
    log.Fatal(guardErr)
}

fmt.Println(result.Claims.ModelFamily)
fmt.Println(result.Headers) // {"AgentAuth-Status": "verified", ...}
```

### net/http Middleware

Standard library middleware, zero dependencies:

```go
package main

import (
    "fmt"
    "net/http"

    xagentauth "github.com/dyshay/agentauth/sdks/go"
)

func handler(w http.ResponseWriter, r *http.Request) {
    claims := xagentauth.ClaimsFromContext(r.Context())
    fmt.Fprintf(w, "Hello, agent %s", claims.ModelFamily)
}

func main() {
    mux := http.NewServeMux()
    mux.HandleFunc("/protected", handler)

    config := xagentauth.GuardConfig{Secret: "your-shared-secret", MinScore: 0.7}
    protected := xagentauth.AgentAuthMiddleware(config)(mux)

    http.ListenAndServe(":8080", protected)
}
```

### Gin Middleware

Separate module to avoid pulling Gin into the main package:

```go
package main

import (
    "net/http"

    "github.com/gin-gonic/gin"
    xagentauth "github.com/dyshay/agentauth/sdks/go"
    "github.com/dyshay/agentauth/sdks/go/ginauth"
)

func main() {
    r := gin.Default()

    config := xagentauth.GuardConfig{Secret: "your-shared-secret", MinScore: 0.7}
    r.Use(ginauth.AgentAuthMiddleware(config))

    r.GET("/protected", func(c *gin.Context) {
        claims := ginauth.GetClaims(c)
        c.JSON(http.StatusOK, gin.H{"model": claims.ModelFamily})
    })

    r.Run(":8080")
}
```

## Features

- **Zero Dependencies**: Core module uses only the Go standard library
- **Full Challenge Flow**: init, get, solve, verify, authenticate
- **Auto-HMAC**: Automatic HMAC-SHA256 computation for challenge responses
- **Header Parsing**: Extracts and parses all AgentAuth-* response headers
- **Type Safety**: Strongly-typed structs for all requests and responses
- **Error Handling**: Custom error types with detailed status codes
- **Local JWT Verification**: HS256 with constant-time signature comparison
- **net/http Middleware**: stdlib-only route protection with context claims
- **Gin Middleware**: separate submodule for Gin framework integration

## Testing

```bash
# Core module
go test -v ./...

# Gin middleware
cd ginauth && go test -v ./...
```

## License

MIT
