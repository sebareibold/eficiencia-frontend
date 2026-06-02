import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  ArrowLeft, Plus, Copy, Trash2, Pencil, Check, X,
  BookOpen, Dumbbell, ExternalLink, ChevronDown, User2, Search,
  Save, AlertTriangle, ChevronRight, GripVertical, Trophy, CalendarDays,
} from 'lucide-react'
import { format, parseISO, differenceInDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { DIFICULTAD_LABELS } from '../types/ejercicio-catalogo.types'
import { rutinasApi } from '../api/rutinas.api'
import { ejerciciosApi } from '../api/ejercicios.api'
import { clientsApi } from '../api/clients.api'
import { useAuthStore } from '../store/authStore'
import { useRutinas } from '../hooks/useRutinas'
import { useRutinaDraft, type DraftBloque, type DraftEjercicio, type DraftSesion, type DraftSemana, type UpdateEjData } from '../hooks/useRutinaDraft'
import type { Rutina, EjercicioPlan, PatronMovimientoEnum, FichaEntrenamiento } from '../types/rutina.types'
import type { EjercicioCatalogo } from '../types/ejercicio-catalogo.types'
import { ROUTES } from '../constants/routes'
import { useUiStore } from '../store/uiStore'
import Skeleton, { SkeletonRutinaPanel } from '../components/ui/Skeleton'

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

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

const DIA_SHORT: Record<string, string> = {
  Lunes: 'LUN', Martes: 'MAR', 'Miércoles': 'MIÉ',
  Jueves: 'JUE', Viernes: 'VIE', Sábado: 'SÁB',
}

const glassCard = 'rounded-[2rem] border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-3xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)]'
const subSection = 'rounded-2xl border border-white/40 dark:border-white/[0.06] bg-white/20 dark:bg-white/[0.03] p-4'

// Grid de columnas para filas de ejercicios (nombre | series | reps | peso | acciones)
const EJ_COLS_VIEW = '1fr 48px 72px 72px 28px'
const EJ_COLS_EDIT = '1fr 48px 72px 72px 80px'

const countEjRutina = (r: Rutina) =>
  r.semanas.reduce((a, s) => a + s.sesiones.reduce((b, ses) => b + ses.bloques.reduce((c, bl) => c + bl.ejerciciosPlan.length, 0), 0), 0)

const countEjDraft = (semanas: DraftSemana[]) =>
  semanas.reduce((a, s) => a + s.sesiones.reduce((b, ses) => b + ses.bloques.reduce((c, bl) => c + bl.ejerciciosPlan.length, 0), 0), 0)

// ─── EjercicioDraftRow ────────────────────────────────────────────────────────

const ejSchema = z.object({
  nombre: z.string().min(1, 'Requerido'),
  series: z.coerce.number().int().min(1).optional().or(z.literal('')),
  repeticiones: z.string().optional(),
  peso: z.string().optional(),
  rir: z.coerce.number().int().min(0).optional().or(z.literal('')),
  rpe: z.coerce.number().int().min(1).max(10).optional().or(z.literal('')),
})
type EjForm = z.infer<typeof ejSchema>

interface EjercicioDraftRowProps {
  ej: DraftEjercicio
  onUpdate: (id: string, data: UpdateEjData) => void
  onDelete: (id: string) => void
}

function EjercicioDraftRow({ ej, onUpdate, onDelete }: EjercicioDraftRowProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const { register, handleSubmit, reset } = useForm<EjForm>({
    resolver: zodResolver(ejSchema),
    defaultValues: {
      nombre: ej.nombre,
      series: ej.series ?? '',
      repeticiones: ej.repeticiones ?? '',
      peso: ej.peso ?? '',
      rir: ej.rir ?? '',
      rpe: ej.rpe ?? '',
    },
  })

  const onSubmit = (data: EjForm) => {
    onUpdate(ej.id, {
      nombre: data.nombre,
      series: data.series,
      repeticiones: data.repeticiones,
      peso: data.peso,
      rir: data.rir,
      rpe: data.rpe,
    })
    setIsEditing(false)
  }

  if (isEditing) {
    return (
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="p-3 bg-gray-50 dark:bg-white/[0.05] rounded-xl border border-gray-300 dark:border-white/[0.1] space-y-2.5 my-1"
      >
        <input
          {...register('nombre')}
          placeholder="Nombre del ejercicio"
          className="w-full bg-gray-100 dark:bg-white/[0.06] border border-gray-300 dark:border-white/[0.1] rounded-lg px-3 py-2 text-sm text-saas-text dark:text-white placeholder-gray-400 dark:placeholder-white/30 focus:outline-none focus:border-primary/60"
        />
        <div className="grid grid-cols-3 gap-2">
          {([
            { name: 'series' as const, label: 'Series', placeholder: '3' },
            { name: 'repeticiones' as const, label: 'Reps', placeholder: '10-12' },
            { name: 'peso' as const, label: 'Peso', placeholder: '60 kg' },
          ] as const).map(f => (
            <div key={f.name}>
              <label className="text-[10px] text-gray-400 dark:text-white/35 block mb-1 font-medium uppercase tracking-wider">{f.label}</label>
              <input
                {...register(f.name)}
                placeholder={f.placeholder}
                className="w-full bg-gray-100 dark:bg-white/[0.06] border border-saas-border dark:border-white/[0.08] rounded-lg px-2.5 py-1.5 text-sm text-saas-text dark:text-white placeholder-gray-400 dark:placeholder-white/25 focus:outline-none focus:border-primary/60 text-center"
              />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {([
            { name: 'rir' as const, label: 'RIR', placeholder: '2' },
            { name: 'rpe' as const, label: 'RPE', placeholder: '8' },
          ] as const).map(f => (
            <div key={f.name}>
              <label className="text-[10px] text-gray-400 dark:text-white/35 block mb-1 font-medium uppercase tracking-wider">{f.label}</label>
              <input
                {...register(f.name)}
                placeholder={f.placeholder}
                className="w-full bg-gray-100 dark:bg-white/[0.06] border border-saas-border dark:border-white/[0.08] rounded-lg px-2.5 py-1.5 text-sm text-saas-text dark:text-white placeholder-gray-400 dark:placeholder-white/25 focus:outline-none focus:border-primary/60 text-center"
              />
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 pt-1">
          <button
            type="submit"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-black text-xs font-semibold"
          >
            <Check className="w-3.5 h-3.5" /> Aplicar
          </button>
          <button
            type="button"
            onClick={() => { setIsEditing(false); reset() }}
            className="px-3 py-1.5 rounded-lg border border-saas-border dark:border-white/[0.08] text-xs text-saas-muted dark:text-white/45 hover:text-white transition-colors"
          >
            Cancelar
          </button>
        </div>
      </form>
    )
  }

  if (confirmDelete) {
    return (
      <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-red-500/[0.06] border border-red-500/[0.12]">
        <div className="flex items-center gap-2 min-w-0">
          <AlertTriangle className="w-3.5 h-3.5 text-red-400/70 shrink-0" />
          <span className="text-[11px] text-red-400/80 truncate">¿Eliminar <span className="font-semibold">{ej.nombre}</span>?</span>
        </div>
        <div className="flex items-center gap-1 shrink-0 ml-2">
          <button onClick={() => onDelete(ej.id)} className="px-2.5 py-1 rounded-lg bg-red-500/15 text-red-400 text-[11px] font-semibold hover:bg-red-500/25 transition-colors">Sí</button>
          <button onClick={() => setConfirmDelete(false)} className="px-2.5 py-1 rounded-lg border border-saas-border dark:border-white/[0.08] text-[11px] text-gray-400 dark:text-white/40 hover:text-white transition-colors">No</button>
        </div>
      </div>
    )
  }

  const hasExtra = ej.rir != null || ej.rpe != null || !!ej.catalogo?.videoUrl

  return (
    <div>
      <div
        style={{ display: 'grid', gridTemplateColumns: EJ_COLS_EDIT, alignItems: 'start' }}
        className="px-3 py-2.5 hover:bg-white/[0.04] transition-colors rounded-xl group/row"
      >
        {/* Nombre + patrón */}
        <div className="min-w-0 pr-2">
          <span className="text-sm text-saas-text dark:text-white/90 font-medium truncate block">{ej.nombre}</span>
          {ej.catalogo?.patronMovimiento && (
            <span className="text-[11px] text-gray-400 dark:text-white/35 truncate block">
              {PATRON_LABELS[ej.catalogo.patronMovimiento as PatronMovimientoEnum] ?? ej.catalogo.patronMovimiento}
            </span>
          )}
        </div>
        {/* Series */}
        <div className="flex justify-center pt-0.5">
          {ej.series != null
            ? <span className="text-xs tabular-nums bg-gray-100 dark:bg-white/[0.06] px-1.5 py-0.5 rounded-md text-gray-600 dark:text-white/60 font-medium">{ej.series}×</span>
            : <span className="text-gray-300 dark:text-white/15 text-xs">—</span>}
        </div>
        {/* Reps */}
        <div className="flex justify-center pt-0.5">
          {ej.repeticiones
            ? <span className="text-xs text-gray-500 dark:text-white/50">{ej.repeticiones}</span>
            : <span className="text-gray-200 dark:text-white/15 text-xs">—</span>}
        </div>
        {/* Peso */}
        <div className="flex justify-center pt-0.5">
          {ej.peso
            ? <span className="text-xs px-1.5 py-0.5 bg-primary/10 text-primary/80 rounded-md font-medium">{ej.peso}</span>
            : <span className="text-gray-200 dark:text-white/15 text-xs">—</span>}
        </div>
        {/* Expand + acciones hover */}
        <div className="flex items-center justify-end gap-0.5 pt-0.5">
          {hasExtra && (
            <button
              onClick={() => setExpanded(v => !v)}
              className="p-1.5 rounded-lg text-gray-300 dark:text-white/25 hover:text-white hover:bg-white/[0.06] transition-colors"
            >
              <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
            </button>
          )}
          <button
            onClick={() => setIsEditing(true)}
            className="p-1.5 rounded-lg text-gray-300 dark:text-white/20 hover:text-white hover:bg-white/[0.08] transition-colors opacity-0 group-hover/row:opacity-100"
          >
            <Pencil className="w-3 h-3" />
          </button>
          <button
            onClick={() => setConfirmDelete(true)}
            className="p-1.5 rounded-lg text-gray-300 dark:text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover/row:opacity-100"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Detalle expandido: RIR, RPE, video */}
      <AnimatePresence>
        {expanded && hasExtra && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="px-6 pb-2.5">
              <div className="flex items-center gap-4 text-[11px] border-l border-primary/20 pl-3 py-1">
                {ej.rir != null && (
                  <span className="text-gray-400 dark:text-white/40">RIR <span className="text-gray-600 dark:text-white/65 font-semibold">{ej.rir}</span></span>
                )}
                {ej.rpe != null && (
                  <span className="text-gray-400 dark:text-white/40">RPE <span className="text-gray-600 dark:text-white/65 font-semibold">{ej.rpe}</span></span>
                )}
                {ej.catalogo?.videoUrl && (
                  <a href={ej.catalogo.videoUrl} target="_blank" rel="noreferrer"
                    className="flex items-center gap-1 text-gray-400 dark:text-white/30 hover:text-primary transition-colors"
                    onClick={e => e.stopPropagation()}>
                    <ExternalLink className="w-3 h-3" />
                    <span>Ver video</span>
                  </a>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── AddEjercicioPanel ────────────────────────────────────────────────────────

const DIFICULTAD_COLORS: Record<string, string> = {
  FACIL: 'bg-emerald-500/15 text-emerald-400',
  INTERMEDIO: 'bg-amber-500/15 text-amber-400',
  AVANZADO: 'bg-red-500/15 text-red-400',
}

interface AddEjercicioPanelProps {
  bloqueId: string
  onAdd: (bloqueId: string, nombre: string, catalogoId?: string, catalogo?: DraftEjercicio['catalogo']) => void
  onClose: () => void
}

function AddEjercicioPanel({ bloqueId, onAdd, onClose }: AddEjercicioPanelProps) {
  const addToast = useUiStore(s => s.addToast)
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [catalogo, setCatalogo] = useState<EjercicioCatalogo[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    setLoading(true)
    ejerciciosApi.getAll({ nombre: debounced || undefined })
      .then(setCatalogo)
      .finally(() => setLoading(false))
  }, [debounced])

  const handleSelect = (ej: EjercicioCatalogo) => {
    onAdd(bloqueId, ej.nombre, ej.id, { nombre: ej.nombre, patronMovimiento: ej.patronMovimiento, videoUrl: ej.videoUrl })
    onClose()
  }

  const handleCrear = async () => {
    if (!search.trim()) return
    setCreating(true)
    try {
      const nuevo = await ejerciciosApi.create({ nombre: search.trim() })
      onAdd(bloqueId, nuevo.nombre, nuevo.id, { nombre: nuevo.nombre })
      onClose()
    } catch {
      addToast({ type: 'error', message: 'Error al crear ejercicio' })
      setCreating(false)
    }
  }

  const noResults = !loading && catalogo.length === 0

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden"
    >
      <div className="mt-2 bg-saas-surface dark:bg-black/50 backdrop-blur-sm border border-saas-border dark:border-white/[0.08] rounded-2xl overflow-hidden">
        <div className="flex items-center gap-2 px-3 pt-3 pb-2 border-b border-saas-border dark:border-white/[0.06]">
          <Search className="w-3.5 h-3.5 text-gray-400 dark:text-white/30 shrink-0" />
          <input
            autoFocus
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar en el catálogo..."
            className="flex-1 bg-transparent text-sm text-saas-text dark:text-white placeholder-gray-400 dark:placeholder-white/25 focus:outline-none"
          />
          <button onClick={onClose} className="text-gray-300 dark:text-white/25 hover:text-white transition-colors shrink-0">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="max-h-48 overflow-y-auto">
          {loading ? (
            <div className="p-3 space-y-2.5">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex flex-col gap-1.5">
                  <Skeleton className="h-4 w-32 rounded-lg" />
                  <Skeleton className="h-3 w-20 rounded-md" />
                </div>
              ))}
            </div>
          ) : noResults ? (
            <div className="p-3 space-y-1.5">
              <p className="text-xs text-gray-400 dark:text-white/30 text-center pb-1">
                {search.trim() ? `Sin resultados para "${search}"` : 'El catálogo está vacío'}
              </p>
              {search.trim() && (
                <button
                  onClick={handleCrear}
                  disabled={creating}
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-primary/30 text-xs text-primary/80 hover:bg-primary/5 hover:border-primary/50 transition-colors disabled:opacity-40"
                >
                  <Plus className="w-3.5 h-3.5 shrink-0" />
                  {creating ? 'Creando...' : `Crear "${search.trim()}" en el catálogo`}
                </button>
              )}
            </div>
          ) : (
            <div className="p-1.5 space-y-0.5">
              {catalogo.map(ej => (
                <button
                  key={ej.id}
                  onClick={() => handleSelect(ej)}
                  className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.06] transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-saas-text dark:text-white/90 font-medium truncate">{ej.nombre}</p>
                    {ej.patronMovimiento && <p className="text-[11px] text-gray-400 dark:text-white/35 truncate">{ej.patronMovimiento}</p>}
                  </div>
                  <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-semibold shrink-0 ${DIFICULTAD_COLORS[ej.dificultad] ?? 'bg-gray-100 dark:bg-white/[0.06] text-gray-400 dark:text-white/35'}`}>
                    {DIFICULTAD_LABELS[ej.dificultad] ?? ej.dificultad}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// ─── ExerciseViewRow (modo lectura) ──────────────────────────────────────────

function ExerciseViewRow({ ej }: { ej: EjercicioPlan }) {
  const [expanded, setExpanded] = useState(false)
  const hasExtra = ej.rir != null || ej.rpe != null || !!ej.catalogo?.videoUrl

  return (
    <div>
      <div
        style={{ display: 'grid', gridTemplateColumns: EJ_COLS_VIEW, alignItems: 'start' }}
        className="px-3 py-2.5 hover:bg-white/[0.04] transition-colors rounded-xl"
      >
        {/* Nombre + patrón */}
        <div className="min-w-0 pr-2">
          <span className="text-sm text-saas-text dark:text-white/90 font-medium truncate block">{ej.nombre}</span>
          {ej.catalogo?.patronMovimiento && (
            <span className="text-[11px] text-gray-400 dark:text-white/35 truncate block">
              {PATRON_LABELS[ej.catalogo.patronMovimiento as PatronMovimientoEnum] ?? ej.catalogo.patronMovimiento}
            </span>
          )}
        </div>
        {/* Series */}
        <div className="flex justify-center pt-0.5">
          {ej.series != null
            ? <span className="text-xs tabular-nums bg-gray-100 dark:bg-white/[0.06] px-1.5 py-0.5 rounded-md text-gray-600 dark:text-white/60 font-medium">{ej.series}×</span>
            : <span className="text-gray-300 dark:text-white/15 text-xs">—</span>}
        </div>
        {/* Reps */}
        <div className="flex justify-center pt-0.5">
          {ej.repeticiones
            ? <span className="text-xs text-gray-500 dark:text-white/50">{ej.repeticiones}</span>
            : <span className="text-gray-200 dark:text-white/15 text-xs">—</span>}
        </div>
        {/* Peso */}
        <div className="flex justify-center pt-0.5">
          {ej.peso
            ? <span className="text-xs px-1.5 py-0.5 bg-primary/10 text-primary/80 rounded-md font-medium">{ej.peso}</span>
            : <span className="text-gray-200 dark:text-white/15 text-xs">—</span>}
        </div>
        {/* Expand */}
        <div className="flex justify-center pt-0.5">
          {hasExtra && (
            <button
              onClick={() => setExpanded(v => !v)}
              className="p-1 rounded-lg text-gray-300 dark:text-white/25 hover:text-white hover:bg-white/[0.06] transition-colors"
            >
              <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {/* Detalle expandido: RIR, RPE, video */}
      <AnimatePresence>
        {expanded && hasExtra && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="px-6 pb-2.5">
              <div className="flex items-center gap-4 text-[11px] border-l border-primary/20 pl-3 py-1">
                {ej.rir != null && (
                  <span className="text-gray-400 dark:text-white/40">RIR <span className="text-gray-600 dark:text-white/65 font-semibold">{ej.rir}</span></span>
                )}
                {ej.rpe != null && (
                  <span className="text-gray-400 dark:text-white/40">RPE <span className="text-gray-600 dark:text-white/65 font-semibold">{ej.rpe}</span></span>
                )}
                {ej.catalogo?.videoUrl && (
                  <a href={ej.catalogo.videoUrl} target="_blank" rel="noreferrer"
                    className="flex items-center gap-1 text-gray-400 dark:text-white/30 hover:text-primary transition-colors">
                    <ExternalLink className="w-3 h-3" />
                    <span>Ver video</span>
                  </a>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── EjInlineCells ───────────────────────────────────────────────────────────
// Devuelve un Fragment de <td> para montarse dentro de un <tr>.
// Alterna entre vista estática y edición inline sin crear filas extra.

function EjInlineCells({ ej, isEditing, onEditStart, onUpdate, onCancelEdit, onDelete }: {
  ej: DraftEjercicio
  isEditing: boolean
  onEditStart: () => void
  onUpdate: (id: string, data: UpdateEjData) => void
  onCancelEdit: () => void
  onDelete: () => void
}) {
  const { register, handleSubmit, reset } = useForm<EjForm>({
    resolver: zodResolver(ejSchema),
    defaultValues: {
      nombre: ej.nombre,
      series: ej.series ?? '',
      repeticiones: ej.repeticiones ?? '',
      peso: ej.peso ?? '',
      rir: ej.rir ?? '',
      rpe: ej.rpe ?? '',
    },
  })

  // Refrescar valores al abrir el modo edición
  useEffect(() => {
    if (isEditing) {
      reset({
        nombre: ej.nombre,
        series: ej.series ?? '',
        repeticiones: ej.repeticiones ?? '',
        peso: ej.peso ?? '',
        rir: ej.rir ?? '',
        rpe: ej.rpe ?? '',
      })
    }
  }, [isEditing]) // eslint-disable-line

  const submit = handleSubmit(d => onUpdate(ej.id, d))

  const inp = 'w-full bg-gray-50 dark:bg-white/[0.07] border border-gray-200 dark:border-white/[0.12] rounded-lg px-1.5 py-1 text-xs text-saas-text dark:text-white placeholder-gray-300 dark:placeholder-white/20 focus:outline-none focus:border-primary/50 transition-colors'

  if (!isEditing) {
    return (
      <>
        <td className="px-4 py-2.5">
          <span className="text-sm text-saas-text dark:text-white/90 font-medium block">{ej.nombre}</span>
          {ej.catalogo?.patronMovimiento && (
            <span className="text-[11px] text-gray-400 dark:text-white/35 block">
              {PATRON_LABELS[ej.catalogo.patronMovimiento as PatronMovimientoEnum] ?? ej.catalogo.patronMovimiento}
            </span>
          )}
        </td>
        <td className="px-3 py-2.5 text-center">
          {ej.series != null ? <span className="text-xs tabular-nums bg-gray-100 dark:bg-white/[0.06] px-1.5 py-0.5 rounded-md text-gray-600 dark:text-white/60 font-medium">{ej.series}×</span> : <span className="text-gray-300 dark:text-white/15 text-xs">—</span>}
        </td>
        <td className="px-3 py-2.5 text-center">
          {ej.repeticiones ? <span className="text-xs text-gray-500 dark:text-white/55">{ej.repeticiones}</span> : <span className="text-gray-300 dark:text-white/15 text-xs">—</span>}
        </td>
        <td className="px-3 py-2.5 text-center">
          {ej.peso ? <span className="text-xs px-1.5 py-0.5 bg-primary/10 text-primary/80 rounded-md font-medium">{ej.peso}</span> : <span className="text-gray-300 dark:text-white/15 text-xs">—</span>}
        </td>
        <td className="px-3 py-2.5 text-center">
          <div className="flex items-center justify-center gap-1 text-[11px]">
            {ej.rir != null && <span className="text-gray-400 dark:text-white/40">RIR <span className="font-semibold text-gray-600 dark:text-white/65">{ej.rir}</span></span>}
            {ej.rpe != null && <span className="text-gray-400 dark:text-white/40">RPE <span className="font-semibold text-gray-600 dark:text-white/65">{ej.rpe}</span></span>}
            {ej.rir == null && ej.rpe == null && <span className="text-gray-300 dark:text-white/15 text-xs">—</span>}
          </div>
        </td>
        <td className="px-2 py-2.5 text-center w-[56px]">
          <div className="flex items-center justify-center gap-0.5 opacity-0 group-hover/ejrow:opacity-100 transition-opacity">
            <button onClick={onEditStart} className="p-1.5 rounded-lg text-gray-500 dark:text-white/50 hover:text-saas-text dark:hover:text-white hover:bg-white/[0.08] transition-colors">
              <Pencil className="w-3 h-3" />
            </button>
            <button onClick={onDelete} className="p-1.5 rounded-lg text-gray-500 dark:text-white/50 hover:text-red-400 hover:bg-red-500/10 transition-colors">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </td>
      </>
    )
  }

  // ── Modo edición — misma fila, celdas con inputs ──────────────────────────
  return (
    <>
      <td className="px-2 py-1.5">
        <input
          {...register('nombre')}
          autoFocus
          placeholder="Nombre"
          onKeyDown={e => { if (e.key === 'Escape') onCancelEdit() }}
          className={`${inp} text-sm px-2 py-1.5`}
        />
      </td>
      <td className="px-1.5 py-1.5">
        <input {...register('series')} placeholder="—" onKeyDown={e => { if (e.key === 'Escape') onCancelEdit() }} className={`${inp} text-center`} />
      </td>
      <td className="px-1.5 py-1.5">
        <input {...register('repeticiones')} placeholder="—" onKeyDown={e => { if (e.key === 'Escape') onCancelEdit() }} className={`${inp} text-center`} />
      </td>
      <td className="px-1.5 py-1.5">
        <input {...register('peso')} placeholder="—" onKeyDown={e => { if (e.key === 'Escape') onCancelEdit() }} className={`${inp} text-center`} />
      </td>
      <td className="px-1.5 py-1.5">
        <div className="flex gap-1">
          <input {...register('rir')} placeholder="RIR" onKeyDown={e => { if (e.key === 'Escape') onCancelEdit() }} className={`${inp} text-center`} />
          <input {...register('rpe')} placeholder="RPE" onKeyDown={e => { if (e.key === 'Escape') onCancelEdit() }} className={`${inp} text-center`} />
        </div>
      </td>
      <td className="px-1.5 py-1.5 w-[56px]">
        <div className="flex items-center justify-center gap-0.5">
          <button type="button" onClick={submit} className="p-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors" title="Guardar (Enter)">
            <Check className="w-3.5 h-3.5" />
          </button>
          <button type="button" onClick={onCancelEdit} className="p-1.5 rounded-lg text-gray-400 dark:text-white/45 hover:bg-white/[0.06] transition-colors" title="Cancelar (Esc)">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    </>
  )
}

// ─── DraftBloqueCard ──────────────────────────────────────────────────────────

interface DraftBloqueCardProps {
  bloque: DraftBloque
  sesionId: string
  addingBloqueId: string | null
  onSetAdding: (id: string | null) => void
  onDeleteBloque: (sesionId: string, bloqueId: string) => void
  onDeleteEj: (ejercicioId: string) => void
  onUpdateEj: (ejercicioId: string, data: UpdateEjData) => void
  onAddEj: (bloqueId: string, nombre: string, catalogoId?: string, catalogo?: DraftEjercicio['catalogo']) => void
}

function DraftBloqueCard({ bloque, sesionId, addingBloqueId, onSetAdding, onDeleteBloque, onDeleteEj, onUpdateEj, onAddEj }: DraftBloqueCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const isAdding = addingBloqueId === bloque.id

  return (
    <div className="relative bg-gray-50 dark:bg-white/[0.03] border border-saas-border dark:border-white/[0.07] rounded-2xl overflow-hidden">
      <div className="absolute inset-y-0 left-0 w-[3px] bg-primary/45 rounded-full" />
      <div className="pl-1">
        <div className="flex items-center justify-between px-4 py-3 bg-gray-50/50 dark:bg-white/[0.02] border-b border-saas-border dark:border-white/[0.05]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-primary/15 border border-primary/25 text-primary text-sm font-bold flex items-center justify-center shrink-0">
              {bloque.letra}
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800 dark:text-white/80">Bloque {bloque.letra}</p>
              <p className="text-[11px] text-gray-400 dark:text-white/40">{bloque.ejerciciosPlan.length} {bloque.ejerciciosPlan.length === 1 ? 'ejercicio' : 'ejercicios'}</p>
            </div>
          </div>
          {confirmDelete ? (
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400/70" />
              <span className="text-[11px] text-red-400/80">¿Eliminar?</span>
              <button onClick={() => { onDeleteBloque(sesionId, bloque.id); setConfirmDelete(false) }} className="px-2 py-1 rounded-lg bg-red-500/15 text-red-400 text-[11px] font-semibold hover:bg-red-500/25 transition-colors">Sí</button>
              <button onClick={() => setConfirmDelete(false)} className="px-2 py-1 rounded-lg border border-saas-border dark:border-white/[0.08] text-[11px] text-gray-400 dark:text-white/40 hover:text-white transition-colors">No</button>
            </div>
          ) : (
            <button onClick={() => setConfirmDelete(true)} className="p-1.5 rounded-lg text-gray-300 dark:text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="p-2 space-y-0.5">
          {bloque.ejerciciosPlan.length > 0 && (
            <div
              style={{ display: 'grid', gridTemplateColumns: EJ_COLS_EDIT, alignItems: 'center' }}
              className="px-3 py-1 mb-0.5 text-[10px] text-gray-300 dark:text-white/25 uppercase tracking-widest font-semibold border-b border-saas-border dark:border-white/[0.05]"
            >
              <span>Ejercicio</span>
              <span className="text-center">Ser.</span>
              <span className="text-center">Reps</span>
              <span className="text-center">Peso</span>
              <span />
            </div>
          )}
          {bloque.ejerciciosPlan.map(ej => (
            <EjercicioDraftRow
              key={ej.id}
              ej={ej}
              onUpdate={onUpdateEj}
              onDelete={onDeleteEj}
            />
          ))}
          <AnimatePresence>
            {isAdding && (
              <AddEjercicioPanel
                bloqueId={bloque.id}
                onAdd={onAddEj}
                onClose={() => onSetAdding(null)}
              />
            )}
          </AnimatePresence>
          {!isAdding && (
            <button
              onClick={() => onSetAdding(bloque.id)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-gray-400 dark:text-white/30 hover:text-primary hover:bg-primary/5 transition-colors mt-1"
            >
              <Plus className="w-3.5 h-3.5" /> Agregar ejercicio
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── SesionDayDropdown ────────────────────────────────────────────────────────

function SesionDayDropdown({ existentes, semanaId, onSelect, onClose }: {
  existentes: string[]
  semanaId: string
  onSelect: (semanaId: string, dia: string) => void
  onClose: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: -8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -8 }}
      className="absolute top-full left-0 mt-1.5 z-30 bg-saas-surface dark:bg-[#1A1A1A] border border-saas-border dark:border-white/[0.08] rounded-2xl p-3 shadow-xl min-w-[160px]"
    >
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-xs text-gray-500 dark:text-white/50 font-medium">Agregar día</span>
        <button onClick={onClose} className="text-gray-400 dark:text-white/30 hover:text-white transition-colors"><X className="w-3.5 h-3.5" /></button>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {DIAS.map(dia => (
          <button key={dia} onClick={() => { onSelect(semanaId, dia); onClose() }}
            disabled={existentes.includes(dia)}
            className="px-2 py-1.5 rounded-lg border border-saas-border dark:border-white/[0.08] text-xs text-saas-text dark:text-white hover:bg-primary hover:text-black hover:border-primary transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
            {dia}
          </button>
        ))}
      </div>
    </motion.div>
  )
}

// ─── SemanaTreeItem (Nivel 2 — árbol visual) ──────────────────────────────────

interface SemanaTreeItemProps {
  semana: DraftSemana
  isLast: boolean
  selectedSesionId: string | null
  onSelectSesion: (id: string) => void
  onAddSesion: (semanaId: string, dia: string) => void
  onDeleteSesion: (semanaId: string, sesionId: string) => void
  onDeleteSemana: (id: string) => void
  onCloneSemana: (id: string) => void
  onRenameSemana: (id: string, nombre: string) => void
  onUpdateObs: (id: string, obs: string) => void
}

function SemanaTreeItem({
  semana, isLast, selectedSesionId, onSelectSesion,
  onAddSesion, onDeleteSesion, onDeleteSemana, onCloneSemana, onRenameSemana, onUpdateObs,
}: SemanaTreeItemProps) {
  const [renaming, setRenaming] = useState(false)
  const [renameVal, setRenameVal] = useState(semana.nombre ?? '')
  const [showDayDropdown, setShowDayDropdown] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const label = semana.nombre?.trim() ? semana.nombre : `S${semana.numero}`

  const handleRename = () => {
    onRenameSemana(semana.id, renameVal.trim())
    setRenaming(false)
  }

  return (
    <div className="relative">
      {/* Vertical tree line — no dibuja en la última semana */}
      {!isLast && (
        <div className="absolute left-[7px] top-5 bottom-0 w-px bg-white/[0.07]" />
      )}

      {/* Header de semana */}
      <div className="flex items-center gap-2.5 mb-2">
        {/* Nodo circular */}
        <div className="relative z-10 w-4 h-4 rounded-full bg-white dark:bg-[#111] border-2 border-primary/50 flex items-center justify-center shrink-0">
          <div className="w-1.5 h-1.5 rounded-full bg-primary/70" />
        </div>

        {renaming ? (
          <form onSubmit={e => { e.preventDefault(); handleRename() }} className="flex items-center gap-1 flex-1">
            <input
              autoFocus
              value={renameVal}
              onChange={e => setRenameVal(e.target.value)}
              placeholder={`S${semana.numero}`}
              className="w-32 bg-gray-100 dark:bg-white/[0.08] border border-primary/40 rounded-lg px-2.5 py-1 text-sm text-saas-text dark:text-white placeholder-gray-400 dark:placeholder-white/30 focus:outline-none"
            />
            <button type="submit" className="p-1.5 rounded-lg text-primary hover:bg-primary/10"><Check className="w-3.5 h-3.5" /></button>
            <button type="button" onClick={() => setRenaming(false)} className="p-1.5 rounded-lg text-gray-400 dark:text-white/30 hover:bg-white/[0.06]"><X className="w-3.5 h-3.5" /></button>
          </form>
        ) : (
          <>
            <span className="text-sm font-semibold text-gray-800 dark:text-white/80">{label}</span>
            <button onClick={() => { setRenameVal(semana.nombre ?? ''); setRenaming(true) }}
              className="p-1 rounded-lg text-gray-300 dark:text-white/20 hover:text-white hover:bg-white/[0.06] transition-colors">
              <Pencil className="w-3 h-3" />
            </button>
            <button onClick={() => onCloneSemana(semana.id)}
              title="Clonar semana"
              className="p-1 rounded-lg text-gray-300 dark:text-white/20 hover:text-white hover:bg-white/[0.06] transition-colors">
              <Copy className="w-3 h-3" />
            </button>
            {confirmDelete ? (
              <div className="flex items-center gap-1 ml-1">
                <span className="text-[11px] text-red-400/80">¿Eliminar?</span>
                <button onClick={() => { onDeleteSemana(semana.id); setConfirmDelete(false) }}
                  className="px-2 py-0.5 rounded-md bg-red-500/15 text-red-400 text-[11px] font-semibold">Sí</button>
                <button onClick={() => setConfirmDelete(false)}
                  className="px-2 py-0.5 rounded-md border border-saas-border dark:border-white/[0.08] text-[11px] text-gray-400 dark:text-white/40">No</button>
              </div>
            ) : (
              <button onClick={() => setConfirmDelete(true)}
                className="p-1 rounded-lg text-gray-200 dark:text-white/15 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </>
        )}
      </div>

      {/* Observaciones de la semana */}
      <div className="ml-2 pl-5 border-l border-saas-border dark:border-white/[0.07] mb-1">
        <textarea
          value={semana.observaciones ?? ''}
          onChange={e => onUpdateObs(semana.id, e.target.value)}
          placeholder="Observaciones para esta semana…"
          rows={2}
          className="w-full resize-none bg-gray-50 dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.08] rounded-xl px-2.5 py-1.5 text-[11px] text-gray-700 dark:text-white/70 placeholder-gray-300 dark:placeholder-white/20 focus:outline-none focus:border-primary/40 focus:bg-white dark:focus:bg-white/[0.06] transition-all leading-relaxed"
        />
      </div>

      {/* Días con línea conectora */}
      <div className="ml-2 pl-5 border-l border-saas-border dark:border-white/[0.07] mb-1 pb-2">
        {semana.sesiones.length === 0 ? (
          <p className="text-[11px] text-gray-300 dark:text-white/25 py-1">Sin días — agregá uno</p>
        ) : (
          <div className="flex items-center gap-2 flex-wrap py-1">
            {semana.sesiones.map(ses => {
              const isSelected = selectedSesionId === ses.id
              return (
                <div key={ses.id} className="relative flex items-center group/day">
                  {/* Conector horizontal desde la línea al día */}
                  <div className="absolute -left-5 top-1/2 w-4 h-px bg-white/[0.07]" />
                  <button
                    onClick={() => onSelectSesion(ses.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                      isSelected
                        ? 'bg-primary/15 border-primary/40 text-primary'
                        : 'bg-gray-50 dark:bg-white/[0.03] border-saas-border dark:border-white/[0.08] text-gray-500 dark:text-white/55 hover:bg-white/[0.07] hover:text-white hover:border-white/[0.2]'
                    }`}
                  >
                    <span className="text-[10px] font-bold tracking-wider">{DIA_SHORT[ses.dia] ?? ses.dia.slice(0, 3).toUpperCase()}</span>
                    <span className="font-normal opacity-70">{ses.dia}</span>
                    <span className={`ml-1 text-[10px] ${isSelected ? 'text-primary/70' : 'text-gray-400 dark:text-white/30'}`}>
                      {ses.bloques.reduce((a, b) => a + b.ejerciciosPlan.length, 0)} ej.
                    </span>
                  </button>
                  <button
                    onClick={() => onDeleteSesion(semana.id, ses.id)}
                    className="ml-0.5 p-1 rounded-lg text-gray-200 dark:text-white/15 hover:text-red-400 transition-colors opacity-0 group-hover/day:opacity-100"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {/* Botón agregar día */}
        <div className="relative mt-1">
          <button
            onClick={() => setShowDayDropdown(v => !v)}
            className="flex items-center gap-1 text-[11px] text-gray-300 dark:text-white/25 hover:text-primary transition-colors"
          >
            <Plus className="w-3 h-3" /> Agregar día
            <ChevronDown className="w-2.5 h-2.5 ml-0.5" />
          </button>
          <AnimatePresence>
            {showDayDropdown && (
              <SesionDayDropdown
                existentes={semana.sesiones.map(s => s.dia)}
                semanaId={semana.id}
                onSelect={onAddSesion}
                onClose={() => setShowDayDropdown(false)}
              />
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

// ─── EditCard (modo edición — expansión full-width) ───────────────────────────

interface EditCardProps {
  clienteId: string
  rutina: Rutina
  canEdit: boolean
  onCancel: () => void
  onSaved: () => void
}

function EditCard({ clienteId: _clienteId, rutina, onCancel, onSaved }: EditCardProps) {
  const draft_ = useRutinaDraft()
  const { draft, hasChanges, saving, initDraft, saveDraft, setMeta, addSemana, cloneSemana, deleteSemana, renameSemana, updateSemanaObs, addSesion, deleteSesion, addBloque, deleteBloque, addEjercicio, updateEjercicio, deleteEjercicio } = draft_

  const [selectedSesionId, setSelectedSesionId] = useState<string | null>(null)
  const [addingBloqueId, setAddingBloqueId] = useState<string | null>(null)

  // Inicializar draft al montar
  useEffect(() => {
    initDraft(rutina)
    const firstSes = rutina.semanas[0]?.sesiones[0]
    if (firstSes) setSelectedSesionId(firstSes.id)
  }, [rutina.id]) // eslint-disable-line

  if (!draft) {
    return (
      <div className={`${glassCard} p-6 space-y-6`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-xl shrink-0" />
            <div>
              <Skeleton className="h-4 w-28 mb-1" />
              <Skeleton className="h-3 w-40" />
            </div>
          </div>
          <Skeleton className="h-9 w-24 rounded-xl" />
        </div>
        <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
          <div className="space-y-4">
            <Skeleton className="h-4 w-20" />
            <div className="space-y-2">
              <Skeleton className="h-10 w-full rounded-xl" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
          </div>
          <div className="space-y-4">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-36 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    )
  }

  // Sesión seleccionada en el draft
  const selectedSesion = draft.semanas
    .flatMap(s => s.sesiones)
    .find(ses => ses.id === selectedSesionId) ?? null

  const selectedSemana = selectedSesion
    ? draft.semanas.find(s => s.sesiones.some(ses => ses.id === selectedSesionId)) ?? null
    : null

  const handleSave = () => saveDraft(onSaved)

  const handleAddSesion = (semanaId: string, dia: string) => {
    addSesion(semanaId, dia)
    // Buscar la sesión que se acaba de agregar en el siguiente render
    // como es local, el ID temporal es predecible sólo en el reducer
    // entonces auto-seleccionamos por dia en el siguiente tick
    setTimeout(() => {
      // No podemos saber el temp ID aquí, así que el usuario hace clic en el día
    }, 0)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      className={`${glassCard} ring-1 ring-primary/20 overflow-hidden`}
    >
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-saas-border dark:border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center shrink-0">
            <Pencil className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-saas-text dark:text-white">Editando rutina</p>
            <p className="text-[11px] text-gray-400 dark:text-white/35">{draft.nombre}</p>
          </div>
          {hasChanges && (
            <span className="px-2 py-0.5 rounded-full bg-primary/15 border border-primary/20 text-[10px] text-primary font-semibold">
              Cambios sin guardar
            </span>
          )}
        </div>
        <button
          onClick={onCancel}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-saas-border dark:border-white/[0.08] text-sm text-saas-muted dark:text-white/45 hover:text-white transition-colors"
        >
          <X className="w-3.5 h-3.5" /> Cancelar
        </button>
      </div>

      <div className="p-6 space-y-5 max-h-[calc(100vh-220px)] overflow-y-auto">

        {/* ── Nivel 1: Datos generales ──────────────────────────────────── */}
        <div className={subSection}>
          <p className="text-[10px] font-semibold text-gray-400 dark:text-white/35 uppercase tracking-widest mb-3">Datos generales</p>
          <div className="space-y-3">
            <div>
              <label className="text-[10px] text-gray-400 dark:text-white/35 font-medium uppercase tracking-wider block mb-1">Nombre</label>
              <input
                value={draft.nombre}
                onChange={e => setMeta(e.target.value, draft.descripcion ?? '', draft.activa)}
                placeholder="Nombre de la rutina"
                className="w-full bg-gray-100 dark:bg-white/[0.06] border border-gray-300 dark:border-white/[0.1] rounded-xl px-3 py-2 text-sm text-saas-text dark:text-white placeholder-gray-400 dark:placeholder-white/30 focus:outline-none focus:border-primary/50"
              />
            </div>
            <div>
              <label className="text-[10px] text-gray-400 dark:text-white/35 font-medium uppercase tracking-wider block mb-1">Descripción</label>
              <input
                value={draft.descripcion ?? ''}
                onChange={e => setMeta(draft.nombre, e.target.value, draft.activa)}
                placeholder="Descripción (opcional)"
                className="w-full bg-gray-100 dark:bg-white/[0.06] border border-gray-300 dark:border-white/[0.1] rounded-xl px-3 py-2 text-sm text-saas-text dark:text-white placeholder-gray-400 dark:placeholder-white/30 focus:outline-none focus:border-primary/50"
              />
            </div>
            <button
              type="button"
              onClick={() => setMeta(draft.nombre, draft.descripcion ?? '', !draft.activa)}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border text-sm transition-all ${
                draft.activa
                  ? 'bg-primary/10 border-primary/30 text-primary'
                  : 'bg-gray-50 dark:bg-white/[0.03] border-saas-border dark:border-white/[0.08] text-saas-muted dark:text-white/45 hover:border-white/20'
              }`}
            >
              <div className={`w-8 h-4 rounded-full flex items-center transition-colors px-0.5 shrink-0 ${draft.activa ? 'bg-primary' : 'bg-gray-300 dark:bg-white/20'}`}>
                <div className={`w-3 h-3 rounded-full bg-white shadow-sm transition-transform ${draft.activa ? 'translate-x-4' : 'translate-x-0'}`} />
              </div>
              {draft.activa ? 'Rutina activa' : 'Rutina inactiva'}
            </button>
          </div>
        </div>

        {/* ── Nivel 2: Árbol semanas / días ────────────────────────────── */}
        <div className={subSection}>
          <div className="flex items-center gap-2 mb-4">
            <p className="text-[10px] font-semibold text-gray-400 dark:text-white/35 uppercase tracking-widest">Semanas y días</p>
            <div className="flex-1 h-px bg-white/[0.04]" />
            <button
              onClick={addSemana}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs border border-dashed border-gray-300 dark:border-white/[0.1] text-gray-400 dark:text-white/30 hover:text-primary hover:border-primary/30 transition-colors"
            >
              <Plus className="w-3 h-3" /> Semana
            </button>
          </div>

          {draft.semanas.length === 0 ? (
            <div className="py-6 text-center">
              <p className="text-sm text-gray-400 dark:text-white/35 mb-3">Esta rutina no tiene semanas</p>
              <button onClick={addSemana} className="px-4 py-2 bg-primary text-black text-sm font-medium rounded-xl">
                Crear semana 1
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {draft.semanas.map((s, i) => (
                <SemanaTreeItem
                  key={s.id}
                  semana={s}
                  isLast={i === draft.semanas.length - 1}
                  selectedSesionId={selectedSesionId}
                  onSelectSesion={setSelectedSesionId}
                  onAddSesion={handleAddSesion}
                  onDeleteSesion={deleteSesion}
                  onDeleteSemana={deleteSemana}
                  onCloneSemana={cloneSemana}
                  onRenameSemana={renameSemana}
                  onUpdateObs={updateSemanaObs}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Nivel 3: Bloques / ejercicios ────────────────────────────── */}
        <AnimatePresence>
          {selectedSesion ? (
            <motion.div
              key={selectedSesion.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className={subSection}
            >
              <div className="flex items-center gap-2 mb-4">
                <p className="text-[10px] font-semibold text-gray-400 dark:text-white/35 uppercase tracking-widest">Bloques</p>
                <div className="flex items-center gap-1 text-[11px] text-gray-400 dark:text-white/30">
                  <ChevronRight className="w-3 h-3" />
                  <span>{selectedSemana?.nombre?.trim() ? selectedSemana.nombre : `Semana ${selectedSemana?.numero}`}</span>
                  <ChevronRight className="w-3 h-3" />
                  <span className="text-gray-500 dark:text-white/50 font-medium">{selectedSesion.dia}</span>
                </div>
                <div className="flex-1 h-px bg-white/[0.04]" />
              </div>

              {selectedSesion.bloques.length === 0 ? (
                <div className="py-8 text-center">
                  <Dumbbell className="w-9 h-9 text-gray-200 dark:text-white/15 mx-auto mb-2.5" />
                  <p className="text-gray-400 dark:text-white/35 text-sm mb-1">Sin bloques en este día</p>
                  <p className="text-[11px] text-gray-300 dark:text-white/20 mb-4">Los bloques agrupan ejercicios con descanso conjunto</p>
                  <button onClick={() => addBloque(selectedSesion.id)} className="px-4 py-2 bg-primary text-black text-sm font-medium rounded-xl">
                    Agregar bloque A
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedSesion.bloques.map(bl => (
                    <DraftBloqueCard
                      key={bl.id}
                      bloque={bl}
                      sesionId={selectedSesion.id}
                      addingBloqueId={addingBloqueId}
                      onSetAdding={setAddingBloqueId}
                      onDeleteBloque={deleteBloque}
                      onDeleteEj={deleteEjercicio}
                      onUpdateEj={updateEjercicio}
                      onAddEj={addEjercicio}
                    />
                  ))}
                  <button
                    onClick={() => addBloque(selectedSesion.id)}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-dashed border-gray-300 dark:border-white/[0.1] text-sm text-gray-400 dark:text-white/30 hover:text-primary hover:border-primary/30 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Agregar bloque {selectedSesion.bloques.length > 0 ? String.fromCharCode(selectedSesion.bloques[selectedSesion.bloques.length - 1].letra.charCodeAt(0) + 1) : 'A'}
                  </button>
                </div>
              )}
            </motion.div>
          ) : (
            draft.semanas.some(s => s.sesiones.length > 0) && (
              <motion.div
                key="no-sesion"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="py-4 text-center text-xs text-gray-300 dark:text-white/25"
              >
                Seleccioná un día en el árbol para editar sus bloques
              </motion.div>
            )
          )}
        </AnimatePresence>
      </div>

      {/* ── Footer: Guardar ───────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-4 border-t border-saas-border dark:border-white/[0.06] bg-gray-50/50 dark:bg-white/[0.02]">
        <div className="flex items-center gap-2 text-[11px] text-gray-400 dark:text-white/30">
          {hasChanges && (
            <>
              <div className="w-1.5 h-1.5 rounded-full bg-primary/70 animate-pulse" />
              Hay cambios sin guardar
            </>
          )}
        </div>
        <button
          onClick={handleSave}
          disabled={!hasChanges || saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-black text-sm font-semibold disabled:opacity-40 transition-opacity"
        >
          {saving ? (
            <>
              <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
              Guardando...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Guardar rutina
            </>
          )}
        </button>
      </div>
    </motion.div>
  )
}

// ─── InlineEditRutinaTable ────────────────────────────────────────────────────

function InlineEditRutinaTable({ rutina, onCancel, onSaved }: {
  rutina: Rutina
  onCancel: () => void
  onSaved: () => void
}) {
  const {
    draft, hasChanges, saving, initDraft, saveDraft, setMeta,
    addSemana, cloneSemana, deleteSemana, renameSemana, reorderSemanas,
    addSesion, deleteSesion,
    addBloque, deleteBloque,
    addEjercicio, updateEjercicio, deleteEjercicio,
  } = useRutinaDraft()

  const [editingEjId, setEditingEjId] = useState<string | null>(null)
  const [addingEjBloqueId, setAddingEjBloqueId] = useState<string | null>(null)
  const [showDiaPicker, setShowDiaPicker] = useState<string | null>(null)
  const [renamingName, setRenamingName] = useState(false)
  const [renameVal, setRenameVal] = useState('')
  const [renamingSemanaId, setRenamingSemanaId] = useState<string | null>(null)
  const [renameSemanaVal, setRenameSemanaVal] = useState('')
  const [dragSemanaId, setDragSemanaId] = useState<string | null>(null)
  const [dragOverSemanaId, setDragOverSemanaId] = useState<string | null>(null)

  useEffect(() => { initDraft(rutina) }, [rutina.id]) // eslint-disable-line

  if (!draft) return <div className={`${glassCard} p-6`}><SkeletonRutinaPanel /></div>

  const C = 'px-3 py-0 align-middle' // empty cell class shorthand

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      className={`${glassCard} ring-1 ring-primary/20 overflow-hidden`}
    >
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 px-6 py-4 border-b border-white/40 dark:border-white/[0.06]">
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <div className="w-7 h-7 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center shrink-0">
            <Pencil className="w-3.5 h-3.5 text-primary" />
          </div>
          {renamingName ? (
            <form onSubmit={e => { e.preventDefault(); setMeta(renameVal, draft.descripcion ?? '', draft.activa); setRenamingName(false) }} className="flex items-center gap-1.5 flex-1 min-w-0">
              <input autoFocus value={renameVal} onChange={e => setRenameVal(e.target.value)}
                className="flex-1 bg-gray-100 dark:bg-white/[0.08] border border-primary/40 rounded-lg px-2.5 py-1 text-sm text-saas-text dark:text-white focus:outline-none min-w-0" />
              <button type="submit" className="p-1.5 rounded-lg text-primary hover:bg-primary/10"><Check className="w-3.5 h-3.5" /></button>
              <button type="button" onClick={() => setRenamingName(false)} className="p-1.5 rounded-lg text-gray-400 dark:text-white/30"><X className="w-3.5 h-3.5" /></button>
            </form>
          ) : (
            <button onClick={() => { setRenameVal(draft.nombre); setRenamingName(true) }} className="group/n flex items-center gap-1.5 flex-1 min-w-0 text-left">
              <span className="text-sm font-semibold text-saas-text dark:text-white truncate">{draft.nombre}</span>
              <Pencil className="w-3 h-3 text-gray-400 dark:text-white/25 opacity-0 group-hover/n:opacity-100 transition-opacity shrink-0" />
            </button>
          )}
          {hasChanges && (
            <span className="px-2 py-0.5 rounded-full bg-primary/15 border border-primary/20 text-[10px] text-primary font-semibold shrink-0">Sin guardar</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMeta(draft.nombre, draft.descripcion ?? '', !draft.activa)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs transition-all ${draft.activa ? 'bg-primary/10 border-primary/30 text-primary' : 'border-saas-border dark:border-white/[0.08] text-saas-muted dark:text-white/40'}`}
          >
            <div className={`w-7 h-3.5 rounded-full flex items-center px-0.5 shrink-0 transition-colors ${draft.activa ? 'bg-primary' : 'bg-gray-300 dark:bg-white/20'}`}>
              <div className={`w-2.5 h-2.5 rounded-full bg-white shadow-sm transition-transform ${draft.activa ? 'translate-x-3.5' : 'translate-x-0'}`} />
            </div>
            {draft.activa ? 'Activa' : 'Inactiva'}
          </button>
          <button onClick={onCancel} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-saas-border dark:border-white/[0.08] text-xs text-saas-muted dark:text-white/40 hover:text-saas-text dark:hover:text-white transition-colors">
            <X className="w-3.5 h-3.5" /> Cancelar
          </button>
        </div>
      </div>

      {/* ── Table ──────────────────────────────────────────────────── */}
      <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-white/40 dark:border-white/[0.08] bg-white/50 dark:bg-black/20 backdrop-blur-sm">
              {(['Semana', 'Día', 'Bloque', 'Ejercicio', 'Ser.', 'Reps', 'Peso', 'RIR/RPE', ''] as const).map((h, i) => (
                <th key={`h${i}`} className={`py-2.5 text-[10px] font-semibold text-gray-400 dark:text-white/35 uppercase tracking-widest whitespace-nowrap ${i < 3 ? 'px-3 text-left' : i === 3 ? 'px-4 text-left' : 'px-3 text-center'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody
            onDragOver={e => {
              e.preventDefault()
              if (!dragSemanaId) return
              let el: Element | null = e.target as Element
              while (el && el.tagName !== 'TR') el = el.parentElement
              const sid = (el as HTMLTableRowElement | null)?.dataset.semId
              if (sid && sid !== dragSemanaId) setDragOverSemanaId(sid)
            }}
            onDrop={e => {
              e.preventDefault()
              let el: Element | null = e.target as Element
              while (el && el.tagName !== 'TR') el = el.parentElement
              const sid = (el as HTMLTableRowElement | null)?.dataset.semId
              if (dragSemanaId && sid && sid !== dragSemanaId) reorderSemanas(dragSemanaId, sid)
              setDragSemanaId(null)
              setDragOverSemanaId(null)
            }}
            onDragEnd={() => { setDragSemanaId(null); setDragOverSemanaId(null) }}
          >
            {draft.semanas.flatMap((sem, semIdx): React.ReactNode[] => {
              const semLabel = sem.nombre?.trim() ? sem.nombre : `S${sem.numero}`
              const rows: React.ReactNode[] = []
              let semShown = false

              const semCell = () => {
                const shown = semShown
                semShown = true
                if (shown) return <td key="sc" className={`w-[120px] ${C}`} />

                const isRenaming = renamingSemanaId === sem.id
                const isDragOver = dragOverSemanaId === sem.id

                return (
                  <td key="sc" className={`px-2 py-2.5 w-[120px] align-top ${isDragOver ? 'bg-primary/[0.04]' : ''}`}>
                    <div className="flex items-center gap-0.5 group/sem">
                      {/* Drag handle */}
                      <div
                        draggable
                        onDragStart={e => { e.stopPropagation(); setDragSemanaId(sem.id); e.dataTransfer.effectAllowed = 'move' }}
                        className="cursor-grab active:cursor-grabbing p-1 rounded text-gray-300 dark:text-white/30 hover:text-gray-500 dark:hover:text-white/60 transition-colors shrink-0"
                        title="Arrastrar para reordenar"
                      >
                        <GripVertical className="w-3 h-3" />
                      </div>

                      {isRenaming ? (
                        <form
                          onSubmit={e => { e.preventDefault(); renameSemana(sem.id, renameSemanaVal.trim() || `S${sem.numero}`); setRenamingSemanaId(null) }}
                          className="flex items-center gap-1 flex-1 min-w-0"
                        >
                          <input
                            autoFocus
                            value={renameSemanaVal}
                            onChange={e => setRenameSemanaVal(e.target.value)}
                            onBlur={() => { renameSemana(sem.id, renameSemanaVal.trim() || `S${sem.numero}`); setRenamingSemanaId(null) }}
                            className="w-14 bg-white dark:bg-white/[0.08] border border-primary/40 rounded-md px-1.5 py-0.5 text-[11px] text-saas-text dark:text-white focus:outline-none"
                          />
                          <button type="submit" className="p-0.5 rounded text-primary shrink-0">
                            <Check className="w-3 h-3" />
                          </button>
                        </form>
                      ) : (
                        <span
                          className="px-2 py-0.5 bg-primary/10 border border-primary/20 rounded-lg text-primary/90 text-[11px] font-bold whitespace-nowrap cursor-pointer hover:bg-primary/20 transition-colors"
                          title="Click para renombrar"
                          onClick={() => { setRenamingSemanaId(sem.id); setRenameSemanaVal(sem.nombre ?? '') }}
                        >
                          {semLabel}
                        </span>
                      )}

                      {!isRenaming && (
                        <>
                          <button onClick={() => cloneSemana(sem.id)} title="Duplicar" className="p-1 rounded text-gray-400 dark:text-white/45 hover:text-primary opacity-0 group-hover/sem:opacity-100 transition-all shrink-0">
                            <Copy className="w-2.5 h-2.5" />
                          </button>
                          <button onClick={() => deleteSemana(sem.id)} title="Eliminar" className="p-1 rounded text-gray-400 dark:text-white/45 hover:text-red-400 opacity-0 group-hover/sem:opacity-100 transition-all shrink-0">
                            <Trash2 className="w-2.5 h-2.5" />
                          </button>
                        </>
                      )}
                    </div>
                    {sem.observaciones && !isRenaming && (
                      <p className="mt-1 text-[10px] text-gray-400 dark:text-white/35 leading-relaxed italic pl-5 line-clamp-2" title={sem.observaciones}>
                        {sem.observaciones}
                      </p>
                    )}
                  </td>
                )
              }

              // Semana sin sesiones
              if (sem.sesiones.length === 0) {
                rows.push(
                  <tr key={`${sem.id}-empty`} data-sem-id={sem.id} className={semIdx > 0 ? 'border-t-2 border-saas-border dark:border-white/[0.1]' : ''}>
                    {semCell()}
                    <td colSpan={7} className="px-4 py-2.5">
                      <div className="relative flex items-center gap-3">
                        <span className="text-xs text-gray-400 dark:text-white/30">Sin días</span>
                        <button onClick={() => setShowDiaPicker(sem.id)} className="flex items-center gap-1 text-xs text-primary/70 hover:text-primary transition-colors">
                          <Plus className="w-3 h-3" /> Agregar día
                        </button>
                        <AnimatePresence>
                          {showDiaPicker === sem.id && (
                            <SesionDayDropdown existentes={[]} semanaId={sem.id} onSelect={(sId, dia) => { addSesion(sId, dia); setShowDiaPicker(null) }} onClose={() => setShowDiaPicker(null)} />
                          )}
                        </AnimatePresence>
                      </div>
                    </td>
                    <td className="w-[60px]" />
                  </tr>
                )
                rows.push(
                  <tr key={`${sem.id}-adddia`} data-sem-id={sem.id} className="border-t-2 border-saas-border dark:border-white/[0.08]">
                    <td className={`w-[120px] ${C}`} />
                    <td colSpan={8} className="px-4 py-2.5" />
                  </tr>
                )
                return rows
              }

              sem.sesiones.forEach((ses, sesIdx) => {
                let diaShown = false

                const diaCell = () => {
                  const shown = diaShown
                  diaShown = true
                  return shown ? <td key="dc" className={`w-[90px] ${C}`} /> : (
                    <td key="dc" className="px-3 py-2.5 w-[90px] align-top">
                      <div className="flex items-center gap-1 group/dia">
                        <span className="text-sm text-gray-700 dark:text-white/70 font-semibold whitespace-nowrap">{ses.dia}</span>
                        <button onClick={() => deleteSesion(sem.id, ses.id)} className="p-1 rounded text-gray-400 dark:text-white/45 hover:text-red-400 opacity-0 group-hover/dia:opacity-100 transition-all">
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    </td>
                  )
                }

                const diaBorder = sesIdx > 0 ? 'border-t border-saas-border dark:border-white/[0.07]' : semIdx > 0 && sesIdx === 0 ? 'border-t-2 border-saas-border dark:border-white/[0.1]' : ''

                if (ses.bloques.length === 0) {
                  rows.push(
                    <tr key={`${ses.id}-empty`} data-sem-id={sem.id} className={diaBorder}>
                      {semCell()}{diaCell()}
                      <td colSpan={6} className="px-4 py-2.5">
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-400 dark:text-white/30">Sin bloques</span>
                          <button onClick={() => addBloque(ses.id)} className="flex items-center gap-1 text-xs text-primary/70 hover:text-primary transition-colors">
                            <Plus className="w-3 h-3" /> Agregar bloque
                          </button>
                        </div>
                      </td>
                      <td className="w-[60px]" />
                    </tr>
                  )
                  semShown = true
                  return
                }

                ses.bloques.forEach((bl, blqIdx) => {
                  let blShown = false

                  const blCell = () => {
                    const shown = blShown
                    blShown = true
                    return shown ? <td key="bc" className={`w-[60px] ${C}`} /> : (
                      <td key="bc" className="px-2 py-2.5 w-[60px] text-center align-top">
                        <div className="flex items-center justify-center gap-0.5 group/bl">
                          <span className="w-6 h-6 rounded-lg bg-primary/15 border border-primary/25 text-primary text-xs font-bold flex items-center justify-center">{bl.letra}</span>
                          <button onClick={() => deleteBloque(ses.id, bl.id)} className="p-1 rounded text-gray-400 dark:text-white/45 hover:text-red-400 opacity-0 group-hover/bl:opacity-100 transition-all">
                            <Trash2 className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      </td>
                    )
                  }

                  const blBorder = blqIdx > 0 ? 'border-t border-saas-border dark:border-white/[0.05]' : ''

                  if (bl.ejerciciosPlan.length === 0) {
                    const bt = sesIdx === 0 && blqIdx === 0 ? diaBorder : blBorder
                    rows.push(
                      <tr key={`${bl.id}-empty`} data-sem-id={sem.id} className={bt}>
                        {semCell()}{diaCell()}{blCell()}
                        <td colSpan={5} className="px-4 py-2">
                          {addingEjBloqueId === bl.id
                            ? <AddEjercicioPanel bloqueId={bl.id} onAdd={addEjercicio} onClose={() => setAddingEjBloqueId(null)} />
                            : <button onClick={() => setAddingEjBloqueId(bl.id)} className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-white/40 hover:text-primary transition-colors py-0.5"><Plus className="w-3 h-3" /> Agregar ejercicio</button>
                          }
                        </td>
                        <td className="w-[60px]" />
                      </tr>
                    )
                    semShown = true
                    return
                  }

                  bl.ejerciciosPlan.forEach((ej, ejIdx) => {
                    const isEditing = editingEjId === ej.id
                    let bt: string
                    if (ejIdx === 0 && blqIdx === 0 && sesIdx === 0) bt = diaBorder
                    else if (ejIdx === 0 && blqIdx === 0) bt = diaBorder
                    else if (ejIdx === 0) bt = blBorder
                    else bt = 'border-t border-saas-border dark:border-white/[0.03]'

                    rows.push(
                      <tr key={ej.id} data-sem-id={sem.id} className={`transition-colors ${isEditing ? 'bg-primary/[0.02] ring-1 ring-inset ring-primary/10' : 'group/ejrow hover:bg-white/[0.03]'} ${bt}`}>
                        {semCell()}{diaCell()}{blCell()}
                        <EjInlineCells
                          ej={ej}
                          isEditing={isEditing}
                          onEditStart={() => setEditingEjId(ej.id)}
                          onUpdate={(id, data) => { updateEjercicio(id, data); setEditingEjId(null) }}
                          onCancelEdit={() => setEditingEjId(null)}
                          onDelete={() => deleteEjercicio(ej.id)}
                        />
                      </tr>
                    )
                    semShown = true
                  })

                  // Fila para agregar ejercicio al bloque
                  rows.push(
                    <tr key={`${bl.id}-addej`} data-sem-id={sem.id}>
                      <td className={`w-[120px] ${C}`} /><td className={`w-[90px] ${C}`} /><td className={`w-[60px] ${C}`} />
                      <td colSpan={5} className="px-4 py-1.5">
                        <AnimatePresence>
                          {addingEjBloqueId === bl.id
                            ? <AddEjercicioPanel bloqueId={bl.id} onAdd={addEjercicio} onClose={() => setAddingEjBloqueId(null)} />
                            : <button onClick={() => setAddingEjBloqueId(bl.id)} className="flex items-center gap-1.5 text-[11px] text-gray-400 dark:text-white/40 hover:text-primary transition-colors py-0.5"><Plus className="w-3 h-3" /> ej. en bloque {bl.letra}</button>
                          }
                        </AnimatePresence>
                      </td>
                      <td className="w-[56px]" />
                    </tr>
                  )
                })

                // Fila para agregar bloque a la sesión
                rows.push(
                  <tr key={`${ses.id}-addbl`} data-sem-id={sem.id} className="border-t border-saas-border dark:border-white/[0.06]">
                    <td className={`w-[120px] ${C}`} /><td className={`w-[90px] ${C}`} />
                    <td colSpan={6} className="px-4 py-2">
                      <button onClick={() => addBloque(ses.id)} className="flex items-center gap-1.5 text-[11px] text-gray-400 dark:text-white/40 hover:text-primary transition-colors">
                        <Plus className="w-3.5 h-3.5" /> bloque en {ses.dia}
                      </button>
                    </td>
                    <td className="w-[56px]" />
                  </tr>
                )
              })

              // Fila para agregar día a la semana
              rows.push(
                <tr key={`${sem.id}-adddia`} data-sem-id={sem.id} className="border-t-2 border-saas-border dark:border-white/[0.08]">
                  <td className={`w-[120px] ${C}`} />
                  <td colSpan={7} className="px-4 py-2.5 relative">
                    <button onClick={() => setShowDiaPicker(v => v === sem.id ? null : sem.id)} className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-white/40 hover:text-primary transition-colors">
                      <Plus className="w-3.5 h-3.5" /> día en {semLabel}
                      <ChevronDown className="w-3 h-3" />
                    </button>
                    <AnimatePresence>
                      {showDiaPicker === sem.id && (
                        <SesionDayDropdown existentes={sem.sesiones.map(s => s.dia)} semanaId={sem.id} onSelect={(sId, dia) => { addSesion(sId, dia); setShowDiaPicker(null) }} onClose={() => setShowDiaPicker(null)} />
                      )}
                    </AnimatePresence>
                  </td>
                  <td className="w-[56px]" />
                </tr>
              )

              return rows
            })}

            {/* Fila para agregar semana */}
            <tr className="border-t-2 border-saas-border dark:border-white/[0.1]">
              <td colSpan={9} className="px-4 py-3">
                <button onClick={addSemana} className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-white/30 hover:text-primary transition-colors">
                  <Plus className="w-3.5 h-3.5" /> nueva semana
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-4 border-t border-white/40 dark:border-white/[0.06] bg-white/[0.02]">
        <span className="text-[11px] text-gray-400 dark:text-white/30">
          {hasChanges && (
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-primary/70 animate-pulse inline-block" />
              Cambios sin guardar
            </span>
          )}
        </span>
        <button
          onClick={() => saveDraft(onSaved)}
          disabled={!hasChanges || saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-black text-sm font-semibold disabled:opacity-40 transition-opacity"
        >
          {saving
            ? <><div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" /> Guardando...</>
            : <><Save className="w-4 h-4" /> Guardar rutina</>
          }
        </button>
      </div>
    </motion.div>
  )
}

// ─── ClientRutinaPage ─────────────────────────────────────────────────────────

export default function ClientRutinaPage() {
  const { id: clienteId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const user = useAuthStore(s => s.user)

  // rid: viene del perfil del cliente al clickear una rutina específica
  const rid = searchParams.get('rid')
  const singleMode = !!rid

  const { rutinas, isLoading, refetch } = useRutinas(clienteId)
  const [selectedRutinaId, setSelectedRutinaId] = useState<string | null>(rid)
  const [editMode, setEditMode] = useState(false)
  const [confirmDeleteSemana, setConfirmDeleteSemana] = useState(false)
  const [ficha, setFicha] = useState<FichaEntrenamiento | null>(null)

  useEffect(() => {
    if (!clienteId) return
    clientsApi.getFichaConEventos(clienteId).then(setFicha).catch(() => {})
  }, [clienteId])

  const canEdit = user?.role === 'admin' || user?.role === 'profesor'

  // Auto-seleccionar rutina: prioriza ?rid=, luego la activa, luego la primera
  useEffect(() => {
    if (rutinas.length === 0) return
    const target = rutinas.find(r => r.id === (selectedRutinaId ?? rid))
      ?? rutinas.find(r => r.activa)
      ?? rutinas[0]
    if (selectedRutinaId !== target.id) setSelectedRutinaId(target.id)
  }, [rutinas]) // eslint-disable-line react-hooks/exhaustive-deps

  const rutina = rutinas.find(r => r.id === selectedRutinaId)

  const selectRutina = (r: Rutina) => {
    setSelectedRutinaId(r.id)
    setEditMode(false)
    setConfirmDeleteSemana(false)
  }

  const handleEnterEdit = () => {
    if (!rutina) return
    setEditMode(true)
    setConfirmDeleteSemana(false)
  }

  const handleEditSaved = useCallback(async () => {
    await refetch()
    setEditMode(false)
  }, [refetch])

  const handleEditCancel = () => {
    setEditMode(false)
  }

  // ─── Render de carga ─────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="p-4 lg:p-6 xl:p-8">
        <SkeletonRutinaPanel />
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6 xl:p-8 min-h-full">

      {/* Volver */}
      <button
        onClick={() => navigate(ROUTES.CLIENT_PROFILE.replace(':id', clienteId!))}
        className="flex items-center gap-2 text-gray-500 dark:text-white/50 hover:text-white transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="text-sm">Volver al perfil</span>
      </button>

      <div className="flex flex-col lg:flex-row gap-5 lg:gap-6 items-start">

        {/* ── Sidebar: lista de rutinas (oculta en edit mode o singleMode) ── */}
        <AnimatePresence>
          {!editMode && !singleMode && (
            <motion.div
              key="sidebar"
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.2 }}
              className="w-full lg:w-64 xl:w-72 shrink-0"
            >
              <div className={`${glassCard} p-4`}>
                <div className="flex items-center gap-2 mb-4">
                  <BookOpen className="w-3.5 h-3.5 text-gray-400 dark:text-white/35" />
                  <h2 className="text-[10px] font-semibold text-gray-400 dark:text-white/40 uppercase tracking-widest">Rutinas</h2>
                  {rutinas.length > 0 && <span className="ml-auto text-xs text-gray-300 dark:text-white/25">{rutinas.length}</span>}
                </div>

                {rutinas.length === 0 && (
                  <div className="py-8 text-center">
                    <Dumbbell className="w-8 h-8 text-gray-200 dark:text-white/15 mx-auto mb-2" />
                    <p className="text-xs text-gray-400 dark:text-white/35">Sin rutinas asignadas</p>
                  </div>
                )}

                <div className="space-y-1.5">
                  {rutinas.map(r => (
                    <div key={r.id} className={`rounded-2xl border transition-all ${
                      selectedRutinaId === r.id
                        ? 'bg-primary/[0.08] border-primary/25'
                        : 'bg-gray-50/50 dark:bg-white/[0.02] border-saas-border dark:border-white/[0.05] hover:bg-white/[0.05] hover:border-gray-300 dark:border-white/[0.1]'
                    }`}>
                      <button onClick={() => selectRutina(r)} className="w-full text-left p-3">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-sm font-medium leading-snug ${selectedRutinaId === r.id ? 'text-saas-text dark:text-white' : 'text-gray-600 dark:text-white/65'}`}>
                            {r.nombre}
                          </p>
                          <span className={`shrink-0 px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${
                            r.activa ? 'bg-primary/15 text-primary' : 'bg-gray-100 dark:bg-white/[0.05] text-gray-400 dark:text-white/30'
                          }`}>
                            {r.activa ? 'Activa' : 'Inactiva'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1.5 text-[11px] text-gray-400 dark:text-white/35">
                          <span>{r.semanas.length} sem.</span>
                          <span className="text-gray-300 dark:text-white/20">·</span>
                          <span>{countEjRutina(r)} ej.</span>
                        </div>
                      </button>
                    </div>
                  ))}
                </div>

                {canEdit && (
                  <button
                    onClick={() => navigate(`${ROUTES.RUTINA_CREAR}?clienteId=${clienteId}`)}
                    className="mt-3 flex items-center gap-2 rounded-xl btn-action px-4 py-2.5 text-sm"
                  >
                    <Plus className="w-3.5 h-3.5" /> Nueva rutina
                  </button>
                )}
              </div>

              {/* ── Calendario Competitivo ───────────────────────────── */}
              {ficha && (ficha.eventos.length > 0 || ficha.objetivos || ficha.deportePractica) && (
                <div className={`${glassCard} p-4 mt-3`}>
                  <div className="flex items-center gap-2 mb-3">
                    <Trophy className="w-3.5 h-3.5 text-primary/70" />
                    <h2 className="text-[10px] font-semibold text-gray-400 dark:text-white/40 uppercase tracking-widest">
                      Contexto deportivo
                    </h2>
                  </div>

                  {/* Objetivo + deporte */}
                  {(ficha.objetivos || ficha.deportePractica) && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {ficha.objetivos && (
                        <span className="px-2 py-0.5 rounded-lg bg-primary/10 border border-primary/20 text-[11px] text-primary/80 font-medium">
                          {ficha.objetivos}
                        </span>
                      )}
                      {ficha.deportePractica && (
                        <span className="px-2 py-0.5 rounded-lg bg-gray-100 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.08] text-[11px] text-gray-600 dark:text-white/55 font-medium">
                          {ficha.deportePractica}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Eventos / competencias */}
                  {ficha.eventos.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-semibold text-gray-400 dark:text-white/30 uppercase tracking-widest flex items-center gap-1.5 mb-2">
                        <CalendarDays className="w-3 h-3" /> Competencias
                      </p>
                      {ficha.eventos.map(ev => {
                        const fecha = parseISO(ev.fecha)
                        const diasRestantes = differenceInDays(fecha, new Date())
                        const esPasada = diasRestantes < 0
                        const esProxima = diasRestantes >= 0 && diasRestantes <= 30
                        return (
                          <div
                            key={ev.id}
                            className={`rounded-xl px-3 py-2 border text-xs ${
                              esPasada
                                ? 'bg-gray-50 dark:bg-white/[0.02] border-gray-200 dark:border-white/[0.05]'
                                : esProxima
                                  ? 'bg-amber-500/[0.06] border-amber-500/20'
                                  : 'bg-primary/[0.04] border-primary/15'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className={`font-semibold ${esPasada ? 'text-gray-400 dark:text-white/30' : 'text-gray-800 dark:text-white/85'}`}>
                                {ev.nombre}
                              </span>
                              {!esPasada && (
                                <span className={`shrink-0 px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                                  esProxima ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' : 'bg-primary/15 text-primary'
                                }`}>
                                  {diasRestantes === 0 ? '¡Hoy!' : `${diasRestantes}d`}
                                </span>
                              )}
                            </div>
                            <p className={`mt-0.5 ${esPasada ? 'text-gray-400 dark:text-white/25' : 'text-gray-500 dark:text-white/45'}`}>
                              {format(fecha, "d MMM yyyy", { locale: es })}
                            </p>
                            {ev.observacion && (
                              <p className="text-[10px] text-gray-400 dark:text-white/30 mt-0.5 italic">{ev.observacion}</p>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Contenido principal ───────────────────────────────────────── */}
        <motion.div layout className="flex-1 min-w-0 space-y-4">

          {/* Modo edición: tabla editable inline */}
          <AnimatePresence mode="wait">
            {editMode && rutina ? (
              <InlineEditRutinaTable
                key="inline-edit"
                rutina={rutina}
                onCancel={handleEditCancel}
                onSaved={handleEditSaved}
              />
            ) : !rutina ? (
              <motion.div key="empty" className={`${glassCard} flex flex-col items-center justify-center py-24 text-center`}>
                <BookOpen className="w-12 h-12 text-gray-200 dark:text-white/15 mb-4" />
                <p className="text-gray-400 dark:text-white/35 text-sm">
                  {rutinas.length > 0 ? 'Seleccioná una rutina' : 'No hay rutinas para este cliente'}
                </p>
              </motion.div>
            ) : (
              /* ── Modo lectura: nav card + bloques ─────────────────────── */
              <motion.div key="view" className="space-y-4">

                {/* ── Card de navegación: rutina + semana + día ─────────── */}
                <div className={glassCard + ' p-5'}>
                  {/* Rutina info row */}
                  <div className="flex items-start justify-between gap-4 pb-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2.5 flex-wrap mb-1.5">
                        <h1 className="text-xl lg:text-2xl font-bold text-saas-text dark:text-white leading-tight">{rutina.nombre}</h1>
                        <span className={`px-2 py-0.5 rounded-lg text-xs font-semibold border ${
                          rutina.activa
                            ? 'bg-primary/15 text-primary border-primary/20'
                            : 'bg-gray-100 dark:bg-white/[0.05] text-gray-400 dark:text-white/35 border-saas-border dark:border-white/[0.08]'
                        }`}>
                          {rutina.activa ? 'Activa' : 'Inactiva'}
                        </span>
                      </div>
                      {rutina.descripcion && <p className="text-sm text-saas-muted dark:text-white/45 mb-2">{rutina.descripcion}</p>}
                      <div className="flex items-center gap-4 text-xs text-gray-400 dark:text-white/40 flex-wrap">
                        <span>{rutina.semanas.length} semanas</span>
                        <span className="text-gray-300 dark:text-white/20">·</span>
                        <span className="text-primary/70 font-semibold">{countEjRutina(rutina)} ejercicios</span>
                        {rutina.profesor && (
                          <>
                            <span className="text-gray-300 dark:text-white/20">·</span>
                            <span className="flex items-center gap-1">
                              <User2 className="w-3 h-3" />
                              {rutina.profesor.usuario.nombre}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    {canEdit && (
                      <button
                        onClick={handleEnterEdit}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-saas-border dark:border-white/[0.08] text-sm text-saas-muted dark:text-white/45 hover:text-white hover:border-white/20 transition-colors shrink-0"
                      >
                        <Pencil className="w-3.5 h-3.5" /> Editar rutina
                      </button>
                    )}
                  </div>

                  {/* Tabla jerárquica */}
                  {rutina.semanas.length === 0 ? (
                    <>
                      <div className="border-t border-saas-border dark:border-white/[0.06] -mx-5 mb-4" />
                      <p className="text-xs text-gray-400 dark:text-white/30 py-2">{canEdit ? 'Entrá en modo edición para agregar semanas' : 'Sin semanas'}</p>
                    </>
                  ) : (() => {
                    const sesRS = (ses: typeof rutina.semanas[0]['sesiones'][0]) =>
                      ses.bloques.length === 0 ? 1
                        : ses.bloques.reduce((a, bl) => a + Math.max(1, bl.ejerciciosPlan.length), 0)
                    const semRS = (sem: typeof rutina.semanas[0]) =>
                      sem.sesiones.length === 0 ? 1
                        : sem.sesiones.reduce((a, ses) => a + sesRS(ses), 0)
                    return (
                      <>
                        <div className="border-t border-saas-border dark:border-white/[0.06] -mx-5 mb-4" />
                        <div className="overflow-x-auto">
                          <table className="w-full border-collapse text-sm">
                            <thead>
                              <tr className="border-b border-saas-border dark:border-white/[0.08] bg-gray-50/50 dark:bg-white/[0.02]">
                                {(['Semana', 'Día', 'Bloque', 'Ejercicio', 'Ser.', 'Reps', 'Peso', 'RIR / RPE'] as const).map((h, i) => (
                                  <th
                                    key={h}
                                    className={`py-3 text-[10px] font-semibold text-gray-400 dark:text-white/35 uppercase tracking-widest whitespace-nowrap ${
                                      i < 3 ? 'px-4 text-left border-r border-saas-border dark:border-white/[0.06]'
                                      : i === 3 ? 'px-4 text-left'
                                      : 'px-3 text-center'
                                    }`}
                                  >
                                    {h}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {rutina.semanas.flatMap(sem => {
                                const sLabel = sem.nombre?.trim() ? sem.nombre : `S${sem.numero}`
                                const sRS = semRS(sem)
                                const semanaCell = (
                                  <td rowSpan={sRS} className="px-4 py-3 align-top border-r border-saas-border dark:border-white/[0.06] max-w-[160px]">
                                    <span className="px-2 py-1 bg-primary/10 border border-primary/20 rounded-lg text-primary/90 text-xs font-bold whitespace-nowrap">
                                      {sLabel}
                                    </span>
                                    {sem.observaciones && (
                                      <p className="mt-2 text-[11px] text-gray-500 dark:text-white/45 leading-relaxed italic break-words">
                                        {sem.observaciones}
                                      </p>
                                    )}
                                  </td>
                                )
                                if (sem.sesiones.length === 0) {
                                  return [(
                                    <tr key={`${sem.id}-empty`} className="border-b border-saas-border dark:border-white/[0.05]">
                                      {semanaCell}
                                      <td colSpan={7} className="px-4 py-3 text-xs text-gray-400 dark:text-white/25">Sin días asignados</td>
                                    </tr>
                                  )]
                                }
                                return sem.sesiones.flatMap((ses, sesIdx) => {
                                  const sRS_ = sesRS(ses)
                                  const diaCell = (
                                    <td rowSpan={sRS_} className="px-4 py-3 align-top border-r border-saas-border dark:border-white/[0.06] whitespace-nowrap">
                                      <span className="text-sm text-gray-700 dark:text-white/70 font-semibold">{ses.dia}</span>
                                    </td>
                                  )
                                  if (ses.bloques.length === 0) {
                                    return [(
                                      <tr key={`${ses.id}-empty`} className="border-b border-saas-border dark:border-white/[0.05]">
                                        {sesIdx === 0 && semanaCell}
                                        {diaCell}
                                        <td colSpan={6} className="px-4 py-3 text-xs text-gray-400 dark:text-white/25">Sin bloques</td>
                                      </tr>
                                    )]
                                  }
                                  return ses.bloques.flatMap((bl, blqIdx) => {
                                    const blRS = Math.max(1, bl.ejerciciosPlan.length)
                                    const bloqueCell = (
                                      <td rowSpan={blRS} className="px-3 py-3 text-center align-top border-r border-saas-border dark:border-white/[0.06]">
                                        <span className="w-7 h-7 rounded-xl bg-primary/15 border border-primary/25 text-primary text-xs font-bold flex items-center justify-center mx-auto">
                                          {bl.letra}
                                        </span>
                                      </td>
                                    )
                                    if (bl.ejerciciosPlan.length === 0) {
                                      return [(
                                        <tr key={`${bl.id}-empty`} className="border-b border-saas-border dark:border-white/[0.05]">
                                          {sesIdx === 0 && blqIdx === 0 && semanaCell}
                                          {blqIdx === 0 && diaCell}
                                          {bloqueCell}
                                          <td colSpan={5} className="px-4 py-3 text-xs text-gray-400 dark:text-white/25">Sin ejercicios</td>
                                        </tr>
                                      )]
                                    }
                                    return bl.ejerciciosPlan.map((ej, ejIdx) => (
                                      <tr key={ej.id} className="border-b border-saas-border dark:border-white/[0.05] hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors">
                                        {sesIdx === 0 && blqIdx === 0 && ejIdx === 0 && semanaCell}
                                        {blqIdx === 0 && ejIdx === 0 && diaCell}
                                        {ejIdx === 0 && bloqueCell}
                                        <td className="px-4 py-2.5">
                                          <span className="text-sm text-saas-text dark:text-white/90 font-medium block">{ej.nombre}</span>
                                          {ej.catalogo?.patronMovimiento && (
                                            <span className="text-[11px] text-gray-400 dark:text-white/35 block">
                                              {PATRON_LABELS[ej.catalogo.patronMovimiento as PatronMovimientoEnum] ?? ej.catalogo.patronMovimiento}
                                            </span>
                                          )}
                                        </td>
                                        <td className="px-3 py-2.5 text-center">
                                          {ej.series != null
                                            ? <span className="text-xs tabular-nums bg-gray-100 dark:bg-white/[0.06] px-1.5 py-0.5 rounded-md text-gray-600 dark:text-white/60 font-medium">{ej.series}×</span>
                                            : <span className="text-gray-300 dark:text-white/15 text-xs">—</span>}
                                        </td>
                                        <td className="px-3 py-2.5 text-center">
                                          {ej.repeticiones
                                            ? <span className="text-xs text-gray-500 dark:text-white/55">{ej.repeticiones}</span>
                                            : <span className="text-gray-300 dark:text-white/15 text-xs">—</span>}
                                        </td>
                                        <td className="px-3 py-2.5 text-center">
                                          {ej.peso
                                            ? <span className="text-xs px-1.5 py-0.5 bg-primary/10 text-primary/80 rounded-md font-medium">{ej.peso}</span>
                                            : <span className="text-gray-300 dark:text-white/15 text-xs">—</span>}
                                        </td>
                                        <td className="px-3 py-2.5 text-center">
                                          <div className="flex items-center justify-center gap-2">
                                            {ej.rir != null && <span className="text-[11px] text-gray-400 dark:text-white/40">RIR <span className="text-gray-600 dark:text-white/65 font-semibold">{ej.rir}</span></span>}
                                            {ej.rpe != null && <span className="text-[11px] text-gray-400 dark:text-white/40">RPE <span className="text-gray-600 dark:text-white/65 font-semibold">{ej.rpe}</span></span>}
                                            {ej.rir == null && ej.rpe == null && <span className="text-gray-300 dark:text-white/15 text-xs">—</span>}
                                          </div>
                                        </td>
                                      </tr>
                                    ))
                                  })
                                })
                              })}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )
                  })()}
                </div>

              </motion.div>
            )}
          </AnimatePresence>

        </motion.div>
      </div>
    </div>
  )
}
