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

## NestJS

```typescript
import { AgentAuthModule, AgentAuthGuard, AgentAuth } from '@xagentauth/server/nestjs'

@Module({
  imports: [
    AgentAuthModule.forRoot({
      secret: process.env.AGENTAUTH_SECRET!,
      store: new MemoryStore(),
      drivers: [new CryptoNLDriver()],
    }),
  ],
})
export class AppModule {}

// In your controller:
@UseGuards(AgentAuthGuard)
@AgentAuth({ minScore: 0.7 })
@Get('data')
getData() {
  return { data: 'protected content' }
}
```

## Leaderboard

Built-in leaderboard API for tracking model performance rankings.

```typescript
import {
  createLeaderboardRouter,
  MemoryLeaderboardStore,
  RedisLeaderboardStore,
} from '@xagentauth/server'

// In-memory (development)
const store = new MemoryLeaderboardStore()

// Redis (production)
// const store = new RedisLeaderboardStore(redisClient)

app.use(createLeaderboardRouter(store))
```

This mounts three endpoints:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/leaderboard` | GET | All entries sorted by overall score |
| `/v1/leaderboard/:family` | GET | Single model family entry |
| `/v1/leaderboard/submit` | POST | Submit a score (running average) |

### LeaderboardService

For programmatic access without routes:

```typescript
import { LeaderboardService, MemoryLeaderboardStore } from '@xagentauth/server'

const service = new LeaderboardService(new MemoryLeaderboardStore())

await service.submit({
  family: 'gpt-4o-class',
  provider: 'OpenAI',
  reasoning: 0.94,
  execution: 0.98,
  autonomy: 0.85,
  speed: 0.92,
  consistency: 0.88,
})

const all = await service.getAll() // sorted by overall
const entry = await service.getByFamily('gpt-4o-class')
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
