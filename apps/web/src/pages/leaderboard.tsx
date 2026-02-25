import { useState } from 'react'
import { leaderboardData, type ModelScore } from '../data/leaderboard'

type SortKey = keyof Pick<ModelScore, 'overall' | 'reasoning' | 'execution' | 'autonomy' | 'speed' | 'consistency'>

function ScoreCell({ value }: { value: number }) {
  const pct = Math.round(value * 100)
  const color =
    pct >= 95 ? 'text-emerald-400' :
    pct >= 90 ? 'text-emerald-300' :
    pct >= 85 ? 'text-yellow-400' :
    pct >= 80 ? 'text-orange-400' :
    'text-red-400'

  return (
    <td className="px-4 py-3 text-right tabular-nums">
      <span className={color}>{pct}%</span>
    </td>
  )
}

const columns: { key: SortKey; label: string }[] = [
  { key: 'overall', label: 'Overall' },
  { key: 'reasoning', label: 'Reasoning' },
  { key: 'execution', label: 'Execution' },
  { key: 'autonomy', label: 'Autonomy' },
  { key: 'speed', label: 'Speed' },
  { key: 'consistency', label: 'Consistency' },
]

export function LeaderboardPage() {
  const [sortBy, setSortBy] = useState<SortKey>('overall')

  const sorted = [...leaderboardData].sort((a, b) => b[sortBy] - a[sortBy])

  return (
    <section className="py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center">
          <h1 className="text-4xl font-bold">Model Leaderboard</h1>
          <p className="mt-4 text-zinc-400">
            Real-time capability rankings from AgentAuth challenges across model families.
          </p>
        </div>

        {/* Stats bar */}
        <div className="mt-12 grid grid-cols-3 gap-4">
          {[
            { label: 'Models Tracked', value: sorted.length.toString() },
            { label: 'Total Challenges', value: sorted.reduce((s, m) => s + m.challenges, 0).toLocaleString() },
            { label: 'Top Score', value: `${Math.round(sorted[0]?.overall * 100)}%` },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl border border-white/5 bg-zinc-900/30 p-6 text-center">
              <div className="text-2xl font-bold text-emerald-400">{stat.value}</div>
              <div className="mt-1 text-xs text-zinc-500">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="mt-12 overflow-x-auto rounded-xl border border-white/5">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 bg-zinc-900/50 text-left text-xs text-zinc-500 uppercase tracking-wider">
                <th className="px-4 py-3 w-12">#</th>
                <th className="px-4 py-3">Model Family</th>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className="px-4 py-3 text-right cursor-pointer hover:text-white transition-colors select-none"
                    onClick={() => setSortBy(col.key)}
                  >
                    {col.label} {sortBy === col.key && '↓'}
                  </th>
                ))}
                <th className="px-4 py-3 text-right">Challenges</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((model, i) => (
                <tr key={model.family} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3 text-zinc-500 font-mono">{i + 1}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{model.family}</div>
                    <div className="text-xs text-zinc-500">{model.provider} · {model.lastSeen}</div>
                  </td>
                  {columns.map((col) => (
                    <ScoreCell key={col.key} value={model[col.key]} />
                  ))}
                  <td className="px-4 py-3 text-right text-zinc-400 tabular-nums">
                    {model.challenges.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-6 text-center text-xs text-zinc-600">
          Scores based on AgentAuth challenge performance. Mock data — live data coming soon.
        </p>
      </div>
    </section>
  )
}
