import { cn } from '@/lib/utils';

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('skeleton', className)} />;
}

/** Скелетон Bento-карточки: заголовок + N строк. */
export function SkeletonCard({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('card p-5', className)}>
      <Skeleton className="mb-4 h-3 w-32" />
      <div className="space-y-3">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} className={cn('h-4', i % 2 ? 'w-3/4' : 'w-full')} />
        ))}
      </div>
    </div>
  );
}
