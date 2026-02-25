import { describe, it, expect } from 'vitest'
import { formatLeaderboard, type LeaderboardEntry } from '../lib/leaderboard-formatter.js'
import type { BenchmarkResult } from '../lib/remote-runner.js'

function makeBenchmarkResult(model: string, score: {
  reasoning: number
  execution: number
  autonomy: number
  speed: number
  consistency: number
}, rounds = 10): BenchmarkResult {
  return {
    model,
    difficulty: 'medium',
    rounds,
    results: Array.from({ length: rounds }, (_, i) => ({
      round: i + 1,
      success: true,
      elapsed_ms: 50 + Math.random() * 50,
      score,
    })),
    stats: {
      successes: rounds,
      failures: 0,
      success_rate: 1,
      timing: { mean_ms: 75, median_ms: 72, min_ms: 51, max_ms: 99, std_ms: 14 },
      avg_score: score,
    },
  }
}

describe('formatLeaderboard', () => {
  it('converts benchmark results to sorted leaderboard entries', () => {
    const results: BenchmarkResult[] = [
      makeBenchmarkResult('gpt-4o', { reasoning: 0.95, execution: 0.90, autonomy: 0.85, speed: 0.80, consistency: 0.88 }),
      makeBenchmarkResult('claude-4', { reasoning: 0.98, execution: 0.95, autonomy: 0.92, speed: 0.90, consistency: 0.96 }),
    ]

    const entries = formatLeaderboard(results)

    expect(entries).toHaveLength(2)
    // Claude should rank first (higher overall)
    expect(entries[0].family).toBe('claude-4')
    expect(entries[1].family).toBe('gpt-4o')
  })

  it('computes correct overall score', () => {
    const score = { reasoning: 0.9, execution: 0.8, autonomy: 0.7, speed: 0.6, consistency: 0.5 }
    const entries = formatLeaderboard([makeBenchmarkResult('test-model', score)])

    expect(entries[0].overall).toBe(0.7) // (0.9+0.8+0.7+0.6+0.5)/5
  })

  it('infers provider from model name', () => {
    const entries = formatLeaderboard([
      makeBenchmarkResult('gpt-4o', { reasoning: 0.9, execution: 0.9, autonomy: 0.9, speed: 0.9, consistency: 0.9 }),
      makeBenchmarkResult('claude-4-opus', { reasoning: 0.9, execution: 0.9, autonomy: 0.9, speed: 0.9, consistency: 0.9 }),
      makeBenchmarkResult('gemini-2-pro', { reasoning: 0.9, execution: 0.9, autonomy: 0.9, speed: 0.9, consistency: 0.9 }),
      makeBenchmarkResult('llama-4', { reasoning: 0.9, execution: 0.9, autonomy: 0.9, speed: 0.9, consistency: 0.9 }),
      makeBenchmarkResult('custom-model', { reasoning: 0.9, execution: 0.9, autonomy: 0.9, speed: 0.9, consistency: 0.9 }),
    ])

    const byFamily = Object.fromEntries(entries.map((e) => [e.family, e.provider]))
    expect(byFamily['gpt-4o']).toBe('OpenAI')
    expect(byFamily['claude-4-opus']).toBe('Anthropic')
    expect(byFamily['gemini-2-pro']).toBe('Google')
    expect(byFamily['llama-4']).toBe('Meta')
    expect(byFamily['custom-model']).toBe('Unknown')
  })

  it('merges multiple runs for the same model', () => {
    const results: BenchmarkResult[] = [
      makeBenchmarkResult('gpt-4o', { reasoning: 0.90, execution: 0.90, autonomy: 0.90, speed: 0.90, consistency: 0.90 }, 5),
      makeBenchmarkResult('gpt-4o', { reasoning: 0.80, execution: 0.80, autonomy: 0.80, speed: 0.80, consistency: 0.80 }, 5),
    ]

    const entries = formatLeaderboard(results)

    expect(entries).toHaveLength(1)
    expect(entries[0].family).toBe('gpt-4o')
    expect(entries[0].overall).toBe(0.85)
    expect(entries[0].challenges).toBe(10) // 5 + 5
  })

  it('skips results with no scores', () => {
    const result: BenchmarkResult = {
      model: 'broken',
      difficulty: 'easy',
      rounds: 3,
      results: [
        { round: 1, success: false, elapsed_ms: 100, error: 'fail' },
        { round: 2, success: false, elapsed_ms: 100, error: 'fail' },
        { round: 3, success: false, elapsed_ms: 100, error: 'fail' },
      ],
      stats: {
        successes: 0,
        failures: 3,
        success_rate: 0,
        timing: { mean_ms: 100, median_ms: 100, min_ms: 100, max_ms: 100, std_ms: 0 },
      },
    }

    const entries = formatLeaderboard([result])
    expect(entries).toHaveLength(0)
  })

  it('includes last_seen as ISO date', () => {
    const entries = formatLeaderboard([
      makeBenchmarkResult('test', { reasoning: 0.9, execution: 0.9, autonomy: 0.9, speed: 0.9, consistency: 0.9 }),
    ])

    expect(entries[0].last_seen).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })
})
