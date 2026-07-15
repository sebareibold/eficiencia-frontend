import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ClipboardList, Check, X, RefreshCw, Clock } from 'lucide-react'
import { listaEsperaApi } from '../api/listaEspera.api'
import type { PendienteSolicitudEntry } from '../types/listaEspera.types'
import { useUiStore } from '../store/uiStore'
import { formatDate } from '../utils/formatDate'

const DIA_LABELS: Record<string, string> = {
  lunes: 'Lun', martes: 'Mar', miercoles: 'Mié', jueves: 'Jue',
  viernes: 'Vie', sabado: 'Sáb', domingo: 'Dom',
}

export default function SolicitudesPage() {
  const addToast = useUiStore(s => s.addToast)
  const [items, setItems]         = useState<PendienteSolicitudEntry[]>([])
  const [loading, setLoading]     = useState(true)
  const [actioningId, setActioningId] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    listaEsperaApi.getPendientes()
      .then(setItems)
      .catch(() => addToast('Error al cargar solicitudes', 'error'))
      .finally(() => setLoading(false))
  }, [addToast])

  useEffect(() => { load() }, [load])

  async function handleAprobar(id: string) {
    setActioningId(id)
    try {
      await listaEsperaApi.aprobar(id)
      addToast('Solicitud aprobada — inscripción creada', 'success')
      load()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Error al aprobar'
      addToast(msg, 'error')
    } finally { setActioningId(null) }
  }

  async function handleRechazar(id: string) {
    setActioningId(id)
    try {
      await listaEsperaApi.rechazar(id)
      addToast('Solicitud rechazada — se notificó al siguiente en la lista', 'success')
      load()
    } catch { addToast('Error al rechazar', 'error') }
    finally { setActioningId(null) }
  }

  return (
    <div className="p-4 lg:p-6 xl:p-8 space-y-5 md:space-y-7">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-black dark:text-white text-gray-900">Solicitudes</h1>
          <p className="text-sm dark:text-gray-400 text-gray-500 mt-1">
            {!loading && (
              items.length > 0
                ? `${items.length} pendiente${items.length !== 1 ? 's' : ''} de aprobación`
                : 'Sin solicitudes pendientes'
            )}
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="p-2 rounded-xl dark:bg-white/5 bg-black/5 hover:dark:bg-white/10 hover:bg-black/10 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={16} className={`dark:text-gray-400 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 rounded-2xl dark:bg-white/5 bg-black/5 animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-16 h-16 rounded-2xl dark:bg-white/5 bg-black/5 flex items-center justify-center">
            <ClipboardList size={28} className="dark:text-gray-600 text-gray-400" />
          </div>
          <div className="text-center">
            <p className="font-semibold dark:text-gray-300 text-gray-700">Sin solicitudes pendientes</p>
            <p className="text-sm dark:text-gray-500 text-gray-400 mt-1">
              Cuando se libere un cupo en un turno con lista de espera, la solicitud aparecerá acá.
            </p>
          </div>
        </div>
      ) : (
        <AnimatePresence initial={false}>
          <div className="space-y-3">
            {items.map(item => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                className="rounded-2xl dark:bg-white/[0.04] bg-white border dark:border-white/[0.08] border-gray-200 p-4 lg:p-5 flex flex-col sm:flex-row sm:items-center gap-4"
              >
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold dark:text-white text-gray-900 truncate">
                      {item.clienteNombre}
                    </span>
                    <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-semibold ${
                      item.tipo === 'INTERNA'
                        ? 'dark:bg-blue-500/15 bg-blue-100 dark:text-blue-300 text-blue-700'
                        : 'dark:bg-purple-500/15 bg-purple-100 dark:text-purple-300 text-purple-700'
                    }`}>
                      {item.tipo === 'INTERNA' ? 'Cliente' : 'Externo'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-semibold dark:text-gray-200 text-gray-700">
                      {item.turnoHoraInicio}–{item.turnoHoraFin}
                    </span>
                    <span className="dark:text-gray-500 text-gray-400">·</span>
                    <span className="dark:text-gray-400 text-gray-500">
                      {item.turnoDias.map(d => DIA_LABELS[d] ?? d).join(', ')}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 mt-1 text-xs dark:text-gray-500 text-gray-400">
                    <Clock size={10} />
                    <span>Solicitado el {formatDate(item.fechaSolicitud)}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => handleRechazar(item.id)}
                    disabled={actioningId === item.id}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold
                      dark:bg-red-500/10 bg-red-50 dark:text-red-400 text-red-600
                      hover:dark:bg-red-500/20 hover:bg-red-100 disabled:opacity-50 transition-colors"
                  >
                    <X size={14} />
                    Rechazar
                  </button>
                  <button
                    onClick={() => handleAprobar(item.id)}
                    disabled={actioningId === item.id}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold
                      bg-primary text-black hover:bg-primary-dark disabled:opacity-50 transition-colors"
                  >
                    <Check size={14} />
                    Aprobar
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </AnimatePresence>
      )}
    </div>
  )
}
