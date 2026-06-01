import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Layers, Plus, GripVertical, X, Check, AlertTriangle, ArrowLeft,
} from 'lucide-react'
import { plantillasApi } from '../api/plantillas.api'
import type { CreatePlantillaPayload, CreateBloquePayload } from '../api/plantillas.api'
import { useUiStore } from '../store/uiStore'
import type { PlantillaRutinaData, TipoDistribucion, PatronMovimientoEnum } from '../types/rutina.types'
import { ROUTES } from '../constants/routes'

// ─── Constantes ───────────────────────────────────────────────────────────────

const TIPO_LABELS: Record<TipoDistribucion, string> = {
  FULL_BODY: 'Full Body',
  ARM_LEG:   'Arm-Leg',
  PUSH_PULL: 'Push-Pull',
  CUSTOM:    'Custom',
}

const PATRON_LABELS: Record<PatronMovimientoEnum, string> = {
  RODILLA_DOMINANTE: 'Rodilla dom.',
  CADERA_DOMINANTE:  'Cadera dom.',
  EMPUJE:            'Empuje',
  TRACCION:          'Tracción',
  HIBRIDO:           'Híbrido',
  HOMBROS:           'Hombros',
  ACCESORIO:         'Accesorio',
  OTROS:             'Otros',
}

const TODOS_PATRONES: PatronMovimientoEnum[] = [
  'RODILLA_DOMINANTE', 'CADERA_DOMINANTE', 'EMPUJE', 'TRACCION',
  'HIBRIDO', 'HOMBROS', 'ACCESORIO', 'OTROS',
]

const LETRAS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']

function uid() { return Math.random().toString(36).slice(2, 9) }

// ─── Estilos ──────────────────────────────────────────────────────────────────

const glass     = 'rounded-[2rem] border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-3xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)]'
const inputCls  = 'w-full rounded-xl border border-gray-200 dark:border-white/[0.1] bg-gray-50 dark:bg-white/[0.05] px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/30 focus:border-primary/60 focus:outline-none transition-colors'
const selectCls = inputCls + ' cursor-pointer'
const labelCls  = 'block text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-white/40 mb-1.5'

// ─── Tipos del formulario ─────────────────────────────────────────────────────

interface BloqueForm {
  _id: string
  patronMovimiento: PatronMovimientoEnum | ''
  cantidadEjercicios: 1 | 2 | 3
}

interface SesionForm {
  numero: number
  nombre: string
  bloques: BloqueForm[]
}

interface FormState {
  nombre: string
  tipo: TipoDistribucion | ''
  cantidadSesiones: number
  sesiones: SesionForm[]
}

function crearBloqueVacio(): BloqueForm {
  return { _id: uid(), patronMovimiento: '', cantidadEjercicios: 2 }
}

function crearSesionVacia(numero: number): SesionForm {
  return { numero, nombre: '', bloques: [crearBloqueVacio()] }
}

function formVacio(): FormState {
  return { nombre: '', tipo: '', cantidadSesiones: 2, sesiones: [crearSesionVacia(1), crearSesionVacia(2)] }
}

function plantillaToForm(p: PlantillaRutinaData): FormState {
  return {
    nombre: p.nombre,
    tipo: p.tipo,
    cantidadSesiones: p.cantidadSesiones,
    sesiones: p.sesiones.map(s => ({
      numero: s.numero,
      nombre: s.nombre ?? '',
      bloques: s.bloques.map(b => ({
        _id: uid(),
        patronMovimiento: b.patronMovimiento,
        cantidadEjercicios: Math.max(1, Math.min(3, b.cantidadEjercicios)) as 1 | 2 | 3,
      })),
    })),
  }
}

function formToPayload(f: FormState): CreatePlantillaPayload {
  return {
    nombre: f.nombre.trim(),
    tipo: f.tipo as TipoDistribucion,
    cantidadSesiones: f.cantidadSesiones,
    sesiones: f.sesiones.map(s => ({
      numero: s.numero,
      nombre: s.nombre.trim() || undefined,
      bloques: s.bloques.map((b, i): CreateBloquePayload => ({
        letra: LETRAS[i] ?? String.fromCharCode(65 + i),
        orden: i,
        patronMovimiento: b.patronMovimiento as PatronMovimientoEnum,
        cantidadEjercicios: b.cantidadEjercicios,
      })),
    })),
  }
}

// ─── BloqueItem ────────────────────────────────────────────────────────────────

interface BloqueItemProps {
  bloque: BloqueForm
  index: number
  isOnly: boolean
  onChange: (changes: Partial<BloqueForm>) => void
  onDelete: () => void
  onDragStart: (index: number) => void
  onDragOver: (e: React.DragEvent, index: number) => void
  onDrop: (e: React.DragEvent, index: number) => void
}

function BloqueItem({ bloque, index, isOnly, onChange, onDelete, onDragStart, onDragOver, onDrop }: BloqueItemProps) {
  const letra = LETRAS[index] ?? String.fromCharCode(65 + index)
  return (
    <div
      draggable
      onDragStart={() => onDragStart(index)}
      onDragOver={e => onDragOver(e, index)}
      onDrop={e => onDrop(e, index)}
      className="group flex items-center gap-2 rounded-xl border border-white/20 dark:border-white/[0.1] bg-white/10 dark:bg-black/20 px-2.5 py-2 cursor-grab active:cursor-grabbing hover:border-white/30 dark:hover:border-white/[0.2] transition-colors"
    >
      <GripVertical size={12} className="text-gray-300 dark:text-white/20 group-hover:text-gray-500 dark:group-hover:text-white/40 shrink-0" />
      <span className="w-5 text-center text-[10px] font-black text-primary/80">{letra}</span>

      <select
        value={bloque.patronMovimiento}
        onChange={e => onChange({ patronMovimiento: e.target.value as PatronMovimientoEnum })}
        className="flex-1 rounded-lg border border-gray-200 dark:border-white/[0.08] bg-gray-50 dark:bg-white/[0.05] px-2 py-1 text-xs text-gray-900 dark:text-white focus:border-primary/50 focus:outline-none cursor-pointer"
      >
        <option value="">Patrón…</option>
        {TODOS_PATRONES.map(p => (
          <option key={p} value={p}>{PATRON_LABELS[p]}</option>
        ))}
      </select>

      <div className="flex gap-0.5 shrink-0">
        {([1, 2, 3] as const).map(n => (
          <button
            key={n}
            type="button"
            onClick={() => onChange({ cantidadEjercicios: n })}
            className={`w-6 h-6 rounded-md text-[10px] font-bold transition-colors ${
              bloque.cantidadEjercicios === n
                ? 'bg-primary text-black'
                : 'bg-gray-100 dark:bg-white/[0.05] text-gray-500 dark:text-white/40 hover:bg-gray-200 dark:hover:bg-white/[0.1]'
            }`}
          >
            {n}
          </button>
        ))}
      </div>

      <button
        type="button"
        disabled={isOnly}
        onClick={onDelete}
        className="ml-0.5 text-gray-300 dark:text-white/20 hover:text-red-400 disabled:opacity-0 transition-colors"
      >
        <X size={12} />
      </button>
    </div>
  )
}

// ─── SesionColumn ─────────────────────────────────────────────────────────────

interface SesionColumnProps {
  sesion: SesionForm
  onUpdate: (updated: SesionForm) => void
}

function SesionColumn({ sesion, onUpdate }: SesionColumnProps) {
  const dragIndexRef = useRef<number | null>(null)

  function handleDragStart(index: number) { dragIndexRef.current = index }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault()
    const from = dragIndexRef.current
    if (from === null || from === index) return
    const bloques = [...sesion.bloques]
    const [item] = bloques.splice(from, 1)
    bloques.splice(index, 0, item)
    dragIndexRef.current = index
    onUpdate({ ...sesion, bloques })
  }

  function handleDrop(e: React.DragEvent) { e.preventDefault(); dragIndexRef.current = null }

  return (
    <div className={`${glass} flex-1 min-w-[200px] max-w-xs p-4 space-y-3`}>
      <div className="flex items-center gap-2 mb-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/15 text-[10px] font-black text-primary">
          {sesion.numero}
        </div>
        <input
          type="text"
          value={sesion.nombre}
          onChange={e => onUpdate({ ...sesion, nombre: e.target.value })}
          placeholder={`Sesión ${sesion.numero}`}
          className="flex-1 bg-transparent border-b border-gray-200 dark:border-white/[0.1] pb-0.5 text-xs text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/25 focus:border-primary/50 focus:outline-none"
        />
      </div>

      <div className="space-y-1.5">
        {sesion.bloques.map((b, i) => (
          <BloqueItem
            key={b._id}
            bloque={b}
            index={i}
            isOnly={sesion.bloques.length === 1}
            onChange={changes => onUpdate({ ...sesion, bloques: sesion.bloques.map((bl, idx) => idx === i ? { ...bl, ...changes } : bl) })}
            onDelete={() => onUpdate({ ...sesion, bloques: sesion.bloques.filter((_, idx) => idx !== i) })}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={() => onUpdate({ ...sesion, bloques: [...sesion.bloques, crearBloqueVacio()] })}
        disabled={sesion.bloques.length >= 8}
        className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-dashed border-gray-200 dark:border-white/[0.1] text-[11px] text-gray-400 dark:text-white/30 hover:text-primary hover:border-primary/30 transition-colors disabled:opacity-30"
      >
        <Plus size={11} /> Agregar bloque
      </button>
    </div>
  )
}

// ─── Página ────────────────────────────────────────────────────────────────────

export default function PlantillaDetailPage() {
  const { id }    = useParams<{ id: string }>()
  const navigate  = useNavigate()
  const addToast  = useUiStore(s => s.addToast)
  const isNew     = id === 'new'

  const [form, setForm]               = useState<FormState>(formVacio())
  const [loadingData, setLoadingData] = useState(!isNew)
  const [saving, setSaving]           = useState(false)
  const [errors, setErrors]           = useState<string[]>([])

  useEffect(() => {
    if (!isNew && id) {
      setLoadingData(true)
      plantillasApi.getById(id)
        .then(p => setForm(plantillaToForm(p)))
        .catch(() => { addToast('Error al cargar la plantilla', 'error'); navigate(ROUTES.EXERCISES) })
        .finally(() => setLoadingData(false))
    }
  }, [id, isNew, addToast, navigate])

  useEffect(() => {
    const n = form.cantidadSesiones
    setForm(prev => {
      if (prev.sesiones.length === n) return prev
      if (prev.sesiones.length < n) {
        const extras = Array.from({ length: n - prev.sesiones.length }, (_, i) =>
          crearSesionVacia(prev.sesiones.length + i + 1)
        )
        return { ...prev, sesiones: [...prev.sesiones, ...extras] }
      }
      return { ...prev, sesiones: prev.sesiones.slice(0, n) }
    })
  }, [form.cantidadSesiones])

  function validate(): boolean {
    const errs: string[] = []
    if (!form.nombre.trim()) errs.push('El nombre es requerido')
    if (!form.tipo) errs.push('El tipo es requerido')
    form.sesiones.forEach((s, si) => {
      s.bloques.forEach((b, bi) => {
        if (!b.patronMovimiento) errs.push(`Sesión ${si + 1}, Bloque ${LETRAS[bi]}: falta el patrón de movimiento`)
      })
    })
    setErrors(errs)
    return errs.length === 0
  }

  async function handleSave() {
    if (!validate()) return
    setSaving(true)
    try {
      const payload = formToPayload(form)
      if (isNew) {
        await plantillasApi.create(payload)
        addToast('Plantilla creada', 'success')
      } else {
        await plantillasApi.update(id!, payload)
        addToast('Plantilla actualizada', 'success')
      }
      navigate(ROUTES.EXERCISES)
    } catch {
      addToast('Error al guardar la plantilla', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loadingData) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`${glass} p-6 space-y-3 max-w-3xl`}>
        {[1, 2, 3].map(i => (
          <div key={i} className="h-10 rounded-xl bg-black/[0.05] dark:bg-white/[0.06] animate-pulse" style={{ opacity: 1 - i * 0.2 }} />
        ))}
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className="flex flex-col gap-6"
    >
      {/* Header */}
      <div className="flex flex-col gap-4">
        <button
          onClick={() => navigate(ROUTES.EXERCISES)}
          className="group flex items-center gap-1.5 text-sm text-gray-500 dark:text-white/40 hover:text-gray-900 dark:hover:text-white transition-colors w-fit"
        >
          <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
          Volver a ejercicios
        </button>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Layers size={20} className="text-primary" />
          </div>
          <h1 className="text-2xl lg:text-3xl xl:text-4xl font-black tracking-tighter text-gray-900 dark:text-white drop-shadow-sm">
            {isNew ? 'Nueva plantilla' : 'Editar plantilla'}
          </h1>
        </div>
      </div>

      {/* Errores */}
      <AnimatePresence>
        {errors.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 space-y-1"
          >
            {errors.map((e, i) => (
              <p key={i} className="flex items-center gap-2 text-xs text-red-400">
                <AlertTriangle size={11} className="shrink-0" /> {e}
              </p>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Datos generales */}
      <div className={`${glass} p-5 space-y-4`}>
        <h3 className="text-xs font-bold text-gray-500 dark:text-white/50 uppercase tracking-widest">Datos generales</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className={labelCls}>Nombre</label>
            <input
              type="text"
              value={form.nombre}
              onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))}
              placeholder="Ej: Full Body 2x"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Tipo</label>
            <select
              value={form.tipo}
              onChange={e => setForm(p => ({ ...p, tipo: e.target.value as TipoDistribucion }))}
              className={selectCls}
            >
              <option value="">Seleccioná...</option>
              {(Object.keys(TIPO_LABELS) as TipoDistribucion[]).map(t => (
                <option key={t} value={t}>{TIPO_LABELS[t]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Sesiones / semana</label>
            <select
              value={form.cantidadSesiones}
              onChange={e => setForm(p => ({ ...p, cantidadSesiones: Number(e.target.value) }))}
              className={selectCls}
            >
              {[2, 3, 4, 5].map(n => (
                <option key={n} value={n}>{n} sesiones</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Estructura */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-gray-500 dark:text-white/50 uppercase tracking-widest">
          Estructura — {form.cantidadSesiones} sesión{form.cantidadSesiones !== 1 ? 'es' : ''}
        </h3>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {form.sesiones.map((s, i) => (
            <SesionColumn
              key={s.numero}
              sesion={s}
              onUpdate={updated => setForm(prev => ({
                ...prev,
                sesiones: prev.sesiones.map((ses, idx) => idx === i ? updated : ses),
              }))}
            />
          ))}
        </div>
        <p className="text-[10px] text-gray-400 dark:text-white/25">
          Arrastrá los bloques para reordenarlos. La letra (A, B, C…) se asigna automáticamente por posición.
        </p>
      </div>

      {/* Acciones */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 rounded-xl btn-action px-4 py-2.5 text-sm disabled:opacity-60"
        >
          {saving
            ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />
            : <Check size={14} />
          }
          {isNew ? 'Crear plantilla' : 'Guardar cambios'}
        </button>
        <button
          type="button"
          onClick={() => navigate(ROUTES.EXERCISES)}
          className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/[0.08] text-sm text-gray-500 dark:text-[#8A8A9A] hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          Cancelar
        </button>
      </div>
    </motion.div>
  )
}
