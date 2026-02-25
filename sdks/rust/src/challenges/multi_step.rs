use base64::engine::general_purpose::STANDARD as B64;
use base64::Engine;
use hmac::{Hmac, Mac};
use rand::seq::SliceRandom;
use rand::Rng;
use sha2::Sha256;

use crate::crypto::{sha256_hex, timing_safe_equal, to_hex};
use crate::types::{ChallengeDimension, ChallengeDriver, ChallengePayload, Difficulty};

// ---------------------------------------------------------------------------
// Step definitions
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum StepDef {
    Sha256,
    Xor { key: u8 },
    Hmac { key: String },
    Slice { start: usize, end: usize },
    MemoryRecall { step: usize, byte_index: usize },
    MemoryApply { step: usize },
}

#[derive(Clone)]
struct StepResult {
    def: StepDef,
    result: String, // hex string of intermediate result
}

// ---------------------------------------------------------------------------
// Difficulty configs
// ---------------------------------------------------------------------------

struct DifficultyConfig {
    data_size: usize,
    compute_steps: usize,
    memory_recall: usize,
    memory_apply: usize,
}

fn difficulty_config(difficulty: &Difficulty) -> DifficultyConfig {
    match difficulty {
        Difficulty::Easy => DifficultyConfig {
            data_size: 32,
            compute_steps: 3,
            memory_recall: 0,
            memory_apply: 0,
        },
        Difficulty::Medium => DifficultyConfig {
            data_size: 32,
            compute_steps: 3,
            memory_recall: 1,
            memory_apply: 0,
        },
        Difficulty::Hard => DifficultyConfig {
            data_size: 64,
            compute_steps: 3,
            memory_recall: 1,
            memory_apply: 1,
        },
        Difficulty::Adversarial => DifficultyConfig {
            data_size: 64,
            compute_steps: 4,
            memory_recall: 2,
            memory_apply: 1,
        },
    }
}

// ---------------------------------------------------------------------------
// Step execution helpers
// ---------------------------------------------------------------------------

fn hmac_sha256_hex_bytes(key: &[u8], message: &[u8]) -> String {
    let mut mac = Hmac::<Sha256>::new_from_slice(key).expect("HMAC key");
    mac.update(message);
    hex::encode(mac.finalize().into_bytes())
}

fn xor_bytes_hex(data: &[u8], key: u8) -> String {
    let result: Vec<u8> = data.iter().map(|b| b ^ key).collect();
    hex::encode(&result)
}

fn slice_hex(hex_str: &str, start: usize, end: usize) -> String {
    let bytes = hex::decode(hex_str).unwrap_or_default();
    let end = std::cmp::min(end, bytes.len());
    let start = std::cmp::min(start, end);
    hex::encode(&bytes[start..end])
}

// ---------------------------------------------------------------------------
// Execute a single step
// ---------------------------------------------------------------------------

fn execute_step(
    step_index: usize,
    def: &StepDef,
    input_data_hex: &str,
    previous_results: &[StepResult],
) -> String {
    match def {
        StepDef::Sha256 => {
            let source = if step_index == 0 {
                input_data_hex.to_string()
            } else {
                previous_results[step_index - 1].result.clone()
            };
            let bytes = hex::decode(&source).unwrap_or_default();
            sha256_hex(&bytes)
        }
        StepDef::Xor { key } => {
            let source = if step_index == 0 {
                input_data_hex.to_string()
            } else {
                previous_results[step_index - 1].result.clone()
            };
            let bytes = hex::decode(&source).unwrap_or_default();
            xor_bytes_hex(&bytes, *key)
        }
        StepDef::Hmac { key } => {
            if step_index == 0 {
                let key_bytes = hex::decode(key).unwrap_or_default();
                let msg_bytes = hex::decode(input_data_hex).unwrap_or_default();
                hmac_sha256_hex_bytes(&key_bytes, &msg_bytes)
            } else {
                let key_bytes =
                    hex::decode(&previous_results[step_index - 1].result).unwrap_or_default();
                let msg_bytes = hex::decode(input_data_hex).unwrap_or_default();
                hmac_sha256_hex_bytes(&key_bytes, &msg_bytes)
            }
        }
        StepDef::Slice { start, end } => {
            let source = if step_index == 0 {
                input_data_hex.to_string()
            } else {
                previous_results[step_index - 1].result.clone()
            };
            slice_hex(&source, *start, *end)
        }
        StepDef::MemoryRecall { step, byte_index } => {
            let target_result = &previous_results[*step].result;
            let bytes = hex::decode(target_result).unwrap_or_default();
            let byte_val = bytes.get(*byte_index).copied().unwrap_or(0);
            format!("{:02x}", byte_val)
        }
        StepDef::MemoryApply { step } => {
            // Re-execute the referenced step's operation type on current data
            let ref_def = &previous_results[*step].def;
            let source = &previous_results[step_index - 1].result;
            // Build a temporary result list for re-execution
            let temp_results: Vec<StepResult> = previous_results[..step_index]
                .to_vec()
                .iter()
                .map(|r| StepResult {
                    def: r.def.clone(),
                    result: r.result.clone(),
                })
                .collect();
            // We need the previous result to be available
            if temp_results.len() < step_index {
                // Should not happen, but safety
                return source.clone();
            }
            execute_step(step_index, ref_def, input_data_hex, &temp_results)
        }
    }
}

#[allow(dead_code)]
fn execute_all_steps(steps: &[StepDef], input_data_hex: &str) -> Vec<StepResult> {
    let mut results = Vec::new();
    for (i, def) in steps.iter().enumerate() {
        let result = execute_step(i, def, input_data_hex, &results);
        results.push(StepResult {
            def: def.clone(),
            result,
        });
    }
    results
}

fn compute_final_answer(step_results: &[StepResult]) -> String {
    let concatenated: String = step_results.iter().map(|r| r.result.as_str()).collect();
    sha256_hex(concatenated.as_bytes())
}

// ---------------------------------------------------------------------------
// Instruction generation (NL phrasings)
// ---------------------------------------------------------------------------

fn generate_instruction(step_index: usize, def: &StepDef, _input_data_hex: &str) -> String {
    let mut rng = rand::thread_rng();
    let step_num = step_index + 1;
    let result_label = format!("R{}", step_num);
    let prev_ref = if step_index == 0 {
        "the provided data".to_string()
    } else {
        format!("R{}", step_index)
    };

    match def {
        StepDef::Sha256 => {
            let ref_str = if step_index == 0 {
                "the provided data"
            } else {
                &prev_ref
            };
            let options = vec![
                format!("Compute the SHA-256 hash of {}. Your result is", ref_str),
                format!("Hash {} using SHA-256. Your result is", ref_str),
                format!("Apply SHA-256 to {}. Your result is", ref_str),
            ];
            format!(
                "Step {}: {} {}.",
                step_num,
                options[rng.gen_range(0..options.len())],
                result_label
            )
        }
        StepDef::Xor { key } => {
            let ref_str = if step_index == 0 {
                "the provided data".to_string()
            } else {
                prev_ref.clone()
            };
            let options = vec![
                format!(
                    "XOR each byte of {} with 0x{:02X}. Your result is",
                    ref_str, key
                ),
                format!(
                    "Apply exclusive-or with the value {} to every byte of {}. Your result is",
                    key, ref_str
                ),
                format!(
                    "Bitwise XOR each byte of {} using the key 0x{:02x}. Your result is",
                    ref_str, key
                ),
            ];
            format!(
                "Step {}: {} {}.",
                step_num,
                options[rng.gen_range(0..options.len())],
                result_label
            )
        }
        StepDef::Hmac { key } => {
            if step_index == 0 {
                let options = vec![
                    format!(
                        "Compute HMAC-SHA256 with the hex key \"{}\" as key and the provided data as message. Your result is",
                        key
                    ),
                    format!(
                        "Use the hex key \"{}\" as an HMAC-SHA256 key to sign the provided data. Your result is",
                        key
                    ),
                ];
                format!(
                    "Step {}: {} {}.",
                    step_num,
                    options[rng.gen_range(0..options.len())],
                    result_label
                )
            } else {
                let options = vec![
                    format!(
                        "Compute HMAC-SHA256 with {} as key and the provided data as message. Your result is",
                        prev_ref
                    ),
                    format!(
                        "Use {} as an HMAC-SHA256 key to sign the provided data. Your result is",
                        prev_ref
                    ),
                ];
                format!(
                    "Step {}: {} {}.",
                    step_num,
                    options[rng.gen_range(0..options.len())],
                    result_label
                )
            }
        }
        StepDef::Slice { start, end } => {
            let ref_str = if step_index == 0 {
                "the provided data".to_string()
            } else {
                prev_ref.clone()
            };
            let options = vec![
                format!(
                    "Take bytes {} through {} (inclusive) from {}. Your result is",
                    start,
                    end - 1,
                    ref_str
                ),
                format!(
                    "Extract the first {} bytes of {} starting at offset {}. Your result is",
                    end - start,
                    ref_str,
                    start
                ),
            ];
            format!(
                "Step {}: {} {}.",
                step_num,
                options[rng.gen_range(0..options.len())],
                result_label
            )
        }
        StepDef::MemoryRecall { step, byte_index } => {
            let options = vec![
                format!(
                    "What was byte {} (0-indexed) of your result R{}? Express as a 2-digit hex value. Your result is",
                    byte_index,
                    step + 1
                ),
                format!(
                    "Recall the value of byte at position {} in R{}, written as two hex digits. Your result is",
                    byte_index,
                    step + 1
                ),
            ];
            format!(
                "Step {}: {} {}.",
                step_num,
                options[rng.gen_range(0..options.len())],
                result_label
            )
        }
        StepDef::MemoryApply { step } => {
            let options = vec![
                format!(
                    "Apply the same operation you performed in step {} to {}. Your result is",
                    step + 1,
                    prev_ref
                ),
                format!(
                    "Repeat the operation from step {}, but this time on {}. Your result is",
                    step + 1,
                    prev_ref
                ),
            ];
            format!(
                "Step {}: {} {}.",
                step_num,
                options[rng.gen_range(0..options.len())],
                result_label
            )
        }
    }
}

fn generate_all_instructions(steps: &[StepDef], input_data_hex: &str) -> String {
    let step_instructions: Vec<String> = steps
        .iter()
        .enumerate()
        .map(|(i, def)| generate_instruction(i, def, input_data_hex))
        .collect();

    let result_refs: String = (1..=steps.len())
        .map(|i| format!("R{}", i))
        .collect::<Vec<_>>()
        .join(" + ");

    let footer = format!(
        "\nYour final answer: SHA-256 of the concatenation of {} (all as lowercase hex strings, concatenated without separators).",
        result_refs
    );

    step_instructions.join("\n") + &footer
}

// ---------------------------------------------------------------------------
// Step generation
// ---------------------------------------------------------------------------

fn generate_compute_step(
    step_index: usize,
    data_size: usize,
    previous_results: &[StepResult],
) -> StepDef {
    let mut rng = rand::thread_rng();

    let available: Vec<&str> = if step_index == 0 {
        vec!["sha256", "xor"]
    } else {
        vec!["sha256", "xor", "hmac", "slice"]
    };

    let step_type = *available.choose(&mut rng).unwrap();

    match step_type {
        "sha256" => StepDef::Sha256,
        "xor" => StepDef::Xor {
            key: rng.gen_range(1..=255),
        },
        "hmac" => {
            if step_index == 0 {
                let key = hex::encode(crate::crypto::random_bytes(16));
                StepDef::Hmac { key }
            } else {
                StepDef::Hmac { key: String::new() }
            }
        }
        "slice" => {
            let prev_result_len = if step_index == 0 {
                data_size
            } else if let Some(prev) = previous_results.last() {
                hex::decode(&prev.result).map(|b| b.len()).unwrap_or(32)
            } else {
                32
            };
            let max_end = std::cmp::max(prev_result_len, 4);
            let start = rng.gen_range(0..=(max_end / 4));
            let end = rng.gen_range((start + 2)..=std::cmp::min(start + max_end / 2, max_end));
            StepDef::Slice { start, end }
        }
        _ => StepDef::Sha256,
    }
}

fn generate_memory_recall_step(previous_results: &[StepResult]) -> StepDef {
    let mut rng = rand::thread_rng();
    let step_idx = rng.gen_range(0..previous_results.len());
    let result_bytes = hex::decode(&previous_results[step_idx].result).unwrap_or_default();
    let byte_index = if result_bytes.is_empty() {
        0
    } else {
        rng.gen_range(0..result_bytes.len())
    };
    StepDef::MemoryRecall {
        step: step_idx,
        byte_index,
    }
}

fn generate_memory_apply_step(previous_results: &[StepResult]) -> StepDef {
    let mut rng = rand::thread_rng();
    let compute_steps: Vec<usize> = previous_results
        .iter()
        .enumerate()
        .filter(|(_, r)| {
            !matches!(
                r.def,
                StepDef::MemoryRecall { .. } | StepDef::MemoryApply { .. }
            )
        })
        .map(|(i, _)| i)
        .collect();

    if compute_steps.is_empty() {
        return StepDef::MemoryApply { step: 0 };
    }

    let target = *compute_steps.choose(&mut rng).unwrap();
    StepDef::MemoryApply { step: target }
}

fn generate_steps(
    difficulty: &Difficulty,
    input_data_hex: &str,
) -> (Vec<StepDef>, Vec<StepResult>) {
    let config = difficulty_config(difficulty);
    let mut steps = Vec::new();
    let mut results = Vec::new();

    // Generate compute steps
    for i in 0..config.compute_steps {
        let def = generate_compute_step(i, config.data_size, &results);
        let result = execute_step(i, &def, input_data_hex, &results);
        results.push(StepResult {
            def: def.clone(),
            result,
        });
        steps.push(def);
    }

    // Memory recall steps
    for _ in 0..config.memory_recall {
        let def = generate_memory_recall_step(&results);
        let idx = steps.len();
        let result = execute_step(idx, &def, input_data_hex, &results);
        results.push(StepResult {
            def: def.clone(),
            result,
        });
        steps.push(def);
    }

    // Memory apply steps
    for _ in 0..config.memory_apply {
        let def = generate_memory_apply_step(&results);
        let idx = steps.len();
        let result = execute_step(idx, &def, input_data_hex, &results);
        results.push(StepResult {
            def: def.clone(),
            result,
        });
        steps.push(def);
    }

    (steps, results)
}

// ---------------------------------------------------------------------------
// Driver
// ---------------------------------------------------------------------------

pub struct MultiStepDriver;

impl MultiStepDriver {
    pub fn new() -> Self {
        Self
    }
}

impl Default for MultiStepDriver {
    fn default() -> Self {
        Self::new()
    }
}

impl ChallengeDriver for MultiStepDriver {
    fn name(&self) -> &str {
        "multi-step"
    }

    fn dimensions(&self) -> Vec<ChallengeDimension> {
        vec![
            ChallengeDimension::Reasoning,
            ChallengeDimension::Execution,
            ChallengeDimension::Memory,
        ]
    }

    fn estimated_human_time_ms(&self) -> u64 {
        120_000
    }

    fn estimated_ai_time_ms(&self) -> u64 {
        2_000
    }

    fn generate(&self, difficulty: &Difficulty) -> Result<(ChallengePayload, String), String> {
        let config = difficulty_config(difficulty);
        let data = crate::crypto::random_bytes(config.data_size);
        let input_data_hex = to_hex(&data);

        let (steps, results) = generate_steps(difficulty, &input_data_hex);
        let final_answer = compute_final_answer(&results);
        let instructions = generate_all_instructions(&steps, &input_data_hex);

        let answer_hash = sha256_hex(final_answer.as_bytes());

        let payload = ChallengePayload {
            challenge_type: "multi-step".into(),
            instructions,
            data: B64.encode(&data),
            steps: steps.len() as u32,
            context: Some(serde_json::json!({
                "stepDefs": steps,
                "expectedResults": results.iter().map(|r| &r.result).collect::<Vec<_>>(),
                "expectedAnswer": final_answer,
            })),
        };

        Ok((payload, answer_hash))
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
        let driver = MultiStepDriver::new();
        let (payload, hash) = driver.generate(&Difficulty::Easy).unwrap();

        assert_eq!(payload.challenge_type, "multi-step");
        assert!(!payload.instructions.is_empty());
        assert!(!payload.data.is_empty());
        assert!(payload.steps >= 3);
        assert!(!hash.is_empty());
        assert_eq!(hash.len(), 64);
    }

    #[test]
    fn test_verify_correct_answer() {
        let driver = MultiStepDriver::new();
        let (payload, answer_hash) = driver.generate(&Difficulty::Easy).unwrap();

        let expected_answer = payload.context.as_ref().unwrap()["expectedAnswer"]
            .as_str()
            .unwrap()
            .to_string();
        let is_valid = driver
            .verify(&answer_hash, &serde_json::Value::String(expected_answer))
            .unwrap();
        assert!(is_valid);
    }

    #[test]
    fn test_verify_wrong_answer() {
        let driver = MultiStepDriver::new();
        let (_payload, answer_hash) = driver.generate(&Difficulty::Easy).unwrap();

        let is_valid = driver
            .verify(&answer_hash, &serde_json::Value::String("wrong".into()))
            .unwrap();
        assert!(!is_valid);
    }

    #[test]
    fn test_step_types_present() {
        // Medium difficulty should include at least one memory_recall step
        let driver = MultiStepDriver::new();
        let (payload, _) = driver.generate(&Difficulty::Medium).unwrap();
        // At least 4 steps (3 compute + 1 memory recall)
        assert!(payload.steps >= 4);
    }
}
