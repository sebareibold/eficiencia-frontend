import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, GripVertical, X, Check, AlertTriangle, ArrowLeft, Zap, BookOpen,
} from 'lucide-react'
import DotsLoader from '../components/ui/DotsLoader'
import { plantillasApi } from '../api/plantillas.api'
import type { CreatePlantillaPayload, CreateBloquePayload, CreatePlantillaEjercicioPayload } from '../api/plantillas.api'
import { patronesApi } from '../api/patrones.api'
import type { PatronMovimientoConfig } from '../api/patrones.api'
import { ejerciciosApi } from '../api/ejercicios.api'
import type { EjercicioCatalogo } from '../types/ejercicio-catalogo.types'
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

const LETRAS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
const DATALIST_ID = 'plantilla-ej-catalog'

function uid() { return Math.random().toString(36).slice(2, 9) }

// ─── Estilos ──────────────────────────────────────────────────────────────────

const glass    = 'rounded-[2rem] border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-3xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)]'
const inputCls = 'w-full rounded-xl border border-gray-200 dark:border-white/[0.1] bg-gray-50 dark:bg-white/[0.05] px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/30 focus:border-primary/60 focus:outline-none transition-colors'
const labelCls = 'block text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-white/40 mb-1.5'

// ─── Tipos del formulario ─────────────────────────────────────────────────────

interface EjercicioForm {
  _id: string
  catalogoId?: string
  nombre: string
  series?: number
  repeticiones?: string
  peso?: string
  rir?: number
  rpe?: number
  notas?: string
}

interface PatronEntryForm {
  _id: string
  patronMovimiento: PatronMovimientoEnum | ''
  cantidad: 1 | 2 | 3
}

interface BloqueForm {
  _id: string
  patrones: PatronEntryForm[]
  ejercicios: EjercicioForm[]
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
  especializada: boolean
  sesiones: SesionForm[]
}

function crearEjercicioVacio(): EjercicioForm {
  return { _id: uid(), nombre: '' }
}

function crearPatronVacio(): PatronEntryForm {
  return { _id: uid(), patronMovimiento: '', cantidad: 2 }
}

function crearBloqueVacio(): BloqueForm {
  return { _id: uid(), patrones: [crearPatronVacio()], ejercicios: [crearEjercicioVacio(), crearEjercicioVacio()] }
}

function crearSesionVacia(numero: number): SesionForm {
  return { numero, nombre: '', bloques: [crearBloqueVacio()] }
}

function formVacio(): FormState {
  return { nombre: '', tipo: '', cantidadSesiones: 2, especializada: false, sesiones: [crearSesionVacia(1), crearSesionVacia(2)] }
}

function plantillaToForm(p: PlantillaRutinaData): FormState {
  return {
    nombre: p.nombre,
    tipo: p.tipo,
    cantidadSesiones: p.cantidadSesiones,
    especializada: p.especializada,
    sesiones: p.sesiones.map(s => ({
      numero: s.numero,
      nombre: s.nombre ?? '',
      bloques: s.bloques.map(b => {
        // Normalizar patrones: usar array nuevo si existe, si no convertir legacy
        const patronesRaw = b.patrones && b.patrones.length > 0
          ? b.patrones
          : b.patronMovimiento
            ? [{ id: '', patronMovimiento: b.patronMovimiento, cantidad: b.cantidadEjercicios ?? 2, orden: 0 }]
            : []
        const patrones: PatronEntryForm[] = patronesRaw.map(pr => ({
          _id: uid(),
          patronMovimiento: pr.patronMovimiento as PatronMovimientoEnum,
          cantidad: Math.max(1, Math.min(3, pr.cantidad)) as 1 | 2 | 3,
        }))
        const totalCantidad = patrones.reduce((s, p) => s + p.cantidad, 0) || 2
        return {
          _id: uid(),
          patrones: patrones.length > 0 ? patrones : [crearPatronVacio()],
          ejercicios: b.ejercicios.length > 0
            ? b.ejercicios.map(e => ({
                _id: uid(),
                catalogoId: e.catalogoId,
                nombre: e.nombre,
                series: e.series ?? undefined,
                repeticiones: e.repeticiones ?? undefined,
                peso: e.peso ?? undefined,
                rir: e.rir ?? undefined,
                rpe: e.rpe ?? undefined,
                notas: e.notas ?? undefined,
              }))
            : Array.from({ length: totalCantidad }, crearEjercicioVacio),
        }
      }),
    })),
  }
}

function formToPayload(f: FormState): CreatePlantillaPayload {
  return {
    nombre: f.nombre.trim(),
    tipo: f.tipo as TipoDistribucion,
    cantidadSesiones: f.cantidadSesiones,
    especializada: f.especializada,
    sesiones: f.sesiones.map(s => ({
      numero: s.numero,
      nombre: s.nombre.trim() || undefined,
      bloques: s.bloques.map((b, i): CreateBloquePayload => ({
        letra: LETRAS[i] ?? String.fromCharCode(65 + i),
        orden: i,
        patrones: b.patrones.map((p, pi) => ({
          patronMovimiento: p.patronMovimiento as PatronMovimientoEnum,
          cantidad: p.cantidad,
          orden: pi,
        })),
        ejercicios: f.especializada
          ? b.ejercicios.map((ej, ejIdx): CreatePlantillaEjercicioPayload => ({
              catalogoId: ej.catalogoId,
              nombre: ej.nombre.trim() || '(sin nombre)',
              series: ej.series,
              repeticiones: ej.repeticiones?.trim() || undefined,
              peso: ej.peso?.trim() || undefined,
              rir: ej.rir,
              rpe: ej.rpe,
              notas: ej.notas?.trim() || undefined,
              orden: ejIdx,
            }))
          : undefined,
      })),
    })),
  }
}

// ─── EjercicioRow ─────────────────────────────────────────────────────────────

interface EjercicioRowProps {
  ejercicio: EjercicioForm
  catalogo: EjercicioCatalogo[]
  isOnly: boolean
  onChange: (changes: Partial<EjercicioForm>) => void
  onDelete: () => void
}

function EjercicioRow({ ejercicio, catalogo, isOnly, onChange, onDelete }: EjercicioRowProps) {
  function handleNombreChange(value: string) {
    const found = catalogo.find(e => e.nombre.toLowerCase() === value.toLowerCase())
    onChange({ nombre: value, catalogoId: found?.id ?? undefined })
  }

  const numInput = 'w-9 bg-transparent text-xs text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/25 text-center focus:outline-none'
  const txtInput = 'w-11 bg-transparent text-xs text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/25 text-center focus:outline-none'

  return (
    <div className="flex items-center gap-1 rounded-lg border border-gray-100 dark:border-white/[0.06] bg-gray-50/60 dark:bg-white/[0.03] px-2 py-1.5">
      <input
        type="text"
        list={DATALIST_ID}
        value={ejercicio.nombre}
        onChange={e => handleNombreChange(e.target.value)}
        placeholder="Ejercicio…"
        className="flex-1 min-w-0 bg-transparent text-xs text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/25 focus:outline-none"
      />
      <div className="w-px h-3 bg-gray-200 dark:bg-white/[0.08] shrink-0" />
      <input
        type="number"
        min={1} max={20}
        value={ejercicio.series ?? ''}
        onChange={e => onChange({ series: e.target.value ? Number(e.target.value) : undefined })}
        placeholder="—"
        className={numInput}
      />
      <div className="w-px h-3 bg-gray-200 dark:bg-white/[0.08] shrink-0" />
      <input
        type="text"
        value={ejercicio.repeticiones ?? ''}
        onChange={e => onChange({ repeticiones: e.target.value || undefined })}
        placeholder="—"
        className={txtInput}
      />
      <div className="w-px h-3 bg-gray-200 dark:bg-white/[0.08] shrink-0" />
      <input
        type="text"
        value={ejercicio.peso ?? ''}
        onChange={e => onChange({ peso: e.target.value || undefined })}
        placeholder="—"
        className={txtInput}
      />
      <div className="w-px h-3 bg-gray-200 dark:bg-white/[0.08] shrink-0" />
      <input
        type="number"
        min={0} max={10}
        value={ejercicio.rir ?? ''}
        onChange={e => onChange({ rir: e.target.value ? Number(e.target.value) : undefined })}
        placeholder="—"
        className={numInput}
      />
      <button
        type="button"
        disabled={isOnly}
        onClick={onDelete}
        className="shrink-0 ml-0.5 text-gray-300 dark:text-white/20 hover:text-red-400 disabled:opacity-0 transition-colors"
      >
        <X size={11} />
      </button>
    </div>
  )
}

// ─── BloqueItem ────────────────────────────────────────────────────────────────

interface BloqueItemProps {
  bloque: BloqueForm
  index: number
  isOnly: boolean
  especializada: boolean
  patrones: PatronMovimientoConfig[]
  catalogo: EjercicioCatalogo[]
  onChange: (changes: Partial<BloqueForm>) => void
  onDelete: () => void
  onDragStart: (index: number) => void
  onDragOver: (e: React.DragEvent, index: number) => void
  onDrop: (e: React.DragEvent, index: number) => void
}

const EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1]

function BloqueItem({
  bloque, index, isOnly, especializada, patrones, catalogo,
  onChange, onDelete, onDragStart, onDragOver, onDrop,
}: BloqueItemProps) {
  const letra = LETRAS[index] ?? String.fromCharCode(65 + index)

  function updatePatron(pi: number, changes: Partial<PatronEntryForm>) {
    onChange({ patrones: bloque.patrones.map((p, idx) => idx === pi ? { ...p, ...changes } : p) })
  }

  function removePatron(pi: number) {
    onChange({ patrones: bloque.patrones.filter((_, idx) => idx !== pi) })
  }

  function addPatron() {
    onChange({ patrones: [...bloque.patrones, crearPatronVacio()] })
  }

  function updateEjercicio(i: number, changes: Partial<EjercicioForm>) {
    onChange({ ejercicios: bloque.ejercicios.map((ej, idx) => idx === i ? { ...ej, ...changes } : ej) })
  }

  return (
    <div
      draggable
      onDragStart={() => onDragStart(index)}
      onDragOver={e => onDragOver(e, index)}
      onDrop={e => onDrop(e, index)}
      className={`group rounded-xl border border-white/20 dark:border-white/[0.1] bg-white/10 dark:bg-black/20 hover:border-white/30 dark:hover:border-white/[0.2] transition-colors ${
        especializada ? 'p-2.5 space-y-2' : 'p-2 space-y-1.5'
      }`}
    >
      {/* Header fila: grip + letra + botón eliminar bloque */}
      <div className="flex items-center gap-2 cursor-grab active:cursor-grabbing">
        <GripVertical size={12} className="text-gray-300 dark:text-white/20 group-hover:text-gray-500 dark:group-hover:text-white/40 shrink-0" />
        <span className="w-5 text-center text-[10px] font-black text-primary/80 shrink-0">{letra}</span>
        <span className="flex-1" />
        {especializada && (
          <span className="text-[10px] text-gray-400 dark:text-white/30 shrink-0">
            {bloque.ejercicios.length} ej.
          </span>
        )}
        <button
          type="button"
          disabled={isOnly}
          onClick={onDelete}
          className="text-gray-300 dark:text-white/20 hover:text-red-400 disabled:opacity-0 transition-colors active:scale-[0.97] shrink-0"
        >
          <X size={12} />
        </button>
      </div>

      {/* Lista de patrones */}
      <div className="pl-7 space-y-1">
        <AnimatePresence initial={false}>
          {bloque.patrones.map((entry, pi) => (
            <motion.div
              key={entry._id}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4, height: 0, marginTop: 0 }}
              transition={{ duration: 0.15, ease: EASE_OUT }}
              className="flex items-center gap-1.5"
            >
              <select
                value={entry.patronMovimiento}
                onChange={e => updatePatron(pi, { patronMovimiento: e.target.value as PatronMovimientoEnum })}
                className="flex-1 rounded-lg border border-gray-200 dark:border-white/[0.08] bg-gray-50 dark:bg-white/[0.05] px-2 py-1 text-xs text-gray-900 dark:text-white focus:border-primary/50 focus:outline-none cursor-pointer"
              >
                <option value="">Patrón…</option>
                {patrones.map(p => (
                  <option key={p.clave} value={p.clave}>{p.label}</option>
                ))}
              </select>

              {/* Cantidad de ejercicios (solo modo básica) */}
              {!especializada && (
                <div className="flex gap-0.5 shrink-0">
                  {([1, 2, 3] as const).map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => updatePatron(pi, { cantidad: n })}
                      className={`w-6 h-6 rounded-md text-[10px] font-bold transition-colors active:scale-[0.97] ${
                        entry.cantidad === n
                          ? 'bg-primary text-black'
                          : 'bg-gray-100 dark:bg-white/[0.05] text-gray-500 dark:text-white/40 hover:bg-gray-200 dark:hover:bg-white/[0.1]'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              )}

              <button
                type="button"
                disabled={bloque.patrones.length === 1}
                onClick={() => removePatron(pi)}
                className="shrink-0 text-gray-300 dark:text-white/20 hover:text-red-400 disabled:opacity-0 transition-colors active:scale-[0.97]"
              >
                <X size={10} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Agregar patrón */}
        {bloque.patrones.length < 4 && (
          <button
            type="button"
            onClick={addPatron}
            className="flex items-center gap-1 text-[9px] text-gray-400 dark:text-white/25 hover:text-primary transition-colors active:scale-[0.97]"
          >
            <Plus size={9} /> patrón
          </button>
        )}
      </div>

      {/* Ejercicios (solo modo especializada) */}
      {especializada && (
        <div className="space-y-1 pl-7">
          {bloque.ejercicios.length > 0 && (
            <div className="flex items-center gap-1 px-2 pb-0.5">
              <span className="flex-1 text-[9px] font-bold uppercase tracking-wider text-gray-400 dark:text-white/25">Ejercicio</span>
              <span className="w-9 text-[9px] font-bold uppercase tracking-wider text-gray-400 dark:text-white/25 text-center">Ser</span>
              <span className="w-11 text-[9px] font-bold uppercase tracking-wider text-gray-400 dark:text-white/25 text-center">Rep</span>
              <span className="w-11 text-[9px] font-bold uppercase tracking-wider text-gray-400 dark:text-white/25 text-center">Kg</span>
              <span className="w-9 text-[9px] font-bold uppercase tracking-wider text-gray-400 dark:text-white/25 text-center">RIR</span>
              <span className="w-4" />
            </div>
          )}
          {bloque.ejercicios.map((ej, i) => (
            <EjercicioRow
              key={ej._id}
              ejercicio={ej}
              catalogo={catalogo}
              isOnly={bloque.ejercicios.length === 1}
              onChange={changes => updateEjercicio(i, changes)}
              onDelete={() => onChange({ ejercicios: bloque.ejercicios.filter((_, idx) => idx !== i) })}
            />
          ))}
          <button
            type="button"
            onClick={() => onChange({ ejercicios: [...bloque.ejercicios, crearEjercicioVacio()] })}
            className="w-full flex items-center justify-center gap-1 py-1.5 rounded-lg border border-dashed border-gray-200 dark:border-white/[0.08] text-[10px] text-gray-400 dark:text-white/25 hover:text-primary hover:border-primary/30 transition-colors"
          >
            <Plus size={10} /> Agregar ejercicio
          </button>
        </div>
      )}
    </div>
  )
}

// ─── SesionColumn ─────────────────────────────────────────────────────────────

interface SesionColumnProps {
  sesion: SesionForm
  especializada: boolean
  patrones: PatronMovimientoConfig[]
  catalogo: EjercicioCatalogo[]
  onUpdate: (updated: SesionForm) => void
}

function SesionColumn({ sesion, especializada, patrones, catalogo, onUpdate }: SesionColumnProps) {
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

  function addBloque() {
    const newBloque = crearBloqueVacio()
    onUpdate({ ...sesion, bloques: [...sesion.bloques, newBloque] })
  }

  return (
    <div className={`${glass} flex-1 min-w-[220px] max-w-xs p-4 space-y-3`}>
      <div className="flex items-center gap-2 mb-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/15 text-[10px] font-black text-primary shrink-0">
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
            especializada={especializada}
            patrones={patrones}
            catalogo={catalogo}
            onChange={changes => onUpdate({
              ...sesion,
              bloques: sesion.bloques.map((bl, idx) => idx === i ? { ...bl, ...changes } : bl),
            })}
            onDelete={() => onUpdate({ ...sesion, bloques: sesion.bloques.filter((_, idx) => idx !== i) })}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={addBloque}
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
  const { id }   = useParams<{ id: string }>()
  const navigate = useNavigate()
  const addToast = useUiStore(s => s.addToast)
  const isNew    = !id || id === 'new'

  const [form, setForm]               = useState<FormState>(formVacio())
  const [loadingData, setLoadingData] = useState(!isNew)
  const [saving, setSaving]           = useState(false)
  const [errors, setErrors]           = useState<string[]>([])
  const [patrones, setPatrones]       = useState<PatronMovimientoConfig[]>([])
  const [catalogo, setCatalogo]       = useState<EjercicioCatalogo[]>([])

  useEffect(() => {
    patronesApi.getAll(true).then(setPatrones).catch(() => {})
    ejerciciosApi.getAll({ }).then(setCatalogo).catch(() => {})
  }, [])

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

  function handleToggleEspecializada() {
    setForm(prev => {
      const nuevaEspecializada = !prev.especializada
      if (nuevaEspecializada) {
        // básica → especializada: auto-poblamos ejercicios desde total de patrones
        return {
          ...prev,
          especializada: true,
          sesiones: prev.sesiones.map(s => ({
            ...s,
            bloques: s.bloques.map(b => ({
              ...b,
              ejercicios: b.ejercicios.some(e => e.nombre)
                ? b.ejercicios
                : Array.from({ length: b.patrones.reduce((acc, p) => acc + p.cantidad, 0) || 2 }, crearEjercicioVacio),
            })),
          })),
        }
      } else {
        // especializada → básica: sin cambios en patrones
        return { ...prev, especializada: false }
      }
    })
  }

  function validate(): boolean {
    const errs: string[] = []
    if (!form.nombre.trim()) errs.push('El nombre es requerido')
    if (!form.tipo) errs.push('El tipo es requerido')
    form.sesiones.forEach((s, si) => {
      s.bloques.forEach((b, bi) => {
        if (b.patrones.length === 0) {
          errs.push(`Sesión ${si + 1}, Bloque ${LETRAS[bi]}: debe tener al menos un patrón`)
        } else if (b.patrones.some(p => !p.patronMovimiento)) {
          errs.push(`Sesión ${si + 1}, Bloque ${LETRAS[bi]}: todos los patrones deben estar seleccionados`)
        }
        if (form.especializada && b.ejercicios.length === 0) {
          errs.push(`Sesión ${si + 1}, Bloque ${LETRAS[bi]}: debe tener al menos un ejercicio`)
        }
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
        const created = await plantillasApi.create(payload)
        addToast('Plantilla creada', 'success')
        navigate(`/plantillas/${created.id}`)
      } else {
        await plantillasApi.update(id!, payload)
        addToast('Plantilla actualizada', 'success')
        navigate(`/plantillas/${id}`)
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message
      addToast(Array.isArray(msg) ? msg[0] : (msg ?? 'Error al guardar la plantilla'), 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loadingData) {
    return (
      <div className="flex flex-col gap-6">
        <button
          onClick={() => navigate(isNew ? ROUTES.EXERCISES : `/plantillas/${id}`)}
          className="group flex items-center gap-1.5 text-sm text-gray-500 dark:text-white/40 hover:text-gray-900 dark:hover:text-white transition-colors w-fit"
        >
          <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
          {isNew ? 'Volver a ejercicios' : 'Ver plantilla'}
        </button>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`${glass} p-6 space-y-3`}>
          {[1, 2, 3].map(i => (
            <div key={i} className="h-10 rounded-xl bg-black/[0.05] dark:bg-white/[0.06] animate-pulse" style={{ opacity: 1 - i * 0.2 }} />
          ))}
        </motion.div>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className="flex flex-col gap-6"
    >
      {/* Datalist para autocompletado del catálogo */}
      <datalist id={DATALIST_ID}>
        {catalogo.map(e => (
          <option key={e.id} value={e.nombre} />
        ))}
      </datalist>

      {/* Header */}
      <div className="flex flex-col gap-4">
        <button
          onClick={() => navigate(isNew ? ROUTES.EXERCISES : `/plantillas/${id}`)}
          className="group flex items-center gap-1.5 text-sm text-gray-500 dark:text-white/40 hover:text-gray-900 dark:hover:text-white transition-colors w-fit"
        >
          <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
          {isNew ? 'Volver a ejercicios' : 'Ver plantilla'}
        </button>
        <h1 className="text-2xl lg:text-3xl xl:text-4xl font-black tracking-tighter text-gray-900 dark:text-white drop-shadow-sm">
          {isNew ? 'Nueva plantilla' : 'Editar plantilla'}
        </h1>
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
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-gray-500 dark:text-white/50 uppercase tracking-widest">Datos generales</h3>

          {/* Toggle básica / especializada */}
          <div className="flex items-center gap-1 rounded-xl border border-gray-200 dark:border-white/[0.08] p-0.5">
            <button
              type="button"
              onClick={() => form.especializada && handleToggleEspecializada()}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                !form.especializada
                  ? 'bg-gray-100 dark:bg-white/[0.1] text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-400 dark:text-white/30 hover:text-gray-700 dark:hover:text-white/60'
              }`}
            >
              <BookOpen size={12} />
              Básica
            </button>
            <button
              type="button"
              onClick={() => !form.especializada && handleToggleEspecializada()}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                form.especializada
                  ? 'bg-primary/15 text-primary shadow-sm'
                  : 'text-gray-400 dark:text-white/30 hover:text-gray-700 dark:hover:text-white/60'
              }`}
            >
              <Zap size={12} />
              Especializada
            </button>
          </div>
        </div>

        {/* Descripción del tipo */}
        <AnimatePresence mode="wait">
          {form.especializada ? (
            <motion.div
              key="esp"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/[0.06] px-3 py-2"
            >
              <Zap size={13} className="text-primary shrink-0 mt-0.5" />
              <p className="text-xs text-gray-600 dark:text-white/60">
                <span className="font-semibold text-primary">Especializada:</span> definís los ejercicios exactos con series, repeticiones y peso. Al crear una rutina desde esta plantilla, todos los ejercicios quedan pre-cargados.
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="bas"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="flex items-start gap-2 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-gray-50 dark:bg-white/[0.03] px-3 py-2"
            >
              <BookOpen size={13} className="text-gray-400 shrink-0 mt-0.5" />
              <p className="text-xs text-gray-500 dark:text-white/40">
                <span className="font-semibold">Básica:</span> definís la estructura (patrón de movimiento y cantidad de ejercicios por bloque). El profesor completa los ejercicios al crear la rutina.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

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
              className={inputCls + ' cursor-pointer'}
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
              className={inputCls + ' cursor-pointer'}
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
              especializada={form.especializada}
              patrones={patrones}
              catalogo={catalogo}
              onUpdate={updated => setForm(prev => ({
                ...prev,
                sesiones: prev.sesiones.map((ses, idx) => idx === i ? updated : ses),
              }))}
            />
          ))}
        </div>
        <p className="text-[10px] text-gray-400 dark:text-white/25">
          {form.especializada
            ? 'Arrastrá los bloques para reordenarlos. Podés escribir el nombre del ejercicio o buscarlo en el catálogo.'
            : 'Arrastrá los bloques para reordenarlos. La letra (A, B, C…) se asigna automáticamente por posición.'
          }
        </p>
      </div>

      {/* Acciones */}
      <div className="flex items-center gap-3 pt-2">
        <motion.button
          type="button"
          onClick={handleSave}
          disabled={saving}
          whileTap={!saving ? { scale: 0.96 } : {}}
          className="flex items-center gap-2 rounded-xl btn-action px-4 py-2.5 text-sm disabled:opacity-60"
        >
          {saving
            ? <DotsLoader size="sm" className="flex items-center" />
            : <Check size={14} />
          }
          {isNew ? 'Crear plantilla' : 'Guardar cambios'}
        </motion.button>
        <button
          type="button"
          onClick={() => navigate(isNew ? ROUTES.EXERCISES : `/plantillas/${id}`)}
          className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/[0.08] text-sm text-gray-500 dark:text-[#8A8A9A] hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          Cancelar
        </button>
      </div>
    </motion.div>
  )
}
