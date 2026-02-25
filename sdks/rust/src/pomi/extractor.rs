use std::collections::HashMap;

use regex::Regex;

use crate::types::{Canary, CanaryAnalysis, CanaryEvidence};

/// Evaluates canary responses against expected patterns.
pub struct CanaryExtractor;

impl CanaryExtractor {
    pub fn new() -> Self {
        Self
    }

    /// Extract evidence from canary responses.
    pub fn extract(
        &self,
        injected_canaries: &[Canary],
        canary_responses: &Option<HashMap<String, String>>,
    ) -> Vec<CanaryEvidence> {
        let responses = match canary_responses {
            Some(r) => r,
            None => return vec![],
        };

        let mut evidence = Vec::new();

        for canary in injected_canaries {
            if let Some(response) = responses.get(&canary.id) {
                let result = self.evaluate(canary, response);
                evidence.push(result);
            }
        }

        evidence
    }

    fn evaluate(&self, canary: &Canary, observed: &str) -> CanaryEvidence {
        match &canary.analysis {
            CanaryAnalysis::ExactMatch { expected } => {
                self.evaluate_exact_match(canary, expected, observed)
            }
            CanaryAnalysis::Pattern { patterns } => {
                self.evaluate_pattern(canary, patterns, observed)
            }
            CanaryAnalysis::Statistical { distributions } => {
                self.evaluate_statistical(canary, distributions, observed)
            }
        }
    }

    fn evaluate_exact_match(
        &self,
        canary: &Canary,
        expected: &HashMap<String, String>,
        observed: &str,
    ) -> CanaryEvidence {
        let mut best_match = String::new();
        let mut is_match = false;

        for (_family, exp) in expected {
            if observed.trim().to_lowercase() == exp.trim().to_lowercase() {
                best_match = exp.clone();
                is_match = true;
                break;
            }
        }

        if !is_match {
            best_match = expected.values().next().cloned().unwrap_or_default();
        }

        CanaryEvidence {
            canary_id: canary.id.clone(),
            observed: observed.to_string(),
            expected: best_match,
            is_match,
            confidence_contribution: if is_match {
                canary.confidence_weight
            } else {
                canary.confidence_weight * 0.3
            },
        }
    }

    fn evaluate_pattern(
        &self,
        canary: &Canary,
        patterns: &HashMap<String, String>,
        observed: &str,
    ) -> CanaryEvidence {
        let mut best_pattern = String::new();
        let mut is_match = false;

        for (_family, pattern) in patterns {
            if let Ok(re) = Regex::new(&format!("(?i){}", pattern)) {
                if re.is_match(observed) {
                    best_pattern = pattern.clone();
                    is_match = true;
                    break;
                }
            }
        }

        if !is_match {
            best_pattern = patterns.values().next().cloned().unwrap_or_default();
        }

        CanaryEvidence {
            canary_id: canary.id.clone(),
            observed: observed.to_string(),
            expected: best_pattern,
            is_match,
            confidence_contribution: if is_match {
                canary.confidence_weight
            } else {
                canary.confidence_weight * 0.2
            },
        }
    }

    fn evaluate_statistical(
        &self,
        canary: &Canary,
        distributions: &HashMap<String, crate::types::Distribution>,
        observed: &str,
    ) -> CanaryEvidence {
        // Extract first number from observed response
        let re = Regex::new(r"-?\d+\.?\d*").unwrap();
        let num_value = re
            .find(observed)
            .and_then(|m| m.as_str().parse::<f64>().ok());

        let mut best_dist = String::new();
        let mut is_match = false;

        if let Some(value) = num_value {
            for (family, dist) in distributions {
                // Within 2 standard deviations
                if (value - dist.mean).abs() <= 2.0 * dist.stddev {
                    best_dist = format!("{}: mean={}, stddev={}", family, dist.mean, dist.stddev);
                    is_match = true;
                    break;
                }
            }
        }

        if !is_match {
            if let Some((family, dist)) = distributions.iter().next() {
                best_dist = format!("{}: mean={}, stddev={}", family, dist.mean, dist.stddev);
            }
        }

        CanaryEvidence {
            canary_id: canary.id.clone(),
            observed: observed.to_string(),
            expected: best_dist,
            is_match,
            confidence_contribution: if is_match {
                canary.confidence_weight * 0.7
            } else {
                canary.confidence_weight * 0.1
            },
        }
    }
}

impl Default for CanaryExtractor {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{Distribution, InjectionMethod};

    fn make_exact_canary() -> Canary {
        Canary {
            id: "test-exact".into(),
            prompt: "test".into(),
            injection_method: InjectionMethod::Inline,
            analysis: CanaryAnalysis::ExactMatch {
                expected: [("gpt-4-class".to_string(), "hello".to_string())]
                    .into_iter()
                    .collect(),
            },
            confidence_weight: 0.5,
        }
    }

    fn make_pattern_canary() -> Canary {
        Canary {
            id: "test-pattern".into(),
            prompt: "test".into(),
            injection_method: InjectionMethod::Inline,
            analysis: CanaryAnalysis::Pattern {
                patterns: [("gpt-4-class".to_string(), r"hello|world".to_string())]
                    .into_iter()
                    .collect(),
            },
            confidence_weight: 0.4,
        }
    }

    fn make_statistical_canary() -> Canary {
        Canary {
            id: "test-stat".into(),
            prompt: "test".into(),
            injection_method: InjectionMethod::Inline,
            analysis: CanaryAnalysis::Statistical {
                distributions: [(
                    "gpt-4-class".to_string(),
                    Distribution {
                        mean: 50.0,
                        stddev: 10.0,
                    },
                )]
                .into_iter()
                .collect(),
            },
            confidence_weight: 0.3,
        }
    }

    #[test]
    fn test_exact_match() {
        let extractor = CanaryExtractor::new();
        let canary = make_exact_canary();
        let mut responses = HashMap::new();
        responses.insert("test-exact".to_string(), "Hello".to_string());

        let evidence = extractor.extract(&[canary], &Some(responses));
        assert_eq!(evidence.len(), 1);
        assert!(evidence[0].is_match); // case-insensitive match
    }

    #[test]
    fn test_pattern_match() {
        let extractor = CanaryExtractor::new();
        let canary = make_pattern_canary();
        let mut responses = HashMap::new();
        responses.insert("test-pattern".to_string(), "hello there".to_string());

        let evidence = extractor.extract(&[canary], &Some(responses));
        assert_eq!(evidence.len(), 1);
        assert!(evidence[0].is_match);
    }

    #[test]
    fn test_statistical_match() {
        let extractor = CanaryExtractor::new();
        let canary = make_statistical_canary();
        let mut responses = HashMap::new();
        responses.insert("test-stat".to_string(), "55".to_string());

        let evidence = extractor.extract(&[canary], &Some(responses));
        assert_eq!(evidence.len(), 1);
        assert!(evidence[0].is_match); // 55 is within 2*10 of mean 50
    }

    #[test]
    fn test_no_response() {
        let extractor = CanaryExtractor::new();
        let canary = make_exact_canary();

        let evidence = extractor.extract(&[canary], &None);
        assert!(evidence.is_empty());
    }
}
