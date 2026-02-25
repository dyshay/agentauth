import { useAgentAuth, type UseAgentAuthOptions } from '../hooks/use-agent-auth.js'
import { ScoreBadge } from './score-badge.js'
import { StatusIndicator } from './status-indicator.js'

export interface ChallengeWidgetProps extends UseAgentAuthOptions {
  title?: string
  className?: string
  style?: React.CSSProperties
  buttonLabel?: string
  retryLabel?: string
}

export function ChallengeWidget({
  title = 'Agent Authentication',
  className,
  style,
  buttonLabel = 'Authenticate',
  retryLabel = 'Retry',
  ...hookOptions
}: ChallengeWidgetProps) {
  const { status, authenticate, reset, score, error } = useAgentAuth(hookOptions)

  const containerStyle: React.CSSProperties = {
    padding: '20px',
    borderRadius: '12px',
    border: '1px solid #dee2e6',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    maxWidth: '360px',
    ...style,
  }

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  }

  const titleStyle: React.CSSProperties = {
    fontSize: '15px',
    fontWeight: 600,
    margin: 0,
    color: '#212529',
  }

  const buttonStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 16px',
    borderRadius: '8px',
    border: 'none',
    fontSize: '14px',
    fontWeight: 500,
    cursor: status === 'authenticating' ? 'wait' : 'pointer',
    backgroundColor: status === 'error' ? '#ff6b6b' : '#228be6',
    color: '#fff',
    opacity: status === 'authenticating' ? 0.7 : 1,
  }

  const errorStyle: React.CSSProperties = {
    marginTop: '12px',
    padding: '8px 12px',
    borderRadius: '8px',
    backgroundColor: '#fff5f5',
    color: '#c92a2a',
    fontSize: '13px',
  }

  const resultStyle: React.CSSProperties = {
    marginTop: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  }

  return (
    <div className={className} style={containerStyle} data-testid="agentauth-widget">
      <div style={headerStyle}>
        <p style={titleStyle}>{title}</p>
        <StatusIndicator status={status} />
      </div>

      {status === 'idle' && (
        <button style={buttonStyle} onClick={authenticate} data-testid="agentauth-authenticate-btn">
          {buttonLabel}
        </button>
      )}

      {status === 'authenticating' && (
        <button style={buttonStyle} disabled>
          Authenticating...
        </button>
      )}

      {status === 'success' && score && (
        <div style={resultStyle} data-testid="agentauth-result">
          <ScoreBadge score={score} label="Overall" />
          <div style={{ fontSize: '12px', color: '#868e96' }}>
            R:{score.reasoning.toFixed(2)} E:{score.execution.toFixed(2)} A:{score.autonomy.toFixed(2)} S:{score.speed.toFixed(2)} C:{score.consistency.toFixed(2)}
          </div>
        </div>
      )}

      {status === 'error' && (
        <>
          <div style={errorStyle} data-testid="agentauth-error">
            {error?.message ?? 'Authentication failed'}
          </div>
          <button style={{ ...buttonStyle, marginTop: '8px' }} onClick={reset} data-testid="agentauth-retry-btn">
            {retryLabel}
          </button>
        </>
      )}
    </div>
  )
}
