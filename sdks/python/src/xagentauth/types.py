from __future__ import annotations

from enum import Enum
from typing import Any, Literal, Optional, Protocol, Union, runtime_checkable

from pydantic import BaseModel


# ---------------------------------------------------------------------------
# Core enums
# ---------------------------------------------------------------------------

class Difficulty(str, Enum):
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"
    ADVERSARIAL = "adversarial"


class ChallengeDimension(str, Enum):
    REASONING = "reasoning"
    EXECUTION = "execution"
    MEMORY = "memory"
    AMBIGUITY = "ambiguity"


# ---------------------------------------------------------------------------
# Challenge types
# ---------------------------------------------------------------------------

class ChallengePayload(BaseModel):
    type: str
    instructions: str
    data: str
    steps: int
    context: Optional[dict[str, Any]] = None


class AgentCapabilityScore(BaseModel):
    reasoning: float
    execution: float
    autonomy: float
    speed: float
    consistency: float


FailReason = Literal[
    "wrong_answer",
    "expired",
    "already_used",
    "invalid_hmac",
    "too_fast",
    "too_slow",
    "timeout",
    "rate_limited",
]


# ---------------------------------------------------------------------------
# PoMI (Proof of Model Identity) types
# ---------------------------------------------------------------------------

InjectionMethod = Literal["inline", "prefix", "suffix", "embedded"]


class Distribution(BaseModel):
    mean: float
    stddev: float


class CanaryAnalysisExactMatch(BaseModel):
    type: Literal["exact_match"] = "exact_match"
    expected: dict[str, str]


class CanaryAnalysisStatistical(BaseModel):
    type: Literal["statistical"] = "statistical"
    distributions: dict[str, Distribution]


class CanaryAnalysisPattern(BaseModel):
    type: Literal["pattern"] = "pattern"
    patterns: dict[str, str]


CanaryAnalysis = Union[CanaryAnalysisExactMatch, CanaryAnalysisStatistical, CanaryAnalysisPattern]


class Canary(BaseModel):
    id: str
    prompt: str
    injection_method: str  # InjectionMethod literal
    analysis: CanaryAnalysis
    confidence_weight: float


class ModelSignature(BaseModel):
    model_family: str
    expected_value: str | float
    confidence: float
    last_verified: str


class CanaryEvidence(BaseModel):
    canary_id: str
    observed: str
    expected: str
    match: bool
    confidence_contribution: float


class ModelAlternative(BaseModel):
    family: str
    confidence: float


class ModelIdentification(BaseModel):
    family: str
    confidence: float
    evidence: list[CanaryEvidence] = []
    alternatives: list[ModelAlternative] = []


class CanaryResponseData(BaseModel):
    canary_id: str
    response: str


class PomiConfig(BaseModel):
    enabled: bool
    canaries: Optional[list[Canary]] = None
    canaries_per_challenge: Optional[int] = None
    model_families: Optional[list[str]] = None
    confidence_threshold: Optional[float] = None


# ---------------------------------------------------------------------------
# Timing Analysis types
# ---------------------------------------------------------------------------

TimingZone = Literal["too_fast", "ai_zone", "suspicious", "human", "timeout"]


class TimingBaseline(BaseModel):
    challenge_type: str
    difficulty: Difficulty
    mean_ms: float
    std_ms: float
    too_fast_ms: float
    ai_lower_ms: float
    ai_upper_ms: float
    human_ms: float
    timeout_ms: float


class TimingAnalysis(BaseModel):
    elapsed_ms: float
    zone: str  # TimingZone
    confidence: float
    z_score: float
    penalty: float
    details: str


class TimingPatternAnalysis(BaseModel):
    variance_coefficient: float
    trend: Literal["constant", "increasing", "decreasing", "variable"]
    round_number_ratio: float
    verdict: Literal["natural", "artificial", "inconclusive"]


SessionAnomalyType = Literal["zone_inconsistency", "timing_variance_anomaly", "rapid_succession"]


class SessionTimingAnomaly(BaseModel):
    type: str  # SessionAnomalyType
    description: str
    severity: Literal["low", "medium", "high"]


class TimingConfig(BaseModel):
    enabled: bool
    baselines: Optional[list[TimingBaseline]] = None
    default_too_fast_ms: Optional[float] = None
    default_ai_lower_ms: Optional[float] = None
    default_ai_upper_ms: Optional[float] = None
    default_human_ms: Optional[float] = None
    default_timeout_ms: Optional[float] = None
    session_tracking: Optional[dict[str, bool]] = None


# ---------------------------------------------------------------------------
# Challenge data & store
# ---------------------------------------------------------------------------

class Challenge(BaseModel):
    id: str
    session_token: str
    payload: ChallengePayload
    difficulty: Difficulty
    dimensions: list[str]  # ChallengeDimension values
    created_at: int
    expires_at: int


class ChallengeData(BaseModel):
    challenge: Challenge
    answer_hash: str
    attempts: int
    max_attempts: int
    created_at: int
    created_at_server_ms: Optional[float] = None
    injected_canaries: Optional[list[Canary]] = None


@runtime_checkable
class ChallengeStore(Protocol):
    async def set(self, id: str, data: ChallengeData, ttl_seconds: int) -> None: ...
    async def get(self, id: str) -> ChallengeData | None: ...
    async def delete(self, id: str) -> None: ...


@runtime_checkable
class ChallengeDriver(Protocol):
    name: str
    dimensions: tuple[str, ...] | list[str]
    estimated_human_time_ms: int
    estimated_ai_time_ms: int

    async def generate(self, difficulty: Difficulty) -> ChallengePayload: ...
    async def compute_answer_hash(self, payload: ChallengePayload) -> str: ...
    async def verify(self, answer_hash: str, submitted_answer: Any) -> bool: ...


# ---------------------------------------------------------------------------
# Engine types
# ---------------------------------------------------------------------------

class AgentAuthConfig(BaseModel):
    secret: str
    store: Any  # ChallengeStore (can't use Protocol in BaseModel)
    drivers: Optional[list[Any]] = None
    token_ttl_seconds: Optional[int] = None
    challenge_ttl_seconds: Optional[int] = None
    min_score: Optional[float] = None
    pomi: Optional[PomiConfig] = None
    timing: Optional[TimingConfig] = None

    model_config = {"arbitrary_types_allowed": True}


class InitChallengeOptions(BaseModel):
    difficulty: Optional[Difficulty] = None
    dimensions: Optional[list[str]] = None


class InitChallengeResult(BaseModel):
    id: str
    session_token: str
    expires_at: int
    ttl_seconds: int


class SolveInput(BaseModel):
    answer: str
    hmac: str
    canary_responses: Optional[dict[str, str]] = None
    metadata: Optional[dict[str, str]] = None
    client_rtt_ms: Optional[float] = None
    step_timings: Optional[list[float]] = None


class VerifyResult(BaseModel):
    success: bool
    score: AgentCapabilityScore
    token: Optional[str] = None
    reason: Optional[str] = None  # FailReason
    model_identity: Optional[ModelIdentification] = None
    timing_analysis: Optional[TimingAnalysis] = None
    pattern_analysis: Optional[TimingPatternAnalysis] = None
    session_anomalies: Optional[list[SessionTimingAnomaly]] = None


class VerifyTokenResult(BaseModel):
    valid: bool
    capabilities: Optional[AgentCapabilityScore] = None
    model_family: Optional[str] = None
    issued_at: Optional[int] = None
    expires_at: Optional[int] = None


# ---------------------------------------------------------------------------
# Client-side response types (kept for backward compat)
# ---------------------------------------------------------------------------

class InitChallengeResponse(BaseModel):
    id: str
    session_token: str
    expires_at: int
    ttl_seconds: int


class ChallengeResponse(BaseModel):
    id: str
    payload: ChallengePayload
    difficulty: Difficulty
    dimensions: list[ChallengeDimension]
    created_at: int
    expires_at: int


class SolveResponse(BaseModel):
    success: bool
    score: AgentCapabilityScore
    token: Optional[str] = None
    reason: Optional[str] = None
    model_identity: Optional[ModelIdentification] = None
    timing_analysis: Optional[TimingAnalysis] = None


class VerifyTokenResponse(BaseModel):
    valid: bool
    capabilities: Optional[AgentCapabilityScore] = None
    model_family: Optional[str] = None
    issued_at: Optional[int] = None
    expires_at: Optional[int] = None


class SolverResult(BaseModel):
    answer: str
    canary_responses: Optional[dict[str, str]] = None


class AgentAuthHeaders(BaseModel):
    status: Optional[str] = None
    score: Optional[float] = None
    model_family: Optional[str] = None
    pomi_confidence: Optional[float] = None
    capabilities: Optional[str] = None
    version: Optional[str] = None
    challenge_id: Optional[str] = None
    token_expires: Optional[int] = None


class AuthenticateResult(BaseModel):
    success: bool
    token: Optional[str] = None
    score: AgentCapabilityScore
    model_identity: Optional[ModelIdentification] = None
    timing_analysis: Optional[TimingAnalysis] = None
    reason: Optional[str] = None
    headers: Optional[AgentAuthHeaders] = None
