import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon?: LucideIcon
  title?: string
  message: string
  action?: ReactNode
  className?: string
}

export default function EmptyState({ icon: Icon, title, message, action, className = '' }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 py-14 text-center ${className}`}>
      {Icon && (
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-black/[0.04] dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08]">
          <Icon size={20} className="text-gray-400 dark:text-[#8A8A9A]" />
        </div>
      )}
      {title && <p className="text-sm font-semibold text-gray-900 dark:text-white">{title}</p>}
      <p className="text-sm text-gray-500 dark:text-[#8A8A9A]">{message}</p>
      {action}
    </div>
  )
}
