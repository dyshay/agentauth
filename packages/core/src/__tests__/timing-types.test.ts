import { describe, it, expect } from 'vitest'
import {
  TimingZoneSchema,
  TimingBaselineSchema,
  TimingAnalysisSchema,
  TimingPatternAnalysisSchema,
  TimingConfigSchema,
} from '../schemas.js'

describe('Timing schemas', () => {
  it('validates all timing zones', () => {
    for (const zone of ['too_fast', 'ai_zone', 'suspicious', 'human', 'timeout']) {
      expect(TimingZoneSchema.parse(zone)).toBe(zone)
    }
    expect(() => TimingZoneSchema.parse('invalid')).toThrow()
  })

  it('validates a valid TimingBaseline', () => {
    const baseline = {
      challenge_type: 'crypto-nl',
      difficulty: 'medium',
      mean_ms: 300,
      std_ms: 100,
      too_fast_ms: 30,
      ai_lower_ms: 50,
      ai_upper_ms: 2000,
      human_ms: 10000,
      timeout_ms: 30000,
    }
    expect(TimingBaselineSchema.parse(baseline)).toEqual(baseline)
  })

  it('rejects negative mean_ms', () => {
    const baseline = {
      challenge_type: 'test',
      difficulty: 'easy',
      mean_ms: -100,
      std_ms: 50,
      too_fast_ms: 10,
      ai_lower_ms: 50,
      ai_upper_ms: 2000,
      human_ms: 10000,
      timeout_ms: 30000,
    }
    expect(() => TimingBaselineSchema.parse(baseline)).toThrow()
  })

  it('validates a valid TimingAnalysis', () => {
    const analysis = {
      elapsed_ms: 350,
      zone: 'ai_zone',
      confidence: 0.95,
      z_score: 0.5,
      penalty: 0.0,
      details: 'Response time within AI zone',
    }
    expect(TimingAnalysisSchema.parse(analysis)).toEqual(analysis)
  })

  it('rejects penalty > 1', () => {
    const analysis = {
      elapsed_ms: 100,
      zone: 'too_fast',
      confidence: 1.0,
      z_score: -2,
      penalty: 1.5,
      details: 'Too fast',
    }
    expect(() => TimingAnalysisSchema.parse(analysis)).toThrow()
  })

  it('validates a valid TimingPatternAnalysis', () => {
    const pattern = {
      variance_coefficient: 0.25,
      trend: 'variable',
      round_number_ratio: 0.1,
      verdict: 'natural',
    }
    expect(TimingPatternAnalysisSchema.parse(pattern)).toEqual(pattern)
  })

  it('validates all trend values', () => {
    for (const trend of ['constant', 'increasing', 'decreasing', 'variable']) {
      const p = { variance_coefficient: 0.1, trend, round_number_ratio: 0.0, verdict: 'natural' }
      expect(TimingPatternAnalysisSchema.parse(p)).toEqual(p)
    }
  })

  it('validates all verdict values', () => {
    for (const verdict of ['natural', 'artificial', 'inconclusive']) {
      const p = { variance_coefficient: 0.1, trend: 'variable', round_number_ratio: 0.0, verdict }
      expect(TimingPatternAnalysisSchema.parse(p)).toEqual(p)
    }
  })

  it('validates TimingConfig with defaults', () => {
    const config = { enabled: true }
    expect(TimingConfigSchema.parse(config)).toEqual({ enabled: true })
  })

  it('validates TimingConfig with all options', () => {
    const config = {
      enabled: true,
      baselines: [{
        challenge_type: 'crypto-nl',
        difficulty: 'easy',
        mean_ms: 200,
        std_ms: 80,
        too_fast_ms: 20,
        ai_lower_ms: 40,
        ai_upper_ms: 1500,
        human_ms: 8000,
        timeout_ms: 30000,
      }],
      defaultTooFastMs: 50,
      defaultAiLowerMs: 100,
      defaultAiUpperMs: 3000,
      defaultHumanMs: 15000,
      defaultTimeoutMs: 30000,
    }
    expect(TimingConfigSchema.parse(config)).toEqual(config)
  })
})
