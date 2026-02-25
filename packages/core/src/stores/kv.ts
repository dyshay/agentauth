import type { ChallengeData, ChallengeStore } from '../types.js'

/**
 * Cloudflare Workers KV-backed challenge store.
 *
 * Accepts a KV namespace binding from the Cloudflare Workers runtime.
 */
export interface KVNamespace {
  get(key: string): Promise<string | null>
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>
  delete(key: string): Promise<void>
}

export class KVStore implements ChallengeStore {
  private kv: KVNamespace
  private prefix: string

  constructor(kv: KVNamespace, options?: { prefix?: string }) {
    this.kv = kv
    this.prefix = options?.prefix ?? 'agentauth:'
  }

  async set(id: string, data: ChallengeData, ttlSeconds: number): Promise<void> {
    const key = this.prefix + id
    const value = JSON.stringify(data)
    await this.kv.put(key, value, { expirationTtl: ttlSeconds })
  }

  async get(id: string): Promise<ChallengeData | null> {
    const key = this.prefix + id
    const value = await this.kv.get(key)
    if (!value) return null
    return JSON.parse(value) as ChallengeData
  }

  async delete(id: string): Promise<void> {
    const key = this.prefix + id
    await this.kv.delete(key)
  }
}
