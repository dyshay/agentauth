from __future__ import annotations


from xagentauth.timing.analyzer import TimingAnalyzer
from xagentauth.timing.baselines import DEFAULT_BASELINES, get_baseline


def test_default_baselines_count():
    assert len(DEFAULT_BASELINES) == 16


def test_get_baseline():
    b = get_baseline("crypto-nl", "easy")
    assert b is not None
    assert b.challenge_type == "crypto-nl"
    assert b.mean_ms == 150


def test_analyze_ai_zone():
    analyzer = TimingAnalyzer()
    result = analyzer.analyze(
        elapsed_ms=200,
        challenge_type="crypto-nl",
        difficulty="easy",
    )
    assert result.zone == "ai_zone"
    assert result.penalty == 0.0


def test_analyze_too_fast():
    analyzer = TimingAnalyzer()
    result = analyzer.analyze(
        elapsed_ms=5,
        challenge_type="crypto-nl",
        difficulty="easy",
    )
    assert result.zone == "too_fast"
    assert result.penalty == 1.0


def test_analyze_timeout():
    analyzer = TimingAnalyzer()
    result = analyzer.analyze(
        elapsed_ms=50000,
        challenge_type="crypto-nl",
        difficulty="easy",
    )
    assert result.zone == "timeout"
    assert result.penalty == 1.0
