import axios from 'axios'
import { useAuthStore } from '../store/authStore'
import { useUiStore } from '../store/uiStore'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 30_000,
  withCredentials: true, // envía la cookie HttpOnly del refreshToken en requests /auth/*
})

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

let isRefreshing = false
let failedQueue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = []

function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error)
    else prom.resolve(token!)
  })
  failedQueue = []
}

const SERVER_DOWN_STATUSES = [502, 503, 504]

const MODULO_LABELS: Record<string, string> = {
  clients:      'clientes',
  payments:     'pagos',
  shifts:       'turnos',
  attendance:   'asistencia',
  expenses:     'gastos',
  memberships:  'membresías',
  dashboard:    'el dashboard',
  users:        'usuarios',
  rutinas:      'rutinas',
  exercises:    'ejercicios',
  plantillas:   'plantillas',
  reposiciones: 'reposiciones',
}

const ACCION_LABELS: Record<string, string> = {
  read:   'ver',
  create: 'crear',
  update: 'editar',
  delete: 'eliminar',
  mark:   'marcar',
}

function buildPermisoMessage(modulo?: string, accion?: string): string {
  if (!modulo || !accion) return 'No tenés permisos para realizar esta acción'
  if (accion === 'mark') return 'No tenés permisos para marcar asistencia'
  const moduloLabel = MODULO_LABELS[modulo] ?? modulo
  const accionLabel = ACCION_LABELS[accion] ?? accion
  return `No tenés permisos para ${accionLabel} ${moduloLabel}`
}

api.interceptors.response.use(
  (response) => {
    // Si había un error de servidor, lo limpiamos al recibir cualquier respuesta exitosa
    useUiStore.getState().setServerDown(false)

    // Desenvuelve el wrapper { data, message, statusCode } que aplica el backend globalmente
    if (
      response.data &&
      typeof response.data === 'object' &&
      'data' in response.data &&
      'message' in response.data &&
      'statusCode' in response.data
    ) {
      response.data = response.data.data
    }
    return response
  },
  async (error) => {
    const originalRequest = error.config

    // Sin respuesta (ECONNREFUSED, timeout de red) o gateway errors → servidor caído
    if (!error.response || SERVER_DOWN_STATUSES.includes(error.response.status)) {
      useUiStore.getState().setServerDown(true)
    }

    if (error.response?.status === 403) {
      const { modulo, accion } = (error.response.data ?? {}) as { modulo?: string; accion?: string }
      const msg = buildPermisoMessage(modulo, accion)
      console.error('[403 Forbidden]', { modulo, accion, url: originalRequest?.url })
      useUiStore.getState().addToast(msg, 'error', 6000)
    }

    if (error.response?.status === 401 && !originalRequest._retry && !originalRequest.url?.includes('/auth/login')) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`
          return api(originalRequest)
        })
      }

      originalRequest._retry = true
      isRefreshing = true

      const { setTokens, logout } = useAuthStore.getState()

      try {
        // refreshToken viaja como cookie HttpOnly — body vacío, withCredentials ya está en la instancia
        const { data } = await axios.post(
          `${import.meta.env.VITE_API_URL}/auth/refresh`,
          {},
          { withCredentials: true },
        )
        // El refresh endpoint también está envuelto
        const tokens = data?.data ?? data
        setTokens(tokens.accessToken)
        processQueue(null, tokens.accessToken)
        originalRequest.headers.Authorization = `Bearer ${tokens.accessToken}`
        return api(originalRequest)
      } catch (err) {
        processQueue(err, null)
        logout()
        window.location.href = '/login'
        return Promise.reject(err)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  },
)

export default api
