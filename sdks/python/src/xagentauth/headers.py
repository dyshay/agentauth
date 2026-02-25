from __future__ import annotations

from xagentauth.types import AgentCapabilityScore

AGENTAUTH_HEADERS = {
    "STATUS": "AgentAuth-Status",
    "SCORE": "AgentAuth-Score",
    "MODEL_FAMILY": "AgentAuth-Model-Family",
    "POMI_CONFIDENCE": "AgentAuth-PoMI-Confidence",
    "CAPABILITIES": "AgentAuth-Capabilities",
    "VERSION": "AgentAuth-Version",
    "CHALLENGE_ID": "AgentAuth-Challenge-Id",
    "TOKEN_EXPIRES": "AgentAuth-Token-Expires",
}


def format_capabilities(score: AgentCapabilityScore) -> str:
    """Format capability scores as a comma-separated key=value string.

    Example: "reasoning=0.9,execution=0.85,autonomy=0.8,speed=0.75,consistency=0.88"
    """
    return (
        f"reasoning={score.reasoning},"
        f"execution={score.execution},"
        f"autonomy={score.autonomy},"
        f"speed={score.speed},"
        f"consistency={score.consistency}"
    )


def parse_capabilities(header: str) -> dict[str, float]:
    """Parse a capabilities header string into a dict of dimension -> score.

    Example: "reasoning=0.9,execution=0.85" -> {"reasoning": 0.9, "execution": 0.85}
    """
    result: dict[str, float] = {}
    for part in header.split(","):
        if "=" in part:
            key, val = part.split("=", 1)
            try:
                result[key.strip()] = float(val.strip())
            except ValueError:
                continue
    return result
