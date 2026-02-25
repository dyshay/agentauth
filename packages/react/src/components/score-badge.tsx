import type { AgentCapabilityScore } from '@xagentauth/core'

export interface ScoreBadgeProps {
  score: AgentCapabilityScore
  label?: string
  className?: string
  style?: React.CSSProperties
}

function averageScore(score: AgentCapabilityScore): number {
  return (score.reasoning + score.execution + score.autonomy + score.speed + score.consistency) / 5
}

function scoreColor(avg: number): string {
  if (avg >= 0.9) return '#51cf66'
  if (avg >= 0.7) return '#fcc419'
  if (avg >= 0.5) return '#ff922b'
  return '#ff6b6b'
}

export function ScoreBadge({ score, label, className, style }: ScoreBadgeProps) {
  const avg = averageScore(score)
  const color = scoreColor(avg)

  const badgeStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 10px',
    borderRadius: '12px',
    fontSize: '13px',
    fontWeight: 600,
    fontFamily: 'system-ui, -apple-system, sans-serif',
    backgroundColor: `${color}20`,
    color,
    border: `1px solid ${color}40`,
    ...style,
  }

  return (
    <span className={className} style={badgeStyle} data-testid="agentauth-score-badge">
      <span style={{ fontSize: '11px' }}>&#9679;</span>
      {label && <span>{label}</span>}
      <span>{(avg * 100).toFixed(0)}%</span>
    </span>
  )
}
