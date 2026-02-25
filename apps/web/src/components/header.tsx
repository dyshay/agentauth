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
            href="/docs"
            className="rounded-lg px-3.5 py-2 text-sm text-zinc-400 hover:text-white hover:bg-white/[0.04] transition-colors"
          >
            API Docs
          </a>
          <a
            href="https://github.com/dyshay/agentauth"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg p-2.5 text-zinc-400 hover:text-white hover:bg-white/[0.04] transition-colors"
            aria-label="GitHub"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
            </svg>
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
