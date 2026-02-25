import { describe, it, expect, vi } from 'vitest'
import { runRemoteBenchmark, type HttpClient, type RoundResult, type SolverFn } from '../lib/remote-runner.js'

const fakeSolver: SolverFn = async () => 'test-answer'

function createMockClient(overrides?: Partial<{
  initResponse: unknown
  challengeResponse: unknown
  solveResponse: unknown
}>): HttpClient {
  const init = overrides?.initResponse ?? {
    id: 'ch_test123',
    session_token: 'st_abc',
    expires_at: Math.floor(Date.now() / 1000) + 30,
    ttl_seconds: 30,
  }
  const challenge = overrides?.challengeResponse ?? {
    id: 'ch_test123',
    payload: {
      type: 'crypto-nl',
      instructions: 'Test challenge',
      data: 'test',
      steps: 1,
    },
    difficulty: 'easy',
  }
  const solve = overrides?.solveResponse ?? {
    success: true,
    score: { reasoning: 0.9, execution: 0.95, autonomy: 0.9, speed: 0.85, consistency: 0.9 },
    token: 'jwt-token',
  }

  return {
    post: vi.fn(async (url: string) => {
      if (url.includes('/init')) return { status: 201, json: async () => init }
      if (url.includes('/solve')) return { status: 200, json: async () => solve }
      return { status: 404, json: async () => ({}) }
    }),
    get: vi.fn(async () => ({
      status: 200,
      json: async () => challenge,
    })),
  }
}

describe('runRemoteBenchmark', () => {
  it('runs specified number of rounds', async () => {
    const client = createMockClient()
    const result = await runRemoteBenchmark(
      { baseUrl: 'http://localhost:3000', model: 'test-model', rounds: 3, difficulty: 'easy' },
      client,
      undefined,
      fakeSolver,
    )

    expect(result.results).toHaveLength(3)
    expect(result.rounds).toBe(3)
    expect(result.model).toBe('test-model')
  })

  it('computes correct statistics on success', async () => {
    const client = createMockClient()
    const result = await runRemoteBenchmark(
      { baseUrl: 'http://localhost:3000', model: 'gpt-4o', rounds: 5, difficulty: 'medium' },
      client,
      undefined,
      fakeSolver,
    )

    expect(result.stats.successes).toBe(5)
    expect(result.stats.failures).toBe(0)
    expect(result.stats.success_rate).toBe(1)
    expect(result.stats.timing.mean_ms).toBeGreaterThan(0)
    expect(result.stats.timing.median_ms).toBeGreaterThan(0)
    expect(result.stats.avg_score).toBeDefined()
    expect(result.stats.avg_score!.reasoning).toBe(0.9)
  })

  it('handles solve failures', async () => {
    const client = createMockClient({
      solveResponse: { success: false, reason: 'wrong_answer', score: { reasoning: 0, execution: 0, autonomy: 0, speed: 0, consistency: 0 } },
    })

    const result = await runRemoteBenchmark(
      { baseUrl: 'http://localhost:3000', model: 'test', rounds: 2, difficulty: 'easy' },
      client,
      undefined,
      fakeSolver,
    )

    expect(result.stats.successes).toBe(0)
    expect(result.stats.failures).toBe(2)
    expect(result.stats.success_rate).toBe(0)
  })

  it('handles network errors gracefully', async () => {
    const client: HttpClient = {
      post: vi.fn(async () => { throw new Error('ECONNREFUSED') }),
      get: vi.fn(async () => { throw new Error('ECONNREFUSED') }),
    }

    const result = await runRemoteBenchmark(
      { baseUrl: 'http://localhost:9999', model: 'test', rounds: 1, difficulty: 'easy' },
      client,
      undefined,
      fakeSolver,
    )

    expect(result.results[0].success).toBe(false)
    expect(result.results[0].error).toBe('ECONNREFUSED')
  })

  it('calls onRound callback for each round', async () => {
    const client = createMockClient()
    const rounds: RoundResult[] = []

    await runRemoteBenchmark(
      { baseUrl: 'http://localhost:3000', model: 'test', rounds: 3, difficulty: 'easy' },
      client,
      (r) => rounds.push(r),
      fakeSolver,
    )

    expect(rounds).toHaveLength(3)
    expect(rounds[0].round).toBe(1)
    expect(rounds[2].round).toBe(3)
  })

  it('tags results with correct model and difficulty', async () => {
    const client = createMockClient()
    const result = await runRemoteBenchmark(
      { baseUrl: 'http://test:3000', model: 'claude-4', rounds: 1, difficulty: 'hard' },
      client,
      undefined,
      fakeSolver,
    )

    expect(result.model).toBe('claude-4')
    expect(result.difficulty).toBe('hard')
  })
})
