import type {
  AgentAuthConfig,
  AgentCapabilityScore,
  ChallengeStore,
  ChallengeDriver,
  ChallengeData,
  VerifyResult,
  FailReason,
  Difficulty,
  ChallengeDimension,
} from './types.js'
import { generateId, generateSessionToken, hmacSha256Hex, timingSafeEqual } from './crypto.js'
import { TokenManager, type AgentAuthJWTPayload } from './token.js'
import { ChallengeRegistry } from './challenges/registry.js'

export interface InitChallengeOptions {
  difficulty?: Difficulty
  dimensions?: ChallengeDimension[]
}

export interface InitChallengeResult {
  id: string
  session_token: string
  expires_at: number
  ttl_seconds: number
}

export interface SolveInput {
  answer: string
  hmac: string
  metadata?: { model?: string; framework?: string }
}

export interface VerifyTokenResult {
  valid: boolean
  capabilities?: AgentCapabilityScore
  model_family?: string
  issued_at?: number
  expires_at?: number
}

export class AgentAuthEngine {
  private store: ChallengeStore
  private registry: ChallengeRegistry
  private tokenManager: TokenManager
  private challengeTtlSeconds: number
  private tokenTtlSeconds: number
  private minScore: number

  constructor(config: AgentAuthConfig) {
    this.store = config.store
    this.registry = new ChallengeRegistry()
    this.tokenManager = new TokenManager(config.secret)
    this.challengeTtlSeconds = config.challengeTtlSeconds ?? 30
    this.tokenTtlSeconds = config.tokenTtlSeconds ?? 3600
    this.minScore = config.minScore ?? 0.7

    // Register all drivers from config (backward compatible)
    for (const driver of config.drivers ?? []) {
      this.registry.register(driver)
    }
  }

  registerDriver(driver: ChallengeDriver): void {
    this.registry.register(driver)
  }

  async initChallenge(options: InitChallengeOptions = {}): Promise<InitChallengeResult> {
    const difficulty = options.difficulty ?? 'medium'
    const selected = this.registry.select({ dimensions: options.dimensions })
    const driver = selected[0]

    const id = generateId()
    const session_token = generateSessionToken()
    const now = Math.floor(Date.now() / 1000)
    const expires_at = now + this.challengeTtlSeconds

    const payload = await driver.generate(difficulty)
    const answerHash = await driver.computeAnswerHash(payload)

    const challengeData: ChallengeData = {
      challenge: {
        id,
        session_token,
        payload,
        difficulty,
        dimensions: [...driver.dimensions],
        created_at: now,
        expires_at,
      },
      answer_hash: answerHash,
      attempts: 0,
      max_attempts: 3,
      created_at: now,
    }

    await this.store.set(id, challengeData, this.challengeTtlSeconds)

    return { id, session_token, expires_at, ttl_seconds: this.challengeTtlSeconds }
  }

  async getChallenge(id: string, sessionToken: string) {
    const data = await this.store.get(id)
    if (!data) return null
    if (!timingSafeEqual(data.challenge.session_token, sessionToken)) return null

    // Return challenge without the context (ops) — agent must parse NL
    const { context: _context, ...publicPayload } = data.challenge.payload
    return {
      ...data.challenge,
      payload: publicPayload,
    }
  }

  async solveChallenge(id: string, input: SolveInput): Promise<VerifyResult> {
    const zeroScore: AgentCapabilityScore = {
      reasoning: 0,
      execution: 0,
      autonomy: 0,
      speed: 0,
      consistency: 0,
    }

    const data = await this.store.get(id)
    if (!data) {
      return { success: false, score: zeroScore, reason: 'expired' }
    }

    // Verify HMAC
    const expectedHmac = await hmacSha256Hex(input.answer, data.challenge.session_token)
    if (!timingSafeEqual(expectedHmac, input.hmac)) {
      return { success: false, score: zeroScore, reason: 'invalid_hmac' }
    }

    // Delete challenge from store (single-use)
    await this.store.delete(id)

    // Verify answer
    const driver = this.registry.get(data.challenge.payload.type)
    if (!driver) {
      return { success: false, score: zeroScore, reason: 'wrong_answer' }
    }

    const correct = await driver.verify(data.answer_hash, input.answer)
    if (!correct) {
      return { success: false, score: zeroScore, reason: 'wrong_answer' }
    }

    // Compute capability score
    const score = this.computeScore(data)

    // Generate token
    const token = await this.tokenManager.sign(
      {
        sub: id,
        capabilities: score,
        model_family: input.metadata?.model ?? 'unknown',
        challenge_ids: [id],
      },
      { ttlSeconds: this.tokenTtlSeconds },
    )

    return { success: true, score, token }
  }

  async verifyToken(token: string): Promise<VerifyTokenResult> {
    try {
      const payload = await this.tokenManager.verify(token)
      return {
        valid: true,
        capabilities: payload.capabilities,
        model_family: payload.model_family,
        issued_at: payload.iat,
        expires_at: payload.exp,
      }
    } catch {
      return { valid: false }
    }
  }

  private computeScore(data: ChallengeData): AgentCapabilityScore {
    // Basic scoring for Phase 1 — timing analysis comes in Phase 4
    return {
      reasoning: 0.9,
      execution: 0.95,
      autonomy: 0.9,
      speed: 0.85,
      consistency: 0.9,
    }
  }
}
