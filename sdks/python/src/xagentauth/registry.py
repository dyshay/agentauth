from __future__ import annotations

from typing import Any, Optional


class ChallengeRegistry:
    """Registry of challenge drivers, with selection by dimension coverage."""

    def __init__(self) -> None:
        self._drivers: dict[str, Any] = {}  # name -> ChallengeDriver

    def register(self, driver: Any) -> None:
        if driver.name in self._drivers:
            raise ValueError(f'Driver "{driver.name}" is already registered')
        self._drivers[driver.name] = driver

    def get(self, name: str) -> Any | None:
        return self._drivers.get(name)

    def list(self) -> list[Any]:
        return list(self._drivers.values())

    def select(
        self,
        dimensions: Optional[list[str]] = None,
        count: int = 1,
    ) -> list[Any]:
        all_drivers = self.list()
        if len(all_drivers) == 0:
            raise ValueError("No challenge drivers registered")

        dims = dimensions or []

        if len(dims) == 0:
            return all_drivers[:count]

        scored = []
        for driver in all_drivers:
            coverage = sum(1 for d in driver.dimensions if d in dims)
            scored.append((coverage, driver))

        scored.sort(key=lambda x: x[0], reverse=True)
        return [s[1] for s in scored[:count]]
