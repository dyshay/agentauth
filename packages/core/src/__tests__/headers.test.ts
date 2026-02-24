import { describe, it, expect } from 'vitest'
import {
  AGENTAUTH_HEADERS,
  formatCapabilities,
  parseCapabilities,
  buildHeaders,
} from '../headers.js'
import type { AgentCapabilityScore } from '../types.js'

const SAMPLE_SCORE: AgentCapabilityScore = {
  reasoning: 0.94,
  execution: 0.98,
  autonomy: 0.91,
  speed: 0.87,
  consistency: 0.95,
}

describe('AGENTAUTH_HEADERS', () => {
  it('defines all standard header names', () => {
    expect(AGENTAUTH_HEADERS.STATUS).toBe('AgentAuth-Status')
    expect(AGENTAUTH_HEADERS.SCORE).toBe('AgentAuth-Score')
    expect(AGENTAUTH_HEADERS.MODEL_FAMILY).toBe('AgentAuth-Model-Family')
    expect(AGENTAUTH_HEADERS.POMI_CONFIDENCE).toBe('AgentAuth-PoMI-Confidence')
    expect(AGENTAUTH_HEADERS.CAPABILITIES).toBe('AgentAuth-Capabilities')
    expect(AGENTAUTH_HEADERS.VERSION).toBe('AgentAuth-Version')
    expect(AGENTAUTH_HEADERS.CHALLENGE_ID).toBe('AgentAuth-Challenge-Id')
    expect(AGENTAUTH_HEADERS.TOKEN_EXPIRES).toBe('AgentAuth-Token-Expires')
  })
})

describe('formatCapabilities', () => {
  it('formats capabilities as key=value pairs', () => {
    const result = formatCapabilities(SAMPLE_SCORE)
    expect(result).toBe('reasoning=0.94,execution=0.98,autonomy=0.91,speed=0.87,consistency=0.95')
  })
})

describe('parseCapabilities', () => {
  it('parses formatted capabilities string', () => {
    const formatted = formatCapabilities(SAMPLE_SCORE)
    const parsed = parseCapabilities(formatted)
    expect(parsed.reasoning).toBe(0.94)
    expect(parsed.execution).toBe(0.98)
    expect(parsed.autonomy).toBe(0.91)
    expect(parsed.speed).toBe(0.87)
    expect(parsed.consistency).toBe(0.95)
  })

  it('handles empty string gracefully', () => {
    const parsed = parseCapabilities('')
    expect(Object.keys(parsed)).toHaveLength(0)
  })
})

describe('buildHeaders', () => {
  it('returns minimal headers for unverified status', () => {
    const headers = buildHeaders({ status: 'unverified' })
    expect(headers['AgentAuth-Status']).toBe('unverified')
    expect(headers['AgentAuth-Version']).toBe('1')
    expect(headers['AgentAuth-Score']).toBeUndefined()
  })

  it('returns full headers for verified result', () => {
    const headers = buildHeaders({
      status: 'verified',
      score: SAMPLE_SCORE,
      model_family: 'gpt-4-class',
      pomi_confidence: 0.87,
      challenge_id: 'ch_abc123',
      expires_at: 1708784400,
    })
    expect(headers['AgentAuth-Status']).toBe('verified')
    expect(headers['AgentAuth-Score']).toBe('0.93')
    expect(headers['AgentAuth-Model-Family']).toBe('gpt-4-class')
    expect(headers['AgentAuth-PoMI-Confidence']).toBe('0.87')
    expect(headers['AgentAuth-Capabilities']).toContain('reasoning=0.94')
    expect(headers['AgentAuth-Challenge-Id']).toBe('ch_abc123')
    expect(headers['AgentAuth-Token-Expires']).toBe('1708784400')
    expect(headers['AgentAuth-Version']).toBe('1')
  })

  it('omits optional fields when not provided', () => {
    const headers = buildHeaders({ status: 'verified', score: SAMPLE_SCORE })
    expect(headers['AgentAuth-Model-Family']).toBeUndefined()
    expect(headers['AgentAuth-PoMI-Confidence']).toBeUndefined()
    expect(headers['AgentAuth-Challenge-Id']).toBeUndefined()
    expect(headers['AgentAuth-Token-Expires']).toBeUndefined()
  })
})
