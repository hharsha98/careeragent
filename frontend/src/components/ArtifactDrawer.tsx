/** Slide-over drawer for one application card: run agents, read artifacts. */
import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { api, type Application, type Artifact } from '../lib/api'

function ResearchView({ c }: { c: Record<string, unknown> }) {
  const list = (k: string) => (c[k] as string[] | undefined) ?? []
  return (
    <div className="space-y-4 text-sm">
      <p className="leading-relaxed text-zinc-300">{String(c.summary ?? '')}</p>
      {(['products', 'recent_news', 'tech_stack', 'talking_points'] as const).map(
        (k) => list(k).length > 0 && (
          <div key={k}>
            <h5 className="font-mono text-[11px] uppercase tracking-widest text-zinc-500">{k.replace('_', ' ')}</h5>
            <ul className="mt-1.5 list-inside list-disc space-y-1 text-zinc-300">
              {list(k).map((x) => <li key={x}>{x}</li>)}
            </ul>
          </div>
        ),
      )}
      {list('sources').length > 0 && (
        <p className="font-mono text-[11px] text-zinc-500">{list('sources').length} sources</p>
      )}
    </div>
  )
}

function TailorView({ c }: { c: Record<string, unknown> }) {
  const bullets = (c.bullets as { text: string; evidence: string }[] | undefined) ?? []
  const gaps = (c.gaps as string[] | undefined) ?? []
  return (
    <div className="space-y-4 text-sm">
      {bullets.map((b, i) => (
        <div key={i} className="rounded-md border border-edge bg-ink px-3 py-2.5">
          <p className="text-zinc-200">• {b.text}</p>
          <p className="mt-1.5 border-l-2 border-accent/40 pl-2 text-[12px] italic text-zinc-500">
            evidence: “{b.evidence}”
          </p>
        </div>
      ))}
      {gaps.length > 0 && (
        <div>
          <h5 className="font-mono text-[11px] uppercase tracking-widest text-amber-400/80">honest gaps</h5>
          <ul className="mt-1.5 list-inside list-disc space-y-1 text-zinc-400">
            {gaps.map((g) => <li key={g}>{g}</li>)}
          </ul>
        </div>
      )}
    </div>
  )
}

export default function ArtifactDrawer({ app, onClose }: { app: Application | null; onClose: () => void }) {
  const [artifacts, setArtifacts] = useState<Artifact[]>([])
  const [running, setRunning] = useState<'research' | 'tailor' | null>(null)
  const [jd, setJd] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(() => {
    if (app) api<Artifact[]>(`/api/applications/${app.id}/artifacts`).then(setArtifacts).catch(() => {})
  }, [app])
  useEffect(() => { setArtifacts([]); setError(''); load() }, [load])

  async function run(kind: 'research' | 'tailor') {
    if (!app) return
    setRunning(kind)
    setError('')
    try {
      await api(`/api/agents/${kind}`, {
        method: 'POST',
        body: JSON.stringify({ application_id: app.id, ...(kind === 'tailor' && jd.trim() ? { jd_text: jd } : {}) }),
      })
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setRunning(null)
    }
  }

  return (
    <AnimatePresence>
      {app && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose} className="fixed inset-0 z-40 bg-black/60" />
          <motion.aside
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.25 }}
            className="fixed right-0 top-0 z-50 h-full w-full max-w-lg overflow-y-auto border-l border-edge bg-panel px-6 py-6">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-zinc-50">{app.company}</h3>
                <p className="text-sm text-zinc-400">{app.role}</p>
              </div>
              <button onClick={onClose} className="font-mono text-zinc-500 hover:text-zinc-200">✕</button>
            </div>

            <div className="mt-5 flex gap-2">
              <button onClick={() => run('research')} disabled={running !== null}
                className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-zinc-950 transition enabled:hover:brightness-110 disabled:opacity-40">
                {running === 'research' ? 'Researching… (~20s)' : 'Run research'}
              </button>
              <button onClick={() => run('tailor')} disabled={running !== null}
                className="rounded-md border border-edge px-4 py-2 text-sm text-zinc-200 transition enabled:hover:border-accent/50 disabled:opacity-40">
                {running === 'tailor' ? 'Tailoring…' : 'Tailor CV'}
              </button>
            </div>
            <textarea value={jd} onChange={(e) => setJd(e.target.value)} rows={3}
              placeholder="Optional: paste the job description here for tailoring…"
              className="mt-3 w-full rounded-md border border-edge bg-ink px-3 py-2 text-sm text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-accent/60" />
            {error && <p className="mt-2 text-sm text-red-400">{error}</p>}

            <div className="mt-6 space-y-5">
              {artifacts.map((a) => (
                <div key={a.id} className="rounded-lg border border-edge bg-ink/60 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className={`font-mono text-[11px] uppercase tracking-widest ${a.type === 'research' ? 'text-accent' : 'text-sky-400'}`}>
                      {a.type}
                    </span>
                    <span className="font-mono text-[11px] text-zinc-500">
                      {a.model} · <span className="text-cost">${Number(a.cost_usd).toFixed(4)}</span>
                    </span>
                  </div>
                  {a.type === 'research' ? <ResearchView c={a.content} /> : <TailorView c={a.content} />}
                </div>
              ))}
              {artifacts.length === 0 && (
                <p className="text-sm text-zinc-600">No artifacts yet — run an agent above.</p>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
