package timing

import (
	"fmt"
	"math"
	"sync"
	"time"

	xagentauth "github.com/dyshay/agentauth/sdks/go"
)

type sessionEntry struct {
	ElapsedMs float64
	Zone      xagentauth.TimingZone
	Timestamp int64
}

// SessionTimingTracker detects timing anomalies across multiple challenges
// within a session (e.g., zone oscillation, suspiciously consistent timing,
// rapid successive attempts).
type SessionTimingTracker struct {
	mu       sync.Mutex
	sessions map[string][]sessionEntry
}

// NewSessionTimingTracker creates a new SessionTimingTracker.
func NewSessionTimingTracker() *SessionTimingTracker {
	return &SessionTimingTracker{
		sessions: make(map[string][]sessionEntry),
	}
}

// Record adds a timing entry for a session.
func (st *SessionTimingTracker) Record(sessionID string, elapsedMs float64, zone xagentauth.TimingZone) {
	st.mu.Lock()
	defer st.mu.Unlock()
	st.sessions[sessionID] = append(st.sessions[sessionID], sessionEntry{
		ElapsedMs: elapsedMs,
		Zone:      zone,
		Timestamp: time.Now().UnixMilli(),
	})
}

// Analyze detects anomalies in a session's timing data.
func (st *SessionTimingTracker) Analyze(sessionID string) []xagentauth.SessionTimingAnomaly {
	st.mu.Lock()
	entries := st.sessions[sessionID]
	st.mu.Unlock()

	if len(entries) < 2 {
		return nil
	}

	var anomalies []xagentauth.SessionTimingAnomaly

	// Check zone inconsistency: agent oscillates between ai_zone and human
	aiCount := 0
	humanCount := 0
	for _, e := range entries {
		if e.Zone == xagentauth.ZoneAI {
			aiCount++
		}
		if e.Zone == xagentauth.ZoneHuman || e.Zone == xagentauth.ZoneSuspicious {
			humanCount++
		}
	}
	if aiCount > 0 && humanCount > 0 && len(entries) >= 3 {
		severity := "medium"
		if humanCount >= aiCount {
			severity = "high"
		}
		anomalies = append(anomalies, xagentauth.SessionTimingAnomaly{
			Type:        "zone_inconsistency",
			Description: fmt.Sprintf("Session oscillates between AI zone (%dx) and human/suspicious zone (%dx) across %d challenges", aiCount, humanCount, len(entries)),
			Severity:    severity,
		})
	}

	// Check timing variance: too consistent across sessions (scripted)
	if len(entries) >= 3 {
		timings := make([]float64, len(entries))
		sum := 0.0
		for i, e := range entries {
			timings[i] = e.ElapsedMs
			sum += e.ElapsedMs
		}
		mean := sum / float64(len(timings))

		if mean > 0 {
			varianceSum := 0.0
			for _, t := range timings {
				diff := t - mean
				varianceSum += diff * diff
			}
			std := math.Sqrt(varianceSum / float64(len(timings)))
			cv := std / mean

			if cv < 0.05 {
				anomalies = append(anomalies, xagentauth.SessionTimingAnomaly{
					Type:        "timing_variance_anomaly",
					Description: fmt.Sprintf("Timing variance coefficient %.1f%% is suspiciously low across %d challenges", cv*100, len(entries)),
					Severity:    "high",
				})
			}
		}
	}

	// Check rapid succession: multiple challenges in < 5s
	for i := 1; i < len(entries); i++ {
		gap := entries[i].Timestamp - entries[i-1].Timestamp
		if gap < 5000 {
			severity := "low"
			if gap < 2000 {
				severity = "high"
			}
			anomalies = append(anomalies, xagentauth.SessionTimingAnomaly{
				Type:        "rapid_succession",
				Description: fmt.Sprintf("Challenges %d and %d completed %dms apart (< 5000ms threshold)", i-1, i, gap),
				Severity:    severity,
			})
			break // Only report once
		}
	}

	return anomalies
}

// Clear removes all timing data for a session.
func (st *SessionTimingTracker) Clear(sessionID string) {
	st.mu.Lock()
	defer st.mu.Unlock()
	delete(st.sessions, sessionID)
}
