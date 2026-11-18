/**
 * Личный пул героев: по умолчанию сортируется по КОЛИЧЕСТВУ ИГР (твои реальные мейны),
 * а также считает сглаженный винрейт, KDA, мета-WR в брекете игрока и тренд меты.
 */
import type { HeroStat } from '@/lib/api/opendota';
import type { ClassifiedMatch, Role } from '@/lib/analytics/roles';
import { kda, shrink } from '@/lib/utils';

export type PoolTag = 'signature' | 'comfort' | 'trending' | 'meta';

export interface PoolHero {
  heroId: number;
  games: number;
  wins: number;
  wr: number;
  shrunkWr: number;
  kda: number;
  mainRole: Role;
  roleGames: Partial<Record<Role, number>>;
  /** Последние 5 игр на герое, новые первыми. */
  recent: boolean[];
  metaWr: number;
  /** Изменение винрейта героя в пабах за последние дни, pp. */
  metaTrend: number;
  /** Скор для драфт-рекомендатора (учитывает и наигрыш, и винрейт). */
  score: number;
  tags: PoolTag[];
}

/** Винрейт героя в брекете игрока (фолбэк — все пабы). */
export function metaWinrate(h: HeroStat, bracket: number | null): number {
  if (bracket && bracket >= 1 && bracket <= 8) {
    const picks = h[`${bracket}_pick`];
    const wins = h[`${bracket}_win`];
    if (picks && picks >= 500) return wins / picks;
  }
  return h.pub_pick ? h.pub_win / h.pub_pick : 0.5;
}

/** Тренд: WR последних 3 полных дней минус WR первых 3 дней окна. */
export function metaTrend(h: HeroStat): number {
  const p = h.pub_pick_trend;
  const w = h.pub_win_trend;
  if (!p || !w || p.length < 5) return 0;
  const full = p.length - 1;
  const wr = (from: number, to: number) => {
    let picks = 0;
    let wins = 0;
    for (let i = from; i < to; i++) {
      picks += p[i] ?? 0;
      wins += w[i] ?? 0;
    }
    return picks ? wins / picks : 0.5;
  };
  return (wr(full - 3, full) - wr(0, 3)) * 100;
}

export function buildHeroPool(
  matches: ClassifiedMatch[],
  heroesById: Map<number, HeroStat>,
  bracket: number | null,
): PoolHero[] {
  const byHero = new Map<number, ClassifiedMatch[]>();
  for (const m of matches) {
    const list = byHero.get(m.hero_id) ?? [];
    list.push(m);
    byHero.set(m.hero_id, list);
  }

  const pool: PoolHero[] = [];
  for (const [heroId, list] of byHero) {
    const hero = heroesById.get(heroId);
    if (!hero) continue;
    const games = list.length;
    const wins = list.filter((m) => m.win).length;
    const roleGames: Partial<Record<Role, number>> = {};
    for (const m of list) roleGames[m.role] = (roleGames[m.role] ?? 0) + 1;
    const mainRole = (Object.entries(roleGames) as [Role, number][]).sort((a, b) => b[1] - a[1])[0][0];
    const K = list.reduce((s, m) => s + m.kills, 0);
    const D = list.reduce((s, m) => s + m.deaths, 0);
    const A = list.reduce((s, m) => s + m.assists, 0);
    const shrunkWr = shrink(wins, games, 5);
    const mWr = metaWinrate(hero, bracket);
    const trend = metaTrend(hero);
    const wr = wins / games;

    const tags: PoolTag[] = [];
    if (games >= 4 && wr >= 0.56) tags.push('signature');
    if (games >= 6) tags.push('comfort');
    if (trend >= 0.5) tags.push('trending');
    if (mWr > 0.53) tags.push('meta');

    pool.push({
      heroId,
      games,
      wins,
      wr,
      shrunkWr,
      kda: kda(K, D, A),
      mainRole,
      roleGames,
      recent: [...list].sort((a, b) => b.start_time - a.start_time).slice(0, 5).map((m) => m.win),
      metaWr: mWr,
      metaTrend: trend,
      score: (shrunkWr - 0.5) * 100 + Math.min(games, 25) * 0.45 + (mWr - 0.5) * 35,
      tags,
    });
  }

  // По умолчанию «Твой пул» сортируется по КОЛИЧЕСТВУ ИГР (самые наигранные герои сверху)
  return pool.sort((a, b) => b.games - a.games || b.wr - a.wr);
}
