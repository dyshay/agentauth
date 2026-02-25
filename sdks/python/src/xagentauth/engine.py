from __future__ import annotations

import time
from typing import Any, Optional

from xagentauth.crypto import (
    generate_id,
    generate_session_token,
    hmac_sha256_hex,
    timing_safe_equal,
)
from xagentauth.pomi.catalog import CanaryCatalog
from xagentauth.pomi.classifier import ModelClassifier
from xagentauth.pomi.injector import CanaryInjector
from xagentauth.registry import ChallengeRegistry
from xagentauth.timing.analyzer import TimingAnalyzer
from xagentauth.timing.session_tracker import SessionTimingTracker
from xagentauth.token import TokenSignInput, TokenVerifier
from xagentauth.types import (
    AgentAuthConfig,
    AgentCapabilityScore,
    Canary,
    Challenge,
    ChallengeData,
    Difficulty,
    InitChallengeOptions,
    InitChallengeResult,
    ModelIdentification,
    SessionTimingAnomaly,
    SolveInput,
    TimingAnalysis,
    TimingPatternAnalysis,
    VerifyResult,
    VerifyTokenResult,
)


class AgentAuthEngine:
    """Main server-side engine orchestrating challenges, timing, and PoMI."""

    def __init__(self, config: AgentAuthConfig) -> None:
        self._store = config.store
        self._registry = ChallengeRegistry()
        self._token_manager = TokenVerifier(config.secret)
        self._challenge_ttl_seconds = config.challenge_ttl_seconds or 30
        self._token_ttl_seconds = config.token_ttl_seconds or 3600
        self._min_score = config.min_score or 0.7

        # Register all drivers
        for driver in config.drivers or []:
            self._registry.register(driver)

        # Initialize timing analyzer if enabled
        self._timing_analyzer: Optional[TimingAnalyzer] = None
        self._session_tracker: Optional[SessionTimingTracker] = None

        if config.timing and config.timing.enabled:
            self._timing_analyzer = TimingAnalyzer(config.timing)
            if config.timing.session_tracking and config.timing.session_tracking.get("enabled"):
                self._session_tracker = SessionTimingTracker()

        # Initialize PoMI if enabled
        self._pomi_config = config.pomi
        self._canary_injector: Optional[CanaryInjector] = None
        self._model_classifier: Optional[ModelClassifier] = None

        if config.pomi and config.pomi.enabled:
            catalog = CanaryCatalog(config.pomi.canaries)
            self._canary_injector = CanaryInjector(catalog)
            model_families = config.pomi.model_families or [
                "gpt-4-class",
                "claude-3-class",
                "gemini-class",
                "llama-class",
                "mistral-class",
            ]
            self._model_classifier = ModelClassifier(
                model_families=model_families,
                confidence_threshold=config.pomi.confidence_threshold or 0.5,
            )

    def register_driver(self, driver: Any) -> None:
        self._registry.register(driver)

    async def init_challenge(self, options: Optional[InitChallengeOptions] = None) -> InitChallengeResult:
        opts = options or InitChallengeOptions()
        difficulty = opts.difficulty or Difficulty.MEDIUM
        diff_str = difficulty.value if isinstance(difficulty, Difficulty) else difficulty

        selected = self._registry.select(dimensions=opts.dimensions)
        driver = selected[0]

        id_ = generate_id()
        session_token = generate_session_token()
        now = int(time.time())
        expires_at = now + self._challenge_ttl_seconds

        payload = await driver.generate(diff_str)

        # Compute answer hash from ORIGINAL payload (before canary injection)
        answer_hash = await driver.compute_answer_hash(payload)

        # Inject canaries if PoMI is enabled
        final_payload = payload
        injected_canaries: Optional[list[Canary]] = None

        if self._canary_injector and self._pomi_config:
            canaries_per = self._pomi_config.canaries_per_challenge or 2
            injection_result = self._canary_injector.inject(payload, canaries_per)
            final_payload = injection_result.payload
            injected_canaries = injection_result.injected

        challenge_data = ChallengeData(
            challenge=Challenge(
                id=id_,
                session_token=session_token,
                payload=final_payload,
                difficulty=Difficulty(diff_str),
                dimensions=list(driver.dimensions),
                created_at=now,
                expires_at=expires_at,
            ),
            answer_hash=answer_hash,
            attempts=0,
            max_attempts=3,
            created_at=now,
            created_at_server_ms=time.time() * 1000,
            injected_canaries=injected_canaries,
        )

        await self._store.set(id_, challenge_data, self._challenge_ttl_seconds)

        return InitChallengeResult(
            id=id_,
            session_token=session_token,
            expires_at=expires_at,
            ttl_seconds=self._challenge_ttl_seconds,
        )

    async def get_challenge(self, id: str, session_token: str) -> Optional[dict[str, Any]]:
        data = await self._store.get(id)
        if not data:
            return None
        if not timing_safe_equal(data.challenge.session_token, session_token):
            return None

        # Return challenge without context and session_token
        payload_dict = data.challenge.payload.model_dump()
        payload_dict.pop("context", None)

        return {
            "id": data.challenge.id,
            "payload": payload_dict,
            "difficulty": data.challenge.difficulty.value
            if isinstance(data.challenge.difficulty, Difficulty)
            else data.challenge.difficulty,
            "dimensions": data.challenge.dimensions,
            "created_at": data.challenge.created_at,
            "expires_at": data.challenge.expires_at,
        }

    async def solve_challenge(self, id: str, input: SolveInput) -> VerifyResult:
        zero_score = AgentCapabilityScore(reasoning=0, execution=0, autonomy=0, speed=0, consistency=0)

        data = await self._store.get(id)
        if not data:
            return VerifyResult(success=False, score=zero_score, reason="expired")

        # Verify HMAC
        expected_hmac = hmac_sha256_hex(input.answer, data.challenge.session_token)
        if not timing_safe_equal(expected_hmac, input.hmac):
            return VerifyResult(success=False, score=zero_score, reason="invalid_hmac")

        # Delete challenge from store (single-use)
        await self._store.delete(id)

        # Verify answer
        driver = self._registry.get(data.challenge.payload.type)
        if not driver:
            return VerifyResult(success=False, score=zero_score, reason="wrong_answer")

        correct = await driver.verify(data.answer_hash, input.answer)
        if not correct:
            return VerifyResult(success=False, score=zero_score, reason="wrong_answer")

        # Compute timing analysis
        timing_analysis: Optional[TimingAnalysis] = None

        if self._timing_analyzer:
            now_ms = time.time() * 1000
            if data.created_at_server_ms:
                base_elapsed = now_ms - data.created_at_server_ms
            else:
                base_elapsed = now_ms - data.challenge.created_at * 1000

            # RTT compensation
            rtt_ms = 0.0
            if input.client_rtt_ms and input.client_rtt_ms > 0:
                rtt_ms = min(input.client_rtt_ms, base_elapsed * 0.5)
            elapsed_ms = base_elapsed - rtt_ms

            diff_str = (
                data.challenge.difficulty.value
                if isinstance(data.challenge.difficulty, Difficulty)
                else data.challenge.difficulty
            )
            timing_analysis = self._timing_analyzer.analyze(
                elapsed_ms=elapsed_ms,
                challenge_type=data.challenge.payload.type,
                difficulty=diff_str,
                rtt_ms=rtt_ms if rtt_ms > 0 else None,
            )

            if timing_analysis.zone == "too_fast":
                return VerifyResult(
                    success=False,
                    score=zero_score,
                    reason="too_fast",
                    timing_analysis=timing_analysis,
                )
            if timing_analysis.zone == "timeout":
                return VerifyResult(
                    success=False,
                    score=zero_score,
                    reason="timeout",
                    timing_analysis=timing_analysis,
                )

        # Analyze per-step timing patterns
        pattern_analysis: Optional[TimingPatternAnalysis] = None

        if self._timing_analyzer and input.step_timings and len(input.step_timings) > 0:
            pattern_analysis = self._timing_analyzer.analyze_pattern(input.step_timings)

        # Compute capability score
        score = self._compute_score(data, timing_analysis, pattern_analysis)

        # Classify model identity if PoMI is enabled
        model_identity: Optional[ModelIdentification] = None

        if self._model_classifier and data.injected_canaries:
            model_identity = self._model_classifier.classify(
                data.injected_canaries,
                input.canary_responses,
            )

        # Determine model_family for token
        model_family = "unknown"
        if model_identity and model_identity.family != "unknown":
            model_family = model_identity.family
        elif input.metadata and input.metadata.get("model"):
            model_family = input.metadata["model"]

        # Session tracking
        session_anomalies: Optional[list[SessionTimingAnomaly]] = None

        if self._session_tracker and timing_analysis and input.metadata and input.metadata.get("model"):
            session_key = input.metadata["model"]
            self._session_tracker.record(session_key, timing_analysis.elapsed_ms, timing_analysis.zone)
            anomalies = self._session_tracker.analyze(session_key)
            if anomalies:
                session_anomalies = anomalies

        # Generate token
        token = self._token_manager.sign(
            TokenSignInput(
                sub=id,
                capabilities=score,
                model_family=model_family,
                challenge_ids=[id],
            ),
            ttl_seconds=self._token_ttl_seconds,
        )

        return VerifyResult(
            success=True,
            score=score,
            token=token,
            model_identity=model_identity,
            timing_analysis=timing_analysis,
            pattern_analysis=pattern_analysis,
            session_anomalies=session_anomalies,
        )

    async def verify_token(self, token: str) -> VerifyTokenResult:
        try:
            payload = self._token_manager.verify(token)
            return VerifyTokenResult(
                valid=True,
                capabilities=payload.capabilities,
                model_family=payload.model_family,
                issued_at=payload.iat,
                expires_at=payload.exp,
            )
        except Exception:
            return VerifyTokenResult(valid=False)

    @staticmethod
    def _compute_score(
        data: ChallengeData,
        timing_analysis: Optional[TimingAnalysis] = None,
        pattern_analysis: Optional[TimingPatternAnalysis] = None,
    ) -> AgentCapabilityScore:
        dims = data.challenge.dimensions
        penalty = timing_analysis.penalty if timing_analysis else 0
        zone = timing_analysis.zone if timing_analysis else None

        # Pattern-based penalty
        pattern_penalty = 0.3 if pattern_analysis and pattern_analysis.verdict == "artificial" else 0

        reasoning = 0.9 if "reasoning" in dims else 0.5
        execution = 0.95 if "execution" in dims else 0.5
        speed = round((1 - penalty) * 0.95 * 1000) / 1000
        autonomy_base = (1 - penalty) * 0.9 if zone in ("human", "suspicious") else 0.9
        autonomy = round(autonomy_base * (1 - pattern_penalty) * 1000) / 1000
        consistency_base = 0.92 if "memory" in dims else 0.9
        consistency = round(consistency_base * (1 - pattern_penalty) * 1000) / 1000

        return AgentCapabilityScore(
            reasoning=reasoning,
            execution=execution,
            speed=speed,
            autonomy=autonomy,
            consistency=consistency,
        )
