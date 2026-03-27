import { Skeleton } from '@/components/ui/skeleton'

export function MobileHomeSkeleton(): React.JSX.Element {
  return (
    <div className="space-y-3 px-4 pt-6">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 h-[72px] rounded-lg bg-card border border-border px-4"
        >
          <Skeleton className="h-10 w-10 rounded-md shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  )
}
