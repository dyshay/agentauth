use base64::engine::general_purpose::STANDARD as B64;
use base64::Engine;
use hmac::{Hmac, Mac};
use rand::seq::SliceRandom;
use rand::Rng;
use sha2::{Digest, Sha256};

use crate::crypto::{sha256_hex, timing_safe_equal};
use crate::types::{ChallengeDimension, ChallengeDriver, ChallengePayload, Difficulty};

// ---------------------------------------------------------------------------
// Operation types
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum OpType {
    Xor,
    Reverse,
    Slice,
    Sort,
    Rotate,
    Sha256,
    BitwiseNot,
    Repeat,
    Hmac,
    Base64Encode,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ByteOperation {
    pub op: OpType,
    pub params: serde_json::Value,
}

// ---------------------------------------------------------------------------
// Op pools by difficulty
// ---------------------------------------------------------------------------

fn basic_ops() -> Vec<OpType> {
    vec![
        OpType::Xor,
        OpType::Reverse,
        OpType::Slice,
        OpType::Sort,
        OpType::Rotate,
    ]
}

fn medium_ops() -> Vec<OpType> {
    let mut ops = basic_ops();
    ops.push(OpType::Sha256);
    ops.push(OpType::BitwiseNot);
    ops
}

fn all_ops() -> Vec<OpType> {
    let mut ops = medium_ops();
    ops.push(OpType::Repeat);
    ops.push(OpType::Hmac);
    ops.push(OpType::Base64Encode);
    ops
}

fn ops_by_difficulty(difficulty: &Difficulty) -> Vec<OpType> {
    match difficulty {
        Difficulty::Easy => basic_ops(),
        Difficulty::Medium => medium_ops(),
        Difficulty::Hard | Difficulty::Adversarial => all_ops(),
    }
}

// ---------------------------------------------------------------------------
// Difficulty config
// ---------------------------------------------------------------------------

fn difficulty_config(difficulty: &Difficulty) -> (usize, usize) {
    // (ops_count, data_size)
    match difficulty {
        Difficulty::Easy => (1, 16),
        Difficulty::Medium => (2, 32),
        Difficulty::Hard => (4, 64),
        Difficulty::Adversarial => (6, 128),
    }
}

// ---------------------------------------------------------------------------
// NL phrasings — multiple per operation
// ---------------------------------------------------------------------------

fn phrasing(op: &ByteOperation) -> String {
    let mut rng = rand::thread_rng();
    match &op.op {
        OpType::Xor => {
            let key = op.params["key"].as_u64().unwrap_or(0);
            let options = vec![
                format!(
                    "XOR each byte with 0x{:02X}",
                    key
                ),
                format!("Apply exclusive-or with the value {} to every byte", key),
                format!("Bitwise XOR each octet using the key {}", key),
                format!(
                    "For every byte, flip bits using 0x{:02x} as mask",
                    key
                ),
            ];
            options[rng.gen_range(0..options.len())].clone()
        }
        OpType::Reverse => {
            let options = vec![
                "Reverse the byte order".to_string(),
                "Flip the sequence end-to-end".to_string(),
                "Mirror the byte array so the last byte becomes first".to_string(),
                "Invert the positional ordering of all bytes".to_string(),
            ];
            options[rng.gen_range(0..options.len())].clone()
        }
        OpType::Slice => {
            let start = op.params["start"].as_u64().unwrap_or(0);
            let end = op.params["end"].as_u64().unwrap_or(0);
            let options = vec![
                format!("Take bytes from offset {} to {}", start, end),
                format!("Extract the slice [{}:{}] from the data", start, end),
                format!(
                    "Isolate bytes at positions {} through {}",
                    start,
                    end.saturating_sub(1)
                ),
            ];
            options[rng.gen_range(0..options.len())].clone()
        }
        OpType::Sort => {
            let options = vec![
                "Sort all bytes in ascending order".to_string(),
                "Arrange the bytes from smallest to largest value".to_string(),
                "Order the octets numerically, lowest first".to_string(),
            ];
            options[rng.gen_range(0..options.len())].clone()
        }
        OpType::Rotate => {
            let pos = op.params["positions"].as_u64().unwrap_or(0);
            let options = vec![
                format!("Rotate the bytes left by {} positions", pos),
                format!(
                    "Shift all bytes {} positions to the left, wrapping around",
                    pos
                ),
                format!("Circular left-shift the array by {}", pos),
            ];
            options[rng.gen_range(0..options.len())].clone()
        }
        OpType::Sha256 => {
            let options = vec![
                "Compute the SHA-256 hash of the current data (producing 32 raw bytes)".to_string(),
                "Hash the byte array with SHA-256, replacing it with the 32-byte digest".to_string(),
                "Apply SHA-256 to the data \u{2014} the result is the raw 32-byte hash".to_string(),
            ];
            options[rng.gen_range(0..options.len())].clone()
        }
        OpType::BitwiseNot => {
            let options = vec![
                "Flip every bit in each byte (bitwise NOT, masked to 8 bits)".to_string(),
                "Apply bitwise complement to every byte (~byte & 0xFF)".to_string(),
                "Invert all bits in the array \u{2014} each byte becomes its one's complement"
                    .to_string(),
            ];
            options[rng.gen_range(0..options.len())].clone()
        }
        OpType::Repeat => {
            let times = op.params["times"].as_u64().unwrap_or(2);
            let options = vec![
                format!(
                    "Concatenate the array with itself {} times (total {}x copies)",
                    times, times
                ),
                format!(
                    "Repeat the data {} times by appending it to itself",
                    times
                ),
                format!(
                    "Duplicate the byte sequence so it appears {} times in a row",
                    times
                ),
            ];
            options[rng.gen_range(0..options.len())].clone()
        }
        OpType::Hmac => {
            let key_hex = op.params["keyHex"].as_str().unwrap_or("");
            let options = vec![
                format!(
                    "Compute HMAC-SHA256 of the data using the hex key {} (producing 32 raw bytes)",
                    key_hex
                ),
                format!(
                    "HMAC the byte array with SHA-256 and key 0x{}, yielding 32 bytes",
                    key_hex
                ),
                format!(
                    "Apply HMAC-SHA256 using the secret key (hex) {} \u{2014} the result is 32 raw bytes",
                    key_hex
                ),
            ];
            options[rng.gen_range(0..options.len())].clone()
        }
        OpType::Base64Encode => {
            let options = vec![
                "Base64-encode the data, then treat the resulting ASCII string as a new byte array"
                    .to_string(),
                "Encode the bytes as a base64 string and reinterpret its characters as byte values"
                    .to_string(),
                "Convert the data to base64 and use the encoded string's character codes as the new bytes"
                    .to_string(),
            ];
            options[rng.gen_range(0..options.len())].clone()
        }
    }
}

// ---------------------------------------------------------------------------
// Op generation
// ---------------------------------------------------------------------------

fn generate_ops(count: usize, data_size: usize, difficulty: &Difficulty) -> Vec<ByteOperation> {
    let op_pool = ops_by_difficulty(difficulty);
    let mut rng = rand::thread_rng();
    let mut ops = Vec::new();

    for _ in 0..count {
        let op_type = op_pool.choose(&mut rng).unwrap().clone();
        let params = match &op_type {
            OpType::Xor => {
                serde_json::json!({ "key": rng.gen_range(1u32..=255) })
            }
            OpType::Reverse => serde_json::json!({}),
            OpType::Slice => {
                let start = rng.gen_range(0..=(data_size / 4));
                let max_end = std::cmp::min(start + data_size / 2, data_size);
                let end = rng.gen_range((start + 4)..=max_end);
                serde_json::json!({ "start": start, "end": end })
            }
            OpType::Sort => serde_json::json!({}),
            OpType::Rotate => {
                let positions = rng.gen_range(1..=(data_size / 2));
                serde_json::json!({ "positions": positions })
            }
            OpType::Sha256 => serde_json::json!({}),
            OpType::BitwiseNot => serde_json::json!({}),
            OpType::Repeat => {
                let times = rng.gen_range(2u32..=3);
                serde_json::json!({ "times": times })
            }
            OpType::Hmac => {
                let key_bytes = crate::crypto::random_bytes(16);
                serde_json::json!({ "keyHex": hex::encode(&key_bytes) })
            }
            OpType::Base64Encode => serde_json::json!({}),
        };
        ops.push(ByteOperation {
            op: op_type,
            params,
        });
    }

    ops
}

// ---------------------------------------------------------------------------
// Op execution
// ---------------------------------------------------------------------------

fn apply_op(data: &[u8], op: &ByteOperation) -> Vec<u8> {
    match &op.op {
        OpType::Xor => {
            let key = op.params["key"].as_u64().unwrap_or(0) as u8;
            data.iter().map(|b| b ^ key).collect()
        }
        OpType::Reverse => {
            let mut result: Vec<u8> = data.to_vec();
            result.reverse();
            result
        }
        OpType::Slice => {
            let start = op.params["start"].as_u64().unwrap_or(0) as usize;
            let end = op.params["end"].as_u64().unwrap_or(data.len() as u64) as usize;
            let end = std::cmp::min(end, data.len());
            let start = std::cmp::min(start, end);
            data[start..end].to_vec()
        }
        OpType::Sort => {
            let mut result = data.to_vec();
            result.sort();
            result
        }
        OpType::Rotate => {
            let positions = op.params["positions"].as_u64().unwrap_or(0) as usize;
            if data.is_empty() {
                return vec![];
            }
            let pos = positions % data.len();
            let mut result = vec![0u8; data.len()];
            for i in 0..data.len() {
                result[i] = data[(i + pos) % data.len()];
            }
            result
        }
        OpType::Sha256 => {
            let mut hasher = Sha256::new();
            hasher.update(data);
            hasher.finalize().to_vec()
        }
        OpType::BitwiseNot => data.iter().map(|b| !b).collect(),
        OpType::Repeat => {
            let times = op.params["times"].as_u64().unwrap_or(2) as usize;
            let mut result = Vec::with_capacity(data.len() * times);
            for _ in 0..times {
                result.extend_from_slice(data);
            }
            result
        }
        OpType::Hmac => {
            let key_hex = op.params["keyHex"].as_str().unwrap_or("");
            let key_bytes = hex::decode(key_hex).unwrap_or_default();
            let mut mac =
                Hmac::<Sha256>::new_from_slice(&key_bytes).expect("HMAC key");
            mac.update(data);
            mac.finalize().into_bytes().to_vec()
        }
        OpType::Base64Encode => {
            let b64 = B64.encode(data);
            b64.into_bytes()
        }
    }
}

fn execute_ops(data: &[u8], ops: &[ByteOperation]) -> Vec<u8> {
    let mut result = data.to_vec();
    for op in ops {
        result = apply_op(&result, op);
    }
    result
}

// ---------------------------------------------------------------------------
// Instruction generation
// ---------------------------------------------------------------------------

fn ops_to_instructions(ops: &[ByteOperation]) -> String {
    ops.iter()
        .enumerate()
        .map(|(i, op)| format!("Step {}: {}", i + 1, phrasing(op)))
        .collect::<Vec<_>>()
        .join("\n")
}

// ---------------------------------------------------------------------------
// Driver
// ---------------------------------------------------------------------------

pub struct CryptoNLDriver;

impl CryptoNLDriver {
    pub fn new() -> Self {
        Self
    }
}

impl Default for CryptoNLDriver {
    fn default() -> Self {
        Self::new()
    }
}

impl ChallengeDriver for CryptoNLDriver {
    fn name(&self) -> &str {
        "crypto-nl"
    }

    fn dimensions(&self) -> Vec<ChallengeDimension> {
        vec![ChallengeDimension::Reasoning, ChallengeDimension::Execution]
    }

    fn estimated_human_time_ms(&self) -> u64 {
        60_000
    }

    fn estimated_ai_time_ms(&self) -> u64 {
        500
    }

    fn generate(&self, difficulty: &Difficulty) -> Result<(ChallengePayload, String), String> {
        let (ops_count, data_size) = difficulty_config(difficulty);
        let data = crate::crypto::random_bytes(data_size);
        let ops = generate_ops(ops_count, data_size, difficulty);
        let instructions = ops_to_instructions(&ops);

        // Compute the correct answer: execute ops then SHA-256 hex of result
        let result = execute_ops(&data, &ops);
        let answer = sha256_hex(&result);
        // answer_hash = sha256(answer_string)
        let answer_hash = sha256_hex(answer.as_bytes());

        let payload = ChallengePayload {
            challenge_type: "crypto-nl".into(),
            instructions: format!(
                "{}\n\nThen compute the SHA-256 hex digest of the final result.",
                instructions
            ),
            data: B64.encode(&data),
            steps: ops.len() as u32,
            context: Some(serde_json::json!({ "ops": ops })),
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
        let driver = CryptoNLDriver::new();
        let (payload, hash) = driver.generate(&Difficulty::Easy).unwrap();

        assert_eq!(payload.challenge_type, "crypto-nl");
        assert!(!payload.instructions.is_empty());
        assert!(!payload.data.is_empty());
        assert!(payload.steps >= 1);
        assert!(!hash.is_empty());
        assert_eq!(hash.len(), 64); // SHA-256 hex
    }

    #[test]
    fn test_verify_correct_answer() {
        let driver = CryptoNLDriver::new();
        let (payload, answer_hash) = driver.generate(&Difficulty::Easy).unwrap();

        // Re-compute the correct answer from the payload
        let data = B64.decode(&payload.data).unwrap();
        let ops: Vec<ByteOperation> =
            serde_json::from_value(payload.context.unwrap()["ops"].clone()).unwrap();
        let result = execute_ops(&data, &ops);
        let answer = sha256_hex(&result);

        let is_valid = driver
            .verify(&answer_hash, &serde_json::Value::String(answer))
            .unwrap();
        assert!(is_valid);
    }

    #[test]
    fn test_verify_wrong_answer() {
        let driver = CryptoNLDriver::new();
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
    fn test_all_ops_produce_output() {
        // Test that each operation produces non-empty output
        let test_data = vec![1u8, 2, 3, 4, 5, 6, 7, 8];

        let ops_to_test = vec![
            ByteOperation {
                op: OpType::Xor,
                params: serde_json::json!({"key": 42}),
            },
            ByteOperation {
                op: OpType::Reverse,
                params: serde_json::json!({}),
            },
            ByteOperation {
                op: OpType::Slice,
                params: serde_json::json!({"start": 1, "end": 5}),
            },
            ByteOperation {
                op: OpType::Sort,
                params: serde_json::json!({}),
            },
            ByteOperation {
                op: OpType::Rotate,
                params: serde_json::json!({"positions": 2}),
            },
            ByteOperation {
                op: OpType::Sha256,
                params: serde_json::json!({}),
            },
            ByteOperation {
                op: OpType::BitwiseNot,
                params: serde_json::json!({}),
            },
            ByteOperation {
                op: OpType::Repeat,
                params: serde_json::json!({"times": 2}),
            },
            ByteOperation {
                op: OpType::Hmac,
                params: serde_json::json!({"keyHex": "0102030405060708090a0b0c0d0e0f10"}),
            },
            ByteOperation {
                op: OpType::Base64Encode,
                params: serde_json::json!({}),
            },
        ];

        for op in &ops_to_test {
            let result = apply_op(&test_data, op);
            assert!(!result.is_empty(), "Op {:?} produced empty output", op.op);
        }
    }

    #[test]
    fn test_nl_phrasings_exist() {
        // Ensure phrasing doesn't panic for each op type
        let ops = vec![
            ByteOperation { op: OpType::Xor, params: serde_json::json!({"key": 5}) },
            ByteOperation { op: OpType::Reverse, params: serde_json::json!({}) },
            ByteOperation { op: OpType::Slice, params: serde_json::json!({"start": 0, "end": 4}) },
            ByteOperation { op: OpType::Sort, params: serde_json::json!({}) },
            ByteOperation { op: OpType::Rotate, params: serde_json::json!({"positions": 3}) },
            ByteOperation { op: OpType::Sha256, params: serde_json::json!({}) },
            ByteOperation { op: OpType::BitwiseNot, params: serde_json::json!({}) },
            ByteOperation { op: OpType::Repeat, params: serde_json::json!({"times": 2}) },
            ByteOperation { op: OpType::Hmac, params: serde_json::json!({"keyHex": "abcd"}) },
            ByteOperation { op: OpType::Base64Encode, params: serde_json::json!({}) },
        ];

        for op in &ops {
            let text = phrasing(op);
            assert!(!text.is_empty(), "Phrasing for {:?} was empty", op.op);
        }
    }
}
