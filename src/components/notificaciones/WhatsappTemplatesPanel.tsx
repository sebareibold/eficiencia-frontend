import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Cog, MessageCircle } from 'lucide-react'
import { usePermissions } from '../../hooks/usePermissions'
import { useSettingsStore } from '../../store/settingsStore'
import { notificacionesApi } from '../../api/notificaciones.api'
import { clientsApi } from '../../api/clients.api'
import { useUiStore } from '../../store/uiStore'
import Skeleton from '../ui/Skeleton'

interface TipoInfo {
  descripcion: string
}

interface UsoUITag {
  label: string
  route?: string    // si tiene ruta directa, el tag es clickeable
  section?: string  // anchor dentro del perfil (ej. 'rutinas', 'clases')
}

const WHATSAPP_INFO: Record<string, TipoInfo & { usoUI?: UsoUITag[] }> = {
  'contacto-cliente':       { descripcion: 'Saludo de contacto general.',             usoUI: [{ label: 'Clientes › Contacto',      route: '/clients' }] },
  'comprobante-pago':       { descripcion: 'Envío del comprobante de pago.',          usoUI: [{ label: 'Pagos › Acciones',         route: '/payments' }] },
  'cobranza':               { descripcion: 'Recordatorio de pago / vencimiento.',     usoUI: [{ label: 'Perfil › Datos',           route: '__perfil__' }] },
  'bienvenida':             { descripcion: 'Mensaje al dar de alta un socio.',        usoUI: [{ label: 'Perfil › Datos',           route: '__perfil__' }] },
  'rutina-lista':           { descripcion: 'Aviso de rutina nueva cargada.',          usoUI: [{ label: 'Perfil › Rutinas',         route: '__perfil__', section: 'rutinas' }] },
  'cupo-liberado':          { descripcion: 'Aviso de cupo liberado en un turno.',     usoUI: [{ label: 'Turnos › Lista de espera', route: '/shifts' }] },
  'seguimiento-rutina':     { descripcion: 'Seguimiento de progreso de rutina.',      usoUI: [{ label: 'Perfil › Rutinas',         route: '__perfil__', section: 'rutinas' }] },
  'recordatorio-turno':     { descripcion: 'Recordatorio de próximo turno.',          usoUI: [{ label: 'Perfil › Clases',          route: '__perfil__', section: 'clases' }] },
  'seguimiento-asistencia': { descripcion: 'Contacto cuando el cliente falta varios días.', usoUI: [{ label: 'Perfil › Asistencia', route: '__perfil__', section: 'asistencia' }] },
  'aviso-membresia':        { descripcion: 'Aviso de vencimiento de membresía.',      usoUI: [{ label: 'Perfil › Membresías',      route: '__perfil__', section: 'membresias' }] },
  'recordatorio-pago':      { descripcion: 'Recordatorio de pago pendiente.',         usoUI: [{ label: 'Perfil › Pagos',           route: '__perfil__', section: 'pagos' }] },
}

type SeccionWsp = 'todos' | 'clientes' | 'pagos' | 'rutinas' | 'turnos' | 'asistencia' | 'membresias'

const WSP_SECCION_PILLS: { id: SeccionWsp; label: string }[] = [
  { id: 'todos',      label: 'Todos' },
  { id: 'clientes',   label: 'Clientes' },
  { id: 'pagos',      label: 'Pagos' },
  { id: 'rutinas',    label: 'Rutinas' },
  { id: 'turnos',     label: 'Turnos' },
  { id: 'asistencia', label: 'Asistencia' },
  { id: 'membresias', label: 'Membresías' },
]

const WSP_SECCION: Record<string, SeccionWsp> = {
  'contacto-cliente':       'clientes',
  'bienvenida':             'clientes',
  'cobranza':               'clientes',
  'comprobante-pago':       'pagos',
  'recordatorio-pago':      'pagos',
  'rutina-lista':           'rutinas',
  'seguimiento-rutina':     'rutinas',
  'cupo-liberado':          'turnos',
  'recordatorio-turno':     'turnos',
  'seguimiento-asistencia': 'asistencia',
  'aviso-membresia':        'membresias',
}

// ─── Toggle idéntico al de SettingsPage ──────────────────────────────────────

function WspToggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  const { appearance } = useSettingsStore()
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-all duration-300 focus:outline-none ${
        checked ? 'shadow-[0_0_12px_rgba(0,0,0,0.15)]' : 'bg-gray-200/80 dark:bg-gray-700/50'
      } ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:scale-105'}`}
      style={checked ? { backgroundColor: appearance.accentColor } : {}}
      aria-checked={checked}
      role="switch"
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform duration-300 ease-in-out ${
          checked ? 'translate-x-[22px]' : 'translate-x-[4px]'
        }`}
      />
    </button>
  )
}

// ─── Ícono WhatsApp ───────────────────────────────────────────────────────────

function WspIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-[#25D366] shrink-0">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  )
}

// ─── Panel ────────────────────────────────────────────────────────────────────

export function WhatsappTemplatesPanel() {
  const navigate = useNavigate()
  const { isAdmin } = usePermissions()
  const addToast = useUiStore(s => s.addToast)
  const [activos, setActivos] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [filtroSeccion, setFiltroSeccion] = useState<SeccionWsp>('todos')
  const [perfilClientId, setPerfilClientId] = useState<string | null>(null)

  const TIPOS = Object.keys(WHATSAPP_INFO)

  useEffect(() => {
    notificacionesApi
      .getPlantillasWhatsapp()
      .then(data => {
        const map: Record<string, boolean> = {}
        data.forEach(p => { map[p.tipo] = p.activo })
        setActivos(map)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
    clientsApi.getAll({ estado: 'active', limit: 1 })
      .then(res => { if (res.data[0]) setPerfilClientId(res.data[0].id) })
      .catch(() => {})
  }, [])

  function resolveRoute(tag: UsoUITag) {
    if (tag.route === '__perfil__') {
      const base = perfilClientId ? `/clients/${perfilClientId}` : '/clients'
      return tag.section ? `${base}#${tag.section}` : base
    }
    return tag.route ?? ''
  }

  async function handleToggle(tipo: string, val: boolean) {
    const prev = activos[tipo]
    setActivos(a => ({ ...a, [tipo]: val })) // optimista
    try {
      await notificacionesApi.updatePlantillaWhatsapp(tipo, { activo: val })
      addToast({ type: 'success', message: val ? 'Plantilla activada' : 'Plantilla desactivada' })
    } catch {
      setActivos(a => ({ ...a, [tipo]: prev })) // rollback
      addToast({ type: 'error', message: 'Error al actualizar' })
    }
  }

  if (loading) {
    return (
      <div>
        {/* Skeleton filtro */}
        <div className="flex flex-col gap-1.5 mb-6">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 px-1">Sección</span>
          <div className="flex items-center w-fit rounded-full border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 p-1 gap-1">
            <Skeleton className="h-7 w-16 rounded-full" />
            <Skeleton className="h-7 w-20 rounded-full" />
            <Skeleton className="h-7 w-16 rounded-full" />
            <Skeleton className="h-7 w-20 rounded-full" />
            <Skeleton className="h-7 w-20 rounded-full" />
            <Skeleton className="h-7 w-24 rounded-full" />
            <Skeleton className="h-7 w-24 rounded-full" />
          </div>
        </div>
        {/* Skeleton lista */}
        <div className="bg-white/30 dark:bg-black/30 backdrop-blur-3xl rounded-3xl border border-white/50 dark:border-white/10 overflow-hidden">
          {TIPOS.slice(0, 5).map((_, i) => (
            <div key={i} className={`flex items-center justify-between gap-6 px-8 py-6 ${i < 4 ? 'border-b border-gray-100/50 dark:border-white/5' : ''}`}>
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-4 w-20 rounded-full" />
                </div>
                <Skeleton className="h-3 w-52" />
              </div>
              <div className="flex items-center gap-2.5">
                <Skeleton className="h-8 w-8 rounded-lg" />
                <Skeleton className="h-6 w-11 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const visibleTipos = filtroSeccion === 'todos'
    ? TIPOS
    : TIPOS.filter(t => WSP_SECCION[t] === filtroSeccion)

  return (
    <div>
      {/* Pills de filtro */}
      <div className="flex flex-col gap-1.5 mb-6">
        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 px-1">Sección</span>
        <div className="flex items-center w-fit overflow-x-auto rounded-full border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-xl p-1 shadow-sm gap-1">
          {WSP_SECCION_PILLS.map(pill => {
            const isActive = filtroSeccion === pill.id
            return (
              <button
                key={pill.id}
                type="button"
                onClick={() => setFiltroSeccion(pill.id)}
                className={`relative inline-flex items-center justify-center rounded-full px-4 py-1.5 text-xs font-bold whitespace-nowrap transition-all duration-300 cursor-pointer ${
                  isActive
                    ? 'text-white dark:text-gray-900'
                    : 'text-gray-500 dark:text-[#8A8A9A] hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {isActive && <div className="absolute inset-0 rounded-full bg-gray-900 dark:bg-white shadow-[0_2px_8px_rgba(0,0,0,0.15)]" style={{ zIndex: 0 }} />}
                <span className="relative z-10">{pill.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {visibleTipos.length > 0 ? (
        <div className="bg-white/30 dark:bg-black/30 backdrop-blur-3xl rounded-3xl border border-white/50 dark:border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)] overflow-hidden transition-all hover:shadow-[0_16px_48px_rgba(0,0,0,0.08)] hover:bg-white/40 dark:hover:bg-black/40">
          {visibleTipos.map((tipo, i) => {
            const active = activos[tipo] ?? true
            const { descripcion, usoUI } = WHATSAPP_INFO[tipo] ?? { descripcion: '' }
            const nombre = tipo
              .split('-')
              .map(w => w.charAt(0).toUpperCase() + w.slice(1))
              .join(' ')

            return (
              <div
                key={tipo}
                className={`flex items-center justify-between gap-6 px-8 py-6 transition-opacity duration-200 ${
                  i < visibleTipos.length - 1 ? 'border-b border-gray-100/50 dark:border-white/5' : ''
                } ${!active ? 'opacity-50' : ''}`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <WspIcon />
                    <p className="text-sm font-bold text-gray-900 dark:text-gray-100 leading-tight">{nombre}</p>
                    {usoUI?.map(tag =>
                      tag.route ? (
                        <button
                          key={tag.label}
                          type="button"
                          onClick={() => navigate(resolveRoute(tag))}
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20 hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors cursor-pointer"
                        >
                          {tag.label}
                        </button>
                      ) : (
                        <span key={tag.label} className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100/70 dark:bg-white/[0.06] text-gray-500 dark:text-gray-400 border border-gray-200/70 dark:border-white/[0.08]">
                          {tag.label}
                        </span>
                      )
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 leading-relaxed">{descripcion}</p>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => navigate(`/settings/notificaciones/whatsapp/${tipo}`)}
                      title="Configurar template"
                      className="flex items-center justify-center h-8 w-8 rounded-lg border border-gray-200/70 dark:border-white/10 bg-white/50 dark:bg-white/[0.04] text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-white/20 transition-all"
                    >
                      <Cog size={14} />
                    </button>
                  )}
                  <WspToggle
                    checked={active}
                    onChange={val => handleToggle(tipo, val)}
                    disabled={!isAdmin}
                  />
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 py-16 rounded-3xl border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-3xl">
          <div className="h-12 w-12 rounded-2xl bg-gray-100 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.06] flex items-center justify-center">
            <MessageCircle size={20} className="text-gray-400 dark:text-gray-500" />
          </div>
          <p className="text-sm font-bold text-gray-500 dark:text-gray-400">
            Sin plantillas en {WSP_SECCION_PILLS.find(p => p.id === filtroSeccion)?.label ?? filtroSeccion}
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 text-center max-w-xs">
            Esta sección no tiene mensajes de WhatsApp configurados todavía.
          </p>
        </div>
      )}
    </div>
  )
}
