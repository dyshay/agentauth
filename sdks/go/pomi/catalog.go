package pomi

import (
	"math/rand"

	xagentauth "github.com/dyshay/agentauth/sdks/go"
)

// CatalogVersion is the version of the canary catalog.
const CatalogVersion = "1.1.0"

// DefaultCanaries contains the 17 default canary definitions for model fingerprinting.
var DefaultCanaries = []xagentauth.Canary{
	{
		ID:              "unicode-rtl",
		Prompt:          "What is the 3rd character (0-indexed) of the string '\\u202E\\u0041\\u0042\\u0043'? Reply with just the character.",
		InjectionMethod: xagentauth.InjectionInline,
		Analysis: xagentauth.CanaryAnalysis{
			Type:     "exact_match",
			Expected: map[string]string{"gpt-4-class": "C", "claude-3-class": "C", "gemini-class": "B", "llama-class": "B", "mistral-class": "C"},
		},
		ConfidenceWeight: 0.3,
	},
	{
		ID:              "random-numbers-5",
		Prompt:          "List 5 random integers between 1 and 100, comma-separated, no spaces.",
		InjectionMethod: xagentauth.InjectionSuffix,
		Analysis: xagentauth.CanaryAnalysis{
			Type: "statistical",
			Distributions: map[string]xagentauth.Distribution{
				"gpt-4-class":    {Mean: 52, StdDev: 18},
				"claude-3-class": {Mean: 47, StdDev: 20},
				"gemini-class":   {Mean: 50, StdDev: 22},
				"llama-class":    {Mean: 55, StdDev: 25},
				"mistral-class":  {Mean: 48, StdDev: 21},
			},
		},
		ConfidenceWeight: 0.4,
	},
	{
		ID:              "random-numbers-10",
		Prompt:          "List 10 random integers between 1 and 50, comma-separated, no spaces.",
		InjectionMethod: xagentauth.InjectionSuffix,
		Analysis: xagentauth.CanaryAnalysis{
			Type: "statistical",
			Distributions: map[string]xagentauth.Distribution{
				"gpt-4-class":    {Mean: 26, StdDev: 10},
				"claude-3-class": {Mean: 24, StdDev: 12},
				"gemini-class":   {Mean: 25, StdDev: 11},
				"llama-class":    {Mean: 28, StdDev: 14},
				"mistral-class":  {Mean: 25, StdDev: 13},
			},
		},
		ConfidenceWeight: 0.35,
	},
	{
		ID:              "reasoning-style",
		Prompt:          "Solve step by step in one sentence: if all A are B, and some B are C, can we say some A are C?",
		InjectionMethod: xagentauth.InjectionInline,
		Analysis: xagentauth.CanaryAnalysis{
			Type: "pattern",
			Patterns: map[string]string{
				"gpt-4-class":    "therefore|thus|hence|consequently",
				"claude-3-class": "let me|let's|I need to|we need to|consider",
				"gemini-class":   "so,|this means|we can see",
				"llama-class":    "the answer is|yes|no,",
				"mistral-class":  "indeed|in fact|precisely",
			},
		},
		ConfidenceWeight: 0.25,
	},
	{
		ID:              "math-precision",
		Prompt:          "What is 0.1 + 0.2? Reply with just the number.",
		InjectionMethod: xagentauth.InjectionInline,
		Analysis: xagentauth.CanaryAnalysis{
			Type: "exact_match",
			Expected: map[string]string{
				"gpt-4-class":    "0.3",
				"claude-3-class": "0.30000000000000004",
				"gemini-class":   "0.3",
				"llama-class":    "0.3",
				"mistral-class":  "0.3",
			},
		},
		ConfidenceWeight: 0.2,
	},
	{
		ID:              "list-format",
		Prompt:          "List 3 primary colors, one per line.",
		InjectionMethod: xagentauth.InjectionSuffix,
		Analysis: xagentauth.CanaryAnalysis{
			Type: "pattern",
			Patterns: map[string]string{
				"gpt-4-class":    "^1\\.|^- |^Red",
				"claude-3-class": "^- |^\\* |^Red",
				"gemini-class":   "^\\* |^1\\.",
				"llama-class":    "^1\\.|^Red",
				"mistral-class":  "^- |^1\\.",
			},
		},
		ConfidenceWeight: 0.15,
	},
	{
		ID:              "creative-word",
		Prompt:          "Say one random English word. Just the word, nothing else.",
		InjectionMethod: xagentauth.InjectionSuffix,
		Analysis: xagentauth.CanaryAnalysis{
			Type: "statistical",
			Distributions: map[string]xagentauth.Distribution{
				"gpt-4-class":    {Mean: 6, StdDev: 2},
				"claude-3-class": {Mean: 8, StdDev: 3},
				"gemini-class":   {Mean: 5, StdDev: 2},
				"llama-class":    {Mean: 5, StdDev: 3},
				"mistral-class":  {Mean: 7, StdDev: 2},
			},
		},
		ConfidenceWeight: 0.1,
	},
	{
		ID:              "emoji-choice",
		Prompt:          "Pick one emoji that represents happiness. Just the emoji.",
		InjectionMethod: xagentauth.InjectionInline,
		Analysis: xagentauth.CanaryAnalysis{
			Type: "exact_match",
			Expected: map[string]string{
				"gpt-4-class":    "\U0001F60A",
				"claude-3-class": "\U0001F604",
				"gemini-class":   "\U0001F603",
				"llama-class":    "\U0001F600",
				"mistral-class":  "\U0001F642",
			},
		},
		ConfidenceWeight: 0.2,
	},
	{
		ID:              "code-style",
		Prompt:          "Write a one-line Python hello world. Just the code, no explanation.",
		InjectionMethod: xagentauth.InjectionEmbedded,
		Analysis: xagentauth.CanaryAnalysis{
			Type: "pattern",
			Patterns: map[string]string{
				"gpt-4-class":    "print\\(\"Hello,? [Ww]orld!?\"\\)",
				"claude-3-class": "print\\(\"Hello,? [Ww]orld!?\"\\)",
				"gemini-class":   "print\\(\"Hello,? [Ww]orld!?\"\\)",
				"llama-class":    "print\\(\"Hello [Ww]orld\"\\)",
				"mistral-class":  "print\\(\"Hello,? [Ww]orld!?\"\\)",
			},
		},
		ConfidenceWeight: 0.1,
	},
	{
		ID:              "temperature-words",
		Prompt:          "Describe 25 degrees Celsius in exactly one word.",
		InjectionMethod: xagentauth.InjectionSuffix,
		Analysis: xagentauth.CanaryAnalysis{
			Type: "exact_match",
			Expected: map[string]string{
				"gpt-4-class":    "Warm",
				"claude-3-class": "Pleasant",
				"gemini-class":   "Comfortable",
				"llama-class":    "Warm",
				"mistral-class":  "Mild",
			},
		},
		ConfidenceWeight: 0.25,
	},
	{
		ID:              "number-between",
		Prompt:          "Pick a number between 1 and 10. Just the number.",
		InjectionMethod: xagentauth.InjectionInline,
		Analysis: xagentauth.CanaryAnalysis{
			Type: "statistical",
			Distributions: map[string]xagentauth.Distribution{
				"gpt-4-class":    {Mean: 7, StdDev: 1.5},
				"claude-3-class": {Mean: 4, StdDev: 2},
				"gemini-class":   {Mean: 7, StdDev: 2},
				"llama-class":    {Mean: 5, StdDev: 2.5},
				"mistral-class":  {Mean: 6, StdDev: 2},
			},
		},
		ConfidenceWeight: 0.3,
	},
	{
		ID:              "default-greeting",
		Prompt:          "Say hello to a user in one short sentence.",
		InjectionMethod: xagentauth.InjectionSuffix,
		Analysis: xagentauth.CanaryAnalysis{
			Type: "pattern",
			Patterns: map[string]string{
				"gpt-4-class":    "Hello!|Hi there|Hey",
				"claude-3-class": "Hello!|Hi there|Hey there",
				"gemini-class":   "Hello!|Hi!|Hey there",
				"llama-class":    "Hello|Hi!|Hey",
				"mistral-class":  "Hello!|Greetings|Hi",
			},
		},
		ConfidenceWeight: 0.15,
	},
	{
		ID:              "math-chain",
		Prompt:          "Solve step by step: (7+3)*2 - 4/2. Show your intermediate steps, then give the final answer.",
		InjectionMethod: xagentauth.InjectionInline,
		Analysis: xagentauth.CanaryAnalysis{
			Type: "pattern",
			Patterns: map[string]string{
				"gpt-4-class":    "7 \\+ 3 = 10|10 \\* 2 = 20|= 18",
				"claude-3-class": "7\\+3|10\\)|\\* 2|= 18",
				"gemini-class":   "\\(7\\+3\\)|= 10|20 - 2|= 18",
				"llama-class":    "10 \\* 2|20 - 2|18",
				"mistral-class":  "First|= 10|= 20|= 18",
			},
		},
		ConfidenceWeight: 0.3,
	},
	{
		ID:              "sorting-preference",
		Prompt:          "Sort these words alphabetically and list them: banana, cherry, apple, date. One per line.",
		InjectionMethod: xagentauth.InjectionSuffix,
		Analysis: xagentauth.CanaryAnalysis{
			Type: "pattern",
			Patterns: map[string]string{
				"gpt-4-class":    "^1\\.|^- [Aa]pple",
				"claude-3-class": "^- [Aa]pple|^\\* [Aa]pple|^[Aa]pple",
				"gemini-class":   "^\\* [Aa]pple|^1\\.",
				"llama-class":    "^1\\. [Aa]pple|^[Aa]pple",
				"mistral-class":  "^- [Aa]pple|^1\\.",
			},
		},
		ConfidenceWeight: 0.2,
	},
	{
		ID:              "json-formatting",
		Prompt:          "Output a JSON object with keys \"name\" (value \"Alice\") and \"age\" (value 30). Just the JSON, nothing else.",
		InjectionMethod: xagentauth.InjectionEmbedded,
		Analysis: xagentauth.CanaryAnalysis{
			Type: "pattern",
			Patterns: map[string]string{
				"gpt-4-class":    "\\{\\s*\"name\":\\s*\"Alice\",\\s*\"age\":\\s*30\\s*\\}",
				"claude-3-class": "\\{\\s*\n\\s*\"name\":\\s*\"Alice\"",
				"gemini-class":   "\\{\"name\":\"Alice\",\"age\":30\\}|\\{\\s*\"name\"",
				"llama-class":    "\\{\"name\": \"Alice\"|\\{\\s*\"name\"",
				"mistral-class":  "\\{\\s*\"name\":\\s*\"Alice\"",
			},
		},
		ConfidenceWeight: 0.2,
	},
	{
		ID:              "analogy-completion",
		Prompt:          "Complete this analogy with one word: cat is to kitten as dog is to ___",
		InjectionMethod: xagentauth.InjectionInline,
		Analysis: xagentauth.CanaryAnalysis{
			Type: "exact_match",
			Expected: map[string]string{
				"gpt-4-class":    "puppy",
				"claude-3-class": "puppy",
				"gemini-class":   "puppy",
				"llama-class":    "puppy",
				"mistral-class":  "puppy",
			},
		},
		ConfidenceWeight: 0.1,
	},
	{
		ID:              "confidence-expression",
		Prompt:          "On a scale of 0 to 100, how confident are you that 2+2=4? Reply with just the number.",
		InjectionMethod: xagentauth.InjectionSuffix,
		Analysis: xagentauth.CanaryAnalysis{
			Type: "statistical",
			Distributions: map[string]xagentauth.Distribution{
				"gpt-4-class":    {Mean: 100, StdDev: 1},
				"claude-3-class": {Mean: 99, StdDev: 3},
				"gemini-class":   {Mean: 100, StdDev: 1},
				"llama-class":    {Mean: 95, StdDev: 8},
				"mistral-class":  {Mean: 100, StdDev: 2},
			},
		},
		ConfidenceWeight: 0.15,
	},
}

// CatalogSelectOptions configures which canaries to select.
type CatalogSelectOptions struct {
	Method  *xagentauth.InjectionMethod
	Exclude []string
}

// CanaryCatalog manages the collection of canaries for selection.
type CanaryCatalog struct {
	canaries []xagentauth.Canary
	Version  string
}

// NewCanaryCatalog creates a new CanaryCatalog with the given canaries,
// or the default set if nil.
func NewCanaryCatalog(canaries []xagentauth.Canary) *CanaryCatalog {
	if canaries == nil {
		canaries = make([]xagentauth.Canary, len(DefaultCanaries))
		copy(canaries, DefaultCanaries)
	}
	return &CanaryCatalog{
		canaries: canaries,
		Version:  CatalogVersion,
	}
}

// List returns all canaries in the catalog.
func (c *CanaryCatalog) List() []xagentauth.Canary {
	result := make([]xagentauth.Canary, len(c.canaries))
	copy(result, c.canaries)
	return result
}

// Get returns a canary by ID, or nil if not found.
func (c *CanaryCatalog) Get(id string) *xagentauth.Canary {
	for i := range c.canaries {
		if c.canaries[i].ID == id {
			return &c.canaries[i]
		}
	}
	return nil
}

// Select returns count canaries from the catalog using Fisher-Yates shuffle.
func (c *CanaryCatalog) Select(count int, options *CatalogSelectOptions) []xagentauth.Canary {
	candidates := make([]xagentauth.Canary, len(c.canaries))
	copy(candidates, c.canaries)

	if options != nil {
		if options.Method != nil {
			var filtered []xagentauth.Canary
			for _, can := range candidates {
				if can.InjectionMethod == *options.Method {
					filtered = append(filtered, can)
				}
			}
			candidates = filtered
		}

		if len(options.Exclude) > 0 {
			excludeSet := make(map[string]bool, len(options.Exclude))
			for _, id := range options.Exclude {
				excludeSet[id] = true
			}
			var filtered []xagentauth.Canary
			for _, can := range candidates {
				if !excludeSet[can.ID] {
					filtered = append(filtered, can)
				}
			}
			candidates = filtered
		}
	}

	// Fisher-Yates shuffle
	for i := len(candidates) - 1; i > 0; i-- {
		j := rand.Intn(i + 1)
		candidates[i], candidates[j] = candidates[j], candidates[i]
	}

	if count > len(candidates) {
		count = len(candidates)
	}
	return candidates[:count]
}
