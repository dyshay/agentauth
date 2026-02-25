import { useState } from 'react'
import { leaderboardData, type ModelScore } from '../data/leaderboard'
import { useInView } from '../hooks/use-in-view'

type SortKey = keyof Pick<ModelScore, 'overall' | 'reasoning' | 'execution' | 'autonomy' | 'speed' | 'consistency'>

const rankColors: Record<number, string> = {
  0: 'from-yellow-500/80 to-yellow-400/80',
  1: 'from-zinc-400/80 to-zinc-300/80',
  2: 'from-amber-600/80 to-amber-500/80',
}

function ScoreBar({ value, active }: { value: number; active: boolean }) {
  const pct = Math.round(value * 100)
  const color =
    pct >= 95 ? 'bg-brand' :
    pct >= 90 ? 'bg-emerald-400/80' :
    pct >= 85 ? 'bg-yellow-400/70' :
    pct >= 80 ? 'bg-orange-400/70' :
    'bg-red-400/70'

  return (
    <td className="px-4 py-4">
      <div className="flex items-center gap-3 justify-end">
        <span className={`font-mono text-xs tabular-nums ${active ? 'text-zinc-200' : 'text-zinc-500'}`}>
          {pct}
        </span>
        <div className="score-bar-track w-14">
          <div className={`score-bar-fill ${color}`} style={{ width: `${pct}%` }} />
        </div>
      </div>
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
  const { ref: headerRef, isInView: headerVisible } = useInView()
  const { ref: tableRef, isInView: tableVisible } = useInView()

  const sorted = [...leaderboardData].sort((a, b) => b[sortBy] - a[sortBy])

  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-6">
        {/* Header */}
        <div
          ref={headerRef}
          className="text-center"
          style={{
            opacity: headerVisible ? 1 : 0,
            transform: headerVisible ? 'translateY(0)' : 'translateY(24px)',
            transition: 'opacity 0.7s cubic-bezier(0.16,1,0.3,1), transform 0.7s cubic-bezier(0.16,1,0.3,1)',
          }}
        >
          <span className="font-mono text-xs text-brand/80 tracking-widest uppercase">Rankings</span>
          <h1 className="mt-3 font-heading text-4xl font-bold tracking-tight sm:text-5xl">Model Leaderboard</h1>
          <p className="mt-4 text-zinc-500 max-w-lg mx-auto leading-relaxed">
            Capability rankings from AgentAuth challenges across model families.
          </p>
        </div>

        {/* Stats */}
        <div
          className="mt-14 grid grid-cols-3 gap-4"
          style={{
            opacity: headerVisible ? 1 : 0,
            transform: headerVisible ? 'translateY(0)' : 'translateY(24px)',
            transition: 'opacity 0.7s cubic-bezier(0.16,1,0.3,1) 0.15s, transform 0.7s cubic-bezier(0.16,1,0.3,1) 0.15s',
          }}
        >
          {[
            { label: 'Models Tracked', value: sorted.length.toString() },
            { label: 'Total Challenges', value: sorted.reduce((s, m) => s + m.challenges, 0).toLocaleString() },
            { label: 'Top Score', value: `${Math.round(sorted[0]?.overall * 100)}%` },
          ].map((stat) => (
            <div key={stat.label} className="glass-card rounded-xl p-5 sm:p-6 text-center">
              <div className="text-2xl font-heading font-bold text-brand">{stat.value}</div>
              <div className="mt-1.5 font-mono text-[10px] text-zinc-600 uppercase tracking-widest">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Table */}
        <div
          ref={tableRef}
          className="mt-10 overflow-x-auto rounded-2xl border border-white/[0.05] bg-surface-1/30"
          style={{
            opacity: tableVisible ? 1 : 0,
            transform: tableVisible ? 'translateY(0)' : 'translateY(24px)',
            transition: 'opacity 0.7s cubic-bezier(0.16,1,0.3,1), transform 0.7s cubic-bezier(0.16,1,0.3,1)',
          }}
        >
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.04] text-left">
                <th className="px-4 py-3.5 w-12 font-mono text-[10px] text-zinc-600 uppercase tracking-widest">#</th>
                <th className="px-4 py-3.5 font-mono text-[10px] text-zinc-600 uppercase tracking-widest">Model</th>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={`px-4 py-3.5 text-right cursor-pointer select-none font-mono text-[10px] uppercase tracking-widest transition-colors ${
                      sortBy === col.key ? 'text-brand' : 'text-zinc-600 hover:text-zinc-400'
                    }`}
                    onClick={() => setSortBy(col.key)}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      {sortBy === col.key && (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M6 9l6 6 6-6" />
                        </svg>
                      )}
                    </span>
                  </th>
                ))}
                <th className="px-4 py-3.5 text-right font-mono text-[10px] text-zinc-600 uppercase tracking-widest">Tests</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((model, i) => (
                <tr
                  key={model.family}
                  className="border-b border-white/[0.03] hover:bg-white/[0.015] transition-colors"
                  style={{
                    opacity: tableVisible ? 1 : 0,
                    animation: tableVisible ? `fade-up 0.5s cubic-bezier(0.16,1,0.3,1) ${i * 0.04}s both` : 'none',
                  }}
                >
                  <td className="px-4 py-4">
                    {i < 3 ? (
                      <div className={`flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-b ${rankColors[i]} font-mono text-[10px] font-bold text-surface-0`}>
                        {i + 1}
                      </div>
                    ) : (
                      <span className="font-mono text-xs text-zinc-600 pl-1">{i + 1}</span>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <div className="font-heading font-semibold text-sm tracking-tight">{model.family}</div>
                    <div className="font-mono text-[10px] text-zinc-600 mt-0.5">{model.provider} &middot; {model.lastSeen}</div>
                  </td>
                  {columns.map((col) => (
                    <ScoreBar key={col.key} value={model[col.key]} active={sortBy === col.key} />
                  ))}
                  <td className="px-4 py-4 text-right font-mono text-xs text-zinc-600 tabular-nums">
                    {model.challenges.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-8 text-center font-mono text-[10px] text-zinc-700 tracking-wider uppercase">
          Scores from AgentAuth challenge performance &middot; Mock data &mdash; live feed coming soon
        </p>
      </div>
    </section>
  )
}
