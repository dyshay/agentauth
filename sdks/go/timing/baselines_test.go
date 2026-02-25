package timing

import (
	"testing"

	xagentauth "github.com/dyshay/agentauth/sdks/go"
)

func TestBaselines_Count(t *testing.T) {
	if len(DefaultBaselines) != 16 {
		t.Errorf("Expected 16 default baselines, got %d", len(DefaultBaselines))
	}
}

func TestBaselines_GetBaseline(t *testing.T) {
	b := GetBaseline("crypto-nl", xagentauth.DifficultyEasy)
	if b == nil {
		t.Fatal("Expected to find crypto-nl easy baseline")
	}
	if b.MeanMs != 150 {
		t.Errorf("Expected mean_ms 150, got %f", b.MeanMs)
	}
	if b.TooFastMs != 20 {
		t.Errorf("Expected too_fast_ms 20, got %f", b.TooFastMs)
	}
}

func TestBaselines_GetBaselineMissing(t *testing.T) {
	b := GetBaseline("nonexistent", xagentauth.DifficultyEasy)
	if b != nil {
		t.Error("Expected nil for missing baseline")
	}
}

func TestBaselines_AllTypes(t *testing.T) {
	types := []string{"crypto-nl", "multi-step", "ambiguous-logic", "code-execution"}
	diffs := []xagentauth.Difficulty{
		xagentauth.DifficultyEasy,
		xagentauth.DifficultyMedium,
		xagentauth.DifficultyHard,
		xagentauth.DifficultyAdversarial,
	}

	for _, ct := range types {
		for _, d := range diffs {
			b := GetBaseline(ct, d)
			if b == nil {
				t.Errorf("Missing baseline for %s/%s", ct, d)
			}
		}
	}
}
