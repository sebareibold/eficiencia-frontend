import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { pageVariants } from '../lib/motion'
import {
  CalendarDays, ClipboardList, Check, X, RefreshCw, Clock,
  GraduationCap, Mail,
} from 'lucide-react'
import { usuariosApi, type ProfesorDetalle } from '../api/usuarios.api'
import { listaEsperaApi } from '../api/listaEspera.api'
import type { PendienteSolicitudEntry } from '../types/listaEspera.types'
import { useUiStore } from '../store/uiStore'
import { formatDate } from '../utils/formatDate'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  buildTurnosDisplay, VIEW_MODES,
  TurnosGrid, TurnosList, TurnosCalendar,
  type TurnoViewMode,
} from '../components/profesor/TurnosProfesor'

const glassCard = 'rounded-[2rem] border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-3xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)]'

const DIA_LABELS: Record<string, string> = {
  lunes: 'Lun', martes: 'Mar', miercoles: 'Mie', jueves: 'Jue',
  viernes: 'Vie', sabado: 'Sab', domingo: 'Dom',
}

type Tab = 'turnos' | 'solicitudes'

export default function MisTurnosPage() {
  const navigate  = useNavigate()
  const addToast  = useUiStore(s => s.addToast)

  const [tab, setTab] = useState<Tab>('turnos')

  // ── Turnos state ──────────────────────────────────────────────────────────
  const [prof,         setProf]         = useState<ProfesorDetalle | null>(null)
  const [loadingProf,  setLoadingProf]  = useState(true)
  const [turnoView,    setTurnoView]    = useState<TurnoViewMode>('grid')

  const loadProf = useCallback(async () => {
    setLoadingProf(true)
    try {
      const data = await usuariosApi.getMiPerfilProfesor()
      setProf(data)
    } catch {
      addToast('Error al cargar tus turnos', 'error')
    } finally {
      setLoadingProf(false)
    }
  }, [addToast])

  useEffect(() => { loadProf() }, [loadProf])

  // ── Solicitudes state ─────────────────────────────────────────────────────
  const [items,        setItems]        = useState<PendienteSolicitudEntry[]>([])
  const [loadingSol,   setLoadingSol]   = useState(true)
  const [actioningId,  setActioningId]  = useState<string | null>(null)

  const loadSolicitudes = useCallback(() => {
    setLoadingSol(true)
    listaEsperaApi.getPendientes()
      .then(setItems)
      .catch(() => addToast('Error al cargar solicitudes', 'error'))
      .finally(() => setLoadingSol(false))
  }, [addToast])

  useEffect(() => { loadSolicitudes() }, [loadSolicitudes])

  async function handleAprobar(id: string) {
    setActioningId(id)
    try {
      await listaEsperaApi.aprobar(id)
      addToast('Solicitud aprobada — inscripcion creada', 'success')
      loadSolicitudes()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Error al aprobar'
      addToast(msg, 'error')
    } finally { setActioningId(null) }
  }

  async function handleRechazar(id: string) {
    setActioningId(id)
    try {
      await listaEsperaApi.rechazar(id)
      addToast('Solicitud rechazada — se notifico al siguiente en la lista', 'success')
      loadSolicitudes()
    } catch { addToast('Error al rechazar', 'error') }
    finally { setActioningId(null) }
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const p = prof?.profesor
  const turnosDisplay = p ? buildTurnosDisplay(p.turnosSalaA, p.turnosSalaB) : []
  const pendingCount = items.length

  return (
    <motion.div {...pageVariants} className="p-4 lg:p-6 xl:p-8 space-y-5 md:space-y-7 relative z-10">

      {/* Blob */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-20 -right-20 w-[400px] h-[400px] rounded-full bg-emerald-500/10 blur-[100px]" />
      </div>

      {/* Header */}
      <div>
        <h1 className="text-2xl lg:text-3xl font-black dark:text-white text-gray-900">Mis Turnos</h1>
        {!loadingProf && prof && (
          <p className="text-sm dark:text-gray-400 text-gray-500 mt-1">
            {prof.nombre} · {p?.especialidad || 'Sin especialidad'}
          </p>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 rounded-full border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-xl w-fit shadow-sm">
        {([
          { key: 'turnos' as Tab,       label: 'Turnos',       icon: CalendarDays },
          { key: 'solicitudes' as Tab,   label: 'Solicitudes',  icon: ClipboardList },
        ]).map(({ key, label, icon: Icon }) => {
          const isActive = tab === key
          return (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`relative flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all duration-300 ${
                isActive
                  ? 'text-white dark:text-gray-900'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              {isActive && (
                <div className="absolute inset-0 rounded-full bg-gray-900 dark:bg-white shadow-[0_2px_8px_rgba(0,0,0,0.15)]" style={{ zIndex: 0 }} />
              )}
              <span className="relative z-10 flex items-center gap-2">
                <Icon size={14} />
                {label}
                {key === 'solicitudes' && pendingCount > 0 && (
                  <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1 rounded-full bg-primary text-[10px] font-black text-black">
                    {pendingCount}
                  </span>
                )}
              </span>
            </button>
          )
        })}
      </div>

      {/* ── Tab: Turnos ──────────────────────────────────────────────────────── */}
      {tab === 'turnos' && (
        <>
          {/* Info card */}
          {!loadingProf && prof && p && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } }}
              className={`${glassCard} p-5 lg:p-6`}
            >
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10">
                  <GraduationCap size={22} className="text-emerald-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h2 className="text-lg font-black text-gray-900 dark:text-white">{prof.nombre}</h2>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                      <Check size={10} /> Activo
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-1.5 text-sm text-gray-500 dark:text-[#8A8A9A]">
                    <span className="flex items-center gap-1.5">
                      <Mail size={12} className="shrink-0" />
                      {prof.email}
                    </span>
                    {p.especialidad && (
                      <>
                        <span className="text-gray-300 dark:text-gray-600">·</span>
                        <span>{p.especialidad}</span>
                      </>
                    )}
                    <span className="text-gray-300 dark:text-gray-600">·</span>
                    <span>Desde {format(parseISO(prof.createdAt), "d MMM yyyy", { locale: es })}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Turnos card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1], delay: 0.08 } }}
            className={`${glassCard} overflow-hidden`}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/20 dark:border-white/[0.06]">
              <div className="flex items-center gap-2.5">
                <CalendarDays size={16} className="text-gray-400" />
                <h3 className="font-bold text-gray-900 dark:text-white">Turnos asignados</h3>
                <span className="text-xs font-bold px-2.5 py-1 rounded-xl bg-white/40 dark:bg-white/[0.06] text-gray-500 dark:text-[#8A8A9A]">
                  {turnosDisplay.length}
                </span>
              </div>

              {turnosDisplay.length > 0 && (
                <div className="flex items-center rounded-full border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-xl p-1 shadow-sm gap-1">
                  {VIEW_MODES.map(({ mode, icon: Icon, label }) => {
                    const isActive = turnoView === mode
                    return (
                      <button
                        key={mode}
                        onClick={() => setTurnoView(mode)}
                        title={label}
                        className={`relative inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all duration-300 cursor-pointer ${
                          isActive
                            ? 'text-white dark:text-gray-900'
                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                        }`}
                      >
                        {isActive && (
                          <div className="absolute inset-0 rounded-full bg-gray-900 dark:bg-white shadow-[0_2px_8px_rgba(0,0,0,0.15)]" style={{ zIndex: 0 }} />
                        )}
                        <span className="relative z-10"><Icon size={13} /></span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {loadingProf ? (
              <div className="p-6 space-y-3 animate-pulse">
                {[1, 2, 3].map(i => <div key={i} className="h-14 rounded-xl bg-white/10 dark:bg-white/[0.05]" />)}
              </div>
            ) : turnosDisplay.length === 0 ? (
              <div className="py-12 text-center">
                <CalendarDays size={28} className="mx-auto text-gray-300 dark:text-white/20 mb-3" />
                <p className="text-sm text-[#8A8A9A]">No tenés turnos asignados</p>
              </div>
            ) : turnoView === 'grid' ? (
              <TurnosGrid turnos={turnosDisplay} onNavigate={id => navigate(`/shifts/${id}`)} />
            ) : turnoView === 'list' ? (
              <TurnosList turnos={turnosDisplay} onNavigate={id => navigate(`/shifts/${id}`)} />
            ) : (
              <TurnosCalendar turnos={turnosDisplay} onNavigate={(id, date) => navigate(`/shifts/${id}${date ? `?date=${date}` : ''}`)} />
            )}
          </motion.div>
        </>
      )}

      {/* ── Tab: Solicitudes ─────────────────────────────────────────────────── */}
      {tab === 'solicitudes' && (
        <>
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm dark:text-gray-400 text-gray-500">
              {!loadingSol && (
                items.length > 0
                  ? `${items.length} pendiente${items.length !== 1 ? 's' : ''} de aprobacion`
                  : 'Sin solicitudes pendientes'
              )}
            </p>
            <button
              onClick={loadSolicitudes}
              disabled={loadingSol}
              className="p-2 rounded-xl dark:bg-white/5 bg-black/5 hover:dark:bg-white/10 hover:bg-black/10 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={16} className={`dark:text-gray-400 text-gray-500 ${loadingSol ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {loadingSol ? (
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
                  Cuando se libere un cupo en un turno con lista de espera, la solicitud aparecera aca.
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
        </>
      )}
    </motion.div>
  )
}
