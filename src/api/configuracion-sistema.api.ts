import api from './axiosInstance'

export interface ConfiguracionSistema {
  id: string
  diasGraciaInactivacion: number
  horaEjecucionCron: number
  resumenAutomatico: boolean
  resumenFrecuencia: 'DAILY' | 'WEEKLY' | 'MONTHLY'
  resumenDiaSemana: number | null
  resumenDiaMes: number | null
  resumenHora: number
}

export const configuracionSistemaApi = {
  get: (): Promise<ConfiguracionSistema> =>
    api.get('/configuracion-sistema').then(r => r.data),

  update: (dto: Partial<Omit<ConfiguracionSistema, 'id'>>): Promise<ConfiguracionSistema> =>
    api.patch('/configuracion-sistema', dto).then(r => r.data),
}
