try:
    from xagentauth.middleware.fastapi import agentauth_guard, create_challenge_router
except ImportError:
    pass

try:
    from xagentauth.middleware.flask import agentauth_required, create_challenge_blueprint
except ImportError:
    pass

__all__ = ["agentauth_guard", "create_challenge_router", "agentauth_required", "create_challenge_blueprint"]
