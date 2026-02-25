import express from 'express'
import { AgentAuth, createLeaderboardRouter, MemoryLeaderboardStore } from '@xagentauth/server'
import {
  MemoryStore,
  CryptoNLDriver,
  MultiStepDriver,
  AmbiguousLogicDriver,
  CodeExecutionDriver,
} from '@xagentauth/core'

const app = express()
app.use(express.json())

const secret = process.env.AGENTAUTH_SECRET
if (!secret || secret.length < 32) {
  console.error('Error: AGENTAUTH_SECRET must be set and at least 32 characters')
  process.exit(1)
}

// --- Store backend ---

const backend = (process.env.STORE_BACKEND || 'memory').toLowerCase()
let store

if (backend === 'redis') {
  const Redis = (await import('ioredis')).default
  const url = process.env.REDIS_URL || 'redis://localhost:6379'
  const { RedisStore } = await import('@xagentauth/core')
  const redis = new Redis(url)
  store = new RedisStore(redis)
  console.log(`Store: redis (${url})`)
} else if (backend === 'postgres') {
  const pg = await import('pg')
  const Pool = pg.default?.Pool ?? pg.Pool
  const url = process.env.DATABASE_URL || 'postgres://localhost:5432/agentauth'
  const { PostgresStore } = await import('@xagentauth/core')
  const pool = new Pool({ connectionString: url })
  store = new PostgresStore(pool)
  console.log(`Store: postgres (${url.replace(/\/\/.*@/, '//<redacted>@')})`)
} else {
  store = new MemoryStore()
  console.log('Store: memory (not recommended for production)')
}

// --- Engine ---

const auth = new AgentAuth({
  secret,
  store,
  drivers: [
    new CryptoNLDriver(),
    new MultiStepDriver(),
    new AmbiguousLogicDriver(),
    new CodeExecutionDriver(),
  ],
  pomi: { enabled: process.env.POMI_ENABLED !== 'false' },
  timing: { enabled: process.env.TIMING_ENABLED !== 'false' },
})

// --- Health & Readiness ---

let ready = false

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', version: '1.0.0', store: backend })
})

app.get('/ready', (_req, res) => {
  if (ready) {
    res.json({ status: 'ready', store: backend })
  } else {
    res.status(503).json({ status: 'starting' })
  }
})

// --- Challenge endpoints ---

app.post('/v1/challenge/init', auth.challenge())
app.get('/v1/challenge/:id', auth.retrieve())
app.post('/v1/challenge/:id/solve', auth.verify())
app.get('/v1/token/verify', auth.tokenVerify())

// --- Leaderboard ---

const leaderboardStore = new MemoryLeaderboardStore()
app.use(createLeaderboardRouter(leaderboardStore))

// --- Start ---

const port = parseInt(process.env.PORT || '3000', 10)
app.listen(port, () => {
  ready = true
  console.log(`AgentAuth server listening on port ${port}`)
  console.log(`  PoMI:   ${process.env.POMI_ENABLED !== 'false' ? 'enabled' : 'disabled'}`)
  console.log(`  Timing: ${process.env.TIMING_ENABLED !== 'false' ? 'enabled' : 'disabled'}`)
})
