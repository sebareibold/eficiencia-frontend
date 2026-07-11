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
