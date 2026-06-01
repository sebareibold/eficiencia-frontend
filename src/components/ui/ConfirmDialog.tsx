import { AlertTriangle } from 'lucide-react'
import Modal from './Modal'
import Button from './Button'

interface ConfirmDialogProps {
  isOpen: boolean
  title: string
  message: string
  confirmLabel?: string
  isLoading?: boolean
  onConfirm: () => void
  onClose: () => void
}

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Eliminar',
  isLoading,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  return (
    <Modal isOpen={isOpen} onClose={isLoading ? () => {} : onClose} size="sm">
      <div className="space-y-5">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0 mt-0.5">
            <AlertTriangle size={18} className="text-red-500" />
          </div>
          <div>
            <p className="text-base font-bold text-gray-900 dark:text-white">{title}</p>
            <p className="text-sm text-gray-500 dark:text-[#8A8A9A] mt-1 leading-relaxed">{message}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" className="flex-1" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button variant="danger" className="flex-1" onClick={onConfirm} isLoading={isLoading}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
