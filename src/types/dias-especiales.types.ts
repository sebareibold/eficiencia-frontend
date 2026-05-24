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
