package timing

import xagentauth "github.com/dyshay/agentauth/sdks/go"

// DefaultBaselines contains the 16 default timing baselines (4 challenge types x 4 difficulties).
var DefaultBaselines = []xagentauth.TimingBaseline{
	// --- crypto-nl ---
	{ChallengeType: "crypto-nl", Difficulty: xagentauth.DifficultyEasy, MeanMs: 150, StdMs: 60, TooFastMs: 20, AILowerMs: 40, AIUpperMs: 1000, HumanMs: 8000, TimeoutMs: 30000},
	{ChallengeType: "crypto-nl", Difficulty: xagentauth.DifficultyMedium, MeanMs: 300, StdMs: 120, TooFastMs: 30, AILowerMs: 50, AIUpperMs: 2000, HumanMs: 10000, TimeoutMs: 30000},
	{ChallengeType: "crypto-nl", Difficulty: xagentauth.DifficultyHard, MeanMs: 600, StdMs: 200, TooFastMs: 50, AILowerMs: 100, AIUpperMs: 3000, HumanMs: 15000, TimeoutMs: 30000},
	{ChallengeType: "crypto-nl", Difficulty: xagentauth.DifficultyAdversarial, MeanMs: 1000, StdMs: 350, TooFastMs: 80, AILowerMs: 150, AIUpperMs: 5000, HumanMs: 20000, TimeoutMs: 30000},

	// --- multi-step ---
	{ChallengeType: "multi-step", Difficulty: xagentauth.DifficultyEasy, MeanMs: 400, StdMs: 150, TooFastMs: 40, AILowerMs: 80, AIUpperMs: 2000, HumanMs: 12000, TimeoutMs: 30000},
	{ChallengeType: "multi-step", Difficulty: xagentauth.DifficultyMedium, MeanMs: 800, StdMs: 300, TooFastMs: 60, AILowerMs: 150, AIUpperMs: 4000, HumanMs: 15000, TimeoutMs: 30000},
	{ChallengeType: "multi-step", Difficulty: xagentauth.DifficultyHard, MeanMs: 1200, StdMs: 400, TooFastMs: 100, AILowerMs: 300, AIUpperMs: 5000, HumanMs: 20000, TimeoutMs: 30000},
	{ChallengeType: "multi-step", Difficulty: xagentauth.DifficultyAdversarial, MeanMs: 1800, StdMs: 500, TooFastMs: 150, AILowerMs: 400, AIUpperMs: 7000, HumanMs: 25000, TimeoutMs: 30000},

	// --- ambiguous-logic ---
	{ChallengeType: "ambiguous-logic", Difficulty: xagentauth.DifficultyEasy, MeanMs: 200, StdMs: 80, TooFastMs: 20, AILowerMs: 50, AIUpperMs: 1500, HumanMs: 10000, TimeoutMs: 30000},
	{ChallengeType: "ambiguous-logic", Difficulty: xagentauth.DifficultyMedium, MeanMs: 400, StdMs: 150, TooFastMs: 40, AILowerMs: 80, AIUpperMs: 2500, HumanMs: 12000, TimeoutMs: 30000},
	{ChallengeType: "ambiguous-logic", Difficulty: xagentauth.DifficultyHard, MeanMs: 700, StdMs: 250, TooFastMs: 60, AILowerMs: 120, AIUpperMs: 3500, HumanMs: 15000, TimeoutMs: 30000},
	{ChallengeType: "ambiguous-logic", Difficulty: xagentauth.DifficultyAdversarial, MeanMs: 1000, StdMs: 350, TooFastMs: 80, AILowerMs: 200, AIUpperMs: 5000, HumanMs: 20000, TimeoutMs: 30000},

	// --- code-execution ---
	{ChallengeType: "code-execution", Difficulty: xagentauth.DifficultyEasy, MeanMs: 300, StdMs: 100, TooFastMs: 30, AILowerMs: 60, AIUpperMs: 1500, HumanMs: 15000, TimeoutMs: 30000},
	{ChallengeType: "code-execution", Difficulty: xagentauth.DifficultyMedium, MeanMs: 500, StdMs: 200, TooFastMs: 50, AILowerMs: 100, AIUpperMs: 3000, HumanMs: 20000, TimeoutMs: 30000},
	{ChallengeType: "code-execution", Difficulty: xagentauth.DifficultyHard, MeanMs: 900, StdMs: 300, TooFastMs: 80, AILowerMs: 150, AIUpperMs: 4500, HumanMs: 25000, TimeoutMs: 30000},
	{ChallengeType: "code-execution", Difficulty: xagentauth.DifficultyAdversarial, MeanMs: 1500, StdMs: 450, TooFastMs: 120, AILowerMs: 250, AIUpperMs: 6000, HumanMs: 30000, TimeoutMs: 30000},
}

// GetBaseline returns the timing baseline for a given challenge type and difficulty.
func GetBaseline(challengeType string, difficulty xagentauth.Difficulty) *xagentauth.TimingBaseline {
	for i := range DefaultBaselines {
		if DefaultBaselines[i].ChallengeType == challengeType && DefaultBaselines[i].Difficulty == difficulty {
			return &DefaultBaselines[i]
		}
	}
	return nil
}
