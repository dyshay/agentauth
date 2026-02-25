export const metadata = {
  title: 'AgentAuth Next.js Example',
  description: 'AI agent authentication with AgentAuth',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 800, margin: '0 auto', padding: 20 }}>
        <h1>AgentAuth Next.js Example</h1>
        {children}
      </body>
    </html>
  )
}
