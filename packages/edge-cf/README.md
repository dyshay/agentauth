# @xagentauth/edge-cf

**AgentAuth server adapter for Cloudflare Workers** — run the AgentAuth protocol at the edge.

## Installation

```bash
npm install @xagentauth/edge-cf @xagentauth/core
```

## Usage

```typescript
import { createAgentAuthHandler } from '@xagentauth/edge-cf'
import { KVStore, CryptoNLDriver } from '@xagentauth/core'

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const handler = createAgentAuthHandler({
      secret: env.AGENTAUTH_SECRET,
      store: new KVStore(env.AGENTAUTH_KV),
      drivers: [new CryptoNLDriver()],
      challengeTtlSeconds: 30,
      tokenTtlSeconds: 3600,
      minScore: 0.5,
    })

    return handler(request)
  },
}
```

## Configuration

The `EdgeCFOptions` type extends the core `AgentAuthConfig`:

```typescript
import type { EdgeCFOptions } from '@xagentauth/edge-cf'
```

## Wrangler Setup

```toml
# wrangler.toml
name = "agentauth-worker"
main = "src/index.ts"

[[kv_namespaces]]
binding = "AGENTAUTH_KV"
id = "your-kv-namespace-id"

[vars]
AGENTAUTH_SECRET = "your-secret"
```

## License

MIT
