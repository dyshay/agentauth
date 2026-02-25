from __future__ import annotations

import asyncio
from typing import Callable, Awaitable, Optional, Type

from pydantic import BaseModel, Field

try:
    from langchain_core.tools import BaseTool
except ImportError:
    raise ImportError("langchain-core is required. Install with: pip install xagentauth[langchain]")

from xagentauth.client import AgentAuthClient
from xagentauth.types import ChallengeResponse, SolverResult


class AgentAuthInput(BaseModel):
    difficulty: str = Field(default="medium", description="Challenge difficulty: easy, medium, hard, adversarial")


class AgentAuthTool(BaseTool):
    """LangChain tool that authenticates an AI agent via the AgentAuth protocol."""

    name: str = "agentauth_authenticate"
    description: str = (
        "Authenticate this AI agent against an AgentAuth server. "
        "Returns a JWT token with capability scores if successful."
    )
    args_schema: Type[BaseModel] = AgentAuthInput

    base_url: str
    api_key: Optional[str] = None
    solver: Optional[Callable[[ChallengeResponse], Awaitable[SolverResult]]] = None

    model_config = {"arbitrary_types_allowed": True}

    def _run(self, difficulty: str = "medium") -> str:
        return asyncio.run(self._arun(difficulty))

    async def _arun(self, difficulty: str = "medium") -> str:
        if not self.solver:
            return "Error: No solver function provided to AgentAuthTool"

        async with AgentAuthClient(base_url=self.base_url, api_key=self.api_key) as client:
            result = await client.authenticate(
                solver=self.solver,
                difficulty=difficulty,
            )

        if result.success:
            return (
                f"Authentication successful. Token: {result.token}\n"
                f"Scores: reasoning={result.score.reasoning}, "
                f"execution={result.score.execution}, "
                f"autonomy={result.score.autonomy}"
            )
        else:
            return f"Authentication failed: {result.reason}"
