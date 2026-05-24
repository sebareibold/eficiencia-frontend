import api from './axiosInstance'
import type { EstadoEspera, TipoEspera, ListaEsperaEntry } from '../types/listaEspera.types'

export type ListaEsperaClienteEntry = {
  id: string
  turnoId: string
  tipo: TipoEspera
  fechaSolicitud: string
  estado: EstadoEspera
  horaInicio: string
  horaFin: string
  dias: string[]
}

function mapEntry(e: any): ListaEsperaEntry {
  return {
    id: String(e.id),
    clienteId: String(e.clienteId),
    turnoId: String(e.turnoId),
    tipo: e.tipo,
    fechaSolicitud: e.fechaSolicitud,
    estado: e.estado,
    clienteNombre: e.cliente
      ? `${e.cliente.nombre} ${e.cliente.apellido}`
      : (e.clienteNombre ?? 'Cliente desconocido'),
  }
}

function mapEntryCliente(e: any): ListaEsperaClienteEntry {
  return {
    id: String(e.id),
    turnoId: String(e.turnoId),
    tipo: e.tipo,
    fechaSolicitud: e.fechaSolicitud,
    estado: e.estado,
    horaInicio: e.turno?.horaInicio ?? '',
    horaFin: e.turno?.horaFin ?? '',
    dias: Array.isArray(e.turno?.diasSemana) ? e.turno.diasSemana : [],
  }
}

export const listaEsperaApi = {
  getByTurno: (turnoId: string): Promise<ListaEsperaEntry[]> =>
    api.get('/lista-espera', { params: { turnoId } }).then(r =>
      (Array.isArray(r.data) ? r.data : []).map(mapEntry)
    ),

  getByCliente: (clienteId: string): Promise<ListaEsperaClienteEntry[]> =>
    api.get('/lista-espera', { params: { clienteId } }).then(r =>
      (Array.isArray(r.data) ? r.data : []).map(mapEntryCliente)
    ),

  create: (clienteId: string, turnoId: string, tipo: TipoEspera): Promise<ListaEsperaEntry> =>
    api.post('/lista-espera', { clienteId, turnoId, tipo }).then(r => mapEntry(r.data)),

  updateEstado: (id: string, estado: EstadoEspera): Promise<ListaEsperaEntry> =>
    api.patch(`/lista-espera/${id}`, { estado }).then(r => mapEntry(r.data)),

  remove: (id: string): Promise<void> =>
    api.delete(`/lista-espera/${id}`),
}
