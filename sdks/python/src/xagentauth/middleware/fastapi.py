from __future__ import annotations

from typing import Callable

from fastapi import Depends, HTTPException, Request, Response
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from xagentauth.errors import AgentAuthError
from xagentauth.guard import GuardConfig, verify_request
from xagentauth.token import AgentAuthClaims

_bearer_scheme = HTTPBearer(auto_error=False)


def agentauth_guard(secret: str, min_score: float = 0.7) -> Callable[..., AgentAuthClaims]:
    """FastAPI dependency that extracts and verifies a Bearer AgentAuth token.

    Usage::

        @app.get("/protected", dependencies=[Depends(agentauth_guard("secret"))])
        def protected():
            return {"ok": True}

        @app.get("/with-claims")
        def with_claims(claims: AgentAuthClaims = Depends(agentauth_guard("secret"))):
            return {"model": claims.model_family}
    """
    config = GuardConfig(secret=secret, min_score=min_score)

    async def _dependency(
        request: Request,
        response: Response,
        credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
    ) -> AgentAuthClaims:
        if credentials is None:
            raise HTTPException(status_code=401, detail="Missing AgentAuth token")

        try:
            result = verify_request(credentials.credentials, config)
        except AgentAuthError as e:
            raise HTTPException(status_code=e.status, detail=str(e)) from e

        for name, value in result.headers.items():
            response.headers[name] = value

        return result.claims

    return _dependency
