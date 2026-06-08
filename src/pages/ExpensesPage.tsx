import React, { useState, useMemo, useEffect } from 'react'
import { motion } from 'framer-motion'
import { pageVariants } from '../lib/motion'
import { Plus, Receipt, Wallet, Building, Wrench, RefreshCw, Trash2, Edit2, LayoutGrid, List, ArrowUp, ArrowDown, ArrowUpDown, ChevronLeft, ChevronRight, Search, X } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format } from 'date-fns'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip } from 'recharts'
import { useExpenses } from '../hooks/useExpenses'
import { expensesApi } from '../api/expenses.api'
import { useUiStore } from '../store/uiStore'
import Modal from '../components/ui/Modal'
import Skeleton from '../components/ui/Skeleton'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import KpiCard from '../components/ui/KpiCard'
import { formatCurrency } from '../utils/formatCurrency'
import { formatDate } from '../utils/formatDate'
import type { Expense, ExpenseCategory } from '../types/expense.types'

const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  SUELDO: 'Sueldos',
  FIJO: 'Fijo',
  VARIABLE: 'Variable',
}

const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  SUELDO: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  FIJO: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  VARIABLE: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
}

const CATEGORY_BAR_COLORS: Record<ExpenseCategory, string> = {
  SUELDO: 'bg-blue-400',
  FIJO: 'bg-purple-400',
  VARIABLE: 'bg-orange-400',
}

const CATEGORY_FORM_OPTIONS = [
  {
    value: 'SUELDO' as ExpenseCategory,
    icon: Building,
    label: 'Sueldos',
    desc: 'Personal y empleados',
    bg: 'bg-blue-50',
    iconColor: 'text-blue-500',
  },
  {
    value: 'FIJO' as ExpenseCategory,
    icon: Receipt,
    label: 'Fijo',
    desc: 'Gastos recurrentes',
    bg: 'bg-purple-50',
    iconColor: 'text-purple-500',
  },
  {
    value: 'VARIABLE' as ExpenseCategory,
    icon: Wrench,
    label: 'Variable',
    desc: 'Gastos imprevistos',
    bg: 'bg-orange-50',
    iconColor: 'text-orange-500',
  },
]

const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

function getMonthLabel(yyyyMM: string) {
  const [year, mon] = yyyyMM.split('-').map(Number)
  return `${MONTH_NAMES[mon - 1]} ${year}`
}

const schema = z.object({
  description: z.string().min(1, 'La descripción es requerida'),
  amount: z.string().min(1, 'El monto es requerido').refine(v => !isNaN(Number(v)) && Number(v) > 0, 'Monto inválido'),
  category: z.enum(['SUELDO', 'FIJO', 'VARIABLE']),
  date: z.string().min(1, 'La fecha es requerida'),
})

type FormValues = z.infer<typeof schema>
type CategoryFilter = 'all' | ExpenseCategory
type ViewMode = 'table' | 'grid'
type SortKey = 'date' | 'amount' | 'category'
type SortDir = 'asc' | 'desc'
type PeriodMode = 'month' | 'year' | 'all'
type ChartGroupBy = 'day' | 'week' | 'month'

function isoWeekKey(dateStr: string): string {
  const d = new Date(dateStr)
  const day = d.getDay() || 7
  d.setDate(d.getDate() + 4 - day)
  const yearStart = new Date(d.getFullYear(), 0, 1)
  const wk = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${d.getFullYear()}-W${String(wk).padStart(2, '0')}`
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ArrowUpDown size={12} className="opacity-30" />
  return dir === 'asc'
    ? <ArrowUp size={12} className="text-orange-500" />
    : <ArrowDown size={12} className="text-orange-500" />
}

export default function ExpensesPage() {
  const today = new Date()
  const [periodMode, setPeriodMode] = useState<PeriodMode>('all')
  const [chartGroupBy, setChartGroupBy] = useState<ChartGroupBy>('month')
  const [month, setMonth] = useState(format(today, 'yyyy-MM'))
  const [year, setYear] = useState(format(today, 'yyyy'))
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all')
  const [viewMode, setViewMode] = useState<ViewMode>(() =>
    typeof window !== 'undefined' && window.innerWidth < 768 ? 'grid' : 'table'
  )
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [editExpense, setEditExpense] = useState<Expense | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const { expenses: rawExpenses, isLoading, error, refetch } = useExpenses(
    periodMode === 'month' ? { month } : {}
  )
  const addToast = useUiStore(s => s.addToast)

  const { register, handleSubmit, formState: { errors }, reset, setValue, watch } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { category: 'VARIABLE', date: format(today, 'yyyy-MM-dd') },
  })
  const watchedCategory = watch('category')

  useEffect(() => {
    setChartGroupBy(periodMode === 'month' ? 'day' : 'month')
  }, [periodMode])

  const periodExpenses = useMemo(() => {
    if (periodMode === 'year') return rawExpenses.filter(e => e.date.startsWith(year))
    return rawExpenses
  }, [rawExpenses, periodMode, year])

  const [amountDisplay, setAmountDisplay] = useState('')

  function formatThousands(raw: string): string {
    const digits = raw.replace(/\D/g, '')
    if (!digits) return ''
    return Number(digits).toLocaleString('es-AR')
  }

  function handleAmountChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\./g, '').replace(/\D/g, '')
    setAmountDisplay(digits ? Number(digits).toLocaleString('es-AR') : '')
    setValue('amount', digits, { shouldValidate: true })
  }

  function handleClose() {
    setCreateOpen(false)
    setEditExpense(null)
    reset()
    setAmountDisplay('')
  }

  function navigateMonth(dir: -1 | 1) {
    const [y, mon] = month.split('-').map(Number)
    const d = new Date(y, mon - 1 + dir, 1)
    setMonth(format(d, 'yyyy-MM'))
  }

  function navigateYear(dir: -1 | 1) {
    setYear(y => String(parseInt(y) + dir))
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const filteredAndSorted = useMemo(() => {
    const q = search.toLowerCase()
    const result = periodExpenses.filter(e => {
      const matchesCategory = categoryFilter === 'all' || e.category === categoryFilter
      const matchesSearch = !q || e.description.toLowerCase().includes(q)
      return matchesCategory && matchesSearch
    })
    return [...result].sort((a, b) => {
      let cmp = 0
      if (sortKey === 'amount') cmp = a.amount - b.amount
      else if (sortKey === 'date') cmp = a.date.localeCompare(b.date)
      else if (sortKey === 'category') cmp = a.category.localeCompare(b.category)
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [periodExpenses, categoryFilter, search, sortKey, sortDir])

  const totals = useMemo(() => {
    const total = periodExpenses.reduce((s, e) => s + e.amount, 0)
    const bySalaries = periodExpenses.filter(e => e.category === 'SUELDO').reduce((s, e) => s + e.amount, 0)
    const byFixed = periodExpenses.filter(e => e.category === 'FIJO').reduce((s, e) => s + e.amount, 0)
    const byVariable = periodExpenses.filter(e => e.category === 'VARIABLE').reduce((s, e) => s + e.amount, 0)
    return { total, bySalaries, byFixed, byVariable }
  }, [periodExpenses])

  const chartData = useMemo(() => {
    if (chartGroupBy === 'day') {
      const byDay = periodExpenses.reduce((acc, exp) => {
        acc[exp.date] = (acc[exp.date] || 0) + exp.amount
        return acc
      }, {} as Record<string, number>)
      return Object.keys(byDay).sort().map(d => ({ date: formatDate(d), amount: byDay[d] }))
    }
    if (chartGroupBy === 'week') {
      const byWeek = periodExpenses.reduce((acc, exp) => {
        const key = isoWeekKey(exp.date)
        acc[key] = (acc[key] || 0) + exp.amount
        return acc
      }, {} as Record<string, number>)
      return Object.keys(byWeek).sort().map(key => {
        const [, wk] = key.split('-W')
        return { date: `Sem ${wk}`, amount: byWeek[key] }
      })
    }
    // month grouping
    const byMonth = periodExpenses.reduce((acc, exp) => {
      const key = exp.date.substring(0, 7)
      acc[key] = (acc[key] || 0) + exp.amount
      return acc
    }, {} as Record<string, number>)
    return Object.keys(byMonth).sort().map(key => {
      const [y, m] = key.split('-').map(Number)
      const label = periodMode === 'all'
        ? `${MONTH_NAMES[m - 1].substring(0, 3)} ${y}`
        : MONTH_NAMES[m - 1].substring(0, 3)
      return { date: label, amount: byMonth[key] }
    })
  }, [periodExpenses, periodMode, chartGroupBy])

  const categoryBreakdown = useMemo(() => {
    const total = totals.total || 1
    return [
      { label: 'Sueldos', value: totals.bySalaries, pct: Math.round((totals.bySalaries / total) * 100), category: 'SUELDO' as ExpenseCategory },
      { label: 'Fijo', value: totals.byFixed, pct: Math.round((totals.byFixed / total) * 100), category: 'FIJO' as ExpenseCategory },
      { label: 'Variable', value: totals.byVariable, pct: Math.round((totals.byVariable / total) * 100), category: 'VARIABLE' as ExpenseCategory },
    ]
  }, [totals])

  function openEdit(expense: Expense) {
    setEditExpense(expense)
    setValue('description', expense.description)
    setValue('amount', String(expense.amount))
    setAmountDisplay(formatThousands(String(Math.round(expense.amount))))
    setValue('category', expense.category)
    setValue('date', expense.date)
  }

  async function onSubmit(data: FormValues) {
    setIsSubmitting(true)
    try {
      if (editExpense) {
        await expensesApi.update(editExpense.id, {
          description: data.description,
          amount: Number(data.amount),
          category: data.category,
          date: data.date,
        })
        addToast('Gasto actualizado', 'success')
        setEditExpense(null)
      } else {
        await expensesApi.create({
          description: data.description,
          amount: Number(data.amount),
          category: data.category,
          date: data.date,
        })
        addToast('Gasto registrado', 'success')
        setCreateOpen(false)
      }
      reset()
      refetch()
    } catch {
      addToast('Error al guardar el gasto', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function deleteExpense(id: number) {
    setIsDeleting(true)
    try {
      await expensesApi.remove(id)
      addToast('Gasto eliminado', 'success')
      refetch()
    } catch {
      addToast('Error al eliminar', 'error')
    } finally {
      setIsDeleting(false)
      setDeleteTarget(null)
    }
  }

  const summaryCards = [
    { label: 'Total gastos', value: totals.total, icon: Wallet, color: 'text-red-400', bgColor: 'bg-red-500/10' },
    { label: 'Sueldos', value: totals.bySalaries, icon: Building, color: 'text-blue-400', bgColor: 'bg-blue-500/10' },
    { label: 'Fijo', value: totals.byFixed, icon: Receipt, color: 'text-purple-400', bgColor: 'bg-purple-500/10' },
    { label: 'Variable', value: totals.byVariable, icon: Wrench, color: 'text-orange-400', bgColor: 'bg-orange-500/10' },
  ]

  return (
    <motion.div {...pageVariants} className="space-y-4 lg:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl xl:text-4xl font-black tracking-tighter text-gray-900 dark:text-white drop-shadow-sm">
            Gastos
          </h1>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center overflow-hidden rounded-xl border border-saas-border dark:border-white/[0.08] bg-white/60 dark:bg-white/[0.04] backdrop-blur-sm shadow-sm">
            {(['month', 'year', 'all'] as PeriodMode[]).map((m, i) => (
              <button
                key={m}
                onClick={() => setPeriodMode(m)}
                className={`h-9 px-3.5 text-sm font-medium transition-colors ${i > 0 ? 'border-l border-saas-border dark:border-white/[0.08]' : ''} ${
                  periodMode === m
                    ? 'bg-gray-900 dark:bg-white/[0.12] text-white'
                    : 'text-gray-500 dark:text-[#8A8A9A] hover:bg-saas-bg dark:hover:bg-white/[0.06] hover:text-gray-700 dark:hover:text-white'
                }`}
              >
                {m === 'month' ? 'Mes' : m === 'year' ? 'Año' : 'Histórico'}
              </button>
            ))}
          </div>

          <div className="flex items-center overflow-hidden rounded-xl border border-saas-border dark:border-white/[0.08] bg-white/60 dark:bg-white/[0.04] backdrop-blur-sm shadow-sm">
            <button
              onClick={() => periodMode === 'month' ? navigateMonth(-1) : navigateYear(-1)}
              className={`flex h-9 w-9 items-center justify-center border-r border-saas-border dark:border-white/[0.08] text-gray-400 dark:text-[#8A8A9A] transition-all hover:bg-saas-bg dark:hover:bg-white/[0.06] hover:text-gray-700 dark:hover:text-white active:scale-[0.92] ${
                periodMode === 'all' ? 'pointer-events-none opacity-0' : ''
              }`}
            >
              <ChevronLeft size={15} />
            </button>
            <span className="w-[148px] text-center text-sm font-semibold text-gray-800 dark:text-white">
              {periodMode === 'month'
                ? getMonthLabel(month)
                : periodMode === 'year'
                ? year
                : 'Todo el tiempo'}
            </span>
            <button
              onClick={() => periodMode === 'month' ? navigateMonth(1) : navigateYear(1)}
              disabled={
                (periodMode === 'month' && month >= format(today, 'yyyy-MM')) ||
                (periodMode === 'year' && year >= format(today, 'yyyy'))
              }
              className={`flex h-9 w-9 items-center justify-center border-l border-saas-border dark:border-white/[0.08] text-gray-400 dark:text-[#8A8A9A] transition-all hover:bg-saas-bg dark:hover:bg-white/[0.06] hover:text-gray-700 dark:hover:text-white active:scale-[0.92] disabled:cursor-not-allowed disabled:opacity-30 ${
                periodMode === 'all' ? 'pointer-events-none opacity-0' : ''
              }`}
            >
              <ChevronRight size={15} />
            </button>
          </div>

          <button
            onClick={refetch}
            title="Actualizar"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-saas-border dark:border-white/[0.08] bg-white/60 dark:bg-white/[0.04] backdrop-blur-sm text-gray-400 dark:text-[#8A8A9A] transition-all hover:bg-saas-bg dark:hover:bg-white/[0.08] hover:text-gray-700 dark:hover:text-white active:scale-[0.9]"
          >
            <RefreshCw size={14} />
          </button>

          <button
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-2 rounded-xl btn-action px-4 py-2.5 text-sm"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-gray-900/10">
              <Plus size={13} strokeWidth={2.5} />
            </span>
            Registrar gasto
          </button>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-4 lg:gap-6 items-start">

        {/* ─── LEFT: resumen + controles + tabla/grid ─── */}
        <div className="flex flex-col gap-5 min-w-0">

          {/* Summary cards — last on mobile, first on xl */}
          <div className="order-last xl:order-none grid grid-cols-2 gap-3">
            {summaryCards.map(card => (
              <KpiCard
                key={card.label}
                label={card.label}
                value={formatCurrency(card.value)}
                icon={card.icon}
                iconColor={card.color}
                iconBg={card.bgColor}
                isLoading={isLoading}
                compact
              />
            ))}
          </div>

          {/* Búsqueda por descripción */}
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-[#8A8A9A]" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por descripción..."
              className="w-full rounded-xl border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-xl pl-10 pr-10 py-2 text-xs font-semibold text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none h-10"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition-colors hover:text-gray-700 dark:hover:text-white"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Controls: filtros + orden + vista */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Category filter — select en mobile, pills en desktop */}
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value as CategoryFilter)}
              className="sm:hidden rounded-xl border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-xl px-3 py-2 text-xs font-bold text-gray-800 dark:text-gray-200 focus:outline-none h-10 cursor-pointer"
            >
              <option value="all">Todos</option>
              {(Object.keys(CATEGORY_LABELS) as ExpenseCategory[]).map(c => (
                <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
              ))}
            </select>
            <div className="hidden sm:flex items-center rounded-full border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-xl p-1 shadow-sm gap-1">
              {(['all', ...(Object.keys(CATEGORY_LABELS) as ExpenseCategory[])] as CategoryFilter[]).map(c => {
                const isActive = categoryFilter === c
                return (
                  <button
                    key={c}
                    onClick={() => setCategoryFilter(c)}
                    className={`relative inline-flex items-center justify-center rounded-full px-4 py-1.5 text-xs font-bold transition-all duration-300 cursor-pointer ${
                      isActive
                        ? 'text-white dark:text-gray-900'
                        : 'text-gray-500 dark:text-[#8A8A9A] hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    {isActive && (
                      <div className="absolute inset-0 rounded-full bg-gray-900 dark:bg-white shadow-[0_2px_8px_rgba(0,0,0,0.15)]" style={{ zIndex: 0 }} />
                    )}
                    <span className="relative z-10">
                      {c === 'all' ? 'Todos' : CATEGORY_LABELS[c]}
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="flex items-center gap-4 flex-wrap">
              {/* Sort buttons */}
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-[#8A8A9A] ml-1 mr-1">Ordenar:</span>
                <div className="flex items-center rounded-full border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-xl p-1 shadow-sm gap-1">
                  {(['date', 'amount', 'category'] as SortKey[]).map(k => {
                    const isActive = sortKey === k
                    return (
                      <button
                        key={k}
                        onClick={() => toggleSort(k)}
                        className={`relative inline-flex items-center justify-center rounded-full px-3 py-1.5 text-xs font-bold transition-all duration-300 cursor-pointer ${
                          isActive
                            ? 'text-white dark:text-gray-900'
                            : 'text-gray-500 dark:text-[#8A8A9A] hover:text-gray-900 dark:hover:text-white'
                        }`}
                      >
                        {isActive && (
                          <div className="absolute inset-0 rounded-full bg-gray-900 dark:bg-white shadow-[0_2px_8px_rgba(0,0,0,0.15)]" style={{ zIndex: 0 }} />
                        )}
                        <span className="relative z-10 flex items-center gap-1">
                          {k === 'date' ? 'Fecha' : k === 'amount' ? 'Monto' : 'Tipo'}
                          <SortIcon active={sortKey === k} dir={sortDir} />
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* View toggle */}
              <div className="flex items-center rounded-full border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-xl p-1 shadow-sm gap-1 shrink-0">
                {(['table', 'grid'] as const).map((mode) => {
                  const isActive = viewMode === mode
                  return (
                    <button
                      key={mode}
                      onClick={() => setViewMode(mode)}
                      title={mode === 'table' ? 'Vista tabla' : 'Vista tarjetas'}
                      className={`relative inline-flex items-center justify-center rounded-full px-4 py-1.5 text-xs font-bold transition-all duration-300 cursor-pointer ${
                        isActive
                          ? 'text-white dark:text-gray-900'
                          : 'text-gray-500 dark:text-[#8A8A9A] hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      {isActive && (
                        <div className="absolute inset-0 rounded-full bg-gray-900 dark:bg-white shadow-[0_2px_8px_rgba(0,0,0,0.15)]" style={{ zIndex: 0 }} />
                      )}
                      <span className="relative z-10 flex items-center justify-center">
                        {mode === 'table' ? <List size={14} /> : <LayoutGrid size={14} />}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3">
              <span className="text-sm text-red-400">{error}</span>
              <button onClick={refetch} className="ml-auto text-xs text-red-400 underline">
                Reintentar
              </button>
            </div>
          )}

          {/* ── Table view ── */}
          {viewMode === 'table' && (
            <div className="overflow-x-auto rounded-2xl xl:rounded-3xl border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-3xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
              {isLoading ? (
                <div className="p-4 space-y-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : (
                <table className="w-full table-fixed text-sm">
                  <colgroup>
                    <col />
                    <col className="w-28" />
                    <col className="w-32" />
                    <col className="w-28" />
                    <col className="w-20" />
                  </colgroup>
                  <thead className="border-b border-saas-border dark:border-white/10 bg-[#F9F8F6] dark:bg-white/[0.04]">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-saas-muted dark:text-gray-400">
                        Descripción
                      </th>
                      <th
                        className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-saas-muted dark:text-gray-400 cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200"
                        onClick={() => toggleSort('category')}
                      >
                        <div className="flex items-center gap-1">
                          Tipo <SortIcon active={sortKey === 'category'} dir={sortDir} />
                        </div>
                      </th>
                      <th
                        className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-saas-muted dark:text-gray-400 cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200"
                        onClick={() => toggleSort('amount')}
                      >
                        <div className="flex items-center gap-1">
                          Monto <SortIcon active={sortKey === 'amount'} dir={sortDir} />
                        </div>
                      </th>
                      <th
                        className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-saas-muted dark:text-gray-400 cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200"
                        onClick={() => toggleSort('date')}
                      >
                        <div className="flex items-center gap-1">
                          Fecha <SortIcon active={sortKey === 'date'} dir={sortDir} />
                        </div>
                      </th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-saas-divider dark:divide-white/[0.06]">
                    {filteredAndSorted.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-12 text-center text-saas-muted dark:text-[#8A8A9A]">
                          Sin gastos en este período
                        </td>
                      </tr>
                    ) : filteredAndSorted.map(e => (
                      <tr key={e.id} className="group transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.04]">
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100 truncate">
                          <div className="flex items-center gap-2">
                            <span className="w-0.5 h-4 rounded-full bg-primary opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                            <span className="truncate">{e.description}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${CATEGORY_COLORS[e.category] ?? 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                            {CATEGORY_LABELS[e.category] ?? e.category}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold text-red-500 dark:text-red-400 tabular-nums">{formatCurrency(e.amount)}</td>
                        <td className="px-4 py-3 text-saas-muted dark:text-gray-400 tabular-nums">{formatDate(e.date)}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                            <button
                              onClick={() => openEdit(e)}
                              className="rounded-md p-1.5 text-gray-400 dark:text-[#8A8A9A] transition-all hover:bg-gray-100 dark:hover:bg-white/[0.08] hover:text-gray-900 dark:hover:text-white"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={() => setDeleteTarget(e.id)}
                              className="rounded-md p-1.5 text-gray-400 dark:text-[#8A8A9A] transition-all hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* ── Grid / card view ── */}
          {viewMode === 'grid' && (
            isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-36 w-full rounded-2xl" />
                ))}
              </div>
            ) : filteredAndSorted.length === 0 ? (
              <div className="rounded-2xl xl:rounded-3xl border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-3xl py-16 text-center text-saas-muted">
                Sin gastos en este período
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filteredAndSorted.map((e, idx) => (
                  <motion.div
                    key={e.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    className="group relative overflow-hidden rounded-2xl border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-3xl p-5 shadow-[0_4px_16px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.3)] transition-all hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-eficiencia-yellow/20 blur-2xl" />
                    <div className="relative z-10">
                      <div className="flex items-start justify-between mb-3">
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${CATEGORY_COLORS[e.category] ?? 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                          {CATEGORY_LABELS[e.category] ?? e.category}
                        </span>
                        <span className="text-xs text-saas-muted">{formatDate(e.date)}</span>
                      </div>
                      <p className="font-semibold text-gray-900 dark:text-white mb-2 line-clamp-2">
                        {e.description}
                      </p>
                      <p className="text-xl font-bold text-red-500 tabular-nums">
                        {formatCurrency(e.amount)}
                      </p>
                      <div className="mt-4 flex items-center justify-end gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          onClick={() => openEdit(e)}
                          className="rounded-lg p-1.5 text-gray-400 transition-all hover:bg-gray-100 hover:text-gray-900"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(e.id)}
                          className="rounded-lg p-1.5 text-gray-400 transition-all hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )
          )}
        </div>

        {/* ─── RIGHT: gráfico + desglose por categoría ─── */}
        <div className="xl:sticky xl:top-6 space-y-5">

          {/* Area chart — evolución */}
          <div className="rounded-2xl xl:rounded-3xl border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-3xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)] p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                {periodMode === 'month' ? 'Evolución del mes' : periodMode === 'year' ? 'Evolución del año' : 'Evolución histórica'}
              </h3>
              <div className="flex gap-1 rounded-xl bg-gray-100 dark:bg-white/[0.06] p-1">
                {(periodMode === 'month'
                  ? [['day', 'Día'], ['week', 'Semana']] as const
                  : [['week', 'Semana'], ['month', 'Mes']] as const
                ).map(([g, label]) => (
                  <button
                    key={g}
                    onClick={() => setChartGroupBy(g as ChartGroupBy)}
                    className={`text-xs font-semibold px-3 py-1 rounded-lg transition-all ${
                      chartGroupBy === g
                        ? 'bg-white dark:bg-white/[0.12] text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-500 dark:text-[#8A8A9A] hover:text-gray-700 dark:hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="h-56 w-full">
              {isLoading ? (
                <Skeleton className="h-full w-full rounded-2xl" />
              ) : chartData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-saas-muted text-sm">
                  Sin datos para este período
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 8, right: 12, left: 8, bottom: 20 }}>
                    <defs>
                      <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#F97316" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#F97316" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.06)" />
                    <XAxis
                      dataKey="date"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: '#8A8A9A' }}
                      dy={6}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: '#8A8A9A' }}
                      width={52}
                      tickFormatter={v => v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`}
                    />
                    <RechartsTooltip
                      contentStyle={{
                        backgroundColor: 'rgba(0,0,0,0.85)',
                        borderColor: 'rgba(255,255,255,0.1)',
                        borderRadius: '12px',
                        color: '#fff',
                        backdropFilter: 'blur(10px)',
                      }}
                      itemStyle={{ color: '#F97316', fontWeight: 'bold' }}
                      formatter={(value: number) => [formatCurrency(value), 'Monto']}
                    />
                    <Area
                      type="monotone"
                      dataKey="amount"
                      stroke="#F97316"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#colorAmount)"
                      dot={{ r: 3, fill: '#F97316', strokeWidth: 0 }}
                      activeDot={{ r: 5, fill: '#F97316', strokeWidth: 0 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Category breakdown con barras de progreso */}
          <div className="rounded-2xl xl:rounded-3xl border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-3xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)] p-6">
            <h3 className="text-base font-bold text-gray-900 dark:text-white mb-5">Por categoría</h3>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : (
              <div className="space-y-4">
                {categoryBreakdown.map(cat => (
                  <div key={cat.label}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{cat.label}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-saas-muted">{cat.pct}%</span>
                        <span className="text-sm font-semibold text-gray-900 dark:text-white tabular-nums">
                          {formatCurrency(cat.value)}
                        </span>
                      </div>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-gray-100 dark:bg-white/10">
                      <motion.div
                        className={`h-full rounded-full ${CATEGORY_BAR_COLORS[cat.category]}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${cat.pct}%` }}
                        transition={{ duration: 0.6, ease: 'easeOut' }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create / Edit modal */}
      <Modal isOpen={createOpen || !!editExpense} onClose={handleClose} size="lg">
        <form onSubmit={handleSubmit(onSubmit)}>

          {/* Header del modal */}
          <div className="mb-8 flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
              <Wallet size={22} className="text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">
                {editExpense ? 'Editar gasto' : 'Registrar gasto'}
              </h2>
              <p className="text-sm text-saas-muted">
                {editExpense ? 'Modificá los datos del gasto' : 'Completá los datos del nuevo gasto'}
              </p>
            </div>
          </div>

          {/* Selector de categoría */}
          <div className="mb-6">
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-saas-muted">
              Categoría
            </p>
            <input type="hidden" {...register('category')} />
            <div className="grid grid-cols-3 gap-3">
              {CATEGORY_FORM_OPTIONS.map(opt => {
                const isSelected = watchedCategory === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setValue('category', opt.value, { shouldValidate: true })}
                    className={`relative flex flex-col items-center gap-3 rounded-2xl border-2 p-5 transition-all duration-200 active:scale-[0.97] ${
                      isSelected
                        ? 'border-primary/50 bg-primary/5 ring-2 ring-primary/20'
                        : 'border-saas-border bg-white hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${opt.bg} transition-colors`}>
                      <opt.icon size={22} className={opt.iconColor} />
                    </div>
                    <div className="text-center">
                      <p className={`text-sm font-bold ${isSelected ? 'text-gray-900' : 'text-gray-700'}`}>
                        {opt.label}
                      </p>
                      <p className="mt-0.5 text-xs leading-tight text-saas-muted">{opt.desc}</p>
                    </div>
                    {isSelected && (
                      <div className="absolute bottom-3 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-primary" />
                    )}
                  </button>
                )
              })}
            </div>
            {errors.category && (
              <p className="mt-2 text-xs text-red-500">{errors.category.message}</p>
            )}
          </div>

          {/* Monto */}
          <div className="mb-6">
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-saas-muted">Monto</p>
            <div className="relative overflow-hidden rounded-2xl border-2 border-saas-border bg-white transition-all focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20">
              <span className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 select-none text-3xl font-black text-gray-200">
                $
              </span>
              <input
                type="text"
                inputMode="numeric"
                placeholder="0"
                value={amountDisplay}
                onChange={handleAmountChange}
                className="w-full bg-transparent py-5 pl-14 pr-5 text-3xl font-black tracking-tight text-gray-900 placeholder:text-gray-200 focus:outline-none dark:text-white"
              />
              <input type="hidden" {...register('amount')} />
            </div>
            {errors.amount && (
              <p className="mt-2 text-xs text-red-500">{errors.amount.message}</p>
            )}
          </div>

          {/* Descripción + Fecha */}
          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-widest text-saas-muted">Descripción</p>
              <textarea
                rows={4}
                placeholder="Ej: Alquiler del local, pago de servicios..."
                className="w-full resize-none rounded-xl border-2 border-saas-border bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 transition-all focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 dark:text-white"
                {...register('description')}
              />
              {errors.description && (
                <p className="mt-1.5 text-xs text-red-500">{errors.description.message}</p>
              )}
            </div>
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-widest text-saas-muted">Fecha</p>
              <input
                type="date"
                className="w-full rounded-xl border-2 border-saas-border bg-white px-4 py-3 text-sm text-gray-900 transition-all focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 dark:text-white"
                {...register('date')}
              />
              {errors.date && (
                <p className="mt-1.5 text-xs text-red-500">{errors.date.message}</p>
              )}
            </div>
          </div>

          {/* Acciones */}
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-xl border border-saas-border bg-white px-5 py-2.5 text-sm font-semibold text-gray-600 transition-all hover:bg-saas-bg hover:text-gray-900 active:scale-[0.97]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 rounded-xl btn-action px-6 py-2.5 text-sm"
            >
              {isSubmitting
                ? <RefreshCw size={14} className="animate-spin" />
                : !editExpense && <Plus size={14} strokeWidth={2.5} />
              }
              {isSubmitting ? 'Guardando...' : editExpense ? 'Guardar cambios' : 'Registrar gasto'}
            </button>
          </div>

        </form>
      </Modal>

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="Eliminar gasto"
        message="Esta acción no se puede deshacer. El registro quedará eliminado permanentemente."
        confirmLabel="Eliminar"
        isLoading={isDeleting}
        onConfirm={() => deleteTarget !== null && deleteExpense(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
      />
    </motion.div>
  )
}
