from __future__ import annotations

from dataclasses import dataclass, field

from xagentauth.errors import AgentAuthError
from xagentauth.headers import format_capabilities
from xagentauth.token import AgentAuthClaims, TokenVerifier


@dataclass
class GuardConfig:
    secret: str
    min_score: float = 0.7


@dataclass
class GuardResult:
    claims: AgentAuthClaims
    headers: dict[str, str] = field(default_factory=dict)


def verify_request(token: str, config: GuardConfig) -> GuardResult:
    """Verify a Bearer token and check the minimum capability score.

    Raises AgentAuthError with status=401 for invalid tokens
    and status=403 for insufficient scores.
    """
    verifier = TokenVerifier(config.secret)
    claims = verifier.verify(token)

    caps = claims.capabilities
    avg = (caps.reasoning + caps.execution + caps.autonomy + caps.speed + caps.consistency) / 5

    if avg < config.min_score:
        raise AgentAuthError(
            f"Insufficient capability score: {avg:.2f} < {config.min_score}",
            status=403,
            error_type="insufficient_score",
        )

    headers = {
        "AgentAuth-Status": "verified",
        "AgentAuth-Score": f"{avg:.2f}",
        "AgentAuth-Model-Family": claims.model_family,
        "AgentAuth-Capabilities": format_capabilities(claims.capabilities),
        "AgentAuth-Version": claims.agentauth_version,
    }
    if claims.challenge_ids:
        headers["AgentAuth-Challenge-Id"] = claims.challenge_ids[0]
    headers["AgentAuth-Token-Expires"] = str(claims.exp)

    return GuardResult(claims=claims, headers=headers)
