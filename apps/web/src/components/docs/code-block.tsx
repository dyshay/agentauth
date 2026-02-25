import { useEffect, useState } from 'react'

let highlighterPromise: Promise<any> | null = null

function getHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = import('shiki').then((mod) =>
      mod.createHighlighter({
        themes: ['vitesse-dark'],
        langs: ['typescript', 'bash', 'json', 'yaml', 'dockerfile'],
      }),
    )
  }
  return highlighterPromise
}

interface CodeBlockProps {
  code: string
  lang?: string
  filename?: string
}

export function CodeBlock({ code, lang = 'typescript', filename }: CodeBlockProps) {
  const [html, setHtml] = useState<string>('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    getHighlighter().then((hl) => {
      setHtml(hl.codeToHtml(code.trim(), { lang, theme: 'vitesse-dark' }))
    })
  }, [code, lang])

  function handleCopy() {
    navigator.clipboard.writeText(code.trim())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="group relative rounded-xl border border-white/[0.06] bg-surface-1 overflow-hidden my-6">
      {filename && (
        <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-2.5">
          <span className="text-xs font-mono text-zinc-500">{filename}</span>
        </div>
      )}
      <div className="relative">
        <button
          onClick={handleCopy}
          className="absolute right-3 top-3 rounded-md border border-white/[0.08] bg-surface-2 px-2.5 py-1.5 text-xs text-zinc-500 opacity-0 transition-opacity group-hover:opacity-100 hover:text-white hover:border-white/[0.15]"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
        {html ? (
          <div
            className="overflow-x-auto p-4 text-sm leading-relaxed [&_pre]:!bg-transparent [&_code]:!bg-transparent"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          <pre className="overflow-x-auto p-4 text-sm leading-relaxed text-zinc-400">
            <code>{code.trim()}</code>
          </pre>
        )}
      </div>
    </div>
  )
}
