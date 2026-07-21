import { useEffect, useState } from 'react'
import { notificacionesApi } from '../api/notificaciones.api'

// Cache a nivel de módulo: solo se fetcha una vez por sesión.
// Todas las páginas que monten el hook después de la primera comparten el mismo resultado.
let _cache: Record<string, string> | null = null
let _promise: Promise<Record<string, string>> | null = null

function fetchTemplates(): Promise<Record<string, string>> {
  if (!_promise) {
    _promise = notificacionesApi
      .getPlantillasWhatsapp()
      .then(data => {
        const map: Record<string, string> = {}
        data.forEach(p => { if (p.activo) map[p.tipo] = p.cuerpo })
        _cache = map
        return map
      })
      .catch(() => {
        _promise = null // permitir reintento si falló
        _cache = {}
        return {}
      })
  }
  return _promise
}

/**
 * Devuelve { templates, loaded }:
 * - templates: mapa tipo → cuerpo solo para plantillas activas
 * - loaded: true cuando ya se resolvió la llamada (evita flicker de columnas)
 * Primera navegación hace fetch; las siguientes usan cache en memoria.
 */
export function useWhatsappTemplates() {
  const [templates, setTemplates] = useState<Record<string, string>>(_cache ?? {})
  const [loaded, setLoaded] = useState(_cache !== null)

  useEffect(() => {
    if (_cache !== null) return // ya en cache, no hace nada
    fetchTemplates().then(map => {
      setTemplates(map)
      setLoaded(true)
    })
  }, [])

  return { templates, loaded }
}
