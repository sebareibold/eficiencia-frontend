import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Layers, Plus, Edit2, Trash2, Power, X, Filter } from 'lucide-react'
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

const glass     = 'rounded-[2rem] border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-3xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)]'
const selectCls = 'rounded-xl border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-xl px-3.5 py-1.5 text-xs font-semibold text-gray-800 dark:text-gray-200 focus:outline-none cursor-pointer h-9 shadow-sm transition-all focus:border-primary'

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

  const [loadingToggle, setLoadingToggle] = useState<string | null>(null)
  const [loadingDelete, setLoadingDelete] = useState<string | null>(null)

  const fetchPlantillas = useCallback(async () => {
    setLoading(true)
    try {
      const data = await plantillasApi.getAll({
        tipo: filtroTipo || undefined,
        cantidadSesiones: filtroSesiones || undefined,
        soloActivas: filtroActivas,
      })
      setPlantillas(data)
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
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Layers size={20} className="text-primary" />
            </div>
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
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Layers size={20} className="text-primary" />
            </div>
            <h2 className="text-2xl lg:text-3xl xl:text-4xl font-black tracking-tighter text-gray-900 dark:text-white drop-shadow-sm">
              Plantillas
            </h2>
          </div>
          {headerButton}
        </div>
      )}

      <div className="space-y-4">
        {/* Filtros */}
        <div className={`${glass} px-4 py-3`}>
          <div className="flex flex-wrap items-center gap-3">
            <Filter size={13} className="text-gray-400 dark:text-white/30 shrink-0" />
            <select
              value={filtroTipo}
              onChange={e => setFiltroTipo(e.target.value as TipoDistribucion | '')}
              className={selectCls}
            >
              <option value="" className="bg-white dark:bg-[#1a1a24] text-gray-900 dark:text-white">Todos los tipos</option>
              {(Object.keys(TIPO_LABELS) as TipoDistribucion[]).map(t => (
                <option key={t} value={t} className="bg-white dark:bg-[#1a1a24] text-gray-900 dark:text-white">{TIPO_LABELS[t]}</option>
              ))}
            </select>
            <select
              value={filtroSesiones}
              onChange={e => setFiltroSesiones(e.target.value ? Number(e.target.value) : '')}
              className={selectCls}
            >
              <option value="" className="bg-white dark:bg-[#1a1a24] text-gray-900 dark:text-white">Todas las sesiones</option>
              {[2, 3, 4, 5].map(n => <option key={n} value={n} className="bg-white dark:bg-[#1a1a24] text-gray-900 dark:text-white">{n}× semana</option>)}
            </select>
            <select
              value={filtroActivas === undefined ? '' : String(filtroActivas)}
              onChange={e => setFiltroActivas(e.target.value === '' ? undefined : e.target.value === 'true')}
              className={selectCls}
            >
              <option value="" className="bg-white dark:bg-[#1a1a24] text-gray-900 dark:text-white">Todas</option>
              <option value="true" className="bg-white dark:bg-[#1a1a24] text-gray-900 dark:text-white">Solo activas</option>
              <option value="false" className="bg-white dark:bg-[#1a1a24] text-gray-900 dark:text-white">Solo inactivas</option>
            </select>
            {(filtroTipo || filtroSesiones || filtroActivas !== undefined) && (
              <button
                onClick={() => { setFiltroTipo(''); setFiltroSesiones(''); setFiltroActivas(undefined) }}
                className="flex items-center gap-1 text-xs text-gray-400 dark:text-white/30 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                <X size={11} /> Limpiar
              </button>
            )}
            <span className="ml-auto text-xs text-gray-400 dark:text-white/25">
              {plantillas.length} plantilla{plantillas.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Tabla */}
        <div className={`${glass} overflow-hidden`}>
          {loading ? (
            <div className="overflow-x-auto">
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
          ) : (
            <div className="overflow-x-auto">
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
                  {plantillas.map(p => (
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
          )}
        </div>

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
