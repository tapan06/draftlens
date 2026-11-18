import { useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

/**
 * Лёгкий тултип через портал.
 * На сенсорных экранах (телефонах/планшетах) отключён, чтобы не перехватывать первый тап
 * и не залипать поверх сетки героев.
 */
export function Tooltip({
  content,
  children,
  className,
  side = 'top',
}: {
  content: ReactNode;
  children: ReactNode;
  className?: string;
  side?: 'top' | 'bottom';
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number; side: 'top' | 'bottom' } | null>(null);

  const show = () => {
    if (typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches) {
      return;
    }
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const s = side === 'top' && r.top < 160 ? 'bottom' : side;
    const x = Math.min(window.innerWidth - 150, Math.max(150, r.left + r.width / 2));
    setPos({ x, y: s === 'top' ? r.top - 8 : r.bottom + 8, side: s });
  };
  const hide = () => setPos(null);

  return (
    <span
      ref={ref}
      className={cn('inline-flex', className)}
      onPointerEnter={(e) => {
        if (e.pointerType === 'mouse') show();
      }}
      onPointerLeave={hide}
    >
      {children}
      {pos &&
        content &&
        createPortal(
          <div
            role="tooltip"
            style={{ left: pos.x, top: pos.y }}
            className={cn(
              'pointer-events-none fixed z-[100] w-max max-w-[280px] -translate-x-1/2',
              pos.side === 'top' && '-translate-y-full',
            )}
          >
            <div className="animate-fade-in rounded-lg border border-line-strong bg-[#0F131B]/95 px-3 py-2 text-xs text-fg shadow-2xl backdrop-blur">
              {content}
            </div>
          </div>,
          document.body,
        )}
    </span>
  );
}
