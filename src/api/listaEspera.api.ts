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
  let clienteNombre: string
  if (e.cliente) {
    clienteNombre = `${e.cliente.nombre} ${e.cliente.apellido}`
  } else if (e.nombreExterno) {
    clienteNombre = `${e.nombreExterno} ${e.apellidoExterno ?? ''}`.trim()
  } else {
    clienteNombre = e.clienteNombre ?? 'Contacto externo'
  }
  return {
    id: String(e.id),
    clienteId: e.clienteId ? String(e.clienteId) : null,
    turnoId: String(e.turnoId),
    tipo: e.tipo,
    fechaSolicitud: e.fechaSolicitud,
    estado: e.estado,
    clienteNombre,
    whatsappExterno: e.whatsappExterno ?? null,
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

  create: (
    turnoId: string,
    tipo: TipoEspera,
    clienteId?: string,
    externo?: { nombreExterno: string; apellidoExterno: string; whatsappExterno: string },
  ): Promise<ListaEsperaEntry> =>
    api.post('/lista-espera', {
      turnoId,
      tipo,
      ...(clienteId ? { clienteId } : {}),
      ...externo,
    }).then(r => mapEntry(r.data)),

  updateEstado: (id: string, estado: EstadoEspera): Promise<ListaEsperaEntry> =>
    api.patch(`/lista-espera/${id}`, { estado }).then(r => mapEntry(r.data)),

  updateExterno: (id: string, data: { nombreExterno: string; apellidoExterno: string; whatsappExterno: string }): Promise<ListaEsperaEntry> =>
    api.patch(`/lista-espera/${id}`, data).then(r => mapEntry(r.data)),

  remove: (id: string): Promise<void> =>
    api.delete(`/lista-espera/${id}`),
}
