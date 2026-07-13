/**
 * AusenciaPage — Flujo 2 pasos: registrar ausencia + agendar recuperación.
 * Ruta: /clients/:id/ausencia?inscripcionId=xxx
 * Diseño: sigue el mismo patrón que CreateClientPage (pageVariants, glassmorphism, stepper).
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { pageVariants } from '../lib/motion'
import { format, addDays, subDays, parseISO, isValid } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  ArrowLeft, CalendarX2, CalendarCheck2, Users,
  CheckCircle2, ChevronRight, Loader2, Bell, BellOff,
  Edit2, Trash2, AlertTriangle,
} from 'lucide-react'
import { reposicionesApi } from '../api/reposiciones.api'
import { clientsApi } from '../api/clients.api'
import { shiftsApi } from '../api/shifts.api'
import { useUiStore } from '../store/uiStore'
import type { AusenciaTurno, CupoInfo } from '../types/reposicion.types'
import type { Shift } from '../types/shift.types'
import type { Client } from '../types/client.types'

// ─── Helpers de fechas del turno ─────────────────────────────────────────────
const DIA_ES_TO_DOW: Record<string, number> = {
  domingo: 0, lunes: 1, martes: 2, miercoles: 3, 'miércoles': 3,
  jueves: 4, viernes: 5, sabado: 6, 'sábado': 6,
}

function generarFechasValidas(diasSemana: string[]): string[] {
  const dows = diasSemana.map(d => DIA_ES_TO_DOW[d.toLowerCase()]).filter(n => n !== undefined)
  if (dows.length === 0) return []
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const desde = subDays(today, 28) // últimas 4 semanas
  const hasta = addDays(today, 28)  // próximas 4 semanas
  const fechas: string[] = []
  let cur = new Date(desde)
  while (cur <= hasta) {
    if (dows.includes(cur.getDay())) {
      // Usar fecha local (no UTC) para evitar off-by-one en UTC-3/UTC+X
      const y = cur.getFullYear()
      const m = String(cur.getMonth() + 1).padStart(2, '0')
      const d = String(cur.getDate()).padStart(2, '0')
      fechas.push(`${y}-${m}-${d}`)
    }
    cur = addDays(cur, 1)
  }
  return fechas
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

const EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1]

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
  try { const d = parseISO(raw.slice(0, 10) + 'T12:00:00'); return isValid(d) ? format(d, pat, { locale: es }) : '—' } catch { return '—' }
}

const STEPS = [
  { id: 1, label: 'Ausencia' },
  { id: 2, label: 'Recuperación' },
]

const STEP_META_CREATE: Record<number, { Icon: typeof CalendarX2; title: string; description: string }> = {
  1: { Icon: CalendarX2,     title: 'Registrar ausencia',    description: 'Indicá la fecha y si el cliente avisó con anticipación' },
  2: { Icon: CalendarCheck2, title: 'Agendar recuperación',  description: 'Elegí el turno y la fecha en que va a recuperar la clase' },
}
const STEP_META_DETAIL: Record<number, { Icon: typeof CalendarX2; title: string; description: string }> = {
  1: { Icon: CalendarX2,     title: 'Detalle de ausencia',   description: 'Editá el aviso y las notas de esta ausencia' },
  2: { Icon: CalendarCheck2, title: 'Recuperación',           description: 'Detalle o modificación de la recuperación agendada' },
}

// ─── Input classes (igual a CreateClientPage) ─────────────────────────────────
const ic = () => [
  'w-full rounded-xl py-3 px-4 text-sm transition-all duration-200',
  'bg-gray-50 dark:bg-white/[0.05]',
  'border border-gray-200 dark:border-white/[0.08]',
  'text-gray-900 dark:text-white',
  'placeholder:text-gray-400 dark:placeholder:text-white/30',
  'focus:outline-none focus:bg-white dark:focus:bg-white/[0.08]',
  'focus:border-primary/50 dark:focus:border-primary/40',
  'focus:ring-2 focus:ring-primary/10',
].join(' ')

export default function AusenciaPage() {
  const { id: clientId } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const inscripcionId = searchParams.get('inscripcionId') ?? ''
  const ausenciaId    = searchParams.get('ausenciaId') ?? ''
  const editGroupIdsRaw = searchParams.get('editGroupIds') ?? ''
  const editGroupIds = useMemo(() => editGroupIdsRaw.split(',').filter(Boolean), [editGroupIdsRaw])
  const isEditGroup   = editGroupIds.length > 0
  const isDetail      = !!ausenciaId && !isEditGroup
  const navigate = useNavigate()
  const addToast = useUiStore(s => s.addToast)

  const diasSemana = useMemo(
    () => (searchParams.get('dias') ?? '').split(',').filter(Boolean),
    [searchParams]
  )
  const fechasValidas = useMemo(() => generarFechasValidas(diasSemana), [diasSemana])

  // ── Edit Group mode ───────────────────────────────────────────────────────
  const [groupAusencias, setGroupAusencias] = useState<AusenciaTurno[]>([])
  const [groupInscripcionId, setGroupInscripcionId] = useState('')
  const [groupDiasSemana, setGroupDiasSemana] = useState<string[]>([])
  const [loadingGroup, setLoadingGroup] = useState(isEditGroup)
  const [savingGroup, setSavingGroup] = useState(false)
  // Fechas originales del grupo (para saber cuáles crear/borrar)
  const [originalFechas, setOriginalFechas] = useState<Set<string>>(new Set())
  const groupFechasValidas = useMemo(() => generarFechasValidas(groupDiasSemana), [groupDiasSemana])

  const [client, setClient] = useState<Client | null>(null)
  const [ausenciaExistente, setAusenciaExistente] = useState<AusenciaTurno | null>(null)
  const [loadingDetalle, setLoadingDetalle] = useState(isDetail)
  const [savingDetalle, setSavingDetalle] = useState(false)
  const [step, setStep] = useState<1 | 2>(1)
  const [ausenciaCreada, setAusenciaCreada] = useState<AusenciaTurno | null>(null)

  // Step 1 — default: la fecha válida más reciente (hoy o antes)
  const defaultFecha = useMemo(() => {
    const today = todayStr()
    const pasadas = fechasValidas.filter(f => f <= today)
    return pasadas.length > 0 ? pasadas[pasadas.length - 1] : (fechasValidas[0] ?? today)
  }, [fechasValidas])

  const [selectionMode, setSelectionMode] = useState<'individual' | 'range'>('individual')
  const [fechasAusencia, setFechasAusencia] = useState<Set<string>>(() => new Set([defaultFecha]))
  const [rangeDesde, setRangeDesde] = useState(defaultFecha)
  const [rangeHasta, setRangeHasta] = useState(defaultFecha)
  const [conAviso, setConAviso] = useState(false)
  const [notas, setNotas] = useState('')
  const [skipRecup, setSkipRecup] = useState(false)
  const [savingAusencia, setSavingAusencia] = useState(false)

  // Step 2
  const [turnos, setTurnos] = useState<Shift[]>([])
  const [loadingTurnos, setLoadingTurnos] = useState(false)

  // Fechas válidas para recuperación: solo fechas donde hay turnos distintos al del cliente
  // y que no sean la fecha de la ausencia misma
  const clienteTurnoIdForDates = (ausenciaCreada ?? ausenciaExistente)?.inscripcion?.turno?.id
  const fechaAusenciaRegistrada = (ausenciaCreada ?? ausenciaExistente)?.fecha?.slice(0, 10)
  const fechasRecupValidas = useMemo(() => {
    if (turnos.length === 0) return []
    const turnosRecuperables = clienteTurnoIdForDates
      ? turnos.filter(t => t.id !== clienteTurnoIdForDates)
      : turnos
    if (turnosRecuperables.length === 0) return []
    const dows = new Set<number>()
    turnosRecuperables.forEach(t => shiftDows(t).forEach(d => dows.add(d)))
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const hasta = addDays(today, 28)
    const result: string[] = []
    let cur = new Date(today)
    while (cur <= hasta) {
      if (dows.has(cur.getDay())) {
        const y = cur.getFullYear()
        const m = String(cur.getMonth() + 1).padStart(2, '0')
        const d = String(cur.getDate()).padStart(2, '0')
        const dateStr = `${y}-${m}-${d}`
        // No mostrar la fecha de la ausencia como opción de recupero
        if (dateStr !== fechaAusenciaRegistrada) {
          result.push(dateStr)
        }
      }
      cur = addDays(cur, 1)
    }
    return result
  }, [turnos, clienteTurnoIdForDates, fechaAusenciaRegistrada])

  const [fechaRecup, setFechaRecup] = useState(todayStr())
  const [cupos, setCupos] = useState<Record<string, CupoInfo>>({})
  const [loadingCupos, setLoadingCupos] = useState(false)
  const [turnoSeleccionado, setTurnoSeleccionado] = useState<string | null>(null)
  const [notasRecup, setNotasRecup] = useState('')
  const [savingRecup, setSavingRecup] = useState(false)

  // Detail mode states
  const [editingAus, setEditingAus]     = useState(false)
  const [confirmDel, setConfirmDel]     = useState(false)
  const [deletingAus, setDeletingAus]   = useState(false)
  const [agendandoRecup, setAgendandoRecup] = useState(false)

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
    if (clientId) clientsApi.getById(clientId).then(setClient).catch(() => {})
    if (isEditGroup && clientId) {
      setLoadingGroup(true)
      reposicionesApi.getAll({ clienteId: clientId })
        .then(lista => {
          const found = lista.filter(a => editGroupIds.includes(a.id))
          found.sort((a, b) => a.fecha.slice(0, 10).localeCompare(b.fecha.slice(0, 10)))
          setGroupAusencias(found)
          if (found.length > 0) {
            // Pre-cargar estados desde el grupo
            const allConAviso = found.every(a => a.conAviso)
            setConAviso(allConAviso)
            setNotas(found[0].notas ?? '')
            // Extraer inscripcionId y diasSemana del turno origen
            const insc = found[0].inscripcion
            if (insc) {
              setGroupInscripcionId(insc.id)
              setGroupDiasSemana(insc.turno?.diasSemana ?? [])
            }
            // Fechas originales
            const fechas = new Set(found.map(a => a.fecha.slice(0, 10)))
            setOriginalFechas(fechas)
            setFechasAusencia(new Set(fechas))
            setSelectionMode('individual')
          }
        })
        .catch(() => addToast({ type: 'error', message: 'Error al cargar el grupo de ausencias' }))
        .finally(() => setLoadingGroup(false))
    } else if (isDetail && clientId) {
      setLoadingDetalle(true)
      reposicionesApi.getAll({ clienteId: clientId })
        .then(lista => {
          const found = lista.find(a => a.id === ausenciaId) ?? null
          setAusenciaExistente(found)
          if (found) {
            setConAviso(found.conAviso)
            setNotas(found.notas ?? '')
            if (found.recuperacion) setStep(2)
          }
        })
        .catch(() => {})
        .finally(() => setLoadingDetalle(false))
    }
  }, [clientId])

  useEffect(() => {
    setFechasAusencia(new Set([defaultFecha]))
    setRangeDesde(defaultFecha)
    setRangeHasta(defaultFecha)
  }, [defaultFecha])

  const fechasSeleccionadas = useMemo<Set<string>>(() => {
    if (selectionMode === 'individual') return fechasAusencia
    if (!rangeDesde || !rangeHasta) return new Set()
    const desde = rangeDesde <= rangeHasta ? rangeDesde : rangeHasta
    const hasta  = rangeDesde <= rangeHasta ? rangeHasta : rangeDesde
    if (fechasValidas.length > 0) {
      return new Set(fechasValidas.filter(f => f >= desde && f <= hasta))
    }
    // Fallback sin fechasValidas: incluir todos los días
    const result = new Set<string>()
    let cur = new Date(desde + 'T12:00:00')
    const end = new Date(hasta + 'T12:00:00')
    while (cur <= end) {
      const y = cur.getFullYear()
      const m = String(cur.getMonth() + 1).padStart(2, '0')
      const d = String(cur.getDate()).padStart(2, '0')
      result.add(`${y}-${m}-${d}`)
      cur.setDate(cur.getDate() + 1)
    }
    return result
  }, [selectionMode, fechasAusencia, rangeDesde, rangeHasta, fechasValidas])

  const isMultiple = fechasSeleccionadas.size > 1

  // ── Drag-to-select en modo individual ──────────────────────────────────────
  const isDraggingRef  = useRef(false)
  const dragActionRef  = useRef<'add' | 'remove'>('add')

  useEffect(() => {
    const stop = () => { isDraggingRef.current = false }
    window.addEventListener('pointerup', stop)
    return () => window.removeEventListener('pointerup', stop)
  }, [])

  function onPillPointerDown(f: string, e: React.PointerEvent) {
    e.preventDefault()
    isDraggingRef.current = true
    const wasSelected = fechasAusencia.has(f)
    dragActionRef.current = wasSelected ? 'remove' : 'add'
    setFechasAusencia(prev => {
      const next = new Set(prev)
      wasSelected ? next.delete(f) : next.add(f)
      return next
    })
  }

  function onPillPointerEnter(f: string) {
    if (!isDraggingRef.current) return
    setFechasAusencia(prev => {
      const next = new Set(prev)
      dragActionRef.current === 'add' ? next.add(f) : next.delete(f)
      return next
    })
  }

  useEffect(() => {
    if (step !== 2 && !agendandoRecup) return
    setLoadingTurnos(true)
    shiftsApi.getAll()
      .then(t => setTurnos(t))
      .catch(() => addToast({ type: 'error', message: 'No se pudieron cargar los turnos' }))
      .finally(() => setLoadingTurnos(false))
  }, [step, agendandoRecup])

  // Inicializar fechaRecup a la primera fecha válida cuando carguen los turnos
  useEffect(() => {
    if (fechasRecupValidas.length > 0) {
      setFechaRecup(prev => fechasRecupValidas.includes(prev) ? prev : fechasRecupValidas[0])
    }
  }, [fechasRecupValidas])

  const cargarCupos = useCallback(async (fecha: string, lista: Shift[]) => {
    if (!fecha || lista.length === 0) return
    setLoadingCupos(true)
    const results = await Promise.allSettled(
      lista.map(t => reposicionesApi.getCupo(t.id, fecha).then(c => ({ id: t.id, cupo: c })))
    )
    const map: Record<string, CupoInfo> = {}
    results.forEach(r => { if (r.status === 'fulfilled') map[r.value.id] = r.value.cupo })
    setCupos(map)
    setLoadingCupos(false)
  }, [])

  useEffect(() => {
    if ((step === 2 || agendandoRecup) && turnos.length > 0) void cargarCupos(fechaRecup, turnos)
  }, [fechaRecup, turnos, step, agendandoRecup, cargarCupos])

  async function handleGuardarDetalle() {
    if (!ausenciaExistente) return
    setSavingDetalle(true)
    try {
      const updated = await reposicionesApi.updateAusencia(ausenciaExistente.id, {
        conAviso,
        notas: notas || undefined,
      })
      setAusenciaExistente(updated)
      setEditingAus(false)
      addToast({ type: 'success', message: 'Ausencia actualizada' })
    } catch (e: any) {
      addToast({ type: 'error', message: e?.response?.data?.message ?? 'Error al guardar' })
    } finally {
      setSavingDetalle(false)
    }
  }

  async function handleDeleteAusencia() {
    if (!ausenciaExistente) return
    setDeletingAus(true)
    try {
      await reposicionesApi.deleteAusencia(ausenciaExistente.id)
      addToast({ type: 'success', message: 'Ausencia eliminada' })
      navigate(`/clients/${clientId}`)
    } catch {
      addToast({ type: 'error', message: 'Error al eliminar la ausencia' })
      setDeletingAus(false)
      setConfirmDel(false)
    }
  }

  async function handleAgendarDesdeDetalle() {
    if (!ausenciaExistente || !turnoSeleccionado) return
    setSavingRecup(true)
    try {
      const recup = await reposicionesApi.createRecuperacion(ausenciaExistente.id, {
        turnoDestinoId: turnoSeleccionado,
        fecha: fechaRecup,
        notas: notasRecup || undefined,
      })
      setAusenciaExistente(prev => prev ? { ...prev, recuperacion: recup } : prev)
      setAgendandoRecup(false)
      setTurnoSeleccionado(null)
      addToast({ type: 'success', message: 'Recuperación agendada' })
    } catch (e: any) {
      addToast({ type: 'error', message: e?.response?.data?.message ?? 'Error al agendar recuperación' })
    } finally {
      setSavingRecup(false)
    }
  }

  // ── Guardar edición de grupo ──────────────────────────────────────────────
  async function handleGuardarGrupo() {
    if (!groupInscripcionId) return
    setSavingGroup(true)
    try {
      const nuevasFechas = fechasSeleccionadas
      const fechasACrear = [...nuevasFechas].filter(f => !originalFechas.has(f))
      const fechasABorrar = [...originalFechas].filter(f => !nuevasFechas.has(f))
      const fechasQueSeQuedan = [...nuevasFechas].filter(f => originalFechas.has(f))

      const ops: Promise<unknown>[] = []

      // Crear ausencias nuevas
      for (const f of fechasACrear) {
        ops.push(reposicionesApi.createAusencia({
          inscripcionId: groupInscripcionId,
          fecha: f,
          conAviso,
          notas: notas || undefined,
        }))
      }

      // Eliminar ausencias quitadas
      for (const f of fechasABorrar) {
        const aus = groupAusencias.find(a => a.fecha.slice(0, 10) === f)
        if (aus) ops.push(reposicionesApi.deleteAusencia(aus.id))
      }

      // Actualizar conAviso y notas de las que se quedan
      for (const f of fechasQueSeQuedan) {
        const aus = groupAusencias.find(a => a.fecha.slice(0, 10) === f)
        if (aus && (aus.conAviso !== conAviso || (aus.notas ?? '') !== notas)) {
          ops.push(reposicionesApi.updateAusencia(aus.id, {
            conAviso,
            notas: notas || undefined,
          }))
        }
      }

      if (ops.length === 0) {
        addToast({ type: 'info', message: 'No hay cambios para guardar' })
        setSavingGroup(false)
        return
      }

      const results = await Promise.allSettled(ops)
      const ok = results.filter(r => r.status === 'fulfilled').length
      const err = results.filter(r => r.status === 'rejected').length

      if (ok > 0) {
        addToast({
          type: 'success',
          message: `Grupo actualizado${err > 0 ? ` (${err} operación${err !== 1 ? 'es' : ''} fallaron)` : ''}`,
        })
      } else {
        addToast({ type: 'error', message: 'No se pudo actualizar el grupo' })
      }
      navigate(`/clients/${clientId}`)
    } catch {
      addToast({ type: 'error', message: 'Error al actualizar el grupo' })
    } finally {
      setSavingGroup(false)
    }
  }

  async function handleCancelarRecup() {
    if (!ausenciaExistente?.recuperacion) return
    setSavingRecup(true)
    try {
      await reposicionesApi.cancelarRecuperacion(ausenciaExistente.recuperacion.id)
      setAusenciaExistente(prev => prev ? { ...prev, recuperacion: null } : prev)
      addToast({ type: 'success', message: 'Recuperación eliminada' })
    } catch {
      addToast({ type: 'error', message: 'Error al cancelar la recuperación' })
    } finally {
      setSavingRecup(false)
    }
  }

  async function handleRegistrar() {
    if (!inscripcionId || fechasSeleccionadas.size === 0) return
    const fechas = Array.from(fechasSeleccionadas).sort()
    setSavingAusencia(true)
    try {
      if (fechas.length === 1) {
        // Flujo normal: una sola fecha → puede continuar al paso de recuperación
        const nueva = await reposicionesApi.createAusencia({
          inscripcionId, fecha: fechas[0], conAviso, notas: notas || undefined,
        })
        setAusenciaCreada(nueva)
        addToast({ type: 'success', message: 'Ausencia registrada' })
        if (skipRecup) navigate(`/clients/${clientId}`)
        else setStep(2)
      } else {
        // Múltiples fechas: crear todas en paralelo, sin paso de recuperación
        const results = await Promise.allSettled(
          fechas.map(f => reposicionesApi.createAusencia({ inscripcionId, fecha: f, conAviso, notas: notas || undefined }))
        )
        const ok  = results.filter(r => r.status === 'fulfilled').length
        const err = results.filter(r => r.status === 'rejected').length
        if (ok > 0) {
          addToast({ type: 'success', message: `${ok} ausencia${ok !== 1 ? 's' : ''} registrada${ok !== 1 ? 's' : ''}${err > 0 ? ` (${err} ya existían o fallaron)` : ''}` })
        } else {
          addToast({ type: 'error', message: 'No se pudo registrar ninguna ausencia' })
        }
        navigate(`/clients/${clientId}`)
      }
    } catch (e: any) {
      addToast({ type: 'error', message: e?.response?.data?.message ?? 'Error al registrar ausencia' })
    } finally {
      setSavingAusencia(false)
    }
  }

  async function handleAgendar() {
    if (!ausenciaCreada || !turnoSeleccionado) return
    setSavingRecup(true)
    try {
      await reposicionesApi.createRecuperacion(ausenciaCreada.id, {
        turnoDestinoId: turnoSeleccionado,
        fecha: fechaRecup,
        notas: notasRecup || undefined,
      })
      addToast({ type: 'success', message: 'Recuperación agendada' })
      navigate(`/clients/${clientId}`)
    } catch (e: any) {
      addToast({ type: 'error', message: e?.response?.data?.message ?? 'Error al agendar recuperación' })
    } finally {
      setSavingRecup(false)
    }
  }

  function cupoDisponible(turnoId: string) {
    const c = cupos[turnoId]
    return c ? c.cupoDisponibleA + c.cupoDisponibleB : 0
  }
  function cupoColor(turnoId: string) {
    const n = cupoDisponible(turnoId)
    if (n === 0) return 'text-red-500'
    if (n <= 2) return 'text-amber-500'
    return 'text-emerald-500'
  }

  // ── Stepper ────────────────────────────────────────────────────────────────
  function Stepper() {
    return (
      <div className="flex items-start mb-8">
        {STEPS.map((s, idx) => {
          const done = step > s.id
          const curr = step === s.id
          return (
            <div key={s.id} className="flex-1 flex flex-col items-center relative">
              {idx > 0 && (
                <div
                  className="absolute z-10 h-px top-[18px] -translate-y-1/2"
                  style={{
                    left: 0, right: '50%',
                    background: done || curr
                      ? 'linear-gradient(90deg, rgba(251,198,8,0.25), rgba(251,198,8,0.7))'
                      : 'rgba(200,200,200,0.25)',
                  }}
                />
              )}
              {idx < STEPS.length - 1 && (
                <div
                  className="absolute z-10 h-px top-[18px] -translate-y-1/2"
                  style={{
                    left: '50%', right: 0,
                    background: done
                      ? 'linear-gradient(90deg, rgba(251,198,8,0.7), rgba(251,198,8,0.25))'
                      : 'rgba(200,200,200,0.25)',
                  }}
                />
              )}
              <div className={[
                'relative z-20 flex h-9 w-9 items-center justify-center rounded-xl text-sm font-black transition-all duration-300',
                curr
                  ? 'bg-primary text-black ring-4 ring-primary/25 shadow-[0_0_24px_rgba(251,198,8,0.45)] scale-110'
                  : done
                    ? 'bg-primary text-black/80 border-2 border-primary/80 shadow-[0_2px_10px_rgba(251,198,8,0.30)]'
                    : 'bg-white dark:bg-[#111] border-2 border-gray-300 dark:border-white/[0.18] text-gray-500 dark:text-white/50',
              ].join(' ')}>
                {done ? <CheckCircle2 size={14} /> : s.id}
              </div>
              <span className={`mt-2 text-[10px] font-bold uppercase tracking-wider ${curr ? 'text-primary' : done ? 'text-gray-400 dark:text-[#6A6A7A]' : 'text-gray-300 dark:text-[#3A3A4A]'}`}>
                {s.label}
              </span>
            </div>
          )
        })}
      </div>
    )
  }

  // ── Step header ────────────────────────────────────────────────────────────
  function StepHeader() {
    const meta = (isDetail ? STEP_META_DETAIL : STEP_META_CREATE)[step]
    return (
      <div className="flex items-center gap-4 mb-6 pb-5 border-b border-gray-100 dark:border-white/[0.05]">
        <div className="shrink-0 h-11 w-11 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 dark:from-primary/10 dark:to-primary/[0.03] flex items-center justify-center border border-primary/20 dark:border-primary/15">
          <meta.Icon size={18} className="text-primary" />
        </div>
        <div>
          <h2 className="text-base font-black text-gray-900 dark:text-white tracking-tight">{meta.title}</h2>
          <p className="text-xs text-gray-500 dark:text-[#6A6A7A] mt-0.5">{meta.description}</p>
        </div>
        <div className="ml-auto shrink-0 text-right">
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-300 dark:text-[#3A3A4A]">
            Paso {step}/2
          </span>
        </div>
      </div>
    )
  }

  // ── Step 1 ────────────────────────────────────────────────────────────────
  function Step1() {
    return (
      <div className="space-y-5">
        {/* Fecha — read-only en modo detalle, selector multi en creación */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-[#6A6A7A]">
              Fecha de ausencia {!isDetail && <span className="text-primary">*</span>}
            </label>
            {/* Toggle modo — solo en creación */}
            {!isDetail && (
              <div className="flex items-center rounded-full border border-black/[0.08] dark:border-white/10 bg-white/60 dark:bg-black/40 p-0.5 gap-0.5">
                {(['individual', 'range'] as const).map(mode => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setSelectionMode(mode)}
                    className={`relative px-3 py-1 rounded-full text-[10px] font-bold transition-colors duration-150 ${
                      selectionMode === mode ? 'text-white' : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    <span className={`absolute inset-0 rounded-full bg-gray-900 transition-opacity duration-150 ${selectionMode === mode ? 'opacity-100' : 'opacity-0'}`} style={{ zIndex: 0 }} />
                    <span className="relative z-10">{mode === 'individual' ? 'Por fecha' : 'Rango'}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {isDetail && ausenciaExistente ? (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08]">
              <CalendarX2 size={14} className="text-blue-500 shrink-0" />
              <p className="text-sm font-bold text-gray-900 dark:text-white capitalize">
                {(() => { const d = parseISO(ausenciaExistente.fecha.slice(0, 10) + 'T12:00:00'); return isValid(d) ? format(d, "EEEE d 'de' MMMM yyyy", { locale: es }) : ausenciaExistente.fecha.slice(0, 10) })()}
              </p>
            </div>

          ) : selectionMode === 'range' ? (
            /* ── Modo rango ───────────────────────────────────────────── */
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-[#555]">Desde</label>
                  <input
                    type="date"
                    value={rangeDesde}
                    onChange={e => setRangeDesde(e.target.value)}
                    className={ic()}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-[#555]">Hasta</label>
                  <input
                    type="date"
                    value={rangeHasta}
                    min={rangeDesde}
                    onChange={e => setRangeHasta(e.target.value)}
                    className={ic()}
                  />
                </div>
              </div>
              {fechasSeleccionadas.size > 0 && (
                <p className="text-xs text-gray-400 dark:text-[#6A6A7A] px-1">
                  <span className="font-bold text-gray-700 dark:text-gray-300">{fechasSeleccionadas.size}</span> fecha{fechasSeleccionadas.size !== 1 ? 's' : ''} de clase en ese rango
                </p>
              )}
            </div>

          ) : fechasValidas.length > 0 ? (
            /* ── Modo individual: pill grid multi-select con drag ─────── */
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 select-none">
              {fechasValidas.map(f => {
                const isSelected = fechasAusencia.has(f)
                const today = todayStr()
                const isPast = f < today
                const isToday = f === today
                return (
                  <button
                    key={f}
                    type="button"
                    draggable={false}
                    onPointerDown={e => onPillPointerDown(f, e)}
                    onPointerEnter={() => onPillPointerEnter(f)}
                    className={`flex flex-col items-center py-2.5 px-1 rounded-xl border text-center transition-all duration-150 ${
                      isSelected
                        ? 'bg-gradient-to-br from-[rgba(251,198,8,0.15)] via-[rgba(251,198,8,0.06)] to-transparent border-primary/40 dark:border-primary/30 shadow-[0_0_0_1px_rgba(251,198,8,0.15)]'
                        : isPast
                          ? 'bg-gray-50 dark:bg-white/[0.03] border-gray-200 dark:border-white/[0.06] hover:border-gray-300 dark:hover:border-white/[0.12] opacity-70'
                          : 'bg-gray-50 dark:bg-white/[0.04] border-gray-200 dark:border-white/[0.08] hover:border-gray-300 dark:hover:border-white/[0.14]'
                    }`}
                  >
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${isSelected ? 'text-primary' : 'text-gray-400 dark:text-[#6A6A7A]'}`}>
                      {fmtDate(f, 'EEEE')}
                    </span>
                    <span className={`text-lg font-black leading-tight ${isSelected ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                      {fmtDate(f, 'd')}
                    </span>
                    <span className={`text-[9px] font-semibold ${isSelected ? 'text-gray-500 dark:text-[#8A8A9A]' : 'text-gray-400 dark:text-[#555]'}`}>
                      {fmtDate(f, 'MMMM')}
                    </span>
                    {isToday && (
                      <span className="mt-0.5 text-[8px] font-black uppercase tracking-wider text-primary">hoy</span>
                    )}
                  </button>
                )
              })}
            </div>
          ) : (
            /* ── Fallback: input date simple ──────────────────────────── */
            <input
              type="date"
              value={Array.from(fechasAusencia)[0] ?? ''}
              onChange={e => setFechasAusencia(new Set([e.target.value]))}
              className={ic()}
            />
          )}

          {/* Badge de selección múltiple — solo en modo individual */}
          {!isDetail && isMultiple && selectionMode === 'individual' && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/[0.07] dark:bg-primary/[0.10] border border-primary/20">
              <span className="text-xs font-bold text-amber-700 dark:text-amber-400">{fechasSeleccionadas.size} fechas seleccionadas</span>
              <span className="text-xs text-gray-400 dark:text-[#6A6A7A]">· Se omite el paso de recuperación</span>
            </div>
          )}
        </div>

        {/* Skip recuperación — solo en creación */}
        {/* Con/sin aviso */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-[#6A6A7A]">
            ¿Avisó con anticipación?
          </label>
          <button
            type="button"
            onClick={() => setConAviso(v => !v)}
            className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl border transition-all duration-200 active:scale-[0.98] ${
              conAviso
                ? 'bg-primary/5 border-primary/30 dark:bg-primary/10 dark:border-primary/25'
                : 'bg-gray-50 dark:bg-white/[0.05] border-gray-200 dark:border-white/[0.08] hover:border-gray-300 dark:hover:border-white/[0.14]'
            }`}
          >
            <div className="flex items-center gap-3">
              {conAviso
                ? <Bell size={15} className="text-primary" />
                : <BellOff size={15} className="text-gray-400 dark:text-[#6A6A7A]" />
              }
              <div className="text-left">
                <p className={`text-sm font-semibold ${conAviso ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-[#8A8A9A]'}`}>
                  {conAviso ? 'Con aviso previo' : 'Sin aviso previo'}
                </p>
                <p className="text-xs text-gray-400 dark:text-[#555]">
                  El cliente {conAviso ? 'avisó con anticipación' : 'no avisó con anticipación'}
                </p>
              </div>
            </div>
            <div className={`relative h-6 w-10 rounded-full transition-colors duration-200 ${conAviso ? 'bg-primary' : 'bg-gray-200 dark:bg-white/[0.12]'}`}>
              <motion.div
                animate={{ x: conAviso ? 16 : 2 }}
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                className="absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm"
              />
            </div>
          </button>
        </div>

        {/* Notas */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-[#6A6A7A]">
            Notas <span className="normal-case font-normal text-gray-400">(opcional)</span>
          </label>
          <textarea
            value={notas}
            onChange={e => setNotas(e.target.value)}
            rows={3}
            placeholder="Motivo de la ausencia, observaciones…"
            className={ic() + ' resize-none'}
          />
        </div>

        {/* Agendar recuperación — oculto si hay múltiples fechas */}
        {!isMultiple && (
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-[#6A6A7A]">
              Recuperación
            </label>
            <button
              type="button"
              onClick={() => setSkipRecup(v => !v)}
              className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl border transition-all duration-200 active:scale-[0.98] ${
                !skipRecup
                  ? 'bg-primary/5 border-primary/30 dark:bg-primary/10 dark:border-primary/25'
                  : 'bg-gray-50 dark:bg-white/[0.05] border-gray-200 dark:border-white/[0.08] hover:border-gray-300 dark:hover:border-white/[0.14]'
              }`}
            >
              <div className="flex items-center gap-3">
                {!skipRecup
                  ? <CalendarCheck2 size={15} className="text-primary" />
                  : <CalendarX2 size={15} className="text-gray-400 dark:text-[#6A6A7A]" />
                }
                <div className="text-left">
                  <p className={`text-sm font-semibold ${!skipRecup ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-[#8A8A9A]'}`}>
                    {!skipRecup ? 'Agendar recuperación ahora' : 'Sin recuperación por ahora'}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-[#555]">
                    {!skipRecup ? 'Se pasará al siguiente paso al confirmar' : 'Solo se registra la ausencia'}
                  </p>
                </div>
              </div>
              <div className={`relative h-6 w-10 rounded-full transition-colors duration-200 shrink-0 ${!skipRecup ? 'bg-primary' : 'bg-gray-200 dark:bg-white/[0.12]'}`}>
                <motion.div
                  animate={{ x: !skipRecup ? 16 : 2 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  className="absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm"
                />
              </div>
            </button>
          </div>
        )}
      </div>
    )
  }

  // ── Step 2 ────────────────────────────────────────────────────────────────
  function Step2() {
    // Día de semana (índice 0–6) de la fecha seleccionada
    const diaFechaIdx = fechaRecup
      ? parseISO(fechaRecup + 'T12:00:00').getDay()
      : null

    // ID del turno regular del cliente (no puede recuperar en ese mismo turno)
    const clienteTurnoId = (ausenciaCreada ?? ausenciaExistente)?.inscripcion?.turno?.id

    // Filtrar: día de la semana + excluir turno propio
    const turnosDelDia = (diaFechaIdx !== null
      ? turnos.filter(t => shiftDows(t).includes(diaFechaIdx))
      : turnos
    ).filter(t => t.id !== clienteTurnoId)

    // Filtrar por cupo disponible (sobre los del día)
    const turnosDisponibles = turnosDelDia.filter(t => {
      if (loadingCupos || !cupos[t.id]) return true
      return cupoDisponible(t.id) > 0
    })
    const cuposListos = Object.keys(cupos).length > 0 && !loadingCupos
    const sinTurnosEseDia = !loadingTurnos && fechaRecup && turnosDelDia.length === 0
    const todosLlenos = cuposListos && turnosDelDia.length > 0 && turnosDisponibles.length === 0

    return (
      <div className="space-y-5">
        {/* Info ausencia registrada */}
        {ausenciaCreada && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-blue-50 dark:bg-blue-500/[0.08] border border-blue-100 dark:border-blue-500/20">
            <CalendarX2 size={14} className="text-blue-500 dark:text-blue-400 shrink-0" />
            <div>
              <p className="text-xs font-bold text-blue-600 dark:text-blue-400">Ausencia registrada</p>
              <p className="text-xs text-blue-500/70 dark:text-blue-400/60 capitalize">
                {fmtDate(ausenciaCreada.fecha, "EEEE d 'de' MMMM")}
                {ausenciaCreada.inscripcion?.turno && (
                  <> · {ausenciaCreada.inscripcion.turno.horaInicio} – {ausenciaCreada.inscripcion.turno.horaFin}</>
                )}
              </p>
            </div>
          </div>
        )}

        {/* 1. Fecha de recuperación */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-[#6A6A7A] flex items-center gap-1.5">
            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-black text-black">1</span>
            Elegí la fecha
          </label>
          {loadingTurnos ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {[1,2,3,4,5,6].map(i => (
                <div key={i} className="h-[68px] rounded-xl bg-gray-100 dark:bg-white/[0.04] animate-pulse" />
              ))}
            </div>
          ) : fechasRecupValidas.length > 0 ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {fechasRecupValidas.map(f => {
                const isSelected = fechaRecup === f
                const isToday = f === todayStr()
                return (
                  <button
                    key={f}
                    type="button"
                    onClick={() => { setFechaRecup(f); setTurnoSeleccionado(null) }}
                    className={`flex flex-col items-center py-2.5 px-1 rounded-xl border text-center transition-all duration-150 active:scale-[0.97] ${
                      isSelected
                        ? 'bg-gradient-to-br from-[rgba(251,198,8,0.15)] via-[rgba(251,198,8,0.06)] to-transparent border-primary/40 dark:border-primary/30 shadow-[0_0_0_1px_rgba(251,198,8,0.15)]'
                        : 'bg-gray-50 dark:bg-white/[0.04] border-gray-200 dark:border-white/[0.08] hover:border-gray-300 dark:hover:border-white/[0.14]'
                    }`}
                  >
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${isSelected ? 'text-primary' : 'text-gray-400 dark:text-[#6A6A7A]'}`}>
                      {fmtDate(f, 'EEEE')}
                    </span>
                    <span className={`text-lg font-black leading-tight ${isSelected ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                      {fmtDate(f, 'd')}
                    </span>
                    <span className={`text-[9px] font-semibold ${isSelected ? 'text-gray-500 dark:text-[#8A8A9A]' : 'text-gray-400 dark:text-[#555]'}`}>
                      {fmtDate(f, 'MMMM')}
                    </span>
                    {isToday && (
                      <span className="mt-0.5 text-[8px] font-black uppercase tracking-wider text-primary">hoy</span>
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
              onChange={e => { setFechaRecup(e.target.value); setTurnoSeleccionado(null) }}
              className={ic()}
            />
          )}
        </div>

        {/* 2. Turno disponible */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-[#6A6A7A] flex items-center gap-1.5">
            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-black text-black">2</span>
            <Users size={10} /> Elegí el turno <span className="text-primary">*</span>
            {loadingCupos && (
              <span className="ml-auto text-[10px] text-gray-400 flex items-center gap-1 font-normal normal-case tracking-normal">
                <Loader2 size={10} className="animate-spin" /> cargando…
              </span>
            )}
          </label>

          {loadingTurnos || (loadingCupos && Object.keys(cupos).length === 0) ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-[60px] rounded-xl bg-gray-100 dark:bg-white/[0.04] animate-pulse" />
              ))}
            </div>
          ) : sinTurnosEseDia ? (
            <div className="flex items-center gap-3 px-4 py-4 rounded-xl bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08]">
              <CalendarX2 size={15} className="text-gray-400 shrink-0" />
              <div>
                <p className="text-sm font-bold text-gray-700 dark:text-gray-300">Sin turnos este día</p>
                <p className="text-xs text-gray-500 dark:text-[#6A6A7A] mt-0.5">
                  No hay turnos programados para este día de la semana. Elegí otra fecha.
                </p>
              </div>
            </div>
          ) : todosLlenos ? (
            <div className="flex items-center gap-3 px-4 py-4 rounded-xl bg-amber-50 dark:bg-amber-500/[0.08] border border-amber-200 dark:border-amber-500/20">
              <CalendarX2 size={15} className="text-amber-500 shrink-0" />
              <div>
                <p className="text-sm font-bold text-amber-700 dark:text-amber-400">Sin lugares disponibles</p>
                <p className="text-xs text-amber-600/70 dark:text-amber-400/60 mt-0.5">
                  Todos los turnos están completos para esta fecha. Probá con otro día.
                </p>
              </div>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              <div className="space-y-2">
                {turnosDisponibles.map((t, i) => {
                  const cupoN = cupoDisponible(t.id)
                  const isSelected = turnoSeleccionado === t.id
                  return (
                    <motion.button
                      key={t.id}
                      layout
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0, transition: { delay: i * 0.04, duration: 0.2, ease: EASE_OUT } }}
                      exit={{ opacity: 0, scale: 0.97 }}
                      type="button"
                      onClick={() => setTurnoSeleccionado(isSelected ? null : t.id)}
                      whileTap={{ scale: 0.98 }}
                      transition={{ duration: 0.1, ease: EASE_OUT }}
                      className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl border text-left transition-all duration-200 ${
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
                        {cupos[t.id] && !loadingCupos ? (
                          <span className={`text-xs font-bold ${cupoColor(t.id)}`}>
                            {cupoN} lugar{cupoN !== 1 ? 'es' : ''}
                          </span>
                        ) : loadingCupos ? (
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
                    </motion.button>
                  )
                })}
              </div>
            </AnimatePresence>
          )}
        </div>

        {/* Notas */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-[#6A6A7A]">
            Notas <span className="normal-case font-normal text-gray-400">(opcional)</span>
          </label>
          <textarea
            value={notasRecup}
            onChange={e => setNotasRecup(e.target.value)}
            rows={2}
            placeholder="Observaciones sobre la recuperación…"
            className={ic() + ' resize-none'}
          />
        </div>
      </div>
    )
  }

  const clienteNombre = client ? `${client.name} ${client.lastName}` : ''

  // ── Render ─────────────────────────────────────────────────────────────────
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
          {isEditGroup ? 'Editar grupo de ausencias' : isDetail ? 'Detalle de ausencia' : 'Ausencia'}
        </h1>
        <p className="text-sm text-gray-500 dark:text-[#6A6A7A] mt-2">
          {isEditGroup
            ? 'Modificá las fechas, el aviso y las notas del grupo.'
            : isDetail
            ? 'Editá los datos de la ausencia o gestioná la recuperación.'
            : 'Registrá la ausencia y agendá la recuperación en un solo flujo.'}
        </p>
      </div>

      {/* ── EDIT GROUP VIEW ───────────────────────────────────────────────── */}
      {isEditGroup && (
        <div className="rounded-[2rem] border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-3xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
          <div className="h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
          <div className="p-6 md:p-8">
            {loadingGroup ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 size={24} className="animate-spin text-primary" />
              </div>
            ) : groupAusencias.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <CalendarX2 size={28} className="text-gray-300 dark:text-[#444] mb-3" />
                <p className="text-sm font-bold text-gray-700 dark:text-gray-300">No se encontraron ausencias</p>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Fechas — pill grid editable */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-[#6A6A7A]">
                      Fechas de ausencia <span className="text-primary">*</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-gray-400 dark:text-[#6A6A7A]">
                        {fechasSeleccionadas.size} seleccionada{fechasSeleccionadas.size !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>

                  {groupFechasValidas.length > 0 ? (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 select-none">
                      {groupFechasValidas.map(f => {
                        const isSelected = fechasAusencia.has(f)
                        const today = todayStr()
                        const isPast = f < today
                        const isToday = f === today
                        const wasOriginal = originalFechas.has(f)
                        // Ausencia con recuperación activa: no se puede quitar
                        const hasRecup = groupAusencias.some(a => a.fecha.slice(0, 10) === f && a.recuperacion && a.recuperacion.estado !== 'CANCELADA')
                        return (
                          <button
                            key={f}
                            type="button"
                            draggable={false}
                            disabled={hasRecup && isSelected}
                            onPointerDown={e => { if (!(hasRecup && isSelected)) onPillPointerDown(f, e) }}
                            onPointerEnter={() => { if (!(hasRecup && isSelected)) onPillPointerEnter(f) }}
                            className={`relative flex flex-col items-center py-2.5 px-1 rounded-xl border text-center transition-all duration-150 ${
                              hasRecup && isSelected
                                ? 'bg-emerald-50 dark:bg-emerald-500/[0.06] border-emerald-200 dark:border-emerald-500/20 cursor-not-allowed opacity-70'
                                : isSelected
                                ? 'bg-gradient-to-br from-[rgba(251,198,8,0.15)] via-[rgba(251,198,8,0.06)] to-transparent border-primary/40 dark:border-primary/30 shadow-[0_0_0_1px_rgba(251,198,8,0.15)]'
                                : isPast
                                  ? 'bg-gray-50 dark:bg-white/[0.03] border-gray-200 dark:border-white/[0.06] hover:border-gray-300 dark:hover:border-white/[0.12] opacity-70'
                                  : 'bg-gray-50 dark:bg-white/[0.04] border-gray-200 dark:border-white/[0.08] hover:border-gray-300 dark:hover:border-white/[0.14]'
                            }`}
                          >
                            {/* Indicador de nueva/eliminada */}
                            {isSelected && !wasOriginal && (
                              <span className="absolute top-1 right-1.5 text-[7px] font-black text-emerald-500 uppercase">nueva</span>
                            )}
                            {!isSelected && wasOriginal && (
                              <span className="absolute top-1 right-1.5 text-[7px] font-black text-red-400 uppercase">quitar</span>
                            )}
                            <span className={`text-[10px] font-bold uppercase tracking-wider ${isSelected ? 'text-primary' : 'text-gray-400 dark:text-[#6A6A7A]'}`}>
                              {fmtDate(f, 'EEEE')}
                            </span>
                            <span className={`text-lg font-black leading-tight ${isSelected ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                              {fmtDate(f, 'd')}
                            </span>
                            <span className={`text-[9px] font-semibold ${isSelected ? 'text-gray-500 dark:text-[#8A8A9A]' : 'text-gray-400 dark:text-[#555]'}`}>
                              {fmtDate(f, 'MMMM')}
                            </span>
                            {isToday && (
                              <span className="mt-0.5 text-[8px] font-black uppercase tracking-wider text-primary">hoy</span>
                            )}
                            {hasRecup && isSelected && (
                              <span className="mt-0.5 text-[7px] font-bold text-emerald-500">con recupero</span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 dark:text-[#6A6A7A]">No se pudieron determinar las fechas del turno.</p>
                  )}

                  {/* Resumen de cambios */}
                  {(() => {
                    const nuevas = [...fechasSeleccionadas].filter(f => !originalFechas.has(f)).length
                    const quitadas = [...originalFechas].filter(f => !fechasSeleccionadas.has(f)).length
                    if (nuevas === 0 && quitadas === 0) return null
                    return (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/[0.07] dark:bg-primary/[0.10] border border-primary/20">
                        <span className="text-xs font-bold text-amber-700 dark:text-amber-400">
                          {nuevas > 0 && `${nuevas} nueva${nuevas !== 1 ? 's' : ''}`}
                          {nuevas > 0 && quitadas > 0 && ' · '}
                          {quitadas > 0 && `${quitadas} a eliminar`}
                        </span>
                      </div>
                    )
                  })()}
                </div>

                {/* Con/sin aviso */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-[#6A6A7A]">
                    ¿Avisó con anticipación?
                  </label>
                  <button
                    type="button"
                    onClick={() => setConAviso(v => !v)}
                    className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl border transition-all duration-200 active:scale-[0.98] ${
                      conAviso
                        ? 'bg-primary/5 border-primary/30 dark:bg-primary/10 dark:border-primary/25'
                        : 'bg-gray-50 dark:bg-white/[0.05] border-gray-200 dark:border-white/[0.08] hover:border-gray-300 dark:hover:border-white/[0.14]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {conAviso
                        ? <Bell size={15} className="text-primary" />
                        : <BellOff size={15} className="text-gray-400 dark:text-[#6A6A7A]" />
                      }
                      <div className="text-left">
                        <p className={`text-sm font-semibold ${conAviso ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-[#8A8A9A]'}`}>
                          {conAviso ? 'Con aviso previo' : 'Sin aviso previo'}
                        </p>
                      </div>
                    </div>
                    <div className={`relative h-6 w-10 rounded-full transition-colors duration-200 ${conAviso ? 'bg-primary' : 'bg-gray-200 dark:bg-white/[0.12]'}`}>
                      <motion.div
                        animate={{ x: conAviso ? 16 : 2 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                        className="absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm"
                      />
                    </div>
                  </button>
                </div>

                {/* Notas */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-[#6A6A7A]">
                    Notas <span className="normal-case font-normal text-gray-400">(opcional)</span>
                  </label>
                  <textarea
                    value={notas}
                    onChange={e => setNotas(e.target.value)}
                    rows={3}
                    placeholder="Motivo de la ausencia, observaciones…"
                    className={ic() + ' resize-none'}
                  />
                </div>

                {/* Botones */}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleGuardarGrupo}
                    disabled={savingGroup || fechasSeleccionadas.size === 0}
                    className="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl
                      bg-primary hover:bg-primary-dark disabled:opacity-50
                      text-black font-bold text-sm shadow-[0_0_24px_rgba(251,198,8,0.3)]
                      hover:shadow-[0_0_32px_rgba(251,198,8,0.45)]
                      transition-all active:scale-[0.97] disabled:shadow-none"
                  >
                    {savingGroup ? <><Loader2 size={14} className="animate-spin" /> Guardando…</> : 'Guardar cambios'}
                  </button>
                  <button
                    onClick={() => navigate(`/clients/${clientId}`)}
                    className="px-6 py-3 rounded-xl text-sm font-semibold text-gray-500 dark:text-[#8A8A9A]
                      hover:bg-gray-100 dark:hover:bg-white/[0.06] border border-gray-200 dark:border-white/[0.08]
                      transition-all active:scale-[0.97]"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── DETAIL VIEW (2 columnas, sin stepper) ─────────────────────────── */}
      {isDetail && (
        <div className="rounded-[2rem] border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-3xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
          <div className="h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
          <div className="p-6 md:p-8">
            {loadingDetalle ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 size={24} className="animate-spin text-primary" />
              </div>
            ) : ausenciaExistente ? (
              <div className="grid grid-cols-1 md:grid-cols-2">

                {/* ── Columna izquierda: Ausencia ─────────────────────────── */}
                <div className="pb-6 md:pb-0 md:pr-8 space-y-5">
                  {/* Encabezado columna */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CalendarX2 size={15} className="text-blue-500" />
                      <span className="text-sm font-black text-gray-900 dark:text-white tracking-tight">Ausencia</span>
                    </div>
                    {!editingAus && !confirmDel && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setEditingAus(true)}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold
                            text-gray-500 dark:text-[#8A8A9A] hover:text-gray-900 dark:hover:text-white
                            hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-all"
                        >
                          <Edit2 size={12} /> Editar
                        </button>
                        <button
                          onClick={() => setConfirmDel(true)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
                          title="Eliminar ausencia"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Cliente */}
                  {client && !editingAus && (
                    <div className="space-y-1.5">
                    <p className="text-[10px] uppercase tracking-widest font-bold text-gray-400 dark:text-[#5A5A6A]">Cliente</p>
                    <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-white/[0.04] border border-gray-100 dark:border-white/[0.06]">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-xs font-black text-primary">
                          {client.name[0]}{client.lastName[0]}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-gray-900 dark:text-white truncate">
                          {client.name} {client.lastName}
                        </p>
                        {client.email && (
                          <p className="text-[11px] text-gray-400 dark:text-[#6A6A7A] truncate">{client.email}</p>
                        )}
                      </div>
                    </div>
                    </div>
                  )}

                  {/* Fecha */}
                  <div>
                    <p className="text-[10px] uppercase tracking-widest font-bold text-gray-400 dark:text-[#5A5A6A] mb-1">Fecha de ausencia</p>
                    <p className="text-xl font-black text-gray-900 dark:text-white capitalize leading-tight">
                      {fmtDate(ausenciaExistente.fecha, "EEEE d 'de' MMMM")}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-[#6A6A7A] mt-0.5">
                      {fmtDate(ausenciaExistente.fecha, 'yyyy')}
                    </p>
                  </div>

                  {/* Con aviso + notas (modo lectura) */}
                  {!editingAus && (
                    <>
                      <div className="space-y-1.5">
                        <p className="text-[10px] uppercase tracking-widest font-bold text-gray-400 dark:text-[#5A5A6A]">Aviso</p>
                        <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                          ausenciaExistente.conAviso
                            ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400'
                            : 'bg-gray-100 dark:bg-white/[0.05] text-gray-500 dark:text-[#8A8A9A]'
                        }`}>
                          {ausenciaExistente.conAviso ? <Bell size={10} /> : <BellOff size={10} />}
                          {ausenciaExistente.conAviso ? 'Avisó con anticipación' : 'Sin aviso previo'}
                        </span>
                        </div>
                      </div>
                      {ausenciaExistente.notas && (
                        <div>
                          <p className="text-[10px] uppercase tracking-widest font-bold text-gray-400 dark:text-[#5A5A6A] mb-1">Notas</p>
                          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{ausenciaExistente.notas}</p>
                        </div>
                      )}
                    </>
                  )}

                  {/* Turno inscripto */}
                  {ausenciaExistente.inscripcion?.turno && !editingAus && (
                    <div className="space-y-1.5">
                      <p className="text-[10px] uppercase tracking-widest font-bold text-gray-400 dark:text-[#5A5A6A]">Turno regular</p>
                    <div className="px-3 py-3 rounded-xl bg-gray-50 dark:bg-white/[0.04] border border-gray-100 dark:border-white/[0.06] space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-bold text-gray-800 dark:text-gray-100">
                          {ausenciaExistente.inscripcion.turno.horaInicio} – {ausenciaExistente.inscripcion.turno.horaFin}
                        </p>
                        <span className="text-[10px] font-semibold text-gray-400 dark:text-[#6A6A7A] bg-gray-100 dark:bg-white/[0.06] px-2 py-0.5 rounded-full">
                          No recuperable en este turno
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {ausenciaExistente.inscripcion.turno.diasSemana.map(d => (
                          <span key={d} className="text-[10px] font-bold capitalize px-2 py-0.5 rounded-full bg-primary/10 text-primary/80 border border-primary/20">
                            {d}
                          </span>
                        ))}
                      </div>
                    </div>
                    </div>
                  )}

                  {/* Modo edición inline */}
                  {editingAus && (
                    <div className="space-y-4">
                      {/* Con aviso toggle */}
                      <button
                        type="button"
                        onClick={() => setConAviso(v => !v)}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-sm transition-all duration-200 active:scale-[0.98] ${
                          conAviso
                            ? 'bg-blue-50 dark:bg-blue-500/[0.08] border-blue-200 dark:border-blue-500/20 text-blue-700 dark:text-blue-400'
                            : 'bg-gray-50 dark:bg-white/[0.04] border-gray-200 dark:border-white/[0.08] text-gray-400 dark:text-[#555]'
                        }`}
                      >
                        <div className={`h-4 w-4 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${conAviso ? 'bg-blue-500 border-blue-500' : 'border-gray-300 dark:border-white/[0.2]'}`}>
                          {conAviso && <CheckCircle2 size={10} className="text-white" />}
                        </div>
                        <span className="font-medium">Avisó con anticipación</span>
                        {conAviso ? <Bell size={14} className="ml-auto" /> : <BellOff size={14} className="ml-auto" />}
                      </button>
                      {/* Notas */}
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-[#6A6A7A]">Notas</label>
                        <textarea
                          value={notas}
                          onChange={e => setNotas(e.target.value)}
                          rows={3}
                          placeholder="Motivo de la ausencia…"
                          className={ic() + ' resize-none'}
                        />
                      </div>
                      {/* Botones */}
                      <div className="flex gap-2">
                        <button
                          onClick={handleGuardarDetalle}
                          disabled={savingDetalle}
                          className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl
                            bg-primary hover:bg-primary-dark disabled:opacity-50
                            text-black font-bold text-sm transition-all active:scale-[0.97]"
                        >
                          {savingDetalle ? <><Loader2 size={14} className="animate-spin" /> Guardando…</> : 'Guardar'}
                        </button>
                        <button
                          onClick={() => { setEditingAus(false); setConAviso(ausenciaExistente.conAviso); setNotas(ausenciaExistente.notas ?? '') }}
                          className="px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-500 dark:text-[#8A8A9A]
                            hover:bg-gray-100 dark:hover:bg-white/[0.06] border border-gray-200 dark:border-white/[0.08]
                            transition-all active:scale-[0.97]"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Confirmar eliminación */}
                  {confirmDel && (
                    <div className="p-4 rounded-xl bg-red-50 dark:bg-red-500/[0.08] border border-red-100 dark:border-red-500/20 space-y-3">
                      <div className="flex items-center gap-2">
                        <AlertTriangle size={14} className="text-red-500 shrink-0" />
                        <p className="text-sm font-bold text-red-600 dark:text-red-400">¿Eliminar esta ausencia?</p>
                      </div>
                      <p className="text-xs text-red-500/70 dark:text-red-400/60">Esta acción no se puede deshacer. Se eliminará también la recuperación asociada.</p>
                      <div className="flex gap-2">
                        <button
                          onClick={handleDeleteAusencia}
                          disabled={deletingAus}
                          className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl
                            bg-red-500 hover:bg-red-600 disabled:opacity-50
                            text-white font-bold text-sm transition-all active:scale-[0.97]"
                        >
                          {deletingAus ? <><Loader2 size={13} className="animate-spin" /> Eliminando…</> : 'Sí, eliminar'}
                        </button>
                        <button
                          onClick={() => setConfirmDel(false)}
                          className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-500 dark:text-[#8A8A9A]
                            hover:bg-gray-100 dark:hover:bg-white/[0.06] border border-gray-200 dark:border-white/[0.08]
                            transition-all active:scale-[0.97]"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Columna derecha: Recuperación ──────────────────────── */}
                <div className="pt-6 md:pt-0 md:pl-8 border-t md:border-t-0 md:border-l border-gray-100 dark:border-white/[0.06] space-y-5">
                  <div className="flex items-center gap-2">
                    <CalendarCheck2 size={15} className="text-emerald-500" />
                    <span className="text-sm font-black text-gray-900 dark:text-white tracking-tight">Recuperación</span>
                  </div>

                  {ausenciaExistente.recuperacion ? (
                    <div className="space-y-4">
                      {/* Estado */}
                      <div className="space-y-1.5">
                        <p className="text-[10px] uppercase tracking-widest font-bold text-gray-400 dark:text-[#5A5A6A]">Estado</p>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                          ausenciaExistente.recuperacion.estado === 'COMPLETADA'
                            ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            : ausenciaExistente.recuperacion.estado === 'PENDIENTE'
                              ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400'
                              : 'bg-gray-100 dark:bg-white/[0.05] text-gray-500 dark:text-[#8A8A9A]'
                        }`}>
                          {ausenciaExistente.recuperacion.estado === 'COMPLETADA' ? '✓ Completada'
                            : ausenciaExistente.recuperacion.estado === 'PENDIENTE' ? '· Pendiente'
                            : '✕ Cancelada'}
                        </span>
                      </div>

                      {/* Fecha recuperación */}
                      <div>
                        <p className="text-[10px] uppercase tracking-widest font-bold text-gray-400 dark:text-[#5A5A6A] mb-1">Fecha de recuperación</p>
                        <p className="text-base font-bold text-gray-900 dark:text-white capitalize">
                          {fmtDate(ausenciaExistente.recuperacion.fecha, "EEEE d 'de' MMMM")}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-[#6A6A7A] mt-0.5">
                          {fmtDate(ausenciaExistente.recuperacion.fecha, 'yyyy')}
                        </p>
                      </div>

                      {/* Turno destino */}
                      <div className="px-3 py-3 rounded-xl bg-gray-50 dark:bg-white/[0.04] border border-gray-100 dark:border-white/[0.06] space-y-2">
                        <p className="text-[10px] uppercase tracking-widest font-bold text-gray-400 dark:text-[#5A5A6A]">Turno de recuperación</p>
                        <p className="text-sm font-bold text-gray-800 dark:text-gray-100">
                          {ausenciaExistente.recuperacion.turnoDestino.horaInicio} – {ausenciaExistente.recuperacion.turnoDestino.horaFin}
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {ausenciaExistente.recuperacion.turnoDestino.diasSemana.map(d => (
                            <span key={d} className="text-[10px] font-bold capitalize px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                              {d}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Notas recuperación */}
                      {ausenciaExistente.recuperacion.notas && (
                        <div>
                          <p className="text-[10px] uppercase tracking-widest font-bold text-gray-400 dark:text-[#5A5A6A] mb-1">Notas</p>
                          <p className="text-sm text-gray-700 dark:text-gray-300">{ausenciaExistente.recuperacion.notas}</p>
                        </div>
                      )}

                      {/* Cancelar (solo si PENDIENTE) */}
                      {ausenciaExistente.recuperacion.estado === 'PENDIENTE' && (
                        <button
                          onClick={handleCancelarRecup}
                          disabled={savingRecup}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold
                            text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10
                            border border-red-200 dark:border-red-500/20 transition-all active:scale-[0.97]"
                        >
                          {savingRecup ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                          Cancelar recuperación
                        </button>
                      )}
                    </div>
                  ) : agendandoRecup ? (
                    <div className="space-y-4">
                      {Step2()}
                      <div className="pt-2 space-y-2">
                        <button
                          onClick={handleAgendarDesdeDetalle}
                          disabled={!turnoSeleccionado || savingRecup}
                          className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-2xl
                            bg-primary hover:bg-primary-dark disabled:opacity-50
                            text-black font-bold text-sm transition-all active:scale-[0.97]
                            shadow-[0_4px_16px_rgba(251,198,8,0.25)]"
                        >
                          {savingRecup
                            ? <><Loader2 size={15} className="animate-spin" /> Agendando…</>
                            : <><CalendarCheck2 size={15} /> Confirmar recuperación</>
                          }
                        </button>
                        <button
                          onClick={() => setAgendandoRecup(false)}
                          className="w-full px-5 py-2.5 rounded-2xl text-sm font-semibold text-gray-500 dark:text-[#8A8A9A]
                            hover:bg-gray-100 dark:hover:bg-white/[0.05] border border-gray-200 dark:border-white/[0.06]
                            transition-all active:scale-[0.98]"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-center space-y-3">
                      <div className="h-10 w-10 rounded-2xl bg-gray-100 dark:bg-white/[0.05] flex items-center justify-center">
                        <CalendarCheck2 size={18} className="text-gray-300 dark:text-[#444]" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-500 dark:text-[#6A6A7A]">Sin recuperación agendada</p>
                        <p className="text-xs text-gray-400 dark:text-[#4A4A5A] mt-0.5">El cliente todavía no tiene una clase de recuperación programada.</p>
                      </div>
                      <button
                        onClick={() => setAgendandoRecup(true)}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold
                          bg-primary/10 hover:bg-primary/15 text-primary
                          border border-primary/20 transition-all active:scale-[0.97]"
                      >
                        <CalendarCheck2 size={14} /> Agendar recuperación
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="py-16 text-center">
                <p className="text-sm text-gray-400">No se encontró la ausencia.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── WIZARD (solo para crear ausencia nueva) ────────────────────────── */}
      {!isDetail && !isEditGroup && (
        <div className="rounded-[2rem] border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-3xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
          <div className="h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
          <div className="p-6 md:p-8">
            {Stepper()}
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                className="min-h-[280px]"
              >
                {StepHeader()}
                {step === 1 && Step1()}
                {step === 2 && Step2()}
              </motion.div>
            </AnimatePresence>
            <div className="mt-8 pt-6 border-t border-gray-100 dark:border-white/[0.05] space-y-3">
              {step === 1 ? (
                <button
                  onClick={handleRegistrar}
                  disabled={!inscripcionId || fechasSeleccionadas.size === 0 || savingAusencia}
                  className="w-full flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl
                    bg-primary hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed
                    text-black font-bold text-sm transition-all duration-150 active:scale-[0.97]
                    shadow-[0_4px_16px_rgba(251,198,8,0.25)] hover:shadow-[0_4px_20px_rgba(251,198,8,0.35)]"
                >
                  {savingAusencia
                    ? <><Loader2 size={16} className="animate-spin" /> Registrando…</>
                    : isMultiple
                      ? `Registrar ${fechasSeleccionadas.size} ausencias`
                      : skipRecup
                        ? 'Registrar ausencia'
                        : <> Registrar y continuar <ChevronRight size={16} /></>
                  }
                </button>
              ) : (
                <>
                  <button
                    onClick={handleAgendar}
                    disabled={!turnoSeleccionado || savingRecup}
                    className="w-full flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl
                      bg-primary hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed
                      text-black font-bold text-sm transition-all duration-150 active:scale-[0.97]
                      shadow-[0_4px_16px_rgba(251,198,8,0.25)] hover:shadow-[0_4px_20px_rgba(251,198,8,0.35)]"
                  >
                    {savingRecup
                      ? <><Loader2 size={16} className="animate-spin" /> Agendando…</>
                      : <><CalendarCheck2 size={16} /> Confirmar recuperación</>
                    }
                  </button>
                  <button
                    onClick={() => navigate(`/clients/${clientId}`)}
                    className="w-full px-5 py-3 rounded-2xl text-sm font-semibold text-gray-500 dark:text-[#8A8A9A]
                      hover:bg-gray-100 dark:hover:bg-white/[0.05]
                      border border-gray-200 dark:border-white/[0.06]
                      transition-all duration-150 active:scale-[0.98]"
                  >
                    Omitir por ahora
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

    </motion.div>
  )
}
