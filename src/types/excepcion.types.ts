export interface ExcepcionTurno {
  id: string
  turnoId: string
  fecha: string        // YYYY-MM-DD
  horaInicio: string | null
  horaFin: string | null
  profesorId: string | null
  profesorNombre: string | null
  motivo: string | null
}
