import pytest


def test_langchain_tool_import():
    """Verify the tool can be imported (requires langchain-core)."""
    try:
        from xagentauth.integrations.langchain import AgentAuthTool

        assert AgentAuthTool.name == "agentauth_authenticate"
    except ImportError:
        pytest.skip("langchain-core not installed")


def test_langchain_tool_schema():
    """Verify input schema is correct."""
    try:
        from xagentauth.integrations.langchain import AgentAuthInput

        schema = AgentAuthInput.model_json_schema()
        assert "difficulty" in schema["properties"]
    except ImportError:
        pytest.skip("langchain-core not installed")
