use std::collections::HashMap;

use crate::types::AgentCapabilityScore;

/// Standard AgentAuth HTTP header names.
pub mod names {
    pub const STATUS: &str = "AgentAuth-Status";
    pub const SCORE: &str = "AgentAuth-Score";
    pub const MODEL_FAMILY: &str = "AgentAuth-Model-Family";
    pub const POMI_CONFIDENCE: &str = "AgentAuth-PoMI-Confidence";
    pub const CAPABILITIES: &str = "AgentAuth-Capabilities";
    pub const VERSION: &str = "AgentAuth-Version";
    pub const CHALLENGE_ID: &str = "AgentAuth-Challenge-Id";
    pub const TOKEN_EXPIRES: &str = "AgentAuth-Token-Expires";
}

/// Format an `AgentCapabilityScore` into a comma-separated header value.
///
/// Output format: `reasoning=0.9,execution=0.85,autonomy=0.8,speed=0.75,consistency=0.88`
pub fn format_capabilities(score: &AgentCapabilityScore) -> String {
    format!(
        "reasoning={},execution={},autonomy={},speed={},consistency={}",
        score.reasoning, score.execution, score.autonomy, score.speed, score.consistency
    )
}

/// Parse a capabilities header string into a map of dimension names to scores.
///
/// Invalid or unparseable values are silently skipped.
pub fn parse_capabilities(header: &str) -> HashMap<String, f64> {
    let mut result = HashMap::new();
    if header.is_empty() {
        return result;
    }
    for part in header.split(',') {
        if let Some((key, val)) = part.split_once('=') {
            let key = key.trim();
            let val = val.trim();
            if let Ok(v) = val.parse::<f64>() {
                result.insert(key.to_string(), v);
            }
        }
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_score() -> AgentCapabilityScore {
        AgentCapabilityScore {
            reasoning: 0.9,
            execution: 0.85,
            autonomy: 0.8,
            speed: 0.75,
            consistency: 0.88,
        }
    }

    #[test]
    fn test_format_capabilities() {
        let result = format_capabilities(&test_score());
        assert!(result.contains("reasoning=0.9"));
        assert!(result.contains("execution=0.85"));
        assert!(result.contains("autonomy=0.8"));
        assert!(result.contains("speed=0.75"));
        assert!(result.contains("consistency=0.88"));
        // Should have exactly 4 commas (5 fields)
        assert_eq!(result.matches(',').count(), 4);
    }

    #[test]
    fn test_parse_capabilities() {
        let header = "reasoning=0.9,execution=0.85,autonomy=0.8,speed=0.75,consistency=0.88";
        let result = parse_capabilities(header);
        assert_eq!(result.len(), 5);
        assert!((result["reasoning"] - 0.9).abs() < f64::EPSILON);
        assert!((result["execution"] - 0.85).abs() < f64::EPSILON);
        assert!((result["autonomy"] - 0.8).abs() < f64::EPSILON);
        assert!((result["speed"] - 0.75).abs() < f64::EPSILON);
        assert!((result["consistency"] - 0.88).abs() < f64::EPSILON);
    }

    #[test]
    fn test_roundtrip() {
        let score = test_score();
        let formatted = format_capabilities(&score);
        let parsed = parse_capabilities(&formatted);

        assert!((parsed["reasoning"] - score.reasoning).abs() < f64::EPSILON);
        assert!((parsed["execution"] - score.execution).abs() < f64::EPSILON);
        assert!((parsed["autonomy"] - score.autonomy).abs() < f64::EPSILON);
        assert!((parsed["speed"] - score.speed).abs() < f64::EPSILON);
        assert!((parsed["consistency"] - score.consistency).abs() < f64::EPSILON);
    }

    #[test]
    fn test_parse_empty() {
        let result = parse_capabilities("");
        assert!(result.is_empty());
    }

    #[test]
    fn test_parse_invalid_values() {
        let header = "reasoning=0.9,execution=bad,autonomy=0.8,speed=,consistency=NaN";
        let result = parse_capabilities(header);
        // "bad" and empty string should be skipped; NaN parses to f64::NAN
        assert!((result["reasoning"] - 0.9).abs() < f64::EPSILON);
        assert!(!result.contains_key("execution"));
        assert!((result["autonomy"] - 0.8).abs() < f64::EPSILON);
        assert!(!result.contains_key("speed"));
        // NaN is a valid f64 parse, so it should be present
        assert!(result["consistency"].is_nan());
    }

    #[test]
    fn test_header_constants() {
        assert_eq!(names::STATUS, "AgentAuth-Status");
        assert_eq!(names::SCORE, "AgentAuth-Score");
        assert_eq!(names::MODEL_FAMILY, "AgentAuth-Model-Family");
        assert_eq!(names::POMI_CONFIDENCE, "AgentAuth-PoMI-Confidence");
        assert_eq!(names::CAPABILITIES, "AgentAuth-Capabilities");
        assert_eq!(names::VERSION, "AgentAuth-Version");
        assert_eq!(names::CHALLENGE_ID, "AgentAuth-Challenge-Id");
        assert_eq!(names::TOKEN_EXPIRES, "AgentAuth-Token-Expires");
    }
}
