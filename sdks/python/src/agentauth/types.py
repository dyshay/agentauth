from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel


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


class AgentCapabilityScore(BaseModel):
    reasoning: float
    execution: float
    autonomy: float
    speed: float
    consistency: float


class ChallengePayload(BaseModel):
    type: str
    instructions: str
    data: str
    steps: int
    context: Optional[dict] = None


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


class TimingAnalysis(BaseModel):
    elapsed_ms: float
    zone: str
    confidence: float
    z_score: float
    penalty: float
    details: str


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
