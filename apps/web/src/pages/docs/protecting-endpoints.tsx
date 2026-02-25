import { Prose } from '../../components/docs/prose'
import { CodeBlock } from '../../components/docs/code-block'

export function DocsProtectingEndpoints() {
  return (
    <Prose>
      <h1>Protecting Endpoints</h1>
      <p>
        AgentAuth provides guard middleware that verifies JWT tokens and enforces minimum
        capability scores on your API routes. This page shows how to protect endpoints
        across every supported framework.
      </p>
      <p>
        Every guard follows the same pattern: extract the <code>Bearer</code> token, call{' '}
        <code>verifyToken()</code>, check the average capability score against a minimum
        threshold, and set <code>AgentAuth-*</code> response headers on success.
      </p>

      <hr />

      <h2>Express</h2>
      <p>
        The Express adapter provides a <code>guard()</code> method that returns standard
        Express middleware.
      </p>
      <CodeBlock
        lang="bash"
        code={`npm install @xagentauth/server @xagentauth/core`}
      />
      <CodeBlock
        lang="typescript"
        filename="server.ts"
        code={`import express from 'express'
import { AgentAuth } from '@xagentauth/server'
import { MemoryStore, CryptoNLDriver } from '@xagentauth/core'

const app = express()
app.use(express.json())

const auth = new AgentAuth({
  secret: process.env.AGENTAUTH_SECRET!,
  store: new MemoryStore(),
  drivers: [new CryptoNLDriver()],
})

// Protect all /api routes — reject tokens with avg score < 0.7
app.use('/api', auth.guard({ minScore: 0.7 }))

app.get('/api/data', (req, res) => {
  res.json({ message: 'Hello, verified agent!' })
})

app.listen(3000)`}
      />
      <p>
        The <code>guard()</code> middleware returns <code>401</code> for missing or invalid
        tokens and <code>403</code> if the capability score is below the threshold.
        On success it calls <code>next()</code> and sets <code>AgentAuth-Status</code>,{' '}
        <code>AgentAuth-Capabilities</code>, and other headers on the response.
      </p>

      <hr />

      <h2>Hono</h2>
      <p>
        The Hono adapter works identically — import from the <code>/hono</code> subpath.
      </p>
      <CodeBlock
        lang="bash"
        code={`npm install @xagentauth/server @xagentauth/core`}
      />
      <CodeBlock
        lang="typescript"
        filename="server.ts"
        code={`import { Hono } from 'hono'
import { AgentAuthHono } from '@xagentauth/server/hono'
import { MemoryStore, CryptoNLDriver } from '@xagentauth/core'

const app = new Hono()

const auth = new AgentAuthHono({
  secret: process.env.AGENTAUTH_SECRET!,
  store: new MemoryStore(),
  drivers: [new CryptoNLDriver()],
})

// Guard middleware for all /api routes
app.use('/api/*', auth.guard({ minScore: 0.7 }))

app.get('/api/data', (c) => {
  return c.json({ message: 'Hello, verified agent!' })
})

export default app`}
      />

      <hr />

      <h2>NestJS</h2>
      <p>
        The NestJS adapter provides a guard, a decorator for per-route score thresholds,
        and a dynamic module for dependency injection.
      </p>
      <CodeBlock
        lang="bash"
        code={`npm install @xagentauth/server @xagentauth/core`}
      />
      <CodeBlock
        lang="typescript"
        filename="app.module.ts"
        code={`import { Module } from '@nestjs/common'
import { AgentAuthModule } from '@xagentauth/server/nestjs'
import { MemoryStore, CryptoNLDriver } from '@xagentauth/core'

@Module({
  imports: [
    AgentAuthModule.forRoot({
      secret: process.env.AGENTAUTH_SECRET!,
      store: new MemoryStore(),
      drivers: [new CryptoNLDriver()],
    }),
  ],
})
export class AppModule {}`}
      />
      <CodeBlock
        lang="typescript"
        filename="data.controller.ts"
        code={`import { Controller, Get, UseGuards } from '@nestjs/common'
import { AgentAuthGuard, AgentAuth } from '@xagentauth/server/nestjs'

@Controller('api')
@UseGuards(AgentAuthGuard)
export class DataController {
  @Get('data')
  @AgentAuth({ minScore: 0.7 })
  getData() {
    return { message: 'Hello, verified agent!' }
  }

  @Get('premium')
  @AgentAuth({ minScore: 0.9 })
  getPremium() {
    return { message: 'Premium access granted' }
  }
}`}
      />
      <p>
        The <code>@AgentAuth()</code> decorator sets a per-route minimum score.
        The <code>AgentAuthGuard</code> reads this metadata and enforces it automatically.
      </p>

      <hr />

      <h2>Cloudflare Workers</h2>
      <p>
        Cloudflare Workers don't use Express or Hono middleware directly, but you can use
        the core engine's <code>verifyToken()</code> method to build a custom guard.
      </p>
      <CodeBlock
        lang="bash"
        code={`npm install @xagentauth/core`}
      />
      <CodeBlock
        lang="typescript"
        filename="worker.ts"
        code={`import { AgentAuthEngine, MemoryStore, CryptoNLDriver } from '@xagentauth/core'

const engine = new AgentAuthEngine({
  secret: 'your-secret',
  store: new MemoryStore(),
  drivers: [new CryptoNLDriver()],
})

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname.startsWith('/api/')) {
      const auth = request.headers.get('authorization')
      if (!auth?.startsWith('Bearer ')) {
        return Response.json({ error: 'Missing token' }, { status: 401 })
      }

      const result = await engine.verifyToken(auth.slice(7))
      if (!result.valid) {
        return Response.json({ error: 'Invalid token' }, { status: 401 })
      }

      // Check score
      if (result.capabilities) {
        const avg = Object.values(result.capabilities)
          .reduce((a, b) => a + b, 0) / 5
        if (avg < 0.7) {
          return Response.json({ error: 'Insufficient score' }, { status: 403 })
        }
      }
    }

    return Response.json({ message: 'Hello, verified agent!' })
  },
}`}
      />

      <hr />

      <h2>Deno Deploy</h2>
      <p>
        Same pattern as Cloudflare Workers — use <code>AgentAuthEngine</code> directly
        from <code>@xagentauth/core</code>.
      </p>
      <CodeBlock
        lang="typescript"
        filename="main.ts"
        code={`import { AgentAuthEngine, MemoryStore, CryptoNLDriver } from '@xagentauth/core'

const engine = new AgentAuthEngine({
  secret: Deno.env.get('AGENTAUTH_SECRET')!,
  store: new MemoryStore(),
  drivers: [new CryptoNLDriver()],
})

Deno.serve(async (request) => {
  const url = new URL(request.url)

  if (url.pathname.startsWith('/api/')) {
    const auth = request.headers.get('authorization')
    if (!auth?.startsWith('Bearer ')) {
      return Response.json({ error: 'Missing token' }, { status: 401 })
    }

    const result = await engine.verifyToken(auth.slice(7))
    if (!result.valid) {
      return Response.json({ error: 'Invalid token' }, { status: 401 })
    }

    if (result.capabilities) {
      const avg = Object.values(result.capabilities)
        .reduce((a, b) => a + b, 0) / 5
      if (avg < 0.7) {
        return Response.json({ error: 'Insufficient score' }, { status: 403 })
      }
    }
  }

  return Response.json({ message: 'Hello, verified agent!' })
})`}
      />

      <hr />

      <h2>Custom / Any Framework</h2>
      <p>
        For any framework not listed above, use <code>AgentAuthEngine.verifyToken()</code>{' '}
        directly from <code>@xagentauth/core</code>. The core package is framework-agnostic
        with zero dependencies.
      </p>
      <CodeBlock
        lang="bash"
        code={`npm install @xagentauth/core`}
      />
      <CodeBlock
        lang="typescript"
        filename="guard.ts"
        code={`import {
  AgentAuthEngine,
  buildHeaders,
  MemoryStore,
  CryptoNLDriver,
} from '@xagentauth/core'

const engine = new AgentAuthEngine({
  secret: process.env.AGENTAUTH_SECRET!,
  store: new MemoryStore(),
  drivers: [new CryptoNLDriver()],
})

export async function verifyAgent(
  authHeader: string | null,
  minScore = 0.7,
): Promise<{ ok: boolean; status: number; headers?: Record<string, string>; error?: string }> {
  if (!authHeader?.startsWith('Bearer ')) {
    return { ok: false, status: 401, error: 'Missing token' }
  }

  const result = await engine.verifyToken(authHeader.slice(7))

  if (!result.valid) {
    return { ok: false, status: 401, error: 'Invalid or expired token' }
  }

  if (result.capabilities) {
    const avg = Object.values(result.capabilities)
      .reduce((a, b) => a + b, 0) / 5
    if (avg < minScore) {
      return { ok: false, status: 403, error: \`Score \${avg.toFixed(2)} below \${minScore}\` }
    }
  }

  const headers = buildHeaders({
    status: 'verified',
    score: result.capabilities,
    model_family: result.model_family,
    expires_at: result.expires_at,
  })

  return { ok: true, status: 200, headers }
}`}
      />
      <p>
        This <code>verifyAgent()</code> helper can be called from any HTTP framework.
        It returns a simple result object — check <code>ok</code>, set the response
        status and headers accordingly, and you're done.
      </p>
    </Prose>
  )
}
