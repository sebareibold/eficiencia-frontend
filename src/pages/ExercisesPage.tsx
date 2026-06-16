import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Dumbbell, Plus, Edit2, Trash2, ExternalLink, Search, ChevronLeft, ChevronRight, Check, X, ArrowUp, ArrowDown, ArrowUpDown, LayoutGrid, List } from 'lucide-react'
import { ejerciciosApi } from '../api/ejercicios.api'
import { patronesApi, type PatronMovimientoConfig } from '../api/patrones.api'
import { useAuthStore } from '../store/authStore'
import { useUiStore } from '../store/uiStore'
import type { EjercicioCatalogo, Dificultad } from '../types/ejercicio-catalogo.types'
import PlantillasPage from './PlantillasPage'
import { ROUTES } from '../constants/routes'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import Modal from '../components/ui/Modal'

const glass = 'rounded-[2rem] border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-3xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)]'
const thCls = 'py-3 px-4 text-left text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-[#6B7280]'

const DIFICULTAD_CONFIG: Record<string, { label: string; cls: string }> = {
  FACIL:    { label: 'Fácil',    cls: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' },
  DIFICIL:  { label: 'Difícil',  cls: 'bg-amber-500/10 text-amber-400 border border-amber-500/20' },
  AVANZADO: { label: 'Avanzado', cls: 'bg-red-500/10 text-red-400 border border-red-500/20' },
}
const DIFICULTAD_FALLBACK = { label: 'Sin definir', cls: 'bg-gray-500/10 text-gray-400 border border-gray-500/20' }
const DIFICULTAD_ORDER: Record<string, number> = { FACIL: 1, DIFICIL: 2, AVANZADO: 3 }

type ExSortKey = 'nombre' | 'patronMovimiento' | 'dificultad'
type ExSortDir = 'asc' | 'desc'

function ExSortIcon({ active, dir }: { active: boolean; dir: ExSortDir }) {
  if (!active) return <ArrowUpDown size={11} className="opacity-30" />
  return dir === 'asc'
    ? <ArrowUp size={11} className="text-primary" />
    : <ArrowDown size={11} className="text-primary" />
}


const selectCls = 'rounded-xl border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-xl px-3.5 py-1.5 text-xs font-semibold text-gray-800 dark:text-gray-200 focus:outline-none cursor-pointer h-10 shadow-sm transition-all focus:border-primary'

const PAGE_SIZE = 10

export default function ExercisesPage() {
  const user     = useAuthStore(s => s.user)
  const addToast = useUiStore(s => s.addToast)
  const navigate = useNavigate()
  const isAdmin  = user?.role === 'admin'

  const [items, setItems]         = useState<EjercicioCatalogo[]>([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]           = useState('')
  const [filterDif, setFilterDif]     = useState<string>('todos')
  const [filterPatron, setFilterPatron] = useState<string>('')
  const [page, setPage]               = useState(1)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  // ── Patrones ──
  const [patrones, setPatrones]               = useState<PatronMovimientoConfig[]>([])
  const [patronesLoading, setPatronesLoading] = useState(true)
  const [editingPatron, setEditingPatron]     = useState<string | null>(null)
  const [editLabel, setEditLabel]             = useState('')
  const [editDesc, setEditDesc]               = useState('')
  const [newPatronLabel, setNewPatronLabel]   = useState('')
  const [newPatronClave, setNewPatronClave]   = useState('')
  const [newPatronDesc, setNewPatronDesc]     = useState('')
  const [showNewForm, setShowNewForm]         = useState(false)
  const [savingPatron, setSavingPatron]       = useState(false)
  const [deletePatronTarget, setDeletePatronTarget] = useState<string | null>(null)
  const [patronViewMode, setPatronViewMode] = useState<'grid' | 'list'>('grid')
  const descTextareaRef = useRef<HTMLTextAreaElement>(null)

  function autoResizeTextarea(el: HTMLTextAreaElement) {
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }

  // Cuando el modal abre con descripción existente, ajustar altura
  useEffect(() => {
    if (editingPatron !== null) {
      requestAnimationFrame(() => {
        if (descTextareaRef.current) autoResizeTextarea(descTextareaRef.current)
      })
    }
  }, [editingPatron])

  const [sortKey, setSortKey] = useState<ExSortKey>('nombre')
  const [sortDir, setSortDir] = useState<ExSortDir>('asc')

  function handleSort(key: ExSortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const sortedItems = useMemo(() => {
    const arr = [...items]
    arr.sort((a, b) => {
      let cmp = 0
      if (sortKey === 'nombre') cmp = a.nombre.localeCompare(b.nombre)
      else if (sortKey === 'patronMovimiento') {
        const la = patrones.find(p => p.clave === a.patronMovimiento)?.label ?? a.patronMovimiento ?? ''
        const lb = patrones.find(p => p.clave === b.patronMovimiento)?.label ?? b.patronMovimiento ?? ''
        cmp = la.localeCompare(lb)
      } else if (sortKey === 'dificultad') {
        cmp = (DIFICULTAD_ORDER[a.dificultad] ?? 0) - (DIFICULTAD_ORDER[b.dificultad] ?? 0)
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
    return arr
  }, [items, sortKey, sortDir, patrones])

  const totalPages = Math.ceil(sortedItems.length / PAGE_SIZE)
  const pageItems  = sortedItems.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const data = await ejerciciosApi.getAll({
        nombre: search || undefined,
        dificultad: filterDif !== 'todos' ? filterDif as Dificultad : undefined,
        patronMovimiento: filterPatron || undefined,
      })
      setItems(data)
      setPage(1)
    } catch {
      addToast('Error al cargar ejercicios', 'error')
    } finally {
      setLoading(false)
    }
  }, [search, filterDif, filterPatron, addToast])

  useEffect(() => {
    const t = setTimeout(fetchItems, 300)
    return () => clearTimeout(t)
  }, [fetchItems])

  // ── Fetch patrones ──
  const fetchPatrones = useCallback(async () => {
    setPatronesLoading(true)
    try { setPatrones(await patronesApi.getAll()) }
    catch { addToast('Error al cargar patrones', 'error') }
    finally { setPatronesLoading(false) }
  }, [addToast])

  useEffect(() => { fetchPatrones() }, [fetchPatrones])

  async function handleSavePatron(id: string) {
    if (!editLabel.trim()) return
    setSavingPatron(true)
    try {
      const updated = await patronesApi.update(id, { label: editLabel.trim(), descripcion: editDesc.trim() || undefined })
      setPatrones(prev => prev.map(p => p.id === id ? updated : p))
      setEditingPatron(null)
      addToast('Patrón actualizado', 'success')
    } catch { addToast('Error al actualizar el patrón', 'error') }
    finally { setSavingPatron(false) }
  }

  async function handleCreatePatron() {
    if (!newPatronLabel.trim() || !newPatronClave.trim()) return
    setSavingPatron(true)
    try {
      const created = await patronesApi.create({
        clave: newPatronClave.trim().toUpperCase().replace(/\s+/g, '_'),
        label: newPatronLabel.trim(),
        descripcion: newPatronDesc.trim() || undefined,
        orden: patrones.length,
      })
      setPatrones(prev => [...prev, created])
      setNewPatronLabel(''); setNewPatronClave(''); setNewPatronDesc(''); setShowNewForm(false)
      addToast('Patrón creado', 'success')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Error al crear el patrón'
      addToast(msg, 'error')
    } finally { setSavingPatron(false) }
  }

  async function handleDeletePatron(id: string) {
    setDeletePatronTarget(null)
    const backup = patrones.find(p => p.id === id)
    setPatrones(prev => prev.filter(p => p.id !== id))
    try {
      await patronesApi.remove(id)
      addToast('Patrón eliminado', 'success')
    } catch {
      if (backup) setPatrones(prev => [...prev, backup])
      addToast('Error al eliminar el patrón', 'error')
    }
  }

  async function handleTogglePatron(id: string, activo: boolean) {
    try {
      const updated = await patronesApi.update(id, { activo: !activo })
      setPatrones(prev => prev.map(p => p.id === id ? updated : p))
    } catch { addToast('Error al cambiar estado del patrón', 'error') }
  }

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
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          {/* Búsqueda */}
          <div className="relative w-full max-w-md shrink-0">
            <Search size={14} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 z-10 text-gray-400 dark:text-[#8A8A9A]" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar ejercicio…"
              className="w-full rounded-xl border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-xl pl-10 pr-4 py-2 text-xs font-semibold text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none h-10"
            />
          </div>

          {/* Filtros */}
          <div className="flex flex-col sm:flex-row gap-3 flex-wrap items-end">
            {/* Dificultad */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 px-1">Dificultad</span>
              <div className="flex items-center rounded-full border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-xl p-1 shadow-sm gap-1">
                {(['todos', 'FACIL', 'DIFICIL', 'AVANZADO'] as const).map(d => {
                  const isActive = filterDif === d
                  return (
                    <button key={d} onClick={() => setFilterDif(d)}
                      className={`relative inline-flex items-center justify-center rounded-full px-4 py-1.5 text-xs font-bold transition-all duration-300 cursor-pointer ${isActive ? 'text-white dark:text-gray-900' : 'text-gray-500 dark:text-[#8A8A9A] hover:text-gray-900 dark:hover:text-white'}`}
                    >
                      {isActive && <div className="absolute inset-0 rounded-full bg-gray-900 dark:bg-white shadow-[0_2px_8px_rgba(0,0,0,0.15)]" style={{ zIndex: 0 }} />}
                      <span className="relative" style={{ zIndex: 1 }}>
                        {d === 'todos' ? 'Todos' : DIFICULTAD_CONFIG[d as keyof typeof DIFICULTAD_CONFIG].label}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Patrón de movimiento */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 px-1">Patrón</span>
              <select
                value={filterPatron}
                onChange={e => setFilterPatron(e.target.value)}
                className={selectCls}
              >
                <option value="" className="bg-white dark:bg-[#1a1a24] text-gray-900 dark:text-white">Todos</option>
                {patrones.filter(p => p.activo).map(p => (
                  <option key={p.clave} value={p.clave} className="bg-white dark:bg-[#1a1a24] text-gray-900 dark:text-white">{p.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Tabla / empty state */}
        {loading ? (
          <div className={`${glass} overflow-hidden p-6 space-y-3`}>
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
                      {patrones.find(p => p.clave === ej.patronMovimiento)?.label ?? ej.patronMovimiento}
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
          <div className="hidden sm:block rounded-[2rem] border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-3xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/20 dark:border-white/10 bg-gray-50/30 dark:bg-black/10">
                  <th className={`${thCls} w-10`}>#</th>
                  <th className={`${thCls} cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200 transition-colors`} onClick={() => handleSort('nombre')}>
                    <div className="flex items-center gap-1.5">Ejercicio <ExSortIcon active={sortKey === 'nombre'} dir={sortDir} /></div>
                  </th>
                  <th className={`${thCls} cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200 transition-colors`} onClick={() => handleSort('patronMovimiento')}>
                    <div className="flex items-center gap-1.5">Patrón de movimiento <ExSortIcon active={sortKey === 'patronMovimiento'} dir={sortDir} /></div>
                  </th>
                  <th className={`${thCls} text-center cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200 transition-colors`} onClick={() => handleSort('dificultad')}>
                    <div className="flex items-center justify-center gap-1.5">Dificultad <ExSortIcon active={sortKey === 'dificultad'} dir={sortDir} /></div>
                  </th>
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
                          {patrones.find(p => p.clave === ej.patronMovimiento)?.label ?? ej.patronMovimiento}
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

      {/* ══ Sección Patrones ══ */}
      <section className="flex flex-col gap-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-2xl lg:text-3xl xl:text-4xl font-black tracking-tighter text-gray-900 dark:text-white drop-shadow-sm">
            Patrones
          </h2>
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-xl border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-xl p-1 shadow-sm">
              <button
                onClick={() => setPatronViewMode('grid')}
                title="Vista grilla"
                className={`p-1.5 rounded-lg transition-all duration-200 ${patronViewMode === 'grid' ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
              >
                <LayoutGrid size={14} />
              </button>
              <button
                onClick={() => setPatronViewMode('list')}
                title="Vista lista"
                className={`p-1.5 rounded-lg transition-all duration-200 ${patronViewMode === 'list' ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
              >
                <List size={14} />
              </button>
            </div>
            {isAdmin && (
              <button
                onClick={() => { setShowNewForm(v => !v); setNewPatronLabel(''); setNewPatronClave(''); setNewPatronDesc('') }}
                className="flex items-center gap-2 rounded-xl btn-action px-4 py-2.5 text-sm"
              >
                <Plus size={14} /> Nuevo patrón
              </button>
            )}
          </div>
        </div>

        {/* Formulario nuevo patrón */}
        <AnimatePresence>
          {showNewForm && isAdmin && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className={`${glass} p-5 flex flex-col gap-4`}
            >
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-[#6B7280]">Nuevo patrón de movimiento</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold text-gray-500 dark:text-[#8A8A9A]">Etiqueta *</label>
                  <input
                    value={newPatronLabel}
                    onChange={e => setNewPatronLabel(e.target.value)}
                    placeholder="Ej: Tracción vertical"
                    className="rounded-xl border border-white/50 dark:border-white/10 bg-white/60 dark:bg-black/20 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-primary"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold text-gray-500 dark:text-[#8A8A9A]">Clave (código) *</label>
                  <input
                    value={newPatronClave}
                    onChange={e => setNewPatronClave(e.target.value)}
                    placeholder="Ej: TRACCION_VERTICAL"
                    className="rounded-xl border border-white/50 dark:border-white/10 bg-white/60 dark:bg-black/20 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-primary font-mono"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold text-gray-500 dark:text-[#8A8A9A]">Descripción</label>
                  <input
                    value={newPatronDesc}
                    onChange={e => setNewPatronDesc(e.target.value)}
                    placeholder="Opcional"
                    className="rounded-xl border border-white/50 dark:border-white/10 bg-white/60 dark:bg-black/20 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-primary"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 justify-end">
                <button onClick={() => setShowNewForm(false)} className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-500 dark:text-[#8A8A9A] hover:text-gray-900 dark:hover:text-white transition-colors">
                  Cancelar
                </button>
                <button
                  onClick={handleCreatePatron}
                  disabled={savingPatron || !newPatronLabel.trim() || !newPatronClave.trim()}
                  className="flex items-center gap-2 rounded-xl btn-action px-4 py-2 text-sm disabled:opacity-40"
                >
                  {savingPatron ? <span className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" /> : <Check size={13} />}
                  Guardar
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Vista de patrones */}
        {patronesLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="h-20 rounded-2xl bg-black/[0.05] dark:bg-white/[0.04] animate-pulse" style={{ opacity: 1 - i * 0.07 }} />
            ))}
          </div>
        ) : patronViewMode === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {patrones.map(p => (
              <motion.div
                key={p.id}
                layout
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`group ${glass} p-4 flex flex-col gap-2 ${!p.activo ? 'opacity-50' : ''}`}
              >
                <div className="flex items-start justify-between gap-1">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-900 dark:text-white leading-tight truncate">{p.label}</p>
                    <p className="text-[10px] font-mono text-gray-400 dark:text-[#4B4B5A] mt-0.5 truncate">{p.clave}</p>
                  </div>
                  {isAdmin && (
                    <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setEditingPatron(p.id); setEditLabel(p.label); setEditDesc(p.descripcion ?? '') }} className="p-1 rounded-lg text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors">
                        <Edit2 size={11} />
                      </button>
                      <button onClick={() => setDeletePatronTarget(p.id)} className="p-1 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                        <Trash2 size={11} />
                      </button>
                    </div>
                  )}
                </div>
                {p.descripcion && (
                  <p className="text-[11px] text-gray-500 dark:text-[#6B7280] leading-snug line-clamp-2">{p.descripcion}</p>
                )}
                {isAdmin && (
                  <button
                    onClick={() => handleTogglePatron(p.id, p.activo)}
                    className={`self-start mt-auto inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold border transition-colors ${
                      p.activo
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20'
                        : 'bg-gray-100 dark:bg-white/[0.05] text-gray-400 border-gray-200 dark:border-white/[0.1] hover:bg-emerald-500/10 hover:text-emerald-400 hover:border-emerald-500/20'
                    }`}
                  >
                    {p.activo ? 'Activo' : 'Inactivo'}
                  </button>
                )}
              </motion.div>
            ))}
          </div>
        ) : (
          <div className={`${glass} overflow-hidden`}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/20 dark:border-white/10 bg-gray-50/30 dark:bg-black/10">
                  <th className={thCls}>Patrón</th>
                  <th className={thCls}>Clave</th>
                  <th className={`hidden md:table-cell ${thCls}`}>Descripción</th>
                  <th className={`${thCls} text-center`}>Estado</th>
                  {isAdmin && <th className="w-20" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/20 dark:divide-white/10">
                {patrones.map((p, i) => (
                  <motion.tr
                    key={p.id}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.02 }}
                    className={`group hover:bg-gray-50/80 dark:hover:bg-white/[0.04] transition-colors ${!p.activo ? 'opacity-50' : ''}`}
                  >
                    <td className="py-3 px-4">
                      <p className="font-semibold text-gray-900 dark:text-white">{p.label}</p>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-gray-100 dark:bg-white/[0.06] text-gray-500 dark:text-[#8A8A9A]">{p.clave}</span>
                    </td>
                    <td className="hidden md:table-cell py-3 px-4 max-w-[240px]">
                      <p className="text-xs text-gray-500 dark:text-[#6B7280] line-clamp-1">{p.descripcion ?? <span className="text-gray-300 dark:text-[#4B4B5A]">—</span>}</p>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {isAdmin ? (
                        <button
                          onClick={() => handleTogglePatron(p.id, p.activo)}
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold border transition-colors ${
                            p.activo
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20'
                              : 'bg-gray-100 dark:bg-white/[0.05] text-gray-400 border-gray-200 dark:border-white/[0.1] hover:bg-emerald-500/10 hover:text-emerald-400 hover:border-emerald-500/20'
                          }`}
                        >
                          {p.activo ? 'Activo' : 'Inactivo'}
                        </button>
                      ) : (
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold border ${p.activo ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-gray-100 dark:bg-white/[0.05] text-gray-400 border-gray-200 dark:border-white/[0.1]'}`}>
                          {p.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      )}
                    </td>
                    {isAdmin && (
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => { setEditingPatron(p.id); setEditLabel(p.label); setEditDesc(p.descripcion ?? '') }} className="p-1.5 rounded-lg text-gray-400 dark:text-[#6B7280] hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors">
                            <Edit2 size={12} />
                          </button>
                          <button onClick={() => setDeletePatronTarget(p.id)} className="p-1.5 rounded-lg text-gray-400 dark:text-[#6B7280] hover:text-red-400 hover:bg-red-500/10 transition-colors">
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
        )}
      </section>

      {/* Modal editar patrón */}
      <Modal isOpen={editingPatron !== null} onClose={() => setEditingPatron(null)} size="md">
        <div className="space-y-5">
          <div>
            <p className="text-base font-bold text-gray-900 dark:text-white">Editar patrón</p>
            <p className="text-xs font-mono text-gray-400 dark:text-[#6B7280] mt-0.5">
              {patrones.find(p => p.id === editingPatron)?.clave}
            </p>
          </div>
          <div className="space-y-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-[#8A8A9A]">Etiqueta *</label>
              <input
                value={editLabel}
                onChange={e => setEditLabel(e.target.value)}
                autoFocus
                className="rounded-xl border border-white/50 dark:border-white/10 bg-white/60 dark:bg-black/20 px-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-primary transition-colors"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-[#8A8A9A]">Descripción</label>
              <textarea
                ref={descTextareaRef}
                value={editDesc}
                onChange={e => { setEditDesc(e.target.value); autoResizeTextarea(e.target) }}
                placeholder="Opcional"
                rows={3}
                className="rounded-xl border border-white/50 dark:border-white/10 bg-white/60 dark:bg-black/20 px-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-primary transition-colors resize-none leading-relaxed w-full"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={() => setEditingPatron(null)}
              className="flex-1 rounded-xl border border-white/30 dark:border-white/10 bg-white/40 dark:bg-white/[0.05] py-2.5 text-sm font-bold text-gray-600 dark:text-gray-300 hover:bg-white/60 dark:hover:bg-white/10 transition-all"
            >
              Cancelar
            </button>
            <button
              onClick={() => editingPatron && handleSavePatron(editingPatron)}
              disabled={savingPatron || !editLabel.trim()}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl btn-action py-2.5 text-sm font-bold disabled:opacity-60"
            >
              {savingPatron
                ? <span className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
                : <Check size={13} />}
              Guardar
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="Eliminar ejercicio"
        message="Se eliminará del catálogo. Las rutinas que lo usan no se modifican. Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        onConfirm={() => deleteTarget !== null && handleDelete(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
      />

      <ConfirmDialog
        isOpen={deletePatronTarget !== null}
        title="Eliminar patrón"
        message="Se eliminará este patrón. Los ejercicios que lo tengan asignado quedarán sin patrón. Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        onConfirm={() => deletePatronTarget !== null && handleDeletePatron(deletePatronTarget)}
        onClose={() => setDeletePatronTarget(null)}
      />
    </motion.div>
  )
}
