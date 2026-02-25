---
"xagentauth": minor
---

Add server-side challenge engine to Python SDK with full TypeScript parity

- Crypto utilities: random_bytes, sha256_hex, hmac_sha256_bytes, generate_id, generate_session_token, timing_safe_equal
- Memory store with dict-based TTL expiry
- Challenge registry with dimension-based driver selection
- 4 challenge drivers: CryptoNL (10 byte ops, NL phrasings), CodeExecution (3 templates, 6 bugs), MultiStep (6 step types with memory), AmbiguousLogic (3 templates, weighted scoring)
- PoMI model fingerprinting: catalog (17 canaries, Fisher-Yates), injector, extractor (exact/pattern/statistical), Bayesian classifier
- Timing analysis: 16 baselines, zone classification, pattern analysis, session tracking (3 anomaly types)
- Engine orchestrator: init_challenge, get_challenge, solve_challenge, verify_token
- FastAPI router and Flask blueprint for HTTP endpoints
- No new dependencies (all stdlib crypto), 67 new tests (99 total)
