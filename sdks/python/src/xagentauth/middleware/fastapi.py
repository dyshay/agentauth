from __future__ import annotations

from typing import Any, Callable, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from xagentauth.engine import AgentAuthEngine
from xagentauth.errors import AgentAuthError
from xagentauth.guard import GuardConfig, verify_request
from xagentauth.token import AgentAuthClaims
from xagentauth.types import AgentAuthConfig, InitChallengeOptions, SolveInput

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


def create_challenge_router(config: AgentAuthConfig) -> APIRouter:
    """Create a FastAPI APIRouter with challenge endpoints.

    Usage::

        from xagentauth.middleware.fastapi import create_challenge_router

        router = create_challenge_router(config)
        app.include_router(router, prefix="/agentauth")
    """
    engine = AgentAuthEngine(config)
    router = APIRouter()

    @router.post("/challenge")
    async def init_challenge(request: Request) -> Any:
        try:
            body = await request.json() if request.headers.get("content-type", "").startswith("application/json") else {}
        except Exception:
            body = {}
        options = InitChallengeOptions(
            difficulty=body.get("difficulty"),
            dimensions=body.get("dimensions"),
        )
        result = await engine.init_challenge(options)
        return result.model_dump()

    @router.get("/challenge/{challenge_id}")
    async def get_challenge(challenge_id: str, request: Request) -> Any:
        auth_header = request.headers.get("authorization", "")
        if not auth_header.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")

        session_token = auth_header[7:]
        challenge = await engine.get_challenge(challenge_id, session_token)
        if not challenge:
            raise HTTPException(status_code=404, detail=f"Challenge {challenge_id} not found or invalid session token")

        return challenge

    @router.post("/challenge/{challenge_id}/solve")
    async def solve_challenge(challenge_id: str, request: Request) -> Any:
        body = await request.json()
        if not body.get("answer") or not body.get("hmac"):
            raise HTTPException(status_code=400, detail="Missing answer or hmac in request body")

        solve_input = SolveInput(
            answer=body["answer"],
            hmac=body["hmac"],
            canary_responses=body.get("canary_responses"),
            metadata=body.get("metadata"),
            client_rtt_ms=body.get("client_rtt_ms"),
            step_timings=body.get("step_timings"),
        )
        result = await engine.solve_challenge(challenge_id, solve_input)
        return result.model_dump(exclude_none=True)

    @router.get("/verify")
    async def verify_token(request: Request) -> Any:
        auth_header = request.headers.get("authorization", "")
        if not auth_header.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Missing token")

        token = auth_header[7:]
        result = await engine.verify_token(token)
        return result.model_dump(exclude_none=True)

    return router
