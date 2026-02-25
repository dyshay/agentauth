from xagentauth.crypto import hmac_sha256_hex


def test_hmac_produces_hex():
    result = hmac_sha256_hex("hello", "secret-key")
    assert len(result) == 64
    assert all(c in "0123456789abcdef" for c in result)


def test_hmac_deterministic():
    a = hmac_sha256_hex("message", "key")
    b = hmac_sha256_hex("message", "key")
    assert a == b


def test_hmac_different_keys():
    a = hmac_sha256_hex("message", "key1")
    b = hmac_sha256_hex("message", "key2")
    assert a != b
