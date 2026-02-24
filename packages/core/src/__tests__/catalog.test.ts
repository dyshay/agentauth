import { describe, it, expect } from 'vitest'
import { CanaryCatalog, DEFAULT_CANARIES, CATALOG_VERSION } from '../pomi/catalog.js'

describe('CanaryCatalog', () => {
  it('has at least 10 default canaries', () => {
    expect(DEFAULT_CANARIES.length).toBeGreaterThanOrEqual(10)
  })

  it('creates a catalog with default canaries', () => {
    const catalog = new CanaryCatalog()
    expect(catalog.list().length).toBeGreaterThanOrEqual(10)
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
    expect(catalog.version).toBe('1.0.0')
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
