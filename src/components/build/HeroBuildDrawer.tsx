import { useEffect } from 'react';
import { Coins, ExternalLink, GitBranch, Package, Sparkles, Swords, X } from 'lucide-react';
import { useHeroBuild, type HeroIndex } from '@/hooks/useDotaData';
import { cdn, type AbilityConst, type ItemConst } from '@/lib/api/opendota';
import type { PoolHero } from '@/lib/analytics/heroPool';
import { ROLE_BY_ID, type Role } from '@/lib/analytics/roles';
import { mockSkillOrder, mockTalentPick } from '@/lib/data/skillBuilds';
import { Badge } from '@/components/ui/Badge';
import { ATTR_META, HeroImage } from '@/components/ui/HeroImage';
import { Skeleton } from '@/components/ui/Skeleton';
import { Tooltip } from '@/components/ui/Tooltip';
import { cn, pct, toneText, wrTone } from '@/lib/utils';

interface HeroBuildDrawerProps {
  heroId: number | null;
  role: Role;
  heroIndex: HeroIndex;
  poolHero?: PoolHero;
  onClose: () => void;
}

interface ResolvedItem {
  id: string;
  key: string;
  count: number;
  meta: ItemConst;
}

function resolveStageItems(
  stage: Record<string, number> | undefined,
  itemIds: Record<string, string> | undefined,
  items: Record<string, ItemConst> | undefined,
  limit = 6,
): ResolvedItem[] {
  if (!stage || !itemIds || !items) return [];
  return Object.entries(stage)
    .map(([id, count]) => {
      const key = itemIds[id];
      const meta = key ? items[key] : undefined;
      return meta && meta.img ? { id, key, count, meta } : null;
    })
    .filter((x): x is ResolvedItem => !!x && !x.key.startsWith('recipe_'))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/** Очищает плейсхолдеры вида {s:bonus_...} в названиях талантов OpenDota. */
function cleanTalentName(raw?: string, fallback?: string): string {
  if (!raw) return fallback ?? 'Талант';
  return raw.replace(/\{s:[^}]+\}/g, '★').trim();
}

export function HeroBuildDrawer({ heroId, role, heroIndex, poolHero, onClose }: HeroBuildDrawerProps) {
  const hero = heroId != null ? heroIndex.byId.get(heroId) : undefined;
  const { popularity, items, itemIds, heroAbilities, abilities } = useHeroBuild(heroId);

  useEffect(() => {
    if (heroId == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [heroId, onClose]);

  if (heroId == null || !hero) return null;

  const isItemsLoading = popularity.isLoading || items.isLoading || itemIds.isLoading;
  const isAbilitiesLoading = heroAbilities.isLoading || abilities.isLoading;

  const stages = [
    {
      title: 'Стартовый закуп (0:00)',
      items: resolveStageItems(popularity.data?.start_game_items, itemIds.data, items.data, 6),
    },
    {
      title: 'Ранняя стадия (Early Game · до 12 мин)',
      items: resolveStageItems(popularity.data?.early_game_items, itemIds.data, items.data, 6),
    },
    {
      title: 'Мидгейм — ключевые слоты (Mid Game · 12–28 мин)',
      items: resolveStageItems(popularity.data?.mid_game_items, itemIds.data, items.data, 6),
    },
    {
      title: 'Лейтгейм (Late Game · 28+ мин)',
      items: resolveStageItems(popularity.data?.late_game_items, itemIds.data, items.data, 6),
    },
  ];

  // Основные 4 активные/пассивные способности героя из /constants/hero_abilities
  const rawHeroAb = heroAbilities.data?.[hero.name];
  const coreAbilityKeys = (rawHeroAb?.abilities ?? [])
    .filter((k) => k !== 'generic_hidden' && !k.startsWith('special_bonus'))
    .slice(0, 4);
  const coreAbilities: Array<{ key: string; meta: AbilityConst | undefined; hotkey: string }> = coreAbilityKeys.map(
    (key, i) => ({
      key,
      meta: abilities.data?.[key],
      hotkey: ['Q', 'W', 'E', 'R'][i] ?? String(i + 1),
    }),
  );

  // Таланты 10 / 15 / 20 / 25
  const talentsByTier = [1, 2, 3, 4].map((tier) => {
    const pair = (rawHeroAb?.talents ?? []).filter((t) => t.level === tier);
    const leftKey = pair[0]?.name ?? '';
    const rightKey = pair[1]?.name ?? '';
    const leftTitle = cleanTalentName(abilities.data?.[leftKey]?.dname, leftKey);
    const rightTitle = cleanTalentName(abilities.data?.[rightKey]?.dname, rightKey);
    const recommended = mockTalentPick(leftKey, rightKey);
    return {
      heroLevel: tier * 5 + 5,
      leftTitle,
      rightTitle,
      recommended,
    };
  });

  const skillOrder = mockSkillOrder(role);
  const attr = ATTR_META[hero.primary_attr];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <aside
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-2xl flex-col overflow-hidden border-l border-line-strong bg-bg shadow-2xl animate-slide-in-right"
      >
        {/* Шапка карточки героя */}
        <header className="relative shrink-0 overflow-hidden border-b border-line bg-surface p-5">
          <div className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-primary/20 blur-3xl" />
          <div className="relative flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="h-16 w-28 overflow-hidden rounded-xl ring-1 ring-line-strong">
                <HeroImage hero={hero} className="h-full w-full" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-extrabold tracking-tight">{hero.localized_name}</h2>
                  <Badge tone="red">{ROLE_BY_ID[role].label}</Badge>
                  <Badge tone="gray">
                    <span className={cn('mr-1 h-2 w-2 rounded-full', attr.dot)} />
                    {attr.label} · {hero.attack_type}
                  </Badge>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-muted">
                  {poolHero ? (
                    <span>
                      Твой WR:{' '}
                      <strong className={cn('num', toneText[wrTone(poolHero.wr)])}>{pct(poolHero.wr, 0)}</strong>{' '}
                      <span className="num text-fg-dim">
                        ({poolHero.wins}W–{poolHero.games - poolHero.wins}L · KDA {poolHero.kda.toFixed(2)})
                      </span>
                    </span>
                  ) : (
                    <span className="text-fg-dim">Нет недавних игр на герое</span>
                  )}
                  <a
                    href={`https://www.opendota.com/heroes/${hero.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-accent hover:underline"
                  >
                    OpenDota <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            </div>

            <button onClick={onClose} className="btn-ghost btn-sm" aria-label="Закрыть">
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Контент билда */}
        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {/* 1. Предметы по стадиям игры (Реальные данные OpenDota /heroes/{id}/itemPopularity) */}
          <section className="card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="card-title">
                <Package className="h-3.5 w-3.5 text-accent" /> Актуальная сборка предметов (OpenDota Live)
              </h3>
              <span className="text-2xs text-fg-dim">Наведи на предмет для стоимости и описания</span>
            </div>

            {isItemsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="space-y-1.5">
                    <Skeleton className="h-3 w-40" />
                    <div className="flex gap-2">
                      {Array.from({ length: 6 }).map((__, j) => (
                        <Skeleton key={j} className="h-11 w-14 rounded-lg" />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {stages.map((st) => (
                  <div key={st.title}>
                    <div className="mb-1.5 text-2xs font-semibold uppercase tracking-wider text-fg-muted">
                      {st.title}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {st.items.map(({ id, count, meta }) => (
                        <Tooltip
                          key={id}
                          content={
                            <div className="space-y-1">
                              <div className="flex items-center justify-between gap-3">
                                <span className="font-bold text-fg">{meta.dname ?? 'Предмет'}</span>
                                {meta.cost != null && meta.cost > 0 && (
                                  <span className="num inline-flex items-center gap-1 font-bold text-win-mid">
                                    <Coins className="h-3 w-3" /> {meta.cost}
                                  </span>
                                )}
                              </div>
                              {meta.abilities?.[0]?.description && (
                                <p className="text-[11px] leading-snug text-fg-muted">
                                  {meta.abilities[0].description.slice(0, 180)}
                                  {meta.abilities[0].description.length > 180 ? '…' : ''}
                                </p>
                              )}
                              <div className="num text-2xs text-fg-dim">Пиков в выборке OpenDota: {count}</div>
                            </div>
                          }
                        >
                          <div className="group relative flex flex-col items-center rounded-lg border border-line bg-surface-2 p-1 transition hover:border-accent/50 hover:bg-surface-3">
                            <img
                              src={cdn(meta.img)}
                              alt={meta.dname ?? ''}
                              className="h-9 w-12 rounded object-cover"
                              loading="lazy"
                            />
                            {meta.cost != null && meta.cost > 0 && (
                              <span className="num mt-0.5 text-[10px] font-semibold text-win-mid">{meta.cost}g</span>
                            )}
                          </div>
                        </Tooltip>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 2. Порядок прокачки скиллов */}
          <section className="card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="card-title">
                <Swords className="h-3.5 w-3.5 text-primary-bright" /> Порядок прокачки способностей (уровни 1–18)
              </h3>
              <Badge tone="gray">Под позицию {ROLE_BY_ID[role].label}</Badge>
            </div>

            {isAbilitiesLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-2.5">
                {coreAbilities.map((ab, slotIdx) => (
                  <div
                    key={ab.key}
                    className="flex flex-col gap-2 rounded-lg border border-line bg-surface-2/60 p-2.5 sm:flex-row sm:items-center"
                  >
                    <Tooltip
                      content={
                        <div className="space-y-1">
                          <div className="font-bold">{ab.meta?.dname ?? ab.key}</div>
                          {ab.meta?.desc && <p className="text-[11px] text-fg-muted">{ab.meta.desc}</p>}
                        </div>
                      }
                    >
                      <div className="flex w-44 shrink-0 items-center gap-2.5">
                        {ab.meta?.img ? (
                          <img src={cdn(ab.meta.img)} alt="" className="h-9 w-9 rounded-md ring-1 ring-line-strong" />
                        ) : (
                          <div className="grid h-9 w-9 place-items-center rounded-md bg-surface-3 font-bold">
                            {ab.hotkey}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="num rounded bg-surface-3 px-1 text-2xs font-bold text-accent">
                              {ab.hotkey}
                            </span>
                            <span className="truncate text-xs font-semibold">{ab.meta?.dname ?? ab.key}</span>
                          </div>
                        </div>
                      </div>
                    </Tooltip>

                    {/* Сетка уровней 1..18 */}
                    <div className="grid flex-1 grid-cols-9 gap-1 sm:grid-cols-[repeat(18,minmax(0,1fr))]">
                      {skillOrder.map((pickedSlot, lvlIdx) => {
                        const active = pickedSlot === slotIdx;
                        return (
                          <span
                            key={lvlIdx}
                            className={cn(
                              'num grid h-6 place-items-center rounded text-[10px] font-bold',
                              active
                                ? slotIdx === 3
                                  ? 'bg-primary text-white shadow-glow-red'
                                  : 'bg-accent/25 text-accent ring-1 ring-accent/50'
                                : 'bg-surface/70 text-fg-dim',
                            )}
                          >
                            {lvlIdx + 1}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 3. Дерево талантов */}
          <section className="card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="card-title">
                <GitBranch className="h-3.5 w-3.5 text-win-mid" /> Дерево талантов (10 / 15 / 20 / 25)
              </h3>
              <span className="inline-flex items-center gap-1 text-2xs text-win-high">
                <Sparkles className="h-3 w-3" /> Рекомендуемый выбор подсвечен
              </span>
            </div>

            {isAbilitiesLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-9 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {[...talentsByTier].reverse().map((row) => (
                  <div key={row.heroLevel} className="grid grid-cols-[1fr_36px_1fr] items-center gap-2">
                    <div
                      className={cn(
                        'truncate rounded-lg border px-3 py-2 text-right text-xs transition',
                        row.recommended === 0
                          ? 'border-win-high/50 bg-win-high/15 font-semibold text-win-high'
                          : 'border-line bg-surface-2/60 text-fg-muted',
                      )}
                      title={row.leftTitle}
                    >
                      {row.leftTitle}
                    </div>
                    <span className="num grid h-8 w-9 place-items-center rounded-lg border border-win-mid/40 bg-win-mid/15 text-xs font-extrabold text-win-mid">
                      {row.heroLevel}
                    </span>
                    <div
                      className={cn(
                        'truncate rounded-lg border px-3 py-2 text-left text-xs transition',
                        row.recommended === 1
                          ? 'border-win-high/50 bg-win-high/15 font-semibold text-win-high'
                          : 'border-line bg-surface-2/60 text-fg-muted',
                      )}
                      title={row.rightTitle}
                    >
                      {row.rightTitle}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </aside>
    </div>
  );
}
