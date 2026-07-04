/** Kanban application tracker: drag cards between stages, open the drawer
 *  to run agents. Drops PATCH the backend. */
import { useEffect, useState } from 'react'
import {
  DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { api, type Application, type Status } from '../lib/api'
import ArtifactDrawer from '../components/ArtifactDrawer'

const COLUMNS: { id: Status; label: string }[] = [
  { id: 'interested', label: 'Interested' },
  { id: 'applied', label: 'Applied' },
  { id: 'interview', label: 'Interview' },
  { id: 'offer', label: 'Offer' },
  { id: 'rejected', label: 'Rejected' },
]

function Card({ app, onOpen }: { app: Application; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: app.id })
  return (
    <div ref={setNodeRef} {...attributes} {...listeners}
      onClick={onOpen}
      style={transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined}
      className={`cursor-grab rounded-md border border-edge bg-panel px-3 py-2.5 transition-shadow active:cursor-grabbing ${
        isDragging ? 'z-30 shadow-lg shadow-black/50 border-accent/50' : 'hover:border-zinc-600'
      }`}>
      <p className="text-sm font-medium text-zinc-100">{app.company}</p>
      <p className="mt-0.5 truncate text-[12px] text-zinc-400">{app.role}</p>
      {app.artifact_count > 0 && (
        <p className="mt-1.5 font-mono text-[11px] text-accent">▣ {app.artifact_count} artifact{app.artifact_count > 1 ? 's' : ''}</p>
      )}
    </div>
  )
}

function Column({ id, label, apps, onOpen }: {
  id: Status; label: string; apps: Application[]; onOpen: (a: Application) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div ref={setNodeRef}
      className={`flex w-56 shrink-0 flex-col rounded-lg border px-2.5 py-3 transition-colors ${
        isOver ? 'border-accent/60 bg-accent-dim' : 'border-edge/60 bg-ink/40'
      }`}>
      <h3 className="mb-3 flex items-baseline justify-between px-1 font-mono text-[11px] uppercase tracking-widest text-zinc-500">
        {label} <span className="text-zinc-600">{apps.length}</span>
      </h3>
      <div className="space-y-2">
        {apps.map((a) => <Card key={a.id} app={a} onOpen={() => onOpen(a)} />)}
      </div>
    </div>
  )
}

export default function Tracker() {
  const [apps, setApps] = useState<Application[]>([])
  const [open, setOpen] = useState<Application | null>(null)
  const [company, setCompany] = useState('')
  const [role, setRole] = useState('')
  const [error, setError] = useState('')
  // 4px of movement before a drag starts, so plain clicks still open the drawer
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  const load = () => api<Application[]>('/api/applications').then(setApps).catch((e) => setError(String(e.message ?? e)))
  useEffect(() => { load() }, [])

  async function onDragEnd(e: DragEndEvent) {
    const target = e.over?.id as Status | undefined
    const card = apps.find((a) => a.id === e.active.id)
    if (!target || !card || card.status === target) return
    setApps((all) => all.map((a) => (a.id === card.id ? { ...a, status: target } : a)))  // optimistic
    try {
      await api(`/api/applications/${card.id}`, { method: 'PATCH', body: JSON.stringify({ status: target }) })
    } catch {
      load()  // roll back to server truth
    }
  }

  async function add(e: React.FormEvent) {
    e.preventDefault()
    if (!company.trim() || !role.trim()) return
    try {
      await api('/api/applications', { method: 'POST', body: JSON.stringify({ company, role }) })
      setCompany(''); setRole(''); load()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div className="flex h-screen flex-col px-8 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-zinc-500">application tracker</p>
          <h2 className="mt-1 text-2xl font-semibold text-zinc-100">Every application, one board.</h2>
        </div>
        <form onSubmit={add} className="flex gap-2">
          <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company"
            className="w-36 rounded-md border border-edge bg-panel px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-accent/60" />
          <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Role"
            className="w-44 rounded-md border border-edge bg-panel px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-accent/60" />
          <button className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-zinc-950 transition hover:brightness-110">
            Add
          </button>
        </form>
      </div>
      {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="flex flex-1 gap-4 overflow-x-auto pb-4">
          {COLUMNS.map((col) => (
            <Column key={col.id} id={col.id} label={col.label}
              apps={apps.filter((a) => a.status === col.id)} onOpen={setOpen} />
          ))}
        </div>
      </DndContext>

      <ArtifactDrawer app={open} onClose={() => { setOpen(null); load() }} />
    </div>
  )
}
