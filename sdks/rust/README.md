# xagentauth

**AgentAuth SDK for Rust** — authenticate AI agents and protect your endpoints.

## Installation

```toml
[dependencies]
xagentauth = "0.1"
```

With framework middleware (feature flags):
```toml
xagentauth = { version = "0.1", features = ["axum"] }   # Axum middleware
xagentauth = { version = "0.1", features = ["actix"] }  # Actix middleware
```

## Client — Authenticate Agents

```rust
use xagentauth::{AgentAuthClient, ClientConfig, Difficulty};

#[tokio::main]
async fn main() -> Result<(), xagentauth::AgentAuthError> {
    let client = AgentAuthClient::new(ClientConfig {
        base_url: "https://api.example.com".to_string(),
        api_key: Some("ak_...".to_string()),
        timeout_ms: None,
    })?;

    // One-call flow: init -> get -> solve
    let result = client
        .authenticate(Some(Difficulty::Medium), None, |challenge| async move {
            let answer = compute_answer(&challenge.payload).await;
            Ok((answer, None))
        })
        .await?;

    println!("Token: {:?}", result.token);
    println!("Score: {:?}", result.score);
    Ok(())
}
```

### Step-by-step API

```rust
let init = client.init_challenge(Some(Difficulty::Hard), None).await?;
let challenge = client.get_challenge(&init.id, &init.session_token).await?;

let answer = compute_answer(&challenge.payload).await;

let (result, headers) = client
    .solve(&init.id, &answer, &init.session_token, None, None)
    .await?;

println!("Token: {:?}", result.token);
```

## Server — Protect Endpoints

### Token Verification

Verify AgentAuth JWTs locally (no network round-trip):

```rust
use xagentauth::token::{TokenVerifier, AgentAuthClaims};

let verifier = TokenVerifier::new("your-shared-secret");

// Verify signature, issuer, and expiration
let claims: AgentAuthClaims = verifier.verify(token)?;
println!("Model: {}", claims.model_family);
println!("Score: {:?}", claims.capabilities);

// Decode without verification (for inspection)
let claims = verifier.decode_unchecked(token)?;
```

### Guard Logic

Framework-agnostic request verification with minimum score enforcement:

```rust
use xagentauth::guard::{GuardConfig, verify_request};

let config = GuardConfig::new("your-shared-secret").with_min_score(0.8);
let result = verify_request(token, &config)?;

println!("Model: {}", result.claims.model_family);
// result.headers contains AgentAuth-* response headers
```

### Axum Middleware

Requires `features = ["axum"]`.

```rust
use axum::{routing::get, Router};
use xagentauth::guard::GuardConfig;
use xagentauth::middleware::axum::{agentauth_layer, AgentAuthToken};

async fn handler(token: AgentAuthToken) -> String {
    format!("Hello, agent {}", token.0.model_family)
}

let config = GuardConfig::new("your-shared-secret");
let app = Router::new()
    .route("/protected", get(handler))
    .layer(agentauth_layer(config));
```

The `AgentAuthToken` extractor gives handlers direct access to verified claims.

### Actix Middleware

Requires `features = ["actix"]`.

```rust
use actix_web::{web, App, HttpServer, HttpResponse};
use xagentauth::guard::GuardConfig;
use xagentauth::middleware::actix::{AgentAuthMiddleware, AgentAuthToken};

async fn handler(token: AgentAuthToken) -> HttpResponse {
    HttpResponse::Ok().body(format!("Hello, agent {}", token.0.model_family))
}

let config = GuardConfig::new("your-shared-secret");
HttpServer::new(move || {
    App::new()
        .wrap(AgentAuthMiddleware::new(config.clone()))
        .route("/protected", web::get().to(handler))
})
.bind("127.0.0.1:8080")?
.run()
.await?;
```

## WASM Support

The crate supports compilation to WebAssembly via `wasm-pack`:

```bash
# Requires wasm-pack: cargo install wasm-pack
./build-wasm.sh
```

```javascript
import { WasmAgentAuthClient, wasm_hmac_sha256_hex } from './pkg/xagentauth.js';

const client = new WasmAgentAuthClient('https://api.example.com', 'ak_...');
const result = await client.initChallenge('medium');
const hmac = client.computeHmac(answer, sessionToken);
```

## Features

- Async client with `reqwest` (native) or `fetch` (WASM)
- Full challenge flow: init -> get -> solve -> verify -> authenticate
- Auto-HMAC computation on solve requests
- AgentAuth response header parsing
- WASM bindings via `wasm-bindgen`
- **Local JWT verification** (HS256, no network call)
- **Axum Tower layer** with claims extractor
- **Actix middleware** with claims extractor

## License

MIT
