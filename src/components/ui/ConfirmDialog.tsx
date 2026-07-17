import { AlertTriangle } from 'lucide-react'
import Modal from './Modal'
import Button from './Button'

interface ConfirmDialogProps {
  isOpen: boolean
  title: string
  message: string
  details?: string[]
  warning?: string
  confirmLabel?: string
  confirmVariant?: 'danger' | 'primary'
  isLoading?: boolean
  onConfirm: () => void
  onClose: () => void
}

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  details,
  warning,
  confirmLabel = 'Eliminar',
  confirmVariant = 'danger',
  isLoading,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  return (
    <Modal isOpen={isOpen} onClose={isLoading ? () => {} : onClose} size="sm">
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0 mt-0.5">
            <AlertTriangle size={18} className="text-red-500" />
          </div>
          <div>
            <p className="text-base font-bold text-gray-900 dark:text-white">{title}</p>
            <p className="text-sm text-gray-500 dark:text-[#8A8A9A] mt-1 leading-relaxed">{message}</p>
          </div>
        </div>

        {details && details.length > 0 && (
          <ul className="space-y-1.5 rounded-xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/[0.07] px-4 py-3">
            {details.map((d, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                <span className="mt-1.5 h-1 w-1 rounded-full bg-gray-400 dark:bg-gray-500 shrink-0" />
                {d}
              </li>
            ))}
          </ul>
        )}

        {warning && (
          <div className="flex items-start gap-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-3">
            <AlertTriangle size={15} className="text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-600 dark:text-amber-400 leading-relaxed">{warning}</p>
          </div>
        )}

        <div className="flex gap-2">
          <Button variant="ghost" className="flex-1" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button variant={confirmVariant} className="flex-1" onClick={onConfirm} isLoading={isLoading}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
