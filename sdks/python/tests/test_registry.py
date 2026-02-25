from __future__ import annotations

import pytest

from xagentauth.registry import ChallengeRegistry


class _FakeDriver:
    def __init__(self, name: str, dimensions: tuple[str, ...]) -> None:
        self.name = name
        self.dimensions = dimensions
        self.estimated_human_time_ms = 1000
        self.estimated_ai_time_ms = 100


def test_register_and_get():
    reg = ChallengeRegistry()
    driver = _FakeDriver("test", ("reasoning",))
    reg.register(driver)
    assert reg.get("test") is driver


def test_register_duplicate_raises():
    reg = ChallengeRegistry()
    driver = _FakeDriver("test", ("reasoning",))
    reg.register(driver)
    with pytest.raises(ValueError, match="already registered"):
        reg.register(driver)


def test_list_drivers():
    reg = ChallengeRegistry()
    d1 = _FakeDriver("a", ("reasoning",))
    d2 = _FakeDriver("b", ("execution",))
    reg.register(d1)
    reg.register(d2)
    assert len(reg.list()) == 2


def test_select_no_drivers_raises():
    reg = ChallengeRegistry()
    with pytest.raises(ValueError, match="No challenge drivers"):
        reg.select()


def test_select_by_dimension():
    reg = ChallengeRegistry()
    d1 = _FakeDriver("a", ("reasoning", "execution"))
    d2 = _FakeDriver("b", ("memory",))
    reg.register(d1)
    reg.register(d2)
    selected = reg.select(dimensions=["execution"], count=1)
    assert len(selected) == 1
    assert selected[0].name == "a"
