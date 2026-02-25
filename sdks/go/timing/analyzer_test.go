package timing

import (
	"testing"

	xagentauth "github.com/dyshay/agentauth/sdks/go"
)

func TestAnalyzer_AIZone(t *testing.T) {
	analyzer := NewTimingAnalyzer(nil)
	result := analyzer.Analyze(AnalyzeParams{
		ElapsedMs:     500,
		ChallengeType: "crypto-nl",
		Difficulty:    xagentauth.DifficultyEasy,
	})

	if result.Zone != string(xagentauth.ZoneAI) {
		t.Errorf("Expected ai_zone, got %s", result.Zone)
	}
	if result.Penalty != 0 {
		t.Errorf("Expected 0 penalty in AI zone, got %f", result.Penalty)
	}
}

func TestAnalyzer_TooFast(t *testing.T) {
	analyzer := NewTimingAnalyzer(nil)
	result := analyzer.Analyze(AnalyzeParams{
		ElapsedMs:     5,
		ChallengeType: "crypto-nl",
		Difficulty:    xagentauth.DifficultyEasy,
	})

	if result.Zone != string(xagentauth.ZoneTooFast) {
		t.Errorf("Expected too_fast, got %s", result.Zone)
	}
	if result.Penalty != 1.0 {
		t.Errorf("Expected penalty 1.0, got %f", result.Penalty)
	}
}

func TestAnalyzer_Timeout(t *testing.T) {
	analyzer := NewTimingAnalyzer(nil)
	result := analyzer.Analyze(AnalyzeParams{
		ElapsedMs:     35000,
		ChallengeType: "crypto-nl",
		Difficulty:    xagentauth.DifficultyEasy,
	})

	if result.Zone != string(xagentauth.ZoneTimeout) {
		t.Errorf("Expected timeout, got %s", result.Zone)
	}
}

func TestAnalyzer_Human(t *testing.T) {
	analyzer := NewTimingAnalyzer(nil)
	result := analyzer.Analyze(AnalyzeParams{
		ElapsedMs:     15000,
		ChallengeType: "crypto-nl",
		Difficulty:    xagentauth.DifficultyEasy,
	})

	if result.Zone != string(xagentauth.ZoneHuman) {
		t.Errorf("Expected human, got %s", result.Zone)
	}
	if result.Penalty != 0.9 {
		t.Errorf("Expected penalty 0.9, got %f", result.Penalty)
	}
}

func TestAnalyzer_Suspicious(t *testing.T) {
	analyzer := NewTimingAnalyzer(nil)
	result := analyzer.Analyze(AnalyzeParams{
		ElapsedMs:     4000,
		ChallengeType: "crypto-nl",
		Difficulty:    xagentauth.DifficultyEasy,
	})

	if result.Zone != string(xagentauth.ZoneSuspicious) {
		t.Errorf("Expected suspicious, got %s", result.Zone)
	}
	if result.Penalty < 0.3 || result.Penalty > 0.7 {
		t.Errorf("Expected penalty between 0.3 and 0.7, got %f", result.Penalty)
	}
}

func TestAnalyzer_DefaultBaseline(t *testing.T) {
	analyzer := NewTimingAnalyzer(nil)
	// Unknown challenge type should use default baseline
	result := analyzer.Analyze(AnalyzeParams{
		ElapsedMs:     500,
		ChallengeType: "unknown-type",
		Difficulty:    xagentauth.DifficultyEasy,
	})

	// Should not panic and should produce a valid result
	if result.Zone == "" {
		t.Error("Expected non-empty zone")
	}
}

func TestAnalyzer_RoundNumberDetection(t *testing.T) {
	analyzer := NewTimingAnalyzer(nil)
	result := analyzer.Analyze(AnalyzeParams{
		ElapsedMs:     500,
		ChallengeType: "crypto-nl",
		Difficulty:    xagentauth.DifficultyEasy,
	})

	if result.Zone != string(xagentauth.ZoneAI) {
		t.Fatalf("Expected ai_zone, got %s", result.Zone)
	}
	// Should detect round number
	if result.Details == "" {
		t.Error("Expected non-empty details")
	}
}

func TestAnalyzer_Pattern_Natural(t *testing.T) {
	analyzer := NewTimingAnalyzer(nil)
	result := analyzer.AnalyzePattern([]float64{123, 287, 341, 198, 256})
	if result.Verdict != "natural" {
		t.Errorf("Expected natural verdict, got %s", result.Verdict)
	}
}

func TestAnalyzer_Pattern_Artificial(t *testing.T) {
	analyzer := NewTimingAnalyzer(nil)
	// Very consistent timings = artificial
	result := analyzer.AnalyzePattern([]float64{500, 500, 500, 500})
	if result.Verdict != "artificial" {
		t.Errorf("Expected artificial verdict for consistent timings, got %s", result.Verdict)
	}
}

func TestAnalyzer_Pattern_TooFew(t *testing.T) {
	analyzer := NewTimingAnalyzer(nil)
	result := analyzer.AnalyzePattern([]float64{100})
	if result.Verdict != "inconclusive" {
		t.Errorf("Expected inconclusive for single timing, got %s", result.Verdict)
	}
}
