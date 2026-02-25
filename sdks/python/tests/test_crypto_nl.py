from __future__ import annotations

import pytest

from xagentauth.challenges.crypto_nl import CryptoNLDriver, _apply_op, _execute_ops, ByteOperation


@pytest.mark.asyncio
async def test_generate_easy():
    driver = CryptoNLDriver()
    payload = await driver.generate("easy")
    assert payload.type == "crypto-nl"
    assert payload.steps == 1
    assert payload.data  # base64 encoded
    assert "Step 1:" in payload.instructions


@pytest.mark.asyncio
async def test_generate_hard():
    driver = CryptoNLDriver()
    payload = await driver.generate("hard")
    assert payload.steps == 4


@pytest.mark.asyncio
async def test_solve_and_verify():
    driver = CryptoNLDriver()
    payload = await driver.generate("easy")
    answer = await driver.solve(payload)
    assert isinstance(answer, str)
    assert len(answer) == 64  # SHA-256 hex

    answer_hash = await driver.compute_answer_hash(payload)
    assert await driver.verify(answer_hash, answer) is True
    assert await driver.verify(answer_hash, "wrong") is False


@pytest.mark.asyncio
async def test_apply_op_xor():
    data = bytes([0x00, 0xFF, 0x0A])
    op = ByteOperation(op="xor", params={"key": 0xFF})
    result = await _apply_op(data, op)
    assert result == bytes([0xFF, 0x00, 0xF5])


@pytest.mark.asyncio
async def test_apply_op_reverse():
    data = bytes([1, 2, 3, 4])
    op = ByteOperation(op="reverse", params={})
    result = await _apply_op(data, op)
    assert result == bytes([4, 3, 2, 1])
