export interface LeaderboardEntry {
  family: string
  provider: string
  overall: number
  reasoning: number
  execution: number
  autonomy: number
  speed: number
  consistency: number
  challenges: number
  last_seen: string
}

export interface LeaderboardStore {
  getAll(): Promise<LeaderboardEntry[]>
  getByFamily(family: string): Promise<LeaderboardEntry | null>
  upsert(entry: LeaderboardEntry): Promise<void>
}

export class MemoryLeaderboardStore implements LeaderboardStore {
  private entries = new Map<string, LeaderboardEntry>()

  async getAll(): Promise<LeaderboardEntry[]> {
    return [...this.entries.values()].sort((a, b) => b.overall - a.overall)
  }

  async getByFamily(family: string): Promise<LeaderboardEntry | null> {
    return this.entries.get(family) ?? null
  }

  async upsert(entry: LeaderboardEntry): Promise<void> {
    this.entries.set(entry.family, entry)
  }
}

export interface RedisLeaderboardClient {
  hset(key: string, ...args: (string | number)[]): Promise<number>
  hgetall(key: string): Promise<Record<string, string>>
  smembers(key: string): Promise<string[]>
  sadd(key: string, ...members: string[]): Promise<number>
}

export class RedisLeaderboardStore implements LeaderboardStore {
  private client: RedisLeaderboardClient
  private prefix: string

  constructor(client: RedisLeaderboardClient, options?: { prefix?: string }) {
    this.client = client
    this.prefix = options?.prefix ?? 'agentauth:lb:'
  }

  async getAll(): Promise<LeaderboardEntry[]> {
    const families = await this.client.smembers(`${this.prefix}families`)
    const entries: LeaderboardEntry[] = []

    for (const family of families) {
      const entry = await this.getByFamily(family)
      if (entry) entries.push(entry)
    }

    return entries.sort((a, b) => b.overall - a.overall)
  }

  async getByFamily(family: string): Promise<LeaderboardEntry | null> {
    const data = await this.client.hgetall(`${this.prefix}entry:${family}`)
    if (!data || Object.keys(data).length === 0) return null

    return {
      family,
      provider: data.provider ?? '',
      overall: parseFloat(data.overall ?? '0'),
      reasoning: parseFloat(data.reasoning ?? '0'),
      execution: parseFloat(data.execution ?? '0'),
      autonomy: parseFloat(data.autonomy ?? '0'),
      speed: parseFloat(data.speed ?? '0'),
      consistency: parseFloat(data.consistency ?? '0'),
      challenges: parseInt(data.challenges ?? '0', 10),
      last_seen: data.last_seen ?? new Date().toISOString(),
    }
  }

  async upsert(entry: LeaderboardEntry): Promise<void> {
    await this.client.sadd(`${this.prefix}families`, entry.family)
    await this.client.hset(
      `${this.prefix}entry:${entry.family}`,
      'provider', entry.provider,
      'overall', entry.overall,
      'reasoning', entry.reasoning,
      'execution', entry.execution,
      'autonomy', entry.autonomy,
      'speed', entry.speed,
      'consistency', entry.consistency,
      'challenges', entry.challenges,
      'last_seen', entry.last_seen,
    )
  }
}
