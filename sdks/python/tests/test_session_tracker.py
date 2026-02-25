from __future__ import annotations


from xagentauth.timing.session_tracker import SessionTimingTracker


def test_no_anomalies_with_single_entry():
    tracker = SessionTimingTracker()
    tracker.record("session-1", 200, "ai_zone")
    anomalies = tracker.analyze("session-1")
    assert len(anomalies) == 0


def test_timing_variance_anomaly():
    tracker = SessionTimingTracker()
    # Record identical timings (suspiciously consistent)
    tracker.record("session-1", 100, "ai_zone")
    tracker.record("session-1", 100, "ai_zone")
    tracker.record("session-1", 100, "ai_zone")
    anomalies = tracker.analyze("session-1")
    types = [a.type for a in anomalies]
    assert "timing_variance_anomaly" in types


def test_clear_session():
    tracker = SessionTimingTracker()
    tracker.record("session-1", 200, "ai_zone")
    tracker.record("session-1", 300, "ai_zone")
    tracker.clear("session-1")
    anomalies = tracker.analyze("session-1")
    assert len(anomalies) == 0
