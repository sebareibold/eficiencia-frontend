import { useMemo, useState } from 'react'
import {
  CalendarDays, Repeat2, LayoutGrid, List,
  ChevronLeft, ChevronRight, Zap, ExternalLink,
} from 'lucide-react'
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, startOfWeek, endOfWeek, getDay } from 'date-fns'
import { es } from 'date-fns/locale'
import type { TurnoResumen } from '../../api/usuarios.api'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TurnoDisplayItem extends TurnoResumen {
  salas: ('A' | 'B')[]
}

export type TurnoViewMode = 'grid' | 'list' | 'calendar'

export const VIEW_MODES: { mode: TurnoViewMode; icon: typeof LayoutGrid; label: string }[] = [
  { mode: 'grid',     icon: LayoutGrid,  label: 'Grilla' },
  { mode: 'list',     icon: List,         label: 'Listado' },
  { mode: 'calendar', icon: CalendarDays, label: 'Calendario' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

export function buildTurnosDisplay(
  salaA: TurnoResumen[],
  salaB: TurnoResumen[],
): TurnoDisplayItem[] {
  const salaAIds = new Set(salaA.map(t => t.id))
  const salaBIds = new Set(salaB.map(t => t.id))
  const allIds   = new Set([...salaAIds, ...salaBIds])

  return Array.from(allIds).map(id => {
    const t = salaA.find(x => x.id === id) ?? salaB.find(x => x.id === id)!
    const salas: ('A' | 'B')[] = []
    if (salaAIds.has(id)) salas.push('A')
    if (salaBIds.has(id)) salas.push('B')
    return { ...t, salas }
  })
}

const DIAS_SEMANA = [
  { key: 'lunes',      label: 'Lunes' },
  { key: 'martes',     label: 'Martes' },
  { key: 'miércoles',  label: 'Miércoles' },
  { key: 'jueves',     label: 'Jueves' },
  { key: 'viernes',    label: 'Viernes' },
  { key: 'sábado',     label: 'Sábado' },
]

function normDia(d: string) {
  return d.toLowerCase()
    .replace(/[áä]/g, 'a').replace(/[éë]/g, 'e').replace(/[íï]/g, 'i')
    .replace(/[óö]/g, 'o').replace(/[úü]/g, 'u')
}

const WEEKDAY_TO_JS: Record<string, number> = {
  lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6, domingo: 0,
}

function turnosParaDia(turnos: TurnoDisplayItem[], diaKey: string): TurnoDisplayItem[] {
  const norm = normDia(diaKey)
  return turnos.filter(t =>
    (Array.isArray(t.diasSemana) ? t.diasSemana : []).some(d => normDia(d) === norm)
  )
}

function getTurnosForDate(turnos: TurnoDisplayItem[], date: Date): TurnoDisplayItem[] {
  const jsDay = getDay(date)
  const dateStr = format(date, 'yyyy-MM-dd')
  return turnos.filter(t => {
    if (!t.recurrente && t.fechaPuntual === dateStr) return true
    if (t.recurrente) {
      const dias = Array.isArray(t.diasSemana) ? t.diasSemana : []
      return dias.some(d => WEEKDAY_TO_JS[normDia(d)] === jsDay)
    }
    return false
  })
}

const DIAS_LABEL: Record<string, string> = {
  lunes: 'Lun', martes: 'Mar', miercoles: 'Mié', jueves: 'Jue', viernes: 'Vie', sabado: 'Sáb', domingo: 'Dom',
}

// ── SalaBadge ─────────────────────────────────────────────────────────────────

export function SalaBadge({ sala }: { sala: 'A' | 'B' }) {
  return sala === 'A'
    ? <span className="inline-flex items-center rounded-lg bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-primary">Sala A</span>
    : <span className="inline-flex items-center rounded-lg bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold text-blue-600 dark:text-blue-400">Sala B</span>
}

// ── TurnoCard ─────────────────────────────────────────────────────────────────

export function TurnoCard({ t, onNavigate }: {
  t: TurnoDisplayItem
  onNavigate: (id: string) => void
}) {
  const isExc = !t.recurrente
  return (
    <div
      className={`relative w-full text-left rounded-xl border overflow-hidden ${
        isExc
          ? 'border-amber-400/25 bg-amber-400/[0.04] dark:bg-amber-400/[0.03]'
          : 'border-white/30 dark:border-white/[0.08] bg-white/40 dark:bg-white/[0.04]'
      } px-2.5 py-2 space-y-1.5`}
    >
      {isExc && <div className="absolute inset-y-0 left-0 w-1 bg-amber-400 pointer-events-none" />}

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-black text-gray-900 dark:text-white leading-tight">
          {t.horaInicio} – {t.horaFin}
        </p>
        <div className="flex gap-1 shrink-0">
          {t.salas.map(s => <SalaBadge key={s} sala={s} />)}
        </div>
      </div>

      {isExc ? (
        <div className="flex items-center gap-1">
          <Zap size={8} className="text-amber-500 shrink-0" />
          <span className="text-[9px] font-bold text-amber-500 truncate">
            Excepcional
            {t.fechaPuntual && (
              <span className="ml-1 text-amber-500/70">
                · {format(parseISO(t.fechaPuntual), "d MMM", { locale: es })}
              </span>
            )}
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <Repeat2 size={8} className="text-orange-700 dark:text-orange-400 shrink-0" />
          <span className="text-[9px] font-bold text-orange-700 dark:text-orange-400">Recurrente</span>
        </div>
      )}

      <button
        onClick={() => onNavigate(t.id)}
        className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-white/50 dark:bg-white/[0.06] border border-white/40 dark:border-white/[0.08] px-2 py-1 text-[10px] font-bold text-gray-600 dark:text-gray-300 hover:bg-white/80 dark:hover:bg-white/[0.12] active:scale-[0.97] transition-all"
      >
        <ExternalLink size={10} />
        Ver turno
      </button>
    </div>
  )
}

// ── TurnosGrid ────────────────────────────────────────────────────────────────

export function TurnosGrid({ turnos, onNavigate }: {
  turnos: TurnoDisplayItem[]
  onNavigate: (id: string) => void
}) {
  const diasVisibles = useMemo(() => {
    const conTurnos = new Set<number>()
    const conExc    = new Set<number>()

    DIAS_SEMANA.forEach((d, i) => {
      const dt = turnosParaDia(turnos, d.key)
      if (dt.length > 0) conTurnos.add(i)
      if (dt.some(t => !t.recurrente)) conExc.add(i)
    })

    const visible = new Set(conTurnos)
    conExc.forEach(i => {
      if (i > 0) visible.add(i - 1)
      if (i < DIAS_SEMANA.length - 1) visible.add(i + 1)
    })

    return DIAS_SEMANA.filter((_, i) => visible.has(i))
  }, [turnos])

  return (
    <div className="p-4 overflow-x-auto">
      <div
        className="grid gap-3 min-w-[480px]"
        style={{ gridTemplateColumns: `repeat(${diasVisibles.length}, minmax(0, 1fr))` }}
      >
        {diasVisibles.map(({ key, label }) => {
          const dayTurnos = turnosParaDia(turnos, key)
          return (
            <div key={key} className="space-y-2">
              <div className="pb-1 border-b border-white/20 dark:border-white/[0.06]">
                <span className="text-[11px] font-extrabold uppercase tracking-widest text-gray-500 dark:text-[#8A8A9A]">
                  {label}
                </span>
              </div>
              <div className="space-y-1.5">
                {dayTurnos.length > 0
                  ? dayTurnos.map(t => <TurnoCard key={t.id} t={t} onNavigate={onNavigate} />)
                  : <p className="text-center text-[10px] text-gray-400 dark:text-[#6A6A7A] py-4">—</p>
                }
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── TurnosList ────────────────────────────────────────────────────────────────

export function TurnosList({ turnos, onNavigate }: {
  turnos: TurnoDisplayItem[]
  onNavigate: (id: string) => void
}) {
  const sorted = useMemo(() => {
    return [...turnos].sort((a, b) => {
      if (a.recurrente !== b.recurrente) return a.recurrente ? -1 : 1
      if (!a.recurrente && !b.recurrente) return (a.fechaPuntual ?? '').localeCompare(b.fechaPuntual ?? '')
      return a.horaInicio.localeCompare(b.horaInicio)
    })
  }, [turnos])

  return (
    <div className="divide-y divide-white/10 dark:divide-white/[0.04]">
      {sorted.map(t => {
        const isExc = !t.recurrente
        const dias = (Array.isArray(t.diasSemana) ? t.diasSemana : [])
          .map(d => DIAS_LABEL[normDia(d)] ?? d)
          .join(', ')
        return (
          <button
            key={t.id}
            onClick={() => onNavigate(t.id)}
            className={`relative w-full text-left flex items-center gap-4 px-5 py-3.5 hover:bg-white/30 dark:hover:bg-white/[0.04] transition-all overflow-hidden ${
              isExc ? 'bg-amber-400/[0.03]' : ''
            }`}
          >
            {isExc && <div className="absolute inset-y-0 left-0 w-1 bg-amber-400" />}
            <div className="w-28 shrink-0">
              <p className="text-sm font-black text-gray-900 dark:text-white">
                {t.horaInicio} – {t.horaFin}
              </p>
            </div>
            <div className="flex-1 min-w-0">
              {isExc ? (
                <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                  {t.fechaPuntual ? format(parseISO(t.fechaPuntual), "d MMM yyyy", { locale: es }) : 'Fecha única'}
                </span>
              ) : (
                <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">{dias}</span>
              )}
            </div>
            <div className="flex gap-1 shrink-0">
              {t.salas.map(s => <SalaBadge key={s} sala={s} />)}
            </div>
            {isExc ? (
              <span className="shrink-0 inline-flex items-center gap-1 rounded-full border border-amber-400/25 bg-amber-400/15 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                <Zap size={8} /> Excepcional
              </span>
            ) : (
              <span className="shrink-0 inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                <Repeat2 size={8} /> Recurrente
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ── TurnosCalendar ────────────────────────────────────────────────────────────

export function TurnosCalendar({ turnos, onNavigate, fechaCutoff }: {
  turnos: TurnoDisplayItem[]
  onNavigate: (id: string, dateStr?: string) => void
  fechaCutoff?: string | null
}) {
  const [month, setMonth] = useState(() => fechaCutoff ? startOfMonth(parseISO(fechaCutoff)) : startOfMonth(new Date()))

  const calendarDays = useMemo(() => {
    const calStart = startOfWeek(startOfMonth(month), { weekStartsOn: 1 })
    const calEnd   = endOfWeek(endOfMonth(month), { weekStartsOn: 1 })
    return eachDayOfInterval({ start: calStart, end: calEnd })
  }, [month])

  const todayStr = format(new Date(), 'yyyy-MM-dd')

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={() => setMonth(m => subMonths(m, 1))}
          className="h-8 w-8 flex items-center justify-center rounded-xl border border-white/30 dark:border-white/10 bg-white/40 dark:bg-white/[0.06] hover:bg-white/60 dark:hover:bg-white/10 transition-all"
        >
          <ChevronLeft size={14} />
        </button>
        <span className="text-sm font-bold text-gray-900 dark:text-white capitalize">
          {format(month, 'MMMM yyyy', { locale: es })}
        </span>
        <button onClick={() => setMonth(m => addMonths(m, 1))}
          className="h-8 w-8 flex items-center justify-center rounded-xl border border-white/30 dark:border-white/10 bg-white/40 dark:bg-white/[0.06] hover:bg-white/60 dark:hover:bg-white/10 transition-all"
        >
          <ChevronRight size={14} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-px">
        {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => (
          <div key={d} className="text-center text-[10px] font-extrabold uppercase tracking-widest text-gray-400 dark:text-[#6A6A7A] py-1.5">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-px rounded-2xl overflow-hidden border border-white/20 dark:border-white/[0.06]">
        {calendarDays.map(day => {
          const dateStr       = format(day, 'yyyy-MM-dd')
          const isCurrentMonth = day.getMonth() === month.getMonth()
          const isToday        = dateStr === todayStr
          const cutoffStr      = fechaCutoff?.slice(0, 10)
          const isPastCutoff   = cutoffStr && dateStr >= cutoffStr
          const dayTurnos      = isPastCutoff ? [] : getTurnosForDate(turnos, day)

          return (
            <div
              key={dateStr}
              className={`min-h-[80px] p-1.5 ${
                isCurrentMonth ? 'bg-white/20 dark:bg-white/[0.02]' : 'bg-white/5 dark:bg-transparent opacity-40'
              }`}
            >
              <div className={`text-[11px] font-bold mb-1 ${isToday ? 'text-primary' : 'text-gray-500 dark:text-[#6A6A7A]'}`}>
                {format(day, 'd')}
              </div>
              <div className="space-y-0.5">
                {dayTurnos.slice(0, 3).map(t => {
                  const isExc = !t.recurrente
                  return (
                    <button
                      key={t.id}
                      onClick={() => onNavigate(t.id, dateStr)}
                      className={`w-full text-left rounded-lg px-1.5 py-0.5 text-[9px] font-bold truncate transition-all hover:opacity-80 ${
                        isExc
                          ? 'bg-amber-400/15 text-amber-600 dark:text-amber-400 border border-amber-400/20'
                          : 'bg-primary/10 text-gray-700 dark:text-gray-300 border border-primary/15'
                      }`}
                    >
                      {isExc && <Zap size={7} className="inline mr-0.5 -mt-px" />}
                      {t.horaInicio}–{t.horaFin}
                    </button>
                  )
                })}
                {dayTurnos.length > 3 && (
                  <span className="block text-[8px] text-gray-400 dark:text-[#6A6A7A] font-bold text-center">
                    +{dayTurnos.length - 3} más
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
