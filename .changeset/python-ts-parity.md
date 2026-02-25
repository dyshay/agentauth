---
"xagentauth": minor
---

Add token signing, header utilities, and AgentAuth-Capabilities header to Python SDK

- TokenVerifier.sign() creates HS256 JWTs with auto-generated JTI
- format_capabilities() / parse_capabilities() for header serialization
- AgentAuth-Capabilities header now included in guard responses
- AGENTAUTH_HEADERS constants dict
