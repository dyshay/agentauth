import time

import jwt
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from xagentauth.middleware.fastapi import agentauth_guard
from xagentauth.token import AgentAuthClaims

SECRET = "test-secret-key-for-agentauth"


def _sign_token(
    secret: str = SECRET,
    reasoning: float = 0.9,
    execution: float = 0.85,
    autonomy: float = 0.8,
    speed: float = 0.75,
    consistency: float = 0.88,
    **overrides: object,
) -> str:
    payload = {
        "sub": "agent-123",
        "iss": "agentauth",
        "iat": int(time.time()),
        "exp": int(time.time()) + 3600,
        "jti": "test-jti-001",
        "capabilities": {
            "reasoning": reasoning,
            "execution": execution,
            "autonomy": autonomy,
            "speed": speed,
            "consistency": consistency,
        },
        "model_family": "gpt-4",
        "challenge_ids": ["ch-001"],
        "agentauth_version": "1",
        **overrides,
    }
    return jwt.encode(payload, secret, algorithm="HS256")


app = FastAPI()


@app.get("/protected", dependencies=[Depends(agentauth_guard(SECRET))])
def protected_route():
    return {"ok": True}


@app.get("/with-claims")
def with_claims(claims: AgentAuthClaims = Depends(agentauth_guard(SECRET))):
    return {"model": claims.model_family, "sub": claims.sub}


client = TestClient(app)


class TestFastAPIGuard:
    def test_returns_401_without_token(self) -> None:
        resp = client.get("/protected")
        assert resp.status_code == 401

    def test_returns_401_with_invalid_token(self) -> None:
        resp = client.get("/protected", headers={"Authorization": "Bearer invalid.token"})
        assert resp.status_code == 401

    def test_returns_403_with_low_score(self) -> None:
        token = _sign_token(reasoning=0.1, execution=0.1, autonomy=0.1, speed=0.1, consistency=0.1)
        resp = client.get("/protected", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 403

    def test_returns_200_with_valid_token_and_sets_headers(self) -> None:
        token = _sign_token()
        resp = client.get("/protected", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        assert resp.json() == {"ok": True}
        assert resp.headers["AgentAuth-Status"] == "verified"
        assert resp.headers["AgentAuth-Model-Family"] == "gpt-4"
        assert "AgentAuth-Score" in resp.headers
