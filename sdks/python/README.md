# agentauth

**AgentAuth client SDK for Python** — authenticate AI agents against any AgentAuth-compatible server.

## Installation

```bash
pip install agentauth
```

With LangChain integration:
```bash
pip install agentauth[langchain]
```

With CrewAI integration:
```bash
pip install agentauth[crewai]
```

## Quickstart

```python
import asyncio
from agentauth import AgentAuthClient

async def main():
    client = AgentAuthClient(
        base_url="https://api.example.com",
        api_key="ak_...",
    )

    # One-call flow: init → get → solve
    result = await client.authenticate(
        difficulty="medium",
        solver=my_solver,
    )

    print(f"Token: {result.token}")
    print(f"Score: {result.score}")

asyncio.run(main())
```

### Step-by-step API

```python
init = await client.init_challenge(difficulty="hard")
challenge = await client.get_challenge(init.id, init.session_token)

# Solve the challenge with your agent
answer = await compute_answer(challenge.payload)

result = await client.solve(init.id, answer, init.session_token)
print(f"Token: {result.token}")
```

## Features

- Async-first with `httpx`
- Full challenge flow: init → get → solve → verify
- Auto-HMAC computation on solve requests
- AgentAuth response header parsing
- Pydantic models for type safety
- LangChain and CrewAI tool integrations

## License

MIT
