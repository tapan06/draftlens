import { Activity, Flame } from 'lucide-react';
import type { ClassifiedMatch } from '@/lib/analytics/roles';
import { ROLE_BY_ID } from '@/lib/analytics/roles';
import type { HeroIndex } from '@/hooks/useDotaData';
import { Card } from '@/components/ui/Card';
import { HeroImage } from '@/components/ui/HeroImage';
import { RadialWinrate } from '@/components/ui/Indicators';
import { Tooltip } from '@/components/ui/Tooltip';
import { Badge } from '@/components/ui/Badge';
import { cn, formatDuration, kda, timeAgo } from '@/lib/utils';

/** Общая форма: WR, W/L, средние показатели + лента последних 20 матчей. */
export function FormCard({ matches, heroIndex }: { matches: ClassifiedMatch[]; heroIndex: HeroIndex }) {
  const last = matches.slice(0, 20);
  const wins = matches.filter((m) => m.win).length;
  const wr = matches.length ? wins / matches.length : 0;
  const lastWins = last.filter((m) => m.win).length;
  const avgKda = matches.length
    ? kda(
        matches.reduce((s, m) => s + m.kills, 0),
        matches.reduce((s, m) => s + m.deaths, 0),
        matches.reduce((s, m) => s + m.assists, 0),
      )
    : 0;

  let streak = 0;
  for (const m of matches) {
    if (m.win === matches[0]?.win) streak++;
    else break;
  }
  const streakWin = matches[0]?.win;

  return (
    <Card
      title="Форма"
      icon={<Activity className="h-3.5 w-3.5" />}
      className="h-full"
      action={
        streak >= 2 && (
          <Badge tone={streakWin ? 'green' : 'red'} icon={<Flame className="h-3 w-3" />}>
            {streakWin ? 'Винстрик' : 'Лузстрик'} <span className="num">{streak}</span>
          </Badge>
        )
      }
    >
      <div className="flex items-center gap-5">
        <RadialWinrate value={wr} size={92} stroke={8} sublabel={`${matches.length} игр`} />
        <div className="grid flex-1 grid-cols-2 gap-x-4 gap-y-2">
          <div>
            <div className="text-2xs uppercase tracking-wider text-fg-dim">Победы / поражения</div>
            <div className="num text-base font-bold">
              <span className="text-win-high">{wins}</span>
              <span className="text-fg-dim"> – </span>
              <span className="text-win-low">{matches.length - wins}</span>
            </div>
          </div>
          <div>
            <div className="text-2xs uppercase tracking-wider text-fg-dim">Средний KDA</div>
            <div className="num text-base font-bold">{avgKda.toFixed(2)}</div>
          </div>
          <div className="col-span-2">
            <div className="text-2xs uppercase tracking-wider text-fg-dim">Последние 20</div>
            <div className="num text-base font-bold">
              {lastWins}–{last.length - lastWins}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-10 gap-1">
        {last.map((m) => {
          const hero = heroIndex.byId.get(m.hero_id);
          return (
            <Tooltip
              key={m.match_id}
              className="block"
              content={
                <div className="space-y-0.5">
                  <div className="font-semibold">
                    {hero?.localized_name} · <span className={m.win ? 'text-win-high' : 'text-win-low'}>{m.win ? 'Победа' : 'Поражение'}</span>
                  </div>
                  <div className="num text-fg-muted">
                    {m.kills}/{m.deaths}/{m.assists} · {m.gold_per_min ?? '—'} GPM · {formatDuration(m.duration)}
                  </div>
                  <div className="text-fg-dim">
                    {ROLE_BY_ID[m.role].label}
                    {!m.confident && ' (оценка)'} · {timeAgo(m.start_time)}
                  </div>
                </div>
              }
            >
              <a
                href={`https://www.opendota.com/matches/${m.match_id}`}
                target="_blank"
                rel="noreferrer"
                className="relative block aspect-square overflow-hidden rounded-md ring-1 ring-line transition hover:scale-110 hover:ring-line-strong"
              >
                <HeroImage hero={hero} variant="full" className="h-full w-full scale-150" />
                <span className={cn('absolute inset-x-0 bottom-0 h-1', m.win ? 'bg-win-high' : 'bg-win-low')} />
              </a>
            </Tooltip>
          );
        })}
      </div>
    </Card>
  );
}
