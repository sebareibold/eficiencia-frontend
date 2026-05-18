import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { ClipboardCheck, CheckCircle2, AlertTriangle } from 'lucide-react'
import { format } from 'date-fns'
import { useShifts } from '../hooks/useShifts'
import { useAttendance } from '../hooks/useAttendance'
import { attendanceApi } from '../api/attendance.api'
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

  const selectedShiftData = shifts.find(s => String(s.id) === selectedShift)

  // Validación: la fecha seleccionada debe coincidir con un día del turno
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

  // Cuando cambia el turno, cargar los clientes inscriptos activos
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

  // Cuando cambia turno + fecha, cargar asistencia existente
  useEffect(() => {
    if (!selectedShift || !selectedDate) return
    fetchByShiftAndDate(selectedShift, selectedDate)
  }, [selectedShift, selectedDate])

  // Sincronizar checkboxes con los registros cargados del backend
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

  async function saveAttendance() {
    if (!selectedShift || dateError) return
    setIsSaving(true)
    try {
      const presentIds = clients.filter(c => present.has(c.id)).map(c => c.id)
      await attendanceApi.bulk(selectedShift, selectedDate, presentIds)
      await fetchByShiftAndDate(selectedShift, selectedDate)
      addToast('Asistencia guardada correctamente', 'success')
    } catch {
      addToast('Error al guardar la asistencia', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const shiftOptions = shifts.map(s => ({
    value: String(s.id),
    label: `${s.startTime}–${s.endTime} Sala ${s.room} (${s.days.map(d => DAY_LABELS[d].slice(0, 3)).join('/')})`,
  }))

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <ClipboardCheck size={20} className="text-primary" />
        </div>
        <h1 className="text-3xl md:text-4xl font-black tracking-tighter text-gray-900 dark:text-white drop-shadow-sm">
          Asistencia
        </h1>
      </div>

      {/* Selectors */}
      <div
        className="rounded-2xl border border-white/[0.08] p-5 space-y-4"
        style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(12px)' }}
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
            />
          )}
          <div className="flex flex-col gap-1">
            <label className="text-sm text-[#9CA3AF]">Fecha</label>
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
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

        {/* Aviso de fecha inválida */}
        {dateError && (
          <div className="flex items-center gap-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-3 text-sm text-amber-400">
            <AlertTriangle size={16} className="shrink-0" />
            <span>{dateError}</span>
          </div>
        )}
      </div>

      {/* Lista de asistencia — solo si la fecha es válida */}
      {selectedShift && !dateError && (
        <div
          className="rounded-2xl border border-white/[0.08] overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(12px)' }}
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
            <button
              onClick={saveAttendance}
              disabled={isSaving}
              className="flex items-center gap-2 rounded-xl btn-action px-4 py-2.5 text-sm disabled:opacity-50"
            >
              {isSaving
                ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-900/30 border-t-gray-900" />
                : <CheckCircle2 size={14} />
              }
              Guardar asistencia
            </button>
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
            <div className="divide-y divide-white/[0.04]">
              {clients.map(client => {
                const isPresent = present.has(client.id)
                return (
                  <label
                    key={client.id}
                    className="flex cursor-pointer items-center gap-4 px-5 py-3.5 hover:bg-white/[0.04] transition-colors"
                  >
                    <div className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border-2 transition-colors ${
                      isPresent ? 'border-primary bg-primary' : 'border-white/20 bg-transparent'
                    }`}>
                      {isPresent && (
                        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                          <path d="M1 4L3.5 6.5L9 1" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
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
                  </label>
                )
              })}
            </div>
          )}
        </div>
      )}

      {!selectedShift && (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-[#8A8A9A]">
          <ClipboardCheck size={36} />
          <p className="text-sm">Seleccioná un turno y una fecha para registrar la asistencia</p>
        </div>
      )}
    </motion.div>
  )
}
