import api from './axiosInstance'

export interface ConfiguracionData {
  tema: string
  accentColor: string
  density: string
}

export const configuracionApi = {
  get: (): Promise<ConfiguracionData> =>
    api.get('/configuracion').then(r => r.data),

  update: (data: Partial<ConfiguracionData>): Promise<ConfiguracionData> =>
    api.patch('/configuracion', data).then(r => r.data),
}
