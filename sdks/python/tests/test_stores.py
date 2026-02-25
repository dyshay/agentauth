from __future__ import annotations

import time

import pytest

from xagentauth.stores.memory import MemoryStore
from xagentauth.types import (
    Challenge,
    ChallengeData,
    ChallengePayload,
    Difficulty,
)


def _make_challenge_data(id_: str = "ch_test") -> ChallengeData:
    return ChallengeData(
        challenge=Challenge(
            id=id_,
            session_token="st_test",
            payload=ChallengePayload(
                type="test",
                instructions="do something",
                data="dGVzdA==",
                steps=1,
            ),
            difficulty=Difficulty.MEDIUM,
            dimensions=["reasoning"],
            created_at=int(time.time()),
            expires_at=int(time.time()) + 30,
        ),
        answer_hash="abc123",
        attempts=0,
        max_attempts=3,
        created_at=int(time.time()),
    )


@pytest.mark.asyncio
async def test_set_and_get():
    store = MemoryStore()
    data = _make_challenge_data()
    await store.set("ch_1", data, 30)
    result = await store.get("ch_1")
    assert result is not None
    assert result.answer_hash == "abc123"


@pytest.mark.asyncio
async def test_get_nonexistent():
    store = MemoryStore()
    result = await store.get("ch_missing")
    assert result is None


@pytest.mark.asyncio
async def test_delete():
    store = MemoryStore()
    data = _make_challenge_data()
    await store.set("ch_1", data, 30)
    await store.delete("ch_1")
    result = await store.get("ch_1")
    assert result is None


@pytest.mark.asyncio
async def test_ttl_expiration():
    store = MemoryStore()
    data = _make_challenge_data()
    await store.set("ch_1", data, 0)  # TTL of 0 seconds (already expired)
    # Sleep briefly to ensure time has passed
    time.sleep(0.01)
    result = await store.get("ch_1")
    assert result is None
