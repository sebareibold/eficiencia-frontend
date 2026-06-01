import { useReducer, useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  ArrowLeft, Check, Search, User, Plus, X, Wrench,
  ChevronDown, ExternalLink, AlertCircle, Layers,
  ClipboardList, Dumbbell, Settings2, Eye,
} from 'lucide-react'
import { ejerciciosApi } from '../api/ejercicios.api'
import { clientsApi } from '../api/clients.api'
import { rutinasApi } from '../api/rutinas.api'
import { plantillasApi } from '../api/plantillas.api'
import { useUiStore } from '../store/uiStore'
import Skeleton from '../components/ui/Skeleton'
import type {
  WizardState, WizardModo, ClienteResumen, SesionDraft, BloqueDraft,
  EjercicioDraft, PatronMovimientoEnum, PeriodoEntrenamiento,
  PlantillaRutinaData, TipoDistribucion, CrearCompletaPayload,
} from '../types/rutina.types'
import type { EjercicioCatalogo } from '../types/ejercicio-catalogo.types'

// ─── Constantes y helpers ─────────────────────────────────────────────────────

const PATRON_LABELS: Record<PatronMovimientoEnum, string> = {
  RODILLA_DOMINANTE: 'Rodilla dominante',
  CADERA_DOMINANTE:  'Cadera dominante',
  EMPUJE:            'Empuje',
  TRACCION:          'Tracción',
  HIBRIDO:           'Híbrido',
  HOMBROS:           'Hombros',
  ACCESORIO:         'Accesorio',
  OTROS:             'Otros',
}

const PATRON_SHORT: Record<PatronMovimientoEnum, string> = {
  RODILLA_DOMINANTE: 'Rodilla',
  CADERA_DOMINANTE:  'Cadera',
  EMPUJE:            'Empuje',
  TRACCION:          'Tracción',
  HIBRIDO:           'Híbrido',
  HOMBROS:           'Hombros',
  ACCESORIO:         'Accesorio',
  OTROS:             'Otros',
}

const TIPO_LABELS: Record<TipoDistribucion, string> = {
  FULL_BODY:  'Full Body',
  ARM_LEG:    'Arm-Leg',
  PUSH_PULL:  'Push-Pull',
  CUSTOM:     'Custom',
}

const TIPO_COLORS: Record<TipoDistribucion, string> = {
  FULL_BODY:  'bg-blue-500/15 text-blue-400 border border-blue-500/25',
  ARM_LEG:    'bg-purple-500/15 text-purple-400 border border-purple-500/25',
  PUSH_PULL:  'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25',
  CUSTOM:     'bg-gray-500/15 text-gray-400 border border-gray-500/25',
}

const PERIODO_LABELS: Record<PeriodoEntrenamiento, string> = {
  CARGA:          'Carga',
  IMPACTO:        'Impacto',
  DESCARGA:       'Descarga',
  MANTENIMIENTO:  'Mantenimiento',
}

const STEP_LABELS = ['Cliente', 'Sesiones', 'Plantilla', 'Estructura', 'Ejercicios', 'Config', 'Confirmar']

const LETRAS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']

function uid(): string {
  return Math.random().toString(36).slice(2, 11)
}

function crearEjercicioVacio(): EjercicioDraft {
  return { _id: uid(), nombre: '' }
}

function crearBloqueVacio(letra: string, orden: number, cant = 2): BloqueDraft {
  return {
    _id: uid(),
    letra,
    orden,
    patronMovimiento: null,
    cantidadEjercicios: cant,
    ejercicios: Array.from({ length: cant }, crearEjercicioVacio),
  }
}

function crearSesionVacia(numero: number, cantBloques = 3): SesionDraft {
  return {
    _id: uid(),
    numero,
    bloques: Array.from({ length: cantBloques }, (_, i) => crearBloqueVacio(LETRAS[i] ?? String(i + 1), i)),
  }
}

function generarEstructura(plantilla: PlantillaRutinaData, cantidadSesiones: number): SesionDraft[] {
  const sesionesPlantilla = plantilla.sesiones.slice(0, cantidadSesiones)
  return sesionesPlantilla.map((sp) => ({
    _id: uid(),
    numero: sp.numero,
    nombre: sp.nombre,
    bloques: sp.bloques.map((bp) => ({
      _id: uid(),
      letra: bp.letra,
      orden: bp.orden,
      patronMovimiento: bp.patronMovimiento,
      cantidadEjercicios: bp.cantidadEjercicios,
      ejercicios: Array.from({ length: bp.cantidadEjercicios }, crearEjercicioVacio),
    })),
  }))
}

function generarEstructuraVacia(cantidadSesiones: number): SesionDraft[] {
  return Array.from({ length: cantidadSesiones }, (_, i) => crearSesionVacia(i + 1))
}

// ─── Estado inicial y reducer ─────────────────────────────────────────────────

const initialState: WizardState = {
  paso: 1,
  modo: 'nueva',
  cliente: null,
  sesionesSemanales: null,
  plantillaId: null,
  sinPlantilla: false,
  sesiones: [],
  nombre: '',
  cantidadSemanas: 4,
  fechaInicio: new Date().toISOString().split('T')[0],
  periodo: null,
  descripcion: '',
  rutinaBaseId: null,
  rutinaBaseSesiones: [],
}

type WizardAction =
  | { type: 'SET_PASO'; paso: number }
  | { type: 'SET_CLIENTE'; cliente: ClienteResumen }
  | { type: 'SET_MODO'; modo: WizardModo; rutinaBaseId?: string }
  | { type: 'SET_SESIONES_SEMANALES'; cantidad: number }
  | { type: 'SET_PLANTILLA'; plantillaId: string | null; sinPlantilla: boolean; sesiones: SesionDraft[] }
  | { type: 'UPDATE_BLOQUE'; sesionId: string; bloqueId: string; changes: Partial<BloqueDraft> }
  | { type: 'ADD_BLOQUE'; sesionId: string }
  | { type: 'DELETE_BLOQUE'; sesionId: string; bloqueId: string }
  | { type: 'UPDATE_EJERCICIO'; sesionId: string; bloqueId: string; ejercicioId: string; changes: Partial<EjercicioDraft> }
  | { type: 'ADD_EJERCICIO_EXTRA'; sesionId: string; bloqueId: string }
  | { type: 'SET_CONFIG'; nombre: string; cantidadSemanas: number; fechaInicio: string; periodo: PeriodoEntrenamiento | null; descripcion: string }
  | { type: 'INIT_MESOCICLO'; sesiones: SesionDraft[]; rutinaBaseId: string }

function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case 'SET_PASO':
      return { ...state, paso: action.paso }

    case 'SET_CLIENTE':
      return { ...state, cliente: action.cliente }

    case 'SET_MODO':
      return {
        ...state,
        modo: action.modo,
        rutinaBaseId: action.rutinaBaseId ?? state.rutinaBaseId,
      }

    case 'SET_SESIONES_SEMANALES':
      return { ...state, sesionesSemanales: action.cantidad }

    case 'SET_PLANTILLA':
      return {
        ...state,
        plantillaId: action.plantillaId,
        sinPlantilla: action.sinPlantilla,
        sesiones: action.sesiones,
      }

    case 'UPDATE_BLOQUE':
      return {
        ...state,
        sesiones: state.sesiones.map(s =>
          s._id !== action.sesionId ? s : {
            ...s,
            bloques: s.bloques.map(b =>
              b._id !== action.bloqueId ? b : { ...b, ...action.changes }
            ),
          }
        ),
      }

    case 'ADD_BLOQUE': {
      return {
        ...state,
        sesiones: state.sesiones.map(s => {
          if (s._id !== action.sesionId) return s
          const siguiente = s.bloques.length
          const letra = LETRAS[siguiente] ?? String.fromCharCode(65 + siguiente)
          return {
            ...s,
            bloques: [...s.bloques, crearBloqueVacio(letra, siguiente)],
          }
        }),
      }
    }

    case 'DELETE_BLOQUE':
      return {
        ...state,
        sesiones: state.sesiones.map(s =>
          s._id !== action.sesionId ? s : {
            ...s,
            bloques: s.bloques.filter(b => b._id !== action.bloqueId),
          }
        ),
      }

    case 'UPDATE_EJERCICIO':
      return {
        ...state,
        sesiones: state.sesiones.map(s =>
          s._id !== action.sesionId ? s : {
            ...s,
            bloques: s.bloques.map(b =>
              b._id !== action.bloqueId ? b : {
                ...b,
                ejercicios: b.ejercicios.map(e =>
                  e._id !== action.ejercicioId ? e : { ...e, ...action.changes }
                ),
              }
            ),
          }
        ),
      }

    case 'ADD_EJERCICIO_EXTRA':
      return {
        ...state,
        sesiones: state.sesiones.map(s =>
          s._id !== action.sesionId ? s : {
            ...s,
            bloques: s.bloques.map(b =>
              b._id !== action.bloqueId ? b : {
                ...b,
                ejercicios: [...b.ejercicios, crearEjercicioVacio()],
              }
            ),
          }
        ),
      }

    case 'SET_CONFIG':
      return {
        ...state,
        nombre: action.nombre,
        cantidadSemanas: action.cantidadSemanas,
        fechaInicio: action.fechaInicio,
        periodo: action.periodo,
        descripcion: action.descripcion,
      }

    case 'INIT_MESOCICLO':
      return {
        ...state,
        sesiones: action.sesiones,
        rutinaBaseId: action.rutinaBaseId,
        rutinaBaseSesiones: action.sesiones,
      }

    default:
      return state
  }
}

// ─── Clases de estilo compartidas ─────────────────────────────────────────────

const glass = 'rounded-[2rem] border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-3xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)]'
const inputCls = 'w-full rounded-xl border border-white/50 dark:border-white/[0.1] bg-white/60 dark:bg-white/[0.05] px-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-[#6B7280] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10 transition-colors'
const labelCls = 'block text-[10px] font-bold text-gray-500 dark:text-[#8A8A9A] mb-1 uppercase tracking-wider'

// ─── StepperHeader ────────────────────────────────────────────────────────────

function StepperHeader({ currentStep, modo }: { currentStep: number; modo: WizardModo }) {
  return (
    <div className="flex items-start mb-8">
      {STEP_LABELS.map((label, idx) => {
        const stepNum = idx + 1
        const done = currentStep > stepNum
        const curr = currentStep === stepNum
        const skipped = modo === 'mesociclo' && stepNum <= 4 && currentStep > stepNum

        return (
          <div key={stepNum} className="flex-1 flex flex-col items-center relative">
            {/* Left connector */}
            {idx > 0 && (
              <div
                className="absolute z-10 h-px top-[18px] -translate-y-1/2"
                style={{
                  left: 0, right: '50%',
                  background: done || curr
                    ? 'linear-gradient(90deg, rgba(251,198,8,0.25), rgba(251,198,8,0.7))'
                    : 'var(--line-inactive)',
                }}
              />
            )}
            {/* Right connector */}
            {idx < STEP_LABELS.length - 1 && (
              <div
                className="absolute z-10 h-px top-[18px] -translate-y-1/2"
                style={{
                  left: '50%', right: 0,
                  background: done
                    ? 'linear-gradient(90deg, rgba(251,198,8,0.7), rgba(251,198,8,0.25))'
                    : 'var(--line-inactive)',
                }}
              />
            )}

            {/* Circle */}
            <div
              className={[
                'relative z-20 flex h-9 w-9 items-center justify-center rounded-xl text-xs font-black transition-all duration-300',
                curr
                  ? 'bg-primary text-black ring-4 ring-primary/25 shadow-[0_0_20px_rgba(251,198,8,0.4)] scale-110'
                  : skipped
                  ? 'bg-gray-300 dark:bg-white/[0.12] text-gray-500 dark:text-white/40 border-2 border-gray-300 dark:border-white/10'
                  : done
                  ? 'bg-primary text-black/80 border-2 border-primary/80 shadow-[0_2px_10px_rgba(251,198,8,0.3)]'
                  : 'bg-white dark:bg-[#111] border-2 border-gray-300 dark:border-white/[0.18] text-gray-500 dark:text-white/50',
              ].join(' ')}
            >
              {done || skipped ? <Check size={13} strokeWidth={2.5} /> : stepNum}
            </div>

            {/* Label */}
            <span className={[
              'mt-1.5 text-[9px] font-bold uppercase tracking-wider hidden sm:block',
              curr ? 'text-gray-900 dark:text-white'
                : done ? 'text-primary'
                : 'text-gray-400 dark:text-[#4A4A5A]',
            ].join(' ')}>
              {label}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ─── OptionCard ───────────────────────────────────────────────────────────────

function OptionCard({
  selected,
  onClick,
  children,
  className = '',
}: {
  selected: boolean
  onClick: () => void
  children: React.ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'relative text-left rounded-2xl border p-4 transition-all duration-200 overflow-hidden w-full',
        selected
          ? 'border-primary/50 dark:border-primary/40 bg-gradient-to-br from-[rgba(251,198,8,0.10)] via-[rgba(251,198,8,0.04)] to-transparent dark:from-[rgba(251,198,8,0.08)] dark:via-[rgba(251,198,8,0.03)] dark:to-transparent shadow-[0_4px_24px_rgba(251,198,8,0.12)]'
          : 'border-white/50 dark:border-white/10 bg-white/40 dark:bg-white/[0.04] backdrop-blur-xl hover:border-white/70 dark:hover:border-white/[0.16] hover:bg-white/60 dark:hover:bg-white/[0.07]',
        className,
      ].join(' ')}
    >
      {selected && (
        <span className="absolute top-2.5 right-2.5 flex h-5 w-5 items-center justify-center rounded-md bg-primary shadow-[0_2px_8px_rgba(251,198,8,0.4)]">
          <Check size={11} strokeWidth={3} className="text-black" />
        </span>
      )}
      {children}
    </button>
  )
}

// ─── SearchableExerciseSelector ───────────────────────────────────────────────

function SearchableExerciseSelector({
  patronHint,
  onSelect,
  onCancel,
}: {
  patronHint: PatronMovimientoEnum | null
  onSelect: (ej: EjercicioCatalogo) => void
  onCancel: () => void
}) {
  const [search, setSearch] = useState('')
  const [patron, setPatron] = useState<string>(patronHint ?? '')
  const [results, setResults] = useState<EjercicioCatalogo[]>([])
  const [loading, setLoading] = useState(false)
  const [videoModal, setVideoModal] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchResults = useCallback(async (q: string, p: string) => {
    setLoading(true)
    try {
      const data = await ejerciciosApi.getAll({
        nombre: q || undefined,
        patronMovimiento: p || undefined,
      })
      setResults(data)
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      void fetchResults(search, patron)
    }, 300)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [search, patron, fetchResults])

  const DIFICULTAD_CLS: Record<string, string> = {
    FACIL:      'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
    INTERMEDIO: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
    AVANZADO:   'bg-red-500/10 text-red-400 border border-red-500/20',
    DIFICIL:    'bg-orange-500/10 text-orange-400 border border-orange-500/20',
  }
  const DIFICULTAD_LABELS: Record<string, string> = {
    FACIL: 'Fácil', INTERMEDIO: 'Intermedio', AVANZADO: 'Avanzado', DIFICIL: 'Difícil',
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar ejercicio..."
            autoFocus
            className={inputCls + ' pl-8'}
          />
        </div>
        <select
          value={patron}
          onChange={e => setPatron(e.target.value)}
          className={inputCls + ' w-40'}
        >
          <option value="">Todos los patrones</option>
          {(Object.keys(PATRON_LABELS) as PatronMovimientoEnum[]).map(p => (
            <option key={p} value={p}>{PATRON_SHORT[p]}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={onCancel}
          className="p-2.5 rounded-xl border border-white/[0.08] text-gray-400 hover:text-white hover:border-white/20 transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      {loading ? (
        <div className="py-2 space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex justify-between items-center px-3 py-2.5">
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-4 w-40 rounded-md" />
                <Skeleton className="h-3 w-20 rounded-md" />
              </div>
              <Skeleton className="h-5 w-12 rounded-full" />
            </div>
          ))}
        </div>
      ) : results.length === 0 ? (
        <p className="py-3 text-sm text-gray-400">Sin resultados. Probá con otro nombre o patrón.</p>
      ) : (
        <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
          {results.map(ej => (
            <button
              key={ej.id}
              type="button"
              onClick={() => onSelect(ej)}
              className="w-full text-left flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 hover:bg-white/[0.06] transition-colors group"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white leading-tight truncate">{ej.nombre}</p>
                {ej.patronMovimiento && (
                  <p className="text-[10px] text-gray-500 mt-0.5">{ej.patronMovimiento}</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold ${DIFICULTAD_CLS[ej.dificultad] ?? ''}`}>
                  {DIFICULTAD_LABELS[ej.dificultad] ?? ej.dificultad}
                </span>
                {ej.videoUrl && (
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); setVideoModal(ej.videoUrl!) }}
                    className="h-6 w-6 flex items-center justify-center rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                  >
                    <ExternalLink size={10} />
                  </button>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Video modal */}
      <AnimatePresence>
        {videoModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={() => setVideoModal(null)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="relative rounded-2xl overflow-hidden w-full max-w-2xl bg-black"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-3 border-b border-white/[0.08]">
                <span className="text-sm text-white font-semibold">Video del ejercicio</span>
                <button onClick={() => setVideoModal(null)} className="p-1 rounded-lg text-gray-400 hover:text-white transition-colors">
                  <X size={16} />
                </button>
              </div>
              <div className="p-4">
                <a
                  href={videoModal}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-primary hover:underline text-sm"
                >
                  <ExternalLink size={14} />
                  Abrir video en nueva pestaña
                </a>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── EjercicioSlot ────────────────────────────────────────────────────────────

function EjercicioSlot({
  ejercicio,
  patronBloque,
  onUpdate,
  esReferencia = false,
}: {
  ejercicio: EjercicioDraft
  patronBloque: PatronMovimientoEnum | null
  onUpdate: (changes: Partial<EjercicioDraft>) => void
  esReferencia?: boolean
}) {
  const [showSelector, setShowSelector] = useState(!ejercicio.nombre)
  const [expanded, setExpanded] = useState(false)

  if (esReferencia && ejercicio._esReferencia) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500 bg-white/[0.06] px-1.5 py-0.5 rounded-md">anterior</span>
          <span className="text-sm text-gray-400">{ejercicio._referenciaData?.nombre ?? ejercicio.nombre}</span>
        </div>
        {ejercicio._referenciaData && (
          <div className="flex gap-3 mt-1 text-[10px] text-gray-600">
            {ejercicio._referenciaData.series !== undefined && <span>{ejercicio._referenciaData.series} series</span>}
            {ejercicio._referenciaData.repeticiones && <span>{ejercicio._referenciaData.repeticiones} reps</span>}
            {ejercicio._referenciaData.peso && <span>{ejercicio._referenciaData.peso} kg</span>}
            {ejercicio._referenciaData.rir !== undefined && <span>RIR {ejercicio._referenciaData.rir}</span>}
          </div>
        )}
        <button
          type="button"
          onClick={() => onUpdate({ _esReferencia: false, nombre: ejercicio._referenciaData?.nombre ?? '' })}
          className="mt-2 text-[10px] font-semibold text-primary hover:text-primary/80 transition-colors"
        >
          Usar como base y editar
        </button>
      </div>
    )
  }

  if (showSelector) {
    return (
      <SearchableExerciseSelector
        patronHint={patronBloque}
        onSelect={(ej) => {
          onUpdate({
            catalogoId: ej.id,
            nombre: ej.nombre,
            _esReferencia: false,
          })
          setShowSelector(false)
          setExpanded(true)
        }}
        onCancel={() => {
          if (!ejercicio.nombre) return
          setShowSelector(false)
        }}
      />
    )
  }

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-white/[0.03] transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
          <span className="text-sm font-semibold text-white truncate">{ejercicio.nombre}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {ejercicio.series && <span className="text-[10px] text-gray-500">{ejercicio.series}×{ejercicio.repeticiones ?? '—'}</span>}
          <button
            type="button"
            onClick={e => { e.stopPropagation(); setShowSelector(true) }}
            className="text-[10px] text-gray-500 hover:text-primary transition-colors"
          >
            cambiar
          </button>
          <ChevronDown size={12} className={`text-gray-500 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-2 border-t border-white/[0.05]">
              <div className="grid grid-cols-3 gap-2 pt-2">
                <div>
                  <label className={labelCls}>Series</label>
                  <input
                    type="number"
                    min={1}
                    value={ejercicio.series ?? ''}
                    onChange={e => onUpdate({ series: e.target.value ? Number(e.target.value) : undefined })}
                    className={inputCls}
                    placeholder="4"
                  />
                </div>
                <div>
                  <label className={labelCls}>Reps</label>
                  <input
                    value={ejercicio.repeticiones ?? ''}
                    onChange={e => onUpdate({ repeticiones: e.target.value || undefined })}
                    className={inputCls}
                    placeholder="8-12"
                  />
                </div>
                <div>
                  <label className={labelCls}>Peso (kg)</label>
                  <input
                    value={ejercicio.peso ?? ''}
                    onChange={e => onUpdate({ peso: e.target.value || undefined })}
                    className={inputCls}
                    placeholder="60"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className={labelCls}>RIR</label>
                  <input
                    type="number"
                    min={0}
                    max={5}
                    value={ejercicio.rir ?? ''}
                    onChange={e => onUpdate({ rir: e.target.value ? Number(e.target.value) : undefined })}
                    className={inputCls}
                    placeholder="2"
                  />
                </div>
                <div>
                  <label className={labelCls}>RPE</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={ejercicio.rpe ?? ''}
                    onChange={e => onUpdate({ rpe: e.target.value ? Number(e.target.value) : undefined })}
                    className={inputCls}
                    placeholder="8"
                  />
                </div>
                <div>
                  <label className={labelCls}>Método</label>
                  <input
                    value={ejercicio.metodo ?? ''}
                    onChange={e => onUpdate({ metodo: e.target.value || undefined })}
                    className={inputCls}
                    placeholder="Drop set"
                  />
                </div>
              </div>
              <div>
                <label className={labelCls}>Notas</label>
                <input
                  value={ejercicio.notas ?? ''}
                  onChange={e => onUpdate({ notas: e.target.value || undefined })}
                  className={inputCls}
                  placeholder="Indicaciones específicas..."
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function CreateRutinaPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const clienteIdFromUrl = searchParams.get('clienteId')
  const addToast = useUiStore(s => s.addToast)
  const [state, dispatch] = useReducer(wizardReducer, initialState)
  const [isSaving, setIsSaving] = useState(false)
  const [loadingClienteInit, setLoadingClienteInit] = useState(!!clienteIdFromUrl)

  // Si viene desde ClientRutinaPage con ?clienteId=xxx, pre-carga el cliente y salta al paso 2
  useEffect(() => {
    if (!clienteIdFromUrl) return
    let cancelled = false
    async function precargarCliente() {
      try {
        const full = await clientsApi.getById(clienteIdFromUrl!)
        const resumen: ClienteResumen = {
          id: String(full.id),
          nombre: full.name,
          apellido: full.lastName,
          planActivo: full.planName ?? null,
          frecuenciaSemanal: full.planFrequency ?? null,
          membresiaVigente: full.membershipStatus === 'ACTIVA',
          rutinaActivaId: null,
          rutinaActivaNombre: null,
        }
        try {
          const rutinas = await rutinasApi.getByCliente(clienteIdFromUrl!)
          const activa = rutinas.find(r => r.activa)
          if (activa) {
            resumen.rutinaActivaId = activa.id
            resumen.rutinaActivaNombre = activa.nombre
          }
        } catch { /* sin rutinas activas */ }
        if (!cancelled) {
          dispatch({ type: 'SET_CLIENTE', cliente: resumen })
          dispatch({ type: 'SET_PASO', paso: 2 })
        }
      } catch {
        if (!cancelled) addToast('Error al cargar el cliente', 'error')
      } finally {
        if (!cancelled) setLoadingClienteInit(false)
      }
    }
    precargarCliente()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Paso 1 — Buscar cliente ────────────────────────────────────────────────

  function Paso1() {
    const [search, setSearch] = useState('')
    const [results, setResults] = useState<ReturnType<typeof Array.prototype.map> extends (infer T)[] ? T[] : never[]>([])
    const [loadingSearch, setLoadingSearch] = useState(false)
    const [loadingCliente, setLoadingCliente] = useState(false)
    const [clienteSeleccionadoRaw, setClienteSeleccionadoRaw] = useState<ClienteResumen | null>(state.cliente)
    type ResultItem = { id: number; nombre: string; apellido: string }
    const [rawResults, setRawResults] = useState<ResultItem[]>([])
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => {
      if (search.length < 2) { setRawResults([]); return }
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(async () => {
        setLoadingSearch(true)
        try {
          const res = await clientsApi.getAll()
          const q = search.toLowerCase()
          const filtered = res.filter(c =>
            c.name.toLowerCase().includes(q) || c.lastName.toLowerCase().includes(q)
          )
          setRawResults(filtered.map(c => ({ id: Number(c.id), nombre: c.name, apellido: c.lastName })))
        } catch {
          setRawResults([])
        } finally {
          setLoadingSearch(false)
        }
      }, 300)
      return () => { if (timerRef.current) clearTimeout(timerRef.current) }
    }, [search])

    async function seleccionarCliente(id: number) {
      setLoadingCliente(true)
      try {
        const full = await clientsApi.getById(String(id))
        const membresiaActiva = full.membershipStatus === 'ACTIVA'
        const resumen: ClienteResumen = {
          id: String(full.id),
          nombre: full.name,
          apellido: full.lastName,
          planActivo: full.planName ?? null,
          frecuenciaSemanal: full.planFrequency ?? null,
          membresiaVigente: membresiaActiva,
          rutinaActivaId: null,
          rutinaActivaNombre: null,
        }
        // Intentar cargar rutinas activas
        try {
          const rutinas = await rutinasApi.getByCliente(String(id))
          const activa = rutinas.find(r => r.activa)
          if (activa) {
            resumen.rutinaActivaId = activa.id
            resumen.rutinaActivaNombre = activa.nombre
          }
        } catch { /* sin rutinas activas */ }

        setClienteSeleccionadoRaw(resumen)
      } catch {
        addToast('Error al cargar el cliente', 'error')
      } finally {
        setLoadingCliente(false)
      }
    }

    function confirmarCliente() {
      if (!clienteSeleccionadoRaw) return
      dispatch({ type: 'SET_CLIENTE', cliente: clienteSeleccionadoRaw })
      dispatch({ type: 'SET_MODO', modo: 'nueva' })
      dispatch({ type: 'SET_PASO', paso: 2 })
    }

    function elegirMesociclo() {
      if (!clienteSeleccionadoRaw?.rutinaActivaId) return
      dispatch({ type: 'SET_CLIENTE', cliente: clienteSeleccionadoRaw })
      dispatch({ type: 'SET_MODO', modo: 'mesociclo', rutinaBaseId: clienteSeleccionadoRaw.rutinaActivaId })
      dispatch({ type: 'SET_PASO', paso: 2 })
    }

    return (
      <div className="space-y-5">
        <div>
          <label className={labelCls}>Buscar cliente</label>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Nombre o apellido (mín. 2 caracteres)"
              className={inputCls + ' pl-9'}
            />
          </div>
        </div>

        {loadingSearch && (
          <div className="space-y-2">
            {[1, 2].map(i => (
              <div key={i} className="flex gap-3 items-center rounded-xl bg-white/[0.02] px-4 py-3 animate-pulse">
                <Skeleton className="h-8 w-8 rounded-xl shrink-0" />
                <Skeleton className="h-4 w-32 rounded-md" />
              </div>
            ))}
          </div>
        )}

        {rawResults.length > 0 && !clienteSeleccionadoRaw && (
          <div className="space-y-1.5 max-h-52 overflow-y-auto">
            {rawResults.map(r => (
              <button
                key={r.id}
                type="button"
                onClick={() => void seleccionarCliente(r.id)}
                className="w-full text-left flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 hover:bg-white/[0.07] hover:border-white/[0.14] transition-all"
              >
                <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <User size={14} className="text-primary" />
                </div>
                <span className="text-sm font-semibold text-white">{r.nombre} {r.apellido}</span>
              </button>
            ))}
          </div>
        )}

        {loadingCliente && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 space-y-4 animate-pulse">
            <div className="flex gap-4 items-center">
              <Skeleton className="h-12 w-12 rounded-full shrink-0" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-5 w-36 rounded-md" />
                <Skeleton className="h-3.5 w-24 rounded-md" />
              </div>
            </div>
            <div className="space-y-2 pt-2 border-t border-white/[0.05]">
              <Skeleton className="h-4 w-full rounded-md" />
              <Skeleton className="h-4 w-5/6 rounded-md" />
            </div>
          </div>
        )}

        {clienteSeleccionadoRaw && !loadingCliente && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-primary/30 bg-gradient-to-br from-[rgba(251,198,8,0.07)] to-transparent p-5 space-y-4"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                <User size={18} className="text-primary" />
              </div>
              <div>
                <p className="text-base font-black text-white">{clienteSeleccionadoRaw.nombre} {clienteSeleccionadoRaw.apellido}</p>
                <p className="text-xs text-gray-400">
                  {clienteSeleccionadoRaw.planActivo
                    ? `${clienteSeleccionadoRaw.planActivo} · ${clienteSeleccionadoRaw.frecuenciaSemanal ?? '?'}× / semana`
                    : 'Sin plan activo'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setClienteSeleccionadoRaw(null)}
                className="ml-auto p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/[0.06] transition-colors"
              >
                <X size={13} />
              </button>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${clienteSeleccionadoRaw.membresiaVigente ? 'bg-emerald-400' : 'bg-red-400'}`} />
              <span className={clienteSeleccionadoRaw.membresiaVigente ? 'text-emerald-400' : 'text-red-400'}>
                {clienteSeleccionadoRaw.membresiaVigente ? 'Membresía vigente' : 'Sin membresía activa'}
              </span>
            </div>

            {clienteSeleccionadoRaw.rutinaActivaNombre ? (
              <div className="space-y-2">
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-amber-500/70 mb-0.5">Rutina activa</p>
                  <p className="text-sm text-amber-300 font-semibold">{clienteSeleccionadoRaw.rutinaActivaNombre}</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={confirmarCliente}
                    className="rounded-xl border border-white/[0.1] bg-white/[0.04] px-3 py-2.5 text-xs font-semibold text-white hover:bg-white/[0.08] transition-colors"
                  >
                    Nueva desde cero
                  </button>
                  <button
                    type="button"
                    onClick={elegirMesociclo}
                    className="rounded-xl border border-primary/40 bg-primary/10 px-3 py-2.5 text-xs font-semibold text-primary hover:bg-primary/15 transition-colors"
                  >
                    Nuevo mesociclo
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={confirmarCliente}
                className="w-full rounded-xl bg-primary text-black text-sm font-black py-2.5 hover:bg-primary/90 transition-colors"
              >
                Continuar con este cliente
              </button>
            )}
          </motion.div>
        )}
      </div>
    )
  }

  // ── Paso 2 — Cantidad de sesiones semanales ────────────────────────────────

  function Paso2() {
    const freq = state.cliente?.frecuenciaSemanal ?? null
    const opciones = [2, 3, 4, 5]

    function isHabilitado(n: number): boolean {
      if (freq === null) return true
      if (freq <= 2) return n === 2
      if (freq === 3) return n <= 3
      return true
    }

    return (
      <div className="space-y-5">
        {freq !== null && (
          <div className="flex items-start gap-2.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3">
            <AlertCircle size={14} className="text-gray-400 shrink-0 mt-0.5" />
            <p className="text-xs text-gray-400">
              El plan del cliente permite hasta <strong className="text-white">{freq}× por semana</strong>.
              Solo se habilitan las opciones compatibles.
            </p>
          </div>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {opciones.map(n => {
            const hab = isHabilitado(n)
            return (
              <button
                key={n}
                type="button"
                disabled={!hab}
                onClick={() => dispatch({ type: 'SET_SESIONES_SEMANALES', cantidad: n })}
                className={[
                  'relative rounded-2xl border p-5 text-center transition-all duration-200',
                  !hab
                    ? 'border-white/[0.04] bg-white/[0.02] opacity-35 cursor-not-allowed'
                    : state.sesionesSemanales === n
                    ? 'border-primary/50 bg-gradient-to-br from-[rgba(251,198,8,0.10)] to-transparent shadow-[0_4px_24px_rgba(251,198,8,0.12)]'
                    : 'border-white/10 bg-white/[0.04] hover:border-white/[0.16] hover:bg-white/[0.07]',
                ].join(' ')}
              >
                {state.sesionesSemanales === n && (
                  <span className="absolute top-2 right-2 flex h-4 w-4 items-center justify-center rounded-md bg-primary">
                    <Check size={9} strokeWidth={3} className="text-black" />
                  </span>
                )}
                <span className={`text-3xl font-black block ${state.sesionesSemanales === n ? 'text-primary' : 'text-white'}`}>{n}</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mt-1 block">días/semana</span>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // ── Paso 3 — Elegir plantilla ──────────────────────────────────────────────

  function Paso3() {
    const [plantillas, setPlantillas] = useState<PlantillaRutinaData[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
      void (async () => {
        try {
          const data = await plantillasApi.getAll()
          const filtradas = data.filter(p =>
            p.activa && p.cantidadSesiones === state.sesionesSemanales
          )
          setPlantillas(filtradas)
        } catch {
          setPlantillas([])
        } finally {
          setLoading(false)
        }
      })()
    }, [])

    function seleccionarPlantilla(p: PlantillaRutinaData) {
      const sesiones = generarEstructura(p, state.sesionesSemanales ?? p.cantidadSesiones)
      dispatch({ type: 'SET_PLANTILLA', plantillaId: p.id, sinPlantilla: false, sesiones })
    }

    function elegirManual() {
      const sesiones = generarEstructuraVacia(state.sesionesSemanales ?? 3)
      dispatch({ type: 'SET_PLANTILLA', plantillaId: null, sinPlantilla: true, sesiones })
      dispatch({ type: 'SET_PASO', paso: 5 })
    }

    if (loading) {
      return (
        <div className="space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 space-y-3 animate-pulse">
              <div className="flex gap-4 items-center">
                <Skeleton className="h-5 w-44 rounded-md" />
                <Skeleton className="h-4 w-12 rounded-full shrink-0 ml-auto" />
              </div>
              <Skeleton className="h-3.5 w-64 rounded-md" />
            </div>
          ))}
        </div>
      )
    }

    return (
      <div className="space-y-3">
        {plantillas.length === 0 && (
          <div className="flex items-start gap-2.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 mb-2">
            <AlertCircle size={14} className="text-gray-400 shrink-0 mt-0.5" />
            <p className="text-xs text-gray-400">
              No hay plantillas activas para {state.sesionesSemanales} sesiones.
              Podés continuar armando la rutina manualmente.
            </p>
          </div>
        )}

        {plantillas.map(p => (
          <OptionCard
            key={p.id}
            selected={state.plantillaId === p.id}
            onClick={() => seleccionarPlantilla(p)}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-black text-white leading-tight">{p.nombre}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold ${TIPO_COLORS[p.tipo]}`}>
                    {TIPO_LABELS[p.tipo]}
                  </span>
                  <span className="text-[10px] text-gray-500">{p.cantidadSesiones} sesiones</span>
                </div>
              </div>
              {/* Preview estructura */}
              <div className="shrink-0 flex gap-1.5">
                {p.sesiones.slice(0, state.sesionesSemanales ?? p.cantidadSesiones).map((s, si) => (
                  <div key={si} className="flex flex-col gap-1">
                    {s.bloques.map((b, bi) => (
                      <div
                        key={bi}
                        className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-white/[0.06] text-gray-400 whitespace-nowrap"
                      >
                        {PATRON_SHORT[b.patronMovimiento] ?? '?'}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </OptionCard>
        ))}

        {/* Sin plantilla */}
        <button
          type="button"
          onClick={elegirManual}
          className={[
            'relative text-left rounded-2xl border p-4 transition-all duration-200 w-full',
            state.sinPlantilla
              ? 'border-gray-400/40 bg-white/[0.05]'
              : 'border-white/10 bg-white/[0.04] hover:border-white/[0.16] hover:bg-white/[0.07]',
          ].join(' ')}
        >
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-white/[0.06] border border-white/[0.1] flex items-center justify-center shrink-0">
              <Wrench size={15} className="text-gray-400" />
            </div>
            <div>
              <p className="text-sm font-black text-white">Sin plantilla — armar manualmente</p>
              <p className="text-xs text-gray-500 mt-0.5">Genera {state.sesionesSemanales} sesiones con bloques vacíos para configurar libremente</p>
            </div>
          </div>
        </button>
      </div>
    )
  }

  // ── Paso 4 — Revisar y ajustar estructura ──────────────────────────────────

  function Paso4() {
    return (
      <div className="space-y-4">
        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${state.sesiones.length}, minmax(0, 1fr))` }}>
          {state.sesiones.map(sesion => (
            <div key={sesion._id} className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 text-center">
                Sesión {sesion.numero}
              </p>

              {sesion.bloques.map(bloque => (
                <div
                  key={bloque._id}
                  className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-primary">Bloque {bloque.letra}</span>
                    <button
                      type="button"
                      onClick={() => dispatch({ type: 'DELETE_BLOQUE', sesionId: sesion._id, bloqueId: bloque._id })}
                      className="h-5 w-5 flex items-center justify-center rounded-md text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <X size={10} />
                    </button>
                  </div>

                  <select
                    value={bloque.patronMovimiento ?? ''}
                    onChange={e => dispatch({
                      type: 'UPDATE_BLOQUE',
                      sesionId: sesion._id,
                      bloqueId: bloque._id,
                      changes: { patronMovimiento: (e.target.value as PatronMovimientoEnum) || null },
                    })}
                    className="w-full text-xs rounded-lg border border-white/[0.08] bg-white/[0.05] px-2 py-1.5 text-white focus:border-primary focus:outline-none transition-colors"
                  >
                    <option value="">Sin patrón</option>
                    {(Object.keys(PATRON_LABELS) as PatronMovimientoEnum[]).map(p => (
                      <option key={p} value={p}>{PATRON_LABELS[p]}</option>
                    ))}
                  </select>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-500 shrink-0">Ejercicios:</span>
                    <input
                      type="number"
                      min={1}
                      max={6}
                      value={bloque.cantidadEjercicios}
                      onChange={e => {
                        const n = Math.max(1, Math.min(6, Number(e.target.value)))
                        const ejActuales = bloque.ejercicios.slice(0, n)
                        const extra = n > ejActuales.length
                          ? Array.from({ length: n - ejActuales.length }, crearEjercicioVacio)
                          : []
                        dispatch({
                          type: 'UPDATE_BLOQUE',
                          sesionId: sesion._id,
                          bloqueId: bloque._id,
                          changes: {
                            cantidadEjercicios: n,
                            ejercicios: [...ejActuales, ...extra],
                          },
                        })
                      }}
                      className="w-12 text-xs rounded-lg border border-white/[0.08] bg-white/[0.05] px-2 py-1 text-white text-center focus:border-primary focus:outline-none"
                    />
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={() => dispatch({ type: 'ADD_BLOQUE', sesionId: sesion._id })}
                className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/[0.1] py-2 text-[11px] text-gray-500 hover:text-white hover:border-white/[0.2] transition-colors"
              >
                <Plus size={11} /> Bloque
              </button>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── Paso 5 — Asignar ejercicios ────────────────────────────────────────────

  function Paso5() {
    return (
      <div className="space-y-8">
        {state.sesiones.map(sesion => (
          <div key={sesion._id}>
            <p className="text-xs font-black uppercase tracking-wider text-primary mb-3">
              Sesión {sesion.numero}{sesion.nombre ? ` — ${sesion.nombre}` : ''}
            </p>

            <div className="space-y-4">
              {sesion.bloques.map(bloque => (
                <div key={bloque._id} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] overflow-hidden">
                  <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/[0.05] bg-white/[0.02]">
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/15 text-xs font-black text-primary">
                      {bloque.letra}
                    </span>
                    {bloque.patronMovimiento && (
                      <span className="text-[10px] font-semibold text-gray-400 bg-white/[0.05] px-2 py-0.5 rounded-md">
                        {PATRON_LABELS[bloque.patronMovimiento]}
                      </span>
                    )}
                    <span className="ml-auto text-[10px] text-gray-600">
                      {bloque.ejercicios.filter(e => e.nombre).length}/{bloque.ejercicios.length} asignados
                    </span>
                  </div>

                  <div className="p-3 space-y-2">
                    {bloque.ejercicios.map(ej => (
                      <EjercicioSlot
                        key={ej._id}
                        ejercicio={ej}
                        patronBloque={bloque.patronMovimiento}
                        esReferencia={ej._esReferencia === true}
                        onUpdate={changes => dispatch({
                          type: 'UPDATE_EJERCICIO',
                          sesionId: sesion._id,
                          bloqueId: bloque._id,
                          ejercicioId: ej._id,
                          changes,
                        })}
                      />
                    ))}

                    <button
                      type="button"
                      onClick={() => dispatch({ type: 'ADD_EJERCICIO_EXTRA', sesionId: sesion._id, bloqueId: bloque._id })}
                      className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/[0.1] py-2 text-[11px] text-gray-500 hover:text-white hover:border-white/[0.2] transition-colors mt-1"
                    >
                      <Plus size={11} /> Ejercicio extra
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  // ── Paso 6 — Configuración ─────────────────────────────────────────────────

  const configSchema = z.object({
    nombre:          z.string().min(1, 'El nombre es requerido'),
    cantidadSemanas: z.number().min(1).max(12),
    fechaInicio:     z.string().min(1, 'La fecha es requerida'),
    periodo:         z.enum(['CARGA', 'IMPACTO', 'DESCARGA', 'MANTENIMIENTO']).optional(),
    descripcion:     z.string().optional(),
  })
  type ConfigForm = z.infer<typeof configSchema>

  function Paso6() {
    const sugerencia = state.nombre || (() => {
      if (state.cliente) return `Rutina — ${state.cliente.nombre} ${state.cliente.apellido}`
      return ''
    })()

    const { register, handleSubmit, formState: { errors } } = useForm<ConfigForm>({
      resolver: zodResolver(configSchema),
      defaultValues: {
        nombre: sugerencia,
        cantidadSemanas: state.cantidadSemanas,
        fechaInicio: state.fechaInicio,
        periodo: state.periodo ?? undefined,
        descripcion: state.descripcion,
      },
    })

    function onValid(data: ConfigForm) {
      dispatch({
        type: 'SET_CONFIG',
        nombre: data.nombre,
        cantidadSemanas: data.cantidadSemanas,
        fechaInicio: data.fechaInicio,
        periodo: (data.periodo as PeriodoEntrenamiento) ?? null,
        descripcion: data.descripcion ?? '',
      })
      dispatch({ type: 'SET_PASO', paso: 7 })
    }

    return (
      <form id="form-paso6" onSubmit={handleSubmit(onValid)} className="space-y-5">
        <div>
          <label className={labelCls}>Nombre de la rutina *</label>
          <input {...register('nombre')} className={inputCls} placeholder="Meso 1 — Full Body" />
          {errors.nombre && <p className="mt-1 text-xs text-red-400">{errors.nombre.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Cantidad de semanas</label>
            <input
              type="number"
              min={1}
              max={12}
              {...register('cantidadSemanas', { valueAsNumber: true })}
              className={inputCls}
            />
            {errors.cantidadSemanas && <p className="mt-1 text-xs text-red-400">Entre 1 y 12</p>}
          </div>
          <div>
            <label className={labelCls}>Fecha de inicio</label>
            <input type="date" {...register('fechaInicio')} className={inputCls} />
            {errors.fechaInicio && <p className="mt-1 text-xs text-red-400">{errors.fechaInicio.message}</p>}
          </div>
        </div>

        <div>
          <label className={labelCls}>Período de entrenamiento (opcional)</label>
          <select {...register('periodo')} className={inputCls}>
            <option value="">— Sin especificar —</option>
            {(Object.keys(PERIODO_LABELS) as PeriodoEntrenamiento[]).map(p => (
              <option key={p} value={p}>{PERIODO_LABELS[p]}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelCls}>Descripción (opcional)</label>
          <textarea
            {...register('descripcion')}
            rows={3}
            className={inputCls + ' resize-none'}
            placeholder="Objetivos, notas para el cliente, etc."
          />
        </div>
      </form>
    )
  }

  // ── Paso 7 — Confirmar y guardar ───────────────────────────────────────────

  function Paso7() {
    const totalBloques = state.sesiones.reduce((sum, s) => sum + s.bloques.length, 0)
    const totalEjercicios = state.sesiones.reduce((sum, s) =>
      sum + s.bloques.reduce((bs, b) => bs + b.ejercicios.filter(e => e.nombre).length, 0), 0)

    const resumen = [
      {
        icon: User,
        label: 'Cliente',
        value: state.cliente ? `${state.cliente.nombre} ${state.cliente.apellido}` : '—',
        sub: state.cliente?.planActivo ?? undefined,
      },
      {
        icon: Layers,
        label: 'Plantilla',
        value: state.sinPlantilla ? 'Armado manualmente' : (state.plantillaId ? 'Plantilla seleccionada' : '—'),
      },
      {
        icon: ClipboardList,
        label: 'Estructura',
        value: `${state.sesiones.length} sesiones · ${totalBloques} bloques en total`,
      },
      {
        icon: Dumbbell,
        label: 'Ejercicios',
        value: `${totalEjercicios} ejercicio${totalEjercicios !== 1 ? 's' : ''} asignados`,
      },
      {
        icon: Settings2,
        label: 'Configuración',
        value: state.nombre || '—',
        sub: `${state.cantidadSemanas} semanas · desde ${state.fechaInicio}${state.periodo ? ` · ${PERIODO_LABELS[state.periodo]}` : ''}`,
      },
    ]

    return (
      <div className="space-y-3">
        {resumen.map((item, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.06 }}
            className="flex items-start gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3"
          >
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <item.icon size={14} className="text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{item.label}</p>
              <p className="text-sm font-semibold text-white mt-0.5">{item.value}</p>
              {item.sub && <p className="text-xs text-gray-400 mt-0.5">{item.sub}</p>}
            </div>
          </motion.div>
        ))}

        {state.modo === 'mesociclo' && state.rutinaBaseId && (
          <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2.5 mt-2">
            <AlertCircle size={13} className="text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-300">
              Al guardar, la rutina anterior quedará inactiva y esta pasará a ser la rutina activa del cliente.
            </p>
          </div>
        )}
      </div>
    )
  }

  // ── Lógica de navegación ───────────────────────────────────────────────────

  function canGoNext(): boolean {
    switch (state.paso) {
      case 1: return state.cliente !== null
      case 2: return state.sesionesSemanales !== null
      case 3: return state.sinPlantilla || state.plantillaId !== null
      case 4: return true
      case 5: return true
      case 6: return false // Controlado por el form submit
      case 7: return false // Controlado por el botón guardar
      default: return false
    }
  }

  async function handleNext() {
    if (state.paso === 2 && state.modo === 'mesociclo') {
      // Cargar la rutina base para precargarse en paso 5
      if (state.rutinaBaseId) {
        try {
          const rutina = await rutinasApi.getById(state.rutinaBaseId)
          const primerasSemanas = rutina.semanas[0]
          if (primerasSemanas) {
            const sesionesDraft: SesionDraft[] = primerasSemanas.sesiones.map((s, si) => ({
              _id: uid(),
              numero: si + 1,
              bloques: s.bloques.map((b, bi) => ({
                _id: uid(),
                letra: LETRAS[bi] ?? String.fromCharCode(65 + bi),
                orden: bi,
                patronMovimiento: null,
                cantidadEjercicios: b.ejerciciosPlan.length,
                ejercicios: b.ejerciciosPlan.map(e => ({
                  _id: uid(),
                  nombre: '',
                  _esReferencia: true,
                  _referenciaData: {
                    nombre: e.nombre,
                    series: e.series,
                    repeticiones: e.repeticiones ?? undefined,
                    peso: e.peso ?? undefined,
                    rir: e.rir ?? undefined,
                  },
                })),
              })),
            }))
            dispatch({ type: 'INIT_MESOCICLO', sesiones: sesionesDraft, rutinaBaseId: state.rutinaBaseId })
          }
        } catch {
          addToast('No se pudo cargar la rutina base', 'error')
        }
      }
      dispatch({ type: 'SET_PASO', paso: 5 })
      return
    }
    if (state.paso < 7) {
      dispatch({ type: 'SET_PASO', paso: state.paso + 1 })
    }
  }

  function handleBack() {
    if (state.paso <= 1) { navigate(-1); return }
    // Si vino con clienteId en URL y está en el paso 2 (primero del wizard), volver a la página del cliente
    if (state.paso === 2 && clienteIdFromUrl) {
      navigate(`/clients/${clienteIdFromUrl}/rutina`)
      return
    }
    if (state.paso === 5 && state.modo === 'mesociclo') {
      dispatch({ type: 'SET_PASO', paso: 2 })
      return
    }
    if (state.paso === 5 && state.sinPlantilla) {
      dispatch({ type: 'SET_PASO', paso: 3 })
      return
    }
    dispatch({ type: 'SET_PASO', paso: state.paso - 1 })
  }

  async function handleGuardar() {
    if (!state.cliente) return
    setIsSaving(true)
    try {
      const payload: CrearCompletaPayload = {
        clienteId: state.cliente.id,
        nombre: state.nombre,
        descripcion: state.descripcion || undefined,
        cantidadSemanas: state.cantidadSemanas,
        fechaInicio: state.fechaInicio || undefined,
        periodo: state.periodo ?? undefined,
        plantillaId: state.plantillaId ?? undefined,
        rutinaBaseId: state.rutinaBaseId ?? undefined,
        sesiones: state.sesiones.map((s, si) => ({
          numero: si + 1,
          nombre: s.nombre,
          bloques: s.bloques.map((b, bi) => ({
            letra: b.letra,
            orden: bi,
            patronMovimiento: b.patronMovimiento ?? undefined,
            ejercicios: b.ejercicios
              .filter(e => e.nombre && !e._esReferencia)
              .map((e, ei) => ({
                catalogoId: e.catalogoId,
                nombre: e.nombre,
                series: e.series,
                repeticiones: e.repeticiones,
                peso: e.peso,
                rir: e.rir,
                rpe: e.rpe,
                metodo: e.metodo,
                notas: e.notas,
                orden: ei,
              })),
          })),
        })),
      }
      await rutinasApi.crearCompleta(payload)
      addToast('Rutina creada correctamente', 'success')
      navigate(`/clients/${state.cliente.id}/rutina`)
    } catch {
      addToast('Error al crear la rutina. Intentá de nuevo.', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  // ── Step header info ───────────────────────────────────────────────────────

  const STEP_META_LOCAL: Record<number, { Icon: typeof User; title: string; desc: string }> = {
    1: { Icon: User,         title: 'Seleccionar cliente',    desc: 'Buscá al cliente al que le vas a crear la rutina' },
    2: { Icon: ClipboardList,title: 'Sesiones semanales',      desc: 'Elegí cuántas veces por semana va a entrenar' },
    3: { Icon: Layers,       title: 'Plantilla',               desc: 'Elegí una estructura base o armá la rutina manualmente' },
    4: { Icon: Settings2,    title: 'Ajustar estructura',      desc: 'Revisá y modificá bloques y patrones de movimiento' },
    5: { Icon: Dumbbell,     title: 'Asignar ejercicios',      desc: 'Seleccioná y configurá los ejercicios de cada bloque' },
    6: { Icon: Settings2,    title: 'Configuración',           desc: 'Nombre, duración y período de la rutina' },
    7: { Icon: Eye,          title: 'Confirmar y guardar',     desc: 'Revisá el resumen antes de crear la rutina' },
  }

  const stepMeta = STEP_META_LOCAL[state.paso]

  // ── Render ────────────────────────────────────────────────────────────────

  if (loadingClienteInit) {
    return (
      <div className="space-y-6">
        {/* Skeleton Breadcrumb */}
        <Skeleton className="h-5 w-20 rounded-md" />
        
        {/* Skeleton Title Card */}
        <div className="space-y-2">
          <Skeleton className="h-9 w-48 rounded-xl" />
          <Skeleton className="h-4 w-72 rounded-md" />
        </div>
        
        {/* Skeleton Body Card */}
        <div className="rounded-[2rem] border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-3xl p-6 space-y-4">
          <Skeleton className="h-8 w-1/3 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-full rounded-md" />
            <Skeleton className="h-4 w-5/6 rounded-md" />
            <Skeleton className="h-4 w-4/5 rounded-md" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className="space-y-6 min-h-screen"
    >
      {/* Breadcrumb */}
      <button
        onClick={handleBack}
        className="group flex items-center gap-2 text-sm text-gray-400 dark:text-[#5A5A6A] hover:text-gray-900 dark:hover:text-white transition-colors"
      >
        <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
        {(state.paso === 1 || (state.paso === 2 && !!clienteIdFromUrl)) ? 'Volver' : 'Paso anterior'}
      </button>

      {/* Título de página */}
      <div>
        <h1 className="text-3xl md:text-4xl font-black tracking-tighter text-gray-900 dark:text-white leading-none">
          {state.modo === 'mesociclo' ? 'Nuevo mesociclo' : 'Crear rutina'}
        </h1>
        <p className="text-sm text-gray-500 dark:text-[#6A6A7A] mt-2">
          {state.cliente
            ? `Cliente: ${state.cliente.nombre} ${state.cliente.apellido}`
            : 'Wizard de creación de rutinas en 7 pasos'}
        </p>
      </div>

      {/* Wizard card */}
      <div className={`${glass} overflow-hidden`}>
        <div className="h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

        <div className="p-6 md:p-8">
          <StepperHeader currentStep={state.paso} modo={state.modo} />

          {/* Step header */}
          {stepMeta && (
            <div className="flex items-center gap-4 mb-6 pb-5 border-b border-gray-100 dark:border-white/[0.05]">
              <div className="shrink-0 h-11 w-11 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 dark:from-primary/10 dark:to-primary/[0.03] flex items-center justify-center border border-primary/20">
                <stepMeta.Icon size={18} className="text-primary" />
              </div>
              <div className="flex-1">
                <h2 className="text-base font-black text-gray-900 dark:text-white tracking-tight">{stepMeta.title}</h2>
                <p className="text-xs text-gray-500 dark:text-[#6A6A7A] mt-0.5">{stepMeta.desc}</p>
              </div>
              <span className="shrink-0 text-[10px] font-bold uppercase tracking-widest text-gray-300 dark:text-[#3A3A4A]">
                Paso {state.paso}/7
              </span>
            </div>
          )}

          {/* Contenido del paso actual */}
          <AnimatePresence mode="wait">
            <motion.div
              key={state.paso}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.16, ease: 'easeOut' }}
              className="min-h-[280px]"
            >
              {state.paso === 1 && <Paso1 />}
              {state.paso === 2 && <Paso2 />}
              {state.paso === 3 && <Paso3 />}
              {state.paso === 4 && <Paso4 />}
              {state.paso === 5 && <Paso5 />}
              {state.paso === 6 && <Paso6 />}
              {state.paso === 7 && <Paso7 />}
            </motion.div>
          </AnimatePresence>

          {/* Navegación */}
          <div className="flex items-center justify-between gap-3 mt-8 pt-6 border-t border-gray-100 dark:border-white/[0.05]">
            <button
              type="button"
              onClick={handleBack}
              className="flex items-center gap-1.5 text-sm font-semibold text-gray-400 dark:text-[#5A5A6A] hover:text-gray-700 dark:hover:text-white transition-colors px-3 py-2"
            >
              <ArrowLeft size={14} />
              {state.paso === 1 ? 'Cancelar' : 'Atrás'}
            </button>

            <div className="flex items-center gap-2">
              {/* Pasos 1-5: botón Siguiente */}
              {state.paso >= 1 && state.paso <= 5 && (
                <button
                  type="button"
                  disabled={!canGoNext()}
                  onClick={() => void handleNext()}
                  className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-black text-black hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Continuar
                  <ChevronDown size={14} className="-rotate-90" />
                </button>
              )}

              {/* Paso 6: submit del form */}
              {state.paso === 6 && (
                <button
                  type="submit"
                  form="form-paso6"
                  className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-black text-black hover:bg-primary/90 transition-colors"
                >
                  Revisar resumen
                  <ChevronDown size={14} className="-rotate-90" />
                </button>
              )}

              {/* Paso 7: guardar */}
              {state.paso === 7 && (
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => void handleGuardar()}
                  className="flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-black text-black hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-black/20 border-t-black" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Check size={14} />
                      Crear rutina
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        :root { --line-inactive: rgba(0,0,0,0.08); }
        .dark { --line-inactive: rgba(255,255,255,0.06); }
      `}</style>
    </motion.div>
  )
}
