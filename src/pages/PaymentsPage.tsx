import { useState, useMemo, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { QK } from '../lib/queryKeys'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { pageVariants, cardVariants, staggerContainerFast, fadeUpItem } from '../lib/motion'
import {
  Plus, CreditCard, Banknote, ArrowLeftRight, Building2, RefreshCw,
  Trash2, Search, ChevronLeft, ChevronRight,
  Layers, LayoutList, LayoutGrid, Edit2, X, Save, Pencil,
  ArrowUp, ArrowDown, ArrowUpDown,
} from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format, startOfMonth, endOfMonth, addMonths, addDays } from 'date-fns'
import { ROUTES } from '../constants/routes'
import { usePayments } from '../hooks/usePayments'
import { useMemberships } from '../hooks/useMemberships'
import { paymentsApi } from '../api/payments.api'
import { membershipsApi } from '../api/memberships.api'
import { tarifasApi } from '../api/tarifas.api'
import { usePermissions } from '../hooks/usePermissions'
import { useAuthStore } from '../store/authStore'
import { useUiStore } from '../store/uiStore'
import { MODALIDAD_LABELS, MODALIDAD_DURACION, MODALIDADES } from '../types/membership.types'
import type { Plan, Modalidad, TarifaVigente } from '../types/membership.types'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import Input from '../components/ui/Input'
import KpiCard from '../components/ui/KpiCard'
import Select from '../components/ui/Select'
import Skeleton from '../components/ui/Skeleton'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import DotsLoader from '../components/ui/DotsLoader'
import { formatCurrency } from '../utils/formatCurrency'
import { formatDate } from '../utils/formatDate'
import type { Payment, PaymentMethod } from '../types/payment.types'

// ── Constantes de pagos ───────────────────────────────────────────────────────

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

// ── Schemas ───────────────────────────────────────────────────────────────────

const planSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  classesPerWeek: z.string().min(1, 'Requerido'),
  description: z.string().optional(),
})
type PlanFormValues = z.infer<typeof planSchema>

const precioSchema = z.object({
  precio: z.string().min(1, 'Requerido').refine(v => !isNaN(Number(v)) && Number(v) >= 0, 'Inválido'),
})
type PrecioFormValues = z.infer<typeof precioSchema>

type MethodFilter = 'all' | PaymentMethod

// ── Componente fila de precio por modalidad ───────────────────────────────────

function PrecioRow({
  modalidad,
  tarifa,
  onSaved,
}: {
  modalidad: Modalidad
  tarifa?: TarifaVigente
  onSaved: () => void
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const { can } = usePermissions()
  const addToast = useUiStore(s => s.addToast)

  const { register, handleSubmit, formState: { errors }, reset } = useForm<PrecioFormValues>({
    resolver: zodResolver(precioSchema),
    defaultValues: { precio: tarifa ? String(tarifa.precio) : '' },
  })

  async function onSubmit(data: PrecioFormValues) {
    if (!tarifa) return
    setIsSaving(true)
    try {
      await tarifasApi.updatePrecio(tarifa.id, Number(data.precio))
      addToast(`Precio actualizado`, 'success')
      setIsEditing(false)
      onSaved()
    } catch {
      addToast('Error al actualizar el precio', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  function cancelEdit() { reset(); setIsEditing(false) }

  return (
    <motion.div layout transition={{ duration: 0.2, ease: 'easeInOut' }}
      className={`rounded-2xl transition-all duration-200 ${isEditing ? 'bg-white/50 dark:bg-white/[0.06] p-4 mb-2' : 'px-1 py-2.5 border-b border-white/20 dark:border-white/10 last:border-0'}`}
    >
      <AnimatePresence mode="wait">
        {!isEditing ? (

          /* ── Vista precio ── */
          <motion.div key="display"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="flex items-center justify-between gap-3"
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 leading-tight">
                {MODALIDAD_LABELS[modalidad]}
              </p>
              <p className="text-xs text-gray-400 dark:text-[#8A8A9A] mt-0.5">
                {MODALIDAD_DURACION[modalidad]}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-base font-black tabular-nums text-emerald-600 dark:text-emerald-400">
                {tarifa ? formatCurrency(tarifa.precio) : <span className="text-sm font-medium text-gray-400 italic">—</span>}
              </span>
              {can('memberships', 'update') && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="rounded-xl p-1.5 text-gray-400 dark:text-gray-600 hover:text-primary hover:bg-primary/10 transition-all"
                  title="Editar precio"
                >
                  <Pencil size={13} />
                </button>
              )}
            </div>
          </motion.div>

        ) : (

          /* ── Editor de precio ── */
          <motion.form key="edit"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onSubmit={handleSubmit(onSubmit)}
            className="flex flex-col gap-3"
          >
            {/* Cabecera del editor */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-gray-900 dark:text-white">
                  {MODALIDAD_LABELS[modalidad]}
                </p>
                <p className="text-xs text-gray-400 dark:text-[#8A8A9A]">
                  {MODALIDAD_DURACION[modalidad]}
                </p>
              </div>
              <button type="button" onClick={cancelEdit}
                className="rounded-xl p-1.5 text-gray-400 hover:bg-white/60 dark:hover:bg-white/10 hover:text-gray-700 dark:hover:text-white transition-all">
                <X size={14} />
              </button>
            </div>

            {/* Input de precio */}
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-base font-bold text-gray-400 pointer-events-none">$</span>
              <input
                type="number"
                min="0"
                step="1000"
                autoFocus
                placeholder="0"
                className="w-full rounded-2xl border border-primary/50 bg-white dark:bg-white/10 pl-8 pr-4 py-3 text-lg font-black tabular-nums text-gray-900 dark:text-white placeholder:text-gray-300 dark:placeholder:text-gray-600 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                {...register('precio')}
              />
              {errors.precio && (
                <p className="mt-1 text-xs text-red-500">{errors.precio.message}</p>
              )}
            </div>

            {/* Botones */}
            <div className="flex gap-2">
              <button type="button" onClick={cancelEdit}
                className="flex-1 rounded-2xl border border-white/30 dark:border-white/10 bg-white/40 dark:bg-white/[0.04] py-2.5 text-sm font-bold text-gray-600 dark:text-gray-300 hover:bg-white/60 dark:hover:bg-white/10 transition-all">
                Cancelar
              </button>
              <button type="submit" disabled={isSaving}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl btn-action py-2.5 text-sm font-bold disabled:opacity-60">
                {isSaving
                  ? <DotsLoader size="sm" className="flex items-center" />
                  : <Save size={14} />}
                Guardar
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ── Esquema inline edición de plan ────────────────────────────────────────────

const editPlanSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  classesPerWeek: z.string().min(1, 'Requerido'),
  description: z.string().optional(),
})
type EditPlanValues = z.infer<typeof editPlanSchema>

const SESIONES_OPTS = [
  { value: '2', label: '2×', sub: '2 veces / semana' },
  { value: '3', label: '3×', sub: '3 veces / semana' },
  { value: '5', label: 'Full', sub: '4 o 5 veces / semana' },
]

// ── Componente card de un plan ─────────────────────────────────────────────────

function PlanCard({
  plan,
  onDelete,
  onRefresh,
}: {
  plan: Plan
  onDelete: (plan: Plan) => void
  onRefresh: () => void
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [selectedSesiones, setSelectedSesiones] = useState(String(plan.classesPerWeek))
  const { can } = usePermissions()
  const addToast = useUiStore(s => s.addToast)
  const tarifaMap = Object.fromEntries(plan.tarifas.map(t => [t.modalidad, t])) as Record<Modalidad, TarifaVigente | undefined>

  const { register, handleSubmit, formState: { errors }, reset, setValue } = useForm<EditPlanValues>({
    resolver: zodResolver(editPlanSchema),
    defaultValues: {
      name: plan.name,
      classesPerWeek: String(plan.classesPerWeek),
      description: plan.description ?? '',
    },
  })

  async function onSavePlan(data: EditPlanValues) {
    setIsSaving(true)
    try {
      await membershipsApi.update(plan.id, {
        name: data.name,
        classesPerWeek: Number(data.classesPerWeek),
        description: data.description,
      })
      addToast('Plan actualizado', 'success')
      setIsEditing(false)
      onRefresh()
    } catch {
      addToast('Error al guardar el plan', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  function openEdit() {
    setSelectedSesiones(String(plan.classesPerWeek))
    reset({ name: plan.name, classesPerWeek: String(plan.classesPerWeek), description: plan.description ?? '' })
    setIsEditing(true)
  }

  function discardEdit() {
    reset({ name: plan.name, classesPerWeek: String(plan.classesPerWeek), description: plan.description ?? '' })
    setIsEditing(false)
  }

  return (
    <motion.div
      layout
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className={`rounded-2xl lg:rounded-[2rem] border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-3xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)] transition-all duration-300 flex flex-col ${
        isEditing
          ? 'ring-2 ring-primary/30'
          : 'hover:-translate-y-1 hover:shadow-[0_20px_40px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_20px_40px_rgba(0,0,0,0.4)]'
      }`}
    >
      {/* ── Cabecera ── */}
      <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-3 lg:px-6 lg:pt-5 lg:pb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`flex h-11 w-11 items-center justify-center rounded-2xl shadow-inner shrink-0 transition-colors ${isEditing ? 'bg-primary/20' : 'bg-primary/10'}`}>
            <Layers size={20} className="text-primary" />
          </div>
          <div className="min-w-0">
            {isEditing
              ? <span className="text-xs font-extrabold uppercase tracking-widest text-primary">Editando plan</span>
              : <p className="font-bold text-gray-900 dark:text-white truncate">{plan.name}</p>
            }
            {!isEditing && (
              <p className="text-xs font-semibold text-gray-400 dark:text-[#8A8A9A] mt-0.5">
                {plan.classesPerWeek === 5 ? '4 o 5' : plan.classesPerWeek} sesiones / semana
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {!isEditing ? (
            <>
              <button onClick={openEdit}
                className="rounded-xl p-2 text-gray-400 dark:text-gray-600 hover:bg-white/60 dark:hover:bg-white/10 hover:text-gray-900 dark:hover:text-white transition-all">
                <Edit2 size={15} />
              </button>
              <button onClick={() => onDelete(plan)}
                className="rounded-xl p-2 text-gray-400 dark:text-gray-600 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-500 transition-all">
                <Trash2 size={15} />
              </button>
            </>
          ) : (
            <button onClick={discardEdit}
              className="rounded-xl p-2 text-gray-400 dark:text-gray-600 hover:bg-white/60 dark:hover:bg-white/10 hover:text-gray-700 dark:hover:text-white transition-all">
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {/* Separador */}
      <div className="mx-4 lg:mx-6 border-t border-white/20 dark:border-white/10" />

      {/* ── Cuerpo ── */}
      <AnimatePresence mode="wait">
        {!isEditing ? (

          /* Vista de precios */
          <motion.div key="display"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="px-4 py-3 lg:px-6 lg:py-5 flex-1"
          >
            <p className="text-xs font-extrabold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-4">
              Precio por modalidad
            </p>
            {MODALIDADES.map(modalidad => (
              <PrecioRow key={modalidad} modalidad={modalidad} tarifa={tarifaMap[modalidad]} onSaved={onRefresh} />
            ))}
          </motion.div>

        ) : (

          /* Formulario inline */
          <motion.form key="edit"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onSubmit={handleSubmit(onSavePlan)}
            className="px-4 py-4 lg:px-6 lg:py-5 flex flex-col gap-4 lg:gap-5"
          >
            {/* Nombre */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-extrabold uppercase tracking-widest text-gray-500 dark:text-gray-400">
                Nombre del plan
              </label>
              <input
                autoFocus
                placeholder="Ej: 3 veces por semana"
                className="w-full rounded-2xl border border-white/30 dark:border-white/10 bg-white/70 dark:bg-white/[0.07] px-4 py-3 text-base font-semibold text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-600 transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                {...register('name')}
              />
              {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
            </div>

            {/* Sesiones — botones visuales */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-extrabold uppercase tracking-widest text-gray-500 dark:text-gray-400">
                Sesiones por semana
              </label>
              <div className="grid grid-cols-3 gap-2">
                {SESIONES_OPTS.map(opt => {
                  const active = selectedSesiones === opt.value
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => { setSelectedSesiones(opt.value); setValue('classesPerWeek', opt.value) }}
                      className={`flex flex-col items-center justify-center gap-0.5 rounded-2xl border py-2.5 lg:py-3.5 px-2 transition-all ${
                        active
                          ? 'border-primary bg-primary/10 text-primary shadow-[0_0_0_2px_rgba(251,198,8,0.3)]'
                          : 'border-white/30 dark:border-white/10 bg-white/40 dark:bg-white/[0.04] text-gray-600 dark:text-gray-300 hover:border-primary/40 hover:bg-primary/5'
                      }`}
                    >
                      <span className={`text-lg font-black leading-none ${active ? 'text-primary' : ''}`}>
                        {opt.label}
                      </span>
                      <span className={`text-[10px] font-semibold leading-tight text-center ${active ? 'text-primary/70' : 'text-gray-400 dark:text-[#8A8A9A]'}`}>
                        {opt.sub}
                      </span>
                    </button>
                  )
                })}
              </div>
              <input type="hidden" {...register('classesPerWeek')} />
            </div>

            {/* Descripción */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-extrabold uppercase tracking-widest text-gray-500 dark:text-gray-400">
                Descripción <span className="normal-case font-normal text-gray-400">(opcional)</span>
              </label>
              <textarea
                rows={2}
                placeholder="Descripción breve del plan..."
                className="w-full resize-none rounded-2xl border border-white/30 dark:border-white/10 bg-white/70 dark:bg-white/[0.07] px-4 py-3 text-sm font-medium text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-600 transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                {...register('description')}
              />
            </div>

            {/* Acciones */}
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={discardEdit}
                className="flex-1 rounded-2xl border border-white/30 dark:border-white/10 bg-white/40 dark:bg-white/[0.05] py-3 text-sm font-bold text-gray-600 dark:text-gray-300 hover:bg-white/60 dark:hover:bg-white/10 transition-all"
              >
                Descartar
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl btn-action py-3 text-sm font-bold disabled:opacity-60"
              >
                {isSaving
                  ? <DotsLoader size="sm" className="flex items-center" />
                  : <Save size={15} />}
                Guardar cambios
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ── Sort helper ───────────────────────────────────────────────────────────────

type PaySortKey = 'clientName' | 'amount' | 'paidAt' | 'invoiced'
type PaySortDir = 'asc' | 'desc'

function PaySortIcon({ active, dir }: { active: boolean; dir: PaySortDir }) {
  if (!active) return <ArrowUpDown size={11} className="opacity-30" />
  return dir === 'asc'
    ? <ArrowUp size={11} className="text-primary" />
    : <ArrowDown size={11} className="text-primary" />
}

// ── Página principal ──────────────────────────────────────────────────────────

type PeriodMode = 'day' | 'month' | 'year' | 'all'

const MONTH_NAMES_PAY = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

export default function PaymentsPage() {
  const today = new Date()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // ── Estado pagos ──
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')
  const [periodMode, setPeriodMode] = useState<PeriodMode>('month')
  const [navDate, setNavDate] = useState(today)
  const [methodFilter, setMethodFilter] = useState<MethodFilter>('all')
  const [invoicedFilter, setInvoicedFilter] = useState<'all' | 'yes' | 'no'>('all')
  const [searchFilter, setSearchFilter] = useState('')

  // ── Estado planes ──
  const [planModalOpen, setPlanModalOpen] = useState(false)
  const [planSubmitting, setPlanSubmitting] = useState(false)
  const [deletePaymentTarget, setDeletePaymentTarget] = useState<number | null>(null)
  const [deletePlanTarget, setDeletePlanTarget] = useState<Plan | null>(null)
  const [removedPaymentIds, setRemovedPaymentIds] = useState<Set<number>>(new Set())
  const [togglingIds, setTogglingIds] = useState<Set<number>>(new Set())
  const [isDeletingPlan, setIsDeletingPlan] = useState(false)

  // ── Derivados de período ──
  const periodDesde = periodMode === 'day'   ? format(navDate, 'yyyy-MM-dd')
                    : periodMode === 'month' ? format(startOfMonth(navDate), 'yyyy-MM-dd')
                    : undefined
  const periodHasta = periodMode === 'day'   ? format(navDate, 'yyyy-MM-dd')
                    : periodMode === 'month' ? format(endOfMonth(navDate), 'yyyy-MM-dd')
                    : undefined
  const periodAnio  = periodMode === 'year'  ? String(navDate.getFullYear()) : undefined

  const periodLabel = periodMode === 'day'   ? format(navDate, 'dd/MM/yyyy')
                    : periodMode === 'month' ? `${MONTH_NAMES_PAY[navDate.getMonth()]} ${navDate.getFullYear()}`
                    : periodMode === 'year'  ? String(navDate.getFullYear())
                    : 'Todo el tiempo'

  const isAtPresent = periodMode === 'day'
    ? format(navDate, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd')
    : periodMode === 'month'
    ? navDate.getFullYear() === today.getFullYear() && navDate.getMonth() === today.getMonth()
    : navDate.getFullYear() >= today.getFullYear()

  const goNavBack    = () => setNavDate(d =>
    periodMode === 'day'   ? addDays(d, -1) :
    periodMode === 'month' ? addMonths(d, -1) :
    new Date(d.getFullYear() - 1, 0, 1))
  const goNavForward = () => setNavDate(d =>
    periodMode === 'day'   ? addDays(d, 1) :
    periodMode === 'month' ? addMonths(d, 1) :
    new Date(d.getFullYear() + 1, 0, 1))

  const { memberships: plans, isLoading: plansLoading, error: plansError, refetch: refetchPlans } = useMemberships()
  const { payments, total: serverTotal, totalPages, currentPage, goToPage, isLoading, error, refetch } = usePayments({
    desde: periodDesde,
    hasta: periodHasta,
    anio:  periodAnio,
  })

  // Resetear página al cambiar período
  useEffect(() => { goToPage(1) }, [periodMode, navDate.getFullYear(), navDate.getMonth()]) // eslint-disable-line react-hooks/exhaustive-deps
  const { can } = usePermissions()
  const addToast = useUiStore(s => s.addToast)
  const user = useAuthStore(s => s.user)
  const isAdmin = user?.role === 'admin'

  const [paySortKey, setPaySortKey] = useState<PaySortKey>('paidAt')
  const [paySortDir, setPaySortDir] = useState<PaySortDir>('desc')

  function togglePaySort(key: PaySortKey) {
    if (paySortKey === key) setPaySortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setPaySortKey(key); setPaySortDir('asc') }
  }

  // ── Forms ──
  const {
    register: planRegister, handleSubmit: planHandleSubmit,
    formState: { errors: planErrors }, reset: planReset,
  } = useForm<PlanFormValues>({
    resolver: zodResolver(planSchema),
    defaultValues: { classesPerWeek: '2' },
  })

  // ── Filtros y totales ──
  const filtered = useMemo(() => payments.filter(p => {
    if (removedPaymentIds.has(p.id)) return false
    const matchMethod   = methodFilter   === 'all' || p.method === methodFilter
    const matchInvoiced = invoicedFilter === 'all' || (invoicedFilter === 'yes' && p.invoiced) || (invoicedFilter === 'no' && !p.invoiced)
    const matchSearch   = !searchFilter  || p.clientName.toLowerCase().includes(searchFilter.toLowerCase())
    return matchMethod && matchInvoiced && matchSearch
  }), [payments, methodFilter, invoicedFilter, searchFilter, removedPaymentIds])

  const sortedFiltered = useMemo(() => {
    const arr = [...filtered]
    arr.sort((a, b) => {
      let cmp = 0
      if (paySortKey === 'clientName') cmp = a.clientName.localeCompare(b.clientName)
      else if (paySortKey === 'amount') cmp = a.amount - b.amount
      else if (paySortKey === 'paidAt') cmp = a.paidAt.localeCompare(b.paidAt)
      else if (paySortKey === 'invoiced') cmp = Number(a.invoiced) - Number(b.invoiced)
      return paySortDir === 'asc' ? cmp : -cmp
    })
    return arr
  }, [filtered, paySortKey, paySortDir])

  // ── Resumen del período (para KPIs — mismo período que la tabla) ──
  const summaryParams = {
    desde: periodMode === 'day' || periodMode === 'month' ? periodDesde : undefined,
    hasta: periodMode === 'day' || periodMode === 'month' ? periodHasta : undefined,
    anio:  periodAnio,
  }
  const { data: summaryData } = useQuery({
    queryKey: QK.payments.summary(summaryParams),
    queryFn:  () => paymentsApi.getSummary(summaryParams),
    staleTime: 30_000,
  })
  const totals = {
    total:      summaryData?.total                             ?? 0,
    byCash:     summaryData?.porMetodo?.EFECTIVO?.total        ?? 0,
    byTransfer: summaryData?.porMetodo?.TRANSFERENCIA?.total   ?? 0,
    byCard:     (summaryData?.porMetodo?.DEBITO?.total ?? 0) + (summaryData?.porMetodo?.EMPRESA?.total ?? 0),
  }

  // ── Handlers pagos ──
  function patchInvoicedInCache(id: number, invoiced: boolean) {
    queryClient.setQueriesData<{ data: Payment[]; total: number; totalPages: number }>(
      { queryKey: ['payments'] },
      old => {
        if (!old?.data || !Array.isArray(old.data)) return old
        return { ...old, data: old.data.map(x => x.id === id ? { ...x, invoiced } : x) }
      },
    )
  }

  async function toggleInvoiced(p: Payment) {
    setTogglingIds(prev => new Set([...prev, p.id]))
    const nuevoEstado = !p.invoiced
    patchInvoicedInCache(p.id, nuevoEstado)
    try {
      await paymentsApi.toggleInvoiced(p.id)
      addToast(
        `${nuevoEstado ? 'Facturado' : 'Sin factura'} — ${p.clientName} · ${formatCurrency(p.amount)} · ${formatDate(p.paidAt)}`,
        'success',
      )
    } catch {
      patchInvoicedInCache(p.id, p.invoiced)
      addToast('Error al actualizar el estado de facturación', 'error')
    } finally {
      setTogglingIds(prev => { const s = new Set(prev); s.delete(p.id); return s })
    }
  }

  async function deletePayment(id: number) {
    setDeletePaymentTarget(null)
    setRemovedPaymentIds(prev => new Set([...prev, id]))
    try {
      await paymentsApi.remove(id)
      addToast('Pago eliminado', 'success')
      refetch()
      setRemovedPaymentIds(prev => { const s = new Set(prev); s.delete(id); return s })
    } catch {
      setRemovedPaymentIds(prev => { const s = new Set(prev); s.delete(id); return s })
      addToast('Error al eliminar', 'error')
    }
  }

  // ── Handlers planes ──
  function openCreatePlan() {
    planReset({ classesPerWeek: '2' }); setPlanModalOpen(true)
  }
  function closePlanModal() { setPlanModalOpen(false); planReset() }

  async function onPlanSubmit(data: PlanFormValues) {
    setPlanSubmitting(true)
    try {
      await membershipsApi.create({ name: data.name, classesPerWeek: Number(data.classesPerWeek), description: data.description })
      addToast('Plan creado', 'success')
      closePlanModal(); refetchPlans()
    } catch { addToast('Error al guardar el plan', 'error') }
    finally { setPlanSubmitting(false) }
  }

  async function deletePlan(plan: Plan) {
    if ((plan.membresiaCount ?? 0) > 0) {
      addToast(`El plan tiene ${plan.membresiaCount} membresía(s) activa(s) — no se puede eliminar`, 'error')
      return
    }
    setDeletePlanTarget(plan)
  }

  async function confirmDeletePlan() {
    if (!deletePlanTarget) return
    setIsDeletingPlan(true)
    try { await membershipsApi.remove(deletePlanTarget.id); addToast('Plan eliminado', 'success'); refetchPlans() }
    catch { addToast('Error al eliminar', 'error') }
    finally { setIsDeletingPlan(false); setDeletePlanTarget(null) }
  }

  // ── Clases compartidas ──
  const inputCls = 'w-full rounded-xl border-2 border-saas-border bg-white/60 dark:bg-white/5 px-3.5 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 transition-all focus:border-primary focus:outline-none'
  const labelCls = 'mb-1.5 block text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500'

  const summaryCards = [
    { label: 'Total cobrado',   value: totals.total,      icon: CreditCard,    color: 'text-primary',      bgColor: 'bg-primary/10' },
    { label: 'Efectivo',        value: totals.byCash,     icon: Banknote,      color: 'text-green-400',    bgColor: 'bg-green-500/10' },
    { label: 'Transferencia',   value: totals.byTransfer, icon: ArrowLeftRight,color: 'text-blue-400',     bgColor: 'bg-blue-500/10' },
    { label: 'Débito',          value: totals.byCard,     icon: Building2,     color: 'text-purple-400',   bgColor: 'bg-purple-500/10' },
  ]

  return (
    <motion.div {...pageVariants} className="space-y-4 lg:space-y-6 xl:space-y-8 pb-6 lg:pb-10 relative z-10">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
        <div>
          <h1 className="text-2xl lg:text-3xl xl:text-4xl font-black tracking-tighter text-gray-900 dark:text-white drop-shadow-sm">Pagos</h1>
          <p className="mt-2 text-sm font-semibold text-gray-500 dark:text-gray-400">Gestioná los ingresos y planes del gimnasio</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center rounded-full border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-xl p-1 shadow-sm gap-1 shrink-0">
            {(['list', 'grid'] as const).map((mode) => {
              const isActive = viewMode === mode
              return (
                <motion.button key={mode} onClick={() => setViewMode(mode)} whileTap={{ scale: 0.94 }}
                  title={mode === 'list' ? 'Vista lista' : 'Vista grilla'}
                  className={`relative inline-flex items-center justify-center rounded-full px-4 py-1.5 text-xs font-bold transition-colors duration-150 cursor-pointer ${isActive ? 'text-white dark:text-gray-900' : 'text-gray-500 dark:text-[#8A8A9A] hover:text-gray-900 dark:hover:text-white'}`}
                >
                  {isActive && <motion.div layoutId="payments-view-pill" className="absolute inset-0 rounded-full bg-gray-900 dark:bg-white shadow-[0_2px_8px_rgba(0,0,0,0.15)]" style={{ zIndex: 0 }} transition={{ type: 'spring', stiffness: 400, damping: 35 }} />}
                  <span className="relative z-10 flex items-center justify-center">
                    {mode === 'list' ? <LayoutList size={14} /> : <LayoutGrid size={14} />}
                  </span>
                </motion.button>
              )
            })}
          </div>
          {can('payments', 'create') && (
            <button
              onClick={() => navigate(ROUTES.PAYMENT_NEW)}
              className="flex items-center gap-2 rounded-xl btn-action px-4 py-2.5 text-sm"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-gray-900/10">
                <Plus size={13} strokeWidth={2.5} />
              </span>
              Nuevo pago
            </button>
          )}
        </div>
      </div>

      {/* ── KPI strip — solo Administrador ── */}
      {isAdmin && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4 xl:gap-6">
          {summaryCards.map(card => (
            <KpiCard key={card.label} label={card.label} value={formatCurrency(card.value)}
              icon={card.icon} iconColor={card.color} iconBg={card.bgColor} isLoading={!summaryData} />
          ))}
        </div>
      )}

      {/* ── Barra de filtros ── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">

        {/* Búsqueda cliente */}
        <div className="relative sm:w-52">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 z-10 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar cliente..."
            value={searchFilter}
            onChange={e => setSearchFilter(e.target.value)}
            className="w-full rounded-xl border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-xl pl-10 pr-4 py-2 text-xs font-semibold text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none h-10"
          />
        </div>

        {/* Filtros derecha */}
        <div className="flex flex-wrap items-end gap-3">

        {/* Período */}
        <div className="flex items-end gap-2">
          {periodMode !== 'all' && (
            <div className="flex items-center rounded-full border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-xl p-1 shadow-sm gap-1 shrink-0">
              <button onClick={goNavBack} className="flex h-7 w-7 items-center justify-center rounded-full text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white/40 dark:hover:bg-white/[0.05] transition-all cursor-pointer">
                <ChevronLeft size={14} />
              </button>
              <span className="px-2 text-xs font-bold text-gray-800 dark:text-gray-200 tabular-nums whitespace-nowrap">{periodLabel}</span>
              <button onClick={goNavForward} disabled={isAtPresent} className="flex h-7 w-7 items-center justify-center rounded-full text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white/40 dark:hover:bg-white/[0.05] transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer">
                <ChevronRight size={14} />
              </button>
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 px-1">Período</span>
            <div className="flex items-center rounded-full border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-xl p-1 shadow-sm gap-1 shrink-0">
              {([['day', 'Hoy'], ['month', 'Mes'], ['year', 'Año'], ['all', 'Histórico']] as [PeriodMode, string][]).map(([m, lbl]) => {
                const isActive = periodMode === m
                return (
                  <motion.button key={m} onClick={() => { setPeriodMode(m); setNavDate(today) }} whileTap={{ scale: 0.94 }}
                    className={`relative inline-flex items-center justify-center rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors duration-150 cursor-pointer ${isActive ? 'text-white dark:text-gray-900' : 'text-gray-500 dark:text-[#8A8A9A] hover:text-gray-900 dark:hover:text-white'}`}
                  >
                    {isActive && <motion.div layoutId="payments-period-pill" className="absolute inset-0 rounded-full bg-gray-900 dark:bg-white shadow-[0_2px_8px_rgba(0,0,0,0.15)]" style={{ zIndex: 0 }} transition={{ type: 'spring', stiffness: 400, damping: 35 }} />}
                    <span className="relative z-10">{lbl}</span>
                  </motion.button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Método */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 px-1">Método</span>
          <div className="flex items-center rounded-full border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-xl p-1 shadow-sm gap-1 shrink-0">
            {([['all', 'Todos'], ['cash', 'Efectivo'], ['transfer', 'Transf.'], ['card', 'Débito']] as [MethodFilter, string][]).map(([val, lbl]) => {
              const isActive = methodFilter === val
              return (
                <motion.button key={val} onClick={() => setMethodFilter(val)} whileTap={{ scale: 0.94 }}
                  className={`relative inline-flex items-center justify-center rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors duration-150 cursor-pointer ${isActive ? 'text-white dark:text-gray-900' : 'text-gray-500 dark:text-[#8A8A9A] hover:text-gray-900 dark:hover:text-white'}`}
                >
                  {isActive && <motion.div layoutId="payments-method-pill" className="absolute inset-0 rounded-full bg-gray-900 dark:bg-white shadow-[0_2px_8px_rgba(0,0,0,0.15)]" style={{ zIndex: 0 }} transition={{ type: 'spring', stiffness: 400, damping: 35 }} />}
                  <span className="relative z-10">{lbl}</span>
                </motion.button>
              )
            })}
          </div>
        </div>

        {/* Facturación */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 px-1">Facturación</span>
          <div className="flex items-center rounded-full border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-xl p-1 shadow-sm gap-1 shrink-0">
            {([['all', 'Todos'], ['yes', 'Facturado'], ['no', 'Sin factura']] as ['all' | 'yes' | 'no', string][]).map(([val, lbl]) => {
              const isActive = invoicedFilter === val
              return (
                <motion.button key={val} onClick={() => setInvoicedFilter(val)} whileTap={{ scale: 0.94 }}
                  className={`relative inline-flex items-center justify-center rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors duration-150 cursor-pointer ${isActive ? 'text-white dark:text-gray-900' : 'text-gray-500 dark:text-[#8A8A9A] hover:text-gray-900 dark:hover:text-white'}`}
                >
                  {isActive && <motion.div layoutId="payments-invoiced-pill" className="absolute inset-0 rounded-full bg-gray-900 dark:bg-white shadow-[0_2px_8px_rgba(0,0,0,0.15)]" style={{ zIndex: 0 }} transition={{ type: 'spring', stiffness: 400, damping: 35 }} />}
                  <span className="relative z-10">{lbl}</span>
                </motion.button>
              )
            })}
          </div>
        </div>

        {/* Contador */}
        </div>{/* fin filtros derecha */}
      </div>

      {/* ── Vista Lista ── */}
      {viewMode === 'list' && (<>
        {/* Mobile cards */}
        <div className="md:hidden space-y-2.5">
          {isLoading ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-[80px] rounded-2xl" />)
            : error ? (
              <div className="py-12 flex flex-col items-center gap-3 text-center">
                <p className="text-sm font-bold text-red-500">Error al cargar los pagos.</p>
                <button onClick={refetch} className="text-xs font-bold text-red-400 underline">Reintentar</button>
              </div>
            ) : filtered.length === 0 ? (
              <p className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">No hay pagos con los filtros actuales</p>
            ) : filtered.map(p => {
              const MethodIcon = METHOD_ICONS[p.method] ?? CreditCard
              return (
                <div key={p.id} onClick={() => navigate(`/payments/${p.id}`)}
                  className="group flex items-center gap-3 rounded-2xl border border-white/50 dark:border-white/10 bg-white/60 dark:bg-black/40 backdrop-blur-xl px-4 py-3.5 shadow-sm cursor-pointer hover:bg-white/80 dark:hover:bg-black/60 transition-colors">
                  <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 shadow-inner">
                    <span className="text-[11px] font-black text-primary leading-none">{p.clientName.charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-gray-900 dark:text-white truncate leading-tight">{p.clientName}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <MethodIcon size={11} className="text-gray-400 dark:text-[#8A8A9A] shrink-0" />
                      <span className="text-[11px] font-semibold text-gray-600 dark:text-gray-300">{METHOD_LABELS[p.method]}</span>
                      <span className="text-[11px] text-gray-300 dark:text-[#8A8A9A]">·</span>
                      <span className="text-[11px] text-gray-400 dark:text-[#8A8A9A]">{formatDate(p.paidAt)}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 tabular-nums">{formatCurrency(p.amount)}</span>
                    <button
                      onClick={e => { e.stopPropagation(); if (!togglingIds.has(p.id)) toggleInvoiced(p) }}
                      disabled={togglingIds.has(p.id)}
                      title={p.invoiced ? 'Quitar facturado' : 'Marcar como facturado'}
                      className="flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors duration-200 ${p.invoiced ? 'bg-emerald-500' : 'bg-gray-200 dark:bg-white/20'}`}>
                        <span className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow-md transition-transform duration-200 ${p.invoiced ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                      </span>
                      <span className={`text-[10px] font-bold ${p.invoiced ? 'text-emerald-500 dark:text-emerald-400' : 'text-gray-400 dark:text-[#8A8A9A]'}`}>
                        {p.invoiced ? 'Facturado' : 'Sin factura'}
                      </span>
                    </button>
                  </div>
                  {can('payments', 'delete') && (<button onClick={e => { e.stopPropagation(); setDeletePaymentTarget(p.id) }}
                    className="rounded-xl p-2 text-gray-400 dark:text-gray-600 opacity-0 group-hover:opacity-100 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 transition-all">
                    <Trash2 size={14} />
                  </button>)}
                </div>
              )
            })}
        </div>

        {/* Desktop tabla */}
        <div className="hidden md:block overflow-x-auto rounded-[2rem] border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-3xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
          {isLoading ? (
            <div className="p-8 space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-[54px] w-full rounded-2xl" />)}</div>
          ) : error ? (
            <div className="px-6 py-16 flex flex-col items-center gap-4 text-center">
              <p className="text-sm font-bold text-red-500">Error al cargar los pagos. Intentá de nuevo.</p>
              <button onClick={refetch} className="text-xs font-bold text-red-400 underline hover:text-red-300 transition-colors">Reintentar</button>
            </div>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-white/20 dark:border-white/10 bg-gray-50/30 dark:bg-black/10">
                  {(['clientName', 'amount', 'paidAt', 'invoiced'] as const).map((key, idx) => (
                    <th
                      key={key}
                      onClick={() => togglePaySort(key)}
                      className="px-6 py-4 text-left text-xs font-extrabold uppercase tracking-widest text-gray-500 dark:text-gray-400 cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                    >
                      <div className="flex items-center gap-1.5">
                        {['Cliente', 'Importe', 'Método · Fecha', 'Estado'][idx]}
                        <PaySortIcon active={paySortKey === key} dir={paySortDir} />
                      </div>
                    </th>
                  ))}
                  <th className="w-14 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/20 dark:divide-white/10">
                {sortedFiltered.length === 0 ? (
                  <tr><td colSpan={5} className="px-6 py-16 text-center text-gray-500 dark:text-gray-400 font-medium">No se encontraron pagos con los filtros actuales</td></tr>
                ) : sortedFiltered.map(p => {
                  const MethodIcon = METHOD_ICONS[p.method] ?? CreditCard
                  return (
                    <tr key={p.id} onClick={() => navigate(`/payments/${p.id}`)}
                      className="group cursor-pointer transition-colors hover:bg-white/40 dark:hover:bg-white/[0.04]">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 shadow-inner">
                            <span className="text-[11px] font-black text-primary leading-none">{p.clientName.charAt(0).toUpperCase()}</span>
                          </div>
                          <span className="font-bold text-gray-900 dark:text-white">{p.clientName}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-base font-black tabular-nums text-emerald-600 dark:text-emerald-400">{formatCurrency(p.amount)}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1.5">
                            <MethodIcon size={12} className="text-gray-400 dark:text-[#8A8A9A] shrink-0" />
                            <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">{METHOD_LABELS[p.method] ?? p.method}</span>
                          </div>
                          <span className="text-[11px] text-gray-400 dark:text-[#8A8A9A] pl-[1.1rem]">{formatDate(p.paidAt)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={e => { e.stopPropagation(); if (!togglingIds.has(p.id)) toggleInvoiced(p) }}
                          disabled={togglingIds.has(p.id)}
                          title={p.invoiced ? 'Quitar facturado' : 'Marcar como facturado'}
                          className="flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-75 transition-opacity active:scale-95"
                        >
                          <span className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 ${p.invoiced ? 'bg-emerald-500' : 'bg-gray-200 dark:bg-white/20'}`}>
                            <span className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-md transition-transform duration-200 ${p.invoiced ? 'translate-x-4' : 'translate-x-0.5'}`} />
                          </span>
                          <span className={`text-[11px] font-bold ${p.invoiced ? 'text-emerald-500 dark:text-emerald-400' : 'text-gray-400 dark:text-[#8A8A9A]'}`}>
                            {p.invoiced ? 'Facturado' : 'Sin factura'}
                          </span>
                        </button>
                      </td>
                      <td className="px-4 py-4 text-right">
                        {can('payments', 'delete') && (<button onClick={e => { e.stopPropagation(); setDeletePaymentTarget(p.id) }}
                          className="rounded-xl p-2 text-gray-400 dark:text-gray-600 opacity-0 group-hover:opacity-100 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 transition-all duration-200">
                          <Trash2 size={15} />
                        </button>)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </>)}

      {/* ── Vista Grid ── */}
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
            <motion.div
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
              variants={staggerContainerFast}
              initial="initial"
              animate="animate"
            >
              {filtered.map(p => {
                const MethodIcon = METHOD_ICONS[p.method] ?? CreditCard
                return (
                  <motion.div key={p.id} variants={fadeUpItem}
                    whileHover={{ y: -3 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => navigate(`/payments/${p.id}`)}
                    className="group relative rounded-2xl border border-white/50 dark:border-white/10 bg-white/60 dark:bg-black/40 backdrop-blur-xl p-5 shadow-sm hover:shadow-md transition-shadow duration-200 cursor-pointer">
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
                      {can('payments', 'delete') && (<button onClick={e => { e.stopPropagation(); setDeletePaymentTarget(p.id) }}
                        className="rounded-lg p-1.5 text-gray-300 dark:text-gray-600 opacity-0 group-hover:opacity-100 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 transition-all">
                        <Trash2 size={13} />
                      </button>)}
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">{formatCurrency(p.amount)}</span>
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center rounded-lg border border-white/50 dark:border-white/10 bg-white/60 dark:bg-white/5 px-2.5 py-1 text-[11px] font-bold text-gray-700 dark:text-gray-300">
                          {METHOD_LABELS[p.method] ?? p.method}
                        </span>
                        <button
                          onClick={e => { e.stopPropagation(); if (!togglingIds.has(p.id)) toggleInvoiced(p) }}
                          disabled={togglingIds.has(p.id)}
                          title={p.invoiced ? 'Quitar facturado' : 'Marcar como facturado'}
                          className="flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-75 transition-opacity active:scale-95"
                        >
                          <span className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 ${p.invoiced ? 'bg-emerald-500' : 'bg-gray-200 dark:bg-white/20'}`}>
                            <span className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-md transition-transform duration-200 ${p.invoiced ? 'translate-x-4' : 'translate-x-0.5'}`} />
                          </span>
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </motion.div>
          )}
        </div>
      )}

      {/* ── Paginación (solo si hay más de una página) ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-4 pt-2">
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 tabular-nums">
            Página {currentPage} de {totalPages} · {serverTotal} pagos en total
          </span>
          <div className="flex items-center rounded-full border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-xl p-1 gap-1">
            <button
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage <= 1}
              className="flex h-7 w-7 items-center justify-center rounded-full text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white/40 dark:hover:bg-white/[0.05] transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronLeft size={14} />
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const pg = totalPages <= 5 ? i + 1 : currentPage <= 3 ? i + 1 : currentPage >= totalPages - 2 ? totalPages - 4 + i : currentPage - 2 + i
              return (
                <button
                  key={pg}
                  onClick={() => goToPage(pg)}
                  className={`relative flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all cursor-pointer ${
                    pg === currentPage
                      ? 'text-white dark:text-gray-900'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white/40 dark:hover:bg-white/[0.05]'
                  }`}
                >
                  {pg === currentPage && (
                    <div className="absolute inset-0 rounded-full bg-gray-900 dark:bg-white" style={{ zIndex: 0 }} />
                  )}
                  <span className="relative z-10">{pg}</span>
                </button>
              )
            })}
            <button
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage >= totalPages}
              className="flex h-7 w-7 items-center justify-center rounded-full text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white/40 dark:hover:bg-white/[0.05] transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* ── Spacer ── */}
      <div className="min-h-[8vh] lg:min-h-[14vh] xl:min-h-[20vh]" />

      {/* ══ SECCIÓN PLANES ══ */}
      <div className="space-y-4 lg:space-y-6 pt-6 lg:pt-8 border-t border-gray-100 dark:border-white/[0.07]">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-black tracking-tighter text-gray-900 dark:text-white drop-shadow-sm">
              Planes y precios
            </h2>
          </div>
          {can('memberships', 'create') && (
            <button
              onClick={openCreatePlan}
              className="flex items-center gap-2 rounded-xl btn-action px-4 py-2.5 text-sm"
            >
              <Plus size={13} strokeWidth={2.5} />
              Nuevo plan
            </button>
          )}
        </div>

        {plansError && (
          <div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3">
            <span className="text-sm text-red-400">{plansError}</span>
            <button onClick={refetchPlans} className="ml-auto text-xs text-red-400 underline">Reintentar</button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 lg:gap-6 md:grid-cols-2 lg:grid-cols-3">
          {plansLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-[2rem] border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-3xl p-6">
                <div className="flex items-center gap-3 mb-5">
                  <Skeleton className="h-10 w-10 rounded-2xl" />
                  <div className="space-y-2"><Skeleton className="h-4 w-36" /><Skeleton className="h-3 w-24" /></div>
                </div>
                <Skeleton className="h-3 w-28 mb-4" />
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, j) => (
                    <div key={j} className="flex justify-between items-center py-1">
                      <Skeleton className="h-3.5 w-40" /><Skeleton className="h-4 w-24" />
                    </div>
                  ))}
                </div>
              </div>
            ))
          ) : plans.length === 0 ? (
            <div className="col-span-full py-16 text-center text-gray-500 dark:text-gray-400 font-medium">
              No hay planes registrados. Creá el primero con el botón "Nuevo plan".
            </div>
          ) : plans.map(plan => (
            <PlanCard key={plan.id} plan={plan} onDelete={deletePlan} onRefresh={refetchPlans} />
          ))}
        </div>
      </div>

      {/* ── Modal crear plan ── */}
      <Modal isOpen={planModalOpen} onClose={closePlanModal} title="Nuevo plan" size="sm">
        <form onSubmit={planHandleSubmit(onPlanSubmit)} className="space-y-4">
          <Input label="Nombre del plan *" placeholder="Ej: 3 veces por semana" error={planErrors.name?.message} {...planRegister('name')} />
          <div>
            <label className={labelCls}>Sesiones por semana *</label>
            <select className={inputCls} {...planRegister('classesPerWeek')}>
              <option value="2">2 veces por semana</option>
              <option value="3">3 veces por semana</option>
              <option value="5">Full (4 o 5 veces por semana)</option>
            </select>
          </div>
          <Input label="Descripción (opcional)" error={planErrors.description?.message} {...planRegister('description')} />
          <p className="text-xs text-gray-400 dark:text-[#8A8A9A] leading-relaxed">
            Una vez creado, configurá los precios por modalidad directamente en la card.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={closePlanModal}>Cancelar</Button>
            <Button type="submit" isLoading={planSubmitting}>Crear plan</Button>
          </div>
        </form>
      </Modal>


      <ConfirmDialog
        isOpen={deletePaymentTarget !== null}
        title="Eliminar pago"
        message="Esta acción no se puede deshacer. El registro quedará eliminado permanentemente."
        confirmLabel="Eliminar"
        onConfirm={() => deletePaymentTarget !== null && deletePayment(deletePaymentTarget)}
        onClose={() => setDeletePaymentTarget(null)}
      />
      <ConfirmDialog
        isOpen={deletePlanTarget !== null}
        title={`Eliminar plan "${deletePlanTarget?.name ?? ''}"`}
        message="Los clientes con este plan asignado quedarán sin plan. Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        isLoading={isDeletingPlan}
        onConfirm={confirmDeletePlan}
        onClose={() => setDeletePlanTarget(null)}
      />
    </motion.div>
  )
}
