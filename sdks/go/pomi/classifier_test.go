package pomi

import (
	"testing"
)

var defaultFamilies = []string{"gpt-4-class", "claude-3-class", "gemini-class", "llama-class", "mistral-class"}

func TestClassifier_NoResponses(t *testing.T) {
	mc := NewModelClassifier(defaultFamilies, nil)
	result := mc.Classify(DefaultCanaries, nil)
	if result.Family != "unknown" {
		t.Errorf("Expected unknown family, got %s", result.Family)
	}
	if result.Confidence != 0 {
		t.Errorf("Expected 0 confidence, got %f", result.Confidence)
	}
}

func TestClassifier_NoCanaries(t *testing.T) {
	mc := NewModelClassifier(defaultFamilies, nil)
	result := mc.Classify(nil, map[string]string{"test": "value"})
	if result.Family != "unknown" {
		t.Errorf("Expected unknown family, got %s", result.Family)
	}
}

func TestClassifier_WithExactMatchEvidence(t *testing.T) {
	mc := NewModelClassifier(defaultFamilies, nil)

	// Provide responses matching GPT-4's expected values
	responses := map[string]string{
		"unicode-rtl":    "C",
		"math-precision": "0.3",
		"emoji-choice":   "\U0001F60A",
	}

	result := mc.Classify(DefaultCanaries, responses)
	if result.Confidence == 0 {
		t.Error("Expected non-zero confidence")
	}
	if len(result.Evidence) == 0 {
		t.Error("Expected evidence")
	}
	// Should identify some model family (not necessarily GPT-4 because
	// some values are shared)
	if result.Family == "" {
		t.Error("Expected non-empty family")
	}
}

func TestClassifier_LowConfidenceThreshold(t *testing.T) {
	mc := NewModelClassifier(defaultFamilies, &ClassifierOptions{ConfidenceThreshold: 0.99})

	// With only one canary response, confidence should be low
	responses := map[string]string{
		"analogy-completion": "puppy",
	}

	result := mc.Classify(DefaultCanaries, responses)
	// All models expect "puppy" so it should not distinguish
	// Confidence should be low because all families match equally
	if result.Family == "unknown" {
		// This is expected for undistinguished canaries
		if len(result.Alternatives) == 0 {
			t.Error("Expected alternatives when family is unknown")
		}
	}
}

func TestClassifier_GaussianPdf(t *testing.T) {
	// Test the Gaussian PDF function
	pdf := gaussianPdf(0, 0, 1)
	expected := 0.3989 // 1/sqrt(2*pi)
	if pdf < expected-0.001 || pdf > expected+0.001 {
		t.Errorf("Expected PDF ~%f, got %f", expected, pdf)
	}

	// PDF at mean should be maximum
	pdfAtMean := gaussianPdf(5, 5, 2)
	pdfAway := gaussianPdf(8, 5, 2)
	if pdfAway >= pdfAtMean {
		t.Error("Expected PDF at mean to be greater than away from mean")
	}
}
