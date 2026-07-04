/** The differentiator page: real cost accounting + live eval results. */
import { useEffect, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api, type EvalRun, type UsageRow, type UsageTotals } from '../lib/api'

export default function Insights() {
  const [totals, setTotals] = useState<UsageTotals | null>(null)
  const [rows, setRows] = useState<UsageRow[]>([])
  const [evals, setEvals] = useState<EvalRun | null>(null)

  useEffect(() => {
    api<{ totals: UsageTotals; breakdown: UsageRow[] }>('/api/insights/usage')
      .then((u) => { setTotals(u.totals); setRows(u.breakdown) }).catch(() => {})
    api<EvalRun>('/api/insights/evals').then(setEvals).catch(() => {})
  }, [])

  const chart = rows.map((r) => ({
    name: r.endpoint.replace('/api/', '').replace('agents/', ''),
    cost: Number((r.cost_usd * 1000).toFixed(4)),   // show in thousandths of a dollar
    requests: r.requests,
  }))

  const stat = (label: string, value: string, accent = false) => (
    <div className="rounded-lg border border-edge bg-panel px-5 py-4">
      <p className="font-mono text-[11px] uppercase tracking-widest text-zinc-500">{label}</p>
      <p className={`mt-1.5 font-mono text-2xl ${accent ? 'text-accent' : 'text-zinc-100'}`}>{value}</p>
    </div>
  )

  return (
    <div className="mx-auto max-w-4xl px-8 py-10">
      <p className="font-mono text-xs uppercase tracking-[0.25em] text-zinc-500">insights</p>
      <h2 className="mt-1 text-2xl font-semibold text-zinc-100">Metered and evaluated.</h2>
      <p className="mt-2 max-w-xl text-sm text-zinc-500">
        Every LLM request in this workspace, with list-price cost equivalents. The eval suite
        runs LLM-as-judge over the RAG pipeline — including questions it must refuse to answer.
      </p>

      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stat('requests', String(totals?.requests ?? '—'))}
        {stat('tokens in', (totals?.tokens_in ?? 0).toLocaleString())}
        {stat('tokens out', (totals?.tokens_out ?? 0).toLocaleString())}
        {stat('total cost', totals ? `$${totals.cost_usd.toFixed(5)}` : '—', true)}
      </div>

      {chart.length > 0 && (
        <div className="mt-8 rounded-lg border border-edge bg-panel p-5">
          <h3 className="mb-4 font-mono text-[11px] uppercase tracking-widest text-zinc-500">
            cost by endpoint (m$ = thousandths of a dollar)
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chart}>
              <CartesianGrid stroke="#26262b" vertical={false} />
              <XAxis dataKey="name" stroke="#52525b" fontSize={11} tickLine={false} />
              <YAxis stroke="#52525b" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip cursor={{ fill: '#18181b' }}
                contentStyle={{ background: '#101012', border: '1px solid #26262b', borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="cost" name="cost (m$)" fill="#34d399" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="mt-8 rounded-lg border border-edge bg-panel p-5">
        <div className="flex items-baseline justify-between">
          <h3 className="font-mono text-[11px] uppercase tracking-widest text-zinc-500">evaluation suite</h3>
          {evals?.score != null && (
            <span className="font-mono text-lg text-accent">{evals.score}/{evals.total}</span>
          )}
        </div>
        <ul className="mt-4 divide-y divide-edge/60">
          {(evals?.cases ?? []).map((c, i) => (
            <li key={i} className="py-3">
              <div className="flex items-start gap-3">
                <span className={`mt-0.5 font-mono text-[11px] ${c.pass ? 'text-accent' : 'text-red-400'}`}>
                  {c.pass ? 'PASS' : 'FAIL'}
                </span>
                <div className="min-w-0">
                  <p className="text-sm text-zinc-200">{c.question}</p>
                  <p className="mt-1 line-clamp-2 text-[12px] text-zinc-500">{c.got}</p>
                </div>
              </div>
            </li>
          ))}
          {(!evals || evals.cases.length === 0) && (
            <li className="py-3 text-sm text-zinc-600">No eval run recorded yet.</li>
          )}
        </ul>
      </div>
    </div>
  )
}
