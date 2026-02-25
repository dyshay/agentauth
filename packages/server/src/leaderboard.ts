import type { LeaderboardStore, LeaderboardEntry } from './leaderboard-store.js'

export interface SubmitScoreInput {
  family: string
  provider?: string
  reasoning: number
  execution: number
  autonomy: number
  speed: number
  consistency: number
}

export class LeaderboardService {
  constructor(private store: LeaderboardStore) {}

  async getAll(): Promise<LeaderboardEntry[]> {
    return this.store.getAll()
  }

  async getByFamily(family: string): Promise<LeaderboardEntry | null> {
    return this.store.getByFamily(family)
  }

  async submit(input: SubmitScoreInput): Promise<LeaderboardEntry> {
    const existing = await this.store.getByFamily(input.family)

    if (existing) {
      // Running average
      const n = existing.challenges
      const avg = (prev: number, next: number) =>
        Math.round(((prev * n + next) / (n + 1)) * 1000) / 1000

      const entry: LeaderboardEntry = {
        family: input.family,
        provider: input.provider ?? existing.provider,
        reasoning: avg(existing.reasoning, input.reasoning),
        execution: avg(existing.execution, input.execution),
        autonomy: avg(existing.autonomy, input.autonomy),
        speed: avg(existing.speed, input.speed),
        consistency: avg(existing.consistency, input.consistency),
        overall: 0,
        challenges: n + 1,
        last_seen: new Date().toISOString(),
      }
      entry.overall = Math.round(
        ((entry.reasoning + entry.execution + entry.autonomy + entry.speed + entry.consistency) / 5) * 1000,
      ) / 1000

      await this.store.upsert(entry)
      return entry
    }

    // New entry
    const overall = Math.round(
      ((input.reasoning + input.execution + input.autonomy + input.speed + input.consistency) / 5) * 1000,
    ) / 1000

    const entry: LeaderboardEntry = {
      family: input.family,
      provider: input.provider ?? 'Unknown',
      overall,
      reasoning: input.reasoning,
      execution: input.execution,
      autonomy: input.autonomy,
      speed: input.speed,
      consistency: input.consistency,
      challenges: 1,
      last_seen: new Date().toISOString(),
    }

    await this.store.upsert(entry)
    return entry
  }
}
