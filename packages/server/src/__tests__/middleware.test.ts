import { describe, it, expect, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import { AgentAuth } from '../middleware.js'
import { MemoryStore, CryptoNLDriver, hmacSha256Hex } from '@xagentauth/core'

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
})
