import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Search, Users } from 'lucide-react'
import api from '../api/axiosInstance'
import { shiftsApi } from '../api/shifts.api'
import { inscripcionesApi } from '../api/inscripciones.api'
import type { Client } from '../types/client.types'
import type { WeekDay } from '../types/shift.types'

// Emil: ease-out fuerte para entradas de UI
const EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1]

// ─── Helpers ──────────────────────────────────────────────────────────────────

const JS_DAY_TO_WEEKDAY: WeekDay[] = [
  'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday',
]

function parseMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface RecomendadoCliente {
  clienteId: string
  name: string
  lastName: string
  turnoLabel: string
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function EjecucionPage() {
  const navigate  = useNavigate()
  const searchRef = useRef<HTMLInputElement>(null)

  const [search, setSearch]         = useState('')
  const [results, setResults]       = useState<Client[]>([])
  const [searching, setSearching]   = useState(false)
  const [activeIdx, setActiveIdx]   = useState(-1)
  const [recomendados, setRecom]    = useState<RecomendadoCliente[]>([])
  const [loadingRecom, setLoadingR] = useState(true)

  // ── Clientes recomendados (turnos activos/próximos) ───────────────────────
  useEffect(() => {
    let cancelled = false

    async function loadRecomendados() {
      try {
        const turnos = await shiftsApi.getAll()
        const now    = new Date()
        const today  = JS_DAY_TO_WEEKDAY[now.getDay()]
        const nowMin = now.getHours() * 60 + now.getMinutes()

        const activos = turnos.filter(t => {
          if (!t.days.includes(today)) return false
          const start = parseMinutes(t.startTime)
          const end   = parseMinutes(t.endTime)
          // Ventana: 60 min antes del inicio hasta 30 min después del fin
          return nowMin >= start - 60 && nowMin <= end + 30
        })

        if (activos.length === 0) {
          if (!cancelled) setLoadingR(false)
          return
        }

        const resultados = await Promise.all(
          activos.map(async t => {
            const inscripciones = await inscripcionesApi.getByTurno(t.id as string)
            return inscripciones
              .filter(i => i.estado === 'ACTIVA')
              .map(i => {
                const parts    = i.clienteNombre.split(' ')
                const name     = parts[0] ?? ''
                const lastName = parts.slice(1).join(' ')
                return {
                  clienteId:   i.clienteId,
                  name,
                  lastName,
                  turnoLabel:  `${t.startTime} – ${t.endTime}`,
                } satisfies RecomendadoCliente
              })
          })
        )

        if (!cancelled) {
          // Deduplica por clienteId
          const seen  = new Set<string>()
          const lista = resultados.flat().filter(c => {
            if (seen.has(c.clienteId)) return false
            seen.add(c.clienteId)
            return true
          })
          setRecom(lista)
          setLoadingR(false)
        }
      } catch {
        if (!cancelled) setLoadingR(false)
      }
    }

    loadRecomendados()
    return () => { cancelled = true }
  }, [])

  // ── Scroll al top al montar ───────────────────────────────────────────────
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior }) }, [])

  // ── Buscador con debounce ─────────────────────────────────────────────────
  useEffect(() => {
    if (!search.trim()) { setResults([]); return }
    const t = setTimeout(async () => {
      setSearching(true)
      try {
        const r = await api.get('/clientes/buscar', { params: { q: search, limit: 8 } })
        const items: Array<{ id: string; nombre: string; apellido: string }> = r.data ?? []
        setResults(items.map(c => ({ id: c.id, name: c.nombre, lastName: c.apellido } as unknown as Client)))
      } catch { setResults([]) }
      finally { setSearching(false); setActiveIdx(-1) }
    }, 280)
    return () => clearTimeout(t)
  }, [search])

  const goToRutina = (clienteId: string, name: string, lastName: string) => {
    navigate(`/ejecucion/${clienteId}`, { state: { name, lastName } })
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (results.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx(i => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && activeIdx >= 0) {
      e.preventDefault()
      const c = results[activeIdx]
      goToRutina(c.id, c.name, c.lastName ?? '')
    }
  }

  return (
    <div className="flex flex-col items-center pt-[15vh] px-4 pb-12">
      <div className="w-full max-w-xl space-y-6">

        {/* Título */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.26, ease: EASE_OUT }}
          className="text-center space-y-1"
        >
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Registrar Entrenamiento</h1>
          <p className="text-sm text-gray-500 dark:text-white/40">Buscá tu nombre para ver tu rutina</p>
        </motion.div>

        {/* Buscador */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.26, delay: 0.06, ease: EASE_OUT }}
          className="relative rounded-2xl bg-white/30 dark:bg-white/[0.05] backdrop-blur-3xl border border-white/50 dark:border-white/[0.12] shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)] transition-colors focus-within:border-primary/50 focus-within:bg-white/50 dark:focus-within:bg-white/[0.07]"
        >
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-white/30 pointer-events-none" />
          <input
            ref={searchRef}
            autoFocus
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribí tu nombre o apellido..."
            className="w-full bg-transparent pl-12 pr-4 py-4 text-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/25 focus:outline-none rounded-2xl"
          />
          {searching && (
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-gray-400 dark:text-white/30">Buscando...</span>
          )}

          <AnimatePresence>
            {results.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                transition={{ duration: 0.18, ease: EASE_OUT }}
                className="absolute top-full left-0 right-0 mt-2 bg-white/50 dark:bg-black/30 backdrop-blur-3xl border border-white/60 dark:border-white/[0.10] rounded-2xl overflow-hidden z-20 shadow-2xl"
              >
                {results.map((c, i) => (
                  <button
                    key={c.id}
                    onClick={() => goToRutina(c.id, c.name, c.lastName ?? '')}
                    onMouseEnter={() => setActiveIdx(i)}
                    className={`w-full text-left px-5 py-4 transition-colors border-b border-white/30 dark:border-white/[0.05] last:border-0 flex items-center gap-4 active:scale-[0.99] ${i === activeIdx ? 'bg-white/40 dark:bg-white/[0.10]' : 'hover:bg-white/30 dark:hover:bg-white/[0.06]'}`}
                  >
                    <span className={`w-10 h-10 rounded-xl text-base font-bold flex items-center justify-center shrink-0 ${i === activeIdx ? 'bg-primary/25 text-primary' : 'bg-primary/15 text-primary'}`}>
                      {c.name.charAt(0).toUpperCase()}
                    </span>
                    <p className="text-base font-semibold text-gray-900 dark:text-white">{c.name} {c.lastName}</p>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Recomendados */}
        {!search && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, delay: 0.12, ease: EASE_OUT }}
            className="space-y-3"
          >
            <div className="flex items-center gap-2">
              <Users className="w-3.5 h-3.5 text-gray-400 dark:text-white/25" />
              <span className="text-xs font-semibold text-gray-400 dark:text-white/25 uppercase tracking-wider">
                En el gimnasio ahora
              </span>
            </div>

            {loadingRecom ? (
              <div className="flex flex-wrap gap-2">
                {[80, 110, 95, 120, 90].map((w, i) => (
                  <div
                    key={i}
                    className="h-10 rounded-xl bg-white/20 dark:bg-white/[0.04] animate-pulse"
                    style={{ width: w }}
                  />
                ))}
              </div>
            ) : recomendados.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-white/20 text-center py-2">
                No hay turnos activos en este momento
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {recomendados.map((c, i) => (
                  <motion.button
                    key={c.clienteId}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.18, delay: i * 0.04, ease: EASE_OUT }}
                    onClick={() => goToRutina(c.clienteId, c.name, c.lastName)}
                    className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-white/20 dark:bg-white/[0.05] backdrop-blur-sm border border-white/50 dark:border-white/[0.08] hover:bg-white/40 dark:hover:bg-white/[0.09] hover:border-white/70 dark:hover:border-white/[0.16] transition-all active:scale-[0.97] group"
                  >
                    <span className="w-6 h-6 rounded-lg bg-primary/15 text-primary text-xs font-bold flex items-center justify-center shrink-0 group-hover:bg-primary/25 transition-colors">
                      {c.name.charAt(0).toUpperCase()}
                    </span>
                    <span className="text-sm font-medium text-gray-600 dark:text-white/70 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                      {c.name} {c.lastName}
                    </span>
                  </motion.button>
                ))}
              </div>
            )}
          </motion.div>
        )}

      </div>
    </div>
  )
}
