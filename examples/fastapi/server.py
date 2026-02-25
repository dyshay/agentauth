"""
AgentAuth FastAPI Example

Minimal FastAPI server that protects endpoints with AgentAuth.
Uses the Python SDK to handle the challenge flow.
"""

import os
import json
import hmac
import hashlib
from typing import Optional

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel

app = FastAPI(title="AgentAuth FastAPI Example")

# In-memory challenge store (use Redis in production)
challenges: dict[str, dict] = {}

SECRET = os.getenv("AGENTAUTH_SECRET", "dev-secret-at-least-32-bytes-long!!")


class InitRequest(BaseModel):
    difficulty: str = "medium"
    dimensions: list[str] = []


class SolveRequest(BaseModel):
    answer: str
    hmac: str
    metadata: Optional[dict] = None


def compute_hmac(message: str, key: str) -> str:
    return hmac.new(key.encode(), message.encode(), hashlib.sha256).hexdigest()


@app.post("/v1/challenge/init", status_code=201)
async def init_challenge(body: InitRequest):
    """Create a new challenge session."""
    import secrets
    import time

    challenge_id = f"ch_{secrets.token_hex(12)}"
    session_token = f"st_{secrets.token_hex(16)}"
    now = int(time.time())
    ttl = 30

    challenges[challenge_id] = {
        "id": challenge_id,
        "session_token": session_token,
        "difficulty": body.difficulty,
        "created_at": now,
        "expires_at": now + ttl,
        "payload": {
            "type": "demo",
            "instructions": "Return the SHA-256 hash of the word 'agentauth'",
            "data": "",
            "steps": 1,
        },
        "answer_hash": hashlib.sha256(
            hashlib.sha256(b"agentauth").hexdigest().encode()
        ).hexdigest(),
    }

    return {
        "id": challenge_id,
        "session_token": session_token,
        "expires_at": now + ttl,
        "ttl_seconds": ttl,
    }


@app.get("/v1/challenge/{challenge_id}")
async def get_challenge(challenge_id: str, authorization: str = Header()):
    """Retrieve challenge payload."""
    if not authorization.startswith("Bearer "):
        raise HTTPException(401, "Missing Bearer token")

    token = authorization[7:]
    ch = challenges.get(challenge_id)
    if not ch or ch["session_token"] != token:
        raise HTTPException(404, "Challenge not found")

    return {
        "id": ch["id"],
        "payload": ch["payload"],
        "difficulty": ch["difficulty"],
        "created_at": ch["created_at"],
        "expires_at": ch["expires_at"],
    }


@app.post("/v1/challenge/{challenge_id}/solve")
async def solve_challenge(challenge_id: str, body: SolveRequest):
    """Submit a challenge solution."""
    ch = challenges.pop(challenge_id, None)
    if not ch:
        return {"success": False, "reason": "expired"}

    expected_hmac = compute_hmac(body.answer, ch["session_token"])
    if not hmac.compare_digest(expected_hmac, body.hmac):
        return {"success": False, "reason": "invalid_hmac"}

    answer_hash = hashlib.sha256(body.answer.encode()).hexdigest()
    if answer_hash != ch["answer_hash"]:
        return {"success": False, "reason": "wrong_answer"}

    return {
        "success": True,
        "token": "demo-jwt-token",
        "score": {
            "reasoning": 0.9,
            "execution": 0.95,
            "autonomy": 0.9,
            "speed": 0.85,
            "consistency": 0.9,
        },
    }


@app.get("/api/data")
async def protected_data(authorization: str = Header()):
    """Protected endpoint — requires AgentAuth JWT."""
    if not authorization.startswith("Bearer "):
        raise HTTPException(401, "Missing AgentAuth token")

    # In production, verify the JWT using the AgentAuth Python SDK:
    #   from xagentauth import AgentAuthClient
    #   client = AgentAuthClient(base_url="...")
    #   result = client.verify_token(token)

    return {
        "message": "You are a verified AI agent!",
        "data": {"secret": 42},
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3000)
