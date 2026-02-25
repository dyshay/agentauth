import { Routes, Route } from 'react-router'
import { Layout } from './components/layout'
import { DocsLayout } from './components/docs/docs-layout'
import { LandingPage } from './pages/landing'
import { LeaderboardPage } from './pages/leaderboard'
import { DocsIndex } from './pages/docs/index'
import { DocsQuickstart } from './pages/docs/quickstart'
import { DocsConcepts } from './pages/docs/concepts'
import { DocsSdk } from './pages/docs/sdk'
import { DocsSelfHosting } from './pages/docs/self-hosting'

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />
        <Route path="/docs" element={<DocsLayout />}>
          <Route index element={<DocsIndex />} />
          <Route path="quickstart" element={<DocsQuickstart />} />
          <Route path="concepts" element={<DocsConcepts />} />
          <Route path="sdk/:name" element={<DocsSdk />} />
          <Route path="self-hosting" element={<DocsSelfHosting />} />
        </Route>
      </Route>
    </Routes>
  )
}
