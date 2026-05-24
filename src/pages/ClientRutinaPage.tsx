import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  ArrowLeft, Plus, BookOpen, Dumbbell, Trash2,
  Edit2, Check, X, ChevronRight, Flame, Hash,
  Table2, List, Search,
} from 'lucide-react'
import { clientsApi } from '../api/clients.api'
import { rutinasApi } from '../api/rutinas.api'
import { ejerciciosApi } from '../api/ejercicios.api'
import { professorsApi } from '../api/shifts.api'
import { useRutinas } from '../hooks/useRutinas'
import { useAuthStore } from '../store/authStore'
import { useUiStore } from '../store/uiStore'

import type { Client } from '../types/client.types'
import type { Rutina, Ejercicio } from '../types/rutina.types'
import type { EjercicioCatalogo, Dificultad } from '../types/ejercicio-catalogo.types'

// ─── Estilos base — dual mode ─────────────────────────────────────────────────

const glass    = 'rounded-[2rem] border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-3xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)]'
const inputCls = 'w-full rounded-xl border border-white/50 dark:border-white/[0.1] bg-white/60 dark:bg-white/[0.05] px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-[#6B7280] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10 transition-colors'
const labelCls = 'block text-[10px] font-bold text-gray-500 dark:text-saas-muted mb-1 uppercase tracking-wider'
const thCls    = 'py-3 px-4 text-left text-xs font-semibold uppercase tracking-wider text-saas-muted'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type ViewMode = 'table' | 'list'
type AddMode  = 'none' | 'catalog' | 'manual'

const ejercicioSchema = z.object({
  nombre:       z.string().min(1, 'Requerido'),
  series:       z.string().regex(/^\d+$/, 'Debe ser número').refine(v => Number(v) >= 1, 'Mín. 1'),
  repeticiones: z.string().min(1, 'Requerido'),
  peso:         z.string().optional(),
  notas:        z.string().optional(),
})
type EjercicioFormValues = z.infer<typeof ejercicioSchema>

const DIF_LABELS: Record<string, string> = {
  PRINCIPIANTE: 'Principiante',
  INTERMEDIO:   'Intermedio',
  AVANZADO:     'Avanzado',
}

// ─── EjercicioInlineEdit ──────────────────────────────────────────────────────

function EjercicioInlineEdit({
  ejercicio, onSave, onCancel,
}: {
  ejercicio: Ejercicio
  onSave: (data: EjercicioFormValues) => void
  onCancel: () => void
}) {
  const { register, handleSubmit, formState: { errors } } = useForm<EjercicioFormValues>({
    resolver: zodResolver(ejercicioSchema),
    defaultValues: {
      nombre:       ejercicio.nombre,
      series:       String(ejercicio.series),
      repeticiones: ejercicio.repeticiones,
      peso:         ejercicio.peso ?? '',
      notas:        ejercicio.notas ?? '',
    },
  })

  return (
    <form onSubmit={handleSubmit(onSave)} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 sm:col-span-1">
          <label className={labelCls}>Nombre *</label>
          <input {...register('nombre')} className={inputCls} />
          {errors.nombre && <p className="mt-0.5 text-[11px] text-red-500">{errors.nombre.message}</p>}
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className={labelCls}>Peso</label>
          <input {...register('peso')} placeholder="ej. 80kg" className={inputCls} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Series *</label>
          <input {...register('series')} type="number" min="1" className={inputCls} />
          {errors.series && <p className="mt-0.5 text-[11px] text-red-500">{errors.series.message}</p>}
        </div>
        <div>
          <label className={labelCls}>Repeticiones *</label>
          <input {...register('repeticiones')} placeholder="ej. 8-10" className={inputCls} />
          {errors.repeticiones && <p className="mt-0.5 text-[11px] text-red-500">{errors.repeticiones.message}</p>}
        </div>
      </div>
      <div>
        <label className={labelCls}>Observaciones</label>
        <input {...register('notas')} placeholder="ej. Bajar con control en 3 segundos" className={inputCls} />
      </div>
      <div className="flex gap-2 pt-1">
        <button type="submit"
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl btn-action text-xs">
          <Check size={12} /> Guardar
        </button>
        <button type="button" onClick={onCancel}
          className="px-3 py-2 rounded-xl border border-gray-200 dark:border-white/[0.08] text-xs text-gray-500 dark:text-[#8A8A9A] hover:text-gray-900 dark:hover:text-white transition-colors">
          Cancelar
        </button>
      </div>
    </form>
  )
}

// ─── EjercicioListCard ────────────────────────────────────────────────────────

function EjercicioListCard({
  ejercicio, index, isLast, canEdit, isEditMode, isEditing,
  onStartEdit, onSave, onCancelEdit, onDelete,
}: {
  ejercicio: Ejercicio
  index: number
  isLast: boolean
  canEdit: boolean
  isEditMode: boolean
  isEditing: boolean
  onStartEdit: () => void
  onSave: (data: EjercicioFormValues) => void
  onCancelEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="relative flex gap-3 group">
      <div className="flex flex-col items-center shrink-0 pt-1">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-xs font-black text-primary">
          {index + 1}
        </div>
        {!isLast && (
          <div className="mt-1 w-px flex-1 min-h-[16px] bg-gradient-to-b from-primary/25 to-transparent" />
        )}
      </div>

      <motion.div
        layout
        initial={{ opacity: 0, x: -6 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0 }}
        className={`${glass} flex-1 p-4 mb-3 last:mb-0`}
      >
        {isEditing ? (
          <EjercicioInlineEdit ejercicio={ejercicio} onSave={onSave} onCancel={onCancelEdit} />
        ) : (
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0 space-y-1.5">
              <p className="text-sm font-bold text-gray-900 dark:text-white">{ejercicio.nombre}</p>
              <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-[#8A8A9A]">
                <span className="flex items-center gap-1">
                  <Flame size={10} className="text-primary/70" />
                  {ejercicio.series} series × {ejercicio.repeticiones}
                </span>
                {ejercicio.peso && (
                  <span className="flex items-center gap-1">
                    <Hash size={10} className="text-primary/70" />
                    {ejercicio.peso}
                  </span>
                )}
              </div>
              {ejercicio.notas && (
                <p className="text-xs text-gray-400 dark:text-[#6B7280] italic leading-snug">{ejercicio.notas}</p>
              )}
            </div>
            {canEdit && isEditMode && (
              <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={onStartEdit}
                  className="p-1.5 rounded-lg text-gray-400 dark:text-[#6B7280] hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors">
                  <Edit2 size={12} />
                </button>
                <button onClick={onDelete}
                  className="p-1.5 rounded-lg text-gray-400 dark:text-[#6B7280] hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">
                  <Trash2 size={12} />
                </button>
              </div>
            )}
          </div>
        )}
      </motion.div>
    </div>
  )
}

// ─── CatalogoPicker ───────────────────────────────────────────────────────────

function CatalogoPicker({
  onSelect,
  onCancel,
}: {
  onSelect: (ej: EjercicioCatalogo) => void
  onCancel: () => void
}) {
  const [search, setSearch]         = useState('')
  const [dificultad, setDificultad] = useState<string>('todos')
  const [items, setItems]           = useState<EjercicioCatalogo[]>([])
  const [loading, setLoading]       = useState(true)

  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true)
      ejerciciosApi.getAll({
        nombre:     search || undefined,
        dificultad: dificultad !== 'todos' ? dificultad as Dificultad : undefined,
      })
        .then(data => { setItems(data); setLoading(false) })
        .catch(() => setLoading(false))
    }, 300)
    return () => clearTimeout(t)
  }, [search, dificultad])

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      className={`${glass} p-4`}
    >
      <div className="flex items-center justify-between mb-3">
        <p className={labelCls}>Buscar en catálogo</p>
        <button
          onClick={onCancel}
          className="p-1 rounded-lg text-gray-400 dark:text-[#8A8A9A] hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      <div className="relative mb-2">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar ejercicio..."
          className={inputCls.replace('px-3', 'pl-8 pr-3')}
          autoFocus
        />
      </div>

      <div className="flex gap-1 mb-3 flex-wrap">
        {(['todos', 'PRINCIPIANTE', 'INTERMEDIO', 'AVANZADO'] as const).map(d => (
          <button
            key={d}
            onClick={() => setDificultad(d)}
            className={`text-[11px] px-2.5 py-1 rounded-lg font-semibold border transition-colors ${
              dificultad === d
                ? 'bg-primary/15 text-primary border-primary/30'
                : 'border-gray-200 dark:border-white/[0.08] text-gray-500 dark:text-[#8A8A9A] hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-white/[0.06]'
            }`}
          >
            {d === 'todos' ? 'Todos' : DIF_LABELS[d]}
          </button>
        ))}
      </div>

      <div className="max-h-[220px] overflow-y-auto space-y-0.5 -mx-1 px-1">
        {loading ? (
          <p className="text-xs text-gray-400 dark:text-[#6B7280] py-6 text-center">Buscando...</p>
        ) : items.length === 0 ? (
          <p className="text-xs text-gray-400 dark:text-[#6B7280] py-6 text-center">
            {search ? 'Sin resultados' : 'El catálogo está vacío'}
          </p>
        ) : items.map(ej => (
          <button
            key={ej.id}
            onClick={() => onSelect(ej)}
            className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-primary/5 border border-transparent hover:border-primary/10 transition-all group"
          >
            <p className="text-sm font-semibold text-gray-900 dark:text-white group-hover:text-primary transition-colors leading-tight">
              {ej.nombre}
            </p>
            <p className="text-[11px] text-gray-400 dark:text-[#6B7280] mt-0.5">
              {ej.gruposMusculares.length > 0 ? ej.gruposMusculares.join(', ') + ' · ' : ''}
              {DIF_LABELS[ej.dificultad] ?? ej.dificultad}
            </p>
          </button>
        ))}
      </div>
    </motion.div>
  )
}

// ─── NuevoEjercicioForm ───────────────────────────────────────────────────────

function NuevoEjercicioForm({
  rutinaId, onSaved, onCancel, prefill,
}: {
  rutinaId: string
  onSaved: () => void
  onCancel: () => void
  prefill?: { nombre: string; catalogoId?: string }
}) {
  const addToast = useUiStore(s => s.addToast)
  const { register, handleSubmit, formState: { errors }, reset } = useForm<EjercicioFormValues>({
    resolver: zodResolver(ejercicioSchema),
    defaultValues: {
      nombre:       prefill?.nombre ?? '',
      series:       '3',
      repeticiones: '10',
      peso:         '',
      notas:        '',
    },
  })
  const [saving, setSaving] = useState(false)

  async function onSubmit(data: EjercicioFormValues) {
    setSaving(true)
    try {
      await rutinasApi.addEjercicio(rutinaId, {
        nombre:       data.nombre.trim(),
        series:       Number(data.series),
        repeticiones: data.repeticiones.trim(),
        peso:         data.peso?.trim() || undefined,
        notas:        data.notas?.trim() || undefined,
        catalogoId:   prefill?.catalogoId,
      })
      reset(); onSaved()
    } catch {
      addToast('Error al agregar ejercicio', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      className={`${glass} p-5`}
    >
      <div className="flex items-center justify-between mb-4">
        <p className={labelCls}>Nuevo ejercicio</p>
        {prefill?.catalogoId && (
          <span className="flex items-center gap-1 text-[10px] text-primary font-semibold">
            <BookOpen size={10} /> Del catálogo
          </span>
        )}
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 sm:col-span-1">
            <label className={labelCls}>Nombre *</label>
            <input {...register('nombre')} placeholder="ej. Press de banca" className={inputCls} />
            {errors.nombre && <p className="mt-0.5 text-[11px] text-red-500">{errors.nombre.message}</p>}
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className={labelCls}>Peso</label>
            <input {...register('peso')} placeholder="ej. 60kg" className={inputCls} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Series *</label>
            <input {...register('series')} type="number" min="1" className={inputCls} />
            {errors.series && <p className="mt-0.5 text-[11px] text-red-500">{errors.series.message}</p>}
          </div>
          <div>
            <label className={labelCls}>Repeticiones *</label>
            <input {...register('repeticiones')} placeholder="ej. 8-10" className={inputCls} />
            {errors.repeticiones && <p className="mt-0.5 text-[11px] text-red-500">{errors.repeticiones.message}</p>}
          </div>
        </div>
        <div>
          <label className={labelCls}>Observaciones</label>
          <input {...register('notas')} placeholder="ej. Bajar con control en 3 segundos" className={inputCls} />
        </div>
        <div className="flex gap-2 pt-1">
          <button type="submit" disabled={saving}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl btn-action text-sm disabled:opacity-50">
            {saving
              ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-gray-900/30 border-t-gray-900" />
              : <Check size={14} />}
            Agregar
          </button>
          <button type="button" onClick={onCancel}
            className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/[0.08] text-sm text-gray-500 dark:text-[#8A8A9A] hover:text-gray-900 dark:hover:text-white transition-colors">
            Cancelar
          </button>
        </div>
      </form>
    </motion.div>
  )
}

// ─── NuevaRutinaForm ──────────────────────────────────────────────────────────

function NuevaRutinaForm({
  clienteId, isAdmin, professors, onSaved, onCancel,
}: {
  clienteId: string
  isAdmin: boolean
  professors: { id: string; name: string }[]
  onSaved: (rutinaId: string) => void
  onCancel: () => void
}) {
  const addToast = useUiStore(s => s.addToast)
  const [nombre, setNombre] = useState('')
  const [desc, setDesc]     = useState('')
  const [profId, setProfId] = useState(professors[0]?.id ?? '')
  const [saving, setSaving] = useState(false)

  // Sincroniza profId cuando los profesores cargan después del mount
  useEffect(() => {
    if (professors.length > 0 && !profId) setProfId(professors[0].id)
  }, [professors])

  async function submit() {
    if (!nombre.trim()) return
    if (isAdmin && !profId) { addToast('Seleccioná un profesor', 'error'); return }
    setSaving(true)
    try {
      const r = await rutinasApi.create({
        clienteId,
        profesorId: isAdmin ? profId : 'auto',
        nombre: nombre.trim(),
        descripcion: desc.trim() || undefined,
      })
      onSaved(r.id)
    } catch {
      addToast('Error al crear la rutina', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 16 }}
      className={`${glass} p-5`}
    >
      <div className="flex items-center justify-between mb-4">
        <p className={labelCls}>Nueva rutina</p>
        <button onClick={onCancel} className="p-1 rounded-lg text-gray-400 dark:text-[#8A8A9A] hover:text-gray-900 dark:hover:text-white transition-colors">
          <X size={15} />
        </button>
      </div>
      <div className="space-y-3">
        <div>
          <label className={labelCls}>Nombre *</label>
          <input className={inputCls} placeholder="ej. Fuerza — Semana 1"
            value={nombre} onChange={e => setNombre(e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Descripción (opcional)</label>
          <input className={inputCls} placeholder="ej. Enfocada en tren superior"
            value={desc} onChange={e => setDesc(e.target.value)} />
        </div>
        {isAdmin && professors.length > 0 && (
          <div>
            <label className={labelCls}>Profesor *</label>
            <select className={inputCls} value={profId} onChange={e => setProfId(e.target.value)}>
              <option value="">Seleccioná un profesor</option>
              {professors.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        )}
        <div className="flex gap-2 pt-1">
          <button onClick={submit} disabled={saving || !nombre.trim() || (isAdmin && !profId)}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl btn-action text-sm disabled:opacity-50">
            {saving
              ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-gray-900/30 border-t-gray-900" />
              : <Plus size={14} />}
            Crear
          </button>
          <button onClick={onCancel}
            className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/[0.08] text-sm text-gray-500 dark:text-[#8A8A9A] hover:text-gray-900 dark:hover:text-white transition-colors">
            Cancelar
          </button>
        </div>
      </div>
    </motion.div>
  )
}

// ─── TablaEjercicios ──────────────────────────────────────────────────────────

function TablaEjercicios({
  ejercicios, canEdit, isEditMode, editingId,
  onStartEdit, onSave, onCancelEdit, onDelete,
}: {
  ejercicios: Ejercicio[]
  canEdit: boolean
  isEditMode: boolean
  editingId: string | null
  onStartEdit: (id: string) => void
  onSave: (id: string, data: EjercicioFormValues) => void
  onCancelEdit: () => void
  onDelete: (id: string) => void
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-white/50 dark:border-white/10 bg-white/20 dark:bg-black/20">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/20 dark:border-white/10 bg-gray-50/30 dark:bg-black/10">
            <th className={`${thCls} w-10`}>#</th>
            <th className={thCls}>Ejercicio</th>
            <th className={`${thCls} text-center`}>Series</th>
            <th className={`${thCls} text-center`}>Repeticiones</th>
            <th className={`${thCls} text-center`}>Peso</th>
            <th className={thCls}>Notas</th>
            {canEdit && isEditMode && <th className="w-20" />}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/20 dark:divide-white/10">
          {ejercicios.map((ej, i) =>
            editingId === ej.id ? (
              <tr key={ej.id + '-edit'}>
                <td colSpan={canEdit && isEditMode ? 7 : 6} className="px-4 py-3">
                  <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                    <EjercicioInlineEdit
                      ejercicio={ej}
                      onSave={data => onSave(ej.id, data)}
                      onCancel={onCancelEdit}
                    />
                  </motion.div>
                </td>
              </tr>
            ) : (
              <motion.tr
                key={ej.id}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="group hover:bg-gray-50/80 dark:hover:bg-white/[0.04] transition-colors"
              >
                <td className="py-3.5 px-4">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-xs font-black text-primary">
                    {i + 1}
                  </span>
                </td>
                <td className="py-3.5 px-4 font-semibold text-gray-900 dark:text-white">{ej.nombre}</td>
                <td className="py-3.5 px-4 text-center text-gray-500 dark:text-[#8A8A9A] tabular-nums font-medium">{ej.series}</td>
                <td className="py-3.5 px-4 text-center text-gray-500 dark:text-[#8A8A9A] tabular-nums">{ej.repeticiones}</td>
                <td className="py-3.5 px-4 text-center text-gray-500 dark:text-[#8A8A9A]">
                  {ej.peso ?? <span className="text-gray-300 dark:text-[#4B4B5A]">—</span>}
                </td>
                <td className="py-3.5 px-4 text-gray-400 dark:text-[#6B7280] text-xs italic max-w-[200px]">
                  {ej.notas ?? <span className="text-gray-300 dark:text-[#4B4B5A] not-italic">—</span>}
                </td>
                {canEdit && isEditMode && (
                  <td className="py-3.5 px-4">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => onStartEdit(ej.id)}
                        className="p-1.5 rounded-lg text-gray-400 dark:text-[#6B7280] hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors"
                      >
                        <Edit2 size={12} />
                      </button>
                      <button
                        onClick={() => onDelete(ej.id)}
                        className="p-1.5 rounded-lg text-gray-400 dark:text-[#6B7280] hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                )}
              </motion.tr>
            )
          )}
        </tbody>
      </table>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function ClientRutinaPage() {
  const { id }   = useParams<{ id: string }>()
  const navigate = useNavigate()
  const user     = useAuthStore(s => s.user)
  const addToast = useUiStore(s => s.addToast)
  const isAdmin  = user?.role === 'admin'
  const canEdit  = isAdmin || user?.role === 'profesor'

  const [client, setClient]                         = useState<Client | null>(null)
  const [loadingClient, setLoadingClient]           = useState(true)
  const [professors, setProfessors]                 = useState<{ id: string; name: string }[]>([])
  const [selectedRutinaId, setSelectedRutinaId]     = useState<string | null>(null)
  const [showNewRutinaForm, setShowNewRutinaForm]   = useState(false)
  const [addMode, setAddMode]                       = useState<AddMode>('none')
  const [catalogPrefill, setCatalogPrefill]         = useState<{ nombre: string; catalogoId: string } | null>(null)
  const [editingRutinaName, setEditingRutinaName]   = useState(false)
  const [editNombre, setEditNombre]                 = useState('')
  const [editingEjercicioId, setEditingEjercicioId] = useState<string | null>(null)
  const [viewMode, setViewMode]                     = useState<ViewMode>('table')
  const [isRutinaEditMode, setIsRutinaEditMode]     = useState(false)

  const { rutinas, isLoading: loadingRutinas, refetch } = useRutinas(id)

  useEffect(() => {
    if (!id) return
    setLoadingClient(true)
    clientsApi.getById(id)
      .then(setClient)
      .catch(() => addToast('Error al cargar el cliente', 'error'))
      .finally(() => setLoadingClient(false))
    if (isAdmin) professorsApi.getAll().then(setProfessors).catch(() => {})
  }, [id, isAdmin])

  useEffect(() => {
    if (!selectedRutinaId && rutinas.length > 0) setSelectedRutinaId(rutinas[0].id)
  }, [rutinas])

  const selectedRutina = rutinas.find(r => r.id === selectedRutinaId) ?? null
  const clientName     = client ? `${client.name} ${client.lastName}` : '...'
  const backPath       = id ? `/clients/${id}` : '/clients'

  async function handleDeleteRutina(rutinaId: string) {
    try {
      await rutinasApi.remove(rutinaId)
      if (selectedRutinaId === rutinaId)
        setSelectedRutinaId(rutinas.find(r => r.id !== rutinaId)?.id ?? null)
      refetch(); addToast('Rutina eliminada', 'success')
    } catch { addToast('Error al eliminar la rutina', 'error') }
  }

  async function handleDeleteEjercicio(ejercicioId: string) {
    if (!selectedRutina) return
    try {
      await rutinasApi.removeEjercicio(selectedRutina.id, ejercicioId)
      refetch(); addToast('Ejercicio eliminado', 'success')
    } catch { addToast('Error al eliminar el ejercicio', 'error') }
  }

  async function handleUpdateEjercicio(ejercicioId: string, data: EjercicioFormValues) {
    if (!selectedRutina) return
    try {
      await rutinasApi.updateEjercicio(selectedRutina.id, ejercicioId, {
        nombre:       data.nombre.trim(),
        series:       Number(data.series),
        repeticiones: data.repeticiones.trim(),
        peso:         data.peso?.trim() || undefined,
        notas:        data.notas?.trim() || undefined,
      })
      refetch(); setEditingEjercicioId(null)
      addToast('Ejercicio actualizado', 'success')
    } catch { addToast('Error al actualizar el ejercicio', 'error') }
  }

  async function handleSaveRutinaName(rutinaId: string) {
    if (!editNombre.trim()) return
    try {
      await rutinasApi.update(rutinaId, { nombre: editNombre.trim() })
      refetch(); setEditingRutinaName(false)
      addToast('Nombre actualizado', 'success')
    } catch { addToast('Error al actualizar', 'error') }
  }

  async function handleToggleActiva(rutina: Rutina) {
    try {
      await rutinasApi.update(rutina.id, { activa: !rutina.activa })
      refetch()
    } catch { addToast('Error al actualizar la rutina', 'error') }
  }

  function selectRutina(rutinaId: string) {
    setSelectedRutinaId(rutinaId)
    setAddMode('none'); setCatalogPrefill(null)
    setEditingRutinaName(false)
    setEditingEjercicioId(null)
    setIsRutinaEditMode(false)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className="flex flex-col gap-5"
    >
      {/* ── Breadcrumb ── */}
      <button
        onClick={() => navigate(backPath)}
        className="group self-start flex items-center gap-2 text-sm text-gray-500 dark:text-[#8A8A9A] hover:text-gray-900 dark:hover:text-white transition-colors"
      >
        <ArrowLeft size={15} className="group-hover:-translate-x-0.5 transition-transform" />
        <span className="font-medium">{loadingClient ? '...' : clientName}</span>
      </button>

      {/* ── Título ── */}
      <div>
        <h1 className="text-3xl md:text-4xl font-black tracking-tighter text-gray-900 dark:text-white drop-shadow-sm flex items-center gap-3">
          <BookOpen size={26} className="text-primary" />
          Rutinas
        </h1>
        {!loadingClient && client && (
          <p className="text-sm text-saas-muted mt-1">
            {clientName} · {rutinas.length} rutina{rutinas.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* ── Body ── */}
      {loadingRutinas ? (
        <div className="grid gap-4 lg:grid-cols-[280px_1fr] items-start">
          <div className={`${glass} p-3 space-y-2`}>
            {[1, 2, 3].map(i => (
              <div key={i} className="h-14 rounded-xl animate-pulse bg-black/[0.05] dark:bg-white/[0.06]" style={{ opacity: 1 - i * 0.2 }} />
            ))}
          </div>
          <div className={`${glass} p-6 space-y-4`}>
            <div className="h-7 w-44 rounded-xl animate-pulse bg-black/[0.05] dark:bg-white/[0.06]" />
            <div className="h-4 w-28 rounded-xl animate-pulse bg-black/[0.04] dark:bg-white/[0.04]" />
            <div className="space-y-3 pt-2">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-11 rounded-xl animate-pulse bg-black/[0.04] dark:bg-white/[0.05]" style={{ opacity: 1 - i * 0.15 }} />
              ))}
            </div>
          </div>
        </div>
      ) : rutinas.length === 0 ? (
        <AnimatePresence mode="wait">
          {showNewRutinaForm ? (
            <NuevaRutinaForm
              key="form"
              clienteId={id!}
              isAdmin={isAdmin}
              professors={professors}
              onSaved={newId => { refetch(); setSelectedRutinaId(newId); setShowNewRutinaForm(false) }}
              onCancel={() => setShowNewRutinaForm(false)}
            />
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className={`${glass} flex flex-col items-center justify-center gap-4 py-24`}
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                <BookOpen size={28} className="text-primary" />
              </div>
              <div className="text-center">
                <p className="text-base font-bold text-gray-900 dark:text-white">Sin rutinas todavía</p>
                <p className="text-sm text-saas-muted mt-1">Creá la primera rutina para este cliente</p>
              </div>
              {canEdit && (
                <button onClick={() => setShowNewRutinaForm(true)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl btn-action text-sm mt-2">
                  <Plus size={14} /> Nueva rutina
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      ) : rutinas.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-[280px_1fr] items-start">

          {/* ── Sidebar ── */}
          <div className={`${glass} p-4 space-y-2`}>
            {rutinas.map(rutina => (
              <motion.div
                key={rutina.id}
                layout
                onClick={() => selectRutina(rutina.id)}
                className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl border cursor-pointer transition-all ${
                  selectedRutinaId === rutina.id
                    ? 'border-primary/40 bg-primary/5'
                    : 'border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 hover:bg-white/50 dark:hover:bg-black/50'
                }`}
              >
                <div className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 ${
                  selectedRutinaId === rutina.id ? 'bg-primary/20' : 'bg-black/[0.04] dark:bg-white/[0.06]'
                }`}>
                  <BookOpen size={14} className={selectedRutinaId === rutina.id ? 'text-primary' : 'text-gray-400 dark:text-[#8A8A9A]'} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-bold truncate ${
                    selectedRutinaId === rutina.id
                      ? 'text-gray-900 dark:text-white'
                      : 'text-gray-700 dark:text-gray-300'
                  }`}>
                    {rutina.nombre}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-[#6B7280]">{rutina.ejercicios.length} ejerc.</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={`h-1.5 w-1.5 rounded-full ${rutina.activa ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
                  {canEdit && (
                    <button
                      onClick={e => { e.stopPropagation(); handleDeleteRutina(rutina.id) }}
                      className="p-1 rounded-lg text-gray-400 dark:text-[#6B7280] hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                  <ChevronRight size={13} className={selectedRutinaId === rutina.id ? 'text-primary' : 'text-gray-300 dark:text-[#4B4B5A]'} />
                </div>
              </motion.div>
            ))}

            {canEdit && !showNewRutinaForm && (
              <motion.button
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onClick={() => { setShowNewRutinaForm(true); setAddMode('none') }}
                className="mt-1 w-full flex items-center justify-center gap-1.5 px-4 py-3 rounded-2xl border border-dashed border-gray-300 dark:border-white/[0.08] text-sm text-gray-400 dark:text-[#6B7280] hover:text-gray-600 dark:hover:text-[#8A8A9A] hover:border-gray-400 dark:hover:border-white/[0.15] transition-all opacity-70 hover:opacity-100"
              >
                <Plus size={13} /> Nueva rutina
              </motion.button>
            )}
          </div>

          {/* ── Panel principal ── */}
          {showNewRutinaForm ? (
            <NuevaRutinaForm
              clienteId={id!}
              isAdmin={isAdmin}
              professors={professors}
              onSaved={newId => { refetch(); setSelectedRutinaId(newId); setShowNewRutinaForm(false) }}
              onCancel={() => setShowNewRutinaForm(false)}
            />
          ) : selectedRutina ? (
            <div className={`${glass} p-6 space-y-6`}>

              {/* Header rutina */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  {editingRutinaName ? (
                    <div className="flex items-center gap-2">
                      <input
                        autoFocus
                        className="flex-1 rounded-xl border border-primary/40 bg-gray-50 dark:bg-white/[0.05] px-3 py-1.5 text-lg font-black text-gray-900 dark:text-white focus:outline-none"
                        value={editNombre}
                        onChange={e => setEditNombre(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleSaveRutinaName(selectedRutina.id) }}
                      />
                      <button onClick={() => handleSaveRutinaName(selectedRutina.id)}
                        className="p-2 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                        <Check size={15} />
                      </button>
                      <button onClick={() => setEditingRutinaName(false)}
                        className="p-2 rounded-xl text-gray-400 dark:text-[#8A8A9A] hover:text-gray-900 dark:hover:text-white transition-colors">
                        <X size={15} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 group/title">
                      <h2 className="text-xl font-black text-gray-900 dark:text-white leading-tight">{selectedRutina.nombre}</h2>
                      {canEdit && isRutinaEditMode && (
                        <button
                          onClick={() => { setEditingRutinaName(true); setEditNombre(selectedRutina.nombre) }}
                          className="p-1.5 rounded-lg text-gray-400 dark:text-[#6B7280] hover:text-gray-900 dark:hover:text-white opacity-0 group-hover/title:opacity-100 transition-all"
                        >
                          <Edit2 size={12} />
                        </button>
                      )}
                    </div>
                  )}
                  {selectedRutina.descripcion && (
                    <p className="text-sm text-saas-muted mt-1">{selectedRutina.descripcion}</p>
                  )}
                  {selectedRutina.profesor && (
                    <p className="text-xs text-gray-400 dark:text-[#6B7280] mt-1.5">
                      Profesor: {selectedRutina.profesor.usuario.nombre}
                    </p>
                  )}
                </div>
                {canEdit && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleToggleActiva(selectedRutina)}
                      className={`text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all ${
                        selectedRutina.activa
                          ? 'border-green-500/30 bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-500/20'
                          : 'border-gray-200 dark:border-white/[0.08] bg-gray-50 dark:bg-white/[0.04] text-gray-500 dark:text-[#8A8A9A] hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      {selectedRutina.activa ? 'Activa' : 'Inactiva'}
                    </button>
                    <button
                      onClick={() => {
                        setIsRutinaEditMode(prev => {
                          if (prev) {
                            setAddMode('none'); setCatalogPrefill(null)
                            setEditingEjercicioId(null); setEditingRutinaName(false)
                          }
                          return !prev
                        })
                      }}
                      className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all ${
                        isRutinaEditMode
                          ? 'border-primary/40 bg-primary/10 text-primary hover:bg-primary/20'
                          : 'border-gray-200 dark:border-white/[0.08] bg-gray-50 dark:bg-white/[0.04] text-gray-500 dark:text-[#8A8A9A] hover:text-gray-900 dark:hover:text-white hover:border-gray-300 dark:hover:border-white/[0.16]'
                      }`}
                    >
                      {isRutinaEditMode ? <><Check size={12} /> Listo</> : <><Edit2 size={12} /> Editar</>}
                    </button>
                  </div>
                )}
              </div>

              {/* Contador + toggle vista */}
              {selectedRutina.ejercicios.length > 0 && (
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-[#8A8A9A]">
                    {selectedRutina.ejercicios.length} ejercicio{selectedRutina.ejercicios.length !== 1 ? 's' : ''}
                  </p>
                  <div className="flex items-center gap-0.5 p-1 rounded-xl bg-gray-100/80 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.06]">
                    <button
                      onClick={() => { setViewMode('table'); setEditingEjercicioId(null) }}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        viewMode === 'table' ? 'bg-primary/20 text-primary' : 'text-gray-500 dark:text-[#8A8A9A] hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      <Table2 size={13} /> Tabla
                    </button>
                    <button
                      onClick={() => { setViewMode('list'); setEditingEjercicioId(null) }}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        viewMode === 'list' ? 'bg-primary/20 text-primary' : 'text-gray-500 dark:text-[#8A8A9A] hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      <List size={13} /> Lista
                    </button>
                  </div>
                </div>
              )}

              {/* Ejercicios */}
              {selectedRutina.ejercicios.length > 0 ? (
                <AnimatePresence mode="wait">
                  <motion.div
                    key={viewMode}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.14 }}
                  >
                    {viewMode === 'table' ? (
                      <TablaEjercicios
                        ejercicios={selectedRutina.ejercicios}
                        canEdit={canEdit}
                        isEditMode={isRutinaEditMode}
                        editingId={editingEjercicioId}
                        onStartEdit={ejId => { setEditingEjercicioId(ejId); setAddMode('none') }}
                        onSave={(ejId, data) => handleUpdateEjercicio(ejId, data)}
                        onCancelEdit={() => setEditingEjercicioId(null)}
                        onDelete={ejId => handleDeleteEjercicio(ejId)}
                      />
                    ) : (
                      <div className="flex flex-col">
                        {selectedRutina.ejercicios.map((ej, i) => (
                          <EjercicioListCard
                            key={ej.id}
                            ejercicio={ej}
                            index={i}
                            isLast={i === selectedRutina.ejercicios.length - 1}
                            canEdit={canEdit}
                            isEditMode={isRutinaEditMode}
                            isEditing={editingEjercicioId === ej.id}
                            onStartEdit={() => { setEditingEjercicioId(ej.id); setAddMode('none') }}
                            onSave={data => handleUpdateEjercicio(ej.id, data)}
                            onCancelEdit={() => setEditingEjercicioId(null)}
                            onDelete={() => handleDeleteEjercicio(ej.id)}
                          />
                        ))}
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              ) : (
                <div className="flex flex-col items-center gap-3 py-12 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.06]">
                    <Dumbbell size={20} className="text-gray-400 dark:text-[#8A8A9A]" />
                  </div>
                  <p className="text-sm text-saas-muted">Sin ejercicios en esta rutina</p>
                </div>
              )}

              {/* ── Agregar ejercicio ── */}
              <AnimatePresence mode="wait">
                {canEdit && isRutinaEditMode && (
                  addMode === 'catalog' ? (
                    <CatalogoPicker
                      key="catalog"
                      onSelect={ej => {
                        setCatalogPrefill({ nombre: ej.nombre, catalogoId: ej.id })
                        setAddMode('manual')
                      }}
                      onCancel={() => setAddMode('none')}
                    />
                  ) : addMode === 'manual' ? (
                    <NuevoEjercicioForm
                      key="new-ej"
                      rutinaId={selectedRutina.id}
                      prefill={catalogPrefill ?? undefined}
                      onSaved={() => { refetch(); setAddMode('none'); setCatalogPrefill(null) }}
                      onCancel={() => { setAddMode('none'); setCatalogPrefill(null) }}
                    />
                  ) : (
                    <motion.div
                      key="add-options"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="grid grid-cols-2 gap-2"
                    >
                      <button
                        onClick={() => { setAddMode('catalog'); setEditingEjercicioId(null) }}
                        className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-gray-300 dark:border-white/[0.1] py-4 text-sm text-gray-400 dark:text-[#8A8A9A] hover:text-primary hover:border-primary/40 transition-all"
                      >
                        <BookOpen size={15} /> Desde catálogo
                      </button>
                      <button
                        onClick={() => { setAddMode('manual'); setEditingEjercicioId(null) }}
                        className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-gray-300 dark:border-white/[0.1] py-4 text-sm text-gray-400 dark:text-[#8A8A9A] hover:text-gray-700 dark:hover:text-white hover:border-gray-400 dark:hover:border-white/[0.2] transition-all"
                      >
                        <Plus size={15} /> Manual
                      </button>
                    </motion.div>
                  )
                )}
              </AnimatePresence>
            </div>
          ) : null}
        </div>
      ) : null}
    </motion.div>
  )
}
