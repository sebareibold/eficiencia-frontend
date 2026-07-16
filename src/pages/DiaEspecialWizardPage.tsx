import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion'
import { pageVariants } from '../lib/motion'
import {
  Check, ArrowLeft,
  Calendar, Clock, Settings, XCircle, AlertTriangle,
  Users, Dumbbell, Plus, Ban,
} from 'lucide-react'
import { diasEspecialesApi } from '../api/dias-especiales.api'
import { professorsApi } from '../api/shifts.api'
import { useUiStore } from '../store/uiStore'
import { ROUTES } from '../constants/routes'
import Button from '../components/ui/Button'
import type { DiaEspecial, TipoDiaEspecial, TurnoPreviewWizard } from '../types/dias-especiales.types'

// ─── Steps config ─────────────────────────────────────────────────────────────

const STEPS_CIERRE   = [{ id: 1, label: 'Tipo y fecha' }, { id: 4, label: 'Confirmar' }]
const STEPS_REDUCIDO = [
  { id: 1, label: 'Tipo y fecha' },
  { id: 2, label: 'Franja' },
  { id: 3, label: 'Config.' },
  { id: 4, label: 'Confirmar' },
]

type StepMeta = { Icon: React.ComponentType<{ size?: number; className?: string }>; title: string; description: string }
const STEP_META: Record<number, StepMeta> = {
  1: { Icon: Calendar, title: 'Tipo y fecha',           description: 'Elegí la fecha y el tipo de restricción para ese día' },
  2: { Icon: Clock,    title: 'Franja horaria',          description: 'Definí las horas en que el gimnasio opera ese día' },
  3: { Icon: Settings, title: 'Configuración avanzada', description: 'Opciones para los turnos dentro de la franja' },
  4: { Icon: Check,    title: 'Confirmar',               description: 'Revisá el resumen antes de guardar los cambios' },
}

type ModoTurnos = 'puntuales' | 'excepciones' | null

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Genera slots de 1h dentro de una franja, lado cliente */
function getSlots(desde: string, hasta: string): { inicio: string; fin: string }[] {
  const slots: { inicio: string; fin: string }[] = []
  const [startH, startM] = desde.split(':').map(Number)
  const [endH, endM] = hasta.split(':').map(Number)
  const endMin = endH * 60 + endM
  let h = startH
  const m = startM
  const pad = (n: number) => String(n).padStart(2, '0')
  while (h * 60 + m < endMin) {
    const nextH = h + 1
    if (nextH * 60 + m <= endMin) {
      slots.push({ inicio: `${pad(h)}:${pad(m)}`, fin: `${pad(nextH)}:${pad(m)}` })
    }
    h = nextH
  }
  return slots
}

// ─── ic() — clases de input ───────────────────────────────────────────────────

const ic = () => [
  'w-full rounded-xl py-3 px-4 text-sm transition-all duration-200',
  'bg-gray-50 dark:bg-white/[0.05]',
  'border border-gray-200 dark:border-white/[0.08]',
  'text-gray-900 dark:text-white',
  'placeholder:text-gray-400 dark:placeholder:text-white/30',
  'focus:outline-none focus:bg-white dark:focus:bg-white/[0.08]',
  'focus:border-primary/50 dark:focus:border-primary/40',
  'focus:ring-2 focus:ring-primary/10',
  'hover:border-gray-300 dark:hover:border-white/[0.14]',
].join(' ')

// ─── OptionCard ───────────────────────────────────────────────────────────────

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
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.12, ease: [0.23, 1, 0.32, 1] }}
      className={[
        'relative text-left rounded-2xl border p-4 transition-[border-color,background,box-shadow] duration-200 overflow-hidden w-full',
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
    </motion.button>
  )
}

// ─── Field ────────────────────────────────────────────────────────────────────

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string
  required?: boolean
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-[#6A6A7A] flex items-center gap-1">
        {label}
        {required && <span className="text-primary text-[10px]">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-gray-500 dark:text-[#6A6A7A] leading-snug mt-1">{hint}</p>}
    </div>
  )
}

// ─── ToggleSwitch ─────────────────────────────────────────────────────────────

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
        checked ? 'bg-primary' : 'bg-gray-200 dark:bg-white/[0.12]'
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  )
}

// ─── Página principal ──────────────────────────────────────────────────────────

export default function DiaEspecialWizardPage() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const { id }    = useParams<{ id: string }>()
  const addToast  = useUiStore(s => s.addToast)
  const isEditing = !!id

  const diaExistente: DiaEspecial | undefined = (location.state as { dia?: DiaEspecial })?.dia

  // Step 1
  const [step, setStep]     = useState<1 | 2 | 3 | 4>(1)
  const [fecha, setFecha]   = useState(diaExistente?.fecha?.slice(0, 10) ?? '')
  const [tipo, setTipo]     = useState<TipoDiaEspecial>(diaExistente?.tipo ?? 'CIERRE_TOTAL')
  const [motivo, setMotivo] = useState(diaExistente?.motivo ?? '')

  // Step 2
  const [horaDesde, setHoraDesde] = useState(diaExistente?.horaDesde ?? '')
  const [horaHasta, setHoraHasta] = useState(diaExistente?.horaHasta ?? '')

  // Step 3 — modo de turnos
  const [modoTurnos, setModoTurnos] = useState<ModoTurnos>(null)

  // Step 3 — configuración compartida (cupos y profesores)
  const [configurarCupos, setConfigurarCupos] = useState(false)
  const [cupoSalaA, setCupoSalaA]             = useState('')
  const [cupoSalaB, setCupoSalaB]             = useState('')
  const [asignarProfesor, setAsignarProfesor] = useState(false)
  const [profesorSalaAId, setProfesorSalaAId] = useState('')
  const [profesorSalaBId, setProfesorSalaBId] = useState('')

  const [profesores, setProfesores]         = useState<{ id: string; name: string }[]>([])
  const [turnosPreview, setTurnosPreview]   = useState<TurnoPreviewWizard[]>([])
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [isSaving, setIsSaving]             = useState(false)

  useEffect(() => {
    professorsApi.getAll().then(setProfesores).catch(() => {})
  }, [])

  const loadPreview = useCallback(async () => {
    if (tipo !== 'HORARIO_REDUCIDO') return
    setLoadingPreview(true)
    try {
      const data = await diasEspecialesApi.preview(fecha, horaDesde || undefined, horaHasta || undefined)
      setTurnosPreview(data)
    } catch {
      setTurnosPreview([])
    } finally {
      setLoadingPreview(false)
    }
  }, [tipo, fecha, horaDesde, horaHasta])

  function goNext() {
    if (step === 1) {
      if (tipo === 'CIERRE_TOTAL') setStep(4)
      else setStep(2)
    } else if (step === 2) {
      setStep(3)
    } else if (step === 3) {
      setStep(4)
      void loadPreview()
    }
  }

  function goBack() {
    if (step === 2) setStep(1)
    else if (step === 3) setStep(2)
    else if (step === 4) {
      if (tipo === 'CIERRE_TOTAL') setStep(1)
      else setStep(3)
    } else {
      navigate(ROUTES.SHIFTS)
    }
  }

  function canGoNext(): boolean {
    if (step === 1) return !!fecha
    if (step === 2) return !!horaDesde && !!horaHasta && horaDesde < horaHasta
    return true
  }

  async function handleConfirmar() {
    setIsSaving(true)
    try {
      if (isEditing && id) {
        await diasEspecialesApi.update(id, {
          fecha,
          tipo,
          motivo: motivo || undefined,
          horaDesde: tipo === 'HORARIO_REDUCIDO' ? horaDesde : undefined,
          horaHasta: tipo === 'HORARIO_REDUCIDO' ? horaHasta : undefined,
        })
        addToast('Día especial actualizado', 'success')
      } else {
        const esPuntuales   = modoTurnos === 'puntuales'
        const esExcepciones = modoTurnos === 'excepciones'
        const result = await diasEspecialesApi.configurar({
          fecha,
          tipo,
          motivo: motivo || undefined,
          horaDesde: tipo === 'HORARIO_REDUCIDO' ? horaDesde : undefined,
          horaHasta: tipo === 'HORARIO_REDUCIDO' ? horaHasta : undefined,
          crearTurnosPuntuales:  esPuntuales  || undefined,
          autoCrearExcepciones:  esExcepciones || undefined,
          cupoSalaA: esPuntuales
            ? (cupoSalaA ? parseInt(cupoSalaA) : undefined)
            : (configurarCupos && cupoSalaA ? parseInt(cupoSalaA) : undefined),
          cupoSalaB: esPuntuales
            ? (cupoSalaB ? parseInt(cupoSalaB) : undefined)
            : (configurarCupos && cupoSalaB ? parseInt(cupoSalaB) : undefined),
          profesorSalaAId: (asignarProfesor && profesorSalaAId) ? profesorSalaAId : undefined,
          profesorSalaBId: (asignarProfesor && profesorSalaBId) ? profesorSalaBId : undefined,
        })

        const t = result.turnosCreados ?? 0
        const c = result.cancelacionesCreadas ?? 0
        const e = result.excepcionesCreadas ?? 0
        let extras = ''
        if (t > 0) extras += ` · ${t} turno${t !== 1 ? 's' : ''} creado${t !== 1 ? 's' : ''}`
        if (c > 0) extras += ` · ${c} cancelaci${c !== 1 ? 'ones' : 'ón'}`
        if (e > 0) extras += ` · ${e} excepci${e !== 1 ? 'ones' : 'ón'}`
        addToast(`Día especial creado${extras}`, 'success')
      }
      navigate(ROUTES.SHIFTS)
    } catch (err: unknown) {
      const apiMsg = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message
      const msg = Array.isArray(apiMsg) ? apiMsg[0] : (apiMsg ?? 'Error al guardar')
      addToast(msg, 'error')
    } finally {
      setIsSaving(false)
    }
  }

  // ─── Stepper ─────────────────────────────────────────────────────────────────

  function StepperComp() {
    const steps      = tipo === 'CIERRE_TOTAL' ? STEPS_CIERRE : STEPS_REDUCIDO
    const displayIdx = steps.findIndex(s => s.id === step)

    return (
      <LayoutGroup id="wizard-stepper">
        <div className="flex items-start mb-8">
          <AnimatePresence mode="popLayout" initial={false}>
            {steps.map((s, idx) => {
              const done        = idx < displayIdx
              const curr        = idx === displayIdx
              const enterDelay  = s.id === 3 ? 0.055 : 0

              return (
                <motion.div
                  key={s.id}
                  layout
                  initial={{ opacity: 0, scale: 0.85, y: -6 }}
                  animate={{ opacity: 1, scale: 1,    y: 0   }}
                  exit={{
                    opacity: 0, scale: 0.85, y: -6,
                    transition: { duration: 0.14, ease: [0.23, 1, 0.32, 1] },
                  }}
                  transition={{
                    layout:  { type: 'spring', duration: 0.4, bounce: 0.1 },
                    opacity: { duration: 0.22, ease: [0.23, 1, 0.32, 1], delay: enterDelay },
                    scale:   { duration: 0.26, ease: [0.23, 1, 0.32, 1], delay: enterDelay },
                    y:       { duration: 0.26, ease: [0.23, 1, 0.32, 1], delay: enterDelay },
                  }}
                  className="flex-1 flex flex-col items-center relative min-w-0"
                >
                  {idx > 0 && (
                    <div
                      className="absolute z-10 h-px top-[18px] -translate-y-1/2 transition-[background] duration-300"
                      style={{
                        left: 0, right: '50%',
                        background: done || curr
                          ? 'linear-gradient(90deg, rgba(251,198,8,0.25), rgba(251,198,8,0.7))'
                          : 'var(--line-inactive)',
                      }}
                    />
                  )}
                  {idx < steps.length - 1 && (
                    <div
                      className="absolute z-10 h-px top-[18px] -translate-y-1/2 transition-[background] duration-300"
                      style={{
                        left: '50%', right: 0,
                        background: done
                          ? 'linear-gradient(90deg, rgba(251,198,8,0.7), rgba(251,198,8,0.25))'
                          : 'var(--line-inactive)',
                      }}
                    />
                  )}

                  <div className={[
                    'relative z-20 flex h-10 w-10 items-center justify-center rounded-xl text-sm font-black transition-[background-color,box-shadow,transform,border-color] duration-300',
                    curr
                      ? 'bg-primary text-black ring-4 ring-primary/25 shadow-[0_0_24px_rgba(251,198,8,0.45),0_0_48px_rgba(251,198,8,0.18)] scale-110'
                      : done
                        ? 'bg-primary text-black/80 border-2 border-primary/80 shadow-[0_2px_10px_rgba(251,198,8,0.30)]'
                        : 'bg-white dark:bg-[#111] border-2 border-gray-300 dark:border-white/[0.18] text-gray-500 dark:text-white/50 shadow-[0_2px_8px_rgba(0,0,0,0.08)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.4)]',
                  ].join(' ')}>
                    {done ? <Check size={14} strokeWidth={2.5} /> : idx + 1}
                  </div>

                  <span className={[
                    'mt-2 text-[10px] font-bold uppercase tracking-wider text-center',
                    curr ? 'text-gray-900 dark:text-white'
                      : done ? 'text-primary'
                        : 'text-gray-400 dark:text-[#4A4A5A]',
                  ].join(' ')}>
                    {s.label}
                  </span>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      </LayoutGroup>
    )
  }

  // ─── Step header ──────────────────────────────────────────────────────────────

  function StepHeader({ stepId }: { stepId: number }) {
    const meta = STEP_META[stepId]
    if (!meta) return null
    const steps    = tipo === 'CIERRE_TOTAL' ? STEPS_CIERRE : STEPS_REDUCIDO
    const currIdx  = steps.findIndex(s => s.id === stepId)
    const { Icon } = meta
    return (
      <div className="flex items-center gap-4 mb-6 pb-5 border-b border-gray-100 dark:border-white/[0.05]">
        <div className="shrink-0 h-11 w-11 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 dark:from-primary/10 dark:to-primary/[0.03] flex items-center justify-center border border-primary/20 dark:border-primary/15">
          <Icon size={18} className="text-primary" />
        </div>
        <div>
          <h2 className="text-base font-black text-gray-900 dark:text-white tracking-tight">{meta.title}</h2>
          <p className="text-xs text-gray-500 dark:text-[#6A6A7A] mt-0.5">{meta.description}</p>
        </div>
        <div className="ml-auto shrink-0 text-right">
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-300 dark:text-[#3A3A4A]">
            Paso {currIdx + 1}/{steps.length}
          </span>
        </div>
      </div>
    )
  }

  // ─── Step 1 — Tipo y fecha ────────────────────────────────────────────────────

  function Step1() {
    return (
      <div className="space-y-5">
        <Field label="Fecha" required>
          <input
            type="date"
            value={fecha}
            onChange={e => setFecha(e.target.value)}
            className={ic()}
          />
        </Field>

        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-[#6A6A7A] mb-3">
            Tipo de restricción <span className="text-primary">*</span>
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <OptionCard
              selected={tipo === 'CIERRE_TOTAL'}
              onClick={() => {
                setTipo('CIERRE_TOTAL')
                setHoraDesde(''); setHoraHasta('')
                setModoTurnos(null)
                setConfigurarCupos(false); setAsignarProfesor(false)
              }}
            >
              <div className="flex items-center gap-2.5 mb-2">
                <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                  tipo === 'CIERRE_TOTAL' ? 'bg-red-500/15' : 'bg-gray-100 dark:bg-white/[0.06]'
                }`}>
                  <XCircle size={16} className={tipo === 'CIERRE_TOTAL' ? 'text-red-500' : 'text-gray-400 dark:text-[#6A6A7A]'} />
                </div>
                <p className="text-sm font-black text-gray-900 dark:text-white pr-6 leading-tight">Cierre total</p>
              </div>
              <p className="text-xs text-gray-500 dark:text-[#6A6A7A] leading-snug">
                El gimnasio no abre ese día. Todos los turnos quedan bloqueados.
              </p>
            </OptionCard>

            <OptionCard
              selected={tipo === 'HORARIO_REDUCIDO'}
              onClick={() => setTipo('HORARIO_REDUCIDO')}
            >
              <div className="flex items-center gap-2.5 mb-2">
                <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                  tipo === 'HORARIO_REDUCIDO' ? 'bg-amber-500/15' : 'bg-gray-100 dark:bg-white/[0.06]'
                }`}>
                  <Clock size={16} className={tipo === 'HORARIO_REDUCIDO' ? 'text-amber-500' : 'text-gray-400 dark:text-[#6A6A7A]'} />
                </div>
                <p className="text-sm font-black text-gray-900 dark:text-white pr-6 leading-tight">Horario reducido</p>
              </div>
              <p className="text-xs text-gray-500 dark:text-[#6A6A7A] leading-snug">
                Opera en un rango de horas reducido. Los turnos fuera de la franja quedan bloqueados.
              </p>
            </OptionCard>
          </div>
        </div>

        <Field label="Motivo" hint="Opcional. Se muestra en el banner de advertencia al registrar asistencia.">
          <input
            type="text"
            value={motivo}
            onChange={e => setMotivo(e.target.value)}
            placeholder="Ej: Feriado nacional, mantenimiento…"
            className={ic()}
          />
        </Field>
      </div>
    )
  }

  // ─── Step 2 — Franja horaria ──────────────────────────────────────────────────

  function Step2() {
    const error = horaDesde && horaHasta && horaDesde >= horaHasta
    return (
      <div className="space-y-5">
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/[0.06] px-4 py-3">
          <AlertTriangle size={15} className="text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-0.5">¿Cómo funciona?</p>
            <p className="text-xs text-amber-700/80 dark:text-amber-400/80 leading-relaxed">
              Solo los turnos cuya hora de inicio y fin caen <span className="font-semibold">dentro</span> de este rango
              funcionarán ese día. Los que caigan fuera quedarán bloqueados automáticamente.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Hora de apertura" required>
            <input type="time" value={horaDesde} onChange={e => setHoraDesde(e.target.value)} className={ic()} />
          </Field>
          <Field label="Hora de cierre" required>
            <input type="time" value={horaHasta} onChange={e => setHoraHasta(e.target.value)} className={ic()} />
          </Field>
        </div>

        {error && (
          <p className="text-xs text-red-400 flex items-center gap-1.5">
            <AlertTriangle size={12} /> La hora de apertura debe ser anterior al cierre
          </p>
        )}

        {horaDesde && horaHasta && !error && (
          <div className="flex items-center gap-3 rounded-xl border border-white/50 dark:border-white/10 bg-white/40 dark:bg-white/[0.04] px-4 py-3">
            <Clock size={14} className="text-primary shrink-0" />
            <p className="text-sm text-gray-700 dark:text-gray-300">
              El gimnasio abre de <span className="font-bold text-primary">{horaDesde}</span> a{' '}
              <span className="font-bold text-primary">{horaHasta}</span>.
            </p>
          </div>
        )}
      </div>
    )
  }

  // ─── Step 3 — Configuración ───────────────────────────────────────────────────

  function Step3() {
    return (
      <div className="space-y-4">

        {/* Selector de modo */}
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-[#6A6A7A] mb-3">
            ¿Qué hacer con los turnos de ese día?
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

            {/* Sin cambios */}
            <OptionCard selected={modoTurnos === null} onClick={() => setModoTurnos(null)}>
              <div className="flex items-center gap-2.5 mb-1.5">
                <div className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${
                  modoTurnos === null ? 'bg-gray-400/15' : 'bg-gray-100 dark:bg-white/[0.06]'
                }`}>
                  <Settings size={14} className="text-gray-400 dark:text-[#6A6A7A]" />
                </div>
                <p className="text-sm font-black text-gray-900 dark:text-white pr-6 leading-tight">Sin cambios</p>
              </div>
              <p className="text-xs text-gray-500 dark:text-[#6A6A7A] leading-snug">
                Los turnos habituales siguen activos (solo se bloquea asistencia fuera de la franja).
              </p>
            </OptionCard>

            {/* Crear turnos puntuales */}
            <OptionCard selected={modoTurnos === 'puntuales'} onClick={() => setModoTurnos('puntuales')}>
              <div className="flex items-center gap-2.5 mb-1.5">
                <div className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${
                  modoTurnos === 'puntuales' ? 'bg-primary/15' : 'bg-gray-100 dark:bg-white/[0.06]'
                }`}>
                  <Plus size={14} className={modoTurnos === 'puntuales' ? 'text-primary' : 'text-gray-400 dark:text-[#6A6A7A]'} />
                </div>
                <p className="text-sm font-black text-gray-900 dark:text-white pr-6 leading-tight">Turnos excepcionales</p>
              </div>
              <p className="text-xs text-gray-500 dark:text-[#6A6A7A] leading-snug">
                Genera turnos de 1h dentro de la franja. Los recurrentes de ese día quedan cancelados.
              </p>
            </OptionCard>

            {/* Ajustar existentes */}
            <OptionCard selected={modoTurnos === 'excepciones'} onClick={() => setModoTurnos('excepciones')}>
              <div className="flex items-center gap-2.5 mb-1.5">
                <div className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${
                  modoTurnos === 'excepciones' ? 'bg-blue-500/15' : 'bg-gray-100 dark:bg-white/[0.06]'
                }`}>
                  <Dumbbell size={14} className={modoTurnos === 'excepciones' ? 'text-blue-400' : 'text-gray-400 dark:text-[#6A6A7A]'} />
                </div>
                <p className="text-sm font-black text-gray-900 dark:text-white pr-6 leading-tight">Ajustar existentes</p>
              </div>
              <p className="text-xs text-gray-500 dark:text-[#6A6A7A] leading-snug">
                Modifica cupo y/o profesor de los turnos recurrentes dentro de la franja para ese día.
              </p>
            </OptionCard>

          </div>
        </div>

        {/* Config: cupos y profesor (modo puntuales o excepciones) */}
        {(modoTurnos === 'puntuales' || modoTurnos === 'excepciones') && (
          <AnimatePresence mode="wait">
            <motion.div
              key={modoTurnos}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
              className="space-y-3"
            >

              {/* Cupos */}
              <div className="rounded-2xl border border-gray-200 dark:border-white/[0.08] bg-white/[0.02] p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-0.5">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
                      <Users size={14} className="text-primary shrink-0" />
                      {modoTurnos === 'puntuales' ? 'Cupo de los nuevos turnos' : 'Configurar cupos'}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-[#8A8A9A] leading-snug">
                      {modoTurnos === 'puntuales'
                        ? 'Cupo por sala para los turnos excepcionales. Por defecto: 10 por sala.'
                        : 'Ajustá el cupo por sala para ese día. Si no lo cambiás, se hereda del turno original.'}
                    </p>
                  </div>
                  {modoTurnos === 'excepciones' && (
                    <ToggleSwitch checked={configurarCupos} onChange={setConfigurarCupos} />
                  )}
                </div>
                {(modoTurnos === 'puntuales' || configurarCupos) && (
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <Field label="Cupo Sala A">
                      <input
                        type="number" min={0}
                        value={cupoSalaA}
                        onChange={e => setCupoSalaA(e.target.value)}
                        placeholder={modoTurnos === 'puntuales' ? '10' : 'Heredar'}
                        className={ic()}
                      />
                    </Field>
                    <Field label="Cupo Sala B">
                      <input
                        type="number" min={0}
                        value={cupoSalaB}
                        onChange={e => setCupoSalaB(e.target.value)}
                        placeholder={modoTurnos === 'puntuales' ? '10' : 'Heredar'}
                        className={ic()}
                      />
                    </Field>
                  </div>
                )}
              </div>

              {/* Profesor por sala */}
              <div className="rounded-2xl border border-gray-200 dark:border-white/[0.08] bg-white/[0.02] p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-0.5">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
                      <Settings size={14} className="text-primary shrink-0" />
                      Asignar profesor por sala
                    </p>
                    <p className="text-xs text-gray-400 dark:text-[#8A8A9A] leading-snug">
                      {modoTurnos === 'puntuales'
                        ? 'Opcional. Asigná un profesor a los turnos excepcionales.'
                        : 'Elegí un profesor diferente para ese día. Si no lo cambiás, se hereda del turno original.'}
                    </p>
                  </div>
                  <ToggleSwitch checked={asignarProfesor} onChange={setAsignarProfesor} />
                </div>
                {asignarProfesor && (
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <Field label="Profesor Sala A">
                      <select value={profesorSalaAId} onChange={e => setProfesorSalaAId(e.target.value)} className={ic()}>
                        <option value="">{modoTurnos === 'puntuales' ? 'Sin asignar' : 'Heredar del turno'}</option>
                        {profesores.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </Field>
                    <Field label="Profesor Sala B">
                      <select value={profesorSalaBId} onChange={e => setProfesorSalaBId(e.target.value)} className={ic()}>
                        <option value="">{modoTurnos === 'puntuales' ? 'Sin asignar' : 'Heredar del turno'}</option>
                        {profesores.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </Field>
                  </div>
                )}
              </div>

            </motion.div>
          </AnimatePresence>
        )}
      </div>
    )
  }

  // ─── Step 4 — Confirmar ───────────────────────────────────────────────────────

  function Step4() {
    const esCierre = tipo === 'CIERRE_TOTAL'
    const slots    = (!esCierre && horaDesde && horaHasta) ? getSlots(horaDesde, horaHasta) : []

    return (
      <div className="space-y-5">
        {/* Resumen */}
        <div className={`rounded-2xl border px-5 py-4 space-y-3 ${
          esCierre ? 'bg-red-500/5 border-red-500/20' : 'bg-amber-500/5 border-amber-500/20'
        }`}>
          <div className="flex items-center gap-2">
            {esCierre
              ? <XCircle size={18} className="text-red-400" />
              : <Clock size={18} className="text-amber-400" />
            }
            <p className={`font-semibold text-sm ${esCierre ? 'text-red-500' : 'text-amber-500'}`}>
              {esCierre ? 'Cierre total' : 'Horario reducido'}
            </p>
          </div>
          <div className="text-sm text-gray-700 dark:text-gray-300 space-y-1.5">
            <p>
              <span className="font-semibold">Fecha:</span>{' '}
              {fecha
                ? new Date(fecha + 'T12:00:00Z').toLocaleDateString('es-AR', {
                    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                  })
                : '—'}
            </p>
            {!esCierre && horaDesde && horaHasta && (
              <p><span className="font-semibold">Franja:</span> {horaDesde} – {horaHasta}</p>
            )}
            {motivo && (
              <p><span className="font-semibold">Motivo:</span> {motivo}</p>
            )}
          </div>
        </div>

        {/* Qué va a pasar */}
        {esCierre ? (
          <div className="rounded-2xl border border-gray-200 dark:border-white/[0.08] px-5 py-4 text-sm text-gray-600 dark:text-gray-300">
            <p className="font-semibold text-gray-900 dark:text-white mb-1">¿Qué va a pasar?</p>
            <p>
              Todos los turnos de ese día quedarán{' '}
              <span className="text-red-400 font-semibold">bloqueados</span>. No se podrá registrar
              asistencia ni hacer inscripciones puntuales para esa fecha.
            </p>
          </div>
        ) : modoTurnos === 'puntuales' ? (

          /* Preview modo A: turnos puntuales */
          <div className="rounded-2xl border border-gray-200 dark:border-white/[0.08] px-5 py-4 text-sm text-gray-600 dark:text-gray-300 space-y-4">
            <p className="font-semibold text-gray-900 dark:text-white">¿Qué va a pasar?</p>

            {/* Turnos a crear */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Plus size={14} className="text-primary shrink-0" />
                <p className="font-semibold text-gray-900 dark:text-white text-xs uppercase tracking-widest">
                  Se crearán {slots.length} turno{slots.length !== 1 ? 's' : ''} excepcional{slots.length !== 1 ? 'es' : ''}
                </p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1">
                {slots.map(s => (
                  <div key={s.inicio} className="flex items-center gap-1.5 rounded-lg bg-primary/8 dark:bg-primary/[0.08] border border-primary/20 px-2.5 py-1.5">
                    <Clock size={11} className="text-primary shrink-0" />
                    <span className="text-xs font-bold text-gray-900 dark:text-white">{s.inicio}</span>
                    <span className="text-[10px] text-gray-400">→ {s.fin}</span>
                  </div>
                ))}
              </div>
              {(cupoSalaA || cupoSalaB) && (
                <p className="text-xs text-gray-400 dark:text-[#8A8A9A]">
                  Cupo: Sala A {cupoSalaA || '10'} · Sala B {cupoSalaB || '10'}
                  {asignarProfesor && profesorSalaAId && (
                    <> · Profe A: {profesores.find(p => p.id === profesorSalaAId)?.name}</>
                  )}
                  {asignarProfesor && profesorSalaBId && (
                    <> · Profe B: {profesores.find(p => p.id === profesorSalaBId)?.name}</>
                  )}
                </p>
              )}
            </div>

            {/* Turnos a cancelar */}
            {loadingPreview ? (
              <div className="space-y-1.5">
                {[1, 2].map(i => (
                  <div key={i} className="h-7 rounded-lg bg-black/[0.04] dark:bg-white/[0.04] animate-pulse" />
                ))}
              </div>
            ) : turnosPreview.length > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Ban size={14} className="text-red-400 shrink-0" />
                  <p className="font-semibold text-gray-900 dark:text-white text-xs uppercase tracking-widest">
                    Se cancelarán {turnosPreview.length} turno{turnosPreview.length !== 1 ? 's' : ''} recurrente{turnosPreview.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="divide-y divide-gray-100 dark:divide-white/[0.04]">
                  {turnosPreview.map(t => (
                    <div key={t.id} className="flex items-center gap-2 py-1.5 text-xs">
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {t.horaInicio} – {t.horaFin}
                      </span>
                      <span className="text-red-400 font-semibold ml-auto">Cancelado este día</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-400 dark:text-[#8A8A9A]">
                No hay turnos recurrentes en ese día de semana que cancelar.
              </p>
            )}
          </div>

        ) : (

          /* Preview modo B o sin modo: turnos existentes */
          <div className="rounded-2xl border border-gray-200 dark:border-white/[0.08] px-5 py-4 text-sm text-gray-600 dark:text-gray-300 space-y-3">
            <p className="font-semibold text-gray-900 dark:text-white">¿Qué va a pasar?</p>
            {loadingPreview ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-8 rounded-lg bg-black/[0.04] dark:bg-white/[0.04] animate-pulse" />
                ))}
              </div>
            ) : turnosPreview.length === 0 ? (
              <div className="space-y-2">
                <p className="text-[#8A8A9A]">
                  No se encontraron turnos recurrentes que operen ese día de semana dentro de la franja.
                </p>
                {modoTurnos === 'excepciones' && (
                  <p className="text-amber-500 dark:text-amber-400 text-xs flex items-start gap-1.5">
                    <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                    La opción &quot;Ajustar existentes&quot; no tendrá efecto porque no hay turnos en esa franja.
                  </p>
                )}
              </div>
            ) : (
              <>
                <p>
                  Los turnos con horario dentro de la franja ({horaDesde}–{horaHasta}) funcionarán
                  normalmente ese día.
                  {modoTurnos === 'excepciones' && (
                    <>
                      {' '}Se crearán{' '}
                      <span className="font-bold text-primary">{turnosPreview.length}</span>
                      {' '}excepci{turnosPreview.length !== 1 ? 'ones' : 'ón'} con la configuración indicada.
                    </>
                  )}
                </p>
                <div className="divide-y divide-gray-100 dark:divide-white/[0.04]">
                  {turnosPreview.map(t => {
                    const profA = t.profesorSalaA?.usuario.nombre
                      ?? (asignarProfesor && profesorSalaAId
                        ? profesores.find(p => p.id === profesorSalaAId)?.name
                        : null)
                    const profB = t.profesorSalaB?.usuario.nombre
                      ?? (asignarProfesor && profesorSalaBId
                        ? profesores.find(p => p.id === profesorSalaBId)?.name
                        : null)
                    const cupoA = configurarCupos && cupoSalaA ? cupoSalaA : t.cupoMaximoSalaA
                    const cupoB = configurarCupos && cupoSalaB ? cupoSalaB : t.cupoMaximoSalaB
                    return (
                      <div key={t.id} className="flex items-center justify-between py-2 text-xs">
                        <div className="flex items-center gap-2">
                          <Dumbbell size={12} className="text-primary shrink-0" />
                          <span className="font-semibold text-gray-900 dark:text-white">
                            {t.horaInicio} – {t.horaFin}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[#8A8A9A]">
                          {modoTurnos === 'excepciones' && (
                            <>
                              <span>A: {cupoA}p{profA ? ` · ${profA}` : ''}</span>
                              <span>B: {cupoB}p{profB ? ` · ${profB}` : ''}</span>
                            </>
                          )}
                          <span className="text-green-400 font-semibold">Activo</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    )
  }

  // ─── Render ───────────────────────────────────────────────────────────────────

  const isLastStep = step === 4

  return (
    <motion.div {...pageVariants} className="space-y-6">

      {/* Breadcrumb */}
      <button
        onClick={() => navigate(ROUTES.SHIFTS)}
        className="group flex items-center gap-2 text-sm text-gray-400 dark:text-[#5A5A6A] hover:text-gray-900 dark:hover:text-white transition-colors"
      >
        <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
        Volver a Turnos
      </button>

      {/* Header */}
      <div>
        <h1 className="text-3xl md:text-4xl font-black tracking-tighter text-gray-900 dark:text-white leading-none">
          {isEditing ? 'Editar día especial' : 'Nuevo día especial'}
        </h1>
        <p className="text-sm text-gray-500 dark:text-[#6A6A7A] mt-2">
          {isEditing
            ? 'Modificá los datos del día especial registrado.'
            : 'Configurá una restricción para una fecha específica del calendario.'}
        </p>
      </div>

      {/* Wizard card */}
      <div className="rounded-[2rem] border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-3xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
        {/* Top accent gradient line */}
        <div className="h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

        <div className="p-6 md:p-8">
          {StepperComp()}

          {/* Step content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="min-h-[300px]"
            >
              {StepHeader({ stepId: step })}
              {step === 1 && Step1()}
              {step === 2 && Step2()}
              {step === 3 && Step3()}
              {step === 4 && Step4()}
            </motion.div>
          </AnimatePresence>

          {/* Navigation */}
          <div className="flex items-center justify-between gap-3 mt-8 pt-6 border-t border-gray-100 dark:border-white/[0.05]">
            <div>
              {step === 1 ? (
                <button
                  onClick={() => navigate(ROUTES.SHIFTS)}
                  className="text-sm font-semibold text-gray-400 dark:text-[#5A5A6A] hover:text-gray-700 dark:hover:text-white transition-colors px-3 py-2"
                >
                  Cancelar
                </button>
              ) : (
                <button
                  onClick={goBack}
                  disabled={isSaving}
                  className="flex items-center gap-1.5 text-sm font-semibold text-gray-400 dark:text-[#5A5A6A] hover:text-gray-700 dark:hover:text-white transition-colors px-3 py-2 disabled:opacity-40"
                >
                  <ArrowLeft size={14} />
                  Atrás
                </button>
              )}
            </div>

            <div>
              {!isLastStep ? (
                <Button
                  variant="primary"
                  disabled={!canGoNext()}
                  onClick={goNext}
                >
                  Continuar →
                </Button>
              ) : (
                <Button
                  variant="primary"
                  isLoading={isSaving}
                  disabled={loadingPreview}
                  onClick={() => { void handleConfirmar() }}
                >
                  {isEditing ? 'Guardar cambios' : 'Confirmar'}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* CSS variable para líneas inactivas del stepper */}
      <style>{`
        :root { --line-inactive: rgba(0,0,0,0.08); }
        .dark { --line-inactive: rgba(255,255,255,0.06); }
      `}</style>
    </motion.div>
  )
}
