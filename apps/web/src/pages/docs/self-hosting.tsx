import { Prose } from '../../components/docs/prose'
import { CodeBlock } from '../../components/docs/code-block'

export function DocsSelfHosting() {
  return (
    <Prose>
      <h1>Self-Hosting</h1>
      <p>
        AgentAuth can be self-hosted using Docker Compose. This guide covers setup with
        Redis for production-grade challenge storage.
      </p>

      <h2>Docker Compose</h2>
      <CodeBlock
        lang="yaml"
        filename="docker-compose.yml"
        code={`services:
  agentauth:
    image: ghcr.io/dyshay/agentauth:latest
    ports:
      - "3000:3000"
    environment:
      - AGENTAUTH_SECRET=your-secret-key-at-least-32-chars
      - REDIS_URL=redis://redis:6379
      - STORE_BACKEND=redis
    depends_on:
      - redis

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data

volumes:
  redis-data:`}
      />

      <h2>Environment Variables</h2>
      <table>
        <thead>
          <tr><th>Variable</th><th>Default</th><th>Description</th></tr>
        </thead>
        <tbody>
          <tr><td><code>AGENTAUTH_SECRET</code></td><td>&mdash;</td><td>Secret key for JWT signing and HMAC (min 32 chars)</td></tr>
          <tr><td><code>STORE_BACKEND</code></td><td><code>memory</code></td><td>Store backend: <code>memory</code>, <code>redis</code>, <code>postgres</code></td></tr>
          <tr><td><code>REDIS_URL</code></td><td>&mdash;</td><td>Redis connection URL (required if store is redis)</td></tr>
          <tr><td><code>DATABASE_URL</code></td><td>&mdash;</td><td>PostgreSQL connection URL (required if store is postgres)</td></tr>
          <tr><td><code>CHALLENGE_TTL</code></td><td><code>30</code></td><td>Challenge TTL in seconds</td></tr>
          <tr><td><code>TOKEN_TTL</code></td><td><code>3600</code></td><td>JWT token TTL in seconds</td></tr>
          <tr><td><code>TIMING_ENABLED</code></td><td><code>true</code></td><td>Enable timing analysis</td></tr>
          <tr><td><code>POMI_ENABLED</code></td><td><code>false</code></td><td>Enable Proof of Model Identity</td></tr>
          <tr><td><code>PORT</code></td><td><code>3000</code></td><td>Server port</td></tr>
        </tbody>
      </table>

      <h2>Production Recommendations</h2>
      <ul>
        <li>Use <strong>Redis</strong> or <strong>PostgreSQL</strong> for challenge storage &mdash; the memory store is not suitable for multi-instance deployments</li>
        <li>Set a strong <code>AGENTAUTH_SECRET</code> (at least 32 characters of random data)</li>
        <li>Place AgentAuth behind a reverse proxy (nginx, Caddy) with TLS termination</li>
        <li>Enable <code>TIMING_ENABLED</code> in production to detect scripted and human solvers</li>
        <li>Monitor challenge solve rates and timing distributions for anomalies</li>
      </ul>

      <h2>Kubernetes</h2>
      <p>
        For Kubernetes deployments, use the Docker image directly with a Redis or PostgreSQL
        backend. AgentAuth is stateless (all state is in the store), so it scales horizontally.
      </p>
      <CodeBlock
        lang="yaml"
        filename="k8s-deployment.yaml"
        code={`apiVersion: apps/v1
kind: Deployment
metadata:
  name: agentauth
spec:
  replicas: 3
  selector:
    matchLabels:
      app: agentauth
  template:
    metadata:
      labels:
        app: agentauth
    spec:
      containers:
        - name: agentauth
          image: ghcr.io/dyshay/agentauth:latest
          ports:
            - containerPort: 3000
          env:
            - name: AGENTAUTH_SECRET
              valueFrom:
                secretKeyRef:
                  name: agentauth-secrets
                  key: secret
            - name: REDIS_URL
              value: redis://redis:6379
            - name: STORE_BACKEND
              value: redis`}
      />
    </Prose>
  )
}
