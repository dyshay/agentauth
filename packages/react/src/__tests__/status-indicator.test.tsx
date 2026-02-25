import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusIndicator } from '../components/status-indicator.js'

describe('StatusIndicator', () => {
  it('shows idle state', () => {
    render(<StatusIndicator status="idle" />)
    expect(screen.getByText('Not authenticated')).toBeDefined()
  })

  it('shows authenticating state', () => {
    render(<StatusIndicator status="authenticating" />)
    expect(screen.getByText('Authenticating...')).toBeDefined()
  })

  it('shows success state', () => {
    render(<StatusIndicator status="success" />)
    expect(screen.getByText('Verified')).toBeDefined()
  })

  it('shows error state', () => {
    render(<StatusIndicator status="error" />)
    expect(screen.getByText('Failed')).toBeDefined()
  })

  it('accepts custom labels', () => {
    render(<StatusIndicator status="success" labels={{ success: 'Agent OK' }} />)
    expect(screen.getByText('Agent OK')).toBeDefined()
  })
})
