use crate::types::{Canary, ChallengePayload, InjectionMethod};

use super::catalog::CanaryCatalog;

/// Result of canary injection into a challenge payload.
pub struct InjectionResult {
    pub payload: ChallengePayload,
    pub injected: Vec<Canary>,
}

/// Injects canary probes into challenge instructions.
pub struct CanaryInjector {
    catalog: CanaryCatalog,
}

impl CanaryInjector {
    pub fn new(catalog: CanaryCatalog) -> Self {
        Self { catalog }
    }

    /// Inject `count` canary probes into the challenge payload.
    pub fn inject(
        &self,
        payload: &ChallengePayload,
        count: usize,
        exclude: Option<&[String]>,
    ) -> InjectionResult {
        if count == 0 {
            return InjectionResult {
                payload: payload.clone(),
                injected: vec![],
            };
        }

        let selected = self.catalog.select(count, None, exclude);
        if selected.is_empty() {
            return InjectionResult {
                payload: payload.clone(),
                injected: vec![],
            };
        }

        // Group by injection method
        let prefix_canaries: Vec<&Canary> = selected
            .iter()
            .filter(|c| c.injection_method == InjectionMethod::Prefix)
            .collect();
        let side_canaries: Vec<&Canary> = selected
            .iter()
            .filter(|c| {
                matches!(
                    c.injection_method,
                    InjectionMethod::Inline | InjectionMethod::Suffix | InjectionMethod::Embedded
                )
            })
            .collect();

        let mut instructions = payload.instructions.clone();

        // Prefix: add before main instructions
        if !prefix_canaries.is_empty() {
            let prefix_text: String = prefix_canaries
                .iter()
                .map(|c| format!("- {}: {}", c.id, c.prompt))
                .collect::<Vec<_>>()
                .join("\n");
            instructions = format!(
                "Before starting, answer these briefly (include in canary_responses):\n{}\n\n{}",
                prefix_text, instructions
            );
        }

        // Inline/Suffix/Embedded: add as side tasks after main instructions
        if !side_canaries.is_empty() {
            let side_text: String = side_canaries
                .iter()
                .map(|c| format!("- {}: {}", c.id, c.prompt))
                .collect::<Vec<_>>()
                .join("\n");
            instructions = format!(
                "{}\n\nAlso, complete these side tasks (include answers in canary_responses field):\n{}",
                instructions, side_text
            );
        }

        let canary_ids: Vec<serde_json::Value> = selected
            .iter()
            .map(|c| serde_json::Value::String(c.id.clone()))
            .collect();

        let mut new_context = payload.context.clone().unwrap_or(serde_json::json!({}));
        if let Some(obj) = new_context.as_object_mut() {
            obj.insert("canary_ids".into(), serde_json::Value::Array(canary_ids));
        }

        let new_payload = ChallengePayload {
            challenge_type: payload.challenge_type.clone(),
            instructions,
            data: payload.data.clone(),
            steps: payload.steps,
            context: Some(new_context),
        };

        InjectionResult {
            payload: new_payload,
            injected: selected,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_payload() -> ChallengePayload {
        ChallengePayload {
            challenge_type: "test".into(),
            instructions: "Original instructions".into(),
            data: "dGVzdA==".into(),
            steps: 1,
            context: None,
        }
    }

    #[test]
    fn test_inject_canaries() {
        let catalog = CanaryCatalog::default();
        let injector = CanaryInjector::new(catalog);
        let result = injector.inject(&test_payload(), 3, None);

        assert_eq!(result.injected.len(), 3);
        // Instructions should have been modified
        assert!(result.payload.instructions.len() > "Original instructions".len());
    }

    #[test]
    fn test_inject_zero_count() {
        let catalog = CanaryCatalog::default();
        let injector = CanaryInjector::new(catalog);
        let result = injector.inject(&test_payload(), 0, None);

        assert!(result.injected.is_empty());
        assert_eq!(result.payload.instructions, "Original instructions");
    }

    #[test]
    fn test_instructions_modified() {
        let catalog = CanaryCatalog::default();
        let injector = CanaryInjector::new(catalog);
        let result = injector.inject(&test_payload(), 2, None);

        assert!(result.payload.instructions.contains("canary_responses"));
        // Context should have canary_ids
        let ctx = result.payload.context.as_ref().unwrap();
        assert!(ctx.get("canary_ids").is_some());
    }
}
