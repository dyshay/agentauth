import { describe, it, expect } from 'vitest'
import { ChallengeRegistry } from '../challenges/registry.js'
import type { ChallengeDriver, ChallengePayload, Difficulty } from '../types.js'

function makeDriver(overrides: Partial<ChallengeDriver> & { name: string }): ChallengeDriver {
  return {
    dimensions: ['reasoning'],
    estimatedHumanTimeMs: 60_000,
    estimatedAiTimeMs: 500,
    generate: async () => ({
      type: overrides.name,
      instructions: 'test',
      data: 'dGVzdA==',
      steps: 1,
    }),
    computeAnswerHash: async () => 'hash',
    verify: async () => true,
    ...overrides,
  }
}

describe('ChallengeRegistry', () => {
  it('registers and retrieves a driver', () => {
    const registry = new ChallengeRegistry()
    const driver = makeDriver({ name: 'test-driver' })
    registry.register(driver)
    expect(registry.get('test-driver')).toBe(driver)
  })

  it('returns undefined for unknown driver', () => {
    const registry = new ChallengeRegistry()
    expect(registry.get('nope')).toBeUndefined()
  })

  it('lists all registered drivers', () => {
    const registry = new ChallengeRegistry()
    registry.register(makeDriver({ name: 'a' }))
    registry.register(makeDriver({ name: 'b' }))
    expect(registry.list()).toHaveLength(2)
  })

  it('throws on duplicate name', () => {
    const registry = new ChallengeRegistry()
    registry.register(makeDriver({ name: 'dup' }))
    expect(() => registry.register(makeDriver({ name: 'dup' }))).toThrow()
  })

  it('selects driver by dimension coverage', () => {
    const registry = new ChallengeRegistry()
    registry.register(makeDriver({ name: 'a', dimensions: ['reasoning'] }))
    registry.register(makeDriver({ name: 'b', dimensions: ['reasoning', 'execution'] }))
    registry.register(makeDriver({ name: 'c', dimensions: ['memory'] }))

    const selected = registry.select({ dimensions: ['reasoning', 'execution'] })
    expect(selected[0].name).toBe('b')
  })

  it('selects multiple drivers for composite challenges', () => {
    const registry = new ChallengeRegistry()
    registry.register(makeDriver({ name: 'a', dimensions: ['reasoning'] }))
    registry.register(makeDriver({ name: 'b', dimensions: ['execution'] }))
    registry.register(makeDriver({ name: 'c', dimensions: ['memory'] }))

    const selected = registry.select({
      dimensions: ['reasoning', 'execution', 'memory'],
      count: 2,
    })
    expect(selected).toHaveLength(2)
  })

  it('returns first driver when no dimensions specified', () => {
    const registry = new ChallengeRegistry()
    registry.register(makeDriver({ name: 'first' }))
    registry.register(makeDriver({ name: 'second' }))
    const selected = registry.select({})
    expect(selected[0].name).toBe('first')
  })

  it('throws when no drivers registered', () => {
    const registry = new ChallengeRegistry()
    expect(() => registry.select({})).toThrow('No challenge drivers registered')
  })
})
