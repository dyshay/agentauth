package challenges

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math/rand"
	"strings"

	xagentauth "github.com/dyshay/agentauth/sdks/go"
)

// ---------------------------------------------------------------------------
// Step definitions
// ---------------------------------------------------------------------------

type stepType string

const (
	stepSHA256       stepType = "sha256"
	stepXOR          stepType = "xor"
	stepHMAC         stepType = "hmac"
	stepSliceMS      stepType = "slice"
	stepMemoryRecall stepType = "memory_recall"
	stepMemoryApply  stepType = "memory_apply"
)

type stepDef struct {
	Type      stepType `json:"type"`
	Key       int      `json:"key,omitempty"`
	KeyHex    string   `json:"key_hex,omitempty"`
	Start     int      `json:"start,omitempty"`
	End       int      `json:"end,omitempty"`
	Step      int      `json:"step,omitempty"`
	ByteIndex int      `json:"byte_index,omitempty"`
}

type stepResult struct {
	Def    stepDef `json:"def"`
	Result string  `json:"result"` // hex string
}

// ---------------------------------------------------------------------------
// Step execution
// ---------------------------------------------------------------------------

func hmacSha256HexBytes(key, message []byte) string {
	mac := hmac.New(sha256.New, key)
	mac.Write(message)
	return hex.EncodeToString(mac.Sum(nil))
}

func xorBytesHex(data []byte, key int) string {
	result := make([]byte, len(data))
	for i := range data {
		result[i] = data[i] ^ byte(key&0xFF)
	}
	return hex.EncodeToString(result)
}

func sliceHex(hexStr string, start, end int) string {
	bytes, _ := hex.DecodeString(hexStr)
	if start > len(bytes) {
		start = len(bytes)
	}
	if end > len(bytes) {
		end = len(bytes)
	}
	return hex.EncodeToString(bytes[start:end])
}

func executeStepMS(stepIndex int, def stepDef, inputDataHex string, previousResults []stepResult) string {
	switch def.Type {
	case stepSHA256:
		source := inputDataHex
		if stepIndex > 0 {
			source = previousResults[stepIndex-1].Result
		}
		bytes, _ := hex.DecodeString(source)
		return xagentauth.SHA256Hex(bytes)

	case stepXOR:
		source := inputDataHex
		if stepIndex > 0 {
			source = previousResults[stepIndex-1].Result
		}
		bytes, _ := hex.DecodeString(source)
		return xorBytesHex(bytes, def.Key)

	case stepHMAC:
		if stepIndex == 0 {
			keyBytes, _ := hex.DecodeString(def.KeyHex)
			msgBytes, _ := hex.DecodeString(inputDataHex)
			return hmacSha256HexBytes(keyBytes, msgBytes)
		}
		keyBytes, _ := hex.DecodeString(previousResults[stepIndex-1].Result)
		msgBytes, _ := hex.DecodeString(inputDataHex)
		return hmacSha256HexBytes(keyBytes, msgBytes)

	case stepSliceMS:
		source := inputDataHex
		if stepIndex > 0 {
			source = previousResults[stepIndex-1].Result
		}
		return sliceHex(source, def.Start, def.End)

	case stepMemoryRecall:
		targetResult := previousResults[def.Step].Result
		bytes, _ := hex.DecodeString(targetResult)
		b := bytes[def.ByteIndex]
		return fmt.Sprintf("%02x", b)

	case stepMemoryApply:
		refDef := previousResults[def.Step].Def
		// Re-execute the referenced operation type on current data
		prevResults := make([]stepResult, stepIndex)
		copy(prevResults, previousResults[:stepIndex])
		return executeStepMS(stepIndex, refDef, inputDataHex, prevResults)
	}
	return ""
}

func executeAllStepsMS(steps []stepDef, inputDataHex string) []stepResult {
	results := make([]stepResult, 0, len(steps))
	for i, def := range steps {
		result := executeStepMS(i, def, inputDataHex, results)
		results = append(results, stepResult{Def: def, Result: result})
	}
	return results
}

func computeFinalAnswer(stepResults []stepResult) string {
	var parts []string
	for _, r := range stepResults {
		parts = append(parts, r.Result)
	}
	concatenated := strings.Join(parts, "")
	return xagentauth.SHA256Hex([]byte(concatenated))
}

// ---------------------------------------------------------------------------
// Instruction generation
// ---------------------------------------------------------------------------

var sha256Phrasings = []func(string) string{
	func(ref string) string { return fmt.Sprintf("Compute the SHA-256 hash of %s. Your result is", ref) },
	func(ref string) string { return fmt.Sprintf("Hash %s using SHA-256. Your result is", ref) },
	func(ref string) string { return fmt.Sprintf("Apply SHA-256 to %s. Your result is", ref) },
}

var xorPhrasings = []func(string, int) string{
	func(ref string, key int) string {
		return fmt.Sprintf("XOR each byte of %s with 0x%02X. Your result is", ref, key)
	},
	func(ref string, key int) string {
		return fmt.Sprintf("Apply exclusive-or with the value %d to every byte of %s. Your result is", key, ref)
	},
	func(ref string, key int) string {
		return fmt.Sprintf("Bitwise XOR each byte of %s using the key 0x%02x. Your result is", ref, key)
	},
}

var hmacPhrasings = []func(string, string) string{
	func(keyRef, msgRef string) string {
		return fmt.Sprintf("Compute HMAC-SHA256 with %s as key and %s as message. Your result is", keyRef, msgRef)
	},
	func(keyRef, msgRef string) string {
		return fmt.Sprintf("Use %s as an HMAC-SHA256 key to sign %s. Your result is", keyRef, msgRef)
	},
}

var slicePhrasings = []func(string, int, int) string{
	func(ref string, start, end int) string {
		return fmt.Sprintf("Take bytes %d through %d (inclusive) from %s. Your result is", start, end-1, ref)
	},
	func(ref string, start, end int) string {
		return fmt.Sprintf("Extract the first %d bytes of %s starting at offset %d. Your result is", end-start, ref, start)
	},
}

var recallPhrasings = []func(int, int) string{
	func(stepNum, byteIndex int) string {
		return fmt.Sprintf("What was byte %d (0-indexed) of your result R%d? Express as a 2-digit hex value. Your result is", byteIndex, stepNum)
	},
	func(stepNum, byteIndex int) string {
		return fmt.Sprintf("Recall the value of byte at position %d in R%d, written as two hex digits. Your result is", byteIndex, stepNum)
	},
}

var applyPhrasings = []func(int, string) string{
	func(stepNum int, prevRef string) string {
		return fmt.Sprintf("Apply the same operation you performed in step %d to %s. Your result is", stepNum, prevRef)
	},
	func(stepNum int, prevRef string) string {
		return fmt.Sprintf("Repeat the operation from step %d, but this time on %s. Your result is", stepNum, prevRef)
	},
}

func generateInstructionMS(stepIndex int, def stepDef) string {
	stepNum := stepIndex + 1
	resultLabel := fmt.Sprintf("R%d", stepNum)
	prevRef := "the provided data"
	if stepIndex > 0 {
		prevRef = fmt.Sprintf("R%d", stepIndex)
	}

	switch def.Type {
	case stepSHA256:
		ref := "the provided data"
		if stepIndex > 0 {
			ref = fmt.Sprintf("R%d", stepIndex)
		}
		p := pickRandom(sha256Phrasings)(ref)
		return fmt.Sprintf("Step %d: %s %s.", stepNum, p, resultLabel)

	case stepXOR:
		ref := "the provided data"
		if stepIndex > 0 {
			ref = fmt.Sprintf("R%d", stepIndex)
		}
		p := pickRandom(xorPhrasings)(ref, def.Key)
		return fmt.Sprintf("Step %d: %s %s.", stepNum, p, resultLabel)

	case stepHMAC:
		if stepIndex == 0 {
			p := pickRandom(hmacPhrasings)(fmt.Sprintf("the hex key \"%s\"", def.KeyHex), "the provided data")
			return fmt.Sprintf("Step %d: %s %s.", stepNum, p, resultLabel)
		}
		p := pickRandom(hmacPhrasings)(fmt.Sprintf("R%d", stepIndex), "the provided data")
		return fmt.Sprintf("Step %d: %s %s.", stepNum, p, resultLabel)

	case stepSliceMS:
		ref := "the provided data"
		if stepIndex > 0 {
			ref = fmt.Sprintf("R%d", stepIndex)
		}
		p := pickRandom(slicePhrasings)(ref, def.Start, def.End)
		return fmt.Sprintf("Step %d: %s %s.", stepNum, p, resultLabel)

	case stepMemoryRecall:
		p := pickRandom(recallPhrasings)(def.Step+1, def.ByteIndex)
		return fmt.Sprintf("Step %d: %s %s.", stepNum, p, resultLabel)

	case stepMemoryApply:
		p := pickRandom(applyPhrasings)(def.Step+1, prevRef)
		return fmt.Sprintf("Step %d: %s %s.", stepNum, p, resultLabel)
	}
	return ""
}

func generateAllInstructionsMS(steps []stepDef) string {
	var parts []string
	for i, def := range steps {
		parts = append(parts, generateInstructionMS(i, def))
	}

	var refs []string
	for i := range steps {
		refs = append(refs, fmt.Sprintf("R%d", i+1))
	}
	footer := fmt.Sprintf("\nYour final answer: SHA-256 of the concatenation of %s (all as lowercase hex strings, concatenated without separators).", strings.Join(refs, " + "))

	return strings.Join(parts, "\n") + footer
}

// ---------------------------------------------------------------------------
// Step generation per difficulty
// ---------------------------------------------------------------------------

type multiStepDiffConfig struct {
	totalSteps   int
	dataSize     int
	computeSteps int
	memoryRecall int
	memoryApply  int
}

var multiStepDiffConfigs = map[xagentauth.Difficulty]multiStepDiffConfig{
	xagentauth.DifficultyEasy:        {totalSteps: 3, dataSize: 32, computeSteps: 3, memoryRecall: 0, memoryApply: 0},
	xagentauth.DifficultyMedium:      {totalSteps: 4, dataSize: 32, computeSteps: 3, memoryRecall: 1, memoryApply: 0},
	xagentauth.DifficultyHard:        {totalSteps: 5, dataSize: 64, computeSteps: 3, memoryRecall: 1, memoryApply: 1},
	xagentauth.DifficultyAdversarial: {totalSteps: 7, dataSize: 64, computeSteps: 4, memoryRecall: 2, memoryApply: 1},
}

type computeStepType string

const (
	csSHA256 computeStepType = "sha256"
	csXOR    computeStepType = "xor"
	csHMAC   computeStepType = "hmac"
	csSlice  computeStepType = "slice"
)

func generateComputeStep(stepIndex, dataSize int, previousResults []stepResult) stepDef {
	allTypes := []computeStepType{csSHA256, csXOR, csHMAC, csSlice}
	firstTypes := []computeStepType{csSHA256, csXOR}

	available := allTypes
	if stepIndex == 0 {
		available = firstTypes
	}
	tp := available[rand.Intn(len(available))]

	switch tp {
	case csSHA256:
		return stepDef{Type: stepSHA256}
	case csXOR:
		return stepDef{Type: stepXOR, Key: randomInt(1, 255)}
	case csHMAC:
		if stepIndex == 0 {
			key := xagentauth.RandomBytes(16)
			return stepDef{Type: stepHMAC, KeyHex: hex.EncodeToString(key)}
		}
		return stepDef{Type: stepHMAC}
	case csSlice:
		prevResultLen := dataSize
		if stepIndex > 0 && len(previousResults) > stepIndex-1 {
			bytes, _ := hex.DecodeString(previousResults[stepIndex-1].Result)
			if len(bytes) > 0 {
				prevResultLen = len(bytes)
			} else {
				prevResultLen = 32
			}
		}
		maxEnd := prevResultLen
		if maxEnd < 4 {
			maxEnd = 4
		}
		start := randomInt(0, maxEnd/4)
		end := randomInt(start+2, min(start+maxEnd/2, maxEnd))
		return stepDef{Type: stepSliceMS, Start: start, End: end}
	}
	return stepDef{Type: stepSHA256}
}

func generateMemoryRecallStep(previousResults []stepResult) stepDef {
	stepIdx := rand.Intn(len(previousResults))
	resultBytes, _ := hex.DecodeString(previousResults[stepIdx].Result)
	byteIndex := rand.Intn(len(resultBytes))
	return stepDef{Type: stepMemoryRecall, Step: stepIdx, ByteIndex: byteIndex}
}

func generateMemoryApplyStep(previousResults []stepResult) stepDef {
	var computeSteps []int
	for i, r := range previousResults {
		if r.Def.Type != stepMemoryRecall && r.Def.Type != stepMemoryApply {
			computeSteps = append(computeSteps, i)
		}
	}
	if len(computeSteps) == 0 {
		return stepDef{Type: stepMemoryApply, Step: 0}
	}
	target := computeSteps[rand.Intn(len(computeSteps))]
	return stepDef{Type: stepMemoryApply, Step: target}
}

func generateStepsMS(difficulty xagentauth.Difficulty, inputDataHex string) ([]stepDef, []stepResult) {
	config := multiStepDiffConfigs[difficulty]
	steps := make([]stepDef, 0, config.totalSteps)
	results := make([]stepResult, 0, config.totalSteps)

	// Compute steps first
	for i := 0; i < config.computeSteps; i++ {
		def := generateComputeStep(i, config.dataSize, results)
		steps = append(steps, def)
		result := executeStepMS(i, def, inputDataHex, results)
		results = append(results, stepResult{Def: def, Result: result})
	}

	// Memory recall steps
	for i := 0; i < config.memoryRecall; i++ {
		def := generateMemoryRecallStep(results)
		stepIdx := len(steps)
		steps = append(steps, def)
		result := executeStepMS(stepIdx, def, inputDataHex, results)
		results = append(results, stepResult{Def: def, Result: result})
	}

	// Memory apply steps
	for i := 0; i < config.memoryApply; i++ {
		def := generateMemoryApplyStep(results)
		stepIdx := len(steps)
		steps = append(steps, def)
		result := executeStepMS(stepIdx, def, inputDataHex, results)
		results = append(results, stepResult{Def: def, Result: result})
	}

	return steps, results
}

// ---------------------------------------------------------------------------
// MultiStepDriver
// ---------------------------------------------------------------------------

// MultiStepDriver implements the multi-step challenge: a series of
// cryptographic operations with memory references.
type MultiStepDriver struct{}

func (d *MultiStepDriver) Name() string { return "multi-step" }

func (d *MultiStepDriver) Dimensions() []xagentauth.ChallengeDimension {
	return []xagentauth.ChallengeDimension{xagentauth.DimensionReasoning, xagentauth.DimensionExecution, xagentauth.DimensionMemory}
}

func (d *MultiStepDriver) EstimatedHumanTimeMs() int64 { return 120000 }
func (d *MultiStepDriver) EstimatedAITimeMs() int64    { return 2000 }

// Generate creates a multi-step challenge.
func (d *MultiStepDriver) Generate(difficulty xagentauth.Difficulty) (*xagentauth.ChallengePayload, string, error) {
	config := multiStepDiffConfigs[difficulty]
	data := xagentauth.RandomBytes(config.dataSize)
	inputDataHex := hex.EncodeToString(data)

	steps, results := generateStepsMS(difficulty, inputDataHex)
	finalAnswer := computeFinalAnswer(results)

	instructions := generateAllInstructionsMS(steps)

	// Answer hash
	answerHash := xagentauth.SHA256Hex([]byte(finalAnswer))

	// Context
	expectedResults := make([]string, len(results))
	for i, r := range results {
		expectedResults[i] = r.Result
	}
	contextMap := map[string]interface{}{
		"stepDefs":        steps,
		"expectedResults": expectedResults,
		"expectedAnswer":  finalAnswer,
	}
	contextJSON, _ := json.Marshal(contextMap)

	payload := &xagentauth.ChallengePayload{
		Type:         "multi-step",
		Instructions: instructions,
		Data:         base64.StdEncoding.EncodeToString(data),
		Steps:        len(steps),
		Context:      contextJSON,
	}

	return payload, answerHash, nil
}

// Verify checks whether the submitted answer matches the answer hash.
func (d *MultiStepDriver) Verify(answerHash string, submitted string) (bool, error) {
	submittedHash := xagentauth.SHA256Hex([]byte(submitted))
	return xagentauth.TimingSafeEqual(answerHash, submittedHash), nil
}
