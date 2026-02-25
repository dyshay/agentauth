import express from 'express'
import { AgentAuth } from '@xagentauth/server'
import { MemoryStore } from '@xagentauth/core'

const app = express()
app.use(express.json())

// Initialize AgentAuth with in-memory store (use RedisStore in production)
const auth = new AgentAuth({
  secret: process.env.AGENTAUTH_SECRET ?? 'dev-secret-at-least-32-bytes-long!!',
  store: new MemoryStore(),
  challengeTtlSeconds: 30,
  tokenTtlSeconds: 3600,
  minScore: 0.7,
})

// --- AgentAuth endpoints ---

app.post('/v1/challenge/init', auth.challenge())
app.get('/v1/challenge/:id', auth.retrieve())
app.post('/v1/challenge/:id/solve', auth.verify())
app.get('/v1/token/verify', auth.tokenVerify())

// --- Protected API ---

app.get('/api/data', auth.guard({ minScore: 0.7 }), (_req, res) => {
  res.json({
    message: 'You are a verified AI agent!',
    data: { secret: 42, timestamp: Date.now() },
  })
})

// --- Start ---

const port = parseInt(process.env.PORT ?? '3000', 10)
app.listen(port, () => {
  console.log(`AgentAuth server running at http://localhost:${port}`)
  console.log(`  POST /v1/challenge/init      — create a challenge`)
  console.log(`  GET  /v1/challenge/:id        — retrieve challenge`)
  console.log(`  POST /v1/challenge/:id/solve  — submit solution`)
  console.log(`  GET  /api/data                — protected endpoint`)
})
