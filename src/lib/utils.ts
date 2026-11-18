import { clsx, type ClassValue } from 'clsx';

export const cn = (...inputs: ClassValue[]) => clsx(inputs);

export const clamp = (v: number, min = 0, max = 1) => Math.min(max, Math.max(min, v));

/** Байесовское сглаживание винрейта к prior (защита от «100% WR за 2 игры»). */
export const shrink = (wins: number, games: number, k: number, prior = 0.5) => (wins + k * prior) / (games + k);

export type WrTone = 'high' | 'mid' | 'low';

/** Пороговые значения дизайн-системы: >53% — high, 49–53% — mid, <49% — low. */
export function wrTone(wr: number): WrTone {
  if (wr > 0.53) return 'high';
  if (wr >= 0.49) return 'mid';
  return 'low';
}

export const toneText: Record<WrTone, string> = {
  high: 'text-win-high',
  mid: 'text-win-mid',
  low: 'text-win-low',
};
export const toneBg: Record<WrTone, string> = {
  high: 'bg-win-high',
  mid: 'bg-win-mid',
  low: 'bg-win-low',
};
export const toneStroke: Record<WrTone, string> = {
  high: 'stroke-win-high',
  mid: 'stroke-win-mid',
  low: 'stroke-win-low',
};

export const pct = (v: number, digits = 1) => `${(v * 100).toFixed(digits)}%`;
export const signed = (v: number, digits = 1) => `${v > 0 ? '+' : v < 0 ? '−' : '±'}${Math.abs(v).toFixed(digits)}`;

export const kda = (k: number, d: number, a: number) => (k + a) / Math.max(1, d);

const RANKS = ['Uncalibrated', 'Herald', 'Guardian', 'Crusader', 'Archon', 'Legend', 'Ancient', 'Divine', 'Immortal'];

export function rankLabel(rankTier: number | null | undefined): string {
  if (!rankTier) return 'Без ранга';
  const tier = Math.floor(rankTier / 10);
  const star = rankTier % 10;
  if (tier >= 8) return 'Immortal';
  return `${RANKS[tier] ?? 'Unknown'} ${star || ''}`.trim();
}

/** Брекет для heroStats (1..8) из rank_tier. */
export const bracketOf = (rankTier: number | null | undefined) => (rankTier ? Math.min(8, Math.floor(rankTier / 10)) : null);

export function timeAgo(unixSeconds: number): string {
  const diff = Date.now() / 1000 - unixSeconds;
  if (diff < 3600) return `${Math.max(1, Math.round(diff / 60))} мин назад`;
  if (diff < 86400) return `${Math.round(diff / 3600)} ч назад`;
  const days = Math.round(diff / 86400);
  return `${days} дн назад`;
}

export const formatDuration = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
