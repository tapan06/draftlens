/**
 * Определение роли в каждом матче и агрегация статистики по ролям.
 *
 * Источник правды:
 *   1) В распаршенных матчах OpenDota — поле `lane_role` (1 safe, 2 mid, 3 off) +
 *      индекс фарма (LH/min + GPM), отделяющий кора от саппорта на линии.
 *   2) В нераспаршенных матчах (`lane_role == null`) — приоритетная позиция самого героя
 *      (HERO_PRIMARY_ROLES) с учётом того, на каких линиях игрок чаще играет в распаршенных играх.
 */
import type { PlayerMatch } from '@/lib/api/opendota';
import { clamp, kda, shrink } from '@/lib/utils';

export type Role = 'carry' | 'mid' | 'offlane' | 'soft' | 'hard';

export interface RoleMeta {
  id: Role;
  label: string;
  pos: number;
  /** Ориентиры для нормализации импакта (паб, средний брекет). */
  gpmBase: number;
  xpmBase: number;
}

export const ROLES: RoleMeta[] = [
  { id: 'carry', label: 'Carry', pos: 1, gpmBase: 600, xpmBase: 680 },
  { id: 'mid', label: 'Mid', pos: 2, gpmBase: 570, xpmBase: 720 },
  { id: 'offlane', label: 'Offlane', pos: 3, gpmBase: 470, xpmBase: 600 },
  { id: 'soft', label: 'Soft Support', pos: 4, gpmBase: 360, xpmBase: 470 },
  { id: 'hard', label: 'Hard Support', pos: 5, gpmBase: 290, xpmBase: 400 },
];

export const ROLE_BY_ID = Object.fromEntries(ROLES.map((r) => [r.id, r])) as Record<Role, RoleMeta>;

export interface ClassifiedMatch extends PlayerMatch {
  role: Role;
  win: boolean;
  /** true — роль определена по lane_role, false — по профилю героя и фарму. */
  confident: boolean;
}

export const isRadiant = (slot: number) => slot < 128;
export const didWin = (m: PlayerMatch) => (m.radiant_win == null ? false : isRadiant(m.player_slot) === m.radiant_win);

/** Ability Draft, Turbo, Event, Custom — искажают роли и GPM. */
const EXCLUDED_MODES = new Set([15, 18, 19, 23]);

export function filterRelevant(matches: PlayerMatch[]): PlayerMatch[] {
  const filtered = matches.filter((m) => !EXCLUDED_MODES.has(m.game_mode) && m.duration >= 600);
  return filtered.length >= 10 ? filtered : matches;
}

function farmIndex(m: PlayerMatch): number {
  const minutes = Math.max(m.duration / 60, 1);
  const lhPerMin = (m.last_hits ?? 0) / minutes;
  const isTurbo = m.game_mode === 23;
  return lhPerMin / (isTurbo ? 6.5 : 5) + (m.gold_per_min ?? 0) / (isTurbo ? 1050 : 600);
}

const CORE_ROLES: Role[] = ['carry', 'mid', 'offlane'];
const SUPPORT_ROLES: Role[] = ['soft', 'hard'];

export function classifyMatches(matches: PlayerMatch[], heroPositions: Map<number, Role[]>): ClassifiedMatch[] {
  // 1-й проход: считаем распределение ролей игрока по распаршенным матчам (где есть lane_role)
  const parsedRoleCounts: Record<Role, number> = { carry: 0, mid: 0, offlane: 0, soft: 0, hard: 0 };
  for (const m of matches) {
    const core = farmIndex(m) >= 1.28;
    if (m.lane_role === 1) parsedRoleCounts[core ? 'carry' : 'hard']++;
    else if (m.lane_role === 2) parsedRoleCounts[core ? 'mid' : 'soft']++;
    else if (m.lane_role === 3) parsedRoleCounts[core ? 'offlane' : 'soft']++;
  }

  // Любимая кор-роль и саппорт-роль игрока по распаршенным матчам (для разрешения неоднозначных героев)
  const favCoreRole = [...CORE_ROLES].sort((a, b) => parsedRoleCounts[b] - parsedRoleCounts[a])[0];
  const favSupportRole = [...SUPPORT_ROLES].sort((a, b) => parsedRoleCounts[b] - parsedRoleCounts[a])[0];

  // 2-й проход: классифицируем каждый матч
  return matches.map((m): ClassifiedMatch => {
    const fi = farmIndex(m);
    const prior = heroPositions.get(m.hero_id) ?? [];
    const primaryHeroRole = prior[0];
    const isPureSupportHero = prior.length > 0 && prior.every((r) => r === 'soft' || r === 'hard');
    const isPureCoreHero = prior.length > 0 && prior.every((r) => r === 'carry' || r === 'mid' || r === 'offlane');

    // Порог кора адаптируется под природу героя (саппорту нужен гораздо более высокий фарм, чтобы считаться кором)
    const core = isPureSupportHero ? fi >= 1.65 : isPureCoreHero ? fi >= 1.05 : fi >= 1.28;

    let role: Role;
    let confident = true;

    switch (m.lane_role) {
      case 1:
        if (!core) {
          role = 'hard';
        } else if (prior.includes('carry') || prior.length === 0) {
          role = 'carry';
        } else if (fi >= 2.25 && !isPureSupportHero) {
          // Лишь при явном тяжелом керри-фарме засчитываем офф-метного героя как Carry
          role = 'carry';
        } else {
          // Например, Pudge (soft/offlane) или Leshrac (mid/offlane), заглянувшие на сейф-линию
          role = primaryHeroRole && !prior.includes('carry') ? primaryHeroRole : 'carry';
        }
        break;
      case 2:
        role = core ? 'mid' : 'soft';
        break;
      case 3:
        role = core ? 'offlane' : 'soft';
        break;
      default: {
        confident = false;
        if (core) {
          const coreCandidates = prior.filter((r): r is Role => CORE_ROLES.includes(r));
          if (coreCandidates.length === 1) {
            role = coreCandidates[0];
          } else if (coreCandidates.length > 1) {
            // Если герой подходит на несколько кор-позиций и одна из них — основная роль игрока, выбираем её
            role =
              coreCandidates.includes(favCoreRole) && parsedRoleCounts[favCoreRole] >= 3
                ? favCoreRole
                : coreCandidates[0];
          } else {
            role = primaryHeroRole && CORE_ROLES.includes(primaryHeroRole) ? primaryHeroRole : favCoreRole;
          }
        } else {
          const supCandidates = prior.filter((r): r is Role => SUPPORT_ROLES.includes(r));
          if (supCandidates.length === 1) {
            role = supCandidates[0];
          } else if (supCandidates.length > 1) {
            role =
              supCandidates.includes(favSupportRole) && parsedRoleCounts[favSupportRole] >= 3
                ? favSupportRole
                : supCandidates[0];
          } else {
            role = primaryHeroRole && SUPPORT_ROLES.includes(primaryHeroRole) ? primaryHeroRole : favSupportRole;
          }
        }
      }
    }

    return { ...m, role, win: didWin(m), confident };
  });
}

export interface RoleStats {
  role: Role;
  games: number;
  wins: number;
  wr: number;
  shrunkWr: number;
  share: number;
  kda: number;
  gpm: number;
  xpm: number;
  /** 0–100: композит WR / KDA / GPM / XPM относительно ориентиров роли. */
  impact: number;
  /** Итоговый скор для выбора лучшей роли (учитывает и винрейт, и дистанцию/долю игр). */
  score: number;
  confidentShare: number;
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export function aggregateRoles(matches: ClassifiedMatch[]): RoleStats[] {
  const totalGames = Math.max(matches.length, 1);

  return ROLES.map((meta) => {
    const g = matches.filter((m) => m.role === meta.id);
    const games = g.length;
    const wins = g.filter((m) => m.win).length;
    const share = games / totalGames;
    const K = g.reduce((s, m) => s + m.kills, 0);
    const D = g.reduce((s, m) => s + m.deaths, 0);
    const A = g.reduce((s, m) => s + m.assists, 0);
    const gpm = avg(g.map((m) => m.gold_per_min ?? 0));
    const xpm = avg(g.map((m) => m.xp_per_min ?? 0));
    const roleKda = games ? kda(K, D, A) : 0;
    const shrunkWr = shrink(wins, games, 12);

    const impact = games
      ? Math.round(
          100 *
            (0.45 * clamp((shrunkWr - 0.35) / 0.3) +
              0.25 * clamp(roleKda / 6) +
              0.15 * clamp(gpm / meta.gpmBase / 1.4) +
              0.15 * clamp(xpm / meta.xpmBase / 1.4)),
        )
      : 0;

    // Чистый профит побед сверх 48% + вес доли матчей (чтобы 65 игр с 54% WR всегда побеждали 8 случайных игр с 63% WR)
    const netWins = wins - games * 0.48;
    const score =
      shrunkWr * 100 +
      share * 45 +
      Math.max(-10, Math.min(netWins, 30)) * 1.1 +
      impact * 0.1;

    return {
      role: meta.id,
      games,
      wins,
      wr: games ? wins / games : 0,
      shrunkWr,
      share,
      kda: roleKda,
      gpm,
      xpm,
      impact,
      score,
      confidentShare: games ? g.filter((m) => m.confident).length / games : 0,
    };
  });
}

/**
 * Выбор лучшей роли:
 * Приоритет отдаётся ролям, где у игрока репрезентативная дистанция (>= 16% всех матчей или >= 12 игр)
 * и достойный винрейт, чтобы случайные 5–8 игр на офф-роли не перебивали основную роль с 60+ играми.
 */
export function pickBestRole(stats: RoleStats[]): RoleStats | null {
  const totalGames = stats.reduce((s, r) => s + r.games, 0);
  const minMainGames = Math.max(5, Math.min(20, Math.round(totalGames * 0.16)));

  const mainRoles = stats.filter((s) => s.games >= minMainGames && s.wr >= 0.47);
  if (mainRoles.length > 0) {
    return [...mainRoles].sort((a, b) => b.score - a.score)[0];
  }

  const fallbackRoles = stats.filter((s) => s.games >= Math.max(4, Math.round(totalGames * 0.1)));
  const pool = fallbackRoles.length ? fallbackRoles : stats.filter((s) => s.games > 0);
  return [...pool].sort((a, b) => b.score - a.score)[0] ?? null;
}
