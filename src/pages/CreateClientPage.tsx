import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { pageVariants } from '../lib/motion'
import {
  Check, ArrowLeft, ChevronRight,
  User, CreditCard, Banknote, Calendar, BookOpen,
  Hash, Mail, Phone, Clock, Users, AlertCircle, Dumbbell,
  ArrowLeftRight, CalendarDays, Plus, X,
} from 'lucide-react'
import { format, addDays } from 'date-fns'
import { es } from 'date-fns/locale'
import Button from '../components/ui/Button'
import { clientsApi } from '../api/clients.api'
import { paymentsApi } from '../api/payments.api'
import { membershipsApi } from '../api/memberships.api'
import { membresiasClienteApi } from '../api/membresiasCliente.api'
import { inscripcionesApi } from '../api/inscripciones.api'
import { rutinasApi } from '../api/rutinas.api'
import { shiftsApi, professorsApi } from '../api/shifts.api'
import { formatCurrency } from '../utils/formatCurrency'
import type { Membership, Modalidad } from '../types/membership.types'
import type { Shift, WeekDay } from '../types/shift.types'

// ─── Constantes ──────────────────────────────────────────────────────────────

const today = new Date().toISOString().slice(0, 10)

const MODALIDAD_DIAS: Record<Modalidad, number> = {
  TRANSFERENCIA_MENSUAL: 30,
  EFECTIVO: 30,
  MEMBRESIA_3_MESES: 90,
  MEMBRESIA_6_MESES: 180,
}

const MODALIDAD_LABEL: Record<Modalidad, string> = {
  TRANSFERENCIA_MENSUAL: 'Transferencia / Débito',
  EFECTIVO: 'Efectivo',
  MEMBRESIA_3_MESES: '3 meses',
  MEMBRESIA_6_MESES: '6 meses',
}

const CUOTAS_POR_MODALIDAD: Record<Modalidad, number> = {
  TRANSFERENCIA_MENSUAL: 1,
  EFECTIVO: 1,
  MEMBRESIA_3_MESES: 3,
  MEMBRESIA_6_MESES: 6,
}

const METODO_LABEL: Record<'EFECTIVO' | 'TRANSFERENCIA' | 'DEBITO', string> = {
  EFECTIVO: 'Efectivo',
  TRANSFERENCIA: 'Transferencia',
  DEBITO: 'Débito',
}

const WEEKDAY_LABEL: Record<WeekDay, string> = {
  monday: 'Lun', tuesday: 'Mar', wednesday: 'Mié',
  thursday: 'Jue', friday: 'Vie', saturday: 'Sáb', sunday: 'Dom',
}

const STEPS = [
  { id: 1 as const, label: 'Datos', optional: false },
  { id: 2 as const, label: 'Membresía', optional: false },
  { id: 3 as const, label: 'Pago', optional: false },
  { id: 4 as const, label: 'Turno', optional: true },
  { id: 5 as const, label: 'Rutina', optional: true },
]

const STEP_META: Record<number, { Icon: typeof User; title: string; description: string }> = {
  1: { Icon: User, title: 'Datos del cliente', description: 'Nombre, CUIL y datos de contacto del nuevo socio' },
  2: { Icon: CreditCard, title: 'Membresía', description: 'Plan, modalidad y precio del período' },
  3: { Icon: Banknote, title: 'Primer pago', description: 'Registrá el pago que realizó el cliente hoy' },
  4: { Icon: Calendar, title: 'Turno', description: 'Asigná el turno al que va a asistir' },
  5: { Icon: Dumbbell, title: 'Rutina inicial', description: 'Creá una rutina de arranque para el cliente' },
}

type StepId = 1 | 2 | 3 | 4 | 5 | 'success'

interface CreatedResult {
  clientId: string
  clientName: string
  planName: string
  modalidad: string
  fechaVencimiento: string
  monto: number
  metodo: string
  turnoLabel: string | null
  rutinaNombre: string | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function calcExpiryPreview(fechaInicio: string, modalidad: Modalidad): string {
  if (!fechaInicio) return '—'
  const d = addDays(new Date(fechaInicio), MODALIDAD_DIAS[modalidad])
  return format(d, "d 'de' MMMM yyyy", { locale: es })
}

function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}

// ─── Input con ícono ─────────────────────────────────────────────────────────

interface FieldProps {
  label: string
  required?: boolean
  error?: string
  icon?: typeof User
  children: React.ReactNode
}

function Field({ label, required, error, icon: Icon, children }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-[#6A6A7A] flex items-center gap-1">
        {label}
        {required && <span className="text-primary text-[10px]">*</span>}
      </label>
      <div className="relative group">
        {Icon && (
          <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-[#5A5A6A] group-focus-within:text-primary transition-colors duration-200">
            <Icon size={14} />
          </div>
        )}
        <div className={Icon ? '[&>input]:pl-10 [&>textarea]:pl-10 [&>input]:pl-10' : ''}>
          {children}
        </div>
      </div>
      {error && (
        <p className="flex items-center gap-1.5 text-xs text-red-500 dark:text-red-400">
          <AlertCircle size={11} />
          {error}
        </p>
      )}
    </div>
  )
}

// ─── Clases de input ─────────────────────────────────────────────────────────

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

// ─── Card de selección ────────────────────────────────────────────────────────

function OptionCard({
  selected,
  onClick,
  children,
  className = '',
}: {
  selected: boolean
  onClick: () => void
  children: React.ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'relative text-left rounded-2xl border p-4 transition-all duration-200 overflow-hidden w-full',
        selected
          ? [
            'border-primary/50 dark:border-primary/40',
            'bg-gradient-to-br from-[rgba(251,198,8,0.10)] via-[rgba(251,198,8,0.04)] to-transparent',
            'dark:from-[rgba(251,198,8,0.08)] dark:via-[rgba(251,198,8,0.03)] dark:to-transparent',
            'shadow-[0_4px_24px_rgba(251,198,8,0.12)] dark:shadow-[0_4px_24px_rgba(251,198,8,0.08)]',
          ].join(' ')
          : [
            'border-white/50 dark:border-white/10',
            'bg-white/40 dark:bg-white/[0.04]',
            'backdrop-blur-xl',
            'shadow-[0_2px_12px_rgba(0,0,0,0.06),0_1px_3px_rgba(0,0,0,0.04)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.2)]',
            'hover:border-white/70 dark:hover:border-white/[0.16]',
            'hover:bg-white/60 dark:hover:bg-white/[0.07]',
            'hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_4px_16px_rgba(0,0,0,0.3)]',
          ].join(' '),
        className,
      ].join(' ')}
    >
      {selected && (
        <span className="absolute top-2.5 right-2.5 flex h-5 w-5 items-center justify-center rounded-md bg-primary shadow-[0_2px_8px_rgba(251,198,8,0.4)]">
          <Check size={11} strokeWidth={3} className="text-black" />
        </span>
      )}
      {children}
    </button>
  )
}

// ─── Componente principal ────────────────────────────────────────────────────

export default function CreateClientPage() {
  const navigate = useNavigate()

  const [step, setStep] = useState<StepId>(1)
  const [clientData, setClientData] = useState({ nombre: '', apellido: '', cuil: '', email: '', telefono: '' })
  const [membershipData, setMembershipData] = useState<{
    planId: string; modalidad: Modalidad; precio: string; fechaInicio: string
  }>({ planId: '', modalidad: 'EFECTIVO', precio: '', fechaInicio: today })
  const [paymentData, setPaymentData] = useState<{
    monto: string; metodo: 'EFECTIVO' | 'TRANSFERENCIA' | 'DEBITO'; fecha: string; comprobante: string
  }>({ monto: '', metodo: 'EFECTIVO', fecha: today, comprobante: '' })
  const [selectedTurnoId, setSelectedTurnoId] = useState<string | null>(null)
  const [rutinaData, setRutinaData] = useState({ nombre: '', descripcion: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [createdResult, setCreatedResult] = useState<CreatedResult | null>(null)
  const [planes, setPlanes] = useState<Membership[]>([])
  const [turnos, setTurnos] = useState<Shift[]>([])
  const [loadingData, setLoadingData] = useState(false)
  const [professors, setProfessors] = useState<{ id: string; name: string }[]>([])

  // ── Nuevo turno inline ──────────────────────────────────────────────────────
  const [creatingNewTurno, setCreatingNewTurno] = useState(false)
  const [newTurnoForm, setNewTurnoForm] = useState<{
    days: WeekDay[]; startTime: string; endTime: string
    cupoMaximoSalaA: string; cupoMaximoSalaB: string
    profesorId: string; recurrente: boolean
  }>({ days: [], startTime: '', endTime: '', cupoMaximoSalaA: '', cupoMaximoSalaB: '', profesorId: '', recurrente: true })
  const [newTurnoErrors, setNewTurnoErrors] = useState<Record<string, string>>({})
  const [savingNewTurno, setSavingNewTurno] = useState(false)

  const ALL_DAYS: WeekDay[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

  async function handleCreateNuevoTurno() {
    const errs: Record<string, string> = {}
    if (newTurnoForm.days.length === 0) errs.days = 'Seleccioná al menos un día'
    if (!newTurnoForm.startTime) errs.startTime = 'Requerida'
    if (!newTurnoForm.endTime) errs.endTime = 'Requerida'
    if (!newTurnoForm.cupoMaximoSalaA || isNaN(Number(newTurnoForm.cupoMaximoSalaA))) errs.cupoMaximoSalaA = 'Inválido'
    if (!newTurnoForm.cupoMaximoSalaB || isNaN(Number(newTurnoForm.cupoMaximoSalaB))) errs.cupoMaximoSalaB = 'Inválido'
    if (!newTurnoForm.profesorId) errs.profesorId = 'Requerido'
    if (Object.keys(errs).length) { setNewTurnoErrors(errs); return }
    setSavingNewTurno(true)
    try {
      const turno = await shiftsApi.create({
        days: newTurnoForm.days,
        recurrente: newTurnoForm.recurrente,
        startTime: newTurnoForm.startTime,
        endTime: newTurnoForm.endTime,
        cupoMaximoSalaA: Number(newTurnoForm.cupoMaximoSalaA),
        cupoMaximoSalaB: Number(newTurnoForm.cupoMaximoSalaB),
        profesorId: newTurnoForm.profesorId,
      })
      setTurnos(prev => [...prev, turno])
      setSelectedTurnoId(String(turno.id))
      setCreatingNewTurno(false)
      setNewTurnoForm({ days: [], startTime: '', endTime: '', cupoMaximoSalaA: '', cupoMaximoSalaB: '', profesorId: '', recurrente: true })
      setNewTurnoErrors({})
    } catch {
      setNewTurnoErrors({ general: 'Error al crear el turno. Intentá de nuevo.' })
    } finally {
      setSavingNewTurno(false)
    }
  }

  useEffect(() => {
    setLoadingData(true)
    Promise.allSettled([membershipsApi.getAll(), shiftsApi.getAll(), professorsApi.getAll()]).then(([pr, tr, pfr]) => {
      if (pr.status === 'fulfilled') setPlanes(pr.value)
      if (tr.status === 'fulfilled') setTurnos(tr.value)
      if (pfr.status === 'fulfilled') setProfessors(pfr.value)
      setLoadingData(false)
    })
  }, [])

  // Auto-fill precio desde TarifaVigente al cambiar plan o modalidad
  useEffect(() => {
    if (!membershipData.planId) return
    const plan = planes.find(p => String(p.id) === membershipData.planId)
    if (!plan) return
    const tarifa = plan.tarifas.find(t => t.modalidad === membershipData.modalidad)
    if (tarifa) setMembershipData(prev => ({ ...prev, precio: String(tarifa.precio) }))
  }, [membershipData.planId, membershipData.modalidad, planes])

  function validate(s: StepId): Record<string, string> {
    const e: Record<string, string> = {}
    if (s === 1) {
      if (!clientData.nombre.trim()) e.nombre = 'Requerido'
      if (!clientData.apellido.trim()) e.apellido = 'Requerido'
      if (clientData.email.trim() && !isValidEmail(clientData.email)) e.email = 'Email inválido'
    }
    if (s === 2) {
      if (!membershipData.planId) e.planId = 'Seleccioná un plan'
      if (!membershipData.precio || Number(membershipData.precio) <= 0) e.precio = 'Ingresá un precio válido'
    }
    if (s === 3) {
      if (!paymentData.monto || Number(paymentData.monto) <= 0) e.monto = 'Ingresá un monto válido'
      if (!paymentData.fecha) e.fecha = 'La fecha es requerida'
    }
    return e
  }

  function handleNext() {
    const errs = validate(step)
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setErrors({})
    if (step === 2 && !paymentData.monto) {
      setPaymentData(p => ({ ...p, monto: membershipData.precio }))
    }
    if (step === 1) { setStep(2); return }
    if (step === 2) { setStep(3); return }
    if (step === 3) { setStep(4); return }
    if (step === 4) { setStep(5); return }
  }

  function handleBack() {
    if (step === 2) { setStep(1); return }
    if (step === 3) { setStep(2); return }
    if (step === 4) { setStep(3); return }
    if (step === 5) { setStep(4); return }
  }

  async function handleSubmit() {
    setIsSubmitting(true)
    setSubmitError(null)
    try {
      const client = await clientsApi.create({
        name: clientData.nombre, lastName: clientData.apellido,
        email: clientData.email, phone: clientData.telefono, cuil: clientData.cuil || undefined,
      })
      const membresia = await membresiasClienteApi.create({
        clienteId: String(client.id), planId: membershipData.planId,
        modalidad: membershipData.modalidad, precio: Number(membershipData.precio),
        fechaInicio: membershipData.fechaInicio || undefined,
      })
      const methodMap: Record<string, 'cash' | 'transfer' | 'card'> = {
        EFECTIVO: 'cash', TRANSFERENCIA: 'transfer', DEBITO: 'card',
      }
      await paymentsApi.create({
        clientId: client.id as number, amount: Number(paymentData.monto),
        method: methodMap[paymentData.metodo] ?? 'cash', invoiced: false,
        paidAt: paymentData.fecha, notes: paymentData.comprobante || undefined,
        membresiaId: membresia.id,
        cuotaNumero: 1,
      })
      if (selectedTurnoId) {
        await inscripcionesApi.enroll(String(client.id), selectedTurnoId)
      }
      if (rutinaData.nombre && selectedTurnoId) {
        const turno = turnos.find(t => String(t.id) === selectedTurnoId)
        if (turno?.profesorId) {
          await rutinasApi.create({
            clienteId: String(client.id), profesorId: turno.profesorId,
            nombre: rutinaData.nombre, descripcion: rutinaData.descripcion || undefined,
          })
        }
      }
      const planSelected = planes.find(p => String(p.id) === membershipData.planId)
      const turnoSelected = turnos.find(t => String(t.id) === selectedTurnoId)
      setCreatedResult({
        clientId: String(client.id),
        clientName: `${clientData.nombre} ${clientData.apellido}`,
        planName: planSelected?.name ?? '',
        modalidad: membershipData.modalidad,
        fechaVencimiento: membresia.fechaVencimiento,
        monto: Number(paymentData.monto),
        metodo: paymentData.metodo,
        turnoLabel: turnoSelected ? `Sala ${turnoSelected.room} · ${turnoSelected.startTime}` : null,
        rutinaNombre: rutinaData.nombre || null,
      })
      setStep('success')
    } catch {
      setSubmitError('Ocurrió un error. Por favor intentá de nuevo.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Stepper ────────────────────────────────────────────────────────────────
  const numericStep = step === 'success' ? 6 : (step as number)

  function Stepper() {
    return (
      <div className="flex items-start mb-8">
        {STEPS.map((s, idx) => {
          const done = numericStep > s.id
          const curr = numericStep === s.id
          return (
            <div key={s.id} className="flex-1 flex flex-col items-center relative">
              {/* Left line */}
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
              {/* Right line */}
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

              {/* Square step indicator */}
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

              {/* Label */}
              <div className="mt-2 flex flex-col items-center gap-0.5">
                <span className={[
                  'text-[10px] font-bold uppercase tracking-wider',
                  curr ? 'text-gray-900 dark:text-white'
                    : done ? 'text-primary'
                      : 'text-gray-400 dark:text-[#4A4A5A]',
                ].join(' ')}>
                  {s.label}
                </span>
                {s.optional && (
                  <span className="text-[9px] text-gray-400 dark:text-[#4A4A5A] uppercase tracking-widest">opt.</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // ── Step header ────────────────────────────────────────────────────────────
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
            Paso {stepId}/5
          </span>
        </div>
      </div>
    )
  }

  // ── Step 1 — Datos ────────────────────────────────────────────────────────
  function Step1() {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Nombre" required error={errors.nombre} icon={User}>
            <input
              value={clientData.nombre}
              onChange={e => setClientData(p => ({ ...p, nombre: e.target.value }))}
              className={ic(true)}
            />
          </Field>
          <Field label="Apellido" required error={errors.apellido}>
            <input
              value={clientData.apellido}
              onChange={e => setClientData(p => ({ ...p, apellido: e.target.value }))}
              className={ic()}
            />
          </Field>
        </div>

        <Field label="CUIL" error={errors.cuil} icon={Hash}>
          <input
            value={clientData.cuil}
            onChange={e => setClientData(p => ({ ...p, cuil: e.target.value }))}
            className={ic(true)}
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Email" error={errors.email} icon={Mail}>
            <input
              type="email"
              value={clientData.email}
              onChange={e => setClientData(p => ({ ...p, email: e.target.value }))}
              className={ic(true)}
            />
          </Field>
          <Field label="Teléfono" icon={Phone}>
            <input
              type="tel"
              value={clientData.telefono}
              onChange={e => {
                const val = e.target.value.replace(/[^0-9+]/g, '')
                setClientData(p => ({ ...p, telefono: val }))
              }}
              className={ic(true)}
            />
          </Field>
        </div>
      </div>
    )
  }

  // ── Step 2 — Membresía ────────────────────────────────────────────────────
  function Step2() {
    const expiryPreview = membershipData.fechaInicio
      ? calcExpiryPreview(membershipData.fechaInicio, membershipData.modalidad)
      : '—'

    function getPrecio(planId: string, mod: Modalidad): number | null {
      const plan = planes.find(p => String(p.id) === planId)
      const tarifa = plan?.tarifas.find(t => t.modalidad === mod)
      return tarifa ? tarifa.precio : null
    }

    function selectPlan(planId: string) {
      const precio = getPrecio(planId, membershipData.modalidad)
      setMembershipData(p => ({ ...p, planId, precio: precio !== null ? String(precio) : '' }))
      setErrors(p => { const e = { ...p }; delete e.planId; return e })
    }

    function selectModalidad(mod: Modalidad) {
      const precio = membershipData.planId ? getPrecio(membershipData.planId, mod) : null
      setMembershipData(p => ({ ...p, modalidad: mod, precio: precio !== null ? String(precio) : p.precio }))
    }

    const MENSUAL_MODS = [
      { mod: 'TRANSFERENCIA_MENSUAL' as Modalidad, label: 'Transferencia / Débito', Icon: ArrowLeftRight },
      { mod: 'EFECTIVO' as Modalidad, label: 'Efectivo', Icon: Banknote },
    ]
    const MEMBRESIA_MODS = [
      { mod: 'MEMBRESIA_3_MESES' as Modalidad, label: '3 meses', Icon: Calendar, dias: 90 },
      { mod: 'MEMBRESIA_6_MESES' as Modalidad, label: '6 meses', Icon: CalendarDays, dias: 180 },
    ]

    return (
      <div className="space-y-6">

        {/* ── Plan ─────────────────────────────────────────────────── */}
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-[#6A6A7A] mb-3">
            Plan <span className="text-primary">*</span>
          </p>
          {loadingData ? (
            <div className="flex items-center gap-2 text-sm text-gray-400 dark:text-[#6A6A7A] py-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-200 dark:border-white/10 border-t-primary" />
              Cargando planes…
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {planes.map(plan => {
                const precio = getPrecio(String(plan.id), membershipData.modalidad)
                return (
                  <OptionCard
                    key={plan.id}
                    selected={membershipData.planId === String(plan.id)}
                    onClick={() => selectPlan(String(plan.id))}
                  >
                    <p className="text-sm font-black text-gray-900 dark:text-white pr-6 leading-tight">{plan.name}</p>
                    <p className="text-[11px] text-gray-500 dark:text-[#6A6A7A] mt-1">{plan.classesPerWeek}× por semana</p>
                    {precio !== null
                      ? <p className="text-lg font-black text-primary mt-2 tabular-nums">{formatCurrency(precio)}</p>
                      : <p className="text-xs text-gray-400 dark:text-[#5A5A6A] mt-2">Sin tarifa cargada</p>
                    }
                  </OptionCard>
                )
              })}
            </div>
          )}
          {errors.planId && (
            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-red-500">
              <AlertCircle size={11} />{errors.planId}
            </p>
          )}
        </div>

        {/* ── Modalidad ────────────────────────────────────────────── */}
        <div className="space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-[#6A6A7A]">
            Modalidad <span className="text-primary">*</span>
          </p>

          {/* Grupo: Pago mensual */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-[#4A4A5A] mb-2">
              Pago mensual
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              {MENSUAL_MODS.map(({ mod, label, Icon }) => {
                const precio = membershipData.planId ? getPrecio(membershipData.planId, mod) : null
                return (
                  <OptionCard key={mod} selected={membershipData.modalidad === mod} onClick={() => selectModalidad(mod)}>
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-lg bg-white/60 dark:bg-white/[0.06] border border-white/60 dark:border-white/[0.08] flex items-center justify-center shrink-0">
                        <Icon size={14} className={membershipData.modalidad === mod ? 'text-primary' : 'text-gray-400 dark:text-[#6A6A7A]'} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-black text-gray-900 dark:text-white leading-tight truncate">{label}</p>
                        <p className="text-[10px] text-gray-400 dark:text-[#5A5A6A] font-semibold uppercase tracking-wider">30 días</p>
                      </div>
                    </div>
                    {precio !== null && (
                      <p className="text-xs font-bold text-primary mt-2 tabular-nums">{formatCurrency(precio)}</p>
                    )}
                  </OptionCard>
                )
              })}
            </div>
          </div>

          {/* Grupo: Membresía */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-[#4A4A5A] mb-2">
              Membresía
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              {MEMBRESIA_MODS.map(({ mod, label, Icon, dias }) => {
                const precio = membershipData.planId ? getPrecio(membershipData.planId, mod) : null
                return (
                  <OptionCard key={mod} selected={membershipData.modalidad === mod} onClick={() => selectModalidad(mod)}>
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-lg bg-white/60 dark:bg-white/[0.06] border border-white/60 dark:border-white/[0.08] flex items-center justify-center shrink-0">
                        <Icon size={14} className={membershipData.modalidad === mod ? 'text-primary' : 'text-gray-400 dark:text-[#6A6A7A]'} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-black text-gray-900 dark:text-white leading-tight">{label}</p>
                        <p className="text-[10px] text-gray-400 dark:text-[#5A5A6A] font-semibold uppercase tracking-wider">{dias} días</p>
                      </div>
                    </div>
                    {precio !== null && (
                      <p className="text-xs font-bold text-primary mt-2 tabular-nums">{formatCurrency(precio)}</p>
                    )}
                  </OptionCard>
                )
              })}
            </div>
          </div>
        </div>

        {/* ── Precio + Fecha ───────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-4">
          <Field label="Precio del período" required error={errors.precio}>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400 dark:text-[#5A5A6A]">$</span>
              <input
                type="number" min={0}
                value={membershipData.precio}
                onChange={e => setMembershipData(p => ({ ...p, precio: e.target.value }))}
                className={ic(true)}
              />
            </div>
          </Field>
          <Field label="Fecha de inicio">
            <input
              type="date"
              value={membershipData.fechaInicio}
              onChange={e => setMembershipData(p => ({ ...p, fechaInicio: e.target.value }))}
              className={ic()}
            />
          </Field>
        </div>

        {/* ── Preview vencimiento ──────────────────────────────────── */}
        {membershipData.planId && (
          <div className="flex items-center gap-3 rounded-xl border border-primary/20 dark:border-primary/15 bg-gradient-to-r from-primary/8 to-primary/3 dark:from-primary/[0.07] dark:to-transparent px-4 py-3">
            <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-[#6A6A7A]">La membresía finaliza el</p>
              <p className="text-sm font-black text-primary mt-0.5">{expiryPreview}</p>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Step 3 — Pago ─────────────────────────────────────────────────────────
  function Step3() {
    const numCuotas = CUOTAS_POR_MODALIDAD[membershipData.modalidad]
    const cuotas = Array.from({ length: numCuotas }, (_, i) => ({
      numero: i + 1,
      fecha: addDays(new Date(membershipData.fechaInicio || today), 30 * i),
    }))

    return (
      <div className="space-y-6">

        {/* Cronograma de cuotas */}
        <div className="rounded-2xl border border-white/50 dark:border-white/10 bg-white/40 dark:bg-white/[0.04] backdrop-blur-xl p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-[#6A6A7A] mb-3">
            Cronograma de pagos · {numCuotas} cuota{numCuotas > 1 ? 's' : ''} mensual{numCuotas > 1 ? 'es' : ''}
          </p>
          <div className="flex flex-col gap-2">
            {cuotas.map(c => (
              <div key={c.numero} className="flex items-center gap-3">
                <div className={[
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[10px] font-black',
                  c.numero === 1
                    ? 'bg-primary text-black shadow-[0_0_10px_rgba(251,198,8,0.35)]'
                    : 'bg-gray-100 dark:bg-white/[0.06] text-gray-400 dark:text-[#6A6A7A]',
                ].join(' ')}>
                  {c.numero}
                </div>
                <div className="flex-1 flex items-center justify-between gap-2">
                  <span className={`text-xs font-semibold ${c.numero === 1 ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-[#6A6A7A]'}`}>
                    {c.numero === 1 ? 'Cuota 1 — se registra ahora' : `Cuota ${c.numero}`}
                  </span>
                  <span className={`text-xs tabular-nums ${c.numero === 1 ? 'text-primary font-bold' : 'text-gray-400 dark:text-[#5A5A6A]'}`}>
                    {format(c.fecha, "d MMM yyyy", { locale: es })}
                  </span>
                </div>
                {c.numero === 1 ? (
                  <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                ) : (
                  <div className="h-1.5 w-1.5 rounded-full bg-gray-200 dark:bg-white/[0.1] shrink-0" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Monto — destacado */}
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-[#6A6A7A] mb-2">
            Monto Cuota 1 <span className="text-primary">*</span>
          </p>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-black text-gray-400 dark:text-[#5A5A6A] pointer-events-none">$</span>
            <input
              type="number" min={0}
              value={paymentData.monto}
              onChange={e => setPaymentData(p => ({ ...p, monto: e.target.value }))}
              className={[
                'w-full pl-9 pr-4 py-4 rounded-xl text-2xl font-black tabular-nums transition-all duration-200',
                'bg-gray-50 dark:bg-white/[0.05]',
                'border border-gray-200 dark:border-white/[0.08]',
                'text-gray-900 dark:text-white',
                'focus:outline-none focus:bg-white dark:focus:bg-white/[0.08]',
                'focus:border-primary/50 focus:ring-2 focus:ring-primary/10',
              ].join(' ')}
            />
          </div>
          {errors.monto && (
            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-red-500">
              <AlertCircle size={11} />{errors.monto}
            </p>
          )}
        </div>

        {/* Método */}
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-[#6A6A7A] mb-3">
            Método de pago <span className="text-primary">*</span>
          </p>
          <div className="grid grid-cols-3 gap-2.5">
            {(['EFECTIVO', 'TRANSFERENCIA', 'DEBITO'] as const).map(met => (
              <OptionCard
                key={met}
                selected={paymentData.metodo === met}
                onClick={() => setPaymentData(p => ({ ...p, metodo: met }))}
                className="text-center"
              >
                <p className={`text-sm font-black ${paymentData.metodo === met ? 'text-primary' : 'text-gray-900 dark:text-white'}`}>
                  {METODO_LABEL[met]}
                </p>
              </OptionCard>
            ))}
          </div>
          {errors.metodo && (
            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-red-500">
              <AlertCircle size={11} />{errors.metodo}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Fecha del pago" required error={errors.fecha}>
            <input
              type="date"
              value={paymentData.fecha}
              onChange={e => setPaymentData(p => ({ ...p, fecha: e.target.value }))}
              className={ic()}
            />
          </Field>
        </div>
      </div>
    )
  }

  // ── Step 4 — Turno ────────────────────────────────────────────────────────
  function Step4() {
    return (
      <div className="space-y-3">
        {loadingData ? (
          <div className="flex items-center gap-2 text-sm text-gray-400 dark:text-[#6A6A7A] py-3">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-200 dark:border-white/10 border-t-primary" />
            Cargando turnos…
          </div>
        ) : (
          <>
            {/* Lista de turnos existentes */}
            {turnos.length > 0 && (
              <div className="max-h-56 overflow-y-auto pr-1 space-y-2">
                {turnos.map(turno => {
                  const sel = selectedTurnoId === String(turno.id)
                  const pct = turno.capacity > 0 ? Math.round((turno.enrolled / turno.capacity) * 100) : 0
                  return (
                    <OptionCard
                      key={turno.id}
                      selected={sel}
                      onClick={() => setSelectedTurnoId(sel ? null : String(turno.id))}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={[
                              'text-[10px] font-black uppercase tracking-wider rounded-md px-2 py-0.5',
                              sel ? 'bg-primary/20 text-primary' : 'bg-gray-100 dark:bg-white/[0.07] text-gray-600 dark:text-[#8A8A9A]',
                            ].join(' ')}>
                              Sala {turno.room}
                            </span>
                            <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-[#6A6A7A]">
                              <Clock size={10} />
                              {turno.startTime}–{turno.endTime}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {turno.days.map(d => (
                              <span key={d} className={[
                                'text-[9px] font-bold uppercase tracking-wider rounded-md px-1.5 py-0.5',
                                sel ? 'bg-primary/10 text-primary/80' : 'bg-gray-100 dark:bg-white/[0.05] text-gray-500 dark:text-[#5A5A6A]',
                              ].join(' ')}>
                                {WEEKDAY_LABEL[d]}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-[#6A6A7A]">
                            <Users size={10} />
                            {turno.enrolled}/{turno.capacity}
                          </span>
                          <div className="w-14 h-1 rounded-full bg-gray-200 dark:bg-white/[0.08] overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${pct >= 90 ? 'bg-red-400' : pct >= 70 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                              style={{ width: `${Math.min(pct, 100)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </OptionCard>
                  )
                })}
              </div>
            )}

            {/* Formulario inline — nuevo turno */}
            <AnimatePresence>
              {creatingNewTurno && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="rounded-2xl border border-primary/25 bg-primary/[0.04] dark:bg-primary/[0.04] p-4 space-y-4">
                    <p className="text-xs font-black uppercase tracking-widest text-primary">Nuevo turno</p>

                    {/* Días */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-[#6A6A7A]">Días *</label>
                      <div className="flex flex-wrap gap-1.5">
                        {ALL_DAYS.map(d => {
                          const sel = newTurnoForm.days.includes(d)
                          return (
                            <button key={d} type="button"
                              onClick={() => {
                                setNewTurnoErrors(p => ({ ...p, days: '' }))
                                setNewTurnoForm(p => ({
                                  ...p,
                                  days: sel ? p.days.filter(x => x !== d) : [...p.days, d],
                                }))
                              }}
                              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                                sel
                                  ? 'bg-primary text-gray-900 shadow-sm shadow-primary/30'
                                  : 'border border-gray-200 dark:border-white/[0.08] bg-gray-50 dark:bg-white/[0.04] text-gray-500 dark:text-[#8A8A9A] hover:border-primary/40 hover:text-gray-900 dark:hover:text-white'
                              }`}
                            >
                              {WEEKDAY_LABEL[d]}
                            </button>
                          )
                        })}
                      </div>
                      {newTurnoErrors.days && <p className="text-[10px] text-red-500">{newTurnoErrors.days}</p>}
                    </div>

                    {/* Horario */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-[#6A6A7A]">Inicio *</label>
                        <input type="time" value={newTurnoForm.startTime}
                          onChange={e => { setNewTurnoErrors(p => ({ ...p, startTime: '' })); setNewTurnoForm(p => ({ ...p, startTime: e.target.value })) }}
                          className={ic()} />
                        {newTurnoErrors.startTime && <p className="text-[10px] text-red-500">{newTurnoErrors.startTime}</p>}
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-[#6A6A7A]">Fin *</label>
                        <input type="time" value={newTurnoForm.endTime}
                          onChange={e => { setNewTurnoErrors(p => ({ ...p, endTime: '' })); setNewTurnoForm(p => ({ ...p, endTime: e.target.value })) }}
                          className={ic()} />
                        {newTurnoErrors.endTime && <p className="text-[10px] text-red-500">{newTurnoErrors.endTime}</p>}
                      </div>
                    </div>

                    {/* Cupos */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-[#6A6A7A]">Cupo Sala A *</label>
                        <input type="number" min={0} placeholder="Ej. 10" value={newTurnoForm.cupoMaximoSalaA}
                          onChange={e => { setNewTurnoErrors(p => ({ ...p, cupoMaximoSalaA: '' })); setNewTurnoForm(p => ({ ...p, cupoMaximoSalaA: e.target.value })) }}
                          className={ic()} />
                        {newTurnoErrors.cupoMaximoSalaA && <p className="text-[10px] text-red-500">{newTurnoErrors.cupoMaximoSalaA}</p>}
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-[#6A6A7A]">Cupo Sala B *</label>
                        <input type="number" min={0} placeholder="Ej. 10" value={newTurnoForm.cupoMaximoSalaB}
                          onChange={e => { setNewTurnoErrors(p => ({ ...p, cupoMaximoSalaB: '' })); setNewTurnoForm(p => ({ ...p, cupoMaximoSalaB: e.target.value })) }}
                          className={ic()} />
                        {newTurnoErrors.cupoMaximoSalaB && <p className="text-[10px] text-red-500">{newTurnoErrors.cupoMaximoSalaB}</p>}
                      </div>
                    </div>

                    {/* Profesor */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-[#6A6A7A]">Profesor *</label>
                      <select value={newTurnoForm.profesorId}
                        onChange={e => { setNewTurnoErrors(p => ({ ...p, profesorId: '' })); setNewTurnoForm(p => ({ ...p, profesorId: e.target.value })) }}
                        className={ic()}>
                        <option value="">{professors.length === 0 ? 'Sin profesores disponibles' : 'Seleccionar…'}</option>
                        {professors.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                      {newTurnoErrors.profesorId && <p className="text-[10px] text-red-500">{newTurnoErrors.profesorId}</p>}
                    </div>

                    {/* Recurrente */}
                    <label className="flex items-center justify-between gap-4 cursor-pointer select-none">
                      <div>
                        <p className="text-xs font-bold text-gray-900 dark:text-white">Recurrente semanal</p>
                        <p className="text-[10px] text-gray-500 dark:text-[#6A6A7A]">Se repite cada semana</p>
                      </div>
                      <button type="button" onClick={() => setNewTurnoForm(p => ({ ...p, recurrente: !p.recurrente }))}
                        className="relative shrink-0">
                        <div className={`w-10 h-5 rounded-full transition-colors ${newTurnoForm.recurrente ? 'bg-primary' : 'bg-gray-200 dark:bg-white/10'}`} />
                        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${newTurnoForm.recurrente ? 'translate-x-5' : 'translate-x-0.5'}`} />
                      </button>
                    </label>

                    {newTurnoErrors.general && (
                      <p className="text-xs text-red-500 bg-red-50 dark:bg-red-500/10 rounded-xl px-3 py-2">{newTurnoErrors.general}</p>
                    )}

                    {/* Acciones */}
                    <div className="flex gap-2 pt-1">
                      <button type="button" onClick={() => { setCreatingNewTurno(false); setNewTurnoErrors({}) }}
                        className="flex items-center gap-1.5 rounded-xl border border-gray-200 dark:border-white/[0.08] px-4 py-2 text-xs font-semibold text-gray-500 dark:text-white/40 hover:text-gray-900 dark:hover:text-white transition-colors">
                        <X size={12} /> Cancelar
                      </button>
                      <button type="button" onClick={handleCreateNuevoTurno} disabled={savingNewTurno}
                        className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-black text-black hover:bg-primary-dark transition-colors disabled:opacity-40">
                        {savingNewTurno
                          ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-black/20 border-t-black" />
                          : <Check size={12} />}
                        {savingNewTurno ? 'Creando…' : 'Crear turno'}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Botón crear nuevo turno */}
            {!creatingNewTurno && (
              <button type="button" onClick={() => setCreatingNewTurno(true)}
                className="flex items-center gap-2 text-xs font-semibold text-gray-400 dark:text-white/30 hover:text-primary dark:hover:text-primary transition-colors mt-1">
                <Plus size={13} />
                {turnos.length === 0 ? 'No hay turnos — crear uno nuevo' : 'Crear nuevo turno'}
              </button>
            )}
          </>
        )}

        <p className="text-[11px] text-gray-400 dark:text-[#5A5A6A] pt-1 font-medium">
          {selectedTurnoId ? '✓ 1 turno seleccionado' : 'Sin turno seleccionado — podés asignarlo más tarde'}
        </p>
      </div>
    )
  }

  // ── Step 5 — Rutina ───────────────────────────────────────────────────────
  function Step5() {
    const turno = turnos.find(t => String(t.id) === selectedTurnoId)
    const canCreate = !!turno?.profesorId

    return (
      <div className="space-y-5">
        {!canCreate && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/[0.06] px-4 py-3">
            <AlertCircle size={15} className="text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 dark:text-amber-400">
              El turno seleccionado no tiene profesor asignado. Podés crear la rutina desde el perfil del cliente.
            </p>
          </div>
        )}

        <div className={canCreate ? '' : 'opacity-40 pointer-events-none select-none'}>
          <div className="space-y-5">
            <Field label="Nombre de la rutina">
              <input
                value={rutinaData.nombre}
                onChange={e => setRutinaData(p => ({ ...p, nombre: e.target.value }))}
                className={ic()}
              />
            </Field>
            <Field label="Descripción (opcional)">
              <textarea
                value={rutinaData.descripcion}
                onChange={e => setRutinaData(p => ({ ...p, descripcion: e.target.value }))}
                rows={3}
                className={[
                  'w-full px-4 py-3 rounded-xl text-sm transition-all duration-200 resize-none',
                  'bg-gray-50 dark:bg-white/[0.05]',
                  'border border-gray-200 dark:border-white/[0.08]',
                  'text-gray-900 dark:text-white',
                  'placeholder:text-gray-400 dark:placeholder:text-white/30',
                  'focus:outline-none focus:bg-white dark:focus:bg-white/[0.08]',
                  'focus:border-primary/50 focus:ring-2 focus:ring-primary/10',
                ].join(' ')}
              />
            </Field>
          </div>
        </div>

        <div className="flex items-start gap-2.5 rounded-xl border border-white/50 dark:border-white/10 bg-white/40 dark:bg-white/[0.04] px-4 py-3">
          <BookOpen size={13} className="text-gray-400 dark:text-[#5A5A6A] shrink-0 mt-0.5" />
          <p className="text-xs text-gray-500 dark:text-[#6A6A7A]">
            Los ejercicios se agregan desde el perfil del cliente una vez creado.
          </p>
        </div>
      </div>
    )
  }

  // ── Success screen ────────────────────────────────────────────────────────
  function SuccessScreen() {
    if (!createdResult) return null
    const modLabel = MODALIDAD_LABEL[createdResult.modalidad as keyof typeof MODALIDAD_LABEL] ?? createdResult.modalidad
    const metLabel = METODO_LABEL[createdResult.metodo as keyof typeof METODO_LABEL] ?? createdResult.metodo

    const items = [
      { label: 'Cliente registrado', value: createdResult.clientName },
      {
        label: 'Membresía activa',
        value: `${createdResult.planName} · ${modLabel}`,
        sub: (() => {
          try { return `Finaliza el ${format(new Date(createdResult.fechaVencimiento), "d 'de' MMMM yyyy", { locale: es })}` }
          catch { return '' }
        })(),
      },
      { label: 'Pago registrado', value: `${formatCurrency(createdResult.monto)} · ${metLabel}` },
      ...(createdResult.turnoLabel ? [{ label: 'Turno asignado', value: createdResult.turnoLabel }] : []),
      ...(createdResult.rutinaNombre ? [{ label: 'Rutina creada', value: createdResult.rutinaNombre }] : []),
    ]

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="flex flex-col items-center text-center py-2"
      >
        {/* Glowing check square */}
        <div className="relative mb-8">
          <div className="absolute inset-0 rounded-2xl bg-primary/25 blur-2xl scale-150 animate-pulse" />
          <div className="relative h-24 w-24 rounded-2xl bg-gradient-to-br from-primary via-primary to-[#D4A800] flex items-center justify-center shadow-[0_12px_40px_rgba(251,198,8,0.45)]">
            <Check size={44} className="text-black" strokeWidth={2.5} />
          </div>
        </div>

        <h3 className="text-3xl font-black tracking-tight text-gray-900 dark:text-white mb-2">
          ¡Socio registrado!
        </h3>
        <p className="text-sm text-gray-500 dark:text-[#6A6A7A] mb-8 max-w-xs">
          Todos los datos fueron guardados correctamente en el sistema.
        </p>

        {/* Items list */}
        <div className="w-full max-w-md space-y-2 text-left mb-8">
          {items.map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 + i * 0.07, duration: 0.25 }}
              className="flex items-start gap-3 rounded-xl border border-white/50 dark:border-white/10 bg-white/40 dark:bg-white/[0.04] px-4 py-3"
            >
              <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-primary/15 dark:bg-primary/10">
                <Check size={11} className="text-primary" strokeWidth={3} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-[#5A5A6A]">{item.label}</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white mt-0.5 truncate">{item.value}</p>
                {'sub' in item && item.sub && (
                  <p className="text-xs text-primary mt-0.5">{item.sub}</p>
                )}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-3 w-full max-w-xs">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={() => navigate(`/clients/${createdResult.clientId}`)}
          >
            Ver perfil <ChevronRight size={14} />
          </Button>
          <Button
            variant="primary"
            className="flex-1"
            onClick={() => {
              setStep(1)
              setClientData({ nombre: '', apellido: '', cuil: '', email: '', telefono: '' })
              setMembershipData({ planId: '', modalidad: 'EFECTIVO', precio: '', fechaInicio: today })
              setPaymentData({ monto: '', metodo: 'EFECTIVO', fecha: today, comprobante: '' })
              setSelectedTurnoId(null)
              setRutinaData({ nombre: '', descripcion: '' })
              setErrors({})
              setSubmitError(null)
              setCreatedResult(null)
            }}
          >
            Registrar otro
          </Button>
        </div>
      </motion.div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <motion.div {...pageVariants} className="space-y-6">

      {/* Breadcrumb */}
      <button
        onClick={() => navigate('/clients')}
        className="group flex items-center gap-2 text-sm text-gray-400 dark:text-[#5A5A6A] hover:text-gray-900 dark:hover:text-white transition-colors"
      >
        <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
        Volver a Clientes
      </button>

      {/* Header */}
      {step !== 'success' && (
        <div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tighter text-gray-900 dark:text-white leading-none">
            Nuevo socio
          </h1>
          <p className="text-sm text-gray-500 dark:text-[#6A6A7A] mt-2">
            Registrá al cliente, asignale su membresía y el pago en un solo flujo.
          </p>
        </div>
      )}

      {/* Wizard card */}
      <div className="rounded-[2rem] border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-3xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
        {/* Top accent gradient line */}
        <div className="h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

        <div className="p-6 md:p-8">
          {step !== 'success' ? (
            <>
              {Stepper()}

              {/* Step content with animated transition */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.18, ease: 'easeOut' }}
                  className="min-h-[300px]"
                >
                  {typeof step === 'number' && StepHeader({ stepId: step })}
                  {step === 1 && Step1()}
                  {step === 2 && Step2()}
                  {step === 3 && Step3()}
                  {step === 4 && Step4()}
                  {step === 5 && Step5()}
                </motion.div>
              </AnimatePresence>

              {/* Submit error */}
              {submitError && (
                <div className="mt-5 flex items-center gap-3 rounded-xl border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/[0.07] px-4 py-3">
                  <AlertCircle size={15} className="text-red-500 shrink-0" />
                  <p className="text-sm text-red-600 dark:text-red-400">{submitError}</p>
                </div>
              )}

              {/* Navigation */}
              <div className="flex items-center justify-between gap-3 mt-8 pt-6 border-t border-gray-100 dark:border-white/[0.05]">
                <div>
                  {step === 1 ? (
                    <button
                      onClick={() => navigate('/clients')}
                      className="text-sm font-semibold text-gray-400 dark:text-[#5A5A6A] hover:text-gray-700 dark:hover:text-white transition-colors px-3 py-2"
                    >
                      Cancelar
                    </button>
                  ) : (
                    <button
                      onClick={handleBack}
                      disabled={isSubmitting}
                      className="flex items-center gap-1.5 text-sm font-semibold text-gray-400 dark:text-[#5A5A6A] hover:text-gray-700 dark:hover:text-white transition-colors px-3 py-2 disabled:opacity-40"
                    >
                      <ArrowLeft size={14} />
                      Atrás
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {(step === 4 || step === 5) && (
                    <Button
                      variant="secondary"
                      onClick={() => { void handleSubmit() }}
                      isLoading={isSubmitting}
                    >
                      Omitir y finalizar
                    </Button>
                  )}
                  {(step === 1 || step === 2 || step === 3 || step === 4) && (
                    <Button variant="primary" onClick={handleNext}>
                      Continuar →
                    </Button>
                  )}
                  {step === 5 && (
                    <Button
                      variant="primary"
                      onClick={() => { void handleSubmit() }}
                      isLoading={isSubmitting}
                    >
                      Finalizar registro
                    </Button>
                  )}
                </div>
              </div>
            </>
          ) : SuccessScreen()}
        </div>
      </div>

      {/* CSS variable para líneas inactivas */}
      <style>{`
        :root { --line-inactive: rgba(0,0,0,0.08); }
        .dark { --line-inactive: rgba(255,255,255,0.06); }
      `}</style>
    </motion.div>
  )
}
