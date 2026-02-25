# @xagentauth/server

## 0.4.0

### Minor Changes

- [#39](https://github.com/dyshay/agentauth/pull/39) [`48fe3f7`](https://github.com/dyshay/agentauth/commit/48fe3f7b80ce0030cf9e7adca0cec43a9651a26a) Thanks [@dyshay](https://github.com/dyshay)! - Add Go server-side middleware with local HS256 JWT verification (stdlib only, zero deps), shared guard logic, net/http middleware with context-based claims, and Gin middleware in a separate ginauth submodule.

- [#34](https://github.com/dyshay/agentauth/pull/34) [`56713b3`](https://github.com/dyshay/agentauth/commit/56713b3b09346317646518e121d9051c54cd817b) Thanks [@dyshay](https://github.com/dyshay)! - Add NestJS adapter with AgentAuthService, AgentAuthGuard, @AgentAuth() decorator, and AgentAuthModule.forRoot()

- [#37](https://github.com/dyshay/agentauth/pull/37) [`8e83611`](https://github.com/dyshay/agentauth/commit/8e836114ef2a06a2017717a82742293d8811926d) Thanks [@dyshay](https://github.com/dyshay)! - Add Python server-side middleware with local HS256 JWT verification (TokenVerifier), shared guard logic, FastAPI dependency guard, and Flask decorator guard. Update docs with Python/Rust/Go middleware examples and fix SDK tab switching on the documentation site.

- [#38](https://github.com/dyshay/agentauth/pull/38) [`e169ed3`](https://github.com/dyshay/agentauth/commit/e169ed38d877a6685349cac2cb567ca9574157c1) Thanks [@dyshay](https://github.com/dyshay)! - Add Rust server-side middleware with local HS256 JWT verification (jsonwebtoken crate), shared guard logic, Axum Tower layer + extractor, and Actix Transform middleware + extractor. Feature-gated behind "axum" and "actix" features.

### Patch Changes

- Updated dependencies [[`2f51078`](https://github.com/dyshay/agentauth/commit/2f51078ee69aebe1544a37f22b878f4817bd5eac), [`93ec9ce`](https://github.com/dyshay/agentauth/commit/93ec9cea9d3688b7e94b07508a4712026bdaa1d2)]:
  - @xagentauth/core@0.5.0

## 0.3.0

### Minor Changes

- [#20](https://github.com/dyshay/agentauth/pull/20) [`161ed57`](https://github.com/dyshay/agentauth/commit/161ed57412a241e546e902a52d98384ea196063b) Thanks [@dyshay](https://github.com/dyshay)! - Add Hono middleware adapter (AgentAuthHono) with challenge, retrieve, verify, tokenVerify, and guard handlers

## 0.2.2

### Patch Changes

- Updated dependencies [[`c6c224d`](https://github.com/dyshay/agentauth/commit/c6c224d03bb83d309c536fa78209b07a053e98ef)]:
  - @xagentauth/core@0.4.0

## 0.2.1

### Patch Changes

- Updated dependencies [[`2cbc1e1`](https://github.com/dyshay/agentauth/commit/2cbc1e1fe62b42812b6e6a4dcfc5a9b169b5a8b7)]:
  - @xagentauth/core@0.3.0

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
