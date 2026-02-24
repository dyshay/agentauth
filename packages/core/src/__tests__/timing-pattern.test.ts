import { describe, it, expect } from 'vitest'
import { TimingAnalyzer } from '../timing/analyzer.js'

describe('TimingAnalyzer pattern analysis', () => {
  const analyzer = new TimingAnalyzer()

  it('detects artificial timing from constant intervals', () => {
    const result = analyzer.analyzePattern([500, 500, 500, 500, 500])
    expect(result.variance_coefficient).toBeLessThan(0.05)
    expect(result.verdict).toBe('artificial')
  })

  it('detects natural timing from variable intervals', () => {
    const result = analyzer.analyzePattern([234, 456, 123, 678, 345, 567])
    expect(result.variance_coefficient).toBeGreaterThan(0.1)
    expect(result.verdict).toBe('natural')
  })

  it('detects round number timing as artificial', () => {
    const result = analyzer.analyzePattern([500, 1000, 500, 1000, 500, 1000])
    expect(result.round_number_ratio).toBeGreaterThan(0.5)
    expect(result.verdict).toBe('artificial')
  })

  it('detects increasing trend (human fatigue)', () => {
    const result = analyzer.analyzePattern([200, 300, 500, 800, 1200, 2000])
    expect(result.trend).toBe('increasing')
  })

  it('detects decreasing trend', () => {
    const result = analyzer.analyzePattern([2000, 1500, 1000, 600, 300])
    expect(result.trend).toBe('decreasing')
  })

  it('detects constant trend from nearly identical timings', () => {
    const result = analyzer.analyzePattern([500, 510, 490, 505, 495])
    expect(result.trend).toBe('constant')
  })

  it('returns inconclusive for single step', () => {
    const result = analyzer.analyzePattern([300])
    expect(result.verdict).toBe('inconclusive')
    expect(result.variance_coefficient).toBe(0)
  })

  it('returns inconclusive for empty array', () => {
    const result = analyzer.analyzePattern([])
    expect(result.verdict).toBe('inconclusive')
  })

  it('handles two-step timing', () => {
    const result = analyzer.analyzePattern([100, 900])
    expect(result.variance_coefficient).toBeGreaterThan(0)
    // Two steps not enough for trend detection
    expect(result.trend).toBe('variable')
  })

  it('computes correct variance coefficient', () => {
    // mean = 300, all same -> std = 0, cv = 0
    const result = analyzer.analyzePattern([300, 300, 300])
    expect(result.variance_coefficient).toBe(0)
  })
})
