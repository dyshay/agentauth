from __future__ import annotations

import pytest

from xagentauth.challenges.code_execution import CodeExecutionDriver


@pytest.mark.asyncio
async def test_generate_easy():
    driver = CodeExecutionDriver()
    payload = await driver.generate("easy")
    assert payload.type == "code-execution"
    assert payload.steps >= 1
    assert "bug" in payload.instructions.lower() or "Code" in payload.instructions


@pytest.mark.asyncio
async def test_generate_hard():
    driver = CodeExecutionDriver()
    payload = await driver.generate("hard")
    assert payload.steps >= 1


@pytest.mark.asyncio
async def test_solve_returns_correct_output():
    driver = CodeExecutionDriver()
    payload = await driver.generate("easy")
    answer = await driver.solve(payload)
    assert isinstance(answer, str)
    assert len(answer) > 0


@pytest.mark.asyncio
async def test_verify_correct_answer():
    driver = CodeExecutionDriver()
    payload = await driver.generate("medium")
    answer = await driver.solve(payload)
    answer_hash = await driver.compute_answer_hash(payload)
    assert await driver.verify(answer_hash, answer) is True
    assert await driver.verify(answer_hash, "wrong_answer") is False
