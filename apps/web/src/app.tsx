import { Routes, Route } from 'react-router'

export function App() {
  return (
    <Routes>
      <Route path="/" element={<div>Landing page</div>} />
      <Route path="/leaderboard" element={<div>Leaderboard</div>} />
    </Routes>
  )
}
