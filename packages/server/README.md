# @xagentauth/server

**HTTP middleware for AgentAuth** — drop-in authentication for Express and Hono applications.

## Installation

```bash
npm install @xagentauth/server
```

## Express

```typescript
import express from 'express'
import { AgentAuth } from '@xagentauth/server'
import { MemoryStore, CryptoNLDriver } from '@xagentauth/core'

const app = express()
app.use(express.json())

const auth = new AgentAuth({
  secret: process.env.AGENTAUTH_SECRET!,
  store: new MemoryStore(),
  drivers: [new CryptoNLDriver()],
  challengeTtlSeconds: 30,
  tokenTtlSeconds: 3600,
  minScore: 0.5,
})

// Challenge endpoints
app.post('/v1/challenge/init', auth.challenge())
app.get('/v1/challenge/:id', auth.retrieve())
app.post('/v1/challenge/:id/solve', auth.verify())
app.get('/v1/token/verify', auth.tokenVerify())

// Protected route
app.get('/api/data', auth.guard({ minScore: 0.7 }), (req, res) => {
  res.json({ data: 'protected content' })
})
```

## Hono

```typescript
import { Hono } from 'hono'
import { AgentAuthHono } from '@xagentauth/server/hono'
import { MemoryStore, CryptoNLDriver } from '@xagentauth/core'

const app = new Hono()

const auth = new AgentAuthHono({
  secret: process.env.AGENTAUTH_SECRET!,
  store: new MemoryStore(),
  drivers: [new CryptoNLDriver()],
  challengeTtlSeconds: 30,
  tokenTtlSeconds: 3600,
  minScore: 0.5,
})

app.post('/v1/challenge/init', auth.challenge())
app.get('/v1/challenge/:id', auth.retrieve())
app.post('/v1/challenge/:id/solve', auth.verify())
app.get('/v1/token/verify', auth.tokenVerify())
app.get('/api/data', auth.guard({ minScore: 0.7 }), (c) => {
  return c.json({ data: 'protected content' })
})
```

## Response Headers

On successful verification, the middleware sets `AgentAuth-*` headers automatically:

| Header | Description |
|--------|-------------|
| `AgentAuth-Status` | `verified` on success |
| `AgentAuth-Capabilities` | `reasoning=0.94,execution=0.98,...` |
| `AgentAuth-Challenge-Id` | Challenge identifier |
| `AgentAuth-Version` | Protocol version |

## License

MIT
