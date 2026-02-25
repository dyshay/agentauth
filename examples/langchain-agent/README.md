# LangChain Agent Example

AI agent that authenticates via AgentAuth before accessing protected APIs.

## Setup

```bash
pip install -r requirements.txt
export OPENAI_API_KEY="sk-..."
export AGENTAUTH_URL="http://localhost:3000"
```

## Usage

First start the Express example server (or any AgentAuth server), then:

```bash
python agent.py
```

The agent will:
1. Request a challenge from the AgentAuth server
2. Use GPT-4o to solve the challenge
3. Submit the solution and receive a JWT
4. Use the JWT to access protected endpoints

## Using the LangChain Tool Integration

For automatic authentication in agent chains:

```python
from xagentauth.integrations.langchain import AgentAuthTool

tools = [AgentAuthTool(base_url="http://localhost:3000")]
agent = create_tool_calling_agent(llm, tools, prompt)
```
