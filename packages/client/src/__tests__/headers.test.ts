import { describe, it, expect } from 'vitest'
import { AGENTAUTH_HEADERS } from '@xagentauth/core'

// Test that the AgentAuthResponseHeaders type works
import type { AgentAuthResponseHeaders } from '../types.js'

describe('AgentAuthResponseHeaders', () => {
  it('can represent full header set', () => {
    const headers: AgentAuthResponseHeaders = {
      status: 'verified',
      score: 0.93,
      model_family: 'gpt-4-class',
      pomi_confidence: 0.87,
      capabilities: 'reasoning=0.94,execution=0.98,autonomy=0.91,speed=0.87,consistency=0.95',
      version: '1',
      challenge_id: 'ch_abc123',
      token_expires: 1708784400,
    }
    expect(headers.status).toBe('verified')
    expect(headers.score).toBe(0.93)
    expect(headers.model_family).toBe('gpt-4-class')
    expect(headers.pomi_confidence).toBe(0.87)
    expect(headers.capabilities).toContain('reasoning=0.94')
    expect(headers.version).toBe('1')
    expect(headers.challenge_id).toBe('ch_abc123')
    expect(headers.token_expires).toBe(1708784400)
  })

  it('can represent minimal header set', () => {
    const headers: AgentAuthResponseHeaders = {}
    expect(headers.status).toBeUndefined()
    expect(headers.score).toBeUndefined()
    expect(headers.model_family).toBeUndefined()
    expect(headers.pomi_confidence).toBeUndefined()
    expect(headers.capabilities).toBeUndefined()
    expect(headers.version).toBeUndefined()
    expect(headers.challenge_id).toBeUndefined()
    expect(headers.token_expires).toBeUndefined()
  })

  it('AGENTAUTH_HEADERS constants have correct values', () => {
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
