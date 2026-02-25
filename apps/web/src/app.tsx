import { Routes, Route } from 'react-router'
import { Layout } from './components/layout'

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<div className="p-20 text-center">Landing page</div>} />
        <Route path="/leaderboard" element={<div className="p-20 text-center">Leaderboard</div>} />
      </Route>
    </Routes>
  )
}
