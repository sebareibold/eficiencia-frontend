export type EstadoEspera = 'PENDIENTE' | 'NOTIFICADO' | 'ACEPTADO' | 'RECHAZADO'
export type TipoEspera = 'INTERNA' | 'EXTERNA'

export interface ListaEsperaEntry {
  id: string
  clienteId: string | null
  turnoId: string
  tipo: TipoEspera
  fechaSolicitud: string
  estado: EstadoEspera
  clienteNombre: string
  whatsappExterno: string | null
}

export interface PendienteSolicitudEntry {
  id: string
  clienteId: string | null
  turnoId: string
  tipo: TipoEspera
  estado: EstadoEspera
  fechaSolicitud: string
  clienteNombre: string
  whatsappExterno: string | null
  turnoHoraInicio: string
  turnoHoraFin: string
  turnoDias: string[]
}
