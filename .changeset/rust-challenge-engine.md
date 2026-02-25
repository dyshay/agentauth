---
"xagentauth": minor
---

Add server-side challenge engine to Rust SDK with full TypeScript parity

- Crypto utilities: random_bytes, sha256_hex, hmac_sha256_bytes, generate_id, generate_session_token
- Memory store with Mutex<HashMap> and TTL-based expiry
- Challenge registry with dimension-based driver selection
- 4 challenge drivers: CryptoNL (10 byte ops), CodeExecution (3 templates, 6 bugs), MultiStep (6 step types), AmbiguousLogic (3 templates)
- PoMI model fingerprinting: catalog (17 canaries, Fisher-Yates), injector, extractor (exact/pattern/statistical), Bayesian classifier
- Timing analysis: 16 baselines, zone classification, pattern analysis, session tracking (3 anomaly types)
- Engine orchestrator: init_challenge, get_challenge, solve_challenge, verify_token with JWT issuance
- New deps: getrandom, rand, base64, regex, async-trait
- 85 unit tests + 10 integration tests passing
