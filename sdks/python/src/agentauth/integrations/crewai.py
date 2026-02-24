from __future__ import annotations

import asyncio
from typing import Callable, Awaitable, Optional, Type

from pydantic import BaseModel, Field

try:
    from crewai_tools import BaseTool as CrewAIBaseTool
except ImportError:
    raise ImportError("crewai-tools is required. Install with: pip install agentauth[crewai]")

from agentauth.client import AgentAuthClient
from agentauth.types import ChallengeResponse, SolverResult


class AgentAuthToolInput(BaseModel):
    difficulty: str = Field(default="medium", description="Challenge difficulty level")


class AgentAuthTool(CrewAIBaseTool):
    """CrewAI tool that authenticates an AI agent via the AgentAuth protocol."""

    name: str = "AgentAuth Authenticate"
    description: str = (
        "Authenticate this AI agent against an AgentAuth server to prove capabilities. "
        "Returns a JWT token with capability scores."
    )
    args_schema: Type[BaseModel] = AgentAuthToolInput

    base_url: str
    api_key: Optional[str] = None
    solver: Optional[Callable[[ChallengeResponse], Awaitable[SolverResult]]] = None

    model_config = {"arbitrary_types_allowed": True}

    def _run(self, difficulty: str = "medium") -> str:
        return asyncio.run(self._async_run(difficulty))

    async def _async_run(self, difficulty: str = "medium") -> str:
        if not self.solver:
            return "Error: No solver function provided"

        async with AgentAuthClient(base_url=self.base_url, api_key=self.api_key) as client:
            result = await client.authenticate(
                solver=self.solver,
                difficulty=difficulty,
            )

        if result.success:
            return (
                f"Authenticated. Token: {result.token}\n"
                f"Reasoning: {result.score.reasoning}, "
                f"Execution: {result.score.execution}, "
                f"Autonomy: {result.score.autonomy}"
            )
        return f"Failed: {result.reason}"
