import { Link, useLocation } from 'react-router'

interface SidebarSection {
  title: string
  items: Array<{ label: string; to: string; external?: boolean }>
}

const sections: SidebarSection[] = [
  {
    title: 'Getting Started',
    items: [
      { label: 'Overview', to: '/docs' },
      { label: 'Quickstart', to: '/docs/quickstart' },
      { label: 'Protecting Endpoints', to: '/docs/protecting-endpoints' },
    ],
  },
  {
    title: 'Concepts',
    items: [
      { label: 'How It Works', to: '/docs/concepts' },
    ],
  },
  {
    title: 'SDKs',
    items: [
      { label: 'TypeScript', to: '/docs/sdk/typescript' },
      { label: 'Python', to: '/docs/sdk/python' },
      { label: 'Rust', to: '/docs/sdk/rust' },
      { label: 'Go', to: '/docs/sdk/go' },
    ],
  },
  {
    title: 'Tools',
    items: [
      { label: 'CLI Reference', to: '/docs/cli' },
    ],
  },
  {
    title: 'Deployment',
    items: [
      { label: 'Self-Hosting', to: '/docs/self-hosting' },
    ],
  },
  {
    title: 'Reference',
    items: [
      { label: 'API Reference', to: '/api-reference', external: true },
    ],
  },
]

export function DocsSidebar() {
  const { pathname } = useLocation()

  return (
    <aside className="w-56 shrink-0 hidden lg:block">
      <nav className="sticky top-[84px] space-y-6 pr-4">
        {sections.map((section) => (
          <div key={section.title}>
            <h4 className="text-xs font-heading font-semibold text-zinc-500 uppercase tracking-widest mb-2">
              {section.title}
            </h4>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = item.to === '/docs'
                  ? pathname === '/docs'
                  : pathname.startsWith(item.to)
                return (
                  <li key={item.to}>
                    {item.external ? (
                      <a
                        href={item.to}
                        className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-zinc-500 hover:text-white hover:bg-white/[0.04] transition-colors"
                      >
                        {item.label}
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-40">
                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                          <polyline points="15 3 21 3 21 9" />
                          <line x1="10" y1="14" x2="21" y2="3" />
                        </svg>
                      </a>
                    ) : (
                      <Link
                        to={item.to}
                        className={`block rounded-md px-3 py-1.5 text-sm transition-colors ${
                          isActive
                            ? 'text-white bg-white/[0.06] font-medium'
                            : 'text-zinc-500 hover:text-white hover:bg-white/[0.04]'
                        }`}
                      >
                        {item.label}
                      </Link>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  )
}
