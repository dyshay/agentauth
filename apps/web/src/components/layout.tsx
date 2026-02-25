import { Outlet } from 'react-router'
import { Header } from './header'
import { Footer } from './footer'

export function Layout() {
  return (
    <div className="noise-overlay min-h-screen bg-surface-0 text-white font-body">
      <div className="dot-grid fixed inset-0 -z-10 pointer-events-none" />
      <Header />
      <main className="pt-[72px]">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
