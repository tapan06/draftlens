/**
 * Позиционные пулы и тактические профили всех 127 героев Dota 2.
 *
 * Порядок ролей в массиве каждого героя задаёт приоритет (первая роль — основная).
 */
import type { Role } from '@/lib/analytics/roles';

export const HERO_PRIMARY_ROLES: Record<string, Role[]> = {
  // Pos 1 — Carry
  antimage: ['carry'],
  faceless_void: ['carry'],
  phantom_assassin: ['carry'],
  spectre: ['carry'],
  terrorblade: ['carry'],
  medusa: ['carry'],
  morphling: ['carry', 'mid'],
  luna: ['carry'],
  slark: ['carry'],
  troll_warlord: ['carry'],
  sven: ['carry'],
  life_stealer: ['carry'],
  naga_siren: ['carry', 'soft'],
  phantom_lancer: ['carry'],
  skeleton_king: ['carry', 'offlane'],
  drow_ranger: ['carry'],
  gyrocopter: ['carry', 'soft'],
  ursa: ['carry'],
  muerta: ['carry', 'soft'],
  monkey_king: ['carry', 'mid', 'soft'],
  weaver: ['carry', 'soft'],
  alchemist: ['carry', 'mid'],
  lycan: ['offlane', 'carry'],
  bloodseeker: ['carry', 'mid', 'offlane'],
  riki: ['carry', 'mid'],
  clinkz: ['carry', 'mid'],
  kez: ['carry', 'mid'],
  juggernaut: ['carry'],
  chaos_knight: ['carry', 'offlane'],

  // Pos 2 — Mid
  invoker: ['mid', 'soft'],
  storm_spirit: ['mid'],
  queenofpain: ['mid', 'offlane'],
  puck: ['mid'],
  ember_spirit: ['mid'],
  void_spirit: ['mid'],
  lina: ['mid', 'carry', 'soft'],
  nevermore: ['mid', 'carry'],
  tinker: ['mid', 'soft'],
  templar_assassin: ['mid', 'carry'],
  leshrac: ['mid', 'offlane'],
  death_prophet: ['mid', 'offlane'],
  pangolier: ['mid', 'offlane'],
  kunkka: ['mid', 'offlane'],
  obsidian_destroyer: ['mid'],
  zuus: ['mid', 'soft'],
  dragon_knight: ['mid', 'offlane', 'carry'],
  sniper: ['mid', 'carry'],
  huskar: ['mid', 'offlane'],
  arc_warden: ['mid', 'carry'],
  broodmother: ['mid', 'offlane'],
  meepo: ['mid', 'carry'],
  lone_druid: ['mid', 'offlane', 'carry'],

  // Pos 3 — Offlane
  axe: ['offlane'],
  mars: ['offlane', 'mid'],
  centaur: ['offlane'],
  legion_commander: ['offlane'],
  tidehunter: ['offlane'],
  abyssal_underlord: ['offlane'],
  bristleback: ['offlane', 'carry'],
  dark_seer: ['offlane'],
  beastmaster: ['offlane', 'mid'],
  primal_beast: ['offlane', 'mid'],
  shredder: ['offlane', 'mid'],
  brewmaster: ['offlane'],
  sand_king: ['offlane', 'mid'],
  night_stalker: ['offlane'],
  magnataur: ['offlane', 'mid'],
  enigma: ['offlane', 'soft'],
  slardar: ['offlane', 'mid'],
  doom_bringer: ['offlane'],
  visage: ['offlane', 'mid'],
  razor: ['offlane', 'mid', 'carry'],
  necrolyte: ['offlane', 'mid'],
  viper: ['offlane', 'mid'],
  dawnbreaker: ['offlane', 'soft'],
  venomancer: ['offlane', 'soft', 'hard'],
  furion: ['offlane', 'carry'],

  // Pos 4 — Soft Support
  earth_spirit: ['soft', 'mid'],
  tusk: ['soft', 'hard'],
  rubick: ['soft', 'mid'],
  mirana: ['soft', 'hard'],
  spirit_breaker: ['soft', 'offlane'],
  earthshaker: ['soft', 'mid', 'offlane'],
  rattletrap: ['soft', 'hard'],
  snapfire: ['soft', 'hard', 'mid'],
  hoodwink: ['soft'],
  nyx_assassin: ['soft'],
  skywrath_mage: ['soft', 'mid'],
  phoenix: ['soft', 'hard', 'offlane'],
  pudge: ['soft', 'offlane', 'mid'],
  techies: ['soft', 'hard'],
  bounty_hunter: ['soft'],
  marci: ['soft', 'offlane', 'carry'],
  dark_willow: ['soft', 'hard'],
  ringmaster: ['soft', 'hard'],
  tiny: ['mid', 'soft', 'offlane'],
  batrider: ['soft', 'offlane', 'mid'],
  windrunner: ['soft', 'mid', 'carry'],
  enchantress: ['soft', 'hard'],
  pugna: ['soft', 'hard', 'mid'],

  // Pos 5 — Hard Support
  crystal_maiden: ['hard', 'soft'],
  lion: ['hard', 'soft'],
  shadow_shaman: ['hard', 'soft'],
  witch_doctor: ['hard', 'soft'],
  dazzle: ['hard', 'soft'],
  oracle: ['hard'],
  warlock: ['hard'],
  jakiro: ['hard', 'soft'],
  lich: ['hard'],
  vengefulspirit: ['hard', 'soft', 'offlane'],
  ancient_apparition: ['hard', 'soft'],
  treant: ['hard', 'soft'],
  disruptor: ['hard', 'soft'],
  winter_wyvern: ['hard', 'soft'],
  chen: ['hard'],
  wisp: ['hard', 'soft'],
  undying: ['hard', 'offlane'],
  ogre_magi: ['hard', 'soft', 'offlane'],
  omniknight: ['hard', 'offlane'],
  elder_titan: ['hard', 'soft'],
  grimstroke: ['hard', 'soft'],
  abaddon: ['hard', 'offlane'],
  bane: ['hard', 'soft'],
  keeper_of_the_light: ['soft', 'hard', 'mid'],
  silencer: ['hard', 'soft'],
  shadow_demon: ['hard', 'soft'],
  largo: ['hard', 'soft'],
};

export const POSITION_POOLS: Record<Role, string[]> = {
  carry: [],
  mid: [],
  offlane: [],
  soft: [],
  hard: [],
};

for (const [hero, roles] of Object.entries(HERO_PRIMARY_ROLES)) {
  for (const r of roles) {
    if (!POSITION_POOLS[r].includes(hero)) POSITION_POOLS[r].push(hero);
  }
}

/** Герои с сильным AoE против иллюзий и саммонов. */
export const AOE_CLEAR_HEROES = new Set([
  'earthshaker', 'axe', 'sand_king', 'leshrac', 'sven', 'ember_spirit', 'abyssal_underlord',
  'jakiro', 'shredder', 'dark_seer', 'magnataur', 'kunkka', 'gyrocopter', 'luna', 'medusa',
  'necrolyte', 'phoenix', 'winter_wyvern', 'dawnbreaker', 'legion_commander', 'puck', 'elder_titan',
]);

/** Враги-иллюзионисты / саммонеры. */
export const ILLUSION_SUMMON_HEROES = new Set([
  'phantom_lancer', 'naga_siren', 'chaos_knight', 'terrorblade', 'meepo',
  'broodmother', 'beastmaster', 'lycan', 'chen', 'visage', 'enigma',
]);

/** Герои с мгновенным / надёжным контролем против мобильных целей. */
export const HARD_LOCKDOWN_HEROES = new Set([
  'lion', 'shadow_shaman', 'axe', 'legion_commander', 'doom_bringer', 'bane',
  'faceless_void', 'puck', 'disruptor', 'spirit_breaker', 'riki', 'night_stalker',
  'silencer', 'skywrath_mage', 'mars', 'centaur', 'slardar', 'tiny', 'primal_beast',
  'bloodseeker', 'earth_spirit', 'nyx_assassin',
]);

/** Герои с сильным сейвом, хилом или подсейвом союзника. */
export const SAVE_SUSTAIN_HEROES = new Set([
  'dazzle', 'oracle', 'shadow_demon', 'abaddon', 'omniknight', 'wisp', 'winter_wyvern',
  'treant', 'chen', 'enchantress', 'pugna', 'vengefulspirit', 'dawnbreaker', 'tusk', 'phoenix', 'largo',
]);

/** Герои преимущественно магического / чистого урона (для баланса физ/маг). */
export const MAGIC_BURST_HEROES = new Set([
  'zuus', 'leshrac', 'invoker', 'storm_spirit', 'puck', 'skywrath_mage', 'lina',
  'queenofpain', 'ember_spirit', 'void_spirit', 'obsidian_destroyer', 'shredder',
  'necrolyte', 'venomancer', 'sand_king', 'phoenix', 'jakiro', 'lich', 'lion',
  'ancient_apparition', 'dark_willow', 'techies', 'earthshaker', 'tinker', 'muerta',
]);

/** Герои преимущественно физического урона (для баланса физ/маг). */
export const PHYSICAL_CORE_HEROES = new Set([
  'antimage', 'juggernaut', 'phantom_assassin', 'faceless_void', 'drow_ranger', 'sniper',
  'sven', 'troll_warlord', 'ursa', 'slark', 'templar_assassin', 'weaver', 'riki', 'clinkz',
  'phantom_lancer', 'terrorblade', 'medusa', 'luna', 'skeleton_king', 'chaos_knight',
  'life_stealer', 'monkey_king', 'kez', 'dragon_knight', 'alchemist', 'slardar', 'legion_commander',
]);

/** Герои, которые режут жирных танков (%-урон, минус броня, чистый урон). */
export const TANK_KILLER_HEROES = new Set([
  'life_stealer', 'necrolyte', 'ursa', 'shredder', 'slardar', 'viper', 'obsidian_destroyer',
  'drow_ranger', 'terrorblade', 'enigma', 'phoenix', 'ancient_apparition', 'razor', 'doom_bringer',
]);

/** Герои, дающие обзор / True Sight против инвиза. */
export const REVEAL_COUNTERS = new Set(['slardar', 'bounty_hunter', 'zuus', 'spirit_breaker', 'bloodseeker']);
export const INVIS_HEROES = new Set(['riki', 'clinkz', 'nyx_assassin', 'bounty_hunter', 'weaver', 'mirana']);

/** Герои с прерываемыми ультимейтами vs герои, которые легко их сбивают. */
export const CHANNEL_ULTERS = new Set(['enigma', 'witch_doctor', 'crystal_maiden', 'bane', 'shadow_shaman', 'pugna', 'sand_king']);
export const ANTI_CHANNEL_COUNTERS = new Set(['silencer', 'rubick', 'nyx_assassin', 'clockwerk', 'rattletrap', 'earthshaker', 'spirit_breaker', 'vengefulspirit', 'axe', 'warlock', 'winter_wyvern']);

/** Герои с механикой Break или жёстким отключением пассивок/хила. */
export const BREAK_HEROES = new Set(['viper', 'shadow_demon', 'hoodwink', 'nyx_assassin', 'doom_bringer']);
export const PASSIVE_RELIANT_HEROES = new Set(['bristleback', 'spectre', 'phantom_assassin', 'huskar', 'tidehunter', 'dragon_knight', 'abaddon', 'shredder']);

export const ANTI_HEAL_HEROES = new Set(['ancient_apparition', 'doom_bringer', 'necrolyte', 'viper', 'venomancer']);
export const HEAL_REGEN_HEROES = new Set(['huskar', 'alchemist', 'necrolyte', 'morphling', 'wisp', 'oracle', 'dazzle', 'life_stealer', 'abaddon', 'bristleback']);

/** Узкоспециализированные "чиз"-герои с низким пикрейтом: не должны возглавлять общую мету без личного наигрыша или жёсткого контрпика. */
export const NICHE_CHEESE_HEROES = new Set([
  'meepo', 'visage', 'chen', 'broodmother', 'lone_druid', 'arc_warden', 'tinker', 'elder_titan',
  'huskar', 'wisp', 'lycan',
]);
