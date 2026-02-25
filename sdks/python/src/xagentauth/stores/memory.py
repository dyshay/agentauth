from __future__ import annotations

import time
from dataclasses import dataclass

from xagentauth.types import ChallengeData


@dataclass
class _Entry:
    data: ChallengeData
    expires_at: float


class MemoryStore:
    """In-memory challenge store with TTL-based expiration."""

    def __init__(self) -> None:
        self._store: dict[str, _Entry] = {}

    async def set(self, id: str, data: ChallengeData, ttl_seconds: int) -> None:
        self._store[id] = _Entry(
            data=data,
            expires_at=time.time() + ttl_seconds,
        )

    async def get(self, id: str) -> ChallengeData | None:
        entry = self._store.get(id)
        if entry is None:
            return None
        if time.time() >= entry.expires_at:
            del self._store[id]
            return None
        return entry.data

    async def delete(self, id: str) -> None:
        self._store.pop(id, None)
