export type TipoDiaEspecial = 'CIERRE_TOTAL' | 'HORARIO_REDUCIDO'

export interface DiaEspecial {
  id: string
  fecha: string
  tipo: TipoDiaEspecial
  motivo?: string
  horaDesde?: string
  horaHasta?: string
  createdAt: string
}

export interface TurnoPreviewWizard {
  id: string
  horaInicio: string
  horaFin: string
  cupoMaximoSalaA: number
  cupoMaximoSalaB: number
  profesorSalaAId: string | null
  profesorSalaBId: string | null
  profesorSalaA: { id: string; usuario: { nombre: string } } | null
  profesorSalaB: { id: string; usuario: { nombre: string } } | null
}

export interface WizardResult {
  diaEspecial: DiaEspecial
  excepcionesCreadas: number
  turnosCreados: number
  cancelacionesCreadas: number
  turnosAfectados: { id: string; horaInicio: string; horaFin: string }[]
}
