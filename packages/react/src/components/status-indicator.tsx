import type { AgentAuthStatus } from '../hooks/use-agent-auth.js'

export interface StatusIndicatorProps {
  status: AgentAuthStatus
  className?: string
  style?: React.CSSProperties
  labels?: Partial<Record<AgentAuthStatus, string>>
}

const DEFAULT_LABELS: Record<AgentAuthStatus, string> = {
  idle: 'Not authenticated',
  authenticating: 'Authenticating...',
  success: 'Verified',
  error: 'Failed',
}

const STATUS_COLORS: Record<AgentAuthStatus, string> = {
  idle: '#868e96',
  authenticating: '#339af0',
  success: '#51cf66',
  error: '#ff6b6b',
}

export function StatusIndicator({ status, className, style, labels }: StatusIndicatorProps) {
  const label = labels?.[status] ?? DEFAULT_LABELS[status]
  const color = STATUS_COLORS[status]

  const containerStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color,
    ...style,
  }

  const dotStyle: React.CSSProperties = {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: color,
  }

  return (
    <span className={className} style={containerStyle} data-testid="agentauth-status">
      <span style={dotStyle} />
      <span>{label}</span>
    </span>
  )
}
