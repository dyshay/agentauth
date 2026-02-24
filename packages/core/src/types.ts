export type Difficulty = 'easy' | 'medium' | 'hard' | 'adversarial'

export type ChallengeDimension = 'reasoning' | 'execution' | 'memory' | 'ambiguity'

export interface ChallengePayload {
  type: string
  instructions: string
  data: string
  steps: number
  context?: Record<string, unknown>
}

export interface Challenge {
  id: string
  session_token: string
  payload: ChallengePayload
  difficulty: Difficulty
  dimensions: ChallengeDimension[]
  created_at: number
  expires_at: number
}

export interface AgentCapabilityScore {
  reasoning: number
  execution: number
  autonomy: number
  speed: number
  consistency: number
}

export type FailReason =
  | 'wrong_answer'
  | 'expired'
  | 'already_used'
  | 'invalid_hmac'
  | 'too_fast'
  | 'too_slow'
  | 'rate_limited'

export interface VerifyResult {
  success: boolean
  score: AgentCapabilityScore
  token?: string
  reason?: FailReason
  model_identity?: ModelIdentification
}

export interface ChallengeData {
  challenge: Challenge
  answer_hash: string
  attempts: number
  max_attempts: number
  created_at: number
  injected_canaries?: Canary[]
}

export interface ChallengeStore {
  set(id: string, data: ChallengeData, ttlSeconds: number): Promise<void>
  get(id: string): Promise<ChallengeData | null>
  delete(id: string): Promise<void>
}

export interface ChallengeDriver {
  name: string
  dimensions: readonly ChallengeDimension[]
  estimatedHumanTimeMs: number
  estimatedAiTimeMs: number
  generate(difficulty: Difficulty): Promise<ChallengePayload>
  computeAnswerHash(payload: ChallengePayload): Promise<string>
  verify(answerHash: string, submittedAnswer: unknown): Promise<boolean>
}

export interface AgentAuthConfig {
  secret: string
  store: ChallengeStore
  drivers?: ChallengeDriver[]
  tokenTtlSeconds?: number
  challengeTtlSeconds?: number
  minScore?: number
  pomi?: PomiConfig
}

// --- PoMI (Proof of Model Identity) Types ---

export type InjectionMethod = 'inline' | 'prefix' | 'suffix' | 'embedded'

export interface CanaryAnalysisExactMatch {
  type: 'exact_match'
  expected: Record<string, string>
}

export interface Distribution {
  mean: number
  stddev: number
}

export interface CanaryAnalysisStatistical {
  type: 'statistical'
  distributions: Record<string, Distribution>
}

export interface CanaryAnalysisPattern {
  type: 'pattern'
  patterns: Record<string, string>
}

export type CanaryAnalysis =
  | CanaryAnalysisExactMatch
  | CanaryAnalysisStatistical
  | CanaryAnalysisPattern

export interface Canary {
  id: string
  prompt: string
  injection_method: InjectionMethod
  analysis: CanaryAnalysis
  confidence_weight: number
}

export interface ModelSignature {
  model_family: string
  expected_value: string | number
  confidence: number
  last_verified: string
}

export interface CanaryEvidence {
  canary_id: string
  observed: string
  expected: string
  match: boolean
  confidence_contribution: number
}

export interface ModelIdentification {
  family: string
  confidence: number
  evidence: CanaryEvidence[]
  alternatives: Array<{ family: string; confidence: number }>
}

export interface CanaryResponseData {
  canary_id: string
  response: string
}

export interface PomiConfig {
  enabled: boolean
  canaries?: Canary[]
  canariesPerChallenge?: number
  modelFamilies?: string[]
  confidenceThreshold?: number
}
