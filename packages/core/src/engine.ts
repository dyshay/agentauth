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
  PomiConfig,
  Canary,
  ModelIdentification,
  TimingConfig,
  TimingAnalysis,
  TimingPatternAnalysis,
  SessionTimingAnomaly,
} from './types.js'
import { generateId, generateSessionToken, hmacSha256Hex, timingSafeEqual } from './crypto.js'
import { TokenManager, type AgentAuthJWTPayload } from './token.js'
import { ChallengeRegistry } from './challenges/registry.js'
import { CanaryCatalog } from './pomi/catalog.js'
import { CanaryInjector } from './pomi/injector.js'
import { ModelClassifier } from './pomi/classifier.js'
import { TimingAnalyzer } from './timing/analyzer.js'
import { SessionTimingTracker } from './timing/session-tracker.js'

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
  canary_responses?: Record<string, string>
  metadata?: { model?: string; framework?: string }
  client_rtt_ms?: number
  step_timings?: number[]
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
  private pomiConfig?: PomiConfig
  private canaryInjector?: CanaryInjector
  private modelClassifier?: ModelClassifier
  private timingAnalyzer?: TimingAnalyzer
  private sessionTracker?: SessionTimingTracker

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

    // Initialize timing analyzer if enabled
    if (config.timing?.enabled) {
      this.timingAnalyzer = new TimingAnalyzer(config.timing)
      if (config.timing.sessionTracking?.enabled) {
        this.sessionTracker = new SessionTimingTracker()
      }
    }

    // Initialize PoMI if enabled
    if (config.pomi?.enabled) {
      this.pomiConfig = config.pomi
      const catalog = new CanaryCatalog(config.pomi.canaries)
      this.canaryInjector = new CanaryInjector(catalog)
      this.modelClassifier = new ModelClassifier(
        config.pomi.modelFamilies ?? ['gpt-4-class', 'claude-3-class', 'gemini-class', 'llama-class', 'mistral-class'],
        { confidenceThreshold: config.pomi.confidenceThreshold ?? 0.5 },
      )
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

    // Compute answer hash from ORIGINAL payload (before canary injection)
    const answerHash = await driver.computeAnswerHash(payload)

    // Inject canaries if PoMI is enabled
    let finalPayload = payload
    let injectedCanaries: Canary[] | undefined

    if (this.canaryInjector && this.pomiConfig) {
      const injectionResult = this.canaryInjector.inject(
        payload,
        this.pomiConfig.canariesPerChallenge ?? 2,
      )
      finalPayload = injectionResult.payload
      injectedCanaries = injectionResult.injected
    }

    const challengeData: ChallengeData = {
      challenge: {
        id,
        session_token,
        payload: finalPayload,
        difficulty,
        dimensions: [...driver.dimensions],
        created_at: now,
        expires_at,
      },
      answer_hash: answerHash,
      attempts: 0,
      max_attempts: 3,
      created_at: now,
      created_at_server_ms: Date.now(),
      injected_canaries: injectedCanaries,
    }

    await this.store.set(id, challengeData, this.challengeTtlSeconds)

    return { id, session_token, expires_at, ttl_seconds: this.challengeTtlSeconds }
  }

  async getChallenge(id: string, sessionToken: string) {
    const data = await this.store.get(id)
    if (!data) return null
    if (!timingSafeEqual(data.challenge.session_token, sessionToken)) return null

    // Return challenge without context (ops) and session_token (already known by agent)
    const { context: _context, ...publicPayload } = data.challenge.payload
    const { session_token: _token, ...challenge } = data.challenge
    return {
      ...challenge,
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

    // Compute timing analysis
    let timingAnalysis: TimingAnalysis | undefined

    if (this.timingAnalyzer) {
      const now = Date.now()
      const baseElapsed = data.created_at_server_ms
        ? now - data.created_at_server_ms
        : now - data.challenge.created_at * 1000

      // RTT compensation: subtract client RTT, capped at 50% of elapsed
      const rttMs = input.client_rtt_ms && input.client_rtt_ms > 0
        ? Math.min(input.client_rtt_ms, baseElapsed * 0.5)
        : 0
      const elapsed_ms = baseElapsed - rttMs

      timingAnalysis = this.timingAnalyzer.analyze({
        elapsed_ms,
        challenge_type: data.challenge.payload.type,
        difficulty: data.challenge.difficulty,
        rtt_ms: rttMs > 0 ? rttMs : undefined,
      })

      // Reject too_fast and timeout
      if (timingAnalysis.zone === 'too_fast') {
        return { success: false, score: zeroScore, reason: 'too_fast', timing_analysis: timingAnalysis }
      }
      if (timingAnalysis.zone === 'timeout') {
        return { success: false, score: zeroScore, reason: 'timeout', timing_analysis: timingAnalysis }
      }
    }

    // Analyze per-step timing patterns
    let patternAnalysis: TimingPatternAnalysis | undefined

    if (this.timingAnalyzer && input.step_timings?.length) {
      patternAnalysis = this.timingAnalyzer.analyzePattern(input.step_timings)
    }

    // Compute capability score
    const score = this.computeScore(data, timingAnalysis, patternAnalysis)

    // Classify model identity if PoMI is enabled
    let modelIdentity: ModelIdentification | undefined

    if (this.modelClassifier && data.injected_canaries) {
      modelIdentity = this.modelClassifier.classify(
        data.injected_canaries,
        input.canary_responses,
      )
    }

    // Update model_family in token to use PoMI result if available
    const modelFamily = modelIdentity?.family !== 'unknown'
      ? modelIdentity?.family ?? input.metadata?.model ?? 'unknown'
      : input.metadata?.model ?? 'unknown'

    // Session tracking for anti-gaming
    let sessionAnomalies: SessionTimingAnomaly[] | undefined

    if (this.sessionTracker && timingAnalysis && input.metadata?.model) {
      const sessionKey = input.metadata.model
      this.sessionTracker.record(sessionKey, timingAnalysis.elapsed_ms, timingAnalysis.zone)
      const anomalies = this.sessionTracker.analyze(sessionKey)
      if (anomalies.length > 0) {
        sessionAnomalies = anomalies
      }
    }

    // Generate token
    const token = await this.tokenManager.sign(
      {
        sub: id,
        capabilities: score,
        model_family: modelFamily,
        challenge_ids: [id],
      },
      { ttlSeconds: this.tokenTtlSeconds },
    )

    return {
      success: true, score, token, model_identity: modelIdentity,
      timing_analysis: timingAnalysis, pattern_analysis: patternAnalysis,
      session_anomalies: sessionAnomalies,
    }
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

  private computeScore(data: ChallengeData, timingAnalysis?: TimingAnalysis, patternAnalysis?: TimingPatternAnalysis): AgentCapabilityScore {
    const dims = data.challenge.dimensions
    const penalty = timingAnalysis?.penalty ?? 0
    const zone = timingAnalysis?.zone

    // Pattern-based penalty: artificial verdict reduces autonomy and consistency
    const patternPenalty = patternAnalysis?.verdict === 'artificial' ? 0.3 : 0

    return {
      reasoning: dims.includes('reasoning') ? 0.9 : 0.5,
      execution: dims.includes('execution') ? 0.95 : 0.5,
      speed: Math.round((1 - penalty) * 0.95 * 1000) / 1000,
      autonomy: Math.round(
        ((zone === 'human' || zone === 'suspicious')
          ? (1 - penalty) * 0.9
          : 0.9) * (1 - patternPenalty) * 1000,
      ) / 1000,
      consistency: Math.round(
        (dims.includes('memory') ? 0.92 : 0.9) * (1 - patternPenalty) * 1000,
      ) / 1000,
    }
  }
}
