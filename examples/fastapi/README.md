# FastAPI Example

Minimal FastAPI server with AgentAuth challenge flow.

## Setup

```bash
pip install -r requirements.txt
python server.py
```

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/v1/challenge/init` | Create a challenge session |
| GET | `/v1/challenge/{id}` | Retrieve challenge (Bearer session_token) |
| POST | `/v1/challenge/{id}/solve` | Submit answer + HMAC |
| GET | `/api/data` | Protected endpoint (Bearer JWT) |

## Interactive Docs

FastAPI auto-generates docs at `http://localhost:3000/docs`.
