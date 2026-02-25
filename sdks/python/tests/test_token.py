import time

import jwt
import pytest

from xagentauth.errors import AgentAuthError
from xagentauth.token import AgentAuthClaims, TokenVerifier

SECRET = "test-secret-key-for-agentauth"

CLAIMS_PAYLOAD = {
    "sub": "agent-123",
    "iss": "agentauth",
    "iat": int(time.time()),
    "exp": int(time.time()) + 3600,
    "jti": "test-jti-001",
    "capabilities": {
        "reasoning": 0.9,
        "execution": 0.85,
        "autonomy": 0.8,
        "speed": 0.75,
        "consistency": 0.88,
    },
    "model_family": "gpt-4",
    "challenge_ids": ["ch-001", "ch-002"],
    "agentauth_version": "1",
}


def _sign_token(secret: str = SECRET, **overrides: object) -> str:
    payload = {**CLAIMS_PAYLOAD, **overrides}
    return jwt.encode(payload, secret, algorithm="HS256")


class TestTokenVerifier:
    def test_verify_valid_token(self) -> None:
        token = _sign_token()
        verifier = TokenVerifier(SECRET)
        claims = verifier.verify(token)

        assert isinstance(claims, AgentAuthClaims)
        assert claims.sub == "agent-123"
        assert claims.iss == "agentauth"
        assert claims.model_family == "gpt-4"
        assert claims.capabilities.reasoning == 0.9
        assert claims.challenge_ids == ["ch-001", "ch-002"]
        assert claims.agentauth_version == "1"

    def test_verify_expired_token_raises(self) -> None:
        token = _sign_token(exp=int(time.time()) - 100)
        verifier = TokenVerifier(SECRET)

        with pytest.raises(AgentAuthError, match="expired"):
            verifier.verify(token)

    def test_verify_wrong_secret_raises(self) -> None:
        token = _sign_token()
        verifier = TokenVerifier("wrong-secret")

        with pytest.raises(AgentAuthError, match="signature"):
            verifier.verify(token)

    def test_verify_wrong_issuer_raises(self) -> None:
        token = _sign_token(iss="not-agentauth")
        verifier = TokenVerifier(SECRET)

        with pytest.raises(AgentAuthError, match="issuer"):
            verifier.verify(token)

    def test_decode_without_verification(self) -> None:
        token = _sign_token(secret="different-secret")
        verifier = TokenVerifier(SECRET)

        claims = verifier.decode(token)
        assert claims.sub == "agent-123"
        assert claims.model_family == "gpt-4"
