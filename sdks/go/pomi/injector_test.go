package pomi

import (
	"strings"
	"testing"

	xagentauth "github.com/dyshay/agentauth/sdks/go"
)

func TestInjector_ZeroCount(t *testing.T) {
	catalog := NewCanaryCatalog(nil)
	injector := NewCanaryInjector(catalog)

	payload := xagentauth.ChallengePayload{
		Type:         "test",
		Instructions: "Do something",
	}

	result := injector.Inject(payload, 0, nil)
	if len(result.Injected) != 0 {
		t.Errorf("Expected 0 injected canaries, got %d", len(result.Injected))
	}
	if result.Payload.Instructions != "Do something" {
		t.Error("Expected instructions to be unchanged")
	}
}

func TestInjector_InjectCanaries(t *testing.T) {
	catalog := NewCanaryCatalog(nil)
	injector := NewCanaryInjector(catalog)

	payload := xagentauth.ChallengePayload{
		Type:         "test",
		Instructions: "Solve this challenge.",
	}

	result := injector.Inject(payload, 3, nil)
	if len(result.Injected) != 3 {
		t.Fatalf("Expected 3 injected canaries, got %d", len(result.Injected))
	}

	// Instructions should be modified
	if result.Payload.Instructions == "Solve this challenge." {
		t.Error("Expected instructions to be modified after injection")
	}

	// Should contain side task marker
	if !strings.Contains(result.Payload.Instructions, "canary_responses") {
		t.Error("Expected instructions to reference canary_responses")
	}
}

func TestInjector_ExcludeCanaries(t *testing.T) {
	catalog := NewCanaryCatalog(nil)
	injector := NewCanaryInjector(catalog)

	payload := xagentauth.ChallengePayload{
		Type:         "test",
		Instructions: "Test",
	}

	result := injector.Inject(payload, 20, &InjectOptions{
		Exclude: []string{"unicode-rtl", "math-precision"},
	})
	for _, c := range result.Injected {
		if c.ID == "unicode-rtl" || c.ID == "math-precision" {
			t.Errorf("Excluded canary %s was injected", c.ID)
		}
	}
}

func TestInjector_PrefixCanaries(t *testing.T) {
	// Create a catalog with a prefix canary
	canaries := []xagentauth.Canary{
		{
			ID:               "test-prefix",
			Prompt:           "Test prefix prompt",
			InjectionMethod:  xagentauth.InjectionPrefix,
			Analysis:         xagentauth.CanaryAnalysis{Type: "exact_match", Expected: map[string]string{"test": "yes"}},
			ConfidenceWeight: 0.5,
		},
	}
	catalog := NewCanaryCatalog(canaries)
	injector := NewCanaryInjector(catalog)

	payload := xagentauth.ChallengePayload{
		Type:         "test",
		Instructions: "Main instructions",
	}

	result := injector.Inject(payload, 1, nil)
	if !strings.HasPrefix(result.Payload.Instructions, "Before starting") {
		t.Error("Expected prefix injection at the start of instructions")
	}
}
