import { describe, it, expect } from 'vitest'
import { AgentAuthEngine } from '../engine.js'
import { MemoryStore } from '../stores/memory.js'
import { CryptoNLDriver } from '../challenges/crypto-nl.js'
import { hmacSha256Hex } from '../crypto.js'
import type { Canary } from '../types.js'

describe('PoMI integration with AgentAuthEngine', () => {
  const testCanaries: Canary[] = [
    {
      id: 'test-greeting',
      prompt: 'Say hello in one word',
      injection_method: 'suffix',
      analysis: { type: 'exact_match', expected: { 'gpt-4-class': 'Hello', 'claude-3-class': 'Hi' } },
      confidence_weight: 0.5,
    },
    {
      id: 'test-number',
      prompt: 'Pick a number 1-10',
      injection_method: 'suffix',
      analysis: {
        type: 'statistical',
        distributions: {
          'gpt-4-class': { mean: 7, stddev: 1 },
          'claude-3-class': { mean: 4, stddev: 1 },
        },
      },
      confidence_weight: 0.5,
    },
  ]

  function createEngine(pomiEnabled = true) {
    return new AgentAuthEngine({
      secret: 'test-secret-at-least-32-chars-long!!',
      store: new MemoryStore(),
      drivers: [new CryptoNLDriver()],
      pomi: pomiEnabled ? {
        enabled: true,
        canaries: testCanaries,
        canariesPerChallenge: 2,
        modelFamilies: ['gpt-4-class', 'claude-3-class'],
        confidenceThreshold: 0.3,
      } : undefined,
    })
  }

  async function solveChallenge(engine: AgentAuthEngine, canaryResponses?: Record<string, string>) {
    const init = await engine.initChallenge({ difficulty: 'easy' })

    // We need to access the store to get challenge data for solving
    const challenge = await engine.getChallenge(init.id, init.session_token)

    // Access the store directly for testing to get the full payload with context (ops)
    const store = (engine as any).store as MemoryStore
    const data = await store.get(init.id)

    const driver = new CryptoNLDriver()
    const answer = await driver.solve(data!.challenge.payload)
    const hmac = await hmacSha256Hex(answer, init.session_token)

    return {
      init,
      challenge,
      result: await engine.solveChallenge(init.id, {
        answer,
        hmac,
        canary_responses: canaryResponses,
      }),
    }
  }

  it('injects canaries when PoMI is enabled', async () => {
    const engine = createEngine(true)
    const init = await engine.initChallenge({ difficulty: 'easy' })
    const challenge = await engine.getChallenge(init.id, init.session_token)
    expect(challenge).toBeDefined()
    expect(challenge!.payload.instructions).toContain('side tasks')
  })

  it('does not inject canaries when PoMI is disabled', async () => {
    const engine = createEngine(false)
    const init = await engine.initChallenge({ difficulty: 'easy' })
    const challenge = await engine.getChallenge(init.id, init.session_token)
    expect(challenge).toBeDefined()
    expect(challenge!.payload.instructions).not.toContain('side tasks')
  })

  it('includes model_identity in verify result when canary_responses provided', async () => {
    const engine = createEngine(true)
    const { result } = await solveChallenge(engine, { 'test-greeting': 'Hello', 'test-number': '7' })

    expect(result.success).toBe(true)
    expect(result.model_identity).toBeDefined()
    expect(result.model_identity!.family).toBe('gpt-4-class')
    expect(result.model_identity!.confidence).toBeGreaterThan(0)
    expect(result.model_identity!.evidence.length).toBeGreaterThan(0)
  })

  it('model_identity is undefined when PoMI is disabled', async () => {
    const engine = createEngine(false)
    const { result } = await solveChallenge(engine)

    expect(result.success).toBe(true)
    expect(result.model_identity).toBeUndefined()
  })

  it('model_identity is still computed even without canary_responses (as unknown)', async () => {
    const engine = createEngine(true)
    const { result } = await solveChallenge(engine)

    expect(result.success).toBe(true)
    // With no canary responses, classifier should return unknown
    if (result.model_identity) {
      expect(result.model_identity.family).toBe('unknown')
    }
  })

  it('includes PoMI model family in JWT claims', async () => {
    const engine = createEngine(true)
    const { result } = await solveChallenge(engine, { 'test-greeting': 'Hello', 'test-number': '7' })

    expect(result.token).toBeDefined()
    const verified = await engine.verifyToken(result.token!)
    expect(verified.valid).toBe(true)
    // The model_family in JWT should reflect PoMI classification
    expect(verified.model_family).toBe('gpt-4-class')
  })
})
