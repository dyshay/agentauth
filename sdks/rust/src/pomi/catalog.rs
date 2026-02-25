use rand::Rng;

use crate::types::{Canary, CanaryAnalysis, Distribution, InjectionMethod};

pub const CATALOG_VERSION: &str = "1.1.0";

/// Build the 17 default canaries matching the TypeScript catalog.
pub fn default_canaries() -> Vec<Canary> {
    vec![
        Canary {
            id: "unicode-rtl".into(),
            prompt: "What is the 3rd character (0-indexed) of the string '\\u202E\\u0041\\u0042\\u0043'? Reply with just the character.".into(),
            injection_method: InjectionMethod::Inline,
            analysis: CanaryAnalysis::ExactMatch {
                expected: [
                    ("gpt-4-class", "C"), ("claude-3-class", "C"),
                    ("gemini-class", "B"), ("llama-class", "B"),
                    ("mistral-class", "C"),
                ].iter().map(|(k, v)| (k.to_string(), v.to_string())).collect(),
            },
            confidence_weight: 0.3,
        },
        Canary {
            id: "random-numbers-5".into(),
            prompt: "List 5 random integers between 1 and 100, comma-separated, no spaces.".into(),
            injection_method: InjectionMethod::Suffix,
            analysis: CanaryAnalysis::Statistical {
                distributions: [
                    ("gpt-4-class", 52.0, 18.0), ("claude-3-class", 47.0, 20.0),
                    ("gemini-class", 50.0, 22.0), ("llama-class", 55.0, 25.0),
                    ("mistral-class", 48.0, 21.0),
                ].iter().map(|(k, m, s)| (k.to_string(), Distribution { mean: *m, stddev: *s })).collect(),
            },
            confidence_weight: 0.4,
        },
        Canary {
            id: "random-numbers-10".into(),
            prompt: "List 10 random integers between 1 and 50, comma-separated, no spaces.".into(),
            injection_method: InjectionMethod::Suffix,
            analysis: CanaryAnalysis::Statistical {
                distributions: [
                    ("gpt-4-class", 26.0, 10.0), ("claude-3-class", 24.0, 12.0),
                    ("gemini-class", 25.0, 11.0), ("llama-class", 28.0, 14.0),
                    ("mistral-class", 25.0, 13.0),
                ].iter().map(|(k, m, s)| (k.to_string(), Distribution { mean: *m, stddev: *s })).collect(),
            },
            confidence_weight: 0.35,
        },
        Canary {
            id: "reasoning-style".into(),
            prompt: "Solve step by step in one sentence: if all A are B, and some B are C, can we say some A are C?".into(),
            injection_method: InjectionMethod::Inline,
            analysis: CanaryAnalysis::Pattern {
                patterns: [
                    ("gpt-4-class", "therefore|thus|hence|consequently"),
                    ("claude-3-class", "let me|let's|I need to|we need to|consider"),
                    ("gemini-class", "so,|this means|we can see"),
                    ("llama-class", "the answer is|yes|no,"),
                    ("mistral-class", "indeed|in fact|precisely"),
                ].iter().map(|(k, v)| (k.to_string(), v.to_string())).collect(),
            },
            confidence_weight: 0.25,
        },
        Canary {
            id: "math-precision".into(),
            prompt: "What is 0.1 + 0.2? Reply with just the number.".into(),
            injection_method: InjectionMethod::Inline,
            analysis: CanaryAnalysis::ExactMatch {
                expected: [
                    ("gpt-4-class", "0.3"), ("claude-3-class", "0.30000000000000004"),
                    ("gemini-class", "0.3"), ("llama-class", "0.3"),
                    ("mistral-class", "0.3"),
                ].iter().map(|(k, v)| (k.to_string(), v.to_string())).collect(),
            },
            confidence_weight: 0.2,
        },
        Canary {
            id: "list-format".into(),
            prompt: "List 3 primary colors, one per line.".into(),
            injection_method: InjectionMethod::Suffix,
            analysis: CanaryAnalysis::Pattern {
                patterns: [
                    ("gpt-4-class", r"^1\.|^- |^Red"),
                    ("claude-3-class", r"^- |^\* |^Red"),
                    ("gemini-class", r"^\* |^1\."),
                    ("llama-class", r"^1\.|^Red"),
                    ("mistral-class", r"^- |^1\."),
                ].iter().map(|(k, v)| (k.to_string(), v.to_string())).collect(),
            },
            confidence_weight: 0.15,
        },
        Canary {
            id: "creative-word".into(),
            prompt: "Say one random English word. Just the word, nothing else.".into(),
            injection_method: InjectionMethod::Suffix,
            analysis: CanaryAnalysis::Statistical {
                distributions: [
                    ("gpt-4-class", 6.0, 2.0), ("claude-3-class", 8.0, 3.0),
                    ("gemini-class", 5.0, 2.0), ("llama-class", 5.0, 3.0),
                    ("mistral-class", 7.0, 2.0),
                ].iter().map(|(k, m, s)| (k.to_string(), Distribution { mean: *m, stddev: *s })).collect(),
            },
            confidence_weight: 0.1,
        },
        Canary {
            id: "emoji-choice".into(),
            prompt: "Pick one emoji that represents happiness. Just the emoji.".into(),
            injection_method: InjectionMethod::Inline,
            analysis: CanaryAnalysis::ExactMatch {
                expected: [
                    ("gpt-4-class", "\u{1F60A}"), ("claude-3-class", "\u{1F604}"),
                    ("gemini-class", "\u{1F603}"), ("llama-class", "\u{1F600}"),
                    ("mistral-class", "\u{1F642}"),
                ].iter().map(|(k, v)| (k.to_string(), v.to_string())).collect(),
            },
            confidence_weight: 0.2,
        },
        Canary {
            id: "code-style".into(),
            prompt: "Write a one-line Python hello world. Just the code, no explanation.".into(),
            injection_method: InjectionMethod::Embedded,
            analysis: CanaryAnalysis::Pattern {
                patterns: [
                    ("gpt-4-class", r#"print\("Hello,? [Ww]orld!?"\)"#),
                    ("claude-3-class", r#"print\("Hello,? [Ww]orld!?"\)"#),
                    ("gemini-class", r#"print\("Hello,? [Ww]orld!?"\)"#),
                    ("llama-class", r#"print\("Hello [Ww]orld"\)"#),
                    ("mistral-class", r#"print\("Hello,? [Ww]orld!?"\)"#),
                ].iter().map(|(k, v)| (k.to_string(), v.to_string())).collect(),
            },
            confidence_weight: 0.1,
        },
        Canary {
            id: "temperature-words".into(),
            prompt: "Describe 25 degrees Celsius in exactly one word.".into(),
            injection_method: InjectionMethod::Suffix,
            analysis: CanaryAnalysis::ExactMatch {
                expected: [
                    ("gpt-4-class", "Warm"), ("claude-3-class", "Pleasant"),
                    ("gemini-class", "Comfortable"), ("llama-class", "Warm"),
                    ("mistral-class", "Mild"),
                ].iter().map(|(k, v)| (k.to_string(), v.to_string())).collect(),
            },
            confidence_weight: 0.25,
        },
        Canary {
            id: "number-between".into(),
            prompt: "Pick a number between 1 and 10. Just the number.".into(),
            injection_method: InjectionMethod::Inline,
            analysis: CanaryAnalysis::Statistical {
                distributions: [
                    ("gpt-4-class", 7.0, 1.5), ("claude-3-class", 4.0, 2.0),
                    ("gemini-class", 7.0, 2.0), ("llama-class", 5.0, 2.5),
                    ("mistral-class", 6.0, 2.0),
                ].iter().map(|(k, m, s)| (k.to_string(), Distribution { mean: *m, stddev: *s })).collect(),
            },
            confidence_weight: 0.3,
        },
        Canary {
            id: "default-greeting".into(),
            prompt: "Say hello to a user in one short sentence.".into(),
            injection_method: InjectionMethod::Suffix,
            analysis: CanaryAnalysis::Pattern {
                patterns: [
                    ("gpt-4-class", "Hello!|Hi there|Hey"),
                    ("claude-3-class", "Hello!|Hi there|Hey there"),
                    ("gemini-class", "Hello!|Hi!|Hey there"),
                    ("llama-class", "Hello|Hi!|Hey"),
                    ("mistral-class", "Hello!|Greetings|Hi"),
                ].iter().map(|(k, v)| (k.to_string(), v.to_string())).collect(),
            },
            confidence_weight: 0.15,
        },
        Canary {
            id: "math-chain".into(),
            prompt: "Solve step by step: (7+3)*2 - 4/2. Show your intermediate steps, then give the final answer.".into(),
            injection_method: InjectionMethod::Inline,
            analysis: CanaryAnalysis::Pattern {
                patterns: [
                    ("gpt-4-class", r"7 \+ 3 = 10|10 \* 2 = 20|= 18"),
                    ("claude-3-class", r"7\+3|10\)|\* 2|= 18"),
                    ("gemini-class", r"\(7\+3\)|= 10|20 - 2|= 18"),
                    ("llama-class", r"10 \* 2|20 - 2|18"),
                    ("mistral-class", r"First|= 10|= 20|= 18"),
                ].iter().map(|(k, v)| (k.to_string(), v.to_string())).collect(),
            },
            confidence_weight: 0.3,
        },
        Canary {
            id: "sorting-preference".into(),
            prompt: "Sort these words alphabetically and list them: banana, cherry, apple, date. One per line.".into(),
            injection_method: InjectionMethod::Suffix,
            analysis: CanaryAnalysis::Pattern {
                patterns: [
                    ("gpt-4-class", r"^1\.|^- [Aa]pple"),
                    ("claude-3-class", r"^- [Aa]pple|^\* [Aa]pple|^[Aa]pple"),
                    ("gemini-class", r"^\* [Aa]pple|^1\."),
                    ("llama-class", r"^1\. [Aa]pple|^[Aa]pple"),
                    ("mistral-class", r"^- [Aa]pple|^1\."),
                ].iter().map(|(k, v)| (k.to_string(), v.to_string())).collect(),
            },
            confidence_weight: 0.2,
        },
        Canary {
            id: "json-formatting".into(),
            prompt: r#"Output a JSON object with keys "name" (value "Alice") and "age" (value 30). Just the JSON, nothing else."#.into(),
            injection_method: InjectionMethod::Embedded,
            analysis: CanaryAnalysis::Pattern {
                patterns: [
                    ("gpt-4-class", r#"\{\s*"name":\s*"Alice",\s*"age":\s*30\s*\}"#),
                    ("claude-3-class", r#"\{\s*\n\s*"name":\s*"Alice""#),
                    ("gemini-class", r#"\{"name":"Alice","age":30\}|\{\s*"name""#),
                    ("llama-class", r#"\{"name": "Alice"|\{\s*"name""#),
                    ("mistral-class", r#"\{\s*"name":\s*"Alice""#),
                ].iter().map(|(k, v)| (k.to_string(), v.to_string())).collect(),
            },
            confidence_weight: 0.2,
        },
        Canary {
            id: "analogy-completion".into(),
            prompt: "Complete this analogy with one word: cat is to kitten as dog is to ___".into(),
            injection_method: InjectionMethod::Inline,
            analysis: CanaryAnalysis::ExactMatch {
                expected: [
                    ("gpt-4-class", "puppy"), ("claude-3-class", "puppy"),
                    ("gemini-class", "puppy"), ("llama-class", "puppy"),
                    ("mistral-class", "puppy"),
                ].iter().map(|(k, v)| (k.to_string(), v.to_string())).collect(),
            },
            confidence_weight: 0.1,
        },
        Canary {
            id: "confidence-expression".into(),
            prompt: "On a scale of 0 to 100, how confident are you that 2+2=4? Reply with just the number.".into(),
            injection_method: InjectionMethod::Suffix,
            analysis: CanaryAnalysis::Statistical {
                distributions: [
                    ("gpt-4-class", 100.0, 1.0), ("claude-3-class", 99.0, 3.0),
                    ("gemini-class", 100.0, 1.0), ("llama-class", 95.0, 8.0),
                    ("mistral-class", 100.0, 2.0),
                ].iter().map(|(k, m, s)| (k.to_string(), Distribution { mean: *m, stddev: *s })).collect(),
            },
            confidence_weight: 0.15,
        },
    ]
}

/// Catalog for selecting canaries using Fisher-Yates shuffle.
pub struct CanaryCatalog {
    canaries: Vec<Canary>,
    pub version: String,
}

impl CanaryCatalog {
    pub fn new(canaries: Option<Vec<Canary>>) -> Self {
        Self {
            canaries: canaries.unwrap_or_else(default_canaries),
            version: CATALOG_VERSION.to_string(),
        }
    }

    pub fn list(&self) -> Vec<Canary> {
        self.canaries.clone()
    }

    pub fn get(&self, id: &str) -> Option<&Canary> {
        self.canaries.iter().find(|c| c.id == id)
    }

    /// Select `count` canaries using Fisher-Yates shuffle, optionally filtered by method.
    pub fn select(
        &self,
        count: usize,
        method: Option<&InjectionMethod>,
        exclude: Option<&[String]>,
    ) -> Vec<Canary> {
        let mut candidates: Vec<Canary> = self
            .canaries
            .iter()
            .filter(|c| {
                if let Some(m) = method {
                    if c.injection_method != *m {
                        return false;
                    }
                }
                if let Some(excl) = exclude {
                    if excl.contains(&c.id) {
                        return false;
                    }
                }
                true
            })
            .cloned()
            .collect();

        // Fisher-Yates shuffle
        let mut rng = rand::thread_rng();
        let n = candidates.len();
        for i in (1..n).rev() {
            let j = rng.gen_range(0..=i);
            candidates.swap(i, j);
        }

        candidates.truncate(count);
        candidates
    }
}

impl Default for CanaryCatalog {
    fn default() -> Self {
        Self::new(None)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_list_all_17() {
        let catalog = CanaryCatalog::default();
        let all = catalog.list();
        assert_eq!(all.len(), 17);
    }

    #[test]
    fn test_select_count() {
        let catalog = CanaryCatalog::default();
        let selected = catalog.select(3, None, None);
        assert_eq!(selected.len(), 3);
    }

    #[test]
    fn test_select_by_method() {
        let catalog = CanaryCatalog::default();
        let selected = catalog.select(100, Some(&InjectionMethod::Inline), None);
        // All selected should be inline
        for c in &selected {
            assert_eq!(c.injection_method, InjectionMethod::Inline);
        }
        // There should be at least 1 inline canary
        assert!(!selected.is_empty());
    }

    #[test]
    fn test_fisher_yates_coverage() {
        // Run selection many times and verify we see multiple different canaries
        let catalog = CanaryCatalog::default();
        let mut seen_ids = std::collections::HashSet::new();

        for _ in 0..50 {
            let selected = catalog.select(3, None, None);
            for c in &selected {
                seen_ids.insert(c.id.clone());
            }
        }

        // We should see more than 3 unique canaries across 50 trials
        assert!(seen_ids.len() > 3);
    }
}
