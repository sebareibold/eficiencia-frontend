import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, Users, Clock, Dumbbell, UserPlus, ListPlus,
  X, Bell, Check, Trash2, Search, AlertTriangle, CheckCircle2, Pencil, Save,
  Hash, Tag, CalendarDays, MessageCircle,
} from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { shiftsApi, professorsApi } from '../api/shifts.api'
import { inscripcionesApi } from '../api/inscripciones.api'
import { attendanceApi } from '../api/attendance.api'
import { listaEsperaApi } from '../api/listaEspera.api'
import { useListaEspera } from '../hooks/useListaEspera'
import { useAttendance } from '../hooks/useAttendance'
import { useClients } from '../hooks/useClients'
import { useUiStore } from '../store/uiStore'
import { useAuthStore } from '../store/authStore'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import Skeleton from '../components/ui/Skeleton'
import type { Shift, WeekDay } from '../types/shift.types'
import type { InscripcionEntry } from '../api/inscripciones.api'
import type { TipoEspera, EstadoEspera } from '../types/listaEspera.types'

// ─── Constantes ────────────────────────────────────────────────────────────────

const DAY_LABELS: Record<WeekDay, string> = {
  monday: 'Lunes', tuesday: 'Martes', wednesday: 'Miércoles',
  thursday: 'Jueves', friday: 'Viernes', saturday: 'Sábado', sunday: 'Domingo',
}

const WEEKDAY_TO_JS: Record<WeekDay, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
}

const DAYS: WeekDay[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

const glassCard = 'rounded-3xl border border-white/50 dark:border-white/[0.08] bg-white/30 dark:bg-black/30 backdrop-blur-3xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.25)]'

function getOccupancyColor(enrolled: number, capacity: number) {
  const r = enrolled / capacity
  if (r >= 1) return 'bg-red-500'
  if (r >= 0.75) return 'bg-amber-500'
  return 'bg-emerald-500'
}

// ─── Edit schema ──────────────────────────────────────────────────────────────

const editSchema = z.object({
  room:       z.string().min(1, 'Requerido'),
  days:       z.array(z.enum(['monday','tuesday','wednesday','thursday','friday','saturday','sunday'])).min(1),
  recurrente: z.boolean().default(true),
  startTime:  z.string().min(1, 'Requerido'),
  endTime:    z.string().min(1, 'Requerido'),
  capacity:   z.string().min(1).refine(v => Number(v) > 0, 'Inválido'),
  profesorId: z.string().min(1, 'Requerido'),
})
type EditValues = z.infer<typeof editSchema>

type DetailTab = 'resumen' | 'inscripciones' | 'asistencia' | 'espera'

const ESPERA_BADGE: Record<string, string> = {
  PENDIENTE:  'bg-amber-500/10 text-amber-400 border-amber-500/20',
  NOTIFICADO: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  ACEPTADO:   'bg-green-500/10 text-green-400 border-green-500/20',
  RECHAZADO:  'bg-red-500/10 text-red-400 border-red-500/20',
}
const ESPERA_LABEL: Record<string, string> = {
  PENDIENTE: 'Pendiente', NOTIFICADO: 'Notificado', ACEPTADO: 'Aceptado', RECHAZADO: 'Rechazado',
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function ShiftDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const addToast = useUiStore(s => s.addToast)
  const user = useAuthStore(s => s.user)
  const isAdmin = user?.role === 'admin'

  const [shift, setShift] = useState<Shift | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<DetailTab>('resumen')
  const [isEditingShift, setIsEditingShift] = useState(false)

  // Inscripciones
  const [inscripciones, setInscripciones] = useState<InscripcionEntry[]>([])
  const [loadingInscrip, setLoadingInscrip] = useState(false)
  const [bajandoId, setBajandoId] = useState<string | null>(null)
  const [addClientMode, setAddClientMode] = useState(false)
  const [addClientSearch, setAddClientSearch] = useState('')
  const [addClientId, setAddClientId] = useState('')
  const [addClientSubmitting, setAddClientSubmitting] = useState(false)

  // Lista de espera
  const [addEsperaMode, setAddEsperaMode] = useState(false)
  const [addEsperaClientSearch, setAddEsperaClientSearch] = useState('')
  const [addEsperaClientId, setAddEsperaClientId] = useState('')
  const [addEsperaTipo, setAddEsperaTipo] = useState<TipoEspera>('INTERNA')
  const [addEsperaSubmitting, setAddEsperaSubmitting] = useState(false)
  const [esperaTipoTab, setEsperaTipoTab] = useState<'INTERNA' | 'EXTERNA'>('INTERNA')
  const [actionLoadingIds, setActionLoadingIds] = useState<Set<string>>(new Set())

  // Asistencia
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [present, setPresent] = useState<Set<string>>(new Set())
  const [isSavingAttendance, setIsSavingAttendance] = useState(false)

  // Edit
  const [professors, setProfessors] = useState<{ id: string; name: string }[]>([])
  const [editSubmitting, setEditSubmitting] = useState(false)

  const { clients } = useClients()
  const { entries: esperaEntries, isLoading: esperaLoading, error: esperaError, refetch: refetchEspera } =
    useListaEspera(id ?? null)
  const { records: attendanceRecords, isLoading: loadingAttendance, fetchByShiftAndDate } = useAttendance()

  const {
    register: editRegister, handleSubmit: editHandleSubmit,
    formState: { errors: editErrors }, reset: editReset,
    watch: editWatch, setValue: editSetValue,
  } = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    defaultValues: { room: 'A', days: [], recurrente: true, startTime: '', endTime: '', capacity: '', profesorId: '' },
  })
  const editDays = (editWatch('days') || []) as WeekDay[]
  const editRecurrente = editWatch('recurrente') ?? true

  // Cargar turno
  useEffect(() => {
    if (!id) return
    setLoading(true)
    shiftsApi.getById(id)
      .then(s => {
        setShift(s)
        editReset({
          room: s.room, days: s.days, recurrente: s.recurrente,
          startTime: s.startTime, endTime: s.endTime,
          capacity: String(s.capacity), profesorId: s.profesorId,
        })
      })
      .catch(() => addToast('Error al cargar el turno', 'error'))
      .finally(() => setLoading(false))
  }, [id])

  // Cargar profesores
  useEffect(() => {
    professorsApi.getAll().then(setProfessors).catch(() => {})
  }, [])

  // Cargar inscripciones cuando corresponde
  useEffect(() => {
    if (!id || (tab !== 'resumen' && tab !== 'inscripciones' && tab !== 'asistencia')) return
    setLoadingInscrip(true)
    inscripcionesApi.getByTurno(id)
      .then(setInscripciones)
      .catch(() => addToast('Error al cargar inscripciones', 'error'))
      .finally(() => setLoadingInscrip(false))
  }, [tab, id])

  // Cargar asistencia cuando cambia fecha o tab
  useEffect(() => {
    if (tab !== 'asistencia' || !id || !selectedDate) return
    fetchByShiftAndDate(id, selectedDate)
  }, [tab, id, selectedDate])

  // Sincronizar checkboxes
  useEffect(() => {
    const presentIds = new Set(attendanceRecords.filter(r => r.present).map(r => r.clientId))
    setPresent(presentIds)
  }, [attendanceRecords])

  // Validación de día para asistencia (desactivada por requerimiento: se permite marcar cualquier día)
  const dateError = null

  // ─── Handlers ────────────────────────────────────────────────────────────────

  async function onEditSubmit(data: EditValues) {
    if (!id) return
    setEditSubmitting(true)
    try {
      const updated = await shiftsApi.update(id, {
        room: data.room, days: data.days, recurrente: data.recurrente,
        startTime: data.startTime, endTime: data.endTime,
        capacity: Number(data.capacity), profesorId: data.profesorId,
      })
      setShift(updated)
      setIsEditingShift(false)
      addToast('Turno actualizado', 'success')
    } catch {
      addToast('Error al guardar', 'error')
    } finally {
      setEditSubmitting(false)
    }
  }

  async function deleteShift() {
    if (!id || !confirm('¿Eliminar este turno? Esta acción no se puede deshacer.')) return
    try {
      await shiftsApi.remove(id)
      addToast('Turno eliminado', 'success')
      navigate('/shifts')
    } catch {
      addToast('Error al eliminar el turno', 'error')
    }
  }

  async function handleAddToShift() {
    if (!id || !addClientId) return
    setAddClientSubmitting(true)
    try {
      const res = await inscripcionesApi.enroll(addClientId, id)
      addToast(res.enListaEspera ? 'Cliente agregado a lista de espera (turno lleno)' : 'Cliente inscripto', 'success')
      setAddClientId(''); setAddClientSearch(''); setAddClientMode(false)
      inscripcionesApi.getByTurno(id).then(setInscripciones).catch(() => {})
      setShift(s => s ? { ...s, enrolled: s.enrolled + (res.enListaEspera ? 0 : 1) } : s)
    } catch {
      addToast('Error al inscribir', 'error')
    } finally {
      setAddClientSubmitting(false)
    }
  }

  async function handleDarDeBaja(inscId: string) {
    if (!id) return
    setBajandoId(inscId)
    try {
      await inscripcionesApi.darDeBaja(inscId)
      setInscripciones(prev => prev.filter(i => i.id !== inscId))
      setShift(s => s ? { ...s, enrolled: Math.max(0, s.enrolled - 1) } : s)
      addToast('Inscripción dada de baja', 'success')
    } catch {
      addToast('Error al dar de baja', 'error')
    } finally {
      setBajandoId(null)
    }
  }

  async function handleAddToWaitingList() {
    if (!id || !addEsperaClientId) return
    setAddEsperaSubmitting(true)
    try {
      await listaEsperaApi.create(addEsperaClientId, id, addEsperaTipo)
      addToast('Agregado a lista de espera', 'success')
      setAddEsperaClientId(''); setAddEsperaClientSearch(''); setAddEsperaMode(false)
      refetchEspera()
    } catch {
      addToast('Error al agregar a lista de espera', 'error')
    } finally {
      setAddEsperaSubmitting(false)
    }
  }

  async function handleEsperaAction(entryId: string, action: 'notificar' | 'aceptar' | 'rechazar' | 'eliminar') {
    setActionLoadingIds(prev => new Set([...prev, entryId]))
    try {
      if (action === 'eliminar') {
        await listaEsperaApi.remove(entryId)
      } else {
        const map = { notificar: 'NOTIFICADO', aceptar: 'ACEPTADO', rechazar: 'RECHAZADO' } as const
        await listaEsperaApi.updateEstado(entryId, map[action] as EstadoEspera)
      }
      addToast('Acción realizada', 'success')
      refetchEspera()
    } catch {
      addToast('Error al procesar la acción', 'error')
    } finally {
      setActionLoadingIds(prev => { const s = new Set(prev); s.delete(entryId); return s })
    }
  }

  async function saveAttendance() {
    if (!id || dateError) return
    setIsSavingAttendance(true)
    try {
      const activeClientIds = inscripciones.filter(i => i.estado === 'ACTIVA').map(i => i.clienteId)
      const presentIds = activeClientIds.filter(cid => present.has(cid))
      await attendanceApi.bulk(id, selectedDate, presentIds)
      await fetchByShiftAndDate(id, selectedDate)
      addToast('Asistencia guardada', 'success')
    } catch {
      addToast('Error al guardar asistencia', 'error')
    } finally {
      setIsSavingAttendance(false)
    }
  }

  function togglePresent(clientId: string) {
    setPresent(prev => {
      const next = new Set(prev)
      if (next.has(clientId)) next.delete(clientId)
      else next.add(clientId)
      return next
    })
  }

  // ─── Loading / not found ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="space-y-4 md:space-y-5"
      >
        {/* Breadcrumb */}
        <button
          onClick={() => navigate('/shifts')}
          className="group flex items-center gap-2 text-sm text-[#8A8A9A] hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
          <span>Turnos</span>
        </button>

        {/* Hero card */}
        <div className={`${glassCard} overflow-hidden`}>
          <div className="h-1 w-full bg-black/[0.06] dark:bg-white/[0.06] animate-pulse" />
          <div className="p-5 md:p-7">
            <div className="flex flex-col sm:flex-row gap-5 sm:items-start">
              <div className="h-16 w-16 md:h-20 md:w-20 rounded-2xl md:rounded-3xl bg-black/[0.06] dark:bg-white/[0.08] animate-pulse shrink-0" />
              <div className="flex-1 space-y-3 pt-1">
                <div className="h-8 w-64 rounded-xl bg-black/[0.06] dark:bg-white/[0.08] animate-pulse" />
                <div className="h-4 w-40 rounded-lg bg-black/[0.04] dark:bg-white/[0.06] animate-pulse" />
                <div className="h-4 w-32 rounded-lg bg-black/[0.04] dark:bg-white/[0.06] animate-pulse" />
                <div className="mt-4 pt-4 border-t border-gray-200/40 dark:border-white/[0.06] space-y-2">
                  <div className="h-3 w-20 rounded bg-black/[0.04] dark:bg-white/[0.06] animate-pulse" />
                  <div className="h-2 rounded-full bg-black/[0.06] dark:bg-white/[0.08] animate-pulse" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sub-navegación */}
        <div className="flex gap-1 p-1 rounded-2xl bg-white/40 dark:bg-white/[0.04] border border-gray-200/60 dark:border-white/[0.07]">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="flex-1 h-9 rounded-xl bg-black/[0.04] dark:bg-white/[0.06] animate-pulse" />
          ))}
        </div>

        {/* Contenido del tab */}
        <div className={`${glassCard} overflow-hidden p-8 space-y-4`}>
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-12 w-full rounded-xl bg-black/[0.05] dark:bg-white/[0.06] animate-pulse" style={{ opacity: 1 - i * 0.15 }} />
          ))}
        </div>
      </motion.div>
    )
  }

  if (!shift) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-[#8A8A9A]">
        <p className="text-sm">Turno no encontrado.</p>
        <Button variant="ghost" onClick={() => navigate('/shifts')}>
          <ArrowLeft size={15} /> Volver
        </Button>
      </div>
    )
  }

  const occupancyPct = Math.min((shift.enrolled / shift.capacity) * 100, 100)
  const activeInscrip = inscripciones.filter(i => i.estado === 'ACTIVA')

  const TABS: { value: DetailTab; label: string; badge?: number }[] = [
    { value: 'resumen',       label: 'Resumen',         badge: shift.enrolled },
    { value: 'inscripciones', label: 'Inscripciones',   badge: inscripciones.length },
    { value: 'asistencia',    label: 'Asistencia' },
    { value: 'espera',        label: 'Lista de espera', badge: esperaEntries.filter(e => e.estado === 'PENDIENTE').length },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-4 md:space-y-5"
    >
      {/* Breadcrumb */}
      <button
        onClick={() => navigate('/shifts')}
        className="group flex items-center gap-2 text-sm text-[#8A8A9A] hover:text-gray-900 dark:hover:text-white transition-colors"
      >
        <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
        <span>Turnos</span>
      </button>

      {/* Hero card */}
      <div className={`${glassCard} overflow-hidden`}>
        <div className={`h-1 w-full ${getOccupancyColor(shift.enrolled, shift.capacity)}`} />

        <AnimatePresence mode="wait">
          {!isEditingShift ? (
            /* ── Vista normal ── */
            <motion.div
              key="view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="p-5 md:p-7"
            >
              <div className="flex flex-col sm:flex-row gap-5 sm:items-start">
                <div className="h-16 w-16 md:h-20 md:w-20 rounded-2xl md:rounded-3xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Dumbbell size={28} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h1 className="text-2xl md:text-3xl font-black tracking-tight text-gray-900 dark:text-white leading-none">
                        Sala {shift.room} · {shift.startTime}–{shift.endTime}
                      </h1>
                      <p className="text-sm font-bold text-primary mt-1">
                        {shift.days.map(d => DAY_LABELS[d]).join(' / ')}
                        {shift.recurrente && <span className="ml-2 text-[10px] font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-full">Recurrente</span>}
                      </p>
                      <p className="text-sm text-[#8A8A9A] mt-1">
                        Prof. {shift.profesorNombre || '—'}
                      </p>
                    </div>
                    {isAdmin && (
                      <button
                        onClick={() => setIsEditingShift(true)}
                        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border border-gray-200 dark:border-white/[0.1] bg-white/70 dark:bg-white/[0.04] text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-white/[0.09] transition-all"
                      >
                        <Pencil size={12} /> Editar
                      </button>
                    )}
                  </div>
                  <div className="mt-4 pt-4 border-t border-gray-200/40 dark:border-white/[0.06]">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-[#8A8A9A]">Ocupación</span>
                      <span className="font-bold text-gray-900 dark:text-white tabular-nums">
                        {shift.enrolled}/{shift.capacity}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
                      <div
                        className={`h-full rounded-full ${getOccupancyColor(shift.enrolled, shift.capacity)} transition-all duration-500`}
                        style={{ width: `${occupancyPct}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            /* ── Modo edición inline ── */
            <motion.div
              key="edit"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="p-5 md:p-7"
            >
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Pencil size={18} className="text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-gray-900 dark:text-white">Editando turno</p>
                    <p className="text-xs text-[#8A8A9A]">Sala {shift.room} · {shift.startTime}–{shift.endTime}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingShift(false)
                    editReset({
                      room: shift.room, days: shift.days, recurrente: shift.recurrente,
                      startTime: shift.startTime, endTime: shift.endTime,
                      capacity: String(shift.capacity), profesorId: shift.profesorId,
                    })
                  }}
                  className="flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-semibold text-gray-500 dark:text-[#8A8A9A] border border-gray-200 dark:border-white/[0.08] hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-all"
                >
                  <X size={13} /> Cancelar
                </button>
              </div>

              <form onSubmit={editHandleSubmit(onEditSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-4">
                    <Select
                      label="Sala *"
                      options={[{ value: 'A', label: 'Sala A' }, { value: 'B', label: 'Sala B' }]}
                      error={editErrors.room?.message}
                      {...editRegister('room')}
                    />
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Días *</label>
                      <div className="flex flex-wrap gap-1.5">
                        {DAYS.map(d => {
                          const sel = editDays.includes(d)
                          return (
                            <button key={d} type="button"
                              onClick={() => {
                                if (sel) editSetValue('days', editDays.filter(x => x !== d), { shouldValidate: true })
                                else editSetValue('days', [...editDays, d], { shouldValidate: true })
                              }}
                              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
                                sel ? 'bg-primary text-white shadow-sm'
                                    : 'border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] text-gray-500 dark:text-[#8A8A9A] hover:border-gray-400 dark:hover:border-white/20'
                              }`}
                            >
                              {DAY_LABELS[d].slice(0, 3)}
                            </button>
                          )
                        })}
                      </div>
                      {(editErrors.days as any)?.message && (
                        <p className="text-xs text-red-500 mt-1">{(editErrors.days as any).message}</p>
                      )}
                    </div>
                    <label className="flex items-center justify-between gap-3 p-3 rounded-xl border border-white/[0.08] bg-white/[0.04] cursor-pointer">
                      <div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">Recurrente semanal</p>
                        <p className="text-[11px] text-[#8A8A9A] mt-0.5">Se repite todas las semanas</p>
                      </div>
                      <div className="relative flex-shrink-0">
                        <input type="checkbox" {...editRegister('recurrente')} className="sr-only peer" />
                        <div className={`w-10 h-5 rounded-full transition-colors ${editRecurrente ? 'bg-primary' : 'bg-gray-200 dark:bg-white/10'}`} />
                        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${editRecurrente ? 'translate-x-5' : 'translate-x-0.5'}`} />
                      </div>
                    </label>
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <Input label="Hora inicio *" type="time" error={editErrors.startTime?.message} {...editRegister('startTime')} />
                      <Input label="Hora fin *" type="time" error={editErrors.endTime?.message} {...editRegister('endTime')} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Input label="Cupo máximo *" type="number" error={editErrors.capacity?.message} {...editRegister('capacity')} />
                      <Select
                        label="Profesor *"
                        options={[
                          { value: '', label: professors.length === 0 ? 'Sin profesores' : 'Seleccionar...' },
                          ...professors.map(p => ({ value: p.id, label: p.name })),
                        ]}
                        error={editErrors.profesorId?.message}
                        {...editRegister('profesorId')}
                      />
                    </div>
                    <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] p-3">
                      <div className="flex justify-between text-xs mb-2">
                        <span className="text-[#8A8A9A]">Ocupación actual</span>
                        <span className="font-semibold text-gray-900 dark:text-white">{shift.enrolled}/{shift.capacity}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${getOccupancyColor(shift.enrolled, shift.capacity)}`}
                          style={{ width: `${occupancyPct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-white/[0.08]">
                  <button
                    type="button" onClick={deleteShift}
                    className="flex items-center gap-1.5 rounded-xl bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-400 hover:bg-red-500/20 transition-all"
                  >
                    <Trash2 size={14} /> Eliminar turno
                  </button>
                  <Button type="submit" isLoading={editSubmitting}>
                    <Save size={14} /> Guardar cambios
                  </Button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Sub-navegación */}
      <div className="space-y-3">
        <div className="flex gap-1 p-1 rounded-2xl bg-white/40 dark:bg-white/[0.04] border border-gray-200/60 dark:border-white/[0.07] overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className={`flex items-center justify-center gap-1.5 flex-shrink-0 flex-1 px-2 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-150 min-w-0 ${
                tab === t.value
                  ? 'bg-white dark:bg-white/[0.09] text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-[#8A8A9A] hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              <span className="truncate">{t.label}</span>
              {t.badge !== undefined && t.badge > 0 && (
                <span className={`min-w-[18px] text-center text-[10px] px-1 py-0.5 rounded-md font-bold shrink-0 ${
                  tab === t.value ? 'bg-primary/20 text-primary' : 'bg-gray-100 dark:bg-white/[0.06] text-gray-500 dark:text-[#8A8A9A]'
                }`}>
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Contenido del tab */}
        <div className={`${glassCard} overflow-hidden min-h-[300px]`}>

          {/* ══ RESUMEN ══ */}
          {tab === 'resumen' && (
            <div>
              {loadingInscrip ? (
                <div className="p-5 space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}
                </div>
              ) : activeInscrip.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.04] border border-white/[0.08]">
                    <Users size={20} className="text-[#8A8A9A]" />
                  </div>
                  <p className="text-sm text-[#8A8A9A]">No hay clientes inscriptos activos</p>
                  <button
                    onClick={() => setTab('inscripciones')}
                    className="text-xs text-primary hover:underline"
                  >
                    Inscribir clientes →
                  </button>
                </div>
              ) : (
                <div className="p-5 flex flex-col gap-3">
                  {activeInscrip.map(insc => {
                    const clientData = clients.find(c => String(c.id) === String(insc.clienteId))
                    
                    // Estado de membresía dinámico
                    const statusConfig = {
                      active: {
                        label: 'Activo',
                        classes: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                      },
                      expiring: {
                        label: 'Por Vencer',
                        classes: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                      },
                      debt: {
                        label: 'Deuda',
                        classes: 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'
                      },
                      inactive: {
                        label: 'Inactivo',
                        classes: 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border border-gray-500/20'
                      }
                    }
                    
                    const clientStatus = clientData?.status && statusConfig[clientData.status]
                      ? statusConfig[clientData.status]
                      : { label: 'Inscripto', classes: 'bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20' }

                    return (
                      <div
                        key={insc.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl border border-gray-200 dark:border-white/[0.08] bg-white/50 dark:bg-white/[0.03] hover:bg-white dark:hover:bg-white/[0.06] transition-all hover:shadow-sm"
                      >
                        {/* Izquierda: Info Principal */}
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                            <span className="text-xs font-black text-primary">
                              {insc.clienteNombre.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-bold text-gray-900 dark:text-white truncate max-w-[150px] sm:max-w-none">
                                {insc.clienteNombre}
                              </p>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${clientStatus.classes}`}>
                                {clientStatus.label}
                              </span>
                            </div>
                            
                            {/* Chips de Detalles Adicionales */}
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
                              {clientData?.dni && (
                                <span className="inline-flex items-center gap-1 text-[11px] text-gray-500 dark:text-[#8A8A9A]">
                                  <Hash size={10} className="shrink-0 opacity-60" />
                                  DNI {clientData.dni}
                                </span>
                              )}
                              {clientData?.planName && (
                                <span className="inline-flex items-center gap-1 text-[11px] text-primary font-semibold bg-primary/5 dark:bg-primary/10 px-1.5 py-0.5 rounded">
                                  <Tag size={10} className="shrink-0 opacity-60" />
                                  {clientData.planName}
                                </span>
                              )}
                              <span className="inline-flex items-center gap-1 text-[11px] text-gray-500 dark:text-[#8A8A9A]">
                                <CalendarDays size={10} className="shrink-0 opacity-60" />
                                Desde {format(new Date(insc.fechaDesde), "d MMM yyyy", { locale: es })}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Derecha: Botón rápido de contacto */}
                        {clientData?.phone && (
                          <a
                            href={`https://wa.me/54${clientData.phone.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 self-end sm:self-center text-xs font-bold px-3 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 transition-all shrink-0"
                          >
                            <MessageCircle size={13} className="text-emerald-500" />
                            WhatsApp
                          </a>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ══ INSCRIPCIONES ══ */}
          {tab === 'inscripciones' && (() => {
            const enrolledIds = new Set(inscripciones.map(i => i.clienteId))
            const filteredForAdd = clients
              .filter(c => !enrolledIds.has(String(c.id)))
              .filter(c => !addClientSearch || `${c.name} ${c.lastName}`.toLowerCase().includes(addClientSearch.toLowerCase()))
              .slice(0, 8)
            return (
              <div className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {inscripciones.length === 0 ? 'Sin inscriptos activos' : `${inscripciones.length} inscripto${inscripciones.length !== 1 ? 's' : ''}`}
                  </p>
                  <button
                    onClick={() => { setAddClientMode(m => !m); setAddClientSearch(''); setAddClientId('') }}
                    className="flex items-center gap-1.5 rounded-xl bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition-all"
                  >
                    <UserPlus size={13} /> Agregar cliente
                  </button>
                </div>

                <AnimatePresence>
                  {addClientMode && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                      className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-2"
                    >
                      <div className="relative">
                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A8A9A]" />
                        <input
                          value={addClientSearch}
                          onChange={e => { setAddClientSearch(e.target.value); setAddClientId('') }}
                          placeholder="Buscar cliente..."
                          className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] pl-8 pr-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-[#8A8A9A] outline-none focus:border-primary/40"
                        />
                      </div>
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {filteredForAdd.length === 0 ? (
                          <p className="text-xs text-[#8A8A9A] text-center py-3">
                            {addClientSearch ? 'Sin resultados' : 'Todos los clientes ya están inscriptos'}
                          </p>
                        ) : filteredForAdd.map(c => (
                          <button
                            key={c.id} type="button"
                            onClick={() => setAddClientId(String(c.id))}
                            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition-all ${
                              addClientId === String(c.id)
                                ? 'bg-primary/10 border border-primary/30 text-primary'
                                : 'hover:bg-black/5 dark:hover:bg-white/5 text-gray-900 dark:text-white'
                            }`}
                          >
                            <span className="font-medium">{c.name} {c.lastName}</span>
                          </button>
                        ))}
                      </div>
                      {addClientId && (
                        <Button size="sm" onClick={handleAddToShift} isLoading={addClientSubmitting} className="w-full">
                          Inscribir cliente seleccionado
                        </Button>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {loadingInscrip ? (
                  <div className="space-y-2">
                    {[1,2,3].map(i => <div key={i} className="h-12 rounded-xl bg-white/[0.04] animate-pulse" />)}
                  </div>
                ) : inscripciones.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-[#8A8A9A]">
                    <Users size={28} className="mb-2 opacity-50" />
                    <p className="text-sm">No hay clientes inscriptos en este turno</p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {inscripciones.map(insc => (
                      <motion.div
                        key={insc.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2.5"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{insc.clienteNombre}</p>
                          <p className="text-xs text-[#8A8A9A]">
                            Desde {format(new Date(insc.fechaDesde), "d MMM yyyy", { locale: es })}
                          </p>
                        </div>
                        <span className="rounded-full bg-green-500/10 px-2.5 py-0.5 text-xs font-semibold text-green-400 border border-green-500/20 shrink-0">
                          Activo
                        </span>
                        <button
                          disabled={bajandoId === insc.id}
                          onClick={() => handleDarDeBaja(insc.id)}
                          className="flex items-center gap-1 rounded-lg bg-red-500/10 px-2.5 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/20 transition-all disabled:opacity-50 shrink-0"
                        >
                          {bajandoId === insc.id ? '...' : <><X size={11} /> Dar de baja</>}
                        </button>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            )
          })()}

          {/* ══ ASISTENCIA ══ */}
          {tab === 'asistencia' && (
            <div className="p-5 space-y-5">
              {/* Barra de control superior premium */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-200/50 dark:border-white/[0.06]">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2.5 bg-white/50 dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.08] rounded-2xl px-3.5 py-2 hover:border-primary dark:hover:border-primary/50 transition-all shadow-sm">
                    <span className="text-xs font-bold text-gray-500 dark:text-[#8A8A9A] uppercase tracking-wider">Fecha:</span>
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={e => setSelectedDate(e.target.value)}
                      className="bg-transparent border-0 p-0 text-sm font-semibold text-gray-900 dark:text-white focus:ring-0 focus:outline-none cursor-pointer [color-scheme:light] dark:[color-scheme:dark]"
                    />
                  </div>
                </div>

                <Button
                  onClick={saveAttendance}
                  isLoading={isSavingAttendance}
                  disabled={!!dateError}
                  className="rounded-2xl shadow-md hover:shadow-lg transition-all"
                >
                  <CheckCircle2 size={16} className="mr-1.5" />
                  Guardar asistencia
                </Button>
              </div>

              {dateError && (
                <div className="flex items-center gap-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-3 text-sm text-amber-400">
                  <AlertTriangle size={16} className="shrink-0" />
                  <span>{dateError}</span>
                </div>
              )}

              {!dateError && (loadingAttendance || loadingInscrip ? (
                <div className="space-y-3">
                  {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}
                </div>
              ) : (() => {
                const presentCount = activeInscrip.filter(i => present.has(i.clienteId)).length
                return (
                  <>
                    {activeInscrip.length > 0 && (
                      <p className="text-xs text-[#8A8A9A]">
                        {presentCount} presente{presentCount !== 1 ? 's' : ''} de {activeInscrip.length}
                      </p>
                    )}
                    {activeInscrip.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 text-[#8A8A9A]">
                        <Users size={24} className="mb-2 opacity-50" />
                        <p className="text-sm">No hay clientes inscriptos activos</p>
                      </div>
                    ) : (
                      <div className="space-y-3 p-4">
                        {activeInscrip.map(insc => {
                          const isPresent = present.has(insc.clienteId)
                          
                          // Estilos dinámicos premium para el contenedor
                          const cardTheme = isPresent
                            ? 'border-green-500/30 dark:border-green-500/20 bg-green-500/[0.04] dark:bg-green-500/[0.02] hover:bg-green-500/[0.08] dark:hover:bg-green-500/[0.04]'
                            : 'border-red-500/30 dark:border-red-500/20 bg-red-500/[0.04] dark:bg-red-500/[0.02] hover:bg-red-500/[0.08] dark:hover:bg-red-500/[0.04]'
                            
                          // Estilos dinámicos para la mitad de estado
                          const rightBg = isPresent
                            ? 'bg-green-500/10 dark:bg-green-500/20 text-green-600 dark:text-green-400'
                            : 'bg-red-500/10 dark:bg-red-500/20 text-red-600 dark:text-red-400'
                            
                          // Color de la línea diagonal divisoria
                          const lineStroke = isPresent
                            ? 'text-green-500/30 dark:text-green-500/20'
                            : 'text-red-500/30 dark:text-red-500/20'

                          return (
                            <label
                              key={insc.id}
                              className={`flex items-stretch rounded-2xl border transition-all duration-250 cursor-pointer overflow-hidden shadow-sm h-14 ${cardTheme}`}
                            >
                              <input
                                type="checkbox"
                                className="sr-only"
                                checked={isPresent}
                                onChange={() => togglePresent(insc.clienteId)}
                              />
                              
                              {/* Nombre del cliente */}
                              <div className="flex-1 flex items-center px-5 font-bold text-sm text-gray-900 dark:text-white truncate">
                                {insc.clienteNombre}
                              </div>
                              
                              {/* Estado (Presente / Ausente) con corte diagonal perfecto */}
                              <div
                                style={{ clipPath: 'polygon(24px 0, 100% 0, 100% 100%, 0 100%)' }}
                                className={`relative w-32 sm:w-40 flex items-center justify-center font-black text-xs sm:text-sm tracking-wider uppercase shrink-0 transition-colors pl-6 -ml-6 ${rightBg}`}
                              >
                                {/* Divisor Diagonal SVG alineado exactamente al clipPath */}
                                <div className={`absolute left-0 top-0 bottom-0 w-6 pointer-events-none ${lineStroke}`}>
                                  <svg className="h-full w-full" viewBox="0 0 24 100" preserveAspectRatio="none">
                                    <line
                                      x1="0"
                                      y1="100"
                                      x2="24"
                                      y2="0"
                                      stroke="currentColor"
                                      strokeWidth="3"
                                    />
                                  </svg>
                                </div>
                                <span className="relative z-10">{isPresent ? 'Presente' : 'Ausente'}</span>
                              </div>
                            </label>
                          )
                        })}
                      </div>)}
                  </>
                )
              })())}
            </div>
          )}

          {/* ══ LISTA DE ESPERA ══ */}
          {tab === 'espera' && (
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {esperaEntries.length === 0 ? 'Lista de espera vacía' : `${esperaEntries.length} entrada${esperaEntries.length !== 1 ? 's' : ''}`}
                </p>
                <button
                  onClick={() => { setAddEsperaMode(m => !m); setAddEsperaClientSearch(''); setAddEsperaClientId('') }}
                  className="flex items-center gap-1.5 rounded-xl bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition-all"
                >
                  <ListPlus size={13} /> Agregar a lista
                </button>
              </div>

              <AnimatePresence>
                {addEsperaMode && (() => {
                  const waitlistedIds = new Set(
                    esperaEntries.filter(e => e.estado === 'PENDIENTE' || e.estado === 'NOTIFICADO').map(e => e.clienteId)
                  )
                  const filteredForEspera = clients
                    .filter(c => !waitlistedIds.has(String(c.id)))
                    .filter(c => !addEsperaClientSearch || `${c.name} ${c.lastName}`.toLowerCase().includes(addEsperaClientSearch.toLowerCase()))
                    .slice(0, 8)
                  return (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                      className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-3"
                    >
                      <div className="relative">
                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A8A9A]" />
                        <input
                          value={addEsperaClientSearch}
                          onChange={e => { setAddEsperaClientSearch(e.target.value); setAddEsperaClientId('') }}
                          placeholder="Buscar cliente..."
                          className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] pl-8 pr-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-[#8A8A9A] outline-none focus:border-primary/40"
                        />
                      </div>
                      <div className="space-y-1 max-h-36 overflow-y-auto">
                        {filteredForEspera.length === 0 ? (
                          <p className="text-xs text-[#8A8A9A] text-center py-2">
                            {addEsperaClientSearch ? 'Sin resultados' : 'No hay clientes disponibles'}
                          </p>
                        ) : filteredForEspera.map(c => (
                          <button key={c.id} type="button"
                            onClick={() => setAddEsperaClientId(String(c.id))}
                            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition-all ${
                              addEsperaClientId === String(c.id)
                                ? 'bg-primary/10 border border-primary/30 text-primary'
                                : 'hover:bg-black/5 dark:hover:bg-white/5 text-gray-900 dark:text-white'
                            }`}
                          >
                            {c.name} {c.lastName}
                          </button>
                        ))}
                      </div>
                      {addEsperaClientId && (
                        <div className="space-y-2">
                          <div className="flex gap-2">
                            {(['INTERNA', 'EXTERNA'] as const).map(t => (
                              <button key={t} type="button" onClick={() => setAddEsperaTipo(t)}
                                className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition-all border ${
                                  addEsperaTipo === t
                                    ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-transparent'
                                    : 'border-gray-200 dark:border-white/[0.08] text-gray-500 dark:text-[#8A8A9A]'
                                }`}
                              >
                                {t === 'INTERNA' ? 'Interna (con membresía)' : 'Externa (sin membresía)'}
                              </button>
                            ))}
                          </div>
                          <Button size="sm" onClick={handleAddToWaitingList} isLoading={addEsperaSubmitting} className="w-full">
                            Agregar a lista de espera
                          </Button>
                        </div>
                      )}
                    </motion.div>
                  )
                })()}
              </AnimatePresence>

              {/* Sub-tabs Interna / Externa */}
              <div className="flex gap-1.5">
                {(['INTERNA', 'EXTERNA'] as const).map(tipo => {
                  const count = esperaEntries.filter(e => e.tipo === tipo).length
                  return (
                    <button key={tipo} onClick={() => setEsperaTipoTab(tipo)}
                      className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all flex items-center gap-1.5 ${
                        esperaTipoTab === tipo
                          ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                          : 'border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] text-gray-500 dark:text-[#8A8A9A]'
                      }`}
                    >
                      {tipo === 'INTERNA' ? 'Interna' : 'Externa'}
                      {count > 0 && (
                        <span className={`flex h-4 min-w-[1rem] items-center justify-center rounded-full text-[10px] font-bold px-1 ${
                          esperaTipoTab === tipo
                            ? 'bg-white/20 dark:bg-black/20 text-white dark:text-gray-900'
                            : 'bg-gray-200 dark:bg-white/10 text-gray-600 dark:text-gray-300'
                        }`}>{count}</span>
                      )}
                    </button>
                  )
                })}
              </div>

              {esperaLoading ? (
                <div className="space-y-2">
                  {[1,2,3].map(i => <div key={i} className="h-14 rounded-xl bg-white/[0.04] animate-pulse" />)}
                </div>
              ) : esperaError ? (
                <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3">
                  <p className="text-sm text-red-400">{esperaError}</p>
                </div>
              ) : (() => {
                const filteredEspera = esperaEntries.filter(e => e.tipo === esperaTipoTab)
                if (filteredEspera.length === 0) return (
                  <div className="flex flex-col items-center justify-center py-10 text-[#8A8A9A]">
                    <Clock size={24} className="mb-2 opacity-50" />
                    <p className="text-sm">No hay entradas {esperaTipoTab === 'INTERNA' ? 'internas' : 'externas'}</p>
                  </div>
                )
                return (
                  <div className="space-y-1.5">
                    {filteredEspera.map(entry => {
                      const isActioning = actionLoadingIds.has(entry.id)
                      return (
                        <motion.div
                          key={entry.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                          className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2.5"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{entry.clienteNombre}</p>
                            <p className="text-xs text-[#8A8A9A]">
                              {format(new Date(entry.fechaSolicitud), "d MMM yyyy", { locale: es })}
                            </p>
                          </div>
                          <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold border ${ESPERA_BADGE[entry.estado]}`}>
                            {ESPERA_LABEL[entry.estado]}
                          </span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {entry.estado === 'PENDIENTE' && (
                              <button disabled={isActioning} onClick={() => handleEsperaAction(entry.id, 'notificar')}
                                className="flex items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition-all disabled:opacity-50">
                                <Bell size={11} /> Notificar
                              </button>
                            )}
                            {entry.estado === 'NOTIFICADO' && (<>
                              <button disabled={isActioning} onClick={() => handleEsperaAction(entry.id, 'aceptar')}
                                className="flex items-center gap-1 rounded-lg bg-green-500/10 px-2 py-1.5 text-xs font-semibold text-green-400 hover:bg-green-500/20 transition-all disabled:opacity-50">
                                <Check size={11} /> Aceptó
                              </button>
                              <button disabled={isActioning} onClick={() => handleEsperaAction(entry.id, 'rechazar')}
                                className="flex items-center gap-1 rounded-lg bg-red-500/10 px-2 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/20 transition-all disabled:opacity-50">
                                <X size={11} /> Rechazó
                              </button>
                            </>)}
                            {(entry.estado === 'ACEPTADO' || entry.estado === 'RECHAZADO') && (
                              <button disabled={isActioning} onClick={() => handleEsperaAction(entry.id, 'eliminar')}
                                className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all disabled:opacity-50">
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        </motion.div>
                      )
                    })}
                  </div>
                )
              })()}
            </div>
          )}

        </div>
      </div>
    </motion.div>
  )
}
