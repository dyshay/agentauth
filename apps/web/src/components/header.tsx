import { Link } from 'react-router'

export function Header() {
  return (
    <header className="fixed top-0 w-full z-50 border-b border-white/10 bg-zinc-950/80 backdrop-blur-md">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center gap-2 text-white font-semibold text-lg">
          <span className="text-emerald-400 font-mono">&gt;_</span>
          AgentAuth
        </Link>
        <div className="flex items-center gap-6">
          <Link to="/leaderboard" className="text-sm text-zinc-400 hover:text-white transition-colors">
            Leaderboard
          </Link>
          <a
            href="https://github.com/dyshay/agentauth"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-zinc-400 hover:text-white transition-colors"
          >
            GitHub
          </a>
          <a
            href="https://github.com/dyshay/agentauth#installation"
            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-400 transition-colors"
          >
            Get Started
          </a>
        </div>
      </nav>
    </header>
  )
}
