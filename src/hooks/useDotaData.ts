import { useMemo } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { opendota, type HeroStat, type PlayerMatch } from '@/lib/api/opendota';
import { TTL } from '@/lib/api/cache';
import { HERO_PRIMARY_ROLES } from '@/lib/data/positions';
import { buildSynergyIndex, type SynergyIndex } from '@/lib/data/synergy';
import { buildCounterIndex, type CounterIndex } from '@/lib/data/counters';
import { aggregateRoles, classifyMatches, filterRelevant, pickBestRole, type Role } from '@/lib/analytics/roles';
import { buildHeroPool } from '@/lib/analytics/heroPool';
import { indexEnemyMatchups, type EnemyMatchupIndex } from '@/lib/analytics/draft';
import { bracketOf } from '@/lib/utils';

/* --------------------------------- heroes --------------------------------- */
export interface HeroIndex {
  list: HeroStat[];
  byId: Map<number, HeroStat>;
  positions: Map<number, Role[]>;
  synergy: SynergyIndex;
  counters: CounterIndex;
}

function buildHeroIndex(heroes: HeroStat[]): HeroIndex {
  const list = [...heroes].sort((a, b) => a.localized_name.localeCompare(b.localized_name));
  const byShort = new Map(list.map((h) => [h.name.replace('npc_dota_hero_', ''), h.id]));
  const positions = new Map<number, Role[]>();

  // Сохраняем точный порядок ролей из HERO_PRIMARY_ROLES (первая роль — основная для героя)
  for (const [shortName, roles] of Object.entries(HERO_PRIMARY_ROLES)) {
    const id = byShort.get(shortName);
    if (id) positions.set(id, [...roles]);
  }

  return {
    list,
    byId: new Map(list.map((h) => [h.id, h])),
    positions,
    synergy: buildSynergyIndex(list),
    counters: buildCounterIndex(list),
  };
}

export function useHeroes() {
  const query = useQuery({ queryKey: ['heroStats'], queryFn: opendota.heroStats, staleTime: TTL.h6 });
  const index = useMemo(() => (query.data ? buildHeroIndex(query.data) : null), [query.data]);
  return { ...query, index };
}

/* --------------------------------- player --------------------------------- */
export function usePlayer(accountId: number, matchLimit = 100) {
  const profile = useQuery({
    queryKey: ['player', accountId],
    queryFn: () => opendota.player(accountId),
    enabled: accountId > 0,
  });
  const exists = !!profile.data?.profile;

  const matches = useQuery({
    queryKey: ['player', accountId, 'matches', matchLimit],
    queryFn: () => opendota.playerMatches(accountId, matchLimit),
    enabled: exists,
  });
  const heroes = useQuery({
    queryKey: ['player', accountId, 'heroes'],
    queryFn: () => opendota.playerHeroes(accountId),
    enabled: exists,
  });
  return { profile, matches, heroes };
}

/* -------------------------------- analytics ------------------------------- */
export function usePlayerAnalytics(
  matches: PlayerMatch[] | undefined,
  heroIndex: HeroIndex | null,
  rankTier: number | null | undefined,
) {
  return useMemo(() => {
    if (!matches || !heroIndex) return null;
    const bracket = bracketOf(rankTier);
    const relevant = filterRelevant(matches);
    const classified = classifyMatches(relevant, heroIndex.positions);
    const roles = aggregateRoles(classified);
    const best = pickBestRole(roles);
    const pool = buildHeroPool(classified, heroIndex.byId, bracket);
    const recent = [...classified].sort((a, b) => b.start_time - a.start_time);
    return {
      bracket,
      totalFetched: matches.length,
      classified,
      recent,
      roles,
      best,
      pool,
      confidentShare: classified.length ? classified.filter((m) => m.confident).length / classified.length : 0,
    };
  }, [matches, heroIndex, rankTier]);
}

export type PlayerAnalytics = NonNullable<ReturnType<typeof usePlayerAnalytics>>;

/* ----------------------------- enemy matchups ----------------------------- */
/**
 * Грузит матчапы ТОЛЬКО для выбранных врагов (0–5 запросов вместо 24 на каждую роль).
 * Один запрос /heroes/{enemyId}/matchups содержит статистику этого врага против ВСЕХ 127 героев сразу!
 * Это полностью убирает ошибки 429 OpenDota и мгновенно переключает роли 1–5.
 */
export function useEnemyMatchups(enemyIds: number[]) {
  const results = useQueries({
    queries: enemyIds.map((id) => ({
      queryKey: ['matchups', id],
      queryFn: () => opendota.heroMatchups(id),
      staleTime: TTL.h24,
    })),
  });

  const signature = results.map((r) => r.dataUpdatedAt).join(',');
  const idsKey = enemyIds.join(',');
  const map = useMemo(() => {
    const m = new Map<number, EnemyMatchupIndex>();
    results.forEach((r, i) => {
      if (r.data) m.set(enemyIds[i], indexEnemyMatchups(r.data));
    });
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, idsKey]);

  const loaded = results.filter((r) => r.isSuccess).length;
  const failed = results.filter((r) => r.isError).length;
  return { map, loaded, failed, total: enemyIds.length, isLoading: loaded + failed < enemyIds.length };
}

/* ---------------------------------- build --------------------------------- */
/** Всё для карточки билда героя. Константы грузятся лениво — только при открытии карточки. */
export function useHeroBuild(heroId: number | null) {
  const enabled = heroId != null;
  const [popularity, items, itemIds, heroAbilities, abilities] = useQueries({
    queries: [
      { queryKey: ['itemPop', heroId], queryFn: () => opendota.itemPopularity(heroId!), enabled, staleTime: TTL.h12 },
      { queryKey: ['const', 'items'], queryFn: opendota.items, enabled, staleTime: TTL.h24 },
      { queryKey: ['const', 'itemIds'], queryFn: opendota.itemIds, enabled, staleTime: TTL.h24 },
      { queryKey: ['const', 'heroAbilities'], queryFn: opendota.heroAbilities, enabled, staleTime: TTL.h24 },
      { queryKey: ['const', 'abilities'], queryFn: opendota.abilities, enabled, staleTime: TTL.h24 },
    ],
  });
  return { popularity, items, itemIds, heroAbilities, abilities };
}
