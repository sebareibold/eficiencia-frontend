import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { pageVariants } from '../lib/motion'
import {
  ArrowLeft, Banknote, ArrowLeftRight, CreditCard,
  User, Search, X, CheckCircle2, Loader2, UserPlus,
  Check, AlertCircle, Phone, Calendar, Shield,
} from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format } from 'date-fns'
import { paymentsApi } from '../api/payments.api'
import { clientsApi } from '../api/clients.api'
import { membresiasClienteApi } from '../api/membresiasCliente.api'
import { membershipsApi } from '../api/memberships.api'
import { useUiStore } from '../store/uiStore'
import { ROUTES } from '../constants/routes'
import { MODALIDAD_LABELS } from '../types/membership.types'
import type { MembresiaCliente, Plan, Modalidad } from '../types/membership.types'
import type { Client } from '../types/client.types'

// ── Schemas ───────────────────────────────────────────────────────────────────

const newClientSchema = z.object({
  name:                z.string().min(1, 'Requerido'),
  lastName:            z.string().min(1, 'Requerido'),
  phone:               z.string().optional(),
  email:               z.string().email('Email inválido').optional().or(z.literal('')),
  fechaNacimiento:     z.string().optional(),
  cuil:                z.string().optional(),
  responsableContacto: z.string().optional(),
})

function esMenorDeEdad(fecha: string): boolean {
  if (!fecha) return false
  const [y, m, d] = fecha.split('-').map(Number)
  if (!y || !m || !d) return false
  const hoy = new Date()
  const diffM = hoy.getMonth() + 1 - m
  const ajuste = diffM < 0 || (diffM === 0 && hoy.getDate() < d) ? 1 : 0
  return hoy.getFullYear() - y - ajuste < 18
}
type NewClientValues = z.infer<typeof newClientSchema>

const paymentSchema = z.object({
  amount:   z.string().min(1, 'Requerido').refine(v => !isNaN(Number(v)) && Number(v) >= 0, 'Debe ser 0 o mayor'),
  method:   z.enum(['cash', 'transfer', 'card']),
  paidAt:   z.string().min(1, 'Requerido'),
  invoiced: z.boolean().optional(),
  notes:    z.string().optional(),
})
type PaymentValues = z.infer<typeof paymentSchema>

// ── Constantes ────────────────────────────────────────────────────────────────

const STEPS = [
  { id: 1 as const, label: 'Cliente' },
  { id: 2 as const, label: 'Pago'    },
]

const STEP_META: Record<number, { Icon: typeof User; title: string; description: string }> = {
  1: { Icon: User,    title: '¿Quién realizó el pago?', description: 'Buscá un cliente existente o creá uno nuevo en el momento' },
  2: { Icon: Banknote, title: 'Detalles del pago',      description: 'Monto, método, membresía vinculada y fecha' },
}

const METHOD_OPTIONS = [
  { value: 'cash'     as const, label: 'Efectivo',      Icon: Banknote,       color: 'text-emerald-600 dark:text-emerald-400', activeBg: 'bg-emerald-500/10', activeBorder: 'border-emerald-500/40' },
  { value: 'transfer' as const, label: 'Transferencia', Icon: ArrowLeftRight, color: 'text-blue-600 dark:text-blue-400',       activeBg: 'bg-blue-500/10',    activeBorder: 'border-blue-500/40'    },
  { value: 'card'     as const, label: 'Débito',        Icon: CreditCard,     color: 'text-violet-600 dark:text-violet-400',   activeBg: 'bg-violet-500/10',  activeBorder: 'border-violet-500/40'  },
]

const MODALIDAD_MESES: Record<string, number> = {
  TRANSFERENCIA_MENSUAL: 1,
  EFECTIVO:              1,
  MEMBRESIA_3_MESES:     3,
  MEMBRESIA_6_MESES:     6,
}

function metodoPagoToMethod(metodoPago: string): 'cash' | 'transfer' | 'card' {
  if (metodoPago === 'EFECTIVO') return 'cash'
  if (metodoPago === 'TRANSFERENCIA') return 'transfer'
  return 'card' // DEBITO, EMPRESA
}

// ── Estilos compartidos ───────────────────────────────────────────────────────

const ic = (withIcon = false) => [
  'w-full rounded-xl py-3 text-sm transition-all duration-200',
  withIcon ? 'pl-10 pr-4' : 'px-4',
  'bg-gray-50 dark:bg-white/[0.05]',
  'border border-gray-200 dark:border-white/[0.08]',
  'text-gray-900 dark:text-white',
  'placeholder:text-gray-400 dark:placeholder:text-white/30',
  'focus:outline-none focus:bg-white dark:focus:bg-white/[0.08]',
  'focus:border-primary/50 dark:focus:border-primary/40',
  'focus:ring-2 focus:ring-primary/10',
  'hover:border-gray-300 dark:hover:border-white/[0.14]',
].join(' ')

// ── Componente ────────────────────────────────────────────────────────────────

export default function PaymentNewPage() {
  const navigate       = useNavigate()
  const [searchParams] = useSearchParams()
  const queryClient    = useQueryClient()
  const addToast       = useUiStore(s => s.addToast)
  const today          = format(new Date(), 'yyyy-MM-dd')

  // ── Paso activo ───────────────────────────────────────────────────────────
  const [step, setStep] = useState<1 | 2>(1)

  // ── Paso 1: cliente ───────────────────────────────────────────────────────
  const [clientQuery,      setClientQuery]      = useState('')
  const [clientResults,    setClientResults]    = useState<Client[]>([])
  const [loadingSearch,    setLoadingSearch]    = useState(false)
  const [selectedClient,   setSelectedClient]   = useState<Client | null>(null)
  const [pendingNewClient, setPendingNewClient] = useState<NewClientValues | null>(null)
  const [showNewClient,    setShowNewClient]    = useState(false)

  const {
    register: regClient,
    handleSubmit: submitClient,
    formState: { errors: clientErrors },
    reset: resetClient,
    watch: watchClient,
  } = useForm<NewClientValues>({ resolver: zodResolver(newClientSchema) })
  const watchFecha = watchClient('fechaNacimiento') ?? ''
  const esMenor = esMenorDeEdad(watchFecha)

  // ── Paso 2: pago ──────────────────────────────────────────────────────────
  const [membresias,  setMembresias]  = useState<MembresiaCliente[]>([])
  const [loadingMemb, setLoadingMemb] = useState(false)
  const [membresiaId,    setMembresiaId]    = useState('')
  const [displayAmount,  setDisplayAmount]  = useState('')
  const [submitting,     setSubmitting]     = useState(false)
  const [submitError,    setSubmitError]    = useState<string | null>(null)

  // ── Selección de plan / modalidad (Step 2) ───────────────────────────────
  const [plans,             setPlans]             = useState<Plan[]>([])
  const [loadingPlans,      setLoadingPlans]      = useState(false)
  const [selectedPlanId,    setSelectedPlanId]    = useState('')
  const [selectedModalidad, setSelectedModalidad] = useState<Modalidad | ''>('')

  const [aplicarProporcional, setAplicarProporcional] = useState(false)
  const [reactivarCliente,   setReactivarCliente]   = useState(true)

  const {
    register: regPay,
    handleSubmit: submitPay,
    formState: { errors: payErrors },
    watch,
    setValue,
    getValues,
  } = useForm<PaymentValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { method: 'transfer', paidAt: today, invoiced: false },
  })
  const watchedMethod  = watch('method')
  const watchedPaidAt  = watch('paidAt')

  const descuentoEstimado = useMemo(() => {
    if (!selectedModalidad || !displayAmount) return 0
    const cuota = Number(displayAmount.replace(/\./g, '')) || 0
    if (cuota === 0) return 0
    const date = new Date((watchedPaidAt || today) + 'T12:00:00')
    const day = date.getDate()
    const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
    return Math.round(cuota * (day - 1) / daysInMonth)
  }, [selectedModalidad, displayAmount, watchedPaidAt, today])

  // ── Pre-fill cliente desde ?clienteId= ───────────────────────────────────
  useEffect(() => {
    const id = searchParams.get('clienteId')
    if (!id) return
    clientsApi.getById(id).then(c => pickClient(c)).catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Búsqueda de clientes con debounce ────────────────────────────────────
  const searchClients = useCallback(async (q: string) => {
    if (!q.trim()) { setClientResults([]); return }
    setLoadingSearch(true)
    try {
      const r = await clientsApi.getAll({ search: q, limit: 8, page: 1 })
      setClientResults(r.data)
    } catch { setClientResults([]) }
    finally { setLoadingSearch(false) }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => searchClients(clientQuery), 120)
    return () => clearTimeout(t)
  }, [clientQuery, searchClients])

  // ── Cargar planes al entrar al Step 2 ────────────────────────────────────
  useEffect(() => {
    if (step !== 2 || plans.length > 0) return
    setLoadingPlans(true)
    membershipsApi.getAll().then(setPlans).catch(() => {}).finally(() => setLoadingPlans(false))
  }, [step]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Seleccionar cliente y avanzar al paso 2 ───────────────────────────────
  function pickClient(c: Client) {
    setSelectedClient(c)
    setClientQuery('')
    setClientResults([])
    setShowNewClient(false)
    resetClient()
    setLoadingMemb(true)
    membresiasClienteApi.getAll(String(c.id))
      .then(m => {
        const sorted = [...m].sort((a, b) => b.fechaInicio.localeCompare(a.fechaInicio))
        setMembresias(sorted)
        setMembresiaId('')
      })
      .finally(() => setLoadingMemb(false))
    setStep(2)
  }

  function backToStep1() {
    setStep(1)
    setSelectedClient(null)
    setPendingNewClient(null)
    setMembresias([])
    setMembresiaId('')
    setSubmitError(null)
    setShowNewClient(false)
    resetClient()
    setSelectedPlanId('')
    setSelectedModalidad('')
    setDisplayAmount('')
  }

  // ── Crear cliente inline — solo guarda datos, la API se llama al confirmar el pago ──
  function onCreateClient(data: NewClientValues) {
    setPendingNewClient(data)
    setMembresias([])
    setMembresiaId('')
    setShowNewClient(false)
    resetClient()
    setStep(2)
  }

  // ── Seleccionar plan ──────────────────────────────────────────────────────
  function handleSelectPlan(planId: string) {
    setSelectedPlanId(planId)
    setSelectedModalidad('')
    setDisplayAmount('')
    setValue('amount', '', { shouldValidate: false })
    setMembresiaId('')
  }

  // ── Seleccionar modalidad → auto-llenar monto y vincular membresía ────────
  function handleSelectModalidad(modalidad: Modalidad, precio: number) {
    setSelectedModalidad(modalidad)
    const effectivePrecio = selectedClient?.exentoDePago ? 0 : precio
    const raw = String(effectivePrecio)
    setDisplayAmount(Number(raw).toLocaleString('es-AR'))
    setValue('amount', raw, { shouldValidate: true })
    const plan = plans.find(p => p.id === selectedPlanId)
    const tarifa = plan?.tarifas.find(t => t.modalidad === modalidad)
    setValue('method', tarifa ? metodoPagoToMethod(tarifa.metodoPago) : 'transfer', { shouldValidate: true })
    // Vincular membresías vigentes (ACTIVA o PENDIENTE por bug histórico)
    const match = membresias.find(
      m => m.planId === selectedPlanId && m.modalidad === modalidad &&
           (m.estado === 'ACTIVA' || m.estado === 'PENDIENTE') &&
           m.fechaVencimiento.slice(0, 10) >= today
    )
    setMembresiaId(match?.id ?? '')
    // Auto-activar proporcional si el pago es después del día 15
    const paidAt = getValues('paidAt') || today
    const day = new Date(paidAt + 'T12:00:00').getDate()
    setAplicarProporcional(day >= 16)
  }

  // ── Registrar pago ────────────────────────────────────────────────────────
  async function onSubmitPayment(data: PaymentValues) {
    if (!selectedClient && !pendingNewClient) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      // Si es cliente nuevo, crearlo ahora antes de cualquier otra cosa
      let clientId: string
      if (selectedClient) {
        clientId = String(selectedClient.id)
      } else {
        const created = await clientsApi.create({
          name:                pendingNewClient!.name,
          lastName:            pendingNewClient!.lastName,
          phone:               pendingNewClient!.phone               || undefined,
          email:               pendingNewClient!.email               || undefined,
          cuil:                pendingNewClient!.cuil                || undefined,
          fechaNacimiento:     pendingNewClient!.fechaNacimiento      || undefined,
          responsableContacto: pendingNewClient!.responsableContacto || undefined,
        })
        clientId = String(created.id)
        addToast(`Cliente ${created.name} ${created.lastName} creado`, 'success')
        queryClient.invalidateQueries({ queryKey: ['clients'] })
      }

      let finalMembresiaId = membresiaId

      // Crear nueva membresía si no hay una vigente para ese plan+modalidad.
      // Acepta PENDIENTE por compatibilidad con membresías creadas antes del fix del backend.
      const tieneVigente = membresias.some(
        m => m.planId === selectedPlanId && m.modalidad === selectedModalidad &&
             (m.estado === 'ACTIVA' || m.estado === 'PENDIENTE') &&
             m.fechaVencimiento.slice(0, 10) >= today
      )
      let esNuevaMembresia = false
      if (selectedPlanId && selectedModalidad && !tieneVigente) {
        const nueva = await membresiasClienteApi.create({
          clienteId: clientId,
          planId: selectedPlanId,
          modalidad: selectedModalidad as Modalidad,
          precio: Number(data.amount),
          fechaInicio: data.paidAt,
          ...(aplicarProporcional && descuentoEstimado > 0 && {
            descuentoProporcional: descuentoEstimado,
          }),
        })
        finalMembresiaId = nueva.id
        esNuevaMembresia = true
      }

      // Calcular cuotaNumero para todos los pagos vinculados a una membresía
      let cuotaNumero: number | undefined = undefined
      if (finalMembresiaId) {
        if (esNuevaMembresia) {
          cuotaNumero = 1
        } else {
          const pagosExistentes = await paymentsApi.getAll({ clientId: clientId, pageSize: 200 })
          const countForMemb = pagosExistentes.data.filter(p => p.membresiaId === finalMembresiaId).length
          cuotaNumero = countForMemb + 1
        }
      }

      const payment = await paymentsApi.create({
        clientId: clientId as unknown as number,
        amount:   Number(data.amount),
        method:   data.method,
        paidAt:   data.paidAt,
        invoiced: data.invoiced,
        notes:    data.notes || undefined,
        ...(finalMembresiaId && { membresiaId: finalMembresiaId }),
        ...(cuotaNumero !== undefined && { cuotaNumero }),
      })
      addToast('Pago registrado', 'success')

      // Reactivar cliente si estaba inactivo y el usuario eligió Sí
      if (reactivarCliente && selectedClient?.activityStatus === 'inactive') {
        await clientsApi.update(clientId, { estado: 'ACTIVO' })
        queryClient.invalidateQueries({ queryKey: ['clients'] })
        addToast(`${selectedClient.name} ${selectedClient.lastName} pasó a activo`, 'success')
      }

      navigate(`/payments/${payment.id}`)
    } catch {
      setSubmitError('Ocurrió un error al registrar el pago. Por favor intentá de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Stepper (mismo estilo que CreateClientPage) ───────────────────────────
  function Stepper() {
    return (
      <div className="flex items-start mb-8">
        {STEPS.map((s, idx) => {
          const done = step > s.id
          const curr = step === s.id
          return (
            <div key={s.id} className="flex-1 flex flex-col items-center relative">
              {/* Línea izquierda */}
              {idx > 0 && (
                <div
                  className="absolute z-10 h-px top-[18px] -translate-y-1/2"
                  style={{
                    left: 0, right: '50%',
                    background: done || curr
                      ? 'linear-gradient(90deg, rgba(251,198,8,0.25), rgba(251,198,8,0.7))'
                      : 'var(--line-inactive)',
                  }}
                />
              )}
              {/* Línea derecha */}
              {idx < STEPS.length - 1 && (
                <div
                  className="absolute z-10 h-px top-[18px] -translate-y-1/2"
                  style={{
                    left: '50%', right: 0,
                    background: done
                      ? 'linear-gradient(90deg, rgba(251,198,8,0.7), rgba(251,198,8,0.25))'
                      : 'var(--line-inactive)',
                  }}
                />
              )}

              {/* Indicador cuadrado */}
              <div
                className={[
                  'relative z-20 flex h-10 w-10 items-center justify-center rounded-xl text-sm font-black [transition:background-color_250ms_ease-out,box-shadow_250ms_ease-out,transform_200ms_ease-out]',
                  curr
                    ? 'bg-primary text-black ring-4 ring-primary/25 shadow-[0_0_24px_rgba(251,198,8,0.45),0_0_48px_rgba(251,198,8,0.18)] scale-110'
                    : done
                      ? 'bg-primary text-black/80 border-2 border-primary/80 shadow-[0_2px_10px_rgba(251,198,8,0.30)]'
                      : 'bg-white dark:bg-[#111] border-2 border-gray-300 dark:border-white/[0.18] text-gray-500 dark:text-white/50 shadow-[0_2px_8px_rgba(0,0,0,0.08)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.4)]',
                ].join(' ')}
              >
                {done ? <Check size={14} strokeWidth={2.5} /> : s.id}
              </div>

              {/* Etiqueta */}
              <div className="mt-2 flex flex-col items-center gap-0.5">
                <span className={[
                  'text-[10px] font-bold uppercase tracking-wider',
                  curr ? 'text-gray-900 dark:text-white'
                    : done ? 'text-primary'
                      : 'text-gray-400 dark:text-[#4A4A5A]',
                ].join(' ')}>
                  {s.label}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // ── Step header (mismo estilo que CreateClientPage) ───────────────────────
  function StepHeader({ stepId }: { stepId: number }) {
    const meta = STEP_META[stepId]
    if (!meta) return null
    return (
      <div className="flex items-center gap-4 mb-6 pb-5 border-b border-gray-100 dark:border-white/[0.05]">
        <div className="shrink-0 h-11 w-11 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 dark:from-primary/10 dark:to-primary/[0.03] flex items-center justify-center border border-primary/20 dark:border-primary/15">
          <meta.Icon size={18} className="text-primary" />
        </div>
        <div>
          <h2 className="text-base font-black text-gray-900 dark:text-white tracking-tight">{meta.title}</h2>
          <p className="text-xs text-gray-500 dark:text-[#6A6A7A] mt-0.5">{meta.description}</p>
        </div>
        <div className="ml-auto shrink-0 text-right">
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-300 dark:text-[#3A3A4A]">
            Paso {stepId}/2
          </span>
        </div>
      </div>
    )
  }

  // ── Contenido Paso 1: seleccionar o crear cliente ─────────────────────────
  function Step1() {
    const showSkeleton = loadingSearch && clientQuery.trim().length > 0
    const showResults  = !loadingSearch && clientResults.length > 0
    const showEmpty    = !loadingSearch && clientQuery.trim().length > 1 && clientResults.length === 0

    return (
      <div className="space-y-3">
        {!showNewClient ? (
          <>
            {/* Input — el ícono cambia a spinner mientras busca */}
            <div className="relative">
              <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-[#5A5A6A] transition-colors duration-200">
                {loadingSearch
                  ? <Loader2 size={14} className="animate-spin" />
                  : <Search size={14} />
                }
              </div>
              <input
                value={clientQuery}
                onChange={e => setClientQuery(e.target.value)}
                placeholder="Buscar cliente por nombre…"
                autoFocus
                className={ic(true)}
              />
            </div>

            {/* Resultados / skeleton / empty — con AnimatePresence para transición suave */}
            <AnimatePresence>

              {/* Skeleton mientras carga */}
              {showSkeleton && (
                <motion.div
                  key="skeleton"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.1 }}
                  className="rounded-2xl border border-gray-200 dark:border-white/[0.08] overflow-hidden divide-y divide-gray-100 dark:divide-white/[0.04]"
                >
                  {[0, 1, 2].map(i => (
                    <div key={i} className="flex items-center gap-3 px-4 py-3"
                      style={{ opacity: 1 - i * 0.2 }}
                    >
                      <div className="h-8 w-8 rounded-xl bg-gray-200 dark:bg-white/[0.07] animate-pulse shrink-0" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-3 rounded bg-gray-200 dark:bg-white/[0.07] animate-pulse" style={{ width: `${55 + i * 15}%` }} />
                        <div className="h-2 rounded bg-gray-100 dark:bg-white/[0.04] animate-pulse" style={{ width: `${30 + i * 10}%` }} />
                      </div>
                    </div>
                  ))}
                </motion.div>
              )}

              {/* Resultados con stagger por ítem */}
              {showResults && (
                <motion.div
                  key="results"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.1 }}
                  className="rounded-2xl border border-gray-200 dark:border-white/[0.08] bg-white/70 dark:bg-black/50 overflow-hidden divide-y divide-gray-100 dark:divide-white/[0.04]"
                >
                  {clientResults.map((c, i) => (
                    <motion.button
                      key={c.id}
                      type="button"
                      onClick={() => pickClient(c)}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.15, delay: i * 0.03, ease: [0.22, 1, 0.36, 1] }}
                      className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left group active:scale-[0.99] [transition:background-color_120ms_ease-out,transform_100ms_ease-out] hover:bg-primary/5"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 text-xs font-black text-primary">
                          {c.name[0]}{c.lastName[0]}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                            {c.name} {c.lastName}
                          </p>
                          {c.planName && (
                            <p className="text-xs text-gray-500 dark:text-[#8A8A9A] truncate">{c.planName}</p>
                          )}
                        </div>
                      </div>
                      <Check size={14} className="text-gray-200 dark:text-[#2A2A3A] group-hover:text-primary shrink-0 transition-colors duration-150" />
                    </motion.button>
                  ))}
                </motion.div>
              )}

              {/* Sin resultados */}
              {showEmpty && (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.1 }}
                  className="rounded-2xl border border-dashed border-gray-200 dark:border-white/[0.08] bg-gray-50/50 dark:bg-white/[0.01] px-4 py-5 space-y-3 text-center"
                >
                  <p className="text-sm text-gray-500 dark:text-[#6A6A7A]">
                    No se encontró "<span className="font-semibold text-gray-700 dark:text-gray-300">{clientQuery}</span>"
                  </p>
                  <button
                    type="button"
                    onClick={() => { setShowNewClient(true); setClientQuery('') }}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 text-sm font-bold transition-all"
                  >
                    <UserPlus size={14} />
                    Crear nuevo cliente
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Hint — fade in/out */}
            <AnimatePresence>
              {!clientQuery && (
                <motion.div
                  key="hint"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-center justify-between pt-1"
                >
                  <p className="text-xs text-gray-400 dark:text-[#5A5A6A]">¿Es un cliente nuevo?</p>
                  <button
                    type="button"
                    onClick={() => setShowNewClient(true)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary-dark transition-colors"
                  >
                    <UserPlus size={12} />
                    Crear cliente
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        ) : (
          /* ── Formulario inline: nuevo cliente ── */
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                <UserPlus size={14} className="text-primary" />
                Datos del nuevo cliente
              </p>
              <button
                type="button"
                onClick={() => { setShowNewClient(false); resetClient() }}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors"
              >
                <X size={12} /> Cancelar
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-[#6A6A7A] flex items-center gap-1">
                  Nombre <span className="text-primary text-[10px]">*</span>
                </label>
                <input {...regClient('name')} placeholder="Juan" autoFocus className={ic()} />
                {clientErrors.name && (
                  <p className="flex items-center gap-1.5 text-xs text-red-500 dark:text-red-400">
                    <AlertCircle size={11} />{clientErrors.name.message}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-[#6A6A7A] flex items-center gap-1">
                  Apellido <span className="text-primary text-[10px]">*</span>
                </label>
                <input {...regClient('lastName')} placeholder="Pérez" className={ic()} />
                {clientErrors.lastName && (
                  <p className="flex items-center gap-1.5 text-xs text-red-500 dark:text-red-400">
                    <AlertCircle size={11} />{clientErrors.lastName.message}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className={`space-y-1.5${esMenor ? ' col-span-2' : ''}`}>
                <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-[#6A6A7A] flex items-center gap-1">
                  Fecha de nacimiento <span className="font-normal normal-case tracking-normal opacity-60 text-[10px]">(opcional)</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    {...regClient('fechaNacimiento')}
                    type="date"
                    max={today}
                    className={ic()}
                  />
                  {watchFecha && (
                    <span className="shrink-0 self-stretch flex items-center px-3 rounded-xl bg-gray-900 dark:bg-white/10 text-white text-xs font-bold whitespace-nowrap">
                      {(() => {
                        const [y, m, d] = watchFecha.split('-').map(Number)
                        const hoy = new Date()
                        const diffM = hoy.getMonth() + 1 - m
                        const ajuste = diffM < 0 || (diffM === 0 && hoy.getDate() < d) ? 1 : 0
                        return `${hoy.getFullYear() - y - ajuste} años`
                      })()}
                    </span>
                  )}
                </div>
              </div>
              {!esMenor && (
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-[#6A6A7A]">
                    CUIL <span className="font-normal normal-case tracking-normal opacity-60 text-[10px]">(opcional)</span>
                  </label>
                  <input {...regClient('cuil')} placeholder="20-12345678-9" className={ic()} />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-[#6A6A7A]">
                  {esMenor ? 'Tel. personal' : 'Teléfono'} <span className="font-normal normal-case tracking-normal opacity-60 text-[10px]">(opcional)</span>
                </label>
                <input {...regClient('phone')} placeholder="1155554444" className={ic()} />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-[#6A6A7A]">
                  Email <span className="font-normal normal-case tracking-normal opacity-60 text-[10px]">(opcional)</span>
                </label>
                <input {...regClient('email')} type="email" placeholder="juan@mail.com" className={ic()} />
                {clientErrors.email && (
                  <p className="flex items-center gap-1.5 text-xs text-red-500 dark:text-red-400">
                    <AlertCircle size={11} />{clientErrors.email.message}
                  </p>
                )}
              </div>
            </div>

            {esMenor && (
              <div className="rounded-xl border border-amber-400/30 bg-amber-400/[0.05] p-3 space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-widest text-amber-500 flex items-center gap-1.5">
                  <Phone size={11} /> Tel. del responsable <span className="font-normal normal-case tracking-normal opacity-60 text-[10px]">(opcional)</span>
                </label>
                <input
                  {...regClient('responsableContacto')}
                  placeholder="1155559999"
                  className={ic()}
                />
              </div>
            )}
          </motion.div>
        )}
      </div>
    )
  }

  // ── Contenido Paso 2: detalles del pago ───────────────────────────────────
  function Step2() {
    const selectedPlan     = plans.find(p => p.id === selectedPlanId)
    // Solo contar como "actual" membresías que son vigentes por fecha real
    const activeMembPlanId = membresias.find(
      m => m.estado === 'ACTIVA' && m.fechaVencimiento.slice(0, 10) >= today
    )?.planId ?? ''

    return (
      <div className="space-y-5">
        {/* Cliente seleccionado / pendiente */}
        {(() => {
          const name = selectedClient
            ? `${selectedClient.name} ${selectedClient.lastName}`
            : `${pendingNewClient?.name} ${pendingNewClient?.lastName}`
          const sub = selectedClient?.planName ?? (pendingNewClient ? 'Nuevo cliente — se creará al confirmar el pago' : '')
          return (
            <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-primary/5 dark:bg-primary/[0.06] border border-primary/20 dark:border-primary/15">
              <div className="h-8 w-8 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                <User size={14} className="text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{name}</p>
                {sub && <p className="text-xs text-gray-500 dark:text-[#6A6A7A] truncate">{sub}</p>}
              </div>
              <button
                type="button"
                onClick={backToStep1}
                className="shrink-0 text-xs font-semibold text-gray-400 hover:text-primary transition-colors"
              >
                Cambiar
              </button>
            </div>
          )
        })()}

        {/* Banner cliente exento */}
        {selectedClient?.exentoDePago && (
          <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-emerald-500/[0.06] border border-emerald-500/20">
            <Shield size={14} className="text-emerald-500 shrink-0 mt-0.5" />
            <p className="text-xs text-emerald-600 dark:text-emerald-400 leading-snug">
              <strong>Cliente exento de pago.</strong> El monto se cargó en $0. Podés modificarlo si realizó un aporte voluntario.
            </p>
          </div>
        )}

        {/* Grid 2 columnas: izquierda = membresía + monto · derecha = método + fecha + notas + facturado */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">

          {/* ── Columna izquierda: membresía → monto ── */}
          <div className="space-y-4">

            {/* Plan cards */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-[#6A6A7A] flex items-center gap-1">
                Plan <span className="text-primary text-[10px]">*</span>
              </label>
              {loadingPlans ? (
                <div className="space-y-2">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="h-14 rounded-xl bg-gray-100 dark:bg-white/[0.04] animate-pulse" style={{ opacity: 1 - i * 0.2 }} />
                  ))}
                </div>
              ) : plans.length === 0 ? (
                <p className="text-xs text-gray-400 py-1">Sin planes configurados.</p>
              ) : (
                <div className="space-y-2">
                  {plans.map(plan => {
                    const isSelected = selectedPlanId === plan.id
                    const isCurrent  = plan.id === activeMembPlanId
                    const minPrice   = plan.tarifas.length > 0
                      ? Math.min(...plan.tarifas.map(t => t.precio))
                      : null
                    return (
                      <button
                        key={plan.id}
                        type="button"
                        onClick={() => handleSelectPlan(plan.id)}
                        className={[
                          'w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border-2 text-left active:scale-[0.98] [transition:background-color_150ms_ease-out,border-color_150ms_ease-out,transform_100ms_ease-out]',
                          isSelected
                            ? 'border-primary bg-primary/10 dark:bg-primary/[0.08]'
                            : 'border-gray-200 dark:border-white/[0.07] bg-white/40 dark:bg-white/[0.02] hover:border-primary/30 dark:hover:border-primary/20',
                        ].join(' ')}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className={`text-sm font-bold truncate ${isSelected ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                              {plan.name}
                            </p>
                            {isCurrent && (
                              <span className="shrink-0 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-primary/20 text-primary">
                                Actual
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 dark:text-[#6A6A7A]">{plan.classesPerWeek}x por semana</p>
                        </div>
                        {minPrice !== null && (
                          <p className={`text-sm font-black shrink-0 ${isSelected ? 'text-primary' : 'text-gray-400 dark:text-[#5A5A6A]'}`}>
                            desde ${minPrice.toLocaleString('es-AR')}
                          </p>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Modalidad cards — aparecen al seleccionar un plan */}
            <AnimatePresence>
              {selectedPlanId && selectedPlan && (
                <motion.div
                  key="modalidad"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                  className="space-y-1.5"
                >
                  <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-[#6A6A7A] flex items-center gap-1">
                    Modalidad <span className="text-primary text-[10px]">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {selectedPlan.tarifas.map(tarifa => {
                      const isActive       = selectedModalidad === tarifa.modalidad
                      const tieneVigBadge  = membresias.some(
                        m => m.planId === selectedPlanId && m.modalidad === tarifa.modalidad &&
                             m.estado === 'ACTIVA' && m.fechaVencimiento.slice(0, 10) >= today
                      )
                      const membVencida = !tieneVigBadge && membresias.find(
                        m => m.planId === selectedPlanId && m.modalidad === tarifa.modalidad &&
                             (m.estado === 'VENCIDA' || (m.estado === 'ACTIVA' && m.fechaVencimiento.slice(0, 10) < today))
                      )
                      return (
                        <button
                          key={tarifa.modalidad}
                          type="button"
                          onClick={() => handleSelectModalidad(tarifa.modalidad, tarifa.precio)}
                          className={[
                            'rounded-xl px-3 py-3 text-left border-2 active:scale-[0.97] [transition:background-color_150ms_ease-out,border-color_150ms_ease-out,color_150ms_ease-out,transform_100ms_ease-out]',
                            isActive
                              ? 'border-primary bg-primary text-gray-900'
                              : 'border-gray-200 dark:border-white/[0.07] bg-white/40 dark:bg-white/[0.02] text-gray-600 dark:text-gray-400 hover:border-primary/30 dark:hover:border-primary/20',
                          ].join(' ')}
                        >
                          <p className="text-[11px] font-bold leading-tight">{MODALIDAD_LABELS[tarifa.modalidad]}</p>
                          <p className={`text-base font-black mt-0.5 ${isActive ? 'text-gray-900' : 'text-gray-900 dark:text-white'}`}>
                            ${tarifa.precio.toLocaleString('es-AR')}
                          </p>
                          {membVencida && (
                            <p className={`text-[10px] font-semibold mt-1 ${isActive ? 'text-gray-700' : 'text-amber-500 dark:text-amber-400'}`}>
                              Vencida — período nuevo
                            </p>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Monto — aparece al seleccionar modalidad, auto-llenado pero editable */}
            <AnimatePresence>
              {selectedModalidad && (
                <motion.div
                  key="monto"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                  className="space-y-1.5"
                >
                  <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-[#6A6A7A] flex items-center gap-1">
                    Monto <span className="text-primary text-[10px]">*</span>
                    <span className="font-normal normal-case tracking-normal opacity-60 text-[10px] ml-1">(editable)</span>
                  </label>
                  <div className="relative">
                    <input type="hidden" {...regPay('amount')} />
                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400 select-none">$</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="0"
                      value={displayAmount}
                      onChange={e => {
                        const raw = e.target.value.replace(/\./g, '').replace(/\D/g, '')
                        const formatted = raw ? Number(raw).toLocaleString('es-AR').replace(/,.*/, '') : ''
                        setDisplayAmount(formatted)
                        setValue('amount', raw, { shouldValidate: true })
                      }}
                      className={`${ic(true)} text-lg font-bold`}
                    />
                  </div>
                  {payErrors.amount && (
                    <p className="flex items-center gap-1.5 text-xs text-red-500 dark:text-red-400">
                      <AlertCircle size={11} />{payErrors.amount.message}
                    </p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>


          </div>

          {/* ── Columna derecha: método + fecha + notas + facturado ── */}
          <div className="space-y-4">

            {/* Método — derivado de la modalidad, solo informativo */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-[#6A6A7A]">
                Método de pago
              </label>
              {(() => {
                const opt = METHOD_OPTIONS.find(o => o.value === watchedMethod)
                if (!opt || !selectedModalidad) return (
                  <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-dashed border-gray-200 dark:border-white/[0.07] text-gray-400 dark:text-[#5A5A6A]">
                    <div className="h-8 w-8 rounded-lg bg-gray-100 dark:bg-white/[0.04] flex items-center justify-center">
                      <Banknote size={15} />
                    </div>
                    <p className="text-xs text-gray-400 dark:text-[#5A5A6A]">Se determina al elegir la modalidad</p>
                  </div>
                )
                return (
                  <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${opt.activeBorder} ${opt.activeBg}`}>
                    <div className={`h-8 w-8 rounded-lg bg-white/50 dark:bg-black/20 flex items-center justify-center ${opt.color}`}>
                      <opt.Icon size={15} />
                    </div>
                    <div>
                      <p className={`text-sm font-bold ${opt.color}`}>{opt.label}</p>
                      <p className="text-[10px] text-gray-400 dark:text-[#6A6A7A]">Definido por la modalidad</p>
                    </div>
                  </div>
                )
              })()}
            </div>

            {/* Fecha */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-[#6A6A7A]">
                Fecha del pago <span className="text-primary text-[10px]">*</span>
              </label>
              <input type="date" {...regPay('paidAt')} className={ic()} />
              <p className="text-xs text-gray-400 dark:text-[#6A6A7A]">
                La fecha de registro se guarda automáticamente (hoy, {format(new Date(), 'dd/MM/yyyy')}). Acá indicá cuándo se efectuó realmente el pago.
              </p>
              {payErrors.paidAt && (
                <p className="flex items-center gap-1.5 text-xs text-red-500 dark:text-red-400">
                  <AlertCircle size={11} />{payErrors.paidAt.message}
                </p>
              )}
            </div>

            {/* Descuento proporcional — siempre visible en columna derecha */}
            {(() => {
              const meses      = MODALIDAD_MESES[selectedModalidad || ''] || 1
              const esMensual  = meses === 1
              const cuota      = Number(displayAmount.replace(/\./g, '')) || 0
              const proxPago   = Math.max(0, cuota - descuentoEstimado)
              const labelTipo  = esMensual ? 'El próximo mes' : `La próxima cuota (cuota 2 de ${meses})`

              const descripcionOn = selectedModalidad && descuentoEstimado > 0
                ? `${labelTipo} pagaría $${proxPago.toLocaleString('es-AR')} (ahorro $${descuentoEstimado.toLocaleString('es-AR')})`
                : selectedModalidad
                  ? `${labelTipo} pagaría $${cuota.toLocaleString('es-AR')} (sin descuento)`
                  : ''

              return (
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-[#6A6A7A]">
                    Proporcional
                  </label>
                  <button
                    type="button"
                    disabled={!selectedModalidad}
                    onClick={() => setAplicarProporcional(v => !v)}
                    className={[
                      'w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border-2 transition-all duration-200',
                      !selectedModalidad
                        ? 'border-gray-100 dark:border-white/[0.04] bg-gray-50/50 dark:bg-white/[0.01] opacity-50 cursor-not-allowed'
                        : aplicarProporcional
                          ? 'border-amber-400/50 bg-amber-500/[0.06] dark:bg-amber-500/[0.05]'
                          : 'border-gray-200 dark:border-white/[0.07] bg-white/40 dark:bg-white/[0.02] hover:border-amber-300/40',
                    ].join(' ')}
                  >
                    <div className="text-left min-w-0">
                      <p className={`text-sm font-bold ${aplicarProporcional && selectedModalidad ? 'text-amber-700 dark:text-amber-400' : 'text-gray-600 dark:text-gray-300'}`}>
                        Descuento por inicio a mitad de mes
                      </p>
                      <p className="text-xs text-gray-500 dark:text-[#6A6A7A] mt-1 leading-relaxed">
                        {!selectedModalidad
                          ? 'Se activa al elegir la modalidad'
                          : aplicarProporcional && descuentoEstimado > 0
                            ? <>
                                <span className="block">Ahora pagaría <strong className="text-gray-700 dark:text-gray-200">${cuota.toLocaleString('es-AR')}</strong></span>
                                <span className="block">{labelTipo} pagaría <strong className="text-amber-700 dark:text-amber-300">${proxPago.toLocaleString('es-AR')}</strong>{' (ahorro $'}{descuentoEstimado.toLocaleString('es-AR')}{' porque arranca a mitad de mes)'}</span>
                              </>
                            : <><span className="block">Sin descuento aplicado</span><span className="block">{labelTipo} pagaría <strong className="text-gray-700 dark:text-gray-200">${cuota.toLocaleString('es-AR')}</strong></span></>
                        }
                      </p>
                    </div>
                    <div className={[
                      'relative shrink-0 h-6 w-11 rounded-full transition-colors duration-200',
                      aplicarProporcional && selectedModalidad ? 'bg-amber-400' : 'bg-gray-300 dark:bg-white/[0.12]',
                    ].join(' ')}>
                      <div className={[
                        'absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200',
                        aplicarProporcional && selectedModalidad ? 'translate-x-5' : 'translate-x-1',
                      ].join(' ')} />
                    </div>
                  </button>
                </div>
              )
            })()}

            {/* Notas */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-[#6A6A7A]">
                Notas{' '}
                <span className="font-normal normal-case tracking-normal opacity-60 text-[10px]">(opcional)</span>
              </label>
              <input
                type="text"
                placeholder="Comprobante, referencia…"
                {...regPay('notes')}
                className={ic()}
              />
            </div>

            {/* Facturado */}
            <label className="flex items-center gap-3 cursor-pointer select-none group pt-1">
              <input
                type="checkbox"
                {...regPay('invoiced')}
                className="h-4 w-4 rounded accent-primary cursor-pointer"
              />
              <div>
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                  Facturado
                </p>
                <p className="text-xs text-gray-400">Comprobante fiscal entregado</p>
              </div>
            </label>

            {/* Reactivar cliente — solo si está inactivo */}
            {selectedClient?.activityStatus === 'inactive' && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-[#6A6A7A]">Alerta</p>
                  <p className="text-[11px] font-semibold text-orange-500 dark:text-orange-400">Este cliente estaba inactivo</p>
                </div>
                <label className="flex items-center justify-between gap-3 cursor-pointer select-none group pt-0.5">
                  <div>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                      {reactivarCliente ? 'Activar al registrar el pago' : 'Mantener inactivo'}
                    </p>
                    <p className="text-xs text-gray-400">
                      {reactivarCliente ? 'El cliente pasará a estado activo' : 'El cliente seguirá en estado inactivo'}
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={reactivarCliente}
                    onClick={() => setReactivarCliente(v => !v)}
                    style={{ transition: 'background-color 200ms ease-out' }}
                    className={`relative inline-flex h-5 w-9 shrink-0 rounded-full ${reactivarCliente ? 'bg-primary' : 'bg-gray-300 dark:bg-white/20'}`}
                  >
                    <span
                      style={{ transition: 'transform 200ms ease-out' }}
                      className={`mt-0.5 ml-0.5 inline-block h-4 w-4 rounded-full bg-white shadow-sm ${reactivarCliente ? 'translate-x-4' : 'translate-x-0'}`}
                    />
                  </button>
                </label>
              </div>
            )}

          </div>
        </div>
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <motion.div
      variants={pageVariants}
      initial="hidden"
      animate="visible"
      className="space-y-5"
    >
      {/* Breadcrumb */}
      <button
        onClick={() => navigate(ROUTES.PAYMENTS)}
        className="group flex items-center gap-2 text-sm text-gray-500 dark:text-[#8A8A9A] hover:text-gray-900 dark:hover:text-white transition-colors"
      >
        <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
        Pagos
      </button>

      {/* Título */}
      <div>
        <h1 className="text-3xl md:text-4xl font-black tracking-tighter text-gray-900 dark:text-white leading-none">
          Registrar pago
        </h1>
        <p className="text-sm text-gray-500 dark:text-[#6A6A7A] mt-2">
          Seleccioná el cliente y completá los detalles del cobro.
        </p>
      </div>

      {/* Wizard card — mismo estilo que CreateClientPage */}
      <div className="rounded-[2rem] border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-3xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
        {/* Línea de acento superior */}
        <div className="h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

        <div className="p-6 md:p-8">
          {Stepper()}

          {/* Contenido animado por paso */}
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="min-h-0"
            >
              {StepHeader({ stepId: step })}
              {step === 1 && Step1()}
              {step === 2 && Step2()}
            </motion.div>
          </AnimatePresence>

          {/* Error de submit */}
          {submitError && (
            <div className="mt-5 flex items-center gap-3 rounded-xl border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/[0.07] px-4 py-3">
              <AlertCircle size={15} className="text-red-500 shrink-0" />
              <p className="text-sm text-red-600 dark:text-red-400">{submitError}</p>
            </div>
          )}

          {/* Navegación */}
          <div className="flex items-center justify-between gap-3 mt-8 pt-6 border-t border-gray-100 dark:border-white/[0.05]">
            <div>
              {step === 1 ? (
                <button
                  type="button"
                  onClick={() => navigate(ROUTES.PAYMENTS)}
                  className="text-sm font-semibold text-gray-400 dark:text-[#5A5A6A] hover:text-gray-700 dark:hover:text-white transition-colors px-3 py-2"
                >
                  Cancelar
                </button>
              ) : (
                <button
                  type="button"
                  onClick={backToStep1}
                  className="flex items-center gap-1.5 text-sm font-semibold text-gray-500 dark:text-[#6A6A7A] hover:text-gray-800 dark:hover:text-white transition-colors px-3 py-2"
                >
                  <ArrowLeft size={14} />
                  Atrás
                </button>
              )}
            </div>

            <div>
              {step === 1 && showNewClient ? (
                /* Crear cliente + continuar */
                <button
                  type="button"
                  onClick={submitClient(onCreateClient)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl btn-action text-sm font-bold"
                >
                  <CheckCircle2 size={14} />
                  Continuar
                </button>
              ) : step === 2 ? (
                /* Registrar pago */
                <button
                  type="button"
                  onClick={submitPay(onSubmitPayment)}
                  disabled={submitting}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl btn-action text-sm font-bold disabled:opacity-60"
                >
                  {submitting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                  Registrar pago
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* CSS variable para líneas inactivas */}
      <style>{`
        :root { --line-inactive: rgba(0,0,0,0.08); }
        .dark  { --line-inactive: rgba(255,255,255,0.06); }
      `}</style>
    </motion.div>
  )
}
