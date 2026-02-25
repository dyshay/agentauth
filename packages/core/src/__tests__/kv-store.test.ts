import { describe, it, expect, vi, beforeEach } from 'vitest'
import { KVStore, type KVNamespace } from '../stores/kv.js'
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

function createMockKV(): KVNamespace & { store: Map<string, string> } {
  const store = new Map<string, string>()

  return {
    store,
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    put: vi.fn(async (key: string, value: string) => {
      store.set(key, value)
    }),
    delete: vi.fn(async (key: string) => {
      store.delete(key)
    }),
  }
}

describe('KVStore', () => {
  let kv: ReturnType<typeof createMockKV>
  let store: KVStore

  beforeEach(() => {
    kv = createMockKV()
    store = new KVStore(kv)
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

  it('calls kv.put with expirationTtl', async () => {
    await store.set('ch_1', makeChallengeData(), 30)
    expect(kv.put).toHaveBeenCalledWith(
      'agentauth:ch_1',
      expect.any(String),
      { expirationTtl: 30 },
    )
  })

  it('uses custom prefix', async () => {
    const customStore = new KVStore(kv, { prefix: 'myapp:' })
    await customStore.set('ch_1', makeChallengeData(), 30)
    expect(kv.put).toHaveBeenCalledWith(
      'myapp:ch_1',
      expect.any(String),
      { expirationTtl: 30 },
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
