import { Crosshair, ExternalLink, Gem } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { HeroStat } from '@/lib/api/opendota';
import { cdn } from '@/lib/api/opendota';
import { cn } from '@/lib/utils';

export const AUTHOR_YOUTUBE_URL = 'https://www.youtube.com/@MemoryShardsDev';

function YouTubeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M23.5 6.2a3.02 3.02 0 0 0-2.12-2.14C19.5 3.55 12 3.55 12 3.55s-7.5 0-9.38.51A3.02 3.02 0 0 0 .5 6.2 31.6 31.6 0 0 0 0 12a31.6 31.6 0 0 0 .5 5.8 3.02 3.02 0 0 0 2.12 2.14c1.88.51 9.38.51 9.38.51s7.5 0 9.38-.51a3.02 3.02 0 0 0 2.12-2.14A31.6 31.6 0 0 0 24 12a31.6 31.6 0 0 0-.5-5.8ZM9.6 15.6V8.4l6.24 3.6-6.24 3.6Z" />
    </svg>
  );
}

/** Кнопка-ссылка на YouTube-канал автора для поддержки проекта. */
export function SupportAuthorButton({ className }: { className?: string }) {
  return (
    <a
      href={AUTHOR_YOUTUBE_URL}
      target="_blank"
      rel="noopener noreferrer"
      title="Поддержать автора на YouTube — @MemoryShardsDev"
      className={cn(
        'btn-ghost btn-sm whitespace-nowrap border-primary/40 bg-primary/10 text-fg hover:border-primary-bright/70 hover:bg-primary/20',
        className,
      )}
    >
      <YouTubeIcon className="h-4 w-4 shrink-0 text-primary-bright" />
      <span>Поддержать автора</span>
      <ExternalLink className="h-3 w-3 shrink-0 text-fg-dim" />
    </a>
  );
}

export function HeroImage({
  hero,
  variant = 'full',
  className,
}: {
  hero: HeroStat | undefined;
  variant?: 'full' | 'icon';
  className?: string;
}) {
  if (!hero) return <div className={cn('rounded bg-surface-3', className)} />;
  return (
    <img
      src={cdn(variant === 'icon' ? hero.icon : hero.img)}
      alt={hero.localized_name}
      loading="lazy"
      draggable={false}
      className={cn('select-none object-cover', className)}
    />
  );
}

export const ATTR_META = {
  str: { label: 'Сила', dot: 'bg-attr-str', text: 'text-attr-str' },
  agi: { label: 'Ловкость', dot: 'bg-attr-agi', text: 'text-attr-agi' },
  int: { label: 'Интеллект', dot: 'bg-attr-int', text: 'text-attr-int' },
  all: { label: 'Универсал', dot: 'bg-attr-all', text: 'text-attr-all' },
} as const;

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="group flex items-center gap-2.5">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary shadow-glow-red transition group-hover:rotate-6">
        <Crosshair className="text-white" size={18} strokeWidth={2.5} />
      </span>
      {!compact && (
        <div className="flex flex-col leading-none">
          <span className="text-[15px] font-extrabold tracking-tight">
            Draft<span className="text-primary-bright">Lens</span>
          </span>
          <span className="mt-0.5 text-[10px] font-semibold tracking-wider text-fg-dim">
            by <span className="text-accent">Memory Shards</span>
          </span>
        </div>
      )}
    </Link>
  );
}

export function StudioFooter() {
  return (
    <footer className="relative z-10 mt-16 border-t border-line bg-surface/40 py-6">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-5 text-xs text-fg-muted sm:flex-row">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 font-semibold text-accent">
            <Gem className="h-3.5 w-3.5" /> Memory Shards Studio
          </span>
          <span className="text-fg-dim">· Разработка и дизайн DraftLens</span>
          <SupportAuthorButton className="py-1" />
        </div>
        <div className="text-center text-2xs text-fg-dim sm:text-right">
          Работает на открытых данных OpenDota API & Steam Web API · Dota 2 является товарным знаком Valve Corporation
        </div>
      </div>
    </footer>
  );
}
