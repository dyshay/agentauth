use std::collections::HashMap;

use crate::types::{
    Difficulty, TimingAnalysis, TimingBaseline, TimingConfig, TimingPatternAnalysis, TimingTrend,
    TimingVerdict, TimingZone,
};

use super::baselines::default_baselines;

/// Analyzes response timing to classify solver type (AI, human, scripted).
pub struct TimingAnalyzer {
    baselines: HashMap<String, TimingBaseline>,
    defaults: DefaultThresholds,
}

struct DefaultThresholds {
    too_fast: f64,
    ai_lower: f64,
    ai_upper: f64,
    human: f64,
    timeout: f64,
}

impl TimingAnalyzer {
    pub fn new(config: &TimingConfig) -> Self {
        let mut baselines = HashMap::new();
        let all = config.baselines.as_ref().map(|b| b.as_slice()).unwrap_or(&[]);

        let source = if all.is_empty() {
            default_baselines()
        } else {
            all.to_vec()
        };

        for b in source {
            let key = format!("{}:{:?}", b.challenge_type, b.difficulty);
            baselines.insert(key, b);
        }

        Self {
            baselines,
            defaults: DefaultThresholds {
                too_fast: config.default_too_fast_ms,
                ai_lower: config.default_ai_lower_ms,
                ai_upper: config.default_ai_upper_ms,
                human: config.default_human_ms,
                timeout: config.default_timeout_ms,
            },
        }
    }

    /// Analyze a single response timing.
    pub fn analyze(
        &self,
        elapsed_ms: f64,
        challenge_type: &str,
        difficulty: &Difficulty,
        rtt_ms: Option<f64>,
    ) -> TimingAnalysis {
        let key = format!("{}:{:?}", challenge_type, difficulty);
        let baseline = self
            .baselines
            .get(&key)
            .cloned()
            .unwrap_or_else(|| self.make_default_baseline());

        // Apply RTT tolerance
        let tolerance = match rtt_ms {
            Some(rtt) if rtt > 0.0 => f64::max(rtt * 0.5, 200.0),
            _ => 0.0,
        };

        let adjusted = if tolerance > 0.0 {
            TimingBaseline {
                ai_upper_ms: baseline.ai_upper_ms + tolerance,
                human_ms: baseline.human_ms + tolerance,
                ..baseline.clone()
            }
        } else {
            baseline.clone()
        };

        let zone = self.classify_zone(elapsed_ms, &adjusted);
        let penalty = self.compute_penalty(&zone, elapsed_ms, &adjusted);
        let z_score = self.compute_z_score(elapsed_ms, &baseline);
        let mut confidence = self.compute_confidence(elapsed_ms, &adjusted, &zone);
        let mut details = self.describe_zone(&zone, elapsed_ms, &adjusted);

        // Round-number detection in ai_zone
        let is_round = elapsed_ms > 0.0
            && (elapsed_ms % 500.0 == 0.0 || elapsed_ms % 100.0 == 0.0);
        if is_round && zone == TimingZone::AiZone {
            confidence = (confidence * 0.85 * 1000.0).round() / 1000.0;
            details += " [round-number timing detected]";
        }

        TimingAnalysis {
            elapsed_ms,
            zone,
            confidence,
            z_score: (z_score * 100.0).round() / 100.0,
            penalty: (penalty * 1000.0).round() / 1000.0,
            details,
        }
    }

    /// Analyze per-step timing patterns.
    pub fn analyze_pattern(&self, step_timings: &[f64]) -> TimingPatternAnalysis {
        if step_timings.len() < 2 {
            return TimingPatternAnalysis {
                variance_coefficient: 0.0,
                trend: TimingTrend::Constant,
                round_number_ratio: 0.0,
                verdict: TimingVerdict::Inconclusive,
            };
        }

        let mean: f64 = step_timings.iter().sum::<f64>() / step_timings.len() as f64;
        let variance: f64 = step_timings.iter().map(|t| (t - mean).powi(2)).sum::<f64>()
            / step_timings.len() as f64;
        let std = variance.sqrt();
        let variance_coefficient = if mean > 0.0 { std / mean } else { 0.0 };

        let trend = self.detect_trend(step_timings);

        // Round number ratio
        let round_count = step_timings
            .iter()
            .filter(|t| **t % 500.0 == 0.0 || (**t % 100.0 == 0.0 && **t % 500.0 != 0.0))
            .count();
        let round_number_ratio = round_count as f64 / step_timings.len() as f64;

        // Verdict
        let verdict = if variance_coefficient < 0.05 && step_timings.len() >= 3 {
            TimingVerdict::Artificial
        } else if round_number_ratio > 0.5 {
            TimingVerdict::Artificial
        } else if variance_coefficient > 0.1 {
            TimingVerdict::Natural
        } else {
            TimingVerdict::Inconclusive
        };

        TimingPatternAnalysis {
            variance_coefficient: (variance_coefficient * 1000.0).round() / 1000.0,
            trend,
            round_number_ratio: (round_number_ratio * 100.0).round() / 100.0,
            verdict,
        }
    }

    fn make_default_baseline(&self) -> TimingBaseline {
        TimingBaseline {
            challenge_type: "default".into(),
            difficulty: Difficulty::Medium,
            mean_ms: (self.defaults.ai_lower + self.defaults.ai_upper) / 2.0,
            std_ms: (self.defaults.ai_upper - self.defaults.ai_lower) / 4.0,
            too_fast_ms: self.defaults.too_fast,
            ai_lower_ms: self.defaults.ai_lower,
            ai_upper_ms: self.defaults.ai_upper,
            human_ms: self.defaults.human,
            timeout_ms: self.defaults.timeout,
        }
    }

    fn classify_zone(&self, elapsed: f64, baseline: &TimingBaseline) -> TimingZone {
        if elapsed < baseline.too_fast_ms {
            TimingZone::TooFast
        } else if elapsed <= baseline.ai_upper_ms {
            TimingZone::AiZone
        } else if elapsed <= baseline.human_ms {
            TimingZone::Suspicious
        } else if elapsed <= baseline.timeout_ms {
            TimingZone::Human
        } else {
            TimingZone::Timeout
        }
    }

    fn compute_penalty(&self, zone: &TimingZone, elapsed: f64, baseline: &TimingBaseline) -> f64 {
        match zone {
            TimingZone::TooFast => 1.0,
            TimingZone::AiZone => 0.0,
            TimingZone::Suspicious => {
                let range = baseline.human_ms - baseline.ai_upper_ms;
                if range <= 0.0 {
                    return 0.5;
                }
                let position = (elapsed - baseline.ai_upper_ms) / range;
                0.3 + position * 0.4
            }
            TimingZone::Human => 0.9,
            TimingZone::Timeout => 1.0,
        }
    }

    fn compute_z_score(&self, elapsed: f64, baseline: &TimingBaseline) -> f64 {
        if baseline.std_ms == 0.0 {
            return 0.0;
        }
        (elapsed - baseline.mean_ms) / baseline.std_ms
    }

    fn compute_confidence(
        &self,
        elapsed: f64,
        baseline: &TimingBaseline,
        zone: &TimingZone,
    ) -> f64 {
        match zone {
            TimingZone::TooFast => {
                let ratio = elapsed / baseline.too_fast_ms;
                f64::max(0.5, 1.0 - ratio)
            }
            TimingZone::AiZone => {
                let dist = (elapsed - baseline.mean_ms).abs();
                let normalized = dist / baseline.std_ms;
                f64::max(0.5, f64::min(1.0, 1.0 - normalized * 0.15))
            }
            TimingZone::Suspicious => {
                let range = baseline.human_ms - baseline.ai_upper_ms;
                if range <= 0.0 {
                    return 0.5;
                }
                0.4 + 0.2 * ((elapsed - baseline.ai_upper_ms) / range)
            }
            TimingZone::Human => 0.8,
            TimingZone::Timeout => 0.95,
        }
    }

    fn describe_zone(&self, zone: &TimingZone, elapsed: f64, baseline: &TimingBaseline) -> String {
        let ms = elapsed.round() as u64;
        match zone {
            TimingZone::TooFast => format!(
                "Response time {}ms is below {}ms threshold \u{2014} likely pre-computed or scripted",
                ms, baseline.too_fast_ms as u64
            ),
            TimingZone::AiZone => format!(
                "Response time {}ms is within expected AI range [{}ms, {}ms]",
                ms, baseline.ai_lower_ms as u64, baseline.ai_upper_ms as u64
            ),
            TimingZone::Suspicious => format!(
                "Response time {}ms exceeds AI range \u{2014} possible human assistance",
                ms
            ),
            TimingZone::Human => format!(
                "Response time {}ms exceeds {}ms \u{2014} likely human solver",
                ms, baseline.human_ms as u64
            ),
            TimingZone::Timeout => format!(
                "Response time {}ms exceeds timeout threshold of {}ms",
                ms, baseline.timeout_ms as u64
            ),
        }
    }

    fn detect_trend(&self, timings: &[f64]) -> TimingTrend {
        if timings.len() < 3 {
            return TimingTrend::Variable;
        }

        let n = timings.len() as f64;
        let x_mean = (n - 1.0) / 2.0;
        let y_mean: f64 = timings.iter().sum::<f64>() / n;

        let mut numerator = 0.0;
        let mut denominator = 0.0;
        for (i, t) in timings.iter().enumerate() {
            let xi = i as f64;
            numerator += (xi - x_mean) * (t - y_mean);
            denominator += (xi - x_mean).powi(2);
        }

        if denominator == 0.0 {
            return TimingTrend::Constant;
        }

        let slope = numerator / denominator;
        let normalized_slope = if y_mean > 0.0 { slope / y_mean } else { 0.0 };

        if normalized_slope.abs() < 0.05 {
            TimingTrend::Constant
        } else if normalized_slope > 0.1 {
            TimingTrend::Increasing
        } else if normalized_slope < -0.1 {
            TimingTrend::Decreasing
        } else {
            TimingTrend::Variable
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn default_config() -> TimingConfig {
        TimingConfig::default()
    }

    fn analyzer() -> TimingAnalyzer {
        TimingAnalyzer::new(&default_config())
    }

    #[test]
    fn test_zone_too_fast() {
        let a = analyzer();
        let result = a.analyze(5.0, "crypto-nl", &Difficulty::Easy, None);
        assert_eq!(result.zone, TimingZone::TooFast);
        assert_eq!(result.penalty, 1.0);
    }

    #[test]
    fn test_zone_ai() {
        let a = analyzer();
        let result = a.analyze(200.0, "crypto-nl", &Difficulty::Easy, None);
        assert_eq!(result.zone, TimingZone::AiZone);
        assert_eq!(result.penalty, 0.0);
    }

    #[test]
    fn test_zone_suspicious() {
        let a = analyzer();
        let result = a.analyze(4000.0, "crypto-nl", &Difficulty::Easy, None);
        assert_eq!(result.zone, TimingZone::Suspicious);
        assert!(result.penalty > 0.0 && result.penalty < 1.0);
    }

    #[test]
    fn test_zone_human() {
        let a = analyzer();
        let result = a.analyze(12000.0, "crypto-nl", &Difficulty::Easy, None);
        assert_eq!(result.zone, TimingZone::Human);
    }

    #[test]
    fn test_zone_timeout() {
        let a = analyzer();
        let result = a.analyze(35000.0, "crypto-nl", &Difficulty::Easy, None);
        assert_eq!(result.zone, TimingZone::Timeout);
        assert_eq!(result.penalty, 1.0);
    }

    #[test]
    fn test_pattern_natural() {
        let a = analyzer();
        let result = a.analyze_pattern(&[150.0, 230.0, 180.0, 310.0, 190.0]);
        assert_eq!(result.verdict, TimingVerdict::Natural);
    }

    #[test]
    fn test_pattern_artificial() {
        let a = analyzer();
        // Very consistent timings = artificial
        let result = a.analyze_pattern(&[100.0, 100.0, 100.0, 100.0]);
        assert_eq!(result.verdict, TimingVerdict::Artificial);
    }

    #[test]
    fn test_pattern_round_numbers() {
        let a = analyzer();
        // Many round numbers = artificial
        let result = a.analyze_pattern(&[500.0, 1000.0, 500.0, 1000.0]);
        assert_eq!(result.verdict, TimingVerdict::Artificial);
    }
}
