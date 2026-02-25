from __future__ import annotations

import asyncio
import functools
from typing import Any, Callable

from flask import Blueprint, g, jsonify, request

from xagentauth.engine import AgentAuthEngine
from xagentauth.errors import AgentAuthError
from xagentauth.guard import GuardConfig, verify_request
from xagentauth.types import AgentAuthConfig, InitChallengeOptions, SolveInput


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


def _run_async(coro: Any) -> Any:
    """Run an async coroutine in a sync context."""
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None

    if loop and loop.is_running():
        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor() as pool:
            return pool.submit(asyncio.run, coro).result()
    else:
        return asyncio.run(coro)


def create_challenge_blueprint(config: AgentAuthConfig, url_prefix: str = "/agentauth") -> Blueprint:
    """Create a Flask Blueprint with challenge endpoints.

    Usage::

        from xagentauth.middleware.flask import create_challenge_blueprint

        bp = create_challenge_blueprint(config)
        app.register_blueprint(bp)
    """
    engine = AgentAuthEngine(config)
    bp = Blueprint("agentauth", __name__, url_prefix=url_prefix)

    @bp.route("/challenge", methods=["POST"])
    def init_challenge() -> Any:
        body = request.get_json(silent=True) or {}
        options = InitChallengeOptions(
            difficulty=body.get("difficulty"),
            dimensions=body.get("dimensions"),
        )
        result = _run_async(engine.init_challenge(options))
        return jsonify(result.model_dump()), 201

    @bp.route("/challenge/<challenge_id>", methods=["GET"])
    def get_challenge(challenge_id: str) -> Any:
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Missing or invalid Authorization header"}), 401

        session_token = auth_header[7:]
        challenge = _run_async(engine.get_challenge(challenge_id, session_token))
        if not challenge:
            return jsonify({"error": f"Challenge {challenge_id} not found"}), 404

        return jsonify(challenge)

    @bp.route("/challenge/<challenge_id>/solve", methods=["POST"])
    def solve_challenge(challenge_id: str) -> Any:
        body = request.get_json(silent=True) or {}
        if not body.get("answer") or not body.get("hmac"):
            return jsonify({"error": "Missing answer or hmac"}), 400

        solve_input = SolveInput(
            answer=body["answer"],
            hmac=body["hmac"],
            canary_responses=body.get("canary_responses"),
            metadata=body.get("metadata"),
            client_rtt_ms=body.get("client_rtt_ms"),
            step_timings=body.get("step_timings"),
        )
        result = _run_async(engine.solve_challenge(challenge_id, solve_input))
        return jsonify(result.model_dump(exclude_none=True))

    @bp.route("/verify", methods=["GET"])
    def verify_token() -> Any:
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"valid": False}), 401

        token = auth_header[7:]
        result = _run_async(engine.verify_token(token))
        return jsonify(result.model_dump(exclude_none=True))

    return bp
