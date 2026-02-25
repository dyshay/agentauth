import time

import jwt
import pytest

from xagentauth.errors import AgentAuthError
from xagentauth.guard import GuardConfig, GuardResult, verify_request

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


class TestVerifyRequest:
    def test_valid_token_with_sufficient_score(self) -> None:
        token = _sign_token()
        config = GuardConfig(secret=SECRET, min_score=0.7)
        result = verify_request(token, config)

        assert isinstance(result, GuardResult)
        assert result.claims.sub == "agent-123"
        assert result.headers["AgentAuth-Status"] == "verified"
        assert result.headers["AgentAuth-Model-Family"] == "gpt-4"
        assert "AgentAuth-Capabilities" in result.headers
        assert "reasoning=0.9" in result.headers["AgentAuth-Capabilities"]

    def test_valid_token_with_insufficient_score_raises_403(self) -> None:
        token = _sign_token(reasoning=0.1, execution=0.1, autonomy=0.1, speed=0.1, consistency=0.1)
        config = GuardConfig(secret=SECRET, min_score=0.7)

        with pytest.raises(AgentAuthError, match="Insufficient capability score") as exc_info:
            verify_request(token, config)
        assert exc_info.value.status == 403

    def test_invalid_token_raises_401(self) -> None:
        config = GuardConfig(secret=SECRET, min_score=0.7)

        with pytest.raises(AgentAuthError) as exc_info:
            verify_request("invalid.token.here", config)
        assert exc_info.value.status == 401
