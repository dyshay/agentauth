# @xagentauth/edge-deno

**AgentAuth server adapter for Deno Deploy** — run the AgentAuth protocol on Deno's edge network.

## Installation

```bash
npm install @xagentauth/edge-deno @xagentauth/core
```

Or import directly in Deno:

```typescript
import { createAgentAuthHandler } from 'npm:@xagentauth/edge-deno'
import { MemoryStore, CryptoNLDriver } from 'npm:@xagentauth/core'
```

## Usage

```typescript
import { createAgentAuthHandler } from '@xagentauth/edge-deno'
import { MemoryStore, CryptoNLDriver } from '@xagentauth/core'

const handler = createAgentAuthHandler({
  secret: Deno.env.get('AGENTAUTH_SECRET')!,
  store: new MemoryStore(),
  drivers: [new CryptoNLDriver()],
  challengeTtlSeconds: 30,
  tokenTtlSeconds: 3600,
  minScore: 0.5,
})

Deno.serve(handler)
```

## Configuration

The `EdgeDenoOptions` type extends the core `AgentAuthConfig`:

```typescript
import type { EdgeDenoOptions } from '@xagentauth/edge-deno'
```

## License

MIT
