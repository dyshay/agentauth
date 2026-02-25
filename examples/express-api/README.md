# Express API Example

Minimal Express server with AgentAuth middleware.

## Setup

```bash
pnpm install
pnpm dev
```

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/v1/challenge/init` | Create a challenge session |
| GET | `/v1/challenge/:id` | Retrieve challenge (Bearer session_token) |
| POST | `/v1/challenge/:id/solve` | Submit answer + HMAC |
| GET | `/v1/token/verify` | Verify a JWT token |
| GET | `/api/data` | Protected endpoint (Bearer agentauth_jwt) |

## Quick Test

```bash
# 1. Create a challenge
curl -s -X POST http://localhost:3000/v1/challenge/init \
  -H "Content-Type: application/json" \
  -d '{"difficulty": "easy"}'

# 2. Retrieve the challenge payload (use session_token from step 1)
curl -s http://localhost:3000/v1/challenge/CH_ID \
  -H "Authorization: Bearer SESSION_TOKEN"

# 3. Solve and get JWT (compute answer + HMAC)
curl -s -X POST http://localhost:3000/v1/challenge/CH_ID/solve \
  -H "Content-Type: application/json" \
  -d '{"answer": "...", "hmac": "..."}'

# 4. Access protected endpoint
curl -s http://localhost:3000/api/data \
  -H "Authorization: Bearer JWT_TOKEN"
```
