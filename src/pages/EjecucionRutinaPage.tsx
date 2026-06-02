import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, Check, ExternalLink, ChevronLeft, ChevronRight, Save } from 'lucide-react'
import { rutinasApi } from '../api/rutinas.api'
import { useUiStore } from '../store/uiStore'
import type { Rutina, EjercicioPlan, EjecucionCliente, CreateEjecucionPayload, PatronMovimientoEnum } from '../types/rutina.types'

// ─── Constantes ───────────────────────────────────────────────────────────────

const PATRON_LABELS: Record<PatronMovimientoEnum, string> = {
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
  OTROS:             'Otros',
}

const glassCard = 'rounded-[2rem] border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-3xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)]'


const AUTO_SAVE_MS = 4 * 60 * 1000

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface RowState { series: string; repeticiones: string; peso: string; rir: string; rpe: string; saved?: boolean }
const emptyRow  = (): RowState => ({ series: '', repeticiones: '', peso: '', rir: '', rpe: '' })
const hasAny    = (r: RowState) => r.series.trim() !== '' || r.repeticiones.trim() !== '' || r.peso.trim() !== '' || r.rir.trim() !== '' || r.rpe.trim() !== ''
const isUnsaved = (r: RowState) => hasAny(r) && !r.saved

interface LocationState { name?: string; lastName?: string }

// ─── Celdas de inputs (controladas, sin estado propio) ───────────────────────

interface ExerciseInputCellsProps {
  ejId:     string
  form:     RowState
  ej:       EjercicioPlan
  lastEj:   EjecucionCliente | undefined
  onChange: (ejId: string, key: keyof RowState, value: string) => void
}

function ExerciseInputCells({ ejId, form, ej, lastEj, onChange }: ExerciseInputCellsProps) {
  const inp = 'w-full bg-white/[0.06] dark:bg-white/[0.07] border border-white/[0.14] rounded-xl px-3 py-2.5 text-base font-medium text-gray-800 dark:text-white text-center focus:outline-none focus:border-primary/70 focus:bg-white/10 transition-colors placeholder:text-gray-600 dark:placeholder:text-white/60 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'
  const set = (key: keyof RowState) => (e: React.ChangeEvent<HTMLInputElement>) => onChange(ejId, key, e.target.value)

  const phSeries = lastEj?.series?.toString() ?? ej.series?.toString() ?? ''
  const phReps   = lastEj?.repeticiones ?? ej.repeticiones ?? ''
  const phPeso   = lastEj?.peso ?? ej.peso ?? ''
  const phRir    = lastEj?.rir != null ? String(lastEj.rir) : ''
  const phRpe    = lastEj?.rpe != null ? String(lastEj.rpe) : ''

  return (
    <>
      <td className="px-2 py-2 w-24"><input type="number" min={1}         value={form.series}      onChange={set('series')}      placeholder={phSeries} className={inp} /></td>
      <td className="px-2 py-2 w-36"><input type="text"                   value={form.repeticiones} onChange={set('repeticiones')} placeholder={phReps}   className={inp} /></td>
      <td className="px-2 py-2 w-36"><input type="text"                   value={form.peso}         onChange={set('peso')}         placeholder={phPeso}   className={inp} /></td>
      <td className="px-2 py-2 w-24"><input type="number" min={0} max={10} value={form.rir}         onChange={set('rir')}          placeholder={phRir}    className={inp} /></td>
      <td className="px-2 py-2 w-24"><input type="number" min={1} max={10} value={form.rpe}         onChange={set('rpe')}          placeholder={phRpe}    className={inp} /></td>
    </>
  )
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function EjecucionRutinaPage() {
  const { clienteId } = useParams<{ clienteId: string }>()
  const navigate      = useNavigate()
  const location      = useLocation()
  const state         = location.state as LocationState | null
  const addToast      = useUiStore(s => s.addToast)

  const [rutina, setRutina]       = useState<Rutina | null>(null)
  const [loading, setLoading]     = useState(true)
  const [semanaIdx, setSemanaIdx] = useState(0)
  const [forms, setForms]         = useState<Record<string, RowState>>({})
  const [saving, setSaving]       = useState(false)

  const clienteName = state?.name && state?.lastName
    ? `${state.name} ${state.lastName}` : 'Cliente'

  useEffect(() => {
    if (!clienteId) return
    rutinasApi.getByCliente(clienteId)
      .then(rutinas => setRutina(rutinas.find(r => r.activa) ?? rutinas[0] ?? null))
      .catch(() => addToast({ type: 'error', message: 'Error al cargar la rutina' }))
      .finally(() => setLoading(false))
  }, [clienteId]) // eslint-disable-line

  // ── Actualizar un campo de un ejercicio ───────────────────────────────────
  const handleChange = useCallback((ejId: string, key: keyof RowState, value: string) => {
    setForms(f => ({ ...f, [ejId]: { ...(f[ejId] ?? emptyRow()), [key]: value, saved: false } }))
  }, [])

  // ── Guardar todos los ejercicios con datos en la semana actual ────────────
  const rutinaRef    = useRef(rutina)
  const semanaIdxRef = useRef(semanaIdx)
  const formsRef     = useRef(forms)
  useEffect(() => { rutinaRef.current    = rutina    }, [rutina])
  useEffect(() => { semanaIdxRef.current = semanaIdx }, [semanaIdx])
  useEffect(() => { formsRef.current     = forms     }, [forms])

  const saveAll = useCallback(async (auto = false) => {
    const r  = rutinaRef.current
    const si = semanaIdxRef.current
    const fs = formsRef.current
    if (!r) return

    const semana = r.semanas[si]
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

      // Actualizar última ejecución en el state
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
                  const res = results.find(r => r.ejId === ej.id)
                  return res ? { ...ej, ejecuciones: [res.created, ...ej.ejecuciones] } : ej
                }),
              })),
            })),
          })),
        }
      })

      // Marcar como guardados (mantiene los valores visibles en los inputs)
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

  // ── Helpers rowspan ───────────────────────────────────────────────────────
  const sesRS = (ses: NonNullable<typeof rutina>['semanas'][0]['sesiones'][0]) =>
    ses.bloques.length === 0 ? 1
      : ses.bloques.reduce((a, bl) => a + Math.max(1, bl.ejerciciosPlan.length), 0)

  // ─── Render ──────────────────────────────────────────────────────────────

  const semanas    = rutina?.semanas ?? []
  const semana     = semanas[semanaIdx] ?? semanas[0]
  const filledEjs  = semana?.sesiones
    .flatMap(s => s.bloques)
    .flatMap(b => b.ejerciciosPlan)
    .filter(ej => forms[ej.id] && isUnsaved(forms[ej.id])) ?? []

  return (
    <div className="p-4 lg:p-6 xl:p-8 min-h-full space-y-6">

      {/* Volver */}
      <button
        onClick={() => navigate('/ejecucion')}
        className="flex items-center gap-2 text-gray-500 dark:text-white/50 hover:text-gray-900 dark:hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="text-sm">Volver</span>
      </button>

      {/* Nombre */}
      <div>
        <h1 className="text-3xl lg:text-4xl xl:text-5xl font-black text-gray-900 dark:text-white leading-tight">
          {clienteName}
        </h1>
        {rutina && <p className="mt-1 text-sm text-gray-500 dark:text-white/40">{rutina.nombre}</p>}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-24">
          <div className="flex items-center gap-2">
            {[0, 1, 2].map(i => (
              <motion.span key={i} className="block w-2 h-2 rounded-full bg-primary"
                animate={{ opacity: [0.15, 1, 0.15], y: [0, -6, 0] }}
                transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.18, ease: 'easeInOut' }} />
            ))}
          </div>
        </div>
      )}

      {/* Sin rutina */}
      {!loading && !rutina && (
        <div className={`${glassCard} flex flex-col items-center justify-center py-20 text-center`}>
          <p className="text-gray-400 dark:text-white/35 text-sm">Este cliente no tiene ninguna rutina activa.</p>
          <p className="text-xs text-gray-300 dark:text-white/20 mt-1">Consultá con el profesor.</p>
        </div>
      )}

      {/* Contenido */}
      {!loading && rutina && semana && (
        <div className="space-y-4">

          {/* Navegador semana */}
          <div className="flex items-center gap-3">
            <button onClick={() => setSemanaIdx(i => Math.max(0, i - 1))} disabled={semanaIdx === 0}
              className="p-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-gray-500 dark:text-white/40 hover:text-gray-900 dark:hover:text-white hover:bg-white/[0.08] disabled:opacity-25 transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex-1 text-center">
              <span className="text-base font-bold text-gray-900 dark:text-white">
                {semana.nombre?.trim() ? semana.nombre : `Semana ${semana.numero}`}
              </span>
              {semana.nombre?.trim() && semana.nombre.trim() !== `Semana ${semana.numero}` && (
                <span className="ml-2 text-xs text-gray-400 dark:text-white/30">· Semana {semana.numero}</span>
              )}
              {semana.observaciones && (
                <p className="text-xs text-gray-400 dark:text-white/40 italic mt-0.5">{semana.observaciones}</p>
              )}
            </div>
            <button onClick={() => setSemanaIdx(i => Math.min(semanas.length - 1, i + 1))} disabled={semanaIdx >= semanas.length - 1}
              className="p-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-gray-500 dark:text-white/40 hover:text-gray-900 dark:hover:text-white hover:bg-white/[0.08] disabled:opacity-25 transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Tabla */}
          <AnimatePresence mode="wait">
            <motion.div key={semana.id}
              initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.18 }}
              className={glassCard + ' overflow-hidden'}
            >
              {semana.sesiones.length === 0 ? (
                <div className="px-6 py-10 text-center text-sm text-gray-400 dark:text-white/30">
                  Esta semana no tiene días asignados.
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-saas-border dark:border-white/[0.08] bg-gray-50/60 dark:bg-white/[0.02]">
                          <th className="py-3 px-3 text-left text-xs font-semibold text-gray-400 dark:text-white/35 uppercase tracking-widest border-r border-saas-border dark:border-white/[0.06] w-20">Día</th>
                          <th className="py-3 px-1.5 text-center text-xs font-semibold text-gray-400 dark:text-white/35 uppercase tracking-widest border-r border-saas-border dark:border-white/[0.06] w-20">Bloque</th>
                          <th className="py-3 px-4 text-left text-xs font-semibold text-gray-400 dark:text-white/35 uppercase tracking-widest w-44">Ejercicio</th>
                          <th colSpan={4} className="py-3 px-3 text-center text-xs font-semibold text-gray-400 dark:text-white/25 uppercase tracking-widest border-r border-saas-border dark:border-white/[0.06]">Plan</th>
                          <th colSpan={5} className="py-3 px-3 text-center text-xs font-semibold text-amber-600 dark:text-primary/60 uppercase tracking-widest">Hoy</th>
                        </tr>
                        <tr className="border-b border-saas-border dark:border-white/[0.08] bg-gray-50/30 dark:bg-black/10">
                          <th className="px-4 py-2 border-r border-saas-border dark:border-white/[0.06]" />
                          <th className="px-1.5 py-2 border-r border-saas-border dark:border-white/[0.06] w-20" />
                          <th className="px-4 py-2 w-44" />
                          {(['Series', 'Reps', 'Kg', 'R/E'] as const).map(h => (
                            <th key={h} className="px-1 py-2 text-center text-xs text-gray-400 dark:text-white/30 font-medium whitespace-nowrap">{h}</th>
                          ))}
                          {(['Serie', 'Reps', 'Peso', 'RIR', 'RPE'] as const).map(h => (
                            <th key={h} className="px-1.5 py-2 text-center text-xs text-amber-600 dark:text-primary/60 font-medium whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {semana.sesiones.flatMap((ses, sesIdx) => {
                          const sRS = sesRS(ses)
                          const diaCell = (
                            <td rowSpan={sRS} className="px-3 py-3 align-top border-r border-saas-border dark:border-white/[0.06] whitespace-nowrap w-20">
                              <span className="text-sm text-gray-700 dark:text-white/70 font-semibold">{ses.dia}</span>
                            </td>
                          )
                          if (ses.bloques.length === 0) return [(
                            <tr key={`${ses.id}-empty`} className="border-b border-saas-border dark:border-white/[0.05]">
                              {diaCell}
                              <td colSpan={9} className="px-4 py-3 text-xs text-gray-400 dark:text-white/25">Sin bloques</td>
                            </tr>
                          )]
                          return ses.bloques.flatMap((bl, blqIdx) => {
                            const blRS = Math.max(1, bl.ejerciciosPlan.length)
                            const bloqueCell = (
                              <td rowSpan={blRS} className="px-1.5 py-2 text-center align-top border-r border-saas-border dark:border-white/[0.06] w-20">
                                <span className="w-6 h-6 rounded-lg bg-primary/15 border border-primary/25 text-primary text-[10px] font-bold flex items-center justify-center mx-auto">
                                  {bl.letra}
                                </span>
                              </td>
                            )
                            if (bl.ejerciciosPlan.length === 0) return [(
                              <tr key={`${bl.id}-empty`} className="border-b border-saas-border dark:border-white/[0.05]">
                                {blqIdx === 0 && diaCell}
                                {bloqueCell}
                                <td colSpan={8} className="px-4 py-3 text-xs text-gray-400 dark:text-white/25">Sin ejercicios</td>
                              </tr>
                            )]
                            return bl.ejerciciosPlan.map((ej, ejIdx) => {
                              const lastEj = ej.ejecuciones[0]
                              const form   = forms[ej.id] ?? emptyRow()
                              const filled = hasAny(form)
                              return (
                                <tr key={ej.id} className={`border-b border-saas-border dark:border-white/[0.05] transition-colors ${filled ? 'bg-primary/[0.02]' : 'hover:bg-gray-50/40 dark:hover:bg-white/[0.02]'}`}>
                                  {blqIdx === 0 && ejIdx === 0 && diaCell}
                                  {ejIdx === 0 && bloqueCell}

                                  {/* Ejercicio */}
                                  <td className="px-4 py-2.5 w-44 max-w-[11rem]">
                                    <span className="text-base text-gray-800 dark:text-white/90 font-medium block">{ej.nombre}</span>
                                    {ej.catalogo?.patronMovimiento && (
                                      <span className="text-[11px] text-gray-400 dark:text-white/35 block">
                                        {PATRON_LABELS[ej.catalogo.patronMovimiento as PatronMovimientoEnum] ?? ej.catalogo.patronMovimiento}
                                      </span>
                                    )}
                                    {ej.catalogo?.videoUrl && (
                                      <a href={ej.catalogo.videoUrl} target="_blank" rel="noreferrer"
                                        className="inline-flex items-center gap-1 text-[11px] text-amber-600 dark:text-primary/70 hover:text-amber-800 dark:hover:text-primary transition-colors mt-0.5"
                                        onClick={e => e.stopPropagation()}>
                                        <ExternalLink className="w-2.5 h-2.5" /> Ver video
                                      </a>
                                    )}
                                  </td>

                                  {/* Plan comprimido */}
                                  <td className="px-1 py-2 text-center w-8">
                                    {ej.series != null ? <span className="text-sm tabular-nums text-gray-400 dark:text-white/35">{ej.series}×</span> : <span className="text-gray-200 dark:text-white/10 text-xs">—</span>}
                                  </td>
                                  <td className="px-1 py-2 text-center w-10">
                                    {ej.repeticiones ? <span className="text-sm text-gray-400 dark:text-white/35">{ej.repeticiones}</span> : <span className="text-gray-200 dark:text-white/10 text-xs">—</span>}
                                  </td>
                                  <td className="px-1 py-2 text-center w-10">
                                    {ej.peso ? <span className="text-sm text-amber-600 dark:text-primary/60">{ej.peso}</span> : <span className="text-gray-300 dark:text-white/10 text-xs">—</span>}
                                  </td>
                                  <td className="px-1 py-2 text-center w-20 border-r border-saas-border dark:border-white/[0.06]">
                                    <div className="flex flex-col items-center leading-tight">
                                      {ej.rir != null && <span className="text-sm text-gray-400 dark:text-white/30">R{ej.rir}</span>}
                                      {ej.rpe != null && <span className="text-sm text-gray-400 dark:text-white/30">E{ej.rpe}</span>}
                                      {ej.rir == null && ej.rpe == null && <span className="text-gray-200 dark:text-white/10 text-xs">—</span>}
                                    </div>
                                  </td>

                                  {/* Inputs Hoy */}
                                  <ExerciseInputCells
                                    ejId={ej.id}
                                    form={form}
                                    ej={ej}
                                    lastEj={lastEj}
                                    onChange={handleChange}
                                  />
                                </tr>
                              )
                            })
                          })
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Footer con botón único */}
                  <div className="flex items-center justify-between px-6 py-4 border-t border-saas-border dark:border-white/[0.06] bg-gray-50/40 dark:bg-white/[0.02]">
                    <span className="text-xs text-gray-400 dark:text-white/30">
                      {filledEjs.length > 0
                        ? `${filledEjs.length} ejercicio${filledEjs.length > 1 ? 's' : ''} con datos`
                        : 'Completá los campos y guardá'}
                    </span>
                    <button
                      onClick={() => saveAll(false)}
                      disabled={saving || filledEjs.length === 0}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-black text-sm font-bold disabled:opacity-40 hover:bg-primary/90 active:scale-95 transition-all"
                    >
                      {saving
                        ? <><div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" /> Guardando...</>
                        : <><Save className="w-4 h-4" /> Guardar</>
                      }
                    </button>
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
