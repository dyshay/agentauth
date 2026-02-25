import { Link, useLocation } from 'react-router'

export function Header() {
  const { pathname } = useLocation()

  return (
    <header className="fixed top-0 w-full z-50 border-b border-white/[0.06] bg-surface-0/70 backdrop-blur-xl">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 h-[72px]">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand/10 border border-brand/20 font-mono text-brand text-sm font-bold transition-colors group-hover:bg-brand/15">
            &gt;_
          </div>
          <span className="font-heading font-semibold text-white tracking-tight">AgentAuth</span>
        </Link>

        <div className="flex items-center gap-1">
          <Link
            to="/leaderboard"
            className={`rounded-lg px-3.5 py-2 text-sm transition-colors ${
              pathname === '/leaderboard'
                ? 'text-white bg-white/[0.06]'
                : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            Leaderboard
          </Link>
          <a
            href="https://github.com/dyshay/agentauth"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg px-3.5 py-2 text-sm text-zinc-400 hover:text-white hover:bg-white/[0.04] transition-colors"
          >
            GitHub
          </a>
          <div className="ml-2 h-5 w-px bg-white/[0.06]" />
          <a
            href="https://github.com/dyshay/agentauth#installation"
            className="ml-2 flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-surface-0 hover:bg-emerald-300 transition-colors"
          >
            Get Started
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </a>
        </div>
      </nav>
    </header>
  )
}
