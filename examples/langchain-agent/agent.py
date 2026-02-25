"""
AgentAuth + LangChain Example

Demonstrates an AI agent that automatically authenticates
via AgentAuth when accessing protected API endpoints.
"""

import os

from langchain_openai import ChatOpenAI
from langchain.agents import AgentExecutor, create_tool_calling_agent
from langchain_core.prompts import ChatPromptTemplate

# If using the AgentAuth LangChain integration:
# from xagentauth.integrations.langchain import AgentAuthTool

from xagentauth import AgentAuthClient


def main():
    # --- AgentAuth client ---
    auth_client = AgentAuthClient(
        base_url=os.getenv("AGENTAUTH_URL", "http://localhost:3000"),
    )

    # --- Authenticate the agent ---
    print("Authenticating agent via AgentAuth...")

    # Step 1: Init challenge
    init = auth_client.init_challenge(difficulty="easy")
    print(f"  Challenge ID: {init.id}")

    # Step 2: Retrieve challenge
    challenge = auth_client.get_challenge(init.id, init.session_token)
    print(f"  Type: {challenge.payload.type}")
    print(f"  Instructions: {challenge.payload.instructions}")

    # Step 3: Use the LLM to solve the challenge
    llm = ChatOpenAI(model="gpt-4o", temperature=0)
    response = llm.invoke(
        f"Solve this challenge and return ONLY the answer, nothing else:\n\n"
        f"Instructions: {challenge.payload.instructions}\n"
        f"Data: {challenge.payload.data}"
    )
    answer = response.content.strip()
    print(f"  LLM answer: {answer}")

    # Step 4: Submit solution
    result = auth_client.solve(init.id, answer, init.session_token)

    if result.success:
        print(f"  Authenticated! Token: {result.token[:50]}...")
        print(f"  Capabilities: {result.score}")
    else:
        print(f"  Failed: {result.reason}")
        return

    # --- Use the token to access protected APIs ---
    print("\nAccessing protected endpoint...")
    # Use result.token as Authorization: Bearer header


if __name__ == "__main__":
    main()
