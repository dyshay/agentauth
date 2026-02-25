from __future__ import annotations

import base64
import hashlib
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
# Types
# ---------------------------------------------------------------------------

BasicOpType = str  # 'xor' | 'reverse' | 'slice' | 'sort' | 'rotate'
ExtendedOpType = str  # 'sha256' | 'bitwise_not' | 'repeat' | 'hmac' | 'base64_encode'
OpType = str  # union of above


@dataclass
class ByteOperation:
    op: str
    params: dict[str, Any]


# ---------------------------------------------------------------------------
# Op pools by difficulty
# ---------------------------------------------------------------------------

BASIC_OPS: list[str] = ["xor", "reverse", "slice", "sort", "rotate"]
MEDIUM_OPS: list[str] = [*BASIC_OPS, "sha256", "bitwise_not"]
ALL_OPS: list[str] = [*MEDIUM_OPS, "repeat", "hmac", "base64_encode"]

OPS_BY_DIFFICULTY: dict[str, list[str]] = {
    "easy": BASIC_OPS,
    "medium": MEDIUM_OPS,
    "hard": ALL_OPS,
    "adversarial": ALL_OPS,
}


# ---------------------------------------------------------------------------
# Natural language phrasings
# ---------------------------------------------------------------------------

PHRASINGS: dict[str, list[Any]] = {
    "xor": [
        lambda p: f"XOR each byte with 0x{int(p['key']):02X}",
        lambda p: f"Apply exclusive-or with the value {p['key']} to every byte",
        lambda p: f"Bitwise XOR each octet using the key {p['key']}",
        lambda p: f"For every byte, flip bits using 0x{int(p['key']):02x} as mask",
    ],
    "reverse": [
        lambda p: "Reverse the byte order",
        lambda p: "Flip the sequence end-to-end",
        lambda p: "Mirror the byte array so the last byte becomes first",
        lambda p: "Invert the positional ordering of all bytes",
    ],
    "slice": [
        lambda p: f"Take bytes from offset {p['start']} to {p['end']}",
        lambda p: f"Extract the slice [{p['start']}:{p['end']}] from the data",
        lambda p: f"Isolate bytes at positions {p['start']} through {int(p['end']) - 1}",
    ],
    "sort": [
        lambda p: "Sort all bytes in ascending order",
        lambda p: "Arrange the bytes from smallest to largest value",
        lambda p: "Order the octets numerically, lowest first",
    ],
    "rotate": [
        lambda p: f"Rotate the bytes left by {p['positions']} positions",
        lambda p: f"Shift all bytes {p['positions']} positions to the left, wrapping around",
        lambda p: f"Circular left-shift the array by {p['positions']}",
    ],
    "sha256": [
        lambda p: "Compute the SHA-256 hash of the current data (producing 32 raw bytes)",
        lambda p: "Hash the byte array with SHA-256, replacing it with the 32-byte digest",
        lambda p: "Apply SHA-256 to the data \u2014 the result is the raw 32-byte hash",
    ],
    "bitwise_not": [
        lambda p: "Flip every bit in each byte (bitwise NOT, masked to 8 bits)",
        lambda p: "Apply bitwise complement to every byte (~byte & 0xFF)",
        lambda p: "Invert all bits in the array \u2014 each byte becomes its one's complement",
    ],
    "repeat": [
        lambda p: f"Concatenate the array with itself {p['times']} times (total {p['times']}x copies)",
        lambda p: f"Repeat the data {p['times']} times by appending it to itself",
        lambda p: f"Duplicate the byte sequence so it appears {p['times']} times in a row",
    ],
    "hmac": [
        lambda p: f"Compute HMAC-SHA256 of the data using the hex key {p['keyHex']} (producing 32 raw bytes)",
        lambda p: f"HMAC the byte array with SHA-256 and key 0x{p['keyHex']}, yielding 32 bytes",
        lambda p: f"Apply HMAC-SHA256 using the secret key (hex) {p['keyHex']} \u2014 the result is 32 raw bytes",
    ],
    "base64_encode": [
        lambda p: "Base64-encode the data, then treat the resulting ASCII string as a new byte array",
        lambda p: "Encode the bytes as a base64 string and reinterpret its characters as byte values",
        lambda p: "Convert the data to base64 and use the encoded string's character codes as the new bytes",
    ],
}

# ---------------------------------------------------------------------------
# Difficulty config
# ---------------------------------------------------------------------------

DIFFICULTY_CONFIG: dict[str, dict[str, int]] = {
    "easy": {"ops": 1, "dataSize": 16},
    "medium": {"ops": 2, "dataSize": 32},
    "hard": {"ops": 4, "dataSize": 64},
    "adversarial": {"ops": 6, "dataSize": 128},
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _pick_random(arr: list[Any]) -> Any:
    return arr[math.floor(random.random() * len(arr))]


def _random_int(min_val: int, max_val: int) -> int:
    return math.floor(random.random() * (max_val - min_val + 1)) + min_val


# ---------------------------------------------------------------------------
# Op generation
# ---------------------------------------------------------------------------


def _generate_ops(count: int, data_size: int, difficulty: str) -> list[ByteOperation]:
    op_pool = OPS_BY_DIFFICULTY[difficulty]
    ops: list[ByteOperation] = []

    for _ in range(count):
        op = _pick_random(op_pool)
        if op == "xor":
            ops.append(ByteOperation(op=op, params={"key": _random_int(1, 255)}))
        elif op == "reverse":
            ops.append(ByteOperation(op=op, params={}))
        elif op == "slice":
            current_size = data_size
            start = _random_int(0, current_size // 4)
            end = _random_int(start + 4, min(start + current_size // 2, current_size))
            ops.append(ByteOperation(op=op, params={"start": start, "end": end}))
        elif op == "sort":
            ops.append(ByteOperation(op=op, params={}))
        elif op == "rotate":
            ops.append(ByteOperation(op=op, params={"positions": _random_int(1, data_size // 2)}))
        elif op == "sha256":
            ops.append(ByteOperation(op=op, params={}))
        elif op == "bitwise_not":
            ops.append(ByteOperation(op=op, params={}))
        elif op == "repeat":
            times = _random_int(2, 3)
            ops.append(ByteOperation(op=op, params={"times": times}))
        elif op == "hmac":
            key_bytes = random_bytes(16)
            ops.append(ByteOperation(op=op, params={"keyHex": to_hex(key_bytes)}))
        elif op == "base64_encode":
            ops.append(ByteOperation(op=op, params={}))

    return ops


# ---------------------------------------------------------------------------
# Async operation execution
# ---------------------------------------------------------------------------


async def _apply_op(data: bytes, op: ByteOperation) -> bytes:
    if op.op == "xor":
        key = int(op.params["key"])
        return bytes(b ^ key for b in data)
    elif op.op == "reverse":
        return data[::-1]
    elif op.op == "slice":
        return data[int(op.params["start"]) : int(op.params["end"])]
    elif op.op == "sort":
        return bytes(sorted(data))
    elif op.op == "rotate":
        pos = int(op.params["positions"]) % len(data)
        return data[pos:] + data[:pos]
    elif op.op == "sha256":
        digest = hashlib.sha256(data).digest()
        return digest
    elif op.op == "bitwise_not":
        return bytes((~b) & 0xFF for b in data)
    elif op.op == "repeat":
        times = int(op.params["times"])
        return data * times
    elif op.op == "hmac":
        key_bytes = from_hex(str(op.params["keyHex"]))
        return hmac_sha256_bytes(key_bytes, data)
    elif op.op == "base64_encode":
        b64 = base64.b64encode(data).decode("ascii")
        return b64.encode("utf-8")
    else:
        raise ValueError(f"Unknown operation: {op.op}")


# ---------------------------------------------------------------------------
# Instruction generation
# ---------------------------------------------------------------------------


def _ops_to_instructions(ops: list[ByteOperation]) -> str:
    lines: list[str] = []
    for i, op in enumerate(ops):
        phrasings = PHRASINGS[op.op]
        phrasing = _pick_random(phrasings)(op.params)
        lines.append(f"Step {i + 1}: {phrasing}")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Pipeline execution (async)
# ---------------------------------------------------------------------------


async def _execute_ops(data: bytes, ops: list[ByteOperation]) -> bytes:
    result = data
    for op in ops:
        result = await _apply_op(result, op)
    return result


# ---------------------------------------------------------------------------
# Driver
# ---------------------------------------------------------------------------


class CryptoNLDriver:
    name = "crypto-nl"
    dimensions = ("reasoning", "execution")
    estimated_human_time_ms = 60_000
    estimated_ai_time_ms = 500

    async def generate(self, difficulty: Difficulty | str) -> ChallengePayload:
        diff_str = difficulty.value if isinstance(difficulty, Difficulty) else difficulty
        config = DIFFICULTY_CONFIG[diff_str]
        data = random_bytes(config["dataSize"])
        ops = _generate_ops(config["ops"], config["dataSize"], diff_str)
        instructions = _ops_to_instructions(ops)

        return ChallengePayload(
            type="crypto-nl",
            instructions=f"{instructions}\n\nThen compute the SHA-256 hex digest of the final result.",
            data=base64.b64encode(data).decode("ascii"),
            steps=len(ops),
            context={"ops": [{"op": op.op, "params": op.params} for op in ops]},
        )

    async def solve(self, payload: ChallengePayload) -> str:
        data = base64.b64decode(payload.data)
        ops_raw = payload.context.get("ops", []) if payload.context else []
        ops = [ByteOperation(op=o["op"], params=o["params"]) for o in ops_raw]
        result = await _execute_ops(data, ops)
        return await sha256_hex(result)

    async def compute_answer_hash(self, payload: ChallengePayload) -> str:
        answer = await self.solve(payload)
        return await sha256_hex(answer.encode("utf-8"))

    async def verify(self, answer_hash: str, submitted_answer: Any) -> bool:
        if not isinstance(submitted_answer, str):
            return False
        submitted_hash = await sha256_hex(submitted_answer.encode("utf-8"))
        return timing_safe_equal(answer_hash, submitted_hash)
