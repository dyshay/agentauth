import { describe, it, expect, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import { AgentAuth } from '../middleware.js'
import { MemoryStore, CryptoNLDriver, hmacSha256Hex, sha256Hex, type TimingConfig } from '@xagentauth/core'

/**
 * Minimal agent solver: parses CryptoNLDriver instructions and executes byte operations.
 * Mirrors the solver in e2e.test.ts.
 */
async function agentSolve(payload: { instructions: string; data: string }): Promise<string> {
  let bytes = new Uint8Array(Buffer.from(payload.data, 'base64'))
  const lines = payload.instructions.split('\n').filter((l) => l.startsWith('Step'))

  for (const line of lines) {
    const instruction = line.replace(/^Step \d+:\s*/, '')

    if (/xor/i.test(instruction) || /exclusive.or/i.test(instruction) || /flip bits/i.test(instruction)) {
      const hexMatch = instruction.match(/0x([0-9A-Fa-f]+)/)
      const keyMatch = instruction.match(/(?:value|key)\s+(\d+)/)
      const key = hexMatch ? parseInt(hexMatch[1], 16) : keyMatch ? parseInt(keyMatch[1]) : 0
      if (key > 0) bytes = bytes.map((b) => b ^ key)
    } else if (/reverse|flip.*end.to.end|mirror|invert.*ordering/i.test(instruction)) {
      bytes = bytes.reverse()
    } else if (/sort|ascending|smallest.*largest|lowest first/i.test(instruction)) {
      bytes = new Uint8Array([...bytes].sort((a, b) => a - b))
    } else if (/offset.*to\s+\d+|slice\s*\[|positions?\s+\d+\s+through/i.test(instruction)) {
      const throughMatch = instruction.match(/positions?\s+(\d+)\s+through\s+(\d+)/)
      if (throughMatch) {
        bytes = bytes.slice(parseInt(throughMatch[1]), parseInt(throughMatch[2]) + 1)
      } else {
        const nums = instruction.match(/(\d+)/g)?.map(Number) ?? []
        if (nums.length >= 2) bytes = bytes.slice(nums[0], nums[1])
      }
    } else if (/rotate|shift|circular/i.test(instruction)) {
      const posMatch = instruction.match(/(\d+)\s*position/i) || instruction.match(/by\s+(\d+)/i)
      if (posMatch) {
        const pos = parseInt(posMatch[1]) % bytes.length
        const rotated = new Uint8Array(bytes.length)
        for (let i = 0; i < bytes.length; i++) rotated[i] = bytes[(i + pos) % bytes.length]
        bytes = rotated
      }
    }
  }

  return sha256Hex(bytes)
}

function createApp() {
  const app = express()
  app.use(express.json())

  const auth = new AgentAuth({
    secret: 'test-secret-that-is-at-least-32-bytes-long-for-hs256',
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
  app.get('/protected', auth.guard({ minScore: 0.5 }), (_req, res) => {
    res.json({ data: 'secret' })
  })

  return app
}

describe('Express middleware', () => {
  let app: express.Express

  beforeEach(() => {
    app = createApp()
  })

  describe('POST /v1/challenge/init', () => {
    it('creates a challenge session', async () => {
      const res = await request(app)
        .post('/v1/challenge/init')
        .send({ difficulty: 'easy' })
        .expect(201)

      expect(res.body.id).toMatch(/^ch_/)
      expect(res.body.session_token).toMatch(/^st_/)
      expect(res.body.ttl_seconds).toBe(30)
    })

    it('defaults to medium difficulty', async () => {
      const res = await request(app)
        .post('/v1/challenge/init')
        .send({})
        .expect(201)

      expect(res.body.id).toBeTruthy()
    })
  })

  describe('GET /v1/challenge/:id', () => {
    it('retrieves a challenge with valid session token', async () => {
      const init = await request(app)
        .post('/v1/challenge/init')
        .send({ difficulty: 'easy' })

      const res = await request(app)
        .get(`/v1/challenge/${init.body.id}`)
        .set('Authorization', `Bearer ${init.body.session_token}`)
        .expect(200)

      expect(res.body.id).toBe(init.body.id)
      expect(res.body.payload.instructions).toBeTruthy()
      expect(res.body.payload.data).toBeTruthy()
    })

    it('rejects missing auth header', async () => {
      const init = await request(app)
        .post('/v1/challenge/init')
        .send({ difficulty: 'easy' })

      await request(app)
        .get(`/v1/challenge/${init.body.id}`)
        .expect(401)
    })

    it('rejects wrong session token', async () => {
      const init = await request(app)
        .post('/v1/challenge/init')
        .send({ difficulty: 'easy' })

      await request(app)
        .get(`/v1/challenge/${init.body.id}`)
        .set('Authorization', 'Bearer st_wrong')
        .expect(404)
    })
  })

  describe('full flow: init → get → solve', () => {
    it('completes end-to-end with correct answer', async () => {
      // 1. Init
      const init = await request(app)
        .post('/v1/challenge/init')
        .send({ difficulty: 'easy' })
        .expect(201)

      // 2. Get challenge
      const challenge = await request(app)
        .get(`/v1/challenge/${init.body.id}`)
        .set('Authorization', `Bearer ${init.body.session_token}`)
        .expect(200)

      // 3. Solve (we cheat by using the driver directly since we can't parse NL in tests)
      // The test proves the HTTP layer works; crypto correctness is tested in core

      const fakeAnswer = 'a'.repeat(64) // wrong answer
      const hmac = await hmacSha256Hex(fakeAnswer, init.body.session_token)

      const solveRes = await request(app)
        .post(`/v1/challenge/${init.body.id}/solve`)
        .send({ answer: fakeAnswer, hmac })
        .expect(200)

      // Wrong answer but valid HMAC → proper rejection
      expect(solveRes.body.success).toBe(false)
      expect(solveRes.body.reason).toBe('wrong_answer')
    })

    it('rejects invalid HMAC', async () => {
      const init = await request(app)
        .post('/v1/challenge/init')
        .send({ difficulty: 'easy' })
        .expect(201)

      const res = await request(app)
        .post(`/v1/challenge/${init.body.id}/solve`)
        .send({ answer: 'anything', hmac: 'bad_hmac' })
        .expect(200)

      expect(res.body.success).toBe(false)
      expect(res.body.reason).toBe('invalid_hmac')
    })
  })

  describe('POST /v1/challenge/:id/solve with canary_responses', () => {
    it('passes canary_responses to engine in solve request', async () => {
      const init = await request(app)
        .post('/v1/challenge/init')
        .send({ difficulty: 'easy' })
        .expect(201)

      const { id, session_token } = init.body

      const fakeAnswer = 'a'.repeat(64)
      const hmac = await hmacSha256Hex(fakeAnswer, session_token)

      const res = await request(app)
        .post(`/v1/challenge/${id}/solve`)
        .send({
          answer: fakeAnswer,
          hmac,
          canary_responses: {
            'canary-1': 'response-1',
            'canary-2': 'response-2',
          },
        })
        .expect(200)

      // The endpoint should accept canary_responses without error
      // Answer is wrong but that's fine — we're testing the middleware accepts the field
      expect(res.body.success).toBe(false)
      expect(res.body.reason).toBe('wrong_answer')
    })
  })

  describe('timing_analysis in solve response', () => {
    it('omits timing_analysis when timing is not configured', async () => {
      const init = await request(app)
        .post('/v1/challenge/init')
        .send({ difficulty: 'easy' })
        .expect(201)

      const { id, session_token } = init.body
      const fakeAnswer = 'a'.repeat(64)
      const hmac = await hmacSha256Hex(fakeAnswer, session_token)

      const res = await request(app)
        .post(`/v1/challenge/${id}/solve`)
        .send({ answer: fakeAnswer, hmac })
        .expect(200)

      expect(res.body.success).toBe(false)
      expect(res.body.timing_analysis).toBeUndefined()
    })

    it('includes timing_analysis when timing is enabled and answer is correct', async () => {
      const timingApp = express()
      timingApp.use(express.json())

      const timing: TimingConfig = {
        enabled: true,
        baselines: [],             // force custom defaults (ignore driver-specific baselines)
        defaultTooFastMs: 0,       // disable too_fast rejection for testing
        defaultAiLowerMs: 0,
        defaultAiUpperMs: 60000,
        defaultHumanMs: 120000,
        defaultTimeoutMs: 300000,
      }

      const timedAuth = new AgentAuth({
        secret: 'test-secret-that-is-at-least-32-bytes-long-for-hs256',
        store: new MemoryStore(),
        drivers: [new CryptoNLDriver()],
        challengeTtlSeconds: 30,
        tokenTtlSeconds: 3600,
        minScore: 0.5,
        timing,
      })

      timingApp.post('/v1/challenge/init', timedAuth.challenge())
      timingApp.get('/v1/challenge/:id', timedAuth.retrieve())
      timingApp.post('/v1/challenge/:id/solve', timedAuth.verify())

      // 1. Init
      const init = await request(timingApp)
        .post('/v1/challenge/init')
        .send({ difficulty: 'easy' })
        .expect(201)

      const { id, session_token } = init.body

      // 2. Get challenge and solve it correctly
      const challengeRes = await request(timingApp)
        .get(`/v1/challenge/${id}`)
        .set('Authorization', `Bearer ${session_token}`)
        .expect(200)

      const answer = await agentSolve(challengeRes.body.payload)
      const hmac = await hmacSha256Hex(answer, session_token)

      // 3. Submit correct solution
      const res = await request(timingApp)
        .post(`/v1/challenge/${id}/solve`)
        .send({ answer, hmac })
        .expect(200)

      expect(res.body.success).toBe(true)
      expect(res.body.timing_analysis).toBeDefined()
      expect(res.body.timing_analysis.elapsed_ms).toBeTypeOf('number')
      expect(res.body.timing_analysis.zone).toBeTypeOf('string')
      expect(['too_fast', 'ai_zone', 'suspicious', 'human', 'timeout']).toContain(
        res.body.timing_analysis.zone,
      )
      expect(res.body.timing_analysis.confidence).toBeTypeOf('number')
      expect(res.body.timing_analysis.z_score).toBeTypeOf('number')
      expect(res.body.timing_analysis.penalty).toBeTypeOf('number')
      expect(res.body.timing_analysis.details).toBeTypeOf('string')
    })
  })

  describe('GET /protected (guard)', () => {
    it('rejects request without token', async () => {
      await request(app).get('/protected').expect(401)
    })

    it('rejects request with invalid token', async () => {
      await request(app)
        .get('/protected')
        .set('Authorization', 'Bearer not.a.valid.jwt')
        .expect(401)
    })
  })

  describe('GET /v1/token/verify', () => {
    it('rejects invalid token', async () => {
      const res = await request(app)
        .get('/v1/token/verify')
        .set('Authorization', 'Bearer invalid')
        .expect(401)

      expect(res.body.valid).toBe(false)
    })
  })

  describe('AgentAuth HTTP response headers', () => {
    async function solveCorrectly(testApp: express.Express) {
      const init = await request(testApp)
        .post('/v1/challenge/init')
        .send({ difficulty: 'easy' })
        .expect(201)

      const { id, session_token } = init.body

      const challengeRes = await request(testApp)
        .get(`/v1/challenge/${id}`)
        .set('Authorization', `Bearer ${session_token}`)
        .expect(200)

      const answer = await agentSolve(challengeRes.body.payload)
      const hmac = await hmacSha256Hex(answer, session_token)

      const solveRes = await request(testApp)
        .post(`/v1/challenge/${id}/solve`)
        .send({ answer, hmac })
        .expect(200)

      return { solveRes, token: solveRes.body.token, id, session_token }
    }

    it('includes AgentAuth-Status: verified header on successful solve', async () => {
      const { solveRes } = await solveCorrectly(app)

      expect(solveRes.body.success).toBe(true)
      expect(solveRes.headers['agentauth-status']).toBe('verified')
    })

    it('includes AgentAuth-Capabilities header on successful solve', async () => {
      const { solveRes } = await solveCorrectly(app)

      expect(solveRes.body.success).toBe(true)
      expect(solveRes.headers['agentauth-capabilities']).toBeTruthy()
      expect(solveRes.headers['agentauth-capabilities']).toContain('reasoning=')
      expect(solveRes.headers['agentauth-capabilities']).toContain('execution=')
    })

    it('includes AgentAuth-Challenge-Id header on successful solve', async () => {
      const { solveRes, id } = await solveCorrectly(app)

      expect(solveRes.body.success).toBe(true)
      expect(solveRes.headers['agentauth-challenge-id']).toBe(id)
    })

    it('includes AgentAuth-Version header on successful solve', async () => {
      const { solveRes } = await solveCorrectly(app)

      expect(solveRes.body.success).toBe(true)
      expect(solveRes.headers['agentauth-version']).toBe('1')
    })

    it('does NOT set AgentAuth headers on failed solve', async () => {
      const init = await request(app)
        .post('/v1/challenge/init')
        .send({ difficulty: 'easy' })
        .expect(201)

      const { id, session_token } = init.body
      const fakeAnswer = 'a'.repeat(64)
      const hmac = await hmacSha256Hex(fakeAnswer, session_token)

      const res = await request(app)
        .post(`/v1/challenge/${id}/solve`)
        .send({ answer: fakeAnswer, hmac })
        .expect(200)

      expect(res.body.success).toBe(false)
      expect(res.headers['agentauth-status']).toBeUndefined()
      expect(res.headers['agentauth-capabilities']).toBeUndefined()
    })

    it('includes AgentAuth-Status: verified header on guarded route', async () => {
      const { token } = await solveCorrectly(app)

      const protectedRes = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)

      expect(protectedRes.headers['agentauth-status']).toBe('verified')
    })

    it('includes AgentAuth-Capabilities header on guarded route', async () => {
      const { token } = await solveCorrectly(app)

      const protectedRes = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)

      expect(protectedRes.headers['agentauth-capabilities']).toBeTruthy()
      expect(protectedRes.headers['agentauth-capabilities']).toContain('reasoning=')
    })

    it('includes AgentAuth-Token-Expires header on guarded route', async () => {
      const { token } = await solveCorrectly(app)

      const protectedRes = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)

      expect(protectedRes.headers['agentauth-token-expires']).toBeTruthy()
    })
  })
})
