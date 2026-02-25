from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from xagentauth.pomi.catalog import CanaryCatalog, CatalogSelectOptions
from xagentauth.types import Canary, ChallengePayload


@dataclass
class InjectionResult:
    payload: ChallengePayload
    injected: list[Canary]


class CanaryInjector:
    """Injects canary probes into challenge payloads."""

    def __init__(self, catalog: CanaryCatalog) -> None:
        self._catalog = catalog

    def inject(
        self,
        payload: ChallengePayload,
        count: int,
        exclude: Optional[list[str]] = None,
    ) -> InjectionResult:
        if count <= 0:
            return InjectionResult(
                payload=payload.model_copy(),
                injected=[],
            )

        options = CatalogSelectOptions(exclude=exclude) if exclude else None
        selected = self._catalog.select(count, options)
        if len(selected) == 0:
            return InjectionResult(
                payload=payload.model_copy(),
                injected=[],
            )

        # Group canaries by injection method
        prefix_canaries = [c for c in selected if c.injection_method == "prefix"]
        inline_canaries = [c for c in selected if c.injection_method == "inline"]
        suffix_canaries = [c for c in selected if c.injection_method == "suffix"]
        embedded_canaries = [c for c in selected if c.injection_method == "embedded"]

        instructions = payload.instructions

        # Prefix: add before main instructions
        if prefix_canaries:
            prefix_text = "\n".join(f"- {c.id}: {c.prompt}" for c in prefix_canaries)
            instructions = (
                f"Before starting, answer these briefly (include in canary_responses):\n"
                f"{prefix_text}\n\n{instructions}"
            )

        # Inline & Suffix & Embedded: add as "Side tasks" after main instructions
        side_task_canaries = inline_canaries + suffix_canaries + embedded_canaries
        if side_task_canaries:
            side_text = "\n".join(f"- {c.id}: {c.prompt}" for c in side_task_canaries)
            instructions = (
                f"{instructions}\n\n"
                f"Also, complete these side tasks (include answers in canary_responses field):\n"
                f"{side_text}"
            )

        new_context = dict(payload.context or {})
        new_context["canary_ids"] = [c.id for c in selected]

        new_payload = ChallengePayload(
            type=payload.type,
            instructions=instructions,
            data=payload.data,
            steps=payload.steps,
            context=new_context,
        )

        return InjectionResult(payload=new_payload, injected=selected)
