import { useState, useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Search, Dumbbell, ChevronLeft, ChevronRight, Check, X, RotateCcw } from 'lucide-react'
import api from '../api/axiosInstance'
import { rutinasApi } from '../api/rutinas.api'
import { useUiStore } from '../store/uiStore'
import type { Rutina, EjercicioPlan, EjecucionCliente, CreateEjecucionPayload } from '../types/rutina.types'
import type { Client } from '../types/client.types'

// ─── Tipos locales ────────────────────────────────────────────────────────────

interface RowState {
  series: string
  repeticiones: string
  peso: string
  rir: string
  rpe: string
}

const emptyRow = (): RowState => ({ series: '', repeticiones: '', peso: '', rir: '', rpe: '' })

// ─── Fila de ejercicio ────────────────────────────────────────────────────────

interface ExerciseRowProps {
  ej: EjercicioPlan
  onSaved: (ejercicioId: string, ejecucion: EjecucionCliente) => void
}

function ExerciseRow({ ej, onSaved }: ExerciseRowProps) {
  const addToast = useUiStore(s => s.addToast)
  const [form, setForm] = useState<RowState>(emptyRow)
  const [saving, setSaving] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)

  const lastEj = ej.ejecuciones[0]

  const set = (key: keyof RowState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }))

  const hasAnyValue = Object.values(form).some(v => v.trim() !== '')

  const handleReset = () => setForm(emptyRow())

  const handleSave = async () => {
    if (!hasAnyValue) return
    setSaving(true)
    try {
      const payload: CreateEjecucionPayload = {
        series:       form.series       ? Number(form.series)       : undefined,
        repeticiones: form.repeticiones || undefined,
        peso:         form.peso         || undefined,
        rir:          form.rir          ? Number(form.rir)          : undefined,
        rpe:          form.rpe          ? Number(form.rpe)          : undefined,
      }
      const created = await rutinasApi.addEjecucion(ej.id, payload)
      onSaved(ej.id, created)
      setForm(emptyRow())
      setSavedFlash(true)
      setTimeout(() => setSavedFlash(false), 1500)
    } catch {
      addToast({ type: 'error', message: 'Error al guardar' })
    } finally {
      setSaving(false)
    }
  }

  const inputClass =
    'w-full bg-white/[0.06] border border-white/[0.10] rounded-lg px-2 py-1.5 text-sm text-white text-center focus:outline-none focus:border-primary/60 focus:bg-white/[0.10] transition-colors placeholder:text-white/20'

  return (
    <tr className={`border-b border-white/[0.05] last:border-0 transition-colors ${savedFlash ? 'bg-green-500/5' : 'hover:bg-white/[0.02]'}`}>
      {/* Nombre + última ejecución */}
      <td className="px-4 py-3 align-middle">
        <p className="text-sm font-medium text-white leading-tight">{ej.nombre}</p>
        {lastEj ? (
          <p className="text-xs text-primary/60 mt-0.5">
            Últ.: {[
              lastEj.series      && `${lastEj.series}×`,
              lastEj.repeticiones,
              lastEj.peso,
              lastEj.rir  != null && `RIR ${lastEj.rir}`,
              lastEj.rpe  != null && `RPE ${lastEj.rpe}`,
            ].filter(Boolean).join(' ')}
          </p>
        ) : (
          <p className="text-xs text-white/25 mt-0.5">Sin registros previos</p>
        )}
      </td>

      {/* Plan — read only */}
      <td className="px-2 py-3 text-center align-middle">
        <span className="text-sm text-white/35 tabular-nums">{ej.series ?? '—'}</span>
      </td>
      <td className="px-2 py-3 text-center align-middle">
        <span className="text-sm text-white/35">{ej.repeticiones || '—'}</span>
      </td>
      <td className="px-2 py-3 text-center align-middle">
        <span className="text-sm text-white/35">{ej.peso || '—'}</span>
      </td>

      {/* Separador visual */}
      <td className="w-px bg-white/[0.06] p-0" />

      {/* Ejecución — editable */}
      <td className="px-1.5 py-2 align-middle w-16">
        <input
          type="number"
          min={1}
          value={form.series}
          onChange={set('series')}
          placeholder={ej.series?.toString() ?? ''}
          className={inputClass}
        />
      </td>
      <td className="px-1.5 py-2 align-middle w-20">
        <input
          type="text"
          value={form.repeticiones}
          onChange={set('repeticiones')}
          placeholder={ej.repeticiones ?? ''}
          className={inputClass}
        />
      </td>
      <td className="px-1.5 py-2 align-middle w-24">
        <input
          type="text"
          value={form.peso}
          onChange={set('peso')}
          placeholder={ej.peso ?? 'kg'}
          className={inputClass}
        />
      </td>
      <td className="px-1.5 py-2 align-middle w-14">
        <input
          type="number"
          min={0}
          max={10}
          value={form.rir}
          onChange={set('rir')}
          placeholder="—"
          className={inputClass}
        />
      </td>
      <td className="px-1.5 py-2 align-middle w-14">
        <input
          type="number"
          min={1}
          max={10}
          value={form.rpe}
          onChange={set('rpe')}
          placeholder="—"
          className={inputClass}
        />
      </td>

      {/* Acciones */}
      <td className="px-2 py-2 align-middle">
        <div className="flex items-center gap-1 justify-center">
          {hasAnyValue && (
            <button
              onClick={handleReset}
              className="p-1.5 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-colors"
              title="Limpiar"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving || !hasAnyValue}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              savedFlash
                ? 'bg-green-500/20 text-green-400'
                : hasAnyValue
                  ? 'bg-primary text-black hover:bg-primary/90 active:scale-95'
                  : 'bg-white/[0.04] text-white/20 cursor-not-allowed'
            }`}
          >
            {savedFlash ? (
              <><Check className="w-3.5 h-3.5" /> OK</>
            ) : saving ? (
              '...'
            ) : (
              <><Check className="w-3.5 h-3.5" /> Guardar</>
            )}
          </button>
        </div>
      </td>
    </tr>
  )
}

// ─── Tabla por bloque ─────────────────────────────────────────────────────────

interface BloqueTableProps {
  letra: string
  ejercicios: EjercicioPlan[]
  onSaved: (ejercicioId: string, ejecucion: EjecucionCliente) => void
}

function BloqueTable({ letra, ejercicios, onSaved }: BloqueTableProps) {
  return (
    <div className="rounded-2xl border border-white/[0.08] overflow-hidden bg-white/[0.02]">
      {/* Header del bloque */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-white/[0.03] border-b border-white/[0.06]">
        <span className="w-7 h-7 rounded-lg bg-primary/15 text-primary text-xs font-black flex items-center justify-center">
          {letra}
        </span>
        <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">Bloque {letra}</span>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto">
        <table className="w-full">
          {/* Encabezado */}
          <thead>
            <tr className="border-b border-white/[0.06]">
              <th className="px-4 py-2 text-left text-xs font-semibold text-white/30 uppercase tracking-wider">
                Ejercicio
              </th>
              {/* Plan */}
              <th className="px-2 py-2 text-center text-xs font-semibold text-white/20 uppercase tracking-wider whitespace-nowrap" colSpan={3}>
                — Plan —
              </th>
              {/* Separador */}
              <th className="w-px p-0" />
              {/* Ejecución */}
              <th className="px-1.5 py-2 text-center text-xs font-semibold text-primary/60 uppercase tracking-wider whitespace-nowrap" colSpan={5}>
                — Hoy —
              </th>
              <th className="px-2 py-2" />
            </tr>
            <tr className="border-b border-white/[0.08] bg-white/[0.01]">
              <th className="px-4 py-1.5" />
              {/* Plan sub-headers */}
              <th className="px-2 py-1.5 text-center text-xs text-white/25 font-medium">Ser.</th>
              <th className="px-2 py-1.5 text-center text-xs text-white/25 font-medium">Reps</th>
              <th className="px-2 py-1.5 text-center text-xs text-white/25 font-medium">Peso</th>
              {/* Separador */}
              <th className="w-px p-0" />
              {/* Hoy sub-headers */}
              <th className="px-1.5 py-1.5 text-center text-xs text-primary/50 font-medium w-16">Ser.</th>
              <th className="px-1.5 py-1.5 text-center text-xs text-primary/50 font-medium w-20">Reps</th>
              <th className="px-1.5 py-1.5 text-center text-xs text-primary/50 font-medium w-24">Peso</th>
              <th className="px-1.5 py-1.5 text-center text-xs text-primary/50 font-medium w-14">RIR</th>
              <th className="px-1.5 py-1.5 text-center text-xs text-primary/50 font-medium w-14">RPE</th>
              <th className="px-2 py-1.5" />
            </tr>
          </thead>
          <tbody>
            {ejercicios.map(ej => (
              <ExerciseRow key={ej.id} ej={ej} onSaved={onSaved} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function EjecucionPage() {
  const addToast = useUiStore(s => s.addToast)
  const searchRef = useRef<HTMLInputElement>(null)

  const [search, setSearch]               = useState('')
  const [results, setResults]             = useState<Client[]>([])
  const [selectedCliente, setSelected]    = useState<Client | null>(null)
  const [rutina, setRutina]               = useState<Rutina | null>(null)
  const [semanaNumero, setSemanaNumero]   = useState(1)
  const [selectedSesionId, setSesionId]  = useState<string | null>(null)
  const [searching, setSearching]         = useState(false)
  const [loadingRutina, setLoadingRutina] = useState(false)

  // Búsqueda con debounce
  useEffect(() => {
    if (!search.trim()) { setResults([]); return }
    const t = setTimeout(async () => {
      setSearching(true)
      try {
        const r = await api.get('/clientes/buscar', { params: { q: search, limit: 8 } })
        const items: Array<{ id: string; nombre: string; apellido: string }> = r.data ?? []
        setResults(items.map(c => ({ id: c.id, name: c.nombre, lastName: c.apellido } as unknown as Client)))
      } catch { setResults([]) }
      finally { setSearching(false) }
    }, 280)
    return () => clearTimeout(t)
  }, [search])

  const handleSelect = async (cliente: Client) => {
    setSelected(cliente)
    setSearch('')
    setResults([])
    setLoadingRutina(true)
    try {
      const rutinas = await rutinasApi.getByCliente(cliente.id)
      const activa = rutinas.find(r => r.activa) ?? rutinas[0] ?? null
      setRutina(activa)
      if (activa?.semanas[0]) {
        setSemanaNumero(activa.semanas[0].numero)
        setSesionId(activa.semanas[0].sesiones[0]?.id ?? null)
      }
    } catch {
      addToast({ type: 'error', message: 'Error al cargar la rutina' })
    } finally {
      setLoadingRutina(false) }
  }

  const handleChange = () => {
    setSelected(null)
    setRutina(null)
    setSemanaNumero(1)
    setSesionId(null)
    setTimeout(() => searchRef.current?.focus(), 50)
  }

  // Actualiza la última ejecución de un ejercicio sin re-fetch completo
  const handleSaved = (ejercicioId: string, ejecucion: EjecucionCliente) => {
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
              ejerciciosPlan: bl.ejerciciosPlan.map(ej =>
                ej.id === ejercicioId
                  ? { ...ej, ejecuciones: [ejecucion, ...ej.ejecuciones] }
                  : ej
              ),
            })),
          })),
        })),
      }
    })
  }

  const semana  = rutina?.semanas.find(s => s.numero === semanaNumero)
  const sesion  = semana?.sesiones.find(s => s.id === selectedSesionId)
  const maxSem  = rutina ? Math.max(0, ...rutina.semanas.map(s => s.numero)) : 0
  const bloques = sesion?.bloques.filter(b => b.ejerciciosPlan.length > 0) ?? []

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-5xl mx-auto">

      {/* ── Título ── */}
      <div className="flex items-center gap-3">
        <Dumbbell className="w-6 h-6 text-primary shrink-0" />
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-white leading-tight">Registrar Entrenamiento</h1>
          <p className="text-sm text-white/40 mt-0.5">Buscá tu nombre, seleccioná el día y completá tus series</p>
        </div>
      </div>

      {/* ── Buscador ── */}
      {!selectedCliente && (
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
          <input
            ref={searchRef}
            autoFocus
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Escribí tu nombre o apellido..."
            className="w-full bg-white/[0.04] border border-white/[0.10] rounded-2xl pl-11 pr-4 py-4 text-base text-white placeholder-white/25 focus:outline-none focus:border-primary/50 focus:bg-white/[0.06] transition-colors"
          />
          {searching && (
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-white/30">Buscando...</span>
          )}

          <AnimatePresence>
            {results.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="absolute top-full left-0 right-0 mt-2 bg-[#1C1C1C] border border-white/[0.10] rounded-2xl overflow-hidden z-20 shadow-2xl"
              >
                {results.map(c => (
                  <button
                    key={c.id}
                    onClick={() => handleSelect(c)}
                    className="w-full text-left px-5 py-3.5 hover:bg-white/[0.06] transition-colors border-b border-white/[0.05] last:border-0 flex items-center gap-3"
                  >
                    <span className="w-9 h-9 rounded-xl bg-primary/15 text-primary text-sm font-bold flex items-center justify-center shrink-0">
                      {c.name.charAt(0).toUpperCase()}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-white">{c.name} {c.lastName}</p>
                      <p className="text-xs text-white/35">{c.dni ? `DNI ${c.dni}` : c.email ?? ''}</p>
                    </div>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ── Cliente seleccionado ── */}
      {selectedCliente && (
        <div className="flex items-center justify-between bg-white/[0.04] border border-white/[0.08] rounded-2xl px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-primary/15 text-primary text-base font-bold flex items-center justify-center shrink-0">
              {selectedCliente.name.charAt(0).toUpperCase()}
            </span>
            <div>
              <p className="text-base font-semibold text-white">
                {selectedCliente.name} {selectedCliente.lastName}
              </p>
              <p className="text-xs text-white/40">
                {loadingRutina
                  ? 'Cargando rutina...'
                  : rutina
                    ? rutina.nombre
                    : 'Sin rutina activa'}
              </p>
            </div>
          </div>
          <button
            onClick={handleChange}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-white/40 hover:text-white hover:bg-white/[0.06] transition-colors"
          >
            <X className="w-3.5 h-3.5" /> Cambiar
          </button>
        </div>
      )}

      {/* ── Sin rutina ── */}
      {selectedCliente && !loadingRutina && !rutina && (
        <div className="text-center py-12 text-white/30">
          <Dumbbell className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Este cliente no tiene ninguna rutina asignada.</p>
          <p className="text-xs mt-1">Consultá con el profesor.</p>
        </div>
      )}

      {/* ── Rutina ── */}
      {rutina && !loadingRutina && (
        <AnimatePresence mode="wait">
          <motion.div
            key={rutina.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-5"
          >
            {/* Navegación de semana */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSemanaNumero(n => Math.max(1, n - 1))}
                disabled={semanaNumero <= 1}
                className="p-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white/40 hover:text-white hover:bg-white/[0.08] disabled:opacity-25 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="flex-1 text-center">
                <span className="text-sm font-semibold text-white">
                  {semana?.nombre ? semana.nombre : `Semana ${semanaNumero}`}
                </span>
                {semana?.nombre && (
                  <span className="ml-2 text-xs text-white/30">· Semana {semanaNumero}</span>
                )}
              </div>
              <button
                onClick={() => setSemanaNumero(n => Math.min(maxSem, n + 1))}
                disabled={semanaNumero >= maxSem}
                className="p-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white/40 hover:text-white hover:bg-white/[0.08] disabled:opacity-25 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Tabs de días */}
            {semana && semana.sesiones.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {semana.sesiones.map(s => (
                  <button
                    key={s.id}
                    onClick={() => setSesionId(s.id)}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                      selectedSesionId === s.id
                        ? 'bg-primary text-black'
                        : 'bg-white/[0.04] text-white/50 border border-white/[0.08] hover:text-white hover:border-white/20'
                    }`}
                  >
                    {s.dia}
                  </button>
                ))}
              </div>
            )}

            {/* Bloques + tablas */}
            {sesion && bloques.length > 0 && (
              <div className="space-y-5">
                {bloques.map(bloque => (
                  <BloqueTable
                    key={bloque.id}
                    letra={bloque.letra}
                    ejercicios={bloque.ejerciciosPlan}
                    onSaved={handleSaved}
                  />
                ))}
              </div>
            )}

            {sesion && bloques.length === 0 && (
              <div className="text-center py-10 text-white/25 text-sm">
                No hay ejercicios cargados en este día.
              </div>
            )}

            {semana && semana.sesiones.length === 0 && (
              <div className="text-center py-10 text-white/25 text-sm">
                Esta semana no tiene días de entrenamiento cargados.
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  )
}
