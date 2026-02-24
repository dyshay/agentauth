import express from 'express'
import { AgentAuth } from '@xagentauth/server'
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

const auth = new AgentAuth({
  secret,
  store: new MemoryStore(),
  drivers: [
    new CryptoNLDriver(),
    new MultiStepDriver(),
    new AmbiguousLogicDriver(),
    new CodeExecutionDriver(),
  ],
  pomi: { enabled: process.env.POMI_ENABLED !== 'false' },
  timing: { enabled: process.env.TIMING_ENABLED !== 'false' },
})

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', version: '1.0.0' })
})

app.post('/v1/challenge/init', auth.challenge())
app.get('/v1/challenge/:id', auth.retrieve())
app.post('/v1/challenge/:id/solve', auth.verify())
app.get('/v1/token/verify', auth.tokenVerify())

const port = parseInt(process.env.PORT || '3000', 10)
app.listen(port, () => {
  console.log(`AgentAuth server listening on port ${port}`)
  console.log(`  PoMI:   ${process.env.POMI_ENABLED !== 'false' ? 'enabled' : 'disabled'}`)
  console.log(`  Timing: ${process.env.TIMING_ENABLED !== 'false' ? 'enabled' : 'disabled'}`)
})
