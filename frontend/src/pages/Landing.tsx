/** The portfolio page. Staged reveal, live status from the real API,
 *  architecture as an honest SVG — no stock imagery anywhere. */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { api, type EvalRun } from '../lib/api'

/** Staged-reveal helper: plain initial/animate objects (the variants+custom
 *  pattern silently fails to start in some browsers with React 19). */
const rise = (i: number) => ({
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { delay: 0.12 * i, duration: 0.5 },
})

export default function Landing() {
  const [evals, setEvals] = useState<EvalRun | null>(null)
  const [health, setHealth] = useState<string>('checking')

  useEffect(() => {
    api<EvalRun>('/api/insights/evals').then(setEvals).catch(() => {})
    api<{ status: string }>('/api/health')
      .then((h) => setHealth(h.status))
      .catch(() => setHealth('offline'))
  }, [])

  return (
    <div className="min-h-screen atmosphere">
      <div className="mx-auto max-w-5xl px-5 pt-16 pb-16 sm:px-6 sm:pt-24 sm:pb-20">
        {/* hero */}
        <motion.p {...rise(0)}
          className="font-mono text-xs tracking-[0.25em] text-accent uppercase">
          careeragent — a working ai system, not a mockup
        </motion.p>
        <motion.h1 {...rise(1)}
          className="mt-5 max-w-3xl text-4xl font-semibold leading-[1.05] tracking-tight text-zinc-50 sm:text-6xl">
          Agents for the job hunt.
        </motion.h1>
        <motion.p {...rise(2)}
          className="mt-6 max-w-xl text-lg leading-relaxed text-zinc-400">
          Chat with a CV — with citations. Research companies live on the web.
          Tailor bullets to any job description, anchored to real evidence.
          Every request metered, every answer evaluated.
        </motion.p>

        <motion.div {...rise(3)}
          className="mt-10 flex flex-wrap items-center gap-4">
          <Link to="/chat"
            className="rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-zinc-950 transition hover:brightness-110">
            Try the live demo →
          </Link>
          <a href="https://github.com/hharsha98/careeragent" target="_blank" rel="noreferrer"
            className="rounded-md border border-edge px-5 py-2.5 text-sm text-zinc-300 transition hover:border-zinc-500">
            Read the code
          </a>
          <span className="ml-2 font-mono text-xs text-zinc-500">
            <i className={`mr-1.5 inline-block h-2 w-2 rounded-full ${health === 'ok' ? 'bg-accent' : 'bg-red-400'}`} />
            api {health}
            {evals?.score != null && (
              <> · eval <span className="text-accent">{evals.score}/{evals.total}</span></>
            )}
          </span>
        </motion.div>

        {/* architecture — drawn, not stocked */}
        <motion.div {...rise(4)} className="mt-24">
          <h2 className="font-mono text-xs uppercase tracking-[0.25em] text-zinc-500">architecture</h2>
          <div className="mt-4 overflow-x-auto rounded-lg border border-edge bg-panel p-6">
            <svg viewBox="0 0 720 190" className="min-w-[640px] w-full font-mono text-[11px]">
              {[
                { x: 10, label: 'React + Vite', sub: 'Cloudflare Pages' },
                { x: 195, label: 'FastAPI', sub: 'Docker · HF Spaces · k8s' },
                { x: 380, label: 'Postgres + pgvector', sub: 'Supabase' },
                { x: 565, label: 'Mistral / Groq / Tavily', sub: 'free tiers, keys server-side' },
              ].map((b) => (
                <g key={b.x}>
                  <rect x={b.x} y={60} width={145} height={62} rx={8}
                    className="fill-ink stroke-edge" strokeWidth={1.25} />
                  <text x={b.x + 72} y={86} textAnchor="middle" className="fill-zinc-200">{b.label}</text>
                  <text x={b.x + 72} y={106} textAnchor="middle" className="fill-zinc-500">{b.sub}</text>
                </g>
              ))}
              {[155, 340, 525].map((x) => (
                <g key={x} className="stroke-emerald-400/70">
                  <line x1={x} y1={91} x2={x + 40} y2={91} strokeWidth={1.25} />
                  <polygon points={`${x + 40},91 ${x + 33},87 ${x + 33},95`} className="fill-emerald-400/70" />
                </g>
              ))}
              <text x={360} y={30} textAnchor="middle" className="fill-zinc-500">
                SSE streaming · JWT auth · per-IP rate limits · /docs disabled in prod
              </text>
              <text x={360} y={165} textAnchor="middle" className="fill-zinc-600">
                RAG chat · research agent (tool loop) · tailor agent · LLM-as-judge evals · cost metering
              </text>
            </svg>
          </div>
        </motion.div>

        {/* what makes it different — three asymmetric rows, not a card grid */}
        <div className="mt-20 space-y-10">
          {[
            ['Evaluated, not vibed', 'An LLM-as-judge suite scores the RAG pipeline on every deploy — including trick questions where the right answer is "I don\'t know". Current score is live above.'],
            ['Metered to the cent', 'Every request logs tokens, latency and list-price cost to the database. The Insights page charts it. Free tiers, real accounting.'],
            ['Locked down by default', 'API docs disabled in production, CORS pinned to one origin, per-IP rate limits, secrets never leave the server, demo sandboxed from real data.'],
          ].map(([title, body], i) => (
            <motion.div key={title} initial={{ opacity: 0, x: -14 }} whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }} transition={{ duration: 0.45 }}
              className={`max-w-xl ${i % 2 ? 'ml-auto text-right' : ''}`}>
              <h3 className="text-lg font-semibold text-zinc-100">
                <span className="font-mono text-accent mr-2">0{i + 1}</span>{title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">{body}</p>
            </motion.div>
          ))}
        </div>

        <footer className="mt-24 border-t border-edge/60 pt-6 font-mono text-xs text-zinc-600">
          built by Harsha · FastAPI · React · pgvector · no agent framework, on purpose
        </footer>
      </div>
    </div>
  )
}
