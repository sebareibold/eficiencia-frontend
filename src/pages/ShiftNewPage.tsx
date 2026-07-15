import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { pageVariants } from '../lib/motion'

const ease = [0.22, 1, 0.36, 1] as const
const cardAnim = (delay: number) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease, delay } },
})

import { createPortal } from 'react-dom'
import {
  ArrowLeft, Calendar, Users, ChevronRight, X, Check,
  CheckCircle2, ExternalLink, Clock, Repeat2,
} from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { shiftsApi, professorsApi } from '../api/shifts.api'
import { inscripcionesApi } from '../api/inscripciones.api'
import { useClients } from '../hooks/useClients'
import { useUiStore } from '../store/uiStore'
import { ROUTES } from '../constants/routes'
import { QK } from '../lib/queryKeys'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import type { WeekDay, Shift } from '../types/shift.types'

// ── Schema ────────────────────────────────────────────────────────────────────

const schema = z.object({
  days:            z.array(
    z.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'])
  ).min(1, 'Seleccioná al menos un día'),
  recurrente:      z.boolean().default(true),
  startTime:       z.string().min(1, 'La hora de inicio es requerida'),
  endTime:         z.string().min(1, 'La hora de fin es requerida'),
  cupoMaximoSalaA: z.string().refine(v => v !== '' && !isNaN(Number(v)) && Number(v) >= 0, 'Cupo inválido'),
  cupoMaximoSalaB: z.string().refine(v => v !== '' && !isNaN(Number(v)) && Number(v) >= 0, 'Cupo inválido'),
  profesorSalaAId: z.string().optional(),
  profesorSalaBId: z.string().optional(),
  clientIdsA:      z.array(z.string()),
  clientIdsB:      z.array(z.string()),
})
type FormValues = z.infer<typeof schema>

const DAYS: WeekDay[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

const DAY_LABELS: Record<WeekDay, string> = {
  monday: 'Lunes', tuesday: 'Martes', wednesday: 'Miércoles',
  thursday: 'Jueves', friday: 'Viernes', saturday: 'Sábado', sunday: 'Domingo',
}

// ── Success modal data ────────────────────────────────────────────────────────

interface CreatedShiftInfo {
  id: string
  days: WeekDay[]
  startTime: string
  endTime: string
  profesorSalaANombre: string
  profesorSalaBNombre: string
  cupoSalaA: number
  cupoSalaB: number
  recurrente: boolean
  clientCountA: number
  clientCountB: number
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function ClientListSkeleton() {
  return (
    <div className="flex flex-col gap-3 flex-1 animate-pulse">
      <div className="h-8 rounded-2xl bg-white/20 dark:bg-white/[0.06]" />
      <div className="space-y-1.5">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2.5 p-2.5 rounded-xl border border-white/10 dark:border-white/[0.04]">
            <div className="h-[18px] w-[18px] rounded-md bg-white/20 dark:bg-white/[0.08] shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 rounded-md bg-white/20 dark:bg-white/[0.08]" style={{ width: `${55 + (i % 4) * 10}%` }} />
              <div className="h-2.5 rounded-md bg-white/10 dark:bg-white/[0.05] w-2/5" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── ClientList ────────────────────────────────────────────────────────────────

function ClientList({
  sala, clients, selectedIds, blockedIds, onToggle,
}: {
  sala: 'A' | 'B'
  clients: { id: string | number; name: string; lastName: string; email?: string }[]
  selectedIds: string[]
  blockedIds: string[]
  onToggle: (id: string, checked: boolean) => void
}) {
  const [search, setSearch] = useState('')
  const filtered = clients.filter(c =>
    `${c.name} ${c.lastName}`.toLowerCase().includes(search.toLowerCase())
  )
  const sc = sala === 'A'
    ? { ring: 'border-primary bg-primary', row: 'border-primary/40 bg-primary/5 dark:bg-primary/10' }
    : { ring: 'border-blue-500 bg-blue-500', row: 'border-blue-500/40 bg-blue-500/5 dark:bg-blue-500/10' }

  return (
    <div className="flex flex-col gap-3 flex-1">
      <div className="relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
        </span>
        <input
          type="text" placeholder="Buscar cliente..." value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full rounded-2xl border border-white/30 dark:border-white/10 bg-white/60 dark:bg-white/[0.06] pl-9 pr-4 py-2 text-xs text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
        />
      </div>
      <div className="overflow-y-auto max-h-[360px] space-y-1 pr-0.5">
        {clients.length === 0 ? (
          <p className="text-xs text-gray-500 text-center py-6">No hay clientes</p>
        ) : filtered.length === 0 ? (
          <p className="text-xs text-gray-500 text-center py-6">Sin resultados</p>
        ) : filtered.map(c => {
          const id    = String(c.id)
          const isSel = selectedIds.includes(id)
          const isBlk = blockedIds.includes(id)
          return (
            <label key={id} className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition-all select-none ${
              isBlk
                ? 'opacity-30 cursor-not-allowed border-white/10 dark:border-white/[0.04]'
                : isSel
                ? `cursor-pointer ${sc.row}`
                : 'cursor-pointer border-white/20 dark:border-white/[0.06] hover:bg-white/40 dark:hover:bg-white/[0.04]'
            }`}>
              <div className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md border-2 transition-all ${isSel ? sc.ring : 'border-gray-300 dark:border-white/20'}`}>
                {isSel && <Check size={10} strokeWidth={3} className="text-white dark:text-gray-900" />}
              </div>
              <input type="checkbox" className="sr-only" disabled={isBlk} checked={isSel}
                onChange={e => onToggle(id, e.target.checked)} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-900 dark:text-white truncate leading-tight">
                  {c.name} {c.lastName}
                </p>
                {c.email && <p className="text-[10px] text-gray-500 dark:text-[#8A8A9A] truncate">{c.email}</p>}
              </div>
              {isBlk && (
                <span className="text-[9px] font-bold text-gray-400 dark:text-[#8A8A9A] shrink-0">
                  Sala {sala === 'A' ? 'B' : 'A'}
                </span>
              )}
              {isSel && !isBlk && (
                <button type="button"
                  onClick={e => { e.preventDefault(); e.stopPropagation(); onToggle(id, false) }}
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all">
                  <X size={10} strokeWidth={3} />
                </button>
              )}
            </label>
          )
        })}
      </div>
    </div>
  )
}

function addHour(time: string): string {
  if (!time) return ''
  const [h, m] = time.split(':').map(Number)
  return `${String((h + 1) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

// ── Success Modal ─────────────────────────────────────────────────────────────

function SuccessModal({ shifts, onGoToShifts, onViewShift }: {
  shifts: CreatedShiftInfo[]
  onGoToShifts: () => void
  onViewShift: (id: string) => void
}) {
  const multiple = shifts.length > 1
  return createPortal(
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] bg-black/30 backdrop-blur-md"
        onClick={onGoToShifts}
      />
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pointer-events-none">
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0, transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] } }}
        exit={{ opacity: 0, scale: 0.97, y: 10, transition: { duration: 0.18, ease: [0.4, 0, 1, 1] } }}
        className="relative w-full max-w-2xl pointer-events-auto"
      >
        <div className="relative overflow-hidden rounded-[2rem] bg-white dark:bg-[#111111] p-8 shadow-[0_32px_80px_rgba(0,0,0,0.18)] dark:shadow-[0_32px_80px_rgba(0,0,0,0.6)] ring-1 ring-black/5 dark:ring-white/[0.08]">
          {/* Blobs */}
          <div className="pointer-events-none absolute -top-20 -right-20 w-64 h-64 rounded-full bg-primary/20 blur-[80px]" />
          <div className="pointer-events-none absolute -bottom-20 -left-20 w-56 h-56 rounded-full bg-primary/10 blur-[70px]" />

          {/* Header */}
          <div className="flex items-center gap-5 mb-7 relative">
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1, transition: { duration: 0.4, delay: 0.1, ease: [0.22, 1, 0.36, 1] } }}
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.25rem] bg-primary/15"
            >
              <CheckCircle2 size={28} className="text-primary" />
            </motion.div>
            <div>
              <h2 className="text-2xl font-black text-gray-900 dark:text-white">
                {multiple ? `¡${shifts.length} turnos creados!` : '¡Turno creado!'}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                {multiple ? 'Podés ir a ver el que quieras.' : 'El turno quedó registrado correctamente.'}
              </p>
            </div>
          </div>

          {/* Shift cards */}
          <div className="space-y-3 mb-6 max-h-[52vh] overflow-y-auto pr-1">
            {shifts.map((s, i) => (
              <motion.div key={s.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0, transition: { duration: 0.22, delay: 0.15 + i * 0.07, ease: [0.22, 1, 0.36, 1] } }}
                className="rounded-2xl border border-gray-100 dark:border-white/10 bg-gray-50 dark:bg-white/[0.04] p-4"
              >
                {/* Fila superior: día + horario + botón ver */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="h-2.5 w-2.5 rounded-full bg-primary shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-base font-black text-gray-900 dark:text-white leading-tight truncate">
                        {s.days.map(d => DAY_LABELS[d]).join(' · ')}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Clock size={11} className="text-gray-400 shrink-0" />
                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                          {s.startTime} → {s.endTime}
                        </p>
                        {s.recurrente && (
                          <span className="flex items-center gap-1 text-[10px] font-bold text-primary/80 bg-primary/10 px-1.5 py-0.5 rounded-md">
                            <Repeat2 size={9} /> Recurrente
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => onViewShift(s.id)}
                    className="flex items-center gap-1.5 shrink-0 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary px-3 py-1.5 text-xs font-bold transition-colors active:scale-[0.96]"
                  >
                    Ver turno <ExternalLink size={11} />
                  </button>
                </div>

                {/* Fila inferior: detalles */}
                <div className="flex flex-wrap items-center gap-2 pt-2.5 border-t border-gray-100 dark:border-white/[0.06]">
                  <span className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-700 dark:text-primary bg-primary/10 px-2.5 py-1 rounded-lg">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                    {`A: ${s.cupoSalaA ?? 0} cupos`}
                    {s.profesorSalaANombre && <span className="text-gray-500 dark:text-gray-400"> · {s.profesorSalaANombre}</span>}
                    {s.clientCountA > 0 && <span className="text-gray-500 dark:text-gray-400"> · {s.clientCountA} inscriptos</span>}
                  </span>
                  <span className="flex items-center gap-1.5 text-[11px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-lg">
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-400 shrink-0" />
                    {`B: ${s.cupoSalaB ?? 0} cupos`}
                    {s.profesorSalaBNombre && <span className="text-gray-500 dark:text-gray-400"> · {s.profesorSalaBNombre}</span>}
                    {s.clientCountB > 0 && <span className="text-gray-500 dark:text-gray-400"> · {s.clientCountB} inscriptos</span>}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>

          <button
            onClick={onGoToShifts}
            className="w-full rounded-2xl border border-gray-200 dark:border-white/20 bg-gray-50 dark:bg-white/[0.06] py-3 text-sm font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10 transition-all active:scale-[0.98]"
          >
            Volver a turnos
          </button>
        </div>
      </motion.div>
      </div>
    </>,
    document.body
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ShiftNewPage() {
  const navigate    = useNavigate()
  const [params]    = useSearchParams()
  const addToast    = useUiStore(s => s.addToast)
  const queryClient = useQueryClient()
  const { clients, isLoading: clientsLoading } = useClients({ limit: 1000, estado: 'active' })

  const [isSubmitting,  setIsSubmitting]  = useState(false)
  const [professors,    setProfessors]    = useState<{ id: string; name: string }[]>([])
  const [profsLoading,  setProfsLoading]  = useState(true)
  const [successShifts, setSuccessShifts] = useState<CreatedShiftInfo[]>([])
  const [showSuccess,   setShowSuccess]   = useState(false)

  // true = un solo turno compartido entre todos los días
  // false (default) = un turno separado por cada día
  const [mismoTurno, setMismoTurno] = useState(false)

  const [salaAActiva,   setSalaAActiva]   = useState(true)
  const [salaBActiva,   setSalaBActiva]   = useState(true)
  const [profesorUnico, setProfesorUnico] = useState(true)

  const prefillDay   = params.get('day') as WeekDay | null
  const prefillStart = params.get('start') ?? ''
  const prefillEnd   = params.get('end')   ?? ''

  const { register, handleSubmit, formState: { errors }, watch, setValue } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      days:            prefillDay ? [prefillDay] : [],
      recurrente:      true,
      clientIdsA:      [],
      clientIdsB:      [],
      cupoMaximoSalaA: '',
      cupoMaximoSalaB: '',
      profesorSalaAId: '',
      profesorSalaBId: '',
      startTime:       prefillStart,
      endTime:         prefillEnd,
    },
  })

  const formDays            = (watch('days') || []) as WeekDay[]
  const formRecurrente      = watch('recurrente') ?? true
  const clientIdsA          = watch('clientIdsA') || []
  const clientIdsB          = watch('clientIdsB') || []
  const startTimeValue      = watch('startTime')
  const watchedCupoA        = watch('cupoMaximoSalaA')
  const watchedCupoB        = watch('cupoMaximoSalaB')
  const watchedProfesorAId  = watch('profesorSalaAId')
  const watchedProfesorBId  = watch('profesorSalaBId')

  // Exclusión mutua: solo aplica cuando hay 2 profesores distintos
  const professorsForSalaA = profesorUnico
    ? professors
    : professors.filter(p => !watchedProfesorBId || p.id !== watchedProfesorBId)
  const professorsForSalaB = profesorUnico
    ? professors
    : professors.filter(p => !watchedProfesorAId || p.id !== watchedProfesorAId)

  // Cuando profesor único está activo, sincronizar B con A
  useEffect(() => {
    if (profesorUnico) setValue('profesorSalaBId', watchedProfesorAId ?? '')
  }, [profesorUnico, watchedProfesorAId]) // eslint-disable-line

  // Si baja a 1 día, resetear toggle
  useEffect(() => {
    if (formDays.length < 2) setMismoTurno(false)
  }, [formDays.length])

  const isFirstRender = useRef(true)
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return }
    if (startTimeValue) setValue('endTime', addHour(startTimeValue), { shouldValidate: true })
  }, [startTimeValue]) // eslint-disable-line

  useEffect(() => {
    professorsApi.getAll()
      .then(setProfessors)
      .catch(() => setProfessors([]))
      .finally(() => setProfsLoading(false))
  }, [])

  async function onSubmit(data: FormValues) {
    setIsSubmitting(true)
    try {
      const created: CreatedShiftInfo[] = []

      const shiftPayload = {
        recurrente:      data.recurrente,
        startTime:       data.startTime,
        endTime:         data.endTime,
        cupoMaximoSalaA: Number(data.cupoMaximoSalaA),
        cupoMaximoSalaB: Number(data.cupoMaximoSalaB),
        profesorSalaAId: data.profesorSalaAId || undefined,
        profesorSalaBId: data.profesorSalaBId || undefined,
      }

      if (mismoTurno || data.days.length === 1) {
        // Un solo turno con todos los días
        const turno = await shiftsApi.create({ ...shiftPayload, days: data.days })
        await Promise.allSettled([
          ...data.clientIdsA.map(id => inscripcionesApi.enroll(id, String(turno.id), 'A')),
          ...data.clientIdsB.map(id => inscripcionesApi.enroll(id, String(turno.id), 'B')),
        ])
        queryClient.setQueryData<Shift[]>(QK.shifts.all(), old => [...(old ?? []), turno])
        created.push({
          id: String(turno.id),
          days: data.days,
          startTime: data.startTime,
          endTime: data.endTime,
          profesorSalaANombre: professors.find(p => p.id === data.profesorSalaAId)?.name ?? '',
          profesorSalaBNombre: professors.find(p => p.id === data.profesorSalaBId)?.name ?? '',
          cupoSalaA: Number(watchedCupoA),
          cupoSalaB: Number(watchedCupoB),
          recurrente: data.recurrente,
          clientCountA: data.clientIdsA.length,
          clientCountB: data.clientIdsB.length,
        })
      } else {
        // Un turno separado por cada día
        const results = await Promise.allSettled(
          data.days.map(async day => {
            const turno = await shiftsApi.create({ ...shiftPayload, days: [day] })
            await Promise.allSettled([
              ...data.clientIdsA.map(id => inscripcionesApi.enroll(id, String(turno.id), 'A')),
              ...data.clientIdsB.map(id => inscripcionesApi.enroll(id, String(turno.id), 'B')),
            ])
            queryClient.setQueryData<Shift[]>(QK.shifts.all(), old => [...(old ?? []), turno])
            return {
              id: String(turno.id),
              days: [day] as WeekDay[],
              startTime: data.startTime,
              endTime: data.endTime,
              profesorSalaANombre: professors.find(p => p.id === data.profesorSalaAId)?.name ?? '',
              profesorSalaBNombre: professors.find(p => p.id === data.profesorSalaBId)?.name ?? '',
              cupoSalaA: Number(watchedCupoA),
              cupoSalaB: Number(watchedCupoB),
              recurrente: data.recurrente,
              clientCountA: data.clientIdsA.length,
              clientCountB: data.clientIdsB.length,
            }
          })
        )
        results.forEach(r => { if (r.status === 'fulfilled') created.push(r.value) })
      }

      queryClient.invalidateQueries({ queryKey: QK.shifts.all() })

      if (created.length === 0) { addToast('Error al crear el turno', 'error'); return }
      setSuccessShifts(created)
      setShowSuccess(true)
    } catch {
      addToast('Error al crear el turno', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const multiDay   = formDays.length >= 2
  const submitLabel = isSubmitting
    ? 'Creando...'
    : multiDay && !mismoTurno
    ? `Crear ${formDays.length} turnos`
    : 'Crear turno'

  const cardCls = 'rounded-[2rem] border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-3xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)]'

  return (
    <motion.div {...pageVariants} className="space-y-6 pb-10 relative z-10">

      {/* Blob */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -bottom-20 -right-20 w-[480px] h-[480px] rounded-full bg-primary/15 blur-[120px]" />
      </div>

      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(ROUTES.SHIFTS)}
          className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-xl text-gray-600 dark:text-gray-300 transition-all hover:scale-105 hover:bg-white/50 dark:hover:bg-black/50"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-2xl lg:text-3xl font-black tracking-tighter text-gray-900 dark:text-white">Nuevo turno</h1>
          <p className="text-sm font-semibold text-gray-500 dark:text-gray-400 mt-0.5">Completá los datos y guardá</p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 lg:grid-cols-[0.75fr_1fr_1fr] gap-6">

          {/* ── Col 1: Datos del turno ── */}
          <motion.div {...cardAnim(0)} className={`${cardCls} p-5 lg:p-6 space-y-4`}>
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
                <Calendar size={16} className="text-amber-700 dark:text-primary" />
              </div>
              <div>
                <p className="font-bold text-sm text-gray-900 dark:text-white">Datos del turno</p>
                <p className="text-xs text-gray-500 dark:text-[#8A8A9A]">Días, horario y opciones</p>
              </div>
            </div>
            <div className="border-t border-white/20 dark:border-white/10" />

            {/* Días */}
            <div className="space-y-3">
              <label className="text-xs font-extrabold uppercase tracking-widest text-gray-500 dark:text-gray-400">
                Días de la semana *
              </label>
              <div className="flex flex-wrap gap-2">
                {DAYS.map(d => {
                  const selected = formDays.includes(d)
                  return (
                    <motion.button key={d} type="button"
                      whileTap={{ scale: 0.94 }} transition={{ duration: 0.1 }}
                      onClick={() => {
                        if (selected) setValue('days', formDays.filter(x => x !== d), { shouldValidate: true })
                        else setValue('days', [...formDays, d], { shouldValidate: true })
                      }}
                      className={`rounded-xl px-3.5 py-2 text-xs font-bold transition-colors ${
                        selected
                          ? 'bg-primary text-gray-900 shadow-sm shadow-primary/30'
                          : 'border border-white/30 dark:border-white/10 bg-white/40 dark:bg-white/[0.04] text-gray-500 dark:text-[#8A8A9A] hover:border-primary/40 hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      {DAY_LABELS[d].slice(0, 3)}
                    </motion.button>
                  )
                })}
              </div>
              {(errors.days as { message?: string })?.message && (
                <p className="text-xs text-red-500">{(errors.days as { message?: string }).message}</p>
              )}
            </div>

            {/* Toggle "mismo turno" — solo visible con 2+ días */}
            <AnimatePresence>
              {multiDay && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0, transition: { duration: 0.2, ease: [0.22, 1, 0.36, 1] } }}
                  exit={{ opacity: 0, y: -4, transition: { duration: 0.15 } }}
                  className="flex items-center justify-between gap-3 p-3 rounded-xl border border-white/30 dark:border-white/10 bg-white/40 dark:bg-white/[0.04]"
                >
                  <div>
                    <p className="text-xs font-bold text-gray-900 dark:text-white">
                      {mismoTurno ? 'Un turno que se repite' : 'Turnos separados por día'}
                    </p>
                    <p className="text-[11px] text-gray-500 dark:text-[#8A8A9A] mt-0.5">
                      {mismoTurno
                        ? `Un solo turno en ${formDays.map(d => DAY_LABELS[d]).join(' y ')}`
                        : `Se crearán ${formDays.length} turnos independientes`}
                    </p>
                  </div>
                  <button type="button" role="switch" aria-checked={mismoTurno}
                    onClick={() => setMismoTurno(v => !v)}
                    className="relative shrink-0"
                  >
                    <div className={`w-11 h-6 rounded-full transition-colors ${mismoTurno ? 'bg-primary' : 'bg-gray-200 dark:bg-white/10'}`} />
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${mismoTurno ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Horario */}
            <div className="grid grid-cols-2 gap-4">
              <Input label="Hora inicio *" type="time" lang="es" error={errors.startTime?.message} {...register('startTime')} />
              <Input label="Hora fin *"    type="time" lang="es" error={errors.endTime?.message}   {...register('endTime')} />
            </div>

            {/* Cupos — movidos a los cards de sala */}

            {/* Salas activas */}
            <div className="space-y-2">
              <p className="text-xs font-extrabold uppercase tracking-widest text-gray-500 dark:text-gray-400">Salas</p>
              {/* Toggle Sala A */}
              <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border border-white/30 dark:border-white/10 bg-white/40 dark:bg-white/[0.04]">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-gray-900 dark:text-white">Sala A</p>
                    <p className="text-[11px] text-gray-500 dark:text-[#8A8A9A]">
                      {salaAActiva ? 'Habilitada para este turno' : 'No se usa en este turno'}
                    </p>
                  </div>
                </div>
                <button type="button" role="switch" aria-checked={salaAActiva}
                  onClick={() => {
                    setSalaAActiva(v => {
                      if (v) { setValue('cupoMaximoSalaA', '0'); setValue('clientIdsA', []); setValue('profesorSalaAId', '') }
                      return !v
                    })
                  }}
                  className="relative shrink-0"
                >
                  <div className={`w-11 h-6 rounded-full transition-colors ${salaAActiva ? 'bg-primary' : 'bg-gray-200 dark:bg-white/10'}`} />
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${salaAActiva ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
              {/* Toggle Sala B */}
              <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border border-white/30 dark:border-white/10 bg-white/40 dark:bg-white/[0.04]">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="h-2 w-2 rounded-full bg-blue-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-gray-900 dark:text-white">Sala B</p>
                    <p className="text-[11px] text-gray-500 dark:text-[#8A8A9A]">
                      {salaBActiva ? 'Habilitada para este turno' : 'No se usa en este turno'}
                    </p>
                  </div>
                </div>
                <button type="button" role="switch" aria-checked={salaBActiva}
                  onClick={() => {
                    setSalaBActiva(v => {
                      if (v) { setValue('cupoMaximoSalaB', '0'); setValue('clientIdsB', []); setValue('profesorSalaBId', '') }
                      return !v
                    })
                  }}
                  className="relative shrink-0"
                >
                  <div className={`w-11 h-6 rounded-full transition-colors ${salaBActiva ? 'bg-blue-500' : 'bg-gray-200 dark:bg-white/10'}`} />
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${salaBActiva ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
            </div>

            {/* Profesor único */}
            <div className="space-y-2">
              <p className="text-xs font-extrabold uppercase tracking-widest text-gray-500 dark:text-gray-400">Profesores</p>
              <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border border-white/30 dark:border-white/10 bg-white/40 dark:bg-white/[0.04]">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="h-2 w-2 rounded-full bg-gray-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-gray-900 dark:text-white">Profesor único</p>
                    <p className="text-[11px] text-gray-500 dark:text-[#8A8A9A]">
                      {profesorUnico ? 'Un profe para ambas salas' : 'Profe distinto por sala'}
                    </p>
                  </div>
                </div>
                <button type="button" role="switch" aria-checked={profesorUnico}
                  onClick={() => setProfesorUnico(v => {
                    if (v) setValue('profesorSalaBId', '')
                    return !v
                  })}
                  className="relative shrink-0"
                >
                  <div className={`w-11 h-6 rounded-full transition-colors ${profesorUnico ? 'bg-gray-500 dark:bg-white/30' : 'bg-gray-200 dark:bg-white/10'}`} />
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${profesorUnico ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
            </div>

            {/* Recurrente */}
            <div className="space-y-2">
              <p className="text-xs font-extrabold uppercase tracking-widest text-gray-500 dark:text-gray-400">Recurrencia</p>
            <label className="flex items-center justify-between gap-4 p-4 rounded-2xl border border-white/30 dark:border-white/10 bg-white/40 dark:bg-white/[0.04] cursor-pointer select-none">
              <div>
                <p className="text-sm font-bold text-gray-900 dark:text-white">Recurrente semanal</p>
                <p className="text-xs text-gray-500 dark:text-[#8A8A9A] mt-0.5">Se repite cada semana</p>
              </div>
              <div className="relative shrink-0">
                <input type="checkbox" {...register('recurrente')} className="sr-only peer" />
                <div className={`w-11 h-6 rounded-full transition-colors ${formRecurrente ? 'bg-primary' : 'bg-gray-200 dark:bg-white/10'}`} />
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${formRecurrente ? 'translate-x-6' : 'translate-x-1'}`} />
              </div>
            </label>
            </div>
          </motion.div>

          {/* ── Col 2: Sala A ── */}
          <motion.div {...cardAnim(0.08)} className={`${cardCls} p-6 lg:p-8 flex flex-col gap-4 transition-all duration-300 ${!salaAActiva ? 'opacity-40 blur-[2px] pointer-events-none' : ''}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10">
                  <Users size={18} className="text-amber-700 dark:text-primary" />
                </div>
                <div>
                  <p className="font-bold text-gray-900 dark:text-white">Sala A</p>
                  <p className="text-xs text-gray-500 dark:text-[#8A8A9A]">Opcional</p>
                </div>
              </div>
              {clientIdsA.length > 0 && (
                <span className="text-xs font-bold px-2.5 py-1 rounded-xl bg-primary/25 text-amber-700 dark:text-primary">
                  {clientIdsA.length} sel.
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Cupo máximo *" type="number" placeholder="Ej. 10" error={errors.cupoMaximoSalaA?.message} {...register('cupoMaximoSalaA')} />
              <Select
                label="Profesor"
                options={[
                  { value: '', label: profsLoading ? 'Cargando...' : 'Ninguno' },
                  ...professorsForSalaA.map(p => ({ value: p.id, label: p.name })),
                ]}
                {...register('profesorSalaAId')}
              />
            </div>
            <div className="border-t border-white/20 dark:border-white/10" />
            {clientsLoading ? <ClientListSkeleton /> : (
              <ClientList
                sala="A"
                clients={clients.map(c => ({ ...c, id: String(c.id) }))}
                selectedIds={clientIdsA}
                blockedIds={clientIdsB}
                onToggle={(id, checked) =>
                  setValue('clientIdsA', checked ? [...clientIdsA, id] : clientIdsA.filter(x => x !== id))
                }
              />
            )}
          </motion.div>

          {/* ── Col 3: Sala B ── */}
          <motion.div {...cardAnim(0.16)} className={`${cardCls} p-6 lg:p-8 flex flex-col gap-4 transition-all duration-300 ${!salaBActiva ? 'opacity-40 blur-[2px] pointer-events-none' : ''}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-500/10">
                  <Users size={18} className="text-blue-500" />
                </div>
                <div>
                  <p className="font-bold text-gray-900 dark:text-white">Sala B</p>
                  <p className="text-xs text-gray-500 dark:text-[#8A8A9A]">Opcional</p>
                </div>
              </div>
              {clientIdsB.length > 0 && (
                <span className="text-xs font-bold px-2.5 py-1 rounded-xl bg-blue-500/10 text-blue-500">
                  {clientIdsB.length} sel.
                </span>
              )}
            </div>
            <div className={`grid gap-3 ${profesorUnico ? 'grid-cols-1' : 'grid-cols-2'}`}>
              <Input label="Cupo máximo *" type="number" placeholder="Ej. 10" error={errors.cupoMaximoSalaB?.message} {...register('cupoMaximoSalaB')} />
              {profesorUnico ? (
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-[11px] text-gray-400 dark:text-[#6A6A7A]">
                    {watchedProfesorAId
                      ? `Prof. ${professors.find(p => p.id === watchedProfesorAId)?.name ?? '—'}`
                      : 'Sin profesor asignado'}
                  </span>
                </div>
              ) : (
                <Select
                  label="Profesor"
                  options={[
                    { value: '', label: profsLoading ? 'Cargando...' : 'Ninguno' },
                    ...professorsForSalaB.map(p => ({ value: p.id, label: p.name })),
                  ]}
                  {...register('profesorSalaBId')}
                />
              )}
            </div>
            <div className="border-t border-white/20 dark:border-white/10" />
            {clientsLoading ? <ClientListSkeleton /> : (
              <ClientList
                sala="B"
                clients={clients.map(c => ({ ...c, id: String(c.id) }))}
                selectedIds={clientIdsB}
                blockedIds={clientIdsA}
                onToggle={(id, checked) =>
                  setValue('clientIdsB', checked ? [...clientIdsB, id] : clientIdsB.filter(x => x !== id))
                }
              />
            )}
          </motion.div>

        </div>

        {/* Acciones */}
        <div className="flex items-center justify-end gap-3 pt-4">
          <button type="button" onClick={() => navigate(ROUTES.SHIFTS)}
            className="rounded-2xl border border-white/30 dark:border-white/10 bg-white/40 dark:bg-white/[0.04] px-6 py-3 text-sm font-bold text-gray-600 dark:text-gray-300 hover:bg-white/60 dark:hover:bg-white/10 transition-all"
          >
            Cancelar
          </button>
          <motion.button type="submit"
            disabled={isSubmitting}
            whileTap={!isSubmitting ? { scale: 0.97 } : undefined}
            transition={{ duration: 0.1 }}
            className="flex items-center gap-2 rounded-2xl btn-action px-8 py-3 text-sm font-bold disabled:opacity-60"
          >
            {isSubmitting
              ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-900/30 border-t-gray-900" />
              : <ChevronRight size={16} />}
            {submitLabel}
          </motion.button>
        </div>
      </form>

      {/* Modal de éxito */}
      <AnimatePresence>
        {showSuccess && (
          <SuccessModal
            shifts={successShifts}
            onGoToShifts={() => navigate(ROUTES.SHIFTS)}
            onViewShift={id => navigate(`/shifts/${id}`)}
          />
        )}
      </AnimatePresence>

    </motion.div>
  )
}
