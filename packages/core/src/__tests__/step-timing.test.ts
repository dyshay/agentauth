import { describe, it, expect } from 'vitest'
import { AgentAuthEngine } from '../engine.js'
import { MemoryStore } from '../stores/memory.js'
import { CryptoNLDriver } from '../challenges/crypto-nl.js'

describe('Per-step timing', () => {
  const store = new MemoryStore()
  const engine = new AgentAuthEngine({
    secret: 'test-secret-that-is-at-least-32-bytes-long-for-hs256',
    store,
    drivers: [new CryptoNLDriver()],
    timing: {
      enabled: true,
      baselines: [],
      defaultTooFastMs: 0,
      defaultAiLowerMs: 0,
      defaultAiUpperMs: 60000,
      defaultHumanMs: 120000,
      defaultTimeoutMs: 300000,
    },
  })

  async function solveWithStepTimings(stepTimings?: number[]) {
    const init = await engine.initChallenge({ difficulty: 'easy' })
    const stored = await store.get(init.id)
    const driver = new CryptoNLDriver()
    const answer = await driver.solve(stored!.challenge.payload)
    const { hmacSha256Hex } = await import('../crypto.js')
    const hmac = await hmacSha256Hex(answer, init.session_token)
    return engine.solveChallenge(init.id, { answer, hmac, step_timings: stepTimings })
  }

  it('artificial patterns reduce autonomy and consistency scores', async () => {
    // Constant timings = artificial
    const result = await solveWithStepTimings([500, 500, 500, 500, 500])
    expect(result.success).toBe(true)
    expect(result.pattern_analysis).toBeDefined()
    expect(result.pattern_analysis!.verdict).toBe('artificial')
    expect(result.score.autonomy).toBeLessThan(0.9)
    expect(result.score.consistency).toBeLessThan(0.9)
  })

  it('natural patterns do not penalize scores', async () => {
    // Variable timings = natural
    const result = await solveWithStepTimings([234, 456, 123, 678, 345, 567])
    expect(result.success).toBe(true)
    expect(result.pattern_analysis).toBeDefined()
    expect(result.pattern_analysis!.verdict).toBe('natural')
    expect(result.score.autonomy).toBeGreaterThanOrEqual(0.9 * 0.99)
  })

  it('missing step_timings produces no pattern_analysis (backward compatible)', async () => {
    const result = await solveWithStepTimings(undefined)
    expect(result.success).toBe(true)
    expect(result.pattern_analysis).toBeUndefined()
    // Scores are not penalized by pattern analysis
    expect(result.score.consistency).toBeGreaterThanOrEqual(0.89)
  })

  it('empty step_timings produces no pattern_analysis', async () => {
    const result = await solveWithStepTimings([])
    expect(result.success).toBe(true)
    expect(result.pattern_analysis).toBeUndefined()
  })

  it('round-number step timings are detected as artificial', async () => {
    const result = await solveWithStepTimings([500, 1000, 500, 1000, 500, 1000])
    expect(result.success).toBe(true)
    expect(result.pattern_analysis!.verdict).toBe('artificial')
    expect(result.pattern_analysis!.round_number_ratio).toBeGreaterThan(0.5)
  })

  it('pattern analysis includes trend information', async () => {
    const result = await solveWithStepTimings([200, 300, 500, 800, 1200, 2000])
    expect(result.success).toBe(true)
    expect(result.pattern_analysis!.trend).toBe('increasing')
  })
})
