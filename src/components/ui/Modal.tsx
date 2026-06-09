import { type ReactNode, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { backdropVariants, modalVariants } from '../../lib/motion'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl'
}

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  '2xl': 'max-w-6xl',
}

export default function Modal({ isOpen, onClose, title, children, size = 'md' }: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = '' }
    }
  }, [isOpen])

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="backdrop"
          {...backdropVariants}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
        >
          <motion.div
            key="panel"
            {...modalVariants}
            className={`w-full ${sizeClasses[size]} max-h-[90vh] flex flex-col rounded-[2rem] border border-white/50 dark:border-white/10 bg-white/95 dark:bg-[#0a0a0a]/95 backdrop-blur-3xl shadow-[0_24px_60px_rgba(0,0,0,0.1)] dark:shadow-[0_24px_60px_rgba(0,0,0,0.5)] relative overflow-hidden`}
            onClick={(e) => e.stopPropagation()}
          >
            {title && (
              <div className="flex items-center justify-between border-b border-white/20 dark:border-white/10 px-6 py-4 shrink-0">
                <h2 className="text-base font-bold tracking-tight text-gray-900 dark:text-white">{title}</h2>
                <button
                  onClick={onClose}
                  className="rounded-full p-2 text-gray-500 dark:text-gray-400 transition-all duration-300 hover:bg-black/5 dark:hover:bg-white/10 hover:text-gray-900 dark:hover:text-white active:scale-95"
                >
                  <X size={16} />
                </button>
              </div>
            )}
            <div className="px-6 py-5 overflow-hidden">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
