import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { pageVariants, cardVariants, stagger } from '../lib/motion'
import { Plus, CreditCard, Banknote, ArrowLeftRight, Building2, RefreshCw, CheckCircle2, XCircle, Trash2, Search, Filter, ChevronDown } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format } from 'date-fns'
import { usePayments } from '../hooks/usePayments'
import { paymentsApi } from '../api/payments.api'
import { clientsApi } from '../api/clients.api'
import { useUiStore } from '../store/uiStore'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import Input from '../components/ui/Input'
import KpiCard from '../components/ui/KpiCard'
import Select from '../components/ui/Select'
import Skeleton from '../components/ui/Skeleton'
import { formatCurrency } from '../utils/formatCurrency'
import { formatDate } from '../utils/formatDate'
import type { Payment, PaymentMethod } from '../types/payment.types'

const METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Efectivo',
  transfer: 'Transferencia',
  card: 'Débito',
}

const METHOD_ICONS = {
  cash: Banknote,
  transfer: ArrowLeftRight,
  card: CreditCard,
}

const schema = z.object({
  clientId: z.string().min(1, 'Seleccioná un cliente'),
  amount: z.string().min(1, 'El monto es requerido').refine(v => !isNaN(Number(v)) && Number(v) > 0, 'Monto inválido'),
  method: z.enum(['cash', 'transfer', 'card']),
  paidAt: z.string().min(1, 'La fecha es requerida'),
  invoiced: z.boolean().optional(),
  notes: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

type MethodFilter = 'all' | PaymentMethod

export default function PaymentsPage() {
  const today = new Date()
  const currentYear = today.getFullYear()
  const YEARS = [currentYear, currentYear - 1, currentYear - 2].map(String)

  const [isFiltersOpen, setIsFiltersOpen] = useState(false)
  const [dateMode, setDateMode] = useState<'year' | 'range'>('year')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [yearFilter, setYearFilter] = useState<string>('all')
  const [amountMin, setAmountMin] = useState('')
  const [amountMax, setAmountMax] = useState('')
  const [methodFilter, setMethodFilter] = useState<MethodFilter>('all')
  const [invoicedFilter, setInvoicedFilter] = useState<'all' | 'yes' | 'no'>('all')
  const [searchFilter, setSearchFilter] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [clientSearch, setClientSearch] = useState('')
  const [clientOptions, setClientOptions] = useState<{ value: string; label: string }[]>([])
  const [loadingClients, setLoadingClients] = useState(false)

  const { payments, isLoading, error, refetch } = usePayments({
    desde: dateFrom || undefined,
    hasta: dateTo || undefined,
    anio: (!dateFrom && !dateTo && yearFilter !== 'all') ? yearFilter : undefined,
  })
  const addToast = useUiStore(s => s.addToast)

  const { register, handleSubmit, formState: { errors }, reset, watch } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      method: 'transfer',
      paidAt: format(today, 'yyyy-MM-dd'),
      invoiced: false,
    },
  })

  const filtered = useMemo(() => {
    return payments.filter(p => {
      const matchMethod = methodFilter === 'all' || p.method === methodFilter
      const matchInvoiced =
        invoicedFilter === 'all' ||
        (invoicedFilter === 'yes' && p.invoiced) ||
        (invoicedFilter === 'no' && !p.invoiced)
      const matchSearch = !searchFilter || p.clientName.toLowerCase().includes(searchFilter.toLowerCase())
      const matchAmountMin = !amountMin || p.amount >= Number(amountMin)
      const matchAmountMax = !amountMax || p.amount <= Number(amountMax)
      return matchMethod && matchInvoiced && matchSearch && matchAmountMin && matchAmountMax
    })
  }, [payments, methodFilter, invoicedFilter, searchFilter, amountMin, amountMax])

  const totals = useMemo(() => {
    const total = payments.reduce((s, p) => s + p.amount, 0)
    const byCash = payments.filter(p => p.method === 'cash').reduce((s, p) => s + p.amount, 0)
    const byTransfer = payments.filter(p => p.method === 'transfer').reduce((s, p) => s + p.amount, 0)
    const byCard = payments.filter(p => p.method === 'card').reduce((s, p) => s + p.amount, 0)
    return { total, byCash, byTransfer, byCard }
  }, [payments])

  async function loadClients(search: string) {
    setLoadingClients(true)
    try {
      const all = await clientsApi.getAll()
      const opts = all
        .filter(c => `${c.name} ${c.lastName}`.toLowerCase().includes(search.toLowerCase()))
        .slice(0, 20)
        .map(c => ({ value: String(c.id), label: `${c.name} ${c.lastName}` }))
      setClientOptions(opts)
    } catch {
      setClientOptions([])
    } finally {
      setLoadingClients(false)
    }
  }

  async function onSubmit(data: FormValues) {
    setIsSubmitting(true)
    try {
      await paymentsApi.create({
        clientId: Number(data.clientId),
        amount: Number(data.amount),
        method: data.method,
        paidAt: data.paidAt,
        invoiced: data.invoiced,
        notes: data.notes || undefined,
      })
      addToast('Pago registrado', 'success')
      setModalOpen(false)
      reset()
      refetch()
    } catch {
      addToast('Error al registrar el pago', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function toggleInvoiced(p: Payment) {
    try {
      await paymentsApi.toggleInvoiced(p.id)
      addToast(`Pago marcado como ${p.invoiced ? 'no facturado' : 'facturado'}`, 'success')
      refetch()
    } catch {
      addToast('Error al actualizar', 'error')
    }
  }

  async function deletePayment(id: number) {
    if (!confirm('¿Eliminar este pago?')) return
    try {
      await paymentsApi.remove(id)
      addToast('Pago eliminado', 'success')
      refetch()
    } catch {
      addToast('Error al eliminar', 'error')
    }
  }

  const summaryCards = [
    { label: 'Total cobrado', value: totals.total, icon: CreditCard, color: 'text-primary', bgColor: 'bg-primary/10' },
    { label: 'Efectivo', value: totals.byCash, icon: Banknote, color: 'text-green-400', bgColor: 'bg-green-500/10' },
    { label: 'Transferencia', value: totals.byTransfer, icon: ArrowLeftRight, color: 'text-blue-400', bgColor: 'bg-blue-500/10' },
    { label: 'Débito', value: totals.byCard, icon: Building2, color: 'text-purple-400', bgColor: 'bg-purple-500/10' },
  ]

  return (
    <motion.div
      {...pageVariants}
      className="space-y-8 pb-12 relative z-10"
    >
      {/* Hyper-Modern Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tighter text-gray-900 dark:text-white drop-shadow-sm">Pagos</h1>
          <p className="mt-2 text-sm font-semibold text-gray-500 dark:text-gray-400">
            Gestioná los ingresos y facturación de tus clientes
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={refetch}
            className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-xl text-gray-600 dark:text-gray-300 transition-all hover:scale-105 hover:bg-white/50 dark:hover:bg-black/50 shadow-sm"
          >
            <RefreshCw size={18} />
          </button>
          <button
            onClick={() => { setModalOpen(true); loadClients('') }}
            className="flex items-center gap-2 rounded-xl btn-action px-4 py-2.5 text-sm"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-gray-900/10">
              <Plus size={13} strokeWidth={2.5} />
            </span>
            Nuevo pago
          </button>
        </div>
      </div>

      {/* Top Row: KPI Micro-Bento */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {summaryCards.map(card => (
          <KpiCard
            key={card.label}
            label={card.label}
            value={formatCurrency(card.value)}
            icon={card.icon}
            iconColor={card.color}
            iconBg={card.bgColor}
            isLoading={isLoading}
          />
        ))}
      </div>

      {/* Complex Filter Bar Container */}
      <div className="rounded-[2rem] border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-3xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
        <button
          onClick={() => setIsFiltersOpen(v => !v)}
          className="w-full flex items-center justify-between gap-2 px-6 py-4 text-gray-800 dark:text-white font-bold"
        >
          <div className="flex items-center gap-2">
            <Filter size={18} className="text-primary" />
            <span>Filtros Avanzados</span>
          </div>
          <motion.span animate={{ rotate: isFiltersOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown size={18} className="text-gray-400" />
          </motion.span>
        </button>

        <AnimatePresence initial={false}>
          {isFiltersOpen && (
            <motion.div
              key="filters"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <div className="px-6 pb-6 flex flex-col gap-4">
                <div className="flex flex-col md:flex-row gap-4 flex-wrap">
                  {/* Buscar */}
                  <div className="flex-1 min-w-[180px] relative">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">Buscar Cliente</label>
                    <div className="relative">
                      <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                      <input
                        type="text"
                        placeholder="Nombre o apellido..."
                        value={searchFilter}
                        onChange={e => setSearchFilter(e.target.value)}
                        className="w-full rounded-xl bg-white/50 dark:bg-black/40 backdrop-blur-xl border border-white/50 dark:border-white/10 pl-11 pr-4 py-2.5 text-sm font-semibold text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all shadow-sm"
                      />
                    </div>
                  </div>

                  {/* Método */}
                  <div className="w-full md:w-44">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">Método</label>
                    <select
                      value={methodFilter}
                      onChange={e => setMethodFilter(e.target.value as MethodFilter)}
                      className="w-full rounded-xl bg-white/50 dark:bg-black/40 backdrop-blur-xl border border-white/50 dark:border-white/10 px-4 py-2.5 text-sm font-semibold text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all shadow-sm cursor-pointer"
                    >
                      <option value="all">Todos</option>
                      <option value="cash">Efectivo</option>
                      <option value="transfer">Transferencia</option>
                      <option value="card">Débito</option>
                    </select>
                  </div>

                  {/* Facturado */}
                  <div className="w-full md:w-40">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">Facturado</label>
                    <select
                      value={invoicedFilter}
                      onChange={e => setInvoicedFilter(e.target.value as 'all' | 'yes' | 'no')}
                      className="w-full rounded-xl bg-white/50 dark:bg-black/40 backdrop-blur-xl border border-white/50 dark:border-white/10 px-4 py-2.5 text-sm font-semibold text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all shadow-sm cursor-pointer"
                    >
                      <option value="all">Todos</option>
                      <option value="yes">Sí</option>
                      <option value="no">No</option>
                    </select>
                  </div>

                  {/* Período: modo */}
                  <div className="w-full md:w-40">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">Período</label>
                    <select
                      value={dateMode}
                      onChange={e => {
                        const mode = e.target.value as 'year' | 'range'
                        setDateMode(mode)
                        if (mode === 'year') { setDateFrom(''); setDateTo('') }
                        else { setYearFilter('all') }
                      }}
                      className="w-full rounded-xl bg-white/50 dark:bg-black/40 backdrop-blur-xl border border-white/50 dark:border-white/10 px-4 py-2.5 text-sm font-semibold text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all shadow-sm cursor-pointer"
                    >
                      <option value="year">Por año</option>
                      <option value="range">Por rango</option>
                    </select>
                  </div>

                  {/* Año (visible si modo = year) */}
                  {dateMode === 'year' && (
                    <div className="w-full md:w-36">
                      <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">Año</label>
                      <select
                        value={yearFilter}
                        onChange={e => setYearFilter(e.target.value)}
                        className="w-full rounded-xl bg-white/50 dark:bg-black/40 backdrop-blur-xl border border-white/50 dark:border-white/10 px-4 py-2.5 text-sm font-semibold text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all shadow-sm cursor-pointer"
                      >
                        <option value="all">Todos</option>
                        {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                    </div>
                  )}

                  {/* Rango de fechas (visible si modo = range) */}
                  {dateMode === 'range' && (
                    <>
                      <div className="w-full md:w-44">
                        <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">Desde</label>
                        <input
                          type="date"
                          value={dateFrom}
                          onChange={e => setDateFrom(e.target.value)}
                          className="w-full rounded-xl bg-white/50 dark:bg-black/40 backdrop-blur-xl border border-white/50 dark:border-white/10 px-4 py-2.5 text-sm font-semibold text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all shadow-sm"
                        />
                      </div>
                      <div className="w-full md:w-44">
                        <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">Hasta</label>
                        <input
                          type="date"
                          value={dateTo}
                          onChange={e => setDateTo(e.target.value)}
                          className="w-full rounded-xl bg-white/50 dark:bg-black/40 backdrop-blur-xl border border-white/50 dark:border-white/10 px-4 py-2.5 text-sm font-semibold text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all shadow-sm"
                        />
                      </div>
                    </>
                  )}

                  {/* Monto mín */}
                  <div className="w-full md:w-36">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">Monto mín.</label>
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={amountMin}
                      onChange={e => setAmountMin(e.target.value)}
                      className="w-full rounded-xl bg-white/50 dark:bg-black/40 backdrop-blur-xl border border-white/50 dark:border-white/10 px-4 py-2.5 text-sm font-semibold text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all shadow-sm"
                    />
                  </div>

                  {/* Monto máx */}
                  <div className="w-full md:w-36">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">Monto máx.</label>
                    <input
                      type="number"
                      min="0"
                      placeholder="∞"
                      value={amountMax}
                      onChange={e => setAmountMax(e.target.value)}
                      className="w-full rounded-xl bg-white/50 dark:bg-black/40 backdrop-blur-xl border border-white/50 dark:border-white/10 px-4 py-2.5 text-sm font-semibold text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all shadow-sm"
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Mobile card list */}
      <div className="md:hidden space-y-3">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-[88px] rounded-2xl" />)}
          </div>
        ) : error ? (
          <div className="py-12 flex flex-col items-center gap-3 text-center">
            <p className="text-sm font-bold text-red-500">Error al cargar los pagos.</p>
            <button onClick={refetch} className="text-xs font-bold text-red-400 underline">Reintentar</button>
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">No hay pagos con los filtros actuales</p>
        ) : filtered.map(p => (
          <div key={p.id} className="flex items-center gap-3 rounded-2xl border border-white/50 dark:border-white/10 bg-white/60 dark:bg-black/40 backdrop-blur-xl px-4 py-3.5 shadow-sm">
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm text-gray-900 dark:text-white truncate leading-tight">{p.clientName}</p>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className="inline-flex items-center gap-1 rounded-lg border border-white/50 dark:border-white/10 bg-white/60 dark:bg-white/5 px-2 py-0.5 text-[11px] font-bold text-gray-700 dark:text-gray-300">
                  {METHOD_LABELS[p.method] ?? p.method}
                </span>
                <span className="text-[11px] text-gray-400 dark:text-gray-500">{formatDate(p.paidAt)}</span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2 shrink-0">
              <span className="text-base font-black text-emerald-600 dark:text-emerald-400">{formatCurrency(p.amount)}</span>
              <div className="flex items-center gap-1.5">
                <button onClick={() => toggleInvoiced(p)} className="transition-transform active:scale-90">
                  {p.invoiced
                    ? <CheckCircle2 size={18} className="text-emerald-500" />
                    : <XCircle size={18} className="text-gray-300 dark:text-gray-600" />}
                </button>
                <button
                  onClick={() => deletePayment(p.id)}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto rounded-[2rem] border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-3xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
        {isLoading ? (
          <div className="p-8 space-y-4">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}
          </div>
        ) : error ? (
          <div className="px-6 py-16 flex flex-col items-center gap-4 text-center">
            <p className="text-sm font-bold text-red-500">Error al cargar los pagos. Intentá de nuevo.</p>
            <button onClick={refetch} className="text-xs font-bold text-red-400 underline hover:text-red-300 transition-colors">Reintentar</button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-white/20 dark:border-white/10 bg-gray-50/30 dark:bg-black/10">
              <tr>
                {['Cliente', 'Monto', 'Método', 'Fecha', 'Facturado', ''].map(h => (
                  <th key={h} className="px-6 py-4 text-left text-xs font-extrabold uppercase tracking-widest text-gray-500 dark:text-gray-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/20 dark:divide-white/10">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-gray-500 dark:text-gray-400 font-medium">
                    No se encontraron pagos con los filtros actuales
                  </td>
                </tr>
              ) : filtered.map(p => (
                <tr key={p.id} className="group relative transition-colors hover:bg-white/50 dark:hover:bg-black/50 before:absolute before:bottom-0 before:left-0 before:top-0 before:w-[3px] before:bg-primary before:opacity-0 before:transition-opacity hover:before:opacity-100 bg-transparent">
                  <td className="px-6 py-4 font-bold text-gray-900 dark:text-white">{p.clientName}</td>
                  <td className="px-6 py-4 font-black text-emerald-600 dark:text-emerald-400 text-base">{formatCurrency(p.amount)}</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1.5 rounded-xl border border-white/50 dark:border-white/10 bg-white/50 dark:bg-white/5 backdrop-blur-md px-3 py-1 text-xs font-bold text-gray-700 dark:text-gray-200 shadow-sm">
                      {METHOD_LABELS[p.method] ?? p.method}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">{formatDate(p.paidAt)}</td>
                  <td className="px-6 py-4">
                    <button onClick={() => toggleInvoiced(p)} className="transition-transform hover:scale-110">
                      {p.invoiced
                        ? <CheckCircle2 size={20} className="text-emerald-500 drop-shadow-sm" />
                        : <XCircle size={20} className="text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400" />}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => deletePayment(p.id)}
                      className="rounded-xl p-2 text-gray-400 opacity-0 transition-all duration-300 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 group-hover:opacity-100"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create modal */}
      <Modal isOpen={modalOpen} onClose={() => { setModalOpen(false); reset() }} title="Registrar pago" size="md">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm text-[#9CA3AF]">Cliente *</label>
            <input
              placeholder="Buscar cliente…"
              value={clientSearch}
              onChange={e => { setClientSearch(e.target.value); loadClients(e.target.value) }}
              className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white placeholder-[#4B5563] focus:border-primary focus:outline-none"
            />
            {clientOptions.length > 0 && (
              <Select
                options={clientOptions}
                placeholder="Seleccioná un cliente"
                error={errors.clientId?.message}
                {...register('clientId')}
              />
            )}
          </div>
          <Input label="Monto *" type="number" error={errors.amount?.message} {...register('amount')} />
          <Select
            label="Método *"
            options={[
              { value: 'cash', label: 'Efectivo' },
              { value: 'transfer', label: 'Transferencia' },
              { value: 'card', label: 'Débito' },
            ]}
            error={errors.method?.message}
            {...register('method')}
          />
          <Input label="Fecha *" type="date" error={errors.paidAt?.message} {...register('paidAt')} />
          <div className="flex items-center gap-2">
            <input type="checkbox" id="invoiced" {...register('invoiced')} className="h-4 w-4 rounded" />
            <label htmlFor="invoiced" className="text-sm text-[#9CA3AF]">Facturado</label>
          </div>
          <Input label="Notas" {...register('notes')} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={() => { setModalOpen(false); reset() }}>Cancelar</Button>
            <Button type="submit" isLoading={isSubmitting}>Registrar</Button>
          </div>
        </form>
      </Modal>
    </motion.div>
  )
}
