import { describe, it, expect, beforeAll } from 'vitest'
import { TokenManager } from '../token.js'
import type { AgentCapabilityScore } from '../types.js'

const TEST_SECRET = 'test-secret-that-is-at-least-32-bytes-long-for-hs256'

describe('TokenManager', () => {
  let manager: TokenManager

  beforeAll(() => {
    manager = new TokenManager(TEST_SECRET)
  })

  it('signs and verifies a token', async () => {
    const score: AgentCapabilityScore = {
      reasoning: 0.94,
      execution: 0.98,
      autonomy: 0.91,
      speed: 0.87,
      consistency: 0.95,
    }

    const token = await manager.sign({
      sub: 'ch_test123',
      capabilities: score,
      model_family: 'frontier',
      challenge_ids: ['ch_abc'],
    })

    expect(token).toMatch(/^eyJ/)

    const payload = await manager.verify(token)
    expect(payload.sub).toBe('ch_test123')
    expect(payload.capabilities).toEqual(score)
    expect(payload.model_family).toBe('frontier')
    expect(payload.challenge_ids).toEqual(['ch_abc'])
    expect(payload.iss).toBe('agentauth')
    expect(payload.agentauth_version).toBe('1')
  })

  it('rejects expired token', async () => {
    const token = await manager.sign(
      {
        sub: 'ch_expired',
        capabilities: {
          reasoning: 0,
          execution: 0,
          autonomy: 0,
          speed: 0,
          consistency: 0,
        },
        model_family: 'unknown',
        challenge_ids: [],
      },
      { ttlSeconds: 0 },
    )

    // Wait a tick for expiration
    await new Promise((r) => setTimeout(r, 1100))

    await expect(manager.verify(token)).rejects.toThrow()
  })

  it('rejects token signed with different secret', async () => {
    const other = new TokenManager('different-secret-also-at-least-32-bytes-long!!')
    const token = await other.sign({
      sub: 'ch_wrong',
      capabilities: {
        reasoning: 0,
        execution: 0,
        autonomy: 0,
        speed: 0,
        consistency: 0,
      },
      model_family: 'unknown',
      challenge_ids: [],
    })

    await expect(manager.verify(token)).rejects.toThrow()
  })

  it('decodes without verification', async () => {
    const token = await manager.sign({
      sub: 'ch_decode',
      capabilities: {
        reasoning: 0.5,
        execution: 0.5,
        autonomy: 0.5,
        speed: 0.5,
        consistency: 0.5,
      },
      model_family: 'mid-tier',
      challenge_ids: ['ch_xyz'],
    })

    const payload = manager.decode(token)
    expect(payload.sub).toBe('ch_decode')
    expect(payload.model_family).toBe('mid-tier')
  })

  it('uses custom TTL', async () => {
    const token = await manager.sign(
      {
        sub: 'ch_custom',
        capabilities: {
          reasoning: 1,
          execution: 1,
          autonomy: 1,
          speed: 1,
          consistency: 1,
        },
        model_family: 'frontier',
        challenge_ids: [],
      },
      { ttlSeconds: 7200 },
    )

    const payload = await manager.verify(token)
    const exp = payload.exp as number
    const iat = payload.iat as number
    expect(exp - iat).toBe(7200)
  })
})
