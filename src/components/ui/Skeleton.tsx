import { type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'

// ── Framer Motion shimmer sweep ───────────────────────────────────────────────
// Uses --sk-shimmer CSS variable so the midpoint color flips automatically
// between light mode (dark tint) and dark mode (Eficiencia yellow hint).
function ShimmerOverlay() {
  const shouldReduce = useReducedMotion()
  if (shouldReduce) return null
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute inset-0 rounded-[inherit]"
      style={{
        background:
          'linear-gradient(90deg, transparent 0%, var(--sk-shimmer) 50%, transparent 100%)',
      }}
      initial={{ x: '-100%' }}
      animate={{ x: '200%' }}
      transition={{ repeat: Infinity, duration: 1.6, ease: 'linear' }}
    />
  )
}

// ── Base Skeleton ─────────────────────────────────────────────────────────────
// Uses --sk-fill so the placeholder is visible in both light and dark themes.
interface SkeletonProps {
  className?: string
  style?: CSSProperties
  rows?: number
}

export default function Skeleton({ className = '', style, rows }: SkeletonProps) {
  const fillStyle: CSSProperties = { background: 'var(--sk-fill)', ...style }

  if (rows && rows > 1) {
    return (
      <div className="flex flex-col gap-2.5">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className={`relative overflow-hidden rounded-xl ${
              i === rows - 1 ? 'w-3/4' : 'w-full'
            } h-4 ${className}`}
            style={fillStyle}
          >
            <ShimmerOverlay />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div
      className={`relative overflow-hidden rounded-xl ${className}`}
      style={fillStyle}
    >
      <ShimmerOverlay />
    </div>
  )
}

// ── Glassmorphic card shell ───────────────────────────────────────────────────
export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`rounded-[2rem] border border-gray-200 dark:border-white/10 bg-white/20 dark:bg-black/20 backdrop-blur-xl p-6 ${className}`}>
      <div className="flex items-start justify-between mb-4">
        <Skeleton className="h-12 w-12 rounded-2xl" />
      </div>
      <Skeleton className="h-9 w-28 mb-2" />
      <Skeleton className="h-3 w-20" />
    </div>
  )
}

// ── Table row skeleton ────────────────────────────────────────────────────────
export function SkeletonRow({ cols = 5 }: { cols?: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-6 py-4">
          <Skeleton className={`h-4 ${i === 0 ? 'w-32' : 'w-20'}`} />
        </td>
      ))}
    </tr>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTENT SKELETONS
// Card container visible from t=0 with correct light/dark colors.
// Shimmer lives inside via <Skeleton> placeholders.
//
// Light mode card:  bg-white/30  border-white/50  (same as KpiCard in light)
// Dark mode card:   bg-black/30  border-white/10
// ─────────────────────────────────────────────────────────────────────────────

// ── Dashboard: KPI grid (4 cards) ────────────────────────────────────────────
export function SkeletonKpiGrid() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="rounded-[2rem] border border-gray-200 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-3xl p-4 sm:p-5 xl:p-6 flex flex-col justify-between gap-4 min-h-[120px]"
        >
          <div className="flex items-start justify-between">
            <Skeleton className="h-10 w-10 xl:h-12 xl:w-12 rounded-xl" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-7 xl:h-9 w-28 xl:w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Dashboard: chart row (area chart 8 cols + bar chart 4 cols) ───────────────
const AREA_PCTS = [55, 72, 48, 88, 65, 78]
const BAR_PCTS  = [68, 45, 82, 60]

export function SkeletonDashboardCharts() {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">

      {/* Area chart */}
      <div className="xl:col-span-8 rounded-[2.5rem] border border-gray-200 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-3xl p-8 flex flex-col gap-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <Skeleton className="h-6 w-52" />
            <Skeleton className="h-3.5 w-64" />
          </div>
          <div className="flex items-center gap-4">
            <Skeleton className="h-4 w-20 rounded-full" />
            <Skeleton className="h-4 w-16 rounded-full" />
          </div>
        </div>

        {/* Absolute children so height % resolves against parent height */}
        <div className="relative min-h-[280px]">
          <div className="absolute left-0 inset-y-0 flex flex-col justify-between pb-8 w-12">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-3 w-10" />)}
          </div>
          <div className="absolute inset-0 flex items-end gap-2 pl-14 pb-8">
            {AREA_PCTS.map((h, i) => (
              <Skeleton key={i} className="flex-1 rounded-t-md" style={{ height: `${h}%` }} />
            ))}
          </div>
        </div>

        <div className="flex justify-around pl-12">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-3 w-10" />)}
        </div>
      </div>

      {/* Bar chart */}
      <div className="xl:col-span-4 rounded-[2.5rem] border border-gray-200 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-3xl p-8 flex flex-col gap-6">
        <Skeleton className="h-4 w-36" />

        <div className="relative min-h-[280px]">
          <div className="absolute inset-0 flex items-end gap-4 pb-10">
            {BAR_PCTS.map((h, i) => (
              <Skeleton key={i} className="flex-1 rounded-t-lg" style={{ height: `${h}%` }} />
            ))}
          </div>
        </div>

        <div className="flex justify-around">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-3 w-12" />)}
        </div>
      </div>
    </div>
  )
}

// ── Client profile: hero card + KPI strip + tabs ──────────────────────────────
export function SkeletonClientProfile() {
  const navigate = useNavigate()
  return (
    <div className="space-y-4 md:space-y-5">

      <button
        onClick={() => navigate('/clients')}
        className="group flex items-center gap-2 text-sm text-gray-500 dark:text-[#8A8A9A] hover:text-gray-900 dark:hover:text-white transition-colors"
      >
        <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
        <span>Clientes</span>
      </button>

      {/* Hero card — mirrors glassCard from ClientProfilePage */}
      <div className="rounded-3xl border border-gray-200 dark:border-white/[0.08] bg-white/30 dark:bg-black/30 backdrop-blur-3xl overflow-hidden">
        <div className="h-1 bg-black/[0.08] dark:bg-white/[0.06]" />
        <div className="p-5 md:p-7">
          <div className="flex flex-col sm:flex-row gap-5">
            <Skeleton className="h-16 w-16 md:h-20 md:w-20 rounded-2xl md:rounded-3xl shrink-0" />
            <div className="flex-1 space-y-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="space-y-2">
                  <Skeleton className="h-8 w-52" />
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-4 w-28" />
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Skeleton className="h-7 w-16 rounded-full" />
                  <Skeleton className="h-7 w-16 rounded-xl" />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Skeleton className="h-7 w-24 rounded-full" />
                <Skeleton className="h-7 w-32 rounded-full" />
                <Skeleton className="h-7 w-28 rounded-full" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* KPI strip — 3 cards */}
      <div className="grid grid-cols-3 gap-3">
        {(['w-16', 'w-12', 'w-20'] as const).map((w, i) => (
          <div
            key={i}
            className="rounded-3xl border border-gray-200 dark:border-white/[0.08] bg-white/30 dark:bg-black/30 backdrop-blur-3xl p-4 flex items-center gap-3"
          >
            <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
            <div className="flex-1 min-w-0 space-y-1.5">
              <Skeleton className={`h-5 ${w}`} />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="space-y-3">
        {/* Tab bar */}
        <div className="flex gap-1 p-1 rounded-2xl bg-black/[0.04] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/[0.06]">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="flex-1 h-9 rounded-xl" />)}
        </div>
        {/* Tab content area */}
        <div className="rounded-3xl border border-gray-200 dark:border-white/[0.08] bg-white/30 dark:bg-black/30 backdrop-blur-3xl p-5 space-y-3 min-h-[240px]">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full rounded-2xl" />)}
        </div>
      </div>
    </div>
  )
}

// ── Rutina page: back link + sidebar + exercise table ────────────────────────
// Mirrors the exact layout of ClientRutinaPage (glassCard, widths, table columns).
const GLASS = 'rounded-[2rem] border border-gray-200 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-3xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)]'

export function SkeletonRutinaPanel() {
  return (
    <div className="space-y-6">

      {/* Back button */}
      <Skeleton className="h-4 w-28" />

      {/* Layout: sidebar + main panel */}
      <div className="flex flex-col lg:flex-row gap-5 lg:gap-6 items-start">

        {/* Sidebar — matches w-full lg:w-64 xl:w-72 */}
        <div className={`${GLASS} p-4 w-full lg:w-64 xl:w-72 shrink-0`}>
          {/* Header "Rutinas" */}
          <div className="flex items-center gap-2 mb-4">
            <Skeleton className="h-3 w-3 rounded" />
            <Skeleton className="h-3 w-16" />
          </div>
          {/* Rutina items */}
          <div className="space-y-1.5">
            {[1, 2, 3].map(i => (
              <div
                key={i}
                className="rounded-2xl border border-gray-200/80 dark:border-white/[0.05] bg-white/20 dark:bg-white/[0.02] p-3 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <Skeleton className={`h-4 ${i === 1 ? 'w-28' : i === 2 ? 'w-36' : 'w-32'}`} />
                  <Skeleton className="h-4 w-12 rounded-md shrink-0" />
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-3 w-10" />
                  <Skeleton className="h-2 w-1 rounded-full" />
                  <Skeleton className="h-3 w-8" />
                </div>
              </div>
            ))}
            {/* Nueva rutina button */}
            <Skeleton className="h-9 w-full rounded-2xl mt-1" />
          </div>
        </div>

        {/* Main panel */}
        <div className={`${GLASS} p-5 flex-1 space-y-5`}>
          {/* Header: título + descripción + botones */}
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2 flex-1">
              <Skeleton className="h-6 w-52" />
              <Skeleton className="h-3.5 w-72" />
            </div>
            <div className="flex gap-2 shrink-0">
              <Skeleton className="h-8 w-20 rounded-xl" />
              <Skeleton className="h-8 w-24 rounded-xl" />
            </div>
          </div>

          {/* Table */}
          <div className="rounded-2xl border border-gray-200/80 dark:border-white/[0.06] overflow-hidden">
            {/* Table header */}
            <div className="flex gap-4 px-4 py-2.5 bg-gray-50/60 dark:bg-white/[0.03] border-b border-gray-200/80 dark:border-white/[0.06]">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-3 flex-1 max-w-[200px]" />
              <Skeleton className="h-3 w-8 ml-auto" />
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-3 w-12" />
            </div>
            {/* Data rows — semana + día + bloque + ejercicios */}
            {[
              { w1: 'w-14', w2: 'w-10', w3: 'w-6', w4: 'w-40' },
              { w1: '',     w2: '',     w3: 'w-6', w4: 'w-32' },
              { w1: '',     w2: 'w-10', w3: 'w-6', w4: 'w-44' },
              { w1: '',     w2: '',     w3: 'w-6', w4: 'w-28' },
              { w1: 'w-14', w2: 'w-10', w3: 'w-6', w4: 'w-36' },
            ].map((r, i) => (
              <div
                key={i}
                className="flex items-center gap-4 px-4 py-3 border-b border-gray-200/60 dark:border-white/[0.04] last:border-0"
              >
                {r.w1 ? <Skeleton className={`h-5 ${r.w1} rounded-lg shrink-0`} /> : <div className="h-5 w-14 shrink-0" />}
                {r.w2 ? <Skeleton className={`h-4 ${r.w2} shrink-0`} /> : <div className="h-4 w-10 shrink-0" />}
                <Skeleton className={`h-5 ${r.w3} rounded-md shrink-0`} />
                <Skeleton className={`h-4 ${r.w4} flex-1`} />
                <Skeleton className="h-3.5 w-6 ml-auto shrink-0" />
                <Skeleton className="h-3.5 w-10 shrink-0" />
                <Skeleton className="h-3.5 w-10 shrink-0" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
