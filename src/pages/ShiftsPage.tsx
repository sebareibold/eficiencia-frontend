import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { pageVariants } from '../lib/motion'
import {
  Plus, Clock, Users, RefreshCw, Dumbbell, Trash2,
  LayoutGrid, CalendarDays, ChevronLeft, ChevronRight,
  Filter, Settings2, X, Bell, Check, Pencil, UserPlus, ListPlus, Search,
  CalendarX, AlertOctagon,
} from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { addWeeks, subWeeks, startOfWeek, endOfWeek, addDays, subDays, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, format, isSameDay, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { useShifts } from '../hooks/useShifts'
import { useClients } from '../hooks/useClients'
import { useListaEspera } from '../hooks/useListaEspera'
import { shiftsApi, professorsApi } from '../api/shifts.api'
import { diasEspecialesApi } from '../api/dias-especiales.api'
import type { DiaEspecial, TipoDiaEspecial } from '../types/dias-especiales.types'
import { listaEsperaApi } from '../api/listaEspera.api'
import { inscripcionesApi } from '../api/inscripciones.api'
import { useUiStore } from '../store/uiStore'
import { useAuthStore } from '../store/authStore'
import { usePermissions } from '../hooks/usePermissions'
import type { EstadoEspera, TipoEspera } from '../types/listaEspera.types'
import type { InscripcionEntry } from '../api/inscripciones.api'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import Skeleton from '../components/ui/Skeleton'
import EmptyState from '../components/ui/EmptyState'
import type { Shift, WeekDay } from '../types/shift.types'
import { ROUTES } from '../constants/routes'
import { QK } from '../lib/queryKeys'

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
const MAX_MONTH_SHIFTS  = 4
const HOURS = Array.from(
  { length: TIMELINE_END_H - TIMELINE_START_H + 1 },
  (_, i) => `${String(TIMELINE_START_H + i).padStart(2, '0')}:00`
)

// ─── Schema ───────────────────────────────────────────────────────────────────

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
  clientIds:       z.array(z.string()),
})
type FormValues = z.infer<typeof schema>

type DayFilter   = 'all' | WeekDay
type ShiftLayout = { shift: Shift; colIndex: number; numCols: number }

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Parsea una fecha ISO del backend como fecha local (evita desfase UTC)
function parseFechaLocal(fechaISO: string): Date {
  const parte = fechaISO.split('T')[0]
  const [y, m, d] = parte.split('-').map(Number)
  return new Date(y, m - 1, d)
}

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

function computeColumnLayout(shifts: Shift[]): ShiftLayout[] {
  if (!shifts.length) return []

  const sorted = [...shifts].sort(
    (a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
  )
  const n = sorted.length

  const parent = Array.from({ length: n }, (_, i) => i)
  function find(x: number): number {
    while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x] }
    return x
  }

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

  const clusters = new Map<number, number[]>()
  for (let i = 0; i < n; i++) {
    const root = find(i)
    if (!clusters.has(root)) clusters.set(root, [])
    clusters.get(root)!.push(i)
  }

  const result: ShiftLayout[] = new Array(n)

  clusters.forEach((indices) => {
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
  const { clients } = useClients()
  const addToast   = useUiStore(s => s.addToast)
  const user       = useAuthStore(s => s.user)
  const queryClient = useQueryClient()
  const { can } = usePermissions()
  const canCreate = can('shifts', 'create')
  const canUpdate = can('shifts', 'update')
  const canDelete = can('shifts', 'delete')
  const navigate = useNavigate()

  // ── View mode
  const [viewMode, setViewMode] = useState<'grid' | 'calendar' | 'timeline'>('calendar')

  // ── Grid state
  const [dayFilter, setDayFilter] = useState<DayFilter>('all')

  // ── Calendar state
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d
  })
  const [calendarRange, setCalendarRange] = useState<'1day' | '3days' | 'week' | 'month'>(() =>
    typeof window !== 'undefined' && window.innerWidth < 768 ? '1day' : 'week'
  )

  // En vista 1-día pasar la fecha exacta; en el resto, pasar hoy para incluir recuperandos del día
  const calendarFecha = viewMode === 'calendar' && calendarRange === '1day'
    ? format(weekStart, 'yyyy-MM-dd')
    : format(new Date(), 'yyyy-MM-dd')
  const { shifts, isLoading, error, refetch } = useShifts({ fecha: calendarFecha })
  const [calendarSelectedDays, setCalendarSelectedDays] = useState<WeekDay[]>(DAYS)
  const [calendarViewMode, setCalendarViewMode] = useState<'extended' | 'optimized'>('optimized')
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
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null)
  const [clientSearch, setClientSearch] = useState('')
  const [professors,   setProfessors]   = useState<{ id: string; name: string }[]>([])
  const [profsLoading, setProfsLoading] = useState(false)

  // ── Días especiales state
  const [diasEspeciales, setDiasEspeciales]             = useState<DiaEspecial[]>([])
  const [loadingDiasEsp, setLoadingDiasEsp]             = useState(false)
  const [diaEspModalOpen, setDiaEspModalOpen]           = useState(false)
  const [diaEspTipo, setDiaEspTipo]                     = useState<TipoDiaEspecial>('CIERRE_TOTAL')
  const [diaEspFecha, setDiaEspFecha]                   = useState('')
  const [diaEspMotivo, setDiaEspMotivo]                 = useState('')
  const [diaEspHoraDesde, setDiaEspHoraDesde]           = useState('')
  const [diaEspHoraHasta, setDiaEspHoraHasta]           = useState('')
  const [savingDiaEsp, setSavingDiaEsp]                 = useState(false)
  const [deletingDiaEspId, setDeletingDiaEspId]         = useState<string | null>(null)
  const [editingDiaEspId, setEditingDiaEspId]           = useState<string | null>(null)
  const [anioFiltroEsp, setAnioFiltroEsp]               = useState(() => new Date().getFullYear())
  const [mesFiltroEsp, setMesFiltroEsp]                 = useState<number | null>(() => new Date().getMonth() + 1)
  const [sortOrderEsp, setSortOrderEsp]                 = useState<'asc' | 'desc'>('asc')

  const { register, handleSubmit, formState: { errors }, reset, watch, setValue } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { days: [], recurrente: true, clientIds: [], cupoMaximoSalaA: '', cupoMaximoSalaB: '', profesorSalaAId: '', profesorSalaBId: '' },
  })

  const formClientIds  = watch('clientIds') || []
  const formDays       = (watch('days') || []) as WeekDay[]
  const formRecurrente = watch('recurrente') ?? true

  // Carga profesores reales desde la API
  useEffect(() => {
    setProfsLoading(true)
    professorsApi.getAll()
      .then(setProfessors)
      .catch(() => setProfessors([]))
      .finally(() => setProfsLoading(false))
  }, [])

  // Cargar todos los días especiales una sola vez
  useEffect(() => {
    setLoadingDiasEsp(true)
    diasEspecialesApi.getAll()
      .then(setDiasEspeciales)
      .catch(() => setDiasEspeciales([]))
      .finally(() => setLoadingDiasEsp(false))
  }, [])

  // ── Derived: días especiales filtrados y ordenados
  const diasEspecialesFiltrados = useMemo(() => {
    let lista = diasEspeciales.filter(d => {
      const fecha = parseFechaLocal(d.fecha)
      if (fecha.getFullYear() !== anioFiltroEsp) return false
      if (mesFiltroEsp !== null && fecha.getMonth() + 1 !== mesFiltroEsp) return false
      return true
    })
    lista = [...lista].sort((a, b) => {
      const diff = parseFechaLocal(a.fecha).getTime() - parseFechaLocal(b.fecha).getTime()
      return sortOrderEsp === 'asc' ? diff : -diff
    })
    return lista
  }, [diasEspeciales, anioFiltroEsp, mesFiltroEsp, sortOrderEsp])

  // ── Derived: grid
  const filtered = useMemo(() =>
    shifts.filter(s =>
      dayFilter === 'all' || s.days.includes(dayFilter as WeekDay)
    ),
    [shifts, dayFilter]
  )

  // ── Derived: calendar nav limits
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
          for(let h = startH; h <= endH; h++) { active.add(h); }
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
  }, [calendarViewMode, activeHourInts])

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

  const handleEmptySlotClick = (wday: WeekDay, timeStr: string) => {
    if (!canCreate) return;
    let endTime = '';
    if (timeStr) {
      const [h, m] = timeStr.split(':').map(Number);
      const endH = Math.min(23, h + 1).toString().padStart(2, '0');
      const endM = m.toString().padStart(2, '0');
      endTime = `${endH}:${endM}`;
    }
    const params = new URLSearchParams({ day: wday, start: timeStr, end: endTime })
    navigate(`${ROUTES.SHIFT_NEW}?${params.toString()}`)
  }

  async function onCreate(data: FormValues) {
    setIsSubmitting(true)
    try {
      const turno = await shiftsApi.create({
        days: data.days, recurrente: data.recurrente,
        startTime: data.startTime, endTime: data.endTime,
        cupoMaximoSalaA: Number(data.cupoMaximoSalaA),
        cupoMaximoSalaB: Number(data.cupoMaximoSalaB),
        profesorSalaAId: data.profesorSalaAId || undefined,
        profesorSalaBId: data.profesorSalaBId || undefined,
      })

      if (data.clientIds.length > 0) {
        await Promise.allSettled(
          data.clientIds.map(clientId => inscripcionesApi.enroll(clientId, String(turno.id), 'A'))
        )
      }

      addToast('Turno creado exitosamente', 'success')
      setCreateOpen(false)
      reset({ days: [], recurrente: true, cupoMaximoSalaA: '', cupoMaximoSalaB: '', profesorSalaAId: '', profesorSalaBId: '', clientIds: [] })
      refetch()
    } catch {
      addToast('Error al crear el turno', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function deleteShift(id: number) {
    setIsDeleting(id)
    try {
      await shiftsApi.remove(id)
      queryClient.setQueryData<Shift[]>(QK.shifts.all(), old => (old ?? []).filter(s => String(s.id) !== String(id)))
      await queryClient.invalidateQueries({ queryKey: QK.shifts.all() })
      addToast('Turno eliminado', 'success')
    } catch {
      addToast('Error al eliminar', 'error')
      refetch()
    } finally {
      setIsDeleting(null)
      setDeleteTarget(null)
    }
  }

  const VIEW_MODES = [
    { mode: 'calendar' as const, icon: CalendarDays, label: 'Calendario' },
    { mode: 'grid'     as const, icon: LayoutGrid,  label: 'Grilla'     },
    { mode: 'timeline' as const, icon: Clock,        label: 'Timeline'   },
  ]

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <motion.div {...pageVariants} className="space-y-4 lg:space-y-6">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl lg:text-3xl xl:text-4xl font-black tracking-tighter text-gray-900 dark:text-white drop-shadow-sm">
          Turnos
        </h1>

        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center rounded-full border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-xl p-1 shadow-sm gap-1">
            {VIEW_MODES.map(({ mode, icon: Icon, label }) => {
              const isActive = viewMode === mode
              return (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  title={label}
                  className={`relative inline-flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold transition-all duration-300 cursor-pointer ${
                    isActive
                      ? 'text-white dark:text-gray-900'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  {isActive && (
                    <div className="absolute inset-0 rounded-full bg-gray-900 dark:bg-white shadow-[0_2px_8px_rgba(0,0,0,0.15)]" style={{ zIndex: 0 }} />
                  )}
                  <span className="relative z-10">
                    <Icon size={14} />
                  </span>
                </button>
              )
            })}
          </div>

          <button
            onClick={refetch}
            className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-xl text-gray-600 dark:text-gray-300 transition-all hover:scale-105 hover:bg-white/50 dark:hover:bg-black/50 shadow-sm"
          >
            <RefreshCw size={16} />
          </button>
          {canCreate && (
            <button
              onClick={() => navigate(ROUTES.SHIFT_NEW)}
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
        <div className="rounded-2xl lg:rounded-[2rem] border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-3xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)] px-6 py-4 flex items-center gap-4 flex-wrap">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-[#8A8A9A] ml-1 shrink-0">Día</span>
          <div className="flex items-center rounded-full border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-xl p-1 shadow-sm gap-1 flex-wrap">
            {(['all', ...DAYS] as DayFilter[]).map(d => {
              const isActive = dayFilter === d
              return (
                <button
                  key={d}
                  onClick={() => setDayFilter(d)}
                  className={`relative inline-flex items-center justify-center rounded-full px-3.5 py-1.5 text-xs font-bold transition-all duration-300 cursor-pointer ${
                    isActive
                      ? 'text-white dark:text-gray-900'
                      : 'text-gray-500 dark:text-[#8A8A9A] hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  {isActive && (
                    <div className="absolute inset-0 rounded-full bg-gray-900 dark:bg-white shadow-[0_2px_8px_rgba(0,0,0,0.15)]" style={{ zIndex: 0 }} />
                  )}
                  <span className="relative z-10">{d === 'all' ? 'Todos' : DAY_LABELS[d].slice(0, 3)}</span>
                </button>
              )
            })}
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
                  <Skeleton key={i} className="h-48 rounded-2xl" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState icon={Dumbbell} message="No hay turnos para los filtros seleccionados" className="py-20" />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map(shift => {
                  const pctA = Math.min((shift.inscritosA / shift.cupoMaximoSalaA) * 100, 100)
                  const pctB = Math.min((shift.inscritosB / shift.cupoMaximoSalaB) * 100, 100)
                  const isFullA = shift.inscritosA >= shift.cupoMaximoSalaA
                  const isFullB = shift.inscritosB >= shift.cupoMaximoSalaB
                  return (
                    <div
                      key={shift.id}
                      onClick={() => navigate(`/shifts/${shift.id}`)}
                      className="group relative cursor-pointer overflow-hidden rounded-2xl lg:rounded-[2rem] border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-3xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)] transition-all duration-500 hover:-translate-y-1 hover:bg-white/50 dark:hover:bg-black/50 hover:shadow-[0_20px_40px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_20px_40px_rgba(0,0,0,0.4)]"
                    >
                      <h3 className="font-semibold text-gray-900 dark:text-white">{shift.name}</h3>
                      <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                        {shift.days.map(d => DAY_LABELS[d].slice(0, 3)).join(' · ')}
                        {!shift.recurrente && <span className="ml-1 text-amber-500"> · puntual</span>}
                      </p>
                      <div className="mt-3 flex items-center gap-1 text-sm text-[#8A8A9A]">
                        <Clock size={13} />
                        <span>{shift.startTime} – {shift.endTime}</span>
                      </div>
                      <div className="mt-4 space-y-2">
                        {/* Sala A bar */}
                        <div>
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="flex items-center gap-1 text-[#8A8A9A]">
                              <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                              Sala A · {shift.inscritosA}/{shift.cupoMaximoSalaA}
                            </span>
                            <span className={isFullA ? 'text-red-400 font-semibold' : 'text-green-400'}>
                              {isFullA ? 'Lleno' : `${shift.cupoMaximoSalaA - shift.inscritosA} libre${shift.cupoMaximoSalaA - shift.inscritosA !== 1 ? 's' : ''}`}
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${getOccupancyColor(shift.inscritosA, shift.cupoMaximoSalaA)}`} style={{ width: `${pctA}%` }} />
                          </div>
                        </div>
                        {/* Sala B bar */}
                        <div>
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="flex items-center gap-1 text-[#8A8A9A]">
                              <span className="h-1.5 w-1.5 rounded-full bg-purple-400" />
                              Sala B · {shift.inscritosB}/{shift.cupoMaximoSalaB}
                            </span>
                            <span className={isFullB ? 'text-red-400 font-semibold' : 'text-green-400'}>
                              {isFullB ? 'Lleno' : `${shift.cupoMaximoSalaB - shift.inscritosB} libre${shift.cupoMaximoSalaB - shift.inscritosB !== 1 ? 's' : ''}`}
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${getOccupancyColor(shift.inscritosB, shift.cupoMaximoSalaB)}`} style={{ width: `${pctB}%` }} />
                          </div>
                        </div>
                      </div>
                      {canDelete && (
                        <div className="absolute bottom-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={e => { e.stopPropagation(); setDeleteTarget(shift.id) }}
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
            <div className="rounded-2xl lg:rounded-[2rem] border border-gray-200 dark:border-white/[0.06] bg-white/30 dark:bg-black/30 backdrop-blur-3xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)] overflow-hidden flex flex-col">

              {isLoading ? (
                <div className="p-4 lg:p-6 xl:p-8 space-y-3 lg:space-y-4">
                  {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl w-full" />)}
                </div>
              ) : calendarRange === 'month' ? (
                /* ── Month Grid View ── */
                <div className="overflow-x-auto">
                <div className="flex flex-col flex-1 min-h-[360px] lg:min-h-[480px] xl:min-h-[600px] min-w-[560px] bg-white/20 dark:bg-black/20">
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
                      const diaEsp = diasEspeciales.find(d => isSameDay(parseFechaLocal(d.fecha), date))

                      return (
                        <div
                          key={i}
                          onClick={() => { if (wday && canCreate && !diaEsp) handleEmptySlotClick(wday, '08:00'); }}
                          className={`relative border-b border-r border-gray-200 dark:border-white/[0.06] p-1.5 sm:p-2 flex flex-col min-h-[72px] lg:min-h-[96px] xl:min-h-[120px] transition-colors
                            ${!diaEsp && canCreate ? 'cursor-pointer hover:bg-black/5 dark:hover:bg-white/5' : ''}
                            ${!isCurrentMonth ? 'bg-gray-50/50 dark:bg-black/40 opacity-60' : 'bg-transparent'}
                            ${isToday && !diaEsp ? 'bg-primary/[0.03]' : ''}
                            ${diaEsp?.tipo === 'CIERRE_TOTAL' ? 'bg-red-500/[0.06] dark:bg-red-500/[0.10]' : ''}
                            ${diaEsp?.tipo === 'HORARIO_REDUCIDO' ? 'bg-amber-500/[0.04] dark:bg-amber-500/[0.08]' : ''}
                          `}
                        >
                          {/* Header: número de día + badge */}
                          <div className="flex items-start justify-between mb-1 sm:mb-1.5">
                            <span className={`flex items-center justify-center h-6 w-6 text-xs font-bold rounded-full ${isToday && !diaEsp ? 'bg-primary text-white' : diaEsp?.tipo === 'CIERRE_TOTAL' ? 'text-red-500 dark:text-red-400' : diaEsp ? 'text-amber-600 dark:text-amber-400' : 'text-gray-600 dark:text-[#8A8A9A]'}`}>
                              {date.getDate()}
                            </span>
                            {diaEsp && (
                              <span className={`flex items-center gap-0.5 rounded-md px-1 py-0.5 text-[8px] font-bold leading-none ${diaEsp.tipo === 'CIERRE_TOTAL' ? 'bg-red-500 text-white' : 'bg-amber-400 text-black'}`}>
                                <CalendarX size={7} className="shrink-0" />
                                {diaEsp.tipo === 'CIERRE_TOTAL' ? 'Cerrado' : 'Reducido'}
                              </span>
                            )}
                          </div>

                          {/* Turnos (blurred si hay día especial) */}
                          <div className={`flex-1 overflow-hidden min-h-0 relative ${diaEsp ? 'pointer-events-none' : ''}`}>
                            <div
                              className={`space-y-px transition-all ${diaEsp ? 'blur-[2px] opacity-40' : ''}`}
                              style={dayShifts.length > MAX_MONTH_SHIFTS ? {
                                maskImage: 'linear-gradient(to bottom, black 60%, transparent 100%)',
                                WebkitMaskImage: 'linear-gradient(to bottom, black 60%, transparent 100%)',
                              } : undefined}
                            >
                              {dayShifts.slice(0, MAX_MONTH_SHIFTS).map(shift => (
                                <button
                                  key={shift.id}
                                  onClick={(e) => { e.stopPropagation(); if (!diaEsp) navigate(`/shifts/${shift.id}`); }}
                                  className="w-full flex items-center gap-1.5 px-1 py-[3px] rounded text-left"
                                  tabIndex={diaEsp ? -1 : 0}
                                >
                                  <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${getOccupancyDot(shift.enrolled, shift.capacity)}`} />
                                  <span className="text-[9px] font-bold text-gray-500 dark:text-[#8A8A9A] flex-shrink-0 tabular-nums leading-none">{shift.startTime}</span>
                                  <span className="text-[9px] font-medium text-gray-700 dark:text-gray-200 truncate flex-1 leading-none">{shift.name}</span>
                                </button>
                              ))}
                            </div>

                            {/* Overlay bloqueante sobre los turnos */}
                            {diaEsp && (
                              <div className={`absolute inset-0 flex flex-col items-center justify-center gap-0.5 rounded-lg ${diaEsp.tipo === 'CIERRE_TOTAL' ? 'bg-red-500/10 border border-red-500/20' : 'bg-amber-500/10 border border-amber-400/20'}`}>
                                <CalendarX size={12} className={diaEsp.tipo === 'CIERRE_TOTAL' ? 'text-red-400' : 'text-amber-400'} />
                                {diaEsp.tipo === 'CIERRE_TOTAL' && (
                                  <p className="text-[7px] font-bold text-red-400 text-center leading-tight px-0.5">
                                    {diaEsp.motivo ?? 'Sin clases'}
                                  </p>
                                )}
                                {diaEsp.tipo === 'HORARIO_REDUCIDO' && diaEsp.horaDesde && (
                                  <p className="text-[7px] font-bold text-amber-400 text-center leading-tight">
                                    {diaEsp.horaDesde}–{diaEsp.horaHasta}
                                  </p>
                                )}
                              </div>
                            )}
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
                <div className="flex">
                  {/* Y-axis Left Column */}
                  <div className="w-16 flex-shrink-0 border-r border-gray-200 dark:border-white/[0.06] bg-white/50 dark:bg-black/20 z-10">
                    <div className="h-14 border-b border-gray-200 dark:border-white/[0.06]" />
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
                        const diaEsp = diasEspeciales.find(d => isSameDay(parseFechaLocal(d.fecha), date))
                        return (
                          <div key={i} className={`relative flex-1 min-w-[140px] min-h-[56px] px-3 py-2 flex flex-col items-center justify-center gap-1 text-center border-r last:border-r-0 border-gray-200 dark:border-white/[0.06] ${isToday ? 'bg-primary/5' : ''} ${diaEsp?.tipo === 'CIERRE_TOTAL' ? 'bg-red-500/8 dark:bg-red-500/10' : diaEsp ? 'bg-amber-500/5' : ''}`}>
                            {diaEsp?.tipo === 'CIERRE_TOTAL' && (
                              <div className="absolute inset-x-0 bottom-0 h-0.5 bg-red-500" />
                            )}
                            {diaEsp?.tipo === 'HORARIO_REDUCIDO' && (
                              <div className="absolute inset-x-0 bottom-0 h-0.5 bg-amber-400" />
                            )}
                            <p className={`text-xs font-bold capitalize ${isToday ? 'text-amber-700 dark:text-primary' : diaEsp ? (diaEsp.tipo === 'CIERRE_TOTAL' ? 'text-red-500 dark:text-red-400' : 'text-amber-600 dark:text-amber-400') : 'text-gray-500 dark:text-[#8A8A9A]'}`}>
                              {format(date, 'EEEE d', { locale: es })}
                            </p>
                            {diaEsp ? (
                              <span className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[9px] font-bold ${diaEsp.tipo === 'CIERRE_TOTAL' ? 'bg-red-500 text-white' : 'bg-amber-400 text-black'}`}>
                                <CalendarX size={8} className="shrink-0" />
                                {diaEsp.tipo === 'CIERRE_TOTAL' ? (diaEsp.motivo ?? 'Sin clases') : (diaEsp.horaDesde ? `${diaEsp.horaDesde}–${diaEsp.horaHasta}` : 'Reducido')}
                              </span>
                            ) : (
                              <span className="h-[18px]" />
                            )}
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
                        const isToday = isSameDay(date, new Date())
                        const diaEspCol = diasEspeciales.find(d => isSameDay(parseFechaLocal(d.fecha), date))

                        return (
                          <div key={i} className={`flex-1 min-w-[140px] relative border-r last:border-r-0 border-gray-200 dark:border-white/[0.06] ${isToday && !diaEspCol ? 'bg-primary/[0.02]' : ''} ${diaEspCol?.tipo === 'CIERRE_TOTAL' ? 'bg-red-500/[0.04] dark:bg-red-500/[0.07]' : diaEspCol ? 'bg-amber-500/[0.03] dark:bg-amber-500/[0.05]' : ''}`}>
                            {/* Empty clickable slots — deshabilitados si hay cierre total o fuera del horario reducido */}
                            {canCreate && wday && HOURS.map((hStr) => {
                              const h = parseInt(hStr.split(':')[0], 10);
                              if (calendarViewMode === 'optimized' && !activeHourInts.has(h)) return null;

                              const isSlotBlocked = diaEspCol?.tipo === 'CIERRE_TOTAL' || (
                                diaEspCol?.tipo === 'HORARIO_REDUCIDO' &&
                                !!diaEspCol.horaDesde && !!diaEspCol.horaHasta &&
                                (hStr < diaEspCol.horaDesde || hStr >= diaEspCol.horaHasta)
                              );

                              if (isSlotBlocked) return null;

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
                              const marginY = 6
                              const top    = getTimeY(shift.startTime) + marginY
                              const bottom = getTimeY(shift.endTime) - marginY
                              const height = Math.max(42, bottom - top)
                              const isFull = shift.enrolled >= shift.capacity

                              const marginX     = 8
                              const gutter      = 4
                              const leftPercent = (colIndex / numCols) * 100
                              const leftPx      = marginX + colIndex * ((-marginX * 2 + gutter) / numCols)
                              const widthPercent = (1 / numCols) * 100
                              const widthPx     = ((-marginX * 2 + gutter) / numCols) - gutter

                              const isBlocked = diaEspCol?.tipo === 'CIERRE_TOTAL' || (
                                diaEspCol?.tipo === 'HORARIO_REDUCIDO' &&
                                !!diaEspCol.horaDesde && !!diaEspCol.horaHasta &&
                                (shift.endTime <= diaEspCol.horaDesde || shift.startTime >= diaEspCol.horaHasta)
                              )

                              return (
                                <motion.button
                                  key={shift.id}
                                  initial={{ opacity: 0, scale: 0.92 }}
                                  animate={{ opacity: isBlocked ? 0.4 : 1, scale: 1 }}
                                  transition={{ duration: 0.18, ease: 'easeOut' }}
                                  onClick={(e) => { e.stopPropagation(); if (!isBlocked) navigate(`/shifts/${shift.id}`); }}
                                  tabIndex={isBlocked ? -1 : 0}
                                  style={{
                                    top,
                                    height,
                                    left:  `calc(${leftPercent}% + ${leftPx}px)`,
                                    width: `calc(${widthPercent}% + ${widthPx}px)`,
                                  }}
                                  className={`absolute rounded-xl border p-2 text-left overflow-hidden transition-[filter,box-shadow] ${!isBlocked ? 'hover:z-10 hover:shadow-md' : 'blur-[1.5px] pointer-events-none'} ${getOccupancyStyle(shift.enrolled, shift.capacity)}`}
                                >
                                  <p className="text-[11px] font-bold text-gray-900 dark:text-white leading-tight truncate">
                                    {shift.startTime} – {shift.endTime}
                                  </p>
                                  {(shift.profesorSalaANombre || shift.profesorSalaBNombre) && (
                                    <p className="text-[10px] text-gray-500 dark:text-[#8A8A9A] truncate leading-tight mt-0.5">
                                      {shift.profesorSalaANombre && shift.profesorSalaBNombre && shift.profesorSalaANombre !== shift.profesorSalaBNombre
                                        ? '2 profesores'
                                        : shift.profesorSalaANombre || shift.profesorSalaBNombre}
                                    </p>
                                  )}
                                  <p className="text-[10px] font-semibold leading-tight mt-1">
                                    <span className="text-blue-500 dark:text-blue-400">A: {shift.inscritosA}/{shift.cupoMaximoSalaA}</span>
                                    <span className="text-gray-400 mx-1">·</span>
                                    <span className="text-purple-500 dark:text-purple-400">B: {shift.inscritosB}/{shift.cupoMaximoSalaB}</span>
                                  </p>
                                </motion.button>
                              )
                            })}

                            {/* Overlay cierre total — clip-path revela de arriba hacia abajo */}
                            <AnimatePresence>
                            {diaEspCol?.tipo === 'CIERRE_TOTAL' && (
                              <motion.div
                                key={`cierre-${diaEspCol.id ?? 'total'}`}
                                className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center gap-2 z-10 bg-red-500/[0.08] dark:bg-red-500/[0.12]"
                                initial={{ clipPath: 'inset(0 0 100% 0)' }}
                                animate={{ clipPath: 'inset(0 0 0% 0)' }}
                                exit={{ clipPath: 'inset(0 0 100% 0)' }}
                                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                              >
                                <motion.div
                                  className="flex flex-col items-center gap-1 px-3 py-2 rounded-2xl backdrop-blur-md bg-red-500/20 border border-red-500/30"
                                  initial={{ opacity: 0, scale: 0.9 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  transition={{ duration: 0.2, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
                                >
                                  <CalendarX size={18} className="text-red-400" />
                                  <p className="text-[10px] font-bold text-center leading-snug text-red-400">
                                    {diaEspCol.motivo ?? 'Sin clases'}
                                  </p>
                                </motion.div>
                              </motion.div>
                            )}
                            </AnimatePresence>

                            {/* Overlay horario reducido — franjas con clip-path */}
                            {diaEspCol?.tipo === 'HORARIO_REDUCIDO' && diaEspCol.horaDesde && diaEspCol.horaHasta && (() => {
                              const yDesde = getTimeY(diaEspCol.horaDesde)
                              const yHasta = getTimeY(diaEspCol.horaHasta)
                              return (
                                <>
                                  {/* Franja antes del horario reducido */}
                                  {yDesde > 0 && (
                                    <motion.div
                                      className="absolute left-0 right-0 z-10 bg-amber-500/[0.10] dark:bg-amber-500/[0.14] border-r-2 border-amber-400/50"
                                      style={{ top: 0, height: yDesde }}
                                      initial={{ clipPath: 'inset(0 0 100% 0)' }}
                                      animate={{ clipPath: 'inset(0 0 0% 0)' }}
                                      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                                    >
                                      <div className="flex items-center justify-center h-full pointer-events-none">
                                        <span className="text-[9px] font-bold text-amber-500 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-md">
                                          Sin clases
                                        </span>
                                      </div>
                                    </motion.div>
                                  )}
                                  {/* Franja después del horario reducido */}
                                  {yHasta < totalHeight && (
                                    <motion.div
                                      className="absolute left-0 right-0 z-10 bg-amber-500/[0.10] dark:bg-amber-500/[0.14] border-r-2 border-amber-400/50"
                                      style={{ top: yHasta, height: totalHeight - yHasta }}
                                      initial={{ clipPath: 'inset(0 0 100% 0)' }}
                                      animate={{ clipPath: 'inset(0 0 0% 0)' }}
                                      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1], delay: 0.05 }}
                                    >
                                      <div className="flex items-center justify-center h-full pointer-events-none">
                                        <span className="text-[9px] font-bold text-amber-500 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-md">
                                          Sin clases
                                        </span>
                                      </div>
                                    </motion.div>
                                  )}
                                </>
                              )
                            })()}
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
                <EmptyState icon={Clock} message={`No hay turnos para ${DAY_LABELS[timelineDay]}`} className="py-16" />
              ) : (
                <div className="rounded-2xl lg:rounded-[2rem] border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-3xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)] overflow-hidden">
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

                    {/* Sala A — ALL shifts with per-sala A occupancy */}
                    <div className="border-r border-white/[0.06] relative">
                      {HOURS.map((h, i) => (
                        <div
                          key={h}
                          onClick={() => handleEmptySlotClick(timelineDay, h)}
                          className={`absolute left-0 right-0 border-t border-white/[0.04] ${canCreate ? 'cursor-pointer hover:bg-black/5 dark:hover:bg-white/5' : ''}`}
                          style={{ top: i * 60 * PX_PER_MIN, height: 60 * PX_PER_MIN }}
                        />
                      ))}
                      {timelineShifts.map(shift => {
                        const marginY = 6
                        const top    = (timeToMinutes(shift.startTime) - TIMELINE_START_H * 60) * PX_PER_MIN + marginY
                        const height = Math.max(32, (timeToMinutes(shift.endTime) - timeToMinutes(shift.startTime)) * PX_PER_MIN - marginY * 2)
                        const pct    = Math.min((shift.inscritosA / shift.cupoMaximoSalaA) * 100, 100)
                        return (
                          <button
                            key={shift.id}
                            onClick={(e) => { e.stopPropagation(); navigate(`/shifts/${shift.id}`); }}
                            className={`absolute inset-x-2 rounded-lg border px-2 py-1 text-left overflow-hidden transition-all hover:brightness-110 z-10 ${getOccupancyStyle(shift.inscritosA, shift.cupoMaximoSalaA)}`}
                            style={{ top, height }}
                          >
                            <p className="text-[11px] font-semibold text-gray-900 dark:text-white truncate leading-tight">{shift.name}</p>
                            <p className="text-[10px] text-[#8A8A9A] leading-tight">{shift.startTime}–{shift.endTime}</p>
                            <p className="text-[10px] text-[#8A8A9A] leading-tight">{shift.inscritosA}/{shift.cupoMaximoSalaA}</p>
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/10 overflow-hidden">
                              <div className={`h-full ${getOccupancyColor(shift.inscritosA, shift.cupoMaximoSalaA)}`} style={{ width: `${pct}%` }} />
                            </div>
                          </button>
                        )
                      })}
                    </div>

                    {/* Sala B — ALL shifts with per-sala B occupancy */}
                    <div className="relative">
                      {HOURS.map((h, i) => (
                        <div
                          key={h}
                          onClick={() => handleEmptySlotClick(timelineDay, h)}
                          className={`absolute left-0 right-0 border-t border-white/[0.04] ${canCreate ? 'cursor-pointer hover:bg-black/5 dark:hover:bg-white/5' : ''}`}
                          style={{ top: i * 60 * PX_PER_MIN, height: 60 * PX_PER_MIN }}
                        />
                      ))}
                      {timelineShifts.map(shift => {
                        const marginY = 6
                        const top    = (timeToMinutes(shift.startTime) - TIMELINE_START_H * 60) * PX_PER_MIN + marginY
                        const height = Math.max(32, (timeToMinutes(shift.endTime) - timeToMinutes(shift.startTime)) * PX_PER_MIN - marginY * 2)
                        const pct    = Math.min((shift.inscritosB / shift.cupoMaximoSalaB) * 100, 100)
                        return (
                          <button
                            key={shift.id}
                            onClick={(e) => { e.stopPropagation(); navigate(`/shifts/${shift.id}`); }}
                            className={`absolute inset-x-2 rounded-lg border px-2 py-1 text-left overflow-hidden transition-all hover:brightness-110 z-10 ${getOccupancyStyle(shift.inscritosB, shift.cupoMaximoSalaB)}`}
                            style={{ top, height }}
                          >
                            <p className="text-[11px] font-semibold text-gray-900 dark:text-white truncate leading-tight">{shift.name}</p>
                            <p className="text-[10px] text-[#8A8A9A] leading-tight">{shift.startTime}–{shift.endTime}</p>
                            <p className="text-[10px] text-[#8A8A9A] leading-tight">{shift.inscritosB}/{shift.cupoMaximoSalaB}</p>
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/10 overflow-hidden">
                              <div className={`h-full ${getOccupancyColor(shift.inscritosB, shift.cupoMaximoSalaB)}`} style={{ width: `${pct}%` }} />
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

      {/* ══════════════════════════════════════════════════════════════════════
           SECCIÓN: Días sin Clases
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="mt-4 space-y-4">

        {/* Título de sección */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-red-500/10">
            <CalendarX size={20} className="text-red-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Días sin Clases</h2>
            <p className="text-sm text-[#8A8A9A]">Feriados, cierres y horarios reducidos del gimnasio</p>
          </div>
          {canCreate && (
            <button
              onClick={() => setDiaEspModalOpen(true)}
              className="ml-auto flex items-center gap-2 rounded-xl bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-400 hover:bg-red-500/20 transition-all"
            >
              <Plus size={14} /> Agregar día
            </button>
          )}
        </div>

        {/* Filtros y controles */}
        <div className="rounded-2xl lg:rounded-[2rem] border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-3xl p-5 shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)] flex flex-wrap items-end gap-4">
          
          {/* Selector de año */}
          <div className="flex flex-col gap-1.5 min-w-[120px] flex-1 sm:flex-initial">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-[#8A8A9A] ml-1">Año</span>
            <select
              value={anioFiltroEsp}
              onChange={(e) => setAnioFiltroEsp(Number(e.target.value))}
              className="rounded-xl border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-xl px-3.5 py-2 text-xs font-semibold text-gray-800 dark:text-gray-200 focus:outline-none cursor-pointer h-10"
            >
              {[2024, 2025, 2026, 2027, 2028, 2029, 2030].map(y => (
                <option key={y} value={y} className="bg-white dark:bg-[#1a1a24] text-gray-900 dark:text-white">{y}</option>
              ))}
            </select>
          </div>

          {/* Selector de mes */}
          <div className="flex flex-col gap-1.5 min-w-[160px] flex-1 sm:flex-initial">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-[#8A8A9A] ml-1">Mes</span>
            <select
              value={mesFiltroEsp ?? ''}
              onChange={(e) => setMesFiltroEsp(e.target.value === '' ? null : Number(e.target.value))}
              className="rounded-xl border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-xl px-3.5 py-2 text-xs font-semibold text-gray-800 dark:text-gray-200 focus:outline-none cursor-pointer h-10"
            >
              <option value="" className="bg-white dark:bg-[#1a1a24] text-gray-900 dark:text-white">Todo el año</option>
              {['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'].map((mes, idx) => (
                <option key={idx} value={idx + 1} className="bg-white dark:bg-[#1a1a24] text-gray-900 dark:text-white">{mes}</option>
              ))}
            </select>
          </div>

          {/* Orden */}
          <div className="flex flex-col gap-1.5 min-w-[160px] sm:ml-auto w-full sm:w-auto">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-[#8A8A9A] ml-1">Orden</span>
            <button
              onClick={() => setSortOrderEsp(o => o === 'asc' ? 'desc' : 'asc')}
              className="rounded-xl border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-xl px-4 py-2 text-xs font-semibold text-gray-800 dark:text-gray-200 hover:bg-white/50 dark:hover:bg-white/10 transition-colors flex items-center justify-center gap-1.5 cursor-pointer h-10 w-full"
            >
              {sortOrderEsp === 'asc' ? (
                <>
                  <ChevronRight size={13} className="rotate-90 text-gray-400" />
                  <span>Más antiguo primero</span>
                </>
              ) : (
                <>
                  <ChevronLeft size={13} className="rotate-90 text-gray-400" />
                  <span>Más reciente primero</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Lista */}
        <div className="rounded-2xl lg:rounded-[2rem] border border-white/50 dark:border-white/[0.08] bg-white/30 dark:bg-black/30 backdrop-blur-3xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.25)] overflow-hidden">
          {loadingDiasEsp ? (
            <div className="p-4 space-y-2">
              {[1,2,3].map(i => <div key={i} className="h-16 rounded-xl bg-black/[0.03] dark:bg-white/[0.04] animate-pulse" />)}
            </div>
          ) : diasEspecialesFiltrados.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-[#8A8A9A]">
              <CalendarX size={32} className="opacity-30" />
              <p className="text-sm">No hay días especiales para el período seleccionado.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200/60 dark:divide-white/[0.06]">
              {diasEspecialesFiltrados.map(dia => {
                const fecha = parseFechaLocal(dia.fecha)
                return (
                  <div key={dia.id} className={`flex items-center gap-4 px-5 py-4 transition-colors ${dia.tipo === 'CIERRE_TOTAL' ? 'hover:bg-red-500/[0.03]' : 'hover:bg-amber-500/[0.03]'}`}>
                    {/* Bloque de fecha */}
                    <div className={`flex flex-col items-center justify-center h-14 w-14 shrink-0 rounded-2xl border ${dia.tipo === 'CIERRE_TOTAL' ? 'border-red-500/30 bg-red-500/10' : 'border-amber-500/30 bg-amber-500/10'}`}>
                      <span className={`text-xl font-black leading-none ${dia.tipo === 'CIERRE_TOTAL' ? 'text-red-500 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`}>
                        {fecha.getDate()}
                      </span>
                      <span className={`text-[10px] font-bold uppercase tracking-wide ${dia.tipo === 'CIERRE_TOTAL' ? 'text-red-400/70' : 'text-amber-500/70'}`}>
                        {format(fecha, 'MMM', { locale: es })}
                      </span>
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 dark:text-white capitalize">
                        {format(fecha, "EEEE d 'de' MMMM yyyy", { locale: es })}
                      </p>
                      <p className="text-xs text-[#8A8A9A] mt-0.5">
                        {dia.tipo === 'CIERRE_TOTAL'
                          ? 'Cierre total del gimnasio'
                          : `Horario reducido${dia.horaDesde ? `: ${dia.horaDesde} – ${dia.horaHasta}` : ''}`}
                        {dia.motivo ? ` · ${dia.motivo}` : ''}
                      </p>
                    </div>
                    {/* Badge — siempre visible */}
                    <span className={`shrink-0 flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${dia.tipo === 'CIERRE_TOTAL' ? 'border-red-500/20 bg-red-500/10 text-red-400' : 'border-amber-500/20 bg-amber-500/10 text-amber-400'}`}>
                      {dia.tipo === 'CIERRE_TOTAL'
                        ? <><CalendarX size={11} /> Cierre total</>
                        : <><AlertOctagon size={11} /> Horario reducido</>
                      }
                    </span>
                    {/* Acciones — siempre a la derecha */}
                    {canDelete && (
                      <div className="shrink-0 flex items-center gap-1">
                        <button
                          onClick={() => {
                            setEditingDiaEspId(dia.id)
                            setDiaEspFecha(dia.fecha.split('T')[0])
                            setDiaEspTipo(dia.tipo)
                            setDiaEspMotivo(dia.motivo ?? '')
                            setDiaEspHoraDesde(dia.horaDesde ?? '')
                            setDiaEspHoraHasta(dia.horaHasta ?? '')
                            setDiaEspModalOpen(true)
                          }}
                          className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/[0.06] text-gray-400 hover:bg-white/10 hover:text-white transition-all"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          disabled={deletingDiaEspId === dia.id}
                          onClick={async () => {
                            setDeletingDiaEspId(dia.id)
                            try {
                              await diasEspecialesApi.remove(dia.id)
                              setDiasEspeciales(prev => prev.filter(d => d.id !== dia.id))
                              addToast('Día especial eliminado', 'success')
                            } catch {
                              addToast('Error al eliminar', 'error')
                            } finally {
                              setDeletingDiaEspId(null)
                            }
                          }}
                          className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all disabled:opacity-50"
                        >
                          {deletingDiaEspId === dia.id ? '…' : <Trash2 size={13} />}
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Modal: Agregar / Editar Día Especial ─────────────────────────────── */}
      <Modal
        isOpen={diaEspModalOpen}
        onClose={() => {
          setDiaEspModalOpen(false)
          setEditingDiaEspId(null)
          setDiaEspFecha(''); setDiaEspMotivo(''); setDiaEspHoraDesde(''); setDiaEspHoraHasta('')
          setDiaEspTipo('CIERRE_TOTAL')
        }}
        title={editingDiaEspId ? 'Editar día especial' : 'Agregar día sin clases'}
      >
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-[#8A8A9A] mb-1.5 block">Fecha</label>
            <input
              type="date"
              value={diaEspFecha}
              onChange={e => setDiaEspFecha(e.target.value)}
              className="w-full rounded-xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-[#8A8A9A] mb-1.5 block">Tipo</label>
            <div className="flex gap-2">
              {(['CIERRE_TOTAL', 'HORARIO_REDUCIDO'] as TipoDiaEspecial[]).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setDiaEspTipo(t)
                    if (t === 'CIERRE_TOTAL') {
                      setDiaEspHoraDesde('')
                      setDiaEspHoraHasta('')
                    }
                  }}
                  className={`flex-1 rounded-xl py-2.5 text-xs font-semibold transition-all border ${diaEspTipo === t ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-transparent' : 'border-gray-200 dark:border-white/[0.08] text-gray-500 dark:text-[#8A8A9A] hover:bg-black/5 dark:hover:bg-white/5'}`}
                >
                  {t === 'CIERRE_TOTAL' ? 'Cierre total' : 'Horario reducido'}
                </button>
              ))}
            </div>
          </div>
          {diaEspTipo === 'HORARIO_REDUCIDO' && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 dark:text-[#8A8A9A] mb-1.5 block">Hora desde *</label>
                  <input type="time" value={diaEspHoraDesde} onChange={e => setDiaEspHoraDesde(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 dark:text-[#8A8A9A] mb-1.5 block">Hora hasta *</label>
                  <input type="time" value={diaEspHoraHasta} onChange={e => setDiaEspHoraHasta(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
              </div>
              <p className="text-xs text-[#8A8A9A] leading-snug">
                Ingresá el rango de horas en que el gimnasio funciona ese día. Por ejemplo, si abre a las 9 y cierra a las 13, ponés <span className="font-semibold text-gray-600 dark:text-gray-400">09:00</span> y <span className="font-semibold text-gray-600 dark:text-gray-400">13:00</span>. Usá formato de 24 horas.
              </p>
            </div>
          )}
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-[#8A8A9A] mb-1.5 block">Motivo <span className="font-normal">(opcional)</span></label>
            <input
              type="text"
              value={diaEspMotivo}
              onChange={e => setDiaEspMotivo(e.target.value)}
              placeholder="Ej: Feriado nacional, mantenimiento…"
              className="w-full rounded-xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] px-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-[#8A8A9A] focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-gray-200 dark:border-white/[0.06]">
            <button
              onClick={() => {
                setDiaEspModalOpen(false)
                setEditingDiaEspId(null)
                setDiaEspFecha(''); setDiaEspMotivo(''); setDiaEspHoraDesde(''); setDiaEspHoraHasta('')
                setDiaEspTipo('CIERRE_TOTAL')
              }}
              className="px-4 py-2 text-sm font-semibold text-gray-500 dark:text-[#8A8A9A] hover:text-gray-700 dark:hover:text-white transition-colors"
            >
              Cancelar
            </button>
            <button
              disabled={!diaEspFecha || (diaEspTipo === 'HORARIO_REDUCIDO' && (!diaEspHoraDesde || !diaEspHoraHasta)) || savingDiaEsp}
              onClick={async () => {
                setSavingDiaEsp(true)
                try {
                  const payload = {
                    fecha: diaEspFecha,
                    tipo: diaEspTipo,
                    motivo: diaEspMotivo || undefined,
                    horaDesde: diaEspTipo === 'HORARIO_REDUCIDO' ? diaEspHoraDesde || undefined : undefined,
                    horaHasta: diaEspTipo === 'HORARIO_REDUCIDO' ? diaEspHoraHasta || undefined : undefined,
                  }
                  if (editingDiaEspId) {
                    const actualizado = await diasEspecialesApi.update(editingDiaEspId, payload)
                    setDiasEspeciales(prev =>
                      prev.map(d => d.id === editingDiaEspId ? actualizado : d)
                        .sort((a, b) => a.fecha.localeCompare(b.fecha))
                    )
                    addToast('Día especial actualizado', 'success')
                  } else {
                    const nuevo = await diasEspecialesApi.create(payload)
                    setDiasEspeciales(prev => [...prev, nuevo].sort((a, b) => a.fecha.localeCompare(b.fecha)))
                    addToast('Día especial registrado', 'success')
                  }
                  setDiaEspModalOpen(false)
                  setEditingDiaEspId(null)
                  setDiaEspFecha(''); setDiaEspMotivo(''); setDiaEspHoraDesde(''); setDiaEspHoraHasta('')
                  setDiaEspTipo('CIERRE_TOTAL')
                } catch (err: unknown) {
                  const apiMsg = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message
                  const msg = Array.isArray(apiMsg) ? apiMsg[0] : (apiMsg ?? 'Error al guardar')
                  addToast(msg, 'error')
                } finally {
                  setSavingDiaEsp(false)
                }
              }}
              className="flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2 text-sm font-bold text-black hover:bg-primary-dark transition-all disabled:opacity-50 shadow-lg shadow-primary/20"
            >
              {savingDiaEsp ? '…' : <><Check size={14} /> {editingDiaEspId ? 'Actualizar' : 'Guardar'}</>}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="Eliminar turno"
        message="Se eliminarán también todas las inscripciones y asistencias asociadas. Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        isLoading={isDeleting !== null}
        onConfirm={() => deleteTarget !== null && deleteShift(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
      />
    </motion.div>
  )
}
