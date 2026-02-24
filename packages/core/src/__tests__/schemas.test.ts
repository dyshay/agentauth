import { describe, it, expect } from 'vitest'
import {
  DifficultySchema,
  ChallengeDimensionSchema,
  ChallengePayloadSchema,
  ChallengeSchema,
  AgentCapabilityScoreSchema,
  VerifyResultSchema,
  ChallengeDataSchema,
  AgentAuthConfigSchema,
} from '../schemas.js'

describe('DifficultySchema', () => {
  it('accepts valid difficulties', () => {
    expect(DifficultySchema.parse('easy')).toBe('easy')
    expect(DifficultySchema.parse('medium')).toBe('medium')
    expect(DifficultySchema.parse('hard')).toBe('hard')
    expect(DifficultySchema.parse('adversarial')).toBe('adversarial')
  })

  it('rejects invalid difficulty', () => {
    expect(() => DifficultySchema.parse('impossible')).toThrow()
  })
})

describe('ChallengeDimensionSchema', () => {
  it('accepts valid dimensions', () => {
    expect(ChallengeDimensionSchema.parse('reasoning')).toBe('reasoning')
    expect(ChallengeDimensionSchema.parse('execution')).toBe('execution')
    expect(ChallengeDimensionSchema.parse('memory')).toBe('memory')
    expect(ChallengeDimensionSchema.parse('ambiguity')).toBe('ambiguity')
  })

  it('rejects invalid dimension', () => {
    expect(() => ChallengeDimensionSchema.parse('magic')).toThrow()
  })
})

describe('AgentCapabilityScoreSchema', () => {
  it('accepts valid scores', () => {
    const score = {
      reasoning: 0.94,
      execution: 0.98,
      autonomy: 0.91,
      speed: 0.87,
      consistency: 0.95,
    }
    expect(AgentCapabilityScoreSchema.parse(score)).toEqual(score)
  })

  it('rejects scores above 1', () => {
    expect(() =>
      AgentCapabilityScoreSchema.parse({
        reasoning: 1.5,
        execution: 0.98,
        autonomy: 0.91,
        speed: 0.87,
        consistency: 0.95,
      }),
    ).toThrow()
  })

  it('rejects scores below 0', () => {
    expect(() =>
      AgentCapabilityScoreSchema.parse({
        reasoning: -0.1,
        execution: 0.98,
        autonomy: 0.91,
        speed: 0.87,
        consistency: 0.95,
      }),
    ).toThrow()
  })
})

describe('ChallengePayloadSchema', () => {
  it('accepts valid payload', () => {
    const payload = {
      type: 'crypto-nl',
      instructions: 'XOR each byte with 0xA3',
      data: 'base64data==',
      steps: 1,
    }
    expect(ChallengePayloadSchema.parse(payload)).toEqual(payload)
  })

  it('accepts payload with optional context', () => {
    const payload = {
      type: 'multi-step',
      instructions: 'Step 1 of 3',
      data: 'base64data==',
      steps: 3,
      context: { previousResult: 'abc123' },
    }
    expect(ChallengePayloadSchema.parse(payload)).toEqual(payload)
  })
})

describe('ChallengeSchema', () => {
  it('accepts valid challenge', () => {
    const challenge = {
      id: 'ch_abc123',
      session_token: 'st_xyz789',
      payload: {
        type: 'crypto-nl',
        instructions: 'Reverse the bytes',
        data: 'base64data==',
        steps: 1,
      },
      difficulty: 'medium' as const,
      dimensions: ['reasoning', 'execution'] as const[],
      created_at: 1708784370,
      expires_at: 1708784400,
    }
    expect(ChallengeSchema.parse(challenge)).toEqual(challenge)
  })
})

describe('VerifyResultSchema', () => {
  it('accepts success result with token', () => {
    const result = {
      success: true,
      score: {
        reasoning: 0.94,
        execution: 0.98,
        autonomy: 0.91,
        speed: 0.87,
        consistency: 0.95,
      },
      token: 'eyJhbGc...',
    }
    expect(VerifyResultSchema.parse(result)).toEqual(result)
  })

  it('accepts failure result with reason', () => {
    const result = {
      success: false,
      score: {
        reasoning: 0,
        execution: 0,
        autonomy: 0,
        speed: 0,
        consistency: 0,
      },
      reason: 'expired' as const,
    }
    expect(VerifyResultSchema.parse(result)).toEqual(result)
  })
})

describe('ChallengeDataSchema', () => {
  it('accepts valid challenge data for store', () => {
    const data = {
      challenge: {
        id: 'ch_abc123',
        session_token: 'st_xyz789',
        payload: {
          type: 'crypto-nl',
          instructions: 'XOR with 0xA3',
          data: 'base64==',
          steps: 1,
        },
        difficulty: 'medium' as const,
        dimensions: ['reasoning'] as const[],
        created_at: 1708784370,
        expires_at: 1708784400,
      },
      answer_hash: 'sha256hexhash',
      attempts: 0,
      max_attempts: 3,
      created_at: 1708784370,
    }
    expect(ChallengeDataSchema.parse(data)).toEqual(data)
  })
})
