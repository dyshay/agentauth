import { Routes, Route } from 'react-router'
import { Layout } from './components/layout'
import { LandingPage } from './pages/landing'
import { LeaderboardPage } from './pages/leaderboard'

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />
      </Route>
    </Routes>
  )
}
