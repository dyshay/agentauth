# @xagentauth/cli

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

- [#4](https://github.com/dyshay/agentauth/pull/4) [`77b1e16`](https://github.com/dyshay/agentauth/commit/77b1e169617c65a03afc6e13eaf5cd95bf3cc918) Thanks [@dyshay](https://github.com/dyshay)! - feat: add TypeScript client SDK and CLI tool

  - @xagentauth/client: Full challenge flow (init, get, solve, verifyToken), one-call authenticate() with auto-HMAC, canary response support
  - @xagentauth/cli: generate, verify, and benchmark commands for local development and testing
