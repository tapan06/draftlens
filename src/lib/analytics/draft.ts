/**
 * Движок рекомендаций для драфта и анализатор баланса команды.
 *
 * Что улучшено:
 *   1) Оценка идёт по ВСЕМ героям, подходящим на выбранную роль (а не только по топ-24 сырого WR) —
 *      поэтому профильные контрпики (Earthshaker против PL, AA против Huskar, Viper против Bristleback)
 *      всегда всплывают в рекомендациях, когда они нужны.
 *   2) Матчинг по врагам инвертирован: запрашиваем /heroes/{enemyId}/matchups (0–5 запросов вместо 24),
 *      стабилизируем шум малых выборок (PRIOR = 75) и объединяем с механической матрицей контрпиков.
 *   3) В расчёте силы меты учитывается не только сырой WR, но и популярность (чтобы узкие чиз-герои
 *      вроде Meepo/Visage/Chen с пикрейтом 1% не вытесняли реальных метовых героев без повода).
 *   4) В режиме 'meta' ('Только Мета') личная статистика полностью игнорируется.
 */
import type { HeroMatchup, HeroStat } from '@/lib/api/opendota';
import type { PoolHero } from '@/lib/analytics/heroPool';
import { metaTrend, metaWinrate } from '@/lib/analytics/heroPool';
import type { Role } from '@/lib/analytics/roles';
import { pairSynergy, type SynergyIndex } from '@/lib/data/synergy';
import { getCounterTip, type CounterIndex } from '@/lib/data/counters';
import {
  ANTI_CHANNEL_COUNTERS,
  ANTI_HEAL_HEROES,
  AOE_CLEAR_HEROES,
  BREAK_HEROES,
  CHANNEL_ULTERS,
  HARD_LOCKDOWN_HEROES,
  HEAL_REGEN_HEROES,
  ILLUSION_SUMMON_HEROES,
  INVIS_HEROES,
  MAGIC_BURST_HEROES,
  NICHE_CHEESE_HEROES,
  PASSIVE_RELIANT_HEROES,
  PHYSICAL_CORE_HEROES,
  REVEAL_COUNTERS,
  SAVE_SUSTAIN_HEROES,
  TANK_KILLER_HEROES,
} from '@/lib/data/positions';
import { clamp, shrink } from '@/lib/utils';

/* ----------------------------- enemy matchups ----------------------------- */
export interface EnemyMatchupIndex {
  /** Средний WR самого врага по всем матчапам — точка отсчёта. */
  enemyBaseline: number;
  byCandidate: Map<number, HeroMatchup>;
}

export function indexEnemyMatchups(rows: HeroMatchup[]): EnemyMatchupIndex {
  let games = 0;
  let wins = 0;
  const byCandidate = new Map<number, HeroMatchup>();
  for (const r of rows) {
    games += r.games_played;
    wins += r.wins;
    byCandidate.set(r.hero_id, r);
  }
  return { enemyBaseline: games ? wins / games : 0.5, byCandidate };
}

/** Высокий байесовский prior убирает ложные ±12% выбросы на 15–30 матчах OpenDota. */
const MATCHUP_PRIOR = 75;

/**
 * Преимущество кандидата против конкретного врага (pp).
 * В /heroes/{enemyId}/matchups `row.wins` — это победы ВРАГА против кандидата,
 * значит преимущество кандидата = (enemyBaseline - smoothedEnemyWr) * 100.
 */
export function candidateVsEnemyAdvantage(
  enemyIdx: EnemyMatchupIndex | undefined,
  candidateId: number,
): { adv: number; games: number } {
  const row = enemyIdx?.byCandidate.get(candidateId);
  if (!enemyIdx || !row || !row.games_played) return { adv: 0, games: 0 };
  const smoothedEnemyWr = shrink(row.wins, row.games_played, MATCHUP_PRIOR, enemyIdx.enemyBaseline);
  const rawAdv = (enemyIdx.enemyBaseline - smoothedEnemyWr) * 100;
  return { adv: clamp(rawAdv, -6.5, 6.5), games: row.games_played };
}

/* ------------------------ team composition analysis ----------------------- */
export interface TeamMetrics {
  disable: number;    // 0..100 — контроль и станы
  initiation: number; // 0..100 — инициация драки
  frontline: number;  // 0..100 — живучесть / танк
  damage: number;     // 0..100 — взрывной и туннельный урон
  push: number;       // 0..100 — урон по строениям
  save: number;       // 0..100 — сейв и лечение
  meleeCount: number;
  rangedCount: number;
  magicCount: number;
  physicalCount: number;
  warnings: string[];
}

function shortHeroName(h: HeroStat): string {
  return h.name.replace('npc_dota_hero_', '');
}

export function analyzeTeamComposition(allies: HeroStat[], enemies: HeroStat[]): TeamMetrics {
  let disablePts = 0;
  let initPts = 0;
  let frontPts = 0;
  let dmgPts = 0;
  let pushPts = 0;
  let savePts = 0;
  let meleeCount = 0;
  let rangedCount = 0;
  let magicCount = 0;
  let physicalCount = 0;

  for (const h of allies) {
    const short = shortHeroName(h);
    if (h.attack_type === 'Melee') meleeCount++;
    else rangedCount++;

    if (MAGIC_BURST_HEROES.has(short)) magicCount++;
    if (PHYSICAL_CORE_HEROES.has(short)) physicalCount++;

    if (h.roles.includes('Disabler')) disablePts += 1.1;
    if (HARD_LOCKDOWN_HEROES.has(short)) disablePts += 0.85;

    if (h.roles.includes('Initiator')) initPts += 1.4;

    if (h.roles.includes('Durable')) frontPts += 1.25;
    if (h.primary_attr === 'str' && h.attack_type === 'Melee') frontPts += 0.7;

    if (h.roles.includes('Carry')) dmgPts += 1.15;
    if (h.roles.includes('Nuker')) dmgPts += 0.9;

    if (h.roles.includes('Pusher')) pushPts += 1.45;

    if (h.roles.includes('Support')) savePts += 0.7;
    if (SAVE_SUSTAIN_HEROES.has(short)) savePts += 1.3;
  }

  const scale = (pts: number, target: number) => Math.round(clamp(pts / target, 0, 1) * 100);
  const metrics: TeamMetrics = {
    disable: scale(disablePts, 3.2),
    initiation: scale(initPts, 2.2),
    frontline: scale(frontPts, 2.4),
    damage: scale(dmgPts, 3.2),
    push: scale(pushPts, 2.0),
    save: scale(savePts, 2.0),
    meleeCount,
    rangedCount,
    magicCount,
    physicalCount,
    warnings: [],
  };

  if (allies.length >= 2) {
    if (metrics.disable < 45) metrics.warnings.push('Мало контроля (станов) в команде');
    if (metrics.initiation < 40) metrics.warnings.push('Не хватает инициатора для старта драки');
    if (metrics.frontline < 40) metrics.warnings.push('Тонкий пик — нужен танк / фронтлейн');
    if (metrics.damage < 45) metrics.warnings.push('Не хватает урона в драке');
    if (metrics.push < 35) metrics.warnings.push('Слабый пуш вышек');
    if (meleeCount >= 3) metrics.warnings.push(`Уже ${meleeCount} милишника — лучше взять дальника`);
    if (rangedCount >= 4) metrics.warnings.push('Все союзники дальники — некому впитывать урон');
    if (magicCount >= 3 && physicalCount === 0) metrics.warnings.push('Перекос в маг. урон (BKB закроет команду) — нужен физ. урон');
    if (physicalCount >= 3 && magicCount === 0) metrics.warnings.push('Один физ. урон (броня/Ghost контрят) — добавь магию');
  }

  const mobileEnemies = enemies.filter((e) => e.roles.includes('Escape'));
  if (mobileEnemies.length >= 2 && metrics.disable < 70) {
    metrics.warnings.push('У врагов мобильные герои — нужен мгновенный контроль');
  }

  const illusionEnemies = enemies.filter((e) => ILLUSION_SUMMON_HEROES.has(shortHeroName(e)));
  const hasAoeAlly = allies.some((a) => AOE_CLEAR_HEROES.has(shortHeroName(a)));
  if (illusionEnemies.length >= 1 && !hasAoeAlly) {
    metrics.warnings.push(`Против ${illusionEnemies.map((e) => e.localized_name).join('/')} нужен AoE-урон`);
  }

  const healEnemies = enemies.filter((e) => HEAL_REGEN_HEROES.has(shortHeroName(e)));
  if (healEnemies.length >= 2) {
    metrics.warnings.push('У врагов много хила/регена — нужен анти-хил или взрыв');
  }

  const passiveEnemies = enemies.filter((e) => PASSIVE_RELIANT_HEROES.has(shortHeroName(e)));
  if (passiveEnemies.length >= 2) {
    metrics.warnings.push('Сильные пассивки у врагов — ценится Break');
  }

  return metrics;
}

/** Оценивает, насколько кандидат закрывает дыры союзного драфта и наказывает уязвимости врагов. */
function evaluateTacticalFit(
  candidate: HeroStat,
  role: Role,
  allies: HeroStat[],
  enemies: HeroStat[],
  team: TeamMetrics,
): { bonus: number; reasons: string[] } {
  let bonus = 0;
  const reasons: string[] = [];
  const short = shortHeroName(candidate);
  const isSupportRole = role === 'soft' || role === 'hard';
  const isCoreRole = !isSupportRole;

  // 1. Потребности союзной команды
  if (allies.length >= 1) {
    if (team.initiation < 45 && candidate.roles.includes('Initiator')) {
      bonus += 1.6;
      reasons.push('+Инициация для команды');
    }
    if (team.disable < 50 && (candidate.roles.includes('Disabler') || HARD_LOCKDOWN_HEROES.has(short))) {
      bonus += 1.5;
      reasons.push('+Закрывает дефицит контроля');
    }
    if (
      team.frontline < 45 &&
      (candidate.roles.includes('Durable') || (candidate.primary_attr === 'str' && candidate.attack_type === 'Melee'))
    ) {
      bonus += 1.45;
      reasons.push('+Даёт фронтлейн и живучесть');
    }
    if (team.damage < 50 && isCoreRole && (candidate.roles.includes('Carry') || candidate.roles.includes('Nuker'))) {
      bonus += 1.1;
      reasons.push('+Добавляет урон в тимфайте');
    }
    if (team.push < 35 && candidate.roles.includes('Pusher')) {
      bonus += 1.0;
      reasons.push('+Даёт урон по вышкам (пуш)');
    }
    if (team.save < 40 && isSupportRole && SAVE_SUSTAIN_HEROES.has(short)) {
      bonus += 1.4;
      reasons.push('+Сейв/поддержка союзников');
    }

    // Баланс физ./маг. урона
    if (team.magicCount >= 2 && team.physicalCount === 0 && PHYSICAL_CORE_HEROES.has(short)) {
      bonus += 1.25;
      reasons.push('+Балансирует пик физ. уроном');
    } else if (team.physicalCount >= 2 && team.magicCount === 0 && MAGIC_BURST_HEROES.has(short)) {
      bonus += 1.25;
      reasons.push('+Добавляет маг. урон команде');
    }

    // Баланс Melee / Ranged (особенно важно на линии для саппорта с мили-керри)
    if (team.meleeCount >= 3) {
      if (candidate.attack_type === 'Ranged') {
        bonus += 1.0;
        reasons.push('+Дальник в мили-драфт');
      } else {
        bonus -= 0.9;
      }
    } else if (team.rangedCount >= 4 && candidate.attack_type === 'Melee' && candidate.roles.includes('Durable')) {
      bonus += 1.2;
      reasons.push('+Мили-танк для 4 дальников');
    } else if (isSupportRole && candidate.attack_type === 'Ranged' && allies.some((a) => a.attack_type === 'Melee' && a.roles.includes('Carry'))) {
      bonus += 0.5;
    }
  }

  // 2. Механический ответ на особенности вражеского пика
  if (enemies.length >= 1) {
    const mobileEnemies = enemies.filter((e) => e.roles.includes('Escape'));
    if (mobileEnemies.length >= 1 && HARD_LOCKDOWN_HEROES.has(short)) {
      const gain = Math.min(2.0, 0.95 * mobileEnemies.length);
      bonus += gain;
      reasons.push(`+Ловит мобильных (${mobileEnemies.map((e) => e.localized_name).slice(0, 2).join(', ')})`);
    }

    const illusionEnemies = enemies.filter((e) => ILLUSION_SUMMON_HEROES.has(shortHeroName(e)));
    if (illusionEnemies.length >= 1 && AOE_CLEAR_HEROES.has(short)) {
      const gain = Math.min(2.4, 1.3 * illusionEnemies.length);
      bonus += gain;
      reasons.push(`+AoE против ${illusionEnemies[0].localized_name}`);
    }

    const tankyEnemies = enemies.filter((e) => e.roles.includes('Durable') || e.primary_attr === 'str');
    if (tankyEnemies.length >= 2 && TANK_KILLER_HEROES.has(short)) {
      bonus += Math.min(2.0, 0.8 * tankyEnemies.length);
      reasons.push('+Режет плотных танков');
    }

    const invisEnemies = enemies.filter((e) => INVIS_HEROES.has(shortHeroName(e)));
    if (invisEnemies.length >= 1 && REVEAL_COUNTERS.has(short)) {
      bonus += 1.5;
      reasons.push('+Видит инвиз (True Sight)');
    }

    const channelEnemies = enemies.filter((e) => CHANNEL_ULTERS.has(shortHeroName(e)));
    if (channelEnemies.length >= 1 && ANTI_CHANNEL_COUNTERS.has(short)) {
      bonus += 1.4;
      reasons.push(`+Сбивает ульт ${channelEnemies[0].localized_name}`);
    }

    const passiveEnemies = enemies.filter((e) => PASSIVE_RELIANT_HEROES.has(shortHeroName(e)));
    if (passiveEnemies.length >= 1 && BREAK_HEROES.has(short)) {
      bonus += 1.5;
      reasons.push(`+Break против ${passiveEnemies[0].localized_name}`);
    }

    const healEnemies = enemies.filter((e) => HEAL_REGEN_HEROES.has(shortHeroName(e)));
    if (healEnemies.length >= 1 && ANTI_HEAL_HEROES.has(short)) {
      bonus += 1.4;
      reasons.push('+Режет отхил врагов');
    }
  }

  return { bonus, reasons };
}

/* ------------------------------- candidates ------------------------------- */
export type PoolMode = 'mixed' | 'personal' | 'meta';

export interface Candidate {
  heroId: number;
  source: 'personal' | 'meta';
  personal?: PoolHero;
  metaWr: number;
  metaStrength: number;
  isPrimaryRole: boolean;
}

/**
 * Актуальная многофакторная оценка силы героя в текущей мете:
 *   1) Бленд WR в брекете игрока (60%) и High-MMR Divine/Immortal (40%, чтобы отсеять хаос низких рангов).
 *   2) Популярность в пабах и на высоком рейтинге (устойчивые метовые стейплы vs редкие флуктуации).
 *   3) Востребованность на про-сцене (pro_pick + pro_ban) и живой 7-дневный тренд патча (`metaTrend`).
 *   4) Штраф чиз-специалистам с <4.5% пикрейта и слабым героям <48% WR.
 */
export function computeMetaStrength(
  h: HeroStat,
  bracket: number | null,
  totalPicks: number,
  totalHighPicks = 0,
): number {
  const bracketWr = metaWinrate(h, bracket);
  const hiPicks = (h['6_pick'] || 0) + (h['7_pick'] || 0) + (h['8_pick'] || 0);
  const hiWins = (h['6_win'] || 0) + (h['7_win'] || 0) + (h['8_win'] || 0);
  const highWr = hiPicks >= 500 ? hiWins / hiPicks : bracketWr;
  const blendedWr = bracket && bracket >= 6 ? highWr : 0.6 * bracketWr + 0.4 * highWr;

  const short = shortHeroName(h);
  const pickShare = totalPicks > 0 ? (h.pub_pick / (totalPicks / 10)) * 100 : 5;
  const highPickShare = totalHighPicks > 0 ? (hiPicks / (totalHighPicks / 10)) * 100 : pickShare;
  const popularityAdj = clamp((pickShare * 0.5 + highPickShare * 0.5 - 5.0) * 0.22, -2.0, 2.2);

  const proContest = (h.pro_pick || 0) + (h.pro_ban || 0);
  const proAdj = clamp(proContest * 0.025, 0, 1.8);
  const trendAdj = clamp(metaTrend(h) * 0.45, -1.2, 1.4);

  const cheesePenalty = NICHE_CHEESE_HEROES.has(short) && pickShare < 4.5 ? -3.4 : 0;
  const slumpPenalty = blendedWr < 0.48 ? (blendedWr - 0.48) * 60 : 0;
  return (blendedWr - 0.5) * 100 + popularityAdj + proAdj + trendAdj + cheesePenalty + slumpPenalty;
}

interface CandidateInput {
  role: Role;
  pool: PoolHero[];
  heroes: HeroStat[];
  positions: Map<number, Role[]>;
  bracket: number | null;
  mode: PoolMode;
}

function rolePriorityBias(roles: Role[] | undefined, targetRole: Role): number {
  const rank = roles?.indexOf(targetRole) ?? -1;
  if (rank === 0) return 1.6;
  if (rank === 1) return -2.2;
  return -3.2;
}

/**
 * Возвращает ВСЕХ релевантных героев на выбранную роль (25–45 героев вместо обрезанных 24),
 * чтобы сильные контрпики всегда попадали в расчёт при выборе врагов.
 */
export function buildCandidates({ role, pool, heroes, positions, bracket, mode }: CandidateInput): Candidate[] {
  const out: Candidate[] = [];
  const seen = new Set<number>();
  const poolById = new Map(pool.map((p) => [p.heroId, p]));
  const heroesById = new Map(heroes.map((h) => [h.id, h]));
  const totalPicks = heroes.reduce((s, h) => s + (h.pub_pick || 0), 0);
  const totalHighPicks = heroes.reduce((s, h) => s + (h['6_pick'] || 0) + (h['7_pick'] || 0) + (h['8_pick'] || 0), 0);

  if (mode === 'meta') {
    const roleHeroes = heroes
      .filter((h) => positions.get(h.id)?.includes(role))
      .map((h) => {
        const roles = positions.get(h.id);
        return {
          h,
          wr: metaWinrate(h, bracket),
          strength: computeMetaStrength(h, bracket, totalPicks, totalHighPicks) + rolePriorityBias(roles, role),
          isPrimaryRole: roles?.[0] === role,
        };
      })
      .sort((a, b) => b.strength - a.strength);

    for (const item of roleHeroes) {
      out.push({
        heroId: item.h.id,
        source: 'meta',
        personal: poolById.get(item.h.id),
        metaWr: item.wr,
        metaStrength: item.strength,
        isPrimaryRole: item.isPrimaryRole,
      });
    }
    return out;
  }

  // Личные герои игрока на эту позицию:
  // строго проверяем соответствие пулу роли (`roles.includes(role)`), чтобы герои вроде Pudge или Leshrac
  // не попадали в Carry из-за случайных лайновых матчей или Turbo; в 'personal' допускаем только при >=5 уверенных играх.
  const personalOnRole = pool
    .filter((p) => {
      const roles = positions.get(p.heroId);
      const rg = p.roleGames[role] ?? 0;
      if (roles?.includes(role)) {
        return rg >= 1 || (roles[0] === role && p.games >= 2);
      }
      if (mode === 'personal') {
        return rg >= 5 && p.wr >= 0.5;
      }
      return false;
    })
    .sort((a, b) => (b.roleGames[role] ?? 0) - (a.roleGames[role] ?? 0) || b.games - a.games);

  for (const p of personalOnRole) {
    const hero = heroesById.get(p.heroId);
    if (!hero) continue;
    const roles = positions.get(p.heroId);
    const isPrimaryRole = roles?.[0] === role;
    const baseBias = roles?.includes(role) ? rolePriorityBias(roles, role) : -4.8;
    out.push({
      heroId: p.heroId,
      source: 'personal',
      personal: p,
      metaWr: metaWinrate(hero, bracket),
      metaStrength: computeMetaStrength(hero, bracket, totalPicks, totalHighPicks) + baseBias,
      isPrimaryRole,
    });
    seen.add(p.heroId);
  }

  // В режиме 'mixed' добавляем ВСЕХ остальных героев роли; в 'personal' — только если личных меньше 10
  if (mode === 'mixed' || out.length < 10) {
    const meta = heroes
      .filter((h) => !seen.has(h.id) && positions.get(h.id)?.includes(role))
      .map((h) => {
        const roles = positions.get(h.id);
        return {
          h,
          wr: metaWinrate(h, bracket),
          strength: computeMetaStrength(h, bracket, totalPicks, totalHighPicks) + rolePriorityBias(roles, role),
          isPrimaryRole: roles?.[0] === role,
        };
      })
      .sort((a, b) => b.strength - a.strength);

    for (const item of meta) {
      if (mode === 'personal' && out.length >= 12) break;
      out.push({
        heroId: item.h.id,
        source: 'meta',
        personal: poolById.get(item.h.id),
        metaWr: item.wr,
        metaStrength: item.strength,
        isPrimaryRole: item.isPrimaryRole,
      });
    }
  }
  return out;
}

/* --------------------------------- scoring -------------------------------- */
export interface DraftContext {
  role: Role;
  mode: PoolMode;
  enemies: number[];
  allies: number[];
  enemyMatchups: Map<number, EnemyMatchupIndex>;
  heroesById: Map<number, HeroStat>;
  synergy: SynergyIndex;
  counters: CounterIndex;
}

export interface Recommendation {
  heroId: number;
  source: Candidate['source'];
  total: number;
  winAdvantage: number;
  counter: number;
  synergy: number;
  tacticalBonus: number;
  perEnemy: { heroId: number; adv: number; games: number }[];
  perAlly: { heroId: number; syn: number }[];
  personalWr: number | null;
  personalGames: number;
  isSignature: boolean;
  metaWr: number;
  matchupsLoaded: boolean;
  reasons: string[];
}

export function scoreCandidates(candidates: Candidate[], ctx: DraftContext): Recommendation[] {
  const allyHeroes = ctx.allies.map((id) => ctx.heroesById.get(id)).filter((h): h is HeroStat => !!h);
  const enemyHeroes = ctx.enemies.map((id) => ctx.heroesById.get(id)).filter((h): h is HeroStat => !!h);
  const teamMetrics = analyzeTeamComposition(allyHeroes, enemyHeroes);
  const name = (id: number) => ctx.heroesById.get(id)?.localized_name ?? `#${id}`;

  return candidates
    .map((c): Recommendation | null => {
      const hero = ctx.heroesById.get(c.heroId);
      if (!hero) return null;

      // 1. Контрпики врагов: стабилизированная статистика OpenDota + механические контрпики Dota 2
      const mechanicalReasons: string[] = [];
      let mechanicalCounterSum = 0;

      const perEnemy = ctx.enemies.map((eId) => {
        const apiAdv = candidateVsEnemyAdvantage(ctx.enemyMatchups.get(eId), c.heroId);
        const tip = getCounterTip(ctx.counters, c.heroId, eId);
        const combinedAdv = apiAdv.adv + (tip?.bonus ?? 0);
        if (tip) {
          mechanicalCounterSum += tip.bonus;
          mechanicalReasons.push(tip.reason);
        }
        return { heroId: eId, adv: combinedAdv, games: apiAdv.games };
      });
      const counter = perEnemy.reduce((s, x) => s + x.adv, 0);

      // 2. Парные связки + тактический баланс команды
      const perAlly = ctx.allies.map((a) => ({ heroId: a, syn: pairSynergy(ctx.synergy, c.heroId, a) }));
      const pairSynSum = perAlly.reduce((s, x) => s + x.syn, 0);
      const tactical = evaluateTacticalFit(hero, ctx.role, allyHeroes, enemyHeroes, teamMetrics);
      const synergy = pairSynSum + tactical.bonus;

      // 3. Личный пул vs Мета патча (высокий prior = 14 и шкала уверенности отсекают шум 1–2 случайных побед)
      const p = c.personal;
      const roleGamesOnPos = p?.roleGames[ctx.role] ?? 0;
      const experienceConf = p ? clamp(p.games / 6, 0.2, 1) : 0;
      const roleFitConf = roleGamesOnPos >= 2 ? 1 : c.isPrimaryRole ? 0.65 : 0.35;
      const rawPersonalScore = p
        ? ((shrink(p.wins, p.games, 14) - 0.5) * 100 +
            Math.min(p.games, 25) * 0.14 +
            Math.min(roleGamesOnPos, 15) * 0.14) *
          experienceConf *
          roleFitConf
        : 0;

      const personalWeight = ctx.mode === 'meta' ? 0 : ctx.mode === 'personal' ? 0.85 : 0.42;
      const metaWeight = ctx.mode === 'meta' ? 1.05 : ctx.mode === 'personal' ? 0.4 : 0.78;

      const winAdvantage = counter + synergy;
      const total = winAdvantage + personalWeight * rawPersonalScore + metaWeight * c.metaStrength;

      // Собираем понятные и честные объяснения
      const reasons: string[] = [...mechanicalReasons];

      const bestAlly = [...perAlly].sort((a, b) => b.syn - a.syn)[0];
      if (bestAlly && bestAlly.syn > 0) {
        reasons.push(`Связка с ${name(bestAlly.heroId)} (+${bestAlly.syn.toFixed(1)}%)`);
      }

      for (const r of tactical.reasons) {
        if (!reasons.includes(r)) reasons.push(r);
      }

      const bestVs = [...perEnemy].sort((a, b) => b.adv - a.adv)[0];
      if (bestVs && bestVs.adv >= 1.0 && mechanicalCounterSum === 0) {
        reasons.push(`Плюс против ${name(bestVs.heroId)} (+${bestVs.adv.toFixed(1)}%)`);
      }

      const worstVs = [...perEnemy].sort((a, b) => a.adv - b.adv)[0];
      if (worstVs && worstVs.adv <= -1.8) {
        reasons.push(`Осторожно против ${name(worstVs.heroId)} (${worstVs.adv.toFixed(1)}%)`);
      }

      if (ctx.mode !== 'meta' && p && p.games >= 3) {
        reasons.push(`Твой пул: ${p.games} игр (${(p.wr * 100).toFixed(0)}% WR)`);
      }

      if (c.metaWr >= 0.52) {
        reasons.push(`Сильная мета: ${(c.metaWr * 100).toFixed(1)}% WR`);
      }

      return {
        heroId: c.heroId,
        source: ctx.mode === 'meta' ? 'meta' : c.source,
        total,
        winAdvantage,
        counter,
        synergy,
        tacticalBonus: tactical.bonus,
        perEnemy,
        perAlly,
        personalWr: p ? p.wr : null,
        personalGames: p?.games ?? 0,
        isSignature: ctx.mode !== 'meta' && !!p?.tags.includes('signature'),
        metaWr: c.metaWr,
        matchupsLoaded: ctx.enemies.every((eId) => ctx.enemyMatchups.has(eId)),
        reasons,
      };
    })
    .filter((r): r is Recommendation => !!r)
    .sort((a, b) => b.total - a.total);
}
