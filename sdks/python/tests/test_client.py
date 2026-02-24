import pytest
from pytest_httpx import HTTPXMock

from agentauth import AgentAuthClient, AgentAuthError, SolverResult


@pytest.fixture
def client():
    return AgentAuthClient(base_url="https://api.test.com")


@pytest.mark.asyncio
async def test_init_challenge(client: AgentAuthClient, httpx_mock: HTTPXMock):
    httpx_mock.add_response(
        url="https://api.test.com/v1/challenge/init",
        method="POST",
        json={"id": "ch_test123", "session_token": "st_token456", "expires_at": 1708784400, "ttl_seconds": 30},
        status_code=201,
    )
    result = await client.init_challenge()
    assert result.id == "ch_test123"
    assert result.session_token == "st_token456"


@pytest.mark.asyncio
async def test_get_challenge(client: AgentAuthClient, httpx_mock: HTTPXMock):
    httpx_mock.add_response(
        url="https://api.test.com/v1/challenge/ch_test123",
        method="GET",
        json={
            "id": "ch_test123",
            "payload": {"type": "crypto-nl", "instructions": "XOR each byte", "data": "AQID", "steps": 1},
            "difficulty": "easy",
            "dimensions": ["reasoning", "execution"],
            "created_at": 1708784000,
            "expires_at": 1708784400,
        },
    )
    result = await client.get_challenge("ch_test123", "st_token")
    assert result.id == "ch_test123"
    assert result.payload.type == "crypto-nl"


@pytest.mark.asyncio
async def test_solve(client: AgentAuthClient, httpx_mock: HTTPXMock):
    httpx_mock.add_response(
        url="https://api.test.com/v1/challenge/ch_test123/solve",
        method="POST",
        json={
            "success": False,
            "score": {"reasoning": 0, "execution": 0, "autonomy": 0, "speed": 0, "consistency": 0},
            "reason": "wrong_answer",
        },
    )
    result = await client.solve("ch_test123", "wrong", "st_token")
    assert not result.success
    assert result.reason == "wrong_answer"


@pytest.mark.asyncio
async def test_http_error(client: AgentAuthClient, httpx_mock: HTTPXMock):
    httpx_mock.add_response(
        url="https://api.test.com/v1/challenge/init",
        method="POST",
        json={"detail": "Internal Error", "status": 500},
        status_code=500,
    )
    with pytest.raises(AgentAuthError) as exc:
        await client.init_challenge()
    assert exc.value.status == 500


@pytest.mark.asyncio
async def test_authenticate(client: AgentAuthClient, httpx_mock: HTTPXMock):
    httpx_mock.add_response(
        url="https://api.test.com/v1/challenge/init", method="POST",
        json={"id": "ch_1", "session_token": "st_1", "expires_at": 9999999999, "ttl_seconds": 30},
        status_code=201,
    )
    httpx_mock.add_response(
        url="https://api.test.com/v1/challenge/ch_1", method="GET",
        json={
            "id": "ch_1",
            "payload": {"type": "crypto-nl", "instructions": "test", "data": "AA==", "steps": 1},
            "difficulty": "easy", "dimensions": ["reasoning"],
            "created_at": 1000, "expires_at": 2000,
        },
    )
    httpx_mock.add_response(
        url="https://api.test.com/v1/challenge/ch_1/solve", method="POST",
        json={
            "success": True,
            "score": {"reasoning": 0.9, "execution": 0.9, "autonomy": 0.9, "speed": 0.9, "consistency": 0.9},
            "token": "jwt.token.here",
        },
    )

    async def solver(challenge):
        return SolverResult(answer="test-answer")

    result = await client.authenticate(solver=solver)
    assert result.success
    assert result.token == "jwt.token.here"
