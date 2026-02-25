package pomi

import (
	"fmt"
	"math"
	"regexp"
	"strconv"
	"strings"

	xagentauth "github.com/dyshay/agentauth/sdks/go"
)

// CanaryExtractor evaluates canary responses and produces evidence.
type CanaryExtractor struct{}

// NewCanaryExtractor creates a new CanaryExtractor.
func NewCanaryExtractor() *CanaryExtractor {
	return &CanaryExtractor{}
}

// Extract evaluates all injected canaries against the provided responses.
func (e *CanaryExtractor) Extract(injectedCanaries []xagentauth.Canary, canaryResponses map[string]string) []xagentauth.CanaryEvidence {
	if canaryResponses == nil {
		return nil
	}

	var evidence []xagentauth.CanaryEvidence
	for _, canary := range injectedCanaries {
		response, ok := canaryResponses[canary.ID]
		if !ok {
			continue
		}
		result := e.evaluate(canary, response)
		evidence = append(evidence, result)
	}
	return evidence
}

func (e *CanaryExtractor) evaluate(canary xagentauth.Canary, observed string) xagentauth.CanaryEvidence {
	switch canary.Analysis.Type {
	case "exact_match":
		return e.evaluateExactMatch(canary, observed)
	case "pattern":
		return e.evaluatePattern(canary, observed)
	case "statistical":
		return e.evaluateStatistical(canary, observed)
	default:
		return xagentauth.CanaryEvidence{
			CanaryID: canary.ID,
			Observed: observed,
			Match:    false,
		}
	}
}

func (e *CanaryExtractor) evaluateExactMatch(canary xagentauth.Canary, observed string) xagentauth.CanaryEvidence {
	bestMatch := ""
	match := false

	for _, expected := range canary.Analysis.Expected {
		if strings.EqualFold(strings.TrimSpace(observed), strings.TrimSpace(expected)) {
			bestMatch = expected
			match = true
			break
		}
	}

	if !match {
		// Use the first expected value as reference
		for _, v := range canary.Analysis.Expected {
			bestMatch = v
			break
		}
	}

	confidence := canary.ConfidenceWeight * 0.3
	if match {
		confidence = canary.ConfidenceWeight
	}

	return xagentauth.CanaryEvidence{
		CanaryID:               canary.ID,
		Observed:               observed,
		Expected:               bestMatch,
		Match:                  match,
		ConfidenceContribution: confidence,
	}
}

func (e *CanaryExtractor) evaluatePattern(canary xagentauth.Canary, observed string) xagentauth.CanaryEvidence {
	bestPattern := ""
	match := false

	for _, pattern := range canary.Analysis.Patterns {
		re, err := regexp.Compile("(?i)" + pattern)
		if err != nil {
			continue
		}
		if re.MatchString(observed) {
			bestPattern = pattern
			match = true
			break
		}
	}

	if !match {
		for _, v := range canary.Analysis.Patterns {
			bestPattern = v
			break
		}
	}

	confidence := canary.ConfidenceWeight * 0.2
	if match {
		confidence = canary.ConfidenceWeight
	}

	return xagentauth.CanaryEvidence{
		CanaryID:               canary.ID,
		Observed:               observed,
		Expected:               bestPattern,
		Match:                  match,
		ConfidenceContribution: confidence,
	}
}

func (e *CanaryExtractor) evaluateStatistical(canary xagentauth.Canary, observed string) xagentauth.CanaryEvidence {
	// Extract the first number from the response
	re := regexp.MustCompile(`-?\d+\.?\d*`)
	numMatch := re.FindString(observed)
	numValue := math.NaN()
	if numMatch != "" {
		if v, err := strconv.ParseFloat(numMatch, 64); err == nil {
			numValue = v
		}
	}

	bestDist := ""
	match := false

	if !math.IsNaN(numValue) {
		for family, dist := range canary.Analysis.Distributions {
			// Within 2 standard deviations
			if math.Abs(numValue-dist.Mean) <= 2*dist.StdDev {
				bestDist = fmt.Sprintf("%s: mean=%g, stddev=%g", family, dist.Mean, dist.StdDev)
				match = true
				break
			}
		}
	}

	if !match {
		for family, dist := range canary.Analysis.Distributions {
			bestDist = fmt.Sprintf("%s: mean=%g, stddev=%g", family, dist.Mean, dist.StdDev)
			break
		}
	}

	confidence := canary.ConfidenceWeight * 0.1
	if match {
		confidence = canary.ConfidenceWeight * 0.7
	}

	return xagentauth.CanaryEvidence{
		CanaryID:               canary.ID,
		Observed:               observed,
		Expected:               bestDist,
		Match:                  match,
		ConfidenceContribution: confidence,
	}
}
