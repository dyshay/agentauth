package pomi

import (
	"testing"

	xagentauth "github.com/dyshay/agentauth/sdks/go"
)

func TestExtractor_ExactMatch(t *testing.T) {
	extractor := NewCanaryExtractor()

	canary := xagentauth.Canary{
		ID:              "test-exact",
		InjectionMethod: xagentauth.InjectionInline,
		Analysis: xagentauth.CanaryAnalysis{
			Type:     "exact_match",
			Expected: map[string]string{"gpt-4-class": "C", "claude-3-class": "C"},
		},
		ConfidenceWeight: 0.3,
	}

	evidence := extractor.Extract([]xagentauth.Canary{canary}, map[string]string{"test-exact": "C"})
	if len(evidence) != 1 {
		t.Fatalf("Expected 1 evidence, got %d", len(evidence))
	}
	if !evidence[0].Match {
		t.Error("Expected match for exact response")
	}
	if evidence[0].ConfidenceContribution != 0.3 {
		t.Errorf("Expected confidence 0.3, got %f", evidence[0].ConfidenceContribution)
	}
}

func TestExtractor_ExactMatchCaseInsensitive(t *testing.T) {
	extractor := NewCanaryExtractor()

	canary := xagentauth.Canary{
		ID: "test-case",
		Analysis: xagentauth.CanaryAnalysis{
			Type:     "exact_match",
			Expected: map[string]string{"gpt-4-class": "Warm"},
		},
		ConfidenceWeight: 0.25,
	}

	evidence := extractor.Extract([]xagentauth.Canary{canary}, map[string]string{"test-case": "warm"})
	if len(evidence) != 1 {
		t.Fatalf("Expected 1 evidence, got %d", len(evidence))
	}
	if !evidence[0].Match {
		t.Error("Expected case-insensitive match")
	}
}

func TestExtractor_Pattern(t *testing.T) {
	extractor := NewCanaryExtractor()

	canary := xagentauth.Canary{
		ID: "test-pattern",
		Analysis: xagentauth.CanaryAnalysis{
			Type:     "pattern",
			Patterns: map[string]string{"gpt-4-class": "Hello!|Hi there"},
		},
		ConfidenceWeight: 0.15,
	}

	// Match
	evidence := extractor.Extract([]xagentauth.Canary{canary}, map[string]string{"test-pattern": "Hello! How are you?"})
	if len(evidence) != 1 {
		t.Fatalf("Expected 1 evidence, got %d", len(evidence))
	}
	if !evidence[0].Match {
		t.Error("Expected pattern match")
	}

	// No match
	evidence2 := extractor.Extract([]xagentauth.Canary{canary}, map[string]string{"test-pattern": "Goodbye!"})
	if evidence2[0].Match {
		t.Error("Expected no match for non-matching response")
	}
}

func TestExtractor_Statistical(t *testing.T) {
	extractor := NewCanaryExtractor()

	canary := xagentauth.Canary{
		ID: "test-stat",
		Analysis: xagentauth.CanaryAnalysis{
			Type: "statistical",
			Distributions: map[string]xagentauth.Distribution{
				"gpt-4-class": {Mean: 50, StdDev: 10},
			},
		},
		ConfidenceWeight: 0.4,
	}

	// Within 2 sigma
	evidence := extractor.Extract([]xagentauth.Canary{canary}, map[string]string{"test-stat": "55"})
	if len(evidence) != 1 {
		t.Fatalf("Expected 1 evidence, got %d", len(evidence))
	}
	if !evidence[0].Match {
		t.Error("Expected statistical match within 2 sigma")
	}

	// Outside 2 sigma
	evidence2 := extractor.Extract([]xagentauth.Canary{canary}, map[string]string{"test-stat": "95"})
	if evidence2[0].Match {
		t.Error("Expected no match outside 2 sigma")
	}
}

func TestExtractor_MissingResponse(t *testing.T) {
	extractor := NewCanaryExtractor()

	canary := xagentauth.Canary{
		ID: "test-missing",
		Analysis: xagentauth.CanaryAnalysis{
			Type:     "exact_match",
			Expected: map[string]string{"gpt-4-class": "test"},
		},
		ConfidenceWeight: 0.3,
	}

	evidence := extractor.Extract([]xagentauth.Canary{canary}, map[string]string{})
	if len(evidence) != 0 {
		t.Errorf("Expected 0 evidence for missing response, got %d", len(evidence))
	}
}
