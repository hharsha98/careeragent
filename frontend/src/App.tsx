import { useEffect, useState } from 'react'

type Health = {
  status: string
  version: string
  env: string
  uptime_seconds: number
}

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:7860'

function App() {
  const [health, setHealth] = useState<Health | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`${API_BASE}/api/health`)
      .then((r) => r.json())
      .then(setHealth)
      .catch((e) => setError(String(e)))
  }, [])

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 px-6">
      <h1 className="text-4xl font-bold tracking-tight text-zinc-50">
        Career<span className="text-emerald-400">Agent</span>
      </h1>
      <p className="max-w-md text-center text-zinc-400">
        AI agents for the job hunt — RAG chat over your CV, live company
        research, CV tailoring, and an application tracker. Day 1 of 14.
      </p>
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 font-mono text-sm">
        {health ? (
          <span className="text-emerald-400">
            ● backend {health.status} · v{health.version} · {health.env}
          </span>
        ) : error ? (
          <span className="text-red-400">● backend unreachable</span>
        ) : (
          <span className="text-zinc-500">● checking backend…</span>
        )}
      </div>
    </main>
  )
}

export default App
