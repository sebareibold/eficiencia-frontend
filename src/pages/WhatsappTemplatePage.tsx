import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Save, RefreshCw, Copy, Check } from 'lucide-react'
import { notificacionesApi, type PlantillaWhatsapp, type VariableSimple } from '../api/notificaciones.api'
import { useUiStore } from '../store/uiStore'
import { resolveWhatsappTemplate, whatsappToHtml } from '../utils/whatsappTemplate'
import { ROUTES } from '../constants/routes'
import Skeleton from '../components/ui/Skeleton'

const fadeUp = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.35 } }

// ─── Preview burbuja WhatsApp ─────────────────────────────────────────────────

function WspBubble({ cuerpo, variables }: { cuerpo: string; variables: VariableSimple[] }) {
  const exampleVars: Record<string, string> = {}
  variables.forEach(v => { exampleVars[v.campo] = v.ejemplo })
  const resolved = resolveWhatsappTemplate(cuerpo, exampleVars)
  const html = whatsappToHtml(resolved)

  return (
    <div className="rounded-2xl overflow-hidden border border-gray-200 dark:border-white/10 bg-[#ECE5DD] dark:bg-[#0D1117] p-4">
      {/* Header de chat */}
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-black/10 dark:border-white/10">
        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-black font-bold text-sm shrink-0">
          E
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-900 dark:text-white leading-none">Eficiencia</p>
          <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">Gimnasio</p>
        </div>
      </div>
      {/* Burbuja */}
      <div className="flex justify-end">
        <div
          className="max-w-[90%] bg-[#DCF8C6] dark:bg-[#005C4B] text-gray-900 dark:text-white text-[13px] leading-[1.55] px-3 py-2 rounded-tl-2xl rounded-tr-sm rounded-b-2xl shadow-sm"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </div>
  )
}

// ─── Highlight de variables en el editor ─────────────────────────────────────

function HighlightedText({ text, onDragStart, onDragEnd }: {
  text: string
  onDragStart?: (e: React.DragEvent<HTMLElement>, start: number, end: number, variable: string) => void
  onDragEnd?: () => void
}) {
  const parts = text.split(/({{[^}]+}})/g)
  let idx = 0
  return (
    <>
      {parts.map((part, i) => {
        const start = idx
        idx += part.length
        const end = idx
        if (/^{{[^}]+}}$/.test(part)) {
          return (
            <mark
              key={i}
              draggable
              className="bg-primary/40 text-amber-900 dark:text-amber-100 font-semibold rounded cursor-grab active:cursor-grabbing pointer-events-auto select-none"
              style={{ fontFamily: 'inherit', fontSize: 'inherit', lineHeight: 'inherit' }}
              onDragStart={e => onDragStart?.(e, start, end, part)}
              onDragEnd={onDragEnd}
            >
              {part}
            </mark>
          )
        }
        return <span key={i} className="text-gray-900 dark:text-gray-100">{part}</span>
      })}
    </>
  )
}

// ─── Chips de variables ───────────────────────────────────────────────────────

function VarChips({
  variables,
  onInsert,
}: {
  variables: VariableSimple[]
  onInsert: (v: string) => void
}) {
  const [showAll, setShowAll] = useState(false)
  const visible = showAll ? variables : variables.slice(0, 3)
  const extra = variables.length - 3

  return (
    <div className="flex flex-wrap gap-1.5">
      {visible.map(v => (
        <button
          key={v.campo}
          type="button"
          onClick={() => onInsert(`{{${v.campo}}}`)}
          title={`${v.descripcion} — ej: ${v.ejemplo}`}
          className="px-2 py-0.5 rounded-full text-[11px] font-mono bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors"
        >
          {`{{${v.campo}}}`}
        </button>
      ))}
      {!showAll && extra > 0 && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="px-2 py-0.5 rounded-full text-[11px] text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/[0.05] transition-colors"
        >
          +{extra} más
        </button>
      )}
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function WhatsappTemplatePage() {
  const { tipo } = useParams<{ tipo: string }>()
  const navigate = useNavigate()
  const addToast = useUiStore(s => s.addToast)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const historyRef = useRef<string[]>([])
  const historyPosRef = useRef(0)

  function updateCuerpo(newVal: string) {
    const sliced = historyRef.current.slice(0, historyPosRef.current + 1)
    if (sliced[sliced.length - 1] !== newVal) {
      sliced.push(newVal)
      historyRef.current = sliced
      historyPosRef.current = sliced.length - 1
    }
    setCuerpo(newVal)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!(e.ctrlKey || e.metaKey)) return
    if (e.key === 'z' && !e.shiftKey) {
      e.preventDefault()
      if (historyPosRef.current > 0) {
        historyPosRef.current--
        setCuerpo(historyRef.current[historyPosRef.current])
      }
    } else if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) {
      e.preventDefault()
      if (historyPosRef.current < historyRef.current.length - 1) {
        historyPosRef.current++
        setCuerpo(historyRef.current[historyPosRef.current])
      }
    }
  }

  const syncScroll = useCallback(() => {
    if (textareaRef.current && overlayRef.current) {
      overlayRef.current.scrollTop = textareaRef.current.scrollTop
    }
  }, [])

  const dragDataRef = useRef<{ start: number; end: number; variable: string } | null>(null)

  function getDropPositionInText(clientX: number, clientY: number): number {
    let targetNode: Node | null = null
    let nodeOffset = 0
    if ('caretPositionFromPoint' in document) {
      const pos = (document as any).caretPositionFromPoint(clientX, clientY) as { offsetNode: Node; offset: number } | null
      if (pos) { targetNode = pos.offsetNode; nodeOffset = pos.offset }
    } else if ('caretRangeFromPoint' in document) {
      const range = (document as any).caretRangeFromPoint(clientX, clientY) as Range | null
      if (range) { targetNode = range.startContainer; nodeOffset = range.startOffset }
    }
    if (!targetNode || !overlayRef.current) return cuerpo.length
    // Walk overlay text nodes — orden idéntico al valor del textarea
    const walker = document.createTreeWalker(overlayRef.current, NodeFilter.SHOW_TEXT)
    let total = 0
    let node = walker.nextNode()
    while (node) {
      if (node === targetNode) return total + nodeOffset
      total += node.textContent?.length ?? 0
      node = walker.nextNode()
    }
    return cuerpo.length
  }

  function handleVarDragStart(e: React.DragEvent<HTMLElement>, start: number, end: number, variable: string) {
    dragDataRef.current = { start, end, variable }
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleVarDragEnd() {
    dragDataRef.current = null
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    if (!dragDataRef.current) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    const drag = dragDataRef.current
    if (!drag) return
    dragDataRef.current = null
    const dropPos = getDropPositionInText(e.clientX, e.clientY)
    const { start, end, variable } = drag
    if (dropPos >= start && dropPos <= end) return
    let newText: string
    let cursorPos: number
    if (dropPos <= start) {
      newText = cuerpo.slice(0, dropPos) + variable + cuerpo.slice(dropPos, start) + cuerpo.slice(end)
      cursorPos = dropPos + variable.length
    } else {
      newText = cuerpo.slice(0, start) + cuerpo.slice(end, dropPos) + variable + cuerpo.slice(dropPos)
      cursorPos = dropPos - (end - start) + variable.length
    }
    updateCuerpo(newText)
    requestAnimationFrame(() => {
      textareaRef.current?.focus()
      textareaRef.current?.setSelectionRange(cursorPos, cursorPos)
    })
  }

  const [plantilla, setPlantilla] = useState<PlantillaWhatsapp | null>(null)
  const [cuerpo, setCuerpo] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [copied, setCopied] = useState(false)

  const isDirty = plantilla !== null && cuerpo !== plantilla.cuerpo
  const variables = plantilla?.variablesDisponibles ?? plantilla?.variables ?? []

  useEffect(() => {
    if (!tipo) return
    setLoading(true)
    notificacionesApi
      .getPlantillaWhatsapp(tipo)
      .then(data => {
        setPlantilla(data)
        setCuerpo(data.cuerpo)
        historyRef.current = [data.cuerpo]
        historyPosRef.current = 0
      })
      .catch(() => addToast({ type: 'error', message: 'No se pudo cargar la plantilla' }))
      .finally(() => setLoading(false))
  }, [tipo]) // eslint-disable-line react-hooks/exhaustive-deps

  function insertAtCursor(text: string) {
    const el = textareaRef.current
    if (!el) return
    const start = el.selectionStart
    const end = el.selectionEnd
    const newVal = cuerpo.slice(0, start) + text + cuerpo.slice(end)
    setCuerpo(newVal)
    requestAnimationFrame(() => {
      el.setSelectionRange(start + text.length, start + text.length)
      el.focus()
    })
  }

  async function handleSave() {
    if (!tipo) return
    setSaving(true)
    try {
      const updated = await notificacionesApi.updatePlantillaWhatsapp(tipo, { cuerpo })
      setPlantilla(prev => prev ? { ...prev, cuerpo: updated.cuerpo } : prev)
      addToast({ type: 'success', message: 'Plantilla guardada' })
    } catch {
      addToast({ type: 'error', message: 'Error al guardar' })
    } finally {
      setSaving(false)
    }
  }

  async function handleReset() {
    if (!tipo) return
    setResetting(true)
    try {
      const updated = await notificacionesApi.resetPlantillaWhatsapp(tipo)
      setPlantilla(prev => prev ? { ...prev, cuerpo: updated.cuerpo } : prev)
      updateCuerpo(updated.cuerpo)
      addToast({ type: 'success', message: 'Plantilla restaurada al texto original' })
    } catch {
      addToast({ type: 'error', message: 'Error al restaurar' })
    } finally {
      setResetting(false)
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(cuerpo)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <motion.div {...fadeUp} className="space-y-6 pb-12">

      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => navigate(ROUTES.SETTINGS, { replace: true, state: { activeCategory: 'notifications', subtab: 'preautomatizados' } })}
          className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
        >
          <ArrowLeft size={16} />
          Configuración
        </button>
      </div>

      {/* Título */}
      <div>
        {loading ? (
          <Skeleton className="h-8 w-64" />
        ) : (
          <>
            <div className="flex items-center gap-2 mb-1">
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-[#25D366] shrink-0">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {plantilla?.nombre ?? tipo}
              </h1>
              {isDirty && (
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-primary/15 text-primary border border-primary/20 font-semibold">
                  Sin guardar
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 ml-7">
              Plantilla de WhatsApp — tipo: <span className="font-mono">{tipo}</span>
            </p>
          </>
        )}
      </div>

      {/* Contenido */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-64 rounded-2xl" />
            <Skeleton className="h-8 w-full rounded-xl" />
          </div>
          <div className="space-y-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-64 rounded-2xl" />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Columna izquierda: editor */}
          <div className="bg-white/30 dark:bg-black/30 backdrop-blur-3xl rounded-3xl border border-white/50 dark:border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)] p-6 space-y-4">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-3">
                Cuerpo del mensaje
              </p>
              <div className="relative" onDragOver={handleDragOver} onDrop={handleDrop}>
                {/* Textarea transparente — base */}
                <textarea
                  ref={textareaRef}
                  value={cuerpo}
                  onChange={e => updateCuerpo(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onScroll={syncScroll}
                  rows={12}
                  className="relative w-full resize-y rounded-2xl bg-white/50 dark:bg-white/[0.04] border border-gray-200/70 dark:border-white/10 text-sm text-transparent caret-gray-900 dark:caret-white placeholder-gray-400 dark:placeholder-gray-600 px-4 py-3 font-mono focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/40 transition-colors"
                />
                {/* Overlay con variables resaltadas — encima del textarea */}
                <div
                  ref={overlayRef}
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 rounded-2xl px-4 py-3 font-mono text-sm whitespace-pre-wrap break-words overflow-hidden"
                >
                  <HighlightedText text={cuerpo} onDragStart={handleVarDragStart} onDragEnd={handleVarDragEnd} />
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">
                Variables — click para insertar en el cursor:
              </p>
              <VarChips variables={variables} onInsert={insertAtCursor} />
            </div>

            <p className="text-[11px] text-gray-400 dark:text-gray-500">
              Formato WhatsApp: <span className="font-mono">*negrita*</span> · <span className="font-mono">_cursiva_</span>
            </p>

            {/* Acciones */}
            <div className="flex items-center gap-2 pt-2 border-t border-gray-100/50 dark:border-white/5">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !isDirty}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-black text-sm font-semibold hover:bg-[#D4A800] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Save size={14} />
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
              <button
                type="button"
                onClick={handleReset}
                disabled={resetting}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-gray-200/70 dark:border-white/10 bg-white/50 dark:bg-white/[0.04] text-gray-600 dark:text-gray-300 text-sm hover:bg-white/80 dark:hover:bg-white/[0.08] disabled:opacity-40 transition-colors"
              >
                <RefreshCw size={13} className={resetting ? 'animate-spin' : ''} />
                Restaurar original
              </button>
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-gray-200/70 dark:border-white/10 bg-white/50 dark:bg-white/[0.04] text-gray-600 dark:text-gray-300 text-sm hover:bg-white/80 dark:hover:bg-white/[0.08] transition-colors ml-auto"
              >
                {copied ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
                {copied ? 'Copiado' : 'Copiar'}
              </button>
            </div>
          </div>

          {/* Columna derecha: preview */}
          <div className="bg-white/30 dark:bg-black/30 backdrop-blur-3xl rounded-3xl border border-white/50 dark:border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)] p-6 space-y-4">
            <p className="text-xs font-extrabold uppercase tracking-widest text-gray-400 dark:text-gray-500">
              Vista previa
            </p>
            <WspBubble cuerpo={cuerpo} variables={variables} />
            <p className="text-[11px] text-gray-400 dark:text-gray-500">
              Las variables se muestran con valores de ejemplo. El mensaje real usa los datos del sistema.
            </p>

            {/* Tabla de variables disponibles */}
            {variables.length > 0 && (
              <div className="rounded-2xl border border-gray-200/60 dark:border-white/[0.06] overflow-hidden">
                <div className="px-4 py-2.5 border-b border-gray-100/60 dark:border-white/[0.05] bg-gray-50/50 dark:bg-white/[0.02]">
                  <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Variables disponibles</p>
                </div>
                {variables.map((v, i) => (
                  <div
                    key={v.campo}
                    className={`grid grid-cols-[auto_1fr_auto] gap-3 items-center px-4 py-2.5 text-[11px] ${
                      i < variables.length - 1 ? 'border-b border-gray-100/50 dark:border-white/[0.04]' : ''
                    }`}
                  >
                    <code className="font-mono text-primary bg-primary/8 dark:bg-primary/10 px-1.5 py-0.5 rounded text-[10px]">
                      {`{{${v.campo}}}`}
                    </code>
                    <span className="text-gray-600 dark:text-gray-400 truncate">{v.descripcion}</span>
                    <span className="text-gray-400 dark:text-gray-500 shrink-0">{v.ejemplo}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </motion.div>
  )
}
