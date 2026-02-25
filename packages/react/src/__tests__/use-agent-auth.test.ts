import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAgentAuth } from '../hooks/use-agent-auth.js'

vi.mock('@xagentauth/client', () => ({
  AgentAuthClient: vi.fn().mockImplementation(() => ({
    authenticate: vi.fn().mockResolvedValue({
      success: true,
      token: 'jwt_test_token',
      score: { reasoning: 0.9, execution: 0.95, autonomy: 0.85, speed: 0.88, consistency: 0.92 },
      model_identity: null,
      timing_analysis: null,
      reason: null,
      headers: { status: 'verified', score: 0.9 },
    }),
  })),
}))

const defaultOptions = {
  config: { baseUrl: 'http://localhost:3000' },
  solver: async () => ({ answer: 'test' }),
}

describe('useAgentAuth', () => {
  it('starts with idle status', () => {
    const { result } = renderHook(() => useAgentAuth(defaultOptions))
    expect(result.current.status).toBe('idle')
    expect(result.current.token).toBeNull()
    expect(result.current.score).toBeNull()
    expect(result.current.error).toBeNull()
  })

  it('authenticates and returns token + score', async () => {
    const onSuccess = vi.fn()
    const { result } = renderHook(() => useAgentAuth({ ...defaultOptions, onSuccess }))

    await act(async () => {
      await result.current.authenticate()
    })

    expect(result.current.status).toBe('success')
    expect(result.current.token).toBe('jwt_test_token')
    expect(result.current.score?.reasoning).toBe(0.9)
    expect(onSuccess).toHaveBeenCalledOnce()
  })

  it('resets state', async () => {
    const { result } = renderHook(() => useAgentAuth(defaultOptions))

    await act(async () => {
      await result.current.authenticate()
    })
    expect(result.current.status).toBe('success')

    act(() => {
      result.current.reset()
    })
    expect(result.current.status).toBe('idle')
    expect(result.current.token).toBeNull()
  })
})
