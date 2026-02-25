from __future__ import annotations

import pytest

from xagentauth.timing.analyzer import TimingAnalyzer


def test_pattern_natural():
    analyzer = TimingAnalyzer()
    result = analyzer.analyze_pattern([150, 220, 180, 310, 260])
    assert result.variance_coefficient > 0.1
    assert result.verdict == "natural"


def test_pattern_artificial_consistent():
    analyzer = TimingAnalyzer()
    result = analyzer.analyze_pattern([100, 100, 100, 100])
    assert result.variance_coefficient < 0.05
    assert result.verdict == "artificial"


def test_pattern_inconclusive_single():
    analyzer = TimingAnalyzer()
    result = analyzer.analyze_pattern([100])
    assert result.verdict == "inconclusive"
