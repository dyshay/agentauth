import type { TimingBaseline, Difficulty } from '../types.js'

// Default baselines based on challenge driver characteristics
// These are calibrated estimates — real baselines should be measured via benchmarking
export const DEFAULT_BASELINES: TimingBaseline[] = [
  // --- crypto-nl ---
  { challenge_type: 'crypto-nl', difficulty: 'easy',        mean_ms: 150,  std_ms: 60,  too_fast_ms: 20,  ai_lower_ms: 40,  ai_upper_ms: 1000,  human_ms: 8000,   timeout_ms: 30000 },
  { challenge_type: 'crypto-nl', difficulty: 'medium',      mean_ms: 300,  std_ms: 120, too_fast_ms: 30,  ai_lower_ms: 50,  ai_upper_ms: 2000,  human_ms: 10000,  timeout_ms: 30000 },
  { challenge_type: 'crypto-nl', difficulty: 'hard',        mean_ms: 600,  std_ms: 200, too_fast_ms: 50,  ai_lower_ms: 100, ai_upper_ms: 3000,  human_ms: 15000,  timeout_ms: 30000 },
  { challenge_type: 'crypto-nl', difficulty: 'adversarial', mean_ms: 1000, std_ms: 350, too_fast_ms: 80,  ai_lower_ms: 150, ai_upper_ms: 5000,  human_ms: 20000,  timeout_ms: 30000 },

  // --- multi-step ---
  { challenge_type: 'multi-step', difficulty: 'easy',        mean_ms: 400,  std_ms: 150, too_fast_ms: 40,  ai_lower_ms: 80,  ai_upper_ms: 2000,  human_ms: 12000, timeout_ms: 30000 },
  { challenge_type: 'multi-step', difficulty: 'medium',      mean_ms: 800,  std_ms: 300, too_fast_ms: 60,  ai_lower_ms: 150, ai_upper_ms: 4000,  human_ms: 15000, timeout_ms: 30000 },
  { challenge_type: 'multi-step', difficulty: 'hard',        mean_ms: 1200, std_ms: 400, too_fast_ms: 100, ai_lower_ms: 300, ai_upper_ms: 5000,  human_ms: 20000, timeout_ms: 30000 },
  { challenge_type: 'multi-step', difficulty: 'adversarial', mean_ms: 1800, std_ms: 500, too_fast_ms: 150, ai_lower_ms: 400, ai_upper_ms: 7000,  human_ms: 25000, timeout_ms: 30000 },

  // --- ambiguous-logic ---
  { challenge_type: 'ambiguous-logic', difficulty: 'easy',        mean_ms: 200,  std_ms: 80,  too_fast_ms: 20,  ai_lower_ms: 50,  ai_upper_ms: 1500, human_ms: 10000, timeout_ms: 30000 },
  { challenge_type: 'ambiguous-logic', difficulty: 'medium',      mean_ms: 400,  std_ms: 150, too_fast_ms: 40,  ai_lower_ms: 80,  ai_upper_ms: 2500, human_ms: 12000, timeout_ms: 30000 },
  { challenge_type: 'ambiguous-logic', difficulty: 'hard',        mean_ms: 700,  std_ms: 250, too_fast_ms: 60,  ai_lower_ms: 120, ai_upper_ms: 3500, human_ms: 15000, timeout_ms: 30000 },
  { challenge_type: 'ambiguous-logic', difficulty: 'adversarial', mean_ms: 1000, std_ms: 350, too_fast_ms: 80,  ai_lower_ms: 200, ai_upper_ms: 5000, human_ms: 20000, timeout_ms: 30000 },

  // --- code-execution ---
  { challenge_type: 'code-execution', difficulty: 'easy',        mean_ms: 300,  std_ms: 100, too_fast_ms: 30,  ai_lower_ms: 60,  ai_upper_ms: 1500, human_ms: 15000, timeout_ms: 30000 },
  { challenge_type: 'code-execution', difficulty: 'medium',      mean_ms: 500,  std_ms: 200, too_fast_ms: 50,  ai_lower_ms: 100, ai_upper_ms: 3000, human_ms: 20000, timeout_ms: 30000 },
  { challenge_type: 'code-execution', difficulty: 'hard',        mean_ms: 900,  std_ms: 300, too_fast_ms: 80,  ai_lower_ms: 150, ai_upper_ms: 4500, human_ms: 25000, timeout_ms: 30000 },
  { challenge_type: 'code-execution', difficulty: 'adversarial', mean_ms: 1500, std_ms: 450, too_fast_ms: 120, ai_lower_ms: 250, ai_upper_ms: 6000, human_ms: 30000, timeout_ms: 30000 },
]

export function getBaseline(challengeType: string, difficulty: Difficulty): TimingBaseline | undefined {
  return DEFAULT_BASELINES.find(
    (b) => b.challenge_type === challengeType && b.difficulty === difficulty,
  )
}
