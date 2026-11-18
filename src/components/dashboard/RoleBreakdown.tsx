import { Layers } from 'lucide-react';
import type { Role, RoleStats } from '@/lib/analytics/roles';
import { ROLE_BY_ID } from '@/lib/analytics/roles';
import { Card } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/Indicators';
import { RoleIcon } from '@/components/ui/RoleIcon';
import { Tooltip } from '@/components/ui/Tooltip';
import { cn, pct, toneText, wrTone } from '@/lib/utils';

/** Сравнение 5 позиций: доля игр, WR, KDA, GPM. Клик — открыть драфт за роль. */
export function RoleBreakdown({
  roles,
  bestRole,
  onSelect,
}: {
  roles: RoleStats[];
  bestRole?: Role;
  onSelect: (role: Role) => void;
}) {
  const total = roles.reduce((s, r) => s + r.games, 0) || 1;

  return (
    <Card title="Позиции" icon={<Layers className="h-3.5 w-3.5" />} className="h-full">
      <div className="space-y-1.5">
        {roles.map((r) => {
          const meta = ROLE_BY_ID[r.role];
          const isBest = r.role === bestRole;
          const empty = r.games === 0;
          return (
            <button
              key={r.role}
              onClick={() => onSelect(r.role)}
              className={cn(
                'group grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 rounded-lg border px-3 py-2.5 text-left transition sm:grid-cols-[150px_minmax(0,1fr)_auto]',
                isBest ? 'border-primary/40 bg-primary/[0.07]' : 'border-transparent hover:border-line hover:bg-surface-2',
                empty && 'opacity-50',
              )}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className={cn(
                    'grid h-7 w-7 place-items-center rounded-md ring-1',
                    isBest ? 'bg-primary/20 text-primary-bright ring-primary/40' : 'bg-surface-3 text-fg-muted ring-line',
                  )}
                >
                  <RoleIcon role={r.role} className="h-3.5 w-3.5" />
                </span>
                <div className="leading-tight">
                  <div className="font-semibold">{meta.label}</div>
                  <div className="num text-2xs text-fg-dim">pos {meta.pos}</div>
                </div>
              </div>

              <div className="order-last col-span-2 flex items-center gap-2 sm:order-none sm:col-span-1">
                <Tooltip content={`${r.games} из ${total} матчей`} className="block flex-1">
                  <ProgressBar value={r.games / total} tone="cyan" className="w-full" />
                </Tooltip>
                <span className="num w-9 text-right text-2xs text-fg-dim">{r.games}</span>
              </div>

              <div className="flex items-center justify-end gap-4 text-right">
                <div>
                  <div className={cn('num text-sm font-bold', empty ? 'text-fg-dim' : toneText[wrTone(r.wr)])}>
                    {empty ? '—' : pct(r.wr, 0)}
                  </div>
                  <div className="text-2xs text-fg-dim">WR</div>
                </div>
                <div className="hidden w-10 sm:block">
                  <div className="num text-sm font-semibold">{empty ? '—' : r.kda.toFixed(1)}</div>
                  <div className="text-2xs text-fg-dim">KDA</div>
                </div>
                <div className="hidden w-10 md:block">
                  <div className="num text-sm font-semibold">{empty ? '—' : Math.round(r.gpm)}</div>
                  <div className="text-2xs text-fg-dim">GPM</div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </Card>
  );
}
