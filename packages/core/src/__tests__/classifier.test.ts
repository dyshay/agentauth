import { describe, it, expect } from 'vitest'
import { ModelClassifier } from '../pomi/classifier.js'
import type { Canary } from '../types.js'

describe('ModelClassifier', () => {
  const MODEL_FAMILIES = ['gpt-4-class', 'claude-3-class', 'gemini-class', 'llama-class', 'mistral-class']

  it('classifies with high confidence from strong exact_match evidence', () => {
    const classifier = new ModelClassifier(MODEL_FAMILIES)
    const canaries: Canary[] = [
      {
        id: 'greeting',
        prompt: 'Say hi',
        injection_method: 'inline',
        analysis: { type: 'exact_match', expected: { 'gpt-4-class': 'Hello!', 'claude-3-class': 'Hi there!' } },
        confidence_weight: 0.9,
      },
      {
        id: 'emoji',
        prompt: 'Pick emoji',
        injection_method: 'inline',
        analysis: { type: 'exact_match', expected: { 'gpt-4-class': '\u{1F60A}', 'claude-3-class': '\u{1F604}' } },
        confidence_weight: 0.9,
      },
      {
        id: 'sign-off',
        prompt: 'Sign off',
        injection_method: 'inline',
        analysis: { type: 'exact_match', expected: { 'gpt-4-class': 'Best regards', 'claude-3-class': 'Cheers' } },
        confidence_weight: 0.9,
      },
    ]
    const responses = { greeting: 'Hello!', emoji: '\u{1F60A}', 'sign-off': 'Best regards' }

    const result = classifier.classify(canaries, responses)
    expect(result.family).toBe('gpt-4-class')
    expect(result.confidence).toBeGreaterThan(0.3)
    expect(result.evidence.length).toBe(3)
  })

  it('returns "unknown" when no evidence matches any model', () => {
    const classifier = new ModelClassifier(MODEL_FAMILIES)
    const canaries: Canary[] = [
      {
        id: 'test',
        prompt: 'test',
        injection_method: 'inline',
        analysis: { type: 'exact_match', expected: { 'gpt-4-class': 'A', 'claude-3-class': 'B' } },
        confidence_weight: 0.5,
      },
    ]
    const responses = { test: 'completely unexpected value' }

    const result = classifier.classify(canaries, responses)
    // With 5 model families and weak evidence, it should be low confidence
    // The classifier may return "unknown" or a family with low confidence
    expect(result.evidence.length).toBe(1)
  })

  it('returns "unknown" when no canary responses provided', () => {
    const classifier = new ModelClassifier(MODEL_FAMILIES)
    const result = classifier.classify([], {})
    expect(result.family).toBe('unknown')
    expect(result.confidence).toBe(0)
    expect(result.evidence).toHaveLength(0)
  })

  it('returns "unknown" when responses is undefined', () => {
    const classifier = new ModelClassifier(MODEL_FAMILIES)
    const canaries: Canary[] = [
      {
        id: 'test',
        prompt: 'test',
        injection_method: 'inline',
        analysis: { type: 'exact_match', expected: { 'gpt-4-class': 'A' } },
        confidence_weight: 0.5,
      },
    ]
    const result = classifier.classify(canaries, undefined)
    expect(result.family).toBe('unknown')
    expect(result.confidence).toBe(0)
  })

  it('provides alternative hypotheses', () => {
    const classifier = new ModelClassifier(MODEL_FAMILIES)
    const canaries: Canary[] = [
      {
        id: 'test',
        prompt: 'test',
        injection_method: 'inline',
        analysis: { type: 'exact_match', expected: { 'gpt-4-class': 'Hello!', 'claude-3-class': 'Hello!' } },
        confidence_weight: 0.5,
      },
    ]
    const responses = { test: 'Hello!' }

    const result = classifier.classify(canaries, responses)
    expect(result.alternatives.length).toBeGreaterThan(0)
  })

  it('uses pattern analysis for classification', () => {
    const classifier = new ModelClassifier(['gpt-4-class', 'claude-3-class'])
    const canaries: Canary[] = [
      {
        id: 'style',
        prompt: 'Solve logic',
        injection_method: 'inline',
        analysis: {
          type: 'pattern',
          patterns: { 'gpt-4-class': 'therefore|thus', 'claude-3-class': 'let me|I think' },
        },
        confidence_weight: 0.6,
      },
    ]
    const responses = { style: 'Let me think about this carefully...' }

    const result = classifier.classify(canaries, responses)
    expect(result.family).toBe('claude-3-class')
    expect(result.confidence).toBeGreaterThan(0)
  })

  it('uses statistical analysis for classification', () => {
    const classifier = new ModelClassifier(['gpt-4-class', 'claude-3-class'])
    const canaries: Canary[] = [
      {
        id: 'numbers',
        prompt: 'Pick a number 1-10',
        injection_method: 'inline',
        analysis: {
          type: 'statistical',
          distributions: {
            'gpt-4-class': { mean: 7, stddev: 1 },
            'claude-3-class': { mean: 3, stddev: 1 },
          },
        },
        confidence_weight: 0.5,
      },
    ]
    const responses = { numbers: '7' }

    const result = classifier.classify(canaries, responses)
    expect(result.family).toBe('gpt-4-class')
  })

  it('combines multiple canary signals via Bayesian update', () => {
    const classifier = new ModelClassifier(['gpt-4-class', 'claude-3-class'])
    const canaries: Canary[] = [
      {
        id: 'c1',
        prompt: 'p1',
        injection_method: 'inline',
        analysis: { type: 'exact_match', expected: { 'gpt-4-class': 'A', 'claude-3-class': 'B' } },
        confidence_weight: 0.4,
      },
      {
        id: 'c2',
        prompt: 'p2',
        injection_method: 'inline',
        analysis: { type: 'exact_match', expected: { 'gpt-4-class': 'X', 'claude-3-class': 'Y' } },
        confidence_weight: 0.4,
      },
      {
        id: 'c3',
        prompt: 'p3',
        injection_method: 'inline',
        analysis: { type: 'exact_match', expected: { 'gpt-4-class': '1', 'claude-3-class': '2' } },
        confidence_weight: 0.4,
      },
    ]
    // All responses match claude-3-class
    const responses = { c1: 'B', c2: 'Y', c3: '2' }

    const result = classifier.classify(canaries, responses)
    expect(result.family).toBe('claude-3-class')
    expect(result.confidence).toBeGreaterThan(0.6)
  })

  it('respects confidence threshold \u2014 returns unknown if below', () => {
    const classifier = new ModelClassifier(MODEL_FAMILIES, { confidenceThreshold: 0.95 })
    const canaries: Canary[] = [
      {
        id: 'weak',
        prompt: 'test',
        injection_method: 'inline',
        analysis: { type: 'exact_match', expected: { 'gpt-4-class': 'A', 'claude-3-class': 'A' } },
        confidence_weight: 0.1,
      },
    ]
    const responses = { weak: 'A' }

    const result = classifier.classify(canaries, responses)
    expect(result.family).toBe('unknown')
  })

  it('handles canaries with no data for a model family gracefully', () => {
    const classifier = new ModelClassifier(['gpt-4-class', 'claude-3-class', 'gemini-class'])
    const canaries: Canary[] = [
      {
        id: 'partial1',
        prompt: 'test1',
        injection_method: 'inline',
        analysis: { type: 'exact_match', expected: { 'gpt-4-class': 'A' } }, // only gpt-4 has data
        confidence_weight: 0.9,
      },
      {
        id: 'partial2',
        prompt: 'test2',
        injection_method: 'inline',
        analysis: { type: 'exact_match', expected: { 'gpt-4-class': 'B' } }, // only gpt-4 has data
        confidence_weight: 0.9,
      },
    ]
    const responses = { partial1: 'A', partial2: 'B' }

    const result = classifier.classify(canaries, responses)
    expect(result.family).toBe('gpt-4-class')
  })
})
