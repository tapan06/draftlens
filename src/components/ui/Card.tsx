import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface CardProps {
  title?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
  glow?: 'red' | 'cyan' | 'green';
}

/** Базовая Bento-карточка: #131822, 1px rgba(255,255,255,.08), радиус 14px. */
export function Card({ title, icon, action, className, bodyClassName, children, glow }: CardProps) {
  return (
    <section
      className={cn(
        'card relative overflow-hidden animate-fade-in',
        glow === 'red' && 'shadow-glow-red',
        glow === 'cyan' && 'shadow-glow-cyan',
        glow === 'green' && 'shadow-glow-green',
        className,
      )}
    >
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 px-4 pt-4 sm:px-5">
          {title && (
            <h2 className="card-title">
              {icon}
              {title}
            </h2>
          )}
          {action}
        </header>
      )}
      <div className={cn('p-4 sm:p-5', title && 'pt-3 sm:pt-3', bodyClassName)}>{children}</div>
    </section>
  );
}
