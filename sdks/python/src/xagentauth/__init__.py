from xagentauth.types import (
    AgentCapabilityScore,
    AgentAuthConfig,
    AgentAuthHeaders,
    AuthenticateResult,
    Canary,
    CanaryEvidence,
    ChallengeData,
    ChallengePayload,
    ChallengeResponse,
    ChallengeDimension,
    Difficulty,
    InitChallengeOptions,
    InitChallengeResponse,
    InitChallengeResult,
    ModelIdentification,
    PomiConfig,
    SessionTimingAnomaly,
    SolveInput,
    SolveResponse,
    SolverResult,
    TimingAnalysis,
    TimingBaseline,
    TimingConfig,
    TimingPatternAnalysis,
    VerifyResult,
    VerifyTokenResponse,
    VerifyTokenResult,
)
from xagentauth.client import AgentAuthClient
from xagentauth.errors import AgentAuthError
from xagentauth.token import AgentAuthClaims, TokenSignInput, TokenVerifier
from xagentauth.guard import GuardConfig, GuardResult, verify_request
from xagentauth.headers import (
    AGENTAUTH_HEADERS,
    format_capabilities,
    parse_capabilities,
)
from xagentauth.engine import AgentAuthEngine
from xagentauth.registry import ChallengeRegistry
from xagentauth.stores.memory import MemoryStore
from xagentauth.challenges import (
    CryptoNLDriver,
    CodeExecutionDriver,
    MultiStepDriver,
    AmbiguousLogicDriver,
)
from xagentauth.pomi import (
    CanaryCatalog,
    CanaryInjector,
    CanaryExtractor,
    ModelClassifier,
)
from xagentauth.timing import (
    TimingAnalyzer,
    SessionTimingTracker,
    DEFAULT_BASELINES,
)

__all__ = [
    # Engine
    "AgentAuthEngine",
    # Client
    "AgentAuthClient",
    "AgentAuthError",
    # Types
    "AgentCapabilityScore",
    "AgentAuthConfig",
    "AgentAuthHeaders",
    "AuthenticateResult",
    "Canary",
    "CanaryEvidence",
    "ChallengeData",
    "ChallengePayload",
    "ChallengeResponse",
    "ChallengeDimension",
    "Difficulty",
    "InitChallengeOptions",
    "InitChallengeResponse",
    "InitChallengeResult",
    "ModelIdentification",
    "PomiConfig",
    "SessionTimingAnomaly",
    "SolveInput",
    "SolveResponse",
    "SolverResult",
    "TimingAnalysis",
    "TimingBaseline",
    "TimingConfig",
    "TimingPatternAnalysis",
    "VerifyResult",
    "VerifyTokenResponse",
    "VerifyTokenResult",
    # Token
    "AgentAuthClaims",
    "TokenSignInput",
    "TokenVerifier",
    # Guard
    "GuardConfig",
    "GuardResult",
    "verify_request",
    # Headers
    "AGENTAUTH_HEADERS",
    "format_capabilities",
    "parse_capabilities",
    # Registry & Store
    "ChallengeRegistry",
    "MemoryStore",
    # Challenge Drivers
    "CryptoNLDriver",
    "CodeExecutionDriver",
    "MultiStepDriver",
    "AmbiguousLogicDriver",
    # PoMI
    "CanaryCatalog",
    "CanaryInjector",
    "CanaryExtractor",
    "ModelClassifier",
    # Timing
    "TimingAnalyzer",
    "SessionTimingTracker",
    "DEFAULT_BASELINES",
]

__version__ = "0.1.0"
