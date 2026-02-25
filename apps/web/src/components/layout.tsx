import { Outlet } from 'react-router'
import { Header } from './header'
import { Footer } from './footer'

export function Layout() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <Header />
      <main className="pt-16">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
