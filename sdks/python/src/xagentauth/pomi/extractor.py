from __future__ import annotations

import re
from typing import Optional

from xagentauth.types import (
    Canary,
    CanaryAnalysisExactMatch,
    CanaryAnalysisPattern,
    CanaryAnalysisStatistical,
    CanaryEvidence,
)


class CanaryExtractor:
    """Evaluates canary responses to produce evidence for model classification."""

    def extract(
        self,
        injected_canaries: list[Canary],
        canary_responses: Optional[dict[str, str]],
    ) -> list[CanaryEvidence]:
        if not canary_responses:
            return []

        evidence: list[CanaryEvidence] = []
        for canary in injected_canaries:
            response = canary_responses.get(canary.id)
            if response is None:
                continue
            result = self._evaluate(canary, response)
            evidence.append(result)

        return evidence

    def _evaluate(self, canary: Canary, observed: str) -> CanaryEvidence:
        analysis = canary.analysis
        if isinstance(analysis, CanaryAnalysisExactMatch) or (isinstance(analysis, dict) and analysis.get("type") == "exact_match"):
            return self._evaluate_exact_match(canary, analysis, observed)
        elif isinstance(analysis, CanaryAnalysisPattern) or (isinstance(analysis, dict) and analysis.get("type") == "pattern"):
            return self._evaluate_pattern(canary, analysis, observed)
        elif isinstance(analysis, CanaryAnalysisStatistical) or (isinstance(analysis, dict) and analysis.get("type") == "statistical"):
            return self._evaluate_statistical(canary, analysis, observed)
        else:
            raise ValueError(f"Unknown analysis type: {analysis}")

    def _evaluate_exact_match(
        self,
        canary: Canary,
        analysis: CanaryAnalysisExactMatch,
        observed: str,
    ) -> CanaryEvidence:
        best_match = ""
        match = False

        for _family, expected in analysis.expected.items():
            if observed.strip().lower() == expected.strip().lower():
                best_match = expected
                match = True
                break

        if not match:
            values = list(analysis.expected.values())
            best_match = values[0] if values else ""

        return CanaryEvidence(
            canary_id=canary.id,
            observed=observed,
            expected=best_match,
            match=match,
            confidence_contribution=canary.confidence_weight if match else canary.confidence_weight * 0.3,
        )

    def _evaluate_pattern(
        self,
        canary: Canary,
        analysis: CanaryAnalysisPattern,
        observed: str,
    ) -> CanaryEvidence:
        best_pattern = ""
        match = False

        for _family, pattern in analysis.patterns.items():
            try:
                regex = re.compile(pattern, re.IGNORECASE)
                if regex.search(observed):
                    best_pattern = pattern
                    match = True
                    break
            except re.error:
                continue

        if not match:
            values = list(analysis.patterns.values())
            best_pattern = values[0] if values else ""

        return CanaryEvidence(
            canary_id=canary.id,
            observed=observed,
            expected=best_pattern,
            match=match,
            confidence_contribution=canary.confidence_weight if match else canary.confidence_weight * 0.2,
        )

    def _evaluate_statistical(
        self,
        canary: Canary,
        analysis: CanaryAnalysisStatistical,
        observed: str,
    ) -> CanaryEvidence:
        num_match = re.search(r"-?\d+\.?\d*", observed)
        num_value = float(num_match.group(0)) if num_match else float("nan")

        best_dist = ""
        match = False

        if num_value == num_value:  # not NaN
            for family, dist in analysis.distributions.items():
                if abs(num_value - dist.mean) <= 2 * dist.stddev:
                    best_dist = f"{family}: mean={dist.mean}, stddev={dist.stddev}"
                    match = True
                    break

        if not match:
            items = list(analysis.distributions.items())
            if items:
                first_family, first_dist = items[0]
                best_dist = f"{first_family}: mean={first_dist.mean}, stddev={first_dist.stddev}"

        return CanaryEvidence(
            canary_id=canary.id,
            observed=observed,
            expected=best_dist,
            match=match,
            confidence_contribution=canary.confidence_weight * 0.7 if match else canary.confidence_weight * 0.1,
        )
