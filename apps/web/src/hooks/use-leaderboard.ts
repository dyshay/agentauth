import { useState, useEffect } from 'react'
import { leaderboardData, type ModelScore } from '../data/leaderboard'

const API_URL = import.meta.env.VITE_AGENTAUTH_API_URL ?? ''

export function useLeaderboard() {
  const [data, setData] = useState<ModelScore[]>(leaderboardData)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLive, setIsLive] = useState(false)

  useEffect(() => {
    if (!API_URL) return

    setLoading(true)
    fetchLeaderboard()
      .then((entries) => {
        if (entries.length > 0) {
          setData(entries)
          setIsLive(true)
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to fetch leaderboard')
        // Fallback to static data (already set)
      })
      .finally(() => setLoading(false))
  }, [])

  return { data, loading, error, isLive }
}

async function fetchLeaderboard(): Promise<ModelScore[]> {
  const res = await fetch(`${API_URL}/v1/leaderboard`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)

  const body = (await res.json()) as {
    entries: Array<{
      family: string
      provider: string
      overall: number
      reasoning: number
      execution: number
      autonomy: number
      speed: number
      consistency: number
      challenges: number
      last_seen: string
    }>
  }

  return body.entries.map((e, i) => ({
    rank: i + 1,
    family: e.family,
    provider: e.provider,
    overall: e.overall,
    reasoning: e.reasoning,
    execution: e.execution,
    autonomy: e.autonomy,
    speed: e.speed,
    consistency: e.consistency,
    challenges: e.challenges,
    lastSeen: formatLastSeen(e.last_seen),
  }))
}

function formatLastSeen(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}
