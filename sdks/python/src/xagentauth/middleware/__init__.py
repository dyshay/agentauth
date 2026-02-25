try:
    from xagentauth.middleware.fastapi import agentauth_guard
except ImportError:
    pass

try:
    from xagentauth.middleware.flask import agentauth_required
except ImportError:
    pass

__all__ = ["agentauth_guard", "agentauth_required"]
