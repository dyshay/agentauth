import { describe, it, expect } from 'vitest'
import { CanaryCatalog, DEFAULT_CANARIES, CATALOG_VERSION } from '../pomi/catalog.js'

describe('CanaryCatalog', () => {
  it('has at least 15 default canaries', () => {
    expect(DEFAULT_CANARIES.length).toBeGreaterThanOrEqual(15)
  })

  it('creates a catalog with default canaries', () => {
    const catalog = new CanaryCatalog()
    expect(catalog.list().length).toBeGreaterThanOrEqual(15)
  })

  it('creates a catalog with custom canaries', () => {
    const catalog = new CanaryCatalog([{
      id: 'custom-1',
      prompt: 'test prompt',
      injection_method: 'inline',
      analysis: { type: 'exact_match', expected: { 'gpt-4': 'yes' } },
      confidence_weight: 0.5,
    }])
    expect(catalog.list()).toHaveLength(1)
  })

  it('gets a canary by id', () => {
    const catalog = new CanaryCatalog()
    const canary = catalog.get('random-numbers-5')
    expect(canary).toBeDefined()
    expect(canary?.id).toBe('random-numbers-5')
  })

  it('returns undefined for unknown canary', () => {
    const catalog = new CanaryCatalog()
    expect(catalog.get('nonexistent')).toBeUndefined()
  })

  it('selects N random canaries', () => {
    const catalog = new CanaryCatalog()
    const selected = catalog.select(3)
    expect(selected).toHaveLength(3)
    const ids = selected.map((c) => c.id)
    expect(new Set(ids).size).toBe(3)
  })

  it('selects canaries by injection method', () => {
    const catalog = new CanaryCatalog()
    const selected = catalog.select(2, { method: 'inline' })
    expect(selected.length).toBeLessThanOrEqual(2)
    selected.forEach((c) => expect(c.injection_method).toBe('inline'))
  })

  it('selects canaries excluding previously used ids', () => {
    const catalog = new CanaryCatalog()
    const all = catalog.list()
    const excludeIds = all.slice(0, all.length - 2).map((c) => c.id)
    const selected = catalog.select(2, { exclude: excludeIds })
    expect(selected).toHaveLength(2)
    selected.forEach((c) => expect(excludeIds).not.toContain(c.id))
  })

  it('returns fewer canaries if not enough available', () => {
    const catalog = new CanaryCatalog([{
      id: 'only-one',
      prompt: 'test',
      injection_method: 'inline',
      analysis: { type: 'exact_match', expected: {} },
      confidence_weight: 0.5,
    }])
    const selected = catalog.select(5)
    expect(selected).toHaveLength(1)
  })

  it('provides catalog version', () => {
    const catalog = new CanaryCatalog()
    expect(catalog.version).toBe('1.1.0')
  })

  it('has unique canary IDs across the entire catalog', () => {
    const ids = DEFAULT_CANARIES.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('new canaries have correct structure', () => {
    const newIds = ['math-chain', 'sorting-preference', 'json-formatting', 'analogy-completion', 'confidence-expression']
    const catalog = new CanaryCatalog()
    const modelFamilies = ['gpt-4-class', 'claude-3-class', 'gemini-class', 'llama-class', 'mistral-class']

    for (const id of newIds) {
      const canary = catalog.get(id)
      expect(canary, `canary ${id} should exist`).toBeDefined()
      expect(canary!.prompt.length).toBeGreaterThan(0)
      expect(canary!.confidence_weight).toBeGreaterThan(0)
      expect(canary!.confidence_weight).toBeLessThanOrEqual(1)
      expect(['exact_match', 'statistical', 'pattern']).toContain(canary!.analysis.type)

      // Verify all 5 model families are present
      if (canary!.analysis.type === 'exact_match') {
        for (const fam of modelFamilies) {
          expect(canary!.analysis.expected).toHaveProperty(fam)
        }
      } else if (canary!.analysis.type === 'statistical') {
        for (const fam of modelFamilies) {
          expect(canary!.analysis.distributions).toHaveProperty(fam)
        }
      } else if (canary!.analysis.type === 'pattern') {
        for (const fam of modelFamilies) {
          expect(canary!.analysis.patterns).toHaveProperty(fam)
        }
      }
    }
  })

  it('math-chain canary uses pattern analysis for reasoning', () => {
    const catalog = new CanaryCatalog()
    const canary = catalog.get('math-chain')
    expect(canary!.analysis.type).toBe('pattern')
    expect(canary!.injection_method).toBe('inline')
  })

  it('analogy-completion canary uses exact_match as sanity check', () => {
    const catalog = new CanaryCatalog()
    const canary = catalog.get('analogy-completion')
    expect(canary!.analysis.type).toBe('exact_match')
    expect(canary!.confidence_weight).toBeLessThanOrEqual(0.15)
  })

  it('confidence-expression canary uses statistical analysis', () => {
    const catalog = new CanaryCatalog()
    const canary = catalog.get('confidence-expression')
    expect(canary!.analysis.type).toBe('statistical')
  })

  it('all default canaries have valid analysis types', () => {
    const catalog = new CanaryCatalog()
    const canaries = catalog.list()
    canaries.forEach((c) => {
      expect(['exact_match', 'statistical', 'pattern']).toContain(c.analysis.type)
      expect(c.confidence_weight).toBeGreaterThan(0)
      expect(c.confidence_weight).toBeLessThanOrEqual(1)
    })
  })

  it('does not mutate internal state when list() is called', () => {
    const catalog = new CanaryCatalog()
    const list1 = catalog.list()
    const list2 = catalog.list()
    expect(list1).toEqual(list2)
    expect(list1).not.toBe(list2) // different array references
  })
})
