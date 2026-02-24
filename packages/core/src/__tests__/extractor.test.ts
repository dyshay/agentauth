import { describe, it, expect } from 'vitest'
import { CanaryExtractor } from '../pomi/extractor.js'
import type { Canary } from '../types.js'

describe('CanaryExtractor', () => {
  const canaries: Canary[] = [
    {
      id: 'random-5',
      prompt: 'List 5 random numbers 1-100',
      injection_method: 'inline',
      analysis: {
        type: 'statistical',
        distributions: {
          'gpt-4-class': { mean: 50, stddev: 20 },
          'claude-3-class': { mean: 42, stddev: 15 },
        },
      },
      confidence_weight: 0.5,
    },
    {
      id: 'greeting',
      prompt: 'Say hi',
      injection_method: 'suffix',
      analysis: {
        type: 'exact_match',
        expected: { 'gpt-4-class': 'Hello!', 'claude-3-class': 'Hi there!' },
      },
      confidence_weight: 0.3,
    },
  ]

  it('extracts canary responses from solve input', () => {
    const extractor = new CanaryExtractor()
    const canaryResponses = { 'random-5': '42,17,88,3,61', 'greeting': 'Hello!' }
    const result = extractor.extract(canaries, canaryResponses)
    expect(result).toHaveLength(2)
    expect(result[0].canary_id).toBe('random-5')
    expect(result[0].observed).toBe('42,17,88,3,61')
    expect(result[1].canary_id).toBe('greeting')
    expect(result[1].observed).toBe('Hello!')
  })

  it('handles missing canary responses gracefully', () => {
    const extractor = new CanaryExtractor()
    const canaryResponses = { 'random-5': '42,17,88,3,61' }
    const result = extractor.extract(canaries, canaryResponses)
    expect(result).toHaveLength(1)
  })

  it('returns empty array when no responses provided', () => {
    const extractor = new CanaryExtractor()
    const result = extractor.extract(canaries, {})
    expect(result).toHaveLength(0)
  })

  it('returns empty array when responses is undefined', () => {
    const extractor = new CanaryExtractor()
    const result = extractor.extract(canaries, undefined)
    expect(result).toHaveLength(0)
  })

  it('evaluates exact_match canary as true when matching', () => {
    const extractor = new CanaryExtractor()
    const result = extractor.extract(canaries, { 'greeting': 'Hello!' })
    expect(result[0].match).toBe(true)
    expect(result[0].expected).toBe('Hello!')
  })

  it('evaluates exact_match canary as false when no match', () => {
    const extractor = new CanaryExtractor()
    const result = extractor.extract(canaries, { 'greeting': 'Yo!' })
    expect(result[0].match).toBe(false)
  })

  it('evaluates pattern canary', () => {
    const patternCanary: Canary = {
      id: 'style',
      prompt: 'Solve: if all A are B...',
      injection_method: 'inline',
      analysis: { type: 'pattern', patterns: { 'gpt-4-class': 'therefore|thus', 'claude-3-class': 'let me think' } },
      confidence_weight: 0.2,
    }
    const extractor = new CanaryExtractor()
    const result = extractor.extract([patternCanary], { 'style': 'Therefore, we can conclude...' })
    expect(result[0].match).toBe(true)
  })

  it('evaluates pattern canary as false when no pattern matches', () => {
    const patternCanary: Canary = {
      id: 'style',
      prompt: 'test',
      injection_method: 'inline',
      analysis: { type: 'pattern', patterns: { 'gpt-4-class': 'xyz123', 'claude-3-class': 'abc789' } },
      confidence_weight: 0.2,
    }
    const extractor = new CanaryExtractor()
    const result = extractor.extract([patternCanary], { 'style': 'no matching text here' })
    expect(result[0].match).toBe(false)
  })

  it('evaluates statistical canary with numeric value', () => {
    const extractor = new CanaryExtractor()
    const result = extractor.extract(canaries, { 'random-5': '45' })
    expect(result[0].match).toBe(true) // 45 is within 2 stddev of both model means
  })

  it('evaluates statistical canary with out-of-range value', () => {
    const statCanary: Canary = {
      id: 'narrow',
      prompt: 'pick a number',
      injection_method: 'inline',
      analysis: {
        type: 'statistical',
        distributions: {
          'model-a': { mean: 5, stddev: 0.5 },
        },
      },
      confidence_weight: 0.3,
    }
    const extractor = new CanaryExtractor()
    const result = extractor.extract([statCanary], { 'narrow': '100' })
    expect(result[0].match).toBe(false) // 100 is way outside mean=5, stddev=0.5
  })

  it('case-insensitive exact match', () => {
    const extractor = new CanaryExtractor()
    const result = extractor.extract(canaries, { 'greeting': 'hello!' })
    expect(result[0].match).toBe(true)
  })
})
