import { describe, it, expect } from 'vitest'
import { DEFAULT_BASELINES, getBaseline } from '../timing/baselines.js'

describe('Timing baselines', () => {
  const CHALLENGE_TYPES = ['crypto-nl', 'multi-step', 'ambiguous-logic', 'code-execution']
  const DIFFICULTIES = ['easy', 'medium', 'hard', 'adversarial'] as const

  it('covers all 4 challenge types', () => {
    const types = new Set(DEFAULT_BASELINES.map((b) => b.challenge_type))
    for (const ct of CHALLENGE_TYPES) {
      expect(types.has(ct)).toBe(true)
    }
  })

  it('covers all 4 difficulties per challenge type', () => {
    for (const ct of CHALLENGE_TYPES) {
      for (const d of DIFFICULTIES) {
        const b = getBaseline(ct, d)
        expect(b, `Missing baseline for ${ct}/${d}`).toBeDefined()
      }
    }
  })

  it('has 16 total baselines (4 types x 4 difficulties)', () => {
    expect(DEFAULT_BASELINES.length).toBe(16)
  })

  it('all baselines have sensible threshold ordering', () => {
    for (const b of DEFAULT_BASELINES) {
      expect(b.too_fast_ms).toBeLessThan(b.ai_lower_ms)
      expect(b.ai_lower_ms).toBeLessThan(b.ai_upper_ms)
      expect(b.ai_upper_ms).toBeLessThan(b.human_ms)
      expect(b.human_ms).toBeLessThanOrEqual(b.timeout_ms)
    }
  })

  it('harder difficulties have higher means', () => {
    for (const ct of CHALLENGE_TYPES) {
      const easy = getBaseline(ct, 'easy')!
      const medium = getBaseline(ct, 'medium')!
      const hard = getBaseline(ct, 'hard')!
      const adversarial = getBaseline(ct, 'adversarial')!
      expect(easy.mean_ms).toBeLessThan(medium.mean_ms)
      expect(medium.mean_ms).toBeLessThan(hard.mean_ms)
      expect(hard.mean_ms).toBeLessThan(adversarial.mean_ms)
    }
  })

  it('all positive values', () => {
    for (const b of DEFAULT_BASELINES) {
      expect(b.mean_ms).toBeGreaterThan(0)
      expect(b.std_ms).toBeGreaterThan(0)
      expect(b.too_fast_ms).toBeGreaterThan(0)
      expect(b.ai_lower_ms).toBeGreaterThan(0)
      expect(b.ai_upper_ms).toBeGreaterThan(0)
      expect(b.human_ms).toBeGreaterThan(0)
      expect(b.timeout_ms).toBeGreaterThan(0)
    }
  })

  it('getBaseline returns undefined for unknown type', () => {
    expect(getBaseline('unknown-type', 'easy')).toBeUndefined()
  })

  it('getBaseline returns correct baseline', () => {
    const b = getBaseline('crypto-nl', 'medium')
    expect(b).toBeDefined()
    expect(b!.challenge_type).toBe('crypto-nl')
    expect(b!.difficulty).toBe('medium')
    expect(b!.mean_ms).toBe(300)
  })
})
