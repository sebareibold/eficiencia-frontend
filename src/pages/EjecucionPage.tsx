import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Search, Users, ChevronRight } from 'lucide-react'
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
  const [recomExpanded, setRecomExpanded] = useState(false)

  const RECOM_INITIAL = 5
  const RECOM_MAX     = 8

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

  // ── Bloquea scroll de página (overscroll-behavior, no toca overflow) ──────
  useEffect(() => {
    const html = document.documentElement
    html.style.overscrollBehavior = 'none'
    return () => { html.style.overscrollBehavior = '' }
  }, [])

  // ── Buscador con debounce ─────────────────────────────────────────────────
  useEffect(() => {
    if (!search.trim()) { setResults([]); return }
    const t = setTimeout(async () => {
      setSearching(true)
      try {
        const r = await api.get('/clientes/buscar', { params: { q: search, limit: 8, startsWith: false } })
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
          className={`relative backdrop-blur-3xl border border-white/50 dark:border-white/[0.12] shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)] transition-colors focus-within:border-primary/50 bg-white/30 dark:bg-white/[0.05] focus-within:bg-white/50 dark:focus-within:bg-white/[0.07] ${results.length > 0 ? 'rounded-t-2xl rounded-b-none' : 'rounded-2xl'}`}
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
                className="absolute top-full left-[-1px] right-[-1px] bg-white/50 dark:bg-black/30 backdrop-blur-3xl border border-t-0 border-white/50 dark:border-white/[0.12] rounded-b-2xl z-20"
              >
                <div className="overflow-y-auto max-h-[403px] overscroll-contain">
                  {results.map((c, i) => (
                    <button
                      key={c.id}
                      onClick={() => goToRutina(c.id, c.name, c.lastName ?? '')}
                      onMouseEnter={() => setActiveIdx(i)}
                      className={`w-full text-left px-5 py-4 transition-colors border-b border-white/30 dark:border-white/[0.05] last:border-0 flex items-center gap-4 active:scale-[0.97] ${i === activeIdx ? 'bg-white/40 dark:bg-white/[0.10]' : 'hover:bg-white/30 dark:hover:bg-white/[0.06]'}`}
                    >
                      <span className={`w-10 h-10 rounded-xl text-base font-bold flex items-center justify-center shrink-0 ${i === activeIdx ? 'bg-primary/25 text-primary' : 'bg-primary/15 text-primary'}`}>
                        {c.name.charAt(0).toUpperCase()}
                      </span>
                      <p className="text-base font-semibold text-gray-900 dark:text-white">{c.name} {c.lastName}</p>
                    </button>
                  ))}
                </div>
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
              <div className="flex flex-col gap-2">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-[60px] rounded-2xl bg-white/20 dark:bg-white/[0.04] animate-pulse"
                  />
                ))}
              </div>
            ) : recomendados.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-white/20 text-center py-2">
                No hay turnos activos en este momento
              </p>
            ) : (
              <div className="flex flex-col gap-0">
                {/* Lista con fade en bordes + scroll interno */}
                <div className="relative">
                  <div
                    className="flex flex-col gap-2 overflow-y-auto overscroll-contain"
                    style={{
                      maxHeight: recomExpanded ? '360px' : '292px',
                      maskImage: 'linear-gradient(to bottom, transparent 0%, black 12%, black 88%, transparent 100%)',
                      WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 12%, black 88%, transparent 100%)',
                    }}
                  >
                    {recomendados.slice(0, RECOM_MAX).map((c, i) => (
                      <motion.button
                        key={c.clienteId}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.22, delay: i * 0.04, ease: EASE_OUT }}
                        onClick={() => goToRutina(c.clienteId, c.name, c.lastName)}
                        className="flex items-center gap-3.5 px-4 py-3.5 rounded-2xl bg-white/50 dark:bg-white/[0.06] backdrop-blur-xl shadow-[0_2px_8px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.6)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.06)] border border-white/70 dark:border-white/[0.10] hover:bg-white/70 dark:hover:bg-white/[0.09] hover:border-white/90 dark:hover:border-white/[0.16] hover:shadow-[0_4px_16px_rgba(0,0,0,0.10),inset_0_1px_0_rgba(255,255,255,0.7)] dark:hover:shadow-[0_4px_16px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.08)] transition-[background-color,border-color,box-shadow,transform] duration-150 active:scale-[0.97] text-left w-full group shrink-0"
                      >
                        <span className="w-10 h-10 rounded-xl bg-primary/15 text-primary text-sm font-bold flex items-center justify-center shrink-0 group-hover:bg-primary/25 transition-colors duration-150">
                          {c.name.charAt(0).toUpperCase()}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-800 dark:text-white/85 group-hover:text-gray-900 dark:group-hover:text-white transition-colors duration-150 truncate">
                            {c.name} {c.lastName}
                          </p>
                          <p className="text-xs text-gray-400 dark:text-white/30 mt-0.5">
                            Rutina · {c.turnoLabel}
                          </p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-300 dark:text-white/20 group-hover:text-primary transition-colors duration-150 shrink-0" />
                      </motion.button>
                    ))}
                  </div>


                </div>

                {/* Botón Ver más */}
                {!recomExpanded && recomendados.length > RECOM_INITIAL && (
                  <button
                    onClick={() => setRecomExpanded(true)}
                    className="relative z-10 mt-1 text-xs font-semibold text-primary hover:text-primary-dark transition-colors duration-150 text-center py-2 active:scale-[0.97]"
                  >
                    Ver más · {Math.min(recomendados.length, RECOM_MAX) - RECOM_INITIAL} más
                  </button>
                )}
              </div>
            )}
          </motion.div>
        )}

      </div>
    </div>
  )
}
