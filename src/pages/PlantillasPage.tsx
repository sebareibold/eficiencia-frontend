import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Layers, Plus, Edit2, Trash2, Power, X, ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { plantillasApi } from '../api/plantillas.api'
import { useAuthStore } from '../store/authStore'
import { useUiStore } from '../store/uiStore'
import type { PlantillaRutinaData, TipoDistribucion } from '../types/rutina.types'
import { ROUTES } from '../constants/routes'
import Skeleton, { SkeletonRow } from '../components/ui/Skeleton'

// ─── Constantes ───────────────────────────────────────────────────────────────

const TIPO_LABELS: Record<TipoDistribucion, string> = {
  FULL_BODY: 'Full Body',
  ARM_LEG:   'Arm-Leg',
  PUSH_PULL: 'Push-Pull',
  CUSTOM:    'Custom',
}

const TIPO_COLORS: Record<TipoDistribucion, string> = {
  FULL_BODY: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
  ARM_LEG:   'bg-purple-500/15 text-purple-400 border-purple-500/25',
  PUSH_PULL: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  CUSTOM:    'bg-gray-500/15 text-gray-400 border-gray-500/25',
}

const PAGE_SIZE = 8
const glass = 'rounded-[2rem] border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-3xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)]'

const TIPO_FILTER_OPTIONS: { value: TipoDistribucion | ''; label: string }[] = [
  { value: '',          label: 'Todos' },
  { value: 'FULL_BODY', label: 'Full Body' },
  { value: 'ARM_LEG',   label: 'Arm-Leg' },
  { value: 'PUSH_PULL', label: 'Push-Pull' },
  { value: 'CUSTOM',    label: 'Custom' },
]

const SESIONES_OPTIONS: { value: number | ''; label: string }[] = [
  { value: '',  label: 'Todas' },
  { value: 2,   label: '2×' },
  { value: 3,   label: '3×' },
  { value: 4,   label: '4×' },
  { value: 5,   label: '5×' },
]

const ESTADO_OPTIONS: { value: boolean | undefined; label: string }[] = [
  { value: undefined, label: 'Todas' },
  { value: true,      label: 'Activas' },
  { value: false,     label: 'Inactivas' },
]

// ─── FilaPlantilla ────────────────────────────────────────────────────────────

interface FilaPlantillaProps {
  plantilla: PlantillaRutinaData
  isAdmin: boolean
  onEdit: () => void
  onToggle: () => void
  onDelete: () => void
  loadingToggle: boolean
  loadingDelete: boolean
}

function FilaPlantilla({ plantilla, isAdmin, onEdit, onToggle, onDelete, loadingToggle, loadingDelete }: FilaPlantillaProps) {
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <tr className="border-b border-white/20 dark:border-white/[0.06] hover:bg-gray-50/80 dark:hover:bg-white/[0.04] transition-colors">
      <td className="px-5 py-3.5">
        <p className="text-sm font-semibold text-gray-900 dark:text-white">{plantilla.nombre}</p>
      </td>
      <td className="px-5 py-3.5">
        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${TIPO_COLORS[plantilla.tipo]}`}>
          {TIPO_LABELS[plantilla.tipo]}
        </span>
      </td>
      <td className="px-5 py-3.5 text-sm text-gray-500 dark:text-white/60">
        {plantilla.cantidadSesiones}×
      </td>
      <td className="px-5 py-3.5">
        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
          plantilla.activa
            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
            : 'bg-gray-100 dark:bg-white/[0.05] text-gray-400 dark:text-white/30 border-gray-200 dark:border-white/[0.1]'
        }`}>
          {plantilla.activa ? 'Activa' : 'Inactiva'}
        </span>
      </td>
      {isAdmin && (
        <td className="px-5 py-3.5">
          <div className="flex items-center gap-1 justify-end">
            <button
              onClick={onEdit}
              title="Editar"
              className="p-1.5 rounded-lg text-gray-400 dark:text-white/30 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors"
            >
              <Edit2 size={13} />
            </button>
            <button
              onClick={onToggle}
              disabled={loadingToggle}
              title={plantilla.activa ? 'Desactivar' : 'Activar'}
              className="p-1.5 rounded-lg text-gray-400 dark:text-white/30 hover:text-amber-500 hover:bg-amber-500/[0.08] transition-colors disabled:opacity-40"
            >
              <Power size={13} />
            </button>
            {confirmDelete ? (
              <div className="flex items-center gap-1">
                <button
                  onClick={onDelete}
                  disabled={loadingDelete}
                  className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-40"
                >
                  Confirmar
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="px-2 py-1 rounded-lg text-[10px] text-gray-500 dark:text-white/40 hover:text-gray-900 dark:hover:text-white border border-gray-200 dark:border-white/[0.1] transition-colors"
                >
                  No
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                title="Eliminar"
                className="p-1.5 rounded-lg text-gray-400 dark:text-white/30 hover:text-red-400 hover:bg-red-500/[0.08] transition-colors"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        </td>
      )}
    </tr>
  )
}

// ─── Página principal ──────────────────────────────────────────────────────────

interface PlantillasPageProps {
  embedded?: boolean
}

export default function PlantillasPage({ embedded = false }: PlantillasPageProps) {
  const { user } = useAuthStore()
  const addToast = useUiStore(s => s.addToast)
  const navigate = useNavigate()
  const isAdmin  = user?.role === 'admin'

  const [plantillas, setPlantillas] = useState<PlantillaRutinaData[]>([])
  const [loading, setLoading]       = useState(true)

  const [filtroTipo, setFiltroTipo]         = useState<TipoDistribucion | ''>('')
  const [filtroSesiones, setFiltroSesiones] = useState<number | ''>('')
  const [filtroActivas, setFiltroActivas]   = useState<boolean | undefined>(undefined)

  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [loadingToggle, setLoadingToggle] = useState<string | null>(null)
  const [loadingDelete, setLoadingDelete] = useState<string | null>(null)

  const filtered   = plantillas.filter(p => !search || p.nombre.toLowerCase().includes(search.toLowerCase()))
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const pageItems  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const fetchPlantillas = useCallback(async () => {
    setLoading(true)
    try {
      const data = await plantillasApi.getAll({
        tipo: filtroTipo || undefined,
        cantidadSesiones: filtroSesiones || undefined,
        soloActivas: filtroActivas,
      })
      setPlantillas(data)
      setPage(1)
    } catch {
      addToast('Error al cargar las plantillas', 'error')
    } finally {
      setLoading(false)
    }
  }, [filtroTipo, filtroSesiones, filtroActivas, addToast])

  useEffect(() => { fetchPlantillas() }, [fetchPlantillas])

  async function handleToggle(p: PlantillaRutinaData) {
    setLoadingToggle(p.id)
    try {
      const updated = await plantillasApi.toggle(p.id)
      setPlantillas(prev => prev.map(x => x.id === p.id ? updated : x))
      addToast(updated.activa ? 'Plantilla activada' : 'Plantilla desactivada', 'success')
    } catch {
      addToast('Error al cambiar estado', 'error')
    } finally {
      setLoadingToggle(null)
    }
  }

  async function handleDelete(p: PlantillaRutinaData) {
    setLoadingDelete(p.id)
    try {
      await plantillasApi.remove(p.id)
      setPlantillas(prev => prev.filter(x => x.id !== p.id))
      addToast('Plantilla eliminada', 'success')
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? 'No se pudo eliminar la plantilla'
      addToast(msg, 'error')
    } finally {
      setLoadingDelete(null)
    }
  }

  const headerButton = isAdmin && (
    <button
      onClick={() => navigate(ROUTES.PLANTILLA_NEW)}
      className="flex items-center gap-2 rounded-xl btn-action px-4 py-2.5 text-sm"
    >
      <Plus size={14} /> Nueva plantilla
    </button>
  )

  const contenido = (
    <div className="space-y-5 lg:space-y-6">
      {/* Header standalone */}
      {!embedded && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-2xl lg:text-3xl xl:text-4xl font-black tracking-tighter text-gray-900 dark:text-white drop-shadow-sm">
                Plantillas
              </h1>
              <p className="text-xs text-gray-500 dark:text-white/40 mt-0.5">Templates de estructura para crear rutinas</p>
            </div>
          </div>
          {headerButton}
        </div>
      )}

      {/* Header embebido */}
      {embedded && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl lg:text-3xl xl:text-4xl font-black tracking-tighter text-gray-900 dark:text-white drop-shadow-sm">
              Plantillas
            </h2>
          </div>
          {headerButton}
        </div>
      )}

      <div className="space-y-4">
        {/* Búsqueda + Filtros */}
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          {/* Buscador */}
          <div className="relative w-full max-w-md shrink-0">
            <Search size={14} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 z-10 text-gray-400 dark:text-[#8A8A9A]" />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              placeholder="Buscar plantilla…"
              className="w-full rounded-xl border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-xl pl-10 pr-4 py-2 text-xs font-semibold text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none h-10"
            />
          </div>

          {/* Filtros */}
          <div className="flex flex-col sm:flex-row gap-3 flex-wrap items-end">
          <div className="flex flex-col sm:flex-row gap-3 flex-wrap items-end">
            {/* Tipo */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 px-1">Tipo</span>
              <div className="flex items-center rounded-full border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-xl p-1 shadow-sm gap-1">
                {TIPO_FILTER_OPTIONS.map(opt => {
                  const isActive = filtroTipo === opt.value
                  return (
                    <button key={String(opt.value)} onClick={() => setFiltroTipo(opt.value as TipoDistribucion | '')}
                      className={`relative inline-flex items-center justify-center rounded-full px-3 py-1.5 text-xs font-bold transition-all duration-300 cursor-pointer ${isActive ? 'text-white dark:text-gray-900' : 'text-gray-500 dark:text-[#8A8A9A] hover:text-gray-900 dark:hover:text-white'}`}
                    >
                      {isActive && <div className="absolute inset-0 rounded-full bg-gray-900 dark:bg-white shadow-[0_2px_8px_rgba(0,0,0,0.15)]" style={{ zIndex: 0 }} />}
                      <span className="relative" style={{ zIndex: 1 }}>{opt.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Sesiones */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 px-1">Sesiones</span>
              <div className="flex items-center rounded-full border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-xl p-1 shadow-sm gap-1">
                {SESIONES_OPTIONS.map(opt => {
                  const isActive = filtroSesiones === opt.value
                  return (
                    <button key={String(opt.value)} onClick={() => setFiltroSesiones(opt.value as number | '')}
                      className={`relative inline-flex items-center justify-center rounded-full px-3 py-1.5 text-xs font-bold transition-all duration-300 cursor-pointer ${isActive ? 'text-white dark:text-gray-900' : 'text-gray-500 dark:text-[#8A8A9A] hover:text-gray-900 dark:hover:text-white'}`}
                    >
                      {isActive && <div className="absolute inset-0 rounded-full bg-gray-900 dark:bg-white shadow-[0_2px_8px_rgba(0,0,0,0.15)]" style={{ zIndex: 0 }} />}
                      <span className="relative" style={{ zIndex: 1 }}>{opt.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Estado */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 px-1">Estado</span>
              <div className="flex items-center rounded-full border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-xl p-1 shadow-sm gap-1">
                {ESTADO_OPTIONS.map(opt => {
                  const isActive = filtroActivas === opt.value
                  return (
                    <button key={String(opt.value)} onClick={() => setFiltroActivas(opt.value)}
                      className={`relative inline-flex items-center justify-center rounded-full px-3 py-1.5 text-xs font-bold transition-all duration-300 cursor-pointer ${isActive ? 'text-white dark:text-gray-900' : 'text-gray-500 dark:text-[#8A8A9A] hover:text-gray-900 dark:hover:text-white'}`}
                    >
                      {isActive && <div className="absolute inset-0 rounded-full bg-gray-900 dark:bg-white shadow-[0_2px_8px_rgba(0,0,0,0.15)]" style={{ zIndex: 0 }} />}
                      <span className="relative" style={{ zIndex: 1 }}>{opt.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {(filtroTipo || filtroSesiones || filtroActivas !== undefined) && (
              <button
                onClick={() => { setFiltroTipo(''); setFiltroSesiones(''); setFiltroActivas(undefined) }}
                className="flex items-center gap-1 h-9 text-xs text-gray-400 dark:text-white/30 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                <X size={11} /> Limpiar
              </button>
            )}
          </div>
          </div>

        </div>

        {/* Tabla */}
        <div className={`${glass} overflow-hidden`}>
          {loading ? (
            <div className="">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/20 dark:border-white/10 bg-gray-50/30 dark:bg-black/10">
                    <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-white/30">Nombre</th>
                    <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-white/30">Tipo</th>
                    <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-white/30">Sesiones</th>
                    <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-white/30">Estado</th>
                    {isAdmin && <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-white/30">Acciones</th>}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <SkeletonRow key={i} cols={isAdmin ? 5 : 4} />
                  ))}
                </tbody>
              </table>
            </div>
          ) : plantillas.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-400 dark:text-white/30">
              <Layers size={32} className="opacity-40" />
              <p className="text-sm">Sin plantillas. {isAdmin && 'Creá la primera con el botón de arriba.'}</p>
            </div>
          ) : (<>
            {/* ── Mobile card grid ── */}
            <div className="sm:hidden grid grid-cols-1 gap-3 p-3">
              {pageItems.map(p => (
                <div key={p.id} className="rounded-2xl border border-white/50 dark:border-white/10 bg-white/40 dark:bg-white/[0.04] backdrop-blur-xl p-4 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-gray-900 dark:text-white leading-tight">{p.nombre}</p>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${TIPO_COLORS[p.tipo]}`}>
                          {TIPO_LABELS[p.tipo]}
                        </span>
                        <span className="text-[11px] text-gray-500 dark:text-[#8A8A9A]">{p.sesiones?.length ?? 0} sesiones</span>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${p.activa ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' : 'bg-gray-100 dark:bg-white/[0.05] text-gray-400 border border-gray-200 dark:border-white/10'}`}>
                          {p.activa ? 'Activa' : 'Inactiva'}
                        </span>
                      </div>
                    </div>
                    {isAdmin && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => navigate(`/plantillas/${p.id}`)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/[0.08] transition-all">
                          <Edit2 size={13} />
                        </button>
                        <button onClick={() => handleToggle(p)} disabled={loadingToggle === p.id} className="p-1.5 rounded-lg text-gray-400 hover:text-primary hover:bg-primary/10 transition-all disabled:opacity-40">
                          <Power size={13} />
                        </button>
                        <button onClick={() => handleDelete(p)} disabled={loadingDelete === p.id} className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-40">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {/* ── Desktop table ── */}
            <div className="hidden sm:block ">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/20 dark:border-white/10 bg-gray-50/30 dark:bg-black/10">
                    <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-white/30">Nombre</th>
                    <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-white/30">Tipo</th>
                    <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-white/30">Sesiones</th>
                    <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-white/30">Estado</th>
                    {isAdmin && <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-white/30">Acciones</th>}
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map(p => (
                    <FilaPlantilla
                      key={p.id}
                      plantilla={p}
                      isAdmin={isAdmin}
                      onEdit={() => navigate(`/plantillas/${p.id}`)}
                      onToggle={() => handleToggle(p)}
                      onDelete={() => handleDelete(p)}
                      loadingToggle={loadingToggle === p.id}
                      loadingDelete={loadingDelete === p.id}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </>)}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-1">
            <span className="text-xs text-gray-500 dark:text-[#8A8A9A]">
              {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} de {filtered.length} plantillas
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

        {plantillas.length > 0 && (
          <p className="text-[10px] text-gray-400 dark:text-white/20 text-center">
            Las plantillas activas aparecen en el paso 3 del wizard de creación de rutinas.
          </p>
        )}
      </div>
    </div>
  )

  if (embedded) return contenido

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      {contenido}
    </motion.div>
  )
}
