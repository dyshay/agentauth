import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PostgresStore, type PostgresClient } from '../stores/postgres.js'
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

function createMockPg(): PostgresClient & { rows: Map<string, { data: string; expires_at: string }> } {
  const rows = new Map<string, { data: string; expires_at: string }>()

  return {
    rows,
    query: vi.fn(async (text: string, values?: unknown[]) => {
      if (text.includes('INSERT INTO')) {
        const [id, data, expiresAt] = values as [string, string, string]
        rows.set(id, { data, expires_at: expiresAt })
        return { rows: [] }
      }
      if (text.includes('SELECT data')) {
        const [id] = values as [string]
        const row = rows.get(id)
        if (!row) return { rows: [] }
        if (new Date(row.expires_at) <= new Date()) {
          rows.delete(id)
          return { rows: [] }
        }
        return { rows: [{ data: row.data }] }
      }
      if (text.includes('DELETE FROM')) {
        const [id] = values as [string]
        rows.delete(id)
        return { rows: [] }
      }
      return { rows: [] }
    }),
  }
}

describe('PostgresStore', () => {
  let pg: ReturnType<typeof createMockPg>
  let store: PostgresStore

  beforeEach(() => {
    pg = createMockPg()
    store = new PostgresStore(pg)
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

  it('uses correct table name', async () => {
    await store.set('ch_1', makeChallengeData(), 30)
    expect(pg.query).toHaveBeenCalledWith(
      expect.stringContaining('agentauth_challenges'),
      expect.any(Array),
    )
  })

  it('uses custom table name', async () => {
    const customStore = new PostgresStore(pg, { table: 'my_challenges' })
    await customStore.set('ch_1', makeChallengeData(), 30)
    expect(pg.query).toHaveBeenCalledWith(
      expect.stringContaining('my_challenges'),
      expect.any(Array),
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

  it('handles JSONB data returned as object', async () => {
    const data = makeChallengeData()
    // Simulate Postgres returning JSONB as parsed object
    pg.query = vi.fn(async (text: string, values?: unknown[]) => {
      if (text.includes('INSERT INTO')) {
        return { rows: [] }
      }
      if (text.includes('SELECT data')) {
        return { rows: [{ data }] }
      }
      return { rows: [] }
    })

    const retrieved = await store.get('ch_1')
    expect(retrieved).toEqual(data)
  })
})
