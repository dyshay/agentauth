from __future__ import annotations

import pytest

from xagentauth.challenges.multi_step import MultiStepDriver


@pytest.mark.asyncio
async def test_generate_easy():
    driver = MultiStepDriver()
    payload = await driver.generate("easy")
    assert payload.type == "multi-step"
    assert payload.steps == 3  # easy has 3 compute steps
    assert "Step 1:" in payload.instructions


@pytest.mark.asyncio
async def test_generate_medium():
    driver = MultiStepDriver()
    payload = await driver.generate("medium")
    assert payload.steps == 4  # 3 compute + 1 memory_recall


@pytest.mark.asyncio
async def test_solve_and_verify():
    driver = MultiStepDriver()
    payload = await driver.generate("easy")
    answer = await driver.solve(payload)
    assert isinstance(answer, str)
    assert len(answer) == 64  # SHA-256 hex

    answer_hash = await driver.compute_answer_hash(payload)
    assert await driver.verify(answer_hash, answer) is True


@pytest.mark.asyncio
async def test_verify_rejects_wrong():
    driver = MultiStepDriver()
    payload = await driver.generate("easy")
    answer_hash = await driver.compute_answer_hash(payload)
    assert await driver.verify(answer_hash, "wrong") is False
