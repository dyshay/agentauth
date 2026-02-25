use hmac::{Hmac, Mac};
use sha2::{Digest, Sha256};

type HmacSha256 = Hmac<Sha256>;

/// Compute HMAC-SHA256 of a UTF-8 message using a UTF-8 secret and return hex.
pub fn hmac_sha256_hex(message: &str, secret: &str) -> String {
    let mut mac =
        HmacSha256::new_from_slice(secret.as_bytes()).expect("HMAC can take key of any size");
    mac.update(message.as_bytes());
    let result = mac.finalize();
    hex::encode(result.into_bytes())
}

/// Constant-time string comparison.
pub fn timing_safe_equal(a: &str, b: &str) -> bool {
    if a.len() != b.len() {
        return false;
    }
    let mut result: u8 = 0;
    for (x, y) in a.bytes().zip(b.bytes()) {
        result |= x ^ y;
    }
    result == 0
}

/// Generate cryptographically-secure random bytes.
pub fn random_bytes(length: usize) -> Vec<u8> {
    let mut buf = vec![0u8; length];
    getrandom::getrandom(&mut buf).expect("getrandom failed");
    buf
}

/// Encode bytes as lowercase hex string.
pub fn to_hex(bytes: &[u8]) -> String {
    hex::encode(bytes)
}

/// Decode hex string to bytes.
pub fn from_hex(hex_str: &str) -> Result<Vec<u8>, hex::FromHexError> {
    hex::decode(hex_str)
}

/// Compute SHA-256 of raw bytes and return as hex string.
pub fn sha256_hex(data: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(data);
    hex::encode(hasher.finalize())
}

/// Compute HMAC-SHA256 with raw byte key and message, returning raw bytes.
pub fn hmac_sha256_bytes(key: &[u8], message: &[u8]) -> Vec<u8> {
    let mut mac = HmacSha256::new_from_slice(key).expect("HMAC key");
    mac.update(message);
    mac.finalize().into_bytes().to_vec()
}

/// Generate a unique challenge ID (ch_ prefix + 16 random bytes as hex).
pub fn generate_id() -> String {
    format!("ch_{}", hex::encode(random_bytes(16)))
}

/// Generate a unique session token (st_ prefix + 24 random bytes as hex).
pub fn generate_session_token() -> String {
    format!("st_{}", hex::encode(random_bytes(24)))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_random_bytes_length() {
        assert_eq!(random_bytes(16).len(), 16);
        assert_eq!(random_bytes(32).len(), 32);
        assert_eq!(random_bytes(0).len(), 0);
    }

    #[test]
    fn test_to_hex_from_hex_roundtrip() {
        let original = random_bytes(32);
        let hex_str = to_hex(&original);
        let decoded = from_hex(&hex_str).unwrap();
        assert_eq!(original, decoded);
    }

    #[test]
    fn test_sha256_hex_known() {
        // SHA-256 of empty string
        let hash = sha256_hex(b"");
        assert_eq!(
            hash,
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        );
        // SHA-256 of "hello"
        let hash2 = sha256_hex(b"hello");
        assert_eq!(
            hash2,
            "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
        );
    }

    #[test]
    fn test_hmac_sha256_bytes_known() {
        let mac = hmac_sha256_bytes(b"key", b"message");
        assert_eq!(mac.len(), 32);
        let hex_str = to_hex(&mac);
        assert_eq!(
            hex_str,
            "6e9ef29b75fffc5b7abae527d58fdadb2fe42e7219011976917343065f58ed4a"
        );
    }

    #[test]
    fn test_hmac_sha256_hex_known() {
        let hex_str = hmac_sha256_hex("message", "key");
        // HMAC-SHA256("message", "key") where both are UTF-8 strings as keys
        assert!(!hex_str.is_empty());
        assert_eq!(hex_str.len(), 64);
    }

    #[test]
    fn test_generate_id_format() {
        let id = generate_id();
        assert!(id.starts_with("ch_"));
        assert_eq!(id.len(), 3 + 32); // "ch_" + 32 hex chars (16 bytes)
    }

    #[test]
    fn test_generate_session_token_format() {
        let token = generate_session_token();
        assert!(token.starts_with("st_"));
        assert_eq!(token.len(), 3 + 48); // "st_" + 48 hex chars (24 bytes)
    }

    #[test]
    fn test_timing_safe_equal_positive() {
        assert!(timing_safe_equal("hello", "hello"));
        assert!(timing_safe_equal("abc123", "abc123"));
    }

    #[test]
    fn test_timing_safe_equal_negative() {
        assert!(!timing_safe_equal("hello", "world"));
        assert!(!timing_safe_equal("abc", "abcd"));
        assert!(!timing_safe_equal("", "a"));
    }
}
