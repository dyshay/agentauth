import { describe, it, expect } from 'vitest'
import { TimingAnalyzer } from '../timing/analyzer.js'
import { SessionTimingTracker } from '../timing/session-tracker.js'

describe('Anti-gaming: round-number detection', () => {
  const analyzer = new TimingAnalyzer({
    enabled: true,
    baselines: [],
    defaultTooFastMs: 10,
    defaultAiLowerMs: 10,
    defaultAiUpperMs: 5000,
    defaultHumanMs: 15000,
    defaultTimeoutMs: 30000,
  })

  it('flags 500ms as round number', () => {
    const result = analyzer.analyze({ elapsed_ms: 500, challenge_type: 'x', difficulty: 'medium' })
    expect(result.zone).toBe('ai_zone')
    expect(result.details).toContain('round-number')
  })

  it('flags 1000ms as round number', () => {
    const result = analyzer.analyze({ elapsed_ms: 1000, challenge_type: 'x', difficulty: 'medium' })
    expect(result.details).toContain('round-number')
  })

  it('flags 2000ms as round number', () => {
    const result = analyzer.analyze({ elapsed_ms: 2000, challenge_type: 'x', difficulty: 'medium' })
    expect(result.details).toContain('round-number')
  })

  it('flags 100ms multiples as round number', () => {
    const result = analyzer.analyze({ elapsed_ms: 300, challenge_type: 'x', difficulty: 'medium' })
    expect(result.details).toContain('round-number')
  })

  it('does not flag non-round numbers', () => {
    const result = analyzer.analyze({ elapsed_ms: 347, challenge_type: 'x', difficulty: 'medium' })
    expect(result.zone).toBe('ai_zone')
    expect(result.details).not.toContain('round-number')
  })

  it('does not flag 123ms as round number', () => {
    const result = analyzer.analyze({ elapsed_ms: 123, challenge_type: 'x', difficulty: 'medium' })
    expect(result.details).not.toContain('round-number')
  })

  it('reduces confidence by 15% for round numbers', () => {
    const roundResult = analyzer.analyze({ elapsed_ms: 500, challenge_type: 'x', difficulty: 'medium' })
    const normalResult = analyzer.analyze({ elapsed_ms: 501, challenge_type: 'x', difficulty: 'medium' })
    expect(roundResult.confidence).toBeLessThan(normalResult.confidence)
  })

  it('does not flag round numbers outside ai_zone', () => {
    const result = analyzer.analyze({ elapsed_ms: 6000, challenge_type: 'x', difficulty: 'medium' })
    expect(result.zone).toBe('suspicious')
    expect(result.details).not.toContain('round-number')
  })
})

describe('Anti-gaming: SessionTimingTracker', () => {
  it('detects zone oscillation', () => {
    const tracker = new SessionTimingTracker()
    tracker.record('s1', 200, 'ai_zone')
    tracker.record('s1', 12000, 'human')
    tracker.record('s1', 300, 'ai_zone')

    const anomalies = tracker.analyze('s1')
    expect(anomalies.some((a) => a.type === 'zone_inconsistency')).toBe(true)
  })

  it('detects low variance (scripted)', () => {
    const tracker = new SessionTimingTracker()
    tracker.record('s2', 500, 'ai_zone')
    tracker.record('s2', 502, 'ai_zone')
    tracker.record('s2', 501, 'ai_zone')
    tracker.record('s2', 500, 'ai_zone')

    const anomalies = tracker.analyze('s2')
    expect(anomalies.some((a) => a.type === 'timing_variance_anomaly')).toBe(true)
  })

  it('detects rapid succession', () => {
    const tracker = new SessionTimingTracker()
    // Record two entries with minimal time gap
    tracker.record('s3', 200, 'ai_zone')
    tracker.record('s3', 300, 'ai_zone')

    const anomalies = tracker.analyze('s3')
    expect(anomalies.some((a) => a.type === 'rapid_succession')).toBe(true)
  })

  it('returns empty for single entry', () => {
    const tracker = new SessionTimingTracker()
    tracker.record('s4', 200, 'ai_zone')

    const anomalies = tracker.analyze('s4')
    expect(anomalies).toHaveLength(0)
  })

  it('returns empty for unknown session', () => {
    const tracker = new SessionTimingTracker()
    expect(tracker.analyze('unknown')).toHaveLength(0)
  })

  it('clears session data', () => {
    const tracker = new SessionTimingTracker()
    tracker.record('s5', 200, 'ai_zone')
    tracker.record('s5', 300, 'ai_zone')
    tracker.clear('s5')

    expect(tracker.analyze('s5')).toHaveLength(0)
  })

  it('does not flag consistent ai_zone sessions', () => {
    const tracker = new SessionTimingTracker()
    // Wait a bit between records to avoid rapid succession
    tracker.record('s6', 200, 'ai_zone')

    // Manually push entries with different timestamps to avoid rapid succession
    const entries = (tracker as any).sessions.get('s6')!
    entries[0].timestamp = Date.now() - 30000
    entries.push({ elapsed_ms: 350, zone: 'ai_zone', timestamp: Date.now() - 20000 })
    entries.push({ elapsed_ms: 280, zone: 'ai_zone', timestamp: Date.now() - 10000 })

    const anomalies = tracker.analyze('s6')
    // No zone inconsistency (all ai_zone), no low variance (varied timings), no rapid succession (spread out)
    expect(anomalies.some((a) => a.type === 'zone_inconsistency')).toBe(false)
    expect(anomalies.some((a) => a.type === 'timing_variance_anomaly')).toBe(false)
    expect(anomalies.some((a) => a.type === 'rapid_succession')).toBe(false)
  })

  it('is opt-in and disabled by default', async () => {
    // Import engine to verify session tracking is opt-in
    const { AgentAuthEngine } = await import('../engine.js')
    const { MemoryStore } = await import('../stores/memory.js')

    const engine = new AgentAuthEngine({
      secret: 'test-secret-that-is-at-least-32-bytes-long-for-hs256',
      store: new MemoryStore(),
      timing: { enabled: true },
    })

    // sessionTracker should not be initialized
    expect((engine as any).sessionTracker).toBeUndefined()
  })

  it('is enabled with sessionTracking config', async () => {
    const { AgentAuthEngine } = await import('../engine.js')
    const { MemoryStore } = await import('../stores/memory.js')

    const engine = new AgentAuthEngine({
      secret: 'test-secret-that-is-at-least-32-bytes-long-for-hs256',
      store: new MemoryStore(),
      timing: { enabled: true, sessionTracking: { enabled: true } },
    })

    expect((engine as any).sessionTracker).toBeDefined()
  })
})
