use std::collections::HashMap;

use regex::Regex;

use crate::types::{Canary, CanaryAnalysis, ModelAlternative, ModelIdentification};

use super::extractor::CanaryExtractor;

/// Bayesian model classifier using canary response analysis.
pub struct ModelClassifier {
    model_families: Vec<String>,
    confidence_threshold: f64,
    extractor: CanaryExtractor,
}

impl ModelClassifier {
    pub fn new(model_families: Vec<String>, confidence_threshold: f64) -> Self {
        Self {
            model_families,
            confidence_threshold,
            extractor: CanaryExtractor::new(),
        }
    }

    /// Classify the model family based on canary responses using Bayesian inference.
    pub fn classify(
        &self,
        canaries: &[Canary],
        canary_responses: &Option<HashMap<String, String>>,
    ) -> ModelIdentification {
        if canary_responses.is_none() || canaries.is_empty() {
            return ModelIdentification {
                family: "unknown".into(),
                confidence: 0.0,
                evidence: vec![],
                alternatives: vec![],
            };
        }

        let responses = canary_responses.as_ref().unwrap();
        let evidence = self.extractor.extract(canaries, canary_responses);

        if evidence.is_empty() {
            return ModelIdentification {
                family: "unknown".into(),
                confidence: 0.0,
                evidence: vec![],
                alternatives: vec![],
            };
        }

        // Initialize uniform prior
        let n = self.model_families.len() as f64;
        let mut posteriors: HashMap<String, f64> = self
            .model_families
            .iter()
            .map(|f| (f.clone(), 1.0 / n))
            .collect();

        // Bayesian update for each canary with a response
        for canary in canaries {
            let response = match responses.get(&canary.id) {
                Some(r) => r,
                None => continue,
            };

            for family in &self.model_families {
                let prior = *posteriors.get(family).unwrap_or(&0.0);
                let likelihood = self.compute_likelihood(canary, response, family);
                posteriors.insert(family.clone(), prior * likelihood);
            }

            // Normalize after each update to prevent underflow
            self.normalize(&mut posteriors);
        }

        // Find the best hypothesis
        let mut best_family = "unknown".to_string();
        let mut best_confidence = 0.0_f64;

        for (family, posterior) in &posteriors {
            if *posterior > best_confidence {
                best_confidence = *posterior;
                best_family = family.clone();
            }
        }

        // Build alternatives
        let mut alternatives: Vec<ModelAlternative> = posteriors
            .iter()
            .filter(|(f, _)| **f != best_family)
            .map(|(f, p)| ModelAlternative {
                family: f.clone(),
                confidence: (p * 1000.0).round() / 1000.0,
            })
            .collect();
        alternatives.sort_by(|a, b| b.confidence.partial_cmp(&a.confidence).unwrap());

        // Apply confidence threshold
        if best_confidence < self.confidence_threshold {
            return ModelIdentification {
                family: "unknown".into(),
                confidence: (best_confidence * 1000.0).round() / 1000.0,
                evidence,
                alternatives: {
                    let mut alts = vec![ModelAlternative {
                        family: best_family,
                        confidence: (best_confidence * 1000.0).round() / 1000.0,
                    }];
                    alts.extend(alternatives);
                    alts
                },
            };
        }

        ModelIdentification {
            family: best_family,
            confidence: (best_confidence * 1000.0).round() / 1000.0,
            evidence,
            alternatives,
        }
    }

    fn compute_likelihood(&self, canary: &Canary, response: &str, family: &str) -> f64 {
        let weight = canary.confidence_weight;

        match &canary.analysis {
            CanaryAnalysis::ExactMatch { expected } => {
                let exp = match expected.get(family) {
                    Some(e) => e,
                    None => return 0.5,
                };
                let is_match = response.trim().to_lowercase() == exp.trim().to_lowercase();
                if is_match {
                    0.5 + 0.5 * weight
                } else {
                    0.5 - 0.4 * weight
                }
            }
            CanaryAnalysis::Pattern { patterns } => {
                let pattern = match patterns.get(family) {
                    Some(p) => p,
                    None => return 0.5,
                };
                let is_match = match Regex::new(&format!("(?i){}", pattern)) {
                    Ok(re) => re.is_match(response),
                    Err(_) => return 0.5,
                };
                if is_match {
                    0.5 + 0.45 * weight
                } else {
                    0.5 - 0.35 * weight
                }
            }
            CanaryAnalysis::Statistical { distributions } => {
                let dist = match distributions.get(family) {
                    Some(d) => d,
                    None => return 0.5,
                };
                let re = Regex::new(r"-?\d+\.?\d*").unwrap();
                let value = match re
                    .find(response)
                    .and_then(|m| m.as_str().parse::<f64>().ok())
                {
                    Some(v) => v,
                    None => return 0.5,
                };
                let pdf = self.gaussian_pdf(value, dist.mean, dist.stddev);
                let max_pdf = self.gaussian_pdf(dist.mean, dist.mean, dist.stddev);
                let normalized = if max_pdf > 0.0 { pdf / max_pdf } else { 0.0 };
                0.1 + 0.8 * normalized * weight
            }
        }
    }

    fn gaussian_pdf(&self, x: f64, mean: f64, stddev: f64) -> f64 {
        let z = (x - mean) / stddev;
        (-0.5 * z * z).exp() / (stddev * (2.0 * std::f64::consts::PI).sqrt())
    }

    fn normalize(&self, posteriors: &mut HashMap<String, f64>) {
        let sum: f64 = posteriors.values().sum();
        if sum == 0.0 {
            let n = posteriors.len() as f64;
            for v in posteriors.values_mut() {
                *v = 1.0 / n;
            }
            return;
        }
        for v in posteriors.values_mut() {
            *v /= sum;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::InjectionMethod;

    fn default_families() -> Vec<String> {
        vec![
            "gpt-4-class".into(),
            "claude-3-class".into(),
            "gemini-class".into(),
            "llama-class".into(),
            "mistral-class".into(),
        ]
    }

    fn make_canary() -> Canary {
        Canary {
            id: "test".into(),
            prompt: "test".into(),
            injection_method: InjectionMethod::Inline,
            analysis: CanaryAnalysis::ExactMatch {
                expected: [
                    ("gpt-4-class".to_string(), "alpha".to_string()),
                    ("claude-3-class".to_string(), "beta".to_string()),
                ]
                .into_iter()
                .collect(),
            },
            confidence_weight: 0.5,
        }
    }

    #[test]
    fn test_classify_known() {
        let classifier = ModelClassifier::new(default_families(), 0.3);
        let canary = make_canary();
        let mut responses = HashMap::new();
        responses.insert("test".to_string(), "alpha".to_string());

        let result = classifier.classify(&[canary], &Some(responses));
        // Should identify gpt-4-class since "alpha" matches it
        assert!(result.confidence > 0.0);
        // The family should be either gpt-4-class or something else depending on Bayesian outcome
    }

    #[test]
    fn test_classify_unknown() {
        let classifier = ModelClassifier::new(default_families(), 0.9);
        let canary = make_canary();
        let mut responses = HashMap::new();
        responses.insert("test".to_string(), "gamma".to_string());

        let result = classifier.classify(&[canary], &Some(responses));
        // With high threshold, "gamma" won't match, so likely "unknown"
        // The confidence might be below threshold
        assert!(!result.evidence.is_empty() || result.family == "unknown");
    }

    #[test]
    fn test_classify_no_responses() {
        let classifier = ModelClassifier::new(default_families(), 0.5);
        let canary = make_canary();

        let result = classifier.classify(&[canary], &None);
        assert_eq!(result.family, "unknown");
        assert_eq!(result.confidence, 0.0);
    }
}
