import api from './axiosInstance'

export interface ConfiguracionSistema {
  id: string
  diasGraciaInactivacion: number
  horaEjecucionCron: number
}

export const configuracionSistemaApi = {
  get: (): Promise<ConfiguracionSistema> =>
    api.get('/configuracion-sistema').then(r => r.data),

  update: (dto: Partial<Pick<ConfiguracionSistema, 'diasGraciaInactivacion' | 'horaEjecucionCron'>>): Promise<ConfiguracionSistema> =>
    api.patch('/configuracion-sistema', dto).then(r => r.data),
}
