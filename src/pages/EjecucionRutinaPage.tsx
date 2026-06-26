import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, ExternalLink, Save, Eye, PenLine, ChevronRight, ChevronLeft } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { rutinasApi } from '../api/rutinas.api'
import DotsLoader from '../components/ui/DotsLoader'
import { useUiStore } from '../store/uiStore'
import type { Rutina, EjercicioPlan, EjecucionCliente, CreateEjecucionPayload, UpdateEjercicioPlanPayload } from '../types/rutina.types'

// ─── Constantes ───────────────────────────────────────────────────────────────

const PATRON_LABELS: Partial<Record<string, string>> = {
  RODILLA_DOMINANTE: 'Rodilla dom.',
  CADERA_DOMINANTE:  'Cadera dom.',
  EMPUJE:            'Empuje',
  TRACCION:          'Tracción',
  HIBRIDO:           'Híbrido',
  HOMBROS:           'Hombros',
  CORE:              'Core',
  POTENCIA:          'Potencia',
  PLIO_MI:           'Plio MI',
  PLIO_MS:           'Plio MS',
  ISO_MI:            'Iso MI',
  ISO_MS:            'Iso MS',
  ACCESORIO:         'Accesorio',
  MOVILIDAD:         'Movilidad',
  OTROS:             'Otros',
}

function getBloquePatrones(bl: { patronMovimiento?: string; ejerciciosPlan: Array<{ catalogo?: { patronMovimiento?: string } }> }): string {
  const patrones = [...new Set(
    bl.ejerciciosPlan.map(ej => ej.catalogo?.patronMovimiento).filter(Boolean) as string[]
  )]
  if (patrones.length > 0) return patrones.map(p => PATRON_LABELS[p] ?? p).join(' • ')
  if (bl.patronMovimiento) return PATRON_LABELS[bl.patronMovimiento] ?? bl.patronMovimiento
  return ''
}

const glassCard = 'rounded-[2rem] border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-3xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)]'

const AUTO_SAVE_MS = 4 * 60 * 1000

// Emil: ease-out fuerte para entradas de UI — instantáneo al inicio, suave al final
const EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1]

// ─── Tipos ────────────────────────────────────────────────────────────────────

type ViewMode = 'plan_ultima' | 'registrar'

interface RowState { series: string; repeticiones: string; peso: string; rir: string; rpe: string; saved?: boolean }
const emptyRow  = (): RowState => ({ series: '', repeticiones: '', peso: '', rir: '', rpe: '' })
const hasAny    = (r: RowState) => r.series.trim() !== '' || r.repeticiones.trim() !== '' || r.peso.trim() !== '' || r.rir.trim() !== '' || r.rpe.trim() !== ''
const isUnsaved = (r: RowState) => hasAny(r) && !r.saved

interface LocationState { name?: string; lastName?: string }

// ─── Celdas Plan (lectura) ───────────────────────────────────────────────────

function PlanCells({ ej, withDivider }: { ej: EjercicioPlan; withDivider?: boolean }) {
  const td = 'px-1 py-2 text-center'
  const dash = <span className="text-gray-300 dark:text-white/10 text-xs">—</span>
  const cells = [
    <span className="text-sm tabular-nums text-gray-500 dark:text-white/45">{ej.series != null ? `${ej.series}×` : '—'}</span>,
    <span className="text-sm text-gray-500 dark:text-white/45">{ej.repeticiones || '—'}</span>,
    <span className="text-sm text-amber-600 dark:text-primary/70 font-medium">{ej.peso || '—'}</span>,
    ej.rir   != null ? <span className="text-sm text-gray-400 dark:text-white/35">{ej.rir}</span>  : dash,
    ej.rpe   != null ? <span className="text-sm text-gray-400 dark:text-white/35">{ej.rpe}</span>  : dash,
  ]
  return (
    <>
      {cells.map((content, i) => (
        <motion.td
          key={i}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.15, delay: i * 0.03, ease: EASE_OUT }}
          className={`${td} ${i === 4 && withDivider ? 'border-r border-gray-200 dark:border-white/[0.06]' : ''}`}
        >
          {content}
        </motion.td>
      ))}
    </>
  )
}

// ─── Celdas Última ejecución (lectura) ───────────────────────────────────────

function UltimaCells({ exec, withDivider }: { exec: EjecucionCliente | undefined; withDivider?: boolean }) {
  const td = 'px-1 py-2 text-center'
  const dash = <span className="text-gray-300 dark:text-white/10 text-xs">—</span>
  return (
    <>
      <td className={td}>{exec?.series    != null ? <span className="text-sm font-medium text-gray-700 dark:text-white/65">{exec.series}</span>      : dash}</td>
      <td className={td}>{exec?.repeticiones       ? <span className="text-sm font-medium text-gray-700 dark:text-white/65">{exec.repeticiones}</span>: dash}</td>
      <td className={td}>{exec?.peso               ? <span className="text-sm font-bold text-amber-600 dark:text-primary/80">{exec.peso}</span>       : dash}</td>
      <td className={td}>{exec?.rir       != null  ? <span className="text-sm text-gray-400 dark:text-white/35">{exec.rir}</span>                     : dash}</td>
      <td className={`${td} ${withDivider ? 'border-r border-gray-200 dark:border-white/[0.06]' : ''}`}>
        {exec?.rpe != null ? <span className="text-sm text-gray-400 dark:text-white/35">{exec.rpe}</span> : dash}
      </td>
    </>
  )
}

// ─── Celdas inputs Hoy ───────────────────────────────────────────────────────

function InputCells({ ejId, form, onChange }: {
  ejId: string; form: RowState
  onChange: (ejId: string, key: keyof RowState, value: string) => void
}) {
  const inp = 'w-full bg-white/[0.06] dark:bg-white/[0.07] border border-gray-300 dark:border-white/[0.14] rounded-lg px-1.5 py-2 text-sm font-medium text-gray-800 dark:text-white text-center focus:outline-none focus:border-primary/70 focus:bg-white/10 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'
  const set = (key: keyof RowState) => (e: React.ChangeEvent<HTMLInputElement>) => onChange(ejId, key, e.target.value)

  return (
    <>
      <td className="px-1 py-2 w-12"><input type="number" min={1}          value={form.series}       onChange={set('series')}       className={inp} /></td>
      <td className="px-1 py-2 w-16"><input type="text"                    value={form.repeticiones}  onChange={set('repeticiones')}  className={inp} /></td>
      <td className="px-1 py-2 w-16"><input type="text"                    value={form.peso}          onChange={set('peso')}          className={inp} /></td>
      <td className="px-1 py-2 w-12"><input type="number" min={0} max={10} value={form.rir}           onChange={set('rir')}           className={inp} /></td>
      <td className="px-1 py-2 w-12"><input type="number" min={1} max={10} value={form.rpe}           onChange={set('rpe')}           className={inp} /></td>
    </>
  )
}

// ─── Página ───────────────────────────────────────────────────────────────────

const VIEW_OPTS: { id: ViewMode; icon: React.ElementType; title: string }[] = [
  { id: 'plan_ultima', icon: Eye,     title: 'Plan vs Última' },
  { id: 'registrar',  icon: PenLine,  title: 'Registrar' },
]

export default function EjecucionRutinaPage() {
  const { clienteId } = useParams<{ clienteId: string }>()
  const navigate      = useNavigate()
  const location      = useLocation()
  const state         = location.state as LocationState | null
  const addToast      = useUiStore(s => s.addToast)

  const [rutina, setRutina]             = useState<Rutina | null>(null)
  const [loading, setLoading]           = useState(true)
  const [selectedSemanaId, setSemanaId] = useState<string | null>(null)
  const [forms, setForms]               = useState<Record<string, RowState>>({})
  const [saving, setSaving]             = useState(false)
  const [viewMode, setViewMode]         = useState<ViewMode>('registrar')
  const [planExpanded, setPlanExpanded] = useState(false)
  const [execOffset, setExecOffset]     = useState(0)

  const clienteName = state?.name && state?.lastName
    ? `${state.name} ${state.lastName}` : 'Cliente'

  useEffect(() => {
    if (!clienteId) return
    rutinasApi.getByCliente(clienteId)
      .then(rutinas => {
        const r = rutinas.find(r => r.activa) ?? rutinas[0] ?? null
        setRutina(r)
        if (r?.semanas.length) setSemanaId(r.semanas[0].id)
      })
      .catch(() => addToast({ type: 'error', message: 'Error al cargar la rutina' }))
      .finally(() => setLoading(false))
  }, [clienteId]) // eslint-disable-line

  // ── Actualizar un campo de un ejercicio ───────────────────────────────────
  const handleChange = useCallback((ejId: string, key: keyof RowState, value: string) => {
    setForms(f => ({ ...f, [ejId]: { ...(f[ejId] ?? emptyRow()), [key]: value, saved: false } }))
  }, [])

  // ── Guardar todos los ejercicios con datos en la semana actual ────────────
  const rutinaRef   = useRef(rutina)
  const semanaIdRef = useRef(selectedSemanaId)
  const formsRef    = useRef(forms)
  useEffect(() => { rutinaRef.current   = rutina          }, [rutina])
  useEffect(() => { semanaIdRef.current = selectedSemanaId }, [selectedSemanaId])
  useEffect(() => { formsRef.current    = forms            }, [forms])

  const saveAll = useCallback(async (auto = false) => {
    const r   = rutinaRef.current
    const sid = semanaIdRef.current
    const fs  = formsRef.current
    if (!r) return
    const semana = r.semanas.find(s => s.id === sid) ?? r.semanas[0]
    if (!semana) return
    const toSave = semana.sesiones
      .flatMap(s => s.bloques)
      .flatMap(b => b.ejerciciosPlan)
      .filter(ej => fs[ej.id] && isUnsaved(fs[ej.id]))
    if (toSave.length === 0) return
    setSaving(true)
    try {
      const results = await Promise.all(
        toSave.map(ej => {
          const form = fs[ej.id]
          const payload: CreateEjecucionPayload = {
            series:       form.series       ? Number(form.series)       : undefined,
            repeticiones: form.repeticiones || undefined,
            peso:         form.peso         || undefined,
            rir:          form.rir          ? Number(form.rir)          : undefined,
            rpe:          form.rpe          ? Number(form.rpe)          : undefined,
          }
          return rutinasApi.addEjecucion(ej.id, payload)
            .then((created): { ejId: string; created: EjecucionCliente } => ({ ejId: ej.id, created }))
        })
      )
      // Fire-and-forget: actualizar valores del plan con lo ejecutado
      toSave.forEach(ej => {
        const form = fs[ej.id]
        const updatePayload: UpdateEjercicioPlanPayload = {
          series:       form.series       ? Number(form.series)       : undefined,
          repeticiones: form.repeticiones || undefined,
          peso:         form.peso         || undefined,
          rir:          form.rir          ? Number(form.rir)          : undefined,
          rpe:          form.rpe          ? Number(form.rpe)          : undefined,
        }
        rutinasApi.updateEjercicio(ej.id, updatePayload).catch(() => {})
      })
      // Actualizar state local
      setRutina(prev => {
        if (!prev) return prev
        return {
          ...prev,
          semanas: prev.semanas.map(s => ({
            ...s,
            sesiones: s.sesiones.map(ses => ({
              ...ses,
              bloques: ses.bloques.map(bl => ({
                ...bl,
                ejerciciosPlan: bl.ejerciciosPlan.map(ej => {
                  const res  = results.find(r => r.ejId === ej.id)
                  const form = fs[ej.id]
                  if (!res || !form) return ej
                  return {
                    ...ej,
                    ...(form.series       && { series:       Number(form.series)       }),
                    ...(form.repeticiones && { repeticiones: form.repeticiones }),
                    ...(form.peso         && { peso:         form.peso }),
                    ...(form.rir          && { rir:          Number(form.rir) }),
                    ...(form.rpe          && { rpe:          Number(form.rpe) }),
                    ejecuciones: [res.created, ...ej.ejecuciones],
                  }
                }),
              })),
            })),
          })),
        }
      })
      setForms(f => {
        const next = { ...f }
        toSave.forEach(ej => { if (next[ej.id]) next[ej.id] = { ...next[ej.id], saved: true } })
        return next
      })
      addToast({
        type: 'success',
        message: auto
          ? `Auto-guardado: ${toSave.length} ejercicio${toSave.length > 1 ? 's' : ''}`
          : `${toSave.length} ejercicio${toSave.length > 1 ? 's guardados' : ' guardado'}`,
      })
    } catch {
      addToast({ type: 'error', message: 'Error al guardar' })
    } finally {
      setSaving(false)
    }
  }, [addToast])

  // ── Auto-save cada 4 minutos ──────────────────────────────────────────────
  const saveAllRef = useRef(saveAll)
  useEffect(() => { saveAllRef.current = saveAll }, [saveAll])
  useEffect(() => {
    const id = setInterval(() => saveAllRef.current(true), AUTO_SAVE_MS)
    return () => clearInterval(id)
  }, [])

  // ── Scroll al top al montar (Emil: reset position on entry) ───────────────
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior }) }, [])

  // ── Helpers rowspan ───────────────────────────────────────────────────────
  const sesRS = (ses: NonNullable<typeof rutina>['semanas'][0]['sesiones'][0]) =>
    ses.bloques.length === 0 ? 1
      : ses.bloques.reduce((a, bl) => a + Math.max(1, bl.ejerciciosPlan.length), 0)

  // ─── Render ──────────────────────────────────────────────────────────────

  const semanas   = rutina?.semanas ?? []
  const semana    = semanas.find(s => s.id === selectedSemanaId) ?? semanas[0]
  const filledEjs = semana?.sesiones
    .flatMap(s => s.bloques)
    .flatMap(b => b.ejerciciosPlan)
    .filter(ej => forms[ej.id] && isUnsaved(forms[ej.id])) ?? []

  // Número de columnas de datos según vista (para Sin bloques / Sin ejercicios)
  const planCols = planExpanded ? 5 : 1
  const dataCols = viewMode === 'plan_ultima' ? planCols + 5 : planCols + 5 + 5

  // Navegación entre ejecuciones anteriores
  const allEjsSem = semana?.sesiones.flatMap(s => s.bloques.flatMap(b => b.ejerciciosPlan)) ?? []
  const maxOffset = allEjsSem.reduce((mx, ej) => Math.max(mx, (ej.ejecuciones?.length ?? 0) - 1), 0)
  const dateAtOffset = allEjsSem.reduce<string | null>(
    (found, ej) => found ?? (ej.ejecuciones[execOffset]?.fecha ?? null), null
  )

  const thBase = 'py-1.5 px-2 text-xs font-medium text-gray-500 dark:text-white/55 uppercase tracking-wide text-center'
  const div    = 'border-r border-gray-200 dark:border-white/[0.07]'

  return (
    <div className="p-4 lg:p-6 xl:p-8 min-h-full space-y-6">

      {/* Volver */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: EASE_OUT }}
      >
        <button
          onClick={() => navigate('/ejecucion')}
          className="flex items-center gap-2 text-gray-500 dark:text-white/50 hover:text-gray-900 dark:hover:text-white transition-colors active:scale-[0.97]"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Volver</span>
        </button>
      </motion.div>

      {/* Nombre + rutina */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24, delay: 0.04, ease: EASE_OUT }}
      >
        <h1 className="text-3xl lg:text-4xl xl:text-5xl font-black text-gray-900 dark:text-white leading-tight">
          {clienteName}
        </h1>
        {rutina && <p className="mt-1 text-sm text-gray-500 dark:text-white/40">{rutina.nombre}</p>}
      </motion.div>

      {/* Loading */}
      {loading && <DotsLoader size="md" className="flex items-center justify-center py-24" />}

      {/* Sin rutina */}
      {!loading && !rutina && (
        <div className={`${glassCard} flex flex-col items-center justify-center py-20 text-center`}>
          <p className="text-gray-400 dark:text-white/35 text-sm">Este cliente no tiene ninguna rutina activa.</p>
          <p className="text-xs text-gray-300 dark:text-white/20 mt-1">Consultá con el profesor.</p>
        </div>
      )}

      {/* Contenido */}
      {!loading && rutina && semana && (
        <div className="space-y-3">

          {/* ── Pill nav semanas + selector de vista ────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, delay: 0.08, ease: EASE_OUT }}
            className="flex items-center justify-between gap-3 flex-wrap"
          >

            {/* Semanas */}
            <div className="flex items-center gap-1 p-1.5 rounded-2xl bg-white/25 dark:bg-black/20 backdrop-blur-xl border border-white/40 dark:border-white/[0.08] shadow-[0_2px_12px_rgba(0,0,0,0.04)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.25)]">
              {semanas.map((s, i) => {
                const label  = s.nombre?.trim() ? s.nombre : `S${s.numero ?? i + 1}`
                const active = s.id === semana.id
                return (
                  <button
                    key={s.id}
                    onClick={() => { setSemanaId(s.id); setExecOffset(0) }}
                    title={s.nombre?.trim() && s.nombre !== label ? s.nombre : undefined}
                    className={`px-4 py-1.5 rounded-xl text-sm font-semibold transition-all duration-200 active:scale-[0.97] ${
                      active
                        ? 'bg-primary text-black shadow-[0_2px_10px_rgba(251,198,8,0.4)]'
                        : 'text-gray-500 dark:text-white/35 hover:text-gray-800 dark:hover:text-white/65 hover:bg-white/50 dark:hover:bg-white/[0.07]'
                    }`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>

            {/* Vista — solo iconos */}
            <div className="flex items-center gap-1 p-1.5 rounded-2xl bg-white/25 dark:bg-black/20 backdrop-blur-xl border border-white/40 dark:border-white/[0.08] shadow-[0_2px_12px_rgba(0,0,0,0.04)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.25)]">
              {VIEW_OPTS.map(({ id, icon: Icon, title }) => {
                const active = viewMode === id
                return (
                  <button
                    key={id}
                    title={title}
                    onClick={() => setViewMode(id)}
                    className={`p-2.5 rounded-xl transition-all duration-200 active:scale-[0.97] ${
                      active
                        ? 'bg-primary text-black shadow-[0_2px_10px_rgba(251,198,8,0.4)]'
                        : 'text-gray-500 dark:text-white/35 hover:text-gray-800 dark:hover:text-white/65 hover:bg-white/50 dark:hover:bg-white/[0.07]'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </button>
                )
              })}
            </div>

          </motion.div>

          {/* ── Tabla ───────────────────────────────────────────────────────── */}
          <AnimatePresence mode="wait">
            <motion.div
              key={semana.id}
              initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2, ease: EASE_OUT }}
              className={glassCard + ' overflow-hidden'}
            >
              {semana.sesiones.length === 0 ? (
                <div className="px-6 py-10 text-center text-sm text-gray-400 dark:text-white/30">
                  Esta semana no tiene días asignados.
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <div className="rounded-t-2xl overflow-hidden">
                      <table className="w-full border-collapse text-sm">
                        <thead>
                          {/* Fila grupo */}
                          <tr className="bg-gray-50 dark:bg-[#111111] border-b border-gray-200 dark:border-white/[0.07]">
                            <th colSpan={3} className={`${thBase} text-left pl-4 ${div}`} />
                            {/* Plan — colapsable con animación */}
                            <th colSpan={planExpanded ? 5 : 1} className={`${thBase} text-amber-700 dark:text-primary/70 ${div}`}>
                              <button
                                onClick={() => setPlanExpanded(e => !e)}
                                className="inline-flex items-center gap-1 hover:text-amber-900 dark:hover:text-primary transition-colors active:scale-[0.97]"
                                title={planExpanded ? 'Ocultar plan' : 'Ver plan'}
                              >
                                <AnimatePresence mode="wait" initial={false}>
                                  <motion.span
                                    key={planExpanded ? 'exp' : 'col'}
                                    initial={{ opacity: 0, x: planExpanded ? -6 : 6 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: planExpanded ? 6 : -6 }}
                                    transition={{ duration: 0.15, ease: EASE_OUT }}
                                    className="inline-flex items-center gap-1"
                                  >
                                    <span>Plan</span>
                                    {planExpanded
                                      ? <ChevronLeft className="w-3 h-3" />
                                      : <ChevronRight className="w-3 h-3" />
                                    }
                                  </motion.span>
                                </AnimatePresence>
                              </button>
                            </th>
                            {(viewMode === 'plan_ultima' || viewMode === 'registrar') && (
                              <th
                                colSpan={5}
                                className={`${thBase} text-gray-600 dark:text-white/45 ${viewMode === 'registrar' ? div : ''}`}
                              >
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    onClick={() => setExecOffset(o => o + 1)}
                                    disabled={execOffset >= maxOffset}
                                    className="p-0.5 rounded hover:text-gray-800 dark:hover:text-white/70 disabled:opacity-20 transition-colors active:scale-[0.97]"
                                  >
                                    <ChevronLeft className="w-3 h-3" />
                                  </button>
                                  <span>
                                    {execOffset === 0 ? 'Última' : `Previa ×${execOffset}`}
                                    {dateAtOffset && (
                                      <span className="ml-1 font-normal opacity-60">
                                        ({format(parseISO(dateAtOffset), 'dd/MM')})
                                      </span>
                                    )}
                                  </span>
                                  <button
                                    onClick={() => setExecOffset(o => o - 1)}
                                    disabled={execOffset === 0}
                                    className="p-0.5 rounded hover:text-gray-800 dark:hover:text-white/70 disabled:opacity-20 transition-colors active:scale-[0.97]"
                                  >
                                    <ChevronRight className="w-3 h-3" />
                                  </button>
                                </div>
                              </th>
                            )}
                            {viewMode === 'registrar' && (
                              <th colSpan={5} className={`${thBase} text-emerald-700 dark:text-emerald-400/70`}>Hoy</th>
                            )}
                          </tr>
                          {/* Fila sub-columnas */}
                          <tr className="bg-gray-50 dark:bg-[#111111] border-b border-gray-200 dark:border-white/[0.07]">
                            <th className={`${thBase} text-left pl-4 ${div} w-20`}>Día</th>
                            <th className={`${thBase} ${div} w-16`}>Bloq</th>
                            <th className={`${thBase} text-left ${div} w-64`}>Ejercicio</th>
                            {/* Plan sub-cols — stagger fade al expandir */}
                            {planExpanded
                              ? (['Ser', 'Reps', 'Peso', 'RIR', 'RPE'] as const).map((h, i) => (
                                  <motion.th
                                    key={h}
                                    initial={{ opacity: 0, y: -3 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.16, delay: i * 0.035, ease: EASE_OUT }}
                                    className={`${thBase} ${i === 4 ? div : ''}`}
                                  >
                                    {h}
                                  </motion.th>
                                ))
                              : <th className={`${thBase} ${div} w-4`} />
                            }
                            {/* Última — anchos explícitos para igualar sección Hoy */}
                            {(viewMode === 'plan_ultima' || viewMode === 'registrar') && (
                              (['Ser', 'Reps', 'Peso', 'RIR', 'RPE'] as const).map((h, i) => (
                                <th
                                  key={`u${h}`}
                                  className={`${thBase} ${i === 4 && viewMode === 'registrar' ? div : ''} ${
                                    i === 1 || i === 2 ? 'w-16' : 'w-12'
                                  }`}
                                >
                                  {h}
                                </th>
                              ))
                            )}
                            {viewMode === 'registrar' && (
                              (['Ser', 'Reps', 'Peso', 'RIR', 'RPE'] as const).map((h, i) => (
                                <th key={`r${h}`} className={`${thBase} text-emerald-700 dark:text-emerald-400/70 ${i === 1 || i === 2 ? 'w-16' : 'w-12'}`}>{h}</th>
                              ))
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {semana.sesiones.flatMap((ses) => {
                            const sRS = sesRS(ses)
                            const diaCell = (
                              <td rowSpan={sRS} className="px-3 py-3 align-top border-r border-gray-200 dark:border-white/[0.06] whitespace-nowrap w-20">
                                <span className="text-base font-bold text-gray-800 dark:text-white/85">{ses.dia}</span>
                              </td>
                            )
                            if (ses.bloques.length === 0) return [(
                              <tr key={`${ses.id}-empty`} className="border-b border-gray-100 dark:border-white/[0.05]">
                                {diaCell}
                                <td colSpan={dataCols + 2} className="px-4 py-3 text-xs text-gray-400 dark:text-white/25">Sin bloques</td>
                              </tr>
                            )]
                            return ses.bloques.flatMap((bl, blqIdx) => {
                              const blRS = Math.max(1, bl.ejerciciosPlan.length)
                              const bloqueCell = (
                                <td rowSpan={blRS} className="px-2 py-3 text-center align-top border-r border-gray-200 dark:border-white/[0.06] w-16">
                                  <span className="w-9 h-9 rounded-xl bg-primary/15 border border-primary/25 text-primary text-sm font-bold flex items-center justify-center mx-auto">
                                    {bl.letra}
                                  </span>
                                  {getBloquePatrones(bl) && (
                                    <span className="text-[9px] text-gray-400 dark:text-white/25 block mt-1 leading-tight text-center whitespace-nowrap">
                                      {getBloquePatrones(bl)}
                                    </span>
                                  )}
                                </td>
                              )
                              if (bl.ejerciciosPlan.length === 0) return [(
                                <tr key={`${bl.id}-empty`} className="border-b border-gray-100 dark:border-white/[0.05]">
                                  {blqIdx === 0 && diaCell}
                                  {bloqueCell}
                                  <td colSpan={dataCols + 1} className="px-4 py-3 text-xs text-gray-400 dark:text-white/25">Sin ejercicios</td>
                                </tr>
                              )]
                              return bl.ejerciciosPlan.map((ej, ejIdx) => {
                                const lastEj = ej.ejecuciones[execOffset]
                                const form   = forms[ej.id] ?? emptyRow()
                                const filled = hasAny(form)
                                return (
                                  <tr
                                    key={ej.id}
                                    className={`border-b border-gray-100 dark:border-white/[0.05] transition-colors ${filled ? 'bg-primary/[0.02]' : 'hover:bg-gray-50/40 dark:hover:bg-white/[0.02]'}`}
                                  >
                                    {blqIdx === 0 && ejIdx === 0 && diaCell}
                                    {ejIdx === 0 && bloqueCell}

                                    {/* Ejercicio */}
                                    <td className="px-4 py-3 border-r border-gray-200 dark:border-white/[0.06] w-64 max-w-[16rem]">
                                      <span className="text-[17px] leading-snug text-gray-900 dark:text-white font-semibold block">{ej.nombre}</span>
                                      {ej.catalogo?.patronMovimiento && (
                                        <span className="text-xs text-gray-400 dark:text-white/35 block mt-0.5">
                                          {PATRON_LABELS[ej.catalogo.patronMovimiento] ?? ej.catalogo.patronMovimiento}
                                        </span>
                                      )}
                                      {ej.catalogo?.videoUrl && (
                                        <a href={ej.catalogo.videoUrl} target="_blank" rel="noreferrer"
                                          className="inline-flex items-center gap-1 text-[11px] text-amber-600 dark:text-primary/70 hover:text-amber-800 dark:hover:text-primary transition-colors mt-0.5"
                                          onClick={e => e.stopPropagation()}>
                                          <ExternalLink className="w-2.5 h-2.5" /> Ver video
                                        </a>
                                      )}
                                      {ej.notas && (
                                        <span className="text-[11px] text-gray-400 dark:text-white/40 italic block mt-0.5">{ej.notas}</span>
                                      )}
                                    </td>

                                    {/* Plan — colapsable */}
                                    {planExpanded
                                      ? <PlanCells ej={ej} withDivider />
                                      : <td className="w-6 border-r border-gray-200 dark:border-white/[0.06]" />
                                    }

                                    {/* Última ejecución */}
                                    {(viewMode === 'plan_ultima' || viewMode === 'registrar') && (
                                      <UltimaCells exec={lastEj} withDivider={viewMode === 'registrar'} />
                                    )}

                                    {/* Inputs Hoy */}
                                    {viewMode === 'registrar' && (
                                      <InputCells
                                        ejId={ej.id}
                                        form={form}
                                        onChange={handleChange}
                                      />
                                    )}
                                  </tr>
                                )
                              })
                            })
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-white/[0.06] bg-gray-50/40 dark:bg-white/[0.02]">
                    <span className="text-xs text-gray-400 dark:text-white/30">
                      {viewMode === 'registrar'
                        ? filledEjs.length > 0
                          ? `${filledEjs.length} ejercicio${filledEjs.length > 1 ? 's' : ''} con datos`
                          : 'Completá los campos y guardá'
                        : 'Comparación Plan vs Última ejecución'
                      }
                    </span>
                    {viewMode === 'registrar' && (
                      <button
                        onClick={() => saveAll(false)}
                        disabled={saving || filledEjs.length === 0}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-black text-sm font-bold disabled:opacity-40 hover:bg-primary/90 active:scale-[0.97] transition-all"
                      >
                        {saving
                          ? <><div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" /> Guardando...</>
                          : <><Save className="w-4 h-4" /> Guardar</>
                        }
                      </button>
                    )}
                  </div>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
