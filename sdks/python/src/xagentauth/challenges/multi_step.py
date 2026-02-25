from __future__ import annotations

import base64
import math
import random
from dataclasses import dataclass
from typing import Any

from xagentauth.crypto import (
    from_hex,
    hmac_sha256_bytes,
    random_bytes,
    sha256_hex,
    timing_safe_equal,
    to_hex,
)
from xagentauth.types import ChallengePayload, Difficulty


# ---------------------------------------------------------------------------
# Step definitions
# ---------------------------------------------------------------------------

StepDef = dict[str, Any]
# Types: 'sha256', 'xor' (+key), 'hmac' (+key), 'slice' (+start,end),
#        'memory_recall' (+step, byteIndex), 'memory_apply' (+step)


@dataclass
class StepResult:
    step_def: StepDef
    result: str  # hex string of intermediate result


# ---------------------------------------------------------------------------
# Utility helpers
# ---------------------------------------------------------------------------


def _pick_random(arr: list[Any]) -> Any:
    return arr[math.floor(random.random() * len(arr))]


def _random_int(min_val: int, max_val: int) -> int:
    return math.floor(random.random() * (max_val - min_val + 1)) + min_val


async def _hmac_sha256_hex_bytes(key: bytes, message: bytes) -> str:
    result = hmac_sha256_bytes(key, message)
    return to_hex(result)


def _xor_bytes(data: bytes, key: int) -> str:
    result = bytes(b ^ (key & 0xFF) for b in data)
    return to_hex(result)


def _slice_hex(hex_str: str, start: int, end: int) -> str:
    data = from_hex(hex_str)
    sliced = data[start:end]
    return to_hex(sliced)


# ---------------------------------------------------------------------------
# Step execution
# ---------------------------------------------------------------------------


async def _execute_step(
    step_index: int,
    step_def: StepDef,
    input_data_hex: str,
    previous_results: list[StepResult],
) -> str:
    step_type = step_def["type"]

    if step_type == "sha256":
        source = input_data_hex if step_index == 0 else previous_results[step_index - 1].result
        data = from_hex(source)
        return await sha256_hex(data)

    elif step_type == "xor":
        source = input_data_hex if step_index == 0 else previous_results[step_index - 1].result
        data = from_hex(source)
        return _xor_bytes(data, step_def["key"])

    elif step_type == "hmac":
        if step_index == 0:
            key_bytes = from_hex(step_def["key"])
            msg_bytes = from_hex(input_data_hex)
            return await _hmac_sha256_hex_bytes(key_bytes, msg_bytes)
        key_bytes = from_hex(previous_results[step_index - 1].result)
        msg_bytes = from_hex(input_data_hex)
        return await _hmac_sha256_hex_bytes(key_bytes, msg_bytes)

    elif step_type == "slice":
        source = input_data_hex if step_index == 0 else previous_results[step_index - 1].result
        return _slice_hex(source, step_def["start"], step_def["end"])

    elif step_type == "memory_recall":
        target_result = previous_results[step_def["step"]].result
        data = from_hex(target_result)
        byte_val = data[step_def["byteIndex"]]
        return format(byte_val, "02x")

    elif step_type == "memory_apply":
        ref_def = previous_results[step_def["step"]].step_def
        source = previous_results[step_index - 1].result
        return await _execute_step(
            step_index,
            ref_def,
            input_data_hex,
            list(previous_results[:step_index]),
        )

    else:
        raise ValueError(f"Unknown step type: {step_type}")


async def _execute_all_steps(
    steps: list[StepDef],
    input_data_hex: str,
) -> list[StepResult]:
    results: list[StepResult] = []
    for i, step_def in enumerate(steps):
        result = await _execute_step(i, step_def, input_data_hex, results)
        results.append(StepResult(step_def=step_def, result=result))
    return results


async def _compute_final_answer(step_results: list[StepResult]) -> str:
    concatenated = "".join(r.result for r in step_results)
    data = concatenated.encode("utf-8")
    return await sha256_hex(data)


# ---------------------------------------------------------------------------
# Natural language instruction generation
# ---------------------------------------------------------------------------

SHA256_PHRASINGS = [
    lambda ref: f"Compute the SHA-256 hash of {ref}. Your result is",
    lambda ref: f"Hash {ref} using SHA-256. Your result is",
    lambda ref: f"Apply SHA-256 to {ref}. Your result is",
]

XOR_PHRASINGS = [
    lambda ref, key: f"XOR each byte of {ref} with 0x{key:02X}. Your result is",
    lambda ref, key: f"Apply exclusive-or with the value {key} to every byte of {ref}. Your result is",
    lambda ref, key: f"Bitwise XOR each byte of {ref} using the key 0x{key:02x}. Your result is",
]

HMAC_PHRASINGS = [
    lambda key_ref, msg_ref: f"Compute HMAC-SHA256 with {key_ref} as key and {msg_ref} as message. Your result is",
    lambda key_ref, msg_ref: f"Use {key_ref} as an HMAC-SHA256 key to sign {msg_ref}. Your result is",
]

SLICE_PHRASINGS = [
    lambda ref, start, end: f"Take bytes {start} through {end - 1} (inclusive) from {ref}. Your result is",
    lambda ref, start, end: (
        f"Extract the first {end - start} bytes of {ref} starting at offset {start}. Your result is"
    ),
]

RECALL_PHRASINGS = [
    lambda step_num, byte_idx: (
        f"What was byte {byte_idx} (0-indexed) of your result R{step_num}? Express as a 2-digit hex value. Your result is"
    ),
    lambda step_num, byte_idx: (
        f"Recall the value of byte at position {byte_idx} in R{step_num}, written as two hex digits. Your result is"
    ),
]

APPLY_PHRASINGS = [
    lambda step_num, prev_ref: (
        f"Apply the same operation you performed in step {step_num} to {prev_ref}. Your result is"
    ),
    lambda step_num, prev_ref: (
        f"Repeat the operation from step {step_num}, but this time on {prev_ref}. Your result is"
    ),
]


def _generate_instruction(
    step_index: int,
    step_def: StepDef,
    input_data_hex: str,
    total_steps: int,
) -> str:
    step_num = step_index + 1
    result_label = f"R{step_num}"
    prev_ref = "the provided data" if step_index == 0 else f"R{step_index}"
    step_type = step_def["type"]

    if step_type == "sha256":
        ref = "the provided data" if step_index == 0 else f"R{step_index}"
        phrasing = _pick_random(SHA256_PHRASINGS)(ref)
        return f"Step {step_num}: {phrasing} {result_label}."

    elif step_type == "xor":
        ref = "the provided data" if step_index == 0 else f"R{step_index}"
        phrasing = _pick_random(XOR_PHRASINGS)(ref, step_def["key"])
        return f"Step {step_num}: {phrasing} {result_label}."

    elif step_type == "hmac":
        if step_index == 0:
            phrasing = _pick_random(HMAC_PHRASINGS)(
                f'the hex key "{step_def["key"]}"',
                "the provided data",
            )
            return f"Step {step_num}: {phrasing} {result_label}."
        phrasing = _pick_random(HMAC_PHRASINGS)(f"R{step_index}", "the provided data")
        return f"Step {step_num}: {phrasing} {result_label}."

    elif step_type == "slice":
        ref = "the provided data" if step_index == 0 else f"R{step_index}"
        phrasing = _pick_random(SLICE_PHRASINGS)(ref, step_def["start"], step_def["end"])
        return f"Step {step_num}: {phrasing} {result_label}."

    elif step_type == "memory_recall":
        phrasing = _pick_random(RECALL_PHRASINGS)(step_def["step"] + 1, step_def["byteIndex"])
        return f"Step {step_num}: {phrasing} {result_label}."

    elif step_type == "memory_apply":
        phrasing = _pick_random(APPLY_PHRASINGS)(step_def["step"] + 1, prev_ref)
        return f"Step {step_num}: {phrasing} {result_label}."

    else:
        raise ValueError(f"Unknown step type: {step_type}")


def _generate_all_instructions(steps: list[StepDef], input_data_hex: str) -> str:
    step_instructions = [
        _generate_instruction(i, step_def, input_data_hex, len(steps)) for i, step_def in enumerate(steps)
    ]
    result_refs = " + ".join(f"R{i + 1}" for i in range(len(steps)))
    footer = f"\nYour final answer: SHA-256 of the concatenation of {result_refs} (all as lowercase hex strings, concatenated without separators)."
    return "\n".join(step_instructions) + footer


# ---------------------------------------------------------------------------
# Step generation per difficulty
# ---------------------------------------------------------------------------


@dataclass
class DifficultyConfig:
    total_steps: int
    data_size: int
    compute_steps: int
    memory_recall: int
    memory_apply: int


DIFFICULTY_CONFIGS: dict[str, DifficultyConfig] = {
    "easy": DifficultyConfig(total_steps=3, data_size=32, compute_steps=3, memory_recall=0, memory_apply=0),
    "medium": DifficultyConfig(total_steps=4, data_size=32, compute_steps=3, memory_recall=1, memory_apply=0),
    "hard": DifficultyConfig(total_steps=5, data_size=64, compute_steps=3, memory_recall=1, memory_apply=1),
    "adversarial": DifficultyConfig(total_steps=7, data_size=64, compute_steps=4, memory_recall=2, memory_apply=1),
}


def _generate_compute_step(
    step_index: int,
    data_size: int,
    previous_results: list[StepResult],
) -> StepDef:
    all_types = ["sha256", "xor", "hmac", "slice"]
    available = ["sha256", "xor"] if step_index == 0 else all_types
    step_type = _pick_random(available)

    if step_type == "sha256":
        return {"type": "sha256"}
    elif step_type == "xor":
        return {"type": "xor", "key": _random_int(1, 255)}
    elif step_type == "hmac":
        if step_index == 0:
            key = to_hex(random_bytes(16))
            return {"type": "hmac", "key": key}
        return {"type": "hmac", "key": ""}
    elif step_type == "slice":
        if step_index == 0:
            prev_result_len = data_size
        else:
            prev_hex = previous_results[step_index - 1].result if previous_results else ""
            prev_result_len = len(from_hex(prev_hex)) if prev_hex else 32
        max_end = max(prev_result_len, 4)
        start = _random_int(0, max_end // 4)
        end = _random_int(start + 2, min(start + max_end // 2, max_end))
        return {"type": "slice", "start": start, "end": end}
    else:
        return {"type": "sha256"}


def _generate_memory_recall_step(previous_results: list[StepResult]) -> StepDef:
    step_idx = _random_int(0, len(previous_results) - 1)
    result_bytes = from_hex(previous_results[step_idx].result)
    byte_index = _random_int(0, len(result_bytes) - 1)
    return {"type": "memory_recall", "step": step_idx, "byteIndex": byte_index}


def _generate_memory_apply_step(previous_results: list[StepResult]) -> StepDef:
    compute_steps = [
        (i, r.step_def)
        for i, r in enumerate(previous_results)
        if r.step_def["type"] not in ("memory_recall", "memory_apply")
    ]
    if not compute_steps:
        return {"type": "memory_apply", "step": 0}
    target = _pick_random(compute_steps)
    return {"type": "memory_apply", "step": target[0]}


async def _generate_steps(
    difficulty: str,
    input_data_hex: str,
) -> tuple[list[StepDef], list[StepResult]]:
    config = DIFFICULTY_CONFIGS[difficulty]
    steps: list[StepDef] = []
    results: list[StepResult] = []

    # Generate compute steps first
    for i in range(config.compute_steps):
        step_def = _generate_compute_step(i, config.data_size, results)
        steps.append(step_def)
        result = await _execute_step(i, step_def, input_data_hex, results)
        results.append(StepResult(step_def=step_def, result=result))

    # Insert memory recall steps
    for _ in range(config.memory_recall):
        step_def = _generate_memory_recall_step(results)
        step_idx = len(steps)
        steps.append(step_def)
        result = await _execute_step(step_idx, step_def, input_data_hex, results)
        results.append(StepResult(step_def=step_def, result=result))

    # Insert memory apply steps
    for _ in range(config.memory_apply):
        step_def = _generate_memory_apply_step(results)
        step_idx = len(steps)
        steps.append(step_def)
        result = await _execute_step(step_idx, step_def, input_data_hex, results)
        results.append(StepResult(step_def=step_def, result=result))

    return steps, results


# ---------------------------------------------------------------------------
# Driver
# ---------------------------------------------------------------------------


class MultiStepDriver:
    name = "multi-step"
    dimensions = ("reasoning", "execution", "memory")
    estimated_human_time_ms = 120_000
    estimated_ai_time_ms = 2_000

    async def generate(self, difficulty: Difficulty | str) -> ChallengePayload:
        diff_str = difficulty.value if isinstance(difficulty, Difficulty) else difficulty
        config = DIFFICULTY_CONFIGS[diff_str]
        data = random_bytes(config.data_size)
        input_data_hex = to_hex(data)

        steps, results = await _generate_steps(diff_str, input_data_hex)
        final_answer = await _compute_final_answer(results)

        instructions = _generate_all_instructions(steps, input_data_hex)

        return ChallengePayload(
            type="multi-step",
            instructions=instructions,
            data=base64.b64encode(data).decode("ascii"),
            steps=len(steps),
            context={
                "stepDefs": steps,
                "expectedResults": [r.result for r in results],
                "expectedAnswer": final_answer,
            },
        )

    async def solve(self, payload: ChallengePayload) -> str:
        data = base64.b64decode(payload.data)
        input_data_hex = to_hex(data)
        step_defs = (payload.context or {}).get("stepDefs", [])
        results = await _execute_all_steps(step_defs, input_data_hex)
        return await _compute_final_answer(results)

    async def compute_answer_hash(self, payload: ChallengePayload) -> str:
        answer = await self.solve(payload)
        return await sha256_hex(answer.encode("utf-8"))

    async def verify(self, answer_hash: str, submitted_answer: Any) -> bool:
        if not isinstance(submitted_answer, str):
            return False
        submitted_hash = await sha256_hex(submitted_answer.encode("utf-8"))
        return timing_safe_equal(answer_hash, submitted_hash)
