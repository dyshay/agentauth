from __future__ import annotations

import pytest

from xagentauth.crypto import (
    from_hex,
    generate_id,
    generate_session_token,
    hmac_sha256_hex,
    hmac_sha256_hex_async,
    random_bytes,
    sha256_hex,
    sha256_hex_sync,
    timing_safe_equal,
    to_hex,
)


def test_random_bytes_length():
    data = random_bytes(32)
    assert len(data) == 32
    data2 = random_bytes(16)
    assert len(data2) == 16


def test_to_hex_from_hex_roundtrip():
    original = random_bytes(16)
    hex_str = to_hex(original)
    assert len(hex_str) == 32
    assert from_hex(hex_str) == original


def test_to_hex_known_value():
    data = bytes([0x00, 0xFF, 0x0A, 0x10])
    assert to_hex(data) == "00ff0a10"


@pytest.mark.asyncio
async def test_sha256_hex():
    result = await sha256_hex(b"hello")
    assert result == "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"


def test_sha256_hex_sync():
    result = sha256_hex_sync(b"hello")
    assert result == "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"


def test_generate_id_format():
    id_ = generate_id()
    assert id_.startswith("ch_")
    assert len(id_) == 3 + 32  # "ch_" + 32 hex chars


def test_generate_session_token_format():
    token = generate_session_token()
    assert token.startswith("st_")
    assert len(token) == 3 + 48  # "st_" + 48 hex chars


def test_timing_safe_equal():
    assert timing_safe_equal("abc", "abc") is True
    assert timing_safe_equal("abc", "abd") is False
    assert timing_safe_equal("abc", "ab") is False
