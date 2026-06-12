import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { pageVariants } from '../lib/motion'
import {
  ArrowLeft, Banknote, ArrowLeftRight, CreditCard,
  User, Search, X, CheckCircle2, Loader2, UserPlus,
  Check, AlertCircle,
} from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format } from 'date-fns'
import { paymentsApi } from '../api/payments.api'
import { clientsApi } from '../api/clients.api'
import { membresiasClienteApi } from '../api/membresiasCliente.api'
import { useUiStore } from '../store/uiStore'
import { ROUTES } from '../constants/routes'
import { MODALIDAD_LABELS } from '../types/membership.types'
import type { MembresiaCliente } from '../types/membership.types'
import type { Client } from '../types/client.types'

// ── Schemas ───────────────────────────────────────────────────────────────────

const newClientSchema = z.object({
  name:     z.string().min(1, 'Requerido'),
  lastName: z.string().min(1, 'Requerido'),
  phone:    z.string().optional(),
  email:    z.string().email('Email inválido').optional().or(z.literal('')),
})
type NewClientValues = z.infer<typeof newClientSchema>

const paymentSchema = z.object({
  amount:   z.string().min(1, 'Requerido').refine(v => !isNaN(Number(v)) && Number(v) > 0, 'Debe ser mayor a 0'),
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

const MEMB_ESTADO_LABEL: Record<string, string> = {
  ACTIVA: 'Activa', PENDIENTE: 'Programada', VENCIDA: 'Expirada', CANCELADA: 'Cancelada',
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
  const addToast       = useUiStore(s => s.addToast)
  const today          = format(new Date(), 'yyyy-MM-dd')

  // ── Paso activo ───────────────────────────────────────────────────────────
  const [step, setStep] = useState<1 | 2>(1)

  // ── Paso 1: cliente ───────────────────────────────────────────────────────
  const [clientQuery,    setClientQuery]    = useState('')
  const [clientResults,  setClientResults]  = useState<Client[]>([])
  const [loadingSearch,  setLoadingSearch]  = useState(false)
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [showNewClient,  setShowNewClient]  = useState(false)
  const [creatingClient, setCreatingClient] = useState(false)

  const {
    register: regClient,
    handleSubmit: submitClient,
    formState: { errors: clientErrors },
    reset: resetClient,
  } = useForm<NewClientValues>({ resolver: zodResolver(newClientSchema) })

  // ── Paso 2: pago ──────────────────────────────────────────────────────────
  const [membresias,  setMembresias]  = useState<MembresiaCliente[]>([])
  const [loadingMemb, setLoadingMemb] = useState(false)
  const [membresiaId,    setMembresiaId]    = useState('')
  const [displayAmount,  setDisplayAmount]  = useState('')
  const [submitting,     setSubmitting]     = useState(false)
  const [submitError,    setSubmitError]    = useState<string | null>(null)

  const {
    register: regPay,
    handleSubmit: submitPay,
    formState: { errors: payErrors },
    watch,
    setValue,
  } = useForm<PaymentValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { method: 'transfer', paidAt: today, invoiced: false },
  })
  const watchedMethod = watch('method')

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
        const active = sorted.find(x => x.estado === 'ACTIVA')
        setMembresiaId(active?.id ?? '')
      })
      .finally(() => setLoadingMemb(false))
    setStep(2)
  }

  function backToStep1() {
    setStep(1)
    setSelectedClient(null)
    setMembresias([])
    setMembresiaId('')
    setSubmitError(null)
    setShowNewClient(false)
    resetClient()
  }

  // ── Crear cliente inline ──────────────────────────────────────────────────
  async function onCreateClient(data: NewClientValues) {
    setCreatingClient(true)
    try {
      const created = await clientsApi.create({
        name: data.name, lastName: data.lastName,
        phone: data.phone || undefined,
        email: data.email || undefined,
      })
      addToast(`Cliente ${created.name} ${created.lastName} creado`, 'success')
      pickClient(created)
    } catch {
      addToast('Error al crear el cliente', 'error')
    } finally {
      setCreatingClient(false)
    }
  }

  // ── Registrar pago ────────────────────────────────────────────────────────
  async function onSubmitPayment(data: PaymentValues) {
    if (!selectedClient) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const payment = await paymentsApi.create({
        clientId: selectedClient.id as unknown as number,
        amount:   Number(data.amount),
        method:   data.method,
        paidAt:   data.paidAt,
        invoiced: data.invoiced,
        notes:    data.notes || undefined,
        ...(membresiaId && { membresiaId }),
      })
      addToast('Pago registrado', 'success')
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
                  'relative z-20 flex h-10 w-10 items-center justify-center rounded-xl text-sm font-black transition-all duration-300',
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
                      transition={{ duration: 0.12, delay: i * 0.02, ease: 'easeOut' }}
                      className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-primary/5 transition-colors text-left group"
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
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-[#6A6A7A]">
                  Teléfono <span className="font-normal normal-case tracking-normal opacity-60 text-[10px]">(opcional)</span>
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
          </motion.div>
        )}
      </div>
    )
  }

  // ── Contenido Paso 2: detalles del pago ───────────────────────────────────
  function Step2() {
    return (
      <div className="space-y-5">
        {/* Cliente seleccionado */}
        <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-primary/5 dark:bg-primary/[0.06] border border-primary/20 dark:border-primary/15">
          <div className="h-8 w-8 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
            <User size={14} className="text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-gray-900 dark:text-white truncate">
              {selectedClient?.name} {selectedClient?.lastName}
            </p>
            {selectedClient?.planName && (
              <p className="text-xs text-gray-500 dark:text-[#6A6A7A] truncate">{selectedClient.planName}</p>
            )}
          </div>
          <button
            type="button"
            onClick={backToStep1}
            className="shrink-0 text-xs font-semibold text-gray-400 hover:text-primary transition-colors"
          >
            Cambiar
          </button>
        </div>

        {/* Grid 2 columnas: izquierda = monto + método · derecha = fecha + membresía + notas + facturado */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">

          {/* ── Columna izquierda ── */}
          <div className="space-y-5">
            {/* Monto */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-[#6A6A7A] flex items-center gap-1">
                Monto <span className="text-primary text-[10px]">*</span>
              </label>
              <div className="relative">
                <input type="hidden" {...regPay('amount')} />
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400 select-none">$</span>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  autoFocus
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
            </div>

            {/* Método — pills */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-[#6A6A7A]">
                Método <span className="text-primary text-[10px]">*</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {METHOD_OPTIONS.map(opt => {
                  const active = watchedMethod === opt.value
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setValue('method', opt.value, { shouldValidate: true })}
                      className={[
                        'flex flex-col items-center gap-2 px-3 py-3.5 rounded-2xl border-2 transition-all duration-200',
                        active
                          ? `${opt.activeBg} ${opt.activeBorder} ${opt.color}`
                          : 'border-gray-200 dark:border-white/[0.07] bg-white/40 dark:bg-white/[0.02] text-gray-400 dark:text-[#5A5A6A] hover:bg-gray-50 dark:hover:bg-white/[0.04] hover:border-gray-300 dark:hover:border-white/[0.12]',
                      ].join(' ')}
                    >
                      <opt.Icon size={17} />
                      <span className="text-xs font-bold">{opt.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* ── Columna derecha ── */}
          <div className="space-y-4">
            {/* Fecha */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-[#6A6A7A]">
                Fecha <span className="text-primary text-[10px]">*</span>
              </label>
              <input type="date" {...regPay('paidAt')} className={ic()} />
              {payErrors.paidAt && (
                <p className="flex items-center gap-1.5 text-xs text-red-500 dark:text-red-400">
                  <AlertCircle size={11} />{payErrors.paidAt.message}
                </p>
              )}
            </div>

            {/* Membresía vinculada */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-[#6A6A7A]">
                Membresía{' '}
                <span className="font-normal normal-case tracking-normal opacity-60 text-[10px]">(opcional)</span>
              </label>
              {loadingMemb ? (
                <div className="h-11 rounded-xl bg-gray-100 dark:bg-white/[0.04] animate-pulse" />
              ) : membresias.length === 0 ? (
                <p className="text-xs text-gray-400 py-1">Sin membresías registradas</p>
              ) : (
                <select
                  value={membresiaId}
                  onChange={e => setMembresiaId(e.target.value)}
                  className={ic()}
                >
                  <option value="">— Sin membresía —</option>
                  {membresias.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.plan.nombre} · {MODALIDAD_LABELS[m.modalidad] ?? m.modalidad} · {MEMB_ESTADO_LABEL[m.estado] ?? m.estado} · desde {m.fechaInicio.slice(0, 10)}
                    </option>
                  ))}
                </select>
              )}
            </div>

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
      className="max-w-4xl mx-auto space-y-5"
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
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
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
                  disabled={creatingClient}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-black text-sm font-bold hover:bg-primary-dark disabled:opacity-60 transition-all"
                >
                  {creatingClient ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                  Crear y continuar
                </button>
              ) : step === 2 ? (
                /* Registrar pago */
                <button
                  type="button"
                  onClick={submitPay(onSubmitPayment)}
                  disabled={submitting}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-black text-sm font-bold hover:bg-primary-dark disabled:opacity-60 transition-all"
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
