from __future__ import annotations

import base64
import math
import random
from dataclasses import dataclass
from typing import Any

from xagentauth.crypto import (
    from_hex,
    random_bytes,
    sha256_hex,
    timing_safe_equal,
    to_hex,
)
from xagentauth.types import ChallengePayload, Difficulty


# ---------------------------------------------------------------------------
# Types
# ---------------------------------------------------------------------------


@dataclass
class AcceptableAnswer:
    answer: str  # hex-encoded result
    score: float  # 0-1, 1.0 = primary answer


@dataclass
class ScoredAnswerHash:
    answer_hash: str
    score: float


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _pick_random(arr: list[Any]) -> Any:
    return arr[math.floor(random.random() * len(arr))]


def _xor_bytes(data: bytes, key: int) -> bytes:
    return bytes(b ^ (key & 0xFF) for b in data)


def _sort_ascending(data: bytes) -> bytes:
    return bytes(sorted(data))


def _reverse_bytes(data: bytes) -> bytes:
    return data[::-1]


# ---------------------------------------------------------------------------
# Templates
# ---------------------------------------------------------------------------


class AmbiguousTemplate:
    def __init__(self, name: str, generate_fn: Any) -> None:
        self.name = name
        self._generate_fn = generate_fn

    def generate(self, data: bytes, difficulty: str) -> tuple[str, list[AcceptableAnswer]]:
        return self._generate_fn(data, difficulty)


# --- lucky-number ---


def _lucky_number_generate(data: bytes, difficulty: str) -> tuple[str, list[AcceptableAnswer]]:
    byte_count = len(data)

    # Primary: 7 is "the" lucky number
    is_lucky_7 = byte_count == 7
    primary_result = _xor_bytes(data, 7) if is_lucky_7 else _xor_bytes(data, 13)

    alternatives: list[AcceptableAnswer] = [
        AcceptableAnswer(answer=to_hex(primary_result), score=1.0),
    ]

    alt_lucky_numbers = [3, 8, 13]
    alt_scores: dict[int, float] = {3: 0.6, 8: 0.6, 13: 0.7}

    if difficulty != "easy":
        for lucky in alt_lucky_numbers:
            is_lucky = byte_count == lucky
            alt_result = _xor_bytes(data, 7) if is_lucky else _xor_bytes(data, 13)
            alt_hex = to_hex(alt_result)
            if alt_hex != alternatives[0].answer:
                alternatives.append(AcceptableAnswer(answer=alt_hex, score=alt_scores[lucky]))

    phrasings = [
        f"You are given {byte_count} bytes of data (base64-encoded).\n"
        f"If the number of bytes is a lucky number, XOR each byte with 7.\n"
        f"Otherwise, XOR each byte with 13.\n"
        f"Return the hex-encoded result.",
        f"The data below contains {byte_count} bytes.\n"
        f"When the byte count is lucky, apply XOR 7 to every byte.\n"
        f"When unlucky, apply XOR 13 instead.\n"
        f"Provide your answer as a hex string.",
    ]

    return _pick_random(phrasings), alternatives


LUCKY_NUMBER_TEMPLATE = AmbiguousTemplate(name="lucky-number", generate_fn=_lucky_number_generate)


# --- famous-constant ---


def _famous_constant_generate(data: bytes, difficulty: str) -> tuple[str, list[AcceptableAnswer]]:
    # Primary: pi -> "3.1" -> 31
    pi_result = _xor_bytes(data, 31)
    # Alternative: e -> "2.7" -> 27
    e_result = _xor_bytes(data, 27)
    # Alternative: phi -> "1.6" -> 16
    phi_result = _xor_bytes(data, 16)

    alternatives: list[AcceptableAnswer] = [
        AcceptableAnswer(answer=to_hex(pi_result), score=1.0),
        AcceptableAnswer(answer=to_hex(e_result), score=0.8),
        AcceptableAnswer(answer=to_hex(phi_result), score=0.6),
    ]

    phrasings = [
        "XOR each byte of the provided data with the most famous mathematical constant's first two digits as an integer.\n"
        "Return the hex-encoded result.",
        "Take the universally recognized mathematical constant, extract its first two digits as a whole number, "
        "and XOR every byte of the data with that number.\n"
        "Provide the hex-encoded output.",
    ]

    return _pick_random(phrasings), alternatives


FAMOUS_CONSTANT_TEMPLATE = AmbiguousTemplate(name="famous-constant", generate_fn=_famous_constant_generate)


# --- big-small ---


def _big_small_generate(data: bytes, difficulty: str) -> tuple[str, list[AcceptableAnswer]]:
    first_byte = data[0]

    # Primary: "big" means > 127
    primary_127 = _reverse_bytes(data) if first_byte > 127 else _sort_ascending(data)

    # Alternative: "big" means > 100
    alt_100 = _reverse_bytes(data) if first_byte > 100 else _sort_ascending(data)

    # Alternative: "big" means > 200
    alt_200 = _reverse_bytes(data) if first_byte > 200 else _sort_ascending(data)

    alternatives: list[AcceptableAnswer] = [
        AcceptableAnswer(answer=to_hex(primary_127), score=1.0),
    ]

    alt_100_hex = to_hex(alt_100)
    alt_200_hex = to_hex(alt_200)

    if alt_100_hex != alternatives[0].answer:
        alternatives.append(AcceptableAnswer(answer=alt_100_hex, score=0.8))
    if alt_200_hex != alternatives[0].answer and alt_200_hex != alt_100_hex:
        alternatives.append(AcceptableAnswer(answer=alt_200_hex, score=0.7))

    phrasings = [
        "If the first byte of the data is big, reverse the entire byte array.\n"
        "Otherwise, sort all bytes in ascending order.\n"
        "Return the hex-encoded result.",
        "Examine the first byte. If it is a big value, flip the array end-to-end.\n"
        "If it is small, arrange bytes from lowest to highest.\n"
        "Provide the hex-encoded output.",
    ]

    return _pick_random(phrasings), alternatives


BIG_SMALL_TEMPLATE = AmbiguousTemplate(name="big-small", generate_fn=_big_small_generate)


# ---------------------------------------------------------------------------
# All templates
# ---------------------------------------------------------------------------

ALL_TEMPLATES: list[AmbiguousTemplate] = [
    LUCKY_NUMBER_TEMPLATE,
    FAMOUS_CONSTANT_TEMPLATE,
    BIG_SMALL_TEMPLATE,
]

DIFFICULTY_CONFIG: dict[str, dict[str, int]] = {
    "easy": {"dataSize": 8, "templateCount": 1},
    "medium": {"dataSize": 16, "templateCount": 1},
    "hard": {"dataSize": 32, "templateCount": 2},
    "adversarial": {"dataSize": 64, "templateCount": 3},
}


# ---------------------------------------------------------------------------
# Driver
# ---------------------------------------------------------------------------


class AmbiguousLogicDriver:
    name = "ambiguous-logic"
    dimensions = ("reasoning", "ambiguity")
    estimated_human_time_ms = 45_000
    estimated_ai_time_ms = 1_000

    async def generate(self, difficulty: Difficulty | str) -> ChallengePayload:
        diff_str = difficulty.value if isinstance(difficulty, Difficulty) else difficulty
        config = DIFFICULTY_CONFIG[diff_str]
        data = random_bytes(config["dataSize"])

        selected_templates = self._select_templates(config["templateCount"])

        if len(selected_templates) == 1:
            return await self._generate_single(selected_templates[0], data, diff_str)

        return await self._generate_chained(selected_templates, data, diff_str)

    async def solve(self, payload: ChallengePayload) -> str:
        ctx = payload.context or {}
        return ctx["primaryAnswer"]

    async def compute_answer_hash(self, payload: ChallengePayload) -> str:
        answer = await self.solve(payload)
        return await sha256_hex(answer.encode("utf-8"))

    async def verify(self, answer_hash: str, submitted_answer: Any) -> bool:
        if not isinstance(submitted_answer, str):
            return False
        submitted_hash = await sha256_hex(submitted_answer.encode("utf-8"))
        return timing_safe_equal(answer_hash, submitted_hash)

    # -------------------------------------------------------------------------
    # Private helpers
    # -------------------------------------------------------------------------

    def _select_templates(self, count: int) -> list[AmbiguousTemplate]:
        shuffled = list(ALL_TEMPLATES)
        shuffled.sort(key=lambda _: random.random() - 0.5)
        return shuffled[: min(count, len(shuffled))]

    async def _generate_single(
        self,
        template: AmbiguousTemplate,
        data: bytes,
        difficulty: str,
    ) -> ChallengePayload:
        instructions, acceptable_answers = template.generate(data, difficulty)

        scored_answers = await self._hash_answers(acceptable_answers)

        return ChallengePayload(
            type="ambiguous-logic",
            instructions=instructions,
            data=base64.b64encode(data).decode("ascii"),
            steps=1,
            context={
                "templateName": template.name,
                "primaryAnswer": acceptable_answers[0].answer,
                "scoredAnswers": [{"answerHash": s.answer_hash, "score": s.score} for s in scored_answers],
            },
        )

    async def _generate_chained(
        self,
        templates: list[AmbiguousTemplate],
        data: bytes,
        difficulty: str,
    ) -> ChallengePayload:
        current_data = data
        instruction_parts: list[str] = []
        all_acceptable: list[AcceptableAnswer] = []

        for i, template in enumerate(templates):
            instructions, acceptable_answers = template.generate(current_data, difficulty)
            instruction_parts.append(f"--- Part {i + 1} ---\n{instructions}")

            if i == 0:
                all_acceptable = acceptable_answers
            else:
                chained: list[AcceptableAnswer] = []
                for prev in all_acceptable:
                    prev_data = from_hex(prev.answer)
                    _, chain_answers = template.generate(prev_data, difficulty)
                    for ans in chain_answers:
                        chained.append(
                            AcceptableAnswer(
                                answer=ans.answer,
                                score=prev.score * ans.score,
                            )
                        )
                all_acceptable = chained

            current_data = from_hex(all_acceptable[0].answer)

        # Deduplicate: keep highest-scoring version of each unique answer
        unique_map: dict[str, float] = {}
        for ans in all_acceptable:
            existing = unique_map.get(ans.answer)
            if existing is None or ans.score > existing:
                unique_map[ans.answer] = ans.score

        deduplicated = [
            AcceptableAnswer(answer=a, score=s) for a, s in sorted(unique_map.items(), key=lambda x: x[1], reverse=True)
        ]

        scored_answers = await self._hash_answers(deduplicated)

        full_instructions = (
            "This is a multi-part ambiguous logic challenge.\n"
            "Apply each part's transformation in order, using the output of the previous part as input for the next.\n\n"
            + "\n\n".join(instruction_parts)
        )

        return ChallengePayload(
            type="ambiguous-logic",
            instructions=full_instructions,
            data=base64.b64encode(data).decode("ascii"),
            steps=len(templates),
            context={
                "templateNames": [t.name for t in templates],
                "primaryAnswer": deduplicated[0].answer,
                "scoredAnswers": [{"answerHash": s.answer_hash, "score": s.score} for s in scored_answers],
            },
        )

    async def _hash_answers(
        self,
        answers: list[AcceptableAnswer],
    ) -> list[ScoredAnswerHash]:
        results: list[ScoredAnswerHash] = []
        for ans in answers:
            h = await sha256_hex(ans.answer.encode("utf-8"))
            results.append(ScoredAnswerHash(answer_hash=h, score=ans.score))
        return results
