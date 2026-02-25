package xagentauth

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
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

// RandomBytes generates cryptographically secure random bytes.
func RandomBytes(length int) []byte {
	buf := make([]byte, length)
	_, err := rand.Read(buf)
	if err != nil {
		panic("crypto/rand failed: " + err.Error())
	}
	return buf
}

// ToHex converts bytes to a lowercase hex string.
func ToHex(data []byte) string {
	return hex.EncodeToString(data)
}

// FromHex converts a hex string to bytes.
func FromHex(hexStr string) ([]byte, error) {
	return hex.DecodeString(hexStr)
}

// SHA256Hex computes the SHA-256 hex digest of the data.
func SHA256Hex(data []byte) string {
	h := sha256.Sum256(data)
	return hex.EncodeToString(h[:])
}

// SHA256Bytes computes the SHA-256 hash and returns raw bytes.
func SHA256Bytes(data []byte) []byte {
	h := sha256.Sum256(data)
	return h[:]
}

// HmacSHA256Bytes computes HMAC-SHA256 of raw bytes, returning raw bytes.
func HmacSHA256Bytes(key, message []byte) []byte {
	h := hmac.New(sha256.New, key)
	h.Write(message)
	return h.Sum(nil)
}

// Base64Encode encodes bytes to standard base64 string.
func Base64Encode(data []byte) string {
	return base64.StdEncoding.EncodeToString(data)
}

// Base64Decode decodes a standard base64 string to bytes.
func Base64Decode(s string) ([]byte, error) {
	return base64.StdEncoding.DecodeString(s)
}

// GenerateID generates a challenge ID like "ch_<32 hex chars>".
func GenerateID() string {
	return "ch_" + hex.EncodeToString(RandomBytes(16))
}

// GenerateSessionToken generates a session token like "st_<48 hex chars>".
func GenerateSessionToken() string {
	return "st_" + hex.EncodeToString(RandomBytes(24))
}
