package challenges

import (
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

type acceptableAnswer struct {
	Answer string  `json:"answer"` // hex-encoded result
	Score  float64 `json:"score"`  // 0-1, where 1.0 = primary
}

type scoredAnswerHash struct {
	AnswerHash string  `json:"answerHash"`
	Score      float64 `json:"score"`
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

func xorBytesArr(data []byte, key int) []byte {
	result := make([]byte, len(data))
	for i := range data {
		result[i] = data[i] ^ byte(key&0xFF)
	}
	return result
}

func sortAscending(data []byte) []byte {
	result := make([]byte, len(data))
	copy(result, data)
	sort.Slice(result, func(i, j int) bool { return result[i] < result[j] })
	return result
}

func reverseBytes(data []byte) []byte {
	result := make([]byte, len(data))
	for i := range data {
		result[i] = data[len(data)-1-i]
	}
	return result
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

type ambiguousTemplate struct {
	name     string
	generate func(data []byte, difficulty xagentauth.Difficulty) (string, []acceptableAnswer)
}

func luckyNumberGenerate(data []byte, difficulty xagentauth.Difficulty) (string, []acceptableAnswer) {
	byteCount := len(data)

	// Primary interpretation: 7 is "the" lucky number
	isLucky7 := byteCount == 7
	var primaryResult []byte
	if isLucky7 {
		primaryResult = xorBytesArr(data, 7)
	} else {
		primaryResult = xorBytesArr(data, 13)
	}

	alternatives := []acceptableAnswer{
		{Answer: hex.EncodeToString(primaryResult), Score: 1.0},
	}

	altLuckyNumbers := []int{3, 8, 13}
	altScores := map[int]float64{3: 0.6, 8: 0.6, 13: 0.7}

	if difficulty != xagentauth.DifficultyEasy {
		for _, lucky := range altLuckyNumbers {
			isLucky := byteCount == lucky
			var altResult []byte
			if isLucky {
				altResult = xorBytesArr(data, 7)
			} else {
				altResult = xorBytesArr(data, 13)
			}
			altHex := hex.EncodeToString(altResult)
			if altHex != alternatives[0].Answer {
				alternatives = append(alternatives, acceptableAnswer{Answer: altHex, Score: altScores[lucky]})
			}
		}
	}

	phrasings := []string{
		fmt.Sprintf("You are given %d bytes of data (base64-encoded).\nIf the number of bytes is a lucky number, XOR each byte with 7.\nOtherwise, XOR each byte with 13.\nReturn the hex-encoded result.", byteCount),
		fmt.Sprintf("The data below contains %d bytes.\nWhen the byte count is lucky, apply XOR 7 to every byte.\nWhen unlucky, apply XOR 13 instead.\nProvide your answer as a hex string.", byteCount),
	}

	return pickRandom(phrasings), alternatives
}

func famousConstantGenerate(data []byte, _ xagentauth.Difficulty) (string, []acceptableAnswer) {
	piResult := xorBytesArr(data, 31)
	eResult := xorBytesArr(data, 27)
	phiResult := xorBytesArr(data, 16)

	alternatives := []acceptableAnswer{
		{Answer: hex.EncodeToString(piResult), Score: 1.0},
		{Answer: hex.EncodeToString(eResult), Score: 0.8},
		{Answer: hex.EncodeToString(phiResult), Score: 0.6},
	}

	phrasings := []string{
		"XOR each byte of the provided data with the most famous mathematical constant's first two digits as an integer.\nReturn the hex-encoded result.",
		"Take the universally recognized mathematical constant, extract its first two digits as a whole number, and XOR every byte of the data with that number.\nProvide the hex-encoded output.",
	}

	return pickRandom(phrasings), alternatives
}

func bigSmallGenerate(data []byte, _ xagentauth.Difficulty) (string, []acceptableAnswer) {
	firstByte := data[0]

	var primary127 []byte
	if firstByte > 127 {
		primary127 = reverseBytes(data)
	} else {
		primary127 = sortAscending(data)
	}

	var alt100 []byte
	if firstByte > 100 {
		alt100 = reverseBytes(data)
	} else {
		alt100 = sortAscending(data)
	}

	var alt200 []byte
	if firstByte > 200 {
		alt200 = reverseBytes(data)
	} else {
		alt200 = sortAscending(data)
	}

	alternatives := []acceptableAnswer{
		{Answer: hex.EncodeToString(primary127), Score: 1.0},
	}

	alt100Hex := hex.EncodeToString(alt100)
	alt200Hex := hex.EncodeToString(alt200)

	if alt100Hex != alternatives[0].Answer {
		alternatives = append(alternatives, acceptableAnswer{Answer: alt100Hex, Score: 0.8})
	}
	if alt200Hex != alternatives[0].Answer && alt200Hex != alt100Hex {
		alternatives = append(alternatives, acceptableAnswer{Answer: alt200Hex, Score: 0.7})
	}

	phrasings := []string{
		"If the first byte of the data is big, reverse the entire byte array.\nOtherwise, sort all bytes in ascending order.\nReturn the hex-encoded result.",
		"Examine the first byte. If it is a big value, flip the array end-to-end.\nIf it is small, arrange bytes from lowest to highest.\nProvide the hex-encoded output.",
	}

	return pickRandom(phrasings), alternatives
}

var allAmbiguousTemplates = []ambiguousTemplate{
	{name: "lucky-number", generate: luckyNumberGenerate},
	{name: "famous-constant", generate: famousConstantGenerate},
	{name: "big-small", generate: bigSmallGenerate},
}

// ---------------------------------------------------------------------------
// Difficulty config
// ---------------------------------------------------------------------------

type ambiguousDiffConfig struct {
	dataSize      int
	templateCount int
}

var ambiguousDiffConfigs = map[xagentauth.Difficulty]ambiguousDiffConfig{
	xagentauth.DifficultyEasy:        {dataSize: 8, templateCount: 1},
	xagentauth.DifficultyMedium:      {dataSize: 16, templateCount: 1},
	xagentauth.DifficultyHard:        {dataSize: 32, templateCount: 2},
	xagentauth.DifficultyAdversarial: {dataSize: 64, templateCount: 3},
}

// ---------------------------------------------------------------------------
// AmbiguousLogicDriver
// ---------------------------------------------------------------------------

// AmbiguousLogicDriver implements challenges where instructions are
// deliberately ambiguous, testing how the agent handles uncertainty.
type AmbiguousLogicDriver struct{}

func (d *AmbiguousLogicDriver) Name() string { return "ambiguous-logic" }

func (d *AmbiguousLogicDriver) Dimensions() []xagentauth.ChallengeDimension {
	return []xagentauth.ChallengeDimension{xagentauth.DimensionReasoning, xagentauth.DimensionAmbiguity}
}

func (d *AmbiguousLogicDriver) EstimatedHumanTimeMs() int64 { return 45000 }
func (d *AmbiguousLogicDriver) EstimatedAITimeMs() int64    { return 1000 }

// Generate creates an ambiguous-logic challenge.
func (d *AmbiguousLogicDriver) Generate(difficulty xagentauth.Difficulty) (*xagentauth.ChallengePayload, string, error) {
	config := ambiguousDiffConfigs[difficulty]
	data := xagentauth.RandomBytes(config.dataSize)

	selectedTemplates := d.selectTemplates(config.templateCount)

	if len(selectedTemplates) == 1 {
		return d.generateSingle(selectedTemplates[0], data, difficulty)
	}
	return d.generateChained(selectedTemplates, data, difficulty)
}

// Verify checks if the submitted answer matches any acceptable answer.
// For ambiguous challenges, the answer hash corresponds to the primary answer,
// but we also accept alternatives (checking the context for scored answers).
func (d *AmbiguousLogicDriver) Verify(answerHash string, submitted string) (bool, error) {
	submittedHash := xagentauth.SHA256Hex([]byte(submitted))
	return xagentauth.TimingSafeEqual(answerHash, submittedHash), nil
}

func (d *AmbiguousLogicDriver) selectTemplates(count int) []ambiguousTemplate {
	// Shuffle
	shuffled := make([]ambiguousTemplate, len(allAmbiguousTemplates))
	copy(shuffled, allAmbiguousTemplates)
	rand.Shuffle(len(shuffled), func(i, j int) {
		shuffled[i], shuffled[j] = shuffled[j], shuffled[i]
	})
	if count > len(shuffled) {
		count = len(shuffled)
	}
	return shuffled[:count]
}

func (d *AmbiguousLogicDriver) generateSingle(
	tmpl ambiguousTemplate,
	data []byte,
	difficulty xagentauth.Difficulty,
) (*xagentauth.ChallengePayload, string, error) {
	instructions, acceptableAnswers := tmpl.generate(data, difficulty)

	scoredAnswers := d.hashAnswers(acceptableAnswers)
	answerHash := xagentauth.SHA256Hex([]byte(acceptableAnswers[0].Answer))

	contextMap := map[string]interface{}{
		"templateName":  tmpl.name,
		"primaryAnswer": acceptableAnswers[0].Answer,
		"scoredAnswers": scoredAnswers,
	}
	contextJSON, _ := json.Marshal(contextMap)

	payload := &xagentauth.ChallengePayload{
		Type:         "ambiguous-logic",
		Instructions: instructions,
		Data:         base64.StdEncoding.EncodeToString(data),
		Steps:        1,
		Context:      contextJSON,
	}

	return payload, answerHash, nil
}

func (d *AmbiguousLogicDriver) generateChained(
	templates []ambiguousTemplate,
	data []byte,
	difficulty xagentauth.Difficulty,
) (*xagentauth.ChallengePayload, string, error) {
	currentData := data
	var instructionParts []string
	var allAcceptable []acceptableAnswer

	for i, tmpl := range templates {
		instructions, answers := tmpl.generate(currentData, difficulty)
		instructionParts = append(instructionParts, fmt.Sprintf("--- Part %d ---\n%s", i+1, instructions))

		if i == 0 {
			allAcceptable = answers
		} else {
			var chained []acceptableAnswer
			for _, prev := range allAcceptable {
				prevData, _ := hex.DecodeString(prev.Answer)
				_, chainAnswers := tmpl.generate(prevData, difficulty)
				for _, ans := range chainAnswers {
					chained = append(chained, acceptableAnswer{
						Answer: ans.Answer,
						Score:  prev.Score * ans.Score,
					})
				}
			}
			allAcceptable = chained
		}

		// Use the primary answer as input for the next template
		currentData, _ = hex.DecodeString(allAcceptable[0].Answer)
	}

	// Deduplicate: keep highest-scoring version
	uniqueMap := make(map[string]float64)
	for _, ans := range allAcceptable {
		if existing, ok := uniqueMap[ans.Answer]; !ok || ans.Score > existing {
			uniqueMap[ans.Answer] = ans.Score
		}
	}

	var deduplicated []acceptableAnswer
	for answer, score := range uniqueMap {
		deduplicated = append(deduplicated, acceptableAnswer{Answer: answer, Score: score})
	}
	sort.Slice(deduplicated, func(i, j int) bool { return deduplicated[i].Score > deduplicated[j].Score })

	scoredAnswers := d.hashAnswers(deduplicated)
	answerHash := xagentauth.SHA256Hex([]byte(deduplicated[0].Answer))

	fullInstructions := "This is a multi-part ambiguous logic challenge.\nApply each part's transformation in order, using the output of the previous part as input for the next.\n\n"
	for i, part := range instructionParts {
		if i > 0 {
			fullInstructions += "\n\n"
		}
		fullInstructions += part
	}

	templateNames := make([]string, len(templates))
	for i, t := range templates {
		templateNames[i] = t.name
	}
	contextMap := map[string]interface{}{
		"templateNames": templateNames,
		"primaryAnswer": deduplicated[0].Answer,
		"scoredAnswers": scoredAnswers,
	}
	contextJSON, _ := json.Marshal(contextMap)

	payload := &xagentauth.ChallengePayload{
		Type:         "ambiguous-logic",
		Instructions: fullInstructions,
		Data:         base64.StdEncoding.EncodeToString(data),
		Steps:        len(templates),
		Context:      contextJSON,
	}

	return payload, answerHash, nil
}

func (d *AmbiguousLogicDriver) hashAnswers(answers []acceptableAnswer) []scoredAnswerHash {
	results := make([]scoredAnswerHash, len(answers))
	for i, ans := range answers {
		hash := xagentauth.SHA256Hex([]byte(ans.Answer))
		results[i] = scoredAnswerHash{AnswerHash: hash, Score: ans.Score}
	}
	return results
}
