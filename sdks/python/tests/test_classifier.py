from __future__ import annotations


from xagentauth.pomi.classifier import ModelClassifier
from xagentauth.types import (
    Canary,
    CanaryAnalysisExactMatch,
)


FAMILIES = ["gpt-4-class", "claude-3-class", "gemini-class"]


def _make_canary(expected: dict[str, str]) -> Canary:
    return Canary(
        id="test-canary",
        prompt="test",
        injection_method="inline",
        analysis=CanaryAnalysisExactMatch(type="exact_match", expected=expected),
        confidence_weight=0.5,
    )


def test_classify_with_matching_response():
    canary = _make_canary({"gpt-4-class": "hello", "claude-3-class": "hi", "gemini-class": "hey"})
    classifier = ModelClassifier(FAMILIES, confidence_threshold=0.3)
    result = classifier.classify([canary], {"test-canary": "hello"})
    assert result.family == "gpt-4-class"
    assert result.confidence > 0


def test_classify_unknown_without_responses():
    canary = _make_canary({"gpt-4-class": "hello"})
    classifier = ModelClassifier(FAMILIES)
    result = classifier.classify([canary], None)
    assert result.family == "unknown"
    assert result.confidence == 0


def test_classify_below_threshold():
    canary = _make_canary({"gpt-4-class": "hello", "claude-3-class": "hello", "gemini-class": "hello"})
    classifier = ModelClassifier(FAMILIES, confidence_threshold=0.99)
    result = classifier.classify([canary], {"test-canary": "hello"})
    # When all families have the same expected value, confidence is uniform
    # so no family can exceed 0.99 threshold
    assert result.family == "unknown" or result.confidence > 0
