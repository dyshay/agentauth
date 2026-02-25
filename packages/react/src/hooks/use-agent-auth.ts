import { useState, useCallback, useRef } from 'react'
import { AgentAuthClient } from '@xagentauth/client'
import type {
  ClientConfig,
  AuthenticateResult,
  ChallengeResponse,
  SolverResult,
  AgentAuthResponseHeaders,
} from '@xagentauth/client'
import type { Difficulty, ChallengeDimension, AgentCapabilityScore } from '@xagentauth/core'

export type AgentAuthStatus = 'idle' | 'authenticating' | 'success' | 'error'

export interface UseAgentAuthOptions {
  config: ClientConfig
  difficulty?: Difficulty
  dimensions?: ChallengeDimension[]
  solver: (challenge: ChallengeResponse) => Promise<SolverResult>
  onSuccess?: (result: AuthenticateResult) => void
  onError?: (error: Error) => void
}

export interface UseAgentAuthReturn {
  status: AgentAuthStatus
  authenticate: () => Promise<void>
  reset: () => void
  result: AuthenticateResult | null
  error: Error | null
  token: string | null
  score: AgentCapabilityScore | null
  headers: AgentAuthResponseHeaders | null
}

export function useAgentAuth(options: UseAgentAuthOptions): UseAgentAuthReturn {
  const [status, setStatus] = useState<AgentAuthStatus>('idle')
  const [result, setResult] = useState<AuthenticateResult | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const clientRef = useRef<AgentAuthClient | null>(null)

  const getClient = useCallback(() => {
    if (!clientRef.current) {
      clientRef.current = new AgentAuthClient(options.config)
    }
    return clientRef.current
  }, [options.config])

  const authenticate = useCallback(async () => {
    setStatus('authenticating')
    setError(null)
    setResult(null)

    try {
      const client = getClient()
      const authResult = await client.authenticate({
        difficulty: options.difficulty,
        dimensions: options.dimensions,
        solver: options.solver,
      })
      setResult(authResult)
      setStatus(authResult.success ? 'success' : 'error')

      if (authResult.success) {
        options.onSuccess?.(authResult)
      } else {
        const err = new Error(authResult.reason ?? 'Authentication failed')
        setError(err)
        options.onError?.(err)
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      setError(error)
      setStatus('error')
      options.onError?.(error)
    }
  }, [getClient, options])

  const reset = useCallback(() => {
    setStatus('idle')
    setResult(null)
    setError(null)
  }, [])

  return {
    status,
    authenticate,
    reset,
    result,
    error,
    token: result?.token ?? null,
    score: result?.score ?? null,
    headers: result?.headers ?? null,
  }
}
