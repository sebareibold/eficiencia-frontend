import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { pageVariants, cardVariants } from '../lib/motion'
import {
  Plus, CreditCard, Banknote, ArrowLeftRight, Building2, RefreshCw,
  CheckCircle2, XCircle, Trash2, Search, Filter, ChevronDown, Tag,
  Edit2, Save, X, LayoutList, LayoutGrid,
} from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format } from 'date-fns'
import { usePayments } from '../hooks/usePayments'
import { useMemberships } from '../hooks/useMemberships'
import { paymentsApi } from '../api/payments.api'
import { membershipsApi } from '../api/memberships.api'
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

  // ── Vista de pagos: lista o grid
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')

  // ── Membresías state
  const [membCreateOpen,  setMembCreateOpen]  = useState(false)
  const [membEditingId,   setMembEditingId]   = useState<number | null>(null)
  const [membSubmitting,  setMembSubmitting]  = useState(false)

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

  const { memberships, isLoading: membLoading, error: membError, refetch: refetchMemb } = useMemberships()

  const membSchema = z.object({
    name:          z.string().min(1, 'Requerido'),
    price:         z.string().min(1, 'Requerido').refine(v => Number(v) > 0, 'Inválido'),
    classesPerWeek:z.string().min(1, 'Requerido').refine(v => Number(v) > 0, 'Inválido'),
    description:   z.string().optional(),
  })
  type MembValues = z.infer<typeof membSchema>

  const {
    register: membRegister, handleSubmit: membHandleSubmit,
    formState: { errors: membErrors }, reset: membReset, setValue: membSetValue,
  } = useForm<MembValues>({ resolver: zodResolver(membSchema), defaultValues: { classesPerWeek: '2' } })

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

  async function onMembSubmit(data: MembValues) {
    setMembSubmitting(true)
    try {
      if (membEditingId !== null) {
        await membershipsApi.update(membEditingId, {
          name: data.name, price: Number(data.price),
          classesPerWeek: Number(data.classesPerWeek), description: data.description,
        })
        addToast('Membresía actualizada', 'success')
        setMembEditingId(null)
      } else {
        await membershipsApi.create({
          name: data.name, price: Number(data.price),
          classesPerWeek: Number(data.classesPerWeek), description: data.description,
        })
        addToast('Membresía creada', 'success')
        setMembCreateOpen(false)
      }
      membReset()
      refetchMemb()
    } catch {
      addToast('Error al guardar la membresía', 'error')
    } finally {
      setMembSubmitting(false)
    }
  }

  async function deleteMembership(id: number) {
    if (!confirm('¿Eliminar esta membresía?')) return
    try {
      await membershipsApi.remove(id)
      addToast('Membresía eliminada', 'success')
      refetchMemb()
    } catch {
      addToast('Error al eliminar', 'error')
    }
  }

  function startMembEdit(m: { id: number; name: string; price: number; classesPerWeek: number; description?: string }) {
    setMembEditingId(m.id)
    membSetValue('name', m.name)
    membSetValue('price', String(m.price))
    membSetValue('classesPerWeek', String(m.classesPerWeek))
    membSetValue('description', m.description || '')
  }

  const inputCls = 'w-full rounded-xl border-2 border-saas-border bg-white/60 dark:bg-white/5 px-3.5 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 transition-all focus:border-primary focus:outline-none'
  const labelCls = 'mb-1.5 block text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500'

  const summaryCards = [
    { label: 'Total cobrado', value: totals.total, icon: CreditCard, color: 'text-primary', bgColor: 'bg-primary/10' },
    { label: 'Efectivo', value: totals.byCash, icon: Banknote, color: 'text-green-400', bgColor: 'bg-green-500/10' },
    { label: 'Transferencia', value: totals.byTransfer, icon: ArrowLeftRight, color: 'text-blue-400', bgColor: 'bg-blue-500/10' },
    { label: 'Débito', value: totals.byCard, icon: Building2, color: 'text-purple-400', bgColor: 'bg-purple-500/10' },
  ]

  return (
    <motion.div {...pageVariants} className="space-y-8 pb-12 relative z-10">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tighter text-gray-900 dark:text-white drop-shadow-sm">Pagos</h1>
          <p className="mt-2 text-sm font-semibold text-gray-500 dark:text-gray-400">
            Gestioná los ingresos y planes del gimnasio
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => { refetch(); refetchMemb() }}
            className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-xl text-gray-600 dark:text-gray-300 transition-all hover:scale-105 hover:bg-white/50 dark:hover:bg-black/50 shadow-sm"
          >
            <RefreshCw size={18} />
          </button>
          <button
            onClick={() => { membReset(); setMembCreateOpen(true) }}
            className="flex items-center gap-2 rounded-xl border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-xl px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-white/50 dark:hover:bg-black/50 transition-all shadow-sm"
          >
            <Plus size={13} strokeWidth={2.5} />
            Nueva membresía
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

      {/* ══ SECCIÓN PAGOS ══ */}

      {/* KPI strip */}
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

      {/* Filtros + toggle vista */}
      <div className="rounded-[2rem] border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-3xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
        <div className="flex items-center justify-between px-6 py-4">
          <button
            onClick={() => setIsFiltersOpen(v => !v)}
            className="flex items-center gap-2 text-gray-800 dark:text-white font-bold"
          >
            <Filter size={18} className="text-primary" />
            <span>Filtros Avanzados</span>
            <motion.span animate={{ rotate: isFiltersOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
              <ChevronDown size={18} className="text-gray-400" />
            </motion.span>
          </button>

          {/* Toggle Lista / Grid */}
          <div className="flex gap-1 p-1 rounded-xl bg-white/40 dark:bg-white/[0.04] border border-gray-200/60 dark:border-white/[0.07]">
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-white/[0.09] text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-[#8A8A9A] hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              <LayoutList size={14} /> Lista
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-white/[0.09] text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-[#8A8A9A] hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              <LayoutGrid size={14} /> Cards
            </button>
          </div>
        </div>

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
                  {dateMode === 'range' && (<>
                    <div className="w-full md:w-44">
                      <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">Desde</label>
                      <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                        className="w-full rounded-xl bg-white/50 dark:bg-black/40 backdrop-blur-xl border border-white/50 dark:border-white/10 px-4 py-2.5 text-sm font-semibold text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all shadow-sm" />
                    </div>
                    <div className="w-full md:w-44">
                      <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">Hasta</label>
                      <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                        className="w-full rounded-xl bg-white/50 dark:bg-black/40 backdrop-blur-xl border border-white/50 dark:border-white/10 px-4 py-2.5 text-sm font-semibold text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all shadow-sm" />
                    </div>
                  </>)}
                  <div className="w-full md:w-36">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">Monto mín.</label>
                    <input type="number" min="0" placeholder="0" value={amountMin} onChange={e => setAmountMin(e.target.value)}
                      className="w-full rounded-xl bg-white/50 dark:bg-black/40 backdrop-blur-xl border border-white/50 dark:border-white/10 px-4 py-2.5 text-sm font-semibold text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all shadow-sm" />
                  </div>
                  <div className="w-full md:w-36">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">Monto máx.</label>
                    <input type="number" min="0" placeholder="∞" value={amountMax} onChange={e => setAmountMax(e.target.value)}
                      className="w-full rounded-xl bg-white/50 dark:bg-black/40 backdrop-blur-xl border border-white/50 dark:border-white/10 px-4 py-2.5 text-sm font-semibold text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all shadow-sm" />
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Vista Lista (tabla desktop / cards mobile) ── */}
      {viewMode === 'list' && (<>
        {/* Mobile */}
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

        {/* Desktop tabla */}
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
                  <tr><td colSpan={6} className="px-6 py-16 text-center text-gray-500 dark:text-gray-400 font-medium">No se encontraron pagos con los filtros actuales</td></tr>
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
      </>)}

      {/* ── Vista Grid (cards) ── */}
      {viewMode === 'grid' && (
        <div>
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-2xl" />)}
            </div>
          ) : error ? (
            <div className="py-12 flex flex-col items-center gap-3 text-center">
              <p className="text-sm font-bold text-red-500">Error al cargar los pagos.</p>
              <button onClick={refetch} className="text-xs font-bold text-red-400 underline">Reintentar</button>
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">No hay pagos con los filtros actuales</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map(p => {
                const MethodIcon = METHOD_ICONS[p.method] ?? CreditCard
                return (
                  <motion.div
                    key={p.id}
                    variants={cardVariants}
                    initial="hidden"
                    animate="visible"
                    className="group relative rounded-2xl border border-white/50 dark:border-white/10 bg-white/60 dark:bg-black/40 backdrop-blur-xl p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                          <MethodIcon size={18} className="text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-sm text-gray-900 dark:text-white truncate leading-tight">{p.clientName}</p>
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{formatDate(p.paidAt)}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => deletePayment(p.id)}
                        className="rounded-lg p-1.5 text-gray-300 dark:text-gray-600 opacity-0 group-hover:opacity-100 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 transition-all"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                        {formatCurrency(p.amount)}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center rounded-lg border border-white/50 dark:border-white/10 bg-white/60 dark:bg-white/5 px-2.5 py-1 text-[11px] font-bold text-gray-700 dark:text-gray-300">
                          {METHOD_LABELS[p.method] ?? p.method}
                        </span>
                        <button onClick={() => toggleInvoiced(p)} className="transition-transform hover:scale-110">
                          {p.invoiced
                            ? <CheckCircle2 size={18} className="text-emerald-500" />
                            : <XCircle size={18} className="text-gray-300 dark:text-gray-600" />}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ══ SECCIÓN MEMBRESÍAS ══ */}
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black tracking-tighter text-gray-900 dark:text-white">Planes y Membresías</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Administrá los planes disponibles del gimnasio</p>
          </div>
        </div>

        {membError && (
          <div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3">
            <span className="text-sm text-red-400">{membError}</span>
            <button onClick={refetchMemb} className="ml-auto text-xs text-red-400 underline">Reintentar</button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {membLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="min-h-[320px] rounded-[2rem] border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-3xl p-8">
                <div className="flex items-center gap-3 mb-8">
                  <div className="h-12 w-12 rounded-2xl bg-white/10 animate-pulse" />
                  <div className="h-6 w-32 rounded-lg bg-white/10 animate-pulse" />
                </div>
                <div className="h-12 w-40 rounded-lg bg-white/10 animate-pulse mb-2" />
                <div className="h-4 w-20 rounded-lg bg-white/10 animate-pulse" />
              </div>
            ))
          ) : memberships.length === 0 ? (
            <div className="col-span-full py-16 text-center text-[#8A8A9A]">
              No hay planes registrados. Creá el primero.
            </div>
          ) : memberships.map(m => {
            const isEditing = membEditingId === m.id
            return (
              <motion.div
                key={m.id}
                layout
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className={`relative overflow-hidden rounded-[2rem] border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-3xl p-8 shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)] flex flex-col transition-all duration-300 hover:shadow-[0_20px_40px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_20px_40px_rgba(0,0,0,0.4)] ${
                  isEditing ? 'min-h-[420px] ring-2 ring-primary/30' : 'min-h-[320px] hover:-translate-y-1'
                }`}
              >
                <div className="relative z-10 flex flex-1 flex-col">
                  <div className="mb-6 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-12 w-12 items-center justify-center rounded-2xl shadow-inner ${isEditing ? 'bg-primary/15' : 'bg-primary/10'}`}>
                        <Tag size={22} className="text-primary" />
                      </div>
                      {!isEditing && <h3 className="text-xl font-bold text-gray-900 dark:text-white">{m.name}</h3>}
                      {isEditing && <span className="text-xs font-bold uppercase tracking-widest text-primary">Editando</span>}
                    </div>
                    <div className="flex gap-1">
                      {!isEditing ? (<>
                        <button onClick={() => startMembEdit(m)} className="rounded-xl p-2 text-gray-400 hover:bg-white/60 dark:hover:bg-white/10 hover:text-gray-900 dark:hover:text-white transition-all">
                          <Edit2 size={15} />
                        </button>
                        <button onClick={() => deleteMembership(m.id)} className="rounded-xl p-2 text-gray-400 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-500 transition-all">
                          <Trash2 size={15} />
                        </button>
                      </>) : (
                        <button onClick={() => { setMembEditingId(null); membReset() }} className="rounded-xl p-2 text-gray-400 hover:bg-white/60 dark:hover:bg-white/10 hover:text-gray-700 dark:hover:text-white transition-all">
                          <X size={15} />
                        </button>
                      )}
                    </div>
                  </div>

                  <AnimatePresence mode="wait">
                    {!isEditing ? (
                      <motion.div key="display" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="flex flex-1 flex-col">
                        <div className="mb-8">
                          <div className="flex items-end gap-1.5">
                            <span className="text-4xl font-black tabular-nums tracking-tighter text-gray-900 dark:text-white">{formatCurrency(m.price)}</span>
                            <span className="mb-1 text-sm font-medium text-gray-400">/ mes</span>
                          </div>
                        </div>
                        <div className="mt-auto space-y-3">
                          <div className="flex items-center gap-2.5 text-sm text-gray-700 dark:text-gray-300">
                            <CheckCircle2 size={16} className="shrink-0 text-primary" />
                            <span>{m.classesPerWeek} clases por semana</span>
                          </div>
                          {m.description && (
                            <p className="text-xs text-gray-400 dark:text-gray-500 leading-relaxed line-clamp-3">{m.description}</p>
                          )}
                        </div>
                      </motion.div>
                    ) : (
                      <motion.form key="edit" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
                        onSubmit={membHandleSubmit(onMembSubmit)} className="flex flex-1 flex-col gap-4">
                        <div>
                          <label className={labelCls}>Nombre</label>
                          <input className={inputCls} placeholder="Nombre del plan" {...membRegister('name')} />
                          {membErrors.name && <p className="mt-1 text-xs text-red-500">{membErrors.name.message}</p>}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className={labelCls}>Precio / mes</label>
                            <input type="number" className={inputCls} {...membRegister('price')} />
                            {membErrors.price && <p className="mt-1 text-xs text-red-500">{membErrors.price.message}</p>}
                          </div>
                          <div>
                            <label className={labelCls}>Clases / semana</label>
                            <input type="number" className={inputCls} {...membRegister('classesPerWeek')} />
                          </div>
                        </div>
                        <div>
                          <label className={labelCls}>Descripción</label>
                          <textarea rows={2} className={`${inputCls} resize-none`} {...membRegister('description')} />
                        </div>
                        <div className="mt-auto flex gap-2.5 pt-2">
                          <button type="button" onClick={() => { setMembEditingId(null); membReset() }}
                            className="flex-1 rounded-xl border border-saas-border bg-white/50 dark:bg-white/5 py-2.5 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-white/10 transition-all">
                            Descartar
                          </button>
                          <button type="submit" disabled={membSubmitting}
                            className="flex flex-1 items-center justify-center gap-2 rounded-xl btn-action py-2.5 text-sm disabled:opacity-60">
                            {membSubmitting ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-900/30 border-t-gray-900" /> : <Save size={14} />}
                            Guardar
                          </button>
                        </div>
                      </motion.form>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* Modal crear membresía */}
      <Modal isOpen={membCreateOpen} onClose={() => { setMembCreateOpen(false); membReset() }} title="Nueva membresía" size="sm">
        <form onSubmit={membHandleSubmit(onMembSubmit)} className="space-y-4">
          <Input label="Nombre del plan *" error={membErrors.name?.message} {...membRegister('name')} />
          <Input label="Precio mensual *" type="number" error={membErrors.price?.message} {...membRegister('price')} />
          <Input label="Clases por semana *" type="number" error={membErrors.classesPerWeek?.message} {...membRegister('classesPerWeek')} />
          <Input label="Descripción (opcional)" error={membErrors.description?.message} {...membRegister('description')} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={() => { setMembCreateOpen(false); membReset() }}>Cancelar</Button>
            <Button type="submit" isLoading={membSubmitting}>Crear</Button>
          </div>
        </form>
      </Modal>

      {/* Modal registrar pago */}
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
