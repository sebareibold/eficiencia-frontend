import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { pageVariants } from '../lib/motion'
import {
  Plus, Clock, Users, RefreshCw, Dumbbell, Trash2,
  LayoutGrid, CalendarDays, ChevronLeft, ChevronRight,
  Filter, Settings2, X
} from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { addWeeks, subWeeks, startOfWeek, endOfWeek, addDays, subDays, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, format, isSameDay } from 'date-fns'
import { es } from 'date-fns/locale'
import { useShifts } from '../hooks/useShifts'
import { useClients } from '../hooks/useClients'
import { shiftsApi, professorsApi } from '../api/shifts.api'
import { useUiStore } from '../store/uiStore'
import { useAuthStore } from '../store/authStore'
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

const TIMELINE_START_H = 6
const TIMELINE_END_H   = 22
const PX_PER_MIN       = 1
const TIMELINE_HEIGHT  = (TIMELINE_END_H - TIMELINE_START_H) * 60 * PX_PER_MIN
const HOURS = Array.from(
  { length: TIMELINE_END_H - TIMELINE_START_H + 1 },
  (_, i) => `${String(TIMELINE_START_H + i).padStart(2, '0')}:00`
)

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  room:      z.string().min(1, 'La sala es requerida'),
  day:       z.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'], {
    errorMap: () => ({ message: 'El día es requerido' })
  }),
  startTime: z.string().min(1, 'La hora de inicio es requerida'),
  endTime:   z.string().min(1, 'La hora de fin es requerida'),
  capacity:  z.string().min(1, 'El cupo es requerido').refine(v => Number(v) > 0, 'Cupo inválido'),
  profesorId: z.string().min(1, 'El profesor es requerido'),
  clientIds: z.array(z.number()),
}).refine(data => data.clientIds.length <= Number(data.capacity || 0), {
  message: 'La cantidad de clientes supera el cupo',
  path: ['clientIds']
})

type FormValues = z.infer<typeof schema>

type RoomFilter = 'all' | 'A' | 'B'
type DayFilter  = 'all' | WeekDay

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
  if (r >= 1)   return 'border-red-500/50 bg-red-500/10 hover:bg-red-500/15'
  if (r >= 0.8) return 'border-yellow-500/50 bg-yellow-500/10 hover:bg-yellow-500/15'
  return 'border-green-500/50 bg-green-500/10 hover:bg-green-500/15'
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ShiftsPage() {
  const { shifts, isLoading, error, refetch } = useShifts()
  const { clients } = useClients()
  const addToast = useUiStore(s => s.addToast)
  const user     = useAuthStore(s => s.user)
  const isAdmin  = user?.role === 'admin'

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

  const { register, handleSubmit, formState: { errors }, reset, watch, setValue } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { room: 'A', clientIds: [] },
  })

  const formClientIds = watch('clientIds') || []
  const formCapacity  = Number(watch('capacity')) || 0

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
      (dayFilter  === 'all' || s.day  === dayFilter)
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
        shifts.filter(s => s.day === wday).forEach(s => {
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
    shifts.forEach(s => { if (map[s.day]) map[s.day].push(s) })
    Object.values(map).forEach(arr => arr.sort((a, b) => a.startTime.localeCompare(b.startTime)))
    return map
  }, [shifts])

  // ── Derived: timeline
  const timelineShifts = useMemo(() =>
    [...shifts]
      .filter(s => s.day === timelineDay)
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
      day: wday,
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
      await shiftsApi.create({
        room: data.room, day: data.day,
        startTime: data.startTime, endTime: data.endTime, capacity: Number(data.capacity),
        profesorId: data.profesorId,
      })
      addToast('Turno creado exitosamente', 'success')
      setCreateOpen(false)
      reset({ room: 'A', day: undefined, startTime: '', endTime: '', capacity: '', profesorId: '', clientIds: [] })
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
                reset({ room: '', day: undefined, startTime: '', endTime: '', capacity: '', profesorId: '', clientIds: [] })
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
                      onClick={() => setDetailShift(shift)}
                      className="group relative cursor-pointer overflow-hidden rounded-[2rem] border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-3xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)] transition-all duration-500 hover:-translate-y-1 hover:bg-white/50 dark:hover:bg-black/50 hover:shadow-[0_20px_40px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_20px_40px_rgba(0,0,0,0.4)]"
                    >
                      <div className="absolute top-4 right-4 flex items-center gap-1.5">
                        <span className={`h-2 w-2 rounded-full ${shift.room === 'A' ? 'bg-blue-400' : 'bg-purple-400'}`} />
                        <span className="text-xs text-[#8A8A9A]">Sala {shift.room}</span>
                      </div>
                      <h3 className="pr-16 font-semibold text-gray-900 dark:text-white">{shift.name}</h3>
                      <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{DAY_LABELS[shift.day]}</p>
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
                          <div className="flex-1 overflow-y-auto space-y-1 custom-scrollbar pr-1">
                            {dayShifts.map(shift => {
                              const isFull = shift.enrolled >= shift.capacity;
                              return (
                                <button
                                  key={shift.id}
                                  onClick={(e) => { e.stopPropagation(); setDetailShift(shift); }}
                                  className={`w-full text-left px-2 py-1.5 rounded-lg border transition-all hover:scale-[1.02] ${getOccupancyStyle(shift.enrolled, shift.capacity)}`}
                                >
                                  <div className="flex items-center justify-between gap-1 mb-0.5">
                                    <span className="font-bold text-[10px] text-gray-900 dark:text-white truncate">{shift.startTime}</span>
                                    <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${shift.room === 'A' ? 'bg-blue-400' : 'bg-purple-400'}`} />
                                  </div>
                                  <p className="text-[10px] font-medium text-gray-700 dark:text-gray-300 truncate">{shift.name}</p>
                                  <div className="flex items-center gap-1 mt-1 text-[9px] text-gray-500 dark:text-[#8A8A9A]">
                                    <Users size={8} /> <span>{shift.enrolled}/{shift.capacity}</span>
                                  </div>
                                </button>
                              )
                            })}
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

                            {dayShifts.map(shift => {
                              const top = getTimeY(shift.startTime)
                              const bottom = getTimeY(shift.endTime)
                              const height = Math.max(40, bottom - top)
                              const isFull = shift.enrolled >= shift.capacity
                              
                              return (
                                <button
                                  key={shift.id}
                                  onClick={(e) => { e.stopPropagation(); setDetailShift(shift); }}
                                  style={{ top, height }}
                                  className={`absolute inset-x-1.5 rounded-xl border p-2 text-left overflow-hidden transition-all hover:scale-[1.02] hover:z-10 shadow-sm ${getOccupancyStyle(shift.enrolled, shift.capacity)}`}
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
                        const top    = (timeToMinutes(shift.startTime) - TIMELINE_START_H * 60) * PX_PER_MIN
                        const height = Math.max(32, (timeToMinutes(shift.endTime) - timeToMinutes(shift.startTime)) * PX_PER_MIN)
                        const pct    = Math.min((shift.enrolled / shift.capacity) * 100, 100)
                        return (
                          <button
                            key={shift.id}
                            onClick={(e) => { e.stopPropagation(); setDetailShift(shift); }}
                            className={`absolute inset-x-1 rounded-lg border px-2 py-1 text-left overflow-hidden transition-all hover:brightness-110 z-10 ${getOccupancyStyle(shift.enrolled, shift.capacity)}`}
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
                        const top    = (timeToMinutes(shift.startTime) - TIMELINE_START_H * 60) * PX_PER_MIN
                        const height = Math.max(32, (timeToMinutes(shift.endTime) - timeToMinutes(shift.startTime)) * PX_PER_MIN)
                        const pct    = Math.min((shift.enrolled / shift.capacity) * 100, 100)
                        return (
                          <button
                            key={shift.id}
                            onClick={(e) => { e.stopPropagation(); setDetailShift(shift); }}
                            className={`absolute inset-x-1 rounded-lg border px-2 py-1 text-left overflow-hidden transition-all hover:brightness-110 z-10 ${getOccupancyStyle(shift.enrolled, shift.capacity)}`}
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

      {/* ── Detail Modal ──────────────────────────────────────────────────────── */}
      <Modal isOpen={!!detailShift} onClose={() => setDetailShift(null)} title={detailShift?.name ?? ''} size="md">
        {detailShift && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] p-3">
                <p className="text-xs text-[#8A8A9A]">Sala</p>
                <p className="mt-1 font-semibold text-white">Sala {detailShift.room}</p>
              </div>
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] p-3">
                <p className="text-xs text-[#8A8A9A]">Día</p>
                <p className="mt-1 font-semibold text-white">{DAY_LABELS[detailShift.day]}</p>
              </div>
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] p-3">
                <p className="text-xs text-[#8A8A9A]">Horario</p>
                <p className="mt-1 font-semibold text-white">{detailShift.startTime} – {detailShift.endTime}</p>
              </div>
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] p-3">
                <p className="text-xs text-[#8A8A9A]">Cupo</p>
                <p className="mt-1 font-semibold text-white">{detailShift.enrolled}/{detailShift.capacity}</p>
              </div>
            </div>
            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className={`h-full rounded-full ${getOccupancyColor(detailShift.enrolled, detailShift.capacity)}`}
                style={{ width: `${Math.min((detailShift.enrolled / detailShift.capacity) * 100, 100)}%` }}
              />
            </div>
          </div>
        )}
      </Modal>

      {/* ── Create Modal ──────────────────────────────────────────────────────── */}
      <Modal isOpen={createOpen} onClose={() => { setCreateOpen(false); reset() }} title="Crear Nuevo Turno" size="2xl">
        <form onSubmit={handleSubmit(onCreate)} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Izquierda: Datos del turno */}
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
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
                <Select
                  label="Día *"
                  options={[
                    { value: '', label: 'Seleccionar...' },
                    ...DAYS.map(d => ({ value: d, label: DAY_LABELS[d] }))
                  ]}
                  error={errors.day?.message}
                  {...register('day')}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Input label="Hora inicio *" type="time" error={errors.startTime?.message} {...register('startTime')} />
                <Input label="Hora fin *"    type="time" error={errors.endTime?.message}   {...register('endTime')} />
              </div>

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
                    const isSelected = formClientIds.includes(c.id);
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
                            if (e.target.checked) setValue('clientIds', [...formClientIds, c.id], { shouldValidate: true })
                            else setValue('clientIds', formClientIds.filter(id => id !== c.id), { shouldValidate: true })
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
                              setValue('clientIds', formClientIds.filter(id => id !== c.id), { shouldValidate: true })
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
