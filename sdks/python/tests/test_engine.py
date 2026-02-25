from __future__ import annotations

import time

import pytest

from xagentauth.challenges.crypto_nl import CryptoNLDriver
from xagentauth.crypto import hmac_sha256_hex
from xagentauth.engine import AgentAuthEngine
from xagentauth.stores.memory import MemoryStore
from xagentauth.types import (
    AgentAuthConfig,
    Difficulty,
    InitChallengeOptions,
    SolveInput,
)


def _make_engine(**kwargs) -> AgentAuthEngine:
    config = AgentAuthConfig(
        secret="test-secret",
        store=MemoryStore(),
        drivers=[CryptoNLDriver()],
        challenge_ttl_seconds=30,
        token_ttl_seconds=3600,
        **kwargs,
    )
    return AgentAuthEngine(config)


@pytest.mark.asyncio
async def test_init_challenge():
    engine = _make_engine()
    result = await engine.init_challenge()
    assert result.id.startswith("ch_")
    assert result.session_token.startswith("st_")
    assert result.ttl_seconds == 30
    assert result.expires_at > int(time.time())


@pytest.mark.asyncio
async def test_get_challenge():
    engine = _make_engine()
    init = await engine.init_challenge()
    challenge = await engine.get_challenge(init.id, init.session_token)
    assert challenge is not None
    assert challenge["id"] == init.id
    assert "context" not in challenge["payload"]


@pytest.mark.asyncio
async def test_get_challenge_wrong_token():
    engine = _make_engine()
    init = await engine.init_challenge()
    challenge = await engine.get_challenge(init.id, "wrong_token")
    assert challenge is None


@pytest.mark.asyncio
async def test_solve_challenge_correct():
    engine = _make_engine()
    init = await engine.init_challenge(InitChallengeOptions(difficulty=Difficulty.EASY))

    # Get the raw challenge data to solve it
    data = await engine._store.get(init.id)
    assert data is not None

    # Find the driver and solve it
    driver = CryptoNLDriver()
    answer = await driver.solve(data.challenge.payload)

    # Generate HMAC
    mac = hmac_sha256_hex(answer, init.session_token)

    result = await engine.solve_challenge(
        init.id,
        SolveInput(answer=answer, hmac=mac),
    )
    assert result.success is True
    assert result.token is not None
    assert result.score.reasoning == 0.9


@pytest.mark.asyncio
async def test_solve_challenge_wrong_answer():
    engine = _make_engine()
    init = await engine.init_challenge()

    mac = hmac_sha256_hex("wrong", init.session_token)
    result = await engine.solve_challenge(
        init.id,
        SolveInput(answer="wrong", hmac=mac),
    )
    assert result.success is False
    assert result.reason == "wrong_answer"


@pytest.mark.asyncio
async def test_solve_challenge_invalid_hmac():
    engine = _make_engine()
    init = await engine.init_challenge()

    result = await engine.solve_challenge(
        init.id,
        SolveInput(answer="test", hmac="invalid_hmac"),
    )
    assert result.success is False
    assert result.reason == "invalid_hmac"


@pytest.mark.asyncio
async def test_solve_challenge_expired():
    engine = _make_engine()
    result = await engine.solve_challenge(
        "ch_nonexistent",
        SolveInput(answer="test", hmac="test"),
    )
    assert result.success is False
    assert result.reason == "expired"


@pytest.mark.asyncio
async def test_verify_token():
    engine = _make_engine()
    init = await engine.init_challenge(InitChallengeOptions(difficulty=Difficulty.EASY))

    data = await engine._store.get(init.id)
    driver = CryptoNLDriver()
    answer = await driver.solve(data.challenge.payload)
    mac = hmac_sha256_hex(answer, init.session_token)

    solve_result = await engine.solve_challenge(
        init.id,
        SolveInput(answer=answer, hmac=mac),
    )
    assert solve_result.token is not None

    verify_result = await engine.verify_token(solve_result.token)
    assert verify_result.valid is True
    assert verify_result.capabilities is not None
    assert verify_result.model_family == "unknown"
