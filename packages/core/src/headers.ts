import type { AgentCapabilityScore } from './types.js'

export const AGENTAUTH_HEADERS = {
  STATUS: 'AgentAuth-Status',
  SCORE: 'AgentAuth-Score',
  MODEL_FAMILY: 'AgentAuth-Model-Family',
  POMI_CONFIDENCE: 'AgentAuth-PoMI-Confidence',
  CAPABILITIES: 'AgentAuth-Capabilities',
  VERSION: 'AgentAuth-Version',
  CHALLENGE_ID: 'AgentAuth-Challenge-Id',
  TOKEN_EXPIRES: 'AgentAuth-Token-Expires',
} as const

export type AgentAuthHeaderName = (typeof AGENTAUTH_HEADERS)[keyof typeof AGENTAUTH_HEADERS]

export function formatCapabilities(score: AgentCapabilityScore): string {
  return `reasoning=${score.reasoning},execution=${score.execution},autonomy=${score.autonomy},speed=${score.speed},consistency=${score.consistency}`
}

export function parseCapabilities(header: string): Partial<AgentCapabilityScore> {
  const result: Record<string, number> = {}
  for (const part of header.split(',')) {
    const [key, val] = part.split('=')
    if (key && val) {
      result[key.trim()] = parseFloat(val.trim())
    }
  }
  return result as Partial<AgentCapabilityScore>
}

export function buildHeaders(params: {
  status: 'verified' | 'unverified' | 'expired'
  score?: AgentCapabilityScore
  model_family?: string
  pomi_confidence?: number
  challenge_id?: string
  expires_at?: number
}): Record<string, string> {
  const headers: Record<string, string> = {
    [AGENTAUTH_HEADERS.STATUS]: params.status,
    [AGENTAUTH_HEADERS.VERSION]: '1',
  }

  if (params.score) {
    const avg = (params.score.reasoning + params.score.execution + params.score.autonomy + params.score.speed + params.score.consistency) / 5
    headers[AGENTAUTH_HEADERS.SCORE] = avg.toFixed(2)
    headers[AGENTAUTH_HEADERS.CAPABILITIES] = formatCapabilities(params.score)
  }

  if (params.model_family) {
    headers[AGENTAUTH_HEADERS.MODEL_FAMILY] = params.model_family
  }

  if (params.pomi_confidence !== undefined) {
    headers[AGENTAUTH_HEADERS.POMI_CONFIDENCE] = params.pomi_confidence.toFixed(2)
  }

  if (params.challenge_id) {
    headers[AGENTAUTH_HEADERS.CHALLENGE_ID] = params.challenge_id
  }

  if (params.expires_at) {
    headers[AGENTAUTH_HEADERS.TOKEN_EXPIRES] = params.expires_at.toString()
  }

  return headers
}
