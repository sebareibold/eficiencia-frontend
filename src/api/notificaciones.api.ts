import api from './axiosInstance'

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
}
