import time

import jwt
from flask import Flask, g, jsonify

from xagentauth.middleware.flask import agentauth_required

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


def _create_app() -> Flask:
    app = Flask(__name__)
    app.config["TESTING"] = True

    @app.route("/protected")
    @agentauth_required(SECRET, min_score=0.7)
    def protected():
        return jsonify({"ok": True})

    @app.route("/with-claims")
    @agentauth_required(SECRET)
    def with_claims():
        claims = g.agentauth_claims
        return jsonify({"model": claims.model_family, "sub": claims.sub})

    return app


class TestFlaskGuard:
    def test_returns_401_without_token(self) -> None:
        app = _create_app()
        with app.test_client() as client:
            resp = client.get("/protected")
            assert resp.status_code == 401

    def test_returns_200_with_valid_token(self) -> None:
        app = _create_app()
        token = _sign_token()
        with app.test_client() as client:
            resp = client.get("/protected", headers={"Authorization": f"Bearer {token}"})
            assert resp.status_code == 200
            assert resp.get_json() == {"ok": True}

    def test_claims_accessible_via_g(self) -> None:
        app = _create_app()
        token = _sign_token()
        with app.test_client() as client:
            resp = client.get("/with-claims", headers={"Authorization": f"Bearer {token}"})
            assert resp.status_code == 200
            data = resp.get_json()
            assert data["model"] == "gpt-4"
            assert data["sub"] == "agent-123"
