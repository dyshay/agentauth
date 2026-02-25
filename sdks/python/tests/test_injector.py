from __future__ import annotations

import pytest

from xagentauth.pomi.catalog import CanaryCatalog
from xagentauth.pomi.injector import CanaryInjector
from xagentauth.types import ChallengePayload


def _make_payload() -> ChallengePayload:
    return ChallengePayload(
        type="test",
        instructions="Original instructions",
        data="dGVzdA==",
        steps=1,
    )


def test_inject_zero_returns_unchanged():
    catalog = CanaryCatalog()
    injector = CanaryInjector(catalog)
    payload = _make_payload()
    result = injector.inject(payload, 0)
    assert result.payload.instructions == "Original instructions"
    assert len(result.injected) == 0


def test_inject_adds_canaries():
    catalog = CanaryCatalog()
    injector = CanaryInjector(catalog)
    payload = _make_payload()
    result = injector.inject(payload, 2)
    assert len(result.injected) == 2
    assert "canary_responses" in result.payload.instructions
    assert result.payload.context is not None
    assert "canary_ids" in result.payload.context


def test_inject_preserves_original_instructions():
    catalog = CanaryCatalog()
    injector = CanaryInjector(catalog)
    payload = _make_payload()
    result = injector.inject(payload, 1)
    assert "Original instructions" in result.payload.instructions
