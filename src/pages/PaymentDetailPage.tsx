import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { pageVariants } from '../lib/motion'
import {
  ArrowLeft, Banknote, ArrowLeftRight, CreditCard,
  CheckCircle2, Trash2, User, FileText,
  Tag, Calendar, Hash,
} from 'lucide-react'
import { paymentsApi } from '../api/payments.api'
import { useUiStore } from '../store/uiStore'
import { useAuthStore } from '../store/authStore'
import { ROUTES } from '../constants/routes'
import { formatCurrency } from '../utils/formatCurrency'
import { formatDate } from '../utils/formatDate'
import Skeleton from '../components/ui/Skeleton'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import type { Payment } from '../types/payment.types'

const METHOD_CONFIG: Record<string, {
  label: string
  Icon: typeof Banknote
  color: string
  bg: string
  border: string
}> = {
  cash:     { label: 'Efectivo',      Icon: Banknote,       color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  transfer: { label: 'Transferencia', Icon: ArrowLeftRight, color: 'text-blue-600 dark:text-blue-400',       bg: 'bg-blue-500/10',    border: 'border-blue-500/20'    },
  card:     { label: 'Débito',        Icon: CreditCard,     color: 'text-violet-600 dark:text-violet-400',   bg: 'bg-violet-500/10',  border: 'border-violet-500/20'  },
}

const MODALIDAD_LABEL: Record<string, string> = {
  MENSUAL: 'Mensual', TRES_MESES: '3 meses', SEIS_MESES: '6 meses',
}
const MEMB_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  ACTIVA:    { label: 'Activa',    color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10' },
  VENCIDA:   { label: 'Vencida',   color: 'text-red-600 dark:text-red-400',         bg: 'bg-red-500/10'     },
  CANCELADA: { label: 'Cancelada', color: 'text-gray-500 dark:text-gray-400',       bg: 'bg-gray-500/10'    },
}

export default function PaymentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const addToast = useUiStore(s => s.addToast)
  const user = useAuthStore(s => s.user)
  const isAdmin = user?.role === 'admin'

  const [payment, setPayment] = useState<Payment | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [togglingInvoiced, setTogglingInvoiced] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)

  useEffect(() => {
    if (!id) return
    setIsLoading(true)
    setError(null)
    paymentsApi.getById(id)
      .then(setPayment)
      .catch(() => setError('No se pudo cargar el pago'))
      .finally(() => setIsLoading(false))
  }, [id])

  async function handleToggleInvoiced() {
    if (!payment) return
    setTogglingInvoiced(true)
    const newValue = !payment.invoiced
    try {
      await paymentsApi.toggleInvoiced(payment.id, newValue)
      setPayment(prev => prev ? { ...prev, invoiced: newValue } : null)
      addToast(`Pago marcado como ${newValue ? 'facturado' : 'no facturado'}`, 'success')
    } catch {
      addToast('Error al actualizar', 'error')
    } finally {
      setTogglingInvoiced(false)
    }
  }

  async function handleDelete() {
    if (!payment) return
    setDeleting(true)
    try {
      await paymentsApi.remove(payment.id)
      addToast('Pago eliminado', 'success')
      navigate(ROUTES.PAYMENTS)
    } catch {
      addToast('Error al eliminar el pago', 'error')
      setDeleting(false)
    }
  }

  const cfg = payment ? (METHOD_CONFIG[payment.method] ?? METHOD_CONFIG.cash) : null
  const MethodIcon = cfg?.Icon ?? Banknote

  return (
    <motion.div {...pageVariants} className="max-w-2xl mx-auto space-y-6 pb-12 relative z-10">

      {/* Back + Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(ROUTES.PAYMENTS)}
          className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-xl text-gray-600 dark:text-gray-300 transition-all hover:scale-105 hover:bg-white/50 dark:hover:bg-black/50 shadow-sm shrink-0"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tighter text-gray-900 dark:text-white">
            Detalle del pago
          </h1>
          {payment && (
            <p className="text-sm font-semibold text-gray-500 dark:text-gray-400 mt-0.5">
              {payment.clientName}
            </p>
          )}
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-4">
          <Skeleton className="h-36 rounded-[2rem]" />
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </div>
      )}

      {/* Error */}
      {!isLoading && error && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-center">
          <p className="text-sm font-bold text-red-500">{error}</p>
          <button onClick={() => navigate(ROUTES.PAYMENTS)} className="mt-3 text-xs font-bold text-red-400 underline">
            Volver a Pagos
          </button>
        </div>
      )}

      {/* Content */}
      {!isLoading && payment && cfg && (
        <>
          {/* Hero — monto + método */}
          <div className={`rounded-[2rem] border ${cfg.border} ${cfg.bg} backdrop-blur-3xl p-8 shadow-sm`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className={`inline-flex items-center gap-2 rounded-xl ${cfg.bg} border ${cfg.border} px-3 py-1.5 mb-4`}>
                  <MethodIcon size={15} className={cfg.color} />
                  <span className={`text-xs font-bold ${cfg.color}`}>{cfg.label}</span>
                </div>
                <p className="text-5xl font-black tabular-nums tracking-tighter text-gray-900 dark:text-white">
                  {formatCurrency(payment.amount)}
                </p>
                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  <span className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
                    <Calendar size={14} />
                    {formatDate(payment.paidAt)}
                  </span>
                </div>
              </div>
              {/* ID */}
              <div className="text-right shrink-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1">ID</p>
                <p className="font-mono text-xs text-gray-400 dark:text-gray-500">
                  {String(payment.id).slice(0, 12)}…
                </p>
              </div>
            </div>
          </div>

          {/* Cliente */}
          <div className="rounded-2xl border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-xl p-5 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-3 flex items-center gap-1.5">
              <User size={12} /> Cliente
            </p>
            <div className="flex items-center justify-between">
              <p className="font-bold text-gray-900 dark:text-white text-lg">{payment.clientName}</p>
              <Link
                to={`/clients/${payment.clientId}`}
                className="flex items-center gap-1.5 rounded-xl border border-white/50 dark:border-white/10 bg-white/40 dark:bg-white/5 px-3.5 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-white/70 dark:hover:bg-white/10 transition-all"
              >
                Ver perfil →
              </Link>
            </div>
          </div>

          {/* Comprobante / notas */}
          {payment.notes && (
            <div className="rounded-2xl border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-xl p-5 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2 flex items-center gap-1.5">
                <FileText size={12} /> Comprobante / Notas
              </p>
              <p className="text-sm text-gray-800 dark:text-gray-200 font-medium">{payment.notes}</p>
            </div>
          )}

          {/* Membresía vinculada */}
          {payment.membresia ? (
            <div className="rounded-2xl border border-primary/25 bg-primary/[0.05] backdrop-blur-xl p-5 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-4 flex items-center gap-1.5">
                <Tag size={12} /> Membresía vinculada
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {[
                  { label: 'Plan', value: payment.membresia.planNombre },
                  { label: 'Modalidad', value: MODALIDAD_LABEL[payment.membresia.modalidad] ?? payment.membresia.modalidad },
                  { label: 'Estado', value: (() => {
                    const s = MEMB_STATUS_CONFIG[payment.membresia!.estado]
                    return s ? (
                      <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded-lg ${s.bg} ${s.color}`}>
                        {s.label}
                      </span>
                    ) : payment.membresia!.estado
                  })() },
                  { label: 'Precio', value: formatCurrency(payment.membresia.precio) },
                  { label: 'Inicio', value: formatDate(payment.membresia.fechaInicio) },
                  { label: 'Vencimiento', value: formatDate(payment.membresia.fechaVencimiento) },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-xl bg-white/40 dark:bg-black/20 border border-white/50 dark:border-white/10 px-3.5 py-3">
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider font-medium">{label}</p>
                    <div className="text-sm font-bold text-gray-900 dark:text-white mt-0.5">{value}</div>
                  </div>
                ))}
              </div>
              {payment.cuotaNumero && (
                <div className="mt-3 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                  <Hash size={14} className="text-primary" />
                  Cuota <span className="font-black text-primary ml-0.5">#{payment.cuotaNumero}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-xl p-5 shadow-sm text-center">
              <p className="text-xs text-gray-400 dark:text-gray-500">Sin membresía vinculada</p>
            </div>
          )}

          {/* Facturación — toggle dedicado */}
          <div className="rounded-2xl border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-xl shadow-sm overflow-hidden">
            <div className="flex items-center justify-between gap-4 p-5">
              <div className="flex items-center gap-4">
                <div className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 transition-colors duration-300 ${
                  payment.invoiced ? 'bg-emerald-500/15' : 'bg-gray-100/60 dark:bg-white/[0.05]'
                }`}>
                  {payment.invoiced
                    ? <CheckCircle2 size={20} className="text-emerald-500" />
                    : <FileText size={20} className="text-gray-400 dark:text-gray-500" />
                  }
                </div>
                <div>
                  <p className={`text-sm font-bold transition-colors duration-300 ${
                    payment.invoiced ? 'text-emerald-700 dark:text-emerald-400' : 'text-gray-900 dark:text-white'
                  }`}>
                    {payment.invoiced ? 'Pago facturado' : 'Sin facturar'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {payment.invoiced
                      ? 'Este pago fue facturado'
                      : 'Este pago aún no fue facturado'
                    }
                  </p>
                </div>
              </div>

              {/* Toggle switch */}
              <button
                type="button"
                onClick={handleToggleInvoiced}
                disabled={togglingInvoiced}
                className={`relative inline-flex h-7 w-14 shrink-0 items-center rounded-full transition-all duration-300 focus:outline-none ${
                  payment.invoiced
                    ? 'bg-emerald-500 shadow-[0_0_16px_rgba(16,185,129,0.35)]'
                    : 'bg-gray-200 dark:bg-gray-700/60'
                } ${togglingInvoiced ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:scale-105'}`}
                aria-checked={payment.invoiced}
                role="switch"
              >
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-300 ease-in-out ${
                  payment.invoiced ? 'translate-x-[30px]' : 'translate-x-[4px]'
                }`} />
              </button>
            </div>
          </div>

          {/* Eliminar — solo admin */}
          {isAdmin && (
            <div className="flex justify-end pt-1">
              <button
                onClick={() => setIsConfirmOpen(true)}
                disabled={deleting}
                className="flex items-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-500/20 transition-all disabled:opacity-50"
              >
                <Trash2 size={15} />
                Eliminar pago
              </button>
            </div>
          )}
        </>
      )}
      <ConfirmDialog
        isOpen={isConfirmOpen}
        title="Eliminar pago"
        message="Esta acción no se puede deshacer. El registro quedará eliminado permanentemente."
        confirmLabel="Eliminar"
        isLoading={deleting}
        onConfirm={handleDelete}
        onClose={() => setIsConfirmOpen(false)}
      />
    </motion.div>
  )
}
