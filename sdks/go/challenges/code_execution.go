package challenges

import (
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math/rand"

	xagentauth "github.com/dyshay/agentauth/sdks/go"
)

// ---------------------------------------------------------------------------
// Bug definitions
// ---------------------------------------------------------------------------

type bugDef struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

var (
	bugOffByOne    = bugDef{Name: "off_by_one", Description: "Uses % 255 instead of % 256 in modulo operation"}
	bugWrongOp     = bugDef{Name: "wrong_operator", Description: "Uses + (addition) instead of ^ (XOR) as the accumulator operator"}
	bugMissingStep = bugDef{Name: "missing_step", Description: "Missing byte reversal between hash rounds"}
	bugWrongInit   = bugDef{Name: "wrong_init", Description: "Accumulator initialized to 1 instead of 0"}
	bugWrongPad    = bugDef{Name: "wrong_pad", Description: "padStart uses length 1 instead of 2 for hex encoding"}
	bugWrongShift  = bugDef{Name: "wrong_shift", Description: "Shift amount is 7 instead of 8 in bit shifting"}
)

// ---------------------------------------------------------------------------
// Code template interface
// ---------------------------------------------------------------------------

type templateInput struct {
	Data   string                 `json:"data"` // base64-encoded
	Params map[string]interface{} `json:"params"`
}

type codeTemplate struct {
	name          string
	availableBugs []bugDef
	generateInput func() templateInput
	buggyCode     func(input templateInput, activeBugs []bugDef) string
	correctOutput func(input templateInput) string
}

// ---------------------------------------------------------------------------
// Template 1: Byte Transform
// ---------------------------------------------------------------------------

func byteTransformGenInput() templateInput {
	size := randomInt(8, 16)
	data := xagentauth.RandomBytes(size)
	return templateInput{
		Data:   base64.StdEncoding.EncodeToString(data),
		Params: map[string]interface{}{},
	}
}

func byteTransformBuggyCode(input templateInput, activeBugs []bugDef) string {
	hasOffByOne := hasBug(activeBugs, "off_by_one")
	hasWrongShift := hasBug(activeBugs, "wrong_shift")
	mod := "256"
	if hasOffByOne {
		mod = "255"
	}
	multiplier := "(i + 1)"
	if hasWrongShift {
		multiplier = "((i + 1) << 7)"
	}

	return fmt.Sprintf(`function transform(data) {
  // data is a Uint8Array
  const result = [];
  for (let i = 0; i < data.length; i++) {
    result.push((data[i] * %s) %% %s);
  }
  // Return the SHA-256 hex digest of the resulting byte array
  return sha256hex(Uint8Array.from(result));
}`, multiplier, mod)
}

func byteTransformCorrectOutput(input templateInput) string {
	data, _ := base64.StdEncoding.DecodeString(input.Data)
	result := make([]byte, len(data))
	for i := 0; i < len(data); i++ {
		result[i] = byte((int(data[i]) * (i + 1)) % 256)
	}
	h := sha256.Sum256(result)
	return hex.EncodeToString(h[:])
}

// ---------------------------------------------------------------------------
// Template 2: Array Processing (accumulator)
// ---------------------------------------------------------------------------

func arrayProcessingGenInput() templateInput {
	size := randomInt(8, 24)
	data := xagentauth.RandomBytes(size)
	return templateInput{
		Data:   base64.StdEncoding.EncodeToString(data),
		Params: map[string]interface{}{},
	}
}

func arrayProcessingBuggyCode(input templateInput, activeBugs []bugDef) string {
	hasWrongOp := hasBug(activeBugs, "wrong_operator")
	hasWrongInit := hasBug(activeBugs, "wrong_init")
	hasWrongPad := hasBug(activeBugs, "wrong_pad")
	operator := "^"
	if hasWrongOp {
		operator = "+"
	}
	initVal := "0"
	if hasWrongInit {
		initVal = "1"
	}
	padLen := "2"
	if hasWrongPad {
		padLen = "1"
	}

	return fmt.Sprintf(`function process(data) {
  // data is a Uint8Array
  let acc = %s;
  for (const byte of data) {
    acc = (acc %s byte) & 0xFF;
  }
  return acc.toString(16).padStart(%s, '0');
}`, initVal, operator, padLen)
}

func arrayProcessingCorrectOutput(input templateInput) string {
	data, _ := base64.StdEncoding.DecodeString(input.Data)
	acc := 0
	for _, b := range data {
		acc = (acc ^ int(b)) & 0xFF
	}
	return fmt.Sprintf("%02x", acc)
}

// ---------------------------------------------------------------------------
// Template 3: Hash Chain
// ---------------------------------------------------------------------------

func hashChainGenInput() templateInput {
	size := randomInt(8, 16)
	data := xagentauth.RandomBytes(size)
	rounds := randomInt(2, 4)
	return templateInput{
		Data:   base64.StdEncoding.EncodeToString(data),
		Params: map[string]interface{}{"rounds": rounds},
	}
}

func hashChainBuggyCode(input templateInput, activeBugs []bugDef) string {
	rounds := int(input.Params["rounds"].(int))
	hasMissing := hasBug(activeBugs, "missing_step")
	hasOff := hasBug(activeBugs, "off_by_one")
	loopEnd := fmt.Sprintf("%d", rounds)
	if hasOff {
		loopEnd = fmt.Sprintf("%d - 1", rounds)
	}
	reverseComment := "      current = current.reverse();"
	if hasMissing {
		reverseComment = "      // (no reversal step)"
	}

	return fmt.Sprintf(`function hashChain(data, rounds) {
  // data is a Uint8Array, rounds = %d
  let current = data;
  for (let i = 0; i < %s; i++) {
    current = sha256(current); // returns Uint8Array
%s
  }
  return hex(current); // returns hex string
}`, rounds, loopEnd, reverseComment)
}

func hashChainCorrectOutput(input templateInput) string {
	data, _ := base64.StdEncoding.DecodeString(input.Data)
	rounds := int(input.Params["rounds"].(int))
	current := data
	for i := 0; i < rounds; i++ {
		hashHex := xagentauth.SHA256Hex(current)
		hashBytes, _ := hex.DecodeString(hashHex)
		// Reverse
		for left, right := 0, len(hashBytes)-1; left < right; left, right = left+1, right-1 {
			hashBytes[left], hashBytes[right] = hashBytes[right], hashBytes[left]
		}
		current = hashBytes
	}
	return hex.EncodeToString(current)
}

// ---------------------------------------------------------------------------
// All templates
// ---------------------------------------------------------------------------

var allCodeTemplates = []codeTemplate{
	{
		name:          "byte_transform",
		availableBugs: []bugDef{bugOffByOne, bugWrongShift},
		generateInput: byteTransformGenInput,
		buggyCode:     byteTransformBuggyCode,
		correctOutput: byteTransformCorrectOutput,
	},
	{
		name:          "array_processing",
		availableBugs: []bugDef{bugWrongOp, bugWrongInit, bugWrongPad},
		generateInput: arrayProcessingGenInput,
		buggyCode:     arrayProcessingBuggyCode,
		correctOutput: arrayProcessingCorrectOutput,
	},
	{
		name:          "hash_chain",
		availableBugs: []bugDef{bugMissingStep, bugOffByOne},
		generateInput: hashChainGenInput,
		buggyCode:     hashChainBuggyCode,
		correctOutput: hashChainCorrectOutput,
	},
}

// ---------------------------------------------------------------------------
// Difficulty configuration
// ---------------------------------------------------------------------------

type codeExecDiffConfig struct {
	bugCount      int
	templateNames []string
	edgeCaseHint  bool
}

var codeExecDiffConfigs = map[xagentauth.Difficulty]codeExecDiffConfig{
	xagentauth.DifficultyEasy:        {bugCount: 1, templateNames: []string{"byte_transform", "array_processing"}, edgeCaseHint: false},
	xagentauth.DifficultyMedium:      {bugCount: 1, templateNames: []string{"byte_transform", "array_processing", "hash_chain"}, edgeCaseHint: false},
	xagentauth.DifficultyHard:        {bugCount: 2, templateNames: []string{"byte_transform", "array_processing", "hash_chain"}, edgeCaseHint: false},
	xagentauth.DifficultyAdversarial: {bugCount: 3, templateNames: []string{"byte_transform", "array_processing", "hash_chain"}, edgeCaseHint: true},
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

func hasBug(bugs []bugDef, name string) bool {
	for _, b := range bugs {
		if b.Name == name {
			return true
		}
	}
	return false
}

func selectBugs(tmpl codeTemplate, count int) []bugDef {
	available := make([]bugDef, len(tmpl.availableBugs))
	copy(available, tmpl.availableBugs)
	selected := make([]bugDef, 0, count)

	toSelect := count
	if toSelect > len(available) {
		toSelect = len(available)
	}
	for i := 0; i < toSelect; i++ {
		idx := rand.Intn(len(available))
		selected = append(selected, available[idx])
		available = append(available[:idx], available[idx+1:]...)
	}
	return selected
}

// ---------------------------------------------------------------------------
// CodeExecutionDriver
// ---------------------------------------------------------------------------

// CodeExecutionDriver implements the code-execution challenge: identify bugs
// in code, mentally fix and execute, and return the correct output.
type CodeExecutionDriver struct{}

func (d *CodeExecutionDriver) Name() string { return "code-execution" }

func (d *CodeExecutionDriver) Dimensions() []xagentauth.ChallengeDimension {
	return []xagentauth.ChallengeDimension{xagentauth.DimensionReasoning, xagentauth.DimensionExecution}
}

func (d *CodeExecutionDriver) EstimatedHumanTimeMs() int64 { return 120000 }
func (d *CodeExecutionDriver) EstimatedAITimeMs() int64    { return 2000 }

// Generate creates a code-execution challenge.
func (d *CodeExecutionDriver) Generate(difficulty xagentauth.Difficulty) (*xagentauth.ChallengePayload, string, error) {
	config := codeExecDiffConfigs[difficulty]

	// Pick a template
	var eligible []codeTemplate
	for _, tmpl := range allCodeTemplates {
		for _, name := range config.templateNames {
			if tmpl.name == name {
				eligible = append(eligible, tmpl)
				break
			}
		}
	}
	tmpl := pickRandom(eligible)

	// Generate input
	input := tmpl.generateInput()

	// Select bugs
	bugs := selectBugs(tmpl, config.bugCount)

	// Generate buggy code
	buggyCode := tmpl.buggyCode(input, bugs)

	// Compute correct output
	correctOutput := tmpl.correctOutput(input)

	// Decode input for display
	inputBytes, _ := base64.StdEncoding.DecodeString(input.Data)
	inputHex := hex.EncodeToString(inputBytes)

	// Build instructions
	paramLines := ""
	if rounds, ok := input.Params["rounds"]; ok {
		paramLines = fmt.Sprintf("Rounds: %v\n", rounds)
	}

	edgeCaseNote := ""
	if config.edgeCaseHint {
		edgeCaseNote = "\n\nNote: Pay close attention to boundary conditions, operator precedence, and off-by-one errors."
	}

	instructions := fmt.Sprintf(`The following JavaScript function contains bug(s). Your task is to:
1. Identify and fix all bugs in the code
2. Mentally execute the fixed code with the provided input
3. Return the correct output

## Code
`+"```javascript\n%s\n```"+`

## Input
Data (hex): %s
%s
## Notes
- sha256hex() / sha256() compute SHA-256 and return hex string / Uint8Array respectively
- hex() converts a Uint8Array to a hex string
- All arithmetic on bytes should stay within 0-255 range%s

Return the exact output of the fixed function.`, buggyCode, inputHex, paramLines, edgeCaseNote)

	// Answer hash = SHA256 of the correct answer string
	answerHash := xagentauth.SHA256Hex([]byte(correctOutput))

	// Build context
	bugsJSON := make([]map[string]string, len(bugs))
	for i, b := range bugs {
		bugsJSON[i] = map[string]string{"name": b.Name, "description": b.Description}
	}
	contextMap := map[string]interface{}{
		"templateName":  tmpl.name,
		"bugs":          bugsJSON,
		"correctOutput": correctOutput,
		"inputParams":   input.Params,
	}
	contextJSON, _ := json.Marshal(contextMap)

	payload := &xagentauth.ChallengePayload{
		Type:         "code-execution",
		Instructions: instructions,
		Data:         input.Data,
		Steps:        len(bugs),
		Context:      contextJSON,
	}

	return payload, answerHash, nil
}

// Verify checks whether the submitted answer matches the answer hash.
func (d *CodeExecutionDriver) Verify(answerHash string, submitted string) (bool, error) {
	submittedHash := xagentauth.SHA256Hex([]byte(submitted))
	return xagentauth.TimingSafeEqual(answerHash, submittedHash), nil
}
