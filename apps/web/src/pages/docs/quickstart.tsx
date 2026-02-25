import { Prose } from '../../components/docs/prose'
import { CodeBlock } from '../../components/docs/code-block'

export function DocsQuickstart() {
  return (
    <Prose>
      <h1>Quickstart</h1>
      <p>
        Get AgentAuth running in your project in under 5 minutes. This guide covers server setup,
        client integration, and verifying your first agent.
      </p>

      <h2>1. Install the Server</h2>
      <CodeBlock
        lang="bash"
        code={`npm install @xagentauth/server @xagentauth/core`}
      />

      <h2>2. Create an Express Middleware</h2>
      <CodeBlock
        lang="typescript"
        filename="server.ts"
        code={`import express from 'express'
import { createExpressMiddleware } from '@xagentauth/server'
import { MemoryStore, CryptoNLDriver } from '@xagentauth/core'

const app = express()
app.use(express.json())

const auth = createExpressMiddleware({
  secret: process.env.AGENTAUTH_SECRET!,
  store: new MemoryStore(),
  drivers: [new CryptoNLDriver()],
  timing: { enabled: true },
})

// Protect your API routes
app.use('/api', auth)

app.get('/api/data', (req, res) => {
  // req.agentAuth contains the verified token payload
  res.json({ message: 'Hello, verified agent!' })
})

app.listen(3000)`}
      />

      <h2>3. Install the Client</h2>
      <CodeBlock
        lang="bash"
        code={`npm install @xagentauth/client`}
      />

      <h2>4. Authenticate an Agent</h2>
      <CodeBlock
        lang="typescript"
        filename="agent.ts"
        code={`import { AgentAuthClient } from '@xagentauth/client'

const client = new AgentAuthClient({
  serverUrl: 'http://localhost:3000',
})

// Request a challenge, solve it, get a JWT token
const token = await client.authenticate()

// Use the token to call protected endpoints
const res = await fetch('http://localhost:3000/api/data', {
  headers: { Authorization: \`Bearer \${token}\` },
})
console.log(await res.json())`}
      />

      <h2>5. Test with the CLI</h2>
      <CodeBlock
        lang="bash"
        code={`npx @xagentauth/cli verify http://localhost:3000`}
      />
      <p>
        The CLI will request a challenge, solve it, and print the resulting JWT token
        with capability scores.
      </p>

      <h2>Next Steps</h2>
      <ul>
        <li>Learn about <a href="/docs/concepts">core concepts</a> like challenge types and scoring</li>
        <li>Explore <a href="/docs/sdk/typescript">SDK documentation</a> for advanced usage</li>
        <li>Set up <a href="/docs/self-hosting">self-hosting</a> with Docker and Redis</li>
      </ul>
    </Prose>
  )
}
