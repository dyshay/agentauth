# @xagentauth/core

**Framework-agnostic core library for the AgentAuth protocol** — challenge engine, scoring, stores, PoMI, and timing analysis.

## Installation

```bash
npm install @xagentauth/core
```

## Overview

This is the foundation package for AgentAuth. It contains the protocol logic with zero framework dependencies:

- **Challenge Engine** — orchestrates init / retrieve / solve lifecycle
- **Drivers** — pluggable challenge generators (CryptoNL, multi-step, etc.)
- **Scoring** — 5-dimension capability assessment (reasoning, execution, autonomy, speed, consistency)
- **Stores** — pluggable storage backends (Memory, Redis, Postgres, KV)
- **PoMI** — Proof of Model Identity via statistical canaries
- **Timing** — behavioral timing analysis with zone classification
- **JWT** — token generation and verification
- **Crypto** — HMAC-SHA256, SHA-256, anti-replay utilities

## Usage

```typescript
import {
  AgentAuthEngine,
  MemoryStore,
  CryptoNLDriver,
} from '@xagentauth/core'

const engine = new AgentAuthEngine({
  secret: process.env.AGENTAUTH_SECRET!,
  store: new MemoryStore(),
  drivers: [new CryptoNLDriver()],
  challengeTtlSeconds: 30,
  tokenTtlSeconds: 3600,
  minScore: 0.5,
})

// Init a challenge
const session = await engine.initChallenge({ difficulty: 'medium' })

// Retrieve it
const challenge = await engine.getChallenge(session.id, session.session_token)

// Solve it
const result = await engine.solveChallenge(session.id, {
  answer: computedAnswer,
  hmac: computedHmac,
})
```

### Stores

```typescript
import { MemoryStore, RedisStore, PostgresStore, KVStore } from '@xagentauth/core'

// In-memory (dev/testing)
const memory = new MemoryStore()

// Redis
const redis = new RedisStore({ url: 'redis://localhost:6379' })

// PostgreSQL
const pg = new PostgresStore({ connectionString: 'postgres://...' })

// Cloudflare KV / generic KV
const kv = new KVStore(kvNamespace)
```

### Timing Analysis

```typescript
import { TimingAnalyzer } from '@xagentauth/core'

const analyzer = new TimingAnalyzer({
  baselines: [{ driver: 'crypto-nl', ... }],
})

const result = analyzer.analyze(elapsed_ms, 'crypto-nl')
// { zone: 'ai_zone', confidence: 0.92, penalty: 0, ... }
```

## License

MIT
