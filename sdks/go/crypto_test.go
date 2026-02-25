package xagentauth

import (
	"testing"
)

func TestHmacSHA256Hex_ProducesHex(t *testing.T) {
	result := HmacSHA256Hex("test message", "secret key")

	// HMAC-SHA256 should produce 32 bytes = 64 hex characters
	if len(result) != 64 {
		t.Errorf("Expected 64 hex characters, got %d", len(result))
	}

	// Verify it's valid hex
	for _, c := range result {
		if !((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f')) {
			t.Errorf("Invalid hex character: %c", c)
		}
	}
}

func TestHmacSHA256Hex_Deterministic(t *testing.T) {
	message := "deterministic test"
	secret := "secret"

	result1 := HmacSHA256Hex(message, secret)
	result2 := HmacSHA256Hex(message, secret)

	if result1 != result2 {
		t.Errorf("Expected deterministic output, got different results:\n%s\n%s", result1, result2)
	}
}

func TestHmacSHA256Hex_DifferentKeys(t *testing.T) {
	message := "same message"

	result1 := HmacSHA256Hex(message, "key1")
	result2 := HmacSHA256Hex(message, "key2")

	if result1 == result2 {
		t.Errorf("Expected different outputs for different keys, got same result: %s", result1)
	}
}

func TestTimingSafeEqual_Same(t *testing.T) {
	if !TimingSafeEqual("abc", "abc") {
		t.Errorf("Expected true for identical strings")
	}
}

func TestTimingSafeEqual_Different(t *testing.T) {
	if TimingSafeEqual("abc", "def") {
		t.Errorf("Expected false for different strings")
	}
}

func TestTimingSafeEqual_DifferentLength(t *testing.T) {
	if TimingSafeEqual("abc", "abcd") {
		t.Errorf("Expected false for strings of different lengths")
	}
}
