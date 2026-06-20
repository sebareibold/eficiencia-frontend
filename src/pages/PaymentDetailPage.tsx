import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { pageVariants } from '../lib/motion'
import {
  ArrowLeft, Banknote, ArrowLeftRight, CreditCard,
  CheckCircle2, Trash2, User, FileText,
  Tag, Calendar, Hash, Edit2, XCircle, Save,
} from 'lucide-react'
import { paymentsApi } from '../api/payments.api'
import { membresiasClienteApi } from '../api/membresiasCliente.api'
import { useUiStore } from '../store/uiStore'
import { useAuthStore } from '../store/authStore'
import { ROUTES } from '../constants/routes'
import { formatCurrency } from '../utils/formatCurrency'
import { formatDate } from '../utils/formatDate'
import Skeleton from '../components/ui/Skeleton'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import type { Payment } from '../types/payment.types'
import type { MembresiaCliente } from '../types/membership.types'
import { MODALIDAD_LABELS } from '../types/membership.types'

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

const MEMB_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  PENDIENTE:  { label: 'Programada', color: 'text-blue-600 dark:text-blue-400',       bg: 'bg-blue-500/10'    },
  ACTIVA:     { label: 'Activa',     color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10' },
  VENCIDA:    { label: 'Expirada',   color: 'text-red-600 dark:text-red-400',         bg: 'bg-red-500/10'     },
  CANCELADA:  { label: 'Cancelada',  color: 'text-gray-500 dark:text-gray-400',       bg: 'bg-gray-500/10'    },
}

const METODO_LABELS: Record<string, string> = {
  cash: 'Efectivo', transfer: 'Transferencia', card: 'Débito',
}

const inputCls = 'w-full bg-white/60 dark:bg-white/[0.06] border border-gray-200 dark:border-white/[0.15] rounded-xl px-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-primary/60 transition-all'
const labelCls = 'text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500'

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
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [membresias, setMembresias] = useState<MembresiaCliente[]>([])
  const [loadingMemb, setLoadingMemb] = useState(false)
  const [membPage, setMembPage] = useState(0)
  const [editForm, setEditForm] = useState<{
    amount: string; method: Payment['method']; paidAt: string; notes: string; membresiaId: string
  }>({ amount: '', method: 'cash', paidAt: '', notes: '', membresiaId: '' })

  useEffect(() => {
    if (!id) return
    setIsLoading(true)
    setError(null)
    paymentsApi.getById(id)
      .then(setPayment)
      .catch(() => setError('No se pudo cargar el pago'))
      .finally(() => setIsLoading(false))
  }, [id])

  function openEdit() {
    if (!payment) return
    setEditForm({
      amount: String(payment.amount),
      method: payment.method,
      paidAt: payment.paidAt.slice(0, 10),
      notes: payment.notes ?? '',
      membresiaId: payment.membresiaId ?? '',
    })
    setMembPage(0)
    setIsEditing(true)
    if (payment.clientId && membresias.length === 0) {
      setLoadingMemb(true)
      membresiasClienteApi.getAll(String(payment.clientId))
        .then(m => setMembresias([...m].sort((a, b) => b.fechaInicio.localeCompare(a.fechaInicio))))
        .finally(() => setLoadingMemb(false))
    }
  }

  function cancelEdit() { setIsEditing(false) }

  async function handleSaveEdit() {
    if (!payment) return
    setSaving(true)
    try {
      await paymentsApi.update(payment.id, {
        amount:      parseFloat(editForm.amount),
        method:      editForm.method,
        paidAt:      editForm.paidAt,
        notes:       editForm.notes || null,
        membresiaId: editForm.membresiaId || null,
      })
      // Re-fetch para obtener relaciones anidadas (membresia.plan) actualizadas
      const fresh = await paymentsApi.getById(payment.id)
      setPayment(fresh)
      addToast('Pago actualizado', 'success')
      setIsEditing(false)
    } catch (err: any) {
      addToast(err?.response?.data?.message ?? 'Error al guardar', 'error')
    } finally {
      setSaving(false)
    }
  }

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
    <motion.div {...pageVariants} className="space-y-6 pb-12 relative z-10">

      {/* Back + Header */}
      <div className="flex items-center gap-4">
        <motion.button
          onClick={() => { if (isEditing) cancelEdit(); else navigate(ROUTES.PAYMENTS) }}
          whileTap={{ scale: 0.92 }}
          className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-xl text-gray-600 dark:text-gray-300 transition-[background-color,border-color] hover:bg-white/50 dark:hover:bg-black/50 shadow-sm shrink-0"
        >
          <ArrowLeft size={18} />
        </motion.button>
        <div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tighter text-gray-900 dark:text-white">
            {isEditing ? 'Editar pago' : 'Detalle del pago'}
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

      {!isLoading && payment && cfg && (
        <AnimatePresence mode="wait">
          {isEditing ? (
            <motion.div
              key="edit"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
              className="space-y-4"
            >
              {/* ── Formulario de edición ─────────────────────────────────── */}
              <div className="rounded-[2rem] border border-primary/25 bg-primary/[0.03] dark:bg-primary/[0.02] backdrop-blur-3xl p-7 shadow-sm space-y-5">
                <p className={`${labelCls} text-primary flex items-center gap-1.5`}>
                  <Edit2 size={11} /> Campos del pago
                </p>

                <div className="grid grid-cols-2 gap-4">
                  {/* Monto */}
                  <div className="flex flex-col gap-1.5">
                    <label className={labelCls}>Monto (ARS)</label>
                    <input
                      autoFocus
                      type="number"
                      value={editForm.amount}
                      onChange={e => setEditForm(f => ({ ...f, amount: e.target.value }))}
                      className={inputCls}
                    />
                  </div>
                  {/* Método */}
                  <div className="flex flex-col gap-1.5">
                    <label className={labelCls}>Método</label>
                    <select
                      value={editForm.method}
                      onChange={e => setEditForm(f => ({ ...f, method: e.target.value as Payment['method'] }))}
                      className={inputCls}
                    >
                      {Object.entries(METODO_LABELS).map(([v, l]) => (
                        <option key={v} value={v}>{l}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Fecha */}
                <div className="flex flex-col gap-1.5">
                  <label className={labelCls}>Fecha</label>
                  <input
                    type="date"
                    value={editForm.paidAt}
                    onChange={e => setEditForm(f => ({ ...f, paidAt: e.target.value }))}
                    className={inputCls}
                  />
                </div>

                {/* Notas */}
                <div className="flex flex-col gap-1.5">
                  <label className={labelCls}>Notas / Comprobante <span className="normal-case font-normal opacity-60">(opcional)</span></label>
                  <input
                    type="text"
                    value={editForm.notes}
                    onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Número de comprobante, observación…"
                    className={inputCls}
                  />
                </div>
              </div>

              {/* ── Selector de membresía ─────────────────────────────────── */}
              <div className="rounded-2xl border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-xl p-5 shadow-sm">
                <p className={`${labelCls} flex items-center gap-1.5 mb-3`}>
                  <Tag size={11} /> Vincular membresía
                </p>

                {loadingMemb ? (
                  <div className="space-y-2">
                    <Skeleton className="h-14 rounded-xl" />
                    <Skeleton className="h-14 rounded-xl" />
                    <Skeleton className="h-14 rounded-xl" />
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* Sin membresía */}
                    <div
                      onClick={() => setEditForm(f => ({ ...f, membresiaId: '' }))}
                      className={`cursor-pointer rounded-xl border px-4 py-3 transition-all ${
                        editForm.membresiaId === ''
                          ? 'border-primary/40 bg-primary/[0.05]'
                          : 'border-gray-200 dark:border-white/[0.08] hover:border-gray-300 dark:hover:border-white/[0.15]'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`h-3 w-3 rounded-full border-2 shrink-0 transition-all ${editForm.membresiaId === '' ? 'border-primary bg-primary' : 'border-gray-300 dark:border-white/30'}`} />
                        <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Sin membresía vinculada</p>
                      </div>
                    </div>

                    {/* Lista de membresías (paginada de 5 en 5) */}
                    {membresias.slice(membPage * 5, membPage * 5 + 5).map(m => {
                      const sCfg = MEMB_STATUS_CONFIG[m.estado]
                      const isSelected = editForm.membresiaId === m.id
                      const daysLeft = Math.ceil((new Date(m.fechaVencimiento).getTime() - Date.now()) / 86_400_000)
                      return (
                        <div
                          key={m.id}
                          onClick={() => setEditForm(f => ({ ...f, membresiaId: m.id }))}
                          className={`cursor-pointer rounded-xl border px-4 py-3.5 transition-all ${
                            isSelected
                              ? 'border-primary/40 bg-primary/[0.05]'
                              : 'border-gray-200 dark:border-white/[0.08] hover:border-gray-300 dark:hover:border-white/[0.15]'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`h-3 w-3 rounded-full border-2 shrink-0 mt-1 transition-all ${isSelected ? 'border-primary bg-primary' : 'border-gray-300 dark:border-white/30'}`} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{m.plan.nombre}</p>
                                {sCfg && (
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg shrink-0 ${sCfg.bg} ${sCfg.color}`}>
                                    {sCfg.label}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-gray-500 dark:text-[#8A8A9A] mt-1 leading-relaxed">
                                {MODALIDAD_LABELS[m.modalidad] ?? m.modalidad}
                                <span className="mx-1.5 opacity-40">·</span>
                                {formatDate(m.fechaInicio)} → {formatDate(m.fechaVencimiento)}
                                {m.estado === 'ACTIVA' && daysLeft > 0 && (
                                  <span className={`ml-1.5 font-semibold ${daysLeft <= 7 ? 'text-red-400' : daysLeft <= 30 ? 'text-amber-400' : 'text-emerald-400'}`}>
                                    ({daysLeft}d)
                                  </span>
                                )}
                              </p>
                              <p className="text-xs font-bold text-primary tabular-nums mt-0.5">
                                {formatCurrency(m.precio)}
                              </p>
                            </div>
                          </div>
                        </div>
                      )
                    })}

                    {membresias.length === 0 && (
                      <p className="text-xs text-gray-400 dark:text-[#8A8A9A] text-center py-3">
                        Este cliente no tiene membresías registradas
                      </p>
                    )}

                    {/* Paginación */}
                    {membresias.length > 5 && (
                      <div className="flex items-center justify-between pt-1">
                        <button
                          type="button"
                          onClick={() => setMembPage(p => Math.max(0, p - 1))}
                          disabled={membPage === 0}
                          className="text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors px-2 py-1"
                        >
                          ← Anteriores
                        </button>
                        <span className="text-[11px] text-gray-400 dark:text-gray-500 tabular-nums">
                          {membPage * 5 + 1}–{Math.min(membPage * 5 + 5, membresias.length)} de {membresias.length}
                        </span>
                        <button
                          type="button"
                          onClick={() => setMembPage(p => p + 1)}
                          disabled={(membPage + 1) * 5 >= membresias.length}
                          className="text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors px-2 py-1"
                        >
                          Siguientes →
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ── Acciones edición ──────────────────────────────────────── */}
              <div className="flex gap-3">
                <motion.button
                  onClick={cancelEdit}
                  whileTap={{ scale: 0.97 }}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border border-gray-200 dark:border-white/[0.1] text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors"
                >
                  <XCircle size={15} /> Cancelar
                </motion.button>
                <motion.button
                  onClick={handleSaveEdit}
                  disabled={saving || !editForm.amount || !editForm.paidAt}
                  whileTap={!saving ? { scale: 0.97 } : {}}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-primary text-black text-sm font-bold hover:bg-primary-dark disabled:opacity-50 transition-colors"
                >
                  <Save size={15} /> {saving ? 'Guardando…' : 'Guardar cambios'}
                </motion.button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="view"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
              className="space-y-4"
            >
              {/* Stack vertical */}
              <div className="space-y-4">

                {/* 1 — Método + monto + fecha + notas */}
                <div className={`rounded-[2rem] border ${cfg.border} ${cfg.bg} backdrop-blur-3xl p-7 shadow-sm flex flex-col gap-5`}>
                  <div className={`inline-flex items-center gap-2 rounded-xl ${cfg.bg} border ${cfg.border} px-3 py-1.5 self-start`}>
                    <MethodIcon size={14} className={cfg.color} />
                    <span className={`text-xs font-bold ${cfg.color}`}>{cfg.label}</span>
                  </div>
                  <div>
                    <p className="text-4xl xl:text-5xl font-black tabular-nums tracking-tighter text-gray-900 dark:text-white">
                      {formatCurrency(payment.amount)}
                    </p>
                    <div className="flex items-center gap-3 mt-3 flex-wrap">
                      <span className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
                        <Calendar size={13} /> {formatDate(payment.paidAt)}
                      </span>
                      <span className="text-gray-300 dark:text-gray-600">·</span>
                      <span className="font-mono text-xs text-gray-400 dark:text-gray-500">
                        #{String(payment.id).slice(0, 8)}…
                      </span>
                    </div>
                  </div>
                  {payment.notes && (
                    <div className="pt-4 border-t border-white/20 dark:border-white/[0.08]">
                      <p className={`${labelCls} mb-1.5 flex items-center gap-1.5`}><FileText size={11} /> Comprobante</p>
                      <p className="text-sm text-gray-700 dark:text-gray-300 font-medium">{payment.notes}</p>
                    </div>
                  )}
                </div>

                {/* 2 — Cliente */}
                <div className="rounded-[2rem] border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-3xl p-7 shadow-sm flex flex-col gap-5">
                  <p className={`${labelCls} flex items-center gap-1.5`}><User size={11} /> Cliente</p>
                  <div className="flex items-center gap-4">
                    <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-2xl font-black text-primary leading-none">{payment.clientName.charAt(0).toUpperCase()}</span>
                    </div>
                    <p className="text-xl font-black text-gray-900 dark:text-white leading-tight">{payment.clientName}</p>
                  </div>
                  <Link
                    to={`/clients/${payment.clientId}`}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-white/50 dark:border-white/10 bg-white/40 dark:bg-white/[0.05] px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-white/70 dark:hover:bg-white/10 transition-all"
                  >
                    Ver perfil →
                  </Link>
                </div>

                {/* 3 — Membresía vinculada */}
                {payment.membresia ? (
                  <div className="rounded-[2rem] border border-primary/25 bg-primary/[0.04] backdrop-blur-3xl p-7 shadow-sm flex flex-col gap-5">
                    <p className={`${labelCls} text-primary flex items-center gap-1.5`}><Tag size={11} /> Membresía vinculada</p>
                    <div className="grid grid-cols-2 gap-2.5">
                      {[
                        { label: 'Plan',        value: payment.membresia.planNombre },
                        { label: 'Modalidad',   value: MODALIDAD_LABELS[payment.membresia.modalidad] ?? payment.membresia.modalidad },
                        { label: 'Estado',      value: (() => {
                            const s = MEMB_STATUS_CONFIG[payment.membresia!.estado]
                            return s
                              ? <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded-lg ${s.bg} ${s.color}`}>{s.label}</span>
                              : payment.membresia!.estado
                          })() },
                        { label: 'Precio',      value: formatCurrency(payment.membresia.precio) },
                        { label: 'Inicio',      value: formatDate(payment.membresia.fechaInicio) },
                        { label: 'Vencimiento', value: formatDate(payment.membresia.fechaVencimiento) },
                      ].map(({ label, value }) => (
                        <div key={label} className="rounded-xl bg-white/40 dark:bg-black/20 border border-white/50 dark:border-white/10 px-3.5 py-3">
                          <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider font-medium">{label}</p>
                          <div className="text-sm font-bold text-gray-900 dark:text-white mt-0.5">{value}</div>
                        </div>
                      ))}
                    </div>
                    {payment.cuotaNumero != null && payment.cuotaNumero <= 36 && (
                      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                        <Hash size={14} className="text-primary" />
                        Cuota <span className="font-black text-primary ml-0.5">#{payment.cuotaNumero}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-[2rem] border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-3xl p-7 shadow-sm flex flex-col items-center justify-center gap-3 text-center">
                    <Tag size={24} className="text-gray-300 dark:text-gray-600" />
                    <div>
                      <p className="text-sm font-bold text-gray-500 dark:text-gray-400">Sin membresía vinculada</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Editá el pago para vincular una</p>
                    </div>
                  </div>
                )}

                {/* 4 — Facturado toggle */}
                <div className="rounded-[2rem] border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-3xl p-7 shadow-sm flex items-center justify-between gap-6">
                  <div className="flex items-center gap-4">
                    <div className={`h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 transition-colors duration-300 ${
                      payment.invoiced ? 'bg-emerald-500/15' : 'bg-gray-100/60 dark:bg-white/[0.05]'
                    }`}>
                      {payment.invoiced
                        ? <CheckCircle2 size={22} className="text-emerald-500" />
                        : <FileText size={22} className="text-gray-400 dark:text-gray-500" />}
                    </div>
                    <div>
                      <p className={`text-base font-black transition-colors duration-300 ${
                        payment.invoiced ? 'text-emerald-700 dark:text-emerald-400' : 'text-gray-900 dark:text-white'
                      }`}>
                        {payment.invoiced ? 'Facturado' : 'Sin facturar'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {payment.invoiced ? 'Este pago fue facturado' : 'Este pago aún no fue facturado'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleToggleInvoiced}
                    disabled={togglingInvoiced}
                    className={`relative inline-flex h-7 w-14 items-center rounded-full transition-all duration-300 focus:outline-none shrink-0 ${
                      payment.invoiced
                        ? 'bg-emerald-500 shadow-[0_0_16px_rgba(16,185,129,0.35)]'
                        : 'bg-gray-200 dark:bg-gray-700/60'
                    } ${togglingInvoiced ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:scale-105'}`}
                    aria-checked={payment.invoiced}
                    role="switch"
                  >
                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-300 ${
                      payment.invoiced ? 'translate-x-[30px]' : 'translate-x-[4px]'
                    }`} />
                  </button>
                </div>
              </div>

              {/* Acciones admin */}
              {isAdmin && (
                <div className="flex items-center justify-between pt-1">
                  <motion.button
                    onClick={openEdit}
                    whileTap={{ scale: 0.96 }}
                    className="flex items-center gap-2 rounded-2xl border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-xl px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-white/50 dark:hover:bg-black/50 transition-colors"
                  >
                    <Edit2 size={15} /> Editar pago
                  </motion.button>
                  <motion.button
                    onClick={() => setIsConfirmOpen(true)}
                    disabled={deleting}
                    whileTap={!deleting ? { scale: 0.96 } : {}}
                    className="flex items-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                  >
                    <Trash2 size={15} /> Eliminar pago
                  </motion.button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
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
