import type { ReactNode } from 'react';
import { cn, toneBg, toneStroke, toneText, wrTone } from '@/lib/utils';

/** Радиальный индикатор винрейта. Цвет — по семантическим порогам (>53 / 49–53 / <49). */
export function RadialWinrate({
  value,
  size = 96,
  stroke = 8,
  label,
  sublabel,
  className,
}: {
  value: number;
  size?: number;
  stroke?: number;
  label?: ReactNode;
  sublabel?: ReactNode;
  className?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const tone = wrTone(value);
  const dash = c * Math.min(1, Math.max(0, value));

  return (
    <div className={cn('relative inline-grid place-items-center', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-white/[0.06]" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
          className={cn(toneStroke[tone], toneText[tone], 'transition-[stroke-dasharray] duration-700 ease-out')}
          style={{ filter: 'drop-shadow(0 0 6px currentColor)' }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className={cn('num font-bold leading-none', toneText[tone])} style={{ fontSize: size * 0.22 }}>
            {label ?? `${(value * 100).toFixed(0)}%`}
          </div>
          {sublabel && <div className="mt-1 text-2xs text-fg-dim">{sublabel}</div>}
        </div>
      </div>
    </div>
  );
}

/** Горизонтальный прогресс-бар. Если tone не задан — цвет по винрейту. */
export function ProgressBar({
  value,
  tone,
  className,
  height = 'h-1.5',
}: {
  value: number;
  tone?: 'cyan' | 'red' | 'wr' | 'high' | 'mid' | 'low';
  className?: string;
  height?: string;
}) {
  const color =
    tone === 'cyan'
      ? 'bg-accent'
      : tone === 'red'
        ? 'bg-primary'
        : tone === 'high' || tone === 'mid' || tone === 'low'
          ? toneBg[tone]
          : toneBg[wrTone(value)];
  return (
    <div className={cn('w-full overflow-hidden rounded-full bg-white/[0.06]', height, className)}>
      <div
        className={cn('h-full rounded-full transition-[width] duration-700 ease-out', color)}
        style={{ width: `${Math.min(100, Math.max(2, value * 100))}%` }}
      />
    </div>
  );
}
