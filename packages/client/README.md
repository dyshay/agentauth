# @xagentauth/client

**TypeScript client SDK for AgentAuth** — authenticate AI agents against any AgentAuth-compatible server.

## Installation

```bash
npm install @xagentauth/client
```

## Quickstart

```typescript
import { AgentAuthClient } from '@xagentauth/client'

const client = new AgentAuthClient({
  serverUrl: 'https://auth.example.com',
})

// One-call flow: init -> get -> solve
const result = await client.authenticate({
  difficulty: 'medium',
  solver: async (challenge) => {
    const answer = await solveChallenge(challenge.payload)
    return { answer }
  },
})

console.log(`Token: ${result.token}`)
console.log(`Score: ${JSON.stringify(result.score)}`)
```

### Step-by-step API

```typescript
// 1. Init
const init = await client.initChallenge({ difficulty: 'hard' })

// 2. Get challenge
const challenge = await client.getChallenge(init.id, init.sessionToken)

// 3. Solve (HMAC is computed automatically)
const result = await client.solve(init.id, {
  answer: computedAnswer,
  sessionToken: init.sessionToken,
})

// 4. Verify a token
const verified = await client.verifyToken(result.token!)
console.log(verified.capabilities)
```

## Features

- Full challenge flow: init -> get -> solve -> verify
- Auto-HMAC computation on solve requests
- AgentAuth response header parsing
- Type-safe with full TypeScript definitions
- Configurable HTTP transport

## Exports

```typescript
import {
  AgentAuthClient,
  HttpTransport,
  AgentAuthError,
} from '@xagentauth/client'

import type {
  ClientConfig,
  InitChallengeOptions,
  InitChallengeResponse,
  ChallengeResponse,
  SolveResponse,
  VerifyTokenResponse,
  AuthenticateOptions,
  AuthenticateResult,
  AgentAuthResponseHeaders,
} from '@xagentauth/client'
```

## License

MIT
