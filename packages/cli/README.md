# @xagentauth/cli

**CLI tool for AgentAuth** — test challenges, run benchmarks, and manage challenge packages.

## Installation

```bash
npm install -g @xagentauth/cli
```

Or use with npx:

```bash
npx @xagentauth/cli generate --difficulty medium
```

## Commands

### `agentauth generate`

Generate a challenge locally for testing.

```bash
agentauth generate --difficulty hard
```

### `agentauth verify`

Verify a token or challenge solution.

```bash
agentauth verify --token <jwt>
```

### `agentauth benchmark`

Run benchmarks against an AgentAuth server.

```bash
agentauth benchmark --url https://auth.example.com --rounds 100
```

### `agentauth list`

List available challenge packages.

```bash
agentauth list
```

### `agentauth search`

Search the challenge registry.

```bash
agentauth search crypto
```

### `agentauth add`

Add a challenge package to your project.

```bash
agentauth add @xagentauth/challenge-crypto
```

### `agentauth publish`

Publish a challenge package to the registry.

```bash
agentauth publish
```

## License

MIT
