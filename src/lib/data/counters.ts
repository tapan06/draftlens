/**
 * Механическая матрица контрпиков Dota 2 (дополняет живую статистику OpenDota).
 * Зачем: выборка матчей в OpenDota /heroes/{id}/matchups ограничена 30–300 играми,
 * из-за чего классические механические контрпики (AM vs Medusa, AA vs Huskar,
 * ES vs PL, Viper vs Bristleback) могут теряться в шуме.
 *
 * Формат: [герой-контрпик, враг, бонус_в_pp, короткое_объяснение_на_русском]
 */
import type { HeroStat } from '@/lib/api/opendota';

const RAW_COUNTERS: Array<[string, string, number, string]> = [
  // Против иллюзий и саммонов
  ['earthshaker', 'phantom_lancer', 4.8, 'Echo Slam уничтожает иллюзий PL'],
  ['earthshaker', 'naga_siren', 4.5, 'Echo Slam наказывает за иллюзии'],
  ['earthshaker', 'chaos_knight', 4.2, 'Echo Slam по иллюзиям CK'],
  ['earthshaker', 'broodmother', 4.4, 'Echo Slam взрывает пауков'],
  ['earthshaker', 'meepo', 4.6, 'Echo Slam по всем клонам Meepo'],
  ['axe', 'phantom_lancer', 3.4, 'Counter Helix чистит иллюзии'],
  ['axe', 'broodmother', 3.6, 'Крутилки легко сбривают паучков'],
  ['axe', 'dazzle', 3.8, 'Culling Blade пробивает Shallow Grave'],
  ['axe', 'phantom_assassin', 2.8, 'Blade Mail + Call контрят PA'],
  ['axe', 'troll_warlord', 2.6, 'Call + Blade Mail под ульту Troll'],
  ['axe', 'huskar', 2.6, 'Culling Blade добивает Huskar на лоу ХП'],
  ['sven', 'phantom_lancer', 3.6, 'Cleave быстро стирает иллюзий'],
  ['sven', 'naga_siren', 3.4, 'Cleave чистит иллюзии Naga'],
  ['sven', 'chaos_knight', 3.4, 'Cleave + Warcry против ульты CK'],
  ['leshrac', 'phantom_lancer', 3.8, 'Постоянный AoE урон по иллюзиям'],
  ['leshrac', 'naga_siren', 3.6, 'AoE магия сжигает иллюзий'],
  ['sand_king', 'phantom_lancer', 3.2, 'Caustic + Sand Storm против иллюзий'],
  ['sand_king', 'broodmother', 3.6, 'Взрывает пауков Caustic Finale'],
  ['winter_wyvern', 'meepo', 4.8, 'Winter\'s Curse убивает клона руками своих'],
  ['winter_wyvern', 'chaos_knight', 3.4, 'Curse разворачивает иллюзий CK'],
  ['winter_wyvern', 'legion_commander', 3.6, 'Cold Embrace полностью сейвит от Duel'],
  ['winter_wyvern', 'faceless_void', 3.2, 'Cold Embrace сейвит союзника в Chrono'],
  ['elder_titan', 'meepo', 4.2, 'Earth Splitter + пассивка сносит броню'],
  ['elder_titan', 'morphling', 3.8, 'Снимает всю базовую броню Morphling'],
  ['elder_titan', 'terrorblade', 3.8, 'Снимает огромную белую броню TB'],

  // Против хила / регена / жира
  ['ancient_apparition', 'huskar', 5.2, 'Ice Blast полностью блокирует хил Huskar'],
  ['ancient_apparition', 'alchemist', 4.8, 'Ice Blast отключает реген ульты Alchemist'],
  ['ancient_apparition', 'necrolyte', 4.4, 'Ice Blast режет отхил Necrophos'],
  ['ancient_apparition', 'morphling', 4.0, 'Ice Blast мешает перекачке Morphling'],
  ['ancient_apparition', 'wisp', 4.0, 'Ice Blast выключает лечение от Io'],
  ['ancient_apparition', 'oracle', 3.6, 'Ice Blast пробивает отхил False Promise'],
  ['ancient_apparition', 'life_stealer', 3.4, 'Ice Blast режет вампиризм'],
  ['necrolyte', 'huskar', 3.2, 'Reaper\'s Scythe наказывает за лоу ХП'],
  ['necrolyte', 'centaur', 3.0, 'Процентный урон + коса по толстому ХП'],
  ['necrolyte', 'pudge', 3.2, 'Heartstopper + Scythe режут Pudge'],
  ['life_stealer', 'pudge', 3.2, 'Feast бьёт от огромного ХП Pudge'],
  ['life_stealer', 'centaur', 3.0, 'Feast + Rage легко режут Centaur'],
  ['life_stealer', 'primal_beast', 2.8, 'Rage игнорирует контроль Primal Beast'],
  ['shredder', 'strength', 0, ''], // placeholder ignored if not found
  ['shredder', 'chaos_knight', 3.4, 'Whirling Death снимает силу у силовика'],
  ['shredder', 'pudge', 3.2, 'Чистый урон режет Pudge'],
  ['shredder', 'centaur', 3.0, 'Снимает силу + реактивная броня'],
  ['shredder', 'bristleback', 2.8, 'Чистый урон пробивает спину'],

  // Break против пассивок
  ['viper', 'bristleback', 4.6, 'Nethertoxin (Break) выключает спину Bristleback'],
  ['viper', 'huskar', 4.0, 'Break выключает Berserker\'s Blood'],
  ['viper', 'spectre', 3.6, 'Break выключает Dispersion и Desolate'],
  ['viper', 'phantom_assassin', 3.2, 'Break выключает Blur и криты'],
  ['viper', 'dragon_knight', 3.2, 'Break снимает пассивную броню и реген'],
  ['viper', 'tidehunter', 3.0, 'Break выключает Kraken Shell'],
  ['shadow_demon', 'bristleback', 3.4, 'Demonic Purge + Shard выключают пассивки'],
  ['shadow_demon', 'anti_mage', 2.8, 'Иллюзии AM + Purge через BKB'],
  ['shadow_demon', 'antimage', 3.2, 'Purge через BKB + сильные иллюзии AM'],
  ['shadow_demon', 'legion_commander', 3.4, 'Disruption полностью срывает Duel'],
  ['shadow_demon', 'omniknight', 3.4, 'Ультимейт снимает Repel / Guardian Angel'],
  ['hoodwink', 'bristleback', 3.4, 'Sharpshooter вешает Break издалека'],
  ['hoodwink', 'spectre', 3.0, 'Sharpshooter вешает Break на Spectre'],

  // Мана-бёрн и анти-каст
  ['antimage', 'medusa', 4.8, 'Mana Break сжигает манащит Medusa'],
  ['antimage', 'storm_spirit', 4.2, 'Mana Void наказывает Storm за трату маны'],
  ['antimage', 'leshrac', 4.0, 'Контрспелл + Mana Void по Leshrac'],
  ['antimage', 'zuus', 3.6, 'Легко прыгает в Zeus + Counterspell'],
  ['antimage', 'tinker', 3.4, 'Ловит Tinker и наказывает Mana Void'],
  ['nyx_assassin', 'obsidian_destroyer', 4.4, 'Mana Burn + Carapace ломают OD'],
  ['nyx_assassin', 'medusa', 3.8, 'Mind Flare сжигает огромный манапул Medusa'],
  ['nyx_assassin', 'tinker', 4.0, 'Находит Tinker через Vendetta + Carapace'],
  ['nyx_assassin', 'zuus', 3.6, 'Spiked Carapace контрит ульт и прокаст'],
  ['nyx_assassin', 'puck', 3.4, 'Carapace сбивает Orb/Waning Rift + ульт'],
  ['pugna', 'obsidian_destroyer', 3.8, 'Nether Ward наказывает за дорогие орбы'],
  ['pugna', 'skywrath_mage', 4.0, 'Nether Ward взрывает Skywrath за прокаст'],
  ['pugna', 'leshrac', 3.6, 'Nether Ward бьёт при включённом ульте'],
  ['pugna', 'legion_commander', 3.2, 'Decrepify не даёт бить в Duel'],
  ['silencer', 'enigma', 4.6, 'Global Silence сбивает Black Hole через BKB'],
  ['silencer', 'witch_doctor', 3.8, 'Global Silence прерывает Death Ward'],
  ['silencer', 'crystal_maiden', 3.6, 'Global Silence сбивает Freezing Field'],
  ['silencer', 'bane', 3.6, 'Global Silence сбивает Fiend\'s Grip'],
  ['silencer', 'puck', 3.4, 'Global Silence + Last Word не дают уйти'],
  ['rubick', 'enigma', 3.8, 'Легко ворует Black Hole и сбивает каст'],
  ['rubick', 'tidehunter', 3.4, 'Ворует Ravage, откидывая команду'],
  ['rubick', 'magnataur', 3.2, 'Ворует RP / Skewer'],
  ['rubick', 'sand_king', 3.2, 'Ворует Burrowstrike / Epicenter'],

  // Анти-мобильность и анти-инвиз
  ['bloodseeker', 'slark', 4.2, 'Thirst подсвечивает Slark на лоу ХП + Rupture'],
  ['bloodseeker', 'pangolier', 4.2, 'Rupture полностью останавливает Rolling Thunder'],
  ['bloodseeker', 'weaver', 3.8, 'Rupture наказывает за Shukuchi/Time Lapse'],
  ['bloodseeker', 'antimage', 3.6, 'Rupture мешает блинкаться Anti-Mage'],
  ['disruptor', 'antimage', 3.4, 'Glimpse возвращает после Blink + Static Storm'],
  ['disruptor', 'puck', 3.4, 'Glimpse возвращает от Orb + сало без BKB'],
  ['disruptor', 'ember_spirit', 3.6, 'Glimpse возвращает после Remnant'],
  ['disruptor', 'weaver', 3.2, 'Glimpse отменяет побег Weaver'],
  ['spirit_breaker', 'tinker', 4.0, 'Charge даёт вижен и ловит Tinker в лесу'],
  ['spirit_breaker', 'sniper', 3.6, 'Легко добирается до Sniper через всю карту'],
  ['spirit_breaker', 'nature_prophet', 3.2, 'Charge контрит сплитпуш'],
  ['spirit_breaker', 'furion', 3.4, 'Charge мгновенно ловит Nature\'s Prophet'],
  ['legion_commander', 'antimage', 3.8, 'Duel не даёт Anti-Mage блинкнуться'],
  ['legion_commander', 'weaver', 3.8, 'Duel не даёт нажать Time Lapse'],
  ['legion_commander', 'puck', 3.8, 'Мгновенный Duel ловит Puck до Shift'],
  ['legion_commander', 'ember_spirit', 3.4, 'Duel ловит Ember до прыжка в Remnant'],
  ['slardar', 'riki', 4.2, 'Corrosive Haze полностью выключает инвиз Riki'],
  ['slardar', 'bounty_hunter', 3.8, 'Ульт снимает инвиз и режет броню'],
  ['slardar', 'clinkz', 3.8, 'Corrosive Haze палит Clinkz и сносит броню'],
  ['slardar', 'weaver', 3.4, 'Corrosive Haze не даёт уйти в Shukuchi'],
  ['slardar', 'nyx_assassin', 3.6, 'True Sight видит Nyx в Vendetta'],
  ['bounty_hunter', 'riki', 3.4, 'Track даёт постоянный True Sight по Riki'],
  ['bounty_hunter', 'nyx_assassin', 3.2, 'Track подсвечивает Nyx в инвизе'],

  // Прочие важные контрпики + сейвы
  ['oracle', 'dark_seer', 3.4, 'Fortune\'s End снимает Surge и Ion Shell'],
  ['oracle', 'batrider', 3.6, 'False Promise сейвит союзника в Lasso'],
  ['oracle', 'necrolyte', 4.0, 'False Promise полностью контрит Scythe'],
  ['oracle', 'legion_commander', 3.4, 'Disarm + False Promise спасают от Duel'],
  ['abaddon', 'bane', 3.8, 'Aphotic Shield мгновенно снимает Grip/Nightmare'],
  ['abaddon', 'batrider', 3.8, 'Aphotic Shield снимает Flaming Lasso'],
  ['abaddon', 'mirana', 3.2, 'Щит снимает 5-секундную стрелу'],
  ['dazzle', 'legion_commander', 3.2, 'Shallow Grave не даёт отдать дуэль'],
  ['razor', 'life_stealer', 3.4, 'Static Link высасывает урон сквозь Rage'],
  ['razor', 'ursa', 3.2, 'Static Link забирает урон в Ursa'],
  ['razor', 'troll_warlord', 3.2, 'Static Link ломает урон Troll'],
  ['doom_bringer', 'storm_spirit', 3.6, 'Doom выключает мобильного Storm'],
  ['doom_bringer', 'puck', 3.6, 'Doom не оставляет шансов Puck'],
  ['doom_bringer', 'huskar', 3.8, 'Doom с талантом/Shard отключает пассивки и хил'],
];

export interface CounterTip {
  bonus: number;
  reason: string;
}

export type CounterIndex = Map<string, CounterTip>;
const counterKey = (counterId: number, enemyId: number) => `${counterId}->${enemyId}`;

export function buildCounterIndex(heroes: HeroStat[]): CounterIndex {
  const byShort = new Map(heroes.map((h) => [h.name.replace('npc_dota_hero_', ''), h.id]));
  const index: CounterIndex = new Map();
  for (const [cShort, eShort, bonus, reason] of RAW_COUNTERS) {
    if (!bonus || !reason) continue;
    const cid = byShort.get(cShort);
    const eid = byShort.get(eShort);
    if (cid && eid) {
      index.set(counterKey(cid, eid), { bonus, reason });
    }
  }
  return index;
}

export function getCounterTip(index: CounterIndex, candidateId: number, enemyId: number): CounterTip | null {
  return index.get(counterKey(candidateId, enemyId)) ?? null;
}
