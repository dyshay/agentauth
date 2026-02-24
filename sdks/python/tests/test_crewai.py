import pytest


def test_crewai_tool_import():
    """Verify the tool can be imported (requires crewai-tools)."""
    try:
        from agentauth.integrations.crewai import AgentAuthTool
        assert AgentAuthTool.name == "AgentAuth Authenticate"
    except ImportError:
        pytest.skip("crewai-tools not installed")
