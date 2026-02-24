import type { AgentCapabilityScore, Difficulty, ChallengeDimension, ModelIdentification, TimingAnalysis, ChallengePayload } from '@xagentauth/core'

export interface ClientConfig {
  baseUrl: string
  apiKey?: string
  timeout?: number  // default 30000ms
}

export interface InitChallengeOptions {
  difficulty?: Difficulty
  dimensions?: ChallengeDimension[]
}

export interface InitChallengeResponse {
  id: string
  session_token: string
  expires_at: number
  ttl_seconds: number
}

export interface ChallengeResponse {
  id: string
  payload: ChallengePayload
  difficulty: Difficulty
  dimensions: ChallengeDimension[]
  created_at: number
  expires_at: number
}

export interface SolveResponse {
  success: boolean
  score: AgentCapabilityScore
  token?: string
  reason?: string
  model_identity?: ModelIdentification
  timing_analysis?: TimingAnalysis
}

export interface VerifyTokenResponse {
  valid: boolean
  capabilities?: AgentCapabilityScore
  model_family?: string
  issued_at?: number
  expires_at?: number
}

export interface SolverResult {
  answer: string
  canary_responses?: Record<string, string>
}

export interface AuthenticateOptions {
  difficulty?: Difficulty
  dimensions?: ChallengeDimension[]
  solver: (challenge: ChallengeResponse) => Promise<SolverResult>
}

export interface AuthenticateResult {
  success: boolean
  token?: string
  score: AgentCapabilityScore
  model_identity?: ModelIdentification
  timing_analysis?: TimingAnalysis
  reason?: string
}
