import { memo, type ElementType, type ReactNode } from 'react'
import Skeleton from './Skeleton'

interface KpiCardProps {
  label: string
  value: string
  icon: ElementType
  iconColor?: string
  iconBg?: string
  isLoading?: boolean
  sub?: ReactNode
  subColor?: string
  compact?: boolean
}

const KpiCard = memo(function KpiCard({
  label,
  value,
  icon: Icon,
  iconColor = 'text-gray-500 dark:text-gray-400',
  iconBg = 'bg-gray-100/60 dark:bg-white/5',
  isLoading = false,
  sub,
  subColor = 'text-gray-500 dark:text-gray-400',
  compact = false,
}: KpiCardProps) {
  return (
    <div className={`group relative overflow-hidden rounded-[2rem] border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-3xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)] transition-all duration-500 hover:-translate-y-1 hover:bg-white/50 dark:hover:bg-black/50 hover:shadow-[0_20px_40px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_20px_40px_rgba(0,0,0,0.4)] ${compact ? 'p-4' : 'p-4 sm:p-5 xl:p-6'}`}>
      <div className={`relative z-10 flex h-full ${compact ? 'flex-row items-center gap-3' : 'flex-col justify-between gap-3 xl:gap-4'}`}>
        {isLoading ? (
          compact ? (
            <>
              <Skeleton className="h-9 w-9 rounded-xl shrink-0" />
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
            </>
          ) : (
            <>
              <Skeleton className="h-10 w-10 xl:h-12 xl:w-12 rounded-2xl" />
              <div className="space-y-2">
                <Skeleton className="h-7 xl:h-9 w-28 xl:w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
            </>
          )
        ) : compact ? (
          <>
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-inner ${iconBg}`}>
              <Icon size={16} className={iconColor} />
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-black tracking-tight text-gray-900 dark:text-white tabular-nums leading-none">
                {value}
              </h3>
              <p className="mt-0.5 text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 truncate">
                {label}
              </p>
              {sub && <p className={`mt-1 text-xs font-medium ${subColor}`}>{sub}</p>}
            </div>
          </>
        ) : (
          <>
            <div className="flex items-start justify-between">
              <div className={`flex h-10 w-10 xl:h-12 xl:w-12 items-center justify-center rounded-xl xl:rounded-2xl shadow-inner ${iconBg}`}>
                <Icon size={19} className={iconColor} />
              </div>
            </div>
            <div>
              <h3 className="text-2xl xl:text-3xl 2xl:text-4xl font-black tracking-tighter text-gray-900 dark:text-white tabular-nums drop-shadow-sm">
                {value}
              </h3>
              <p className="mt-1 text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">
                {label}
              </p>
              {sub && (
                <p className={`mt-1.5 text-xs font-medium ${subColor}`}>{sub}</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
})

export default KpiCard
