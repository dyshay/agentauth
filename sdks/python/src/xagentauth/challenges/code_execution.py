from __future__ import annotations

import base64
import math
import random
from dataclasses import dataclass
from typing import Any

from xagentauth.crypto import (
    random_bytes,
    sha256_hex,
    timing_safe_equal,
    to_hex,
)
from xagentauth.types import ChallengePayload, Difficulty


# ---------------------------------------------------------------------------
# Utility helpers
# ---------------------------------------------------------------------------


def _pick_random(arr: list[Any]) -> Any:
    return arr[math.floor(random.random() * len(arr))]


def _random_int(min_val: int, max_val: int) -> int:
    return math.floor(random.random() * (max_val - min_val + 1)) + min_val


# ---------------------------------------------------------------------------
# Bug definitions
# ---------------------------------------------------------------------------


@dataclass
class BugDef:
    name: str
    description: str


BUG_OFF_BY_ONE = BugDef(name="off_by_one", description="Uses % 255 instead of % 256 in modulo operation")
BUG_WRONG_OPERATOR = BugDef(
    name="wrong_operator", description="Uses + (addition) instead of ^ (XOR) as the accumulator operator"
)
BUG_MISSING_STEP = BugDef(name="missing_step", description="Missing byte reversal between hash rounds")
BUG_WRONG_INIT = BugDef(name="wrong_init", description="Accumulator initialized to 1 instead of 0")
BUG_WRONG_PAD = BugDef(name="wrong_pad", description="padStart uses length 1 instead of 2 for hex encoding")
BUG_WRONG_SHIFT = BugDef(name="wrong_shift", description="Shift amount is 7 instead of 8 in bit shifting")


# ---------------------------------------------------------------------------
# Code templates
# ---------------------------------------------------------------------------


@dataclass
class TemplateInput:
    data: str  # base64-encoded
    params: dict[str, Any]


class CodeTemplate:
    def __init__(
        self,
        name: str,
        available_bugs: list[BugDef],
        generate_input_fn: Any,
        buggy_code_fn: Any,
        correct_output_fn: Any,
    ) -> None:
        self.name = name
        self.available_bugs = available_bugs
        self._generate_input_fn = generate_input_fn
        self._buggy_code_fn = buggy_code_fn
        self._correct_output_fn = correct_output_fn

    def generate_input(self) -> TemplateInput:
        return self._generate_input_fn()

    def buggy_code(self, input: TemplateInput, active_bugs: list[BugDef]) -> str:
        return self._buggy_code_fn(input, active_bugs)

    async def correct_output(self, input: TemplateInput) -> str:
        return await self._correct_output_fn(input)


# ---------------------------------------------------------------------------
# Template 1: Byte Transform
# ---------------------------------------------------------------------------


def _byte_transform_gen_input() -> TemplateInput:
    size = _random_int(8, 16)
    data = random_bytes(size)
    return TemplateInput(data=base64.b64encode(data).decode("ascii"), params={})


def _byte_transform_buggy_code(input: TemplateInput, active_bugs: list[BugDef]) -> str:
    has_off_by_one = any(b.name == "off_by_one" for b in active_bugs)
    has_wrong_shift = any(b.name == "wrong_shift" for b in active_bugs)
    mod = "255" if has_off_by_one else "256"
    multiplier = "((i + 1) << 7)" if has_wrong_shift else "(i + 1)"

    return "\n".join(
        [
            "function transform(data) {",
            "  // data is a Uint8Array",
            "  const result = [];",
            "  for (let i = 0; i < data.length; i++) {",
            f"    result.push((data[i] * {multiplier}) % {mod});",
            "  }",
            "  // Return the SHA-256 hex digest of the resulting byte array",
            "  return sha256hex(Uint8Array.from(result));",
            "}",
        ]
    )


async def _byte_transform_correct_output(input: TemplateInput) -> str:
    data = base64.b64decode(input.data)
    result: list[int] = []
    for i in range(len(data)):
        result.append((data[i] * (i + 1)) % 256)
    return await sha256_hex(bytes(result))


BYTE_TRANSFORM_TEMPLATE = CodeTemplate(
    name="byte_transform",
    available_bugs=[BUG_OFF_BY_ONE, BUG_WRONG_SHIFT],
    generate_input_fn=_byte_transform_gen_input,
    buggy_code_fn=_byte_transform_buggy_code,
    correct_output_fn=_byte_transform_correct_output,
)


# ---------------------------------------------------------------------------
# Template 2: Array Processing (accumulator)
# ---------------------------------------------------------------------------


def _array_processing_gen_input() -> TemplateInput:
    size = _random_int(8, 24)
    data = random_bytes(size)
    return TemplateInput(data=base64.b64encode(data).decode("ascii"), params={})


def _array_processing_buggy_code(input: TemplateInput, active_bugs: list[BugDef]) -> str:
    has_wrong_op = any(b.name == "wrong_operator" for b in active_bugs)
    has_wrong_init = any(b.name == "wrong_init" for b in active_bugs)
    has_wrong_pad = any(b.name == "wrong_pad" for b in active_bugs)
    operator = "+" if has_wrong_op else "^"
    init_val = "1" if has_wrong_init else "0"
    pad_len = "1" if has_wrong_pad else "2"

    return "\n".join(
        [
            "function process(data) {",
            "  // data is a Uint8Array",
            f"  let acc = {init_val};",
            "  for (const byte of data) {",
            f"    acc = (acc {operator} byte) & 0xFF;",
            "  }",
            f"  return acc.toString(16).padStart({pad_len}, '0');",
            "}",
        ]
    )


async def _array_processing_correct_output(input: TemplateInput) -> str:
    data = base64.b64decode(input.data)
    acc = 0
    for byte in data:
        acc = (acc ^ byte) & 0xFF
    return format(acc, "02x")


ARRAY_PROCESSING_TEMPLATE = CodeTemplate(
    name="array_processing",
    available_bugs=[BUG_WRONG_OPERATOR, BUG_WRONG_INIT, BUG_WRONG_PAD],
    generate_input_fn=_array_processing_gen_input,
    buggy_code_fn=_array_processing_buggy_code,
    correct_output_fn=_array_processing_correct_output,
)


# ---------------------------------------------------------------------------
# Template 3: Hash Chain
# ---------------------------------------------------------------------------


def _hash_chain_gen_input() -> TemplateInput:
    size = _random_int(8, 16)
    data = random_bytes(size)
    rounds = _random_int(2, 4)
    return TemplateInput(data=base64.b64encode(data).decode("ascii"), params={"rounds": rounds})


def _hash_chain_buggy_code(input: TemplateInput, active_bugs: list[BugDef]) -> str:
    rounds = input.params["rounds"]
    has_missing_step = any(b.name == "missing_step" for b in active_bugs)
    has_off_by_one = any(b.name == "off_by_one" for b in active_bugs)
    loop_end = f"{rounds} - 1" if has_off_by_one else str(rounds)
    reverse_comment = "      // (no reversal step)" if has_missing_step else "      current = current.reverse();"

    return "\n".join(
        [
            "function hashChain(data, rounds) {",
            f"  // data is a Uint8Array, rounds = {rounds}",
            "  let current = data;",
            f"  for (let i = 0; i < {loop_end}; i++) {{",
            "    current = sha256(current); // returns Uint8Array",
            reverse_comment,
            "  }",
            "  return hex(current); // returns hex string",
            "}",
        ]
    )


async def _hash_chain_correct_output(input: TemplateInput) -> str:
    data = base64.b64decode(input.data)
    rounds = input.params["rounds"]
    current = data
    for _ in range(rounds):
        hash_hex = await sha256_hex(current)
        hash_bytes = bytes.fromhex(hash_hex)
        current = hash_bytes[::-1]  # reverse between rounds
    return to_hex(current)


HASH_CHAIN_TEMPLATE = CodeTemplate(
    name="hash_chain",
    available_bugs=[BUG_MISSING_STEP, BUG_OFF_BY_ONE],
    generate_input_fn=_hash_chain_gen_input,
    buggy_code_fn=_hash_chain_buggy_code,
    correct_output_fn=_hash_chain_correct_output,
)


# ---------------------------------------------------------------------------
# All templates
# ---------------------------------------------------------------------------

ALL_TEMPLATES: list[CodeTemplate] = [
    BYTE_TRANSFORM_TEMPLATE,
    ARRAY_PROCESSING_TEMPLATE,
    HASH_CHAIN_TEMPLATE,
]


# ---------------------------------------------------------------------------
# Difficulty configuration
# ---------------------------------------------------------------------------


@dataclass
class DifficultyConfig:
    bug_count: int
    template_names: list[str]
    edge_case_hint: bool


DIFFICULTY_CONFIG: dict[str, DifficultyConfig] = {
    "easy": DifficultyConfig(bug_count=1, template_names=["byte_transform", "array_processing"], edge_case_hint=False),
    "medium": DifficultyConfig(
        bug_count=1, template_names=["byte_transform", "array_processing", "hash_chain"], edge_case_hint=False
    ),
    "hard": DifficultyConfig(
        bug_count=2, template_names=["byte_transform", "array_processing", "hash_chain"], edge_case_hint=False
    ),
    "adversarial": DifficultyConfig(
        bug_count=3, template_names=["byte_transform", "array_processing", "hash_chain"], edge_case_hint=True
    ),
}


# ---------------------------------------------------------------------------
# Bug selection logic
# ---------------------------------------------------------------------------


def _select_bugs(template: CodeTemplate, count: int) -> list[BugDef]:
    available = list(template.available_bugs)
    selected: list[BugDef] = []
    to_select = min(count, len(available))
    for _ in range(to_select):
        idx = _random_int(0, len(available) - 1)
        selected.append(available[idx])
        available.pop(idx)
    return selected


# ---------------------------------------------------------------------------
# CodeExecutionDriver
# ---------------------------------------------------------------------------


class CodeExecutionDriver:
    name = "code-execution"
    dimensions = ("reasoning", "execution")
    estimated_human_time_ms = 120_000
    estimated_ai_time_ms = 2_000

    async def generate(self, difficulty: Difficulty | str) -> ChallengePayload:
        diff_str = difficulty.value if isinstance(difficulty, Difficulty) else difficulty
        config = DIFFICULTY_CONFIG[diff_str]

        # Pick a template
        eligible = [t for t in ALL_TEMPLATES if t.name in config.template_names]
        template = _pick_random(eligible)

        # Generate input
        input_data = template.generate_input()

        # Select bugs
        bugs = _select_bugs(template, config.bug_count)

        # Generate buggy code
        buggy_code = template.buggy_code(input_data, bugs)

        # Pre-compute correct output
        correct_output = await template.correct_output(input_data)

        # Decode input data for display
        input_bytes = base64.b64decode(input_data.data)
        input_hex = to_hex(input_bytes)

        # Build instructions
        param_lines: list[str] = []
        if input_data.params.get("rounds") is not None:
            param_lines.append(f"Rounds: {input_data.params['rounds']}")

        edge_case_note = (
            "\n\nNote: Pay close attention to boundary conditions, operator precedence, and off-by-one errors."
            if config.edge_case_hint
            else ""
        )

        instructions = "\n".join(
            [
                "The following JavaScript function contains bug(s). Your task is to:",
                "1. Identify and fix all bugs in the code",
                "2. Mentally execute the fixed code with the provided input",
                "3. Return the correct output",
                "",
                "## Code",
                "```javascript",
                buggy_code,
                "```",
                "",
                "## Input",
                f"Data (hex): {input_hex}",
                *param_lines,
                "",
                "## Notes",
                "- sha256hex() / sha256() compute SHA-256 and return hex string / Uint8Array respectively",
                "- hex() converts a Uint8Array to a hex string",
                "- All arithmetic on bytes should stay within 0-255 range",
                edge_case_note,
                "",
                "Return the exact output of the fixed function.",
            ]
        )

        return ChallengePayload(
            type="code-execution",
            instructions=instructions,
            data=input_data.data,
            steps=len(bugs),
            context={
                "templateName": template.name,
                "bugs": [{"name": b.name, "description": b.description} for b in bugs],
                "correctOutput": correct_output,
                "inputParams": input_data.params,
            },
        )

    async def solve(self, payload: ChallengePayload) -> str:
        ctx = payload.context or {}
        return ctx["correctOutput"]

    async def compute_answer_hash(self, payload: ChallengePayload) -> str:
        answer = await self.solve(payload)
        return await sha256_hex(answer.encode("utf-8"))

    async def verify(self, answer_hash: str, submitted_answer: Any) -> bool:
        if not isinstance(submitted_answer, str):
            return False
        submitted_hash = await sha256_hex(submitted_answer.encode("utf-8"))
        return timing_safe_equal(answer_hash, submitted_hash)
