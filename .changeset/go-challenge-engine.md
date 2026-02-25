---
"xagentauth": minor
---

Add server-side challenge engine to Go SDK with full TypeScript parity

- Crypto utilities: RandomBytes, SHA256Hex, HmacSHA256Bytes, GenerateID, GenerateSessionToken
- Memory store with TTL-based expiry (stores/ subpackage)
- Challenge registry with dimension-based driver selection
- 4 challenge drivers (challenges/ subpackage): CryptoNL, CodeExecution, MultiStep, AmbiguousLogic
- PoMI model fingerprinting (pomi/ subpackage): catalog (17 canaries), injector, extractor, Bayesian classifier
- Timing analysis (timing/ subpackage): 16 baselines, zone classification, pattern analysis, session tracking
- Engine orchestrator: InitChallenge, GetChallenge, SolveChallenge, VerifyToken
- Zero external dependencies (all stdlib), 95 tests passing
