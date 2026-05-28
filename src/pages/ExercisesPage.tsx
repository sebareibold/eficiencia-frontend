import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Dumbbell, Plus, Edit2, Trash2, Check, X, ExternalLink, Search,
} from 'lucide-react'
import { ejerciciosApi } from '../api/ejercicios.api'
import { useAuthStore } from '../store/authStore'
import { useUiStore } from '../store/uiStore'
import type { EjercicioCatalogo, Dificultad } from '../types/ejercicio-catalogo.types'

// ─── Estilos base (mismo patrón que ClientRutinaPage) ────────────────────────

const glass    = 'rounded-[2rem] border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-3xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)]'
const inputCls = 'w-full rounded-xl border border-white/50 dark:border-white/[0.1] bg-white/60 dark:bg-white/[0.05] px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-[#6B7280] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10 transition-colors'
const labelCls = 'block text-[10px] font-bold text-gray-500 dark:text-[#8A8A9A] mb-1 uppercase tracking-wider'
const thCls    = 'py-3 px-4 text-left text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-[#6B7280]'

const DIFICULTAD_CONFIG = {
  FACIL:      { label: 'Fácil',      cls: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' },
  INTERMEDIO: { label: 'Intermedio', cls: 'bg-amber-500/10 text-amber-400 border border-amber-500/20' },
  AVANZADO:   { label: 'Avanzado',   cls: 'bg-red-500/10 text-red-400 border border-red-500/20' },
} as const

const ejercicioSchema = z.object({
  nombre:          z.string().min(1, 'Requerido'),
  descripcion:     z.string().optional(),
  videoUrl:        z.string().optional(),
  patronMovimiento: z.string().optional(),
  dificultad:      z.enum(['FACIL', 'INTERMEDIO', 'AVANZADO']),
})
type FormValues = z.infer<typeof ejercicioSchema>

// ─── EjercicioForm ────────────────────────────────────────────────────────────

function EjercicioForm({
  defaultValues,
  onSubmit,
  onCancel,
  isEditing = false,
  isSaving = false,
}: {
  defaultValues?: Partial<FormValues>
  onSubmit: (data: FormValues) => void
  onCancel: () => void
  isEditing?: boolean
  isSaving?: boolean
}) {
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(ejercicioSchema),
    defaultValues: { dificultad: 'INTERMEDIO', ...defaultValues },
  })

  return (
    <form onSubmit={handleSubmit(d => onSubmit(d))} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 sm:col-span-1">
          <label className={labelCls}>Nombre *</label>
          <input {...register('nombre')} placeholder="ej. Press de banca" className={inputCls} />
          {errors.nombre && <p className="mt-0.5 text-[11px] text-red-400">{errors.nombre.message}</p>}
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className={labelCls}>Dificultad</label>
          <select {...register('dificultad')} className={inputCls + ' cursor-pointer'}>
            <option value="FACIL">Fácil</option>
            <option value="INTERMEDIO">Intermedio</option>
            <option value="AVANZADO">Avanzado</option>
          </select>
        </div>
      </div>
      <div>
        <label className={labelCls}>Descripción</label>
        <input
          {...register('descripcion')}
          placeholder="ej. Ejercicio compuesto para pecho, hombros y tríceps"
          className={inputCls}
        />
      </div>
      <div>
        <label className={labelCls}>URL del video (YouTube, etc.)</label>
        <input
          {...register('videoUrl')}
          placeholder="https://youtube.com/watch?v=..."
          className={inputCls}
        />
      </div>
      <div>
        <label className={labelCls}>Patrón de movimiento</label>
        <input
          {...register('patronMovimiento')}
          placeholder="ej. Empuje horizontal"
          className={inputCls}
        />
      </div>
      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={isSaving}
          className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl btn-action text-sm disabled:opacity-50"
        >
          {isSaving
            ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-gray-900/30 border-t-gray-900" />
            : <Check size={14} />}
          {isEditing ? 'Actualizar' : 'Guardar'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2.5 rounded-xl border border-white/[0.08] text-sm text-[#8A8A9A] hover:text-white transition-colors"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function ExercisesPage() {
  const user     = useAuthStore(s => s.user)
  const addToast = useUiStore(s => s.addToast)
  const isAdmin  = user?.role === 'admin'

  const [items, setItems]         = useState<EjercicioCatalogo[]>([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [filterDif, setFilterDif] = useState<string>('todos')
  const [showForm, setShowForm]   = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [savingId, setSavingId]   = useState<string | null>(null)

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const data = await ejerciciosApi.getAll({
        nombre: search || undefined,
        dificultad: filterDif !== 'todos' ? filterDif as Dificultad : undefined,
      })
      setItems(data)
    } catch {
      addToast('Error al cargar ejercicios', 'error')
    } finally {
      setLoading(false)
    }
  }, [search, filterDif, addToast])

  useEffect(() => {
    const t = setTimeout(fetchItems, 300)
    return () => clearTimeout(t)
  }, [fetchItems])

  async function handleCreate(data: FormValues) {
    setSavingId('new')
    try {
      await ejerciciosApi.create({
        ...data,
        descripcion: data.descripcion || undefined,
        videoUrl: data.videoUrl || undefined,
        patronMovimiento: data.patronMovimiento || undefined,
      })
      setShowForm(false)
      fetchItems()
      addToast('Ejercicio creado', 'success')
    } catch {
      addToast('Error al crear el ejercicio', 'error')
    } finally {
      setSavingId(null)
    }
  }

  async function handleUpdate(id: string, data: FormValues) {
    setSavingId(id)
    try {
      await ejerciciosApi.update(id, {
        ...data,
        descripcion: data.descripcion || undefined,
        videoUrl: data.videoUrl || undefined,
        patronMovimiento: data.patronMovimiento || undefined,
      })
      setEditingId(null)
      fetchItems()
      addToast('Ejercicio actualizado', 'success')
    } catch {
      addToast('Error al actualizar el ejercicio', 'error')
    } finally {
      setSavingId(null)
    }
  }

  async function handleDelete(id: string) {
    try {
      await ejerciciosApi.remove(id)
      fetchItems()
      addToast('Ejercicio eliminado', 'success')
    } catch {
      addToast('Error al eliminar el ejercicio', 'error')
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className="flex flex-col gap-5"
    >
      {/* ── Título ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl md:text-4xl font-black tracking-tighter text-gray-900 dark:text-white drop-shadow-sm flex items-center gap-3">
            <Dumbbell size={26} className="text-primary" />
            Catálogo de Ejercicios
          </h1>
          {!loading && (
            <p className="text-sm text-saas-muted">
              {items.length} ejercicio{items.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        {isAdmin && !showForm && (
          <button
            onClick={() => { setShowForm(true); setEditingId(null) }}
            className="flex items-center gap-2 rounded-xl btn-action px-4 py-2.5 text-sm self-start sm:self-auto"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-gray-900/10">
              <Plus size={13} strokeWidth={2.5} />
            </span>
            Nuevo ejercicio
          </button>
        )}
      </div>

      {/* ── Búsqueda + filtros ── */}
      <div className="flex w-full flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div className="relative w-full max-w-md">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar ejercicio..."
            className="w-full rounded-xl border border-saas-border bg-white py-2 pl-10 pr-4 text-sm text-gray-900 transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {(['todos', 'FACIL', 'INTERMEDIO', 'AVANZADO'] as const).map(d => (
            <button
              key={d}
              onClick={() => setFilterDif(d)}
              className={`inline-flex items-center rounded-full px-3 py-1.5 text-sm font-medium transition-all active:scale-[0.98] ${
                filterDif === d
                  ? 'bg-gray-900 text-white shadow-sm'
                  : 'border border-saas-border bg-white text-gray-700 hover:bg-saas-hover'
              }`}
            >
              {d === 'todos' ? 'Todos' : DIFICULTAD_CONFIG[d as keyof typeof DIFICULTAD_CONFIG].label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Formulario nuevo ejercicio (inline) ── */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            key="new-form"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className={`${glass} p-5 border-primary/30`}
          >
            <div className="flex items-center justify-between mb-4">
              <p className={labelCls}>Nuevo ejercicio</p>
              <button
                onClick={() => setShowForm(false)}
                className="p-1 rounded-lg text-gray-400 dark:text-[#8A8A9A] hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                <X size={14} />
              </button>
            </div>
            <EjercicioForm
              onSubmit={handleCreate}
              onCancel={() => setShowForm(false)}
              isSaving={savingId === 'new'}
            />

          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Tabla / empty state ── */}
      {loading ? (
        <div className={`${glass} p-6 space-y-3`}>
          {[1, 2, 3, 4].map(i => (
            <div
              key={i}
              className="h-10 rounded-xl bg-black/[0.05] dark:bg-white/[0.06] animate-pulse"
              style={{ opacity: 1 - i * 0.18 }}
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className={`${glass} flex flex-col items-center justify-center gap-4 py-24`}>
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <Dumbbell size={28} className="text-primary" />
          </div>
          <div className="text-center">
            <p className="text-base font-bold text-white">
              {search || filterDif !== 'todos' ? 'Sin resultados' : 'Catálogo vacío'}
            </p>
            <p className="text-sm text-[#8A8A9A] mt-1">
              {search || filterDif !== 'todos'
                ? 'Probá con otros filtros'
                : 'Agregá el primer ejercicio al catálogo'}
            </p>
          </div>
          {isAdmin && !search && filterDif === 'todos' && !showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl btn-action text-sm mt-2"
            >
              <Plus size={14} /> Agregar ejercicio
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[2rem] border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-3xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/20 dark:border-white/10 bg-gray-50/30 dark:bg-black/10">
                <th className={`${thCls} w-10`}>#</th>
                <th className={thCls}>Ejercicio</th>
                <th className={thCls}>Patrón de movimiento</th>
                <th className={`${thCls} text-center`}>Dificultad</th>
                <th className={`${thCls} text-center w-16`}>Video</th>
                {isAdmin && <th className="w-24" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/20 dark:divide-white/10">
              {items.map((ej, i) =>
                editingId === ej.id ? (
                  <tr key={ej.id + '-edit'}>
                    <td colSpan={isAdmin ? 6 : 5} className="px-4 py-4">
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <p className={labelCls}>Editar ejercicio</p>
                          <button
                            onClick={() => setEditingId(null)}
                            className="p-1 rounded-lg text-gray-400 dark:text-[#8A8A9A] hover:text-gray-900 dark:hover:text-white transition-colors"
                          >
                            <X size={14} />
                          </button>
                        </div>
                        <EjercicioForm
                          defaultValues={{
                            nombre:           ej.nombre,
                            descripcion:      ej.descripcion ?? '',
                            videoUrl:         ej.videoUrl ?? '',
                            patronMovimiento: ej.patronMovimiento ?? '',
                            dificultad:       ej.dificultad,
                          }}
                          onSubmit={(data) => handleUpdate(ej.id, data)}
                          onCancel={() => setEditingId(null)}
                          isEditing
                          isSaving={savingId === ej.id}
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
                    <td className="py-3.5 px-4 max-w-[240px]">
                      <p className="font-semibold text-white leading-tight">{ej.nombre}</p>
                      {ej.descripcion && (
                        <p className="text-xs text-[#6B7280] mt-0.5 line-clamp-1 italic">{ej.descripcion}</p>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      {ej.patronMovimiento ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/[0.06] text-[#8A8A9A]">
                          {ej.patronMovimiento}
                        </span>
                      ) : (
                        <span className="text-[#4B4B5A]">—</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${DIFICULTAD_CONFIG[ej.dificultad].cls}`}>
                        {DIFICULTAD_CONFIG[ej.dificultad].label}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {ej.videoUrl ? (
                        <a
                          href={ej.videoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center h-7 w-7 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                          onClick={e => e.stopPropagation()}
                        >
                          <ExternalLink size={12} />
                        </a>
                      ) : (
                        <span className="text-[#4B4B5A]">—</span>
                      )}
                    </td>
                    {isAdmin && (
                      <td className="py-3.5 px-4">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => { setEditingId(ej.id); setShowForm(false) }}
                            className="p-1.5 rounded-lg text-[#6B7280] hover:text-white hover:bg-white/[0.06] transition-colors"
                          >
                            <Edit2 size={12} />
                          </button>
                          <button
                            onClick={() => handleDelete(ej.id)}
                            className="p-1.5 rounded-lg text-[#6B7280] hover:text-red-400 hover:bg-red-500/10 transition-colors"
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
      )}
    </motion.div>
  )
}
