/**
 * OpenDota API client (https://docs.opendota.com).
 * Только публичные эндпоинты: никакого доступа к клиенту игры, памяти процесса или
 * приватным данным. Все данные — то, что Valve публикует при включённой
 * «Общедоступной истории матчей».
 *
 * Лимиты free-tier: ~60 запросов/мин, ~2000/день. Поэтому:
 *   - семафор на 4 параллельных запроса;
 *   - агрессивный кэш (см. cache.ts) для статичных данных.
 */
import { cached, invalidate, TTL } from './cache';

export const OPENDOTA_BASE = 'https://api.opendota.com/api';
export const STEAM_CDN = 'https://cdn.cloudflare.steamstatic.com';
const API_KEY = import.meta.env.VITE_OPENDOTA_API_KEY as string | undefined;

/** Абсолютный URL картинки героя/предмета/способности из относительного пути OpenDota. */
export const cdn = (path?: string | null) => {
  if (!path) return '';
  return path.startsWith('http') ? path : STEAM_CDN + path;
};

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/* ---------------------------- concurrency limiter --------------------------- */
const MAX_CONCURRENT = 4;
let active = 0;
const waiters: Array<() => void> = [];

async function withSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (active >= MAX_CONCURRENT) await new Promise<void>((resolve) => waiters.push(resolve));
  active++;
  try {
    return await fn();
  } finally {
    active--;
    waiters.shift()?.();
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = new URL(OPENDOTA_BASE + path);
  if (API_KEY) url.searchParams.set('api_key', API_KEY);

  return withSlot(async () => {
    let res: Response;
    try {
      res = await fetch(url.toString(), init);
    } catch {
      throw new ApiError('Не удалось связаться с OpenDota. Проверь интернет или попробуй позже.', 0);
    }
    if (res.status === 429) {
      throw new ApiError('Лимит запросов OpenDota исчерпан (≈60/мин). Подожди минуту и обнови.', 429);
    }
    if (!res.ok) throw new ApiError(`OpenDota ответил ошибкой ${res.status}`, res.status);
    return (await res.json()) as T;
  });
}

/* ---------------------------------- types ---------------------------------- */
export type PrimaryAttr = 'str' | 'agi' | 'int' | 'all';

export interface HeroStat {
  id: number;
  name: string; // npc_dota_hero_antimage
  localized_name: string;
  primary_attr: PrimaryAttr;
  attack_type: 'Melee' | 'Ranged';
  roles: string[];
  img: string;
  icon: string;
  pub_pick: number;
  pub_win: number;
  pub_pick_trend?: number[]; // по дням, последний элемент — неполный день
  pub_win_trend?: number[];
  pro_pick?: number;
  pro_win?: number;
  pro_ban?: number;
  /** Пики/победы по брекетам: 1 = Herald … 8 = Immortal */
  [bracket: `${number}_pick`]: number;
  [bracketWin: `${number}_win`]: number;
}

export interface PlayerProfile {
  account_id: number;
  personaname: string | null;
  name: string | null;
  avatarfull: string | null;
  profileurl: string | null;
  plus?: boolean;
  loccountrycode?: string | null;
  fh_unavailable?: boolean;
}

export interface PlayerResponse {
  profile?: PlayerProfile;
  rank_tier: number | null;
  leaderboard_rank: number | null;
}

export interface PlayerMatch {
  match_id: number;
  player_slot: number;
  radiant_win: boolean | null;
  duration: number;
  game_mode: number;
  lobby_type: number;
  hero_id: number;
  start_time: number;
  kills: number;
  deaths: number;
  assists: number;
  gold_per_min: number | null;
  xp_per_min: number | null;
  last_hits: number | null;
  hero_damage: number | null;
  /** 1 safe, 2 mid, 3 off, 4 jungle. null — матч не распаршен OpenDota. */
  lane_role: number | null;
}

export interface PlayerHeroRecord {
  hero_id: number;
  last_played: number;
  games: number;
  win: number;
  with_games: number;
  with_win: number;
  against_games: number;
  against_win: number;
}

export interface WinLoss {
  win: number;
  lose: number;
}

export interface HeroMatchup {
  hero_id: number;
  games_played: number;
  wins: number;
}

export interface ItemPopularity {
  start_game_items: Record<string, number>;
  early_game_items: Record<string, number>;
  mid_game_items: Record<string, number>;
  late_game_items: Record<string, number>;
}

export interface ItemConst {
  id: number;
  img: string;
  dname?: string;
  cost: number | null;
  qual?: string;
  lore?: string;
  notes?: string;
  abilities?: { type: string; title: string; description: string }[];
  components?: string[] | null;
}

export interface HeroAbilitiesConst {
  abilities: string[];
  talents: { name: string; level: number }[];
}

export interface AbilityConst {
  dname?: string;
  desc?: string;
  img?: string;
  behavior?: string | string[];
  is_innate?: boolean;
}

export interface PlayerSearchResult {
  account_id: number;
  personaname: string;
  avatarfull: string | null;
  last_match_time?: string | null;
  similarity?: number;
}

/* -------------------------------- endpoints -------------------------------- */
/** Поля, которые запрашиваем у /players/{id}/matches (параметр `project`). */
const MATCH_FIELDS = [
  'hero_id',
  'start_time',
  'duration',
  'game_mode',
  'lobby_type',
  'kills',
  'deaths',
  'assists',
  'gold_per_min',
  'xp_per_min',
  'last_hits',
  'hero_damage',
  'lane_role',
] as const;

export const opendota = {
  /** Все герои + винрейты по брекетам + тренды по дням. Меняется медленно → кэш 6ч. */
  heroStats: () => cached('heroStats', TTL.h6, () => request<HeroStat[]>('/heroStats')),

  player: (id: number) =>
    cached(`player:${id}:profile`, TTL.m10, () => request<PlayerResponse>(`/players/${id}`), { persist: false }),

  playerWL: (id: number, limit = 100) =>
    cached(`player:${id}:wl:${limit}`, TTL.m10, () => request<WinLoss>(`/players/${id}/wl?limit=${limit}`), {
      persist: false,
    }),

  /** Последние N матчей с нужными полями (GPM/XPM/lane_role и т.д.). */
  playerMatches: (id: number, limit = 100) => {
    const project = MATCH_FIELDS.map((f) => `project=${f}`).join('&');
    return cached(
      `player:${id}:matches:${limit}`,
      TTL.m10,
      () => request<PlayerMatch[]>(`/players/${id}/matches?limit=${limit}&${project}`),
      { persist: false },
    );
  },

  /** Личная статистика по героям: игры НА герое, С героем и ПРОТИВ героя (за всё время). */
  playerHeroes: (id: number) =>
    cached(
      `player:${id}:heroes`,
      TTL.m30,
      async () =>
        (await request<PlayerHeroRecord[]>(`/players/${id}/heroes`)).map((h) => ({ ...h, hero_id: Number(h.hero_id) })),
      { persist: false },
    ),

  /** Просит OpenDota перезапросить историю игрока у Valve. */
  refreshPlayer: async (id: number) => {
    await request<unknown>(`/players/${id}/refresh`, { method: 'POST' });
    invalidate(`player:${id}`);
  },

  /** Поиск по никнейму (Steam persona name). */
  search: (q: string) =>
    cached(`search:${q.toLowerCase()}`, TTL.m5, () => request<PlayerSearchResult[]>(`/search?q=${encodeURIComponent(q)}`), {
      persist: false,
    }),

  /** Винрейт героя против каждого другого героя (выборка высокоуровневых матчей OpenDota). */
  heroMatchups: (heroId: number) =>
    cached(`matchups:${heroId}`, TTL.h24, () => request<HeroMatchup[]>(`/heroes/${heroId}/matchups`)),

  /** Популярность предметов по стадиям игры (start / early / mid / late). */
  itemPopularity: (heroId: number) =>
    cached(`itemPop:${heroId}`, TTL.h12, () => request<ItemPopularity>(`/heroes/${heroId}/itemPopularity`)),

  /* --- constants (dotaconstants) --- */
  items: () => cached('const:items', TTL.h24, () => request<Record<string, ItemConst>>('/constants/items')),
  itemIds: () => cached('const:item_ids', TTL.h24, () => request<Record<string, string>>('/constants/item_ids')),
  heroAbilities: () =>
    cached('const:hero_abilities', TTL.h24, () => request<Record<string, HeroAbilitiesConst>>('/constants/hero_abilities')),
  /** ~1.3 MB — держим только в памяти. */
  abilities: () =>
    cached('const:abilities', TTL.h24, () => request<Record<string, AbilityConst>>('/constants/abilities'), {
      persist: false,
    }),
};
