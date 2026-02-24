import { hmacSha256Hex } from '@xagentauth/core'
import { HttpTransport } from './http.js'
import type {
  ClientConfig,
  InitChallengeOptions,
  InitChallengeResponse,
  ChallengeResponse,
  SolveResponse,
  VerifyTokenResponse,
  AuthenticateOptions,
  AuthenticateResult,
} from './types.js'

export class AgentAuthClient {
  private http: HttpTransport

  constructor(config: ClientConfig) {
    this.http = new HttpTransport(config)
  }

  async initChallenge(options?: InitChallengeOptions): Promise<InitChallengeResponse> {
    return this.http.post<InitChallengeResponse>('/v1/challenge/init', {
      difficulty: options?.difficulty ?? 'medium',
      dimensions: options?.dimensions,
    })
  }

  async getChallenge(id: string, sessionToken: string): Promise<ChallengeResponse> {
    return this.http.get<ChallengeResponse>(`/v1/challenge/${id}`, {
      Authorization: `Bearer ${sessionToken}`,
    })
  }

  async solve(
    id: string,
    answer: string,
    sessionToken: string,
    canaryResponses?: Record<string, string>,
    metadata?: { model?: string; framework?: string },
  ): Promise<SolveResponse> {
    const hmac = await hmacSha256Hex(answer, sessionToken)
    return this.http.post<SolveResponse>(`/v1/challenge/${id}/solve`, {
      answer,
      hmac,
      canary_responses: canaryResponses,
      metadata,
    })
  }

  async verifyToken(token: string): Promise<VerifyTokenResponse> {
    return this.http.get<VerifyTokenResponse>('/v1/token/verify', {
      Authorization: `Bearer ${token}`,
    })
  }

  async authenticate(options: AuthenticateOptions): Promise<AuthenticateResult> {
    // Step 1: Init challenge
    const init = await this.initChallenge({
      difficulty: options.difficulty,
      dimensions: options.dimensions,
    })

    // Step 2: Get challenge
    const challenge = await this.getChallenge(init.id, init.session_token)

    // Step 3: Solve with user-provided solver
    const solverResult = await options.solver(challenge)

    // Step 4: Submit solution (auto HMAC)
    const result = await this.solve(
      init.id,
      solverResult.answer,
      init.session_token,
      solverResult.canary_responses,
    )

    return {
      success: result.success,
      token: result.token,
      score: result.score,
      model_identity: result.model_identity,
      timing_analysis: result.timing_analysis,
      reason: result.reason,
    }
  }
}
