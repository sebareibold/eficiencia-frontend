import { X, CheckCircle, AlertCircle, Info } from 'lucide-react'
import { useUiStore, type Toast as ToastType } from '../../store/uiStore'

const icons = {
  success: <CheckCircle size={16} className="text-green-400 shrink-0" />,
  error: <AlertCircle size={16} className="text-red-400 shrink-0" />,
  info: <Info size={16} className="text-blue-400 shrink-0" />,
}

function ToastItem({ toast }: { toast: ToastType }) {
  const removeToast = useUiStore((s) => s.removeToast)
  return (
    <div className="flex items-start gap-3 rounded-xl border border-custom-border bg-surface px-4 py-3 shadow-xl">
      {icons[toast.type]}
      <span className="text-sm text-white">{toast.message}</span>
      <button
        onClick={() => removeToast(toast.id)}
        className="ml-auto text-[#9CA3AF] hover:text-white transition-colors"
      >
        <X size={14} />
      </button>
    </div>
  )
}

export default function ToastContainer() {
  const toasts = useUiStore((s) => s.toasts)
  if (!toasts.length) return null
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 w-80">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  )
}
