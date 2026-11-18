import { Link } from 'react-router-dom';
import { BarChart3, Crosshair, History, Lock, ScrollText, ShieldCheck, Sparkles, Swords } from 'lucide-react';
import { ProfileSearch } from '@/components/search/ProfileSearch';
import { Logo, StudioFooter, SupportAuthorButton } from '@/components/ui/HeroImage';
import { Badge } from '@/components/ui/Badge';
import { buildSteamLoginUrl } from '@/lib/api/steam';
import { getRecentProfiles } from '@/lib/recent';
import { timeAgo } from '@/lib/utils';

/** Публичный профиль с открытой историей — для мгновенного теста. */
const DEMO_ACCOUNT_ID = 86745912;

const FEATURES = [
  {
    icon: BarChart3,
    title: 'Лучшая роль',
    text: 'Разбираем последние 100 матчей: WR, KDA, GPM/XPM и импакт по каждой позиции 1–5.',
    tone: 'text-accent',
  },
  {
    icon: Swords,
    title: 'Помощник драфта',
    text: 'Кликай вражеские пики — топ-5 героев из твоего пула пересчитываются мгновенно.',
    tone: 'text-primary-bright',
  },
  {
    icon: ScrollText,
    title: 'Билды под патч',
    text: 'Стартовый закуп, предметы по стадиям игры, прокачка и таланты в одной карточке.',
    tone: 'text-win-high',
  },
];

function SteamIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M11.98 0C5.67 0 .5 4.86.02 11.03l6.43 2.66a3.4 3.4 0 0 1 2.14-.6l2.86-4.15v-.06a4.52 4.52 0 1 1 4.52 4.52h-.1l-4.08 2.91c0 .05.01.1.01.16a3.39 3.39 0 0 1-6.72.66L.48 15.3A12 12 0 1 0 11.98 0Zm-4.5 18.2-1.47-.6a2.54 2.54 0 1 0 1.39-3.5l1.52.63a1.87 1.87 0 1 1-1.44 3.46Zm11.4-9.28a3.01 3.01 0 1 0-6.02 0 3.01 3.01 0 0 0 6.02 0Zm-5.27 0a2.26 2.26 0 1 1 4.52 0 2.26 2.26 0 0 1-4.52 0Z" />
    </svg>
  );
}

export function SearchPage() {
  const recent = getRecentProfiles();
  const steamUrl = buildSteamLoginUrl(`${window.location.origin}/auth/steam`);

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* фон: сетка + два мягких свечения в цветах бренда */}
      <div className="bg-grid mask-fade-b pointer-events-none absolute inset-0" />
      <div className="pointer-events-none absolute -left-40 -top-40 h-[520px] w-[520px] rounded-full bg-primary/20 blur-[120px]" />
      <div className="pointer-events-none absolute -right-40 top-60 h-[460px] w-[460px] rounded-full bg-accent/10 blur-[120px]" />

      <header className="relative z-10 mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-5 py-5">
        <Logo />
        <div className="flex flex-wrap items-center gap-2">
          <SupportAuthorButton />
          <Badge tone="green" icon={<ShieldCheck className="h-3 w-3" />}>
            <span className="hidden sm:inline">100% легально · </span>только публичные API
          </Badge>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex max-w-6xl flex-col items-center px-5 pb-12 pt-10 sm:pt-20">
        <div className="mb-6 flex flex-wrap items-center justify-center gap-2">
          <Badge tone="red" icon={<Sparkles className="h-3 w-3" />}>
            Dota 2 · Role & Draft Assistant
          </Badge>
          <Badge tone="cyan">Memory Shards Studio</Badge>
        </div>
        <h1 className="max-w-3xl text-balance text-center text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
          Найди свою роль. <span className="text-gradient-red">Выигрывай драфт.</span>
        </h1>
        <p className="mt-5 max-w-xl text-balance text-center text-base text-fg-muted">
          Аналитика твоих матчей и подсказки по пикам в реальном времени. Открой на втором мониторе, пока ищешь игру.
        </p>

        <div className="mt-10 flex w-full flex-col items-center">
          <ProfileSearch />

          <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-sm">
            <a href={steamUrl} className="btn-ghost">
              <SteamIcon className="h-4 w-4" /> Войти через Steam
            </a>
            <Link to={`/player/${DEMO_ACCOUNT_ID}`} className="btn-ghost">
              <Crosshair className="h-4 w-4 text-primary-bright" /> Демо-профиль
            </Link>
          </div>

          <p className="mt-4 text-center text-2xs text-fg-dim">
            Форматы: <span className="num">86745912</span> · <span className="num">7656119…</span> · steamcommunity.com/profiles/… ·
            ссылки OpenDota / Dotabuff / Stratz · никнейм
          </p>
        </div>

        {recent.length > 0 && (
          <div className="mt-8 flex w-full max-w-2xl flex-wrap items-center justify-center gap-2">
            <span className="card-title mr-1">
              <History className="h-3.5 w-3.5" /> Недавние
            </span>
            {recent.map((r) => (
              <Link
                key={r.accountId}
                to={`/player/${r.accountId}`}
                className="flex items-center gap-2 rounded-full border border-line bg-surface py-1 pl-1 pr-3 text-xs transition hover:border-line-strong hover:bg-surface-2"
                title={timeAgo(r.ts / 1000)}
              >
                {r.avatar && <img src={r.avatar} alt="" className="h-5 w-5 rounded-full" />}
                {r.name}
              </Link>
            ))}
          </div>
        )}

        <section className="mt-20 grid w-full gap-4 md:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, text, tone }, i) => (
            <div key={title} className="card card-interactive p-5 animate-fade-in" style={{ animationDelay: `${i * 70}ms` }}>
              <div className="mb-4 grid h-10 w-10 place-items-center rounded-lg bg-surface-2 ring-1 ring-line">
                <Icon className={`h-5 w-5 ${tone}`} />
              </div>
              <h3 className="font-semibold">{title}</h3>
              <p className="mt-1.5 text-fg-muted">{text}</p>
            </div>
          ))}
          <div className="card flex flex-col gap-4 p-5 md:col-span-3 md:flex-row md:items-center">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-win-high/10 ring-1 ring-win-high/30">
              <Lock className="h-5 w-5 text-win-high" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">Безопасно, как Albion Data Project — только в духе Dota</h3>
              <p className="mt-1 text-fg-muted">
                Никаких программ, оверлеев и доступа к файлам или памяти игры. Только открытые данные OpenDota и Steam Web API.
                Пароль вводится исключительно на steamcommunity.com.
              </p>
            </div>
          </div>
        </section>
      </main>
      <StudioFooter />
    </div>
  );
}
