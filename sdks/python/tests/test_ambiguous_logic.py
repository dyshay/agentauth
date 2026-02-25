from __future__ import annotations

import pytest

from xagentauth.challenges.ambiguous_logic import AmbiguousLogicDriver


@pytest.mark.asyncio
async def test_generate_easy():
    driver = AmbiguousLogicDriver()
    payload = await driver.generate("easy")
    assert payload.type == "ambiguous-logic"
    assert payload.steps == 1


@pytest.mark.asyncio
async def test_generate_hard():
    driver = AmbiguousLogicDriver()
    payload = await driver.generate("hard")
    assert payload.steps == 2


@pytest.mark.asyncio
async def test_solve_returns_primary_answer():
    driver = AmbiguousLogicDriver()
    payload = await driver.generate("easy")
    answer = await driver.solve(payload)
    assert isinstance(answer, str)
    assert len(answer) > 0
    # Should be a hex string
    int(answer, 16)  # Should not raise


@pytest.mark.asyncio
async def test_verify_correct():
    driver = AmbiguousLogicDriver()
    payload = await driver.generate("medium")
    answer = await driver.solve(payload)
    answer_hash = await driver.compute_answer_hash(payload)
    assert await driver.verify(answer_hash, answer) is True
    assert await driver.verify(answer_hash, "wrong") is False
