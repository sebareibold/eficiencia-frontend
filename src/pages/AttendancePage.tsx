import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { staggerContainerFast, fadeUpItem } from '../lib/motion'
import DotsLoader from '../components/ui/DotsLoader'
import { ClipboardCheck, CheckCircle2, AlertTriangle, XCircle, Clock, RefreshCw, Bell } from 'lucide-react'
import { format } from 'date-fns'
import { useShifts } from '../hooks/useShifts'
import { useAttendance } from '../hooks/useAttendance'
import { attendanceApi } from '../api/attendance.api'
import type { VerificacionFecha } from '../api/attendance.api'
import { inscripcionesApi } from '../api/inscripciones.api'
import { reposicionesApi } from '../api/reposiciones.api'
import { useUiStore } from '../store/uiStore'
import { useAuthStore } from '../store/authStore'
import { usuariosApi } from '../api/usuarios.api'
import Skeleton from '../components/ui/Skeleton'
import Select from '../components/ui/Select'
import type { WeekDay } from '../types/shift.types'

const DAY_LABELS: Record<WeekDay, string> = {
  monday: 'Lunes',
  tuesday: 'Martes',
  wednesday: 'Miércoles',
  thursday: 'Jueves',
  friday: 'Viernes',
  saturday: 'Sábado',
  sunday: 'Domingo',
}

const WEEKDAY_TO_JS: Record<WeekDay, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
}

// ─── Tipos ────────────────────────────────────────────────────────────────────

type AttendanceState = 'presente' | 'ausente' | 'con_aviso'

interface ClientEntry {
  id: string
  name: string
  esReposicion?: boolean
}

// ─── Banner de alerta según tipo de restricción ───────────────────────────────

interface AlertaBannerProps {
  verificacion: VerificacionFecha
}

function AlertaBanner({ verificacion }: AlertaBannerProps) {
  if (!verificacion.tipo) return null

  const configs = {
    CIERRE_TOTAL: {
      bg: 'bg-red-500/10 border-red-500/20',
      text: 'text-red-400',
      icon: <XCircle size={16} className="shrink-0 text-red-400" />,
      titulo: 'Gimnasio cerrado',
    },
    CANCELACION_TURNO: {
      bg: 'bg-red-500/10 border-red-500/20',
      text: 'text-red-400',
      icon: <XCircle size={16} className="shrink-0 text-red-400" />,
      titulo: 'Turno cancelado',
    },
    HORARIO_REDUCIDO: {
      bg: 'bg-amber-500/10 border-amber-500/20',
      text: 'text-amber-400',
      icon: <Clock size={16} className="shrink-0 text-amber-400" />,
      titulo: 'Horario reducido',
    },
  }

  const { bg, text, icon, titulo } = configs[verificacion.tipo]

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm ${bg}`}
    >
      {icon}
      <div className={text}>
        <span className="font-semibold">{titulo}:</span>{' '}
        {verificacion.motivo}
        {verificacion.tipo === 'HORARIO_REDUCIDO' && verificacion.horaDesde && verificacion.horaHasta && (
          <span className="ml-1 opacity-80">({verificacion.horaDesde}–{verificacion.horaHasta})</span>
        )}
        {verificacion.bloqueado && (
          <p className="mt-0.5 opacity-75">No se puede registrar asistencia en este día.</p>
        )}
      </div>
    </motion.div>
  )
}

// ─── Toggle de 3 estados por cliente ─────────────────────────────────────────

const EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1]

interface StateToggleProps {
  value: AttendanceState
  onChange: (v: AttendanceState) => void
  esReposicion?: boolean
}

function StateToggle({ value, onChange, esReposicion }: StateToggleProps) {
  const options: { key: AttendanceState; label: string; icon?: React.ReactNode }[] = [
    { key: 'presente',   label: 'Presente' },
    { key: 'ausente',    label: 'Ausente' },
    { key: 'con_aviso',  label: 'Con aviso', icon: <Bell size={10} /> },
  ]

  // Recuperaciones solo tienen presente/ausente (ya avisaron antes)
  const visible = esReposicion ? options.slice(0, 2) : options

  return (
    <div className="flex items-center gap-0.5 rounded-xl bg-white/[0.06] dark:bg-black/20 p-0.5">
      {visible.map(opt => {
        const active = value === opt.key
        const color =
          opt.key === 'presente'
            ? active ? 'bg-green-500/20 text-green-400 border-green-500/30' : ''
            : opt.key === 'con_aviso'
            ? active ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : ''
            : active ? 'bg-red-500/10 text-red-400 border-red-500/20' : ''

        return (
          <motion.button
            key={opt.key}
            onClick={() => onChange(opt.key)}
            whileTap={{ scale: 0.96 }}
            transition={{ duration: 0.12, ease: EASE_OUT }}
            className={`relative flex items-center gap-1 rounded-[10px] border px-2.5 py-1 text-[11px] font-semibold transition-all duration-150 ${
              active
                ? `${color} shadow-sm`
                : 'border-transparent text-gray-400 dark:text-[#8A8A9A] hover:text-gray-600 dark:hover:text-gray-300'
            }`}
          >
            {opt.icon}
            {opt.label}
          </motion.button>
        )
      })}
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function AttendancePage() {
  const { shifts, isLoading: loadingShifts } = useShifts()
  const { records, isLoading: loadingAttendance, fetchByShiftAndDate } = useAttendance()
  const addToast = useUiStore(s => s.addToast)
  const user    = useAuthStore(s => s.user)
  const isProfesor = user?.role === 'profesor'

  const [profesorId, setProfesorId] = useState<string | null>(null)

  useEffect(() => {
    if (!isProfesor) return
    usuariosApi.getMiPerfilProfesor()
      .then(p => setProfesorId(p.profesor?.id ?? null))
      .catch(() => {})
  }, [isProfesor])

  const [selectedShift, setSelectedShift] = useState('')
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [clients, setClients] = useState<ClientEntry[]>([])
  const [states, setStates] = useState<Record<string, AttendanceState>>({})
  const [isSaving, setIsSaving] = useState(false)
  const [loadingClients, setLoadingClients] = useState(false)
  const [loadingRecuperaciones, setLoadingRecuperaciones] = useState(false)

  // Estado de verificación de días especiales
  const [verificacion, setVerificacion] = useState<VerificacionFecha | null>(null)
  const [loadingVerificacion, setLoadingVerificacion] = useState(false)

  const selectedShiftData = shifts.find(s => String(s.id) === selectedShift)

  // Validación: día de semana vs días del turno
  const dateError = useMemo(() => {
    if (!selectedShiftData || !selectedDate) return null
    const jsDay = new Date(selectedDate + 'T12:00:00').getDay()
    const validDays = selectedShiftData.days.map(d => WEEKDAY_TO_JS[d])
    if (!validDays.includes(jsDay)) {
      const names = selectedShiftData.days.map(d => DAY_LABELS[d]).join(', ')
      return `Este turno solo se dicta los ${names}`
    }
    return null
  }, [selectedShiftData, selectedDate])

  // Verificar días especiales y cancelaciones cuando cambia turno o fecha
  useEffect(() => {
    if (!selectedShift || !selectedDate || dateError) {
      setVerificacion(null)
      return
    }
    setLoadingVerificacion(true)
    attendanceApi.verificar(selectedShift, selectedDate)
      .then(setVerificacion)
      .catch(() => setVerificacion(null))
      .finally(() => setLoadingVerificacion(false))
  }, [selectedShift, selectedDate, dateError])

  // Cargar clientes inscriptos cuando cambia el turno
  useEffect(() => {
    if (!selectedShift) return
    setLoadingClients(true)
    inscripcionesApi.getByTurno(selectedShift)
      .then(inscripciones => {
        const inscriptos: ClientEntry[] = inscripciones
          .filter(i => i.estado === 'ACTIVA')
          .map(i => ({ id: i.clienteId, name: i.clienteNombre, esReposicion: false }))
        setClients(prev => {
          const reps = prev.filter(c => c.esReposicion)
          const inscriptosIds = new Set(inscriptos.map(c => c.id))
          return [...inscriptos, ...reps.filter(c => !inscriptosIds.has(c.id))]
        })
      })
      .catch(() => addToast('Error al cargar clientes del turno', 'error'))
      .finally(() => setLoadingClients(false))
  }, [selectedShift])

  // Cargar recuperaciones PENDIENTES cuando cambia turno o fecha
  useEffect(() => {
    if (!selectedShift || !selectedDate) return
    setLoadingRecuperaciones(true)
    reposicionesApi.getByTurnoFecha(selectedShift, selectedDate)
      .then(recuperaciones => {
        const repClients: ClientEntry[] = recuperaciones
          .filter(r => r.estado === 'PENDIENTE')
          .map(r => ({
            id: r.clienteId,
            name: `${r.cliente.nombre} ${r.cliente.apellido}`,
            esReposicion: true,
          }))
        setClients(prev => {
          const inscriptos = prev.filter(c => !c.esReposicion)
          const inscriptosIds = new Set(inscriptos.map(c => c.id))
          return [...inscriptos, ...repClients.filter(c => !inscriptosIds.has(c.id))]
        })
      })
      .catch(() => {/* silencioso */})
      .finally(() => setLoadingRecuperaciones(false))
  }, [selectedShift, selectedDate])

  // Cargar asistencia existente cuando cambia turno + fecha
  useEffect(() => {
    if (!selectedShift || !selectedDate) return
    fetchByShiftAndDate(selectedShift, selectedDate)
  }, [selectedShift, selectedDate])

  // Sincronizar states con registros del backend
  useEffect(() => {
    const next: Record<string, AttendanceState> = {}
    for (const r of records) {
      next[r.clientId] = r.present ? 'presente' : 'ausente'
    }
    setStates(next)
  }, [records])

  function getState(clientId: string): AttendanceState {
    return states[clientId] ?? 'ausente'
  }

  function setState(clientId: string, value: AttendanceState) {
    setStates(prev => ({ ...prev, [clientId]: value }))
  }

  // El botón guardar está bloqueado si hay error de día, verificación bloqueada, o cargando
  const guardadoBloqueado = !!dateError || loadingVerificacion || (verificacion?.bloqueado ?? false)

  async function saveAttendance() {
    if (!selectedShift || guardadoBloqueado) return
    setIsSaving(true)
    try {
      const presentIds = clients.filter(c => getState(c.id) === 'presente').map(c => c.id)
      const conAvisoIds = clients
        .filter(c => !c.esReposicion && getState(c.id) === 'con_aviso')
        .map(c => c.id)

      await attendanceApi.bulk(selectedShift, selectedDate, presentIds, conAvisoIds)
      await fetchByShiftAndDate(selectedShift, selectedDate)

      const conAvisoCount = conAvisoIds.length
      if (verificacion?.tipo === 'HORARIO_REDUCIDO') {
        addToast('Asistencia guardada (horario reducido)', 'success')
      } else if (conAvisoCount > 0) {
        addToast(
          `Asistencia guardada · ${conAvisoCount} ausencia${conAvisoCount > 1 ? 's' : ''} con crédito generada${conAvisoCount > 1 ? 's' : ''}`,
          'success',
        )
      } else {
        addToast('Asistencia guardada correctamente', 'success')
      }
    } catch (err) {
      const axiosData = (err as { response?: { data?: { message?: string } } })?.response?.data
      const msg = axiosData?.message ?? 'Error al guardar la asistencia'
      addToast(msg, 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const visibleShifts = (isProfesor && profesorId)
    ? shifts.filter(s => s.profesorSalaAId === profesorId || s.profesorSalaBId === profesorId)
    : shifts

  const shiftOptions = visibleShifts.map(s => ({
    value: String(s.id),
    label: `${s.startTime}–${s.endTime} Sala ${s.room} (${s.days.map(d => DAY_LABELS[d].slice(0, 3)).join('/')})`,
  }))

  // Conteos para el header
  const presentCount   = clients.filter(c => getState(c.id) === 'presente').length
  const conAvisoCount  = clients.filter(c => !c.esReposicion && getState(c.id) === 'con_aviso').length
  const reposCount     = clients.filter(c => c.esReposicion).length

  const mostrarLista = selectedShift && !dateError && !verificacion?.bloqueado

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-4 lg:space-y-6"
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <ClipboardCheck size={20} className="text-primary" />
        </div>
        <h1 className="text-2xl lg:text-3xl xl:text-4xl font-black tracking-tighter text-gray-900 dark:text-white drop-shadow-sm">
          Asistencia
        </h1>
      </div>

      {/* Selectores */}
      <div className="rounded-[2rem] border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-3xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)] p-6 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {loadingShifts ? (
            <Skeleton className="h-10 rounded-lg" />
          ) : (
            <Select
              label="Turno"
              placeholder="Seleccioná un turno"
              options={shiftOptions}
              value={selectedShift}
              onChange={e => setSelectedShift(e.target.value)}
              labelClassName="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-[#8A8A9A] ml-1 mb-1.5 block"
              className="!h-10 !py-2 !rounded-xl !text-xs !font-semibold border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-xl text-gray-800 dark:text-gray-200 focus:border-primary"
            />
          )}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-[#8A8A9A] ml-1 mb-1.5 block">Fecha</label>
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="w-full rounded-xl border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-xl px-3.5 py-2 text-xs font-semibold text-gray-800 dark:text-gray-200 focus:outline-none h-10"
            />
          </div>
        </div>

        {selectedShiftData && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#8A8A9A]">
            <span>Sala {selectedShiftData.room}</span>
            <span>·</span>
            <span>{selectedShiftData.startTime}–{selectedShiftData.endTime}</span>
            <span>·</span>
            <span>{selectedShiftData.days.map(d => DAY_LABELS[d]).join(' / ')}</span>
            <span>·</span>
            <span>Cupo: {selectedShiftData.enrolled}/{selectedShiftData.capacity}</span>
          </div>
        )}

        {/* Banners de alerta */}
        <AnimatePresence mode="wait">
          {dateError && (
            <motion.div
              key="date-error"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="flex items-center gap-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-3 text-sm text-amber-400"
            >
              <AlertTriangle size={16} className="shrink-0" />
              <span>{dateError}</span>
            </motion.div>
          )}

          {!dateError && loadingVerificacion && (
            <motion.div
              key="loading-verif"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 text-xs text-[#8A8A9A]"
            >
              <DotsLoader size="sm" className="flex items-center" />
              Verificando disponibilidad...
            </motion.div>
          )}

          {!dateError && !loadingVerificacion && verificacion && verificacion.tipo && (
            <AlertaBanner key="verif-banner" verificacion={verificacion} />
          )}
        </AnimatePresence>
      </div>

      {/* Lista de asistencia */}
      {mostrarLista && (
        <div className="rounded-[2rem] border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-3xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)] overflow-hidden">

          {/* Header de la lista */}
          <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4 gap-4 flex-wrap">
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-white">Lista de clientes</h2>
              {!loadingClients && (
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-xs text-green-400 font-medium">{presentCount} presente{presentCount !== 1 ? 's' : ''}</span>
                  {conAvisoCount > 0 && (
                    <span className="text-xs text-amber-400 font-medium flex items-center gap-1">
                      <Bell size={10} />
                      {conAvisoCount} con aviso
                    </span>
                  )}
                  {reposCount > 0 && (
                    <span className="text-xs font-medium flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-amber-400">
                      {reposCount} repos.
                    </span>
                  )}
                  {loadingRecuperaciones && (
                    <RefreshCw size={10} className="animate-spin text-[#8A8A9A]" />
                  )}
                </div>
              )}
            </div>
            <motion.button
              onClick={saveAttendance}
              disabled={isSaving || guardadoBloqueado}
              whileTap={{ scale: 0.96 }}
              className="flex items-center gap-2 rounded-xl btn-action px-4 py-2.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            >
              {isSaving
                ? <DotsLoader size="sm" className="flex items-center" />
                : <CheckCircle2 size={14} />
              }
              Guardar asistencia
            </motion.button>
          </div>

          {/* Leyenda */}
          {!loadingClients && clients.length > 0 && (
            <div className="flex items-center gap-4 px-5 py-2.5 border-b border-white/[0.04] bg-white/[0.02] dark:bg-black/10">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#8A8A9A]">Estado por cliente →</span>
              <span className="flex items-center gap-1 text-[10px] text-green-400 font-semibold">● Presente</span>
              <span className="flex items-center gap-1 text-[10px] text-red-400 font-semibold">● Ausente</span>
              <span className="flex items-center gap-1 text-[10px] text-amber-400 font-semibold">
                <Bell size={9} /> Con aviso → genera crédito
              </span>
            </div>
          )}

          {/* Contenido */}
          {loadingAttendance || loadingClients ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-xl" />
              ))}
            </div>
          ) : clients.length === 0 ? (
            <div className="py-12 text-center text-[#8A8A9A] text-sm">
              No hay clientes activos inscriptos en este turno
            </div>
          ) : (
            <motion.div
              className="divide-y divide-white/[0.04]"
              variants={staggerContainerFast}
              initial="initial"
              animate="animate"
            >
              {clients.map(client => {
                const state = getState(client.id)
                return (
                  <motion.div
                    key={client.id}
                    variants={fadeUpItem}
                    className="flex items-center gap-3 px-5 py-3.5 hover:bg-white/[0.03] dark:hover:bg-white/[0.02] transition-colors"
                  >
                    {/* Avatar inicial */}
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors duration-200 ${
                      state === 'presente'
                        ? 'bg-green-500/20 text-green-400'
                        : state === 'con_aviso'
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'bg-white/[0.06] text-[#8A8A9A]'
                    }`}>
                      {client.name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()}
                    </div>

                    {/* Nombre + badge reposición */}
                    <div className="flex-1 min-w-0 flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{client.name}</p>
                      {client.esReposicion && (
                        <span className="shrink-0 rounded-full bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-400">
                          Repos.
                        </span>
                      )}
                    </div>

                    {/* Toggle 3 estados */}
                    <StateToggle
                      value={state}
                      onChange={v => setState(client.id, v)}
                      esReposicion={client.esReposicion}
                    />
                  </motion.div>
                )
              })}
            </motion.div>
          )}
        </div>
      )}

      {/* Estado vacío: bloqueo duro activo */}
      {selectedShift && !dateError && verificacion?.bloqueado && (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-[#8A8A9A]">
          <XCircle size={36} className="text-red-500/50" />
          <p className="text-sm text-center max-w-xs">
            No es posible registrar asistencia para esta combinación de turno y fecha.
          </p>
        </div>
      )}

      {/* Estado vacío: sin turno seleccionado */}
      {!selectedShift && (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-[#8A8A9A]">
          <ClipboardCheck size={36} />
          <p className="text-sm">Seleccioná un turno y una fecha para registrar la asistencia</p>
        </div>
      )}
    </motion.div>
  )
}
