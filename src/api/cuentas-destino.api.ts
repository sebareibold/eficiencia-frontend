import api from './axiosInstance'

export interface CuentaDestino {
  id: string
  nombre: string
  alias: string | null
  cbu: string | null
  banco: string | null
  activa: boolean
  createdAt: string
}

export interface CreateCuentaDestinoDto {
  nombre: string
  alias?: string
  cbu?: string
  banco?: string
  activa?: boolean
}

export type UpdateCuentaDestinoDto = Partial<CreateCuentaDestinoDto>

export const cuentasDestinoApi = {
  getAll: (): Promise<CuentaDestino[]> =>
    api.get('/cuentas-destino').then(r => r.data),

  getById: (id: string): Promise<CuentaDestino> =>
    api.get(`/cuentas-destino/${id}`).then(r => r.data),

  create: (dto: CreateCuentaDestinoDto): Promise<CuentaDestino> =>
    api.post('/cuentas-destino', dto).then(r => r.data),

  update: (id: string, dto: UpdateCuentaDestinoDto): Promise<CuentaDestino> =>
    api.patch(`/cuentas-destino/${id}`, dto).then(r => r.data),

  remove: (id: string): Promise<void> =>
    api.delete(`/cuentas-destino/${id}`),
}
