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
  /** 'lg' = 2 cols, 'md' = 3-4 cols (default), 'sm' = 5-6 cols */
  size?: 'lg' | 'md' | 'sm'
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
  size,
  compact = false,
}: KpiCardProps) {
  // size prop takes priority over legacy compact
  const resolvedSize = size ?? (compact ? 'sm' : 'md')

  if (resolvedSize === 'sm') {
    // Compact horizontal — 5-6 cols
    return (
      <div className="group relative overflow-hidden rounded-2xl border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-3xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)] transition-all duration-500 hover:-translate-y-0.5 hover:bg-white/50 dark:hover:bg-black/50 p-2.5 sm:p-3">
        <div className="relative z-10 flex h-full flex-row items-center gap-2.5">
          {isLoading ? (
            <>
              <Skeleton className="h-8 w-8 rounded-xl shrink-0" />
              <div className="space-y-1.5 flex-1 min-w-0">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-2.5 w-12" />
              </div>
            </>
          ) : (
            <>
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl shadow-inner ${iconBg}`}>
                <Icon size={13} className={iconColor} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-black tracking-tight text-gray-900 dark:text-white tabular-nums leading-none truncate">
                  {value}
                </h3>
                <p className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 truncate">
                  {label}
                </p>
                {sub && <p className={`mt-0.5 text-[10px] font-medium ${subColor} truncate`}>{sub}</p>}
              </div>
            </>
          )}
        </div>
      </div>
    )
  }

  if (resolvedSize === 'lg') {
    // Grande — 2 cols
    return (
      <div className="group relative overflow-hidden rounded-[2rem] border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-3xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)] transition-all duration-500 hover:-translate-y-1 hover:bg-white/50 dark:hover:bg-black/50 hover:shadow-[0_20px_40px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_20px_40px_rgba(0,0,0,0.4)] p-5 sm:p-6 xl:p-8">
        <div className="relative z-10 flex h-full flex-col justify-between gap-4 xl:gap-5">
          {isLoading ? (
            <>
              <Skeleton className="h-14 w-14 rounded-2xl" />
              <div className="space-y-2">
                <Skeleton className="h-10 w-36" />
                <Skeleton className="h-3 w-28" />
              </div>
            </>
          ) : (
            <>
              <div className="flex items-start justify-between">
                <div className={`flex h-14 w-14 items-center justify-center rounded-2xl shadow-inner ${iconBg}`}>
                  <Icon size={26} className={iconColor} />
                </div>
              </div>
              <div>
                <h3 className="text-3xl xl:text-4xl 2xl:text-5xl font-black tracking-tighter text-gray-900 dark:text-white tabular-nums drop-shadow-sm">
                  {value}
                </h3>
                <p className="mt-1 text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">
                  {label}
                </p>
                {sub && <p className={`mt-1.5 text-xs font-medium ${subColor}`}>{sub}</p>}
              </div>
            </>
          )}
        </div>
      </div>
    )
  }

  // 'md' — default (3-4 cols)
  return (
    <div className="group relative overflow-hidden rounded-[2rem] border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-3xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)] transition-all duration-500 hover:-translate-y-1 hover:bg-white/50 dark:hover:bg-black/50 hover:shadow-[0_20px_40px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_20px_40px_rgba(0,0,0,0.4)] p-3 sm:p-4 xl:p-6">
      <div className="relative z-10 flex h-full flex-col justify-between gap-3 xl:gap-4">
        {isLoading ? (
          <>
            <Skeleton className="h-10 w-10 xl:h-12 xl:w-12 rounded-2xl" />
            <div className="space-y-2">
              <Skeleton className="h-7 xl:h-9 w-28 xl:w-32" />
              <Skeleton className="h-3 w-24" />
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
              {sub && <p className={`mt-1.5 text-xs font-medium ${subColor}`}>{sub}</p>}
            </div>
          </>
        )}
      </div>
    </div>
  )
})

export default KpiCard
