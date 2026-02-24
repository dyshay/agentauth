import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MemoryStore } from '../stores/memory.js'
import type { ChallengeData } from '../types.js'

function makeChallengeData(overrides?: Partial<ChallengeData>): ChallengeData {
  return {
    challenge: {
      id: 'ch_test',
      session_token: 'st_test',
      payload: {
        type: 'crypto-nl',
        instructions: 'test',
        data: 'dGVzdA==',
        steps: 1,
      },
      difficulty: 'medium',
      dimensions: ['reasoning'],
      created_at: Date.now(),
      expires_at: Date.now() + 30_000,
    },
    answer_hash: 'abc123',
    attempts: 0,
    max_attempts: 3,
    created_at: Date.now(),
    ...overrides,
  }
}

describe('MemoryStore', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('stores and retrieves data', async () => {
    const store = new MemoryStore()
    const data = makeChallengeData()
    await store.set('ch_1', data, 30)
    const retrieved = await store.get('ch_1')
    expect(retrieved).toEqual(data)
  })

  it('returns null for missing key', async () => {
    const store = new MemoryStore()
    const result = await store.get('nonexistent')
    expect(result).toBeNull()
  })

  it('deletes data', async () => {
    const store = new MemoryStore()
    await store.set('ch_1', makeChallengeData(), 30)
    await store.delete('ch_1')
    const result = await store.get('ch_1')
    expect(result).toBeNull()
  })

  it('expires data after TTL', async () => {
    const store = new MemoryStore()
    await store.set('ch_1', makeChallengeData(), 5)

    const before = await store.get('ch_1')
    expect(before).not.toBeNull()

    vi.advanceTimersByTime(6_000)

    const after = await store.get('ch_1')
    expect(after).toBeNull()
  })

  it('does not expire data before TTL', async () => {
    const store = new MemoryStore()
    await store.set('ch_1', makeChallengeData(), 10)

    vi.advanceTimersByTime(9_000)

    const result = await store.get('ch_1')
    expect(result).not.toBeNull()
  })

  it('handles delete of nonexistent key without error', async () => {
    const store = new MemoryStore()
    await expect(store.delete('nonexistent')).resolves.toBeUndefined()
  })

  it('overwrites existing key', async () => {
    const store = new MemoryStore()
    const data1 = makeChallengeData({ answer_hash: 'hash1' })
    const data2 = makeChallengeData({ answer_hash: 'hash2' })
    await store.set('ch_1', data1, 30)
    await store.set('ch_1', data2, 30)
    const result = await store.get('ch_1')
    expect(result?.answer_hash).toBe('hash2')
  })
})
