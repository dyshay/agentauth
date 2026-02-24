use agentauth::crypto::{hmac_sha256_hex, timing_safe_equal};

#[test]
fn test_hmac_sha256_produces_hex() {
    let result = hmac_sha256_hex("hello", "secret-key");
    assert_eq!(result.len(), 64);
    assert!(result.chars().all(|c| c.is_ascii_hexdigit()));
}

#[test]
fn test_hmac_sha256_deterministic() {
    let a = hmac_sha256_hex("message", "key");
    let b = hmac_sha256_hex("message", "key");
    assert_eq!(a, b);
}

#[test]
fn test_hmac_sha256_different_keys() {
    let a = hmac_sha256_hex("message", "key1");
    let b = hmac_sha256_hex("message", "key2");
    assert_ne!(a, b);
}

#[test]
fn test_timing_safe_equal_same() {
    assert!(timing_safe_equal("abc", "abc"));
}

#[test]
fn test_timing_safe_equal_different() {
    assert!(!timing_safe_equal("abc", "def"));
}

#[test]
fn test_timing_safe_equal_different_length() {
    assert!(!timing_safe_equal("abc", "abcd"));
}
