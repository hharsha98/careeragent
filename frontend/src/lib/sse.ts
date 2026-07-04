/** Minimal Server-Sent-Events reader over fetch.
 *  The backend streams:  event: token|sources|usage \n data: <json> \n\n  */
import { API_BASE, sseHeaders } from './api'

export type SSEHandlers = {
  onToken: (text: string) => void
  onSources: (sources: { n: number; source: string; page: number }[]) => void
  onUsage: (usage: { model: string; tokens_in: number; tokens_out: number; cost_usd: number; latency_ms: number }) => void
}

export async function streamChat(question: string, h: SSEHandlers): Promise<void> {
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: sseHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ question }),
  })
  if (res.status === 429) throw new Error('Rate limit reached — try again in a minute.')
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    // frames are separated by a blank line
    const frames = buffer.split('\n\n')
    buffer = frames.pop() ?? ''
    for (const frame of frames) {
      let event = 'message'
      let data = ''
      for (const line of frame.split('\n')) {
        if (line.startsWith('event: ')) event = line.slice(7)
        if (line.startsWith('data: ')) data = line.slice(6)
      }
      if (!data) continue
      const parsed = JSON.parse(data)
      if (event === 'token') h.onToken(parsed.text)
      else if (event === 'sources') h.onSources(parsed)
      else if (event === 'usage') h.onUsage(parsed)
    }
  }
}
