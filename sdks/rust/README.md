# xagentauth

**AgentAuth client SDK for Rust** — authenticate AI agents against any AgentAuth-compatible server.

## Installation

```toml
[dependencies]
xagentauth = "0.1"
```

## Quickstart

```rust
use xagentauth::{AgentAuthClient, ClientConfig, Difficulty};

#[tokio::main]
async fn main() -> Result<(), xagentauth::AgentAuthError> {
    let client = AgentAuthClient::new(ClientConfig {
        base_url: "https://api.example.com".to_string(),
        api_key: Some("ak_...".to_string()),
        timeout_ms: None,
    })?;

    // One-call flow: init → get → solve
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

## WASM Support

The crate supports compilation to WebAssembly via `wasm-pack`:

```bash
# Requires wasm-pack: cargo install wasm-pack
./build-wasm.sh
```

This produces a `pkg/` directory with JS bindings:

```javascript
import { WasmAgentAuthClient, wasm_hmac_sha256_hex } from './pkg/xagentauth.js';

const client = new WasmAgentAuthClient('https://api.example.com', 'ak_...');
const result = await client.initChallenge('medium');
const hmac = client.computeHmac(answer, sessionToken);
```

## Features

- Async client with `reqwest` (native) or `fetch` (WASM)
- Full challenge flow: init → get → solve → verify → authenticate
- Auto-HMAC computation on solve requests
- AgentAuth response header parsing
- WASM bindings via `wasm-bindgen`

## License

MIT
