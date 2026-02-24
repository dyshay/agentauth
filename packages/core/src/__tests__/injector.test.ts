import { describe, it, expect } from 'vitest'
import { CanaryInjector } from '../pomi/injector.js'
import { CanaryCatalog } from '../pomi/catalog.js'
import type { ChallengePayload, Canary } from '../types.js'

describe('CanaryInjector', () => {
  const catalog = new CanaryCatalog()

  it('injects canaries into a challenge payload', () => {
    const injector = new CanaryInjector(catalog)
    const payload: ChallengePayload = {
      type: 'crypto-nl',
      instructions: 'Step 1: XOR each byte with 0xFF',
      data: 'AQID',
      steps: 1,
    }

    const result = injector.inject(payload, 2)
    expect(result.payload.instructions).toContain('Step 1: XOR each byte with 0xFF')
    expect(result.injected).toHaveLength(2)
  })

  it('returns canary ids for later extraction', () => {
    const injector = new CanaryInjector(catalog)
    const payload: ChallengePayload = {
      type: 'crypto-nl',
      instructions: 'Step 1: Reverse the byte order',
      data: 'AQID',
      steps: 1,
    }

    const result = injector.inject(payload, 3)
    expect(result.injected.length).toBe(3)
    result.injected.forEach((c) => {
      expect(c.id).toBeDefined()
      expect(c.prompt).toBeDefined()
    })
  })

  it('does not modify the original payload', () => {
    const injector = new CanaryInjector(catalog)
    const payload: ChallengePayload = {
      type: 'crypto-nl',
      instructions: 'Original instructions',
      data: 'AQID',
      steps: 1,
    }

    injector.inject(payload, 1)
    expect(payload.instructions).toBe('Original instructions')
  })

  it('stores injected canary ids in context', () => {
    const injector = new CanaryInjector(catalog)
    const payload: ChallengePayload = {
      type: 'crypto-nl',
      instructions: 'test',
      data: 'AQID',
      steps: 1,
      context: { ops: [] },
    }

    const result = injector.inject(payload, 2)
    expect(result.payload.context?.canary_ids).toBeDefined()
    expect((result.payload.context?.canary_ids as string[]).length).toBe(2)
  })

  it('preserves existing context', () => {
    const injector = new CanaryInjector(catalog)
    const payload: ChallengePayload = {
      type: 'crypto-nl',
      instructions: 'test',
      data: 'AQID',
      steps: 1,
      context: { ops: [{ op: 'xor', params: { key: 42 } }] },
    }

    const result = injector.inject(payload, 1)
    expect(result.payload.context?.ops).toBeDefined()
    expect((result.payload.context?.ops as any[]).length).toBe(1)
  })

  it('supports excluding previously used canaries', () => {
    const canaries: Canary[] = [
      { id: 'a', prompt: 'A?', injection_method: 'inline', analysis: { type: 'exact_match', expected: {} }, confidence_weight: 0.5 },
      { id: 'b', prompt: 'B?', injection_method: 'inline', analysis: { type: 'exact_match', expected: {} }, confidence_weight: 0.5 },
    ]
    const smallCatalog = new CanaryCatalog(canaries)
    const injector = new CanaryInjector(smallCatalog)
    const payload: ChallengePayload = { type: 'test', instructions: 'test', data: '', steps: 1 }

    const result = injector.inject(payload, 1, { exclude: ['a'] })
    expect(result.injected[0].id).toBe('b')
  })

  it('injects zero canaries when count is 0', () => {
    const injector = new CanaryInjector(catalog)
    const payload: ChallengePayload = { type: 'test', instructions: 'test', data: '', steps: 1 }

    const result = injector.inject(payload, 0)
    expect(result.injected).toHaveLength(0)
    expect(result.payload.instructions).toBe('test')
  })

  it('handles prefix injection method', () => {
    const prefixCanary: Canary = {
      id: 'prefix-test',
      prompt: 'What color is the sky?',
      injection_method: 'prefix',
      analysis: { type: 'exact_match', expected: {} },
      confidence_weight: 0.3,
    }
    const cat = new CanaryCatalog([prefixCanary])
    const injector = new CanaryInjector(cat)
    const payload: ChallengePayload = { type: 'test', instructions: 'main task', data: '', steps: 1 }

    const result = injector.inject(payload, 1)
    expect(result.payload.instructions).toContain('Before starting')
    expect(result.payload.instructions).toContain('prefix-test')
    expect(result.payload.instructions).toContain('main task')
  })

  it('handles suffix/inline canaries with "Also" section', () => {
    const suffixCanary: Canary = {
      id: 'suffix-test',
      prompt: 'What color is the sky?',
      injection_method: 'suffix',
      analysis: { type: 'exact_match', expected: {} },
      confidence_weight: 0.3,
    }
    const cat = new CanaryCatalog([suffixCanary])
    const injector = new CanaryInjector(cat)
    const payload: ChallengePayload = { type: 'test', instructions: 'main task', data: '', steps: 1 }

    const result = injector.inject(payload, 1)
    expect(result.payload.instructions).toContain('Also')
    expect(result.payload.instructions).toContain('suffix-test')
  })
})
