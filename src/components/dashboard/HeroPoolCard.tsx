import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Star, TrendingDown, TrendingUp, Users } from 'lucide-react';
import type { PoolHero } from '@/lib/analytics/heroPool';
import { ROLE_BY_ID } from '@/lib/analytics/roles';
import type { HeroIndex } from '@/hooks/useDotaData';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { HeroImage } from '@/components/ui/HeroImage';
import { ProgressBar } from '@/components/ui/Indicators';
import { Tooltip } from '@/components/ui/Tooltip';
import { cn, pct, signed, toneText, wrTone } from '@/lib/utils';

type SortKey = 'games' | 'wr' | 'kda';

/** Личный пул героев: по умолчанию отсортирован по количеству игр (твои мейны). */
export function HeroPoolCard({
  pool,
  heroIndex,
  onOpenHero,
}: {
  pool: PoolHero[];
  heroIndex: HeroIndex;
  onOpenHero: (heroId: number) => void;
}) {
  const [sortBy, setSortBy] = useState<SortKey>('games');
  const [showAll, setShowAll] = useState(false);

  const sorted = useMemo(() => {
    const base = [...pool];
    if (sortBy === 'games') {
      return base.sort((a, b) => b.games - a.games || b.wr - a.wr);
    }
    if (sortBy === 'wr') {
      // Для сортировки по винрейту сначала показываем героев хотя бы с 3 играми
      return base.sort((a, b) => {
        const aElig = a.games >= 3 ? 1 : 0;
        const bElig = b.games >= 3 ? 1 : 0;
        if (aElig !== bElig) return bElig - aElig;
        return b.wr - a.wr || b.games - a.games;
      });
    }
    return base.sort((a, b) => b.kda - a.kda || b.games - a.games);
  }, [pool, sortBy]);

  const list = showAll ? sorted : sorted.slice(0, 12);

  return (
    <Card
      title={`Твой пул героев (${pool.length})`}
      icon={<Users className="h-3.5 w-3.5" />}
      action={
        <div className="flex flex-wrap items-center gap-1 rounded-lg border border-line bg-surface-2 p-0.5">
          {(
            [
              { id: 'games', label: 'По кол-ву игр' },
              { id: 'wr', label: 'По винрейту' },
              { id: 'kda', label: 'По KDA' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSortBy(tab.id)}
              className={cn(
                'rounded-md px-2 py-1 text-2xs font-semibold transition',
                sortBy === tab.id ? 'bg-surface-3 text-fg shadow-sm ring-1 ring-line-strong' : 'text-fg-muted hover:text-fg',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      }
    >
      {list.length === 0 ? (
        <p className="text-fg-muted">Пока нет данных по героям.</p>
      ) : (
        <>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(168px,1fr))] gap-3">
            {list.map((p, i) => {
              const hero = heroIndex.byId.get(p.heroId);
              const signature = p.tags.includes('signature');
              return (
                <button
                  key={p.heroId}
                  onClick={() => onOpenHero(p.heroId)}
                  style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}
                  className={cn(
                    'card card-interactive group overflow-hidden text-left animate-fade-in',
                    signature && 'border-win-high/40 shadow-glow-green',
                  )}
                >
                  <div className="relative aspect-[16/8] overflow-hidden">
                    <HeroImage hero={hero} className="h-full w-full transition duration-300 group-hover:scale-105" />
                    <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/20 to-transparent" />
                    <div className="absolute left-2 top-2 flex flex-wrap gap-1">
                      <span className="num rounded bg-black/80 px-1.5 py-0.5 text-2xs font-extrabold text-white ring-1 ring-white/15">
                        {p.games} игр
                      </span>
                      {signature && (
                        <Badge
                          tone="green"
                          icon={<Star className="h-3 w-3 fill-current" />}
                          className="bg-win-high/90 text-white ring-0"
                        >
                          Best Pick
                        </Badge>
                      )}
                    </div>
                    <div className="absolute bottom-1.5 left-2.5 right-2.5 flex items-end justify-between">
                      <span className="truncate font-semibold drop-shadow">{hero?.localized_name}</span>
                      <span className="num text-2xs text-fg-muted">{ROLE_BY_ID[p.mainRole].label}</span>
                    </div>
                  </div>

                  <div className="space-y-2.5 p-3 pt-2">
                    <div className="flex items-baseline justify-between">
                      <span className={cn('num text-xl font-bold', toneText[wrTone(p.wr)])}>{pct(p.wr, 0)}</span>
                      <span className="num text-2xs text-fg-dim">
                        {p.wins}W {p.games - p.wins}L · KDA {p.kda.toFixed(1)}
                      </span>
                    </div>
                    <ProgressBar value={p.wr} />
                    <div className="flex items-center justify-between text-2xs">
                      <Tooltip content="Винрейт героя в твоём брекете (OpenDota /heroStats)">
                        <span className="text-fg-dim">
                          Мета <span className={cn('num font-semibold', toneText[wrTone(p.metaWr)])}>{pct(p.metaWr)}</span>
                        </span>
                      </Tooltip>
                      <Tooltip content="Изменение WR героя в пабах за последние дни">
                        <span
                          className={cn(
                            'num flex items-center gap-0.5 font-semibold',
                            p.metaTrend >= 0 ? 'text-win-high' : 'text-win-low',
                          )}
                        >
                          {p.metaTrend >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                          {signed(p.metaTrend)}
                        </span>
                      </Tooltip>
                      <span className="flex gap-0.5" aria-label="последние игры">
                        {p.recent.map((w, j) => (
                          <span key={j} className={cn('h-2 w-1.5 rounded-sm', w ? 'bg-win-high' : 'bg-win-low')} />
                        ))}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {sorted.length > 12 && (
            <div className="mt-4 flex justify-center">
              <button onClick={() => setShowAll((v) => !v)} className="btn-ghost btn-sm">
                {showAll ? (
                  <>
                    <ChevronUp className="h-4 w-4" /> Свернуть до Топ-12
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4" /> Показать всех героев ({sorted.length})
                  </>
                )}
              </button>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
