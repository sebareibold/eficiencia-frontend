import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { pageVariants } from '../lib/motion'
import {
  Plus, Clock, Users, RefreshCw, Dumbbell, Trash2,
  LayoutGrid, CalendarDays, ChevronLeft, ChevronRight,
  Filter, Settings2, X, Bell, Check, Pencil, UserPlus, ListPlus, Search
} from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { addWeeks, subWeeks, startOfWeek, endOfWeek, addDays, subDays, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, format, isSameDay } from 'date-fns'
import { es } from 'date-fns/locale'
import { useShifts } from '../hooks/useShifts'
import { useClients } from '../hooks/useClients'
import { useListaEspera } from '../hooks/useListaEspera'
import { shiftsApi, professorsApi } from '../api/shifts.api'
import { listaEsperaApi } from '../api/listaEspera.api'
import { inscripcionesApi } from '../api/inscripciones.api'
import { useUiStore } from '../store/uiStore'
import { useAuthStore } from '../store/authStore'
import type { EstadoEspera, TipoEspera } from '../types/listaEspera.types'
import type { InscripcionEntry } from '../api/inscripciones.api'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import Skeleton from '../components/ui/Skeleton'
import type { Shift, WeekDay } from '../types/shift.types'

// ─── Constants ────────────────────────────────────────────────────────────────

const DAY_LABELS: Record<WeekDay, string> = {
  monday: 'Lunes',
  tuesday: 'Martes',
  wednesday: 'Miércoles',
  thursday: 'Jueves',
  friday: 'Viernes',
  saturday: 'Sábado',
  sunday: 'Domingo',
}

const DAYS: WeekDay[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

const JS_TO_WEEKDAY: Record<number, WeekDay | undefined> = {
  1: 'monday', 2: 'tuesday', 3: 'wednesday', 4: 'thursday', 5: 'friday', 6: 'saturday', 0: 'sunday'
}

const TIMELINE_START_H  = 6
const TIMELINE_END_H    = 22
const PX_PER_MIN        = 1.3
const TIMELINE_HEIGHT   = (TIMELINE_END_H - TIMELINE_START_H) * 60 * PX_PER_MIN
const MAX_MONTH_SHIFTS  = 4   // máximo de filas compactas visibles en la vista mensual
const HOURS = Array.from(
  { length: TIMELINE_END_H - TIMELINE_START_H + 1 },
  (_, i) => `${String(TIMELINE_START_H + i).padStart(2, '0')}:00`
)

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  room:       z.string().min(1, 'La sala es requerida'),
  days:       z.array(
    z.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'])
  ).min(1, 'Seleccioná al menos un día'),
  recurrente: z.boolean().default(true),
  startTime:  z.string().min(1, 'La hora de inicio es requerida'),
  endTime:    z.string().min(1, 'La hora de fin es requerida'),
  capacity:   z.string().min(1, 'El cupo es requerido').refine(v => Number(v) > 0, 'Cupo inválido'),
  profesorId: z.string().min(1, 'El profesor es requerido'),
  clientIds:  z.array(z.string()),
}).refine(data => data.clientIds.length <= Number(data.capacity || 0), {
  message: 'La cantidad de clientes supera el cupo',
  path: ['clientIds']
})

type FormValues = z.infer<typeof schema>

// Schema para editar un turno existente (mismo que crear, sin clientIds)
const editSchema = z.object({
  room:       z.string().min(1, 'La sala es requerida'),
  days:       z.array(
    z.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'])
  ).min(1, 'Seleccioná al menos un día'),
  recurrente: z.boolean().default(true),
  startTime:  z.string().min(1, 'La hora de inicio es requerida'),
  endTime:    z.string().min(1, 'La hora de fin es requerida'),
  capacity:   z.string().min(1, 'El cupo es requerido').refine(v => Number(v) > 0, 'Cupo inválido'),
  profesorId: z.string().min(1, 'El profesor es requerido'),
})
type EditFormValues = z.infer<typeof editSchema>

type RoomFilter  = 'all' | 'A' | 'B'
type DayFilter   = 'all' | WeekDay
type ShiftLayout = { shift: Shift; colIndex: number; numCols: number }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getOccupancyColor(enrolled: number, capacity: number): string {
  const r = enrolled / capacity
  if (r >= 1)   return 'bg-red-500'
  if (r >= 0.8) return 'bg-yellow-400'
  return 'bg-green-500'
}

function getOccupancyDot(enrolled: number, capacity: number): string {
  const r = enrolled / capacity
  if (r >= 1)   return 'bg-red-400'
  if (r >= 0.8) return 'bg-yellow-400'
  return 'bg-green-400'
}

function getOccupancyStyle(enrolled: number, capacity: number): string {
  const r = enrolled / capacity
  if (r >= 1)   return 'border-red-500/50 bg-red-500/10 hover:bg-red-500/25 hover:border-red-500/80'
  if (r >= 0.8) return 'border-yellow-500/50 bg-yellow-500/10 hover:bg-yellow-500/25 hover:border-yellow-500/80'
  return 'border-green-500/50 bg-green-500/10 hover:bg-green-500/25 hover:border-green-500/80'
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

/**
 * Asigna colIndex y numCols a cada turno usando un algoritmo greedy con union-find.
 * Turnos que se solapan forman un "cluster" y se distribuyen en columnas paralelas.
 * Turnos sin solapamiento siempre obtienen numCols=1 (ancho completo).
 */
function computeColumnLayout(shifts: Shift[]): ShiftLayout[] {
  if (!shifts.length) return []

  const sorted = [...shifts].sort(
    (a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
  )
  const n = sorted.length

  // Union-Find comprimido por camino
  const parent = Array.from({ length: n }, (_, i) => i)
  function find(x: number): number {
    while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x] }
    return x
  }

  // Dos turnos se solapan si A.start < B.end Y B.start < A.end
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const aStart = timeToMinutes(sorted[i].startTime)
      const aEnd   = timeToMinutes(sorted[i].endTime)
      const bStart = timeToMinutes(sorted[j].startTime)
      const bEnd   = timeToMinutes(sorted[j].endTime)
      if (aStart < bEnd && bStart < aEnd) {
        const ri = find(i), rj = find(j)
        if (ri !== rj) parent[ri] = rj
      }
    }
  }

  // Agrupar índices por cluster
  const clusters = new Map<number, number[]>()
  for (let i = 0; i < n; i++) {
    const root = find(i)
    if (!clusters.has(root)) clusters.set(root, [])
    clusters.get(root)!.push(i)
  }

  const result: ShiftLayout[] = new Array(n)

  clusters.forEach((indices) => {
    // Asignación greedy de columnas: reutiliza la primera columna libre
    const colEnds: number[] = []
    const colOf   = new Array<number>(indices.length)

    indices.forEach((globalIdx, localIdx) => {
      const startMin = timeToMinutes(sorted[globalIdx].startTime)
      let col = colEnds.findIndex(end => end <= startMin)
      if (col === -1) col = colEnds.length
      colEnds[col] = timeToMinutes(sorted[globalIdx].endTime)
      colOf[localIdx] = col
    })

    const numCols = colEnds.length
    indices.forEach((globalIdx, localIdx) => {
      result[globalIdx] = { shift: sorted[globalIdx], colIndex: colOf[localIdx], numCols }
    })
  })

  return result
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ShiftsPage() {
  const { shifts, isLoading, error, refetch } = useShifts()
  const { clients } = useClients()
  const addToast = useUiStore(s => s.addToast)
  const user     = useAuthStore(s => s.user)
  const isAdmin  = user?.role === 'admin'
  const navigate = useNavigate()

  // ── View mode
  const [viewMode, setViewMode] = useState<'grid' | 'calendar' | 'timeline'>('calendar')

  // ── Grid state
  const [roomFilter, setRoomFilter] = useState<RoomFilter>('all')
  const [dayFilter,  setDayFilter]  = useState<DayFilter>('all')

  // ── Calendar state
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d
  })
  const [calendarRange, setCalendarRange] = useState<'1day' | '3days' | 'week' | 'month'>(() =>
    typeof window !== 'undefined' && window.innerWidth < 768 ? '1day' : 'week'
  )
  const [calendarSelectedDays, setCalendarSelectedDays] = useState<WeekDay[]>(DAYS)
  const [calendarViewMode, setCalendarViewMode] = useState<'extended' | 'optimized'>('extended')
  const [showCalendarFilters, setShowCalendarFilters] = useState(false)

  // ── Timeline state
  const [timelineDay, setTimelineDay] = useState<WeekDay>(
    () => JS_TO_WEEKDAY[new Date().getDay()] ?? 'monday'
  )

  // ── Shared modal state
  const [createOpen,  setCreateOpen]  = useState(false)
  const [detailShift, setDetailShift] = useState<Shift | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleting,   setIsDeleting]   = useState<number | null>(null)
  const [clientSearch, setClientSearch] = useState('')
  const [professors,   setProfessors]   = useState<{ id: string; name: string }[]>([])
  const [profsLoading, setProfsLoading] = useState(false)

  // ── Management panel state
  const [detailTab,        setDetailTab]        = useState<'edit' | 'inscripciones' | 'espera'>('edit')
  const [esperaTipoTab,    setEsperaTipoTab]    = useState<'INTERNA' | 'EXTERNA'>('INTERNA')
  const [actionLoadingIds, setActionLoadingIds] = useState<Set<string>>(new Set())

  // Inscripciones tab
  const [inscripciones,   setInscripciones]   = useState<InscripcionEntry[]>([])
  const [loadingInscrip,  setLoadingInscrip]  = useState(false)
  const [bajandoId,       setBajandoId]       = useState<string | null>(null)
  const [addClientMode,   setAddClientMode]   = useState(false)
  const [addClientSearch, setAddClientSearch] = useState('')
  const [addClientId,     setAddClientId]     = useState('')
  const [addClientSubmitting, setAddClientSubmitting] = useState(false)

  // Lista de espera — agregar manualmente
  const [addEsperaMode,        setAddEsperaMode]        = useState(false)
  const [addEsperaClientSearch,setAddEsperaClientSearch] = useState('')
  const [addEsperaClientId,    setAddEsperaClientId]    = useState('')
  const [addEsperaTipo,        setAddEsperaTipo]        = useState<TipoEspera>('INTERNA')
  const [addEsperaSubmitting,  setAddEsperaSubmitting]  = useState(false)

  // Edit form (separate instance from create form)
  const {
    register: editRegister, handleSubmit: editHandleSubmit,
    formState: { errors: editErrors }, reset: editReset,
    watch: editWatch, setValue: editSetValue,
  } = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
    defaultValues: { room: 'A', days: [], recurrente: true, startTime: '', endTime: '', capacity: '', profesorId: '' },
  })
  const [editSubmitting, setEditSubmitting] = useState(false)
  const editDays       = (editWatch('days') || []) as WeekDay[]
  const editRecurrente = editWatch('recurrente') ?? true

  const { entries: esperaEntries, isLoading: esperaLoading, error: esperaError, refetch: refetchEspera } =
    useListaEspera(detailShift ? String(detailShift.id) : null)

  const { register, handleSubmit, formState: { errors }, reset, watch, setValue } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { room: 'A', days: [], recurrente: true, clientIds: [] },
  })

  const formClientIds = watch('clientIds') || []
  const formCapacity  = Number(watch('capacity')) || 0
  const formDays      = (watch('days') || []) as WeekDay[]
  const formRecurrente = watch('recurrente') ?? true

  // Carga profesores reales desde la API
  useEffect(() => {
    setProfsLoading(true)
    professorsApi.getAll()
      .then(setProfessors)
      .catch(() => setProfessors([]))
      .finally(() => setProfsLoading(false))
  }, [])

  // ── Derived: grid
  const filtered = useMemo(() =>
    shifts.filter(s =>
      (roomFilter === 'all' || s.room === roomFilter) &&
      (dayFilter  === 'all' || s.days.includes(dayFilter as WeekDay))
    ),
    [shifts, roomFilter, dayFilter]
  )

  // ── Derived: calendar nav limits (1day mode: ±2 days from today)
  const todayMidnight = useMemo(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d
  }, [])
  const weekStartNorm = useMemo(() => {
    const d = new Date(weekStart); d.setHours(0, 0, 0, 0); return d
  }, [weekStart])
  const dayDiff = Math.round((weekStartNorm.getTime() - todayMidnight.getTime()) / 86400000)
  const canGoPrev = calendarRange !== '1day' || dayDiff > -2
  const canGoNext = calendarRange !== '1day' || dayDiff < 2

  const handlePrev = () => {
    if (!canGoPrev) return
    if (calendarRange === '1day')   setWeekStart(d => subDays(d, 1))
    else if (calendarRange === 'month') setWeekStart(d => subMonths(d, 1))
    else if (calendarRange === '3days') setWeekStart(d => subDays(d, 3))
    else setWeekStart(d => subWeeks(d, 1))
  }
  const handleNext = () => {
    if (!canGoNext) return
    if (calendarRange === '1day')   setWeekStart(d => addDays(d, 1))
    else if (calendarRange === 'month') setWeekStart(d => addMonths(d, 1))
    else if (calendarRange === '3days') setWeekStart(d => addDays(d, 3))
    else setWeekStart(d => addWeeks(d, 1))
  }

  const currentDates = useMemo(() => {
    if (calendarRange === '1day') {
      return [weekStart]
    } else if (calendarRange === '3days') {
      return Array.from({length: 3}).map((_, i) => addDays(weekStart, i))
    } else if (calendarRange === 'week') {
      return Array.from({length: 7}).map((_, i) => addDays(startOfWeek(weekStart, { weekStartsOn: 1 }), i))
    } else {
      const start = startOfMonth(weekStart)
      const end = endOfMonth(weekStart)
      return eachDayOfInterval({ start, end })
    }
  }, [calendarRange, weekStart])

  const visibleDates = useMemo(() => {
    if (calendarRange === 'month') return [];
    if (calendarRange === 'week') {
      return currentDates.filter(d => {
        const wday = JS_TO_WEEKDAY[d.getDay()]
        return wday && calendarSelectedDays.includes(wday)
      })
    }
    return currentDates;
  }, [currentDates, calendarRange, calendarSelectedDays])

  const monthGridDays = useMemo(() => {
    if (calendarRange !== 'month') return [];
    const start = startOfWeek(startOfMonth(weekStart), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(weekStart), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [calendarRange, weekStart]);

  const activeHourInts = useMemo(() => {
    const active = new Set<number>();
    if (calendarViewMode === 'optimized') {
      visibleDates.forEach(date => {
        const wday = JS_TO_WEEKDAY[date.getDay()];
        if (!wday) return;
        shifts.filter(s => s.days.includes(wday)).forEach(s => {
          const startH = parseInt(s.startTime.split(':')[0], 10);
          const endH = parseInt(s.endTime.split(':')[0], 10);
          for(let h = startH; h <= endH; h++) {
            active.add(h);
          }
        });
      });
    }
    return active;
  }, [calendarViewMode, visibleDates, shifts])

  const { offsets, totalHeight } = useMemo(() => {
    let currentOffset = 0;
    const offs: Record<string, number> = {};
    
    HOURS.forEach(hStr => {
      const h = parseInt(hStr.split(':')[0], 10);
      offs[hStr] = currentOffset;
      
      if (calendarViewMode === 'extended' || activeHourInts.has(h)) {
        currentOffset += 60 * PX_PER_MIN;
      }
    });
    return { offsets: offs, totalHeight: currentOffset };
  }, [HOURS, calendarViewMode, activeHourInts])

  const getTimeY = (timeStr: string) => {
    const h = parseInt(timeStr.split(':')[0], 10);
    const m = parseInt(timeStr.split(':')[1], 10);
    
    const hClamped = Math.max(TIMELINE_START_H, Math.min(h, TIMELINE_END_H));
    const hourKey = `${String(hClamped).padStart(2, '0')}:00`;
    const baseY = offsets[hourKey] ?? 0;
    
    if (calendarViewMode === 'extended' || activeHourInts.has(hClamped)) {
      return baseY + (m * PX_PER_MIN);
    } else {
      return baseY;
    }
  }

  const shiftsByDay = useMemo(() => {
    const map: Record<WeekDay, Shift[]> = {
      monday: [], tuesday: [], wednesday: [], thursday: [], friday: [], saturday: [], sunday: [],
    }
    shifts.forEach(s => { s.days.forEach(d => { if (map[d]) map[d].push(s) }) })
    Object.values(map).forEach(arr => arr.sort((a, b) => a.startTime.localeCompare(b.startTime)))
    return map
  }, [shifts])

  // Layout de columnas por día: evita solapamiento visual entre turnos simultáneos
  const layoutsByDay = useMemo(() => {
    const map = {} as Record<WeekDay, ShiftLayout[]>
    ;(Object.keys(shiftsByDay) as WeekDay[]).forEach(day => {
      map[day] = computeColumnLayout(shiftsByDay[day])
    })
    return map
  }, [shiftsByDay])

  // ── Derived: timeline
  const timelineShifts = useMemo(() =>
    [...shifts]
      .filter(s => s.days.includes(timelineDay))
      .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [shifts, timelineDay]
  )

  const now           = new Date()
  const todayWeekDay  = JS_TO_WEEKDAY[now.getDay()]
  const nowPx         = (now.getHours() * 60 + now.getMinutes() - TIMELINE_START_H * 60) * PX_PER_MIN
  const showNowLine   = timelineDay === todayWeekDay && nowPx >= 0 && nowPx <= TIMELINE_HEIGHT

  // ── Handlers

  const handleEmptySlotClick = (wday: WeekDay, timeStr: string, room: RoomFilter = 'A') => {
    if (!isAdmin) return;
    
    let endTime = '';
    if (timeStr) {
      const [h, m] = timeStr.split(':').map(Number);
      const endH = Math.min(23, h + 1).toString().padStart(2, '0');
      const endM = m.toString().padStart(2, '0');
      endTime = `${endH}:${endM}`;
    }

    reset({
      room: room === 'all' ? 'A' : room,
      days: [wday],
      recurrente: true,
      startTime: timeStr,
      endTime: endTime,
      capacity: '',
      profesorId: '',
      clientIds: []
    });
    setClientSearch('');
    setCreateOpen(true);
  }

  async function onCreate(data: FormValues) {
    setIsSubmitting(true)
    try {
      const turno = await shiftsApi.create({
        room: data.room, days: data.days, recurrente: data.recurrente,
        startTime: data.startTime, endTime: data.endTime, capacity: Number(data.capacity),
        profesorId: data.profesorId,
      })

      if (data.clientIds.length > 0) {
        // Promise.allSettled para que inscripciones individuales que fallen no cancelen el turno creado
        await Promise.allSettled(
          data.clientIds.map(clientId => inscripcionesApi.enroll(clientId, String(turno.id)))
        )
      }

      addToast('Turno creado exitosamente', 'success')
      setCreateOpen(false)
      reset({ room: 'A', days: [], recurrente: true, startTime: '', endTime: '', capacity: '', profesorId: '', clientIds: [] })
      refetch()
    } catch {
      addToast('Error al crear el turno', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function deleteShift(id: number) {
    if (!confirm('¿Eliminar este turno?')) return
    setIsDeleting(id)
    try {
      await shiftsApi.remove(id)
      addToast('Turno eliminado', 'success')
      refetch()
    } catch {
      addToast('Error al eliminar', 'error')
    } finally {
      setIsDeleting(null)
    }
  }

  // Cuando se abre un turno diferente: pre-rellenar el form de edición y limpiar estados auxiliares
  useEffect(() => {
    if (!detailShift) return
    editReset({
      room:       detailShift.room,
      days:       detailShift.days,
      recurrente: detailShift.recurrente,
      startTime:  detailShift.startTime,
      endTime:    detailShift.endTime,
      capacity:   String(detailShift.capacity),
      profesorId: detailShift.profesorId,
    })
    setDetailTab('edit')
    setEsperaTipoTab('INTERNA')
    setAddClientMode(false); setAddClientSearch(''); setAddClientId('')
    setAddEsperaMode(false); setAddEsperaClientSearch(''); setAddEsperaClientId('')
    setInscripciones([])
  }, [detailShift?.id])

  // Cargar inscripciones cuando se abre la pestaña correspondiente
  useEffect(() => {
    if (detailTab !== 'inscripciones' || !detailShift) return
    setLoadingInscrip(true)
    inscripcionesApi.getByTurno(String(detailShift.id))
      .then(setInscripciones)
      .catch(() => addToast('Error al cargar inscripciones', 'error'))
      .finally(() => setLoadingInscrip(false))
  }, [detailTab, detailShift?.id])

  async function handleEsperaAction(id: string, action: 'notificar' | 'aceptar' | 'rechazar' | 'eliminar') {
    setActionLoadingIds(prev => new Set([...prev, id]))
    try {
      if (action === 'eliminar') {
        await listaEsperaApi.remove(id)
        addToast('Entrada eliminada', 'success')
      } else {
        const estadoMap: Record<'notificar' | 'aceptar' | 'rechazar', EstadoEspera> = {
          notificar: 'NOTIFICADO',
          aceptar:   'ACEPTADO',
          rechazar:  'RECHAZADO',
        }
        await listaEsperaApi.updateEstado(id, estadoMap[action])
        addToast('Estado actualizado', 'success')
      }
      refetchEspera()
    } catch {
      addToast('Error al procesar la acción', 'error')
    } finally {
      setActionLoadingIds(prev => { const s = new Set(prev); s.delete(id); return s })
    }
  }

  // ── Edit submit
  async function onEditSubmit(data: EditFormValues) {
    if (!detailShift) return
    setEditSubmitting(true)
    try {
      await shiftsApi.update(detailShift.id, {
        room: data.room, days: data.days, recurrente: data.recurrente,
        startTime: data.startTime, endTime: data.endTime,
        capacity: Number(data.capacity), profesorId: data.profesorId,
      })
      addToast('Turno actualizado exitosamente', 'success')
      refetch()
      // Sincronizar el detailShift local para que otros tabs reflejen los cambios
      setDetailShift(prev => prev ? {
        ...prev, room: data.room, days: data.days, recurrente: data.recurrente,
        startTime: data.startTime, endTime: data.endTime, capacity: Number(data.capacity),
      } : null)
    } catch {
      addToast('Error al actualizar el turno', 'error')
    } finally {
      setEditSubmitting(false)
    }
  }

  // ── Dar de baja un inscripto
  async function handleDarDeBaja(inscripcionId: string) {
    setBajandoId(inscripcionId)
    try {
      await inscripcionesApi.darDeBaja(inscripcionId)
      addToast('Cliente dado de baja correctamente', 'success')
      if (detailShift) {
        inscripcionesApi.getByTurno(String(detailShift.id)).then(setInscripciones).catch(() => {})
      }
      refetch()
    } catch {
      addToast('Error al dar de baja', 'error')
    } finally {
      setBajandoId(null)
    }
  }

  // ── Inscribir cliente desde el panel de gestión
  async function handleAddToShift() {
    if (!detailShift || !addClientId) return
    setAddClientSubmitting(true)
    try {
      const res = await inscripcionesApi.enroll(addClientId, String(detailShift.id))
      if (res.enListaEspera) {
        addToast('Turno lleno — cliente agregado a lista de espera', 'success')
      } else {
        addToast('Cliente inscripto correctamente', 'success')
      }
      setAddClientMode(false); setAddClientSearch(''); setAddClientId('')
      if (detailShift) {
        inscripcionesApi.getByTurno(String(detailShift.id)).then(setInscripciones).catch(() => {})
      }
      refetch()
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Error al inscribir al cliente'
      addToast(msg, 'error')
    } finally {
      setAddClientSubmitting(false)
    }
  }

  // ── Agregar a lista de espera manualmente
  async function handleAddToWaitingList() {
    if (!detailShift || !addEsperaClientId) return
    setAddEsperaSubmitting(true)
    try {
      await listaEsperaApi.create(addEsperaClientId, String(detailShift.id), addEsperaTipo)
      addToast('Cliente agregado a la lista de espera', 'success')
      setAddEsperaMode(false); setAddEsperaClientSearch(''); setAddEsperaClientId('')
      refetchEspera()
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Error al agregar a lista de espera'
      addToast(msg, 'error')
    } finally {
      setAddEsperaSubmitting(false)
    }
  }

  const VIEW_MODES = [
    { mode: 'calendar' as const, icon: CalendarDays, label: 'Calendario' },
    { mode: 'grid'     as const, icon: LayoutGrid,  label: 'Grilla'     },
    { mode: 'timeline' as const, icon: Clock,        label: 'Timeline'   },
  ]

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <motion.div {...pageVariants} className="space-y-6">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl md:text-4xl font-black tracking-tighter text-gray-900 dark:text-white drop-shadow-sm">
          Turnos
        </h1>

        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center rounded-2xl border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-xl shadow-sm overflow-hidden">
            {VIEW_MODES.map(({ mode, icon: Icon, label }) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                title={label}
                className={`flex h-11 w-11 items-center justify-center transition-all ${
                  viewMode === mode
                    ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-black/50'
                }`}
              >
                <Icon size={16} />
              </button>
            ))}
          </div>

          <button
            onClick={refetch}
            className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-xl text-gray-600 dark:text-gray-300 transition-all hover:scale-105 hover:bg-white/50 dark:hover:bg-black/50 shadow-sm"
          >
            <RefreshCw size={16} />
          </button>
          {/* Acciones principales */}
          {isAdmin && (
            <button
              onClick={() => {
                reset({ room: 'A', days: [], recurrente: true, startTime: '', endTime: '', capacity: '', profesorId: '', clientIds: [] })
                setClientSearch('')
                setCreateOpen(true)
              }}
              className="flex items-center gap-2 rounded-xl btn-action px-4 py-2.5 text-sm"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-gray-900/10">
                <Plus size={13} strokeWidth={2.5} />
              </span>
              Nuevo turno
            </button>
          )}
        </div>
      </div>

      {/* ── Grid filters ────────────────────────────────────────────────────── */}
      {viewMode === 'grid' && (
        <div className="rounded-[2rem] border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-3xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)] px-6 py-4 flex flex-col sm:flex-row gap-4 sm:items-center">
          {/* Sala */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-[#8A8A9A] w-8 shrink-0">Sala</span>
            <div className="flex gap-1.5">
              {(['all', 'A', 'B'] as const).map(r => (
                <button
                  key={r}
                  onClick={() => setRoomFilter(r)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
                    roomFilter === r
                      ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-sm'
                      : 'border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] text-gray-500 dark:text-[#8A8A9A] hover:border-gray-400 dark:hover:border-white/20 hover:text-gray-900 dark:hover:text-gray-100'
                  }`}
                >
                  {r === 'all' ? 'Todas' : `Sala ${r}`}
                </button>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="hidden sm:block w-px h-6 bg-gray-200 dark:bg-white/[0.08] shrink-0" />

          {/* Día */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-[#8A8A9A] w-8 shrink-0">Día</span>
            <div className="flex gap-1.5 flex-wrap">
              {(['all', ...DAYS] as DayFilter[]).map(d => (
                <button
                  key={d}
                  onClick={() => setDayFilter(d)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
                    dayFilter === d
                      ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-sm'
                      : 'border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] text-gray-500 dark:text-[#8A8A9A] hover:border-gray-400 dark:hover:border-white/20 hover:text-gray-900 dark:hover:text-gray-100'
                  }`}
                >
                  {d === 'all' ? 'Todos' : DAY_LABELS[d].slice(0, 3)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Calendar nav controls ────────────────────────────────────────────── */}
      {viewMode === 'calendar' && (
        <div className="flex items-center justify-between flex-wrap gap-3 relative z-40">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white capitalize">
              {calendarRange === '1day'
                ? format(weekStart, "EEEE d 'de' MMMM", { locale: es })
                : calendarRange === 'month'
                ? format(weekStart, 'MMMM yyyy', { locale: es })
                : calendarRange === '3days'
                  ? `${format(currentDates[0] || weekStart, 'd MMM', { locale: es })} - ${format(currentDates[currentDates.length-1] || weekStart, 'd MMM', { locale: es })}`
                  : `Semana ${format(weekStart, 'd', { locale: es })} ${format(weekStart, 'MMM', { locale: es })}`}
            </h2>
            
            {/* Filter Overlay Wrapper */}
            <div className="relative">
              <button
                onClick={() => setShowCalendarFilters(!showCalendarFilters)}
                className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 text-sm font-semibold transition-all shadow-sm ${
                  showCalendarFilters || (calendarRange === 'week' && (calendarViewMode === 'optimized' || calendarSelectedDays.length !== DAYS.length))
                    ? 'border-gray-900 bg-gray-900 text-white dark:border-white dark:bg-white dark:text-gray-900' 
                    : 'border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-xl text-gray-700 dark:text-gray-200 hover:bg-white/50 dark:hover:bg-black/50'
                }`}
              >
                <Settings2 size={16} /> 
                <span className="hidden sm:inline">Opciones</span>
              </button>
              
              <AnimatePresence>
                {showCalendarFilters && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute left-0 top-full mt-2 w-72 rounded-[1.5rem] border border-white/50 dark:border-white/10 bg-white/80 dark:bg-[#1a1a24]/80 backdrop-blur-3xl p-5 shadow-[0_20px_40px_rgba(0,0,0,0.1)] dark:shadow-[0_20px_40px_rgba(0,0,0,0.5)] z-50"
                  >
                    <div className="space-y-5">
                      {/* Rango Temporal */}
                      <div>
                        <label className="text-xs font-bold text-gray-500 dark:text-[#8A8A9A] uppercase tracking-wider mb-2 block">
                          Rango Temporal
                        </label>
                        <div className="flex bg-gray-100/50 dark:bg-black/20 p-1 rounded-xl">
                          {[
                            { id: '1day',  label: '1 Día'  },
                            { id: '3days', label: '3 Días' },
                            { id: 'week',  label: 'Semana' },
                            { id: 'month', label: 'Mes'    }
                          ].map(opt => (
                            <button
                              key={opt.id}
                              onClick={() => setCalendarRange(opt.id as any)}
                              className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition-all ${
                                calendarRange === opt.id
                                  ? 'bg-white dark:bg-[#2a2a36] text-gray-900 dark:text-white shadow-sm'
                                  : 'text-gray-500 dark:text-[#8A8A9A] hover:text-gray-700 dark:hover:text-gray-300'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Selector de Días */}
                      {calendarRange === 'week' && (
                        <div>
                          <label className="text-xs font-bold text-gray-500 dark:text-[#8A8A9A] uppercase tracking-wider mb-2 block">
                            Días Visibles
                          </label>
                          <div className="flex flex-wrap gap-1.5">
                            {DAYS.map(d => {
                              const isActive = calendarSelectedDays.includes(d)
                              return (
                                <button
                                  key={d}
                                  onClick={() => setCalendarSelectedDays(prev => 
                                    prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]
                                  )}
                                  className={`rounded-full px-3 py-1 text-xs font-semibold transition-all ${
                                    isActive
                                      ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                                      : 'border border-gray-200 dark:border-white/[0.08] bg-white/50 dark:bg-white/[0.04] text-gray-500 dark:text-[#8A8A9A]'
                                  }`}
                                >
                                  {DAY_LABELS[d].slice(0,3)}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {/* Lógica de Visualización */}
                      {calendarRange !== 'month' && (
                        <div>
                          <label className="text-xs font-bold text-gray-500 dark:text-[#8A8A9A] uppercase tracking-wider mb-2 block">
                            Modo de Grilla
                          </label>
                          <div className="flex bg-gray-100/50 dark:bg-black/20 p-1 rounded-xl">
                            <button
                              onClick={() => setCalendarViewMode('extended')}
                              className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition-all ${
                                calendarViewMode === 'extended'
                                  ? 'bg-white dark:bg-[#2a2a36] text-gray-900 dark:text-white shadow-sm'
                                  : 'text-gray-500 dark:text-[#8A8A9A] hover:text-gray-700 dark:hover:text-gray-300'
                              }`}
                            >
                              Extendida
                            </button>
                            <button
                              onClick={() => setCalendarViewMode('optimized')}
                              className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition-all ${
                                calendarViewMode === 'optimized'
                                  ? 'bg-white dark:bg-[#2a2a36] text-gray-900 dark:text-white shadow-sm'
                                  : 'text-gray-500 dark:text-[#8A8A9A] hover:text-gray-700 dark:hover:text-gray-300'
                              }`}
                            >
                              Optimizada
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-3 text-xs text-[#8A8A9A] mr-2">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-400" />Disponible</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-yellow-400" />Casi lleno</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-400" />Lleno</span>
            </div>
            <button
              onClick={handlePrev}
              disabled={!canGoPrev}
              className={`flex h-10 w-10 items-center justify-center rounded-xl border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-xl text-gray-600 dark:text-gray-300 transition-all hover:bg-white/50 dark:hover:bg-black/50 shadow-sm ${canGoPrev ? 'hover:scale-105' : 'opacity-30 cursor-not-allowed'}`}
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => {
                const d = new Date(); d.setHours(0, 0, 0, 0);
                if (calendarRange === '1day') setWeekStart(d)
                else if (calendarRange === 'month') setWeekStart(startOfMonth(d))
                else if (calendarRange === '3days') setWeekStart(d)
                else setWeekStart(startOfWeek(d, { weekStartsOn: 1 }))
              }}
              className="rounded-xl border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-xl px-4 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300 transition-all hover:bg-white/50 dark:hover:bg-black/50 shadow-sm"
            >
              Hoy
            </button>
            <button
              onClick={handleNext}
              disabled={!canGoNext}
              className={`flex h-10 w-10 items-center justify-center rounded-xl border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-xl text-gray-600 dark:text-gray-300 transition-all hover:bg-white/50 dark:hover:bg-black/50 shadow-sm ${canGoNext ? 'hover:scale-105' : 'opacity-30 cursor-not-allowed'}`}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3">
          <span className="text-sm text-red-400">{error}</span>
          <button onClick={refetch} className="ml-auto text-xs text-red-400 underline">Reintentar</button>
        </div>
      )}

      {/* ── Animated view content ─────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={viewMode}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
        >

          {/* ════════════════ GRID VIEW ════════════════ */}
          {viewMode === 'grid' && (
            isLoading ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-40 rounded-2xl" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-20 text-[#8A8A9A]">
                <Dumbbell size={32} />
                <p className="text-sm">No hay turnos para los filtros seleccionados</p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map(shift => {
                  const pct    = Math.min((shift.enrolled / shift.capacity) * 100, 100)
                  const isFull = shift.enrolled >= shift.capacity
                  return (
                    <div
                      key={shift.id}
                      onClick={() => navigate(`/shifts/${shift.id}`)}
                      className="group relative cursor-pointer overflow-hidden rounded-[2rem] border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-3xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)] transition-all duration-500 hover:-translate-y-1 hover:bg-white/50 dark:hover:bg-black/50 hover:shadow-[0_20px_40px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_20px_40px_rgba(0,0,0,0.4)]"
                    >
                      <div className="absolute top-4 right-4 flex items-center gap-1.5">
                        <span className={`h-2 w-2 rounded-full ${shift.room === 'A' ? 'bg-blue-400' : 'bg-purple-400'}`} />
                        <span className="text-xs text-[#8A8A9A]">Sala {shift.room}</span>
                      </div>
                      <h3 className="pr-16 font-semibold text-gray-900 dark:text-white">{shift.name}</h3>
                      <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                        {shift.days.map(d => DAY_LABELS[d].slice(0, 3)).join(' · ')}
                        {!shift.recurrente && <span className="ml-1 text-amber-500"> · puntual</span>}
                      </p>
                      <div className="mt-3 flex items-center gap-1 text-sm text-[#8A8A9A]">
                        <Clock size={13} />
                        <span>{shift.startTime} – {shift.endTime}</span>
                      </div>
                      <div className="mt-4 space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1 text-[#8A8A9A]">
                            <Users size={12} />{shift.enrolled}/{shift.capacity}
                          </span>
                          <span className={isFull ? 'text-red-400' : 'text-green-400'}>
                            {isFull ? 'Lleno' : `${shift.capacity - shift.enrolled} libre${shift.capacity - shift.enrolled !== 1 ? 's' : ''}`}
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${getOccupancyColor(shift.enrolled, shift.capacity)}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                      {isAdmin && (
                        <div className="absolute bottom-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={e => { e.stopPropagation(); deleteShift(shift.id) }}
                            className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20"
                          >
                            {isDeleting === shift.id ? '…' : <Trash2 size={12} />}
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          )}

          {/* ════════════════ CALENDAR VIEW ════════════════ */}
          {viewMode === 'calendar' && (
            <div className="rounded-[2rem] border border-gray-200 dark:border-white/[0.06] bg-white/30 dark:bg-black/30 backdrop-blur-3xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)] overflow-hidden flex flex-col">
              
              {isLoading ? (
                <div className="p-8 space-y-4">
                  {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl w-full" />)}
                </div>
              ) : calendarRange === 'month' ? (
                /* ── Month Grid View ── */
                <div className="overflow-x-auto">
                <div className="flex flex-col flex-1 min-h-[600px] min-w-[560px] bg-white/20 dark:bg-black/20">
                  <div className="grid grid-cols-7 border-b border-gray-200 dark:border-white/[0.06] bg-white/50 dark:bg-black/20 sticky top-0 z-20">
                    {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map(d => (
                      <div key={d} className="py-3 text-center border-r last:border-r-0 border-gray-200 dark:border-white/[0.06]">
                        <span className="text-xs font-bold text-gray-500 dark:text-[#8A8A9A] uppercase">{d.slice(0,3)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 flex-1 auto-rows-fr">
                    {monthGridDays.map((date, i) => {
                      const wday = JS_TO_WEEKDAY[date.getDay()];
                      const dayShifts = wday ? shiftsByDay[wday] ?? [] : [];
                      const isCurrentMonth = date.getMonth() === weekStart.getMonth();
                      const isToday = isSameDay(date, new Date());
                      
                      return (
                        <div 
                          key={i} 
                          onClick={() => {
                            if (wday && isAdmin) handleEmptySlotClick(wday, '08:00');
                          }}
                          className={`border-b border-r border-gray-200 dark:border-white/[0.06] p-1.5 sm:p-2 flex flex-col min-h-[120px] transition-colors ${isAdmin ? 'cursor-pointer hover:bg-black/5 dark:hover:bg-white/5' : ''}
                            ${!isCurrentMonth ? 'bg-gray-50/50 dark:bg-black/40 opacity-60' : 'bg-transparent'}
                            ${isToday ? 'bg-primary/[0.03]' : ''}
                          `}
                        >
                          <div className="flex justify-end mb-1 sm:mb-2 pointer-events-none">
                            <span className={`flex items-center justify-center h-6 w-6 text-xs font-bold rounded-full ${isToday ? 'bg-primary text-white' : 'text-gray-600 dark:text-[#8A8A9A]'}`}>
                              {date.getDate()}
                            </span>
                          </div>
                          {/* Lista compacta — sin overflow, con fade si hay más de MAX_MONTH_SHIFTS */}
                          <div
                            className="flex-1 overflow-hidden min-h-0"
                            style={dayShifts.length > MAX_MONTH_SHIFTS ? {
                              maskImage:         'linear-gradient(to bottom, black 60%, transparent 100%)',
                              WebkitMaskImage:   'linear-gradient(to bottom, black 60%, transparent 100%)',
                            } : undefined}
                          >
                            <div className="space-y-px">
                              {dayShifts.slice(0, MAX_MONTH_SHIFTS).map(shift => (
                                <button
                                  key={shift.id}
                                  onClick={(e) => { e.stopPropagation(); navigate(`/shifts/${shift.id}`); }}
                                  className="w-full flex items-center gap-1.5 px-1 py-[3px] rounded text-left transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                                >
                                  <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${shift.room === 'A' ? 'bg-blue-400' : 'bg-purple-400'}`} />
                                  <span className="text-[9px] font-bold text-gray-500 dark:text-[#8A8A9A] flex-shrink-0 tabular-nums leading-none">{shift.startTime}</span>
                                  <span className="text-[9px] font-medium text-gray-700 dark:text-gray-200 truncate flex-1 leading-none">{shift.name}</span>
                                  <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${getOccupancyDot(shift.enrolled, shift.capacity)}`} />
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
                </div>
              ) : visibleDates.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-[#8A8A9A]">
                  <Dumbbell size={32} className="mb-4 opacity-50" />
                  <p className="text-sm font-medium">No hay días seleccionados para visualizar</p>
                </div>
              ) : (
                <div className="flex flex-1 overflow-hidden">
                  {/* Y-axis Left Column */}
                  <div className="w-16 flex-shrink-0 border-r border-gray-200 dark:border-white/[0.06] bg-white/50 dark:bg-black/20 z-10">
                    <div className="h-14 border-b border-gray-200 dark:border-white/[0.06]" /> {/* Header spacer */}
                    <div className="relative" style={{ height: totalHeight }}>
                      {HOURS.map((hStr) => {
                        const h = parseInt(hStr.split(':')[0], 10)
                        if (calendarViewMode === 'optimized' && !activeHourInts.has(h)) return null;
                        const top = offsets[hStr];
                        return (
                          <div key={hStr} className="absolute w-full flex justify-center pr-2" style={{ top }}>
                            <span className="text-[10px] font-medium text-gray-500 dark:text-[#8A8A9A] -mt-2.5 bg-white/50 dark:bg-black/50 px-1 rounded backdrop-blur-md">{hStr}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                  
                  {/* X-axis Days & Grid */}
                  <div className="flex-1 overflow-x-auto relative flex flex-col custom-scrollbar">
                    {/* Day Headers */}
                    <div className="flex border-b border-gray-200 dark:border-white/[0.06] sticky top-0 bg-white/80 dark:bg-[#1a1a24]/80 backdrop-blur-xl z-20">
                      {visibleDates.map((date, i) => {
                        const isToday = isSameDay(date, new Date())
                        return (
                          <div key={i} className={`flex-1 min-w-[140px] p-3 text-center border-r last:border-r-0 border-gray-200 dark:border-white/[0.06] ${isToday ? 'bg-primary/5' : ''}`}>
                            <p className={`text-xs font-bold capitalize ${isToday ? 'text-primary' : 'text-gray-500 dark:text-[#8A8A9A]'}`}>
                              {format(date, 'EEEE d', { locale: es })}
                            </p>
                          </div>
                        )
                      })}
                    </div>
                    
                    {/* Grid Content */}
                    <div className="flex relative bg-white/20 dark:bg-black/20" style={{ height: totalHeight, minHeight: '400px' }}>
                      {/* Horizontal grid lines */}
                      {HOURS.map((hStr) => {
                        const h = parseInt(hStr.split(':')[0], 10)
                        if (calendarViewMode === 'optimized' && !activeHourInts.has(h)) return null;
                        const top = offsets[hStr];
                        return (
                          <div key={hStr} className="absolute w-full border-t border-gray-200 dark:border-white/[0.04]" style={{ top }} />
                        )
                      })}

                      {/* Day Columns */}
                      {visibleDates.map((date, i) => {
                        const wday = JS_TO_WEEKDAY[date.getDay()]
                        const dayShifts = wday ? shiftsByDay[wday] ?? [] : []
                        const isToday = isSameDay(date, new Date())
                        
                        return (
                          <div key={i} className={`flex-1 min-w-[140px] relative border-r last:border-r-0 border-gray-200 dark:border-white/[0.06] ${isToday ? 'bg-primary/[0.02]' : ''}`}>
                            {/* Empty clickable slots */}
                            {isAdmin && wday && HOURS.map((hStr) => {
                              const h = parseInt(hStr.split(':')[0], 10);
                              if (calendarViewMode === 'optimized' && !activeHourInts.has(h)) return null;
                              const top = offsets[hStr];
                              return (
                                <div
                                  key={hStr}
                                  onClick={() => handleEmptySlotClick(wday, hStr)}
                                  className="absolute w-full cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors z-0"
                                  style={{ top, height: 60 * PX_PER_MIN }}
                                />
                              )
                            })}

                            {(wday ? layoutsByDay[wday] : []).map(({ shift, colIndex, numCols }) => {
                              const marginY      = 6
                              const top    = getTimeY(shift.startTime) + marginY
                              const bottom = getTimeY(shift.endTime) - marginY
                              const height = Math.max(42, bottom - top)
                              const isFull = shift.enrolled >= shift.capacity

                              const marginX      = 8
                              const gutter       = 4
                              const leftPercent  = (colIndex / numCols) * 100
                              const leftPx       = marginX + colIndex * ((-marginX * 2 + gutter) / numCols)
                              const widthPercent = (1 / numCols) * 100
                              const widthPx      = ((-marginX * 2 + gutter) / numCols) - gutter

                              return (
                                <button
                                  key={shift.id}
                                  onClick={(e) => { e.stopPropagation(); navigate(`/shifts/${shift.id}`); }}
                                  style={{
                                    top,
                                    height,
                                    left:  `calc(${leftPercent}% + ${leftPx}px)`,
                                    width: `calc(${widthPercent}% + ${widthPx}px)`,
                                  }}
                                  className={`absolute rounded-xl border p-2 text-left overflow-hidden transition-all hover:z-10 hover:shadow-md ${getOccupancyStyle(shift.enrolled, shift.capacity)}`}
                                >
                                  <div className="flex items-start justify-between gap-1 mb-1">
                                    <p className="text-[11px] font-bold text-gray-900 dark:text-white leading-tight truncate">
                                      {shift.name}
                                    </p>
                                    <span className={`flex-shrink-0 h-1.5 w-1.5 mt-1 rounded-full ${shift.room === 'A' ? 'bg-blue-400' : 'bg-purple-400'}`} />
                                  </div>
                                  <div className="flex items-center gap-1 text-[10px] text-gray-600 dark:text-[#8A8A9A] mb-0.5">
                                    <Clock size={10} /><span>{shift.startTime} – {shift.endTime}</span>
                                  </div>
                                  <div className="flex items-center justify-between text-[10px]">
                                    <span className="flex items-center gap-1 text-gray-600 dark:text-[#8A8A9A]">
                                      <Users size={10} /> {shift.enrolled}/{shift.capacity}
                                    </span>
                                    <span className={`font-semibold ${isFull ? 'text-red-500 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                                      {isFull ? 'Lleno' : 'Libre'}
                                    </span>
                                  </div>
                                </button>
                              )
                            })}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Mobile legend */}
              <div className="sm:hidden flex items-center justify-center gap-4 py-3 border-t border-gray-200 dark:border-white/[0.06] text-xs text-gray-500 dark:text-[#8A8A9A] bg-white/50 dark:bg-black/30">
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-400" />Disponible</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-yellow-400" />Casi lleno</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-400" />Lleno</span>
              </div>
            </div>
          )}

          {/* ════════════════ TIMELINE VIEW ════════════════ */}
          {viewMode === 'timeline' && (
            <div className="space-y-4">
              {/* Day selector pills */}
              <div className="flex flex-wrap gap-2">
                {DAYS.map(d => (
                  <button
                    key={d}
                    onClick={() => setTimelineDay(d)}
                    className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
                      timelineDay === d
                        ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                        : 'border border-white/[0.08] bg-white/[0.04] text-[#8A8A9A] hover:text-white'
                    }`}
                  >
                    {DAY_LABELS[d]}
                  </button>
                ))}
              </div>

              {isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
                </div>
              ) : timelineShifts.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-16 text-[#8A8A9A]">
                  <Clock size={32} />
                  <p className="text-sm">No hay turnos para {DAY_LABELS[timelineDay]}</p>
                </div>
              ) : (
                <div
                  className="rounded-[2rem] border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-3xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)] overflow-hidden"
                >
                  {/* Room header */}
                  <div className="grid border-b border-white/[0.08]" style={{ gridTemplateColumns: '56px 1fr 1fr' }}>
                    <div className="py-3 border-r border-white/[0.06]" />
                    <div className="py-3 px-4 text-center border-r border-white/[0.06]">
                      <span className="text-xs font-bold text-[#8A8A9A] uppercase tracking-wider flex items-center justify-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-blue-400" />Sala A
                      </span>
                    </div>
                    <div className="py-3 px-4 text-center">
                      <span className="text-xs font-bold text-[#8A8A9A] uppercase tracking-wider flex items-center justify-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-purple-400" />Sala B
                      </span>
                    </div>
                  </div>

                  {/* Main grid */}
                  <div
                    className="grid relative overflow-hidden"
                    style={{ gridTemplateColumns: '56px 1fr 1fr', height: TIMELINE_HEIGHT }}
                  >
                    {/* Time axis */}
                    <div className="border-r border-white/[0.06] relative">
                      {HOURS.map((h, i) => (
                        <div
                          key={h}
                          className="absolute right-0 left-0 flex items-start justify-end pr-2"
                          style={{ top: i * 60 * PX_PER_MIN }}
                        >
                          <span className="text-[10px] text-[#8A8A9A]/50 mt-0.5">{h}</span>
                        </div>
                      ))}
                    </div>

                    {/* Sala A */}
                    <div className="border-r border-white/[0.06] relative">
                      {HOURS.map((h, i) => (
                        <div
                          key={h}
                          onClick={() => handleEmptySlotClick(timelineDay, h, 'A')}
                          className={`absolute left-0 right-0 border-t border-white/[0.04] ${isAdmin ? 'cursor-pointer hover:bg-black/5 dark:hover:bg-white/5' : ''}`}
                          style={{ top: i * 60 * PX_PER_MIN, height: 60 * PX_PER_MIN }}
                        />
                      ))}
                      {timelineShifts.filter(s => s.room === 'A').map(shift => {
                        const marginY = 6
                        const top    = (timeToMinutes(shift.startTime) - TIMELINE_START_H * 60) * PX_PER_MIN + marginY
                        const height = Math.max(32, (timeToMinutes(shift.endTime) - timeToMinutes(shift.startTime)) * PX_PER_MIN - marginY * 2)
                        const pct    = Math.min((shift.enrolled / shift.capacity) * 100, 100)
                        return (
                          <button
                            key={shift.id}
                            onClick={(e) => { e.stopPropagation(); navigate(`/shifts/${shift.id}`); }}
                            className={`absolute inset-x-2 rounded-lg border px-2 py-1 text-left overflow-hidden transition-all hover:brightness-110 z-10 ${getOccupancyStyle(shift.enrolled, shift.capacity)}`}
                            style={{ top, height }}
                          >
                            <p className="text-[11px] font-semibold text-white truncate leading-tight">{shift.name}</p>
                            <p className="text-[10px] text-[#8A8A9A] leading-tight">{shift.startTime}–{shift.endTime}</p>
                            <p className="text-[10px] text-[#8A8A9A] leading-tight">{shift.enrolled}/{shift.capacity}</p>
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/10 overflow-hidden">
                              <div className={`h-full ${getOccupancyColor(shift.enrolled, shift.capacity)}`} style={{ width: `${pct}%` }} />
                            </div>
                          </button>
                        )
                      })}
                    </div>

                    {/* Sala B */}
                    <div className="relative">
                      {HOURS.map((h, i) => (
                        <div
                          key={h}
                          onClick={() => handleEmptySlotClick(timelineDay, h, 'B')}
                          className={`absolute left-0 right-0 border-t border-white/[0.04] ${isAdmin ? 'cursor-pointer hover:bg-black/5 dark:hover:bg-white/5' : ''}`}
                          style={{ top: i * 60 * PX_PER_MIN, height: 60 * PX_PER_MIN }}
                        />
                      ))}
                      {timelineShifts.filter(s => s.room === 'B').map(shift => {
                        const marginY = 6
                        const top    = (timeToMinutes(shift.startTime) - TIMELINE_START_H * 60) * PX_PER_MIN + marginY
                        const height = Math.max(32, (timeToMinutes(shift.endTime) - timeToMinutes(shift.startTime)) * PX_PER_MIN - marginY * 2)
                        const pct    = Math.min((shift.enrolled / shift.capacity) * 100, 100)
                        return (
                          <button
                            key={shift.id}
                            onClick={(e) => { e.stopPropagation(); navigate(`/shifts/${shift.id}`); }}
                            className={`absolute inset-x-2 rounded-lg border px-2 py-1 text-left overflow-hidden transition-all hover:brightness-110 z-10 ${getOccupancyStyle(shift.enrolled, shift.capacity)}`}
                            style={{ top, height }}
                          >
                            <p className="text-[11px] font-semibold text-white truncate leading-tight">{shift.name}</p>
                            <p className="text-[10px] text-[#8A8A9A] leading-tight">{shift.startTime}–{shift.endTime}</p>
                            <p className="text-[10px] text-[#8A8A9A] leading-tight">{shift.enrolled}/{shift.capacity}</p>
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/10 overflow-hidden">
                              <div className={`h-full ${getOccupancyColor(shift.enrolled, shift.capacity)}`} style={{ width: `${pct}%` }} />
                            </div>
                          </button>
                        )
                      })}
                    </div>

                    {/* Now line */}
                    {showNowLine && (
                      <div
                        className="absolute z-20 pointer-events-none"
                        style={{ top: nowPx, left: 56, right: 0 }}
                      >
                        <div className="relative border-t-2 border-red-500">
                          <div className="absolute -left-1.5 -top-[5px] h-2.5 w-2.5 rounded-full bg-red-500" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

        </motion.div>
      </AnimatePresence>

      {/* ── Management Panel Modal (migrado a ShiftDetailPage) ─────────────── */}
      {false && (
          <div className="space-y-4">

            {/* ── 3 Tabs ── */}
            <div className="flex gap-1 rounded-xl bg-black/5 dark:bg-white/5 p-1">
              {([
                { id: 'edit'          as const, label: 'Editar',         icon: Pencil   },
                { id: 'inscripciones' as const, label: 'Inscripciones',  icon: Users    },
                { id: 'espera'        as const, label: 'Lista de espera', icon: ListPlus },
              ] as const).map(({ id, label, icon: Icon }) => {
                const badge = id === 'inscripciones' ? detailShift.enrolled
                            : id === 'espera'        ? esperaEntries.filter(e => e.estado === 'PENDIENTE').length
                            : 0
                return (
                  <button
                    key={id}
                    onClick={() => setDetailTab(id)}
                    className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all ${
                      detailTab === id
                        ? 'bg-white dark:bg-[#2a2a36] text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-500 dark:text-[#8A8A9A] hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                  >
                    <Icon size={12} />
                    {label}
                    {badge > 0 && (
                      <span className="flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-primary text-[9px] font-bold text-white px-1">
                        {badge}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            {/* ════════════ TAB: EDITAR ════════════ */}
            {detailTab === 'edit' && (
              <form onSubmit={editHandleSubmit(onEditSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                  {/* Columna izquierda */}
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
                                else     editSetValue('days', [...editDays, d],              { shouldValidate: true })
                              }}
                              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
                                sel ? 'bg-primary text-white shadow-sm'
                                    : 'border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] text-gray-500 dark:text-[#8A8A9A] hover:border-gray-400 dark:hover:border-white/20'
                              }`}
                            >{DAY_LABELS[d].slice(0, 3)}</button>
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

                  {/* Columna derecha */}
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <Input label="Hora inicio *" type="time" error={editErrors.startTime?.message} {...editRegister('startTime')} />
                      <Input label="Hora fin *"    type="time" error={editErrors.endTime?.message}   {...editRegister('endTime')} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Input label="Cupo máximo *" type="number" placeholder="Ej. 15" error={editErrors.capacity?.message} {...editRegister('capacity')} />
                      <Select
                        label="Profesor *"
                        options={[
                          { value: '', label: profsLoading ? 'Cargando...' : professors.length === 0 ? 'Sin profesores' : 'Seleccionar...' },
                          ...professors.map(p => ({ value: p.id, label: p.name })),
                        ]}
                        error={editErrors.profesorId?.message}
                        {...editRegister('profesorId')}
                      />
                    </div>

                    {/* Ocupación actual (solo lectura) */}
                    <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] p-3">
                      <div className="flex justify-between text-xs mb-2">
                        <span className="text-[#8A8A9A]">Ocupación actual</span>
                        <span className="font-semibold text-gray-900 dark:text-white">{detailShift.enrolled}/{detailShift.capacity}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div className={`h-full rounded-full ${getOccupancyColor(detailShift.enrolled, detailShift.capacity)}`}
                          style={{ width: `${Math.min((detailShift.enrolled / detailShift.capacity) * 100, 100)}%` }} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2 border-t border-white/[0.08]">
                  {isAdmin && (
                    <button type="button" onClick={() => deleteShift(detailShift.id)}
                      className="flex items-center gap-1.5 rounded-xl bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-500/20 transition-all">
                      <Trash2 size={14} /> Eliminar turno
                    </button>
                  )}
                  <Button type="submit" isLoading={editSubmitting} className="px-6">
                    Guardar cambios
                  </Button>
                </div>
              </form>
            )}

            {/* ════════════ TAB: INSCRIPCIONES ════════════ */}
            {detailTab === 'inscripciones' && (() => {
              const enrolledIds = new Set(inscripciones.map(i => i.clienteId))
              const filteredForAdd = clients
                .filter(c => !enrolledIds.has(String(c.id)))
                .filter(c => !addClientSearch || `${c.name} ${c.lastName}`.toLowerCase().includes(addClientSearch.toLowerCase()))
                .slice(0, 8)
              return (
                <div className="space-y-3">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      {inscripciones.length === 0 ? 'Sin inscriptos activos' : `${inscripciones.length} inscripto${inscripciones.length !== 1 ? 's' : ''} activo${inscripciones.length !== 1 ? 's' : ''}`}
                    </p>
                    <button onClick={() => { setAddClientMode(m => !m); setAddClientSearch(''); setAddClientId('') }}
                      className="flex items-center gap-1.5 rounded-xl bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition-all">
                      <UserPlus size={13} /> Agregar cliente
                    </button>
                  </div>

                  {/* Panel agregar */}
                  <AnimatePresence>
                    {addClientMode && (
                      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                        className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-2">
                        <div className="relative">
                          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A8A9A]" />
                          <input
                            value={addClientSearch} onChange={e => { setAddClientSearch(e.target.value); setAddClientId('') }}
                            placeholder="Buscar cliente..."
                            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] pl-8 pr-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-[#8A8A9A] outline-none focus:border-primary/40"
                          />
                        </div>
                        <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar">
                          {filteredForAdd.length === 0 ? (
                            <p className="text-xs text-[#8A8A9A] text-center py-3">
                              {addClientSearch ? 'Sin resultados' : 'Todos los clientes ya están inscriptos'}
                            </p>
                          ) : filteredForAdd.map(c => (
                            <button key={c.id} type="button"
                              onClick={() => setAddClientId(String(c.id))}
                              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition-all ${
                                addClientId === String(c.id)
                                  ? 'bg-primary/10 border border-primary/30 text-primary'
                                  : 'hover:bg-black/5 dark:hover:bg-white/5 text-gray-900 dark:text-white'
                              }`}>
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

                  {/* Lista inscriptos */}
                  {loadingInscrip ? (
                    <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-12 rounded-xl bg-black/5 dark:bg-white/[0.04] animate-pulse" />)}</div>
                  ) : inscripciones.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-[#8A8A9A]">
                      <Users size={28} className="mb-2 opacity-50" />
                      <p className="text-sm">No hay clientes inscriptos en este turno</p>
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-72 overflow-y-auto custom-scrollbar pr-1">
                      {inscripciones.map(insc => (
                        <motion.div key={insc.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                          className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2.5">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{insc.clienteNombre}</p>
                            <p className="text-xs text-[#8A8A9A]">Desde {format(new Date(insc.fechaDesde), "d MMM yyyy", { locale: es })}</p>
                          </div>
                          <span className="rounded-full bg-green-500/10 px-2.5 py-0.5 text-xs font-semibold text-green-600 dark:text-green-400 border border-green-500/20">
                            Activo
                          </span>
                          <button disabled={bajandoId === insc.id} onClick={() => handleDarDeBaja(insc.id)}
                            className="flex items-center gap-1 rounded-lg bg-red-500/10 px-2.5 py-1.5 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-500/20 transition-all disabled:opacity-50">
                            {bajandoId === insc.id ? '...' : <><X size={11} /> Dar de baja</>}
                          </button>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })()}

            {/* ════════════ TAB: LISTA DE ESPERA ════════════ */}
            {detailTab === 'espera' && (
              <div className="space-y-3">

                {/* Agregar a lista de espera */}
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {esperaEntries.length === 0 ? 'Lista de espera vacía' : `${esperaEntries.length} entrada${esperaEntries.length !== 1 ? 's' : ''}`}
                  </p>
                  <button onClick={() => { setAddEsperaMode(m => !m); setAddEsperaClientSearch(''); setAddEsperaClientId('') }}
                    className="flex items-center gap-1.5 rounded-xl bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition-all">
                    <ListPlus size={13} /> Agregar a lista
                  </button>
                </div>

                <AnimatePresence>
                  {addEsperaMode && (() => {
                    const waitlistedIds = new Set(esperaEntries.filter(e => e.estado === 'PENDIENTE' || e.estado === 'NOTIFICADO').map(e => e.clienteId))
                    const filteredForEspera = clients
                      .filter(c => !waitlistedIds.has(String(c.id)))
                      .filter(c => !addEsperaClientSearch || `${c.name} ${c.lastName}`.toLowerCase().includes(addEsperaClientSearch.toLowerCase()))
                      .slice(0, 8)
                    return (
                      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                        className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-3">
                        <div className="relative">
                          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A8A9A]" />
                          <input
                            value={addEsperaClientSearch} onChange={e => { setAddEsperaClientSearch(e.target.value); setAddEsperaClientId('') }}
                            placeholder="Buscar cliente..."
                            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] pl-8 pr-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-[#8A8A9A] outline-none focus:border-primary/40"
                          />
                        </div>
                        <div className="space-y-1 max-h-36 overflow-y-auto custom-scrollbar">
                          {filteredForEspera.map(c => (
                            <button key={c.id} type="button"
                              onClick={() => setAddEsperaClientId(String(c.id))}
                              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition-all ${
                                addEsperaClientId === String(c.id)
                                  ? 'bg-primary/10 border border-primary/30 text-primary'
                                  : 'hover:bg-black/5 dark:hover:bg-white/5 text-gray-900 dark:text-white'
                              }`}>
                              {c.name} {c.lastName}
                            </button>
                          ))}
                          {filteredForEspera.length === 0 && (
                            <p className="text-xs text-[#8A8A9A] text-center py-2">
                              {addEsperaClientSearch ? 'Sin resultados' : 'No hay clientes disponibles'}
                            </p>
                          )}
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
                                  }`}>{t === 'INTERNA' ? 'Interna (con membresía)' : 'Externa (sin membresía)'}</button>
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
                            esperaTipoTab === tipo ? 'bg-white/20 dark:bg-black/20 text-white dark:text-gray-900' : 'bg-gray-200 dark:bg-white/10 text-gray-600 dark:text-gray-300'
                          }`}>{count}</span>
                        )}
                      </button>
                    )
                  })}
                </div>

                {esperaLoading ? (
                  <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-14 rounded-xl bg-black/5 dark:bg-white/[0.04] animate-pulse" />)}</div>
                ) : esperaError ? (
                  <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3"><p className="text-sm text-red-400">{esperaError}</p></div>
                ) : (() => {
                  const filtered = esperaEntries.filter(e => e.tipo === esperaTipoTab)
                  if (filtered.length === 0) return (
                    <div className="flex flex-col items-center justify-center py-10 text-[#8A8A9A]">
                      <Clock size={24} className="mb-2 opacity-50" />
                      <p className="text-sm">No hay entradas {esperaTipoTab === 'INTERNA' ? 'internas' : 'externas'}</p>
                    </div>
                  )
                  const badgeStyle: Record<string, string> = {
                    PENDIENTE: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20',
                    NOTIFICADO:'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20',
                    ACEPTADO:  'bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20',
                    RECHAZADO: 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20',
                  }
                  const badgeLabel: Record<string, string> = { PENDIENTE:'Pendiente', NOTIFICADO:'Notificado', ACEPTADO:'Aceptado', RECHAZADO:'Rechazado' }
                  return (
                    <div className="space-y-1.5 max-h-72 overflow-y-auto custom-scrollbar pr-1">
                      {filtered.map(entry => {
                        const isActioning = actionLoadingIds.has(entry.id)
                        return (
                          <motion.div key={entry.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                            className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2.5">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{entry.clienteNombre}</p>
                              <p className="text-xs text-[#8A8A9A]">{format(new Date(entry.fechaSolicitud), "d MMM yyyy", { locale: es })}</p>
                            </div>
                            <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${badgeStyle[entry.estado]}`}>{badgeLabel[entry.estado]}</span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {entry.estado === 'PENDIENTE' && (
                                <button disabled={isActioning} onClick={() => handleEsperaAction(entry.id, 'notificar')}
                                  className="flex items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition-all disabled:opacity-50">
                                  <Bell size={11} /> Notificar
                                </button>
                              )}
                              {entry.estado === 'NOTIFICADO' && (<>
                                <button disabled={isActioning} onClick={() => handleEsperaAction(entry.id, 'aceptar')}
                                  className="flex items-center gap-1 rounded-lg bg-green-500/10 px-2 py-1.5 text-xs font-semibold text-green-600 dark:text-green-400 hover:bg-green-500/20 transition-all disabled:opacity-50">
                                  <Check size={11} /> Aceptó
                                </button>
                                <button disabled={isActioning} onClick={() => handleEsperaAction(entry.id, 'rechazar')}
                                  className="flex items-center gap-1 rounded-lg bg-red-500/10 px-2 py-1.5 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-500/20 transition-all disabled:opacity-50">
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
      )}

      {/* ── Create Modal ──────────────────────────────────────────────────────── */}
      <Modal isOpen={createOpen} onClose={() => { setCreateOpen(false); reset() }} title="Crear Nuevo Turno" size="2xl">
        <form onSubmit={handleSubmit(onCreate)} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Izquierda: Datos del turno */}
            <div className="space-y-4">

              {/* Sala */}
              <Select
                label="Sala *"
                options={[
                  { value: '', label: 'Seleccionar...' },
                  { value: 'A', label: 'Sala A' },
                  { value: 'B', label: 'Sala B' }
                ]}
                error={errors.room?.message}
                {...register('room')}
              />

              {/* Días de la semana — pills multi-selección */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  Días de la semana *
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {DAYS.map(d => {
                    const selected = formDays.includes(d)
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => {
                          if (selected) setValue('days', formDays.filter(x => x !== d), { shouldValidate: true })
                          else setValue('days', [...formDays, d], { shouldValidate: true })
                        }}
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
                          selected
                            ? 'bg-primary text-white shadow-sm'
                            : 'border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] text-gray-500 dark:text-[#8A8A9A] hover:border-gray-400 dark:hover:border-white/20 hover:text-gray-900 dark:hover:text-white'
                        }`}
                      >
                        {DAY_LABELS[d].slice(0, 3)}
                      </button>
                    )
                  })}
                </div>
                {(errors.days as any)?.message && (
                  <p className="text-xs text-red-500 mt-1.5">{(errors.days as any).message}</p>
                )}
              </div>

              {/* Horario */}
              <div className="grid grid-cols-2 gap-4">
                <Input label="Hora inicio *" type="time" error={errors.startTime?.message} {...register('startTime')} />
                <Input label="Hora fin *"    type="time" error={errors.endTime?.message}   {...register('endTime')} />
              </div>

              {/* Cupo + Profesor */}
              <div className="grid grid-cols-2 gap-4">
                <Input label="Cupo máximo *" type="number" placeholder="Ej. 15" error={errors.capacity?.message} {...register('capacity')} />
                <Select
                  label="Profesor *"
                  options={[
                    {
                      value: '',
                      label: profsLoading
                        ? 'Cargando...'
                        : professors.length === 0
                          ? 'Sin profesores registrados'
                          : 'Seleccionar...',
                    },
                    ...professors.map(p => ({ value: p.id, label: p.name }))
                  ]}
                  error={errors.profesorId?.message}
                  {...register('profesorId')}
                />
              </div>

              {/* Toggle recurrencia */}
              <label className="flex items-center justify-between gap-4 p-3 rounded-xl border border-white/[0.08] bg-white/[0.04] cursor-pointer select-none">
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">Recurrente semanal</p>
                  <p className="text-[11px] text-gray-500 dark:text-[#8A8A9A] mt-0.5">Se repite todas las semanas en los días seleccionados</p>
                </div>
                <div className="relative flex-shrink-0">
                  <input type="checkbox" {...register('recurrente')} className="sr-only peer" />
                  <div className={`w-10 h-5 rounded-full transition-colors ${formRecurrente ? 'bg-primary' : 'bg-gray-200 dark:bg-white/10'}`} />
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${formRecurrente ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </div>
              </label>

              {professors.length === 0 && !profsLoading && (
                <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2">
                  No hay profesores registrados. Creá un usuario con rol Profesor primero.
                </p>
              )}
            </div>

            {/* Derecha: Inscribir Clientes */}
            <div className="flex flex-col bg-white/5 dark:bg-black/20 rounded-2xl p-4 border border-gray-200 dark:border-white/10 overflow-hidden">
              <div className="flex items-center justify-between mb-3 shrink-0">
                <label className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Users size={16} className="text-primary" /> Inscribir Clientes
                </label>
                <span className={`text-xs font-semibold px-2 py-1 rounded-lg ${formClientIds.length > formCapacity && formCapacity > 0 ? 'bg-red-500/20 text-red-500' : 'bg-black/5 dark:bg-white/10 text-gray-500 dark:text-gray-400'}`}>
                  {formClientIds.length} / {formCapacity || '?'}
                </span>
              </div>
              
              <div className="mb-3 shrink-0">
                <Input
                  placeholder="Buscar por nombre o apellido..."
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                />
              </div>

              <div className="flex-1 overflow-y-auto min-h-[200px] max-h-[300px] custom-scrollbar pr-2 space-y-1.5">
                {clients.length === 0 ? (
                  <p className="text-xs text-gray-500 text-center py-6">No hay clientes disponibles</p>
                ) : (() => {
                  const filteredClients = clients.filter(c => 
                    `${c.name} ${c.lastName}`.toLowerCase().includes(clientSearch.toLowerCase())
                  );
                  
                  if (filteredClients.length === 0) {
                    return <p className="text-xs text-gray-500 text-center py-6">No se encontraron clientes que coincidan con la búsqueda.</p>;
                  }

                  return filteredClients.map(c => {
                    const isSelected = formClientIds.includes(String(c.id));
                    const isFull = formClientIds.length >= formCapacity && !isSelected && formCapacity > 0;
                    return (
                      <label 
                        key={c.id} 
                        className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all cursor-pointer select-none ${
                          isSelected 
                            ? 'border-primary/50 bg-primary/5 dark:bg-primary/10' 
                            : isFull 
                              ? 'border-transparent opacity-40 cursor-not-allowed grayscale' 
                              : 'border-black/5 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5'
                        }`}
                      >
                        <input 
                          type="checkbox" 
                          disabled={isFull}
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) setValue('clientIds', [...formClientIds, String(c.id)], { shouldValidate: true })
                            else setValue('clientIds', formClientIds.filter(id => id !== String(c.id)), { shouldValidate: true })
                          }}
                          className="w-4 h-4 rounded text-primary focus:ring-primary/20 bg-white/10 border-black/20 dark:border-white/20"
                        />
                        <div className="flex flex-col flex-1">
                          <span className="text-sm font-medium text-gray-900 dark:text-white leading-tight">{c.name} {c.lastName}</span>
                          <span className="text-[10px] text-gray-500 dark:text-gray-400">{c.email}</span>
                        </div>
                        {isSelected && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setValue('clientIds', formClientIds.filter(id => id !== String(c.id)), { shouldValidate: true })
                            }}
                            className="ml-auto flex h-7 w-7 items-center justify-center rounded-full bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-sm"
                          >
                            <X size={14} strokeWidth={3} />
                          </button>
                        )}
                      </label>
                    )
                  })
                })()}
              </div>
              {errors.clientIds?.message && (
                <p className="mt-3 text-xs text-red-500 font-medium text-center">{errors.clientIds.message}</p>
              )}
            </div>
            
          </div>
          
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-white/10 mt-6">
            <Button type="submit" isLoading={isSubmitting} className="px-8 font-bold shadow-lg shadow-primary/20">Guardar y crear</Button>
          </div>
        </form>
      </Modal>


    </motion.div>
  )
}
