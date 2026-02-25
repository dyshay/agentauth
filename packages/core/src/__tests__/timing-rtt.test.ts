import { describe, it, expect } from 'vitest'
import { TimingAnalyzer } from '../timing/analyzer.js'

describe('RTT compensation', () => {
  const analyzer = new TimingAnalyzer({
    enabled: true,
    defaultTooFastMs: 50,
    defaultAiLowerMs: 50,
    defaultAiUpperMs: 2000,
    defaultHumanMs: 10000,
    defaultTimeoutMs: 30000,
  })

  it('expands zone boundaries with RTT tolerance', () => {
    // 2500ms would normally be suspicious (above 2000ms ai_upper)
    // With 400ms RTT: tolerance = max(200, 200) = 200, ai_upper becomes 2200
    const withRtt = analyzer.analyze({
      elapsed_ms: 2100,
      challenge_type: 'unknown',
      difficulty: 'medium',
      rtt_ms: 400,
    })
    expect(withRtt.zone).toBe('ai_zone')

    // Same elapsed without RTT should be suspicious
    const withoutRtt = analyzer.analyze({
      elapsed_ms: 2100,
      challenge_type: 'unknown',
      difficulty: 'medium',
    })
    expect(withoutRtt.zone).toBe('suspicious')
  })

  it('uses minimum tolerance of 200ms', () => {
    // rtt_ms * 0.5 = 50, but min is 200
    const result = analyzer.analyze({
      elapsed_ms: 2100,
      challenge_type: 'unknown',
      difficulty: 'medium',
      rtt_ms: 100,
    })
    // 200ms tolerance → ai_upper becomes 2200ms → 2100ms is ai_zone
    expect(result.zone).toBe('ai_zone')
  })

  it('applies larger tolerance for high RTT', () => {
    // rtt_ms * 0.5 = 500, > 200 → tolerance = 500
    const result = analyzer.analyze({
      elapsed_ms: 2400,
      challenge_type: 'unknown',
      difficulty: 'medium',
      rtt_ms: 1000,
    })
    // ai_upper becomes 2000 + 500 = 2500 → 2400ms is ai_zone
    expect(result.zone).toBe('ai_zone')
  })

  it('zero RTT produces same behavior as no RTT', () => {
    const withZero = analyzer.analyze({
      elapsed_ms: 300,
      challenge_type: 'unknown',
      difficulty: 'medium',
      rtt_ms: 0,
    })
    const withoutRtt = analyzer.analyze({
      elapsed_ms: 300,
      challenge_type: 'unknown',
      difficulty: 'medium',
    })
    expect(withZero.zone).toBe(withoutRtt.zone)
    expect(withZero.penalty).toBe(withoutRtt.penalty)
  })

  it('negative RTT is treated as no RTT', () => {
    const withNeg = analyzer.analyze({
      elapsed_ms: 300,
      challenge_type: 'unknown',
      difficulty: 'medium',
      rtt_ms: -100,
    })
    const withoutRtt = analyzer.analyze({
      elapsed_ms: 300,
      challenge_type: 'unknown',
      difficulty: 'medium',
    })
    expect(withNeg.zone).toBe(withoutRtt.zone)
  })

  it('undefined RTT produces same behavior as no RTT', () => {
    const withUndefined = analyzer.analyze({
      elapsed_ms: 5000,
      challenge_type: 'unknown',
      difficulty: 'medium',
      rtt_ms: undefined,
    })
    const withoutRtt = analyzer.analyze({
      elapsed_ms: 5000,
      challenge_type: 'unknown',
      difficulty: 'medium',
    })
    expect(withUndefined.zone).toBe(withoutRtt.zone)
    expect(withUndefined.penalty).toBe(withoutRtt.penalty)
  })

  it('also expands human zone boundary with tolerance', () => {
    // 10100ms without RTT would be human (above 10000ms)
    // With 600ms RTT: tolerance = max(300, 200) = 300, human_ms becomes 10300
    const withRtt = analyzer.analyze({
      elapsed_ms: 10100,
      challenge_type: 'unknown',
      difficulty: 'medium',
      rtt_ms: 600,
    })
    expect(withRtt.zone).toBe('suspicious')

    const withoutRtt = analyzer.analyze({
      elapsed_ms: 10100,
      challenge_type: 'unknown',
      difficulty: 'medium',
    })
    expect(withoutRtt.zone).toBe('human')
  })
})
