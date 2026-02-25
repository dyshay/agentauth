from __future__ import annotations

from typing import Optional

from xagentauth.types import TimingBaseline, Difficulty

DEFAULT_BASELINES: list[TimingBaseline] = [
    # --- crypto-nl ---
    TimingBaseline(challenge_type="crypto-nl", difficulty=Difficulty.EASY,        mean_ms=150,  std_ms=60,  too_fast_ms=20,  ai_lower_ms=40,  ai_upper_ms=1000,  human_ms=8000,   timeout_ms=30000),
    TimingBaseline(challenge_type="crypto-nl", difficulty=Difficulty.MEDIUM,      mean_ms=300,  std_ms=120, too_fast_ms=30,  ai_lower_ms=50,  ai_upper_ms=2000,  human_ms=10000,  timeout_ms=30000),
    TimingBaseline(challenge_type="crypto-nl", difficulty=Difficulty.HARD,        mean_ms=600,  std_ms=200, too_fast_ms=50,  ai_lower_ms=100, ai_upper_ms=3000,  human_ms=15000,  timeout_ms=30000),
    TimingBaseline(challenge_type="crypto-nl", difficulty=Difficulty.ADVERSARIAL, mean_ms=1000, std_ms=350, too_fast_ms=80,  ai_lower_ms=150, ai_upper_ms=5000,  human_ms=20000,  timeout_ms=30000),

    # --- multi-step ---
    TimingBaseline(challenge_type="multi-step", difficulty=Difficulty.EASY,        mean_ms=400,  std_ms=150, too_fast_ms=40,  ai_lower_ms=80,  ai_upper_ms=2000,  human_ms=12000, timeout_ms=30000),
    TimingBaseline(challenge_type="multi-step", difficulty=Difficulty.MEDIUM,      mean_ms=800,  std_ms=300, too_fast_ms=60,  ai_lower_ms=150, ai_upper_ms=4000,  human_ms=15000, timeout_ms=30000),
    TimingBaseline(challenge_type="multi-step", difficulty=Difficulty.HARD,        mean_ms=1200, std_ms=400, too_fast_ms=100, ai_lower_ms=300, ai_upper_ms=5000,  human_ms=20000, timeout_ms=30000),
    TimingBaseline(challenge_type="multi-step", difficulty=Difficulty.ADVERSARIAL, mean_ms=1800, std_ms=500, too_fast_ms=150, ai_lower_ms=400, ai_upper_ms=7000,  human_ms=25000, timeout_ms=30000),

    # --- ambiguous-logic ---
    TimingBaseline(challenge_type="ambiguous-logic", difficulty=Difficulty.EASY,        mean_ms=200,  std_ms=80,  too_fast_ms=20,  ai_lower_ms=50,  ai_upper_ms=1500, human_ms=10000, timeout_ms=30000),
    TimingBaseline(challenge_type="ambiguous-logic", difficulty=Difficulty.MEDIUM,      mean_ms=400,  std_ms=150, too_fast_ms=40,  ai_lower_ms=80,  ai_upper_ms=2500, human_ms=12000, timeout_ms=30000),
    TimingBaseline(challenge_type="ambiguous-logic", difficulty=Difficulty.HARD,        mean_ms=700,  std_ms=250, too_fast_ms=60,  ai_lower_ms=120, ai_upper_ms=3500, human_ms=15000, timeout_ms=30000),
    TimingBaseline(challenge_type="ambiguous-logic", difficulty=Difficulty.ADVERSARIAL, mean_ms=1000, std_ms=350, too_fast_ms=80,  ai_lower_ms=200, ai_upper_ms=5000, human_ms=20000, timeout_ms=30000),

    # --- code-execution ---
    TimingBaseline(challenge_type="code-execution", difficulty=Difficulty.EASY,        mean_ms=300,  std_ms=100, too_fast_ms=30,  ai_lower_ms=60,  ai_upper_ms=1500, human_ms=15000, timeout_ms=30000),
    TimingBaseline(challenge_type="code-execution", difficulty=Difficulty.MEDIUM,      mean_ms=500,  std_ms=200, too_fast_ms=50,  ai_lower_ms=100, ai_upper_ms=3000, human_ms=20000, timeout_ms=30000),
    TimingBaseline(challenge_type="code-execution", difficulty=Difficulty.HARD,        mean_ms=900,  std_ms=300, too_fast_ms=80,  ai_lower_ms=150, ai_upper_ms=4500, human_ms=25000, timeout_ms=30000),
    TimingBaseline(challenge_type="code-execution", difficulty=Difficulty.ADVERSARIAL, mean_ms=1500, std_ms=450, too_fast_ms=120, ai_lower_ms=250, ai_upper_ms=6000, human_ms=30000, timeout_ms=30000),
]


def get_baseline(challenge_type: str, difficulty: str | Difficulty) -> Optional[TimingBaseline]:
    diff_val = difficulty.value if isinstance(difficulty, Difficulty) else difficulty
    for b in DEFAULT_BASELINES:
        b_diff = b.difficulty.value if isinstance(b.difficulty, Difficulty) else b.difficulty
        if b.challenge_type == challenge_type and b_diff == diff_val:
            return b
    return None
