import { useState, useEffect, useRef, useCallback } from 'react'
import { Navigate, useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Save, Send, Copy, RotateCcw, Eye, EyeOff, ChevronDown, ChevronUp, GripVertical, Pencil } from 'lucide-react'
import { notificacionesApi, type PlantillaSistema, type VariableSimple } from '../api/notificaciones.api'
import { useUiStore } from '../store/uiStore'
import { usePermissions } from '../hooks/usePermissions'
import { ROUTES } from '../constants/routes'

const fadeUp = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.35 } }

/** Resalta {{variables}} con color primario dentro de un string de texto */
function HighlightedText({ text }: { text: string }) {
  if (!text) return <span className="text-gray-400 dark:text-gray-500 italic">Sin contenido</span>
  const parts = text.split(/({{[^}]+}})/g)
  return (
    <>
      {parts.map((part, i) =>
        /^{{[^}]+}}$/.test(part)
          ? (
            <span
              key={i}
              className="text-primary-dark font-bold bg-primary/10 dark:bg-primary/15 px-0.5 rounded"
            >
              {part}
            </span>
          )
          : <span key={i}>{part}</span>
      )}
    </>
  )
}

/** Igual que HighlightedText pero inserta una barrita de cursor en la posición `pos` */
function HighlightedTextWithCursor({ text, pos }: { text: string; pos: number }) {
  const before = text.slice(0, pos)
  const after  = text.slice(pos)
  return (
    <>
      <HighlightedText text={before} />
      <span
        aria-hidden
        className="inline-block w-[2px] h-[1.15em] bg-primary-dark align-text-bottom mx-px rounded-sm"
      />
      <HighlightedText text={after} />
    </>
  )
}

function insertAtCursor(value: string, insert: string, start: number, end: number) {
  return value.slice(0, start) + insert + value.slice(end)
}

/**
 * Calcula el offset absoluto de caracteres más cercano a (mouseX, mouseY) dentro de overlayEl.
 * Usa Range.getBoundingClientRect() sobre cada text node — no depende de pointer-events.
 */
function getCaretOffset(overlayEl: HTMLElement, mouseX: number, mouseY: number): number {
  const walker = document.createTreeWalker(overlayEl, NodeFilter.SHOW_TEXT)
  let abs = 0
  let bestAbs = 0
  let bestDist = Infinity
  let node: Node | null

  while ((node = walker.nextNode())) {
    const len = node.textContent?.length ?? 0
    for (let i = 0; i <= len; i++) {
      const r = document.createRange()
      r.setStart(node, i)
      r.collapse(true)
      const { x, y, height } = r.getBoundingClientRect()
      const dist = Math.hypot(x - mouseX, (y + height / 2) - mouseY)
      if (dist < bestDist) {
        bestDist = dist
        bestAbs = abs + i
      }
    }
    abs += len
  }
  return bestAbs
}

type Preset = typeof DESIGN_PRESETS[number]

function PresetCard({ preset, active, onApply }: { preset: Preset; active: boolean; onApply: () => void }) {
  return (
    <button
      type="button"
      onClick={onApply}
      title={preset.label}
      className={`rounded-xl overflow-hidden border-2 transition-all hover:scale-[1.04] ${
        active
          ? 'border-primary-dark shadow-md'
          : 'border-transparent hover:border-gray-300 dark:hover:border-white/20'
      }`}
    >
      <div className="h-3.5" style={{ backgroundColor: preset.colorAcento }} />
      <div className="h-5"   style={{ backgroundColor: preset.colorCuerpo }} />
      <div className="h-2"   style={{ backgroundColor: preset.colorFooter }} />
      <div className="py-1" style={{ backgroundColor: preset.colorFooter }}>
        <p
          className="text-[9px] text-center font-semibold truncate px-1"
          style={{ color: isLightColor(preset.colorFooter) ? '#6b7280' : '#9ca3af' }}
        >
          {preset.label}
        </p>
      </div>
    </button>
  )
}

/** Selector de color compacto reutilizable con input hex editable */
function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [hexInput, setHexInput] = useState(value.toUpperCase())

  useEffect(() => {
    setHexInput(value.toUpperCase())
  }, [value])

  function handleHexChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value
    setHexInput(raw)
    const normalized = raw.startsWith('#') ? raw : `#${raw}`
    if (/^#[0-9A-Fa-f]{6}$/.test(normalized)) {
      onChange(normalized.toLowerCase())
    }
  }

  function handleHexBlur() {
    const normalized = hexInput.startsWith('#') ? hexInput : `#${hexInput}`
    if (/^#[0-9A-Fa-f]{6}$/.test(normalized)) {
      onChange(normalized.toLowerCase())
      setHexInput(normalized.toUpperCase())
    } else {
      setHexInput(value.toUpperCase())
    }
  }

  return (
    <div className="flex items-center gap-2.5">
      <input
        type="color"
        value={value}
        onChange={e => { onChange(e.target.value); setHexInput(e.target.value.toUpperCase()) }}
        className="h-7 w-7 rounded-lg cursor-pointer border border-gray-200 dark:border-white/10 bg-transparent p-0.5 shrink-0"
      />
      <span className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500 w-16 shrink-0 font-semibold">{label}</span>
      <input
        type="text"
        value={hexInput}
        onChange={handleHexChange}
        onBlur={handleHexBlur}
        maxLength={7}
        spellCheck={false}
        className="w-20 text-[11px] font-mono text-gray-600 dark:text-gray-300 bg-transparent border-b border-gray-200 dark:border-white/10 focus:outline-none focus:border-primary/50 transition-colors"
        placeholder="#000000"
      />
    </div>
  )
}

const DESIGN_PRESETS = [
  // Diseños Eficiencia
  { label: 'Glass',        colorAcento: '#FBC608', colorCuerpo: '#0F0F0F', colorFooter: '#1A1A1A', logoInvertido: false },
  { label: 'Clásica',      colorAcento: '#1A1A1A', colorCuerpo: '#ffffff', colorFooter: '#f5f4f0', logoInvertido: true  },
  { label: 'Eficiencia',   colorAcento: '#FBC608', colorCuerpo: '#ffffff', colorFooter: '#f5f5f5', logoInvertido: false },
  // Colores
  { label: 'Azul',         colorAcento: '#3B82F6', colorCuerpo: '#ffffff', colorFooter: '#eff6ff', logoInvertido: true  },
  { label: 'Verde',        colorAcento: '#10B981', colorCuerpo: '#ffffff', colorFooter: '#f0fdf4', logoInvertido: true  },
  { label: 'Rojo',         colorAcento: '#EF4444', colorCuerpo: '#ffffff', colorFooter: '#fef2f2', logoInvertido: true  },
  { label: 'Morado',       colorAcento: '#8B5CF6', colorCuerpo: '#ffffff', colorFooter: '#f5f3ff', logoInvertido: true  },
  { label: 'Naranja',      colorAcento: '#F97316', colorCuerpo: '#ffffff', colorFooter: '#fff7ed', logoInvertido: true  },
  // Estilos
  { label: 'Minimalista',  colorAcento: '#f0f0f0', colorCuerpo: '#ffffff', colorFooter: '#fafafa', logoInvertido: false },
  { label: 'Oscuro',       colorAcento: '#111111', colorCuerpo: '#1a1a1a', colorFooter: '#0d0d0d', logoInvertido: true  },
  { label: 'Noche',        colorAcento: '#1e293b', colorCuerpo: '#0f172a', colorFooter: '#020617', logoInvertido: true  },
]

/** Reemplaza {{campo}} con el valor ejemplo de cada variable */
function resolveVariables(text: string, vars: VariableSimple[]): string {
  return vars.reduce(
    (acc, v) => acc.replace(new RegExp(`\\{\\{${v.campo}\\}\\}`, 'g'), v.ejemplo),
    text
  )
}

/** Devuelve true si el color hex es claro (para usar texto oscuro encima) */
function isLightColor(hex: string): boolean {
  const h = hex.replace('#', '').padEnd(6, '0')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.55
}

export default function NotificationTemplatePage() {
  const { tipo } = useParams<{ tipo: string }>()
  const navigate = useNavigate()
  const addToast = useUiStore(s => s.addToast)
  const { isAdmin } = usePermissions()

  const [plantilla, setPlantilla] = useState<PlantillaSistema | null>(null)
  const [asunto, setAsunto] = useState('')
  const [cuerpo, setCuerpo] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [showVarDetails, setShowVarDetails] = useState(false)
  const [showAllVars, setShowAllVars] = useState(false)
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit')
  const [colorAcento, setColorAcento] = useState('#FBC608')
  const [colorCuerpo, setColorCuerpo] = useState('#ffffff')
  const [colorFooter, setColorFooter] = useState('#f5f5f5')
  const [colorLogo, setColorLogo] = useState('')
  const [logoInvertido, setLogoInvertido] = useState(false)
  const [asuntoDragOver, setAsuntoDragOver] = useState(false)
  const [cuerpoDragOver, setCuerpoDragOver] = useState(false)
  const [dropPos, setDropPos] = useState<number | null>(null)

  const asuntoRef = useRef<HTMLInputElement>(null)
  const cuerpoRef = useRef<HTMLTextAreaElement>(null)
  const cuerpoOverlayRef = useRef<HTMLDivElement>(null)

  // Undo/redo stack para el cuerpo
  const cuerpoHistory = useRef<string[]>([''])
  const cuerpoHistIdx = useRef(0)

  const pushCuerpoHistory = useCallback((val: string) => {
    const h = cuerpoHistory.current
    const i = cuerpoHistIdx.current
    if (h[i] === val) return
    const next = h.slice(0, i + 1)
    next.push(val)
    if (next.length > 200) next.shift()
    cuerpoHistory.current = next
    cuerpoHistIdx.current = next.length - 1
  }, [])

  // Auto-resize del textarea para que el overlay coincida sin scroll sync
  useEffect(() => {
    const el = cuerpoRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.max(el.scrollHeight, 280)}px`
  }, [cuerpo])

  useEffect(() => {
    if (!tipo) return
    setLoading(true)
    notificacionesApi.getPlantillaSistema(tipo)
      .then(p => {
        setPlantilla(p)
        setAsunto(p.asunto)
        setCuerpo(p.cuerpo)
        setColorAcento(p.colorAcento ?? '#FBC608')
        setColorCuerpo(p.colorCuerpo ?? '#ffffff')
        setColorFooter(p.colorFooter ?? '#f5f5f5')
        setColorLogo(p.colorLogo ?? '')
        setLogoInvertido(p.logoInvertido ?? false)
        cuerpoHistory.current = [p.cuerpo]
        cuerpoHistIdx.current = 0
      })
      .catch(() => addToast('Error al cargar la plantilla', 'error'))
      .finally(() => setLoading(false))
  }, [tipo])

  if (!isAdmin) return <Navigate to={ROUTES.SETTINGS} replace />

  const variables: VariableSimple[] = plantilla?.variablesDisponibles ?? plantilla?.variables ?? []

  const hasChanges = plantilla && (
    asunto !== plantilla.asunto ||
    cuerpo !== plantilla.cuerpo ||
    colorAcento !== (plantilla.colorAcento ?? '#FBC608') ||
    colorCuerpo !== (plantilla.colorCuerpo ?? '#ffffff') ||
    colorFooter !== (plantilla.colorFooter ?? '#f5f5f5') ||
    colorLogo !== (plantilla.colorLogo ?? '') ||
    logoInvertido !== (plantilla.logoInvertido ?? false)
  )

  async function handleSave() {
    if (!tipo || !hasChanges) return
    setSaving(true)
    try {
      const updated = await notificacionesApi.updatePlantillaSistema(tipo, { asunto, cuerpo, colorAcento, colorCuerpo, colorFooter, colorLogo, logoInvertido })
      setPlantilla(prev => prev ? { ...prev, ...updated } : prev)
      setDirty(false)
      addToast('Plantilla guardada', 'success')
    } catch {
      addToast('Error al guardar', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleTest() {
    if (!tipo) return
    setTesting(true)
    try {
      // Siempre enviamos el estado actual del editor para que el email refleje
      // exactamente lo que se ve en pantalla (asunto, cuerpo y colores), sin
      // necesidad de guardar primero.
      const override = { asunto, cuerpo, colorAcento, colorCuerpo, colorFooter, colorLogo, logoInvertido }
      const res = await notificacionesApi.probarPlantillaSistema(tipo, override)
      addToast(`Prueba enviada a ${res.destino}`, 'success')
    } catch {
      addToast('Error al enviar email de prueba', 'error')
    } finally {
      setTesting(false)
    }
  }

  function handleReset() {
    if (!plantilla) return
    setAsunto(plantilla.asunto)
    setCuerpo(plantilla.cuerpo)
    setColorAcento(plantilla.colorAcento ?? '#FBC608')
    setColorCuerpo(plantilla.colorCuerpo ?? '#ffffff')
    setColorFooter(plantilla.colorFooter ?? '#f5f5f5')
    setColorLogo(plantilla.colorLogo ?? '')
    setLogoInvertido(plantilla.logoInvertido ?? false)
    setDirty(false)
  }

  function insertVariable(campo: string) {
    const tag = `{{${campo}}}`
    const el = cuerpoRef.current
    let next: string
    if (el && document.activeElement === el) {
      const start = el.selectionStart ?? cuerpo.length
      const end = el.selectionEnd ?? cuerpo.length
      next = insertAtCursor(cuerpo, tag, start, end)
    } else {
      next = cuerpo + tag
    }
    setCuerpo(next)
    pushCuerpoHistory(next)
    setDirty(true)
  }

  function copyVariable(campo: string) {
    navigator.clipboard.writeText(`{{${campo}}}`)
    addToast(`Copiado: {{${campo}}}`, 'info')
  }

  function handleDragStart(e: React.DragEvent, campo: string) {
    e.dataTransfer.setData('text/plain', `{{${campo}}}`)
    e.dataTransfer.effectAllowed = 'copy'
  }

  function handleDropAsunto(e: React.DragEvent<HTMLInputElement>) {
    e.preventDefault()
    setAsuntoDragOver(false)
    const text = e.dataTransfer.getData('text/plain')
    if (!text) return
    const el = e.currentTarget
    const start = el.selectionStart ?? asunto.length
    const end = el.selectionEnd ?? asunto.length
    setAsunto(insertAtCursor(asunto, text, start, end))
    setDirty(true)
  }

  function handleDropCuerpo(e: React.DragEvent<HTMLTextAreaElement>) {
    e.preventDefault()
    const text = e.dataTransfer.getData('text/plain')
    const pos = cuerpoOverlayRef.current
      ? getCaretOffset(cuerpoOverlayRef.current, e.clientX, e.clientY)
      : (e.currentTarget.selectionStart ?? cuerpo.length)
    setCuerpoDragOver(false)
    setDropPos(null)
    if (!text) return
    const next = insertAtCursor(cuerpo, text, pos, pos)
    setCuerpo(next)
    pushCuerpoHistory(next)
    setDirty(true)
  }

  if (loading) {
    const card = 'rounded-2xl lg:rounded-3xl border border-white/50 dark:border-white/[0.06] bg-white/20 dark:bg-white/[0.02]'
    return (
      <>
        <style>{`
          @keyframes sk-sweep {
            0%   { background-position: -500px 0; }
            100% { background-position: 700px 0; }
          }
          .sk {
            background-color: rgba(0,0,0,0.055);
            background-image: linear-gradient(90deg, transparent 0%, rgba(0,0,0,0.04) 50%, transparent 100%);
            background-size: 500px 100%;
            background-repeat: no-repeat;
            animation: sk-sweep 2s ease-in-out infinite;
          }
          .dark .sk {
            background-color: rgba(255,255,255,0.045);
            background-image: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.07) 50%, transparent 100%);
          }
        `}</style>

        <div className="px-4 lg:px-8 pt-2 pb-12 space-y-5">

          {/* back link */}
          <div className="sk h-4 w-[88px] rounded-md" />

          {/* header: título + tabs */}
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2.5 flex-1">
              <div className="sk h-[34px] w-52 rounded-xl" />
              <div className="sk h-4 w-80 rounded-lg" />
            </div>
            <div className="sk h-9 w-44 shrink-0 rounded-xl" />
          </div>

          {/* grid 2 columnas */}
          <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5 items-start">

            {/* ── columna izquierda ── */}
            <div className={`${card} p-5 space-y-4`}>

              {/* Variables — header */}
              <div className="flex items-center justify-between">
                <div className="sk h-2.5 w-[68px] rounded-full" />
                <div className="sk h-2.5 w-16 rounded-full" />
              </div>

              {/* variable chips */}
              <div className="space-y-1.5">
                {[82, 94, 76].map((w, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-black/[0.05] dark:border-white/[0.06]"
                    style={{ animationDelay: `${i * 0.07}s` }}
                  >
                    <div className="sk h-2.5 w-2.5 rounded-sm shrink-0" />
                    <div className="sk h-2.5 rounded-full flex-1" style={{ maxWidth: `${w}%` }} />
                    <div className="sk h-2.5 w-2.5 rounded-sm shrink-0 opacity-50" />
                  </div>
                ))}
              </div>

              {/* ver más */}
              <div className="sk h-3 w-20 rounded-full mx-auto" />

              {/* hint text */}
              <div className="sk h-2.5 w-full rounded-full opacity-60" />

              {/* divider */}
              <div className="h-px bg-black/[0.06] dark:bg-white/[0.05]" />

              {/* Diseño del email */}
              <div className="sk h-2.5 w-[90px] rounded-full" />

              {/* Logo — 3-option tab */}
              <div className="sk h-9 w-full rounded-lg" />

              {/* Colores label */}
              <div className="sk h-2 w-14 rounded-full" />

              {/* color fields */}
              <div className="space-y-3">
                {[0, 0.1, 0.2].map((delay, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <div className="sk h-7 w-7 rounded-lg shrink-0" style={{ animationDelay: `${delay}s` }} />
                    <div className="sk h-2.5 w-14 rounded-full" style={{ animationDelay: `${delay}s` }} />
                    <div className="sk h-2.5 w-[70px] rounded-md" style={{ animationDelay: `${delay}s` }} />
                  </div>
                ))}
              </div>

              {/* Paletas label */}
              <div className="sk h-2 w-12 rounded-full" />

              {/* grupo Eficiencia */}
              <div className="sk h-2 w-16 rounded-full opacity-50" />
              <div className="grid grid-cols-3 gap-2">
                {[0, 1, 2].map(i => (
                  <div key={i} className="rounded-xl overflow-hidden border border-black/[0.05] dark:border-white/[0.05]">
                    <div className="sk h-3.5" style={{ borderRadius: 0, animationDelay: `${i * 0.06}s` }} />
                    <div className="sk h-5"   style={{ borderRadius: 0, animationDelay: `${i * 0.06 + 0.05}s` }} />
                    <div className="sk h-2"   style={{ borderRadius: 0 }} />
                    <div className="sk h-4"   style={{ borderRadius: 0 }} />
                  </div>
                ))}
              </div>

              {/* grupo Colores */}
              <div className="sk h-2 w-12 rounded-full opacity-50" />
              <div className="grid grid-cols-3 gap-2">
                {[0, 1, 2, 3, 4].map(i => (
                  <div key={i} className="rounded-xl overflow-hidden border border-black/[0.05] dark:border-white/[0.05]">
                    <div className="sk h-3.5" style={{ borderRadius: 0, animationDelay: `${i * 0.05}s` }} />
                    <div className="sk h-5"   style={{ borderRadius: 0, animationDelay: `${i * 0.05 + 0.05}s` }} />
                    <div className="sk h-2"   style={{ borderRadius: 0 }} />
                    <div className="sk h-4"   style={{ borderRadius: 0 }} />
                  </div>
                ))}
              </div>

              {/* grupo Estilos */}
              <div className="sk h-2 w-11 rounded-full opacity-50" />
              <div className="grid grid-cols-3 gap-2">
                {[0, 1, 2].map(i => (
                  <div key={i} className="rounded-xl overflow-hidden border border-black/[0.05] dark:border-white/[0.05]">
                    <div className="sk h-3.5" style={{ borderRadius: 0, animationDelay: `${i * 0.06}s` }} />
                    <div className="sk h-5"   style={{ borderRadius: 0, animationDelay: `${i * 0.06 + 0.05}s` }} />
                    <div className="sk h-2"   style={{ borderRadius: 0 }} />
                    <div className="sk h-4"   style={{ borderRadius: 0 }} />
                  </div>
                ))}
              </div>
            </div>

            {/* ── columna derecha ── */}
            <div className="space-y-5">

              {/* asunto card */}
              <div className={`${card} p-5 space-y-3`}>
                <div className="sk h-2.5 w-28 rounded-full" />
                <div className="sk h-11 rounded-xl" />
              </div>

              {/* cuerpo card */}
              <div className={`${card} p-5 space-y-4`}>
                <div className="flex items-center justify-between">
                  <div className="sk h-2.5 w-32 rounded-full" />
                  <div className="sk h-6 w-24 rounded-lg" />
                </div>
                {/* líneas de texto simulando el contenido del email */}
                <div className="space-y-2.5 pt-1">
                  {[100, 91, 96, 78, 100, 87, 94, 62].map((w, i) => (
                    <div
                      key={i}
                      className="sk h-[15px] rounded-md"
                      style={{ width: `${w}%`, animationDelay: `${(i % 4) * 0.06}s` }}
                    />
                  ))}
                </div>
                <div className="space-y-2.5 pt-2">
                  {[100, 84, 90, 70, 100, 88].map((w, i) => (
                    <div
                      key={i}
                      className="sk h-[15px] rounded-md"
                      style={{ width: `${w}%`, animationDelay: `${(i % 4) * 0.06 + 0.12}s` }}
                    />
                  ))}
                </div>
                <div className="space-y-2.5 pt-2">
                  {[100, 92, 74].map((w, i) => (
                    <div
                      key={i}
                      className="sk h-[15px] rounded-md"
                      style={{ width: `${w}%`, animationDelay: `${i * 0.06 + 0.24}s` }}
                    />
                  ))}
                </div>
              </div>

              {/* botones de acción */}
              <div className="flex justify-end gap-2">
                <div className="sk h-10 w-24 rounded-xl" />
                <div className="sk h-10 w-28 rounded-xl" style={{ animationDelay: '0.08s' }} />
                <div className="sk h-10 w-28 rounded-xl" style={{ animationDelay: '0.16s' }} />
              </div>
            </div>
          </div>
        </div>
      </>
    )
  }

  if (!plantilla) {
    return (
      <div className="px-4 lg:px-8 pt-4">
        <p className="text-sm text-gray-500">Plantilla no encontrada.</p>
      </div>
    )
  }

  const glassCard = 'rounded-2xl lg:rounded-3xl bg-white/30 dark:bg-white/[0.03] backdrop-blur-3xl border border-white/50 dark:border-white/[0.06]'
  const dropRingAsunto = asuntoDragOver ? 'ring-2 ring-primary/50 border-primary/40' : ''

  return (
    <div className="px-4 lg:px-8 pt-2 pb-12 space-y-5">

      {/* Header */}
      <motion.div {...fadeUp} className="flex items-center gap-4">
        <button
          onClick={() => navigate(ROUTES.SETTINGS, { replace: true, state: { activeCategory: 'notifications', subtab: 'automatizados' } })}
          className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
        >
          <ArrowLeft size={16} />
          Configuración
        </button>
      </motion.div>

      <motion.div {...fadeUp} className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-black text-gray-900 dark:text-white tracking-tight">
            {plantilla.nombre}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Editá el asunto y cuerpo del email. Arrastrá las variables al campo que quieras o hacé click para insertar.
          </p>
        </div>
        <div className="flex shrink-0 rounded-xl bg-gray-100/80 dark:bg-black/20 p-1 gap-1 border border-white/50 dark:border-white/[0.06] mt-1">
          <button
            type="button"
            onClick={() => setViewMode('edit')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
              viewMode === 'edit'
                ? 'bg-white dark:bg-white/10 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            <Pencil size={11} />
            Editar
          </button>
          <button
            type="button"
            onClick={() => setViewMode('preview')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
              viewMode === 'preview'
                ? 'bg-white dark:bg-white/10 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            <Eye size={11} />
            Vista previa
          </button>
        </div>
      </motion.div>

      {/* Layout de dos columnas */}
      <motion.div {...fadeUp} className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5 items-start">

        {/* ── Columna izquierda: Variables disponibles ── */}
        {variables.length > 0 && (
          <div className={`${glassCard} p-5 space-y-3 lg:sticky lg:top-4`}>
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                Variables
              </label>
              <button
                type="button"
                onClick={() => setShowVarDetails(v => !v)}
                className="flex items-center gap-1 text-[11px] text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                {showVarDetails ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                {showVarDetails ? 'Menos' : 'Ver detalle'}
              </button>
            </div>

            {/* Lista de chips (vertical en sidebar) */}
            <div className="space-y-1.5">
              {(showAllVars ? variables : variables.slice(0, 3)).map(v => (
                <button
                  key={v.campo}
                  type="button"
                  draggable
                  onDragStart={e => handleDragStart(e, v.campo)}
                  onClick={() => insertVariable(v.campo)}
                  onContextMenu={e => { e.preventDefault(); copyVariable(v.campo) }}
                  title={`${v.descripcion}\nEj: ${v.ejemplo}\n\nArrastrá al campo · Click: insertar · Click derecho: copiar`}
                  className="group w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200/70 dark:border-white/10 bg-white/50 dark:bg-white/[0.04] text-xs font-mono text-primary-dark hover:border-primary/50 hover:bg-primary/5 dark:hover:bg-primary/10 transition-all cursor-grab active:cursor-grabbing select-none"
                >
                  <GripVertical size={10} className="text-gray-300 dark:text-gray-600 shrink-0" />
                  <span className="flex-1 text-left truncate">{`{{${v.campo}}}`}</span>
                  <Copy size={9} className="opacity-0 group-hover:opacity-50 transition-opacity shrink-0" />
                </button>
              ))}
              {variables.length > 3 && (
                <button
                  type="button"
                  onClick={() => setShowAllVars(v => !v)}
                  className="w-full flex items-center justify-center gap-1 py-1.5 text-[11px] font-semibold text-gray-400 dark:text-gray-500 hover:text-primary-dark transition-colors"
                >
                  {showAllVars
                    ? <><ChevronUp size={11} /> Ver menos</>
                    : <><ChevronDown size={11} /> Ver {variables.length - 3} más</>
                  }
                </button>
              )}
            </div>

            <p className="text-[10px] text-gray-400 dark:text-gray-500 leading-relaxed">
              Arrastrá al asunto o cuerpo · Click inserta · Click derecho copia
            </p>

            {/* Diseño del email */}
            <div className="pt-3 border-t border-gray-100 dark:border-white/[0.06] space-y-3">
              <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                Diseño del email
              </label>

              {/* Logo */}
              <div className="space-y-1.5">
                <p className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-600 font-semibold">Logo</p>
                {(() => {
                  const logoModo = colorLogo ? 'color' : logoInvertido ? 'blanco' : 'natural'
                  return (
                    <>
                      <div className="flex rounded-lg bg-gray-100/80 dark:bg-black/20 p-0.5 gap-0.5 border border-white/50 dark:border-white/[0.05]">
                        {([
                          { key: 'natural', label: 'Natural' },
                          { key: 'blanco',  label: 'Blanco'  },
                          { key: 'color',   label: 'Color'   },
                        ] as const).map(opt => (
                          <button
                            key={opt.key}
                            type="button"
                            onClick={() => {
                              if (opt.key === 'natural') { setLogoInvertido(false); setColorLogo('') }
                              if (opt.key === 'blanco')  { setLogoInvertido(true);  setColorLogo('') }
                              if (opt.key === 'color')   { setLogoInvertido(false); setColorLogo(colorLogo || colorAcento || '#FBC608') }
                              setDirty(true)
                            }}
                            className={`flex-1 text-[11px] font-semibold px-1.5 py-1.5 rounded-md transition-all ${
                              logoModo === opt.key
                                ? 'bg-white dark:bg-white/10 text-gray-900 dark:text-white shadow-sm'
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                      {logoModo === 'color' && (
                        <ColorField
                          label="Logo"
                          value={colorLogo}
                          onChange={v => { setColorLogo(v); setLogoInvertido(false); setDirty(true) }}
                        />
                      )}
                    </>
                  )
                })()}
              </div>

              {/* Colores */}
              <div className="space-y-2">
                <p className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-600 font-semibold">Colores</p>
                <ColorField label="Encabezado" value={colorAcento} onChange={v => { setColorAcento(v); setDirty(true) }} />
                <ColorField label="Cuerpo"     value={colorCuerpo} onChange={v => { setColorCuerpo(v); setDirty(true) }} />
                <ColorField label="Footer"     value={colorFooter} onChange={v => { setColorFooter(v); setDirty(true) }} />
              </div>

              {/* Paletas predefinidas */}
              <div className="space-y-2">
                <p className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-600 font-semibold">Paletas</p>

                {/* Grupo Eficiencia */}
                <p className="text-[9px] uppercase tracking-widest text-gray-300 dark:text-gray-700 font-bold">Eficiencia</p>
                <div className="grid grid-cols-3 gap-2">
                  {DESIGN_PRESETS.slice(0, 3).map(preset => <PresetCard key={preset.label} preset={preset} active={colorAcento === preset.colorAcento && colorCuerpo === preset.colorCuerpo && colorFooter === preset.colorFooter} onApply={() => { setColorAcento(preset.colorAcento); setColorCuerpo(preset.colorCuerpo); setColorFooter(preset.colorFooter); setLogoInvertido(preset.logoInvertido); setDirty(true) }} />)}
                </div>

                {/* Grupo Colores */}
                <p className="text-[9px] uppercase tracking-widest text-gray-300 dark:text-gray-700 font-bold pt-1">Colores</p>
                <div className="grid grid-cols-3 gap-2">
                  {DESIGN_PRESETS.slice(3, 8).map(preset => <PresetCard key={preset.label} preset={preset} active={colorAcento === preset.colorAcento && colorCuerpo === preset.colorCuerpo && colorFooter === preset.colorFooter} onApply={() => { setColorAcento(preset.colorAcento); setColorCuerpo(preset.colorCuerpo); setColorFooter(preset.colorFooter); setLogoInvertido(preset.logoInvertido); setDirty(true) }} />)}
                </div>

                {/* Grupo Estilos */}
                <p className="text-[9px] uppercase tracking-widest text-gray-300 dark:text-gray-700 font-bold pt-1">Estilos</p>
                <div className="grid grid-cols-3 gap-2">
                  {DESIGN_PRESETS.slice(8).map(preset => <PresetCard key={preset.label} preset={preset} active={colorAcento === preset.colorAcento && colorCuerpo === preset.colorCuerpo && colorFooter === preset.colorFooter} onApply={() => { setColorAcento(preset.colorAcento); setColorCuerpo(preset.colorCuerpo); setColorFooter(preset.colorFooter); setLogoInvertido(preset.logoInvertido); setDirty(true) }} />)}
                </div>
              </div>
            </div>

            {/* Panel expandible con descripción de cada variable */}
            <AnimatePresence>
              {showVarDetails && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="pt-2 border-t border-gray-100 dark:border-white/[0.06] space-y-2">
                    {variables.map(v => (
                      <div key={v.campo} className="space-y-0.5">
                        <code className="text-[10px] font-mono text-primary-dark bg-primary/10 dark:bg-primary/15 px-1.5 py-0.5 rounded font-bold">
                          {`{{${v.campo}}}`}
                        </code>
                        <p className="text-[11px] text-gray-600 dark:text-gray-400 leading-snug">{v.descripcion}</p>
                        <p className="text-[10px] text-gray-400 dark:text-gray-500">
                          Ej: <span className="font-medium">{v.ejemplo}</span>
                        </p>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* ── Columna derecha: Asunto + Cuerpo + Acciones ── */}
        <div className="space-y-5 min-w-0">

          <AnimatePresence mode="wait">
            {viewMode === 'edit' ? (
              <motion.div
                key="edit"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
                className="space-y-5"
              >
                {/* Asunto */}
                <div className={`${glassCard} p-5 space-y-3`}>
                  <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                    Asunto del email
                  </label>
                  <input
                    ref={asuntoRef}
                    type="text"
                    value={asunto}
                    onChange={e => { setAsunto(e.target.value); setDirty(true) }}
                    onDrop={handleDropAsunto}
                    onDragOver={e => { e.preventDefault(); setAsuntoDragOver(true) }}
                    onDragLeave={() => setAsuntoDragOver(false)}
                    className={`w-full rounded-xl border border-gray-200 dark:border-white/10 bg-white/60 dark:bg-white/[0.04] px-4 py-3 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all ${dropRingAsunto}`}
                    placeholder="Asunto del email... (arrastrá variables aquí)"
                  />
                </div>

                {/* Cuerpo */}
                <div className={`${glassCard} p-5 space-y-3`}>
                  <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                    Cuerpo del mensaje
                  </label>

                  {/* Wrapper con overlay de resaltado */}
                  <div
                    className={`relative rounded-xl border bg-white/60 dark:bg-white/[0.04] transition-all focus-within:ring-2 focus-within:ring-primary/40 ${cuerpoDragOver ? 'ring-2 ring-primary/50 border-primary/40' : 'border-gray-200 dark:border-white/10'}`}
                  >
                    {/* Textarea primero en el DOM (z-order inferior) */}
                    <textarea
                      ref={cuerpoRef}
                      value={cuerpo}
                      onChange={e => {
                        setCuerpo(e.target.value)
                        pushCuerpoHistory(e.target.value)
                        setDirty(true)
                      }}
                      onKeyDown={e => {
                        const ctrl = e.ctrlKey || e.metaKey
                        if (ctrl && e.key === 'z' && !e.shiftKey) {
                          e.preventDefault()
                          const i = cuerpoHistIdx.current
                          if (i > 0) {
                            cuerpoHistIdx.current = i - 1
                            setCuerpo(cuerpoHistory.current[i - 1])
                          }
                        }
                        if (ctrl && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
                          e.preventDefault()
                          const i = cuerpoHistIdx.current
                          const h = cuerpoHistory.current
                          if (i < h.length - 1) {
                            cuerpoHistIdx.current = i + 1
                            setCuerpo(h[i + 1])
                          }
                        }
                      }}
                      onDrop={handleDropCuerpo}
                      onDragOver={e => {
                        e.preventDefault()
                        setCuerpoDragOver(true)
                        if (cuerpoOverlayRef.current) {
                          setDropPos(getCaretOffset(cuerpoOverlayRef.current, e.clientX, e.clientY))
                        }
                      }}
                      onDragLeave={() => { setCuerpoDragOver(false); setDropPos(null) }}
                      className="relative w-full px-4 py-3 text-sm font-mono leading-relaxed focus:outline-none bg-transparent resize-none overflow-hidden"
                      style={{ color: 'transparent', caretColor: '#D4A800', minHeight: '420px' }}
                    />
                    {/* Overlay encima (pointer-events:none) — Range.getBoundingClientRect funciona igual */}
                    <div
                      ref={cuerpoOverlayRef}
                      aria-hidden
                      className="absolute inset-0 px-4 py-3 text-sm font-mono leading-relaxed whitespace-pre-wrap break-words pointer-events-none rounded-xl overflow-hidden text-gray-900 dark:text-white"
                    >
                      {cuerpo
                        ? (cuerpoDragOver && dropPos !== null
                            ? <HighlightedTextWithCursor text={cuerpo} pos={dropPos} />
                            : <HighlightedText text={cuerpo} />
                          )
                        : <span className="text-gray-400 dark:text-gray-500">Contenido del email... (arrastrá variables aquí)</span>
                      }
                    </div>
                  </div>

                  <p className="text-[11px] text-gray-400 dark:text-gray-500">
                    Usá <code className="bg-gray-100 dark:bg-white/10 px-1.5 py-0.5 rounded text-[10px]">{'{{variable}}'}</code> para datos dinámicos.
                    Para listas: <code className="bg-gray-100 dark:bg-white/10 px-1.5 py-0.5 rounded text-[10px]">{'{{#items}}...{{/items}}'}</code>.
                  </p>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="preview"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
              >
                {/* Email preview — mismo diseño que el email real */}
                <div className="rounded-2xl overflow-hidden bg-gray-200/60 dark:bg-black/30 p-5">
                  {/* Metadatos (De / Para) */}
                  <div className="mb-4 space-y-1 px-1">
                    {[
                      { label: 'De', value: 'Eficiencia <no-responder@eficiencia-gim.com>' },
                      { label: 'Para', value: 'socio@ejemplo.com' },
                    ].map(row => (
                      <div key={row.label} className="flex items-baseline gap-2 text-xs">
                        <span className="text-gray-400 dark:text-gray-500 w-10 shrink-0">{row.label}:</span>
                        <span className="text-gray-500 dark:text-gray-400">{row.value}</span>
                      </div>
                    ))}
                  </div>

                  {/* Tarjeta del email — siempre fondo blanco como cliente de correo */}
                  <div className="rounded-xl overflow-hidden shadow-xl">
                    {/* Header con color de acento configurable */}
                    <div style={{ backgroundColor: colorAcento }} className="px-7 py-6 flex flex-col items-center gap-3">
                      {colorLogo ? (
                        /* CSS Mask: coloriza el logo al color elegido preservando la transparencia */
                        <div className="relative inline-flex h-14">
                          <img src="/logo.png" className="h-14 w-auto opacity-0" aria-hidden />
                          <div
                            className="absolute inset-0"
                            style={{
                              backgroundColor: colorLogo,
                              WebkitMaskImage: 'url(/logo.png)',
                              maskImage: 'url(/logo.png)',
                              WebkitMaskSize: '100% 100%',
                              maskSize: '100% 100%',
                              WebkitMaskRepeat: 'no-repeat',
                              maskRepeat: 'no-repeat',
                            }}
                          />
                        </div>
                      ) : (
                        <img
                          src="/logo.png"
                          alt="Eficiencia"
                          className="h-14 w-auto object-contain"
                          style={{ filter: logoInvertido ? 'brightness(0) invert(1)' : 'none' }}
                        />
                      )}
                      <p
                        className="text-base font-black tracking-widest uppercase"
                        style={{ color: isLightColor(colorAcento) ? '#000000' : '#ffffff' }}
                      >
                        Eficiencia
                      </p>
                    </div>

                    {/* Asunto como título */}
                    <div style={{ backgroundColor: colorCuerpo }} className="px-7 pt-6 pb-2">
                      <h1
                        className="text-lg font-bold leading-snug"
                        style={{ color: isLightColor(colorCuerpo) ? '#111827' : '#f3f4f6' }}
                      >
                        {resolveVariables(asunto, variables) || (
                          <span style={{ color: isLightColor(colorCuerpo) ? '#9ca3af' : '#6b7280' }} className="font-normal italic">Sin asunto</span>
                        )}
                      </h1>
                    </div>

                    {/* Cuerpo */}
                    <div style={{ backgroundColor: colorCuerpo }} className="px-7 pb-8 pt-2">
                      <div
                        className="text-sm leading-relaxed whitespace-pre-wrap"
                        style={{ color: isLightColor(colorCuerpo) ? '#374151' : '#d1d5db' }}
                      >
                        {resolveVariables(cuerpo, variables) || (
                          <span style={{ color: isLightColor(colorCuerpo) ? '#9ca3af' : '#6b7280' }} className="italic">Sin contenido</span>
                        )}
                      </div>
                    </div>

                    {/* Footer del email */}
                    <div
                      className="px-7 py-4"
                      style={{
                        backgroundColor: colorFooter,
                        borderTop: `1px solid ${isLightColor(colorFooter) ? '#e5e7eb' : '#374151'}`,
                      }}
                    >
                      <p
                        className="text-[11px] text-center"
                        style={{ color: isLightColor(colorFooter) ? '#9ca3af' : '#6b7280' }}
                      >
                        © {new Date().getFullYear()} Eficiencia · Todos los derechos reservados
                      </p>
                      <p
                        className="text-[10px] text-center mt-0.5"
                        style={{ color: isLightColor(colorFooter) ? '#d1d5db' : '#4b5563' }}
                      >
                        Este email fue enviado automáticamente por el sistema.
                      </p>
                    </div>
                  </div>

                  <p className="text-[10px] text-gray-400 dark:text-gray-500 text-center mt-3">
                    Vista previa con valores de ejemplo · El email real usará los datos del sistema
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Acciones — siempre visibles */}
          <div className="flex items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-2">
              {hasChanges && (
                <button
                  onClick={handleReset}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                >
                  <RotateCcw size={14} />
                  Descartar
                </button>
              )}
            </div>
            <div className="flex items-center gap-2.5">
              <button
                onClick={handleTest}
                disabled={testing}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-200/70 dark:border-white/10 bg-white/50 dark:bg-white/[0.04] text-sm font-semibold text-gray-600 dark:text-gray-300 hover:border-gray-300 dark:hover:border-white/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {testing
                  ? <span className="h-3.5 w-3.5 rounded-full border-[1.5px] border-current border-t-transparent animate-spin" />
                  : <Send size={14} />
                }
                Probar
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !hasChanges}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: hasChanges ? 'rgb(var(--color-primary))' : undefined,
                  color: hasChanges ? '#000' : undefined,
                }}
              >
                {saving
                  ? <span className="h-3.5 w-3.5 rounded-full border-[1.5px] border-current border-t-transparent animate-spin" />
                  : <Save size={14} />
                }
                Guardar
              </button>
            </div>
          </div>

        </div>
      </motion.div>
    </div>
  )
}
