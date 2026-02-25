# xagentauth

AgentAuth client SDK for Go — authenticate AI agents against any AgentAuth-compatible server.

## Description

This Go SDK provides a complete client implementation for the AgentAuth protocol, enabling AI agents to authenticate through cryptographic challenges. It supports the full challenge-response flow with automatic HMAC computation, header parsing, and error handling.

## Installation

```bash
go get github.com/dyshay/agentauth/sdks/go
```

## Quickstart

```go
package main

import (
    "fmt"
    "log"

    "github.com/dyshay/agentauth/sdks/go"
)

func main() {
    // Create client
    client := xagentauth.NewClient(xagentauth.ClientConfig{
        BaseURL:   "https://auth.example.com",
        APIKey:    "your-api-key",
        TimeoutMs: 30000,
    })

    // Define a solver function
    solver := func(challenge xagentauth.ChallengeResponse) (string, map[string]string, error) {
        // Your agent's logic to solve the challenge
        answer := solveChallenge(challenge.Payload)
        return answer, nil, nil
    }

    // Authenticate
    result, err := client.Authenticate(
        xagentauth.DifficultyMedium,
        []xagentauth.ChallengeDimension{
            xagentauth.DimensionReasoning,
            xagentauth.DimensionExecution,
        },
        solver,
    )
    if err != nil {
        log.Fatalf("Authentication failed: %v", err)
    }

    if result.Success {
        fmt.Printf("Authenticated! Token: %s\n", *result.Token)
        fmt.Printf("Capability Scores: %+v\n", result.Score)
    } else {
        fmt.Printf("Authentication failed: %s\n", *result.Reason)
    }
}

func solveChallenge(payload xagentauth.ChallengePayload) string {
    // Implement your challenge-solving logic here
    return "computed-answer"
}
```

## Step-by-Step API Usage

```go
package main

import (
    "fmt"
    "log"

    "github.com/dyshay/agentauth/sdks/go"
)

func main() {
    // Create client
    client := xagentauth.NewClient(xagentauth.ClientConfig{
        BaseURL: "https://auth.example.com",
        APIKey:  "your-api-key",
    })

    // Step 1: Initialize challenge
    initResp, err := client.InitChallenge(
        xagentauth.DifficultyMedium,
        []xagentauth.ChallengeDimension{
            xagentauth.DimensionReasoning,
            xagentauth.DimensionExecution,
        },
    )
    if err != nil {
        log.Fatalf("Failed to initialize challenge: %v", err)
    }

    fmt.Printf("Challenge ID: %s\n", initResp.ID)
    fmt.Printf("Session Token: %s\n", initResp.SessionToken)

    // Step 2: Get challenge details
    challenge, err := client.GetChallenge(initResp.ID, initResp.SessionToken)
    if err != nil {
        log.Fatalf("Failed to get challenge: %v", err)
    }

    fmt.Printf("Challenge Type: %s\n", challenge.Payload.Type)
    fmt.Printf("Instructions: %s\n", challenge.Payload.Instructions)

    // Step 3: Solve the challenge
    answer := solveChallenge(challenge.Payload)

    // Step 4: Submit solution
    solveResp, headers, err := client.Solve(
        initResp.ID,
        answer,
        initResp.SessionToken,
        nil, // canary responses
        nil, // metadata
    )
    if err != nil {
        log.Fatalf("Failed to submit solution: %v", err)
    }

    if solveResp.Success {
        fmt.Printf("Success! Token: %s\n", *solveResp.Token)
        fmt.Printf("Scores: %+v\n", solveResp.Score)
        fmt.Printf("Headers: %+v\n", headers)
    } else {
        fmt.Printf("Failed: %s\n", *solveResp.Reason)
    }
}

func solveChallenge(payload xagentauth.ChallengePayload) string {
    // Implement your challenge-solving logic here
    return "computed-answer"
}
```

## Features

- **Zero Dependencies**: Uses only the Go standard library
- **Full Challenge Flow**: Complete implementation of init, get, and solve endpoints
- **Auto-HMAC**: Automatic HMAC-SHA256 computation for challenge responses
- **Header Parsing**: Extracts and parses all AgentAuth-* response headers
- **Type Safety**: Strongly-typed structs for all requests and responses
- **Error Handling**: Custom error types with detailed status codes and messages
- **Configurable Timeouts**: Set custom HTTP timeouts per client
- **Token Verification**: Built-in support for token verification endpoint

## API Reference

### Client Creation

```go
client := xagentauth.NewClient(xagentauth.ClientConfig{
    BaseURL:   "https://auth.example.com",
    APIKey:    "your-api-key",
    TimeoutMs: 30000, // optional, defaults to 30000ms
})
```

### Challenge Methods

#### InitChallenge
Initialize a new challenge with specified difficulty and dimensions.

```go
resp, err := client.InitChallenge(
    xagentauth.DifficultyMedium,
    []xagentauth.ChallengeDimension{
        xagentauth.DimensionReasoning,
        xagentauth.DimensionExecution,
    },
)
```

#### GetChallenge
Retrieve challenge details using the challenge ID and session token.

```go
challenge, err := client.GetChallenge(challengeID, sessionToken)
```

#### Solve
Submit a solution to a challenge (HMAC is computed automatically).

```go
solveResp, headers, err := client.Solve(
    challengeID,
    answer,
    sessionToken,
    canaryResponses, // map[string]string or nil
    metadata,        // *SolveMetadata or nil
)
```

#### Authenticate
Perform the complete authentication flow in one call.

```go
result, err := client.Authenticate(
    difficulty,
    dimensions,
    solverFunc,
)
```

### Types

**Difficulty Levels**:
- `DifficultyEasy`
- `DifficultyMedium`
- `DifficultyHard`
- `DifficultyAdversarial`

**Challenge Dimensions**:
- `DimensionReasoning`
- `DimensionExecution`
- `DimensionMemory`
- `DimensionAmbiguity`

**Solver Function**:
```go
type SolverFunc func(ChallengeResponse) (string, map[string]string, error)
```

## Error Handling

The SDK provides detailed error information through the `AgentAuthError` type:

```go
result, err := client.Authenticate(difficulty, dimensions, solver)
if err != nil {
    if agentAuthErr, ok := err.(*xagentauth.AgentAuthError); ok {
        fmt.Printf("Status Code: %d\n", agentAuthErr.StatusCode)
        fmt.Printf("Message: %s\n", agentAuthErr.Message)
        fmt.Printf("Error Type: %s\n", agentAuthErr.ErrorType)
    }
    return
}
```

## Testing

Run the test suite:

```bash
go test -v
```

Run specific tests:

```bash
go test -v -run TestAuthenticate
```

## License

MIT
