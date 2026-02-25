import hashlib
import hmac as _hmac


def hmac_sha256_hex(message: str, secret: str) -> str:
    return _hmac.new(
        secret.encode("utf-8"),
        message.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
