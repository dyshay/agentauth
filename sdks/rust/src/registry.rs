use std::collections::HashMap;

use crate::types::{ChallengeDimension, ChallengeDriver};

/// Registry mapping driver names to driver instances.
///
/// Used by the engine to look up, list, and select drivers.
pub struct ChallengeRegistry {
    drivers: HashMap<String, Box<dyn ChallengeDriver>>,
}

impl ChallengeRegistry {
    pub fn new() -> Self {
        Self {
            drivers: HashMap::new(),
        }
    }

    /// Register a challenge driver. Replaces any existing driver with the same name.
    pub fn register(&mut self, driver: Box<dyn ChallengeDriver>) {
        self.drivers.insert(driver.name().to_string(), driver);
    }

    /// Get a driver by name.
    pub fn get(&self, name: &str) -> Option<&dyn ChallengeDriver> {
        self.drivers.get(name).map(|d| d.as_ref())
    }

    /// List all registered drivers.
    pub fn list(&self) -> Vec<&dyn ChallengeDriver> {
        self.drivers.values().map(|d| d.as_ref()).collect()
    }

    /// Select drivers that best match the requested dimensions.
    ///
    /// Each driver is scored by how many of the requested dimensions it covers.
    /// Returns up to `count` drivers sorted by descending match score.
    pub fn select(
        &self,
        dimensions: Option<&[ChallengeDimension]>,
        count: usize,
    ) -> Vec<&dyn ChallengeDriver> {
        let mut scored: Vec<(usize, &dyn ChallengeDriver)> = self
            .drivers
            .values()
            .map(|d| {
                let score = if let Some(dims) = dimensions {
                    let driver_dims = d.dimensions();
                    dims.iter()
                        .filter(|dim| driver_dims.contains(dim))
                        .count()
                } else {
                    1
                };
                (score, d.as_ref())
            })
            .collect();

        scored.sort_by(|a, b| b.0.cmp(&a.0));
        scored.into_iter().take(count).map(|(_, d)| d).collect()
    }
}

impl Default for ChallengeRegistry {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{ChallengePayload, Difficulty};

    struct MockDriver {
        driver_name: String,
        dims: Vec<ChallengeDimension>,
    }

    impl ChallengeDriver for MockDriver {
        fn name(&self) -> &str {
            &self.driver_name
        }
        fn dimensions(&self) -> Vec<ChallengeDimension> {
            self.dims.clone()
        }
        fn estimated_human_time_ms(&self) -> u64 {
            10000
        }
        fn estimated_ai_time_ms(&self) -> u64 {
            500
        }
        fn generate(
            &self,
            _difficulty: &Difficulty,
        ) -> Result<(ChallengePayload, String), String> {
            Ok((
                ChallengePayload {
                    challenge_type: self.driver_name.clone(),
                    instructions: "test".into(),
                    data: "".into(),
                    steps: 1,
                    context: None,
                },
                "hash".into(),
            ))
        }
        fn verify(
            &self,
            _answer_hash: &str,
            _submitted: &serde_json::Value,
        ) -> Result<bool, String> {
            Ok(true)
        }
    }

    fn mock_driver(name: &str, dims: Vec<ChallengeDimension>) -> Box<dyn ChallengeDriver> {
        Box::new(MockDriver {
            driver_name: name.into(),
            dims,
        })
    }

    #[test]
    fn test_register_and_get() {
        let mut reg = ChallengeRegistry::new();
        reg.register(mock_driver(
            "test-driver",
            vec![ChallengeDimension::Reasoning],
        ));
        let driver = reg.get("test-driver");
        assert!(driver.is_some());
        assert_eq!(driver.unwrap().name(), "test-driver");
    }

    #[test]
    fn test_get_missing() {
        let reg = ChallengeRegistry::new();
        assert!(reg.get("nonexistent").is_none());
    }

    #[test]
    fn test_list() {
        let mut reg = ChallengeRegistry::new();
        reg.register(mock_driver("d1", vec![ChallengeDimension::Reasoning]));
        reg.register(mock_driver("d2", vec![ChallengeDimension::Execution]));
        let list = reg.list();
        assert_eq!(list.len(), 2);
    }

    #[test]
    fn test_select_by_dimension() {
        let mut reg = ChallengeRegistry::new();
        reg.register(mock_driver("d1", vec![ChallengeDimension::Reasoning]));
        reg.register(mock_driver(
            "d2",
            vec![ChallengeDimension::Reasoning, ChallengeDimension::Execution],
        ));
        reg.register(mock_driver("d3", vec![ChallengeDimension::Ambiguity]));

        let selected = reg.select(
            Some(&[
                ChallengeDimension::Reasoning,
                ChallengeDimension::Execution,
            ]),
            2,
        );
        // d2 covers both dimensions, so it should be first
        assert_eq!(selected.len(), 2);
        assert_eq!(selected[0].name(), "d2");
    }

    #[test]
    fn test_select_count() {
        let mut reg = ChallengeRegistry::new();
        reg.register(mock_driver("d1", vec![ChallengeDimension::Reasoning]));
        reg.register(mock_driver("d2", vec![ChallengeDimension::Execution]));
        reg.register(mock_driver("d3", vec![ChallengeDimension::Ambiguity]));

        let selected = reg.select(None, 1);
        assert_eq!(selected.len(), 1);
    }
}
