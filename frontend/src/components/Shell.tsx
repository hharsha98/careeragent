/** App chrome for the three tool pages: left rail nav + demo banner. */
import { NavLink, Outlet } from 'react-router-dom'

const tabs = [
  { to: '/chat', label: 'Chat', glyph: '❯_' },
  { to: '/tracker', label: 'Tracker', glyph: '▦' },
  { to: '/insights', label: 'Insights', glyph: '∑' },
]

export default function Shell() {
  return (
    <div className="min-h-screen atmosphere flex">
      <aside className="w-48 shrink-0 border-r border-edge/70 px-4 py-6 flex flex-col gap-1">
        <NavLink to="/" className="mb-8 block font-semibold tracking-tight text-zinc-50">
          Career<span className="text-accent">Agent</span>
        </NavLink>
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                isActive
                  ? 'bg-accent-dim text-accent'
                  : 'text-zinc-400 hover:text-zinc-100 hover:bg-panel'
              }`
            }
          >
            <span className="font-mono text-xs w-5">{t.glyph}</span>
            {t.label}
          </NavLink>
        ))}
        <div className="mt-auto rounded-md border border-edge bg-panel px-3 py-2.5 text-[11px] leading-relaxed text-zinc-500">
          <span className="text-accent font-mono">demo</span> workspace — synthetic
          candidate, rate-limited, resets daily.
        </div>
      </aside>
      <main className="min-w-0 flex-1">
        <Outlet />
      </main>
    </div>
  )
}
