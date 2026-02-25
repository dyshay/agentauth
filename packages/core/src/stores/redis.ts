import type { ChallengeData, ChallengeStore } from '../types.js'

/**
 * Redis-backed challenge store.
 *
 * Accepts any Redis client that implements the minimal interface below,
 * compatible with both `ioredis` and `@redis/client` (node-redis v4+).
 */
export interface RedisClient {
  get(key: string): Promise<string | null>
  set(key: string, value: string, ...args: unknown[]): Promise<unknown>
  del(key: string | string[]): Promise<number>
}

export class RedisStore implements ChallengeStore {
  private client: RedisClient
  private prefix: string

  constructor(client: RedisClient, options?: { prefix?: string }) {
    this.client = client
    this.prefix = options?.prefix ?? 'agentauth:'
  }

  async set(id: string, data: ChallengeData, ttlSeconds: number): Promise<void> {
    const key = this.prefix + id
    const value = JSON.stringify(data)
    await this.client.set(key, value, 'EX', ttlSeconds)
  }

  async get(id: string): Promise<ChallengeData | null> {
    const key = this.prefix + id
    const value = await this.client.get(key)
    if (!value) return null
    return JSON.parse(value) as ChallengeData
  }

  async delete(id: string): Promise<void> {
    const key = this.prefix + id
    await this.client.del(key)
  }
}
