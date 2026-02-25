import {
  CryptoNLDriver,
  MultiStepDriver,
  AmbiguousLogicDriver,
  CodeExecutionDriver,
} from '@xagentauth/core'
import type { ChallengeDriver, ChallengePayload, Difficulty, AgentCapabilityScore } from '@xagentauth/core'

export interface RemoteRunnerOptions {
  baseUrl: string
  model: string
  rounds: number
  difficulty: Difficulty
  type?: string
}

export interface RoundResult {
  round: number
  success: boolean
  elapsed_ms: number
  score?: AgentCapabilityScore
  error?: string
}

export interface BenchmarkResult {
  model: string
  difficulty: Difficulty
  rounds: number
  results: RoundResult[]
  stats: BenchmarkStats
}

export interface BenchmarkStats {
  successes: number
  failures: number
  success_rate: number
  timing: {
    mean_ms: number
    median_ms: number
    min_ms: number
    max_ms: number
    std_ms: number
  }
  avg_score?: AgentCapabilityScore
}

// Minimal interface so we can inject a test double
export interface HttpClient {
  post(url: string, body: unknown): Promise<{ status: number; json(): Promise<unknown> }>
  get(url: string, headers?: Record<string, string>): Promise<{ status: number; json(): Promise<unknown> }>
}

class FetchHttpClient implements HttpClient {
  constructor(private baseUrl: string) {}

  async post(path: string, body: unknown) {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return { status: res.status, json: () => res.json() }
  }

  async get(path: string, headers?: Record<string, string>) {
    const res = await fetch(`${this.baseUrl}${path}`, { headers })
    return { status: res.status, json: () => res.json() }
  }
}

const DRIVERS: Record<string, () => ChallengeDriver> = {
  'crypto-nl': () => new CryptoNLDriver(),
  'multi-step': () => new MultiStepDriver(),
  'ambiguous-logic': () => new AmbiguousLogicDriver(),
  'code-execution': () => new CodeExecutionDriver(),
}

function getDriver(type: string): ChallengeDriver {
  const factory = DRIVERS[type]
  if (factory) return factory()
  // Fallback — try all drivers, solve will fail for wrong type
  return new CryptoNLDriver()
}

async function solveLocally(driver: ChallengeDriver, payload: ChallengePayload): Promise<string | null> {
  try {
    if ('solve' in driver && typeof (driver as Record<string, unknown>).solve === 'function') {
      return await (driver as unknown as { solve(p: ChallengePayload): Promise<string> }).solve(payload)
    }
  } catch {
    // Driver solve requires context that the remote server doesn't expose
    return null
  }
  return null
}

async function computeHmac(answer: string, sessionToken: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(sessionToken),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(answer))
  return Array.from(new Uint8Array(sig as ArrayBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export type SolverFn = (payload: ChallengePayload) => Promise<string | null>

export async function runRemoteBenchmark(
  options: RemoteRunnerOptions,
  httpClient?: HttpClient,
  onRound?: (result: RoundResult) => void,
  solver?: SolverFn,
): Promise<BenchmarkResult> {
  const client = httpClient ?? new FetchHttpClient(options.baseUrl)
  const results: RoundResult[] = []

  for (let i = 0; i < options.rounds; i++) {
    const start = performance.now()

    try {
      // 1. Init challenge
      const initRes = await client.post('/v1/challenge/init', {
        difficulty: options.difficulty,
      })
      const init = (await initRes.json()) as {
        id: string
        session_token: string
      }

      // 2. Retrieve challenge
      const challengeRes = await client.get(
        `/v1/challenge/${init.id}`,
        { Authorization: `Bearer ${init.session_token}` },
      )
      const challenge = (await challengeRes.json()) as {
        payload: ChallengePayload & { type: string }
      }

      // 3. Solve locally using custom solver or the appropriate driver
      let answer: string | null
      if (solver) {
        answer = await solver(challenge.payload)
      } else {
        const driver = getDriver(challenge.payload.type)
        answer = await solveLocally(driver, challenge.payload)
      }
      if (!answer) {
        const elapsed = performance.now() - start
        const result: RoundResult = { round: i + 1, success: false, elapsed_ms: elapsed, error: 'no_solver' }
        results.push(result)
        onRound?.(result)
        continue
      }

      // 4. Compute HMAC and submit
      const hmac = await computeHmac(answer, init.session_token)
      const solveRes = await client.post(`/v1/challenge/${init.id}/solve`, {
        answer,
        hmac,
        metadata: { model: options.model, framework: 'agentauth-cli' },
      })
      const solve = (await solveRes.json()) as {
        success: boolean
        score?: AgentCapabilityScore
        reason?: string
      }

      const elapsed = performance.now() - start
      const result: RoundResult = {
        round: i + 1,
        success: solve.success,
        elapsed_ms: elapsed,
        score: solve.score,
        error: solve.reason,
      }
      results.push(result)
      onRound?.(result)
    } catch (err) {
      const elapsed = performance.now() - start
      const result: RoundResult = {
        round: i + 1,
        success: false,
        elapsed_ms: elapsed,
        error: err instanceof Error ? err.message : 'unknown_error',
      }
      results.push(result)
      onRound?.(result)
    }
  }

  return {
    model: options.model,
    difficulty: options.difficulty,
    rounds: options.rounds,
    results,
    stats: computeStats(results),
  }
}

function computeStats(results: RoundResult[]): BenchmarkStats {
  const timings = results.map((r) => r.elapsed_ms)
  const successes = results.filter((r) => r.success).length

  const mean = timings.reduce((a, b) => a + b, 0) / timings.length
  const sorted = [...timings].sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)]
  const min = sorted[0]
  const max = sorted[sorted.length - 1]
  const std = Math.sqrt(timings.reduce((sum, t) => sum + (t - mean) ** 2, 0) / timings.length)

  // Average capability scores from successful rounds
  const scored = results.filter((r) => r.success && r.score)
  let avg_score: AgentCapabilityScore | undefined
  if (scored.length > 0) {
    avg_score = {
      reasoning: scored.reduce((s, r) => s + r.score!.reasoning, 0) / scored.length,
      execution: scored.reduce((s, r) => s + r.score!.execution, 0) / scored.length,
      autonomy: scored.reduce((s, r) => s + r.score!.autonomy, 0) / scored.length,
      speed: scored.reduce((s, r) => s + r.score!.speed, 0) / scored.length,
      consistency: scored.reduce((s, r) => s + r.score!.consistency, 0) / scored.length,
    }
  }

  return {
    successes,
    failures: results.length - successes,
    success_rate: successes / results.length,
    timing: {
      mean_ms: Math.round(mean * 10) / 10,
      median_ms: Math.round(median * 10) / 10,
      min_ms: Math.round(min * 10) / 10,
      max_ms: Math.round(max * 10) / 10,
      std_ms: Math.round(std * 10) / 10,
    },
    avg_score,
  }
}
