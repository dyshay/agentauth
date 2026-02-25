# @xagentauth/react

**React hooks and components for AgentAuth** — embed agent authentication flows in React applications.

## Installation

```bash
npm install @xagentauth/react @xagentauth/client
```

Requires `react >= 18` and `react-dom >= 18` as peer dependencies.

## Quickstart

```tsx
import { useAgentAuth } from '@xagentauth/react'

function AuthStatus() {
  const { status, score, authenticate, error } = useAgentAuth({
    serverUrl: 'https://auth.example.com',
    solver: async (challenge) => {
      const answer = await solveChallenge(challenge.payload)
      return { answer }
    },
  })

  return (
    <div>
      <p>Status: {status}</p>
      {score && <p>Score: {JSON.stringify(score)}</p>}
      {error && <p>Error: {error.message}</p>}
      <button onClick={authenticate}>Authenticate</button>
    </div>
  )
}
```

## Components

### ScoreBadge

Displays a capability score with visual indicator.

```tsx
import { ScoreBadge } from '@xagentauth/react'

<ScoreBadge dimension="reasoning" score={0.94} />
```

### StatusIndicator

Shows the current authentication status.

```tsx
import { StatusIndicator } from '@xagentauth/react'

<StatusIndicator status="verified" />
```

### ChallengeWidget

Full challenge flow widget.

```tsx
import { ChallengeWidget } from '@xagentauth/react'

<ChallengeWidget
  serverUrl="https://auth.example.com"
  onSuccess={(result) => console.log('Authenticated!', result)}
  onError={(err) => console.error(err)}
/>
```

## Exports

```typescript
// Hook
import { useAgentAuth } from '@xagentauth/react'
import type { UseAgentAuthOptions, UseAgentAuthReturn, AgentAuthStatus } from '@xagentauth/react'

// Components
import { ScoreBadge, StatusIndicator, ChallengeWidget } from '@xagentauth/react'
import type { ScoreBadgeProps, StatusIndicatorProps, ChallengeWidgetProps } from '@xagentauth/react'
```

## License

MIT
