# @xagentauth/server

## 0.2.0

### Minor Changes

- [#6](https://github.com/dyshay/agentauth/pull/6) [`5fd8919`](https://github.com/dyshay/agentauth/commit/5fd8919cdc16f48c6b940156042a0ff073958538) Thanks [@dyshay](https://github.com/dyshay)! - feat: add HTTP headers, Docker self-hosting, and challenge registry

  - Standard AgentAuth-\* HTTP headers injected by server guard/verify middleware
  - Client SDK parses AgentAuth response headers
  - Dockerfile and docker-compose.yml for one-command self-hosting
  - Challenge registry package format (agentauth.json manifest)
  - Local registry manager with install/uninstall/list/search
  - CLI commands: add, list, search, publish

### Patch Changes

- Updated dependencies [[`5fd8919`](https://github.com/dyshay/agentauth/commit/5fd8919cdc16f48c6b940156042a0ff073958538)]:
  - @xagentauth/core@0.2.0

## 0.1.0

### Minor Changes

- [#2](https://github.com/dyshay/agentauth/pull/2) [`a2ceb00`](https://github.com/dyshay/agentauth/commit/a2ceb0092d6d1a7799abe5389169230ebb583a4e) Thanks [@dyshay](https://github.com/dyshay)! - feat: add Proof of Model Identity (PoMI) and Behavioral Timing Analysis

  - Canary catalog with 12 default canary prompts for model fingerprinting
  - Canary injector/extractor for seamless challenge integration
  - Bayesian model classifier identifying model families (gpt-4, claude, gemini, llama, mistral)
  - Timing analyzer with zone classification (too_fast, ai_zone, suspicious, human, timeout)
  - Default timing baselines for all challenge types and difficulties
  - Multi-step timing pattern analysis (variance, trend, round number detection)
  - PoMI and timing results included in JWT claims and verify response

### Patch Changes

- Updated dependencies [[`a2ceb00`](https://github.com/dyshay/agentauth/commit/a2ceb0092d6d1a7799abe5389169230ebb583a4e)]:
  - @xagentauth/core@0.1.0
