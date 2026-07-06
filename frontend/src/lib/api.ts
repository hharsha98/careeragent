/** API client. All requests hit the FastAPI backend.
 *  In dev, VITE_DEV_OWNER=1 unlocks the owner workspace via the dev-only header.
 *  The prod API URL is hardcoded (HF username hv1998, NOT the GitHub name) so a
 *  wrong/missing Cloudflare env var can't point the site at a dead Space. */
export const API_BASE = import.meta.env.DEV
  ? 'http://localhost:7860'
  : 'https://hv1998-careeragent-api.hf.space'

function headers(extra?: Record<string, string>): Record<string, string> {
  const h: Record<string, string> = { ...extra }
  if (import.meta.env.VITE_DEV_OWNER === '1') h['X-Workspace'] = 'owner'
  return h
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: headers({
      ...(init?.body && !(init.body instanceof FormData)
        ? { 'Content-Type': 'application/json' }
        : {}),
      ...(init?.headers as Record<string, string>),
    }),
  })
  if (res.status === 429)
    throw new Error('Rate limit reached — the demo allows a few requests per hour. Try again soon.')
  if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`)
  return res.status === 204 ? (undefined as T) : res.json()
}

export const sseHeaders = headers

/* ---- backend types ---- */
export type Doc = { id: string; filename: string; kind: 'cv' | 'jd'; chunk_count: number }
export type Application = {
  id: string; company: string; role: string; status: Status
  position: number; artifact_count: number
}
export type Status = 'interested' | 'applied' | 'interview' | 'offer' | 'rejected'
export type Artifact = {
  id: string; type: 'research' | 'tailoring'; content: Record<string, unknown>
  model: string; cost_usd: number; created_at: string
}
export type UsageTotals = { tokens_in: number; tokens_out: number; cost_usd: number; requests: number }
export type UsageRow = {
  endpoint: string; model: string; requests: number
  tokens_in: number; tokens_out: number; cost_usd: number; avg_latency_ms: number
}
export type EvalCase = { question: string; got: string; pass: boolean; reason: string }
export type EvalRun = { score: number | null; total: number | null; cases: EvalCase[]; created_at: string | null }
