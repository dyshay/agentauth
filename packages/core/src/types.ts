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
}

export interface ChallengeData {
  challenge: Challenge
  answer_hash: string
  attempts: number
  max_attempts: number
  created_at: number
}

export interface ChallengeStore {
  set(id: string, data: ChallengeData, ttlSeconds: number): Promise<void>
  get(id: string): Promise<ChallengeData | null>
  delete(id: string): Promise<void>
}

export interface ChallengeDriver {
  name: string
  dimensions: ChallengeDimension[]
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
}
