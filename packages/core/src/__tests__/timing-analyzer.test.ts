import { describe, it, expect } from 'vitest'
import { TimingAnalyzer } from '../timing/analyzer.js'

describe('TimingAnalyzer', () => {
  const analyzer = new TimingAnalyzer()

  describe('zone classification', () => {
    it('classifies too_fast response', () => {
      const result = analyzer.analyze({ elapsed_ms: 10, challenge_type: 'crypto-nl', difficulty: 'medium' })
      expect(result.zone).toBe('too_fast')
      expect(result.penalty).toBe(1.0)
    })

    it('classifies ai_zone response', () => {
      const result = analyzer.analyze({ elapsed_ms: 300, challenge_type: 'crypto-nl', difficulty: 'medium' })
      expect(result.zone).toBe('ai_zone')
      expect(result.penalty).toBe(0.0)
    })

    it('classifies suspicious response', () => {
      const result = analyzer.analyze({ elapsed_ms: 5000, challenge_type: 'crypto-nl', difficulty: 'medium' })
      expect(result.zone).toBe('suspicious')
      expect(result.penalty).toBeGreaterThan(0.3)
      expect(result.penalty).toBeLessThan(0.7)
    })

    it('classifies human response', () => {
      const result = analyzer.analyze({ elapsed_ms: 15000, challenge_type: 'crypto-nl', difficulty: 'medium' })
      expect(result.zone).toBe('human')
      expect(result.penalty).toBe(0.9)
    })

    it('classifies timeout response', () => {
      const result = analyzer.analyze({ elapsed_ms: 35000, challenge_type: 'crypto-nl', difficulty: 'medium' })
      expect(result.zone).toBe('timeout')
      expect(result.penalty).toBe(1.0)
    })
  })

  describe('z-score', () => {
    it('computes positive z-score for slow response', () => {
      const result = analyzer.analyze({ elapsed_ms: 600, challenge_type: 'crypto-nl', difficulty: 'medium' })
      expect(result.z_score).toBeGreaterThan(0)
    })

    it('computes negative z-score for fast response', () => {
      const result = analyzer.analyze({ elapsed_ms: 100, challenge_type: 'crypto-nl', difficulty: 'medium' })
      expect(result.z_score).toBeLessThan(0)
    })

    it('computes near-zero z-score for mean response', () => {
      const result = analyzer.analyze({ elapsed_ms: 300, challenge_type: 'crypto-nl', difficulty: 'medium' })
      expect(Math.abs(result.z_score)).toBeLessThan(0.1)
    })
  })

  describe('confidence', () => {
    it('has high confidence in ai_zone near the mean', () => {
      const result = analyzer.analyze({ elapsed_ms: 300, challenge_type: 'crypto-nl', difficulty: 'medium' })
      expect(result.confidence).toBeGreaterThanOrEqual(0.5)
    })

    it('has moderate confidence in suspicious zone', () => {
      const result = analyzer.analyze({ elapsed_ms: 5000, challenge_type: 'crypto-nl', difficulty: 'medium' })
      expect(result.confidence).toBeGreaterThanOrEqual(0.3)
      expect(result.confidence).toBeLessThanOrEqual(0.8)
    })
  })

  describe('penalty scaling', () => {
    it('suspicious penalty increases linearly across the zone', () => {
      const early = analyzer.analyze({ elapsed_ms: 2500, challenge_type: 'crypto-nl', difficulty: 'medium' })
      const late = analyzer.analyze({ elapsed_ms: 8000, challenge_type: 'crypto-nl', difficulty: 'medium' })
      expect(early.zone).toBe('suspicious')
      expect(late.zone).toBe('suspicious')
      expect(late.penalty).toBeGreaterThan(early.penalty)
    })
  })

  describe('fallback to defaults', () => {
    it('uses default baselines for unknown challenge type', () => {
      const result = analyzer.analyze({ elapsed_ms: 100, challenge_type: 'unknown-type', difficulty: 'easy' })
      expect(result.zone).toBeDefined()
      expect(result.details).toBeDefined()
    })
  })

  describe('details', () => {
    it('provides human-readable description', () => {
      const result = analyzer.analyze({ elapsed_ms: 300, challenge_type: 'crypto-nl', difficulty: 'medium' })
      expect(result.details).toContain('300ms')
      expect(result.details).toContain('AI range')
    })
  })

  describe('different challenge types', () => {
    it('uses different baselines per challenge type', () => {
      const crypto = analyzer.analyze({ elapsed_ms: 500, challenge_type: 'crypto-nl', difficulty: 'easy' })
      const multi = analyzer.analyze({ elapsed_ms: 500, challenge_type: 'multi-step', difficulty: 'easy' })
      // Same elapsed but different challenge types may produce different zones
      expect(crypto.zone).toBeDefined()
      expect(multi.zone).toBeDefined()
    })
  })

  describe('custom config', () => {
    it('uses custom default thresholds', () => {
      const custom = new TimingAnalyzer({
        enabled: true,
        defaultTooFastMs: 10,
        defaultAiUpperMs: 500,
        defaultHumanMs: 5000,
        defaultTimeoutMs: 10000,
      })
      const result = custom.analyze({ elapsed_ms: 600, challenge_type: 'unknown', difficulty: 'easy' })
      expect(result.zone).toBe('suspicious')
    })
  })
})
