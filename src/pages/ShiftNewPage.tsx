import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { pageVariants } from '../lib/motion'

const ease = [0.22, 1, 0.36, 1] as const
const cardAnim = (delay: number) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease, delay } },
})
import { ArrowLeft, Calendar, Users, ChevronRight, X, Check } from 'lucide-react'
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
import type { WeekDay } from '../types/shift.types'

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
  profesorId:      z.string().min(1, 'El profesor es requerido'),
  clientIdsA:      z.array(z.string()),
  clientIdsB:      z.array(z.string()),
})
type FormValues = z.infer<typeof schema>

const DAYS: WeekDay[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

const DAY_LABELS: Record<WeekDay, string> = {
  monday: 'Lunes', tuesday: 'Martes', wednesday: 'Miércoles',
  thursday: 'Jueves', friday: 'Viernes', saturday: 'Sábado', sunday: 'Domingo',
}

// ── Sub-componente lista de clientes ──────────────────────────────────────────

function ClientList({
  sala,
  clients,
  selectedIds,
  blockedIds,
  onToggle,
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

  const salaColor = sala === 'A'
    ? { dot: 'bg-primary', ring: 'border-primary bg-primary', row: 'border-primary/40 bg-primary/5 dark:bg-primary/10' }
    : { dot: 'bg-blue-500', ring: 'border-blue-500 bg-blue-500', row: 'border-blue-500/40 bg-blue-500/5 dark:bg-blue-500/10' }

  return (
    <div className="flex flex-col gap-3 flex-1">
      {/* Buscador */}
      <div className="relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        </span>
        <input
          type="text"
          placeholder="Buscar cliente..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full rounded-2xl border border-white/30 dark:border-white/10 bg-white/60 dark:bg-white/[0.06] pl-9 pr-4 py-2 text-xs text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
        />
      </div>

      {/* Lista */}
      <div className="overflow-y-auto max-h-[360px] space-y-1 pr-0.5">
        {clients.length === 0 ? (
          <p className="text-xs text-gray-500 text-center py-6">No hay clientes</p>
        ) : filtered.length === 0 ? (
          <p className="text-xs text-gray-500 text-center py-6">Sin resultados</p>
        ) : filtered.map(c => {
          const id        = String(c.id)
          const isSelected = selectedIds.includes(id)
          const isBlocked  = blockedIds.includes(id)

          return (
            <label
              key={id}
              className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition-all select-none ${
                isBlocked
                  ? 'opacity-30 cursor-not-allowed border-white/10 dark:border-white/[0.04]'
                  : isSelected
                  ? `cursor-pointer ${salaColor.row}`
                  : 'cursor-pointer border-white/20 dark:border-white/[0.06] hover:bg-white/40 dark:hover:bg-white/[0.04]'
              }`}
            >
              <div className={`flex h-4.5 w-4.5 h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md border-2 transition-all ${
                isSelected ? salaColor.ring : 'border-gray-300 dark:border-white/20'
              }`}>
                {isSelected && <Check size={10} strokeWidth={3} className="text-white dark:text-gray-900" />}
              </div>
              <input
                type="checkbox"
                className="sr-only"
                disabled={isBlocked}
                checked={isSelected}
                onChange={e => onToggle(id, e.target.checked)}
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-900 dark:text-white truncate leading-tight">
                  {c.name} {c.lastName}
                </p>
                {c.email && (
                  <p className="text-[10px] text-gray-500 dark:text-[#8A8A9A] truncate">{c.email}</p>
                )}
              </div>
              {isBlocked && (
                <span className="text-[9px] font-bold text-gray-400 dark:text-[#8A8A9A] shrink-0">
                  Sala {sala === 'A' ? 'B' : 'A'}
                </span>
              )}
              {isSelected && !isBlocked && (
                <button
                  type="button"
                  onClick={e => { e.preventDefault(); e.stopPropagation(); onToggle(id, false) }}
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all"
                >
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

// ── Página principal ──────────────────────────────────────────────────────────

export default function ShiftNewPage() {
  const navigate      = useNavigate()
  const [params]      = useSearchParams()
  const addToast      = useUiStore(s => s.addToast)
  const queryClient   = useQueryClient()
  const { clients }   = useClients()

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [professors,   setProfessors]   = useState<{ id: string; name: string }[]>([])
  const [profsLoading, setProfsLoading] = useState(true)

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
      startTime:       prefillStart,
      endTime:         prefillEnd,
    },
  })

  const formDays       = (watch('days') || []) as WeekDay[]
  const formRecurrente = watch('recurrente') ?? true
  const clientIdsA     = watch('clientIdsA') || []
  const clientIdsB     = watch('clientIdsB') || []
  const startTimeValue = watch('startTime')

  const isFirstRender = useRef(true)
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return }
    if (startTimeValue) setValue('endTime', addHour(startTimeValue), { shouldValidate: true })
  }, [startTimeValue]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    professorsApi.getAll()
      .then(setProfessors)
      .catch(() => setProfessors([]))
      .finally(() => setProfsLoading(false))
  }, [])

  async function onSubmit(data: FormValues) {
    setIsSubmitting(true)
    try {
      const turno = await shiftsApi.create({
        days:            data.days,
        recurrente:      data.recurrente,
        startTime:       data.startTime,
        endTime:         data.endTime,
        cupoMaximoSalaA: Number(data.cupoMaximoSalaA),
        cupoMaximoSalaB: Number(data.cupoMaximoSalaB),
        profesorId:      data.profesorId,
      })

      await Promise.allSettled([
        ...data.clientIdsA.map(id => inscripcionesApi.enroll(id, String(turno.id), 'A')),
        ...data.clientIdsB.map(id => inscripcionesApi.enroll(id, String(turno.id), 'B')),
      ])

      queryClient.setQueryData<import('../types/shift.types').Shift[]>(QK.shifts.all(), old => [...(old ?? []), turno])
      queryClient.invalidateQueries({ queryKey: QK.shifts.all() })
      addToast('Turno creado exitosamente', 'success')
      navigate(`/shifts/${turno.id}`)
    } catch {
      addToast('Error al crear el turno', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const cardCls = 'rounded-[2rem] border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-3xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)]'

  return (
    <motion.div {...pageVariants} className="space-y-6 pb-10 relative z-10">

      {/* ── Blob de fondo ── */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -bottom-20 -right-20 w-[480px] h-[480px] rounded-full bg-primary/15 blur-[120px]" />
      </div>

      {/* ── Header ── */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(ROUTES.SHIFTS)}
          className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-xl text-gray-600 dark:text-gray-300 transition-all hover:scale-105 hover:bg-white/50 dark:hover:bg-black/50"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-2xl lg:text-3xl font-black tracking-tighter text-gray-900 dark:text-white">Nuevo turno</h1>
          <p className="text-sm font-semibold text-gray-500 dark:text-gray-400 mt-0.5">Completá los datos y guardá</p>
        </div>
      </div>

      {/* ── Formulario ── */}
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── Col 1: Datos del turno ── */}
          <motion.div {...cardAnim(0)} className={`${cardCls} p-6 lg:p-8 space-y-6`}>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10">
                <Calendar size={18} className="text-amber-700 dark:text-primary" />
              </div>
              <div>
                <p className="font-bold text-gray-900 dark:text-white">Datos del turno</p>
                <p className="text-xs text-gray-500 dark:text-[#8A8A9A]">Días, horario, cupos y profesor</p>
              </div>
            </div>

            <div className="border-t border-white/20 dark:border-white/10" />

            {/* Días */}
            <div className="space-y-2">
              <label className="text-xs font-extrabold uppercase tracking-widest text-gray-500 dark:text-gray-400">
                Días de la semana *
              </label>
              <div className="flex flex-wrap gap-2">
                {DAYS.map(d => {
                  const selected = formDays.includes(d)
                  return (
                    <motion.button key={d} type="button"
                      whileTap={{ scale: 0.94 }}
                      transition={{ duration: 0.1 }}
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

            {/* Horario */}
            <div className="grid grid-cols-2 gap-4">
              <Input label="Hora inicio *" type="time" lang="es" error={errors.startTime?.message} {...register('startTime')} />
              <Input label="Hora fin *"    type="time" lang="es" error={errors.endTime?.message}   {...register('endTime')} />
            </div>

            {/* Cupos */}
            <div className="grid grid-cols-2 gap-4">
              <Input label="Cupo Sala A *" type="number" placeholder="Ej. 10" error={errors.cupoMaximoSalaA?.message} {...register('cupoMaximoSalaA')} />
              <Input label="Cupo Sala B *" type="number" placeholder="Ej. 10" error={errors.cupoMaximoSalaB?.message} {...register('cupoMaximoSalaB')} />
            </div>

            {/* Profesor */}
            <Select
              label="Profesor *"
              options={[
                { value: '', label: profsLoading ? 'Cargando...' : professors.length === 0 ? 'Sin profesores' : 'Seleccionar...' },
                ...professors.map(p => ({ value: p.id, label: p.name })),
              ]}
              error={errors.profesorId?.message}
              {...register('profesorId')}
            />

            {professors.length === 0 && !profsLoading && (
              <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2">
                No hay profesores. Creá un usuario con rol Profesor primero.
              </p>
            )}

            {/* Recurrencia */}
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
          </motion.div>

          {/* ── Col 2: Sala A ── */}
          <motion.div {...cardAnim(0.08)} className={`${cardCls} p-6 lg:p-8 flex flex-col gap-4`}>
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
            <div className="border-t border-white/20 dark:border-white/10" />
            <ClientList
              sala="A"
              clients={clients.map(c => ({ ...c, id: String(c.id) }))}
              selectedIds={clientIdsA}
              blockedIds={clientIdsB}
              onToggle={(id, checked) =>
                setValue('clientIdsA', checked ? [...clientIdsA, id] : clientIdsA.filter(x => x !== id))
              }
            />
          </motion.div>

          {/* ── Col 3: Sala B ── */}
          <motion.div {...cardAnim(0.16)} className={`${cardCls} p-6 lg:p-8 flex flex-col gap-4`}>
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
            <div className="border-t border-white/20 dark:border-white/10" />
            <ClientList
              sala="B"
              clients={clients.map(c => ({ ...c, id: String(c.id) }))}
              selectedIds={clientIdsB}
              blockedIds={clientIdsA}
              onToggle={(id, checked) =>
                setValue('clientIdsB', checked ? [...clientIdsB, id] : clientIdsB.filter(x => x !== id))
              }
            />
          </motion.div>

        </div>

        {/* ── Acción ── */}
        <div className="flex items-center justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={() => navigate(ROUTES.SHIFTS)}
            className="rounded-2xl border border-white/30 dark:border-white/10 bg-white/40 dark:bg-white/[0.04] px-6 py-3 text-sm font-bold text-gray-600 dark:text-gray-300 hover:bg-white/60 dark:hover:bg-white/10 transition-all"
          >
            Cancelar
          </button>
          <motion.button
            type="submit"
            disabled={isSubmitting}
            whileTap={!isSubmitting ? { scale: 0.97 } : undefined}
            transition={{ duration: 0.1 }}
            className="flex items-center gap-2 rounded-2xl btn-action px-8 py-3 text-sm font-bold disabled:opacity-60"
          >
            {isSubmitting
              ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-900/30 border-t-gray-900" />
              : <ChevronRight size={16} />}
            {isSubmitting ? 'Creando...' : 'Crear turno'}
          </motion.button>
        </div>
      </form>
    </motion.div>
  )
}
