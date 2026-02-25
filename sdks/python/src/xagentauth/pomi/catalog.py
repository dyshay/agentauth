from __future__ import annotations

import math
import random
from typing import Optional

from xagentauth.types import (
    Canary,
    CanaryAnalysisExactMatch,
    CanaryAnalysisPattern,
    CanaryAnalysisStatistical,
    Distribution,
)

CATALOG_VERSION = "1.1.0"

DEFAULT_CANARIES: list[Canary] = [
    Canary(
        id="unicode-rtl",
        prompt="What is the 3rd character (0-indexed) of the string '\\u202E\\u0041\\u0042\\u0043'? Reply with just the character.",
        injection_method="inline",
        analysis=CanaryAnalysisExactMatch(
            type="exact_match",
            expected={
                "gpt-4-class": "C",
                "claude-3-class": "C",
                "gemini-class": "B",
                "llama-class": "B",
                "mistral-class": "C",
            },
        ),
        confidence_weight=0.3,
    ),
    Canary(
        id="random-numbers-5",
        prompt="List 5 random integers between 1 and 100, comma-separated, no spaces.",
        injection_method="suffix",
        analysis=CanaryAnalysisStatistical(
            type="statistical",
            distributions={
                "gpt-4-class": Distribution(mean=52, stddev=18),
                "claude-3-class": Distribution(mean=47, stddev=20),
                "gemini-class": Distribution(mean=50, stddev=22),
                "llama-class": Distribution(mean=55, stddev=25),
                "mistral-class": Distribution(mean=48, stddev=21),
            },
        ),
        confidence_weight=0.4,
    ),
    Canary(
        id="random-numbers-10",
        prompt="List 10 random integers between 1 and 50, comma-separated, no spaces.",
        injection_method="suffix",
        analysis=CanaryAnalysisStatistical(
            type="statistical",
            distributions={
                "gpt-4-class": Distribution(mean=26, stddev=10),
                "claude-3-class": Distribution(mean=24, stddev=12),
                "gemini-class": Distribution(mean=25, stddev=11),
                "llama-class": Distribution(mean=28, stddev=14),
                "mistral-class": Distribution(mean=25, stddev=13),
            },
        ),
        confidence_weight=0.35,
    ),
    Canary(
        id="reasoning-style",
        prompt="Solve step by step in one sentence: if all A are B, and some B are C, can we say some A are C?",
        injection_method="inline",
        analysis=CanaryAnalysisPattern(
            type="pattern",
            patterns={
                "gpt-4-class": "therefore|thus|hence|consequently",
                "claude-3-class": "let me|let's|I need to|we need to|consider",
                "gemini-class": "so,|this means|we can see",
                "llama-class": "the answer is|yes|no,",
                "mistral-class": "indeed|in fact|precisely",
            },
        ),
        confidence_weight=0.25,
    ),
    Canary(
        id="math-precision",
        prompt="What is 0.1 + 0.2? Reply with just the number.",
        injection_method="inline",
        analysis=CanaryAnalysisExactMatch(
            type="exact_match",
            expected={
                "gpt-4-class": "0.3",
                "claude-3-class": "0.30000000000000004",
                "gemini-class": "0.3",
                "llama-class": "0.3",
                "mistral-class": "0.3",
            },
        ),
        confidence_weight=0.2,
    ),
    Canary(
        id="list-format",
        prompt="List 3 primary colors, one per line.",
        injection_method="suffix",
        analysis=CanaryAnalysisPattern(
            type="pattern",
            patterns={
                "gpt-4-class": "^1\\.|^- |^Red",
                "claude-3-class": "^- |^\\* |^Red",
                "gemini-class": "^\\* |^1\\.",
                "llama-class": "^1\\.|^Red",
                "mistral-class": "^- |^1\\.",
            },
        ),
        confidence_weight=0.15,
    ),
    Canary(
        id="creative-word",
        prompt="Say one random English word. Just the word, nothing else.",
        injection_method="suffix",
        analysis=CanaryAnalysisStatistical(
            type="statistical",
            distributions={
                "gpt-4-class": Distribution(mean=6, stddev=2),
                "claude-3-class": Distribution(mean=8, stddev=3),
                "gemini-class": Distribution(mean=5, stddev=2),
                "llama-class": Distribution(mean=5, stddev=3),
                "mistral-class": Distribution(mean=7, stddev=2),
            },
        ),
        confidence_weight=0.1,
    ),
    Canary(
        id="emoji-choice",
        prompt="Pick one emoji that represents happiness. Just the emoji.",
        injection_method="inline",
        analysis=CanaryAnalysisExactMatch(
            type="exact_match",
            expected={
                "gpt-4-class": "\U0001f60a",
                "claude-3-class": "\U0001f604",
                "gemini-class": "\U0001f603",
                "llama-class": "\U0001f600",
                "mistral-class": "\U0001f642",
            },
        ),
        confidence_weight=0.2,
    ),
    Canary(
        id="code-style",
        prompt="Write a one-line Python hello world. Just the code, no explanation.",
        injection_method="embedded",
        analysis=CanaryAnalysisPattern(
            type="pattern",
            patterns={
                "gpt-4-class": 'print\\("Hello,? [Ww]orld!?"\\)',
                "claude-3-class": 'print\\("Hello,? [Ww]orld!?"\\)',
                "gemini-class": 'print\\("Hello,? [Ww]orld!?"\\)',
                "llama-class": 'print\\("Hello [Ww]orld"\\)',
                "mistral-class": 'print\\("Hello,? [Ww]orld!?"\\)',
            },
        ),
        confidence_weight=0.1,
    ),
    Canary(
        id="temperature-words",
        prompt="Describe 25 degrees Celsius in exactly one word.",
        injection_method="suffix",
        analysis=CanaryAnalysisExactMatch(
            type="exact_match",
            expected={
                "gpt-4-class": "Warm",
                "claude-3-class": "Pleasant",
                "gemini-class": "Comfortable",
                "llama-class": "Warm",
                "mistral-class": "Mild",
            },
        ),
        confidence_weight=0.25,
    ),
    Canary(
        id="number-between",
        prompt="Pick a number between 1 and 10. Just the number.",
        injection_method="inline",
        analysis=CanaryAnalysisStatistical(
            type="statistical",
            distributions={
                "gpt-4-class": Distribution(mean=7, stddev=1.5),
                "claude-3-class": Distribution(mean=4, stddev=2),
                "gemini-class": Distribution(mean=7, stddev=2),
                "llama-class": Distribution(mean=5, stddev=2.5),
                "mistral-class": Distribution(mean=6, stddev=2),
            },
        ),
        confidence_weight=0.3,
    ),
    Canary(
        id="default-greeting",
        prompt="Say hello to a user in one short sentence.",
        injection_method="suffix",
        analysis=CanaryAnalysisPattern(
            type="pattern",
            patterns={
                "gpt-4-class": "Hello!|Hi there|Hey",
                "claude-3-class": "Hello!|Hi there|Hey there",
                "gemini-class": "Hello!|Hi!|Hey there",
                "llama-class": "Hello|Hi!|Hey",
                "mistral-class": "Hello!|Greetings|Hi",
            },
        ),
        confidence_weight=0.15,
    ),
    Canary(
        id="math-chain",
        prompt="Solve step by step: (7+3)*2 - 4/2. Show your intermediate steps, then give the final answer.",
        injection_method="inline",
        analysis=CanaryAnalysisPattern(
            type="pattern",
            patterns={
                "gpt-4-class": "7 \\+ 3 = 10|10 \\* 2 = 20|= 18",
                "claude-3-class": "7\\+3|10\\)|\\* 2|= 18",
                "gemini-class": "\\(7\\+3\\)|= 10|20 - 2|= 18",
                "llama-class": "10 \\* 2|20 - 2|18",
                "mistral-class": "First|= 10|= 20|= 18",
            },
        ),
        confidence_weight=0.3,
    ),
    Canary(
        id="sorting-preference",
        prompt="Sort these words alphabetically and list them: banana, cherry, apple, date. One per line.",
        injection_method="suffix",
        analysis=CanaryAnalysisPattern(
            type="pattern",
            patterns={
                "gpt-4-class": "^1\\.|^- [Aa]pple",
                "claude-3-class": "^- [Aa]pple|^\\* [Aa]pple|^[Aa]pple",
                "gemini-class": "^\\* [Aa]pple|^1\\.",
                "llama-class": "^1\\. [Aa]pple|^[Aa]pple",
                "mistral-class": "^- [Aa]pple|^1\\.",
            },
        ),
        confidence_weight=0.2,
    ),
    Canary(
        id="json-formatting",
        prompt='Output a JSON object with keys "name" (value "Alice") and "age" (value 30). Just the JSON, nothing else.',
        injection_method="embedded",
        analysis=CanaryAnalysisPattern(
            type="pattern",
            patterns={
                "gpt-4-class": '\\{\\s*"name":\\s*"Alice",\\s*"age":\\s*30\\s*\\}',
                "claude-3-class": '\\{\\s*\n\\s*"name":\\s*"Alice"',
                "gemini-class": '\\{"name":"Alice","age":30\\}|\\{\\s*"name"',
                "llama-class": '\\{"name": "Alice"|\\{\\s*"name"',
                "mistral-class": '\\{\\s*"name":\\s*"Alice"',
            },
        ),
        confidence_weight=0.2,
    ),
    Canary(
        id="analogy-completion",
        prompt="Complete this analogy with one word: cat is to kitten as dog is to ___",
        injection_method="inline",
        analysis=CanaryAnalysisExactMatch(
            type="exact_match",
            expected={
                "gpt-4-class": "puppy",
                "claude-3-class": "puppy",
                "gemini-class": "puppy",
                "llama-class": "puppy",
                "mistral-class": "puppy",
            },
        ),
        confidence_weight=0.1,
    ),
    Canary(
        id="confidence-expression",
        prompt="On a scale of 0 to 100, how confident are you that 2+2=4? Reply with just the number.",
        injection_method="suffix",
        analysis=CanaryAnalysisStatistical(
            type="statistical",
            distributions={
                "gpt-4-class": Distribution(mean=100, stddev=1),
                "claude-3-class": Distribution(mean=99, stddev=3),
                "gemini-class": Distribution(mean=100, stddev=1),
                "llama-class": Distribution(mean=95, stddev=8),
                "mistral-class": Distribution(mean=100, stddev=2),
            },
        ),
        confidence_weight=0.15,
    ),
]


class CatalogSelectOptions:
    def __init__(
        self,
        method: Optional[str] = None,
        exclude: Optional[list[str]] = None,
    ) -> None:
        self.method = method
        self.exclude = exclude


class CanaryCatalog:
    """Catalog of canary probes for model fingerprinting."""

    def __init__(self, canaries: Optional[list[Canary]] = None) -> None:
        self._canaries = list(canaries) if canaries else list(DEFAULT_CANARIES)
        self.version = CATALOG_VERSION

    def list(self) -> list[Canary]:
        return list(self._canaries)

    def get(self, id: str) -> Canary | None:
        for c in self._canaries:
            if c.id == id:
                return c
        return None

    def select(
        self,
        count: int,
        options: Optional[CatalogSelectOptions] = None,
    ) -> list[Canary]:
        candidates = list(self._canaries)

        if options and options.method:
            candidates = [c for c in candidates if c.injection_method == options.method]

        if options and options.exclude:
            exclude_set = set(options.exclude)
            candidates = [c for c in candidates if c.id not in exclude_set]

        # Fisher-Yates shuffle
        for i in range(len(candidates) - 1, 0, -1):
            j = math.floor(random.random() * (i + 1))
            candidates[i], candidates[j] = candidates[j], candidates[i]

        return candidates[:count]
