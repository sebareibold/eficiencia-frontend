import api from './axiosInstance'

export type InscripcionEntry = {
  id: string
  clienteId: string
  clienteNombre: string
  sala: 'A' | 'B'
  fechaDesde: string
  estado: 'ACTIVA' | 'BAJA'
}

export type InscripcionClienteEntry = {
  id: string
  turnoId: string
  sala: 'A' | 'B'
  fechaDesde: string
  horaInicio: string
  horaFin: string
  dias: string[]
}

function mapInscripcion(i: any): InscripcionEntry {
  return {
    id: String(i.id),
    clienteId: String(i.clienteId),
    clienteNombre: i.cliente ? `${i.cliente.nombre} ${i.cliente.apellido}` : 'Cliente desconocido',
    sala: i.sala === 'B' ? 'B' : 'A',
    fechaDesde: i.fechaDesde,
    estado: i.estado,
  }
}

function mapInscripcionCliente(i: any): InscripcionClienteEntry {
  return {
    id: String(i.id),
    turnoId: String(i.turnoId),
    sala: i.sala === 'B' ? 'B' : 'A',
    fechaDesde: i.fechaDesde,
    horaInicio: i.turno?.horaInicio ?? '',
    horaFin: i.turno?.horaFin ?? '',
    dias: Array.isArray(i.turno?.diasSemana) ? i.turno.diasSemana : [],
  }
}

export const inscripcionesApi = {
  getByTurno: (turnoId: string): Promise<InscripcionEntry[]> =>
    api.get('/inscripciones', { params: { turnoId } }).then(r =>
      (Array.isArray(r.data) ? r.data : []).map(mapInscripcion)
    ),

  getByCliente: (clienteId: string): Promise<InscripcionClienteEntry[]> =>
    api.get('/inscripciones', { params: { clienteId } }).then(r =>
      (Array.isArray(r.data) ? r.data : []).map(mapInscripcionCliente)
    ),

  enroll: (clienteId: string, turnoId: string, sala: 'A' | 'B'): Promise<{ enListaEspera: boolean }> =>
    api.post('/inscripciones', { clienteId, turnoId, sala }).then(r => ({
      enListaEspera: r.data?.enListaEspera === true,
    })),

  cambiarSala: (id: string, sala: 'A' | 'B'): Promise<void> =>
    api.patch(`/inscripciones/${id}/sala`, { sala }),

  darDeBaja: (id: string): Promise<void> =>
    api.patch(`/inscripciones/${id}/baja`),
}
