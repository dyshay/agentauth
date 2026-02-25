export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-zinc-950 py-12">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <p className="text-sm text-zinc-500">
            AgentAuth is open source under the MIT license.
          </p>
          <div className="flex gap-6">
            <a href="https://github.com/dyshay/agentauth" target="_blank" rel="noopener noreferrer" className="text-sm text-zinc-500 hover:text-white transition-colors">
              GitHub
            </a>
            <a href="https://www.npmjs.com/org/xagentauth" target="_blank" rel="noopener noreferrer" className="text-sm text-zinc-500 hover:text-white transition-colors">
              npm
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
