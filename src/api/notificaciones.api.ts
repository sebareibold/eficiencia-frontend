import api from './axiosInstance'

export interface VariableSimple {
  campo: string
  descripcion: string
  ejemplo: string
}

export interface PlantillaSistema {
  id: string
  tipo: string
  nombre: string
  asunto: string
  cuerpo: string
  colorAcento?: string
  colorCuerpo?: string
  colorFooter?: string
  colorLogo?: string
  logoInvertido?: boolean
  variables: VariableSimple[]
  variablesDisponibles?: VariableSimple[]
  updatedAt: string
}

export const notificacionesApi = {
  probar: (tipo: string): Promise<{ enviado: boolean; destino: string }> =>
    api.post(`/notificaciones/probar/${tipo}`).then(r => r.data),

  enviarResumenAhora: (): Promise<{ enviado: boolean; destino: string; mensaje: string }> =>
    api.post('/notificaciones/enviar-resumen-ahora').then(r => r.data),

  conteoEmails: (): Promise<{
    hoy: number
    esteMes: number
    limites: { diario: number; mensual: number }
    desglose: { tipo: string; count: number }[]
  }> => api.get('/notificaciones/conteo-emails').then(r => r.data),

  // Plantillas del sistema
  getPlantillasSistema: (): Promise<PlantillaSistema[]> =>
    api.get('/notificaciones/plantillas-sistema').then(r => r.data),

  getPlantillaSistema: (tipo: string): Promise<PlantillaSistema> =>
    api.get(`/notificaciones/plantillas-sistema/${tipo}`).then(r => r.data),

  updatePlantillaSistema: (tipo: string, data: { asunto?: string; cuerpo?: string; colorAcento?: string; colorCuerpo?: string; colorFooter?: string; colorLogo?: string; logoInvertido?: boolean }): Promise<PlantillaSistema> =>
    api.patch(`/notificaciones/plantillas-sistema/${tipo}`, data).then(r => r.data),

  probarPlantillaSistema: (tipo: string, override?: { asunto?: string; cuerpo?: string }): Promise<{ enviado: boolean; destino: string }> =>
    api.post(`/notificaciones/plantillas-sistema/${tipo}/probar`, override ?? {}).then(r => r.data),
}
