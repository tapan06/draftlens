import { ArrowRight, Info, Trophy } from 'lucide-react';
import type { RoleStats } from '@/lib/analytics/roles';
import { ROLE_BY_ID } from '@/lib/analytics/roles';
import { Card } from '@/components/ui/Card';
import { RadialWinrate } from '@/components/ui/Indicators';
import { RoleIcon } from '@/components/ui/RoleIcon';
import { Tooltip } from '@/components/ui/Tooltip';
import { cn, pct, toneText, wrTone } from '@/lib/utils';

function Stat({ label, value, hint, className }: { label: string; value: string; hint?: string; className?: string }) {
  const body = (
    <div className="min-w-0 rounded-lg border border-line bg-surface-2/60 px-3 py-2">
      <div className="text-2xs uppercase tracking-wider text-fg-dim">{label}</div>
      <div className={cn('num mt-0.5 text-lg font-bold leading-tight', className)}>{value}</div>
    </div>
  );
  return hint ? <Tooltip content={hint} className="block">{body}</Tooltip> : body;
}

/** Главный вердикт: «Твоя лучшая роль: Offlane (62% WR за последние 40 игр)». */
export function BestRoleCard({
  best,
  totalGames,
  confidentShare,
  onOpenDraft,
}: {
  best: RoleStats | null;
  totalGames: number;
  confidentShare: number;
  onOpenDraft: (role: RoleStats['role']) => void;
}) {
  if (!best) {
    return (
      <Card title="Лучшая роль" icon={<Trophy className="h-3.5 w-3.5" />} className="h-full">
        <p className="text-fg-muted">Недостаточно матчей для вердикта. Сыграй ещё пару игр и нажми «Обновить».</p>
      </Card>
    );
  }
  const meta = ROLE_BY_ID[best.role];
  const tone = wrTone(best.wr);

  return (
    <Card className="h-full" bodyClassName="p-0 sm:p-0">
      {/* декоративное свечение */}
      <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
      <div className="relative flex flex-col gap-6 p-5 sm:p-6 lg:flex-row lg:items-center">
        <div className="min-w-0 flex-1">
          <div className="card-title text-primary-bright">
            <Trophy className="h-3.5 w-3.5" /> Вердикт по последним {totalGames} матчам
          </div>
          <div className="mt-3 flex items-center gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary to-primary-bright shadow-glow-red">
              <RoleIcon role={best.role} className="h-6 w-6 text-white" />
            </span>
            <div>
              <div className="text-sm text-fg-muted">Твоя лучшая роль</div>
              <div className="text-3xl font-extrabold tracking-tight sm:text-4xl">
                {meta.label} <span className="num text-lg font-semibold text-fg-dim">pos {meta.pos}</span>
              </div>
            </div>
          </div>
          <p className="mt-3 text-base text-fg-muted">
            <span className={cn('num font-bold', toneText[tone])}>{pct(best.wr, 0)} WR</span> за последние{' '}
            <span className="num font-semibold text-fg">{best.games}</span> игр на этой позиции
          </p>

          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="KDA" value={best.kda.toFixed(2)} />
            <Stat label="GPM" value={Math.round(best.gpm).toString()} hint={`Ориентир для роли: ${meta.gpmBase}`} />
            <Stat label="XPM" value={Math.round(best.xpm).toString()} hint={`Ориентир для роли: ${meta.xpmBase}`} />
            <Stat
              label="Impact"
              value={`${best.impact}`}
              className="text-accent"
              hint="0–100: композит винрейта (45%), KDA (25%), GPM (15%) и XPM (15%) относительно ориентиров роли"
            />
          </div>
        </div>

        <div className="flex shrink-0 flex-row items-center gap-5 lg:flex-col">
          <RadialWinrate value={best.wr} size={128} stroke={10} sublabel="винрейт" />
          <button onClick={() => onOpenDraft(best.role)} className="btn-primary">
            Драфт за {meta.label} <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="relative flex items-start gap-2 border-t border-line px-5 py-3 text-2xs text-fg-dim sm:px-6">
        <Info className="mt-px h-3.5 w-3.5 shrink-0" />
        Позиция определена по линии в <span className="num text-fg-muted">{pct(confidentShare, 0)}</span> матчей (распаршенные OpenDota),
        остальное — эвристика по герою и фарму. Turbo и Ability Draft исключены.
      </div>
    </Card>
  );
}
