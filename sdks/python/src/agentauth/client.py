from __future__ import annotations

from typing import Callable, Awaitable, Optional

import httpx

from agentauth.crypto import hmac_sha256_hex
from agentauth.errors import AgentAuthError
from agentauth.types import (
    AgentAuthHeaders,
    AuthenticateResult,
    ChallengeResponse,
    Difficulty,
    ChallengeDimension,
    InitChallengeResponse,
    SolveResponse,
    SolverResult,
    VerifyTokenResponse,
)

_HEADER_MAP = {
    "agentauth-status": "status",
    "agentauth-score": "score",
    "agentauth-model-family": "model_family",
    "agentauth-pomi-confidence": "pomi_confidence",
    "agentauth-capabilities": "capabilities",
    "agentauth-version": "version",
    "agentauth-challenge-id": "challenge_id",
    "agentauth-token-expires": "token_expires",
}


def _extract_headers(response: httpx.Response) -> AgentAuthHeaders:
    data: dict = {}
    for header, field in _HEADER_MAP.items():
        value = response.headers.get(header)
        if value is not None:
            if field in ("score", "pomi_confidence"):
                data[field] = float(value)
            elif field == "token_expires":
                data[field] = int(value)
            else:
                data[field] = value
    return AgentAuthHeaders(**data)


class AgentAuthClient:
    def __init__(
        self,
        base_url: str,
        api_key: str | None = None,
        timeout: float = 30.0,
    ):
        self._base_url = base_url.rstrip("/")
        headers: dict[str, str] = {"Content-Type": "application/json"}
        if api_key:
            headers["X-API-Key"] = api_key
        self._http = httpx.AsyncClient(
            base_url=self._base_url,
            headers=headers,
            timeout=timeout,
        )

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        await self.close()

    async def close(self):
        await self._http.aclose()

    async def _check(self, resp: httpx.Response) -> None:
        if resp.status_code >= 400:
            try:
                data = resp.json()
                msg = data.get("detail", data.get("message", f"HTTP {resp.status_code}"))
                err_type = data.get("type")
            except Exception:
                msg = resp.text or f"HTTP {resp.status_code}"
                err_type = None
            raise AgentAuthError(msg, status=resp.status_code, error_type=err_type)

    async def init_challenge(
        self,
        difficulty: Difficulty | str = Difficulty.MEDIUM,
        dimensions: list[ChallengeDimension | str] | None = None,
    ) -> InitChallengeResponse:
        body: dict = {"difficulty": str(difficulty.value if isinstance(difficulty, Difficulty) else difficulty)}
        if dimensions:
            body["dimensions"] = [str(d.value if isinstance(d, ChallengeDimension) else d) for d in dimensions]

        resp = await self._http.post("/v1/challenge/init", json=body)
        await self._check(resp)
        return InitChallengeResponse(**resp.json())

    async def get_challenge(self, id: str, session_token: str) -> ChallengeResponse:
        resp = await self._http.get(
            f"/v1/challenge/{id}",
            headers={"Authorization": f"Bearer {session_token}"},
        )
        await self._check(resp)
        return ChallengeResponse(**resp.json())

    async def solve(
        self,
        id: str,
        answer: str,
        session_token: str,
        canary_responses: dict[str, str] | None = None,
        metadata: dict | None = None,
    ) -> SolveResponse:
        hmac = hmac_sha256_hex(answer, session_token)
        body: dict = {"answer": answer, "hmac": hmac}
        if canary_responses:
            body["canary_responses"] = canary_responses
        if metadata:
            body["metadata"] = metadata

        resp = await self._http.post(f"/v1/challenge/{id}/solve", json=body)
        await self._check(resp)
        return SolveResponse(**resp.json())

    async def verify_token(self, token: str) -> VerifyTokenResponse:
        resp = await self._http.get(
            "/v1/token/verify",
            headers={"Authorization": f"Bearer {token}"},
        )
        await self._check(resp)
        return VerifyTokenResponse(**resp.json())

    async def authenticate(
        self,
        solver: Callable[[ChallengeResponse], Awaitable[SolverResult]],
        difficulty: Difficulty | str = Difficulty.MEDIUM,
        dimensions: list[ChallengeDimension | str] | None = None,
    ) -> AuthenticateResult:
        init = await self.init_challenge(difficulty, dimensions)
        challenge = await self.get_challenge(init.id, init.session_token)
        solver_result = await solver(challenge)
        result = await self.solve(
            init.id,
            solver_result.answer,
            init.session_token,
            solver_result.canary_responses,
        )
        return AuthenticateResult(
            success=result.success,
            token=result.token,
            score=result.score,
            model_identity=result.model_identity,
            timing_analysis=result.timing_analysis,
            reason=result.reason,
        )
