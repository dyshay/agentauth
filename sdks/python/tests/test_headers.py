from xagentauth.headers import format_capabilities, parse_capabilities
from xagentauth.types import AgentCapabilityScore


class TestFormatCapabilities:
    def test_formats_all_dimensions(self) -> None:
        score = AgentCapabilityScore(
            reasoning=0.9, execution=0.85, autonomy=0.8, speed=0.75, consistency=0.88
        )
        result = format_capabilities(score)
        assert result == "reasoning=0.9,execution=0.85,autonomy=0.8,speed=0.75,consistency=0.88"

    def test_roundtrip(self) -> None:
        score = AgentCapabilityScore(
            reasoning=0.9, execution=0.85, autonomy=0.8, speed=0.75, consistency=0.88
        )
        formatted = format_capabilities(score)
        parsed = parse_capabilities(formatted)
        assert parsed["reasoning"] == 0.9
        assert parsed["execution"] == 0.85
        assert parsed["autonomy"] == 0.8
        assert parsed["speed"] == 0.75
        assert parsed["consistency"] == 0.88


class TestParseCapabilities:
    def test_parses_valid_header(self) -> None:
        result = parse_capabilities("reasoning=0.9,execution=0.85,autonomy=0.8")
        assert result == {"reasoning": 0.9, "execution": 0.85, "autonomy": 0.8}

    def test_handles_whitespace(self) -> None:
        result = parse_capabilities("reasoning = 0.9 , execution = 0.85")
        assert result == {"reasoning": 0.9, "execution": 0.85}

    def test_handles_empty_string(self) -> None:
        result = parse_capabilities("")
        assert result == {}

    def test_handles_invalid_values(self) -> None:
        result = parse_capabilities("reasoning=abc,execution=0.85")
        assert result == {"execution": 0.85}
