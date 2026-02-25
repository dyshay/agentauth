import { Outlet } from 'react-router'
import { DocsSidebar } from './docs-sidebar'

export function DocsLayout() {
  return (
    <div className="mx-auto flex max-w-5xl gap-10 px-6 py-12">
      <DocsSidebar />
      <article className="min-w-0 flex-1">
        <Outlet />
      </article>
    </div>
  )
}
