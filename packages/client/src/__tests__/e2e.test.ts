import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import express from 'express'
import { AgentAuth } from '@xagentauth/server'
import { MemoryStore, CryptoNLDriver } from '@xagentauth/core'
import { AgentAuthClient } from '../client.js'

describe('AgentAuthClient e2e', () => {
  let server: ReturnType<express.Express['listen']>
  let baseUrl: string

  beforeAll(async () => {
    const app = express()
    app.use(express.json())

    const auth = new AgentAuth({
      secret: 'test-secret-at-least-32-chars-long!!',
      store: new MemoryStore(),
      drivers: [new CryptoNLDriver()],
    })

    app.post('/v1/challenge/init', auth.challenge())
    app.get('/v1/challenge/:id', auth.retrieve())
    app.post('/v1/challenge/:id/solve', auth.verify())
    app.get('/v1/token/verify', auth.tokenVerify())

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address()
        if (addr && typeof addr === 'object') {
          baseUrl = `http://localhost:${addr.port}`
        }
        resolve()
      })
    })
  })

  afterAll(() => {
    server?.close()
  })

  it('completes full challenge flow step by step', async () => {
    const client = new AgentAuthClient({ baseUrl })

    // Init
    const init = await client.initChallenge({ difficulty: 'easy' })
    expect(init.id).toBeDefined()
    expect(init.session_token).toBeDefined()
    expect(init.expires_at).toBeGreaterThan(0)
    expect(init.ttl_seconds).toBeGreaterThan(0)

    // Get challenge
    const challenge = await client.getChallenge(init.id, init.session_token)
    expect(challenge.payload.type).toBe('crypto-nl')
    expect(challenge.difficulty).toBe('easy')
    expect(challenge.dimensions).toBeDefined()
  })

  it('authenticates using one-call method with wrong answer', async () => {
    const client = new AgentAuthClient({ baseUrl })

    // The solver returns a wrong answer, but we exercise the full flow
    const result = await client.authenticate({
      difficulty: 'easy',
      solver: async (_challenge) => {
        return { answer: 'test-answer' }
      },
    })

    // The answer is wrong, so it should fail
    expect(result.success).toBe(false)
    expect(result.reason).toBe('wrong_answer')
  })

  it('verifies an invalid token', async () => {
    const client = new AgentAuthClient({ baseUrl })

    // AgentAuthError is thrown because the server returns 401
    // for invalid tokens — our client throws on non-ok responses
    await expect(client.verifyToken('invalid-token')).rejects.toThrow()
  })
})
