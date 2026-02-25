---
"xagentauth": minor
---

Add token signing, header utilities, and AgentAuth-Capabilities header to Go SDK

- TokenVerifier.Sign() creates HS256 JWTs with auto-generated JTI
- FormatCapabilities() / ParseCapabilities() for header serialization
- AgentAuth-Capabilities header now included in guard responses
- Header name constants (HeaderStatus, HeaderCapabilities, etc.)
