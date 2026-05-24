import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { pageVariants } from '../lib/motion'
import {
  TrendingUp, TrendingDown, Users, DollarSign, RefreshCw,
  AlertTriangle, Clock, AlertCircle, CheckCircle2,
  ChevronLeft, ChevronRight,
} from 'lucide-react'
import { format, startOfMonth, endOfMonth, addMonths, subMonths, parseISO } from 'date-fns'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { useDashboard } from '../hooks/useDashboard'
import Skeleton, { SkeletonKpiGrid, SkeletonDashboardCharts } from '../components/ui/Skeleton'
import KpiCard from '../components/ui/KpiCard'
import { formatCurrency } from '../utils/formatCurrency'
import { ROUTES } from '../constants/routes'

// ── Paleta de colores ─────────────────────────────────────────────────────────

const C = {
  primary:  '#FBC608',
  green:    '#22C55E',
  red:      '#EF4444',
  blue:     '#3B82F6',
  purple:   '#A855F7',
  orange:   '#F97316',
  teal:     '#14B8A6',
  pink:     '#EC4899',
}

const PIE_CLIENTES  = [C.green, C.orange, C.red]
const PIE_GASTOS    = [C.blue, C.purple, C.teal]
const BAR_METODOS   = [C.primary, C.blue, C.purple, C.teal]

// ── Tooltip personalizado ─────────────────────────────────────────────────────

const TooltipStyle = {
  contentStyle: {
    background: 'rgba(10,10,10,0.92)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 16,
    color: '#fff',
    boxShadow: '0 20px 40px -10px rgba(0,0,0,0.5)',
    padding: '12px 16px',
  },
  itemStyle: { fontWeight: 900, padding: '2px 0' },
}

// ── ChartView toggle ──────────────────────────────────────────────────────────

type ChartView = 'meses' | 'años' | 'historico'

function ViewToggle({ value, onChange }: { value: ChartView; onChange: (v: ChartView) => void }) {
  return (
    <div className="flex items-center rounded-xl border border-saas-border dark:border-white/[0.08] bg-white/[0.6] dark:bg-white/[0.04] backdrop-blur-sm p-0.5 gap-0.5 shrink-0">
      {([['meses', 'Meses'], ['años', 'Años'], ['historico', 'Histórico']] as [ChartView, string][]).map(([mode, label]) => (
        <button
          key={mode}
          onClick={() => onChange(mode)}
          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
            value === mode
              ? 'bg-gray-900 dark:bg-white/[0.12] text-white'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

// ── Sección wrapper ───────────────────────────────────────────────────────────

function Section({ title, subtitle, children, headerAction }: {
  title: string; subtitle?: string; children: React.ReactNode; headerAction?: React.ReactNode
}) {
  return (
    <div className="space-y-3 lg:space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base lg:text-xl font-black tracking-tight text-gray-900 dark:text-white">{title}</h2>
          {subtitle && <p className="text-xs lg:text-sm font-semibold text-gray-500 dark:text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
        {headerAction}
      </div>
      {children}
    </div>
  )
}

// ── Card genérica de gráfico ──────────────────────────────────────────────────

function ChartCard({ title, subtitle, children, className = '' }: {
  title: string; subtitle?: string; children: React.ReactNode; className?: string
}) {
  return (
    <div className={`rounded-2xl lg:rounded-[2rem] border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-3xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)] p-4 lg:p-6 flex flex-col ${className}`}>
      <div className="mb-3 lg:mb-5">
        <h3 className="text-sm lg:text-base font-bold text-gray-900 dark:text-white">{title}</h3>
        {subtitle && <p className="text-xs font-semibold text-gray-400 dark:text-[#8A8A9A] mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

// ── Leyenda personalizada para PieChart ───────────────────────────────────────

function PieLegend({ items }: { items: { label: string; value: number | string; color: string }[] }) {
  return (
    <div className="space-y-2 mt-4">
      {items.map(item => (
        <div key={item.label} className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: item.color }} />
            <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 truncate">{item.label}</span>
          </div>
          <span className="text-xs font-black tabular-nums text-gray-900 dark:text-white shrink-0">{item.value}</span>
        </div>
      ))}
    </div>
  )
}

// ── Progress bar de facturación ───────────────────────────────────────────────

function FacturacionBar({ facturado, sinFacturar, total }: { facturado: number; sinFacturar: number; total: number }) {
  const pctFacturado = total > 0 ? Math.round((facturado / total) * 100) : 0
  return (
    <div className="space-y-3">
      <div className="flex justify-between text-xs font-bold text-gray-500 dark:text-gray-400">
        <span>Facturado</span>
        <span>{pctFacturado}%</span>
      </div>
      <div className="h-3 rounded-full bg-white/20 dark:bg-white/10 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pctFacturado}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="h-full rounded-full bg-primary"
        />
      </div>
      <div className="grid grid-cols-2 gap-3 pt-1">
        <div className="rounded-2xl bg-primary/10 px-4 py-3">
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-primary/70 mb-1">Facturado</p>
          <p className="text-base font-black tabular-nums text-gray-900 dark:text-white">{formatCurrency(facturado)}</p>
        </div>
        <div className="rounded-2xl bg-white/30 dark:bg-white/[0.04] px-4 py-3">
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-1">Sin facturar</p>
          <p className="text-base font-black tabular-nums text-gray-900 dark:text-white">{formatCurrency(sinFacturar)}</p>
        </div>
      </div>
    </div>
  )
}

// ── Página ────────────────────────────────────────────────────────────────────

type PeriodMode = 'month' | 'year' | 'range'

export default function DashboardPage() {
  const today = new Date()
  const navigate = useNavigate()

  const [periodMode, setPeriodMode] = useState<PeriodMode>('month')
  const [navDate, setNavDate] = useState(today)
  const [rangeFrom, setRangeFrom] = useState(format(startOfMonth(today), 'yyyy-MM-dd'))
  const [rangeTo,   setRangeTo]   = useState(format(endOfMonth(today),   'yyyy-MM-dd'))

  const fromDate = useMemo(() => {
    if (periodMode === 'range')  return rangeFrom
    if (periodMode === 'month')  return format(startOfMonth(navDate), 'yyyy-MM-dd')
    return format(new Date(navDate.getFullYear(), 0, 1), 'yyyy-MM-dd')
  }, [periodMode, navDate, rangeFrom])

  const toDate = useMemo(() => {
    if (periodMode === 'range')  return rangeTo
    if (periodMode === 'month')  return format(endOfMonth(navDate), 'yyyy-MM-dd')
    return format(new Date(navDate.getFullYear(), 11, 31), 'yyyy-MM-dd')
  }, [periodMode, navDate, rangeTo])

  const periodLabel = useMemo(() => {
    if (periodMode === 'range') {
      const fmtDate = (iso: string, withYear = false) => {
        const d = parseISO(iso)
        const day = format(d, 'd')
        const mon = format(d, 'MMM').replace(/^\w/, c => c.toUpperCase())
        return withYear ? `${day} ${mon} ${format(d, 'yyyy')}` : `${day} ${mon}`
      }
      const from = rangeFrom ? fmtDate(rangeFrom) : '.'
      const to   = rangeTo   ? fmtDate(rangeTo, true) : '.'
      return `${from}, ${to}`
    }
    if (periodMode === 'month')
      return format(navDate, 'MMMM yyyy').replace(/^\w/, c => c.toUpperCase())
    return String(navDate.getFullYear())
  }, [periodMode, navDate, rangeFrom, rangeTo])

  const isAtPresent = periodMode === 'month'
    ? navDate >= startOfMonth(today)
    : navDate.getFullYear() >= today.getFullYear()

  const goBack = () => setNavDate(prev =>
    periodMode === 'month' ? subMonths(prev, 1) : new Date(prev.getFullYear() - 1, 0, 1)
  )
  const goForward = () => setNavDate(prev =>
    periodMode === 'month' ? addMonths(prev, 1) : new Date(prev.getFullYear() + 1, 0, 1)
  )

  const [chartView, setChartView] = useState<ChartView>('meses')
  const [chartMonthOffset, setChartMonthOffset] = useState(0)

  const historicoMeses = chartView === 'meses' ? 24 : chartView === 'años' ? 60 : 120

  const { stats, isLoading, error, refetch } = useDashboard({ from: fromDate, to: toDate, historicoMeses })

  // Dataset base: meses = todos los puntos crudos; años = agrupado por año; historico = todos
  const chartData = useMemo(() => {
    if (!stats?.historico?.length) return []
    if (chartView !== 'años') return stats.historico
    const byYear = new Map<string, typeof stats.historico[0]>()
    for (const p of stats.historico) {
      const year = p.mes.slice(0, 4)
      const ex = byYear.get(year)
      if (ex) {
        ex.ingresos     += p.ingresos
        ex.gastos       += p.gastos
        ex.gananciaNeta += p.gananciaNeta
      } else {
        byYear.set(year, { ...p, mes: year, label: year })
      }
    }
    return Array.from(byYear.values()).sort((a, b) => a.label.localeCompare(b.label))
  }, [stats?.historico, chartView])

  // Ventana visible: en modo meses, 12 puntos deslizantes; en otros modos, todo
  const activeChartData = useMemo(() => {
    if (chartView !== 'meses') return chartData
    const arr = chartData
    if (!arr.length) return []
    const end   = chartMonthOffset === 0 ? arr.length : arr.length - chartMonthOffset
    const start = Math.max(0, end - 12)
    return arr.slice(start, end)
  }, [chartView, chartData, chartMonthOffset])

  const canGoBack    = chartView === 'meses' && chartMonthOffset < Math.max(0, chartData.length - 12)
  const canGoForward = chartView === 'meses' && chartMonthOffset > 0

  const goChartBack    = () => setChartMonthOffset(v => v + 1)
  const goChartForward = () => setChartMonthOffset(v => Math.max(0, v - 1))

  const changeChartView = (v: ChartView) => { setChartView(v); setChartMonthOffset(0) }

  const facturAgg = useMemo(() => {
    if (chartView === 'meses') return null
    if (!activeChartData.length) return null
    return {
      totalIngresos: activeChartData.reduce((s, p) => s + p.ingresos, 0),
      totalGastos:   activeChartData.reduce((s, p) => s + p.gastos, 0),
      gananciaNeta:  activeChartData.reduce((s, p) => s + p.gananciaNeta, 0),
    }
  }, [chartView, activeChartData])

  const chartSubtitle = useMemo(() => {
    if (chartView === 'años')     return 'Por año'
    if (chartView === 'historico') return 'Histórico completo'
    if (!activeChartData.length)  return 'Últimos 12 meses'
    if (chartMonthOffset === 0)   return 'Últimos 12 meses'
    return `${activeChartData[0].label} – ${activeChartData[activeChartData.length - 1].label}`
  }, [chartView, activeChartData, chartMonthOffset])

  const chartHeaderAction = (
    <div className="flex items-center gap-2">
      {chartView === 'meses' && (
        <div className="flex items-center rounded-xl border border-saas-border dark:border-white/[0.08] bg-white/[0.6] dark:bg-white/[0.04] backdrop-blur-sm p-0.5">
          <button
            onClick={goChartBack}
            disabled={!canGoBack}
            className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-white/40 dark:hover:bg-white/[0.06] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="px-2 text-[11px] font-black text-gray-700 dark:text-gray-200 min-w-[80px] text-center tabular-nums">
            {chartSubtitle}
          </span>
          <button
            onClick={goChartForward}
            disabled={!canGoForward}
            className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-white/40 dark:hover:bg-white/[0.06] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}
      <ViewToggle value={chartView} onChange={changeChartView} />
    </div>
  )

  // ── Loading ──
  if (isLoading) {
    const glassCard = 'rounded-2xl lg:rounded-[2rem] border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-3xl p-4 lg:p-6'
    const sectionHeader = (
      <div className="space-y-1.5">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-3.5 w-56" />
      </div>
    )
    return (
      <div className="space-y-5 md:space-y-7 xl:space-y-10 pb-6 lg:pb-10">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-9 xl:h-11 w-44" />
            <Skeleton className="h-4 w-56" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-[122px] rounded-xl" />
            <Skeleton className="h-9 w-[156px] rounded-xl" />
            <Skeleton className="h-9 w-9 rounded-xl" />
          </div>
        </div>

        {/* KPIs */}
        <SkeletonKpiGrid />

        {/* Alertas */}
        <div className="space-y-3 lg:space-y-4">
          {sectionHeader}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 lg:gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className={`${glassCard} flex items-start gap-3 lg:gap-4`}>
                <Skeleton className="h-9 w-9 lg:h-11 lg:w-11 rounded-xl shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-8 lg:h-9 w-12" />
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Financiero */}
        <div className="space-y-3 lg:space-y-4">
          {sectionHeader}
          <SkeletonDashboardCharts />
        </div>

        {/* Clientes & Planes */}
        <div className="space-y-3 lg:space-y-4">
          {sectionHeader}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-6">

            {/* Donut — Estado de clientes */}
            <div className={`${glassCard} flex flex-col`}>
              <div className="mb-3 lg:mb-5 space-y-1.5">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-20" />
              </div>
              <div className="flex justify-center items-center h-[140px] lg:h-[170px] xl:h-[180px]">
                <div className="relative h-[110px] w-[110px] lg:h-[130px] lg:w-[130px]">
                  <Skeleton className="absolute inset-0 rounded-full" />
                  <div className="absolute inset-[20px] rounded-full bg-white/30 dark:bg-black/30" />
                </div>
              </div>
              <div className="space-y-2 mt-4">
                {(['w-20', 'w-16', 'w-20'] as const).map((w, i) => (
                  <div key={i} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-2.5 w-2.5 rounded-full shrink-0" />
                      <Skeleton className={`h-3 ${w}`} />
                    </div>
                    <Skeleton className="h-3 w-6" />
                  </div>
                ))}
              </div>
            </div>

            {/* Horizontal bar — Membresías por plan */}
            <div className={`${glassCard} flex flex-col`}>
              <div className="mb-3 lg:mb-5 space-y-1.5">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-28" />
              </div>
              <div className="flex-1 min-h-[140px] lg:min-h-[190px] xl:min-h-[220px] flex flex-col justify-evenly gap-3">
                {[70, 50, 85].map((pct, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-3 w-16 shrink-0" />
                    <div className="flex-1 h-5 rounded-r-lg overflow-hidden bg-white/10 dark:bg-white/[0.04]">
                      <Skeleton className="h-full rounded-r-lg" style={{ width: `${pct}%` }} />
                    </div>
                    <Skeleton className="h-3 w-5 shrink-0" />
                  </div>
                ))}
              </div>
            </div>

            {/* Donut — Gastos por categoría */}
            <div className={`${glassCard} flex flex-col`}>
              <div className="mb-3 lg:mb-5 space-y-1.5">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-20" />
              </div>
              <div className="flex justify-center items-center h-[140px] lg:h-[170px] xl:h-[180px]">
                <div className="relative h-[110px] w-[110px] lg:h-[130px] lg:w-[130px]">
                  <Skeleton className="absolute inset-0 rounded-full" />
                  <div className="absolute inset-[20px] rounded-full bg-white/30 dark:bg-black/30" />
                </div>
              </div>
              <div className="space-y-2 mt-4">
                {(['w-16', 'w-12', 'w-20'] as const).map((w, i) => (
                  <div key={i} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-2.5 w-2.5 rounded-full shrink-0" />
                      <Skeleton className={`h-3 ${w}`} />
                    </div>
                    <Skeleton className="h-3 w-14" />
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>

        {/* Facturación */}
        <div className="space-y-3 lg:space-y-4">
          {sectionHeader}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">

            {/* Progress bar card */}
            <div className={glassCard}>
              <Skeleton className="h-4 w-52 mb-3 lg:mb-5" />
              <div className="space-y-3">
                <div className="flex justify-between">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-3 w-8" />
                </div>
                <Skeleton className="h-3 w-full rounded-full" />
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <Skeleton className="h-16 rounded-2xl" />
                  <Skeleton className="h-16 rounded-2xl" />
                </div>
              </div>
            </div>

            {/* Stats list card */}
            <div className={glassCard}>
              <Skeleton className="h-4 w-36 mb-3 lg:mb-5" />
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex items-center justify-between rounded-2xl px-4 py-3.5 bg-white/10 dark:bg-white/[0.04]">
                    <Skeleton className="h-3.5 w-28" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                ))}
                <div className="flex items-center gap-2 rounded-2xl border border-white/30 dark:border-white/10 px-4 py-3.5">
                  <Skeleton className="h-3.5 w-3.5 rounded-full shrink-0" />
                  <Skeleton className="h-3.5 w-44" />
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>
    )
  }

  // ── Error ──
  if (error || !stats) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24">
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-8 py-6 text-center">
          <p className="text-sm font-medium text-red-400 mb-3">{error ?? 'Error al cargar el dashboard'}</p>
          <button onClick={refetch} className="flex items-center gap-2 mx-auto text-xs text-red-400 underline hover:text-red-300">
            <RefreshCw size={12} /> Reintentar
          </button>
        </div>
      </div>
    )
  }

  // ── KPIs ──
  const kpis = [
    {
      label: 'Clientes activos',
      value: String(stats.clientes.activos),
      icon: Users,
      iconColor: 'text-primary',
      iconBg: 'bg-primary/10',
    },
    {
      label: 'Ingresos del mes',
      value: formatCurrency(stats.totalIngresos),
      icon: TrendingUp,
      iconColor: 'text-green-400',
      iconBg: 'bg-green-500/10',
    },
    {
      label: 'Gastos del mes',
      value: formatCurrency(stats.totalGastos),
      icon: TrendingDown,
      iconColor: 'text-red-400',
      iconBg: 'bg-red-500/10',
    },
    {
      label: 'Ganancia neta',
      value: formatCurrency(stats.gananciaNeta),
      icon: DollarSign,
      iconColor: stats.gananciaNeta >= 0 ? 'text-green-400' : 'text-red-400',
      iconBg:    stats.gananciaNeta >= 0 ? 'bg-green-500/10' : 'bg-red-500/10',
    },
  ]

  // ── Datos para gráficos ──
  const pieClientesData = [
    { name: 'Activos',    value: stats.clientes.activos,  color: C.green },
    { name: 'En deuda',   value: stats.clientes.enDeuda,  color: C.orange },
    { name: 'Vencidos',   value: stats.clientes.vencidos, color: C.red },
  ].filter(d => d.value > 0)

  const pieGastosData = stats.gastosPorCategoria.map((g, i) => ({
    name: g.categoria, value: g.total, color: PIE_GASTOS[i % PIE_GASTOS.length],
  }))

  return (
    <motion.div {...pageVariants} className="space-y-5 md:space-y-7 xl:space-y-10 pb-6 lg:pb-10 relative z-10">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl xl:text-4xl font-black tracking-tighter text-gray-900 dark:text-white drop-shadow-sm">
            Dashboard
          </h1>
          <p className="mt-1 text-xs lg:text-sm font-semibold text-gray-500 dark:text-gray-400">
            {periodLabel}, vista general del negocio
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Selector período */}
          <div className="flex items-center rounded-xl border border-saas-border dark:border-white/[0.08] bg-white/[0.6] dark:bg-white/[0.04] backdrop-blur-sm p-0.5 gap-0.5">
            {([['month', 'Mes'], ['year', 'Año'], ['range', 'Rango']] as [PeriodMode, string][]).map(([mode, label]) => (
              <button
                key={mode}
                onClick={() => { setPeriodMode(mode); if (mode !== 'range') setNavDate(today) }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  periodMode === mode
                    ? 'bg-gray-900 dark:bg-white/[0.12] text-white'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Navegador mes/año */}
          {periodMode !== 'range' && (
            <div className="flex items-center rounded-xl border border-saas-border dark:border-white/[0.08] bg-white/[0.6] dark:bg-white/[0.04] backdrop-blur-sm p-0.5">
              <button
                onClick={goBack}
                className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-white/40 dark:hover:bg-white/[0.06] transition-all"
              >
                <ChevronLeft size={15} />
              </button>
              <span className="px-2 text-xs font-black text-gray-700 dark:text-gray-200 min-w-[88px] text-center tabular-nums">
                {periodLabel}
              </span>
              <button
                onClick={goForward}
                disabled={isAtPresent}
                className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-white/40 dark:hover:bg-white/[0.06] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          )}

          {/* Date pickers rango */}
          {periodMode === 'range' && (
            <div className="flex items-center gap-1.5">
              <div
                style={{ colorScheme: 'light' }}
                className="rounded-xl border border-saas-border dark:border-white/[0.08] bg-white/[0.6] dark:bg-white/[0.04] backdrop-blur-sm"
              >
                <input
                  type="date"
                  value={rangeFrom}
                  max={rangeTo}
                  onChange={e => setRangeFrom(e.target.value)}
                  className="px-3 py-1.5 text-xs font-bold text-gray-700 focus:outline-none !bg-transparent"
                />
              </div>
              <span className="text-xs font-bold text-gray-400 dark:text-gray-500">,</span>
              <div
                style={{ colorScheme: 'light' }}
                className="rounded-xl border border-saas-border dark:border-white/[0.08] bg-white/[0.6] dark:bg-white/[0.04] backdrop-blur-sm"
              >
                <input
                  type="date"
                  value={rangeTo}
                  min={rangeFrom}
                  max={format(today, 'yyyy-MM-dd')}
                  onChange={e => setRangeTo(e.target.value)}
                  className="px-3 py-1.5 text-xs font-bold text-gray-700 focus:outline-none !bg-transparent"
                />
              </div>
            </div>
          )}

          {/* Refresh */}
          <button
            onClick={refetch}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-saas-border dark:border-white/[0.08] bg-white/[0.6] dark:bg-white/[0.04] backdrop-blur-sm text-gray-600 dark:text-gray-300 transition-all hover:scale-105"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* ══ SECCIÓN 1: KPIs ══ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4 xl:gap-6">
        {kpis.map(k => (
          <KpiCard key={k.label} label={k.label} value={k.value} icon={k.icon} iconColor={k.iconColor} iconBg={k.iconBg} />
        ))}
      </div>

      {/* ══ SECCIÓN 2: ALERTAS OPERATIVAS ══ */}
      <Section title="Alertas operativas" subtitle="Accionables, requieren atención hoy">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 lg:gap-4">

          {/* Clientes en deuda */}
          <motion.button
            whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
            onClick={() => navigate(ROUTES.CLIENTS)}
            className={`rounded-2xl lg:rounded-[2rem] border p-4 lg:p-6 text-left transition-all backdrop-blur-3xl flex items-start gap-3 lg:gap-4 ${
              stats.clientes.enDeuda > 0
                ? 'border-red-500/30 bg-red-500/10 hover:bg-red-500/15'
                : 'border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30'
            }`}
          >
            <div className={`flex h-9 w-9 lg:h-11 lg:w-11 shrink-0 items-center justify-center rounded-xl lg:rounded-2xl ${stats.clientes.enDeuda > 0 ? 'bg-red-500/20' : 'bg-white/20 dark:bg-white/10'}`}>
              <AlertCircle size={20} className={stats.clientes.enDeuda > 0 ? 'text-red-400' : 'text-gray-400'} />
            </div>
            <div>
              <p className="text-2xl lg:text-3xl font-black tabular-nums text-gray-900 dark:text-white">{stats.clientes.enDeuda}</p>
              <p className={`text-sm font-bold mt-0.5 ${stats.clientes.enDeuda > 0 ? 'text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>
                {stats.clientes.enDeuda === 1 ? 'cliente en deuda' : 'clientes en deuda'}
              </p>
              <p className="text-xs text-gray-400 dark:text-[#8A8A9A] mt-1">Tocá para ver el listado →</p>
            </div>
          </motion.button>

          {/* Membresías vencen en 7 días */}
          <div className={`rounded-2xl lg:rounded-[2rem] border p-4 lg:p-6 backdrop-blur-3xl flex items-start gap-3 lg:gap-4 ${
            stats.membresiasPorVencer.en7dias > 0
              ? 'border-orange-500/30 bg-orange-500/10'
              : 'border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30'
          }`}>
            <div className={`flex h-9 w-9 lg:h-11 lg:w-11 shrink-0 items-center justify-center rounded-xl lg:rounded-2xl ${stats.membresiasPorVencer.en7dias > 0 ? 'bg-orange-500/20' : 'bg-white/20 dark:bg-white/10'}`}>
              <AlertTriangle size={20} className={stats.membresiasPorVencer.en7dias > 0 ? 'text-orange-400' : 'text-gray-400'} />
            </div>
            <div>
              <p className="text-2xl lg:text-3xl font-black tabular-nums text-gray-900 dark:text-white">{stats.membresiasPorVencer.en7dias}</p>
              <p className={`text-sm font-bold mt-0.5 ${stats.membresiasPorVencer.en7dias > 0 ? 'text-orange-400' : 'text-gray-500 dark:text-gray-400'}`}>
                {stats.membresiasPorVencer.en7dias === 1 ? 'membresía vence' : 'membresías vencen'} en 7 días
              </p>
              <p className="text-xs text-gray-400 dark:text-[#8A8A9A] mt-1">Contactar para renovar</p>
            </div>
          </div>

          {/* Membresías vencen en 30 días */}
          <div className={`rounded-2xl lg:rounded-[2rem] border p-4 lg:p-6 backdrop-blur-3xl flex items-start gap-3 lg:gap-4 ${
            stats.membresiasPorVencer.en30dias > 0
              ? 'border-yellow-500/30 bg-yellow-500/10'
              : 'border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30'
          }`}>
            <div className={`flex h-9 w-9 lg:h-11 lg:w-11 shrink-0 items-center justify-center rounded-xl lg:rounded-2xl ${stats.membresiasPorVencer.en30dias > 0 ? 'bg-yellow-500/20' : 'bg-white/20 dark:bg-white/10'}`}>
              <Clock size={20} className={stats.membresiasPorVencer.en30dias > 0 ? 'text-yellow-400' : 'text-gray-400'} />
            </div>
            <div>
              <p className="text-2xl lg:text-3xl font-black tabular-nums text-gray-900 dark:text-white">{stats.membresiasPorVencer.en30dias}</p>
              <p className={`text-sm font-bold mt-0.5 ${stats.membresiasPorVencer.en30dias > 0 ? 'text-yellow-500 dark:text-yellow-400' : 'text-gray-500 dark:text-gray-400'}`}>
                {stats.membresiasPorVencer.en30dias === 1 ? 'membresía vence' : 'membresías vencen'} en 30 días
              </p>
              <p className="text-xs text-gray-400 dark:text-[#8A8A9A] mt-1">En el próximo mes</p>
            </div>
          </div>

        </div>
      </Section>

      {/* ══ SECCIÓN 3: FINANCIERO ══ */}
      <Section
        title="Financiero"
        subtitle="Evolución de ingresos y gastos"
        headerAction={chartHeaderAction}
      >
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 lg:gap-6">

          {/* AreaChart histórico */}
          <ChartCard
            title="Ingresos vs Gastos"
            subtitle={chartSubtitle}
            className="xl:col-span-8 min-h-[240px] lg:min-h-[300px] xl:min-h-[340px]"
          >
            <div className="flex items-center gap-5 mb-4">
              {[['Ingresos', C.primary], ['Gastos', C.red], ['Ganancia', C.green]].map(([label, color]) => (
                <span key={label} className="flex items-center gap-1.5 text-xs font-bold text-gray-500 dark:text-gray-400">
                  <span className="h-2 w-4 rounded-full inline-block" style={{ background: color as string }} />
                  {label}
                </span>
              ))}
            </div>
            <div className="flex-1 min-h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={activeChartData} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    {[['ing', C.primary], ['gas', C.red], ['gan', C.green]].map(([id, color]) => (
                      <linearGradient key={id} id={`grad-${id}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={color as string} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={color as string} stopOpacity={0} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.05} vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: '#9CA3AF', fontSize: 12, fontWeight: 700 }} axisLine={false} tickLine={false} dy={8} />
                  <YAxis tick={{ fill: '#9CA3AF', fontSize: 11, fontWeight: 700 }} axisLine={false} tickLine={false} width={58} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip {...TooltipStyle} formatter={(v: number) => formatCurrency(v)} />
                  <Area type="monotone" dataKey="ingresos"    name="Ingresos" stroke={C.primary} strokeWidth={2.5} fill="url(#grad-ing)" activeDot={{ r: 6, fill: C.primary, strokeWidth: 0 }} />
                  <Area type="monotone" dataKey="gastos"      name="Gastos"   stroke={C.red}     strokeWidth={2}   fill="url(#grad-gas)" activeDot={{ r: 5, fill: C.red, strokeWidth: 0 }} />
                  <Area type="monotone" dataKey="gananciaNeta" name="Ganancia" stroke={C.green}  strokeWidth={2}   fill="url(#grad-gan)" activeDot={{ r: 5, fill: C.green, strokeWidth: 0 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          {/* BarChart por método */}
          <ChartCard title="Por método de cobro" subtitle={periodLabel} className="xl:col-span-4 min-h-[240px] lg:min-h-[300px] xl:min-h-[340px]">
            {stats.ingresosPorMetodo.length === 0 ? (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-sm text-gray-400 dark:text-[#8A8A9A]">Sin pagos en este período</p>
              </div>
            ) : (
              <div className="flex-1 min-h-[160px] lg:min-h-[220px] xl:min-h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.ingresosPorMetodo} margin={{ top: 5, right: 8, left: 0, bottom: 20 }} barSize={28}>
                    <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.05} vertical={false} horizontal={false} />
                    <XAxis dataKey="metodo" axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 11, fontWeight: 700 }} interval={0} angle={-15} textAnchor="end" dy={6} />
                    <YAxis tick={{ fill: '#9CA3AF', fontSize: 11, fontWeight: 700 }} axisLine={false} tickLine={false} width={52} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip {...TooltipStyle} formatter={(v: number) => [formatCurrency(v), 'Total']} />
                    <Bar dataKey="total" radius={[8, 8, 8, 8]}>
                      {stats.ingresosPorMetodo.map((_, i) => (
                        <Cell key={i} fill={BAR_METODOS[i % BAR_METODOS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </ChartCard>

        </div>
      </Section>

      {/* ══ SECCIÓN 4: CLIENTES & PLANES ══ */}
      <Section title="Clientes y planes" subtitle="Distribución actual del gimnasio">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-6">

          {/* Donut clientes por estado */}
          <ChartCard title="Estado de clientes" subtitle="Total actual">
            {pieClientesData.length === 0 ? (
              <p className="text-sm text-gray-400 flex-1 flex items-center">Sin clientes registrados</p>
            ) : (<>
              <div className="h-[140px] lg:h-[170px] xl:h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieClientesData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} dataKey="value" paddingAngle={3}>
                      {pieClientesData.map((d, i) => <Cell key={i} fill={d.color} strokeWidth={0} />)}
                    </Pie>
                    <Tooltip {...TooltipStyle} formatter={(v: number) => [v, 'Clientes']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <PieLegend items={pieClientesData.map(d => ({ label: d.name, value: d.value, color: d.color }))} />
            </>)}
          </ChartCard>

          {/* BarChart por plan */}
          <ChartCard title="Membresías por plan" subtitle="Clientes activos">
            {stats.clientesPorPlan.length === 0 ? (
              <p className="text-sm text-gray-400 flex-1 flex items-center">Sin membresías activas</p>
            ) : (
              <div className="flex-1 min-h-[140px] lg:min-h-[190px] xl:min-h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={stats.clientesPorPlan}
                    layout="vertical"
                    margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
                    barSize={20}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.05} horizontal={false} />
                    <XAxis type="number" tick={{ fill: '#9CA3AF', fontSize: 11, fontWeight: 700 }} axisLine={false} tickLine={false} />
                    <YAxis
                      type="category"
                      dataKey="nombre"
                      width={100}
                      tick={{ fill: '#9CA3AF', fontSize: 11, fontWeight: 700 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v: string) => v.replace(' veces por semana', '×/sem').replace('Full (4-5 veces por semana)', 'Full')}
                    />
                    <Tooltip {...TooltipStyle} formatter={(v: number) => [v, 'Clientes']} />
                    <Bar dataKey="cantidad" radius={[0, 8, 8, 0]} fill={C.primary} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </ChartCard>

          {/* Donut gastos por categoría */}
          <ChartCard title="Gastos por categoría" subtitle={periodLabel}>
            {pieGastosData.length === 0 ? (
              <p className="text-sm text-gray-400 flex-1 flex items-center">Sin gastos en este período</p>
            ) : (<>
              <div className="h-[140px] lg:h-[170px] xl:h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieGastosData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} dataKey="value" paddingAngle={3}>
                      {pieGastosData.map((d, i) => <Cell key={i} fill={d.color} strokeWidth={0} />)}
                    </Pie>
                    <Tooltip {...TooltipStyle} formatter={(v: number) => [formatCurrency(v), 'Total']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <PieLegend items={pieGastosData.map(d => ({ label: d.name, value: formatCurrency(d.value), color: d.color }))} />
            </>)}
          </ChartCard>

        </div>
      </Section>

      {/* ══ SECCIÓN 5: FACTURACIÓN ══ */}
      <Section
        title="Facturación"
        subtitle={chartView === 'meses' ? `Estado de los ingresos, ${periodLabel}` : chartView === 'años' ? 'Totales por año' : 'Totales históricos'}
        headerAction={chartHeaderAction}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">

          {chartView === 'meses' ? (
            <ChartCard title="Ingresos facturados vs sin facturar">
              <FacturacionBar
                facturado={stats.facturacion.facturado}
                sinFacturar={stats.facturacion.sinFacturar}
                total={stats.facturacion.total}
              />
            </ChartCard>
          ) : (
            <ChartCard title="Ingresos vs Gastos" subtitle={chartSubtitle} className="min-h-[220px]">
              {chartData.length === 0 ? (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-sm text-gray-400 dark:text-[#8A8A9A]">Sin datos en este período</p>
                </div>
              ) : (
                <div className="flex-1 min-h-[160px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={activeChartData} barSize={18} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.05} vertical={false} />
                      <XAxis dataKey="label" tick={{ fill: '#9CA3AF', fontSize: 11, fontWeight: 700 }} axisLine={false} tickLine={false} dy={6} />
                      <YAxis tick={{ fill: '#9CA3AF', fontSize: 11, fontWeight: 700 }} axisLine={false} tickLine={false} width={52} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                      <Tooltip {...TooltipStyle} formatter={(v: number) => formatCurrency(v)} />
                      <Bar dataKey="ingresos" name="Ingresos" radius={[4, 4, 0, 0]} fill={C.primary} />
                      <Bar dataKey="gastos"   name="Gastos"   radius={[4, 4, 0, 0]} fill={C.red} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </ChartCard>
          )}

          {/* Resumen */}
          <ChartCard title="Resumen del período">
            <div className="space-y-3 flex-1">
              {[
                {
                  label: 'Ingresos totales',
                  value: formatCurrency(facturAgg ? facturAgg.totalIngresos : stats.totalIngresos),
                  color: 'text-green-500 dark:text-green-400', bg: 'bg-green-500/10',
                },
                {
                  label: 'Gastos totales',
                  value: formatCurrency(facturAgg ? facturAgg.totalGastos : stats.totalGastos),
                  color: 'text-red-500 dark:text-red-400', bg: 'bg-red-500/10',
                },
                {
                  label: 'Ganancia neta',
                  value: formatCurrency(facturAgg ? facturAgg.gananciaNeta : stats.gananciaNeta),
                  color: (facturAgg ? facturAgg.gananciaNeta : stats.gananciaNeta) >= 0 ? 'text-green-500 dark:text-green-400' : 'text-red-500 dark:text-red-400',
                  bg:    (facturAgg ? facturAgg.gananciaNeta : stats.gananciaNeta) >= 0 ? 'bg-green-500/10' : 'bg-red-500/10',
                },
              ].map(row => (
                <div key={row.label} className={`flex items-center justify-between rounded-2xl px-4 py-3.5 ${row.bg}`}>
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{row.label}</span>
                  <span className={`text-base font-black tabular-nums ${row.color}`}>{row.value}</span>
                </div>
              ))}
              <div className="flex items-center gap-2 rounded-2xl border border-white/30 dark:border-white/10 px-4 py-3.5">
                <CheckCircle2 size={15} className="text-primary shrink-0" />
                <span className="text-sm font-semibold text-gray-600 dark:text-gray-300">
                  {stats.clientes.activos} clientes activos al día de hoy
                </span>
              </div>
            </div>
          </ChartCard>

        </div>
      </Section>

    </motion.div>
  )
}
