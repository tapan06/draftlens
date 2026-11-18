import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, LayoutDashboard, MonitorSmartphone, Swords } from 'lucide-react';
import { useHeroes, usePlayer, usePlayerAnalytics } from '@/hooks/useDotaData';
import type { Role } from '@/lib/analytics/roles';
import { pushRecentProfile } from '@/lib/recent';
import { Logo, StudioFooter, SupportAuthorButton } from '@/components/ui/HeroImage';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { ProfileSearch } from '@/components/search/ProfileSearch';
import { PlayerHeader, type MatchLimit } from '@/components/dashboard/PlayerHeader';
import { BestRoleCard } from '@/components/dashboard/BestRoleCard';
import { RoleBreakdown } from '@/components/dashboard/RoleBreakdown';
import { FormCard } from '@/components/dashboard/FormCard';
import { HeroPoolCard } from '@/components/dashboard/HeroPoolCard';
import { PrivateProfileGuide } from '@/components/dashboard/PrivateProfileGuide';
import { DraftAssistant } from '@/components/draft/DraftAssistant';
import { HeroBuildDrawer } from '@/components/build/HeroBuildDrawer';
import { cn } from '@/lib/utils';

export function DashboardPage() {
  const { accountId: rawId } = useParams<{ accountId: string }>();
  const accountId = Number(rawId);

  const [matchLimit, setMatchLimit] = useState<MatchLimit>(100);
  const heroes = useHeroes();
  const { profile, matches } = usePlayer(accountId, matchLimit);
  const analytics = usePlayerAnalytics(matches.data, heroes.index, profile.data?.rank_tier);

  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [buildHero, setBuildHero] = useState<{ heroId: number; role: Role } | null>(null);
  const [compactDraftMode, setCompactDraftMode] = useState(() =>
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('overlay') === '1' : false,
  );

  const draftSectionRef = useRef<HTMLDivElement>(null);

  // Сохраняем профиль в «Недавние» после загрузки
  useEffect(() => {
    const p = profile.data?.profile;
    if (p && p.account_id) {
      pushRecentProfile({
        accountId: p.account_id,
        name: p.personaname ?? `Игрок ${p.account_id}`,
        avatar: p.avatarfull,
      });
    }
  }, [profile.data]);

  // Сбрасываем выбранную вручную роль при смене игрока
  useEffect(() => {
    setSelectedRole(null);
    setBuildHero(null);
  }, [accountId]);

  const activeRole: Role = selectedRole ?? analytics?.best?.role ?? 'offlane';

  const jumpToDraft = (role: Role) => {
    setSelectedRole(role);
    draftSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const isLoading = heroes.isLoading || profile.isLoading || (profile.data?.profile && matches.isLoading && !matches.data);
  const notFound = !profile.isLoading && (!profile.data || !profile.data.profile);
  const isPrivateOrEmpty =
    !isLoading && !notFound && (matches.data?.length === 0 || (profile.data?.profile?.fh_unavailable && !matches.data?.length));

  return (
    <div className="min-h-screen pb-16">
      {/* Верхняя навигационная панель (удобна и на 2-м мониторе) */}
      <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-4">
            <Logo />
            {!isLoading && !notFound && !isPrivateOrEmpty && (
              <div className="hidden items-center gap-1 rounded-lg border border-line bg-surface p-1 sm:flex">
                <button
                  onClick={() => setCompactDraftMode(false)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition',
                    !compactDraftMode ? 'bg-surface-3 text-fg shadow-sm' : 'text-fg-muted hover:text-fg',
                  )}
                >
                  <LayoutDashboard className="h-3.5 w-3.5" /> Полный дашборд
                </button>
                <button
                  onClick={() => setCompactDraftMode(true)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition',
                    compactDraftMode ? 'bg-primary text-white shadow-glow-red' : 'text-fg-muted hover:text-fg',
                  )}
                  title="Скрыть общую статистику и оставить только Драфт-помощник для узкого окна на 2-м мониторе"
                >
                  <MonitorSmartphone className="h-3.5 w-3.5" /> Режим 2-го монитора (Драфт)
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <SupportAuthorButton />
            <ProfileSearch variant="compact" />
          </div>
        </div>
      </header>

      <main className="mx-auto mt-5 max-w-7xl space-y-4 px-4 sm:px-6">
        {/* 1. Состояние загрузки (Skeleton Loaders, пока отвечает OpenDota) */}
        {isLoading && (
          <div className="space-y-4" aria-busy="true" aria-label="Загрузка данных OpenDota">
            <SkeletonCard lines={2} />
            <div className="grid gap-4 lg:grid-cols-12">
              <SkeletonCard lines={5} className="lg:col-span-7" />
              <SkeletonCard lines={5} className="lg:col-span-5" />
            </div>
            <div className="grid gap-4 lg:grid-cols-12">
              <SkeletonCard lines={6} className="lg:col-span-5" />
              <SkeletonCard lines={6} className="lg:col-span-7" />
            </div>
          </div>
        )}

        {/* 2. Ошибка сети или лимита OpenDota */}
        {(heroes.isError || profile.isError) && (
          <div className="card p-6 text-center">
            <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-win-low" />
            <h2 className="text-lg font-bold">Ошибка при обращении к OpenDota API</h2>
            <p className="mt-1 text-fg-muted">
              {((heroes.error ?? profile.error) as Error)?.message ?? 'Проверь подключение и попробуй снова.'}
            </p>
            <Link to="/" className="btn-primary mt-4">
              Вернуться к поиску
            </Link>
          </div>
        )}

        {/* 3. Профиль не найден */}
        {notFound && !profile.isError && (
          <div className="card p-8 text-center">
            <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-win-mid" />
            <h2 className="text-xl font-bold">Игрок с ID {rawId} не найден в OpenDota</h2>
            <p className="mx-auto mt-2 max-w-md text-fg-muted">
              Проверь правильность Steam ID32 / ID64 или убедись, что аккаунт хотя бы раз запускал Dota 2 с открытой
              историей матчей.
            </p>
            <div className="mt-5 flex justify-center gap-3">
              <Link to="/" className="btn-ghost">
                На главную
              </Link>
              <Link to="/player/86745912" className="btn-primary">
                Открыть демо-профиль
              </Link>
            </div>
          </div>
        )}

        {/* 4. Профиль найден, но история матчей скрыта */}
        {!isLoading && profile.data?.profile && isPrivateOrEmpty && (
          <>
            <PlayerHeader
              accountId={accountId}
              player={profile.data}
              analyzed={0}
              matchLimit={matchLimit}
              onMatchLimitChange={setMatchLimit}
              isFetchingMatches={matches.isFetching}
            />
            <PrivateProfileGuide accountId={accountId} />
          </>
        )}

        {/* 5. Основной Bento-дашборд + Интерактивный симулятор драфта */}
        {!isLoading && profile.data?.profile && analytics && heroes.index && !isPrivateOrEmpty && (
          <>
            <PlayerHeader
              accountId={accountId}
              player={profile.data}
              analyzed={analytics.classified.length}
              matchLimit={matchLimit}
              onMatchLimitChange={setMatchLimit}
              isFetchingMatches={matches.isFetching}
            />

            {!compactDraftMode && (
              <>
                <div className="grid gap-4 lg:grid-cols-12">
                  <div className="lg:col-span-7">
                    <BestRoleCard
                      best={analytics.best}
                      totalGames={analytics.classified.length}
                      confidentShare={analytics.confidentShare}
                      onOpenDraft={jumpToDraft}
                    />
                  </div>
                  <div className="lg:col-span-5">
                    <FormCard matches={analytics.recent} heroIndex={heroes.index} />
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-12">
                  <div className="lg:col-span-5">
                    <RoleBreakdown
                      roles={analytics.roles}
                      bestRole={analytics.best?.role}
                      onSelect={jumpToDraft}
                    />
                  </div>
                  <div className="lg:col-span-7">
                    <HeroPoolCard
                      pool={analytics.pool}
                      heroIndex={heroes.index}
                      onOpenHero={(heroId) => {
                        const heroMainRole = analytics.pool.find((p) => p.heroId === heroId)?.mainRole ?? activeRole;
                        setBuildHero({ heroId, role: heroMainRole });
                      }}
                    />
                  </div>
                </div>
              </>
            )}

            {/* Блок драфт-ассистента */}
            <div ref={draftSectionRef} className="scroll-mt-20 pt-2">
              <div className="mb-2 flex items-center justify-between px-1 sm:hidden">
                <span className="card-title text-primary-bright">
                  <Swords className="h-3.5 w-3.5" /> Draft Simulator
                </span>
                <button
                  onClick={() => setCompactDraftMode((v) => !v)}
                  className="text-2xs font-semibold text-accent underline"
                >
                  {compactDraftMode ? 'Показать статистику' : 'Скрыть статистику'}
                </button>
              </div>

              <DraftAssistant
                role={activeRole}
                onRoleChange={setSelectedRole}
                bestRole={analytics.best?.role}
                pool={analytics.pool}
                heroIndex={heroes.index}
                bracket={analytics.bracket}
                onOpenBuild={(heroId, role) => setBuildHero({ heroId, role })}
              />
            </div>

            {/* Выдвижная карточка актуального билда и талантов */}
            <HeroBuildDrawer
              heroId={buildHero?.heroId ?? null}
              role={buildHero?.role ?? activeRole}
              heroIndex={heroes.index}
              poolHero={buildHero ? analytics.pool.find((p) => p.heroId === buildHero.heroId) : undefined}
              onClose={() => setBuildHero(null)}
            />
          </>
        )}
      </main>
      <StudioFooter />
    </div>
  );
}
