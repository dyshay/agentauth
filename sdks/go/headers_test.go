package xagentauth

import (
	"strings"
	"testing"
)

func TestFormatCapabilities(t *testing.T) {
	score := AgentCapabilityScore{
		Reasoning:   0.9,
		Execution:   0.85,
		Autonomy:    0.8,
		Speed:       0.75,
		Consistency: 0.88,
	}
	result := FormatCapabilities(score)

	if !strings.Contains(result, "reasoning=0.9") {
		t.Errorf("expected reasoning=0.9 in %s", result)
	}
	if !strings.Contains(result, "execution=0.85") {
		t.Errorf("expected execution=0.85 in %s", result)
	}
	if !strings.Contains(result, "autonomy=0.8") {
		t.Errorf("expected autonomy=0.8 in %s", result)
	}
	if !strings.Contains(result, "speed=0.75") {
		t.Errorf("expected speed=0.75 in %s", result)
	}
	if !strings.Contains(result, "consistency=0.88") {
		t.Errorf("expected consistency=0.88 in %s", result)
	}
	// Exactly 4 commas (5 items)
	if strings.Count(result, ",") != 4 {
		t.Errorf("expected 4 commas, got %d in %s", strings.Count(result, ","), result)
	}
}

func TestParseCapabilities(t *testing.T) {
	result := ParseCapabilities("reasoning=0.9,execution=0.85,autonomy=0.8,speed=0.75,consistency=0.88")

	if result["reasoning"] != 0.9 {
		t.Errorf("expected reasoning=0.9, got %f", result["reasoning"])
	}
	if result["execution"] != 0.85 {
		t.Errorf("expected execution=0.85, got %f", result["execution"])
	}
	if len(result) != 5 {
		t.Errorf("expected 5 entries, got %d", len(result))
	}
}

func TestParseCapabilitiesRoundtrip(t *testing.T) {
	score := AgentCapabilityScore{
		Reasoning:   0.9,
		Execution:   0.85,
		Autonomy:    0.8,
		Speed:       0.75,
		Consistency: 0.88,
	}
	formatted := FormatCapabilities(score)
	parsed := ParseCapabilities(formatted)

	if parsed["reasoning"] != 0.9 {
		t.Errorf("roundtrip reasoning mismatch: %f", parsed["reasoning"])
	}
	if parsed["execution"] != 0.85 {
		t.Errorf("roundtrip execution mismatch: %f", parsed["execution"])
	}
	if parsed["autonomy"] != 0.8 {
		t.Errorf("roundtrip autonomy mismatch: %f", parsed["autonomy"])
	}
	if parsed["speed"] != 0.75 {
		t.Errorf("roundtrip speed mismatch: %f", parsed["speed"])
	}
	if parsed["consistency"] != 0.88 {
		t.Errorf("roundtrip consistency mismatch: %f", parsed["consistency"])
	}
}

func TestParseCapabilitiesEmpty(t *testing.T) {
	result := ParseCapabilities("")
	if len(result) != 0 {
		t.Errorf("expected empty map, got %d entries", len(result))
	}
}

func TestParseCapabilitiesInvalidValues(t *testing.T) {
	result := ParseCapabilities("reasoning=abc,execution=0.85")
	if _, ok := result["reasoning"]; ok {
		t.Error("expected reasoning to be skipped")
	}
	if result["execution"] != 0.85 {
		t.Errorf("expected execution=0.85, got %f", result["execution"])
	}
}

func TestHeaderConstants(t *testing.T) {
	if HeaderStatus != "AgentAuth-Status" {
		t.Errorf("wrong HeaderStatus: %s", HeaderStatus)
	}
	if HeaderCapabilities != "AgentAuth-Capabilities" {
		t.Errorf("wrong HeaderCapabilities: %s", HeaderCapabilities)
	}
	if HeaderChallengeID != "AgentAuth-Challenge-Id" {
		t.Errorf("wrong HeaderChallengeID: %s", HeaderChallengeID)
	}
}
