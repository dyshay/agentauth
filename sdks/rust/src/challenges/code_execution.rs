use base64::engine::general_purpose::STANDARD as B64;
use base64::Engine;
use rand::seq::SliceRandom;
use rand::Rng;

use crate::crypto::{sha256_hex, timing_safe_equal};
use crate::types::{ChallengeDimension, ChallengeDriver, ChallengePayload, Difficulty};

// ---------------------------------------------------------------------------
// Bug definitions
// ---------------------------------------------------------------------------

#[derive(Debug, Clone)]
struct BugDef {
    name: &'static str,
    description: &'static str,
}

const BUG_OFF_BY_ONE: BugDef = BugDef {
    name: "off_by_one",
    description: "Uses % 255 instead of % 256 in modulo operation",
};

const BUG_WRONG_OPERATOR: BugDef = BugDef {
    name: "wrong_operator",
    description: "Uses + (addition) instead of ^ (XOR) as the accumulator operator",
};

const BUG_MISSING_STEP: BugDef = BugDef {
    name: "missing_step",
    description: "Missing byte reversal between hash rounds",
};

const BUG_WRONG_INIT: BugDef = BugDef {
    name: "wrong_init",
    description: "Accumulator initialized to 1 instead of 0",
};

const BUG_WRONG_PAD: BugDef = BugDef {
    name: "wrong_pad",
    description: "padStart uses length 1 instead of 2 for hex encoding",
};

const BUG_WRONG_SHIFT: BugDef = BugDef {
    name: "wrong_shift",
    description: "Shift amount is 7 instead of 8 in bit shifting",
};

// ---------------------------------------------------------------------------
// Template trait
// ---------------------------------------------------------------------------

trait CodeTemplate: Send + Sync {
    fn template_name(&self) -> &str;
    fn available_bugs(&self) -> Vec<BugDef>;
    fn generate_input(&self) -> (String, serde_json::Value); // (base64_data, params)
    fn buggy_code(
        &self,
        base64_data: &str,
        params: &serde_json::Value,
        active_bugs: &[BugDef],
    ) -> String;
    fn correct_output(&self, base64_data: &str, params: &serde_json::Value) -> String;
}

// ---------------------------------------------------------------------------
// Template 1: Byte Transform
// Correct: (data[i] * (i + 1)) % 256
// ---------------------------------------------------------------------------

struct ByteTransformTemplate;

impl CodeTemplate for ByteTransformTemplate {
    fn template_name(&self) -> &str {
        "byte_transform"
    }

    fn available_bugs(&self) -> Vec<BugDef> {
        vec![BUG_OFF_BY_ONE, BUG_WRONG_SHIFT]
    }

    fn generate_input(&self) -> (String, serde_json::Value) {
        let mut rng = rand::thread_rng();
        let size = rng.gen_range(8..=16);
        let data = crate::crypto::random_bytes(size);
        (B64.encode(&data), serde_json::json!({}))
    }

    fn buggy_code(
        &self,
        _base64_data: &str,
        _params: &serde_json::Value,
        active_bugs: &[BugDef],
    ) -> String {
        let has_off_by_one = active_bugs.iter().any(|b| b.name == "off_by_one");
        let has_wrong_shift = active_bugs.iter().any(|b| b.name == "wrong_shift");
        let modval = if has_off_by_one { "255" } else { "256" };
        let multiplier = if has_wrong_shift {
            "((i + 1) << 7)"
        } else {
            "(i + 1)"
        };

        format!(
            "function transform(data) {{\n\
             \x20 // data is a Uint8Array\n\
             \x20 const result = [];\n\
             \x20 for (let i = 0; i < data.length; i++) {{\n\
             \x20   result.push((data[i] * {}) % {});\n\
             \x20 }}\n\
             \x20 // Return the SHA-256 hex digest of the resulting byte array\n\
             \x20 return sha256hex(Uint8Array.from(result));\n\
             }}",
            multiplier, modval
        )
    }

    fn correct_output(&self, base64_data: &str, _params: &serde_json::Value) -> String {
        let data = B64.decode(base64_data).unwrap();
        let result: Vec<u8> = data
            .iter()
            .enumerate()
            .map(|(i, &b)| ((b as u32 * (i as u32 + 1)) % 256) as u8)
            .collect();
        sha256_hex(&result)
    }
}

// ---------------------------------------------------------------------------
// Template 2: Array Processing (accumulator)
// Correct: acc = (acc ^ byte) & 0xFF, starting from 0
// ---------------------------------------------------------------------------

struct ArrayProcessingTemplate;

impl CodeTemplate for ArrayProcessingTemplate {
    fn template_name(&self) -> &str {
        "array_processing"
    }

    fn available_bugs(&self) -> Vec<BugDef> {
        vec![BUG_WRONG_OPERATOR, BUG_WRONG_INIT, BUG_WRONG_PAD]
    }

    fn generate_input(&self) -> (String, serde_json::Value) {
        let mut rng = rand::thread_rng();
        let size = rng.gen_range(8..=24);
        let data = crate::crypto::random_bytes(size);
        (B64.encode(&data), serde_json::json!({}))
    }

    fn buggy_code(
        &self,
        _base64_data: &str,
        _params: &serde_json::Value,
        active_bugs: &[BugDef],
    ) -> String {
        let has_wrong_op = active_bugs.iter().any(|b| b.name == "wrong_operator");
        let has_wrong_init = active_bugs.iter().any(|b| b.name == "wrong_init");
        let has_wrong_pad = active_bugs.iter().any(|b| b.name == "wrong_pad");
        let operator = if has_wrong_op { "+" } else { "^" };
        let init_val = if has_wrong_init { "1" } else { "0" };
        let pad_len = if has_wrong_pad { "1" } else { "2" };

        format!(
            "function process(data) {{\n\
             \x20 // data is a Uint8Array\n\
             \x20 let acc = {};\n\
             \x20 for (const byte of data) {{\n\
             \x20   acc = (acc {} byte) & 0xFF;\n\
             \x20 }}\n\
             \x20 return acc.toString(16).padStart({}, '0');\n\
             }}",
            init_val, operator, pad_len
        )
    }

    fn correct_output(&self, base64_data: &str, _params: &serde_json::Value) -> String {
        let data = B64.decode(base64_data).unwrap();
        let mut acc: u8 = 0;
        for &byte in &data {
            acc ^= byte;
        }
        format!("{:02x}", acc)
    }
}

// ---------------------------------------------------------------------------
// Template 3: Hash Chain
// Correct: hash N rounds, reversing the byte array between rounds
// ---------------------------------------------------------------------------

struct HashChainTemplate;

impl CodeTemplate for HashChainTemplate {
    fn template_name(&self) -> &str {
        "hash_chain"
    }

    fn available_bugs(&self) -> Vec<BugDef> {
        vec![BUG_MISSING_STEP, BUG_OFF_BY_ONE]
    }

    fn generate_input(&self) -> (String, serde_json::Value) {
        let mut rng = rand::thread_rng();
        let size = rng.gen_range(8..=16);
        let data = crate::crypto::random_bytes(size);
        let rounds = rng.gen_range(2..=4);
        (B64.encode(&data), serde_json::json!({ "rounds": rounds }))
    }

    fn buggy_code(
        &self,
        _base64_data: &str,
        params: &serde_json::Value,
        active_bugs: &[BugDef],
    ) -> String {
        let rounds = params["rounds"].as_u64().unwrap_or(2);
        let has_missing_step = active_bugs.iter().any(|b| b.name == "missing_step");
        let has_off_by_one = active_bugs.iter().any(|b| b.name == "off_by_one");
        let loop_end = if has_off_by_one {
            format!("{} - 1", rounds)
        } else {
            format!("{}", rounds)
        };
        let reverse_line = if has_missing_step {
            "      // (no reversal step)"
        } else {
            "      current = current.reverse();"
        };

        format!(
            "function hashChain(data, rounds) {{\n\
             \x20 // data is a Uint8Array, rounds = {}\n\
             \x20 let current = data;\n\
             \x20 for (let i = 0; i < {}; i++) {{\n\
             \x20   current = sha256(current); // returns Uint8Array\n\
             {}\n\
             \x20 }}\n\
             \x20 return hex(current); // returns hex string\n\
             }}",
            rounds, loop_end, reverse_line
        )
    }

    fn correct_output(&self, base64_data: &str, params: &serde_json::Value) -> String {
        let data = B64.decode(base64_data).unwrap();
        let rounds = params["rounds"].as_u64().unwrap_or(2) as usize;
        let mut current = data;

        for _ in 0..rounds {
            // SHA-256 the data
            let hash_hex = sha256_hex(&current);
            // Convert hex back to bytes
            let hash_bytes = hex::decode(&hash_hex).unwrap();
            // Reverse between rounds
            let mut reversed = hash_bytes;
            reversed.reverse();
            current = reversed;
        }

        hex::encode(&current)
    }
}

// ---------------------------------------------------------------------------
// All templates
// ---------------------------------------------------------------------------

fn all_templates() -> Vec<Box<dyn CodeTemplate>> {
    vec![
        Box::new(ByteTransformTemplate),
        Box::new(ArrayProcessingTemplate),
        Box::new(HashChainTemplate),
    ]
}

// ---------------------------------------------------------------------------
// Difficulty config
// ---------------------------------------------------------------------------

struct DifficultyConfig {
    bug_count: usize,
    template_names: Vec<&'static str>,
    edge_case_hint: bool,
}

fn difficulty_config(difficulty: &Difficulty) -> DifficultyConfig {
    match difficulty {
        Difficulty::Easy => DifficultyConfig {
            bug_count: 1,
            template_names: vec!["byte_transform", "array_processing"],
            edge_case_hint: false,
        },
        Difficulty::Medium => DifficultyConfig {
            bug_count: 1,
            template_names: vec!["byte_transform", "array_processing", "hash_chain"],
            edge_case_hint: false,
        },
        Difficulty::Hard => DifficultyConfig {
            bug_count: 2,
            template_names: vec!["byte_transform", "array_processing", "hash_chain"],
            edge_case_hint: false,
        },
        Difficulty::Adversarial => DifficultyConfig {
            bug_count: 3,
            template_names: vec!["byte_transform", "array_processing", "hash_chain"],
            edge_case_hint: true,
        },
    }
}

// ---------------------------------------------------------------------------
// Bug selection
// ---------------------------------------------------------------------------

fn select_bugs(available: &[BugDef], count: usize) -> Vec<BugDef> {
    let mut rng = rand::thread_rng();
    let mut pool = available.to_vec();
    let to_select = std::cmp::min(count, pool.len());
    let mut selected = Vec::new();

    for _ in 0..to_select {
        let idx = rng.gen_range(0..pool.len());
        selected.push(pool.remove(idx));
    }

    selected
}

// ---------------------------------------------------------------------------
// Driver
// ---------------------------------------------------------------------------

pub struct CodeExecutionDriver;

impl CodeExecutionDriver {
    pub fn new() -> Self {
        Self
    }
}

impl Default for CodeExecutionDriver {
    fn default() -> Self {
        Self::new()
    }
}

impl ChallengeDriver for CodeExecutionDriver {
    fn name(&self) -> &str {
        "code-execution"
    }

    fn dimensions(&self) -> Vec<ChallengeDimension> {
        vec![ChallengeDimension::Reasoning, ChallengeDimension::Execution]
    }

    fn estimated_human_time_ms(&self) -> u64 {
        120_000
    }

    fn estimated_ai_time_ms(&self) -> u64 {
        2_000
    }

    fn generate(&self, difficulty: &Difficulty) -> Result<(ChallengePayload, String), String> {
        let mut rng = rand::thread_rng();
        let config = difficulty_config(difficulty);

        let templates = all_templates();
        let eligible: Vec<_> = templates
            .iter()
            .filter(|t| config.template_names.contains(&t.template_name()))
            .collect();

        let template = eligible
            .choose(&mut rng)
            .ok_or_else(|| "No eligible templates".to_string())?;

        let (base64_data, params) = template.generate_input();
        let bugs = select_bugs(&template.available_bugs(), config.bug_count);
        let buggy_code = template.buggy_code(&base64_data, &params, &bugs);
        let correct_output = template.correct_output(&base64_data, &params);

        // Decode for hex display
        let input_bytes = B64.decode(&base64_data).unwrap();
        let input_hex = hex::encode(&input_bytes);

        let mut param_lines = Vec::new();
        if let Some(rounds) = params.get("rounds") {
            param_lines.push(format!("Rounds: {}", rounds));
        }

        let edge_case_note = if config.edge_case_hint {
            "\n\nNote: Pay close attention to boundary conditions, operator precedence, and off-by-one errors."
        } else {
            ""
        };

        let instructions = format!(
            "The following JavaScript function contains bug(s). Your task is to:\n\
             1. Identify and fix all bugs in the code\n\
             2. Mentally execute the fixed code with the provided input\n\
             3. Return the correct output\n\
             \n\
             ## Code\n\
             ```javascript\n\
             {}\n\
             ```\n\
             \n\
             ## Input\n\
             Data (hex): {}\n\
             {}\n\
             ## Notes\n\
             - sha256hex() / sha256() compute SHA-256 and return hex string / Uint8Array respectively\n\
             - hex() converts a Uint8Array to a hex string\n\
             - All arithmetic on bytes should stay within 0-255 range\n\
             {}\n\
             Return the exact output of the fixed function.",
            buggy_code,
            input_hex,
            if param_lines.is_empty() {
                String::new()
            } else {
                format!("{}\n", param_lines.join("\n"))
            },
            edge_case_note
        );

        let answer_hash = sha256_hex(correct_output.as_bytes());

        let payload = ChallengePayload {
            challenge_type: "code-execution".into(),
            instructions,
            data: base64_data.clone(),
            steps: bugs.len() as u32,
            context: Some(serde_json::json!({
                "templateName": template.template_name(),
                "bugs": bugs.iter().map(|b| serde_json::json!({
                    "name": b.name,
                    "description": b.description,
                })).collect::<Vec<_>>(),
                "correctOutput": correct_output,
                "inputParams": params,
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
        let driver = CodeExecutionDriver::new();
        let (payload, hash) = driver.generate(&Difficulty::Easy).unwrap();

        assert_eq!(payload.challenge_type, "code-execution");
        assert!(!payload.instructions.is_empty());
        assert!(!payload.data.is_empty());
        assert!(!hash.is_empty());
        assert_eq!(hash.len(), 64);
    }

    #[test]
    fn test_verify_correct_answer() {
        let driver = CodeExecutionDriver::new();
        let (payload, answer_hash) = driver.generate(&Difficulty::Easy).unwrap();

        let correct_output = payload.context.as_ref().unwrap()["correctOutput"]
            .as_str()
            .unwrap()
            .to_string();
        let is_valid = driver
            .verify(&answer_hash, &serde_json::Value::String(correct_output))
            .unwrap();
        assert!(is_valid);
    }

    #[test]
    fn test_verify_wrong_answer() {
        let driver = CodeExecutionDriver::new();
        let (_payload, answer_hash) = driver.generate(&Difficulty::Easy).unwrap();

        let is_valid = driver
            .verify(
                &answer_hash,
                &serde_json::Value::String("wrong_answer".into()),
            )
            .unwrap();
        assert!(!is_valid);
    }

    #[test]
    fn test_all_templates_produce_output() {
        for template in all_templates() {
            let (data, params) = template.generate_input();
            let output = template.correct_output(&data, &params);
            assert!(
                !output.is_empty(),
                "Template {} produced empty output",
                template.template_name()
            );
        }
    }
}
