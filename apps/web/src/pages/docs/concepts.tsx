import { Prose } from '../../components/docs/prose'
import { CodeBlock } from '../../components/docs/code-block'

export function DocsConcepts() {
  return (
    <Prose>
      <h1>Core Concepts</h1>
      <p>
        AgentAuth verifies agents through a multi-layered approach: challenges, capability scoring,
        model fingerprinting (PoMI), and behavioral timing analysis.
      </p>

      <h2>Challenge Types</h2>
      <p>
        AgentAuth uses pluggable challenge drivers. Each driver tests different capabilities:
      </p>
      <table>
        <thead>
          <tr><th>Driver</th><th>Dimensions</th><th>Description</th></tr>
        </thead>
        <tbody>
          <tr><td><code>crypto-nl</code></td><td>reasoning, execution</td><td>Natural-language cryptographic puzzles (decode, encrypt, hash)</td></tr>
          <tr><td><code>multi-step</code></td><td>reasoning, memory</td><td>Multi-step logical chains requiring state tracking</td></tr>
          <tr><td><code>ambiguous-logic</code></td><td>reasoning, ambiguity</td><td>Intentionally ambiguous problems to test nuanced reasoning</td></tr>
          <tr><td><code>code-execution</code></td><td>execution</td><td>Code understanding and output prediction</td></tr>
        </tbody>
      </table>

      <h2>Capability Scoring</h2>
      <p>
        Each successful verification produces a 5-dimension score from 0 to 1:
      </p>
      <ul>
        <li><strong>Reasoning</strong> &mdash; logical and analytical problem-solving</li>
        <li><strong>Execution</strong> &mdash; ability to run code and process data accurately</li>
        <li><strong>Autonomy</strong> &mdash; ability to operate independently (penalized by suspicious timing)</li>
        <li><strong>Speed</strong> &mdash; response efficiency (penalized by slow responses)</li>
        <li><strong>Consistency</strong> &mdash; reliability across repeated challenges</li>
      </ul>

      <h2>Proof of Model Identity (PoMI)</h2>
      <p>
        PoMI uses statistical canaries &mdash; micro-prompts injected into challenges that
        different model families answer in characteristic ways. The catalog includes:
      </p>
      <ul>
        <li><strong>Exact match</strong> canaries &mdash; specific answers that vary by model (e.g., emoji choice, math precision)</li>
        <li><strong>Statistical</strong> canaries &mdash; responses with model-specific distributions (e.g., random numbers, confidence levels)</li>
        <li><strong>Pattern</strong> canaries &mdash; formatting patterns that differ between models (e.g., list formatting, reasoning style)</li>
      </ul>
      <p>
        The classifier compares observed responses against known model signatures to produce
        a confidence score for each model family.
      </p>

      <h2>Timing Zones</h2>
      <p>
        AgentAuth classifies response times into behavioral zones:
      </p>
      <table>
        <thead>
          <tr><th>Zone</th><th>Meaning</th><th>Penalty</th></tr>
        </thead>
        <tbody>
          <tr><td><code>too_fast</code></td><td>Pre-computed or scripted response</td><td>Rejected</td></tr>
          <tr><td><code>ai_zone</code></td><td>Expected AI response time</td><td>None</td></tr>
          <tr><td><code>suspicious</code></td><td>Possible human assistance</td><td>0.3 - 0.7</td></tr>
          <tr><td><code>human</code></td><td>Likely human solver</td><td>0.9</td></tr>
          <tr><td><code>timeout</code></td><td>Exceeded time limit</td><td>Rejected</td></tr>
        </tbody>
      </table>

      <h3>Network Latency Compensation</h3>
      <p>
        Clients can pass <code>client_rtt_ms</code> when solving challenges. The server subtracts
        RTT from elapsed time (capped at 50%) and expands zone boundaries to account for high-latency connections.
      </p>

      <h3>Per-Step Timing</h3>
      <p>
        For multi-step challenges, clients can provide <code>step_timings</code> &mdash; an array
        of per-step durations in milliseconds. The pattern analyzer detects:
      </p>
      <ul>
        <li>Constant intervals (scripted)</li>
        <li>Round-number timing (artificial delays)</li>
        <li>Increasing/decreasing trends (fatigue or optimization)</li>
      </ul>

      <h2>Token Format</h2>
      <p>
        Successful verification produces a signed JWT containing:
      </p>
      <CodeBlock
        lang="json"
        code={`{
  "sub": "ch_abc123",
  "capabilities": {
    "reasoning": 0.9,
    "execution": 0.95,
    "autonomy": 0.9,
    "speed": 0.95,
    "consistency": 0.9
  },
  "model_family": "claude-3-class",
  "challenge_ids": ["ch_abc123"],
  "iat": 1700000000,
  "exp": 1700003600
}`}
      />
    </Prose>
  )
}
