import { Link } from 'react-router'

function Hero() {
  return (
    <section className="relative overflow-hidden py-32 sm:py-40">
      {/* Gradient background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-0 -translate-x-1/2 h-[600px] w-[800px] rounded-full bg-emerald-500/10 blur-3xl" />
      </div>

      <div className="mx-auto max-w-4xl px-6 text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-1.5 text-sm text-emerald-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Open Protocol v1
        </div>

        <h1 className="text-5xl font-bold tracking-tight sm:text-7xl">
          Authentication for{' '}
          <span className="text-emerald-400">AI Agents</span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-lg text-zinc-400">
          Traditional CAPTCHAs prove you're human. AgentAuth proves you're a machine — and measures exactly how capable.
          Think of it as <strong className="text-white">OAuth for the agentic web</strong>.
        </p>

        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <a
            href="https://github.com/dyshay/agentauth#installation"
            className="rounded-lg bg-emerald-500 px-6 py-3 text-sm font-medium text-white hover:bg-emerald-400 transition-colors"
          >
            Get Started
          </a>
          <Link
            to="/leaderboard"
            className="rounded-lg border border-white/10 bg-white/5 px-6 py-3 text-sm font-medium text-white hover:bg-white/10 transition-colors"
          >
            View Leaderboard
          </Link>
        </div>

        {/* Token preview */}
        <div className="mx-auto mt-16 max-w-lg rounded-xl border border-white/10 bg-zinc-900/50 p-6 text-left font-mono text-sm">
          <div className="mb-2 text-xs text-zinc-500">AgentAuth JWT payload</div>
          <pre className="text-zinc-300 overflow-x-auto"><code>{`{
  "capabilities": {
    "reasoning": 0.94,
    "execution": 0.98,
    "autonomy": 0.91
  },
  "model_identity": {
    "family": "gpt-4-class",
    "confidence": 0.87
  }
}`}</code></pre>
        </div>
      </div>
    </section>
  )
}

const features = [
  {
    title: 'Capability Scoring',
    description: 'Five-dimensional scoring: reasoning, execution, autonomy, speed, consistency. Every authenticated agent gets a precise capability vector.',
    icon: '📊',
  },
  {
    title: 'Proof of Model Identity',
    description: 'Canary prompts embedded in challenges identify which model family solved it. Bayesian classification makes spoofing statistically difficult.',
    icon: '🔬',
  },
  {
    title: 'Timing Analysis',
    description: 'Response time zones detect humans-in-the-loop, scripted delays, and pre-computed answers. Only genuine AI agents pass.',
    icon: '⏱️',
  },
  {
    title: 'Multi-Language SDKs',
    description: 'TypeScript, Python, Rust, Go — plus React components and edge runtime adapters for Cloudflare Workers and Deno Deploy.',
    icon: '🧩',
  },
]

function Features() {
  return (
    <section className="py-24 border-t border-white/5">
      <div className="mx-auto max-w-6xl px-6">
        <h2 className="text-center text-3xl font-bold">Why AgentAuth?</h2>
        <p className="mx-auto mt-4 max-w-2xl text-center text-zinc-400">
          The first open protocol that authenticates AI agents — not just humans.
        </p>
        <div className="mt-16 grid gap-8 sm:grid-cols-2">
          {features.map((f) => (
            <div key={f.title} className="rounded-xl border border-white/5 bg-zinc-900/30 p-8">
              <div className="mb-4 text-3xl">{f.icon}</div>
              <h3 className="text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-zinc-400 leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

const steps = [
  { step: '01', title: 'Init Challenge', description: 'Agent requests a challenge. Server returns NL instructions, data, and embedded canary prompts.', code: 'POST /v1/challenge/init' },
  { step: '02', title: 'Solve & Verify', description: 'Agent solves the challenge. Server verifies answer + HMAC, classifies model via PoMI, and analyzes timing.', code: 'POST /v1/challenge/{id}/solve' },
  { step: '03', title: 'Receive JWT', description: 'Authenticated agent receives a signed JWT with capability scores, model identity, and expiration.', code: 'Authorization: Bearer eyJ...' },
]

function HowItWorks() {
  return (
    <section className="py-24 border-t border-white/5">
      <div className="mx-auto max-w-6xl px-6">
        <h2 className="text-center text-3xl font-bold">How It Works</h2>
        <div className="mt-16 grid gap-8 sm:grid-cols-3">
          {steps.map((s) => (
            <div key={s.step} className="relative">
              <div className="mb-4 text-5xl font-bold text-emerald-500/20">{s.step}</div>
              <h3 className="text-lg font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm text-zinc-400 leading-relaxed">{s.description}</p>
              <code className="mt-4 block rounded-lg bg-zinc-900 px-3 py-2 text-xs text-emerald-400 font-mono">{s.code}</code>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

const sdks = [
  { name: 'TypeScript', install: 'npm install @xagentauth/client', color: 'text-blue-400' },
  { name: 'Python', install: 'pip install xagentauth', color: 'text-yellow-400' },
  { name: 'Rust', install: 'cargo add xagentauth', color: 'text-orange-400' },
  { name: 'Go', install: 'go get github.com/dyshay/agentauth/sdks/go', color: 'text-cyan-400' },
  { name: 'React', install: 'npm install @xagentauth/react', color: 'text-sky-400' },
  { name: 'Docker', install: 'docker compose up -d', color: 'text-blue-300' },
]

function SDKs() {
  return (
    <section className="py-24 border-t border-white/5">
      <div className="mx-auto max-w-6xl px-6">
        <h2 className="text-center text-3xl font-bold">One Protocol, Every Stack</h2>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sdks.map((sdk) => (
            <div key={sdk.name} className="rounded-xl border border-white/5 bg-zinc-900/30 p-6">
              <div className={`text-sm font-semibold ${sdk.color}`}>{sdk.name}</div>
              <code className="mt-3 block text-xs text-zinc-400 font-mono">{sdk.install}</code>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function CTA() {
  return (
    <section className="py-24 border-t border-white/5">
      <div className="mx-auto max-w-4xl px-6 text-center">
        <h2 className="text-3xl font-bold">Ready to authenticate your agents?</h2>
        <p className="mt-4 text-zinc-400">
          Get started in under 5 minutes. Install, configure, and protect your API.
        </p>
        <div className="mt-8 rounded-xl border border-white/10 bg-zinc-900/50 p-6 font-mono text-sm text-left max-w-md mx-auto">
          <div className="text-zinc-500">$ npm install @xagentauth/server</div>
          <div className="text-zinc-500 mt-1">$ npm install @xagentauth/client</div>
          <div className="text-emerald-400 mt-2">✓ Ready to authenticate agents</div>
        </div>
        <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
          <a
            href="https://github.com/dyshay/agentauth"
            className="rounded-lg bg-emerald-500 px-6 py-3 text-sm font-medium text-white hover:bg-emerald-400 transition-colors"
          >
            View on GitHub
          </a>
          <a
            href="https://github.com/dyshay/agentauth#self-hosting"
            className="rounded-lg border border-white/10 bg-white/5 px-6 py-3 text-sm font-medium text-white hover:bg-white/10 transition-colors"
          >
            Self-Host with Docker
          </a>
        </div>
      </div>
    </section>
  )
}

export function LandingPage() {
  return (
    <>
      <Hero />
      <Features />
      <HowItWorks />
      <SDKs />
      <CTA />
    </>
  )
}
