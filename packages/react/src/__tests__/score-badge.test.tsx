import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ScoreBadge } from '../components/score-badge.js'

const highScore = { reasoning: 0.95, execution: 0.98, autonomy: 0.91, speed: 0.87, consistency: 0.95 }
const lowScore = { reasoning: 0.3, execution: 0.2, autonomy: 0.4, speed: 0.1, consistency: 0.3 }

describe('ScoreBadge', () => {
  it('renders percentage from score', () => {
    render(<ScoreBadge score={highScore} />)
    const badge = screen.getByTestId('agentauth-score-badge')
    expect(badge.textContent).toContain('93%')
  })

  it('renders label when provided', () => {
    render(<ScoreBadge score={highScore} label="Agent Score" />)
    expect(screen.getByText('Agent Score')).toBeDefined()
  })

  it('uses green for high scores', () => {
    render(<ScoreBadge score={highScore} />)
    const badge = screen.getByTestId('agentauth-score-badge')
    expect(badge.style.color).toBe('rgb(81, 207, 102)')
  })

  it('uses red for low scores', () => {
    render(<ScoreBadge score={lowScore} />)
    const badge = screen.getByTestId('agentauth-score-badge')
    expect(badge.style.color).toBe('rgb(255, 107, 107)')
  })
})
