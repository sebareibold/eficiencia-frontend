import { type ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  title?: string
}

export default function Card({ children, className = '', title }: CardProps) {
  return (
    <div className={`rounded-xl border border-custom-border bg-surface p-4 ${className}`}>
      {title && <h3 className="mb-3 text-sm font-semibold text-[#9CA3AF] uppercase tracking-wider">{title}</h3>}
      {children}
    </div>
  )
}
