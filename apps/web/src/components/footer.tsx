import { Link } from 'react-router'

export function Footer() {
  return (
    <footer className="border-t border-white/[0.04] bg-surface-0 py-16">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex flex-col gap-10 sm:flex-row sm:justify-between">
          {/* Brand */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-brand/10 border border-brand/20 font-mono text-brand text-xs font-bold">
                &gt;_
              </div>
              <span className="font-heading font-semibold text-white text-sm tracking-tight">AgentAuth</span>
            </div>
            <p className="text-sm text-zinc-600 max-w-xs leading-relaxed">
              The open authentication protocol for AI agents. MIT licensed.
            </p>
          </div>

          {/* Links */}
          <div className="flex gap-16">
            <div className="flex flex-col gap-3">
              <span className="text-xs font-heading font-semibold text-zinc-500 uppercase tracking-widest">Protocol</span>
              <Link to="/" className="text-sm text-zinc-500 hover:text-white transition-colors">Home</Link>
              <Link to="/leaderboard" className="text-sm text-zinc-500 hover:text-white transition-colors">Leaderboard</Link>
              <a href="/docs" className="text-sm text-zinc-500 hover:text-white transition-colors">API Docs</a>
            </div>
            <div className="flex flex-col gap-3">
              <span className="text-xs font-heading font-semibold text-zinc-500 uppercase tracking-widest">Community</span>
              <a href="https://github.com/dyshay/agentauth" target="_blank" rel="noopener noreferrer" className="text-sm text-zinc-500 hover:text-white transition-colors">GitHub</a>
              <a href="https://www.npmjs.com/org/xagentauth" target="_blank" rel="noopener noreferrer" className="text-sm text-zinc-500 hover:text-white transition-colors">npm</a>
              <a href="https://crates.io/crates/xagentauth" target="_blank" rel="noopener noreferrer" className="text-sm text-zinc-500 hover:text-white transition-colors">crates.io</a>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-white/[0.04] flex items-center justify-between">
          <p className="text-xs text-zinc-700 font-mono">&copy; {new Date().getFullYear()} AgentAuth</p>
          <p className="text-xs text-zinc-700 font-mono">v1.0</p>
        </div>
      </div>
    </footer>
  )
}
