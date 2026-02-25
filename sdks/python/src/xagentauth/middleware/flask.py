from __future__ import annotations

import functools
from typing import Any, Callable

from flask import g, jsonify, request

from xagentauth.errors import AgentAuthError
from xagentauth.guard import GuardConfig, verify_request


def agentauth_required(secret: str, min_score: float = 0.7) -> Callable[..., Any]:
    """Flask decorator for route protection.

    Verifies the Bearer token and stores claims in ``flask.g.agentauth_claims``.

    Usage::

        @app.route("/protected")
        @agentauth_required("secret", min_score=0.8)
        def protected():
            claims = g.agentauth_claims
            return jsonify({"model": claims.model_family})
    """
    config = GuardConfig(secret=secret, min_score=min_score)

    def decorator(fn: Callable[..., Any]) -> Callable[..., Any]:
        @functools.wraps(fn)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            auth_header = request.headers.get("Authorization", "")
            if not auth_header.startswith("Bearer "):
                return jsonify({"error": "Missing AgentAuth token"}), 401

            token = auth_header[7:]

            try:
                result = verify_request(token, config)
            except AgentAuthError as e:
                return jsonify({"error": str(e)}), e.status or 401

            g.agentauth_claims = result.claims

            rv = fn(*args, **kwargs)

            # Attach AgentAuth headers to the response
            if isinstance(rv, tuple):
                body, status_code = rv[0], rv[1] if len(rv) > 1 else 200
                resp = body if hasattr(body, "headers") else jsonify(body)
                for name, value in result.headers.items():
                    resp.headers[name] = value
                return resp, status_code
            else:
                resp = rv
                if hasattr(resp, "headers"):
                    for name, value in result.headers.items():
                        resp.headers[name] = value
                return resp

        return wrapper

    return decorator
