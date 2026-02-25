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

Run local or remote benchmarks against AgentAuth challenges.

```bash
# Local benchmark (no server needed)
agentauth benchmark --type crypto-nl --difficulty medium --rounds 20

# Remote benchmark against a server
agentauth benchmark --remote https://auth.example.com --model gpt-4o --rounds 50

# Output leaderboard-compatible JSON
agentauth benchmark --remote https://auth.example.com --model claude-4 --output results.json
```

| Flag | Description | Default |
|------|-------------|---------|
| `-t, --type <type>` | Challenge type | `crypto-nl` |
| `-d, --difficulty <level>` | Difficulty level | `medium` |
| `-n, --rounds <n>` | Number of rounds | `10` |
| `-r, --remote <url>` | Benchmark against a remote server | — |
| `-m, --model <name>` | Model name for leaderboard tagging | `unknown` |
| `-o, --output <file>` | Write leaderboard JSON to file | — |
| `--json` | Output as JSON | `false` |

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
