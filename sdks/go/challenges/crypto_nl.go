package challenges

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math/rand"
	"sort"

	xagentauth "github.com/dyshay/agentauth/sdks/go"
)

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

// OpType is the type of byte operation.
type OpType string

const (
	OpXOR          OpType = "xor"
	OpReverse      OpType = "reverse"
	OpSlice        OpType = "slice"
	OpSort         OpType = "sort"
	OpRotate       OpType = "rotate"
	OpSHA256       OpType = "sha256"
	OpBitwiseNot   OpType = "bitwise_not"
	OpRepeat       OpType = "repeat"
	OpHMAC         OpType = "hmac"
	OpBase64Encode OpType = "base64_encode"
)

// ByteOperation represents a single operation with its parameters.
type ByteOperation struct {
	Op     OpType            `json:"op"`
	Params map[string]string `json:"params"`
}

// ---------------------------------------------------------------------------
// Op pools by difficulty
// ---------------------------------------------------------------------------

var basicOps = []OpType{OpXOR, OpReverse, OpSlice, OpSort, OpRotate}
var mediumOps = append(append([]OpType{}, basicOps...), OpSHA256, OpBitwiseNot)
var allOps = append(append([]OpType{}, mediumOps...), OpRepeat, OpHMAC, OpBase64Encode)

var opsByDifficulty = map[xagentauth.Difficulty][]OpType{
	xagentauth.DifficultyEasy:        basicOps,
	xagentauth.DifficultyMedium:      mediumOps,
	xagentauth.DifficultyHard:        allOps,
	xagentauth.DifficultyAdversarial: allOps,
}

// ---------------------------------------------------------------------------
// Natural language phrasings
// ---------------------------------------------------------------------------

type phrasingFunc func(params map[string]string) string

var phrasings = map[OpType][]phrasingFunc{
	OpXOR: {
		func(p map[string]string) string {
			return fmt.Sprintf("XOR each byte with 0x%s", p["keyHex"])
		},
		func(p map[string]string) string {
			return fmt.Sprintf("Apply exclusive-or with the value %s to every byte", p["key"])
		},
		func(p map[string]string) string {
			return fmt.Sprintf("Bitwise XOR each octet using the key %s", p["key"])
		},
		func(p map[string]string) string {
			return fmt.Sprintf("For every byte, flip bits using 0x%s as mask", p["keyHex"])
		},
	},
	OpReverse: {
		func(_ map[string]string) string { return "Reverse the byte order" },
		func(_ map[string]string) string { return "Flip the sequence end-to-end" },
		func(_ map[string]string) string { return "Mirror the byte array so the last byte becomes first" },
		func(_ map[string]string) string { return "Invert the positional ordering of all bytes" },
	},
	OpSlice: {
		func(p map[string]string) string {
			return fmt.Sprintf("Take bytes from offset %s to %s", p["start"], p["end"])
		},
		func(p map[string]string) string {
			return fmt.Sprintf("Extract the slice [%s:%s] from the data", p["start"], p["end"])
		},
		func(p map[string]string) string {
			return fmt.Sprintf("Isolate bytes at positions %s through the byte before %s", p["start"], p["end"])
		},
	},
	OpSort: {
		func(_ map[string]string) string { return "Sort all bytes in ascending order" },
		func(_ map[string]string) string { return "Arrange the bytes from smallest to largest value" },
		func(_ map[string]string) string { return "Order the octets numerically, lowest first" },
	},
	OpRotate: {
		func(p map[string]string) string {
			return fmt.Sprintf("Rotate the bytes left by %s positions", p["positions"])
		},
		func(p map[string]string) string {
			return fmt.Sprintf("Shift all bytes %s positions to the left, wrapping around", p["positions"])
		},
		func(p map[string]string) string {
			return fmt.Sprintf("Circular left-shift the array by %s", p["positions"])
		},
	},
	OpSHA256: {
		func(_ map[string]string) string {
			return "Compute the SHA-256 hash of the current data (producing 32 raw bytes)"
		},
		func(_ map[string]string) string {
			return "Hash the byte array with SHA-256, replacing it with the 32-byte digest"
		},
		func(_ map[string]string) string {
			return "Apply SHA-256 to the data -- the result is the raw 32-byte hash"
		},
	},
	OpBitwiseNot: {
		func(_ map[string]string) string {
			return "Flip every bit in each byte (bitwise NOT, masked to 8 bits)"
		},
		func(_ map[string]string) string {
			return "Apply bitwise complement to every byte (~byte & 0xFF)"
		},
		func(_ map[string]string) string {
			return "Invert all bits in the array -- each byte becomes its one's complement"
		},
	},
	OpRepeat: {
		func(p map[string]string) string {
			return fmt.Sprintf("Concatenate the array with itself %s times (total %sx copies)", p["times"], p["times"])
		},
		func(p map[string]string) string {
			return fmt.Sprintf("Repeat the data %s times by appending it to itself", p["times"])
		},
		func(p map[string]string) string {
			return fmt.Sprintf("Duplicate the byte sequence so it appears %s times in a row", p["times"])
		},
	},
	OpHMAC: {
		func(p map[string]string) string {
			return fmt.Sprintf("Compute HMAC-SHA256 of the data using the hex key %s (producing 32 raw bytes)", p["keyHex"])
		},
		func(p map[string]string) string {
			return fmt.Sprintf("HMAC the byte array with SHA-256 and key 0x%s, yielding 32 bytes", p["keyHex"])
		},
		func(p map[string]string) string {
			return fmt.Sprintf("Apply HMAC-SHA256 using the secret key (hex) %s -- the result is 32 raw bytes", p["keyHex"])
		},
	},
	OpBase64Encode: {
		func(_ map[string]string) string {
			return "Base64-encode the data, then treat the resulting ASCII string as a new byte array"
		},
		func(_ map[string]string) string {
			return "Encode the bytes as a base64 string and reinterpret its characters as byte values"
		},
		func(_ map[string]string) string {
			return "Convert the data to base64 and use the encoded string's character codes as the new bytes"
		},
	},
}

// ---------------------------------------------------------------------------
// Difficulty config
// ---------------------------------------------------------------------------

type cryptoDifficultyConfig struct {
	ops      int
	dataSize int
}

var cryptoDiffConfigs = map[xagentauth.Difficulty]cryptoDifficultyConfig{
	xagentauth.DifficultyEasy:        {ops: 1, dataSize: 16},
	xagentauth.DifficultyMedium:      {ops: 2, dataSize: 32},
	xagentauth.DifficultyHard:        {ops: 4, dataSize: 64},
	xagentauth.DifficultyAdversarial: {ops: 6, dataSize: 128},
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

func pickRandom[T any](arr []T) T {
	return arr[rand.Intn(len(arr))]
}

func randomInt(min, max int) int {
	return min + rand.Intn(max-min+1)
}

// ---------------------------------------------------------------------------
// Op generation
// ---------------------------------------------------------------------------

func generateOps(count, dataSize int, difficulty xagentauth.Difficulty) []ByteOperation {
	opPool := opsByDifficulty[difficulty]
	ops := make([]ByteOperation, 0, count)

	for i := 0; i < count; i++ {
		op := pickRandom(opPool)
		switch op {
		case OpXOR:
			key := randomInt(1, 255)
			ops = append(ops, ByteOperation{
				Op: op,
				Params: map[string]string{
					"key":    fmt.Sprintf("%d", key),
					"keyHex": fmt.Sprintf("%02X", key),
				},
			})
		case OpReverse:
			ops = append(ops, ByteOperation{Op: op, Params: map[string]string{}})
		case OpSlice:
			start := randomInt(0, dataSize/4)
			end := randomInt(start+4, min(start+dataSize/2, dataSize))
			ops = append(ops, ByteOperation{
				Op: op,
				Params: map[string]string{
					"start": fmt.Sprintf("%d", start),
					"end":   fmt.Sprintf("%d", end),
				},
			})
		case OpSort:
			ops = append(ops, ByteOperation{Op: op, Params: map[string]string{}})
		case OpRotate:
			positions := randomInt(1, dataSize/2)
			ops = append(ops, ByteOperation{
				Op: op,
				Params: map[string]string{
					"positions": fmt.Sprintf("%d", positions),
				},
			})
		case OpSHA256:
			ops = append(ops, ByteOperation{Op: op, Params: map[string]string{}})
		case OpBitwiseNot:
			ops = append(ops, ByteOperation{Op: op, Params: map[string]string{}})
		case OpRepeat:
			times := randomInt(2, 3)
			ops = append(ops, ByteOperation{
				Op: op,
				Params: map[string]string{
					"times": fmt.Sprintf("%d", times),
				},
			})
		case OpHMAC:
			keyBytes := xagentauth.RandomBytes(16)
			ops = append(ops, ByteOperation{
				Op: op,
				Params: map[string]string{
					"keyHex": hex.EncodeToString(keyBytes),
				},
			})
		case OpBase64Encode:
			ops = append(ops, ByteOperation{Op: op, Params: map[string]string{}})
		}
	}

	return ops
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// ---------------------------------------------------------------------------
// Op execution
// ---------------------------------------------------------------------------

func applyOp(data []byte, op ByteOperation) ([]byte, error) {
	switch op.Op {
	case OpXOR:
		key := 0
		fmt.Sscanf(op.Params["key"], "%d", &key)
		result := make([]byte, len(data))
		for i := range data {
			result[i] = data[i] ^ byte(key)
		}
		return result, nil

	case OpReverse:
		result := make([]byte, len(data))
		for i := range data {
			result[i] = data[len(data)-1-i]
		}
		return result, nil

	case OpSlice:
		start, end := 0, len(data)
		fmt.Sscanf(op.Params["start"], "%d", &start)
		fmt.Sscanf(op.Params["end"], "%d", &end)
		if start > len(data) {
			start = len(data)
		}
		if end > len(data) {
			end = len(data)
		}
		return append([]byte{}, data[start:end]...), nil

	case OpSort:
		result := make([]byte, len(data))
		copy(result, data)
		sort.Slice(result, func(i, j int) bool { return result[i] < result[j] })
		return result, nil

	case OpRotate:
		pos := 0
		fmt.Sscanf(op.Params["positions"], "%d", &pos)
		if len(data) == 0 {
			return data, nil
		}
		pos = pos % len(data)
		result := make([]byte, len(data))
		for i := range data {
			result[i] = data[(i+pos)%len(data)]
		}
		return result, nil

	case OpSHA256:
		h := sha256.Sum256(data)
		return h[:], nil

	case OpBitwiseNot:
		result := make([]byte, len(data))
		for i := range data {
			result[i] = ^data[i]
		}
		return result, nil

	case OpRepeat:
		times := 2
		fmt.Sscanf(op.Params["times"], "%d", &times)
		result := make([]byte, 0, len(data)*times)
		for t := 0; t < times; t++ {
			result = append(result, data...)
		}
		return result, nil

	case OpHMAC:
		keyBytes, err := hex.DecodeString(op.Params["keyHex"])
		if err != nil {
			return nil, fmt.Errorf("invalid HMAC key hex: %w", err)
		}
		mac := hmac.New(sha256.New, keyBytes)
		mac.Write(data)
		return mac.Sum(nil), nil

	case OpBase64Encode:
		b64 := base64.StdEncoding.EncodeToString(data)
		return []byte(b64), nil

	default:
		return nil, fmt.Errorf("unknown operation: %s", op.Op)
	}
}

func executeOps(data []byte, ops []ByteOperation) ([]byte, error) {
	result := data
	for _, op := range ops {
		var err error
		result, err = applyOp(result, op)
		if err != nil {
			return nil, err
		}
	}
	return result, nil
}

// ---------------------------------------------------------------------------
// Instruction generation
// ---------------------------------------------------------------------------

func opsToInstructions(ops []ByteOperation) string {
	var result string
	for i, op := range ops {
		phrFuncs := phrasings[op.Op]
		phr := pickRandom(phrFuncs)(op.Params)
		if i > 0 {
			result += "\n"
		}
		result += fmt.Sprintf("Step %d: %s", i+1, phr)
	}
	return result
}

// ---------------------------------------------------------------------------
// CryptoNLDriver
// ---------------------------------------------------------------------------

// CryptoNLDriver implements the crypto-nl challenge: natural language
// descriptions of byte operations on random data.
type CryptoNLDriver struct{}

func (d *CryptoNLDriver) Name() string { return "crypto-nl" }

func (d *CryptoNLDriver) Dimensions() []xagentauth.ChallengeDimension {
	return []xagentauth.ChallengeDimension{xagentauth.DimensionReasoning, xagentauth.DimensionExecution}
}

func (d *CryptoNLDriver) EstimatedHumanTimeMs() int64 { return 60000 }
func (d *CryptoNLDriver) EstimatedAITimeMs() int64    { return 500 }

// Generate creates a crypto-nl challenge. Returns (payload, answerHash, error).
func (d *CryptoNLDriver) Generate(difficulty xagentauth.Difficulty) (*xagentauth.ChallengePayload, string, error) {
	config := cryptoDiffConfigs[difficulty]
	data := xagentauth.RandomBytes(config.dataSize)
	ops := generateOps(config.ops, config.dataSize, difficulty)
	instructions := opsToInstructions(ops)

	// Execute ops to compute the answer
	result, err := executeOps(data, ops)
	if err != nil {
		return nil, "", fmt.Errorf("failed to execute ops: %w", err)
	}

	// The answer is the SHA-256 hex digest of the result
	answer := xagentauth.SHA256Hex(result)
	// The answer hash is SHA-256 of the answer string
	answerHash := xagentauth.SHA256Hex([]byte(answer))

	// Encode ops in context
	opsJSON, err := json.Marshal(ops)
	if err != nil {
		return nil, "", fmt.Errorf("failed to marshal ops: %w", err)
	}

	contextMap := map[string]json.RawMessage{
		"ops": opsJSON,
	}
	contextJSON, err := json.Marshal(contextMap)
	if err != nil {
		return nil, "", fmt.Errorf("failed to marshal context: %w", err)
	}

	payload := &xagentauth.ChallengePayload{
		Type:         "crypto-nl",
		Instructions: instructions + "\n\nThen compute the SHA-256 hex digest of the final result.",
		Data:         base64.StdEncoding.EncodeToString(data),
		Steps:        len(ops),
		Context:      contextJSON,
	}

	return payload, answerHash, nil
}

// Verify checks whether the submitted answer matches the answer hash.
func (d *CryptoNLDriver) Verify(answerHash string, submitted string) (bool, error) {
	submittedHash := xagentauth.SHA256Hex([]byte(submitted))
	return xagentauth.TimingSafeEqual(answerHash, submittedHash), nil
}
