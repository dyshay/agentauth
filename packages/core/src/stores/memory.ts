import type { ChallengeData, ChallengeStore } from '../types.js'

interface Entry {
  data: ChallengeData
  expires_at: number
}

export class MemoryStore implements ChallengeStore {
  private store = new Map<string, Entry>()

  async set(id: string, data: ChallengeData, ttlSeconds: number): Promise<void> {
    this.store.set(id, {
      data,
      expires_at: Date.now() + ttlSeconds * 1000,
    })
  }

  async get(id: string): Promise<ChallengeData | null> {
    const entry = this.store.get(id)
    if (!entry) return null
    if (Date.now() >= entry.expires_at) {
      this.store.delete(id)
      return null
    }
    return entry.data
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id)
  }
}
