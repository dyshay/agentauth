import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ChallengeWidget } from '../components/challenge-widget.js'

vi.mock('@xagentauth/client', () => ({
  AgentAuthClient: vi.fn().mockImplementation(() => ({
    authenticate: vi.fn().mockResolvedValue({
      success: true,
      token: 'jwt_test',
      score: { reasoning: 0.9, execution: 0.95, autonomy: 0.85, speed: 0.88, consistency: 0.92 },
    }),
  })),
}))

const baseProps = {
  config: { baseUrl: 'http://localhost:3000' },
  solver: async () => ({ answer: 'test' }),
}

describe('ChallengeWidget', () => {
  it('renders with title and authenticate button', () => {
    render(<ChallengeWidget {...baseProps} />)
    expect(screen.getByText('Agent Authentication')).toBeDefined()
    expect(screen.getByTestId('agentauth-authenticate-btn')).toBeDefined()
  })

  it('shows result after authentication', async () => {
    render(<ChallengeWidget {...baseProps} />)
    fireEvent.click(screen.getByTestId('agentauth-authenticate-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('agentauth-result')).toBeDefined()
    })
  })

  it('accepts custom title', () => {
    render(<ChallengeWidget {...baseProps} title="Custom Title" />)
    expect(screen.getByText('Custom Title')).toBeDefined()
  })
})
