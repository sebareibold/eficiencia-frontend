import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { pageVariants, tabContentVariants, staggerContainerFast, fadeUpItem } from '../lib/motion'
import {
  ArrowLeft, Users, Clock, Dumbbell, UserPlus, ListPlus,
  X, Bell, Check, Trash2, Search, AlertTriangle, CheckCircle2, Pencil, Save,
  Hash, Tag, CalendarDays, GripVertical, Ban, Plus, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { shiftsApi, professorsApi } from '../api/shifts.api'
import { clientsApi } from '../api/clients.api'
import type { Client } from '../types/client.types'
import { cancelacionesApi } from '../api/cancelaciones.api'
import type { CancelacionTurno } from '../types/cancelaciones.types'
import { inscripcionesApi } from '../api/inscripciones.api'
import { attendanceApi } from '../api/attendance.api'
import { listaEsperaApi } from '../api/listaEspera.api'
import { useListaEspera } from '../hooks/useListaEspera'
import { useAttendance } from '../hooks/useAttendance'
import { useClients } from '../hooks/useClients'
import { useShifts } from '../hooks/useShifts'
import { useUiStore } from '../store/uiStore'
import { useAuthStore } from '../store/authStore'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import Skeleton from '../components/ui/Skeleton'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import EmptyState from '../components/ui/EmptyState'
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
  days:            z.array(z.enum(['monday','tuesday','wednesday','thursday','friday','saturday','sunday'])).min(1),
  recurrente:      z.boolean().default(true),
  startTime:       z.string().min(1, 'Requerido'),
  endTime:         z.string().min(1, 'Requerido'),
  cupoMaximoSalaA: z.string().refine(v => v !== '' && !isNaN(Number(v)) && Number(v) >= 0, 'Inválido'),
  cupoMaximoSalaB: z.string().refine(v => v !== '' && !isNaN(Number(v)) && Number(v) >= 0, 'Inválido'),
  profesorId:      z.string().min(1, 'Requerido'),
})
type EditValues = z.infer<typeof editSchema>

type DetailTab = 'resumen' | 'inscripciones' | 'asistencia' | 'espera' | 'cancelaciones'

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

  // Traer lista primero para poder inicializar el estado desde cache
  const { shifts } = useShifts()

  const [shift, setShift] = useState<Shift | null>(() => shifts.find(s => s.id === id) ?? null)
  const [loading, setLoading] = useState(() => !shifts.find(s => s.id === id))
  const [tab, setTab] = useState<DetailTab>('resumen')
  const [isEditingShift, setIsEditingShift] = useState(false)
  const [isConfirmDeleteShift, setIsConfirmDeleteShift] = useState(false)
  const [isDeletingShift, setIsDeletingShift] = useState(false)

  // Inscripciones
  const [inscripciones, setInscripciones] = useState<InscripcionEntry[]>([])
  const [loadingInscrip, setLoadingInscrip] = useState(false)
  const [bajandoId, setBajandoId] = useState<string | null>(null)

  // DnD inscripciones
  const [localInscripciones, setLocalInscripciones] = useState<InscripcionEntry[]>([])
  const [pendingChanges, setPendingChanges] = useState<Set<string>>(new Set())
  const [dragOverSala, setDragOverSala] = useState<'A' | 'B' | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [savingChanges, setSavingChanges] = useState(false)

  const [addClientMode, setAddClientMode] = useState(false)
  const [addClientSearch, setAddClientSearch] = useState('')
  const [addClientId, setAddClientId] = useState('')
  const [addClientSala, setAddClientSala] = useState<'A' | 'B'>('A')
  const [addClientSubmitting, setAddClientSubmitting] = useState(false)
  const [clientSearchResults, setClientSearchResults] = useState<Client[]>([])
  const [clientSearchLoading, setClientSearchLoading] = useState(false)

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

  // Cancelaciones
  const [cancelaciones, setCancelaciones] = useState<CancelacionTurno[]>([])
  const [loadingCancelaciones, setLoadingCancelaciones] = useState(false)
  const [cancelacionFormOpen, setCancelacionFormOpen] = useState(false)
  const [cancelacionFecha, setCancelacionFecha] = useState('')
  const [cancelacionMotivo, setCancelacionMotivo] = useState('')
  const [savingCancelacion, setSavingCancelacion] = useState(false)
  const [deletingCancelacionId, setDeletingCancelacionId] = useState<string | null>(null)

  // Edit
  const [professors, setProfessors] = useState<{ id: string; name: string }[]>([])
  const [editSubmitting, setEditSubmitting] = useState(false)

  const { clients } = useClients()

  // Buscador server-side para el panel "Agregar cliente" — carga todos con diasUsados real
  useEffect(() => {
    if (!addClientMode) return
    setClientSearchLoading(true)
    const timer = setTimeout(() => {
      clientsApi.getAll({ search: addClientSearch, limit: 50 })
        .then(r => setClientSearchResults(r.data))
        .catch(() => {})
        .finally(() => setClientSearchLoading(false))
    }, addClientSearch ? 300 : 0)
    return () => clearTimeout(timer)
  }, [addClientSearch, addClientMode])

  const { entries: esperaEntries, isLoading: esperaLoading, error: esperaError, refetch: refetchEspera } =
    useListaEspera(id ?? null)
  const { records: attendanceRecords, isLoading: loadingAttendance, fetchByShiftAndDate } = useAttendance()

  const {
    register: editRegister, handleSubmit: editHandleSubmit,
    formState: { errors: editErrors }, reset: editReset,
    watch: editWatch, setValue: editSetValue,
  } = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    defaultValues: { days: [], recurrente: true, startTime: '', endTime: '', cupoMaximoSalaA: '', cupoMaximoSalaB: '', profesorId: '' },
  })
  const editDays = (editWatch('days') || []) as WeekDay[]
  const editRecurrente = editWatch('recurrente') ?? true

  // Navegación entre turnos — usa `id` de la URL, no `shift.id`, para estar siempre sincronizado
  const { prevShift, nextShift } = useMemo(() => {
    if (!id || !shifts.length) return { prevShift: null, nextShift: null }
    const sorted = [...shifts].sort((a, b) => a.startTime.localeCompare(b.startTime))
    const currentIndex = sorted.findIndex(s => s.id === id)
    return {
      prevShift: currentIndex > 0 ? sorted[currentIndex - 1] : null,
      nextShift: currentIndex >= 0 && currentIndex < sorted.length - 1 ? sorted[currentIndex + 1] : null,
    }
  }, [id, shifts])

  // Cargar turno — inicialización lazy desde cache, API solo como fallback
  useEffect(() => {
    if (!id) return

    const fromCache = shifts.find(s => s.id === id)
    if (fromCache) {
      setShift(fromCache)
      editReset({
        days: fromCache.days, recurrente: fromCache.recurrente,
        startTime: fromCache.startTime, endTime: fromCache.endTime,
        cupoMaximoSalaA: String(fromCache.cupoMaximoSalaA),
        cupoMaximoSalaB: String(fromCache.cupoMaximoSalaB),
        profesorId: fromCache.profesorId,
      })
      setLoading(false)
      return
    }

    // Solo llega acá si la lista no estaba cargada (acceso directo por URL)
    if (!shift) {
      setLoading(true)
      shiftsApi.getById(id)
        .then(s => {
          setShift(s)
          editReset({
            days: s.days, recurrente: s.recurrente,
            startTime: s.startTime, endTime: s.endTime,
            cupoMaximoSalaA: String(s.cupoMaximoSalaA),
            cupoMaximoSalaB: String(s.cupoMaximoSalaB),
            profesorId: s.profesorId,
          })
        })
        .catch(() => addToast('Error al cargar el turno', 'error'))
        .finally(() => setLoading(false))
    }
  }, [id, shifts])

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

  // Cargar cancelaciones cuando se abre el tab
  useEffect(() => {
    if (tab !== 'cancelaciones' || !id) return
    setLoadingCancelaciones(true)
    cancelacionesApi.getByTurno(id)
      .then(setCancelaciones)
      .catch(() => addToast('Error al cargar cancelaciones', 'error'))
      .finally(() => setLoadingCancelaciones(false))
  }, [tab, id])

  // Sincronizar checkboxes asistencia
  useEffect(() => {
    const presentIds = new Set(attendanceRecords.filter(r => r.present).map(r => r.clientId))
    setPresent(presentIds)
  }, [attendanceRecords])

  // Sincronizar local inscripciones con datos del servidor (resetea cambios pendientes)
  useEffect(() => {
    setLocalInscripciones(inscripciones.filter(i => i.estado === 'ACTIVA'))
    setPendingChanges(new Set())
  }, [inscripciones])

  const dateError = null

  // ─── Handlers ────────────────────────────────────────────────────────────────

  async function onEditSubmit(data: EditValues) {
    if (!id) return
    setEditSubmitting(true)
    try {
      const updated = await shiftsApi.update(id, {
        days: data.days, recurrente: data.recurrente,
        startTime: data.startTime, endTime: data.endTime,
        cupoMaximoSalaA: Number(data.cupoMaximoSalaA),
        cupoMaximoSalaB: Number(data.cupoMaximoSalaB),
        profesorId: data.profesorId,
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
    if (!id) return
    setIsDeletingShift(true)
    try {
      await shiftsApi.remove(id)
      addToast('Turno eliminado', 'success')
      navigate('/shifts')
    } catch {
      addToast('Error al eliminar el turno', 'error')
      setIsDeletingShift(false)
    }
  }

  async function handleAddToShift() {
    if (!id || !addClientId) return
    setAddClientSubmitting(true)
    try {
      const res = await inscripcionesApi.enroll(addClientId, id, addClientSala)
      addToast(res.enListaEspera ? `Sala ${addClientSala} llena — cliente en lista de espera` : `Cliente inscripto en Sala ${addClientSala}`, 'success')
      setAddClientId(''); setAddClientSearch(''); setAddClientMode(false); setClientSearchResults([])
      inscripcionesApi.getByTurno(id).then(setInscripciones).catch(() => {})
      setShift(s => {
        if (!s) return s
        const newInscritosA = addClientSala === 'A' && !res.enListaEspera ? s.inscritosA + 1 : s.inscritosA
        const newInscritosB = addClientSala === 'B' && !res.enListaEspera ? s.inscritosB + 1 : s.inscritosB
        return { ...s, inscritosA: newInscritosA, inscritosB: newInscritosB, enrolled: newInscritosA + newInscritosB }
      })
    } catch {
      addToast('Error al inscribir', 'error')
    } finally {
      setAddClientSubmitting(false)
    }
  }

  // ─── DnD handlers ────────────────────────────────────────────────────────────

  function handleDragStart(e: React.DragEvent, inscId: string) {
    setDraggingId(inscId)
    e.dataTransfer.setData('inscripcionId', inscId)
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDragOver(e: React.DragEvent, sala: 'A' | 'B') {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverSala(sala)
  }

  function handleDragLeave(e: React.DragEvent) {
    // Solo resetear si salimos del drop zone real (no de un hijo)
    if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
      setDragOverSala(null)
    }
  }

  function handleDrop(e: React.DragEvent, targetSala: 'A' | 'B') {
    e.preventDefault()
    const inscId = e.dataTransfer.getData('inscripcionId')
    const insc = localInscripciones.find(i => i.id === inscId)
    setDragOverSala(null)
    setDraggingId(null)
    if (!insc || insc.sala === targetSala) return

    setLocalInscripciones(prev => prev.map(i => i.id === inscId ? { ...i, sala: targetSala } : i))
    setPendingChanges(prev => {
      const next = new Set(prev)
      // Si vuelve a la sala original del servidor, ya no está pendiente
      const original = inscripciones.find(i => i.id === inscId)
      if (original && original.sala === targetSala) next.delete(inscId)
      else next.add(inscId)
      return next
    })
  }

  async function handleGuardarCambiosSala() {
    setSavingChanges(true)
    const changed = localInscripciones.filter(i => pendingChanges.has(i.id))
    try {
      await Promise.all(changed.map(i => inscripcionesApi.cambiarSala(i.id, i.sala)))
      const newA = localInscripciones.filter(i => i.sala === 'A').length
      const newB = localInscripciones.filter(i => i.sala === 'B').length
      setInscripciones(prev => prev.map(i => {
        const local = localInscripciones.find(l => l.id === i.id)
        return local ? { ...i, sala: local.sala } : i
      }))
      setShift(s => s ? { ...s, inscritosA: newA, inscritosB: newB, enrolled: newA + newB } : s)
      setPendingChanges(new Set())
      addToast(`${changed.length} cambio${changed.length !== 1 ? 's' : ''} guardado${changed.length !== 1 ? 's' : ''}`, 'success')
    } catch {
      addToast('Error al guardar cambios de sala', 'error')
    } finally {
      setSavingChanges(false)
    }
  }

  function handleCancelarCambiosSala() {
    setLocalInscripciones(inscripciones.filter(i => i.estado === 'ACTIVA'))
    setPendingChanges(new Set())
  }

  async function handleDarDeBaja(inscId: string, sala: 'A' | 'B') {
    if (!id) return
    setBajandoId(inscId)
    try {
      await inscripcionesApi.darDeBaja(inscId)
      setInscripciones(prev => prev.filter(i => i.id !== inscId))
      setPendingChanges(prev => { const s = new Set(prev); s.delete(inscId); return s })
      setShift(s => {
        if (!s) return s
        const newInscritosA = sala === 'A' ? Math.max(0, s.inscritosA - 1) : s.inscritosA
        const newInscritosB = sala === 'B' ? Math.max(0, s.inscritosB - 1) : s.inscritosB
        return { ...s, inscritosA: newInscritosA, inscritosB: newInscritosB, enrolled: newInscritosA + newInscritosB }
      })
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

  async function handleAddCancelacion() {
    if (!id || !cancelacionFecha) return
    setSavingCancelacion(true)
    try {
      const nueva = await cancelacionesApi.create({ turnoId: id, fecha: cancelacionFecha, motivo: cancelacionMotivo || undefined })
      setCancelaciones(prev => [nueva, ...prev])
      setCancelacionFormOpen(false)
      setCancelacionFecha('')
      setCancelacionMotivo('')
      addToast('Cancelación registrada', 'success')
    } catch {
      addToast('Error al registrar cancelación', 'error')
    } finally {
      setSavingCancelacion(false)
    }
  }

  async function handleDeleteCancelacion(cancelacionId: string) {
    setDeletingCancelacionId(cancelacionId)
    try {
      await cancelacionesApi.remove(cancelacionId)
      setCancelaciones(prev => prev.filter(c => c.id !== cancelacionId))
      addToast('Cancelación eliminada', 'success')
    } catch {
      addToast('Error al eliminar cancelación', 'error')
    } finally {
      setDeletingCancelacionId(null)
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
      <div className="space-y-4 md:space-y-5">
        <button
          onClick={() => navigate('/shifts')}
          className="group flex items-center gap-2 text-sm text-[#8A8A9A] hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
          <span>Turnos</span>
        </button>

        <div className={`${glassCard} overflow-hidden`}>
          <div className="h-[3px] w-full bg-black/[0.06] dark:bg-white/[0.06] animate-pulse" />
          <div className="flex items-stretch">
            {/* Flecha izq skeleton */}
            <div className="w-8 shrink-0 border-r border-gray-200/40 dark:border-white/[0.06] flex items-center justify-center">
              <div className="h-5 w-3 rounded bg-black/[0.06] dark:bg-white/[0.08] animate-pulse" />
            </div>
            {/* Contenido skeleton */}
            <div className="flex-1 p-5 md:p-7">
              <div className="flex flex-col sm:flex-row gap-5 sm:items-start">
                <div className="h-16 w-16 md:h-20 md:w-20 rounded-2xl md:rounded-3xl bg-black/[0.06] dark:bg-white/[0.08] animate-pulse shrink-0" />
                <div className="flex-1 space-y-3 pt-1">
                  <div className="h-8 w-48 rounded-xl bg-black/[0.06] dark:bg-white/[0.08] animate-pulse" />
                  <div className="h-4 w-36 rounded-lg bg-black/[0.04] dark:bg-white/[0.06] animate-pulse" />
                  <div className="h-3 w-28 rounded bg-black/[0.04] dark:bg-white/[0.05] animate-pulse" />
                  <div className="pt-4 border-t border-gray-200/40 dark:border-white/[0.06] space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="h-3 w-16 rounded bg-black/[0.04] dark:bg-white/[0.06] animate-pulse" />
                      <div className="flex-1 h-1.5 rounded-full bg-black/[0.06] dark:bg-white/[0.08] animate-pulse" />
                      <div className="h-3 w-10 rounded bg-black/[0.04] dark:bg-white/[0.06] animate-pulse" />
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="h-3 w-16 rounded bg-black/[0.04] dark:bg-white/[0.06] animate-pulse" />
                      <div className="flex-1 h-1.5 rounded-full bg-black/[0.06] dark:bg-white/[0.08] animate-pulse" />
                      <div className="h-3 w-10 rounded bg-black/[0.04] dark:bg-white/[0.06] animate-pulse" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {/* Flecha der skeleton */}
            <div className="w-8 shrink-0 border-l border-gray-200/40 dark:border-white/[0.06] flex items-center justify-center">
              <div className="h-5 w-3 rounded bg-black/[0.06] dark:bg-white/[0.08] animate-pulse" />
            </div>
          </div>
        </div>

        <div className="flex gap-1 p-1 rounded-2xl bg-white/40 dark:bg-white/[0.04] border border-gray-200/60 dark:border-white/[0.07]">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="flex-1 h-9 rounded-xl bg-black/[0.04] dark:bg-white/[0.06] animate-pulse" />
          ))}
        </div>

        <div className={`${glassCard} overflow-hidden p-8 space-y-4`}>
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-12 w-full rounded-xl bg-black/[0.05] dark:bg-white/[0.06] animate-pulse" style={{ opacity: 1 - i * 0.15 }} />
          ))}
        </div>
      </div>
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

  const pctA = Math.min((shift.inscritosA / shift.cupoMaximoSalaA) * 100, 100)
  const pctB = Math.min((shift.inscritosB / shift.cupoMaximoSalaB) * 100, 100)
  const activeInscrip = inscripciones.filter(i => i.estado === 'ACTIVA')
  const inscripA = activeInscrip.filter(i => i.sala === 'A')
  const inscripB = activeInscrip.filter(i => i.sala === 'B')
  const localInscripA = localInscripciones.filter(i => i.sala === 'A')
  const localInscripB = localInscripciones.filter(i => i.sala === 'B')

  const TABS: { value: DetailTab; label: string; badge?: number }[] = [
    { value: 'resumen',        label: 'Resumen',         badge: shift.enrolled },
    { value: 'inscripciones',  label: 'Inscripciones',   badge: inscripciones.length },
    { value: 'asistencia',     label: 'Asistencia' },
    { value: 'espera',         label: 'Lista de espera', badge: esperaEntries.filter(e => e.estado === 'PENDIENTE').length },
    { value: 'cancelaciones',  label: 'Cancelaciones',   badge: cancelaciones.length || undefined },
  ]

  return (
    <div className="space-y-4 md:space-y-5">
      {/* Breadcrumb */}
      <button
        onClick={() => navigate('/shifts')}
        className="group flex items-center gap-2 text-sm text-[#8A8A9A] hover:text-gray-900 dark:hover:text-white transition-colors"
      >
        <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
        <span>Turnos</span>
      </button>

      {/* Hero card con navegación */}
      <motion.div
        key={id}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.12, ease: 'easeOut' }}
        className={`${glassCard} overflow-hidden hover:bg-white/50 dark:hover:bg-white/[0.08] transition-colors`}
      >
        <div className="flex gap-0 items-stretch">
          {/* Flecha izquierda */}
          <button
            onClick={() => prevShift && navigate(`/shifts/${prevShift.id}`)}
            disabled={!prevShift}
            className="w-8 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-white/[0.08] disabled:opacity-40 disabled:cursor-not-allowed transition-colors border-r border-gray-200/40 dark:border-white/[0.06] group"
            title={prevShift ? `Turno anterior: ${prevShift.startTime}` : 'No hay turno anterior'}
          >
            <ChevronLeft size={22} strokeWidth={2} className="text-gray-400 dark:text-[#8A8A9A] group-hover:text-primary transition-colors" />
          </button>

          {/* Card principal */}
          <div className="overflow-hidden flex-1">
        {/* Top bar: dual color for A/B con difuminado en extremos */}
        <div className="relative h-[3px] w-full">
          <div
            className={`absolute left-0 right-1/2 h-full rounded-full ${getOccupancyColor(shift.inscritosA, shift.cupoMaximoSalaA)}`}
            style={{ maskImage: 'linear-gradient(to right, transparent 0%, black 25%, black 100%)' }}
          />
          <div
            className={`absolute left-1/2 right-0 h-full rounded-full ${getOccupancyColor(shift.inscritosB, shift.cupoMaximoSalaB)}`}
            style={{ maskImage: 'linear-gradient(to left, transparent 0%, black 25%, black 100%)' }}
          />
        </div>

        <AnimatePresence mode="wait">
          {!isEditingShift ? (
            /* ── Vista normal ── */
            <motion.div
              key="view"
              initial={{ opacity: 0, scale: 0.99, y: 4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.99, y: -2 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
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
                        {shift.startTime}–{shift.endTime}
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

                  {/* Dual occupancy bars */}
                  <div className="mt-4 pt-4 border-t border-gray-200/40 dark:border-white/[0.06] space-y-2.5">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 w-20 shrink-0">
                        <span className="h-2 w-2 rounded-full bg-blue-400" />
                        <span className="text-xs font-bold text-gray-500 dark:text-[#8A8A9A]">Sala A</span>
                      </div>
                      <div className="flex-1 h-1.5 rounded-full bg-black/[0.06] dark:bg-white/[0.08] overflow-hidden">
                        <motion.div
                          className={`h-full w-full rounded-full ${getOccupancyColor(shift.inscritosA, shift.cupoMaximoSalaA)}`}
                          style={{ transformOrigin: 'left' }}
                          initial={{ scaleX: 0 }}
                          animate={{ scaleX: pctA / 100 }}
                          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
                        />
                      </div>
                      <span className="text-xs font-bold tabular-nums text-gray-900 dark:text-white w-14 text-right">
                        {shift.inscritosA}/{shift.cupoMaximoSalaA}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 w-20 shrink-0">
                        <span className="h-2 w-2 rounded-full bg-purple-400" />
                        <span className="text-xs font-bold text-gray-500 dark:text-[#8A8A9A]">Sala B</span>
                      </div>
                      <div className="flex-1 h-1.5 rounded-full bg-black/[0.06] dark:bg-white/[0.08] overflow-hidden">
                        <motion.div
                          className={`h-full w-full rounded-full ${getOccupancyColor(shift.inscritosB, shift.cupoMaximoSalaB)}`}
                          style={{ transformOrigin: 'left' }}
                          initial={{ scaleX: 0 }}
                          animate={{ scaleX: pctB / 100 }}
                          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
                        />
                      </div>
                      <span className="text-xs font-bold tabular-nums text-gray-900 dark:text-white w-14 text-right">
                        {shift.inscritosB}/{shift.cupoMaximoSalaB}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            /* ── Modo edición inline ── */
            <motion.div
              key="edit"
              initial={{ opacity: 0, scale: 0.99, y: 4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.99, y: -2 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              className="p-5 md:p-7"
            >
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Pencil size={18} className="text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-gray-900 dark:text-white">Editando turno</p>
                    <p className="text-xs text-[#8A8A9A]">{shift.startTime}–{shift.endTime}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingShift(false)
                    editReset({
                      days: shift.days, recurrente: shift.recurrente,
                      startTime: shift.startTime, endTime: shift.endTime,
                      cupoMaximoSalaA: String(shift.cupoMaximoSalaA),
                      cupoMaximoSalaB: String(shift.cupoMaximoSalaB),
                      profesorId: shift.profesorId,
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
                      <Input
                        label="Cupo Sala A *" type="number" placeholder="Ej. 10"
                        error={editErrors.cupoMaximoSalaA?.message}
                        {...editRegister('cupoMaximoSalaA')}
                      />
                      <Input
                        label="Cupo Sala B *" type="number" placeholder="Ej. 10"
                        error={editErrors.cupoMaximoSalaB?.message}
                        {...editRegister('cupoMaximoSalaB')}
                      />
                    </div>
                    <Select
                      label="Profesor *"
                      options={[
                        { value: '', label: professors.length === 0 ? 'Sin profesores' : 'Seleccionar...' },
                        ...professors.map(p => ({ value: p.id, label: p.name })),
                      ]}
                      error={editErrors.profesorId?.message}
                      {...editRegister('profesorId')}
                    />
                    {/* Ocupación actual (solo lectura) */}
                    <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] p-3 space-y-2">
                      <p className="text-xs text-[#8A8A9A] mb-1">Ocupación actual</p>
                      <div className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-blue-400 shrink-0" />
                        <span className="text-xs text-[#8A8A9A] w-12">Sala A</span>
                        <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                          <div className={`h-full rounded-full ${getOccupancyColor(shift.inscritosA, shift.cupoMaximoSalaA)}`}
                            style={{ width: `${pctA}%` }} />
                        </div>
                        <span className="text-xs font-semibold text-gray-900 dark:text-white tabular-nums w-10 text-right">{shift.inscritosA}/{shift.cupoMaximoSalaA}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-purple-400 shrink-0" />
                        <span className="text-xs text-[#8A8A9A] w-12">Sala B</span>
                        <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                          <div className={`h-full rounded-full ${getOccupancyColor(shift.inscritosB, shift.cupoMaximoSalaB)}`}
                            style={{ width: `${pctB}%` }} />
                        </div>
                        <span className="text-xs font-semibold text-gray-900 dark:text-white tabular-nums w-10 text-right">{shift.inscritosB}/{shift.cupoMaximoSalaB}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-white/[0.08]">
                  <button
                    type="button" onClick={() => setIsConfirmDeleteShift(true)}
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

          {/* Flecha derecha */}
          <button
            onClick={() => nextShift && navigate(`/shifts/${nextShift.id}`)}
            disabled={!nextShift}
            className="w-8 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-white/[0.08] disabled:opacity-40 disabled:cursor-not-allowed transition-colors border-l border-gray-200/40 dark:border-white/[0.06] group"
            title={nextShift ? `Siguiente turno: ${nextShift.startTime}` : 'No hay siguiente turno'}
          >
            <ChevronRight size={22} strokeWidth={2} className="text-gray-400 dark:text-[#8A8A9A] group-hover:text-primary transition-colors" />
          </button>
        </div>
      </motion.div>

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
        <AnimatePresence mode="wait">

          {/* ══ RESUMEN ══ */}
          {tab === 'resumen' && (
          <motion.div key="resumen" {...tabContentVariants}>
            <div className="p-5 space-y-4">
              {!loadingInscrip && activeInscrip.length > 0 && (
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {activeInscrip.length} inscripto{activeInscrip.length !== 1 ? 's' : ''}
                </p>
              )}

              {loadingInscrip ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[0,1].map(col => (
                    <div key={col} className="space-y-3">
                      <div className="h-5 w-24 rounded-lg bg-black/[0.05] dark:bg-white/[0.07] animate-pulse" />
                      {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}
                    </div>
                  ))}
                </div>
              ) : activeInscrip.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.04]">
                    <Users size={20} className="text-[#8A8A9A]" />
                  </div>
                  <p className="text-sm text-[#8A8A9A]">No hay clientes inscriptos activos</p>
                  <button onClick={() => setTab('inscripciones')} className="text-xs text-primary hover:underline">
                    Inscribir clientes →
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Sala A */}
                  <div>
                    <div className="flex items-center gap-2 mb-3 pb-2.5 border-b border-blue-500/20">
                      <span className="h-2.5 w-2.5 rounded-full bg-blue-400 shrink-0" />
                      <h3 className="text-xs font-bold uppercase tracking-widest text-blue-500 dark:text-blue-400">Sala A</h3>
                      <span className="ml-auto text-xs font-semibold tabular-nums text-gray-500 dark:text-[#8A8A9A]">
                        {inscripA.length}/{shift.cupoMaximoSalaA}
                      </span>
                    </div>
                    {inscripA.length === 0 ? (
                      <p className="text-xs text-center text-[#8A8A9A] py-6">Sin clientes en Sala A</p>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {inscripA.map(insc => (
                          <ResumenCard key={insc.id} insc={insc} clients={clients} sala="A" />
                        ))}
                      </div>
                    )}
                  </div>
                  {/* Sala B */}
                  <div>
                    <div className="flex items-center gap-2 mb-3 pb-2.5 border-b border-purple-500/20">
                      <span className="h-2.5 w-2.5 rounded-full bg-purple-400 shrink-0" />
                      <h3 className="text-xs font-bold uppercase tracking-widest text-purple-500 dark:text-purple-400">Sala B</h3>
                      <span className="ml-auto text-xs font-semibold tabular-nums text-gray-500 dark:text-[#8A8A9A]">
                        {inscripB.length}/{shift.cupoMaximoSalaB}
                      </span>
                    </div>
                    {inscripB.length === 0 ? (
                      <p className="text-xs text-center text-[#8A8A9A] py-6">Sin clientes en Sala B</p>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {inscripB.map(insc => (
                          <ResumenCard key={insc.id} insc={insc} clients={clients} sala="B" />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
          )}

          {/* ══ INSCRIPCIONES ══ */}
          {tab === 'inscripciones' && (() => {
            const enrolledIds = new Set(inscripciones.map(i => i.clienteId))
            const shiftDias = shift?.days.length ?? 0
            const notEnrolled = clientSearchResults.filter(c => !enrolledIds.has(String(c.id)))
            const availableForAdd = notEnrolled
              .filter(c => !c.planFrequency || (c.diasUsados + shiftDias) <= Number(c.planFrequency))
              .slice(0, 8)
            const atLimitForAdd = notEnrolled
              .filter(c => c.planFrequency != null && (c.diasUsados + shiftDias) > Number(c.planFrequency))
              .slice(0, 4)
            const filteredForAdd = availableForAdd
            return (
            <motion.div key="inscripciones" {...tabContentVariants}>
              <div className="p-5 space-y-4">
                {/* Toolbar */}
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {localInscripciones.length === 0 ? 'Sin inscriptos activos' : `${localInscripciones.length} inscripto${localInscripciones.length !== 1 ? 's' : ''}`}
                  </p>
                  <button
                    onClick={() => { setAddClientMode(m => !m); setAddClientSearch(''); setAddClientId(''); setClientSearchResults([]) }}
                    className="flex items-center gap-1.5 rounded-xl bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition-all"
                  >
                    <UserPlus size={13} /> Agregar cliente
                  </button>
                </div>

                {/* Panel agregar cliente */}
                <AnimatePresence>
                  {addClientMode && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                      className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-2"
                    >
                      <div>
                        <p className="text-xs font-bold text-[#8A8A9A] mb-1.5">Sala *</p>
                        <div className="flex gap-2">
                          {(['A', 'B'] as const).map(s => (
                            <button key={s} type="button" onClick={() => setAddClientSala(s)}
                              className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition-all border ${
                                addClientSala === s
                                  ? s === 'A' ? 'bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400'
                                              : 'bg-purple-500/10 border-purple-500/30 text-purple-600 dark:text-purple-400'
                                  : 'border-gray-200 dark:border-white/[0.08] text-gray-500 dark:text-[#8A8A9A]'
                              }`}
                            >
                              <span className={`h-2 w-2 rounded-full ${s === 'A' ? 'bg-blue-400' : 'bg-purple-400'}`} />
                              Sala {s}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="relative">
                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A8A9A]" />
                        <input
                          value={addClientSearch}
                          onChange={e => { setAddClientSearch(e.target.value); setAddClientId('') }}
                          placeholder="Buscar cliente..."
                          className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] pl-8 pr-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-[#8A8A9A] outline-none focus:border-primary/40"
                        />
                      </div>
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {clientSearchLoading ? (
                          <div className="space-y-1 py-1">
                            {[1, 2, 3].map(i => <div key={i} className="h-8 rounded-lg bg-black/[0.05] dark:bg-white/[0.06] animate-pulse" />)}
                          </div>
                        ) : filteredForAdd.length === 0 && atLimitForAdd.length === 0 ? (
                          <p className="text-xs text-[#8A8A9A] text-center py-3">
                            {clientSearchResults.length === 0
                              ? 'Buscá un cliente por nombre'
                              : notEnrolled.length === 0
                              ? 'Todos los clientes ya están inscriptos'
                              : 'Todos los resultados alcanzaron el límite de su plan'}
                          </p>
                        ) : (
                          <>
                            {filteredForAdd.map(c => (
                              <button key={c.id} type="button" onClick={() => setAddClientId(String(c.id))}
                                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition-all ${
                                  addClientId === String(c.id)
                                    ? 'bg-primary/10 border border-primary/30 text-primary'
                                    : 'hover:bg-black/5 dark:hover:bg-white/5 text-gray-900 dark:text-white'
                                }`}
                              >
                                <span className="font-medium flex-1">{c.name} {c.lastName}</span>
                                {c.planFrequency != null && (
                                  <span className="text-[10px] text-[#8A8A9A] tabular-nums shrink-0">
                                    {c.diasUsados}/{c.planFrequency}d
                                  </span>
                                )}
                              </button>
                            ))}
                            {atLimitForAdd.map(c => (
                              <div key={c.id}
                                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm opacity-50 cursor-not-allowed select-none"
                              >
                                <span className="font-medium flex-1 text-gray-900 dark:text-white">{c.name} {c.lastName}</span>
                                <span className="text-[10px] text-amber-500 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-md font-semibold shrink-0 whitespace-nowrap">
                                  Límite de plan
                                </span>
                              </div>
                            ))}
                          </>
                        )}
                      </div>
                      {addClientId && (
                        <Button size="sm" onClick={handleAddToShift} isLoading={addClientSubmitting} className="w-full">
                          Inscribir en Sala {addClientSala}
                        </Button>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Columnas DnD */}
                {loadingInscrip ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[0, 1].map(col => (
                      <div key={col} className="space-y-2">
                        <div className="h-5 w-20 rounded-lg bg-black/[0.05] dark:bg-white/[0.07] animate-pulse" />
                        {[1, 2, 3].map(i => <div key={i} className="h-12 rounded-xl bg-white/[0.04] animate-pulse" />)}
                      </div>
                    ))}
                  </div>
                ) : localInscripciones.length === 0 ? (
                  <EmptyState icon={Users} message="No hay clientes inscriptos en este turno" className="py-10" />
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* ── Sala A drop zone ── */}
                    <div
                      onDragOver={e => handleDragOver(e, 'A')}
                      onDragLeave={handleDragLeave}
                      onDrop={e => handleDrop(e, 'A')}
                      className={`rounded-2xl border-2 p-3 min-h-[160px] transition-all duration-150 ${
                        dragOverSala === 'A'
                          ? 'border-blue-400/60 bg-blue-500/[0.06]'
                          : 'border-blue-500/20 bg-blue-500/[0.02]'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <span className="h-2.5 w-2.5 rounded-full bg-blue-400 shrink-0" />
                        <span className="text-xs font-bold uppercase tracking-widest text-blue-500 dark:text-blue-400">Sala A</span>
                        <span className="ml-auto text-xs font-semibold tabular-nums text-gray-500 dark:text-[#8A8A9A]">
                          {localInscripA.length}/{shift.cupoMaximoSalaA}
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        {localInscripA.map(insc => (
                          <DraggableCard
                            key={insc.id} insc={insc}
                            isPending={pendingChanges.has(insc.id)}
                            isDragging={draggingId === insc.id}
                            bajandoId={bajandoId}
                            onDarDeBaja={handleDarDeBaja}
                            onDragStart={handleDragStart}
                          />
                        ))}
                        {localInscripA.length === 0 && (
                          <div className={`flex items-center justify-center py-8 rounded-xl border-2 border-dashed transition-all ${
                            dragOverSala === 'A'
                              ? 'border-blue-400/50 text-blue-400'
                              : 'border-gray-200/40 dark:border-white/[0.06] text-[#8A8A9A]'
                          }`}>
                            <p className="text-xs">Arrastrá clientes aquí</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* ── Sala B drop zone ── */}
                    <div
                      onDragOver={e => handleDragOver(e, 'B')}
                      onDragLeave={handleDragLeave}
                      onDrop={e => handleDrop(e, 'B')}
                      className={`rounded-2xl border-2 p-3 min-h-[160px] transition-all duration-150 ${
                        dragOverSala === 'B'
                          ? 'border-purple-400/60 bg-purple-500/[0.06]'
                          : 'border-purple-500/20 bg-purple-500/[0.02]'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <span className="h-2.5 w-2.5 rounded-full bg-purple-400 shrink-0" />
                        <span className="text-xs font-bold uppercase tracking-widest text-purple-500 dark:text-purple-400">Sala B</span>
                        <span className="ml-auto text-xs font-semibold tabular-nums text-gray-500 dark:text-[#8A8A9A]">
                          {localInscripB.length}/{shift.cupoMaximoSalaB}
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        {localInscripB.map(insc => (
                          <DraggableCard
                            key={insc.id} insc={insc}
                            isPending={pendingChanges.has(insc.id)}
                            isDragging={draggingId === insc.id}
                            bajandoId={bajandoId}
                            onDarDeBaja={handleDarDeBaja}
                            onDragStart={handleDragStart}
                          />
                        ))}
                        {localInscripB.length === 0 && (
                          <div className={`flex items-center justify-center py-8 rounded-xl border-2 border-dashed transition-all ${
                            dragOverSala === 'B'
                              ? 'border-purple-400/50 text-purple-400'
                              : 'border-gray-200/40 dark:border-white/[0.06] text-[#8A8A9A]'
                          }`}>
                            <p className="text-xs">Arrastrá clientes aquí</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Cambios pendientes — barra de guardado abajo */}
                <AnimatePresence>
                  {pendingChanges.size > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                      className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-primary/10 border border-primary/20"
                    >
                      <p className="text-xs font-semibold text-primary">
                        {pendingChanges.size} movimiento{pendingChanges.size !== 1 ? 's' : ''} sin guardar
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleCancelarCambiosSala}
                          className="text-xs text-[#8A8A9A] hover:text-gray-900 dark:hover:text-white transition-colors"
                        >
                          Deshacer
                        </button>
                        <Button size="sm" onClick={handleGuardarCambiosSala} isLoading={savingChanges}>
                          <Save size={12} /> Guardar vista
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
            )
          })()}

          {/* ══ ASISTENCIA ══ */}
          {tab === 'asistencia' && (
          <motion.div key="asistencia" {...tabContentVariants}>
            <div className="p-5 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-200/50 dark:border-white/[0.06]">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2.5 bg-white/30 dark:bg-white/[0.06] backdrop-blur-xl border border-white/50 dark:border-white/[0.08] rounded-2xl px-3.5 py-2 hover:border-primary dark:hover:border-primary/50 transition-all shadow-sm">
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
                      <EmptyState icon={Users} message="No hay clientes inscriptos activos" className="py-10" />
                    ) : (
                      <div className="space-y-3 p-4">
                        {activeInscrip.map(insc => {
                          const isPresent = present.has(insc.clienteId)
                          const cardTheme = isPresent
                            ? 'border-green-500/30 dark:border-green-500/20 bg-green-500/[0.04] dark:bg-green-500/[0.02] hover:bg-green-500/[0.08] dark:hover:bg-green-500/[0.04]'
                            : 'border-red-500/30 dark:border-red-500/20 bg-red-500/[0.04] dark:bg-red-500/[0.02] hover:bg-red-500/[0.08] dark:hover:bg-red-500/[0.04]'
                          const rightBg = isPresent
                            ? 'bg-green-500/10 dark:bg-green-500/20 text-green-600 dark:text-green-400'
                            : 'bg-red-500/10 dark:bg-red-500/20 text-red-600 dark:text-red-400'
                          const lineStroke = isPresent
                            ? 'text-green-500/30 dark:text-green-500/20'
                            : 'text-red-500/30 dark:text-red-500/20'

                          return (
                            <label
                              key={insc.id}
                              className={`flex items-stretch rounded-2xl border transition-all duration-250 cursor-pointer overflow-hidden shadow-sm h-14 ${cardTheme}`}
                            >
                              <input type="checkbox" className="sr-only" checked={isPresent} onChange={() => togglePresent(insc.clienteId)} />
                              <div className="flex-1 flex items-center px-5 gap-2 font-bold text-sm text-gray-900 dark:text-white truncate">
                                <span className={`h-2 w-2 rounded-full shrink-0 ${insc.sala === 'A' ? 'bg-blue-400' : 'bg-purple-400'}`} />
                                {insc.clienteNombre}
                              </div>
                              <div
                                style={{ clipPath: 'polygon(24px 0, 100% 0, 100% 100%, 0 100%)' }}
                                className={`relative w-32 sm:w-40 flex items-center justify-center font-black text-xs sm:text-sm tracking-wider uppercase shrink-0 transition-colors pl-6 -ml-6 ${rightBg}`}
                              >
                                <div className={`absolute left-0 top-0 bottom-0 w-6 pointer-events-none ${lineStroke}`}>
                                  <svg className="h-full w-full" viewBox="0 0 24 100" preserveAspectRatio="none">
                                    <line x1="0" y1="100" x2="24" y2="0" stroke="currentColor" strokeWidth="3" />
                                  </svg>
                                </div>
                                <span className="relative z-10">{isPresent ? 'Presente' : 'Ausente'}</span>
                              </div>
                            </label>
                          )
                        })}
                      </div>
                    )}
                  </>
                )
              })())}
            </div>
          </motion.div>
          )}

          {/* ══ LISTA DE ESPERA ══ */}
          {tab === 'espera' && (
          <motion.div key="espera" {...tabContentVariants}>
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
                  <EmptyState icon={Clock} message={`No hay entradas ${esperaTipoTab === 'INTERNA' ? 'internas' : 'externas'}`} className="py-10" />
                )
                return (
                  <div className="space-y-1.5">
                    {filteredEspera.map(entry => {
                      const isActioning = actionLoadingIds.has(entry.id)
                      return (
                        <motion.div
                          key={entry.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                          className="flex items-center gap-3 rounded-xl border border-white/50 dark:border-white/[0.08] bg-white/30 dark:bg-white/[0.05] backdrop-blur-xl px-3 py-2.5"
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
          </motion.div>
          )}

          {/* ══ CANCELACIONES ══ */}
          {tab === 'cancelaciones' && (
          <motion.div key="cancelaciones" {...tabContentVariants}>
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Ban size={16} className="text-red-400" />
                  <span className="text-sm font-bold text-gray-900 dark:text-white">Cancelaciones puntuales</span>
                </div>
                {isAdmin && (
                  <button
                    onClick={() => setCancelacionFormOpen(v => !v)}
                    className="flex items-center gap-1.5 rounded-xl bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/20 transition-all"
                  >
                    <Plus size={12} /> Registrar cancelación
                  </button>
                )}
              </div>

              <AnimatePresence>
                {cancelacionFormOpen && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="flex flex-col gap-3 rounded-2xl border border-red-500/20 bg-red-500/5 p-4">
                      <p className="text-xs font-bold text-red-400 uppercase tracking-wider">Nueva cancelación</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-semibold text-gray-500 dark:text-[#8A8A9A] mb-1 block">Fecha</label>
                          <input
                            type="date"
                            value={cancelacionFecha}
                            onChange={e => setCancelacionFecha(e.target.value)}
                            className="w-full rounded-xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/30"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-500 dark:text-[#8A8A9A] mb-1 block">Motivo <span className="font-normal">(opcional)</span></label>
                          <input
                            type="text"
                            value={cancelacionMotivo}
                            onChange={e => setCancelacionMotivo(e.target.value)}
                            placeholder="Ej: Feriado nacional"
                            className="w-full rounded-xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-[#8A8A9A] focus:outline-none focus:ring-2 focus:ring-red-500/30"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <button onClick={() => { setCancelacionFormOpen(false); setCancelacionFecha(''); setCancelacionMotivo('') }}
                          className="rounded-xl px-4 py-1.5 text-xs font-semibold text-gray-500 dark:text-[#8A8A9A] hover:text-gray-700 dark:hover:text-white transition-colors">
                          Cancelar
                        </button>
                        <button
                          onClick={handleAddCancelacion}
                          disabled={!cancelacionFecha || savingCancelacion}
                          className="flex items-center gap-1.5 rounded-xl bg-red-500 px-4 py-1.5 text-xs font-semibold text-white hover:bg-red-600 transition-all disabled:opacity-50"
                        >
                          {savingCancelacion ? '…' : <><Check size={12} /> Guardar</>}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {loadingCancelaciones ? (
                <div className="space-y-2">
                  {[1,2,3].map(i => <div key={i} className="h-14 rounded-xl bg-black/[0.04] dark:bg-white/[0.04] animate-pulse" />)}
                </div>
              ) : cancelaciones.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-12 text-[#8A8A9A]">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.04]">
                    <Ban size={20} className="opacity-50" />
                  </div>
                  <p className="text-sm">No hay cancelaciones registradas para este turno.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {cancelaciones.map(c => (
                    <motion.div
                      key={c.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-red-500/10">
                        <Ban size={14} className="text-red-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">
                          {format(parseISO(c.fecha), "EEEE d 'de' MMMM yyyy", { locale: es })}
                        </p>
                        <p className="text-xs text-[#8A8A9A]">
                          {c.motivo ?? 'Sin motivo especificado'}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full border border-red-500/20 bg-red-500/10 px-2.5 py-0.5 text-xs font-semibold text-red-400">
                        Cancelado
                      </span>
                      {isAdmin && (
                        <button
                          disabled={deletingCancelacionId === c.id}
                          onClick={() => handleDeleteCancelacion(c.id)}
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all disabled:opacity-50"
                        >
                          {deletingCancelacionId === c.id ? '…' : <Trash2 size={12} />}
                        </button>
                      )}
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
          )}

        </AnimatePresence>
        </div>
      </div>

      <ConfirmDialog
        isOpen={isConfirmDeleteShift}
        title="Eliminar turno"
        message="Se eliminarán también todas las inscripciones y asistencias asociadas. Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        isLoading={isDeletingShift}
        onConfirm={deleteShift}
        onClose={() => setIsConfirmDeleteShift(false)}
      />
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ResumenCard({ insc, clients, sala }: { insc: InscripcionEntry; clients: any[]; sala: 'A' | 'B' }) {
  const clientData = clients.find(c => String(c.id) === String(insc.clienteId))
  const statusConfig: Record<string, { label: string; classes: string }> = {
    active:   { label: 'Activo',     classes: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' },
    expiring: { label: 'Por Vencer', classes: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20' },
    debt:     { label: 'Deuda',      classes: 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20' },
    inactive: { label: 'Inactivo',   classes: 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border border-gray-500/20' },
  }
  const clientStatus = clientData?.status && statusConfig[clientData.status]
    ? statusConfig[clientData.status]
    : { label: 'Inscripto', classes: 'bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20' }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl border border-white/50 dark:border-white/[0.08] bg-white/30 dark:bg-white/[0.05] backdrop-blur-xl hover:bg-white/50 dark:hover:bg-white/[0.08] transition-all hover:shadow-sm">
      <div className="flex items-center gap-3 min-w-0">
        <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${sala === 'A' ? 'bg-blue-500/10' : 'bg-purple-500/10'}`}>
          <span className={`text-xs font-black ${sala === 'A' ? 'text-blue-500' : 'text-purple-500'}`}>
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
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
            {clientData?.cuil && (
              <span className="inline-flex items-center gap-1 text-[11px] text-gray-500 dark:text-[#8A8A9A]">
                <Hash size={10} className="shrink-0 opacity-60" />
                CUIL {clientData.cuil}
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
      <a
        href={`/clients/${insc.clienteId}`}
        className="flex items-center gap-1.5 self-end sm:self-center text-xs font-semibold px-3 py-2 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-white/60 dark:bg-white/[0.04] text-gray-600 dark:text-[#8A8A9A] hover:text-gray-900 dark:hover:text-white hover:bg-white dark:hover:bg-white/[0.09] transition-all shrink-0"
      >
        Ver perfil →
      </a>
    </div>
  )
}

function DraggableCard({
  insc, isPending, isDragging, bajandoId, onDarDeBaja, onDragStart,
}: {
  insc: InscripcionEntry
  isPending: boolean
  isDragging: boolean
  bajandoId: string | null
  onDarDeBaja: (id: string, sala: 'A' | 'B') => void
  onDragStart: (e: React.DragEvent, id: string) => void
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: isDragging ? 0.4 : 1, scale: 1 }}
      draggable
      onDragStart={e => onDragStart(e, insc.id)}
      className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 cursor-grab active:cursor-grabbing select-none backdrop-blur-xl transition-colors ${
        isPending
          ? 'border-primary/30 bg-primary/10 dark:bg-primary/[0.08]'
          : 'border-white/50 dark:border-white/[0.08] bg-white/30 dark:bg-white/[0.05] hover:bg-white/50 dark:hover:bg-white/[0.09]'
      }`}
    >
      <GripVertical size={13} className="text-[#8A8A9A]/60 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{insc.clienteNombre}</p>
          {isPending && (
            <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full shrink-0">
              Movido
            </span>
          )}
        </div>
        <p className="text-xs text-[#8A8A9A]">
          Desde {format(new Date(insc.fechaDesde), "d MMM yyyy", { locale: es })}
        </p>
      </div>
      <button
        disabled={bajandoId === insc.id}
        onClick={e => { e.stopPropagation(); onDarDeBaja(insc.id, insc.sala) }}
        className="flex items-center gap-1 rounded-lg bg-red-500/10 px-2 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/20 transition-all disabled:opacity-50 shrink-0"
      >
        {bajandoId === insc.id ? '…' : <><X size={11} /> Dar de baja</>}
      </button>
    </motion.div>
  )
}
