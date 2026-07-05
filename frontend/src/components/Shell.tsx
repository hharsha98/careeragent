/** App chrome: left rail on desktop, compact top bar on phones. */
import { NavLink, Outlet } from 'react-router-dom'

const tabs = [
  { to: '/chat', label: 'Chat', glyph: '❯_' },
  { to: '/tracker', label: 'Tracker', glyph: '▦' },
  { to: '/insights', label: 'Insights', glyph: '∑' },
]

export default function Shell() {
  return (
    <div className="h-dvh atmosphere flex flex-col md:flex-row">
      {/* top bar (mobile) / left rail (desktop) */}
      <aside className="shrink-0 border-b border-edge/70 px-3 py-2 flex items-center gap-1 overflow-x-auto
                        md:w-48 md:flex-col md:items-stretch md:border-b-0 md:border-r md:px-4 md:py-6">
        <NavLink to="/" className="mr-2 shrink-0 font-semibold tracking-tight text-zinc-50 md:mb-8 md:mr-0">
          Career<span className="text-accent">Agent</span>
        </NavLink>
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            className={({ isActive }) =>
              `flex shrink-0 items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors md:gap-3 md:py-2 ${
                isActive
                  ? 'bg-accent-dim text-accent'
                  : 'text-zinc-400 hover:text-zinc-100 hover:bg-panel'
              }`
            }
          >
            <span className="hidden font-mono text-xs md:inline md:w-5">{t.glyph}</span>
            {t.label}
          </NavLink>
        ))}
        <div className="mt-auto hidden rounded-md border border-edge bg-panel px-3 py-2.5 text-[11px] leading-relaxed text-zinc-500 md:block">
          <span className="text-accent font-mono">demo</span> workspace — synthetic
          candidate, rate-limited, resets daily.
        </div>
      </aside>
      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
