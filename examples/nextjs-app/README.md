# Next.js App Example

Next.js application with AgentAuth integration using the React components and client SDK.

## Setup

```bash
pnpm install
pnpm dev
```

## Structure

```
app/
  layout.tsx          — Root layout
  page.tsx            — Home page with ChallengeWidget
  api/
    challenge/
      init/route.ts   — POST /api/challenge/init
      [id]/route.ts   — GET /api/challenge/:id
      [id]/solve/
        route.ts      — POST /api/challenge/:id/solve
    data/route.ts     — GET /api/data (protected)
```

## Features

- Server-side AgentAuth middleware via API routes
- Client-side `ChallengeWidget` and `ScoreBadge` from `@xagentauth/react`
- `useAgentAuth` hook for programmatic access
- Protected API endpoint with guard middleware
