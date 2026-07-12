import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { pageVariants, staggerContainerFast, fadeUpItem } from '../lib/motion'
import {
  TrendingUp, TrendingDown, Users, DollarSign, RefreshCw,
  AlertTriangle, Clock, AlertCircle, CheckCircle2,
  ChevronLeft, ChevronRight, CreditCard, UserX, Activity,
} from 'lucide-react'
import { format, startOfMonth, endOfMonth, addMonths, subMonths, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  useDashboardAlertas,
  useDashboardFinanciero,
  useDashboardClientes,
  useDashboardFacturacion,
  useDashboardHistorico,
} from '../hooks/useDashboard'
import Skeleton from '../components/ui/Skeleton'
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
}

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
  labelStyle: { color: '#fff', fontWeight: 700, marginBottom: 4 },
  itemStyle: { color: '#fff', fontWeight: 900, padding: '2px 0' },
  cursor: { fill: 'rgba(255,255,255,0.04)' },
}

// ── ChartView toggle ──────────────────────────────────────────────────────────

type ChartView = 'meses' | 'años' | 'historico'

function ViewToggle({ value, onChange }: { value: ChartView; onChange: (v: ChartView) => void }) {
  return (
    <div className="flex items-center rounded-full border border-black/[0.08] dark:border-white/10 bg-white/60 dark:!bg-black/40 backdrop-blur-xl p-1 shadow-sm gap-1 w-full sm:w-auto">
      {([['historico', 'Histórico'], ['años', 'Años'], ['meses', 'Meses']] as [ChartView, string][]).map(([mode, label]) => {
        const isActive = value === mode
        return (
          <button
            key={mode}
            onClick={() => onChange(mode)}
            className={`relative inline-flex flex-1 sm:flex-none items-center justify-center rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors duration-200 cursor-pointer ${
              isActive
                ? 'text-white'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-900 hover:bg-black/[0.06] dark:hover:bg-white/80'
            }`}
          >
            <span
              className={`absolute inset-0 rounded-full bg-gray-900 shadow-[0_2px_8px_rgba(0,0,0,0.25)] transition-opacity duration-200 ${isActive ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
              style={{ zIndex: 0 }}
            />
            <span className="relative z-10">{label}</span>
          </button>
        )
      })}
    </div>
  )
}

// ── Sección wrapper ───────────────────────────────────────────────────────────

function Section({ title, subtitle, children, headerAction }: {
  title: string; subtitle?: string; children: React.ReactNode; headerAction?: React.ReactNode
}) {
  return (
    <motion.div
      className="space-y-3 lg:space-y-4"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-3">
        <div>
          <h2 className="text-base lg:text-xl font-black tracking-tight text-gray-900 dark:text-white">{title}</h2>
          {subtitle && <p className="text-xs lg:text-sm font-semibold text-gray-500 dark:text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
        {headerAction}
      </div>
      {children}
    </motion.div>
  )
}

// ── Card genérica de gráfico ──────────────────────────────────────────────────

function ChartCard({ title, subtitle, children, className = '' }: {
  title: string; subtitle?: string; children: React.ReactNode; className?: string
}) {
  return (
    <motion.div
      className={`rounded-2xl lg:rounded-[2rem] border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-3xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)] p-4 lg:p-6 flex flex-col ${className}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="mb-3 lg:mb-5">
        <h3 className="text-sm lg:text-base font-bold text-gray-900 dark:text-white">{title}</h3>
        {subtitle && <p className="text-xs font-semibold text-gray-400 dark:text-[#8A8A9A] mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </motion.div>
  )
}

// ── Leyenda personalizada para PieChart ───────────────────────────────────────

function PieLegend({ items }: { items: { label: string; value: number | string; color: string }[] }) {
  return (
    <motion.div className="space-y-2 mt-4" variants={staggerContainerFast} initial="initial" animate="animate">
      {items.map(item => (
        <motion.div key={item.label} variants={fadeUpItem} className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: item.color }} />
            <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 truncate">{item.label}</span>
          </div>
          <span className="text-xs font-black tabular-nums text-gray-900 dark:text-white shrink-0">{item.value}</span>
        </motion.div>
      ))}
    </motion.div>
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
          className="h-full w-full rounded-full bg-primary"
          style={{ transformOrigin: 'left' }}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: pctFacturado / 100 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
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

type PeriodMode = 'month' | 'year' | 'range' | 'historic'

export default function DashboardPage() {
  const today = new Date()
  const navigate = useNavigate()

  const [periodMode, setPeriodMode] = useState<PeriodMode>('month')
  const [navDate, setNavDate] = useState(today)
  const [rangeFrom, setRangeFrom] = useState(format(startOfMonth(today), 'yyyy-MM-dd'))
  const [rangeTo,   setRangeTo]   = useState(format(endOfMonth(today),   'yyyy-MM-dd'))

  const fromDate = useMemo(() => {
    if (periodMode === 'range')   return rangeFrom
    if (periodMode === 'historic') return '2020-01-01'
    if (periodMode === 'month')   return format(startOfMonth(navDate), 'yyyy-MM-dd')
    return format(new Date(navDate.getFullYear(), 0, 1), 'yyyy-MM-dd')
  }, [periodMode, navDate, rangeFrom])

  const toDate = useMemo(() => {
    if (periodMode === 'range')   return rangeTo
    if (periodMode === 'historic') return format(today, 'yyyy-MM-dd')
    if (periodMode === 'month')   return format(endOfMonth(navDate), 'yyyy-MM-dd')
    return format(new Date(navDate.getFullYear(), 11, 31), 'yyyy-MM-dd')
  }, [periodMode, navDate, rangeTo])

  const periodLabel = useMemo(() => {
    if (periodMode === 'range') {
      const fmtDate = (iso: string, withYear = false) => {
        const d = parseISO(iso)
        const day = format(d, 'd', { locale: es })
        const mon = format(d, 'MMM', { locale: es }).replace(/^\w/, c => c.toUpperCase())
        return withYear ? `${day} ${mon} ${format(d, 'yyyy')}` : `${day} ${mon}`
      }
      const from = rangeFrom ? fmtDate(rangeFrom) : '.'
      const to   = rangeTo   ? fmtDate(rangeTo, true) : '.'
      return `${from}, ${to}`
    }
    if (periodMode === 'historic') return 'Todo el tiempo'
    if (periodMode === 'month')
      return format(navDate, 'MMMM yyyy', { locale: es }).replace(/^\w/, c => c.toUpperCase())
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
  const [activePieClienteIdx, setActivePieClienteIdx] = useState<number | null>(null)
  const [activePiePagoIdx,    setActivePiePagoIdx]    = useState<number | null>(null)
  const [activePieGastoIdx,   setActivePieGastoIdx]   = useState<number | null>(null)
  const [facturacionYear, setFacturacionYear] = useState(today.getFullYear())
  const [facturacionMonthOffset, setFacturacionMonthOffset] = useState(0)
  const facturacionNavDate = addMonths(today, -facturacionMonthOffset)
  const facturacionMesLabel = format(facturacionNavDate, 'MMMM yyyy', { locale: es }).replace(/^\w/, c => c.toUpperCase())

  const historicoMeses = chartView === 'meses' ? 24 : chartView === 'años' ? 60 : 120

  // ── 5 hooks granulares — cada sección carga independientemente ────────────────
  const alertasHook     = useDashboardAlertas()
  const financieroHook  = useDashboardFinanciero({ desde: fromDate, hasta: toDate })
  const clientesHook    = useDashboardClientes()
  const facturacionHook = useDashboardFacturacion({ desde: fromDate, hasta: toDate })
  const historicoHook   = useDashboardHistorico(historicoMeses)

  // Hook de facturación para la sección billing — siempre relativo a hoy, no al período del header
  const facturacionChartParams = useMemo(() => {
    if (chartView === 'meses') return {
      desde: format(startOfMonth(facturacionNavDate), 'yyyy-MM-dd'),
      hasta: format(endOfMonth(facturacionNavDate),   'yyyy-MM-dd'),
    }
    if (chartView === 'años') return {
      desde: `${facturacionYear}-01-01`,
      hasta: `${facturacionYear}-12-31`,
    }
    return { desde: '2020-01-01', hasta: format(today, 'yyyy-MM-dd') }
  }, [chartView, facturacionYear, facturacionMonthOffset])  // eslint-disable-line react-hooks/exhaustive-deps
  const facturacionChartHook = useDashboardFacturacion(facturacionChartParams)

  const refetchAll = () => {
    alertasHook.refetch(); financieroHook.refetch(); clientesHook.refetch()
    facturacionHook.refetch(); facturacionChartHook.refetch(); historicoHook.refetch()
  }

  // Dataset base para gráfico histórico
  const chartData = useMemo(() => {
    const hist = historicoHook.data
    if (!hist?.length) return []

    if (chartView === 'años') {
      // Agrupa por año, label = "2024"
      const byYear = new Map<string, typeof hist[0]>()
      for (const p of hist) {
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
    }

    if (chartView === 'historico') {
      const MESES_ABREV = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
      // Construye etiqueta "Ene '24" y descarta meses vacíos al inicio
      const withLabel = hist.map(p => {
        const [y, m] = p.mes.split('-').map(Number)
        return { ...p, label: `${MESES_ABREV[m - 1]} '${String(y).slice(2)}` }
      })
      // Arranca un mes antes del primer punto con datos (para que el gráfico parta desde 0)
      const firstNonZero = withLabel.findIndex(p => p.ingresos > 0 || p.gastos > 0)
      const startIdx = firstNonZero > 0 ? firstNonZero - 1 : firstNonZero
      return startIdx >= 0 ? withLabel.slice(startIdx) : withLabel
    }

    // 'meses' — datos crudos con label original
    return hist
  }, [historicoHook.data, chartView])

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
    if (chartView === 'años')      return 'Por año'
    if (chartView === 'historico') return 'Histórico completo'
    if (!activeChartData.length)   return 'Últimos 12 meses'
    if (chartMonthOffset === 0)    return 'Últimos 12 meses'
    return `${activeChartData[0].label} – ${activeChartData[activeChartData.length - 1].label}`
  }, [chartView, activeChartData, chartMonthOffset])

  const makeChartHeaderAction = (id: string) => (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
      {chartView === 'meses' && (
        <div className="flex items-center rounded-full border border-black/[0.08] dark:border-white/10 bg-white/60 dark:!bg-black/40 backdrop-blur-xl p-1 shadow-sm gap-1 w-full sm:w-auto">
          <button
            onClick={goChartBack}
            disabled={!canGoBack}
            className="flex h-7 w-7 items-center justify-center rounded-full text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white/40 dark:hover:bg-white/[0.05] transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="flex-1 px-2 text-[10px] font-bold uppercase tracking-wider text-gray-700 dark:text-gray-200 text-center tabular-nums">
            {chartSubtitle}
          </span>
          <button
            onClick={goChartForward}
            disabled={!canGoForward}
            className="flex h-7 w-7 items-center justify-center rounded-full text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white/40 dark:hover:bg-white/[0.05] transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}
      <ViewToggle value={chartView} onChange={changeChartView} />
    </div>
  )

  const makeFacturacionHeaderAction = () => (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
      {chartView === 'meses' && (
        <div className="flex items-center rounded-full border border-black/[0.08] dark:border-white/10 bg-white/60 dark:!bg-black/40 backdrop-blur-xl p-1 shadow-sm gap-1 w-full sm:w-auto">
          <button
            onClick={() => setFacturacionMonthOffset(v => v + 1)}
            className="flex h-7 w-7 items-center justify-center rounded-full text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white/40 dark:hover:bg-white/[0.05] transition-all cursor-pointer"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="flex-1 px-2 text-[10px] font-bold uppercase tracking-wider text-gray-700 dark:text-gray-200 text-center tabular-nums">
            {facturacionMesLabel}
          </span>
          <button
            onClick={() => setFacturacionMonthOffset(v => Math.max(0, v - 1))}
            disabled={facturacionMonthOffset === 0}
            className="flex h-7 w-7 items-center justify-center rounded-full text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white/40 dark:hover:bg-white/[0.05] transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}
      {chartView === 'años' && (
        <div className="flex items-center rounded-full border border-black/[0.08] dark:border-white/10 bg-white/60 dark:!bg-black/40 backdrop-blur-xl p-1 shadow-sm gap-1">
          <button
            onClick={() => setFacturacionYear(y => y - 1)}
            className="flex h-7 w-7 items-center justify-center rounded-full text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white/40 dark:hover:bg-white/[0.05] transition-all cursor-pointer"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="px-2 text-xs font-bold text-gray-800 dark:text-gray-200 tabular-nums">
            {facturacionYear}
          </span>
          <button
            onClick={() => setFacturacionYear(y => y + 1)}
            disabled={facturacionYear >= today.getFullYear()}
            className="flex h-7 w-7 items-center justify-center rounded-full text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white/40 dark:hover:bg-white/[0.05] transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}
      <ViewToggle value={chartView} onChange={changeChartView} />
    </div>
  )

  // ── Datos derivados ──────────────────────────────────────────────────────────
  const f = financieroHook.data
  const a = alertasHook.data
  const c = clientesHook.data
  const fc = facturacionHook.data

  const gananciaNeta  = f?.gananciaNeta ?? 0
  const clientesActivos = c?.distribucion.activos ?? a?.clientesActivos ?? 0

  const kpis = [
    {
      label: 'Clientes activos',
      value: String(clientesActivos),
      icon: Users,
      iconColor: 'text-primary',
      iconBg: 'bg-primary/10',
    },
    {
      label: 'Ingresos del mes',
      value: formatCurrency(f?.ingresos.total ?? 0),
      icon: TrendingUp,
      iconColor: 'text-green-400',
      iconBg: 'bg-green-500/10',
    },
    {
      label: 'Gastos del mes',
      value: formatCurrency(f?.gastos.total ?? 0),
      icon: TrendingDown,
      iconColor: 'text-red-400',
      iconBg: 'bg-red-500/10',
    },
    {
      label: 'Ganancia neta',
      value: formatCurrency(gananciaNeta),
      icon: DollarSign,
      iconColor: gananciaNeta >= 0 ? 'text-green-400' : 'text-red-400',
      iconBg:    gananciaNeta >= 0 ? 'bg-green-500/10' : 'bg-red-500/10',
    },
  ]

  const pieActividadData = (a || c)
    ? [
        { name: 'Activos',   value: a?.clientesActivos ?? 0, color: C.green },
        { name: 'Inactivos', value: Math.max(0, (c?.distribucion.total ?? 0) - (a?.clientesActivos ?? 0)), color: '#6B7280' },
      ].filter(d => d.value > 0)
    : []

  const piePagoData = c
    ? [
        { name: 'Al día',   value: c.distribucion.activos,  color: C.green },
        { name: 'Vencida',  value: c.distribucion.enDeuda + c.distribucion.vencidos, color: C.orange },
      ].filter(d => d.value > 0)
    : []

  const vencimientosData = a ? [
    { label: '7 días',  value: a.membresiasPorVencer.en7dias,  color: C.red },
    { label: '15 días', value: a.membresiasPorVencer.en15dias, color: C.orange },
    { label: '30 días', value: a.membresiasPorVencer.en30dias, color: C.primary },
  ] : []
  const maxVencimiento = Math.max(...vencimientosData.map(d => d.value), 1)

  const pieGastosData = f
    ? f.gastosPorCategoria.map((g, i) => ({
        name: g.categoria, value: g.total, color: PIE_GASTOS[i % PIE_GASTOS.length],
      }))
    : []

  // ── KPI loading: combina financiero + clientes ───────────────────────────────
  const kpiLoading = financieroHook.isLoading || clientesHook.isLoading

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
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2">
          {/* Navegador de fecha — primero (izquierda) */}
          <AnimatePresence mode="wait">
            {periodMode === 'month' || periodMode === 'year' ? (
              <motion.div
                key="nav-date"
                initial={{ opacity: 0, x: -8, scale: 0.96 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -8, scale: 0.96 }}
                transition={{ duration: 0.15, ease: 'easeInOut' }}
                className="flex items-center rounded-full border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-xl p-1 shadow-sm gap-1 w-full sm:w-auto"
              >
                <button
                  onClick={goBack}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white/40 dark:hover:bg-white/[0.05] transition-all cursor-pointer"
                >
                  <ChevronLeft size={15} />
                </button>
                <span className="flex-1 px-3 text-xs font-bold tracking-tight text-gray-800 dark:text-gray-200 text-center tabular-nums">
                  {periodLabel}
                </span>
                <button
                  onClick={goForward}
                  disabled={isAtPresent}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white/40 dark:hover:bg-white/[0.05] transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                >
                  <ChevronRight size={15} />
                </button>
              </motion.div>
            ) : periodMode === 'range' ? (
              <motion.div
                key="picker-range"
                initial={{ opacity: 0, x: 8, scale: 0.96 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 8, scale: 0.96 }}
                transition={{ duration: 0.15, ease: 'easeInOut' }}
                className="flex items-center gap-1.5"
              >
                <div
                  style={{ colorScheme: 'light' }}
                  className="rounded-xl border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-xl px-3 py-1 text-xs font-semibold text-gray-800 dark:text-gray-200 focus-within:border-primary shadow-sm h-9 flex items-center"
                >
                  <input
                    type="date"
                    value={rangeFrom}
                    max={rangeTo}
                    onChange={e => setRangeFrom(e.target.value)}
                    className="bg-transparent focus:outline-none cursor-pointer font-bold text-gray-800 dark:text-gray-200"
                  />
                </div>
                <span className="text-xs font-bold text-gray-400 dark:text-[#8A8A9A]">/</span>
                <div
                  style={{ colorScheme: 'light' }}
                  className="rounded-xl border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-xl px-3 py-1 text-xs font-semibold text-gray-800 dark:text-gray-200 focus-within:border-primary shadow-sm h-9 flex items-center"
                >
                  <input
                    type="date"
                    value={rangeTo}
                    min={rangeFrom}
                    max={format(today, 'yyyy-MM-dd')}
                    onChange={e => setRangeTo(e.target.value)}
                    className="bg-transparent focus:outline-none cursor-pointer font-bold text-gray-800 dark:text-gray-200"
                  />
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>

          {/* Selector período */}
          <div className="flex items-center rounded-full border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-xl p-1 shadow-sm gap-1 w-full sm:w-auto">
            {([['historic', 'Histórico'], ['year', 'Año'], ['month', 'Mes'], ['range', 'Rango']] as [PeriodMode, string][]).map(([mode, label]) => {
              const isActive = periodMode === mode
              return (
                <button
                  key={mode}
                  onClick={() => { setPeriodMode(mode); if (mode !== 'range' && mode !== 'historic') setNavDate(today) }}
                  className={`relative inline-flex flex-1 sm:flex-none items-center justify-center rounded-full px-4 py-1.5 text-xs font-bold transition-colors duration-200 cursor-pointer ${
                    isActive
                      ? 'text-white'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-900 hover:bg-black/[0.06] dark:hover:bg-white/80'
                  }`}
                >
                  <span
                    className={`absolute inset-0 rounded-full bg-gray-900 shadow-[0_2px_8px_rgba(0,0,0,0.25)] transition-opacity duration-200 ${isActive ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                    style={{ zIndex: 0 }}
                  />
                  <span className="relative z-10">{label}</span>
                </button>
              )
            })}
          </div>

          {/* Refresh global */}
          <button
            onClick={refetchAll}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-xl text-gray-600 dark:text-gray-300 transition-all hover:scale-105 hover:bg-white/50 dark:hover:bg-black/50 shadow-sm cursor-pointer"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* ══ SECCIÓN 1: KPIs — carga con financiero + clientes ══ */}
      <motion.div
        className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4 xl:gap-6"
        variants={staggerContainerFast}
        initial="initial"
        animate="animate"
      >
        {kpis.map(k => (
          <motion.div key={k.label} variants={fadeUpItem}>
            <KpiCard label={k.label} value={k.value} icon={k.icon} iconColor={k.iconColor} iconBg={k.iconBg} isLoading={kpiLoading} />
          </motion.div>
        ))}
      </motion.div>

      {/* ══ SECCIÓN 2: ALERTAS — carga independientemente ══ */}
      <Section title="Alertas operativas" subtitle="Accionables, requieren atención hoy">
        <motion.div
          className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4"
          variants={staggerContainerFast}
          initial="initial"
          animate="animate"
        >

          {/* Clientes con membresía vencida */}
          <motion.button
            variants={fadeUpItem}
            whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
            onClick={() => navigate(ROUTES.CLIENTS + '?estado=expiring')}
            className={`rounded-2xl lg:rounded-[2rem] border p-4 lg:p-6 text-left transition-all backdrop-blur-3xl flex items-start gap-3 lg:gap-4 ${
              a && a.clientesEnDeuda > 0
                ? 'border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/15'
                : 'border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30'
            }`}
          >
            <div className={`flex h-9 w-9 lg:h-11 lg:w-11 shrink-0 items-center justify-center rounded-xl lg:rounded-2xl shadow-inner ${a && a.clientesEnDeuda > 0 ? 'bg-amber-500/20' : 'bg-white/20 dark:bg-white/10'}`}>
              <AlertCircle size={20} className={a && a.clientesEnDeuda > 0 ? 'text-amber-400' : 'text-gray-400'} />
            </div>
            <div>
              {alertasHook.isLoading ? (
                <div className="space-y-1.5 mt-0.5"><Skeleton className="h-8 lg:h-9 w-12" /><Skeleton className="h-4 w-32" /></div>
              ) : (
                <>
                  <p className="text-2xl lg:text-3xl font-black tabular-nums text-gray-900 dark:text-white">{a?.clientesEnDeuda ?? 0}</p>
                  <p className={`text-sm font-bold mt-0.5 ${a && a.clientesEnDeuda > 0 ? 'text-amber-400' : 'text-gray-500 dark:text-gray-400'}`}>
                    {a && a.clientesEnDeuda === 1 ? 'cliente con membresía vencida' : 'clientes con membresía vencida'}
                  </p>
                </>
              )}
              <p className="text-xs text-gray-400 dark:text-[#8A8A9A] mt-1">Tocá para ver el listado →</p>
            </div>
          </motion.button>

          {/* Cuotas por cobrar esta semana */}
          <motion.button
            variants={fadeUpItem}
            whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
            onClick={() => navigate(ROUTES.CLIENTS)}
            className={`rounded-2xl lg:rounded-[2rem] border p-4 lg:p-6 text-left transition-all backdrop-blur-3xl flex items-start gap-3 lg:gap-4 ${
              a && a.cuotasPorCobrar > 0
                ? 'border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/15'
                : 'border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30'
            }`}
          >
            <div className={`flex h-9 w-9 lg:h-11 lg:w-11 shrink-0 items-center justify-center rounded-xl lg:rounded-2xl shadow-inner ${a && a.cuotasPorCobrar > 0 ? 'bg-blue-500/20' : 'bg-white/20 dark:bg-white/10'}`}>
              <CreditCard size={20} className={a && a.cuotasPorCobrar > 0 ? 'text-blue-400' : 'text-gray-400'} />
            </div>
            <div>
              {alertasHook.isLoading ? (
                <div className="space-y-1.5 mt-0.5"><Skeleton className="h-8 lg:h-9 w-12" /><Skeleton className="h-4 w-36" /></div>
              ) : (
                <>
                  <p className="text-2xl lg:text-3xl font-black tabular-nums text-gray-900 dark:text-white">{a?.cuotasPorCobrar ?? 0}</p>
                  <p className={`text-sm font-bold mt-0.5 ${a && a.cuotasPorCobrar > 0 ? 'text-blue-400' : 'text-gray-500 dark:text-gray-400'}`}>
                    {a && a.cuotasPorCobrar === 1 ? 'cuota vence' : 'cuotas vencen'} esta semana
                  </p>
                </>
              )}
              <p className="text-xs text-gray-400 dark:text-[#8A8A9A] mt-1">Membresías 3 y 6 meses →</p>
            </div>
          </motion.button>

          {/* Clientes sin turno inscripto */}
          <motion.button
            variants={fadeUpItem}
            whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
            onClick={() => navigate(ROUTES.CLIENTS)}
            className="rounded-2xl lg:rounded-[2rem] border p-4 lg:p-6 text-left transition-all backdrop-blur-3xl flex items-start gap-3 lg:gap-4 border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30"
            style={a && a.clientesSinTurno > 0 ? {
              backgroundImage: 'radial-gradient(circle at 100% 100%, rgba(139,92,246,0.09) 0%, transparent 35%)',
            } : undefined}
          >
            <div className={`flex h-9 w-9 lg:h-11 lg:w-11 shrink-0 items-center justify-center rounded-xl lg:rounded-2xl shadow-inner ${a && a.clientesSinTurno > 0 ? 'bg-violet-500/20' : 'bg-white/20 dark:bg-white/10'}`}>
              <UserX size={20} className={a && a.clientesSinTurno > 0 ? 'text-violet-400' : 'text-gray-400'} />
            </div>
            <div>
              {alertasHook.isLoading ? (
                <div className="space-y-1.5 mt-0.5"><Skeleton className="h-8 lg:h-9 w-12" /><Skeleton className="h-4 w-36" /></div>
              ) : (
                <>
                  <p className="text-2xl lg:text-3xl font-black tabular-nums text-gray-900 dark:text-white">{a?.clientesSinTurno ?? 0}</p>
                  <p className={`text-sm font-bold mt-0.5 ${a && a.clientesSinTurno > 0 ? 'text-violet-400' : 'text-gray-500 dark:text-gray-400'}`}>
                    {a && a.clientesSinTurno === 1 ? 'cliente activo sin turno' : 'clientes activos sin turno'}
                  </p>
                </>
              )}
              <p className="text-xs text-gray-400 dark:text-[#8A8A9A] mt-1">Membresía activa sin inscripción →</p>
            </div>
          </motion.button>

          {/* Baja asistencia */}
          <motion.button
            variants={fadeUpItem}
            whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
            onClick={() => navigate(ROUTES.CLIENTS)}
            className="rounded-2xl lg:rounded-[2rem] border p-4 lg:p-6 text-left transition-all backdrop-blur-3xl flex items-start gap-3 lg:gap-4 border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30"
            style={a && a.clientesBajaAsistencia > 0 ? {
              backgroundImage: 'radial-gradient(circle at 100% 100%, rgba(16,185,129,0.09) 0%, transparent 35%)',
            } : undefined}
          >
            <div className={`flex h-9 w-9 lg:h-11 lg:w-11 shrink-0 items-center justify-center rounded-xl lg:rounded-2xl shadow-inner ${a && a.clientesBajaAsistencia > 0 ? 'bg-emerald-500/20' : 'bg-white/20 dark:bg-white/10'}`}>
              <Activity size={20} className={a && a.clientesBajaAsistencia > 0 ? 'text-emerald-400' : 'text-gray-400'} />
            </div>
            <div>
              {alertasHook.isLoading ? (
                <div className="space-y-1.5 mt-0.5"><Skeleton className="h-8 lg:h-9 w-12" /><Skeleton className="h-4 w-36" /></div>
              ) : (
                <>
                  <p className="text-2xl lg:text-3xl font-black tabular-nums text-gray-900 dark:text-white">{a?.clientesBajaAsistencia ?? 0}</p>
                  <p className={`text-sm font-bold mt-0.5 ${a && a.clientesBajaAsistencia > 0 ? 'text-emerald-400' : 'text-gray-500 dark:text-gray-400'}`}>
                    {a && a.clientesBajaAsistencia === 1 ? 'cliente sin venir' : 'clientes sin venir'} hace 14 días
                  </p>
                </>
              )}
              <p className="text-xs text-gray-400 dark:text-[#8A8A9A] mt-1">Con membresía activa y turno →</p>
            </div>
          </motion.button>

        </motion.div>
      </Section>

      {/* ══ SECCIÓN 3: FINANCIERO — carga con financiero + histórico ══ */}
      <Section
        title="Financiero"
        subtitle="Evolución de ingresos y gastos"
        headerAction={makeChartHeaderAction('view-toggle-financiero')}
      >
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 lg:gap-6">

          {/* AreaChart histórico */}
          <ChartCard
            title="Ingresos vs Gastos"
            subtitle={chartSubtitle}
            className="xl:col-span-9 min-h-[240px] lg:min-h-[300px] xl:min-h-[340px]"
          >
            <div className="flex items-center gap-5 mb-4">
              {[['Ingresos', C.primary], ['Gastos', C.red], ['Ganancia', C.green]].map(([label, color]) => (
                <span key={label} className="flex items-center gap-1.5 text-xs font-bold text-gray-500 dark:text-gray-400">
                  <span className="h-2 w-4 rounded-full inline-block" style={{ background: color as string }} />
                  {label}
                </span>
              ))}
            </div>
            {historicoHook.isLoading ? (
              <div className="flex-1 min-h-[260px] flex items-center justify-center">
                <Skeleton className="h-full w-full rounded-2xl min-h-[220px]" />
              </div>
            ) : (
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
                    <Area type="monotone" dataKey="ingresos"     name="Ingresos" stroke={C.primary} strokeWidth={2.5} fill="url(#grad-ing)" activeDot={{ r: 6, fill: C.primary, strokeWidth: 0 }} />
                    <Area type="monotone" dataKey="gastos"       name="Gastos"   stroke={C.red}     strokeWidth={2}   fill="url(#grad-gas)" activeDot={{ r: 5, fill: C.red, strokeWidth: 0 }} />
                    <Area type="monotone" dataKey="gananciaNeta" name="Ganancia" stroke={C.green}   strokeWidth={2}   fill="url(#grad-gan)" activeDot={{ r: 5, fill: C.green, strokeWidth: 0 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </ChartCard>

          {/* BarChart por método */}
          <ChartCard title="Por método de cobro" subtitle={periodLabel} className="xl:col-span-3 min-h-[240px] lg:min-h-[300px] xl:min-h-[340px]">
            {financieroHook.isLoading ? (
              <div className="flex-1 min-h-[160px] lg:min-h-[220px] xl:min-h-[260px] flex items-center justify-center">
                <Skeleton className="h-full w-full rounded-2xl min-h-[200px]" />
              </div>
            ) : !f || f.ingresosPorMetodo.length === 0 ? (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-sm text-gray-400 dark:text-[#8A8A9A]">Sin pagos en este período</p>
              </div>
            ) : (
              <div className="flex-1 min-h-[160px] lg:min-h-[220px] xl:min-h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={f.ingresosPorMetodo} margin={{ top: 5, right: 8, left: 0, bottom: 20 }} barSize={28}>
                    <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.05} vertical={false} horizontal={false} />
                    <XAxis dataKey="metodo" axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 11, fontWeight: 700 }} interval={0} angle={-15} textAnchor="end" dy={6} />
                    <YAxis tick={{ fill: '#9CA3AF', fontSize: 11, fontWeight: 700 }} axisLine={false} tickLine={false} width={52} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip {...TooltipStyle} formatter={(v: number, _: string, props: any) => [formatCurrency(v), props?.payload?.metodo ?? 'Total']} />
                    <Bar dataKey="total" radius={[8, 8, 8, 8]}>
                      {f.ingresosPorMetodo.map((_, i) => (
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

      {/* ══ SECCIÓN 4: CLIENTES & PLANES — carga independientemente ══ */}
      <Section title="Clientes y planes" subtitle="Distribución actual del gimnasio">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-6">


          {/* Donut estado de pago: AL_DÍA / EN_DEUDA / VENCIDO */}
          <ChartCard title="Estado de pago" subtitle="Clientes activos">
            {clientesHook.isLoading ? (
              <div className="flex-1 flex flex-col justify-between py-2">
                <div className="flex justify-center items-center h-[140px] lg:h-[160px]">
                  <div className="relative h-[100px] w-[100px] lg:h-[120px] lg:w-[120px]">
                    <Skeleton className="absolute inset-0 rounded-full animate-pulse" />
                    <div className="absolute inset-[18px] rounded-full bg-white/30 dark:bg-black/30" />
                  </div>
                </div>
                <div className="space-y-2 mt-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="flex justify-between items-center">
                      <Skeleton className="h-3 w-16" /><Skeleton className="h-3 w-8" />
                    </div>
                  ))}
                </div>
              </div>
            ) : piePagoData.length === 0 ? (
              <p className="text-sm text-gray-400 flex-1 flex items-center">Sin datos</p>
            ) : (<>
              <div className="h-[155px] lg:h-[165px] xl:h-[175px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={piePagoData}
                      cx="50%" cy="50%"
                      innerRadius={48} outerRadius={70}
                      dataKey="value" paddingAngle={3}
                      onMouseEnter={(_, i) => setActivePiePagoIdx(i)}
                      onMouseLeave={() => setActivePiePagoIdx(null)}
                    >
                      {piePagoData.map((d, i) => (
                        <Cell key={i} fill={d.color} strokeWidth={0}
                          style={{ opacity: activePiePagoIdx === null || activePiePagoIdx === i ? 1 : 0.15, transition: 'opacity 0.35s ease-in-out' }}
                        />
                      ))}
                    </Pie>
                    <Tooltip {...TooltipStyle} formatter={(v: number, name: string) => [v, name]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <PieLegend items={piePagoData.map(d => ({ label: d.name, value: d.value, color: d.color }))} />
            </>)}
          </ChartCard>

          {/* BarChart por plan */}
          <ChartCard title="Membresías por plan" subtitle="Clientes activos">
            {clientesHook.isLoading ? (
              <div className="flex-1 min-h-[140px] lg:min-h-[190px] xl:min-h-[220px] flex flex-col justify-evenly gap-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-3 w-16 shrink-0" />
                    <Skeleton className="flex-1 h-5 rounded-lg" />
                    <Skeleton className="h-3 w-5 shrink-0" />
                  </div>
                ))}
              </div>
            ) : !c || c.clientesPorPlan.length === 0 ? (
              <p className="text-sm text-gray-400 flex-1 flex items-center">Sin membresías activas</p>
            ) : (
              <div className="flex-1 min-h-[140px] lg:min-h-[190px] xl:min-h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={c.clientesPorPlan}
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
                    <Tooltip {...TooltipStyle} formatter={(v: number, _: string, props: any) => [v, props?.payload?.nombre ?? 'Clientes']} />
                    <Bar dataKey="cantidad" radius={[0, 8, 8, 0]} fill={C.primary} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </ChartCard>

          {/* Donut gastos por categoría */}
          <ChartCard title="Gastos por categoría" subtitle={periodLabel}>
            {financieroHook.isLoading ? (
              <div className="flex-1 flex flex-col justify-between py-2">
                <div className="flex justify-center items-center h-[140px] lg:h-[170px] xl:h-[180px]">
                  <div className="relative h-[110px] w-[110px] lg:h-[130px] lg:w-[130px]">
                    <Skeleton className="absolute inset-0 rounded-full animate-pulse" />
                    <div className="absolute inset-[20px] rounded-full bg-white/30 dark:bg-black/30" />
                  </div>
                </div>
                <div className="space-y-2 mt-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="flex justify-between items-center">
                      <Skeleton className="h-3 w-16" />
                      <Skeleton className="h-3 w-8" />
                    </div>
                  ))}
                </div>
              </div>
            ) : pieGastosData.length === 0 ? (
              <p className="text-sm text-gray-400 flex-1 flex items-center">Sin gastos en este período</p>
            ) : (<>
              <div className="h-[175px] lg:h-[185px] xl:h-[195px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieGastosData}
                      cx="50%" cy="50%"
                      innerRadius={55} outerRadius={80}
                      dataKey="value" paddingAngle={3}
                      onMouseEnter={(_, i) => setActivePieGastoIdx(i)}
                      onMouseLeave={() => setActivePieGastoIdx(null)}
                    >
                      {pieGastosData.map((d, i) => (
                        <Cell
                          key={i}
                          fill={d.color}
                          strokeWidth={0}
                          style={{
                            opacity: activePieGastoIdx === null || activePieGastoIdx === i ? 1 : 0.15,
                            transition: 'opacity 0.35s ease-in-out',
                          }}
                        />
                      ))}
                    </Pie>
                    <Tooltip {...TooltipStyle} formatter={(v: number, name: string) => [formatCurrency(v), name]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <PieLegend items={pieGastosData.map(d => ({ label: d.name, value: formatCurrency(d.value), color: d.color }))} />
            </>)}
          </ChartCard>

          {/* Próximos vencimientos */}
          <ChartCard title="Próximos vencimientos" subtitle="Membresías por vencer">
            {alertasHook.isLoading ? (
              <div className="flex-1 flex flex-col justify-evenly gap-4 py-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex flex-col gap-2">
                    <div className="flex justify-between"><Skeleton className="h-3 w-14" /><Skeleton className="h-3 w-6" /></div>
                    <Skeleton className="h-4 w-full rounded-full" />
                  </div>
                ))}
              </div>
            ) : !a ? (
              <p className="text-sm text-gray-400 flex-1 flex items-center">Sin datos</p>
            ) : (
              <div className="flex-1 flex flex-col justify-evenly gap-4 py-1">
                {vencimientosData.map(d => (
                  <div key={d.label} className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-500 dark:text-gray-400">En {d.label}</span>
                      <span className="text-sm font-black tabular-nums" style={{ color: d.color }}>{d.value}</span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-white/20 dark:bg-white/[0.06] overflow-hidden">
                      <motion.div
                        className="h-full w-full rounded-full"
                        style={{ transformOrigin: 'left', backgroundColor: d.color }}
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: d.value / maxVencimiento }}
                        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                      />
                    </div>
                  </div>
                ))}
                <p className="text-[10px] font-semibold text-gray-400 dark:text-[#8A8A9A] text-center pt-1">
                  Los de 15 y 30 días incluyen los de 7
                </p>
              </div>
            )}
          </ChartCard>

        </div>
      </Section>

      {/* ══ SECCIÓN 5: FACTURACIÓN — carga independientemente ══ */}
      <Section
        title="Facturación"
        subtitle={
          chartView === 'meses'
            ? facturacionMesLabel
            : chartView === 'años'
            ? `Año ${facturacionYear}`
            : 'Todo el tiempo'
        }
        headerAction={makeFacturacionHeaderAction()}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">

          <ChartCard title="Facturado vs sin facturar">
            {facturacionChartHook.isLoading ? (
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
            ) : (
              <FacturacionBar
                facturado={facturacionChartHook.data?.facturacion.facturado ?? 0}
                sinFacturar={facturacionChartHook.data?.facturacion.sinFacturar ?? 0}
                total={facturacionChartHook.data?.facturacion.total ?? 0}
              />
            )}
          </ChartCard>

          {/* Resumen del período */}
          <ChartCard title="Resumen del período">
            {(financieroHook.isLoading || clientesHook.isLoading) ? (
              <div className="space-y-3 flex-1">
                {[1, 2, 3, 4].map(i => (
                  <Skeleton key={i} className="h-[52px] rounded-2xl" />
                ))}
              </div>
            ) : (
              <div className="space-y-3 flex-1">
                {[
                  {
                    label: 'Ingresos totales',
                    value: formatCurrency(facturAgg ? facturAgg.totalIngresos : f?.ingresos.total ?? 0),
                    color: 'text-green-500 dark:text-green-400', bg: 'bg-green-500/10',
                  },
                  {
                    label: 'Gastos totales',
                    value: formatCurrency(facturAgg ? facturAgg.totalGastos : f?.gastos.total ?? 0),
                    color: 'text-red-500 dark:text-red-400', bg: 'bg-red-500/10',
                  },
                  {
                    label: 'Ganancia neta',
                    value: formatCurrency(facturAgg ? facturAgg.gananciaNeta : gananciaNeta),
                    color: (facturAgg ? facturAgg.gananciaNeta : gananciaNeta) >= 0 ? 'text-green-500 dark:text-green-400' : 'text-red-500 dark:text-red-400',
                    bg:    (facturAgg ? facturAgg.gananciaNeta : gananciaNeta) >= 0 ? 'bg-green-500/10' : 'bg-red-500/10',
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
                    {clientesActivos} clientes activos al día de hoy
                  </span>
                </div>
              </div>
            )}
          </ChartCard>

        </div>
      </Section>

    </motion.div>
  )
}
