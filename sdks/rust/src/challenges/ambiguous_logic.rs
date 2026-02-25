use base64::engine::general_purpose::STANDARD as B64;
use base64::Engine;
use rand::seq::SliceRandom;
use rand::Rng;

use crate::crypto::{sha256_hex, timing_safe_equal};
use crate::types::{ChallengeDimension, ChallengeDriver, ChallengePayload, Difficulty};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

#[derive(Debug, Clone)]
struct AcceptableAnswer {
    answer: String, // hex-encoded result
    score: f64,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
struct ScoredAnswerHash {
    answer_hash: String,
    score: f64,
}

struct TemplateResult {
    instructions: String,
    acceptable_answers: Vec<AcceptableAnswer>,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn xor_bytes(data: &[u8], key: u8) -> Vec<u8> {
    data.iter().map(|b| b ^ key).collect()
}

fn sort_ascending(data: &[u8]) -> Vec<u8> {
    let mut sorted = data.to_vec();
    sorted.sort();
    sorted
}

fn reverse_bytes(data: &[u8]) -> Vec<u8> {
    let mut result = data.to_vec();
    result.reverse();
    result
}

// ---------------------------------------------------------------------------
// Template 1: Lucky Number
// ---------------------------------------------------------------------------

fn lucky_number_template(data: &[u8], difficulty: &Difficulty) -> TemplateResult {
    let mut rng = rand::thread_rng();
    let byte_count = data.len();

    // Primary: 7 is "the" lucky number
    let is_lucky_7 = byte_count == 7;
    let primary_result = if is_lucky_7 {
        xor_bytes(data, 7)
    } else {
        xor_bytes(data, 13)
    };

    let mut alternatives = vec![AcceptableAnswer {
        answer: hex::encode(&primary_result),
        score: 1.0,
    }];

    // Alternative lucky numbers from various cultures
    if *difficulty != Difficulty::Easy {
        let alt_lucky = [(3usize, 0.6), (8, 0.6), (13, 0.7)];
        for &(lucky, score) in &alt_lucky {
            let is_lucky = byte_count == lucky;
            let alt_result = if is_lucky {
                xor_bytes(data, 7)
            } else {
                xor_bytes(data, 13)
            };
            let alt_hex = hex::encode(&alt_result);
            if alt_hex != alternatives[0].answer {
                alternatives.push(AcceptableAnswer {
                    answer: alt_hex,
                    score,
                });
            }
        }
    }

    let phrasings = [
        format!(
            "You are given {} bytes of data (base64-encoded).\n\
             If the number of bytes is a lucky number, XOR each byte with 7.\n\
             Otherwise, XOR each byte with 13.\n\
             Return the hex-encoded result.",
            byte_count
        ),
        format!(
            "The data below contains {} bytes.\n\
             When the byte count is lucky, apply XOR 7 to every byte.\n\
             When unlucky, apply XOR 13 instead.\n\
             Provide your answer as a hex string.",
            byte_count
        ),
    ];

    TemplateResult {
        instructions: phrasings[rng.gen_range(0..phrasings.len())].clone(),
        acceptable_answers: alternatives,
    }
}

// ---------------------------------------------------------------------------
// Template 2: Famous Constant
// ---------------------------------------------------------------------------

fn famous_constant_template(data: &[u8], _difficulty: &Difficulty) -> TemplateResult {
    let mut rng = rand::thread_rng();

    // Primary: pi -> "3.1" -> 31
    let pi_result = xor_bytes(data, 31);
    // Alternative: e -> "2.7" -> 27
    let e_result = xor_bytes(data, 27);
    // Alternative: phi -> "1.6" -> 16
    let phi_result = xor_bytes(data, 16);

    let alternatives = vec![
        AcceptableAnswer {
            answer: hex::encode(&pi_result),
            score: 1.0,
        },
        AcceptableAnswer {
            answer: hex::encode(&e_result),
            score: 0.8,
        },
        AcceptableAnswer {
            answer: hex::encode(&phi_result),
            score: 0.6,
        },
    ];

    let phrasings = ["XOR each byte of the provided data with the most famous mathematical constant's first two digits as an integer.\n\
         Return the hex-encoded result.".to_string(),
        "Take the universally recognized mathematical constant, extract its first two digits as a whole number, \
         and XOR every byte of the data with that number.\n\
         Provide the hex-encoded output.".to_string()];

    TemplateResult {
        instructions: phrasings[rng.gen_range(0..phrasings.len())].clone(),
        acceptable_answers: alternatives,
    }
}

// ---------------------------------------------------------------------------
// Template 3: Big/Small
// ---------------------------------------------------------------------------

fn big_small_template(data: &[u8], _difficulty: &Difficulty) -> TemplateResult {
    let mut rng = rand::thread_rng();
    let first_byte = data[0];

    // Primary: "big" means > 127
    let primary_127 = if first_byte > 127 {
        reverse_bytes(data)
    } else {
        sort_ascending(data)
    };

    // Alternative: "big" means > 100
    let alt_100 = if first_byte > 100 {
        reverse_bytes(data)
    } else {
        sort_ascending(data)
    };

    // Alternative: "big" means > 200
    let alt_200 = if first_byte > 200 {
        reverse_bytes(data)
    } else {
        sort_ascending(data)
    };

    let mut alternatives = vec![AcceptableAnswer {
        answer: hex::encode(&primary_127),
        score: 1.0,
    }];

    let alt_100_hex = hex::encode(&alt_100);
    let alt_200_hex = hex::encode(&alt_200);

    if alt_100_hex != alternatives[0].answer {
        alternatives.push(AcceptableAnswer {
            answer: alt_100_hex.clone(),
            score: 0.8,
        });
    }
    if alt_200_hex != alternatives[0].answer && alt_200_hex != alt_100_hex {
        alternatives.push(AcceptableAnswer {
            answer: alt_200_hex,
            score: 0.7,
        });
    }

    let phrasings = [
        "If the first byte of the data is big, reverse the entire byte array.\n\
         Otherwise, sort all bytes in ascending order.\n\
         Return the hex-encoded result."
            .to_string(),
        "Examine the first byte. If it is a big value, flip the array end-to-end.\n\
         If it is small, arrange bytes from lowest to highest.\n\
         Provide the hex-encoded output."
            .to_string(),
    ];

    TemplateResult {
        instructions: phrasings[rng.gen_range(0..phrasings.len())].clone(),
        acceptable_answers: alternatives,
    }
}

// ---------------------------------------------------------------------------
// Template dispatch
// ---------------------------------------------------------------------------

type TemplateFn = fn(&[u8], &Difficulty) -> TemplateResult;

const ALL_TEMPLATES: &[(&str, TemplateFn)] = &[
    ("lucky-number", lucky_number_template as TemplateFn),
    ("famous-constant", famous_constant_template as TemplateFn),
    ("big-small", big_small_template as TemplateFn),
];

// ---------------------------------------------------------------------------
// Difficulty config
// ---------------------------------------------------------------------------

fn difficulty_config(difficulty: &Difficulty) -> (usize, usize) {
    // (data_size, template_count)
    match difficulty {
        Difficulty::Easy => (8, 1),
        Difficulty::Medium => (16, 1),
        Difficulty::Hard => (32, 2),
        Difficulty::Adversarial => (64, 3),
    }
}

// ---------------------------------------------------------------------------
// Hash answers
// ---------------------------------------------------------------------------

fn hash_answers(answers: &[AcceptableAnswer]) -> Vec<ScoredAnswerHash> {
    answers
        .iter()
        .map(|a| ScoredAnswerHash {
            answer_hash: sha256_hex(a.answer.as_bytes()),
            score: a.score,
        })
        .collect()
}

// ---------------------------------------------------------------------------
// Driver
// ---------------------------------------------------------------------------

pub struct AmbiguousLogicDriver;

impl AmbiguousLogicDriver {
    pub fn new() -> Self {
        Self
    }

    fn select_templates(&self, count: usize) -> Vec<(&str, TemplateFn)> {
        let mut rng = rand::thread_rng();
        let mut shuffled: Vec<_> = ALL_TEMPLATES.to_vec();
        shuffled.shuffle(&mut rng);
        shuffled.truncate(std::cmp::min(count, shuffled.len()));
        shuffled
    }

    fn generate_single(
        &self,
        template_name: &str,
        template_fn: TemplateFn,
        data: &[u8],
        difficulty: &Difficulty,
    ) -> Result<(ChallengePayload, String), String> {
        let result = template_fn(data, difficulty);
        let scored = hash_answers(&result.acceptable_answers);

        let primary_answer = &result.acceptable_answers[0].answer;
        let answer_hash = sha256_hex(primary_answer.as_bytes());

        let payload = ChallengePayload {
            challenge_type: "ambiguous-logic".into(),
            instructions: result.instructions,
            data: B64.encode(data),
            steps: 1,
            context: Some(serde_json::json!({
                "templateName": template_name,
                "primaryAnswer": primary_answer,
                "scoredAnswers": scored,
            })),
        };

        Ok((payload, answer_hash))
    }

    fn generate_chained(
        &self,
        templates: &[(&str, TemplateFn)],
        data: &[u8],
        difficulty: &Difficulty,
    ) -> Result<(ChallengePayload, String), String> {
        let mut current_data = data.to_vec();
        let mut instruction_parts = Vec::new();
        let mut all_acceptable: Vec<AcceptableAnswer> = Vec::new();

        for (i, (_name, func)) in templates.iter().enumerate() {
            let result = func(&current_data, difficulty);

            instruction_parts.push(format!("--- Part {} ---\n{}", i + 1, result.instructions));

            if i == 0 {
                all_acceptable = result.acceptable_answers;
            } else {
                let mut chained = Vec::new();
                for prev in &all_acceptable {
                    let prev_data = hex::decode(&prev.answer).unwrap_or_default();
                    let chain_result = func(&prev_data, difficulty);
                    for ans in &chain_result.acceptable_answers {
                        chained.push(AcceptableAnswer {
                            answer: ans.answer.clone(),
                            score: prev.score * ans.score,
                        });
                    }
                }
                all_acceptable = chained;
            }

            // Use primary for next template input
            current_data = hex::decode(&all_acceptable[0].answer).unwrap_or_default();
        }

        // Deduplicate by keeping highest score for each answer
        let mut unique: std::collections::HashMap<String, f64> = std::collections::HashMap::new();
        for ans in &all_acceptable {
            let entry = unique.entry(ans.answer.clone()).or_insert(0.0);
            if ans.score > *entry {
                *entry = ans.score;
            }
        }
        let mut deduplicated: Vec<AcceptableAnswer> = unique
            .into_iter()
            .map(|(answer, score)| AcceptableAnswer { answer, score })
            .collect();
        deduplicated.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap());

        let scored = hash_answers(&deduplicated);
        let primary_answer = &deduplicated[0].answer;
        let answer_hash = sha256_hex(primary_answer.as_bytes());

        let template_names: Vec<&str> = templates.iter().map(|(n, _)| *n).collect();
        let full_instructions = format!(
            "This is a multi-part ambiguous logic challenge.\n\
             Apply each part's transformation in order, using the output of the previous part as input for the next.\n\n\
             {}",
            instruction_parts.join("\n\n")
        );

        let payload = ChallengePayload {
            challenge_type: "ambiguous-logic".into(),
            instructions: full_instructions,
            data: B64.encode(data),
            steps: templates.len() as u32,
            context: Some(serde_json::json!({
                "templateNames": template_names,
                "primaryAnswer": primary_answer,
                "scoredAnswers": scored,
            })),
        };

        Ok((payload, answer_hash))
    }
}

impl Default for AmbiguousLogicDriver {
    fn default() -> Self {
        Self::new()
    }
}

impl ChallengeDriver for AmbiguousLogicDriver {
    fn name(&self) -> &str {
        "ambiguous-logic"
    }

    fn dimensions(&self) -> Vec<ChallengeDimension> {
        vec![ChallengeDimension::Reasoning, ChallengeDimension::Ambiguity]
    }

    fn estimated_human_time_ms(&self) -> u64 {
        45_000
    }

    fn estimated_ai_time_ms(&self) -> u64 {
        1_000
    }

    fn generate(&self, difficulty: &Difficulty) -> Result<(ChallengePayload, String), String> {
        let (data_size, template_count) = difficulty_config(difficulty);
        let data = crate::crypto::random_bytes(data_size);
        let selected = self.select_templates(template_count);

        if selected.len() == 1 {
            let (name, func) = selected[0];
            self.generate_single(name, func, &data, difficulty)
        } else {
            self.generate_chained(&selected, &data, difficulty)
        }
    }

    fn verify(&self, answer_hash: &str, submitted: &serde_json::Value) -> Result<bool, String> {
        let submitted_str = submitted
            .as_str()
            .ok_or_else(|| "Answer must be a string".to_string())?;
        let submitted_hash = sha256_hex(submitted_str.as_bytes());
        Ok(timing_safe_equal(answer_hash, &submitted_hash))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_payload_structure() {
        let driver = AmbiguousLogicDriver::new();
        let (payload, hash) = driver.generate(&Difficulty::Easy).unwrap();

        assert_eq!(payload.challenge_type, "ambiguous-logic");
        assert!(!payload.instructions.is_empty());
        assert!(!payload.data.is_empty());
        assert!(!hash.is_empty());
        assert_eq!(hash.len(), 64);
    }

    #[test]
    fn test_verify_correct_answer() {
        let driver = AmbiguousLogicDriver::new();
        let (payload, answer_hash) = driver.generate(&Difficulty::Easy).unwrap();

        let primary_answer = payload.context.as_ref().unwrap()["primaryAnswer"]
            .as_str()
            .unwrap()
            .to_string();
        let is_valid = driver
            .verify(&answer_hash, &serde_json::Value::String(primary_answer))
            .unwrap();
        assert!(is_valid);
    }

    #[test]
    fn test_verify_wrong_answer() {
        let driver = AmbiguousLogicDriver::new();
        let (_payload, answer_hash) = driver.generate(&Difficulty::Easy).unwrap();

        let is_valid = driver
            .verify(&answer_hash, &serde_json::Value::String("wrong".into()))
            .unwrap();
        assert!(!is_valid);
    }

    #[test]
    fn test_all_templates_produce_output() {
        let data = crate::crypto::random_bytes(16);
        for &(_name, func) in ALL_TEMPLATES {
            let result = func(&data, &Difficulty::Medium);
            assert!(!result.acceptable_answers.is_empty());
            assert!(!result.instructions.is_empty());
        }
    }
}
