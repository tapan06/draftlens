import { useState } from 'react';
import { CheckCircle2, EyeOff, Gamepad2, Loader2, RefreshCw, Settings, ShieldCheck } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { opendota } from '@/lib/api/opendota';

const STEPS = [
  {
    icon: Gamepad2,
    title: 'Открой настройки Dota 2',
    text: 'В главном меню нажми на шестерёнку (вверху слева) → вкладка «Опции» → «Социальные» (в новых версиях клиента — раздел «Учётная запись / Социальное»).',
  },
  {
    icon: Settings,
    title: 'Включи «Общедоступная история матчей»',
    text: 'Англ.: «Expose Public Match Data». Это официальная настройка Valve: она разрешает публичным API видеть твои матчи. Ничего больше не открывается.',
  },
  {
    icon: CheckCircle2,
    title: 'Сыграй один матч',
    text: 'Настройка применяется к новым играм. После матча история становится доступна OpenDota.',
  },
  {
    icon: RefreshCw,
    title: 'Нажми «Обновить в OpenDota»',
    text: 'Мы попросим OpenDota перезапросить твою историю. Обычно это занимает 1–5 минут.',
  },
];

/** Красивая инструкция для скрытого профиля / пустой истории. */
export function PrivateProfileGuide({ accountId }: { accountId: number }) {
  const qc = useQueryClient();
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');

  const refresh = async () => {
    setState('loading');
    try {
      await opendota.refreshPlayer(accountId);
      setState('done');
      setTimeout(() => qc.invalidateQueries({ queryKey: ['player', accountId] }), 4000);
    } catch {
      setState('error');
    }
  };

  return (
    <div className="card relative overflow-hidden p-6 animate-fade-in sm:p-8">
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-win-mid/10 blur-3xl" />
      <div className="relative flex flex-col gap-8 lg:flex-row">
        <div className="lg:w-80">
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-win-mid/15 ring-1 ring-win-mid/30">
            <EyeOff className="h-6 w-6 text-win-mid" />
          </span>
          <h2 className="mt-4 text-2xl font-bold tracking-tight">История матчей скрыта</h2>
          <p className="mt-2 text-fg-muted">
            Профиль найден, но OpenDota не видит матчей. Скорее всего, в Dota 2 выключена публичная история — это 30 секунд в
            настройках.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <button onClick={refresh} disabled={state === 'loading'} className="btn-primary">
              {state === 'loading' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Обновить в OpenDota
            </button>
          </div>
          {state === 'done' && <p className="mt-3 text-xs text-win-high">Запрос отправлен — страница обновится автоматически.</p>}
          {state === 'error' && <p className="mt-3 text-xs text-win-low">OpenDota не принял запрос. Попробуй через минуту.</p>}
          <p className="mt-5 flex items-start gap-2 text-2xs text-fg-dim">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-win-high" />
            Мы никогда не просим пароль, Steam Guard или установку программ.
          </p>
        </div>

        <ol className="grid flex-1 gap-3 sm:grid-cols-2">
          {STEPS.map(({ icon: Icon, title, text }, i) => (
            <li key={title} className="rounded-xl border border-line bg-surface-2/60 p-4">
              <div className="flex items-center gap-3">
                <span className="num grid h-7 w-7 place-items-center rounded-md bg-accent/10 text-xs font-bold text-accent ring-1 ring-accent/25">
                  {i + 1}
                </span>
                <Icon className="h-4 w-4 text-fg-muted" />
              </div>
              <h3 className="mt-3 font-semibold">{title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-fg-muted">{text}</p>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
