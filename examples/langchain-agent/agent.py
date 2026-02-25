"""
AgentAuth + LangChain Example

Demonstrates an AI agent that automatically authenticates
via AgentAuth when accessing protected API endpoints.

Uses raw httpx calls (no SDK required).
"""

import os
import hmac
import hashlib

import httpx
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate

BASE_URL = os.getenv("AGENTAUTH_URL", "http://localhost:3000")


def compute_hmac(answer: str, session_token: str) -> str:
    return hmac.new(
        session_token.encode(), answer.encode(), hashlib.sha256
    ).hexdigest()


def main():
    client = httpx.Client(base_url=BASE_URL, timeout=30)

    # --- Authenticate the agent ---
    print("Authenticating agent via AgentAuth...\n")

    # Step 1: Init challenge
    init_res = client.post("/v1/challenge/init", json={"difficulty": "easy"})
    init_res.raise_for_status()
    init = init_res.json()
    print(f"  Challenge ID:    {init['id']}")
    print(f"  Session token:   {init['session_token'][:20]}...")
    print(f"  TTL:             {init['ttl_seconds']}s\n")

    # Step 2: Retrieve challenge
    challenge_res = client.get(
        f"/v1/challenge/{init['id']}",
        headers={"Authorization": f"Bearer {init['session_token']}"},
    )
    challenge_res.raise_for_status()
    challenge = challenge_res.json()
    print(f"  Type:            {challenge['payload']['type']}")
    print(f"  Instructions:    {challenge['payload']['instructions']}")
    print(f"  Steps:           {challenge['payload']['steps']}\n")

    # Step 3: Use the LLM to solve the challenge
    llm = ChatOpenAI(model="gpt-4o", temperature=0)
    response = llm.invoke(
        f"Solve this challenge and return ONLY the answer, nothing else:\n\n"
        f"Instructions: {challenge['payload']['instructions']}\n"
        f"Data: {challenge['payload']['data']}"
    )
    answer = response.content.strip()
    print(f"  LLM answer:      {answer}\n")

    # Step 4: Submit solution with HMAC
    answer_hmac = compute_hmac(answer, init["session_token"])
    solve_res = client.post(
        f"/v1/challenge/{init['id']}/solve",
        json={
            "answer": answer,
            "hmac": answer_hmac,
            "metadata": {"model": "gpt-4o", "framework": "langchain"},
        },
    )
    solve_res.raise_for_status()
    result = solve_res.json()

    if result.get("success"):
        token = result["token"]
        score = result["score"]
        print(f"  Authenticated!")
        print(f"  Token:           {token[:50]}...")
        print(f"  Score:           {score}\n")

        # --- Use the token to access protected APIs ---
        print("Accessing protected endpoint...\n")
        data_res = client.get(
            "/api/data",
            headers={"Authorization": f"Bearer {token}"},
        )
        if data_res.status_code == 200:
            print(f"  Response:        {data_res.json()}")
        else:
            print(f"  Protected endpoint returned {data_res.status_code}")
    else:
        print(f"  Failed: {result.get('reason', 'unknown')}")

    client.close()


if __name__ == "__main__":
    main()
