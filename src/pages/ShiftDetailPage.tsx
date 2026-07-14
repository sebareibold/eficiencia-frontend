import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { pageVariants, tabContentVariants, staggerContainerFast, fadeUpItem } from '../lib/motion'
import {
  ArrowLeft, Users, Clock, Dumbbell, UserPlus, ListPlus,
  X, Bell, Check, Trash2, Search, AlertTriangle, CheckCircle2, Pencil, Save, UserCheck,
  Hash, Tag, CalendarDays, GripVertical, Ban, Plus, ChevronLeft, ChevronRight,
  RefreshCw, MessageSquare,
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
import { excepcionesApi } from '../api/excepciones.api'
import type { ExcepcionTurno } from '../types/excepcion.types'
import { inscripcionesApi } from '../api/inscripciones.api'
import { attendanceApi } from '../api/attendance.api'
import { listaEsperaApi } from '../api/listaEspera.api'
import { reposicionesApi } from '../api/reposiciones.api'
import type { AusenciaTurno, RecuperacionClase } from '../types/reposicion.types'
import { useQueryClient } from '@tanstack/react-query'
import { QK } from '../lib/queryKeys'
import type { ListaEsperaEntry } from '../types/listaEspera.types'
import { useListaEspera } from '../hooks/useListaEspera'
import { useAttendance } from '../hooks/useAttendance'
import { useClients } from '../hooks/useClients'
import { useShifts } from '../hooks/useShifts'
import { useUiStore } from '../store/uiStore'
import { useAuthStore } from '../store/authStore'
import { usePermissions } from '../hooks/usePermissions'
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
  const [searchParams] = useSearchParams()
  const addToast = useUiStore(s => s.addToast)
  const user = useAuthStore(s => s.user)
  const queryClient = useQueryClient()
  const isAdmin = user?.role === 'admin'
  const { can } = usePermissions()

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
  const [esperaTipoTab, setEsperaTipoTab] = useState<'TODOS' | 'INTERNA' | 'EXTERNA'>('TODOS')
  const [addExternoNombre, setAddExternoNombre] = useState('')
  const [addExternoApellido, setAddExternoApellido] = useState('')
  const [addExternoWhatsapp, setAddExternoWhatsapp] = useState('')
  const [actionLoadingIds, setActionLoadingIds] = useState<Set<string>>(new Set())
  const [editingEsperaId, setEditingEsperaId] = useState<string | null>(null)
  const [editExternoNombre, setEditExternoNombre] = useState('')
  const [editExternoApellido, setEditExternoApellido] = useState('')
  const [editExternoWhatsapp, setEditExternoWhatsapp] = useState('')
  const [editEsperaSubmitting, setEditEsperaSubmitting] = useState(false)

  // Asistencia — fecha fija a la próxima ocurrencia del turno (o URL param si viene del historial)
  const selectedDate = useMemo(() => {
    const fromUrl = searchParams.get('date')
    if (fromUrl && /^\d{4}-\d{2}-\d{2}$/.test(fromUrl)) return fromUrl
    if (shift) {
      const dows = shift.days.map(d => WEEKDAY_TO_JS[d])
      const today = new Date(); today.setHours(0, 0, 0, 0)
      for (let i = 0; i <= 6; i++) {
        const candidate = new Date(today)
        candidate.setDate(today.getDate() + i)
        if (dows.includes(candidate.getDay())) {
          const y = candidate.getFullYear()
          const m = String(candidate.getMonth() + 1).padStart(2, '0')
          const d = String(candidate.getDate()).padStart(2, '0')
          return `${y}-${m}-${d}`
        }
      }
    }
    return format(new Date(), 'yyyy-MM-dd')
  }, [shift?.id, searchParams])
  const [attendanceStates, setAttendanceStates] = useState<Record<string, 'presente' | 'ausente' | 'con_aviso'>>({})
  const [isSavingAttendance, setIsSavingAttendance] = useState(false)
  const [dragOverAttendCol, setDragOverAttendCol] = useState<'presente' | 'ausente' | 'con_aviso' | null>(null)
  const [draggingAttendId, setDraggingAttendId] = useState<string | null>(null)

  // Ausencias con aviso (para Resumen)
  const [ausenciasHoy, setAusenciasHoy] = useState<AusenciaTurno[]>([])

  // Recuperaciones del día (para Asistencia)
  const [recuperacionesHoy, setRecuperacionesHoy] = useState<RecuperacionClase[]>([])
  const [loadingRecuperaciones, setLoadingRecuperaciones] = useState(false)

  // Cancelaciones
  const [cancelaciones, setCancelaciones] = useState<CancelacionTurno[]>([])
  const [loadingCancelaciones, setLoadingCancelaciones] = useState(false)
  const [cancelacionFormOpen, setCancelacionFormOpen] = useState(false)
  const [cancelacionFecha, setCancelacionFecha] = useState('')
  const [cancelacionMotivo, setCancelacionMotivo] = useState('')
  const [savingCancelacion, setSavingCancelacion] = useState(false)
  const [deletingCancelacionId, setDeletingCancelacionId] = useState<string | null>(null)

  // Excepciones puntuales
  const [excepciones, setExcepciones] = useState<ExcepcionTurno[]>([])
  const [loadingExcepciones, setLoadingExcepciones] = useState(false)
  const [excepcionFormOpen, setExcepcionFormOpen] = useState(false)
  const [excepcionFecha, setExcepcionFecha] = useState('')
  const [excepcionHoraInicio, setExcepcionHoraInicio] = useState('')
  const [excepcionHoraFin, setExcepcionHoraFin] = useState('')
  const [excepcionProfesorId, setExcepcionProfesorId] = useState('')
  const [excepcionMotivo, setExcepcionMotivo] = useState('')
  const [savingExcepcion, setSavingExcepcion] = useState(false)
  const [deletingExcepcionId, setDeletingExcepcionId] = useState<string | null>(null)
  const [editMode, setEditMode] = useState<'general' | 'puntual'>('general')

  // Edit general
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

  // Cargar todo lo sensible a la fecha cuando cambia selectedDate o el tab activo
  useEffect(() => {
    if (!id || !selectedDate) return
    // Asistencia: siempre pre-cargar para que el tab Asistencia esté listo
    if (tab === 'asistencia' || tab === 'resumen') {
      fetchByShiftAndDate(id, selectedDate)
    }
  }, [tab, id, selectedDate])

  // Cargar ausencias con aviso para el Resumen
  useEffect(() => {
    if (tab !== 'resumen' || !id) return
    reposicionesApi.getAll({ turnoId: id, fecha: selectedDate })
      .then(data => setAusenciasHoy(data.filter(a => a.conAviso)))
      .catch(() => {/* silencioso — no bloquea el resumen */})
  }, [tab, id, selectedDate])

  // Cargar recuperaciones para Resumen y Asistencia
  useEffect(() => {
    if ((tab !== 'asistencia' && tab !== 'resumen') || !id || !selectedDate) return
    setLoadingRecuperaciones(true)
    reposicionesApi.getByTurnoFecha(id, selectedDate)
      .then(recs => setRecuperacionesHoy(recs.filter(r => r.estado !== 'CANCELADA')))
      .catch(() => setRecuperacionesHoy([]))
      .finally(() => setLoadingRecuperaciones(false))
  }, [tab, id, selectedDate])

  // Cargar cancelaciones y excepciones cuando se abre el modo edición
  useEffect(() => {
    if (!isEditingShift || !id) return
    setLoadingCancelaciones(true)
    cancelacionesApi.getByTurno(id)
      .then(setCancelaciones)
      .catch(() => addToast('Error al cargar cancelaciones', 'error'))
      .finally(() => setLoadingCancelaciones(false))

    setLoadingExcepciones(true)
    excepcionesApi.getByTurno(id)
      .then(setExcepciones)
      .catch(() => addToast('Error al cargar modificaciones puntuales', 'error'))
      .finally(() => setLoadingExcepciones(false))
  }, [isEditingShift, id])

  // Sincronizar attendanceStates con registros del backend
  useEffect(() => {
    const next: Record<string, 'presente' | 'ausente' | 'con_aviso'> = {}
    for (const r of attendanceRecords) {
      next[r.clientId] = r.present ? 'presente' : r.conAviso ? 'con_aviso' : 'ausente'
    }
    setAttendanceStates(next)
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
    if (!id) return
    const hasClient = addEsperaClientId !== ''
    const hasExternal = addExternoNombre.trim() && addExternoApellido.trim() && addExternoWhatsapp.trim()
    if (!hasClient && !hasExternal) return
    setAddEsperaSubmitting(true)
    try {
      if (hasClient) {
        await listaEsperaApi.create(id, addEsperaTipo, addEsperaClientId)
      } else {
        await listaEsperaApi.create(id, addEsperaTipo, undefined, {
          nombreExterno:   addExternoNombre.trim(),
          apellidoExterno: addExternoApellido.trim(),
          whatsappExterno: addExternoWhatsapp.trim(),
        })
      }
      addToast('Agregado a lista de espera', 'success')
      setAddEsperaClientId(''); setAddEsperaClientSearch('')
      setAddExternoNombre(''); setAddExternoApellido(''); setAddExternoWhatsapp('')
      setAddEsperaMode(false)
      refetchEspera()
    } catch (e: any) {
      addToast(e?.response?.data?.message ?? 'Error al agregar a lista de espera', 'error')
    } finally {
      setAddEsperaSubmitting(false)
    }
  }

  async function handleEsperaAction(entryId: string, action: 'notificar' | 'aceptar' | 'rechazar' | 'eliminar') {
    const qk = QK.listaEspera.byTurno(id ?? null)

    if (action === 'eliminar') {
      // Optimistic: sacar la entrada del cache inmediatamente
      const prev = queryClient.getQueryData<ListaEsperaEntry[]>(qk)
      queryClient.setQueryData<ListaEsperaEntry[]>(qk, old => old?.filter(e => e.id !== entryId) ?? [])
      try {
        await listaEsperaApi.remove(entryId)
      } catch {
        // Revertir si falla
        queryClient.setQueryData(qk, prev)
        addToast('Error al eliminar', 'error')
      }
      return
    }

    setActionLoadingIds(prev => new Set([...prev, entryId]))
    try {
      const map = { notificar: 'NOTIFICADO', aceptar: 'ACEPTADO', rechazar: 'RECHAZADO' } as const
      await listaEsperaApi.updateEstado(entryId, map[action] as EstadoEspera)
      addToast('Acción realizada', 'success')
      refetchEspera()
    } catch {
      addToast('Error al procesar la acción', 'error')
    } finally {
      setActionLoadingIds(prev => { const s = new Set(prev); s.delete(entryId); return s })
    }
  }

  function startEditEspera(entry: { id: string; clienteNombre: string; whatsappExterno: string | null }) {
    const parts = entry.clienteNombre.split(' ')
    setEditExternoNombre(parts[0] ?? '')
    setEditExternoApellido(parts.slice(1).join(' '))
    setEditExternoWhatsapp(entry.whatsappExterno ?? '')
    setEditingEsperaId(entry.id)
  }

  async function handleEsperaSaveEdit(entryId: string) {
    setEditEsperaSubmitting(true)
    try {
      await listaEsperaApi.updateExterno(entryId, {
        nombreExterno:   editExternoNombre.trim(),
        apellidoExterno: editExternoApellido.trim(),
        whatsappExterno: editExternoWhatsapp.trim(),
      })
      addToast('Contacto actualizado', 'success')
      setEditingEsperaId(null)
      refetchEspera()
    } catch {
      addToast('Error al guardar cambios', 'error')
    } finally {
      setEditEsperaSubmitting(false)
    }
  }

  function getAttendanceState(clientId: string): 'presente' | 'ausente' | 'con_aviso' {
    return attendanceStates[clientId] ?? 'presente'
  }

  function setAttendanceState(clientId: string, value: 'presente' | 'ausente' | 'con_aviso') {
    setAttendanceStates(prev => ({ ...prev, [clientId]: value }))
  }

  function cycleAttendState(clientId: string) {
    const current = getAttendanceState(clientId)
    const next = current === 'ausente' ? 'presente' : current === 'presente' ? 'con_aviso' : 'ausente'
    setAttendanceState(clientId, next)
  }

  function handleMarkAllPresent() {
    const regularClientIds = inscripciones.filter(i => i.estado === 'ACTIVA').map(i => i.clienteId)
    const regularSet = new Set(regularClientIds)
    const recuperacionClientIds = recuperacionesHoy.filter(r => !regularSet.has(r.clienteId)).map(r => r.clienteId)
    const next: Record<string, 'presente' | 'ausente' | 'con_aviso'> = {}
    for (const cid of [...regularClientIds, ...recuperacionClientIds]) next[cid] = 'presente'
    setAttendanceStates(next)
  }

  function handleAttendDragStart(e: React.DragEvent, clientId: string) {
    setDraggingAttendId(clientId)
    e.dataTransfer.setData('attendClientId', clientId)
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleAttendDragOver(e: React.DragEvent, col: 'presente' | 'ausente' | 'con_aviso') {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverAttendCol(col)
  }

  function handleAttendDragLeave(e: React.DragEvent) {
    if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
      setDragOverAttendCol(null)
    }
  }

  function handleAttendDrop(e: React.DragEvent, targetCol: 'presente' | 'ausente' | 'con_aviso') {
    e.preventDefault()
    const clientId = e.dataTransfer.getData('attendClientId')
    setDragOverAttendCol(null)
    setDraggingAttendId(null)
    if (!clientId) return
    setAttendanceStates(prev => ({ ...prev, [clientId]: targetCol }))
  }

  async function saveAttendance() {
    if (!id || dateError) return
    setIsSavingAttendance(true)
    try {
      const regularClientIds = inscripciones.filter(i => i.estado === 'ACTIVA').map(i => i.clienteId)
      const regularSet = new Set(regularClientIds)
      // Recovering clients que NO están inscriptos regularmente en este turno
      const recuperacionClientIds = recuperacionesHoy
        .filter(r => !regularSet.has(r.clienteId))
        .map(r => r.clienteId)
      const allClientIds = [...regularClientIds, ...recuperacionClientIds]

      const presentIds = allClientIds.filter(cid => getAttendanceState(cid) === 'presente')
      // con_aviso solo aplica a inscriptos regulares (genera AusenciaTurno en su turno propio)
      const conAvisoIds = regularClientIds.filter(cid => getAttendanceState(cid) === 'con_aviso')
      await attendanceApi.bulk(id, selectedDate, presentIds, conAvisoIds)
      await fetchByShiftAndDate(id, selectedDate)
      const msg = conAvisoIds.length > 0
        ? `Asistencia guardada · ${conAvisoIds.length} crédito${conAvisoIds.length > 1 ? 's' : ''} generado${conAvisoIds.length > 1 ? 's' : ''}`
        : 'Asistencia guardada'
      addToast(msg, 'success')
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

  function openExcepcionForm() {
    if (!shift) return
    setExcepcionHoraInicio(shift.startTime)
    setExcepcionHoraFin(shift.endTime)
    setExcepcionProfesorId(shift.profesorId ?? '')
    setExcepcionMotivo('')
    setExcepcionFecha('')
    setExcepcionFormOpen(true)
  }

  async function handleSaveExcepcion(fechaParam?: string) {
    const fecha = fechaParam ?? excepcionFecha
    if (!id || !fecha) return
    setSavingExcepcion(true)
    try {
      const existente = excepciones.find(e => e.fecha === fecha)
      if (existente) {
        const actualizada = await excepcionesApi.update(existente.id, {
          profesorId: excepcionProfesorId || null,
          motivo:     excepcionMotivo     || null,
        })
        setExcepciones(prev => prev.map(e => e.id === existente.id ? actualizada : e))
      } else {
        const nueva = await excepcionesApi.create({
          turnoId:    id,
          fecha,
          profesorId: excepcionProfesorId || undefined,
          motivo:     excepcionMotivo     || undefined,
        })
        setExcepciones(prev => [...prev, nueva].sort((a, b) => a.fecha.localeCompare(b.fecha)))
      }
      addToast('Modificación puntual guardada', 'success')
    } catch {
      addToast('Error al guardar modificación puntual', 'error')
    } finally {
      setSavingExcepcion(false)
    }
  }

  async function handleDeleteExcepcion(excId: string) {
    setDeletingExcepcionId(excId)
    const prev = excepciones
    setExcepciones(old => old.filter(e => e.id !== excId))
    try {
      await excepcionesApi.remove(excId)
    } catch {
      setExcepciones(prev)
      addToast('Error al eliminar modificación puntual', 'error')
    } finally {
      setDeletingExcepcionId(null)
    }
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

  const activeInscrip = inscripciones.filter(i => i.estado === 'ACTIVA')
  const inscripA = activeInscrip.filter(i => i.sala === 'A')
  const inscripB = activeInscrip.filter(i => i.sala === 'B')
  const localInscripA = localInscripciones.filter(i => i.sala === 'A')
  const localInscripB = localInscripciones.filter(i => i.sala === 'B')

  // Recuperandos del día que NO están ya inscriptos regularmente (van a Sala A)
  const inscripIdSet = new Set(activeInscrip.map(i => i.clienteId))
  const recuperandoHoy = recuperacionesHoy.filter(r => !inscripIdSet.has(r.clienteId))
  // Cupo real de Sala A para selectedDate (inscriptos + recuperandos)
  const realInscritosA = inscripA.length + recuperandoHoy.length
  const pctA = Math.min((realInscritosA / shift.cupoMaximoSalaA) * 100, 100)
  const pctB = Math.min((shift.inscritosB / shift.cupoMaximoSalaB) * 100, 100)

  const TABS: { value: DetailTab; label: string; badge?: number }[] = [
    { value: 'resumen',        label: 'Resumen',         badge: shift.enrolled },
    { value: 'inscripciones',  label: 'Inscripciones',   badge: inscripciones.length },
    { value: 'asistencia',     label: 'Asistencia' },
    { value: 'espera',         label: 'Lista de espera', badge: esperaEntries.filter(e => e.estado === 'PENDIENTE').length },
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
            className={`absolute left-0 right-1/2 h-full rounded-full ${getOccupancyColor(realInscritosA, shift.cupoMaximoSalaA)}`}
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
                      {(() => {
                        const dows = shift.days.map(d => WEEKDAY_TO_JS[d])
                        const today = new Date(); today.setHours(0,0,0,0)
                        let próxima: Date | null = null
                        for (let i = 0; i <= 6; i++) {
                          const candidate = new Date(today); candidate.setDate(today.getDate() + i)
                          if (dows.includes(candidate.getDay())) { próxima = candidate; break }
                        }
                        if (!próxima) return null
                        return (
                          <p className="text-xs font-semibold text-gray-400 dark:text-[#6A6A7A] mt-0.5 capitalize">
                            {format(próxima, "EEEE d 'de' MMMM", { locale: es })}
                          </p>
                        )
                      })()}
                      <p className="text-sm text-[#8A8A9A] mt-1">
                        Prof. {shift.profesorNombre || '—'}
                      </p>
                    </div>
                    {can('shifts', 'update') && (
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
                          className={`h-full w-full rounded-full ${getOccupancyColor(realInscritosA, shift.cupoMaximoSalaA)}`}
                          style={{ transformOrigin: 'left' }}
                          initial={{ scaleX: 0 }}
                          animate={{ scaleX: pctA / 100 }}
                          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
                        />
                      </div>
                      <span className="text-xs font-bold tabular-nums text-gray-900 dark:text-white w-14 text-right">
                        {realInscritosA}/{shift.cupoMaximoSalaA}
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

              {/* Toggle General / Puntual */}
              <div className="flex gap-1.5 mb-5 p-1 rounded-xl bg-gray-100 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.06]">
                {(['general', 'puntual'] as const).map(mode => (
                  <button
                    key={mode} type="button"
                    onClick={() => { setEditMode(mode); setExcepcionFormOpen(false); setCancelacionFormOpen(false) }}
                    className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition-all ${
                      editMode === mode
                        ? 'bg-white dark:bg-white/[0.10] text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-500 dark:text-[#8A8A9A] hover:text-gray-700 dark:hover:text-white'
                    }`}
                  >
                    {mode === 'general' ? 'Turno general' : 'Modificación puntual'}
                  </button>
                ))}
              </div>

              {/* ── Panel modificación puntual ── */}
              {editMode === 'puntual' && shift && (() => {
                const excepExistente = excepciones.find(e => e.fecha === selectedDate)
                return (
                  <div className="space-y-4">
                    {/* Header: turno + fecha en contexto */}
                    <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#8A8A9A] mb-1">Modificación puntual del turno</p>
                      <p className="text-sm font-bold text-gray-900 dark:text-white">{shift.startTime} – {shift.endTime}</p>
                      <p className="text-xs text-[#8A8A9A]">{shift.days.map(d => DAY_LABELS[d]).join(' · ')}</p>
                      <p className="text-xs font-semibold text-primary mt-1.5 capitalize">
                        {format(new Date(selectedDate + 'T12:00:00'), "EEEE d 'de' MMMM yyyy", { locale: es })}
                      </p>
                    </div>

                    {/* Formulario */}
                    <div className="space-y-3 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
                      <div>
                        <label className="text-[11px] font-semibold text-gray-500 dark:text-[#8A8A9A] mb-1 block">Profesor</label>
                        <select
                          value={excepcionProfesorId || excepExistente?.profesorId || shift.profesorId || ''}
                          onChange={e => setExcepcionProfesorId(e.target.value)}
                          className="w-full rounded-lg border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] px-2.5 py-1.5 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary">
                          {professors.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-gray-500 dark:text-[#8A8A9A] mb-1 block">Motivo <span className="font-normal">(opcional)</span></label>
                        <input type="text"
                          value={excepcionMotivo || excepExistente?.motivo || ''}
                          onChange={e => setExcepcionMotivo(e.target.value)}
                          placeholder="Ej: Cambio de horario por feriado"
                          className="w-full rounded-lg border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] px-2.5 py-1.5 text-xs text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-[#8A8A9A] focus:outline-none focus:ring-1 focus:ring-primary" />
                      </div>
                      <div className="flex justify-end pt-1">
                        <button type="button"
                          onClick={() => handleSaveExcepcion(selectedDate)}
                          disabled={savingExcepcion}
                          className="flex items-center gap-1 rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-gray-900 hover:bg-primary-dark transition-all disabled:opacity-50">
                          {savingExcepcion ? '…' : <><Save size={11} /> Guardar modificación</>}
                        </button>
                      </div>
                    </div>

                    {/* Modificaciones ya registradas */}
                    {loadingExcepciones ? (
                      <div className="h-8 rounded-lg bg-white/[0.04] animate-pulse" />
                    ) : excepciones.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-[11px] font-semibold text-[#8A8A9A] uppercase tracking-wider">Ya registradas</p>
                        {excepciones.map(exc => (
                          <div key={exc.id} className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
                            <Pencil size={11} className="text-primary shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-gray-900 dark:text-white truncate capitalize">
                                {format(new Date(exc.fecha + 'T12:00:00'), "EEE d MMM yyyy", { locale: es })}
                                {exc.horaInicio && <span className="text-[#8A8A9A] font-normal ml-1.5">· {exc.horaInicio}–{exc.horaFin}</span>}
                                {exc.profesorNombre && <span className="text-[#8A8A9A] font-normal ml-1.5">· {exc.profesorNombre}</span>}
                              </p>
                              {exc.motivo && <p className="text-[11px] text-[#8A8A9A] truncate">{exc.motivo}</p>}
                            </div>
                            <button type="button" disabled={deletingExcepcionId === exc.id} onClick={() => handleDeleteExcepcion(exc.id)}
                              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all disabled:opacity-50">
                              {deletingExcepcionId === exc.id ? '…' : <Trash2 size={10} />}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })()}

              {/* ── Formulario general ── */}
              {editMode === 'general' && <form onSubmit={editHandleSubmit(onEditSubmit)} className="space-y-4">
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

                {/* ── Cancelaciones puntuales ── */}
                <div className="space-y-2 pt-2 border-t border-white/[0.08]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Ban size={13} className="text-red-400" />
                      <span className="text-xs font-bold text-gray-700 dark:text-[#8A8A9A] uppercase tracking-wider">Cancelaciones puntuales</span>
                    </div>
                    {isAdmin && (
                      <button type="button" onClick={() => setCancelacionFormOpen(v => !v)}
                        className="flex items-center gap-1 rounded-lg bg-red-500/10 px-2.5 py-1 text-xs font-semibold text-red-400 hover:bg-red-500/20 transition-all">
                        <Plus size={11} /> Registrar
                      </button>
                    )}
                  </div>

                  <AnimatePresence>
                    {cancelacionFormOpen && shift && (() => {
                      // Generar próximas fechas del turno (próximas 6 semanas)
                      const canceladasSet = new Set(cancelaciones.map(c => c.fecha.slice(0, 10)))
                      const dows = shift.days.map(d => WEEKDAY_TO_JS[d])
                      const proximas: string[] = []
                      const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
                      for (let i = 0; proximas.length < 18; i++) {
                        const d = new Date(hoy); d.setDate(hoy.getDate() + i)
                        const iso = d.toISOString().slice(0, 10)
                        if (dows.includes(d.getDay()) && !canceladasSet.has(iso)) proximas.push(iso)
                      }
                      return (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                          <div className="flex flex-col gap-2 rounded-xl border border-red-500/20 bg-red-500/5 p-3">
                            <label className="text-[11px] font-semibold text-gray-500 dark:text-[#8A8A9A]">Seleccioná la fecha a cancelar</label>
                            <div className="flex flex-wrap gap-1.5">
                              {proximas.map(iso => (
                                <button
                                  key={iso} type="button"
                                  onClick={() => setCancelacionFecha(iso)}
                                  className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all border ${
                                    cancelacionFecha === iso
                                      ? 'bg-red-500 border-red-500 text-white'
                                      : 'border-red-500/30 bg-red-500/5 text-red-400 hover:bg-red-500/15'
                                  }`}
                                >
                                  {format(new Date(iso + 'T12:00:00'), "EEE d MMM", { locale: es })}
                                </button>
                              ))}
                            </div>
                            <div>
                              <label className="text-[11px] font-semibold text-gray-500 dark:text-[#8A8A9A] mb-1 block">Motivo <span className="font-normal">(opcional)</span></label>
                              <input type="text" value={cancelacionMotivo} onChange={e => setCancelacionMotivo(e.target.value)}
                                placeholder="Ej: Feriado, ausencia del profesor…"
                                className="w-full rounded-lg border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] px-2.5 py-1.5 text-xs text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-[#8A8A9A] focus:outline-none focus:ring-1 focus:ring-red-500/30" />
                            </div>
                            <div className="flex justify-end gap-2">
                              <button type="button" onClick={() => { setCancelacionFormOpen(false); setCancelacionFecha(''); setCancelacionMotivo('') }}
                                className="rounded-lg px-3 py-1 text-xs font-semibold text-gray-500 dark:text-[#8A8A9A] hover:text-gray-700 dark:hover:text-white transition-colors">
                                Cancelar
                              </button>
                              <button type="button" onClick={handleAddCancelacion} disabled={!cancelacionFecha || savingCancelacion}
                                className="flex items-center gap-1 rounded-lg bg-red-500 px-3 py-1 text-xs font-semibold text-white hover:bg-red-600 transition-all disabled:opacity-50">
                                {savingCancelacion ? '…' : <><Check size={11} /> Guardar</>}
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      )
                    })()}
                  </AnimatePresence>

                  {loadingCancelaciones ? (
                    <div className="h-8 rounded-lg bg-white/[0.04] animate-pulse" />
                  ) : cancelaciones.length === 0 ? (
                    <p className="text-xs text-[#8A8A9A] py-1">Sin cancelaciones registradas.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {cancelaciones.map(c => (
                        <div key={c.id} className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2">
                          <Ban size={11} className="text-red-400 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">
                              {format(parseISO(c.fecha), "EEE d MMM yyyy", { locale: es })}
                            </p>
                            {c.motivo && <p className="text-[11px] text-[#8A8A9A] truncate">{c.motivo}</p>}
                          </div>
                          {isAdmin && (
                            <button type="button" disabled={deletingCancelacionId === c.id} onClick={() => handleDeleteCancelacion(c.id)}
                              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all disabled:opacity-50">
                              {deletingCancelacionId === c.id ? '…' : <Trash2 size={10} />}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
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
              </form>}
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
              <div className="flex items-center justify-between gap-3 flex-wrap">
                {!loadingInscrip && activeInscrip.length > 0 && (
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {activeInscrip.length} inscripto{activeInscrip.length !== 1 ? 's' : ''}
                  </p>
                )}
                {selectedDate && (
                  <p className="text-sm font-bold text-primary capitalize ml-auto">
                    {format(parseISO(selectedDate + 'T12:00:00'), "EEEE d 'de' MMMM", { locale: es })}
                  </p>
                )}
              </div>

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
                (() => {
                  const avisóIds = new Set(ausenciasHoy.map(a => a.clienteId))
                  const totalSalaA = realInscritosA
                  return (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      {/* Sala A */}
                      <div>
                        <div className="flex items-center gap-2 mb-3 pb-2.5 border-b border-blue-500/20">
                          <span className="h-2.5 w-2.5 rounded-full bg-blue-400 shrink-0" />
                          <h3 className="text-xs font-bold uppercase tracking-widest text-blue-500 dark:text-blue-400">Sala A</h3>
                          <span className="ml-auto text-xs font-semibold tabular-nums text-gray-500 dark:text-[#8A8A9A]">
                            {totalSalaA}/{shift.cupoMaximoSalaA}
                          </span>
                        </div>
                        {inscripA.length === 0 && recuperandoHoy.length === 0 ? (
                          <p className="text-xs text-center text-[#8A8A9A] py-6">Sin clientes en Sala A</p>
                        ) : (
                          <div className="flex flex-col gap-2">
                            {inscripA.map(insc => (
                              <ResumenCard key={insc.id} insc={insc} clients={clients} sala="A" aviso={avisóIds.has(insc.clienteId)} />
                            ))}
                            {recuperandoHoy.map(rec => (
                              <div key={rec.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.03] dark:bg-emerald-500/[0.04] backdrop-blur-xl hover:bg-emerald-500/[0.06] transition-all">
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 bg-emerald-500/10">
                                    <span className="text-xs font-black text-emerald-500">
                                      {rec.cliente.nombre[0]}{rec.cliente.apellido[0]}
                                    </span>
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <p className="text-sm font-bold text-gray-900 dark:text-white truncate">
                                        {rec.cliente.nombre} {rec.cliente.apellido}
                                      </p>
                                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                        Recupera hoy
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                <a
                                  href={`/clients/${rec.clienteId}`}
                                  className="flex items-center gap-1.5 self-end sm:self-center text-xs font-semibold px-3 py-2 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-white/60 dark:bg-white/[0.04] text-gray-600 dark:text-[#8A8A9A] hover:text-gray-900 dark:hover:text-white hover:bg-white dark:hover:bg-white/[0.09] transition-all shrink-0"
                                >
                                  Ver perfil →
                                </a>
                              </div>
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
                              <ResumenCard key={insc.id} insc={insc} clients={clients} sala="B" aviso={avisóIds.has(insc.clienteId)} />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })()
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
                  {can('shifts', 'create') && (
                    <button
                      onClick={() => { setAddClientMode(m => !m); setAddClientSearch(''); setAddClientId(''); setClientSearchResults([]) }}
                      className="flex items-center gap-1.5 rounded-xl bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition-all"
                    >
                      <UserPlus size={13} /> Agregar cliente
                    </button>
                  )}
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
                            canWrite={can('shifts', 'update')}
                            canDelete={can('shifts', 'delete')}
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
                            canWrite={can('shifts', 'update')}
                            canDelete={can('shifts', 'delete')}
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
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-bold text-gray-500 dark:text-[#8A8A9A] uppercase tracking-wider">Fecha</span>
                  {selectedDate && (
                    <p className="text-sm font-black text-primary capitalize leading-none">
                      {format(parseISO(selectedDate + 'T12:00:00'), "EEEE d 'de' MMMM", { locale: es })}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleMarkAllPresent}
                    disabled={!!dateError}
                    className="flex items-center gap-1.5 rounded-2xl border border-green-500/30 bg-green-500/10 px-3 py-2 text-xs font-semibold text-green-600 dark:text-green-400 hover:bg-green-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <UserCheck size={14} />
                    Todos presentes
                  </button>
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
              </div>

              {dateError && (
                <div className="flex items-center gap-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-3 text-sm text-amber-400">
                  <AlertTriangle size={16} className="shrink-0" />
                  <span>{dateError}</span>
                </div>
              )}

              {!dateError && !loadingAttendance && attendanceRecords.length === 0 && (
                <div className="flex items-center gap-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 px-4 py-3 text-sm text-blue-400">
                  <AlertTriangle size={16} className="shrink-0" />
                  <span>Asistencia no registrada para esta fecha. Todos aparecen como ausentes por defecto — marcá los presentes y guardá.</span>
                </div>
              )}

              {!dateError && (loadingAttendance || loadingInscrip || loadingRecuperaciones ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <div key={i} className="space-y-2">
                      <Skeleton className="h-7 rounded-xl w-24" />
                      {Array.from({ length: 4 }).map((_, j) => <Skeleton key={j} className="h-10 rounded-xl" />)}
                    </div>
                  ))}
                </div>
              ) : (() => {
                // Entradas unificadas: inscriptos regulares + clientes que recuperan hoy
                const regularEntries = activeInscrip.map(i => ({
                  clienteId: i.clienteId,
                  nombre: i.clienteNombre,
                  sala: i.sala,
                  esRecuperacion: false as const,
                }))
                const regularIds = new Set(activeInscrip.map(i => i.clienteId))
                const recuperacionEntries = recuperacionesHoy
                  .filter(r => !regularIds.has(r.clienteId))
                  .map(r => ({
                    clienteId: r.clienteId,
                    nombre: `${r.cliente.nombre} ${r.cliente.apellido}`,
                    sala: 'A' as const,
                    esRecuperacion: true as const,
                  }))
                const allEntries = [...regularEntries, ...recuperacionEntries]

                if (allEntries.length === 0) return (
                  <EmptyState icon={Users} message="No hay clientes para esta fecha" className="py-10" />
                )

                const asistenciaList = allEntries.filter(e => getAttendanceState(e.clienteId) !== 'con_aviso')
                const conAvisoList   = allEntries.filter(e => getAttendanceState(e.clienteId) === 'con_aviso')

                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Columna 1 — Asistencia */}
                    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-[#8A8A9A]">Asistencia</span>
                        <span className="ml-auto text-xs font-semibold tabular-nums text-gray-500 dark:text-[#8A8A9A]">{asistenciaList.length}</span>
                      </div>
                      <div className="space-y-1.5">
                        {asistenciaList.map(entry => (
                          <AttendanceRowCard
                            key={entry.clienteId}
                            entry={entry}
                            state={getAttendanceState(entry.clienteId) as 'presente' | 'ausente'}
                            onToggle={() => setAttendanceState(entry.clienteId, getAttendanceState(entry.clienteId) === 'presente' ? 'ausente' : 'presente')}
                            onConAviso={() => setAttendanceState(entry.clienteId, 'con_aviso')}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Columna 2 — Con aviso */}
                    <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.02] p-3">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="h-2.5 w-2.5 rounded-full shrink-0 bg-amber-400" />
                        <span className="text-xs font-bold uppercase tracking-widest text-amber-500 dark:text-amber-400">Con aviso</span>
                        <span className="text-[10px] text-amber-400/60 font-medium">genera crédito</span>
                        <span className="ml-auto text-xs font-semibold tabular-nums text-amber-500 dark:text-amber-400">{conAvisoList.length}</span>
                      </div>
                      <div className="space-y-1.5">
                        {conAvisoList.map(entry => (
                          <ConAvisoRowCard
                            key={entry.clienteId}
                            entry={entry}
                            onUndo={() => setAttendanceState(entry.clienteId, 'ausente')}
                          />
                        ))}
                        {conAvisoList.length === 0 && (
                          <div className="flex items-center justify-center py-6 rounded-xl border-2 border-dashed border-amber-500/20">
                            <p className="text-xs text-amber-400/40">Ningún cliente avisó</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
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
                {can('shifts', 'create') && (
                  <button
                    onClick={() => { setAddEsperaMode(m => { if (!m) setAddEsperaTipo(esperaTipoTab === 'TODOS' ? 'INTERNA' : esperaTipoTab); return !m }); setAddEsperaClientSearch(''); setAddEsperaClientId(''); setAddExternoNombre(''); setAddExternoApellido(''); setAddExternoWhatsapp('') }}
                    className="flex items-center gap-1.5 rounded-xl bg-primary/25 px-3 py-1.5 text-xs font-semibold text-amber-700 dark:text-primary hover:bg-primary/40 transition-all"
                  >
                    <ListPlus size={13} /> {addEsperaMode ? 'Cancelar' : 'Agregar a lista'}
                  </button>
                )}
              </div>

              {/* Layout dos columnas cuando el panel está abierto */}
              <div className="flex gap-3 items-start">
                {/* Columna izquierda: pills + lista */}
                <div className="flex-1 min-w-0 space-y-3">
                  <div className="flex gap-1.5">
                    {(['TODOS', 'INTERNA', 'EXTERNA'] as const).map(tipo => {
                      const count = tipo === 'TODOS' ? esperaEntries.length : esperaEntries.filter(e => e.tipo === tipo).length
                      return (
                        <button key={tipo} onClick={() => setEsperaTipoTab(tipo)}
                          className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all flex items-center gap-1.5 ${
                            esperaTipoTab === tipo
                              ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                              : 'border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] text-gray-500 dark:text-[#8A8A9A]'
                          }`}
                        >
                          {tipo === 'TODOS' ? 'Todos' : tipo === 'INTERNA' ? 'Interna' : 'Externa'}
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

                  {/* Lista de entradas */}
                  {esperaLoading ? (
                    <div className="space-y-2">
                      {[1,2,3].map(i => <div key={i} className="h-14 rounded-xl bg-white/[0.04] animate-pulse" />)}
                    </div>
                  ) : esperaError ? (
                    <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3">
                      <p className="text-sm text-red-400">{esperaError}</p>
                    </div>
                  ) : (() => {
                    const filteredEspera = esperaTipoTab === 'TODOS'
                      ? esperaEntries
                      : esperaEntries.filter(e => e.tipo === esperaTipoTab)
                    if (filteredEspera.length === 0) return (
                      <EmptyState icon={Clock} message={`No hay entradas${esperaTipoTab === 'INTERNA' ? ' internas' : esperaTipoTab === 'EXTERNA' ? ' externas' : ''}`} className="py-10" />
                    )
                    return (
                      <div className="grid grid-cols-2 gap-3">
                        {filteredEspera.map(entry => {
                          const isActioning = actionLoadingIds.has(entry.id)
                          return (
                            <motion.div
                              key={entry.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                              className="flex flex-col gap-2 rounded-xl border border-white/50 dark:border-white/[0.08] bg-white/30 dark:bg-white/[0.05] backdrop-blur-xl px-3 py-2.5"
                            >
                              {editingEsperaId === entry.id ? (
                                /* Form inline de edición para contacto externo */
                                <div className="space-y-1.5">
                                  <input
                                    value={editExternoNombre}
                                    onChange={e => setEditExternoNombre(e.target.value)}
                                    placeholder="Nombre"
                                    className="w-full rounded-lg border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.06] px-2.5 py-1.5 text-xs text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-[#8A8A9A] focus:outline-none focus:ring-1 focus:ring-primary"
                                  />
                                  <input
                                    value={editExternoApellido}
                                    onChange={e => setEditExternoApellido(e.target.value)}
                                    placeholder="Apellido"
                                    className="w-full rounded-lg border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.06] px-2.5 py-1.5 text-xs text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-[#8A8A9A] focus:outline-none focus:ring-1 focus:ring-primary"
                                  />
                                  <input
                                    value={editExternoWhatsapp}
                                    onChange={e => setEditExternoWhatsapp(e.target.value)}
                                    placeholder="WhatsApp"
                                    className="w-full rounded-lg border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.06] px-2.5 py-1.5 text-xs text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-[#8A8A9A] focus:outline-none focus:ring-1 focus:ring-primary"
                                  />
                                  <div className="flex gap-1.5 pt-0.5">
                                    <button
                                      disabled={editEsperaSubmitting || !editExternoNombre.trim() || !editExternoApellido.trim()}
                                      onClick={() => handleEsperaSaveEdit(entry.id)}
                                      className="flex items-center gap-1 rounded-lg bg-primary/20 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:text-primary hover:bg-primary/30 transition-all disabled:opacity-50"
                                    >
                                      <Save size={10} /> Guardar
                                    </button>
                                    <button
                                      onClick={() => setEditingEsperaId(null)}
                                      className="flex items-center gap-1 rounded-lg border border-gray-200 dark:border-white/[0.08] px-2.5 py-1 text-xs font-semibold text-gray-500 dark:text-[#8A8A9A] hover:bg-gray-100 dark:hover:bg-white/[0.05] transition-all"
                                    >
                                      Cancelar
                                    </button>
                                  </div>
                                </div>
                              ) : (<>
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{entry.clienteNombre}</p>
                                    <p className="text-xs text-[#8A8A9A]">
                                      {format(new Date(entry.fechaSolicitud), "d MMM yyyy", { locale: es })}
                                    </p>
                                  </div>
                                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold border ${ESPERA_BADGE[entry.estado]}`}>
                                    {ESPERA_LABEL[entry.estado]}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {!entry.clienteId && entry.whatsappExterno && (
                                    <a
                                      href={`https://wa.me/${entry.whatsappExterno.replace(/\D/g, '')}`}
                                      target="_blank" rel="noopener noreferrer"
                                      className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                                      onClick={e => e.stopPropagation()}
                                    >
                                      <MessageSquare size={10} />
                                      {entry.whatsappExterno}
                                    </a>
                                  )}
                                  {can('shifts', 'update') && entry.estado === 'NOTIFICADO' && (<>
                                    <button disabled={isActioning} onClick={() => handleEsperaAction(entry.id, 'aceptar')}
                                      className="flex items-center gap-1 rounded-lg bg-green-500/10 px-2 py-1 text-xs font-semibold text-green-400 hover:bg-green-500/20 transition-all disabled:opacity-50">
                                      <Check size={11} /> Aceptó
                                    </button>
                                    <button disabled={isActioning} onClick={() => handleEsperaAction(entry.id, 'rechazar')}
                                      className="flex items-center gap-1 rounded-lg bg-red-500/10 px-2 py-1 text-xs font-semibold text-red-400 hover:bg-red-500/20 transition-all disabled:opacity-50">
                                      <X size={11} /> Rechazó
                                    </button>
                                  </>)}
                                  {(can('shifts', 'update') || can('shifts', 'delete')) && (
                                    <div className="ml-auto flex items-center gap-1">
                                      {can('shifts', 'update') && entry.estado === 'PENDIENTE' && (
                                        <button disabled={isActioning} onClick={() => handleEsperaAction(entry.id, 'notificar')}
                                          className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10 text-amber-700 dark:text-primary hover:bg-primary/20 transition-all disabled:opacity-50">
                                          <Bell size={11} />
                                        </button>
                                      )}
                                      {can('shifts', 'update') && !entry.clienteId && (
                                        <button disabled={isActioning} onClick={() => startEditEspera(entry)}
                                          className="flex h-6 w-6 items-center justify-center rounded-lg bg-gray-100 dark:bg-white/[0.06] text-gray-500 dark:text-[#8A8A9A] hover:bg-gray-200 dark:hover:bg-white/10 transition-all disabled:opacity-50">
                                          <Pencil size={11} />
                                        </button>
                                      )}
                                      {can('shifts', 'delete') && (
                                        <button disabled={isActioning} onClick={() => handleEsperaAction(entry.id, 'eliminar')}
                                          className="flex h-6 w-6 items-center justify-center rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all disabled:opacity-50">
                                          <Trash2 size={11} />
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </>)}
                            </motion.div>
                          )
                        })}
                      </div>
                    )
                  })()}
                </div>{/* fin columna izquierda */}

                {/* Columna derecha: panel de alta */}
                <AnimatePresence>
                  {addEsperaMode && (() => {
                    const waitlistedIds = new Set(
                      esperaEntries
                        .filter(e => e.estado === 'PENDIENTE' || e.estado === 'NOTIFICADO')
                        .map(e => e.clienteId)
                        .filter(Boolean)
                    )
                    const filteredForEspera = clients
                      .filter(c => !waitlistedIds.has(String(c.id)))
                      .filter(c => !addEsperaClientSearch || `${c.name} ${c.lastName}`.toLowerCase().includes(addEsperaClientSearch.toLowerCase()))
                      .slice(0, 8)
                    const canSubmit = addEsperaTipo === 'INTERNA'
                      ? addEsperaClientId !== ''
                      : addExternoNombre.trim() !== '' && addExternoApellido.trim() !== '' && addExternoWhatsapp.trim() !== ''
                    return (
                      <motion.div
                        initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }}
                        className="w-1/3 shrink-0 rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-3"
                      >
                        {/* Tipo toggle */}
                        <div className="flex gap-1.5">
                          {(['INTERNA', 'EXTERNA'] as const).map(t => (
                            <button key={t} type="button"
                              onClick={() => { setAddEsperaTipo(t); setAddEsperaClientId(''); setAddEsperaClientSearch(''); setAddExternoNombre(''); setAddExternoApellido(''); setAddExternoWhatsapp('') }}
                              className={`flex-1 rounded-lg py-1 text-[11px] font-semibold transition-all border ${
                                addEsperaTipo === t
                                  ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-transparent'
                                  : 'border-gray-200 dark:border-white/[0.08] text-gray-500 dark:text-[#8A8A9A]'
                              }`}
                            >
                              {t === 'INTERNA' ? 'Interna' : 'Externa'}
                            </button>
                          ))}
                        </div>

                        {/* INTERNA: buscador de cliente registrado */}
                        {addEsperaTipo === 'INTERNA' && (<>
                          <div className="relative">
                            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8A8A9A]" />
                            <input
                              value={addEsperaClientSearch}
                              onChange={e => { setAddEsperaClientSearch(e.target.value); setAddEsperaClientId('') }}
                              placeholder="Buscar cliente..."
                              className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] pl-7 pr-2 py-1.5 text-xs text-gray-900 dark:text-white placeholder:text-[#8A8A9A] outline-none focus:border-primary/40"
                            />
                          </div>
                          <div className="space-y-1 max-h-40 overflow-y-auto">
                            {filteredForEspera.length === 0 ? (
                              <p className="text-xs text-[#8A8A9A] text-center py-2">
                                {addEsperaClientSearch ? 'Sin resultados' : 'No hay clientes'}
                              </p>
                            ) : filteredForEspera.map(c => (
                              <button key={c.id} type="button"
                                onClick={() => setAddEsperaClientId(String(c.id))}
                                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-xs transition-all ${
                                  addEsperaClientId === String(c.id)
                                    ? 'bg-primary/10 border border-primary/30 text-primary'
                                    : 'hover:bg-black/5 dark:hover:bg-white/5 text-gray-900 dark:text-white'
                                }`}
                              >
                                {c.name} {c.lastName}
                              </button>
                            ))}
                          </div>
                        </>)}

                        {/* EXTERNA: formulario de contacto sin cuenta */}
                        {addEsperaTipo === 'EXTERNA' && (
                          <div className="space-y-2">
                            <input
                              value={addExternoNombre}
                              onChange={e => setAddExternoNombre(e.target.value)}
                              placeholder="Nombre *"
                              className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 py-1.5 text-xs text-gray-900 dark:text-white placeholder:text-[#8A8A9A] outline-none focus:border-primary/40"
                            />
                            <input
                              value={addExternoApellido}
                              onChange={e => setAddExternoApellido(e.target.value)}
                              placeholder="Apellido *"
                              className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 py-1.5 text-xs text-gray-900 dark:text-white placeholder:text-[#8A8A9A] outline-none focus:border-primary/40"
                            />
                            <input
                              value={addExternoWhatsapp}
                              onChange={e => setAddExternoWhatsapp(e.target.value)}
                              placeholder="WhatsApp *"
                              className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 py-1.5 text-xs text-gray-900 dark:text-white placeholder:text-[#8A8A9A] outline-none focus:border-primary/40"
                            />
                          </div>
                        )}

                        <Button size="sm" onClick={handleAddToWaitingList} isLoading={addEsperaSubmitting} className="w-full" disabled={!canSubmit}>
                          Agregar
                        </Button>
                      </motion.div>
                    )
                  })()}
                </AnimatePresence>
              </div>{/* fin flex columnas */}
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

function ResumenCard({ insc, clients, sala, aviso }: { insc: InscripcionEntry; clients: any[]; sala: 'A' | 'B'; aviso?: boolean }) {
  const clientData = clients.find(c => String(c.id) === String(insc.clienteId))
  const statusConfig: Record<string, { label: string; classes: string }> = {
    active:   { label: 'Activo',     classes: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' },
    expiring: { label: 'Vencida',    classes: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20' },
    debt:     { label: 'Vencida',    classes: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20' },
    inactive: { label: 'Inactivo',   classes: 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border border-gray-500/20' },
  }
  const clientStatus = clientData?.status && statusConfig[clientData.status]
    ? statusConfig[clientData.status]
    : { label: 'Inscripto', classes: 'bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20' }

  const avatarBg = aviso
    ? 'bg-amber-500/15'
    : sala === 'A' ? 'bg-blue-500/10' : 'bg-purple-500/10'
  const avatarText = aviso
    ? 'text-amber-500'
    : sala === 'A' ? 'text-blue-500' : 'text-purple-500'
  const cardBorder = aviso
    ? 'border-amber-500/25 dark:border-amber-500/20'
    : 'border-white/50 dark:border-white/[0.08]'
  const cardBg = aviso
    ? 'bg-amber-500/5 dark:bg-amber-500/[0.04]'
    : 'bg-white/30 dark:bg-white/[0.05]'

  return (
    <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl border ${cardBorder} ${cardBg} backdrop-blur-xl hover:bg-white/50 dark:hover:bg-white/[0.08] transition-all hover:shadow-sm`}>
      <div className="flex items-center gap-3 min-w-0">
        <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${avatarBg}`}>
          <span className={`text-xs font-black ${avatarText}`}>
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
            {aviso && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                Avisó que falta
              </span>
            )}
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

type AttendanceEntry = { clienteId: string; nombre: string; sala: 'A' | 'B'; esRecuperacion: boolean }

function AttendanceRowCard({ entry, state, onToggle, onConAviso }: {
  entry: AttendanceEntry
  state: 'presente' | 'ausente'
  onToggle: () => void
  onConAviso: () => void
}) {
  return (
    <motion.div layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 backdrop-blur-xl"
    >
      {entry.esRecuperacion
        ? <span className="h-2 w-2 rounded-full shrink-0 bg-emerald-400" />
        : <span className={`h-2 w-2 rounded-full shrink-0 ${entry.sala === 'A' ? 'bg-blue-400' : 'bg-purple-400'}`} />
      }
      <p className="flex-1 text-sm font-semibold text-gray-900 dark:text-white truncate min-w-0">{entry.nombre}</p>
      {entry.esRecuperacion && (
        <span className="text-[9px] font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-full shrink-0 whitespace-nowrap">
          Recupera
        </span>
      )}
      <button
        onClick={onToggle}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 transition-colors duration-200 focus:outline-none ${
          state === 'presente' ? 'bg-green-500 border-green-500' : 'bg-red-500/30 border-red-500/40'
        }`}
      >
        <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${
          state === 'presente' ? 'translate-x-5' : 'translate-x-0.5'
        }`} />
      </button>
      <button
        onClick={onConAviso}
        title="Con aviso"
        className="rounded-lg p-1.5 text-amber-500/40 hover:text-amber-400 hover:bg-amber-500/10 transition-all"
      >
        <Bell size={13} />
      </button>
    </motion.div>
  )
}

function ConAvisoRowCard({ entry, onUndo }: { entry: AttendanceEntry; onUndo: () => void }) {
  return (
    <motion.div layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/[0.05] px-3 py-2 backdrop-blur-xl"
    >
      {entry.esRecuperacion
        ? <span className="h-2 w-2 rounded-full shrink-0 bg-emerald-400" />
        : <span className={`h-2 w-2 rounded-full shrink-0 ${entry.sala === 'A' ? 'bg-blue-400' : 'bg-purple-400'}`} />
      }
      <p className="flex-1 text-sm font-semibold text-gray-900 dark:text-white truncate min-w-0">{entry.nombre}</p>
      {entry.esRecuperacion && (
        <span className="text-[9px] font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-full shrink-0 whitespace-nowrap">
          Recupera
        </span>
      )}
      <button
        onClick={onUndo}
        title="Quitar aviso"
        className="rounded-lg p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
      >
        <X size={13} />
      </button>
    </motion.div>
  )
}

function DraggableCard({
  insc, isPending, isDragging, bajandoId, canWrite, canDelete, onDarDeBaja, onDragStart,
}: {
  insc: InscripcionEntry
  isPending: boolean
  isDragging: boolean
  bajandoId: string | null
  canWrite: boolean   // can('shifts', 'update') — habilita drag y cambio de sala
  canDelete: boolean  // can('shifts', 'delete') — habilita dar de baja
  onDarDeBaja: (id: string, sala: 'A' | 'B') => void
  onDragStart: (e: React.DragEvent, id: string) => void
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: isDragging ? 0.4 : 1, scale: 1 }}
      draggable={canWrite}
      onDragStart={canWrite ? e => onDragStart(e, insc.id) : undefined}
      className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 select-none backdrop-blur-xl transition-colors ${
        canWrite ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
      } ${
        isPending
          ? 'border-primary/30 bg-primary/10 dark:bg-primary/[0.08]'
          : 'border-white/50 dark:border-white/[0.08] bg-white/30 dark:bg-white/[0.05] hover:bg-white/50 dark:hover:bg-white/[0.09]'
      }`}
    >
      {canWrite && <GripVertical size={13} className="text-[#8A8A9A]/60 shrink-0" />}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{insc.clienteNombre}</p>
          {isPending && (
            <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full shrink-0">
              Movido
            </span>
          )}
        </div>
      </div>
      {canDelete && (
        <button
          disabled={bajandoId === insc.id}
          onClick={e => { e.stopPropagation(); onDarDeBaja(insc.id, insc.sala) }}
          className="flex items-center gap-1 rounded-lg bg-red-500/10 px-2 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/20 transition-all disabled:opacity-50 shrink-0"
        >
          {bajandoId === insc.id ? '…' : <><X size={11} /> Dar de baja</>}
        </button>
      )}
    </motion.div>
  )
}
