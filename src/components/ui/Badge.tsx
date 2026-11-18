import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type BadgeTone = 'red' | 'cyan' | 'green' | 'amber' | 'gray' | 'violet';

const tones: Record<BadgeTone, string> = {
  red: 'bg-primary/15 text-primary-bright ring-primary/30',
  cyan: 'bg-accent/10 text-accent ring-accent/25',
  green: 'bg-win-high/15 text-win-high ring-win-high/30',
  amber: 'bg-win-mid/15 text-win-mid ring-win-mid/30',
  gray: 'bg-white/5 text-fg-muted ring-white/10',
  violet: 'bg-attr-all/15 text-attr-all ring-attr-all/30',
};

export function Badge({
  tone = 'gray',
  icon,
  children,
  className,
}: {
  tone?: BadgeTone;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-2xs font-semibold ring-1 ring-inset',
        tones[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}
