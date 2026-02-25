use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use crate::types::{SessionAnomalySeverity, SessionTimingAnomaly, TimingZone};

struct SessionEntry {
    elapsed_ms: f64,
    zone: TimingZone,
    timestamp_ms: u64,
}

/// Tracks timing patterns across multiple challenges in a session.
pub struct SessionTimingTracker {
    sessions: Mutex<HashMap<String, Vec<SessionEntry>>>,
}

impl SessionTimingTracker {
    pub fn new() -> Self {
        Self {
            sessions: Mutex::new(HashMap::new()),
        }
    }

    fn now_ms() -> u64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64
    }

    /// Record a challenge timing for a session.
    pub fn record(&self, session_id: &str, elapsed_ms: f64, zone: TimingZone) {
        let mut sessions = self.sessions.lock().unwrap();
        let entries = sessions.entry(session_id.to_string()).or_default();
        entries.push(SessionEntry {
            elapsed_ms,
            zone,
            timestamp_ms: Self::now_ms(),
        });
    }

    /// Analyze a session for timing anomalies.
    pub fn analyze(&self, session_id: &str) -> Vec<SessionTimingAnomaly> {
        let sessions = self.sessions.lock().unwrap();
        let entries = match sessions.get(session_id) {
            Some(e) if e.len() >= 2 => e,
            _ => return vec![],
        };

        let mut anomalies = Vec::new();

        // Zone inconsistency: oscillates between ai_zone and human/suspicious
        let zones: Vec<&TimingZone> = entries.iter().map(|e| &e.zone).collect();
        let ai_count = zones.iter().filter(|z| ***z == TimingZone::AiZone).count();
        let human_count = zones
            .iter()
            .filter(|z| ***z == TimingZone::Human || ***z == TimingZone::Suspicious)
            .count();

        if ai_count > 0 && human_count > 0 && entries.len() >= 3 {
            let severity = if human_count >= ai_count {
                SessionAnomalySeverity::High
            } else {
                SessionAnomalySeverity::Medium
            };
            anomalies.push(SessionTimingAnomaly {
                anomaly_type: "zone_inconsistency".into(),
                description: format!(
                    "Session oscillates between AI zone ({}x) and human/suspicious zone ({}x) across {} challenges",
                    ai_count, human_count, entries.len()
                ),
                severity,
            });
        }

        // Timing variance anomaly: too consistent across challenges (scripted)
        if entries.len() >= 3 {
            let timings: Vec<f64> = entries.iter().map(|e| e.elapsed_ms).collect();
            let mean: f64 = timings.iter().sum::<f64>() / timings.len() as f64;
            if mean > 0.0 {
                let variance: f64 =
                    timings.iter().map(|t| (t - mean).powi(2)).sum::<f64>() / timings.len() as f64;
                let std = variance.sqrt();
                let cv = std / mean;
                if cv < 0.05 {
                    anomalies.push(SessionTimingAnomaly {
                        anomaly_type: "timing_variance_anomaly".into(),
                        description: format!(
                            "Timing variance coefficient {:.1}% is suspiciously low across {} challenges",
                            cv * 100.0,
                            entries.len()
                        ),
                        severity: SessionAnomalySeverity::High,
                    });
                }
            }
        }

        // Rapid succession: challenges completed < 5s apart
        for i in 1..entries.len() {
            let gap = entries[i]
                .timestamp_ms
                .saturating_sub(entries[i - 1].timestamp_ms);
            if gap < 5000 {
                let severity = if gap < 2000 {
                    SessionAnomalySeverity::High
                } else {
                    SessionAnomalySeverity::Low
                };
                anomalies.push(SessionTimingAnomaly {
                    anomaly_type: "rapid_succession".into(),
                    description: format!(
                        "Challenges {} and {} completed {}ms apart (< 5000ms threshold)",
                        i - 1,
                        i,
                        gap
                    ),
                    severity,
                });
                break; // Only report once
            }
        }

        anomalies
    }

    /// Clear session data.
    pub fn clear(&self, session_id: &str) {
        self.sessions.lock().unwrap().remove(session_id);
    }
}

impl Default for SessionTimingTracker {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_zone_inconsistency() {
        let tracker = SessionTimingTracker::new();
        tracker.record("s1", 200.0, TimingZone::AiZone);
        tracker.record("s1", 15000.0, TimingZone::Human);
        tracker.record("s1", 300.0, TimingZone::AiZone);

        let anomalies = tracker.analyze("s1");
        assert!(
            anomalies
                .iter()
                .any(|a| a.anomaly_type == "zone_inconsistency"),
            "Expected zone_inconsistency anomaly"
        );
    }

    #[test]
    fn test_variance_anomaly() {
        let tracker = SessionTimingTracker::new();
        // Very consistent timings
        tracker.record("s2", 500.0, TimingZone::AiZone);
        tracker.record("s2", 500.0, TimingZone::AiZone);
        tracker.record("s2", 500.0, TimingZone::AiZone);

        let anomalies = tracker.analyze("s2");
        assert!(
            anomalies
                .iter()
                .any(|a| a.anomaly_type == "timing_variance_anomaly"),
            "Expected timing_variance_anomaly"
        );
    }

    #[test]
    fn test_rapid_succession() {
        let tracker = SessionTimingTracker::new();
        // Record two entries very quickly (within same test, timestamps will be close)
        tracker.record("s3", 200.0, TimingZone::AiZone);
        tracker.record("s3", 300.0, TimingZone::AiZone);

        let anomalies = tracker.analyze("s3");
        assert!(
            anomalies
                .iter()
                .any(|a| a.anomaly_type == "rapid_succession"),
            "Expected rapid_succession anomaly"
        );
    }
}
