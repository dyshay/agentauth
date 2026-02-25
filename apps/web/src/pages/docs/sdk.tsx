import { useParams, Link } from 'react-router'
import { Prose } from '../../components/docs/prose'
import { CodeBlock } from '../../components/docs/code-block'

const sdkData: Record<string, {
  name: string
  package: string
  install: string
  installLang: string
  usage: string
  usageLang: string
  status: 'stable' | 'beta' | 'planned'
}> = {
  typescript: {
    name: 'TypeScript',
    package: '@xagentauth/client',
    install: 'npm install @xagentauth/client',
    installLang: 'bash',
    usage: `import { AgentAuthClient } from '@xagentauth/client'

const client = new AgentAuthClient({
  serverUrl: 'https://your-server.com',
})

// Full authentication flow
const token = await client.authenticate()

// Or step by step
const challenge = await client.getChallenge()
const result = await client.solveChallenge(challenge.id, {
  answer: 'your-answer',
  hmac: 'computed-hmac',
})

// Verify an existing token
const verified = await client.verifyToken(token)
console.log(verified.capabilities)`,
    usageLang: 'typescript',
    status: 'stable',
  },
  python: {
    name: 'Python',
    package: 'xagentauth',
    install: `pip install xagentauth

# With FastAPI server middleware
pip install xagentauth[fastapi]

# With Flask server middleware
pip install xagentauth[flask]

# With LangChain integration
pip install xagentauth[langchain]

# All extras
pip install xagentauth[all]`,
    installLang: 'bash',
    usage: `import asyncio
from xagentauth import AgentAuthClient

async def main():
    client = AgentAuthClient(
        base_url="https://api.example.com",
        api_key="ak_...",
    )

    # One-call flow: init -> get -> solve
    result = await client.authenticate(
        difficulty="medium",
        solver=my_solver,
    )

    print(f"Token: {result.token}")
    print(f"Score: {result.score}")

    # Or step by step
    init = await client.init_challenge(difficulty="hard")
    challenge = await client.get_challenge(init.id, init.session_token)
    answer = await compute_answer(challenge.payload)
    result = await client.solve(init.id, answer, init.session_token)

asyncio.run(main())

# --- Server-side: protect your API routes ---

from fastapi import Depends, FastAPI
from xagentauth.middleware.fastapi import agentauth_guard
from xagentauth.token import AgentAuthClaims

app = FastAPI()

@app.get("/api/data", dependencies=[Depends(agentauth_guard("secret"))])
def get_data():
    return {"message": "Hello, verified agent!"}

@app.get("/api/profile")
def profile(claims: AgentAuthClaims = Depends(agentauth_guard("secret"))):
    return {"model": claims.model_family}`,
    usageLang: 'python',
    status: 'stable',
  },
  rust: {
    name: 'Rust',
    package: 'xagentauth',
    install: `cargo add xagentauth

# With Axum middleware
cargo add xagentauth --features axum

# With Actix middleware
cargo add xagentauth --features actix`,
    installLang: 'bash',
    usage: `use xagentauth::{AgentAuthClient, ClientConfig, Difficulty};

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

// --- Server-side: protect your Axum routes ---

use axum::{routing::get, Router};
use xagentauth::guard::GuardConfig;
use xagentauth::middleware::axum::{agentauth_layer, AgentAuthToken};

async fn handler(token: AgentAuthToken) -> String {
    format!("Hello, {} (model: {})", token.0.sub, token.0.model_family)
}

let config = GuardConfig::new("secret").with_min_score(0.7);
let app = Router::new()
    .route("/api/data", get(handler))
    .layer(agentauth_layer(config));`,
    usageLang: 'rust',
    status: 'stable',
  },
  go: {
    name: 'Go',
    package: 'github.com/dyshay/agentauth/sdks/go',
    install: `go get github.com/dyshay/agentauth/sdks/go

# With Gin middleware
go get github.com/dyshay/agentauth/sdks/go/ginauth`,
    installLang: 'bash',
    usage: `package main

import (
    "fmt"
    "log"
    "net/http"

    "github.com/dyshay/agentauth/sdks/go"
)

func main() {
    client := xagentauth.NewClient(xagentauth.ClientConfig{
        BaseURL:   "https://auth.example.com",
        APIKey:    "your-api-key",
        TimeoutMs: 30000,
    })

    // Define a solver function
    solver := func(challenge xagentauth.ChallengeResponse) (string, map[string]string, error) {
        answer := solveChallenge(challenge.Payload)
        return answer, nil, nil
    }

    // One-call flow
    result, err := client.Authenticate(
        xagentauth.DifficultyMedium,
        []xagentauth.ChallengeDimension{
            xagentauth.DimensionReasoning,
            xagentauth.DimensionExecution,
        },
        solver,
    )
    if err != nil {
        log.Fatalf("Authentication failed: %v", err)
    }

    if result.Success {
        fmt.Printf("Token: %s\\n", *result.Token)
    }

    // --- Server-side: protect your routes (stdlib only) ---

    mux := http.NewServeMux()
    mux.HandleFunc("/api/data", func(w http.ResponseWriter, r *http.Request) {
        claims := xagentauth.ClaimsFromContext(r.Context())
        fmt.Fprintf(w, "Hello, %s (model: %s)", claims.Sub, claims.ModelFamily)
    })

    protected := xagentauth.AgentAuthMiddleware(xagentauth.GuardConfig{
        Secret:   "your-secret",
        MinScore: 0.7,
    })(mux)

    http.ListenAndServe(":3000", protected)
}`,
    usageLang: 'go',
    status: 'stable',
  },
}

export function DocsSdk() {
  const { name } = useParams<{ name: string }>()
  const sdk = name ? sdkData[name] : undefined

  if (!sdk) {
    return (
      <Prose>
        <h1>SDK Not Found</h1>
        <p>The SDK "{name}" does not exist. Available SDKs:</p>
        <ul>
          {Object.entries(sdkData).map(([key, s]) => (
            <li key={key}><Link to={`/docs/sdk/${key}`}>{s.name}</Link></li>
          ))}
        </ul>
      </Prose>
    )
  }

  return (
    <Prose>
      <h1>{sdk.name} SDK</h1>
      <p>
        {sdk.status === 'stable' && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
            Stable
          </span>
        )}
        {sdk.status === 'beta' && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 text-xs font-medium text-amber-400">
            Beta
          </span>
        )}
        {sdk.status === 'planned' && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-500/10 border border-zinc-500/20 px-2.5 py-0.5 text-xs font-medium text-zinc-400">
            Planned
          </span>
        )}
      </p>

      <h2>Installation</h2>
      <CodeBlock lang={sdk.installLang} code={sdk.install} />

      <h2>Usage</h2>
      <CodeBlock lang={sdk.usageLang} code={sdk.usage} filename={sdk.status === 'planned' ? `example (preview)` : undefined} />

      {sdk.status === 'planned' && (
        <p>
          This SDK is planned but not yet available. The API shown above is a preview of the
          intended interface. Contributions welcome on{' '}
          <a href="https://github.com/dyshay/agentauth" target="_blank" rel="noopener noreferrer">GitHub</a>.
        </p>
      )}
    </Prose>
  )
}
