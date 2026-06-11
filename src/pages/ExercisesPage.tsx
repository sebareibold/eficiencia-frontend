import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Dumbbell, Plus, Edit2, Trash2, ExternalLink, Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { ejerciciosApi } from '../api/ejercicios.api'
import { useAuthStore } from '../store/authStore'
import { useUiStore } from '../store/uiStore'
import type { EjercicioCatalogo, Dificultad } from '../types/ejercicio-catalogo.types'
import PlantillasPage from './PlantillasPage'
import { ROUTES } from '../constants/routes'
import ConfirmDialog from '../components/ui/ConfirmDialog'

const glass = 'rounded-[2rem] border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-3xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)]'
const thCls = 'py-3 px-4 text-left text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-[#6B7280]'

const DIFICULTAD_CONFIG: Record<string, { label: string; cls: string }> = {
  FACIL:    { label: 'Fácil',    cls: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' },
  DIFICIL:  { label: 'Difícil',  cls: 'bg-amber-500/10 text-amber-400 border border-amber-500/20' },
  AVANZADO: { label: 'Avanzado', cls: 'bg-red-500/10 text-red-400 border border-red-500/20' },
}
const DIFICULTAD_FALLBACK = { label: 'Sin definir', cls: 'bg-gray-500/10 text-gray-400 border border-gray-500/20' }
const PAGE_SIZE = 10

export default function ExercisesPage() {
  const user     = useAuthStore(s => s.user)
  const addToast = useUiStore(s => s.addToast)
  const navigate = useNavigate()
  const isAdmin  = user?.role === 'admin'

  const [items, setItems]         = useState<EjercicioCatalogo[]>([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [filterDif, setFilterDif] = useState<string>('todos')
  const [page, setPage]           = useState(1)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const totalPages = Math.ceil(items.length / PAGE_SIZE)
  const pageItems  = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const data = await ejerciciosApi.getAll({
        nombre: search || undefined,
        dificultad: filterDif !== 'todos' ? filterDif as Dificultad : undefined,
      })
      setItems(data)
      setPage(1)
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

  async function handleDelete(id: string) {
    setDeleteTarget(null)
    const backup = items.find(e => e.id === id)
    setItems(prev => prev.filter(e => e.id !== id))
    try {
      await ejerciciosApi.remove(id)
      addToast('Ejercicio eliminado', 'success')
    } catch {
      if (backup) setItems(prev => [...prev, backup])
      addToast('Error al eliminar el ejercicio', 'error')
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className="flex flex-col gap-16"
    >

      {/* ══ Sección Plantillas ══ */}
      <section>
        <PlantillasPage embedded />
      </section>

      {/* ══ Sección Catálogo ══ */}
      <section className="flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Dumbbell size={20} className="text-primary" />
            </div>
            <h2 className="text-2xl lg:text-3xl xl:text-4xl font-black tracking-tighter text-gray-900 dark:text-white drop-shadow-sm">
              Catálogo
            </h2>
          </div>
          {isAdmin && (
            <button
              onClick={() => navigate(ROUTES.EXERCISE_NEW)}
              className="flex items-center gap-2 rounded-xl btn-action px-4 py-2.5 text-sm"
            >
              <Plus size={14} /> Nuevo ejercicio
            </button>
          )}
        </div>

        {/* Búsqueda + filtros */}
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
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 px-1">Dificultad</span>
            <div className="flex flex-wrap gap-2">
              {(['todos', 'FACIL', 'DIFICIL', 'AVANZADO'] as const).map(d => (
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
        </div>

        {/* Tabla / empty state */}
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
              <p className="text-base font-bold text-gray-900 dark:text-white">
                {search || filterDif !== 'todos' ? 'Sin resultados' : 'Catálogo vacío'}
              </p>
              <p className="text-sm text-gray-500 dark:text-[#8A8A9A] mt-1">
                {search || filterDif !== 'todos'
                  ? 'Probá con otros filtros'
                  : 'Agregá el primer ejercicio al catálogo'}
              </p>
            </div>
            {isAdmin && !search && filterDif === 'todos' && (
              <button
                onClick={() => navigate(ROUTES.EXERCISE_NEW)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl btn-action text-sm mt-2"
              >
                <Plus size={14} /> Agregar ejercicio
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4">

          {/* ── Mobile card grid ── */}
          <div className="sm:hidden grid grid-cols-1 gap-3">
            {pageItems.map((ej, i) => (
              <motion.div
                key={ej.id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="rounded-2xl border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-3xl p-4 flex flex-col gap-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-xs font-black text-primary shrink-0">
                      {(page - 1) * PAGE_SIZE + i + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-gray-900 dark:text-white leading-tight truncate">{ej.nombre}</p>
                      {ej.descripcion && (
                        <p className="text-xs text-gray-500 dark:text-[#6B7280] mt-0.5 line-clamp-1 italic">{ej.descripcion}</p>
                      )}
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => navigate(`/exercises/${ej.id}`)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/[0.08] transition-colors">
                        <Edit2 size={13} />
                      </button>
                      <button onClick={() => setDeleteTarget(ej.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {ej.patronMovimiento && (
                    <span className="text-[11px] px-2 py-0.5 rounded-md bg-gray-100 dark:bg-white/[0.06] text-gray-500 dark:text-[#8A8A9A]">
                      {ej.patronMovimiento}
                    </span>
                  )}
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${(DIFICULTAD_CONFIG[ej.dificultad] ?? DIFICULTAD_FALLBACK).cls}`}>
                    {(DIFICULTAD_CONFIG[ej.dificultad] ?? DIFICULTAD_FALLBACK).label}
                  </span>
                  {ej.videoUrl && (
                    <a href={ej.videoUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                      className="inline-flex items-center gap-1 text-[11px] text-amber-600 dark:text-primary/70 hover:underline">
                      <ExternalLink size={11} /> Video
                    </a>
                  )}
                </div>
              </motion.div>
            ))}
          </div>

          {/* ── Desktop table ── */}
          <div className="hidden sm:block overflow-x-auto rounded-[2rem] border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-3xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
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
                {pageItems.map((ej, i) => (
                  <motion.tr
                    key={ej.id}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="group hover:bg-gray-50/80 dark:hover:bg-white/[0.04] transition-colors"
                  >
                    <td className="py-3.5 px-4">
                      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-xs font-black text-primary">
                        {(page - 1) * PAGE_SIZE + i + 1}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 max-w-[240px]">
                      <p className="font-semibold text-gray-900 dark:text-white leading-tight">{ej.nombre}</p>
                      {ej.descripcion && (
                        <p className="text-xs text-gray-500 dark:text-[#6B7280] mt-0.5 line-clamp-1 italic">{ej.descripcion}</p>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      {ej.patronMovimiento ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-white/[0.06] text-gray-500 dark:text-[#8A8A9A]">
                          {ej.patronMovimiento}
                        </span>
                      ) : (
                        <span className="text-gray-300 dark:text-[#4B4B5A]">—</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${(DIFICULTAD_CONFIG[ej.dificultad] ?? DIFICULTAD_FALLBACK).cls}`}>
                        {(DIFICULTAD_CONFIG[ej.dificultad] ?? DIFICULTAD_FALLBACK).label}
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
                        <span className="text-gray-300 dark:text-[#4B4B5A]">—</span>
                      )}
                    </td>
                    {isAdmin && (
                      <td className="py-3.5 px-4">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => navigate(`/exercises/${ej.id}`)}
                            className="p-1.5 rounded-lg text-gray-400 dark:text-[#6B7280] hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors"
                          >
                            <Edit2 size={12} />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(ej.id)}
                            className="p-1.5 rounded-lg text-gray-400 dark:text-[#6B7280] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    )}
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-1">
              <span className="text-xs text-gray-500 dark:text-[#8A8A9A]">
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, items.length)} de {items.length} ejercicios
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-3xl text-gray-500 dark:text-gray-400 shadow-[0_4px_16px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.3)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/50 dark:hover:bg-black/50 hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_8px_24px_rgba(0,0,0,0.4)] disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-[0_4px_16px_rgba(0,0,0,0.04)]"
                >
                  <ChevronLeft size={14} />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                  .reduce<(number | '...')[]>((acc, p, idx, arr) => {
                    if (idx > 0 && (p as number) - (arr[idx - 1] as number) > 1) acc.push('...')
                    acc.push(p)
                    return acc
                  }, [])
                  .map((p, idx) =>
                    p === '...' ? (
                      <span key={`ellipsis-${idx}`} className="w-8 text-center text-xs text-gray-400 dark:text-[#4B4B5A]">…</span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => setPage(p as number)}
                        className={`h-8 min-w-[2rem] rounded-xl px-2.5 text-xs font-bold backdrop-blur-3xl transition-all duration-200 ${
                          page === p
                            ? 'bg-gray-900/90 dark:bg-white/90 text-white dark:text-gray-900 border border-gray-900/20 dark:border-white/20 shadow-[0_8px_24px_rgba(0,0,0,0.18)] dark:shadow-[0_8px_24px_rgba(255,255,255,0.08)] -translate-y-0.5'
                            : 'border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 text-gray-600 dark:text-gray-400 shadow-[0_4px_16px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.3)] hover:-translate-y-0.5 hover:bg-white/50 dark:hover:bg-black/50 hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_8px_24px_rgba(0,0,0,0.4)]'
                        }`}
                      >
                        {p}
                      </button>
                    )
                  )}
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-3xl text-gray-500 dark:text-gray-400 shadow-[0_4px_16px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.3)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/50 dark:hover:bg-black/50 hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_8px_24px_rgba(0,0,0,0.4)] disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-[0_4px_16px_rgba(0,0,0,0.04)]"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
          </div>
        )}
      </section>

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="Eliminar ejercicio"
        message="Se eliminará del catálogo. Las rutinas que lo usan no se modifican. Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        onConfirm={() => deleteTarget !== null && handleDelete(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
      />
    </motion.div>
  )
}
