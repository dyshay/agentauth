from __future__ import annotations

import math
import re
from typing import Optional

from xagentauth.pomi.extractor import CanaryExtractor
from xagentauth.types import (
    Canary,
    CanaryAnalysisExactMatch,
    CanaryAnalysisPattern,
    CanaryAnalysisStatistical,
    CanaryEvidence,
    ModelAlternative,
    ModelIdentification,
)


class ModelClassifier:
    """Bayesian model family classifier using canary evidence."""

    def __init__(
        self,
        model_families: list[str],
        confidence_threshold: float = 0.5,
    ) -> None:
        self._model_families = model_families
        self._confidence_threshold = confidence_threshold
        self._extractor = CanaryExtractor()

    def classify(
        self,
        canaries: list[Canary],
        canary_responses: Optional[dict[str, str]],
    ) -> ModelIdentification:
        if not canary_responses or len(canaries) == 0:
            return ModelIdentification(
                family="unknown", confidence=0, evidence=[], alternatives=[]
            )

        evidence = self._extractor.extract(canaries, canary_responses)
        if len(evidence) == 0:
            return ModelIdentification(
                family="unknown", confidence=0, evidence=[], alternatives=[]
            )

        # Initialize uniform prior
        posteriors: dict[str, float] = {
            family: 1 / len(self._model_families) for family in self._model_families
        }

        # Bayesian update for each canary with a response
        for canary in canaries:
            response = canary_responses.get(canary.id)
            if response is None:
                continue

            for family in self._model_families:
                prior = posteriors[family]
                likelihood = self._compute_likelihood(canary, response, family)
                posteriors[family] = prior * likelihood

            # Normalize after each update to prevent underflow
            self._normalize(posteriors)

        # Find best hypothesis
        best_family = "unknown"
        best_confidence = 0.0

        for family, posterior in posteriors.items():
            if posterior > best_confidence:
                best_confidence = posterior
                best_family = family

        # Build alternatives
        alternatives: list[ModelAlternative] = []
        for family, posterior in posteriors.items():
            if family != best_family:
                alternatives.append(
                    ModelAlternative(
                        family=family,
                        confidence=round(posterior * 1000) / 1000,
                    )
                )
        alternatives.sort(key=lambda a: a.confidence, reverse=True)

        # Apply confidence threshold
        if best_confidence < self._confidence_threshold:
            return ModelIdentification(
                family="unknown",
                confidence=round(best_confidence * 1000) / 1000,
                evidence=evidence,
                alternatives=[
                    ModelAlternative(
                        family=best_family,
                        confidence=round(best_confidence * 1000) / 1000,
                    ),
                    *alternatives,
                ],
            )

        return ModelIdentification(
            family=best_family,
            confidence=round(best_confidence * 1000) / 1000,
            evidence=evidence,
            alternatives=alternatives,
        )

    def _compute_likelihood(self, canary: Canary, response: str, family: str) -> float:
        weight = canary.confidence_weight
        analysis = canary.analysis

        if isinstance(analysis, CanaryAnalysisExactMatch):
            expected = analysis.expected.get(family)
            if not expected:
                return 0.5
            is_match = response.strip().lower() == expected.strip().lower()
            return 0.5 + 0.5 * weight if is_match else 0.5 - 0.4 * weight

        elif isinstance(analysis, CanaryAnalysisPattern):
            pattern = analysis.patterns.get(family)
            if not pattern:
                return 0.5
            try:
                regex = re.compile(pattern, re.IGNORECASE)
                is_match = bool(regex.search(response))
                return 0.5 + 0.45 * weight if is_match else 0.5 - 0.35 * weight
            except re.error:
                return 0.5

        elif isinstance(analysis, CanaryAnalysisStatistical):
            dist = analysis.distributions.get(family)
            if not dist:
                return 0.5
            num_match = re.search(r"-?\d+\.?\d*", response)
            if not num_match:
                return 0.5
            value = float(num_match.group(0))
            pdf = self._gaussian_pdf(value, dist.mean, dist.stddev)
            max_pdf = self._gaussian_pdf(dist.mean, dist.mean, dist.stddev)
            normalized_pdf = pdf / max_pdf if max_pdf > 0 else 0
            return 0.1 + 0.8 * normalized_pdf * weight

        return 0.5

    @staticmethod
    def _gaussian_pdf(x: float, mean: float, stddev: float) -> float:
        z = (x - mean) / stddev
        return math.exp(-0.5 * z * z) / (stddev * math.sqrt(2 * math.pi))

    @staticmethod
    def _normalize(posteriors: dict[str, float]) -> None:
        total = sum(posteriors.values())
        if total == 0:
            uniform = 1 / len(posteriors)
            for key in posteriors:
                posteriors[key] = uniform
            return
        for key in posteriors:
            posteriors[key] = posteriors[key] / total
