import { describe, it, expect } from 'vitest'
import {
  CanarySchema,
  CanaryAnalysisSchema,
  ModelSignatureSchema,
  ModelIdentificationSchema,
  CanaryEvidenceSchema,
  InjectionMethodSchema,
  DistributionSchema,
  PomiConfigSchema,
} from '../schemas.js'

describe('PoMI schemas', () => {
  it('validates a valid Canary', () => {
    const canary = {
      id: 'unicode-rtl',
      prompt: "What is the 3rd character of '\\u202e\\u0041\\u0042'?",
      injection_method: 'inline',
      analysis: {
        type: 'exact_match',
        expected: { 'gpt-4': 'A', 'claude': 'A', 'llama-3': 'B' },
      },
      confidence_weight: 0.3,
    }
    expect(CanarySchema.parse(canary)).toEqual(canary)
  })

  it('rejects invalid injection_method', () => {
    const canary = {
      id: 'test',
      prompt: 'test',
      injection_method: 'invalid',
      analysis: { type: 'exact_match', expected: {} },
      confidence_weight: 0.5,
    }
    expect(() => CanarySchema.parse(canary)).toThrow()
  })

  it('validates exact_match analysis', () => {
    const analysis = { type: 'exact_match', expected: { 'gpt-4': 'hello', 'claude': 'hi' } }
    expect(CanaryAnalysisSchema.parse(analysis)).toEqual(analysis)
  })

  it('validates statistical analysis', () => {
    const analysis = {
      type: 'statistical',
      distributions: {
        'gpt-4': { mean: 50, stddev: 15 },
        'claude': { mean: 42, stddev: 10 },
      },
    }
    expect(CanaryAnalysisSchema.parse(analysis)).toEqual(analysis)
  })

  it('validates pattern analysis', () => {
    const analysis = {
      type: 'pattern',
      patterns: { 'gpt-4': 'therefore|thus', 'claude': 'let me think' },
    }
    expect(CanaryAnalysisSchema.parse(analysis)).toEqual(analysis)
  })

  it('validates ModelSignature', () => {
    const sig = {
      model_family: 'gpt-4-class',
      expected_value: 'A',
      confidence: 0.85,
      last_verified: '2026-02-24',
    }
    expect(ModelSignatureSchema.parse(sig)).toEqual(sig)
  })

  it('validates ModelIdentification', () => {
    const id = {
      family: 'gpt-4-class',
      confidence: 0.87,
      evidence: [
        {
          canary_id: 'unicode-rtl',
          observed: 'A',
          expected: 'A',
          match: true,
          confidence_contribution: 0.3,
        },
      ],
      alternatives: [{ family: 'claude-3-class', confidence: 0.1 }],
    }
    expect(ModelIdentificationSchema.parse(id)).toEqual(id)
  })

  it('rejects confidence_weight outside 0-1', () => {
    const canary = {
      id: 'test',
      prompt: 'test',
      injection_method: 'inline',
      analysis: { type: 'exact_match', expected: {} },
      confidence_weight: 1.5,
    }
    expect(() => CanarySchema.parse(canary)).toThrow()
  })

  it('validates CanaryEvidence', () => {
    const evidence = {
      canary_id: 'random-5',
      observed: '42,17,88,3,61',
      expected: '50,25,75,33,67',
      match: false,
      confidence_contribution: 0.15,
    }
    expect(CanaryEvidenceSchema.parse(evidence)).toEqual(evidence)
  })

  it('validates InjectionMethod enum', () => {
    expect(InjectionMethodSchema.parse('inline')).toBe('inline')
    expect(InjectionMethodSchema.parse('prefix')).toBe('prefix')
    expect(InjectionMethodSchema.parse('suffix')).toBe('suffix')
    expect(InjectionMethodSchema.parse('embedded')).toBe('embedded')
    expect(() => InjectionMethodSchema.parse('other')).toThrow()
  })

  it('validates Distribution', () => {
    expect(DistributionSchema.parse({ mean: 50, stddev: 15 })).toEqual({ mean: 50, stddev: 15 })
    expect(() => DistributionSchema.parse({ mean: 50, stddev: -1 })).toThrow()
  })

  it('validates PomiConfig', () => {
    const config = {
      enabled: true,
      canariesPerChallenge: 3,
      modelFamilies: ['gpt-4-class', 'claude-3-class'],
      confidenceThreshold: 0.7,
    }
    expect(PomiConfigSchema.parse(config)).toEqual(config)
  })
})
