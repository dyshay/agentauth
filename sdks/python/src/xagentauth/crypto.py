from __future__ import annotations

import hashlib
import hmac as _hmac
import secrets


def random_bytes(length: int) -> bytes:
    """Generate cryptographically secure random bytes."""
    return secrets.token_bytes(length)


def to_hex(data: bytes) -> str:
    """Convert bytes to a lowercase hex string."""
    return data.hex()


def from_hex(hex_str: str) -> bytes:
    """Convert a hex string to bytes."""
    return bytes.fromhex(hex_str)


async def sha256_hex(data: bytes) -> str:
    """Compute the SHA-256 hex digest of raw bytes (async for API consistency)."""
    return hashlib.sha256(data).hexdigest()


def sha256_hex_sync(data: bytes) -> str:
    """Compute the SHA-256 hex digest of raw bytes (sync version)."""
    return hashlib.sha256(data).hexdigest()


def hmac_sha256_hex(message: str, secret: str) -> str:
    """Compute HMAC-SHA256 hex digest (sync version, kept for backward compat)."""
    return _hmac.new(
        secret.encode("utf-8"),
        message.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


async def hmac_sha256_hex_async(message: str, secret: str) -> str:
    """Compute HMAC-SHA256 hex digest (async version for engine)."""
    return _hmac.new(
        secret.encode("utf-8"),
        message.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def hmac_sha256_bytes(key: bytes, message: bytes) -> bytes:
    """Compute HMAC-SHA256 of raw bytes, returning raw bytes."""
    return _hmac.new(key, message, hashlib.sha256).digest()


def generate_id() -> str:
    """Generate a challenge ID like 'ch_<32 hex chars>'."""
    return "ch_" + secrets.token_hex(16)


def generate_session_token() -> str:
    """Generate a session token like 'st_<48 hex chars>'."""
    return "st_" + secrets.token_hex(24)


def timing_safe_equal(a: str, b: str) -> bool:
    """Constant-time string comparison."""
    return _hmac.compare_digest(a, b)
