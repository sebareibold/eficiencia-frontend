import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { staggerContainerFast, fadeUpItem } from '../lib/motion'
import DotsLoader from '../components/ui/DotsLoader'
import { ClipboardCheck, CheckCircle2, AlertTriangle, XCircle, Clock } from 'lucide-react'
import { format } from 'date-fns'
import { useShifts } from '../hooks/useShifts'
import { useAttendance } from '../hooks/useAttendance'
import { attendanceApi } from '../api/attendance.api'
import type { VerificacionFecha } from '../api/attendance.api'
import { inscripcionesApi } from '../api/inscripciones.api'
import { useUiStore } from '../store/uiStore'
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

// ─── Página principal ─────────────────────────────────────────────────────────

export default function AttendancePage() {
  const { shifts, isLoading: loadingShifts } = useShifts()
  const { records, isLoading: loadingAttendance, fetchByShiftAndDate } = useAttendance()
  const addToast = useUiStore(s => s.addToast)

  const [selectedShift, setSelectedShift] = useState('')
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [clients, setClients] = useState<{ id: string; name: string }[]>([])
  const [present, setPresent] = useState<Set<string>>(new Set())
  const [isSaving, setIsSaving] = useState(false)
  const [loadingClients, setLoadingClients] = useState(false)

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
      .then(inscripciones =>
        setClients(
          inscripciones
            .filter(i => i.estado === 'ACTIVA')
            .map(i => ({ id: i.clienteId, name: i.clienteNombre }))
        )
      )
      .catch(() => addToast('Error al cargar clientes del turno', 'error'))
      .finally(() => setLoadingClients(false))
  }, [selectedShift])

  // Cargar asistencia existente cuando cambia turno + fecha
  useEffect(() => {
    if (!selectedShift || !selectedDate) return
    fetchByShiftAndDate(selectedShift, selectedDate)
  }, [selectedShift, selectedDate])

  // Sincronizar checkboxes con registros del backend
  useEffect(() => {
    const presentIds = new Set(records.filter(r => r.present).map(r => r.clientId))
    setPresent(presentIds)
  }, [records])

  function toggle(clientId: string) {
    setPresent(prev => {
      const next = new Set(prev)
      if (next.has(clientId)) next.delete(clientId)
      else next.add(clientId)
      return next
    })
  }

  // El botón guardar está bloqueado si hay error de día, verificación bloqueada, o cargando
  const guardadoBloqueado = !!dateError || loadingVerificacion || (verificacion?.bloqueado ?? false)

  async function saveAttendance() {
    if (!selectedShift || guardadoBloqueado) return
    setIsSaving(true)
    try {
      const presentIds = clients.filter(c => present.has(c.id)).map(c => c.id)
      await attendanceApi.bulk(selectedShift, selectedDate, presentIds)
      await fetchByShiftAndDate(selectedShift, selectedDate)
      if (verificacion?.tipo === 'HORARIO_REDUCIDO') {
        addToast('Asistencia guardada (horario reducido)', 'success')
      } else {
        addToast('Asistencia guardada correctamente', 'success')
      }
    } catch (err) {
      // El backend devuelve el motivo en el mensaje del error 409
      const axiosData = (err as { response?: { data?: { message?: string } } })?.response?.data
      const msg = axiosData?.message ?? 'Error al guardar la asistencia'
      addToast(msg, 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const shiftOptions = shifts.map(s => ({
    value: String(s.id),
    label: `${s.startTime}–${s.endTime} Sala ${s.room} (${s.days.map(d => DAY_LABELS[d].slice(0, 3)).join('/')})`,
  }))

  // Mostrar la lista de asistencia solo si no hay bloqueo duro (CIERRE_TOTAL o CANCELACION)
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
      <div
        className="rounded-[2rem] border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-3xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)] p-6 space-y-4"
      >
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

        {/* Banners de alerta — en orden de prioridad */}
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
        <div
          className="rounded-[2rem] border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-3xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)] overflow-hidden"
        >
          <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
            <div>
              <h2 className="font-semibold text-white">Lista de clientes</h2>
              {!loadingClients && (
                <p className="text-xs text-[#8A8A9A] mt-0.5">
                  {present.size} presente{present.size !== 1 ? 's' : ''} de {clients.length}
                </p>
              )}
            </div>
            <motion.button
              onClick={saveAttendance}
              disabled={isSaving || guardadoBloqueado}
              whileTap={{ scale: 0.96 }}
              className="flex items-center gap-2 rounded-xl btn-action px-4 py-2.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving
                ? <DotsLoader size="sm" className="flex items-center" />
                : <CheckCircle2 size={14} />
              }
              Guardar asistencia
            </motion.button>
          </div>

          {loadingAttendance || loadingClients ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-12 rounded-xl" />
              ))}
            </div>
          ) : clients.length === 0 ? (
            <div className="py-12 text-center text-[#8A8A9A] text-sm">
              No hay clientes activos inscriptos en este turno
            </div>
          ) : (
            <motion.div className="divide-y divide-white/[0.04]" variants={staggerContainerFast} initial="initial" animate="animate">
              {clients.map(client => {
                const isPresent = present.has(client.id)
                return (
                  <motion.label
                    key={client.id}
                    variants={fadeUpItem}
                    className="flex cursor-pointer items-center gap-4 px-5 py-3.5 hover:bg-white/[0.04] transition-colors"
                  >
                    <motion.div
                      animate={{ scale: isPresent ? 1 : 0.9, opacity: isPresent ? 1 : 0.5 }}
                      transition={{ duration: 0.12, ease: [0.22, 1, 0.36, 1] }}
                      className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border-2 transition-colors ${
                        isPresent ? 'border-primary bg-primary' : 'border-white/20 bg-transparent'
                      }`}
                    >
                      <AnimatePresence>
                        {isPresent && (
                          <motion.svg
                            key="check"
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0, opacity: 0 }}
                            transition={{ duration: 0.12, ease: [0.22, 1, 0.36, 1] }}
                            width="10" height="8" viewBox="0 0 10 8" fill="none"
                          >
                            <path d="M1 4L3.5 6.5L9 1" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </motion.svg>
                        )}
                      </AnimatePresence>
                    </motion.div>
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={isPresent}
                      onChange={() => toggle(client.id)}
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-white">{client.name}</p>
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      isPresent ? 'bg-green-500/10 text-green-400' : 'bg-white/[0.06] text-[#8A8A9A]'
                    }`}>
                      {isPresent ? 'Presente' : 'Ausente'}
                    </span>
                  </motion.label>
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
