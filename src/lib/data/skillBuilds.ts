/**
 * Порядок прокачки способностей и выбор талантов (MOCK).
 *
 * Реальные названия/иконки способностей и талантов берутся из OpenDota constants
 * (/constants/hero_abilities + /constants/abilities). Но АГРЕГИРОВАННОГО порядка
 * прокачки в OpenDota нет, поэтому здесь — типовые шаблоны.
 *
 * 🔌 Как подключить реальные данные (на выбор):
 *   A) Stratz GraphQL:
 *        heroStats { abilityMinLevel(heroId: X) { abilityId level matchCount winCount } }
 *        heroStats { talent(heroId: X)      { abilityId matchCount winCount } }
 *   B) Свой бэкенд-агрегатор: раз в сутки забирать /api/proMatches → /api/matches/{id}
 *      и считать моду по players[].ability_upgrades_arr для каждого героя (OpenDota-only путь).
 */
import type { Role } from '@/lib/analytics/roles';

/** 0=Q, 1=W, 2=E, 3=R (ультимейт), 4=талант. Индекс массива = уровень героя - 1. */
export type SkillSlot = 0 | 1 | 2 | 3 | 4;

const CORE_PATTERN: SkillSlot[] = [0, 1, 0, 2, 0, 3, 0, 1, 1, 4, 1, 3, 2, 2, 4, 2, 3, 4];
const SUPPORT_PATTERN: SkillSlot[] = [1, 0, 1, 2, 1, 3, 1, 0, 0, 4, 0, 3, 2, 2, 4, 2, 3, 4];

export function mockSkillOrder(role: Role | null): SkillSlot[] {
  return role === 'soft' || role === 'hard' ? SUPPORT_PATTERN : CORE_PATTERN;
}

/**
 * MOCK-выбор таланта: отдаём предпочтение уникальным талантам героя
 * (special_bonus_unique_*), они чаще сильнее общих статов.
 */
export function mockTalentPick(left: string, right: string): 0 | 1 {
  const l = left.includes('unique');
  const r = right.includes('unique');
  if (l === r) return 0;
  return l ? 0 : 1;
}
