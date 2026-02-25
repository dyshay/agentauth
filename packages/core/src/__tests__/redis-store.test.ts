import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RedisStore, type RedisClient } from '../stores/redis.js'
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

function createMockRedis(): RedisClient & { store: Map<string, { value: string; expiresAt?: number }> } {
  const store = new Map<string, { value: string; expiresAt?: number }>()

  return {
    store,
    get: vi.fn(async (key: string) => {
      const entry = store.get(key)
      if (!entry) return null
      if (entry.expiresAt && Date.now() >= entry.expiresAt) {
        store.delete(key)
        return null
      }
      return entry.value
    }),
    set: vi.fn(async (key: string, value: string, ..._args: unknown[]) => {
      const ttlArg = _args[1] as number | undefined
      store.set(key, {
        value,
        expiresAt: ttlArg ? Date.now() + ttlArg * 1000 : undefined,
      })
      return 'OK'
    }),
    del: vi.fn(async (key: string | string[]) => {
      const keys = Array.isArray(key) ? key : [key]
      let count = 0
      for (const k of keys) {
        if (store.delete(k)) count++
      }
      return count
    }),
  }
}

describe('RedisStore', () => {
  let redis: ReturnType<typeof createMockRedis>
  let store: RedisStore

  beforeEach(() => {
    redis = createMockRedis()
    store = new RedisStore(redis)
  })

  it('stores and retrieves data', async () => {
    const data = makeChallengeData()
    await store.set('ch_1', data, 30)
    const retrieved = await store.get('ch_1')
    expect(retrieved).toEqual(data)
  })

  it('returns null for missing key', async () => {
    const result = await store.get('nonexistent')
    expect(result).toBeNull()
  })

  it('deletes data', async () => {
    await store.set('ch_1', makeChallengeData(), 30)
    await store.delete('ch_1')
    const result = await store.get('ch_1')
    expect(result).toBeNull()
  })

  it('calls redis set with EX flag for TTL', async () => {
    await store.set('ch_1', makeChallengeData(), 30)
    expect(redis.set).toHaveBeenCalledWith(
      'agentauth:ch_1',
      expect.any(String),
      'EX',
      30,
    )
  })

  it('uses custom prefix', async () => {
    const customStore = new RedisStore(redis, { prefix: 'myapp:' })
    await customStore.set('ch_1', makeChallengeData(), 30)
    expect(redis.set).toHaveBeenCalledWith(
      'myapp:ch_1',
      expect.any(String),
      'EX',
      30,
    )
  })

  it('handles delete of nonexistent key without error', async () => {
    await expect(store.delete('nonexistent')).resolves.toBeUndefined()
  })

  it('overwrites existing key', async () => {
    const data1 = makeChallengeData({ answer_hash: 'hash1' })
    const data2 = makeChallengeData({ answer_hash: 'hash2' })
    await store.set('ch_1', data1, 30)
    await store.set('ch_1', data2, 30)
    const result = await store.get('ch_1')
    expect(result?.answer_hash).toBe('hash2')
  })
})
