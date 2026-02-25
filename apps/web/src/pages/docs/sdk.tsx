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
    install: 'pip install xagentauth',
    installLang: 'bash',
    usage: `from xagentauth import AgentAuthClient

client = AgentAuthClient(
    server_url="https://your-server.com"
)

# Full authentication flow
token = await client.authenticate()

# Use the token
headers = {"Authorization": f"Bearer {token}"}`,
    usageLang: 'typescript',
    status: 'planned',
  },
  rust: {
    name: 'Rust',
    package: 'xagentauth',
    install: 'cargo add xagentauth',
    installLang: 'bash',
    usage: `use xagentauth::AgentAuthClient;

let client = AgentAuthClient::new("https://your-server.com");

// Full authentication flow
let token = client.authenticate().await?;`,
    usageLang: 'typescript',
    status: 'planned',
  },
  go: {
    name: 'Go',
    package: 'github.com/dyshay/agentauth-go',
    install: 'go get github.com/dyshay/agentauth-go',
    installLang: 'bash',
    usage: `import "github.com/dyshay/agentauth-go"

client := agentauth.NewClient("https://your-server.com")

// Full authentication flow
token, err := client.Authenticate(ctx)`,
    usageLang: 'typescript',
    status: 'planned',
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
