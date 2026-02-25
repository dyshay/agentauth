from __future__ import annotations

import math
from typing import Optional

from xagentauth.timing.baselines import DEFAULT_BASELINES
from xagentauth.types import (
    Difficulty,
    TimingAnalysis,
    TimingBaseline,
    TimingConfig,
    TimingPatternAnalysis,
)


class TimingAnalyzer:
    """Analyzes challenge response timing to classify entities."""

    def __init__(self, config: Optional[TimingConfig] = None) -> None:
        self._baselines: dict[str, TimingBaseline] = {}

        all_baselines = (config.baselines if config and config.baselines else None) or DEFAULT_BASELINES
        for b in all_baselines:
            diff_val = b.difficulty.value if isinstance(b.difficulty, Difficulty) else b.difficulty
            key = f"{b.challenge_type}:{diff_val}"
            self._baselines[key] = b

        self._defaults = {
            "too_fast": (config.default_too_fast_ms if config and config.default_too_fast_ms is not None else None) or 50,
            "ai_lower": (config.default_ai_lower_ms if config and config.default_ai_lower_ms is not None else None) or 50,
            "ai_upper": (config.default_ai_upper_ms if config and config.default_ai_upper_ms is not None else None) or 2000,
            "human": (config.default_human_ms if config and config.default_human_ms is not None else None) or 10000,
            "timeout": (config.default_timeout_ms if config and config.default_timeout_ms is not None else None) or 30000,
        }

    def analyze(
        self,
        elapsed_ms: float,
        challenge_type: str,
        difficulty: str | Difficulty,
        rtt_ms: Optional[float] = None,
    ) -> TimingAnalysis:
        diff_val = difficulty.value if isinstance(difficulty, Difficulty) else difficulty
        key = f"{challenge_type}:{diff_val}"
        baseline = self._baselines.get(key) or self._make_default_baseline()

        # Apply RTT tolerance to zone boundaries
        tolerance = max(rtt_ms * 0.5, 200) if rtt_ms and rtt_ms > 0 else 0
        if tolerance > 0:
            adjusted = TimingBaseline(
                challenge_type=baseline.challenge_type,
                difficulty=baseline.difficulty,
                mean_ms=baseline.mean_ms,
                std_ms=baseline.std_ms,
                too_fast_ms=baseline.too_fast_ms,
                ai_lower_ms=baseline.ai_lower_ms,
                ai_upper_ms=baseline.ai_upper_ms + tolerance,
                human_ms=baseline.human_ms + tolerance,
                timeout_ms=baseline.timeout_ms,
            )
        else:
            adjusted = baseline

        zone = self._classify_zone(elapsed_ms, adjusted)
        penalty = self._compute_penalty(zone, elapsed_ms, adjusted)
        z_score = self._compute_z_score(elapsed_ms, baseline)
        confidence = self._compute_confidence(elapsed_ms, adjusted, zone)
        details = self._describe_zone(zone, elapsed_ms, adjusted)

        # Round-number detection
        is_round = elapsed_ms % 500 == 0 or elapsed_ms % 100 == 0
        if is_round and zone == "ai_zone" and elapsed_ms > 0:
            confidence = round(confidence * 0.85 * 1000) / 1000
            details += " [round-number timing detected]"

        return TimingAnalysis(
            elapsed_ms=elapsed_ms,
            zone=zone,
            confidence=confidence,
            z_score=round(z_score * 100) / 100,
            penalty=round(penalty * 1000) / 1000,
            details=details,
        )

    def analyze_pattern(self, step_timings: list[float]) -> TimingPatternAnalysis:
        if len(step_timings) < 2:
            return TimingPatternAnalysis(
                variance_coefficient=0,
                trend="constant",
                round_number_ratio=0,
                verdict="inconclusive",
            )

        mean = sum(step_timings) / len(step_timings)
        std = math.sqrt(
            sum((t - mean) ** 2 for t in step_timings) / len(step_timings)
        )
        variance_coefficient = std / mean if mean > 0 else 0

        trend = self._detect_trend(step_timings)

        # Round number detection: multiples of 100ms or 500ms
        round_count = sum(
            1
            for t in step_timings
            if t % 500 == 0 or (t % 100 == 0 and t % 500 != 0)
        )
        round_number_ratio = round_count / len(step_timings)

        # Verdict
        if variance_coefficient < 0.05 and len(step_timings) >= 3:
            verdict = "artificial"
        elif round_number_ratio > 0.5:
            verdict = "artificial"
        elif variance_coefficient > 0.1:
            verdict = "natural"
        else:
            verdict = "inconclusive"

        return TimingPatternAnalysis(
            variance_coefficient=round(variance_coefficient * 1000) / 1000,
            trend=trend,
            round_number_ratio=round(round_number_ratio * 100) / 100,
            verdict=verdict,
        )

    def _make_default_baseline(self) -> TimingBaseline:
        return TimingBaseline(
            challenge_type="default",
            difficulty=Difficulty.MEDIUM,
            mean_ms=(self._defaults["ai_lower"] + self._defaults["ai_upper"]) / 2,
            std_ms=(self._defaults["ai_upper"] - self._defaults["ai_lower"]) / 4,
            too_fast_ms=self._defaults["too_fast"],
            ai_lower_ms=self._defaults["ai_lower"],
            ai_upper_ms=self._defaults["ai_upper"],
            human_ms=self._defaults["human"],
            timeout_ms=self._defaults["timeout"],
        )

    @staticmethod
    def _classify_zone(elapsed: float, baseline: TimingBaseline) -> str:
        if elapsed < baseline.too_fast_ms:
            return "too_fast"
        if baseline.too_fast_ms <= elapsed <= baseline.ai_upper_ms:
            return "ai_zone"
        if baseline.ai_upper_ms < elapsed <= baseline.human_ms:
            return "suspicious"
        if baseline.human_ms < elapsed <= baseline.timeout_ms:
            return "human"
        return "timeout"

    @staticmethod
    def _compute_penalty(zone: str, elapsed: float, baseline: TimingBaseline) -> float:
        if zone == "too_fast":
            return 1.0
        elif zone == "ai_zone":
            return 0.0
        elif zone == "suspicious":
            range_ = baseline.human_ms - baseline.ai_upper_ms
            if range_ <= 0:
                return 0.5
            position = (elapsed - baseline.ai_upper_ms) / range_
            return 0.3 + position * 0.4
        elif zone == "human":
            return 0.9
        elif zone == "timeout":
            return 1.0
        return 0.0

    @staticmethod
    def _compute_z_score(elapsed: float, baseline: TimingBaseline) -> float:
        if baseline.std_ms == 0:
            return 0
        return (elapsed - baseline.mean_ms) / baseline.std_ms

    @staticmethod
    def _compute_confidence(elapsed: float, baseline: TimingBaseline, zone: str) -> float:
        if zone == "too_fast":
            ratio = elapsed / baseline.too_fast_ms
            return max(0.5, 1 - ratio)
        elif zone == "ai_zone":
            dist_from_mean = abs(elapsed - baseline.mean_ms)
            normalized_dist = dist_from_mean / baseline.std_ms if baseline.std_ms > 0 else 0
            return max(0.5, min(1, 1 - normalized_dist * 0.15))
        elif zone == "suspicious":
            range_ = baseline.human_ms - baseline.ai_upper_ms
            if range_ <= 0:
                return 0.4
            return 0.4 + 0.2 * ((elapsed - baseline.ai_upper_ms) / range_)
        elif zone == "human":
            return 0.8
        elif zone == "timeout":
            return 0.95
        return 0.5

    @staticmethod
    def _describe_zone(zone: str, elapsed: float, baseline: TimingBaseline) -> str:
        ms = round(elapsed)
        if zone == "too_fast":
            return f"Response time {ms}ms is below {baseline.too_fast_ms}ms threshold \u2014 likely pre-computed or scripted"
        elif zone == "ai_zone":
            return f"Response time {ms}ms is within expected AI range [{baseline.ai_lower_ms}ms, {baseline.ai_upper_ms}ms]"
        elif zone == "suspicious":
            return f"Response time {ms}ms exceeds AI range \u2014 possible human assistance"
        elif zone == "human":
            return f"Response time {ms}ms exceeds {baseline.human_ms}ms \u2014 likely human solver"
        elif zone == "timeout":
            return f"Response time {ms}ms exceeds timeout threshold of {baseline.timeout_ms}ms"
        return ""

    @staticmethod
    def _detect_trend(timings: list[float]) -> str:
        if len(timings) < 3:
            return "variable"

        n = len(timings)
        x_mean = (n - 1) / 2
        y_mean = sum(timings) / n

        numerator = 0.0
        denominator = 0.0
        for i in range(n):
            numerator += (i - x_mean) * (timings[i] - y_mean)
            denominator += (i - x_mean) ** 2

        if denominator == 0:
            return "constant"
        slope = numerator / denominator

        normalized_slope = slope / y_mean if y_mean > 0 else 0

        if abs(normalized_slope) < 0.05:
            return "constant"
        if normalized_slope > 0.1:
            return "increasing"
        if normalized_slope < -0.1:
            return "decreasing"
        return "variable"
