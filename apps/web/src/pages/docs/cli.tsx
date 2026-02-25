import { Prose } from '../../components/docs/prose'
import { CodeBlock } from '../../components/docs/code-block'

export function DocsCli() {
  return (
    <Prose>
      <h1>CLI Reference</h1>
      <p>
        The AgentAuth CLI lets you generate challenges, verify tokens, benchmark performance,
        and manage challenge packages — all from your terminal.
      </p>

      <h2>Installation</h2>
      <CodeBlock
        lang="bash"
        code={`npm install -g @xagentauth/cli

# Or run directly with npx
npx @xagentauth/cli <command>`}
      />

      <hr />

      <h2>agentauth generate</h2>
      <p>Generate a challenge locally for testing or debugging.</p>
      <CodeBlock
        lang="bash"
        code={`agentauth generate [options]`}
      />
      <table>
        <thead>
          <tr>
            <th>Option</th>
            <th>Description</th>
            <th>Default</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><code>-t, --type &lt;type&gt;</code></td>
            <td>Challenge type (<code>crypto-nl</code>, <code>multi-step</code>, <code>ambiguous-logic</code>, <code>code-execution</code>)</td>
            <td><code>crypto-nl</code></td>
          </tr>
          <tr>
            <td><code>-d, --difficulty &lt;level&gt;</code></td>
            <td>Difficulty level (<code>easy</code>, <code>medium</code>, <code>hard</code>)</td>
            <td><code>medium</code></td>
          </tr>
          <tr>
            <td><code>--json</code></td>
            <td>Output as JSON</td>
            <td><code>false</code></td>
          </tr>
        </tbody>
      </table>
      <h3>Example</h3>
      <CodeBlock
        lang="bash"
        code={`# Generate an easy crypto-nl challenge
agentauth generate -t crypto-nl -d easy

# Output as JSON for piping
agentauth generate --type multi-step --json`}
      />

      <hr />

      <h2>agentauth verify</h2>
      <p>Decode and verify an AgentAuth JWT token. Always decodes the payload; pass <code>--secret</code> to also verify the signature.</p>
      <CodeBlock
        lang="bash"
        code={`agentauth verify <token> [options]`}
      />
      <table>
        <thead>
          <tr>
            <th>Option</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><code>-s, --secret &lt;secret&gt;</code></td>
            <td>Secret key for signature verification</td>
          </tr>
          <tr>
            <td><code>--json</code></td>
            <td>Output as JSON</td>
          </tr>
        </tbody>
      </table>
      <h3>Example</h3>
      <CodeBlock
        lang="bash"
        code={`# Decode a token (no signature check)
agentauth verify eyJhbGciOiJIUzI1NiIs...

# Decode and verify signature
agentauth verify eyJhbGciOiJIUzI1NiIs... --secret my-secret`}
      />

      <hr />

      <h2>agentauth benchmark</h2>
      <p>Performance benchmark for challenge generation and solving. Useful for evaluating driver speed across difficulty levels.</p>
      <CodeBlock
        lang="bash"
        code={`agentauth benchmark [options]`}
      />
      <table>
        <thead>
          <tr>
            <th>Option</th>
            <th>Description</th>
            <th>Default</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><code>-t, --type &lt;type&gt;</code></td>
            <td>Challenge type</td>
            <td><code>crypto-nl</code></td>
          </tr>
          <tr>
            <td><code>-d, --difficulty &lt;level&gt;</code></td>
            <td>Difficulty level</td>
            <td><code>medium</code></td>
          </tr>
          <tr>
            <td><code>-n, --rounds &lt;count&gt;</code></td>
            <td>Number of rounds</td>
            <td><code>10</code></td>
          </tr>
          <tr>
            <td><code>--json</code></td>
            <td>Output as JSON</td>
            <td><code>false</code></td>
          </tr>
        </tbody>
      </table>
      <h3>Example</h3>
      <CodeBlock
        lang="bash"
        code={`# Benchmark crypto-nl at hard difficulty, 50 rounds
agentauth benchmark -t crypto-nl -d hard -n 50

# JSON output for CI integration
agentauth benchmark --type multi-step --rounds 100 --json`}
      />

      <hr />

      <h2>agentauth add</h2>
      <p>Install a challenge package from a local directory. The package is validated before installation.</p>
      <CodeBlock
        lang="bash"
        code={`agentauth add <source>`}
      />
      <table>
        <thead>
          <tr>
            <th>Argument</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><code>&lt;source&gt;</code></td>
            <td>Path to the challenge package directory</td>
          </tr>
        </tbody>
      </table>
      <h3>Example</h3>
      <CodeBlock
        lang="bash"
        code={`agentauth add ./my-custom-challenge`}
      />

      <hr />

      <h2>agentauth list</h2>
      <p>List all installed challenge packages with their metadata.</p>
      <CodeBlock
        lang="bash"
        code={`agentauth list [options]`}
      />
      <table>
        <thead>
          <tr>
            <th>Option</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><code>--json</code></td>
            <td>Output as JSON</td>
          </tr>
        </tbody>
      </table>
      <h3>Example</h3>
      <CodeBlock
        lang="bash"
        code={`# Human-readable list
agentauth list

# JSON for scripting
agentauth list --json`}
      />

      <hr />

      <h2>agentauth search</h2>
      <p>Search installed challenge packages by query string.</p>
      <CodeBlock
        lang="bash"
        code={`agentauth search <query> [options]`}
      />
      <table>
        <thead>
          <tr>
            <th>Argument / Option</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><code>&lt;query&gt;</code></td>
            <td>Search query</td>
          </tr>
          <tr>
            <td><code>--json</code></td>
            <td>Output as JSON</td>
          </tr>
        </tbody>
      </table>
      <h3>Example</h3>
      <CodeBlock
        lang="bash"
        code={`agentauth search "crypto"
agentauth search "reasoning" --json`}
      />

      <hr />

      <h2>agentauth publish</h2>
      <p>Validate and prepare a challenge package for publishing. Use <code>--dry-run</code> to check validity without publishing.</p>
      <CodeBlock
        lang="bash"
        code={`agentauth publish [dir] [options]`}
      />
      <table>
        <thead>
          <tr>
            <th>Argument / Option</th>
            <th>Description</th>
            <th>Default</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><code>[dir]</code></td>
            <td>Package directory</td>
            <td><code>.</code> (current directory)</td>
          </tr>
          <tr>
            <td><code>--dry-run</code></td>
            <td>Validate only, do not publish</td>
            <td><code>false</code></td>
          </tr>
        </tbody>
      </table>
      <h3>Example</h3>
      <CodeBlock
        lang="bash"
        code={`# Validate the current directory
agentauth publish --dry-run

# Validate a specific package
agentauth publish ./my-challenge --dry-run`}
      />
    </Prose>
  )
}
