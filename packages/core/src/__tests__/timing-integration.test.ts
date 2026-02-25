import { describe, it, expect } from 'vitest'
import { AgentAuthEngine } from '../engine.js'
import { MemoryStore } from '../stores/memory.js'
import { CryptoNLDriver } from '../challenges/crypto-nl.js'
import { hmacSha256Hex } from '../crypto.js'

describe('Timing integration with AgentAuthEngine', () => {
  function createEngine(timingEnabled = true) {
    return new AgentAuthEngine({
      secret: 'test-secret-at-least-32-chars-long!!',
      store: new MemoryStore(),
      drivers: [new CryptoNLDriver()],
      timing: timingEnabled ? { enabled: true } : undefined,
    })
  }

  async function initAndSolve(engine: AgentAuthEngine) {
    const init = await engine.initChallenge({ difficulty: 'easy' })
    const store = (engine as any).store as MemoryStore
    const data = await store.get(init.id)
    const driver = new CryptoNLDriver()
    const answer = await (driver as any).solve(data!.challenge.payload)
    const hmac = await hmacSha256Hex(answer, init.session_token)
    return { init, answer, hmac }
  }

  it('includes timing_analysis in verify result when timing enabled', async () => {
    // Use custom baselines with too_fast_ms=0 to prevent flaky too_fast rejections in tests
    const engine = new AgentAuthEngine({
      secret: 'test-secret-at-least-32-chars-long!!',
      store: new MemoryStore(),
      drivers: [new CryptoNLDriver()],
      timing: {
        enabled: true,
        baselines: [],
        defaultTooFastMs: 0,
        defaultAiUpperMs: 999999,
        defaultHumanMs: 9999999,
        defaultTimeoutMs: 99999999,
      },
    })
    const { init, answer, hmac } = await initAndSolve(engine)

    const result = await engine.solveChallenge(init.id, { answer, hmac })
    expect(result.success).toBe(true)
    expect(result.timing_analysis).toBeDefined()
    expect(result.timing_analysis!.zone).toBeDefined()
    expect(result.timing_analysis!.elapsed_ms).toBeGreaterThan(0)
  })

  it('does not include timing_analysis when timing disabled', async () => {
    const engine = createEngine(false)
    const { init, answer, hmac } = await initAndSolve(engine)

    const result = await engine.solveChallenge(init.id, { answer, hmac })
    expect(result.success).toBe(true)
    expect(result.timing_analysis).toBeUndefined()
  })

  it('speed score reflects timing penalty', async () => {
    // Use custom baselines with too_fast_ms=0 to prevent flaky too_fast rejections in tests
    const engine = new AgentAuthEngine({
      secret: 'test-secret-at-least-32-chars-long!!',
      store: new MemoryStore(),
      drivers: [new CryptoNLDriver()],
      timing: {
        enabled: true,
        baselines: [],
        defaultTooFastMs: 0,
        defaultAiUpperMs: 999999,
        defaultHumanMs: 9999999,
        defaultTimeoutMs: 99999999,
      },
    })
    const { init, answer, hmac } = await initAndSolve(engine)

    const result = await engine.solveChallenge(init.id, { answer, hmac })
    expect(result.success).toBe(true)
    // Since solve happens almost instantly in tests, it should be in ai_zone
    expect(result.timing_analysis!.zone).toBe('ai_zone')
    expect(result.score.speed).toBeCloseTo(0.95, 1) // no penalty
  })

  it('backward compatible — works without timing config', async () => {
    const engine = new AgentAuthEngine({
      secret: 'test-secret-at-least-32-chars-long!!',
      store: new MemoryStore(),
      drivers: [new CryptoNLDriver()],
    })
    const { init, answer, hmac } = await initAndSolve(engine)

    const result = await engine.solveChallenge(init.id, { answer, hmac })
    expect(result.success).toBe(true)
    expect(result.timing_analysis).toBeUndefined()
    // Without timing, speed uses default
    expect(result.score.speed).toBe(0.95)
  })

  it('too_fast rejection returns failure with reason', async () => {
    // Create engine with very high too_fast threshold to trigger rejection.
    // Pass empty baselines array so the analyzer falls back to defaults.
    const engine = new AgentAuthEngine({
      secret: 'test-secret-at-least-32-chars-long!!',
      store: new MemoryStore(),
      drivers: [new CryptoNLDriver()],
      timing: {
        enabled: true,
        baselines: [], // force fallback to custom defaults
        defaultTooFastMs: 999999, // Everything is "too fast"
        defaultAiLowerMs: 999999,
        defaultAiUpperMs: 9999999,
        defaultHumanMs: 99999999,
        defaultTimeoutMs: 999999999,
      },
    })
    const { init, answer, hmac } = await initAndSolve(engine)

    const result = await engine.solveChallenge(init.id, { answer, hmac })
    expect(result.success).toBe(false)
    expect(result.reason).toBe('too_fast')
    expect(result.timing_analysis).toBeDefined()
    expect(result.timing_analysis!.zone).toBe('too_fast')
  })
})
