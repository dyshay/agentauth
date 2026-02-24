---
"@xagentauth/core": minor
"@xagentauth/server": minor
"@xagentauth/client": minor
"@xagentauth/cli": minor
---

feat: add HTTP headers, Docker self-hosting, and challenge registry

- Standard AgentAuth-* HTTP headers injected by server guard/verify middleware
- Client SDK parses AgentAuth response headers
- Dockerfile and docker-compose.yml for one-command self-hosting
- Challenge registry package format (agentauth.json manifest)
- Local registry manager with install/uninstall/list/search
- CLI commands: add, list, search, publish
