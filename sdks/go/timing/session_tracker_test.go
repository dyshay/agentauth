package timing

import (
	"testing"
	"time"

	xagentauth "github.com/dyshay/agentauth/sdks/go"
)

func TestSessionTracker_NoAnomaliesWithFewEntries(t *testing.T) {
	tracker := NewSessionTimingTracker()
	tracker.Record("session1", 500, xagentauth.ZoneAI)

	anomalies := tracker.Analyze("session1")
	if len(anomalies) != 0 {
		t.Errorf("Expected 0 anomalies for single entry, got %d", len(anomalies))
	}
}

func TestSessionTracker_ZoneInconsistency(t *testing.T) {
	tracker := NewSessionTimingTracker()
	tracker.Record("session1", 200, xagentauth.ZoneAI)
	time.Sleep(10 * time.Millisecond) // Ensure different timestamps
	tracker.Record("session1", 12000, xagentauth.ZoneHuman)
	time.Sleep(10 * time.Millisecond)
	tracker.Record("session1", 300, xagentauth.ZoneAI)

	anomalies := tracker.Analyze("session1")
	found := false
	for _, a := range anomalies {
		if a.Type == "zone_inconsistency" {
			found = true
			break
		}
	}
	if !found {
		t.Error("Expected zone_inconsistency anomaly")
	}
}

func TestSessionTracker_TimingVariance(t *testing.T) {
	tracker := NewSessionTimingTracker()
	// Very consistent timings
	tracker.Record("session2", 500, xagentauth.ZoneAI)
	time.Sleep(10 * time.Millisecond)
	tracker.Record("session2", 500, xagentauth.ZoneAI)
	time.Sleep(10 * time.Millisecond)
	tracker.Record("session2", 500, xagentauth.ZoneAI)

	anomalies := tracker.Analyze("session2")
	found := false
	for _, a := range anomalies {
		if a.Type == "timing_variance_anomaly" {
			found = true
			break
		}
	}
	if !found {
		t.Error("Expected timing_variance_anomaly for perfectly consistent timings")
	}
}

func TestSessionTracker_RapidSuccession(t *testing.T) {
	tracker := NewSessionTimingTracker()
	tracker.Record("session3", 200, xagentauth.ZoneAI)
	// No sleep - immediate succession
	tracker.Record("session3", 300, xagentauth.ZoneAI)

	anomalies := tracker.Analyze("session3")
	found := false
	for _, a := range anomalies {
		if a.Type == "rapid_succession" {
			found = true
			break
		}
	}
	if !found {
		t.Error("Expected rapid_succession anomaly")
	}
}

func TestSessionTracker_Clear(t *testing.T) {
	tracker := NewSessionTimingTracker()
	tracker.Record("session4", 200, xagentauth.ZoneAI)
	tracker.Clear("session4")

	anomalies := tracker.Analyze("session4")
	if len(anomalies) != 0 {
		t.Errorf("Expected 0 anomalies after clear, got %d", len(anomalies))
	}
}
