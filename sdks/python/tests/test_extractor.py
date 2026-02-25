from __future__ import annotations

import pytest

from xagentauth.pomi.extractor import CanaryExtractor
from xagentauth.types import (
    Canary,
    CanaryAnalysisExactMatch,
    CanaryAnalysisPattern,
    CanaryAnalysisStatistical,
    Distribution,
)


def _make_exact_canary() -> Canary:
    return Canary(
        id="test-exact",
        prompt="test",
        injection_method="inline",
        analysis=CanaryAnalysisExactMatch(
            type="exact_match",
            expected={"gpt-4-class": "hello", "claude-3-class": "hi"},
        ),
        confidence_weight=0.5,
    )


def test_extract_exact_match():
    extractor = CanaryExtractor()
    canary = _make_exact_canary()
    evidence = extractor.extract([canary], {"test-exact": "hello"})
    assert len(evidence) == 1
    assert evidence[0].match is True
    assert evidence[0].confidence_contribution == 0.5


def test_extract_exact_mismatch():
    extractor = CanaryExtractor()
    canary = _make_exact_canary()
    evidence = extractor.extract([canary], {"test-exact": "wrong"})
    assert len(evidence) == 1
    assert evidence[0].match is False
    assert evidence[0].confidence_contribution == 0.5 * 0.3


def test_extract_pattern():
    extractor = CanaryExtractor()
    canary = Canary(
        id="test-pattern",
        prompt="test",
        injection_method="inline",
        analysis=CanaryAnalysisPattern(
            type="pattern",
            patterns={"gpt-4-class": "Hello|Hi", "claude-3-class": "Hey"},
        ),
        confidence_weight=0.4,
    )
    evidence = extractor.extract([canary], {"test-pattern": "Hello there"})
    assert len(evidence) == 1
    assert evidence[0].match is True


def test_extract_no_responses():
    extractor = CanaryExtractor()
    canary = _make_exact_canary()
    evidence = extractor.extract([canary], None)
    assert len(evidence) == 0
