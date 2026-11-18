/**
 * Синергии пар героев (связки на линии и в тимфайтах).
 *
 * OpenDota не предоставляет агрегированную статистику «герой A + герой B в одной команде».
 * Для 100% реальных синергий по патчу можно подключить Stratz GraphQL (`heroVsHeroMatchup.advantage.with`).
 */
import type { HeroStat } from '@/lib/api/opendota';

const PAIRS: Array<[string, string, number]> = [
  // Io + коры
  ['wisp', 'tiny', 3.0],
  ['wisp', 'gyrocopter', 2.8],
  ['wisp', 'chaos_knight', 2.4],
  ['wisp', 'life_stealer', 2.2],
  ['wisp', 'marci', 2.6],
  ['wisp', 'leshrac', 2.5],
  ['wisp', 'sven', 2.0],

  // Magnus + мили-керри
  ['magnataur', 'sven', 2.5],
  ['magnataur', 'troll_warlord', 2.2],
  ['magnataur', 'phantom_lancer', 2.0],
  ['magnataur', 'phantom_assassin', 2.4],
  ['magnataur', 'juggernaut', 2.2],
  ['magnataur', 'ursa', 2.0],

  // Faceless Void (Chronosphere комбо)
  ['faceless_void', 'skywrath_mage', 2.6],
  ['faceless_void', 'invoker', 2.4],
  ['faceless_void', 'witch_doctor', 2.4],
  ['faceless_void', 'lich', 2.0],
  ['faceless_void', 'jakiro', 2.2],
  ['faceless_void', 'snapfire', 2.2],
  ['faceless_void', 'phoenix', 2.0],
  ['faceless_void', 'ancient_apparition', 1.8],

  // Mars (Arena комбо)
  ['mars', 'snapfire', 2.4],
  ['mars', 'phoenix', 2.4],
  ['mars', 'disruptor', 2.2],
  ['mars', 'invoker', 2.0],
  ['mars', 'jakiro', 2.0],
  ['mars', 'dark_willow', 1.8],

  // Dark Seer / Enigma / Teamfight
  ['dark_seer', 'enigma', 2.6],
  ['dark_seer', 'sven', 2.2],
  ['dark_seer', 'kunkka', 1.8],
  ['dark_seer', 'elder_titan', 2.4],
  ['dark_seer', 'jakiro', 1.8],
  ['enigma', 'queenofpain', 1.8],
  ['enigma', 'lich', 2.0],

  // Grimstroke Soulbind комбо
  ['grimstroke', 'lich', 2.6],
  ['grimstroke', 'doom_bringer', 2.4],
  ['grimstroke', 'legion_commander', 2.2],
  ['grimstroke', 'lion', 2.0],
  ['grimstroke', 'lina', 2.0],
  ['grimstroke', 'necrolyte', 2.2],

  // Сейв + агрессивный кор
  ['omniknight', 'huskar', 2.4],
  ['dazzle', 'huskar', 2.6],
  ['oracle', 'huskar', 2.6],
  ['oracle', 'ursa', 1.8],
  ['abaddon', 'huskar', 2.0],
  ['abaddon', 'slark', 1.6],
  ['ogre_magi', 'troll_warlord', 2.0],
  ['ogre_magi', 'sven', 1.8],
  ['shadow_demon', 'morphling', 1.8],
  ['shadow_demon', 'luna', 2.2],

  // Сильные лайновые связки
  ['crystal_maiden', 'juggernaut', 2.2],
  ['crystal_maiden', 'ursa', 2.0],
  ['crystal_maiden', 'slark', 1.8],
  ['lion', 'juggernaut', 1.8],
  ['shadow_shaman', 'ursa', 2.4],
  ['shadow_shaman', 'juggernaut', 2.2],
  ['venomancer', 'juggernaut', 2.0],
  ['tusk', 'sven', 1.8],
  ['tusk', 'centaur', 1.8],
  ['vengefulspirit', 'drow_ranger', 2.4],
  ['drow_ranger', 'visage', 2.0],
  ['treant', 'ursa', 1.8],
  ['marci', 'ember_spirit', 1.6],
  ['earthshaker', 'sven', 1.6],
  ['jakiro', 'medusa', 1.6],
  ['undying', 'troll_warlord', 1.8],
  ['bane', 'axe', 1.6],
  ['bane', 'mirana', 2.2],
  ['shadow_demon', 'mirana', 2.2],
  ['pugna', 'skywrath_mage', 2.0],
  ['pugna', 'zuus', 1.8],
  ['spirit_breaker', 'bounty_hunter', 1.6],
  ['spirit_breaker', 'life_stealer', 2.2],
];

export type SynergyIndex = Map<string, number>;
const pairKey = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);

export function buildSynergyIndex(heroes: HeroStat[]): SynergyIndex {
  const byShort = new Map(heroes.map((h) => [h.name.replace('npc_dota_hero_', ''), h.id]));
  const index: SynergyIndex = new Map();
  for (const [a, b, v] of PAIRS) {
    const ia = byShort.get(a);
    const ib = byShort.get(b);
    if (ia && ib) index.set(pairKey(ia, ib), v);
  }
  return index;
}

export const pairSynergy = (index: SynergyIndex, a: number, b: number) => index.get(pairKey(a, b)) ?? 0;
