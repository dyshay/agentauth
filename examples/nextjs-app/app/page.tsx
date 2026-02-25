'use client'

import { useState } from 'react'

export default function Home() {
  const [result, setResult] = useState<string>('')
  const [loading, setLoading] = useState(false)

  async function runChallenge() {
    setLoading(true)
    setResult('')

    try {
      // 1. Init challenge
      const initRes = await fetch('/api/challenge/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ difficulty: 'easy' }),
      })
      const init = await initRes.json()
      setResult(prev => prev + `Challenge created: ${init.id}\n`)

      // 2. Retrieve challenge
      const challengeRes = await fetch(`/api/challenge/${init.id}`, {
        headers: { Authorization: `Bearer ${init.session_token}` },
      })
      const challenge = await challengeRes.json()
      setResult(prev => prev + `Type: ${challenge.payload.type}\n`)
      setResult(prev => prev + `Instructions: ${challenge.payload.instructions}\n\n`)
      setResult(prev => prev + `(Agent would solve the challenge here...)\n`)
    } catch (err) {
      setResult(`Error: ${err}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <p>This example demonstrates the AgentAuth challenge flow via Next.js API routes.</p>

      <button
        onClick={runChallenge}
        disabled={loading}
        style={{
          padding: '10px 20px',
          fontSize: 16,
          cursor: loading ? 'wait' : 'pointer',
          background: '#000',
          color: '#fff',
          border: 'none',
          borderRadius: 6,
        }}
      >
        {loading ? 'Running...' : 'Start Challenge'}
      </button>

      {result && (
        <pre style={{
          marginTop: 20,
          padding: 16,
          background: '#f5f5f5',
          borderRadius: 8,
          whiteSpace: 'pre-wrap',
        }}>
          {result}
        </pre>
      )}
    </div>
  )
}
