import type { ReactNode } from 'react'

export function Prose({ children }: { children: ReactNode }) {
  return (
    <div className="prose-docs max-w-none text-zinc-300 leading-relaxed [&_h1]:text-3xl [&_h1]:font-heading [&_h1]:font-bold [&_h1]:text-white [&_h1]:mb-4 [&_h1]:tracking-tight [&_h2]:text-xl [&_h2]:font-heading [&_h2]:font-semibold [&_h2]:text-white [&_h2]:mt-12 [&_h2]:mb-4 [&_h2]:tracking-tight [&_h3]:text-lg [&_h3]:font-heading [&_h3]:font-semibold [&_h3]:text-white [&_h3]:mt-8 [&_h3]:mb-3 [&_p]:mb-4 [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:mb-1.5 [&_li]:text-zinc-400 [&_a]:text-brand [&_a]:underline [&_a]:underline-offset-2 [&_a:hover]:text-emerald-300 [&_strong]:text-white [&_strong]:font-semibold [&_code]:rounded [&_code]:bg-white/[0.06] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-sm [&_code]:font-mono [&_code]:text-emerald-300 [&_hr]:border-white/[0.06] [&_hr]:my-8 [&_table]:w-full [&_table]:text-sm [&_th]:text-left [&_th]:text-zinc-400 [&_th]:font-heading [&_th]:font-semibold [&_th]:pb-3 [&_th]:border-b [&_th]:border-white/[0.08] [&_td]:py-2.5 [&_td]:border-b [&_td]:border-white/[0.04] [&_td]:text-zinc-400">
      {children}
    </div>
  )
}
