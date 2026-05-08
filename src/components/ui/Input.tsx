import { forwardRef, type InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, id, className = '', ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label htmlFor={inputId} className="text-sm font-bold tracking-tight text-gray-700 dark:text-gray-300">
            {label}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            className={`w-full rounded-xl border border-gray-200 dark:border-white/10 bg-white/50 dark:bg-black/40 backdrop-blur-sm px-4 py-3 text-sm font-semibold text-gray-900 dark:text-white transition-all duration-200 ease-out placeholder-gray-400 dark:placeholder-gray-500 focus:border-primary focus:bg-white dark:focus:bg-black/80 focus:outline-none focus:ring-4 focus:ring-primary/10 shadow-sm ${error ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20 text-red-900 dark:text-red-400' : ''} ${className}`}
            {...props}
          />
        </div>
        {error && <span className="text-xs font-bold text-red-500 dark:text-red-400 mt-0.5">{error}</span>}
      </div>
    )
  },
)

Input.displayName = 'Input'

export default Input
