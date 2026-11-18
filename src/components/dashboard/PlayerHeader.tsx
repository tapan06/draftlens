import { useState } from 'react';
import { ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { opendota, type PlayerResponse } from '@/lib/api/opendota';
import { id32ToId64 } from '@/lib/api/steam';
import { Badge } from '@/components/ui/Badge';
import { Tooltip } from '@/components/ui/Tooltip';
import { cn, rankLabel } from '@/lib/utils';

export const MATCH_LIMIT_OPTIONS = [50, 100, 250, 500, 1000] as const;
export type MatchLimit = (typeof MATCH_LIMIT_OPTIONS)[number];

export function PlayerHeader({
  accountId,
  player,
  analyzed,
  matchLimit,
  onMatchLimitChange,
  isFetchingMatches,
}: {
  accountId: number;
  player: PlayerResponse;
  analyzed?: number;
  matchLimit: MatchLimit;
  onMatchLimitChange: (limit: MatchLimit) => void;
  isFetchingMatches?: boolean;
}) {
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState<string | null>(null);
  const p = player.profile!;
  const tier = player.rank_tier ? Math.floor(player.rank_tier / 10) : 0;

  const refresh = async () => {
    setRefreshing(true);
    setRefreshMsg(null);
    try {
      await opendota.refreshPlayer(accountId);
      setRefreshMsg('Запрос отправлен. Новые матчи появятся через 1–5 минут.');
      await qc.invalidateQueries({ queryKey: ['player', accountId] });
    } catch (e) {
      setRefreshMsg((e as Error).message);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="card flex flex-col gap-4 p-4 animate-fade-in lg:flex-row lg:items-center lg:justify-between sm:p-5">
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <div className="relative shrink-0">
          {p.avatarfull ? (
            <img src={p.avatarfull} alt="" className="h-14 w-14 rounded-xl ring-1 ring-line-strong sm:h-16 sm:w-16" />
          ) : (
            <div className="h-14 w-14 rounded-xl bg-surface-3 sm:h-16 sm:w-16" />
          )}
          {p.plus && (
            <span className="absolute -bottom-1 -right-1 rounded bg-win-mid px-1 text-[9px] font-bold text-black">PLUS</span>
          )}
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">{p.personaname ?? `Игрок ${accountId}`}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <Badge tone="cyan" className="gap-1.5">
              {tier > 0 && (
                <img
                  src={`https://www.opendota.com/assets/images/dota2/rank_icons/rank_icon_${tier}.png`}
                  alt=""
                  className="-my-1 h-4 w-4"
                  onError={(e) => (e.currentTarget.style.display = 'none')}
                />
              )}
              {rankLabel(player.rank_tier)}
              {player.leaderboard_rank && <span className="num">#{player.leaderboard_rank}</span>}
            </Badge>
            <span className="num text-2xs text-fg-dim">ID32 {accountId}</span>
            {analyzed != null && (
              <span className="num inline-flex items-center gap-1 text-2xs text-fg-muted">
                · в анализе: <strong>{analyzed}</strong> матчей
                {isFetchingMatches && <Loader2 className="h-3 w-3 animate-spin text-accent" />}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Выбор глубины выборки матчей + быстрые ссылки */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-lg border border-line bg-surface-2 p-1">
          <span className="px-1.5 text-2xs font-semibold text-fg-dim">Выборка:</span>
          {MATCH_LIMIT_OPTIONS.map((lim) => (
            <button
              key={lim}
              onClick={() => onMatchLimitChange(lim)}
              className={cn(
                'num rounded-md px-2 py-1 text-xs font-semibold transition',
                matchLimit === lim
                  ? 'bg-accent text-black shadow-sm'
                  : 'text-fg-muted hover:bg-surface-3 hover:text-fg',
              )}
              title={`Анализировать последние ${lim} матчей игрока`}
            >
              {lim}
            </button>
          ))}
        </div>

        {[
          { label: 'OpenDota', href: `https://www.opendota.com/players/${accountId}` },
          { label: 'Stratz', href: `https://stratz.com/players/${accountId}` },
          { label: 'Steam', href: p.profileurl ?? `https://steamcommunity.com/profiles/${id32ToId64(accountId)}` },
        ].map((l) => (
          <a key={l.label} href={l.href} target="_blank" rel="noreferrer" className="btn-ghost btn-sm">
            {l.label} <ExternalLink className="h-3 w-3 text-fg-dim" />
          </a>
        ))}
        <Tooltip content={refreshMsg ?? 'Попросить OpenDota подтянуть свежие матчи из Steam'}>
          <button onClick={refresh} disabled={refreshing} className="btn-ghost btn-sm">
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
            Обновить
          </button>
        </Tooltip>
      </div>
    </div>
  );
}
