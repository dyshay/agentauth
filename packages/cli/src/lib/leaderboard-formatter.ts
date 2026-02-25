import type { BenchmarkResult } from './remote-runner.js'

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

/**
 * Converts benchmark results into leaderboard entries.
 * Groups by model name — multiple runs for the same model get averaged.
 */
export function formatLeaderboard(results: BenchmarkResult[]): LeaderboardEntry[] {
  const byModel = new Map<string, BenchmarkResult[]>()

  for (const r of results) {
    const existing = byModel.get(r.model) ?? []
    existing.push(r)
    byModel.set(r.model, existing)
  }

  const entries: LeaderboardEntry[] = []

  for (const [model, runs] of byModel) {
    const scores = runs
      .filter((r) => r.stats.avg_score)
      .map((r) => r.stats.avg_score!)

    if (scores.length === 0) continue

    const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length
    const round = (n: number) => Math.round(n * 1000) / 1000

    const reasoning = round(avg(scores.map((s) => s.reasoning)))
    const execution = round(avg(scores.map((s) => s.execution)))
    const autonomy = round(avg(scores.map((s) => s.autonomy)))
    const speed = round(avg(scores.map((s) => s.speed)))
    const consistency = round(avg(scores.map((s) => s.consistency)))
    const overall = round((reasoning + execution + autonomy + speed + consistency) / 5)
    const totalChallenges = runs.reduce((s, r) => s + r.rounds, 0)

    entries.push({
      family: model,
      provider: inferProvider(model),
      overall,
      reasoning,
      execution,
      autonomy,
      speed,
      consistency,
      challenges: totalChallenges,
      last_seen: new Date().toISOString(),
    })
  }

  return entries.sort((a, b) => b.overall - a.overall)
}

function inferProvider(model: string): string {
  const lower = model.toLowerCase()
  if (lower.includes('gpt') || lower.includes('o1') || lower.includes('o3')) return 'OpenAI'
  if (lower.includes('claude')) return 'Anthropic'
  if (lower.includes('gemini')) return 'Google'
  if (lower.includes('llama')) return 'Meta'
  if (lower.includes('mistral')) return 'Mistral'
  if (lower.includes('command')) return 'Cohere'
  if (lower.includes('grok')) return 'xAI'
  if (lower.includes('deepseek')) return 'DeepSeek'
  return 'Unknown'
}
