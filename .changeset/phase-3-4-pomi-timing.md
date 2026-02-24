---
"@xagentauth/core": minor
"@xagentauth/server": minor
---

feat: add Proof of Model Identity (PoMI) and Behavioral Timing Analysis

- Canary catalog with 12 default canary prompts for model fingerprinting
- Canary injector/extractor for seamless challenge integration
- Bayesian model classifier identifying model families (gpt-4, claude, gemini, llama, mistral)
- Timing analyzer with zone classification (too_fast, ai_zone, suspicious, human, timeout)
- Default timing baselines for all challenge types and difficulties
- Multi-step timing pattern analysis (variance, trend, round number detection)
- PoMI and timing results included in JWT claims and verify response
