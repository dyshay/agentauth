# xagentauth

**AgentAuth SDK for Python** — authenticate AI agents and protect your endpoints.

## Installation

```bash
pip install xagentauth
```

With framework integrations:
```bash
pip install xagentauth[fastapi]    # FastAPI middleware
pip install xagentauth[flask]      # Flask middleware
pip install xagentauth[langchain]  # LangChain tools
pip install xagentauth[crewai]     # CrewAI tools
pip install xagentauth[all]        # Everything
```

## Client — Authenticate Agents

```python
import asyncio
from xagentauth import AgentAuthClient

async def main():
    client = AgentAuthClient(
        base_url="https://api.example.com",
        api_key="ak_...",
    )

    # One-call flow: init -> get -> solve
    result = await client.authenticate(
        difficulty="medium",
        solver=my_solver,
    )

    print(f"Token: {result.token}")
    print(f"Score: {result.score}")

asyncio.run(main())
```

### Step-by-step API

```python
init = await client.init_challenge(difficulty="hard")
challenge = await client.get_challenge(init.id, init.session_token)

answer = await compute_answer(challenge.payload)

result = await client.solve(init.id, answer, init.session_token)
print(f"Token: {result.token}")
```

## Server — Protect Endpoints

### Token Verification

Verify AgentAuth JWTs locally (no network round-trip):

```python
from xagentauth import TokenVerifier, AgentAuthClaims

verifier = TokenVerifier(secret="your-shared-secret")

# Verify signature, issuer, and expiration
claims: AgentAuthClaims = verifier.verify(token)
print(claims.model_family)       # "gpt-4"
print(claims.capabilities)       # AgentCapabilityScore(reasoning=0.9, ...)
print(claims.challenge_ids)      # ["ch-001"]

# Decode without verification (for inspection)
claims = verifier.decode(token)
```

### Guard Logic

Framework-agnostic request verification with minimum score enforcement:

```python
from xagentauth import GuardConfig, GuardResult, verify_request

config = GuardConfig(secret="your-shared-secret", min_score=0.8)
result: GuardResult = verify_request(token, config)

print(result.claims.model_family)  # "gpt-4"
print(result.headers)              # {"AgentAuth-Status": "verified", ...}
```

### FastAPI Middleware

```python
from fastapi import FastAPI, Depends
from xagentauth.middleware.fastapi import agentauth_guard
from xagentauth import AgentAuthClaims

app = FastAPI()

# As a dependency — returns claims
@app.get("/api/data")
async def get_data(claims: AgentAuthClaims = Depends(agentauth_guard("secret"))):
    return {"model": claims.model_family}

# As a route dependency — just protects the route
@app.get("/api/protected", dependencies=[Depends(agentauth_guard("secret", min_score=0.8))])
async def protected():
    return {"status": "ok"}
```

### Flask Middleware

```python
from flask import Flask, g, jsonify
from xagentauth.middleware.flask import agentauth_required

app = Flask(__name__)

@app.route("/api/data")
@agentauth_required("secret", min_score=0.8)
def get_data():
    claims = g.agentauth_claims
    return jsonify({"model": claims.model_family})
```

## Features

- Async-first client with `httpx`
- Full challenge flow: init -> get -> solve -> verify
- Auto-HMAC computation on solve requests
- AgentAuth response header parsing
- Pydantic models for type safety
- LangChain and CrewAI tool integrations
- **Local JWT verification** (HS256, no network call)
- **FastAPI guard dependency** with claims extraction
- **Flask decorator** with `g.agentauth_claims` access

## License

MIT
