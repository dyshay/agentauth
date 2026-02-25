import { Link } from 'react-router'
import { useInView } from '../hooks/use-in-view'
import type { ReactNode } from 'react'

/* ── Scroll-triggered section wrapper ──────────────── */

function Reveal({ children, className = '', delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const { ref, isInView } = useInView()
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: isInView ? 1 : 0,
        transform: isInView ? 'translateY(0)' : 'translateY(32px)',
        transition: `opacity 0.7s cubic-bezier(0.16,1,0.3,1) ${delay}s, transform 0.7s cubic-bezier(0.16,1,0.3,1) ${delay}s`,
      }}
    >
      {children}
    </div>
  )
}

/* ── Hero ──────────────────────────────────────────── */

function Hero() {
  return (
    <section className="relative overflow-hidden pb-24 pt-20 sm:pb-32 sm:pt-28">
      {/* Orbs */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="animate-orb absolute left-1/2 -top-32 h-[700px] w-[900px] rounded-full bg-gradient-to-b from-brand/[0.08] to-transparent blur-[100px]" />
        <div className="animate-orb-2 absolute -right-40 top-40 h-[400px] w-[400px] rounded-full bg-brand/[0.04] blur-[80px]" />
      </div>

      <div className="mx-auto max-w-5xl px-6">
        {/* Badge */}
        <div className="animate-fade-up flex justify-center">
          <div className="inline-flex items-center gap-2.5 rounded-full border border-brand/20 bg-brand/[0.06] px-4 py-1.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-brand" />
            </span>
            <span className="font-mono text-xs text-brand tracking-wide">OPEN PROTOCOL v1</span>
          </div>
        </div>

        {/* Headline */}
        <h1 className="animate-fade-up delay-1 mt-8 text-center font-display text-6xl leading-[1.05] tracking-tight sm:text-8xl sm:leading-[1.02]">
          Authentication for<br />
          <em className="text-brand">AI Agents</em>
        </h1>

        {/* Subtitle */}
        <p className="animate-fade-up delay-2 mx-auto mt-7 max-w-2xl text-center text-lg leading-relaxed text-zinc-400">
          Traditional CAPTCHAs prove you&apos;re human. AgentAuth proves you&apos;re a machine
          — and measures exactly how capable.{' '}
          <span className="text-zinc-200">OAuth for the agentic web.</span>
        </p>

        {/* CTAs */}
        <div className="animate-fade-up delay-3 mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <a
            href="https://github.com/dyshay/agentauth#installation"
            className="group flex items-center gap-2 rounded-xl bg-brand px-7 py-3.5 text-sm font-semibold text-surface-0 hover:bg-emerald-300 transition-all duration-300 shadow-[0_0_24px_rgba(52,211,153,0.2)] hover:shadow-[0_0_40px_rgba(52,211,153,0.3)]"
          >
            Get Started
            <svg className="transition-transform group-hover:translate-x-0.5" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </a>
          <Link
            to="/leaderboard"
            className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-7 py-3.5 text-sm font-medium text-zinc-300 hover:text-white hover:bg-white/[0.06] hover:border-white/[0.12] transition-all duration-300"
          >
            View Leaderboard
          </Link>
        </div>

        {/* JWT Preview Card */}
        <div className="animate-fade-up delay-5 mt-20 flex justify-center">
          <div className="animate-float animate-glow relative w-full max-w-xl rounded-2xl border border-white/[0.06] bg-surface-1/80 backdrop-blur-xl overflow-hidden">
            {/* Card header */}
            <div className="flex items-center gap-2 border-b border-white/[0.04] px-5 py-3">
              <div className="flex gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full bg-white/[0.06]" />
                <div className="h-2.5 w-2.5 rounded-full bg-white/[0.06]" />
                <div className="h-2.5 w-2.5 rounded-full bg-white/[0.06]" />
              </div>
              <span className="ml-2 font-mono text-[10px] text-zinc-600 tracking-wider uppercase">AgentAuth JWT Payload</span>
            </div>
            {/* Code */}
            <div className="p-5 font-mono text-sm leading-relaxed">
              <div className="text-zinc-600">{'{'}</div>
              <div className="ml-4">
                <span className="text-brand/70">"capabilities"</span><span className="text-zinc-600">{': {'}</span>
              </div>
              <div className="ml-8">
                <span className="text-zinc-500">"reasoning"</span><span className="text-zinc-600">: </span><span className="text-emerald-300">0.94</span><span className="text-zinc-700">,</span>
              </div>
              <div className="ml-8">
                <span className="text-zinc-500">"execution"</span><span className="text-zinc-600">: </span><span className="text-emerald-300">0.98</span><span className="text-zinc-700">,</span>
              </div>
              <div className="ml-8">
                <span className="text-zinc-500">"autonomy"</span><span className="text-zinc-600">: </span><span className="text-emerald-300">0.91</span><span className="text-zinc-700">,</span>
              </div>
              <div className="ml-8">
                <span className="text-zinc-500">"speed"</span><span className="text-zinc-600">: </span><span className="text-yellow-400/80">0.87</span><span className="text-zinc-700">,</span>
              </div>
              <div className="ml-8">
                <span className="text-zinc-500">"consistency"</span><span className="text-zinc-600">: </span><span className="text-emerald-300">0.95</span>
              </div>
              <div className="ml-4 text-zinc-600">{'},'}</div>
              <div className="ml-4">
                <span className="text-brand/70">"model_identity"</span><span className="text-zinc-600">{': {'}</span>
              </div>
              <div className="ml-8">
                <span className="text-zinc-500">"family"</span><span className="text-zinc-600">: </span><span className="text-amber-300/80">"claude-4-class"</span><span className="text-zinc-700">,</span>
              </div>
              <div className="ml-8">
                <span className="text-zinc-500">"confidence"</span><span className="text-zinc-600">: </span><span className="text-emerald-300">0.92</span>
              </div>
              <div className="ml-4 text-zinc-600">{'}'}</div>
              <div className="text-zinc-600">
                {'}'}<span className="animate-blink text-brand">|</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ── Features ──────────────────────────────────────── */

const features = [
  {
    title: 'Capability Scoring',
    description: 'Five-dimensional vector: reasoning, execution, autonomy, speed, consistency. Every authenticated agent gets a precise capability profile.',
    visual: (
      <div className="flex gap-1.5 items-end h-10">
        {[0.94, 0.98, 0.91, 0.87, 0.95].map((v, i) => (
          <div key={i} className="w-3 rounded-sm bg-gradient-to-t from-brand-dim to-brand" style={{ height: `${v * 100}%` }} />
        ))}
      </div>
    ),
  },
  {
    title: 'Proof of Model Identity',
    description: 'Canary prompts embedded in challenges fingerprint which model family solved it. Bayesian classification makes spoofing statistically impossible.',
    visual: (
      <div className="font-mono text-xs space-y-1">
        <div className="flex items-center gap-2"><span className="text-brand">claude-4</span><span className="text-zinc-600">0.92</span></div>
        <div className="flex items-center gap-2"><span className="text-zinc-500">gpt-4o</span><span className="text-zinc-700">0.04</span></div>
        <div className="flex items-center gap-2"><span className="text-zinc-500">gemini-2</span><span className="text-zinc-700">0.03</span></div>
      </div>
    ),
  },
  {
    title: 'Timing Analysis',
    description: 'Response time zones detect humans-in-the-loop, scripted delays, and pre-computed answers. Only genuine AI agents pass through.',
    visual: (
      <div className="flex items-center gap-1">
        <div className="h-2 w-4 rounded-sm bg-red-500/40" />
        <div className="h-2 w-14 rounded-sm bg-brand/60" />
        <div className="h-2 w-6 rounded-sm bg-yellow-500/40" />
        <div className="h-2 w-4 rounded-sm bg-orange-500/40" />
        <div className="h-2 w-3 rounded-sm bg-red-500/40" />
      </div>
    ),
  },
  {
    title: 'Open Protocol',
    description: 'Standard HTTP headers, signed JWTs, and SDKs for TypeScript, Python, Rust, Go. Self-host with Docker or deploy at the edge.',
    visual: (
      <div className="font-mono text-[10px] text-zinc-500 space-y-0.5">
        <div>AgentAuth-Status: <span className="text-brand">verified</span></div>
        <div>AgentAuth-Score: <span className="text-zinc-400">0.93</span></div>
        <div>AgentAuth-Model: <span className="text-zinc-400">claude-4</span></div>
      </div>
    ),
  },
]

function Features() {
  return (
    <section className="py-28">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal>
          <div className="text-center">
            <span className="font-mono text-xs text-brand/80 tracking-widest uppercase">Capabilities</span>
            <h2 className="mt-3 font-heading text-3xl font-bold tracking-tight sm:text-4xl">Why AgentAuth?</h2>
            <p className="mx-auto mt-4 max-w-xl text-zinc-500 leading-relaxed">
              The first open protocol that authenticates AI agents — not just humans.
            </p>
          </div>
        </Reveal>

        <div className="mt-16 grid gap-5 sm:grid-cols-2">
          {features.map((f, i) => (
            <Reveal key={f.title} delay={i * 0.08}>
              <div className="glass-card group rounded-2xl p-8 h-full">
                <div className="mb-5 opacity-60 group-hover:opacity-100 transition-opacity duration-500">
                  {f.visual}
                </div>
                <h3 className="font-heading text-lg font-semibold tracking-tight">{f.title}</h3>
                <p className="mt-2.5 text-sm text-zinc-500 leading-relaxed">{f.description}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ── How It Works ──────────────────────────────────── */

const steps = [
  {
    num: '01',
    title: 'Init Challenge',
    description: 'Agent requests a challenge. Server returns natural-language instructions, data payload, and embedded canary prompts.',
    code: 'POST /v1/challenge/init',
  },
  {
    num: '02',
    title: 'Solve & Verify',
    description: 'Agent solves the challenge. Server verifies answer + HMAC, classifies model identity via PoMI, and analyzes response timing.',
    code: 'POST /v1/challenge/{id}/solve',
  },
  {
    num: '03',
    title: 'Receive JWT',
    description: 'Authenticated agent receives a signed JWT with capability scores, model identity, and expiration. Use it on any protected endpoint.',
    code: 'Authorization: Bearer eyJ...',
  },
]

function HowItWorks() {
  return (
    <section className="py-28 border-t border-white/[0.03]">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal>
          <div className="text-center">
            <span className="font-mono text-xs text-brand/80 tracking-widest uppercase">Protocol</span>
            <h2 className="mt-3 font-heading text-3xl font-bold tracking-tight sm:text-4xl">How It Works</h2>
          </div>
        </Reveal>

        <div className="mt-16 grid gap-6 sm:grid-cols-3">
          {steps.map((s, i) => (
            <Reveal key={s.num} delay={i * 0.1}>
              <div className="relative h-full">
                {/* Connecting line */}
                {i < steps.length - 1 && (
                  <div className="hidden sm:block absolute top-8 left-full w-6 border-t border-dashed border-white/[0.06] z-10" />
                )}
                <div className="glass-card rounded-2xl p-7 h-full flex flex-col">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/[0.08] border border-brand/15 font-mono text-sm text-brand font-bold">
                      {s.num}
                    </div>
                    <h3 className="font-heading text-lg font-semibold tracking-tight">{s.title}</h3>
                  </div>
                  <p className="text-sm text-zinc-500 leading-relaxed flex-1">{s.description}</p>
                  <code className="mt-5 block rounded-lg bg-surface-0/60 border border-white/[0.04] px-3.5 py-2.5 text-xs text-brand/80 font-mono">
                    {s.code}
                  </code>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ── SDKs ──────────────────────────────────────────── */

const sdks = [
  { name: 'TypeScript', install: 'npm i @xagentauth/client', badge: 'Server + Client' },
  { name: 'Python', install: 'pip install xagentauth', badge: 'LangChain + CrewAI' },
  { name: 'Rust', install: 'cargo add xagentauth', badge: 'WASM bindings' },
  { name: 'Go', install: 'go get github.com/dyshay/agentauth/sdks/go', badge: 'Zero deps' },
  { name: 'React', install: 'npm i @xagentauth/react', badge: 'Hooks + Components' },
  { name: 'Edge', install: 'npm i @xagentauth/edge-cf', badge: 'CF Workers + Deno' },
]

function SDKs() {
  return (
    <section className="py-28 border-t border-white/[0.03]">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal>
          <div className="text-center">
            <span className="font-mono text-xs text-brand/80 tracking-widest uppercase">Ecosystem</span>
            <h2 className="mt-3 font-heading text-3xl font-bold tracking-tight sm:text-4xl">One Protocol, Every Stack</h2>
          </div>
        </Reveal>

        <div className="mt-14 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sdks.map((sdk, i) => (
            <Reveal key={sdk.name} delay={i * 0.06}>
              <div className="glass-card group rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-heading text-sm font-semibold text-zinc-200">{sdk.name}</span>
                  <span className="rounded-full bg-white/[0.04] border border-white/[0.06] px-2.5 py-0.5 font-mono text-[10px] text-zinc-500">
                    {sdk.badge}
                  </span>
                </div>
                <div className="flex items-center rounded-lg bg-surface-0/50 border border-white/[0.03] px-3 py-2">
                  <span className="text-zinc-600 font-mono text-xs mr-2 select-none">$</span>
                  <code className="font-mono text-xs text-zinc-400 flex-1 truncate">{sdk.install}</code>
                  <span className="animate-blink text-brand/50 font-mono text-xs ml-1 hidden group-hover:inline">|</span>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ── CTA ───────────────────────────────────────────── */

function CTA() {
  return (
    <section className="py-28 border-t border-white/[0.03]">
      <div className="mx-auto max-w-4xl px-6">
        <Reveal>
          <div className="gradient-border rounded-2xl p-10 sm:p-14 text-center">
            <h2 className="font-display text-3xl sm:text-4xl tracking-tight">
              Ready to authenticate<br />your agents?
            </h2>
            <p className="mt-4 text-zinc-500 leading-relaxed">
              Get started in under 5 minutes. Install, configure, and protect your API.
            </p>

            {/* Terminal block */}
            <div className="mx-auto mt-10 max-w-md rounded-xl border border-white/[0.06] bg-surface-0/80 overflow-hidden text-left">
              <div className="flex items-center gap-1.5 border-b border-white/[0.04] px-4 py-2.5">
                <div className="h-2 w-2 rounded-full bg-white/[0.06]" />
                <div className="h-2 w-2 rounded-full bg-white/[0.06]" />
                <div className="h-2 w-2 rounded-full bg-white/[0.06]" />
                <span className="ml-2 font-mono text-[10px] text-zinc-700">terminal</span>
              </div>
              <div className="p-4 font-mono text-xs leading-loose">
                <div><span className="text-brand/60 select-none">~ </span><span className="text-zinc-400">npm install @xagentauth/server</span></div>
                <div><span className="text-brand/60 select-none">~ </span><span className="text-zinc-400">npm install @xagentauth/client</span></div>
                <div className="mt-1.5 text-brand">
                  <span className="mr-1.5">&#10003;</span>
                  Ready to authenticate agents
                </div>
              </div>
            </div>

            <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
              <a
                href="https://github.com/dyshay/agentauth"
                className="group flex items-center justify-center gap-2 rounded-xl bg-brand px-7 py-3.5 text-sm font-semibold text-surface-0 hover:bg-emerald-300 transition-all duration-300 shadow-[0_0_24px_rgba(52,211,153,0.15)]"
              >
                View on GitHub
                <svg className="transition-transform group-hover:translate-x-0.5" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" />
                </svg>
              </a>
              <a
                href="https://github.com/dyshay/agentauth#self-hosting"
                className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-7 py-3.5 text-sm font-medium text-zinc-300 hover:text-white hover:bg-white/[0.06] hover:border-white/[0.12] transition-all duration-300"
              >
                Self-Host with Docker
              </a>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

/* ── Page ──────────────────────────────────────────── */

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
