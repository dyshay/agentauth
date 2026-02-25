import { Link } from 'react-router'
import { Prose } from '../../components/docs/prose'

export function DocsIndex() {
  return (
    <Prose>
      <h1>AgentAuth Documentation</h1>
      <p>
        AgentAuth is an open authentication protocol for AI agents &mdash; OAuth for the agentic web.
        It proves an entity is a real AI agent, measures its capabilities, and identifies its model family.
      </p>

      <h2>What AgentAuth Does</h2>
      <ul>
        <li><strong>Challenge-based verification</strong> &mdash; cryptographic, multi-step, and logic puzzles that only real AI agents can solve efficiently</li>
        <li><strong>Capability scoring</strong> &mdash; 5-dimension scores (reasoning, execution, autonomy, speed, consistency) from 0-1</li>
        <li><strong>Model fingerprinting (PoMI)</strong> &mdash; identify the model family (GPT-4, Claude, Gemini, etc.) through statistical canaries</li>
        <li><strong>Timing analysis</strong> &mdash; detect scripted, human, or genuine AI responses via behavioral timing zones</li>
        <li><strong>JWT tokens</strong> &mdash; signed tokens with capabilities, model identity, and expiry for downstream use</li>
      </ul>

      <h2>Architecture</h2>
      <p>
        AgentAuth is built as a monorepo with pluggable components:
      </p>
      <table>
        <thead>
          <tr><th>Package</th><th>Purpose</th></tr>
        </thead>
        <tbody>
          <tr><td><code>@xagentauth/core</code></td><td>Challenge logic, types, scoring, PoMI, timing (zero dependencies on frameworks)</td></tr>
          <tr><td><code>@xagentauth/server</code></td><td>Express, Hono, and Fastify middleware</td></tr>
          <tr><td><code>@xagentauth/client</code></td><td>TypeScript client SDK</td></tr>
          <tr><td><code>@xagentauth/react</code></td><td>React components and hooks</td></tr>
          <tr><td><code>@xagentauth/cli</code></td><td>CLI for testing and benchmarking</td></tr>
        </tbody>
      </table>

      <h2>Quick Links</h2>
      <ul>
        <li><Link to="/docs/quickstart">Quickstart Guide</Link> &mdash; get running in 5 minutes</li>
        <li><Link to="/docs/concepts">Core Concepts</Link> &mdash; challenges, scoring, PoMI, and timing</li>
        <li><Link to="/docs/sdk/typescript">TypeScript SDK</Link> &mdash; install and use the client</li>
        <li><Link to="/docs/self-hosting">Self-Hosting</Link> &mdash; deploy with Docker</li>
        <li><a href="/api-reference">API Reference</a> &mdash; full OpenAPI documentation</li>
      </ul>
    </Prose>
  )
}
