import { Link } from 'react-router'
import { useInView } from '../hooks/use-in-view'
import type { ReactNode } from 'react'

/* ── Scroll-triggered wrapper ──────────────────────── */

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

/* ── SVG Icons ─────────────────────────────────────── */

function IconBarChart() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="12" width="4" height="9" rx="1" />
      <rect x="10" y="6" width="4" height="15" rx="1" />
      <rect x="17" y="2" width="4" height="19" rx="1" />
    </svg>
  )
}

function IconFingerprint() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 10v6" />
      <path d="M8.5 12.5a3.5 3.5 0 0 1 7 0v1" />
      <path d="M6 14a6 6 0 0 1 12 0" />
      <path d="M3.5 16a8.5 8.5 0 0 1 17 0" />
      <path d="M15.5 17a3.5 3.5 0 0 0-2-3" />
    </svg>
  )
}

function IconStopwatch() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2.5 1.5" />
      <path d="M10 2h4" />
      <path d="M12 2v3" />
      <path d="M19.4 7l1-1.73" />
    </svg>
  )
}

function IconTerminal() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  )
}

/* ── Hero ──────────────────────────────────────────── */

function Hero() {
  return (
    <section className="relative overflow-hidden pb-24 pt-20 sm:pb-32 sm:pt-28">
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="animate-orb absolute left-1/2 -top-32 h-[700px] w-[900px] rounded-full bg-gradient-to-b from-brand/[0.08] to-transparent blur-[100px]" />
        <div className="animate-orb-2 absolute -right-40 top-40 h-[400px] w-[400px] rounded-full bg-brand/[0.04] blur-[80px]" />
      </div>

      <div className="mx-auto max-w-5xl px-6">
        <div className="animate-fade-up flex justify-center">
          <div className="inline-flex items-center gap-2.5 rounded-full border border-brand/20 bg-brand/[0.06] px-4 py-1.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-brand" />
            </span>
            <span className="font-mono text-xs text-brand tracking-wide">OPEN PROTOCOL v1</span>
          </div>
        </div>

        <h1 className="animate-fade-up delay-1 mt-8 text-center font-display text-6xl leading-[1.05] tracking-tight sm:text-8xl sm:leading-[1.02]">
          Authentication for<br />
          <em className="text-brand">AI Agents</em>
        </h1>

        <p className="animate-fade-up delay-2 mx-auto mt-7 max-w-2xl text-center text-lg leading-relaxed text-zinc-400">
          Traditional CAPTCHAs prove you&apos;re human. AgentAuth proves you&apos;re a machine
          — and measures exactly how capable.{' '}
          <span className="text-zinc-200">OAuth for the agentic web.</span>
        </p>

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

        {/* JWT Preview */}
        <div className="animate-fade-up delay-5 mt-20 flex justify-center">
          <div className="animate-float animate-glow relative w-full max-w-xl rounded-2xl border border-white/[0.06] bg-surface-1/80 backdrop-blur-xl overflow-hidden">
            <div className="flex items-center gap-2 border-b border-white/[0.04] px-5 py-3">
              <div className="flex gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full bg-white/[0.06]" />
                <div className="h-2.5 w-2.5 rounded-full bg-white/[0.06]" />
                <div className="h-2.5 w-2.5 rounded-full bg-white/[0.06]" />
              </div>
              <span className="ml-2 font-mono text-[10px] text-zinc-600 tracking-wider uppercase">AgentAuth JWT Payload</span>
            </div>
            <div className="p-5 font-mono text-sm leading-relaxed">
              <div className="text-zinc-600">{'{'}</div>
              <div className="ml-4"><span className="text-brand/70">"capabilities"</span><span className="text-zinc-600">{': {'}</span></div>
              <div className="ml-8"><span className="text-zinc-500">"reasoning"</span><span className="text-zinc-600">: </span><span className="text-emerald-300">0.94</span><span className="text-zinc-700">,</span></div>
              <div className="ml-8"><span className="text-zinc-500">"execution"</span><span className="text-zinc-600">: </span><span className="text-emerald-300">0.98</span><span className="text-zinc-700">,</span></div>
              <div className="ml-8"><span className="text-zinc-500">"autonomy"</span><span className="text-zinc-600">: </span><span className="text-emerald-300">0.91</span><span className="text-zinc-700">,</span></div>
              <div className="ml-8"><span className="text-zinc-500">"speed"</span><span className="text-zinc-600">: </span><span className="text-yellow-400/80">0.87</span><span className="text-zinc-700">,</span></div>
              <div className="ml-8"><span className="text-zinc-500">"consistency"</span><span className="text-zinc-600">: </span><span className="text-emerald-300">0.95</span></div>
              <div className="ml-4 text-zinc-600">{'},'}</div>
              <div className="ml-4"><span className="text-brand/70">"model_identity"</span><span className="text-zinc-600">{': {'}</span></div>
              <div className="ml-8"><span className="text-zinc-500">"family"</span><span className="text-zinc-600">: </span><span className="text-amber-300/80">"claude-4-class"</span><span className="text-zinc-700">,</span></div>
              <div className="ml-8"><span className="text-zinc-500">"confidence"</span><span className="text-zinc-600">: </span><span className="text-emerald-300">0.92</span></div>
              <div className="ml-4 text-zinc-600">{'}'}</div>
              <div className="text-zinc-600">{'}'}<span className="animate-blink text-brand">|</span></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ── Feature Block Layout ──────────────────────────── */

function FeatureBlock({ icon, label, title, description, visual, reverse = false }: {
  icon: ReactNode
  label: string
  title: string
  description: string
  visual: ReactNode
  reverse?: boolean
}) {
  return (
    <section className="py-24 lg:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <div className={`flex flex-col gap-12 lg:gap-20 lg:items-center ${reverse ? 'lg:flex-row-reverse' : 'lg:flex-row'}`}>
          {/* Text */}
          <Reveal className="flex-1" delay={0}>
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand/[0.08] border border-brand/15 text-brand">
                {icon}
              </div>
              <span className="font-mono text-xs text-brand/80 tracking-widest uppercase">{label}</span>
            </div>
            <h2 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl leading-tight">{title}</h2>
            <p className="mt-5 text-zinc-400 leading-relaxed max-w-lg">{description}</p>
          </Reveal>

          {/* Visual */}
          <div className="flex-1 flex justify-center">
            {visual}
          </div>
        </div>
      </div>
    </section>
  )
}

/* ── Visual: Capability Scoring ────────────────────── */

function CapabilityVisual() {
  const { ref, isInView } = useInView()
  const scores = [
    { label: 'Reasoning', value: 0.94 },
    { label: 'Execution', value: 0.98 },
    { label: 'Autonomy', value: 0.91 },
    { label: 'Speed', value: 0.87 },
    { label: 'Consistency', value: 0.95 },
  ]

  return (
    <div ref={ref} className="w-full max-w-md rounded-2xl border border-white/[0.06] bg-surface-1/60 backdrop-blur-sm overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/[0.04] px-5 py-3">
        <span className="font-mono text-[10px] text-zinc-600 tracking-wider uppercase">Capability Vector</span>
        <span className="font-mono text-[10px] text-brand/60">VERIFIED</span>
      </div>
      <div className="p-5 space-y-4">
        {scores.map((s, i) => (
          <div key={s.label} className="flex items-center gap-4">
            <span className="w-24 text-xs text-zinc-500 font-mono shrink-0">{s.label}</span>
            <div className="flex-1 h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-brand-dim to-brand"
                style={{
                  width: isInView ? `${s.value * 100}%` : '0%',
                  transition: `width 1s cubic-bezier(0.16,1,0.3,1) ${i * 0.12}s`,
                }}
              />
            </div>
            <span
              className="w-10 text-right font-mono text-xs tabular-nums text-zinc-300"
              style={{
                opacity: isInView ? 1 : 0,
                transition: `opacity 0.4s ease ${0.6 + i * 0.12}s`,
              }}
            >
              {(s.value * 100).toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
      <div className="border-t border-white/[0.04] px-5 py-3 flex items-center justify-between">
        <span className="font-mono text-[10px] text-zinc-700">Overall</span>
        <span
          className="font-mono text-sm font-bold text-brand"
          style={{
            opacity: isInView ? 1 : 0,
            transition: 'opacity 0.5s ease 1s',
          }}
        >
          93%
        </span>
      </div>
    </div>
  )
}

/* ── Visual: PoMI Classification ───────────────────── */

function PomiVisual() {
  const { ref, isInView } = useInView()
  const models = [
    { family: 'claude-4-class', confidence: 0.92, primary: true },
    { family: 'gpt-4o-class', confidence: 0.04, primary: false },
    { family: 'gemini-2-class', confidence: 0.03, primary: false },
    { family: 'other', confidence: 0.01, primary: false },
  ]
  const evidence = [
    { signal: 'Reasoning chain structure', result: 'match' },
    { signal: 'Number distribution bias', result: 'match' },
    { signal: 'Formatting conventions', result: 'high confidence' },
    { signal: 'Default word choices', result: 'match' },
  ]

  return (
    <div ref={ref} className="w-full max-w-md rounded-2xl border border-white/[0.06] bg-surface-1/60 backdrop-blur-sm overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/[0.04] px-5 py-3">
        <span className="font-mono text-[10px] text-zinc-600 tracking-wider uppercase">Model Classification</span>
        <span className="font-mono text-[10px] text-zinc-700">4 canary signals</span>
      </div>
      <div className="p-5 space-y-3">
        {models.map((m, i) => (
          <div
            key={m.family}
            className="flex items-center gap-3"
            style={{
              opacity: isInView ? 1 : 0,
              transform: isInView ? 'translateX(0)' : 'translateX(-12px)',
              transition: `opacity 0.5s ease ${i * 0.1}s, transform 0.5s ease ${i * 0.1}s`,
            }}
          >
            <div className={`h-2 w-2 rounded-full shrink-0 ${m.primary ? 'bg-brand' : 'bg-white/[0.08]'}`} />
            <span className={`font-mono text-xs flex-1 ${m.primary ? 'text-zinc-200' : 'text-zinc-600'}`}>
              {m.family}
            </span>
            <div className="w-20 h-1 bg-white/[0.04] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${m.primary ? 'bg-brand' : 'bg-white/[0.1]'}`}
                style={{
                  width: isInView ? `${m.confidence * 100}%` : '0%',
                  transition: `width 0.8s cubic-bezier(0.16,1,0.3,1) ${0.2 + i * 0.1}s`,
                }}
              />
            </div>
            <span className={`font-mono text-xs tabular-nums w-10 text-right ${m.primary ? 'text-brand' : 'text-zinc-700'}`}>
              {(m.confidence * 100).toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
      <div className="border-t border-white/[0.04] px-5 py-4 space-y-2">
        <span className="font-mono text-[10px] text-zinc-600 tracking-wider uppercase">Evidence</span>
        {evidence.map((e, i) => (
          <div
            key={e.signal}
            className="flex items-center gap-2.5"
            style={{
              opacity: isInView ? 1 : 0,
              transition: `opacity 0.4s ease ${0.5 + i * 0.08}s`,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-brand/60 shrink-0">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span className="font-mono text-[11px] text-zinc-500">{e.signal}</span>
            <span className="font-mono text-[10px] text-zinc-700 ml-auto">{e.result}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Visual: Timing Analysis ───────────────────────── */

function TimingVisual() {
  const { ref, isInView } = useInView()
  const zones = [
    { label: 'Too Fast', range: '<50ms', width: 'w-[10%]', color: 'bg-red-500/30', textColor: 'text-red-400/60' },
    { label: 'AI Zone', range: '50ms–2s', width: 'w-[35%]', color: 'bg-brand/30', textColor: 'text-brand' },
    { label: 'Suspicious', range: '2s–10s', width: 'w-[25%]', color: 'bg-yellow-500/20', textColor: 'text-yellow-500/60' },
    { label: 'Human', range: '10s–30s', width: 'w-[20%]', color: 'bg-orange-500/20', textColor: 'text-orange-500/60' },
    { label: 'Timeout', range: '>30s', width: 'w-[10%]', color: 'bg-red-500/20', textColor: 'text-red-400/60' },
  ]

  return (
    <div ref={ref} className="w-full max-w-md rounded-2xl border border-white/[0.06] bg-surface-1/60 backdrop-blur-sm overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/[0.04] px-5 py-3">
        <span className="font-mono text-[10px] text-zinc-600 tracking-wider uppercase">Timing Analysis</span>
        <span className="font-mono text-[10px] text-brand/60">230ms</span>
      </div>
      <div className="p-5">
        {/* Zone bar */}
        <div className="flex h-8 rounded-lg overflow-hidden gap-px">
          {zones.map((z, i) => (
            <div
              key={z.label}
              className={`${z.width} ${z.color} relative flex items-center justify-center`}
              style={{
                opacity: isInView ? 1 : 0,
                transition: `opacity 0.4s ease ${i * 0.08}s`,
              }}
            >
              <span className={`font-mono text-[8px] ${z.textColor} whitespace-nowrap`}>{z.label}</span>
            </div>
          ))}
        </div>

        {/* Indicator */}
        <div className="relative mt-1 h-6">
          <div
            className="absolute flex flex-col items-center"
            style={{
              left: isInView ? '22%' : '0%',
              transition: 'left 1.2s cubic-bezier(0.16,1,0.3,1) 0.3s',
              opacity: isInView ? 1 : 0,
            }}
          >
            <svg width="8" height="6" viewBox="0 0 8 6" className="text-brand">
              <polygon points="4,0 8,6 0,6" fill="currentColor" />
            </svg>
          </div>
        </div>

        {/* Details */}
        <div className="mt-4 space-y-2.5">
          {[
            { label: 'Response time', value: '230ms', accent: true },
            { label: 'Zone', value: 'AI (optimal)', accent: true },
            { label: 'Penalty', value: '0.00', accent: false },
            { label: 'Confidence', value: '0.97', accent: false },
          ].map((row, i) => (
            <div
              key={row.label}
              className="flex items-center justify-between"
              style={{
                opacity: isInView ? 1 : 0,
                transform: isInView ? 'translateY(0)' : 'translateY(8px)',
                transition: `opacity 0.4s ease ${0.6 + i * 0.08}s, transform 0.4s ease ${0.6 + i * 0.08}s`,
              }}
            >
              <span className="font-mono text-[11px] text-zinc-600">{row.label}</span>
              <span className={`font-mono text-xs tabular-nums ${row.accent ? 'text-brand' : 'text-zinc-500'}`}>{row.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ── Visual: Open Protocol Headers ─────────────────── */

function ProtocolVisual() {
  const { ref, isInView } = useInView()
  const headers = [
    { key: 'AgentAuth-Status', value: 'verified', valueColor: 'text-brand' },
    { key: 'AgentAuth-Score', value: '0.93', valueColor: 'text-zinc-300' },
    { key: 'AgentAuth-Model-Family', value: 'claude-4-class', valueColor: 'text-zinc-300' },
    { key: 'AgentAuth-PoMI-Confidence', value: '0.92', valueColor: 'text-zinc-300' },
    { key: 'AgentAuth-Capabilities', value: 'r=0.94,e=0.98,a=0.91', valueColor: 'text-zinc-400' },
    { key: 'AgentAuth-Version', value: '1', valueColor: 'text-zinc-500' },
    { key: 'AgentAuth-Challenge-Id', value: 'ch_a1b2c3d4', valueColor: 'text-zinc-500' },
    { key: 'AgentAuth-Token-Expires', value: '1708784400', valueColor: 'text-zinc-500' },
  ]

  return (
    <div ref={ref} className="w-full max-w-md rounded-2xl border border-white/[0.06] bg-surface-1/60 backdrop-blur-sm overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/[0.04] px-5 py-3">
        <span className="font-mono text-[10px] text-zinc-600 tracking-wider uppercase">Response Headers</span>
        <span className="font-mono text-[10px] text-zinc-700">HTTP/1.1 200 OK</span>
      </div>
      <div className="p-5 space-y-1.5">
        {headers.map((h, i) => (
          <div
            key={h.key}
            className="flex items-baseline gap-1 font-mono text-[11px] leading-relaxed"
            style={{
              opacity: isInView ? 1 : 0,
              transform: isInView ? 'translateX(0)' : 'translateX(-8px)',
              transition: `opacity 0.35s ease ${i * 0.07}s, transform 0.35s ease ${i * 0.07}s`,
            }}
          >
            <span className="text-zinc-600 shrink-0">{h.key}:</span>
            <span className={h.valueColor}>{h.value}</span>
          </div>
        ))}
      </div>
      <div className="border-t border-white/[0.04] px-5 py-3 flex items-center gap-2">
        <div className="h-1.5 w-1.5 rounded-full bg-brand animate-pulse" />
        <span
          className="font-mono text-[10px] text-zinc-600"
          style={{
            opacity: isInView ? 1 : 0,
            transition: 'opacity 0.4s ease 0.8s',
          }}
        >
          Headers injected by guard() middleware
        </span>
      </div>
    </div>
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

      <FeatureBlock
        icon={<IconBarChart />}
        label="Capability Scoring"
        title="Five dimensions of agent capability"
        description="Every authenticated agent receives a scored capability vector: reasoning, execution, autonomy, speed, and consistency. API providers can gate access by minimum score, ensuring only sufficiently capable agents reach sensitive endpoints."
        visual={<CapabilityVisual />}
      />

      <FeatureBlock
        icon={<IconFingerprint />}
        label="Model Identity"
        title="Know which model is behind the agent"
        description="Canary prompts are embedded alongside real challenge data. Each model family exhibits subtle behavioral fingerprints — number biases, reasoning patterns, formatting preferences. A Bayesian classifier analyzes these signals to identify the model with confidence scores."
        visual={<PomiVisual />}
        reverse
      />

      <FeatureBlock
        icon={<IconStopwatch />}
        label="Timing Analysis"
        title="Detect humans, scripts, and pre-computation"
        description="Response time is classified into zones: too-fast rejects pre-computed answers, the AI zone accepts genuine agent responses, and slow responses penalize autonomy and speed scores. Multi-step timing patterns catch scripted delays and human fatigue."
        visual={<TimingVisual />}
      />

      <FeatureBlock
        icon={<IconTerminal />}
        label="Open Protocol"
        title="Standard headers, signed JWTs, every stack"
        description="AgentAuth injects standard HTTP response headers on verified requests, making agent status visible to downstream middleware. SDKs for TypeScript, Python, Rust, and Go. Self-host with Docker or deploy at the edge on Cloudflare Workers and Deno."
        visual={<ProtocolVisual />}
        reverse
      />

      <HowItWorks />
      <SDKs />
      <CTA />
    </>
  )
}
