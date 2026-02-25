from __future__ import annotations

import jwt
from pydantic import BaseModel

from xagentauth.errors import AgentAuthError
from xagentauth.types import AgentCapabilityScore


class AgentAuthClaims(BaseModel):
    sub: str
    iss: str
    iat: int
    exp: int
    jti: str
    capabilities: AgentCapabilityScore
    model_family: str
    challenge_ids: list[str]
    agentauth_version: str


class TokenVerifier:
    def __init__(self, secret: str) -> None:
        self._secret = secret

    def verify(self, token: str) -> AgentAuthClaims:
        """Verify JWT signature, issuer, and expiration. Returns claims on success."""
        try:
            payload = jwt.decode(
                token,
                self._secret,
                algorithms=["HS256"],
                issuer="agentauth",
                options={"require": ["exp", "iss", "sub", "iat", "jti"]},
            )
            return AgentAuthClaims(**payload)
        except jwt.ExpiredSignatureError as e:
            raise AgentAuthError("Token has expired", status=401, error_type="token_expired") from e
        except jwt.InvalidIssuerError as e:
            raise AgentAuthError("Invalid token issuer", status=401, error_type="invalid_issuer") from e
        except jwt.InvalidSignatureError as e:
            raise AgentAuthError("Invalid token signature", status=401, error_type="invalid_signature") from e
        except jwt.PyJWTError as e:
            raise AgentAuthError(f"Invalid token: {e}", status=401, error_type="invalid_token") from e

    def decode(self, token: str) -> AgentAuthClaims:
        """Decode JWT without signature verification. Useful for inspecting tokens."""
        try:
            payload = jwt.decode(
                token,
                options={"verify_signature": False, "verify_exp": False},
                algorithms=["HS256"],
            )
            return AgentAuthClaims(**payload)
        except jwt.PyJWTError as e:
            raise AgentAuthError(f"Failed to decode token: {e}", status=400, error_type="decode_error") from e
