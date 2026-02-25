from __future__ import annotations

import math
import time
from dataclasses import dataclass

from xagentauth.types import SessionTimingAnomaly


@dataclass
class _SessionEntry:
    elapsed_ms: float
    zone: str
    timestamp: float


class SessionTimingTracker:
    """Tracks timing patterns across sessions and detects anomalies."""

    def __init__(self) -> None:
        self._sessions: dict[str, list[_SessionEntry]] = {}

    def record(self, session_id: str, elapsed_ms: float, zone: str) -> None:
        entries = self._sessions.get(session_id)
        if entries is None:
            entries = []
            self._sessions[session_id] = entries
        entries.append(
            _SessionEntry(
                elapsed_ms=elapsed_ms,
                zone=zone,
                timestamp=time.time() * 1000,  # ms
            )
        )

    def analyze(self, session_id: str) -> list[SessionTimingAnomaly]:
        entries = self._sessions.get(session_id)
        if not entries or len(entries) < 2:
            return []

        anomalies: list[SessionTimingAnomaly] = []

        # Check zone inconsistency
        zones = [e.zone for e in entries]
        ai_count = sum(1 for z in zones if z == "ai_zone")
        human_count = sum(1 for z in zones if z in ("human", "suspicious"))

        if ai_count > 0 and human_count > 0 and len(entries) >= 3:
            anomalies.append(
                SessionTimingAnomaly(
                    type="zone_inconsistency",
                    description=(
                        f"Session oscillates between AI zone ({ai_count}x) "
                        f"and human/suspicious zone ({human_count}x) "
                        f"across {len(entries)} challenges"
                    ),
                    severity="high" if human_count >= ai_count else "medium",
                )
            )

        # Check timing variance
        if len(entries) >= 3:
            timings = [e.elapsed_ms for e in entries]
            mean = sum(timings) / len(timings)
            if mean > 0:
                std = math.sqrt(sum((t - mean) ** 2 for t in timings) / len(timings))
                cv = std / mean
                if cv < 0.05:
                    anomalies.append(
                        SessionTimingAnomaly(
                            type="timing_variance_anomaly",
                            description=(
                                f"Timing variance coefficient {cv * 100:.1f}% is suspiciously low "
                                f"across {len(entries)} challenges"
                            ),
                            severity="high",
                        )
                    )

        # Check rapid succession
        for i in range(1, len(entries)):
            gap = entries[i].timestamp - entries[i - 1].timestamp
            if gap < 5000:
                anomalies.append(
                    SessionTimingAnomaly(
                        type="rapid_succession",
                        description=(
                            f"Challenges {i - 1} and {i} completed {gap:.0f}ms apart "
                            f"(< 5000ms threshold)"
                        ),
                        severity="high" if gap < 2000 else "low",
                    )
                )
                break  # Only report once

        return anomalies

    def clear(self, session_id: str) -> None:
        self._sessions.pop(session_id, None)
