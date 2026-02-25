package xagentauth

import (
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
)

// HmacSHA256Hex computes the HMAC-SHA256 of the message using the secret
// and returns the result as a hex-encoded string.
func HmacSHA256Hex(message, secret string) string {
	h := hmac.New(sha256.New, []byte(secret))
	h.Write([]byte(message))
	return hex.EncodeToString(h.Sum(nil))
}

// TimingSafeEqual performs a constant-time comparison of two strings
// to prevent timing attacks.
func TimingSafeEqual(a, b string) bool {
	return subtle.ConstantTimeCompare([]byte(a), []byte(b)) == 1
}
