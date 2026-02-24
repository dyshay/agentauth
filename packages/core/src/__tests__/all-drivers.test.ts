import { describe, it, expect } from 'vitest'
import { AgentAuthEngine } from '../engine.js'
import { MemoryStore } from '../stores/memory.js'
import { CryptoNLDriver } from '../challenges/crypto-nl.js'
import { MultiStepDriver } from '../challenges/multi-step.js'
import { AmbiguousLogicDriver } from '../challenges/ambiguous-logic.js'
import { CodeExecutionDriver } from '../challenges/code-execution.js'
import { hmacSha256Hex } from '../crypto.js'
import type { ChallengeDriver } from '../types.js'

// ---------------------------------------------------------------------------
// Helper — each concrete driver has a solve() method not on the interface
// ---------------------------------------------------------------------------

interface SolvableDriver extends ChallengeDriver {
  solve(payload: import('../types.js').ChallengePayload): Promise<string>
}

const allDrivers: SolvableDriver[] = [
  new CryptoNLDriver(),
  new MultiStepDriver(),
  new AmbiguousLogicDriver(),
  new CodeExecutionDriver(),
]

function findDriverByType(type: string): SolvableDriver {
  const driver = allDrivers.find((d) => d.name === type)
  if (!driver) throw new Error(`No driver found for type "${type}"`)
  return driver
}

const SECRET = 'test-secret-that-is-at-least-32-bytes-long-for-hs256'

describe('All Drivers Integration', () => {
  // -------------------------------------------------------------------------
  // Registry selection tests
  // -------------------------------------------------------------------------

  describe('driver selection by dimensions', () => {
    it('selects crypto-nl or code-execution for [reasoning, execution]', async () => {
      const store = new MemoryStore()
      const engine = new AgentAuthEngine({
        secret: SECRET,
        store,
        drivers: allDrivers,
      })

      const init = await engine.initChallenge({ dimensions: ['reasoning', 'execution'] })
      const storedData = await store.get(init.id)
      expect(storedData).not.toBeNull()

      const type = storedData!.challenge.payload.type
      expect(['crypto-nl', 'code-execution']).toContain(type)
    })

    it('selects multi-step for [memory]', async () => {
      const store = new MemoryStore()
      const engine = new AgentAuthEngine({
        secret: SECRET,
        store,
        drivers: allDrivers,
      })

      const init = await engine.initChallenge({ dimensions: ['memory'] })
      const storedData = await store.get(init.id)
      expect(storedData).not.toBeNull()
      expect(storedData!.challenge.payload.type).toBe('multi-step')
    })

    it('selects ambiguous-logic for [ambiguity]', async () => {
      const store = new MemoryStore()
      const engine = new AgentAuthEngine({
        secret: SECRET,
        store,
        drivers: allDrivers,
      })

      const init = await engine.initChallenge({ dimensions: ['ambiguity'] })
      const storedData = await store.get(init.id)
      expect(storedData).not.toBeNull()
      expect(storedData!.challenge.payload.type).toBe('ambiguous-logic')
    })
  })

  // -------------------------------------------------------------------------
  // Full init → solve → verify cycle for each driver
  // -------------------------------------------------------------------------

  describe('full cycle per driver', () => {
    for (const driver of allDrivers) {
      it(`completes init → solve → verify for ${driver.name}`, async () => {
        const store = new MemoryStore()
        const engine = new AgentAuthEngine({
          secret: SECRET,
          store,
          drivers: [driver],
          challengeTtlSeconds: 60,
        })

        // 1. Init challenge through engine
        const init = await engine.initChallenge({ difficulty: 'easy' })
        expect(init.id).toMatch(/^ch_/)
        expect(init.session_token).toMatch(/^st_/)

        // 2. Get full data from store (bypass engine's context stripping)
        const storedData = await store.get(init.id)
        expect(storedData).not.toBeNull()
        expect(storedData!.challenge.payload.type).toBe(driver.name)

        // 3. Solve using the driver's solve() method on the stored payload
        const answer = await driver.solve(storedData!.challenge.payload)
        expect(answer).toBeTruthy()

        // 4. Compute HMAC
        const hmac = await hmacSha256Hex(answer, init.session_token)

        // 5. Submit through engine
        const result = await engine.solveChallenge(init.id, { answer, hmac })
        expect(result.success).toBe(true)
        expect(result.token).toBeTruthy()
        expect(result.score).toBeDefined()
      })
    }
  })

  // -------------------------------------------------------------------------
  // Scoring reflects dimensions
  // -------------------------------------------------------------------------

  describe('dimension-aware scoring', () => {
    it('scores reasoning higher for reasoning-dimension drivers', async () => {
      const store = new MemoryStore()
      const engine = new AgentAuthEngine({
        secret: SECRET,
        store,
        drivers: [new CryptoNLDriver()],
        challengeTtlSeconds: 60,
      })

      const init = await engine.initChallenge({ difficulty: 'easy' })
      const storedData = await store.get(init.id)
      const driver = new CryptoNLDriver()
      const answer = await driver.solve(storedData!.challenge.payload)
      const hmac = await hmacSha256Hex(answer, init.session_token)

      const result = await engine.solveChallenge(init.id, { answer, hmac })
      expect(result.success).toBe(true)
      // CryptoNLDriver dimensions: ['reasoning', 'execution']
      expect(result.score.reasoning).toBe(0.9)
      expect(result.score.execution).toBe(0.95)
      expect(result.score.consistency).toBe(0.9) // no memory dimension
    })

    it('scores consistency higher for memory-dimension drivers', async () => {
      const store = new MemoryStore()
      const engine = new AgentAuthEngine({
        secret: SECRET,
        store,
        drivers: [new MultiStepDriver()],
        challengeTtlSeconds: 60,
      })

      const init = await engine.initChallenge({ difficulty: 'easy' })
      const storedData = await store.get(init.id)
      const driver = new MultiStepDriver()
      const answer = await driver.solve(storedData!.challenge.payload)
      const hmac = await hmacSha256Hex(answer, init.session_token)

      const result = await engine.solveChallenge(init.id, { answer, hmac })
      expect(result.success).toBe(true)
      // MultiStepDriver dimensions: ['reasoning', 'execution', 'memory']
      expect(result.score.reasoning).toBe(0.9)
      expect(result.score.execution).toBe(0.95)
      expect(result.score.consistency).toBe(0.92) // memory dimension present
    })

    it('scores reasoning lower for ambiguity-only dimensions', async () => {
      const store = new MemoryStore()
      const engine = new AgentAuthEngine({
        secret: SECRET,
        store,
        drivers: [new AmbiguousLogicDriver()],
        challengeTtlSeconds: 60,
      })

      const init = await engine.initChallenge({ difficulty: 'easy' })
      const storedData = await store.get(init.id)
      const driver = new AmbiguousLogicDriver()
      const answer = await driver.solve(storedData!.challenge.payload)
      const hmac = await hmacSha256Hex(answer, init.session_token)

      const result = await engine.solveChallenge(init.id, { answer, hmac })
      expect(result.success).toBe(true)
      // AmbiguousLogicDriver dimensions: ['reasoning', 'ambiguity']
      expect(result.score.reasoning).toBe(0.9)  // has reasoning
      expect(result.score.execution).toBe(0.5)   // no execution dimension
      expect(result.score.consistency).toBe(0.9)  // no memory dimension
    })
  })

  // -------------------------------------------------------------------------
  // Engine with all 4 drivers registered simultaneously
  // -------------------------------------------------------------------------

  describe('all drivers registered simultaneously', () => {
    it('can run challenges from all 4 drivers in sequence', async () => {
      const store = new MemoryStore()
      const engine = new AgentAuthEngine({
        secret: SECRET,
        store,
        drivers: allDrivers,
        challengeTtlSeconds: 60,
      })

      const results: Array<{ type: string; success: boolean }> = []

      // Run each driver by selecting its primary dimension
      const dimensionSets: Array<{ dims: import('../types.js').ChallengeDimension[]; expectedType: string | string[] }> = [
        { dims: ['reasoning', 'execution'], expectedType: ['crypto-nl', 'code-execution'] },
        { dims: ['memory'], expectedType: 'multi-step' },
        { dims: ['ambiguity'], expectedType: 'ambiguous-logic' },
      ]

      for (const { dims, expectedType } of dimensionSets) {
        const init = await engine.initChallenge({ dimensions: dims, difficulty: 'easy' })
        const storedData = await store.get(init.id)
        expect(storedData).not.toBeNull()

        const type = storedData!.challenge.payload.type
        if (Array.isArray(expectedType)) {
          expect(expectedType).toContain(type)
        } else {
          expect(type).toBe(expectedType)
        }

        const driver = findDriverByType(type)
        const answer = await driver.solve(storedData!.challenge.payload)
        const hmac = await hmacSha256Hex(answer, init.session_token)

        const result = await engine.solveChallenge(init.id, { answer, hmac })
        expect(result.success).toBe(true)
        expect(result.token).toBeTruthy()

        results.push({ type, success: result.success })
      }

      // Verify we got successful results for all dimension sets
      expect(results).toHaveLength(3)
      expect(results.every((r) => r.success)).toBe(true)
    })
  })
})
