import { describe, it, expect, beforeEach } from 'vitest'
import { AgentAuthEngine } from '../engine.js'
import { MemoryStore } from '../stores/memory.js'
import { CryptoNLDriver } from '../challenges/crypto-nl.js'

describe('AgentAuthEngine', () => {
  let engine: AgentAuthEngine
  let store: MemoryStore

  beforeEach(() => {
    store = new MemoryStore()
    engine = new AgentAuthEngine({
      secret: 'test-secret-that-is-at-least-32-bytes-long-for-hs256',
      store,
      drivers: [new CryptoNLDriver()],
      challengeTtlSeconds: 30,
      tokenTtlSeconds: 3600,
      minScore: 0.5,
    })
  })

  describe('initChallenge', () => {
    it('creates a challenge and returns session info', async () => {
      const result = await engine.initChallenge({ difficulty: 'easy' })
      expect(result.id).toMatch(/^ch_/)
      expect(result.session_token).toMatch(/^st_/)
      expect(result.expires_at).toBeGreaterThan(Date.now() / 1000)
      expect(result.ttl_seconds).toBe(30)
    })
  })

  describe('getChallenge', () => {
    it('retrieves a challenge by id + session token', async () => {
      const init = await engine.initChallenge({ difficulty: 'easy' })
      const challenge = await engine.getChallenge(init.id, init.session_token)
      expect(challenge).not.toBeNull()
      expect(challenge!.id).toBe(init.id)
      expect(challenge!.payload.type).toBe('crypto-nl')
      expect(challenge!.payload.instructions).toBeTruthy()
    })

    it('strips context from returned payload', async () => {
      const init = await engine.initChallenge({ difficulty: 'easy' })
      const challenge = await engine.getChallenge(init.id, init.session_token)
      expect(challenge).not.toBeNull()
      expect((challenge!.payload as Record<string, unknown>).context).toBeUndefined()
    })

    it('returns null for wrong session token', async () => {
      const init = await engine.initChallenge({ difficulty: 'easy' })
      const challenge = await engine.getChallenge(init.id, 'st_wrong')
      expect(challenge).toBeNull()
    })

    it('returns null for nonexistent id', async () => {
      const challenge = await engine.getChallenge('ch_nope', 'st_nope')
      expect(challenge).toBeNull()
    })

    it('does not include session_token in retrieved challenge', async () => {
      const init = await engine.initChallenge({ difficulty: 'easy' })
      const challenge = await engine.getChallenge(init.id, init.session_token)
      expect(challenge).not.toBeNull()
      expect((challenge as any).session_token).toBeUndefined()
    })
  })

  describe('solveChallenge', () => {
    it('accepts correct answer and returns token', async () => {
      const init = await engine.initChallenge({ difficulty: 'easy' })

      // Retrieve the full payload (with context) from the store to solve
      const stored = await store.get(init.id)
      const driver = new CryptoNLDriver()
      const answer = await driver.solve(stored!.challenge.payload)
      const { hmacSha256Hex } = await import('../crypto.js')
      const hmac = await hmacSha256Hex(answer, init.session_token)

      const result = await engine.solveChallenge(init.id, {
        answer,
        hmac,
      })

      expect(result.success).toBe(true)
      expect(result.token).toBeTruthy()
      expect(result.score.execution).toBeGreaterThan(0)
    })

    it('rejects wrong answer', async () => {
      const init = await engine.initChallenge({ difficulty: 'easy' })

      const { hmacSha256Hex } = await import('../crypto.js')
      const hmac = await hmacSha256Hex('wrong', init.session_token)

      const result = await engine.solveChallenge(init.id, {
        answer: 'wrong',
        hmac,
      })

      expect(result.success).toBe(false)
      expect(result.reason).toBe('wrong_answer')
    })

    it('rejects invalid HMAC', async () => {
      const init = await engine.initChallenge({ difficulty: 'easy' })

      // Get the full payload from store to compute correct answer
      const stored = await store.get(init.id)
      const driver = new CryptoNLDriver()
      const answer = await driver.solve(stored!.challenge.payload)

      const result = await engine.solveChallenge(init.id, {
        answer,
        hmac: 'invalid_hmac',
      })

      expect(result.success).toBe(false)
      expect(result.reason).toBe('invalid_hmac')
    })

    it('rejects already-used challenge', async () => {
      const init = await engine.initChallenge({ difficulty: 'easy' })

      // Get the full payload from store to compute correct answer
      const stored = await store.get(init.id)
      const driver = new CryptoNLDriver()
      const answer = await driver.solve(stored!.challenge.payload)
      const { hmacSha256Hex } = await import('../crypto.js')
      const hmac = await hmacSha256Hex(answer, init.session_token)

      await engine.solveChallenge(init.id, { answer, hmac })
      const result = await engine.solveChallenge(init.id, { answer, hmac })

      // After successful solve, challenge is deleted from store (single-use).
      // A second attempt sees it as nonexistent, which maps to 'expired'.
      expect(result.success).toBe(false)
      expect(result.reason).toBe('expired')
    })

    it('rejects nonexistent challenge', async () => {
      const result = await engine.solveChallenge('ch_nope', {
        answer: 'x',
        hmac: 'x',
      })
      expect(result.success).toBe(false)
      expect(result.reason).toBe('expired')
    })

    it('rejects timeout zone', async () => {
      // Use empty baselines to force fallback to custom defaults,
      // with all zone boundaries at zero so any real elapsed time exceeds timeout
      const timingEngine = new AgentAuthEngine({
        secret: 'test-secret-that-is-at-least-32-bytes-long-for-hs256',
        store,
        drivers: [new CryptoNLDriver()],
        timing: {
          enabled: true,
          baselines: [],
          defaultTooFastMs: 0,
          defaultAiLowerMs: 0,
          defaultAiUpperMs: 0,
          defaultHumanMs: 0,
          defaultTimeoutMs: 1,
        },
      })

      const init = await timingEngine.initChallenge({ difficulty: 'easy' })
      const stored = await store.get(init.id)
      const driver = new CryptoNLDriver()
      const answer = await driver.solve(stored!.challenge.payload)
      const { hmacSha256Hex } = await import('../crypto.js')
      const hmac = await hmacSha256Hex(answer, init.session_token)

      const result = await timingEngine.solveChallenge(init.id, { answer, hmac })
      expect(result.success).toBe(false)
      expect(result.reason).toBe('timeout')
    })
  })

  describe('registerDriver', () => {
    it('allows registering drivers at runtime', async () => {
      const engine = new AgentAuthEngine({
        secret: 'test-secret-that-is-at-least-32-bytes-long-for-hs256',
        store: new MemoryStore(),
      })
      engine.registerDriver(new CryptoNLDriver())
      const result = await engine.initChallenge({ difficulty: 'easy' })
      expect(result.id).toMatch(/^ch_/)
    })
  })

  describe('verifyToken', () => {
    it('verifies a valid token', async () => {
      const init = await engine.initChallenge({ difficulty: 'easy' })
      const stored = await store.get(init.id)
      const driver = new CryptoNLDriver()
      const answer = await driver.solve(stored!.challenge.payload)
      const { hmacSha256Hex } = await import('../crypto.js')
      const hmac = await hmacSha256Hex(answer, init.session_token)
      const solveResult = await engine.solveChallenge(init.id, { answer, hmac })

      const verification = await engine.verifyToken(solveResult.token!)
      expect(verification.valid).toBe(true)
      expect(verification.capabilities).toBeDefined()
    })

    it('rejects invalid token', async () => {
      const verification = await engine.verifyToken('not.a.token')
      expect(verification.valid).toBe(false)
    })
  })
})
