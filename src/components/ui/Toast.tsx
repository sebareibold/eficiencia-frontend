import { AnimatePresence, motion } from 'framer-motion'
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react'
import { useUiStore, type Toast as ToastType } from '../../store/uiStore'
import { toastVariants } from '../../lib/motion'

const config: Record<ToastType['type'], { icon: React.ReactNode; border: string; bg: string }> = {
  success: {
    icon: <CheckCircle size={16} className="text-emerald-400 shrink-0" />,
    border: 'border-emerald-500/20',
    bg: 'bg-emerald-500/10',
  },
  error: {
    icon: <AlertCircle size={16} className="text-red-400 shrink-0" />,
    border: 'border-red-500/20',
    bg: 'bg-red-500/10',
  },
  info: {
    icon: <Info size={16} className="text-blue-400 shrink-0" />,
    border: 'border-blue-500/20',
    bg: 'bg-blue-500/10',
  },
}

function ToastItem({ toast }: { toast: ToastType }) {
  const removeToast = useUiStore((s) => s.removeToast)
  const { icon, border, bg } = config[toast.type] ?? config.info

  return (
    <motion.div
      layout
      {...toastVariants}
      className={`flex items-start gap-3 rounded-2xl border ${border} ${bg} backdrop-blur-2xl px-4 py-3 shadow-2xl`}
    >
      {icon}
      <span className="text-sm font-semibold text-gray-900 dark:text-white flex-1">{toast.message}</span>
      <button
        onClick={() => removeToast(toast.id)}
        className="text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors duration-150 active:scale-95 ml-1"
      >
        <X size={14} />
      </button>
    </motion.div>
  )
}

export default function ToastContainer() {
  const toasts = useUiStore((s) => s.toasts)
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 w-80 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem toast={t} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  )
}
