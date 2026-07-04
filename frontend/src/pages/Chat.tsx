/** RAG chat: streaming tokens, citation chips, per-answer cost readout,
 *  document sidebar with upload. */
import { useEffect, useRef, useState } from 'react'
import { api, type Doc } from '../lib/api'
import { streamChat } from '../lib/sse'

type Source = { n: number; source: string; page: number }
type Usage = { model: string; tokens_in: number; tokens_out: number; cost_usd: number; latency_ms: number }
type Msg = { role: 'user' | 'ai'; text: string; sources?: Source[]; usage?: Usage; streaming?: boolean }

const SUGGESTIONS = [
  'What did the candidate build at RoboLogistics?',
  'Which skills match an AI Engineer role?',
  'Does the candidate know Kubernetes?',
]

/** Render "…text [1] more [2]" with citation chips. */
function WithCitations({ text, sources }: { text: string; sources?: Source[] }) {
  const parts = text.split(/(\[\d+\])/g)
  return (
    <>
      {parts.map((p, i) => {
        const m = p.match(/^\[(\d+)\]$/)
        if (!m) return <span key={i}>{p}</span>
        const src = sources?.find((s) => s.n === Number(m[1]))
        return (
          <span key={i} title={src ? `${src.source} — page ${src.page}` : 'source'}
            className="mx-0.5 inline-block rounded bg-accent-dim px-1.5 font-mono text-[11px] text-accent align-baseline cursor-help">
            {m[1]}
          </span>
        )
      })}
    </>
  )
}

export default function Chat() {
  const [docs, setDocs] = useState<Doc[]>([])
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  const loadDocs = () => api<Doc[]>('/api/documents').then(setDocs).catch(() => {})
  useEffect(() => { loadDocs() }, [])
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs])

  async function ask(question: string) {
    if (!question.trim() || busy) return
    setError('')
    setBusy(true)
    setInput('')
    setMsgs((m) => [...m, { role: 'user', text: question }, { role: 'ai', text: '', streaming: true }])

    const patch = (fn: (last: Msg) => Msg) =>
      setMsgs((m) => [...m.slice(0, -1), fn(m[m.length - 1])])

    try {
      await streamChat(question, {
        onToken: (t) => patch((last) => ({ ...last, text: last.text + t })),
        onSources: (sources) => patch((last) => ({ ...last, sources })),
        onUsage: (usage) => patch((last) => ({ ...last, usage, streaming: false })),
      })
      patch((last) => ({ ...last, streaming: false }))
    } catch (e) {
      setMsgs((m) => m.slice(0, -1))
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function upload(file: File, kind: 'cv' | 'jd') {
    setUploading(true)
    setError('')
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('kind', kind)
      await api('/api/documents', { method: 'POST', body: form })
      await loadDocs()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex h-screen">
      {/* thread */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex-1 space-y-6 overflow-y-auto px-8 py-8">
          {msgs.length === 0 && (
            <div className="mx-auto mt-24 max-w-md text-center">
              <p className="font-mono text-xs uppercase tracking-[0.25em] text-zinc-500">rag chat</p>
              <h2 className="mt-3 text-2xl font-semibold text-zinc-100">Ask the documents anything.</h2>
              <p className="mt-2 text-sm text-zinc-500">
                Answers come only from the uploaded documents, with citations. If it isn't in there, it says so.
              </p>
              <div className="mt-6 space-y-2">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => ask(s)}
                    className="block w-full rounded-md border border-edge bg-panel px-4 py-2.5 text-left text-sm text-zinc-300 transition hover:border-accent/50">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {msgs.map((m, i) =>
            m.role === 'user' ? (
              <div key={i} className="ml-auto max-w-lg rounded-lg bg-accent-dim px-4 py-2.5 text-sm text-zinc-100">
                {m.text}
              </div>
            ) : (
              <div key={i} className="max-w-2xl">
                <div className={`whitespace-pre-wrap text-sm leading-relaxed text-zinc-200 ${m.streaming ? 'caret' : ''}`}>
                  <WithCitations text={m.text} sources={m.sources} />
                </div>
                {m.sources && m.sources.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {m.sources.map((s) => (
                      <span key={s.n} className="rounded border border-edge bg-panel px-2 py-1 font-mono text-[11px] text-zinc-400">
                        [{s.n}] {s.source} · p{s.page}
                      </span>
                    ))}
                  </div>
                )}
                {m.usage && (
                  <p className="mt-2 font-mono text-[11px] text-zinc-500">
                    {m.usage.model} · {m.usage.tokens_in}→{m.usage.tokens_out} tok ·{' '}
                    <span className="text-cost">${m.usage.cost_usd.toFixed(6)}</span> · {m.usage.latency_ms} ms
                  </p>
                )}
              </div>
            ),
          )}
          <div ref={endRef} />
        </div>

        {error && <p className="px-8 pb-2 text-sm text-red-400">{error}</p>}

        <form onSubmit={(e) => { e.preventDefault(); ask(input) }}
          className="border-t border-edge/70 px-8 py-4">
          <div className="flex gap-3">
            <input value={input} onChange={(e) => setInput(e.target.value)}
              placeholder={busy ? 'streaming…' : 'Ask about the documents…'}
              disabled={busy}
              className="flex-1 rounded-md border border-edge bg-panel px-4 py-2.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-accent/60" />
            <button type="submit" disabled={busy || !input.trim()}
              className="rounded-md bg-accent px-5 text-sm font-medium text-zinc-950 transition enabled:hover:brightness-110 disabled:opacity-40">
              Send
            </button>
          </div>
        </form>
      </div>

      {/* documents rail */}
      <aside className="w-72 shrink-0 overflow-y-auto border-l border-edge/70 px-5 py-6">
        <h3 className="font-mono text-xs uppercase tracking-[0.25em] text-zinc-500">documents</h3>
        <ul className="mt-4 space-y-2">
          {docs.map((d) => (
            <li key={d.id} className="rounded-md border border-edge bg-panel px-3 py-2.5">
              <p className="truncate text-sm text-zinc-200">{d.filename}</p>
              <p className="mt-0.5 font-mono text-[11px] text-zinc-500">
                <span className={d.kind === 'cv' ? 'text-accent' : 'text-sky-400'}>{d.kind}</span> · {d.chunk_count} chunks
              </p>
            </li>
          ))}
          {docs.length === 0 && <li className="text-sm text-zinc-600">No documents yet.</li>}
        </ul>

        <label className={`mt-5 block cursor-pointer rounded-md border border-dashed border-edge px-3 py-6 text-center text-sm transition hover:border-accent/50 ${uploading ? 'opacity-50' : ''}`}>
          <span className="text-zinc-400">{uploading ? 'Embedding…' : 'Upload PDF (CV or JD)'}</span>
          <input type="file" accept="application/pdf" className="hidden" disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) upload(f, window.confirm('OK = CV, Cancel = job description') ? 'cv' : 'jd')
              e.target.value = ''
            }} />
        </label>
        <p className="mt-3 text-[11px] leading-relaxed text-zinc-600">
          PDFs only, ≤5 MB, ≤20 pages. Demo uploads are rate-limited and cleared daily.
        </p>
      </aside>
    </div>
  )
}
