/** Signature animated hero: the retrieval pipeline itself, looping.
 *  query → hybrid retrieve (candidates light up) → rerank (top ones promoted)
 *  → grounded answer. Shared visual identity across all sites. */
import { motion } from 'framer-motion'

const LOOP = 6

const CANDIDATES = [
  { y: 40, win: false },
  { y: 66, win: true, rank: 1 },
  { y: 92, win: false },
  { y: 118, win: true, rank: 2 },
  { y: 144, win: false },
  { y: 170, win: true, rank: 3 },
]

const PROMOTED_Y = [66, 96, 126]

export default function RetrievalFlow() {
  return (
    <svg viewBox="0 0 560 210" className="w-full max-w-lg" role="img"
      aria-label="Animated retrieval pipeline: query, hybrid retrieval, reranking, answer">
      <defs>
        <linearGradient id="rf-line" x1="0" x2="1">
          <stop offset="0" stopColor="#34d399" stopOpacity="0.1" />
          <stop offset="0.5" stopColor="#34d399" stopOpacity="0.6" />
          <stop offset="1" stopColor="#22d3ee" stopOpacity="0.1" />
        </linearGradient>
        <filter id="rf-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {[['query', 40], ['hybrid retrieve', 200], ['rerank', 360], ['answer', 490]].map(
        ([label, x]) => (
          <text key={label as string} x={x as number} y={16} textAnchor="middle"
            className="fill-zinc-600 font-mono" fontSize="9"
            letterSpacing="1.5">{(label as string).toUpperCase()}</text>
        ),
      )}

      <motion.g
        animate={{ opacity: [0.4, 1, 1, 1, 0.4], scale: [0.96, 1, 1, 1, 0.96] }}
        transition={{ duration: LOOP, times: [0, 0.1, 0.5, 0.9, 1], repeat: Infinity }}
        style={{ transformOrigin: '40px 105px' }}>
        <rect x={12} y={90} width={56} height={30} rx={8}
          className="fill-emerald-400/10 stroke-emerald-400/60" strokeWidth={1} filter="url(#rf-glow)" />
        <text x={40} y={109} textAnchor="middle" className="fill-emerald-300 font-mono" fontSize="10">?</text>
      </motion.g>

      <line x1={70} y1={105} x2={150} y2={105} stroke="url(#rf-line)" strokeWidth={1.5} />
      <motion.circle r={3} className="fill-emerald-400" filter="url(#rf-glow)"
        animate={{ cx: [70, 150], cy: 105, opacity: [0, 1, 0] }}
        transition={{ duration: LOOP * 0.15, repeat: Infinity, repeatDelay: LOOP * 0.85, ease: 'easeIn' }} />

      {CANDIDATES.map((c, i) => (
        <motion.rect key={i} x={155} y={c.y} width={70} height={16} rx={4}
          className="fill-cyan-400/10 stroke-cyan-400/40" strokeWidth={1}
          animate={{ opacity: [0.15, 1, 1, 0.4], stroke: ['#22d3ee66', '#22d3ee', '#22d3ee', '#22d3ee66'] }}
          transition={{ duration: LOOP, times: [0, 0.18 + i * 0.02, 0.5, 1], repeat: Infinity }} />
      ))}

      {CANDIDATES.filter((c) => c.win).map((c, i) => (
        <motion.g key={i}
          animate={{ opacity: [0, 0, 1, 1, 0] }}
          transition={{ duration: LOOP, times: [0, 0.45, 0.55, 0.9, 1], repeat: Infinity }}>
          <motion.rect x={315} width={80} height={18} rx={4}
            className="fill-emerald-400/15 stroke-emerald-400/70" strokeWidth={1} filter="url(#rf-glow)"
            animate={{ y: [c.y, PROMOTED_Y[i]] }}
            transition={{ duration: LOOP * 0.12, times: [0, 1], repeat: Infinity, repeatDelay: LOOP * 0.88, ease: 'easeOut' }} />
          <motion.text x={322} textAnchor="start" className="fill-emerald-300 font-mono" fontSize="9"
            animate={{ y: [c.y + 12, PROMOTED_Y[i] + 12] }}
            transition={{ duration: LOOP * 0.12, repeat: Infinity, repeatDelay: LOOP * 0.88, ease: 'easeOut' }}>
            #{c.rank}
          </motion.text>
        </motion.g>
      ))}

      <line x1={395} y1={96} x2={460} y2={105} stroke="url(#rf-line)" strokeWidth={1.5} />
      <motion.circle r={3} className="fill-emerald-400" filter="url(#rf-glow)"
        animate={{ cx: [395, 460], cy: [96, 105], opacity: [0, 1, 0] }}
        transition={{ duration: LOOP * 0.12, repeat: Infinity, repeatDelay: LOOP * 0.88, delay: LOOP * 0.72, ease: 'easeIn' }} />

      <motion.g
        animate={{ opacity: [0.3, 0.3, 1, 1, 0.3] }}
        transition={{ duration: LOOP, times: [0, 0.75, 0.85, 0.95, 1], repeat: Infinity }}>
        <rect x={462} y={88} width={86} height={34} rx={8}
          className="fill-emerald-400/10 stroke-emerald-400/60" strokeWidth={1} filter="url(#rf-glow)" />
        <rect x={470} y={97} width={44} height={5} rx={2.5} className="fill-emerald-300/70" />
        <rect x={470} y={107} width={30} height={5} rx={2.5} className="fill-zinc-500" />
        <rect x={520} y={95} width={20} height={12} rx={3} className="fill-emerald-400/20 stroke-emerald-400/50" strokeWidth={0.75} />
        <text x={530} y={104} textAnchor="middle" className="fill-emerald-300 font-mono" fontSize="8">1</text>
      </motion.g>
    </svg>
  )
}
