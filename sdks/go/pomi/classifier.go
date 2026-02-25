package pomi

import (
	"math"
	"regexp"
	"sort"
	"strconv"
	"strings"

	xagentauth "github.com/dyshay/agentauth/sdks/go"
)

// ClassifierOptions configures the model classifier.
type ClassifierOptions struct {
	ConfidenceThreshold float64
}

// ModelClassifier performs Bayesian inference to identify the model family
// based on canary responses.
type ModelClassifier struct {
	modelFamilies       []string
	confidenceThreshold float64
	extractor           *CanaryExtractor
}

// NewModelClassifier creates a new ModelClassifier.
func NewModelClassifier(modelFamilies []string, options *ClassifierOptions) *ModelClassifier {
	threshold := 0.5
	if options != nil && options.ConfidenceThreshold > 0 {
		threshold = options.ConfidenceThreshold
	}
	return &ModelClassifier{
		modelFamilies:       modelFamilies,
		confidenceThreshold: threshold,
		extractor:           NewCanaryExtractor(),
	}
}

// Classify performs Bayesian classification on the canary responses.
func (mc *ModelClassifier) Classify(
	canaries []xagentauth.Canary,
	canaryResponses map[string]string,
) xagentauth.ModelIdentification {
	if canaryResponses == nil || len(canaries) == 0 {
		return xagentauth.ModelIdentification{
			Family: "unknown", Confidence: 0, Evidence: nil, Alternatives: nil,
		}
	}

	evidence := mc.extractor.Extract(canaries, canaryResponses)
	if len(evidence) == 0 {
		return xagentauth.ModelIdentification{
			Family: "unknown", Confidence: 0, Evidence: nil, Alternatives: nil,
		}
	}

	// Initialize uniform prior
	posteriors := make(map[string]float64, len(mc.modelFamilies))
	for _, family := range mc.modelFamilies {
		posteriors[family] = 1.0 / float64(len(mc.modelFamilies))
	}

	// Bayesian update for each canary with a response
	for _, canary := range canaries {
		response, ok := canaryResponses[canary.ID]
		if !ok {
			continue
		}

		for _, family := range mc.modelFamilies {
			prior := posteriors[family]
			likelihood := mc.computeLikelihood(canary, response, family)
			posteriors[family] = prior * likelihood
		}

		// Normalize after each update to prevent underflow
		mc.normalize(posteriors)
	}

	// Find the best hypothesis
	bestFamily := "unknown"
	bestConfidence := 0.0

	for family, posterior := range posteriors {
		if posterior > bestConfidence {
			bestConfidence = posterior
			bestFamily = family
		}
	}

	// Build alternatives (sorted descending, excluding best)
	var alternatives []xagentauth.ModelAlternative
	for family, posterior := range posteriors {
		if family != bestFamily {
			alternatives = append(alternatives, xagentauth.ModelAlternative{
				Family:     family,
				Confidence: math.Round(posterior*1000) / 1000,
			})
		}
	}
	sort.Slice(alternatives, func(i, j int) bool {
		return alternatives[i].Confidence > alternatives[j].Confidence
	})

	// Apply confidence threshold
	if bestConfidence < mc.confidenceThreshold {
		return xagentauth.ModelIdentification{
			Family:     "unknown",
			Confidence: math.Round(bestConfidence*1000) / 1000,
			Evidence:   evidence,
			Alternatives: append([]xagentauth.ModelAlternative{
				{Family: bestFamily, Confidence: math.Round(bestConfidence*1000) / 1000},
			}, alternatives...),
		}
	}

	return xagentauth.ModelIdentification{
		Family:       bestFamily,
		Confidence:   math.Round(bestConfidence*1000) / 1000,
		Evidence:     evidence,
		Alternatives: alternatives,
	}
}

func (mc *ModelClassifier) computeLikelihood(canary xagentauth.Canary, response string, family string) float64 {
	weight := canary.ConfidenceWeight

	switch canary.Analysis.Type {
	case "exact_match":
		expected, ok := canary.Analysis.Expected[family]
		if !ok {
			return 0.5
		}
		isMatch := strings.EqualFold(strings.TrimSpace(response), strings.TrimSpace(expected))
		if isMatch {
			return 0.5 + 0.5*weight
		}
		return 0.5 - 0.4*weight

	case "pattern":
		pattern, ok := canary.Analysis.Patterns[family]
		if !ok {
			return 0.5
		}
		re, err := regexp.Compile("(?i)" + pattern)
		if err != nil {
			return 0.5
		}
		if re.MatchString(response) {
			return 0.5 + 0.45*weight
		}
		return 0.5 - 0.35*weight

	case "statistical":
		dist, ok := canary.Analysis.Distributions[family]
		if !ok {
			return 0.5
		}
		re := regexp.MustCompile(`-?\d+\.?\d*`)
		numMatch := re.FindString(response)
		if numMatch == "" {
			return 0.5
		}
		value, err := strconv.ParseFloat(numMatch, 64)
		if err != nil {
			return 0.5
		}
		pdf := gaussianPdf(value, dist.Mean, dist.StdDev)
		maxPdf := gaussianPdf(dist.Mean, dist.Mean, dist.StdDev)
		normalizedPdf := pdf / maxPdf
		return 0.1 + 0.8*normalizedPdf*weight
	}
	return 0.5
}

func gaussianPdf(x, mean, stddev float64) float64 {
	z := (x - mean) / stddev
	return math.Exp(-0.5*z*z) / (stddev * math.Sqrt(2*math.Pi))
}

func (mc *ModelClassifier) normalize(posteriors map[string]float64) {
	sum := 0.0
	for _, v := range posteriors {
		sum += v
	}
	if sum == 0 {
		for k := range posteriors {
			posteriors[k] = 1.0 / float64(len(posteriors))
		}
		return
	}
	for k, v := range posteriors {
		posteriors[k] = v / sum
	}
}
