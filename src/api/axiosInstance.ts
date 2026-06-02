import axios from 'axios'
import { useAuthStore } from '../store/authStore'
import { useUiStore } from '../store/uiStore'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 30_000,
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

      const { refreshToken, setTokens, logout } = useAuthStore.getState()

      if (!refreshToken) {
        logout()
        window.location.href = '/login'
        return Promise.reject(error)
      }

      try {
        const { data } = await axios.post(`${import.meta.env.VITE_API_URL}/auth/refresh`, {
          refreshToken,
        })
        // El refresh endpoint también está envuelto
        const tokens = data?.data ?? data
        setTokens(tokens.accessToken, tokens.refreshToken ?? refreshToken)
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
