/**
 * AusenciaGrupoPage — Detalle de un grupo de ausencias con asignación de recupero individual.
 * Ruta: /clients/:id/ausencias-grupo?ids=uuid1,uuid2,...
 * Diseño: sigue el mismo patrón que AusenciaPage (pageVariants, glassmorphism).
 */
import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { pageVariants } from '../lib/motion'
import { format, addDays, parseISO, isValid } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  ArrowLeft, CalendarX2, CalendarCheck2, Users,
  CheckCircle2, ChevronDown, Loader2, Bell, BellOff,
} from 'lucide-react'
import { reposicionesApi } from '../api/reposiciones.api'
import { clientsApi } from '../api/clients.api'
import { shiftsApi } from '../api/shifts.api'
import { useUiStore } from '../store/uiStore'
import type { AusenciaTurno, CupoInfo } from '../types/reposicion.types'
import type { Shift } from '../types/shift.types'
import type { Client } from '../types/client.types'

// ─── Helpers ────────────────────────────────────────────────────────────────
const DIA_ES_TO_DOW: Record<string, number> = {
  domingo: 0, lunes: 1, martes: 2, miercoles: 3, 'miércoles': 3,
  jueves: 4, viernes: 5, sabado: 6, 'sábado': 6,
}

const WEEKDAY_TO_DIA_ES: Record<string, string> = {
  monday: 'lunes', tuesday: 'martes', wednesday: 'miercoles',
  thursday: 'jueves', friday: 'viernes', saturday: 'sabado', sunday: 'domingo',
}

function shiftDows(t: { days?: string[]; diasSemana?: string[] }): number[] {
  const dias: string[] = (t.diasSemana && t.diasSemana.length > 0)
    ? t.diasSemana
    : (t.days ?? []).map(d => WEEKDAY_TO_DIA_ES[d] ?? d)
  return dias.map(d => DIA_ES_TO_DOW[d.toLowerCase()] ?? -1).filter(n => n >= 0)
}

const DIA_LABEL: Record<string, string> = {
  lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles', 'miércoles': 'Miércoles',
  jueves: 'Jueves', viernes: 'Viernes', sabado: 'Sábado', 'sábado': 'Sábado', domingo: 'Domingo',
}
function diasStr(dias: string[]) {
  return dias.map(d => DIA_LABEL[d.toLowerCase()] ?? d).join(' · ')
}

function todayStr() {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`
}

function fmtDate(raw: string | null | undefined, pat: string): string {
  if (!raw) return '—'
  try {
    const d = parseISO(raw.slice(0, 10) + 'T12:00:00')
    return isValid(d) ? format(d, pat, { locale: es }) : '—'
  } catch { return '—' }
}

const EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1]

// Estado de recuperación por ausencia
interface RecupState {
  expanded: boolean
  fechaRecup: string
  turnoSeleccionado: string | null
  notas: string
  saving: boolean
  done: boolean // ya se guardó exitosamente
}

// ─── Componente principal ───────────────────────────────────────────────────
export default function AusenciaGrupoPage() {
  const { id: clientId } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const addToast = useUiStore(s => s.addToast)

  const ausenciaIds = useMemo(
    () => (searchParams.get('ids') ?? '').split(',').filter(Boolean),
    [searchParams]
  )

  const [client, setClient] = useState<Client | null>(null)
  const [ausencias, setAusencias] = useState<AusenciaTurno[]>([])
  const [loading, setLoading] = useState(true)

  // Turnos disponibles para recuperar
  const [turnos, setTurnos] = useState<Shift[]>([])
  const [loadingTurnos, setLoadingTurnos] = useState(false)

  // Cupos por turno, indexados por fecha → turnoId
  const [cuposCache, setCuposCache] = useState<Record<string, Record<string, CupoInfo>>>({})
  const [loadingCupos, setLoadingCupos] = useState<Set<string>>(new Set())

  // Estado de recuperación individual por ausencia ID
  const [recupStates, setRecupStates] = useState<Record<string, RecupState>>({})

  // ── Cargar datos iniciales ──────────────────────────────────────────────
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })

    if (!clientId) return

    const loadAll = async () => {
      setLoading(true)
      try {
        const [clientData, allAusencias, turnosData] = await Promise.all([
          clientsApi.getById(clientId),
          reposicionesApi.getAll({ clienteId: clientId }),
          shiftsApi.getAll(),
        ])
        setClient(clientData)
        setTurnos(turnosData)

        // Filtrar solo las ausencias con IDs solicitados
        const filtered = allAusencias.filter(a => ausenciaIds.includes(a.id))
        // Ordenar por fecha ascendente
        filtered.sort((a, b) => a.fecha.slice(0, 10).localeCompare(b.fecha.slice(0, 10)))
        setAusencias(filtered)

        // Inicializar estado de recup para cada ausencia
        const initial: Record<string, RecupState> = {}
        for (const a of filtered) {
          initial[a.id] = {
            expanded: false,
            fechaRecup: todayStr(),
            turnoSeleccionado: null,
            notas: '',
            saving: false,
            done: !!a.recuperacion && a.recuperacion.estado !== 'CANCELADA',
          }
        }
        setRecupStates(initial)
      } catch {
        addToast({ type: 'error', message: 'Error al cargar las ausencias' })
      } finally {
        setLoading(false)
      }
    }

    void loadAll()
  }, [clientId, ausenciaIds.join(',')])

  // ── Slots ya usados por otras ausencias (fecha|turnoId) ─────────────────
  // Evita que dos ausencias del grupo se recuperen en el mismo turno+fecha
  const usedSlots = useMemo(() => {
    const set = new Set<string>()
    for (const [ausId, s] of Object.entries(recupStates)) {
      if (s.turnoSeleccionado && !s.done) {
        set.add(`${s.fechaRecup}|${s.turnoSeleccionado}|${ausId}`)
      }
    }
    // También incluir recuperaciones ya confirmadas (done)
    for (const a of ausencias) {
      if (a.recuperacion && a.recuperacion.estado !== 'CANCELADA') {
        set.add(`${a.recuperacion.fecha.slice(0, 10)}|${a.recuperacion.turnoDestinoId}|${a.id}`)
      }
    }
    return set
  }, [recupStates, ausencias])

  // ── Fechas ya tomadas por otra ausencia del grupo ─────────────────────
  // Si la ausencia A eligió recuperar el lunes 3, esa fecha NO aparece como pill para B, C, etc.
  const usedDatesByAusencia = useMemo(() => {
    const map = new Map<string, string>() // fecha → ausenciaId que la tomó
    for (const [ausId, s] of Object.entries(recupStates)) {
      if (s.turnoSeleccionado && s.fechaRecup) {
        map.set(s.fechaRecup, ausId)
      }
    }
    // Recuperaciones ya confirmadas
    for (const a of ausencias) {
      if (a.recuperacion && a.recuperacion.estado !== 'CANCELADA') {
        map.set(a.recuperacion.fecha.slice(0, 10), a.id)
      }
    }
    return map
  }, [recupStates, ausencias])

  function isDateTakenByOther(fecha: string, currentAusenciaId: string): boolean {
    const owner = usedDatesByAusencia.get(fecha)
    return !!owner && owner !== currentAusenciaId
  }

  // Chequea si un turno+fecha ya fue tomado por OTRA ausencia
  function isSlotTaken(fecha: string, turnoId: string, currentAusenciaId: string): boolean {
    for (const entry of usedSlots) {
      const [f, t, aId] = entry.split('|')
      if (f === fecha && t === turnoId && aId !== currentAusenciaId) return true
    }
    return false
  }

  // ── Rango continuo de ausencias del grupo (excluido del picker de recuperación) ──
  // Si las ausencias van del 10/7 al 7/8, TODAS las fechas entre esas dos se excluyen
  const fechasExcluidasSet = useMemo(() => {
    if (ausencias.length === 0) return new Set<string>()
    const sorted = ausencias.map(a => a.fecha.slice(0, 10)).sort()
    const minDate = sorted[0]
    const maxDate = sorted[sorted.length - 1]
    const set = new Set<string>()
    let cur = new Date(minDate + 'T12:00:00')
    const end = new Date(maxDate + 'T12:00:00')
    while (cur <= end) {
      const y = cur.getFullYear()
      const m = String(cur.getMonth() + 1).padStart(2, '0')
      const d = String(cur.getDate()).padStart(2, '0')
      set.add(`${y}-${m}-${d}`)
      cur.setDate(cur.getDate() + 1)
    }
    return set
  }, [ausencias])

  // ── Fechas de recuperación válidas ────────────────────────────────────
  // Excluye: fechas donde solo opera el turno propio + rango de ausencia del grupo
  // Ventana: desde hoy hasta 28 días después del fin del rango de ausencias
  const fechasRecupPorTurnoOrigen = useMemo(() => {
    const origenIds = new Set(ausencias.map(a => a.inscripcion?.turno?.id).filter(Boolean) as string[])

    // Turnos donde el cliente puede recuperar (no su propio turno)
    const turnosDisponibles = turnos.filter(t => !origenIds.has(t.id))
    if (turnosDisponibles.length === 0) return []

    const dows = new Set<number>()
    turnosDisponibles.forEach(t => shiftDows(t).forEach(d => dows.add(d)))

    const today = new Date(); today.setHours(0, 0, 0, 0)
    // Extender la ventana: 28 días después de la última ausencia del grupo
    const sortedFechas = ausencias.map(a => a.fecha.slice(0, 10)).sort()
    const maxAusencia = sortedFechas.length > 0 ? new Date(sortedFechas[sortedFechas.length - 1] + 'T12:00:00') : today
    const limitBase = maxAusencia > today ? maxAusencia : today
    const hasta = addDays(limitBase, 28)

    const result: string[] = []
    let cur = new Date(today)
    while (cur <= hasta) {
      if (dows.has(cur.getDay())) {
        const y = cur.getFullYear()
        const m = String(cur.getMonth() + 1).padStart(2, '0')
        const d = String(cur.getDate()).padStart(2, '0')
        const dateStr = `${y}-${m}-${d}`
        if (!fechasExcluidasSet.has(dateStr)) {
          result.push(dateStr)
        }
      }
      cur = addDays(cur, 1)
    }
    return result
  }, [turnos, ausencias, fechasExcluidasSet])

  // Inicializar fechaRecup de cada ausencia a la primera fecha válida
  useEffect(() => {
    if (fechasRecupPorTurnoOrigen.length === 0) return
    setRecupStates(prev => {
      const next = { ...prev }
      for (const key of Object.keys(next)) {
        if (!fechasRecupPorTurnoOrigen.includes(next[key].fechaRecup)) {
          next[key] = { ...next[key], fechaRecup: fechasRecupPorTurnoOrigen[0] }
        }
      }
      return next
    })
  }, [fechasRecupPorTurnoOrigen])

  // ── Cargar cupos para una fecha ─────────────────────────────────────────
  const cargarCupos = useCallback(async (fecha: string) => {
    if (!fecha || turnos.length === 0) return
    if (cuposCache[fecha]) return // ya cargado

    setLoadingCupos(prev => new Set(prev).add(fecha))
    try {
      const results = await Promise.allSettled(
        turnos.map(t => reposicionesApi.getCupo(t.id, fecha).then(c => ({ id: t.id, cupo: c })))
      )
      const map: Record<string, CupoInfo> = {}
      results.forEach(r => { if (r.status === 'fulfilled') map[r.value.id] = r.value.cupo })
      setCuposCache(prev => ({ ...prev, [fecha]: map }))
    } catch { /* silencioso */ }
    setLoadingCupos(prev => {
      const next = new Set(prev)
      next.delete(fecha)
      return next
    })
  }, [turnos, cuposCache])

  // ── Helpers de estado ───────────────────────────────────────────────────
  function updateRecup(ausenciaId: string, patch: Partial<RecupState>) {
    setRecupStates(prev => ({
      ...prev,
      [ausenciaId]: { ...prev[ausenciaId], ...patch },
    }))
  }

  function toggleExpanded(ausenciaId: string) {
    setRecupStates(prev => {
      const cur = prev[ausenciaId]
      if (!cur) return prev
      const willExpand = !cur.expanded
      // Al expandir, cargar cupos para la fecha seleccionada
      if (willExpand) void cargarCupos(cur.fechaRecup)
      return { ...prev, [ausenciaId]: { ...cur, expanded: willExpand } }
    })
  }

  function handleFechaChange(ausenciaId: string, fecha: string) {
    updateRecup(ausenciaId, { fechaRecup: fecha, turnoSeleccionado: null })
    void cargarCupos(fecha)
  }

  // ── Guardar recuperación individual ─────────────────────────────────────
  async function handleGuardarRecup(ausenciaId: string) {
    const state = recupStates[ausenciaId]
    if (!state || !state.turnoSeleccionado) return

    updateRecup(ausenciaId, { saving: true })
    try {
      const recup = await reposicionesApi.createRecuperacion(ausenciaId, {
        turnoDestinoId: state.turnoSeleccionado,
        fecha: state.fechaRecup,
        notas: state.notas || undefined,
      })
      // Actualizar la ausencia con la recuperación
      setAusencias(prev => prev.map(a =>
        a.id === ausenciaId ? { ...a, recuperacion: recup } : a
      ))
      updateRecup(ausenciaId, { saving: false, done: true, expanded: false })
      addToast({ type: 'success', message: `Recuperación agendada — ${fmtDate(state.fechaRecup, "d 'de' MMMM")}` })
    } catch (e: any) {
      addToast({ type: 'error', message: e?.response?.data?.message ?? 'Error al agendar recuperación' })
      updateRecup(ausenciaId, { saving: false })
    }
  }

  // ── Guardar todos los pendientes ────────────────────────────────────────
  const pendientesConTurno = useMemo(() =>
    ausencias.filter(a => {
      const s = recupStates[a.id]
      return s && !s.done && s.turnoSeleccionado && s.expanded
    }),
    [ausencias, recupStates]
  )

  async function handleGuardarTodos() {
    if (pendientesConTurno.length === 0) return
    const results = await Promise.allSettled(
      pendientesConTurno.map(a => {
        const s = recupStates[a.id]
        updateRecup(a.id, { saving: true })
        return reposicionesApi.createRecuperacion(a.id, {
          turnoDestinoId: s.turnoSeleccionado!,
          fecha: s.fechaRecup,
          notas: s.notas || undefined,
        }).then(recup => ({ ausenciaId: a.id, recup }))
      })
    )

    let okCount = 0
    for (const r of results) {
      if (r.status === 'fulfilled') {
        okCount++
        setAusencias(prev => prev.map(a =>
          a.id === r.value.ausenciaId ? { ...a, recuperacion: r.value.recup } : a
        ))
        updateRecup(r.value.ausenciaId, { saving: false, done: true, expanded: false })
      }
    }
    const errCount = results.filter(r => r.status === 'rejected').length
    for (const a of pendientesConTurno) {
      if (results.find(r => r.status === 'rejected')) {
        updateRecup(a.id, { saving: false })
      }
    }
    if (okCount > 0) {
      addToast({ type: 'success', message: `${okCount} recuperación${okCount !== 1 ? 'es' : ''} agendada${okCount !== 1 ? 's' : ''}${errCount > 0 ? ` (${errCount} fallaron)` : ''}` })
    } else {
      addToast({ type: 'error', message: 'No se pudo agendar ninguna recuperación' })
    }
  }

  // ── Helpers de cupo ─────────────────────────────────────────────────────
  function cupoDisponible(fecha: string, turnoId: string) {
    const c = cuposCache[fecha]?.[turnoId]
    return c ? c.cupoDisponibleA + c.cupoDisponibleB : 0
  }
  function cupoColor(fecha: string, turnoId: string) {
    const n = cupoDisponible(fecha, turnoId)
    if (n === 0) return 'text-red-500'
    if (n <= 2) return 'text-amber-500'
    return 'text-emerald-500'
  }

  // ── Estadísticas del grupo ──────────────────────────────────────────────
  const conAvisoCount = ausencias.filter(a => a.conAviso).length
  const sinAvisoCount = ausencias.length - conAvisoCount
  const yaRecuperadas = ausencias.filter(a => recupStates[a.id]?.done).length
  const pendientes = ausencias.length - yaRecuperadas

  const clienteNombre = client ? `${client.name} ${client.lastName}` : ''

  const rangoLabel = useMemo(() => {
    if (ausencias.length === 0) return ''
    const fechas = ausencias.map(a => a.fecha.slice(0, 10)).sort()
    const min = fechas[0]
    const max = fechas[fechas.length - 1]
    if (min === max) return fmtDate(min, "EEEE d 'de' MMMM yyyy")
    return `${fmtDate(min, "d 'de' MMMM")} – ${fmtDate(max, "d 'de' MMMM yyyy")}`
  }, [ausencias])

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <motion.div {...pageVariants} className="space-y-6">

      {/* Breadcrumb */}
      <button
        onClick={() => navigate(`/clients/${clientId}`)}
        className="group flex items-center gap-2 text-sm text-gray-400 dark:text-[#5A5A6A] hover:text-gray-900 dark:hover:text-white transition-colors"
      >
        <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
        Volver al perfil{clienteNombre ? ` de ${clienteNombre}` : ''}
      </button>

      {/* Header */}
      <div>
        <h1 className="text-3xl md:text-4xl font-black tracking-tighter text-gray-900 dark:text-white leading-none">
          Grupo de ausencias
        </h1>
        <p className="text-sm text-gray-500 dark:text-[#6A6A7A] mt-2 capitalize">
          {rangoLabel} · {ausencias.length} ausencia{ausencias.length !== 1 ? 's' : ''}
        </p>
      </div>

      {loading ? (
        <div className="rounded-[2rem] border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-3xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
          <div className="h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin text-primary" />
          </div>
        </div>
      ) : ausencias.length === 0 ? (
        <div className="rounded-[2rem] border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-3xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
          <div className="h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <CalendarX2 size={28} className="text-gray-300 dark:text-[#444] mb-3" />
            <p className="text-sm font-bold text-gray-700 dark:text-gray-300">No se encontraron ausencias</p>
            <p className="text-xs text-gray-400 dark:text-[#666] mt-1">Es posible que hayan sido eliminadas.</p>
          </div>
        </div>
      ) : (
        <>
          {/* Resumen del grupo */}
          <div className="rounded-[2rem] border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-3xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
            <div className="h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
            <div className="p-5 md:p-6">
              <div className="flex items-center gap-4 flex-wrap">
                {/* Cliente */}
                {client && (
                  <div className="flex items-center gap-2.5">
                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-xs font-black text-primary">
                        {client.name[0]}{client.lastName[0]}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-gray-900 dark:text-white truncate">
                        {client.name} {client.lastName}
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex-1" />

                {/* Badges resumen */}
                <div className="flex items-center gap-2 flex-wrap">
                  {conAvisoCount > 0 && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400">
                      <Bell size={10} /> {conAvisoCount} c/aviso
                    </span>
                  )}
                  {sinAvisoCount > 0 && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-50 dark:bg-red-500/10 text-red-500 dark:text-red-400">
                      <BellOff size={10} /> {sinAvisoCount} s/aviso
                    </span>
                  )}
                  {yaRecuperadas > 0 && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 size={10} /> {yaRecuperadas} recuperada{yaRecuperadas !== 1 ? 's' : ''}
                    </span>
                  )}
                  {pendientes > 0 && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400">
                      {pendientes} pendiente{pendientes !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Lista de ausencias con recuperación individual */}
          <div className="space-y-3">
            {ausencias.map((a, idx) => {
              const state = recupStates[a.id]
              if (!state) return null
              const hasRecup = !!a.recuperacion && a.recuperacion.estado !== 'CANCELADA'
              const turnoOrigen = a.inscripcion?.turno

              return (
                <motion.div
                  key={a.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0, transition: { delay: idx * 0.04, duration: 0.25, ease: EASE_OUT } }}
                  className="rounded-2xl border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-3xl overflow-hidden shadow-[0_4px_16px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.2)]"
                >
                  {/* Card header — ausencia */}
                  <div className="px-5 py-4">
                    <div className="flex items-start gap-3">
                      {/* Dot + número */}
                      <div className="flex flex-col items-center gap-1 shrink-0 pt-0.5">
                        <div className={`h-2.5 w-2.5 rounded-full ${a.conAviso ? 'bg-blue-500' : 'bg-red-400'}`} />
                        <span className="text-[9px] font-bold text-gray-300 dark:text-[#444]">#{idx + 1}</span>
                      </div>

                      {/* Info ausencia */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-black text-gray-900 dark:text-white capitalize leading-tight">
                            {fmtDate(a.fecha, "EEEE d 'de' MMMM")}
                          </p>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                            a.conAviso ? 'bg-blue-500/10 text-blue-500' : 'bg-red-400/10 text-red-400'
                          }`}>
                            {a.conAviso ? 'c/aviso' : 's/aviso'}
                          </span>
                        </div>

                        {/* Turno origen */}
                        {turnoOrigen && (
                          <p className="text-xs text-gray-400 dark:text-[#6A6A7A] mt-0.5">
                            Turno: {turnoOrigen.horaInicio} – {turnoOrigen.horaFin}
                            {turnoOrigen.diasSemana?.length > 0 && (
                              <> · {diasStr(turnoOrigen.diasSemana)}</>
                            )}
                          </p>
                        )}

                        {a.notas && (
                          <p className="text-[11px] text-gray-500 dark:text-[#8A8A9A] mt-1 leading-snug">{a.notas}</p>
                        )}

                        {/* Estado de recuperación */}
                        {hasRecup && a.recuperacion && (
                          <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/[0.08] border border-emerald-100 dark:border-emerald-500/20">
                            <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                                {a.recuperacion.estado === 'COMPLETADA' ? 'Recuperada' : 'Recuperación agendada'}
                              </p>
                              <p className="text-[11px] text-emerald-600/70 dark:text-emerald-400/60 capitalize">
                                {fmtDate(a.recuperacion.fecha, "EEEE d 'de' MMMM")}
                                {a.recuperacion.turnoDestino && (
                                  <> · {a.recuperacion.turnoDestino.horaInicio} – {a.recuperacion.turnoDestino.horaFin}</>
                                )}
                              </p>
                            </div>
                          </div>
                        )}

                        {state.done && !hasRecup && (
                          <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/[0.08] border border-emerald-100 dark:border-emerald-500/20">
                            <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                            <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">Recuperación agendada</p>
                          </div>
                        )}
                      </div>

                      {/* Botón expandir para agendar recupero */}
                      {!state.done && a.conAviso && (
                        <button
                          onClick={() => toggleExpanded(a.id)}
                          className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all duration-200 active:scale-[0.97] ${
                            state.expanded
                              ? 'bg-primary/10 text-primary border border-primary/20'
                              : 'bg-gray-100 dark:bg-white/[0.06] text-gray-500 dark:text-[#8A8A9A] border border-gray-200 dark:border-white/[0.08] hover:border-gray-300 dark:hover:border-white/[0.14]'
                          }`}
                        >
                          <CalendarCheck2 size={13} />
                          Recuperar
                          <ChevronDown size={12} className={`transition-transform duration-200 ${state.expanded ? 'rotate-180' : ''}`} />
                        </button>
                      )}

                      {/* Indicador "sin aviso" — no se puede recuperar */}
                      {!a.conAviso && !state.done && (
                        <span className="shrink-0 text-[10px] font-semibold text-gray-400 dark:text-[#555] bg-gray-100 dark:bg-white/[0.04] px-2.5 py-1.5 rounded-lg">
                          Sin crédito
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Panel expandible — selector de recuperación */}
                  <AnimatePresence>
                    {state.expanded && !state.done && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1, transition: { duration: 0.25, ease: EASE_OUT } }}
                        exit={{ height: 0, opacity: 0, transition: { duration: 0.2, ease: EASE_OUT } }}
                        className="overflow-hidden"
                      >
                        <div className="px-5 pb-5 pt-1 border-t border-gray-100 dark:border-white/[0.05]">
                          <RecuperacionSelector
                            ausenciaId={a.id}
                            turnoOrigenId={turnoOrigen?.id}
                            state={state}
                            turnos={turnos}
                            fechasRecupPorTurnoOrigen={fechasRecupPorTurnoOrigen}
                            cuposCache={cuposCache}
                            loadingCupos={loadingCupos}
                            loadingTurnos={loadingTurnos}
                            cupoDisponible={cupoDisponible}
                            cupoColor={cupoColor}
                            isSlotTaken={isSlotTaken}
                            isDateTakenByOther={isDateTakenByOther}
                            onFechaChange={handleFechaChange}
                            onTurnoSelect={(id, turnoId) => updateRecup(id, { turnoSeleccionado: turnoId })}
                            onNotasChange={(id, notas) => updateRecup(id, { notas })}
                            onGuardar={handleGuardarRecup}
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )
            })}
          </div>

          {/* Botón guardar todos */}
          {pendientesConTurno.length > 1 && (
            <div className="flex justify-end">
              <button
                onClick={handleGuardarTodos}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-black font-bold text-sm shadow-[0_0_24px_rgba(251,198,8,0.3)] hover:shadow-[0_0_32px_rgba(251,198,8,0.45)] active:scale-[0.97] transition-all duration-200"
              >
                <CalendarCheck2 size={16} />
                Agendar {pendientesConTurno.length} recuperaciones
              </button>
            </div>
          )}

          {/* Botón volver cuando todo está resuelto */}
          {pendientes === 0 && ausencias.length > 0 && (
            <div className="flex justify-center pt-2">
              <button
                onClick={() => navigate(`/clients/${clientId}`)}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-500 text-white font-bold text-sm shadow-lg hover:bg-emerald-600 active:scale-[0.97] transition-all duration-200"
              >
                <CheckCircle2 size={16} />
                Todas las ausencias están resueltas — Volver al perfil
              </button>
            </div>
          )}
        </>
      )}
    </motion.div>
  )
}

// ─── Componente de selección de recuperación (reutilizado por ausencia) ────
interface RecuperacionSelectorProps {
  ausenciaId: string
  turnoOrigenId?: string
  state: RecupState
  turnos: Shift[]
  fechasRecupPorTurnoOrigen: string[]
  cuposCache: Record<string, Record<string, CupoInfo>>
  loadingCupos: Set<string>
  loadingTurnos: boolean
  cupoDisponible: (fecha: string, turnoId: string) => number
  cupoColor: (fecha: string, turnoId: string) => string
  isSlotTaken: (fecha: string, turnoId: string, currentAusenciaId: string) => boolean
  isDateTakenByOther: (fecha: string, currentAusenciaId: string) => boolean
  onFechaChange: (ausenciaId: string, fecha: string) => void
  onTurnoSelect: (ausenciaId: string, turnoId: string | null) => void
  onNotasChange: (ausenciaId: string, notas: string) => void
  onGuardar: (ausenciaId: string) => void
}

function RecuperacionSelector({
  ausenciaId, turnoOrigenId, state, turnos, fechasRecupPorTurnoOrigen,
  cuposCache, loadingCupos, loadingTurnos,
  cupoDisponible, cupoColor, isSlotTaken, isDateTakenByOther,
  onFechaChange, onTurnoSelect, onNotasChange, onGuardar,
}: RecuperacionSelectorProps) {
  const { fechaRecup, turnoSeleccionado, notas, saving } = state
  const isLoadingCupos = loadingCupos.has(fechaRecup)
  const cupos = cuposCache[fechaRecup] ?? {}

  // Fechas disponibles para esta ausencia (excluye las tomadas por otras del grupo)
  const fechasDisponibles = fechasRecupPorTurnoOrigen.filter(
    f => !isDateTakenByOther(f, ausenciaId)
  )

  // Filtrar turnos del día seleccionado, excluyendo el turno origen
  const diaFechaIdx = fechaRecup ? parseISO(fechaRecup + 'T12:00:00').getDay() : null
  const turnosDelDia = (diaFechaIdx !== null
    ? turnos.filter(t => shiftDows(t).includes(diaFechaIdx))
    : turnos
  ).filter(t => t.id !== turnoOrigenId)

  const turnosDisponibles = turnosDelDia.filter(t => {
    // Excluir slots ya tomados por otra ausencia del grupo
    if (isSlotTaken(fechaRecup, t.id, ausenciaId)) return false
    if (isLoadingCupos || !cupos[t.id]) return true
    return cupoDisponible(fechaRecup, t.id) > 0
  })

  // Turnos tomados por otra ausencia del grupo en esta fecha
  const turnosTomados = turnosDelDia.filter(t => isSlotTaken(fechaRecup, t.id, ausenciaId))

  const cuposListos = Object.keys(cupos).length > 0 && !isLoadingCupos
  const sinTurnosEseDia = !loadingTurnos && fechaRecup && turnosDelDia.length === 0
  const todosLlenos = cuposListos && turnosDelDia.length > 0 && turnosDisponibles.length === 0

  return (
    <div className="space-y-4 pt-3">
      {/* 1. Fecha */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-[#6A6A7A] flex items-center gap-1.5">
          <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-black text-black">1</span>
          Fecha de recuperación
        </label>
        {fechasDisponibles.length > 0 ? (
          <div className="grid grid-cols-4 sm:grid-cols-5 lg:grid-cols-7 gap-1.5">
            {fechasDisponibles.map(f => {
              const isSelected = fechaRecup === f
              const isToday = f === todayStr()
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => onFechaChange(ausenciaId, f)}
                  className={`flex flex-col items-center py-2 px-0.5 rounded-lg border text-center transition-all duration-150 active:scale-[0.97] ${
                    isSelected
                      ? 'bg-gradient-to-br from-[rgba(251,198,8,0.15)] via-[rgba(251,198,8,0.06)] to-transparent border-primary/40 dark:border-primary/30 shadow-[0_0_0_1px_rgba(251,198,8,0.15)]'
                      : 'bg-gray-50 dark:bg-white/[0.04] border-gray-200 dark:border-white/[0.08] hover:border-gray-300 dark:hover:border-white/[0.14]'
                  }`}
                >
                  <span className={`text-[9px] font-bold uppercase tracking-wider ${isSelected ? 'text-primary' : 'text-gray-400 dark:text-[#6A6A7A]'}`}>
                    {fmtDate(f, 'EEEE')}
                  </span>
                  <span className={`text-base font-black leading-tight ${isSelected ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                    {fmtDate(f, 'd')}
                  </span>
                  <span className={`text-[8px] font-semibold ${isSelected ? 'text-gray-500 dark:text-[#8A8A9A]' : 'text-gray-400 dark:text-[#555]'}`}>
                    {fmtDate(f, 'MMMM')}
                  </span>
                  {isToday && (
                    <span className="text-[7px] font-black uppercase tracking-wider text-primary">hoy</span>
                  )}
                </button>
              )
            })}
          </div>
        ) : (
          <input
            type="date"
            value={fechaRecup}
            min={todayStr()}
            onChange={e => onFechaChange(ausenciaId, e.target.value)}
            className="w-full rounded-xl py-2.5 px-3 text-sm bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.08] text-gray-900 dark:text-white focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
          />
        )}
      </div>

      {/* 2. Turno */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-[#6A6A7A] flex items-center gap-1.5">
          <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-black text-black">2</span>
          <Users size={10} /> Turno
          {isLoadingCupos && (
            <span className="ml-auto text-[10px] text-gray-400 flex items-center gap-1 font-normal normal-case tracking-normal">
              <Loader2 size={10} className="animate-spin" /> cargando...
            </span>
          )}
        </label>

        {loadingTurnos || (isLoadingCupos && Object.keys(cupos).length === 0) ? (
          <div className="space-y-1.5">
            {[1, 2].map(i => (
              <div key={i} className="h-[52px] rounded-xl bg-gray-100 dark:bg-white/[0.04] animate-pulse" />
            ))}
          </div>
        ) : sinTurnosEseDia ? (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08]">
            <CalendarX2 size={14} className="text-gray-400 shrink-0" />
            <p className="text-xs font-bold text-gray-500 dark:text-gray-400">Sin turnos este día</p>
          </div>
        ) : todosLlenos ? (
          <div className="space-y-2">
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-500/[0.08] border border-amber-200 dark:border-amber-500/20">
              <CalendarX2 size={14} className="text-amber-500 shrink-0" />
              <p className="text-xs font-bold text-amber-700 dark:text-amber-400">
                {turnosTomados.length > 0
                  ? 'Turnos ocupados o ya asignados a otra ausencia del grupo'
                  : 'Sin lugares disponibles'}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            {turnosDisponibles.map(t => {
              const cupoN = cupoDisponible(fechaRecup, t.id)
              const isSelected = turnoSeleccionado === t.id
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onTurnoSelect(ausenciaId, isSelected ? null : t.id)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-left transition-all duration-200 active:scale-[0.98] ${
                    isSelected
                      ? 'bg-gradient-to-br from-[rgba(251,198,8,0.10)] via-[rgba(251,198,8,0.04)] to-transparent dark:from-[rgba(251,198,8,0.08)] border-primary/40 dark:border-primary/30 shadow-[0_0_0_1px_rgba(251,198,8,0.15)]'
                      : 'bg-gray-50 dark:bg-white/[0.04] border-gray-200 dark:border-white/[0.08] hover:border-gray-300 dark:hover:border-white/[0.14]'
                  }`}
                >
                  <div className="min-w-0">
                    <p className={`text-sm font-bold ${isSelected ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-200'}`}>
                      {t.startTime} – {t.endTime}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-[#6A6A7A] mt-0.5">
                      {diasStr(
                        (t as any).diasSemana ??
                        t.days.map((d: string) => {
                          const m: Record<string, string> = { monday:'lunes',tuesday:'martes',wednesday:'miércoles',thursday:'jueves',friday:'viernes',saturday:'sábado',sunday:'domingo' }
                          return m[d] ?? d
                        })
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    {cupos[t.id] && !isLoadingCupos ? (
                      <span className={`text-xs font-bold ${cupoColor(fechaRecup, t.id)}`}>
                        {cupoN} lugar{cupoN !== 1 ? 'es' : ''}
                      </span>
                    ) : isLoadingCupos ? (
                      <Loader2 size={12} className="animate-spin text-gray-300" />
                    ) : null}
                    {isSelected && (
                      <motion.div
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.15, ease: EASE_OUT }}
                      >
                        <CheckCircle2 size={15} className="text-primary" />
                      </motion.div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Notas + guardar */}
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <input
            type="text"
            value={notas}
            onChange={e => onNotasChange(ausenciaId, e.target.value)}
            placeholder="Notas (opcional)"
            className="w-full rounded-xl py-2.5 px-3 text-xs bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.08] text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-white/30 focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
          />
        </div>
        <button
          onClick={() => onGuardar(ausenciaId)}
          disabled={!turnoSeleccionado || saving}
          className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-black text-xs font-bold shadow-[0_0_16px_rgba(251,198,8,0.25)] hover:shadow-[0_0_24px_rgba(251,198,8,0.4)] active:scale-[0.97] transition-all duration-200 disabled:opacity-40 disabled:shadow-none disabled:cursor-not-allowed"
        >
          {saving ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
          Confirmar
        </button>
      </div>
    </div>
  )
}
