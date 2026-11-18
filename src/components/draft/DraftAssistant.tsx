import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Grid,
  LayoutList,
  Loader2,
  RotateCcw,
  ScrollText,
  Search,
  Shield,
  Sparkles,
  Star,
  Swords,
  UserPlus,
  X,
  Zap,
} from 'lucide-react';
import type { HeroIndex } from '@/hooks/useDotaData';
import { useEnemyMatchups } from '@/hooks/useDotaData';
import type { PoolHero } from '@/lib/analytics/heroPool';
import { ROLES, ROLE_BY_ID, type Role } from '@/lib/analytics/roles';
import {
  buildCandidates,
  scoreCandidates,
  type PoolMode,
  type Recommendation,
} from '@/lib/analytics/draft';
import type { PrimaryAttr } from '@/lib/api/opendota';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ATTR_META, HeroImage } from '@/components/ui/HeroImage';
import { RoleIcon } from '@/components/ui/RoleIcon';
import { Tooltip } from '@/components/ui/Tooltip';
import { LiveDraftScanner } from '@/components/draft/LiveDraftScanner';
import { cn, pct, signed, toneText, wrTone } from '@/lib/utils';

interface DraftAssistantProps {
  role: Role;
  onRoleChange: (role: Role) => void;
  bestRole?: Role;
  pool: PoolHero[];
  heroIndex: HeroIndex;
  bracket: number | null;
  onOpenBuild: (heroId: number, role: Role) => void;
}

const ATTR_FILTERS: Array<{ id: 'all_attrs' | PrimaryAttr; label: string }> = [
  { id: 'all_attrs', label: 'Все' },
  { id: 'str', label: 'Сила' },
  { id: 'agi', label: 'Ловк.' },
  { id: 'int', label: 'Инт.' },
  { id: 'all', label: 'Унив.' },
];

const POOL_MODES: Array<{ id: PoolMode; label: string; hint: string }> = [
  { id: 'mixed', label: 'Пул + Мета', hint: 'Учитывает и твой наигрыш/винрейт, и силу героев в текущем патче' },
  { id: 'personal', label: 'Личный пул', hint: 'Рекомендует в первую очередь твоих наигранных героев' },
  {
    id: 'meta',
    label: 'Только Мета',
    hint: 'ТОЛЬКО МЕТА: твой личный винрейт полностью игнорируется, расчёт идёт чисто по силе героев в патче, контрпикам и балансу тимы',
  },
];

const COUNT_OPTIONS = [5, 10, 999] as const;

export function DraftAssistant({
  role,
  onRoleChange,
  bestRole,
  pool,
  heroIndex,
  bracket,
  onOpenBuild,
}: DraftAssistantProps) {
  const isOverlayUrl =
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('overlay') === '1';

  const [enemies, setEnemies] = useState<number[]>([]);
  const [allies, setAllies] = useState<number[]>([]);
  const [myHeroId, setMyHeroId] = useState<number | null>(null);
  const [pickSide, setPickSide] = useState<'enemy' | 'ally'>('enemy');
  const [poolMode, setPoolMode] = useState<PoolMode>('mixed');
  const [visibleCount, setVisibleCount] = useState<number>(10);
  const [mobileTab, setMobileTab] = useState<'grid' | 'recs'>('grid');
  // В режиме оверлея или при включении авто-захвата экрана скрываем огромную сетку героев, чтобы всё помещалось на 1 экран без меню
  const [hudFocusMode, setHudFocusMode] = useState<boolean>(isOverlayUrl);
  const [showManualGridInHud, setShowManualGridInHud] = useState<boolean>(false);

  const [query, setQuery] = useState('');
  const [attrFilter, setAttrFilter] = useState<'all_attrs' | PrimaryAttr>('all_attrs');
  const [onlyMyPool, setOnlyMyPool] = useState(false);

  useEffect(() => {
    if (isOverlayUrl) setHudFocusMode(true);
  }, [isOverlayUrl]);

  // Все релевантные кандидаты на выбранную роль (полный охват контрпиков и меты)
  const candidates = useMemo(
    () =>
      buildCandidates({
        role,
        pool,
        heroes: heroIndex.list,
        positions: heroIndex.positions,
        bracket,
        mode: poolMode,
      }),
    [role, pool, heroIndex, bracket, poolMode],
  );

  // Загружаем матчапы ТОЛЬКО выбранных врагов (0–5 запросов вместо 24 на каждую роль)
  const matchups = useEnemyMatchups(enemies);

  // Рекомендации пересчитываются мгновенно при каждом клике по врагу/союзнику или авто-захвате экрана
  const recommendations = useMemo(() => {
    const picked = new Set([...enemies, ...allies, ...(myHeroId ? [myHeroId] : [])]);
    const available = candidates.filter((c) => !picked.has(c.heroId));
    return scoreCandidates(available, {
      role,
      mode: poolMode,
      enemies,
      allies,
      enemyMatchups: matchups.map,
      heroesById: heroIndex.byId,
      synergy: heroIndex.synergy,
      counters: heroIndex.counters,
    });
  }, [candidates, role, poolMode, enemies, allies, myHeroId, matchups.map, heroIndex]);

  const visibleRecs = recommendations.slice(0, visibleCount);
  const top5Mobile = recommendations.slice(0, 5);
  const recByHeroId = useMemo(
    () => new Map<number, Recommendation>(recommendations.map((r) => [r.heroId, r])),
    [recommendations],
  );
  const poolByHeroId = useMemo(() => new Map<number, PoolHero>(pool.map((p) => [p.heroId, p])), [pool]);

  const toggleHeroPick = (heroId: number) => {
    if (myHeroId === heroId) {
      setMyHeroId(null);
      return;
    }
    if (enemies.includes(heroId)) {
      setEnemies((prev) => prev.filter((id) => id !== heroId));
      return;
    }
    if (allies.includes(heroId)) {
      setAllies((prev) => prev.filter((id) => id !== heroId));
      return;
    }
    if (pickSide === 'enemy') {
      if (enemies.length < 5) {
        setEnemies((prev) => [...prev, heroId]);
      } else if (allies.length < 4) {
        setPickSide('ally');
        setAllies((prev) => [...prev, heroId]);
      }
    } else {
      if (allies.length < 4) {
        setAllies((prev) => [...prev, heroId]);
      } else if (enemies.length < 5) {
        setPickSide('enemy');
        setEnemies((prev) => [...prev, heroId]);
      }
    }
  };

  const resetDraft = () => {
    setEnemies([]);
    setAllies([]);
    setMyHeroId(null);
    setPickSide('enemy');
  };

  const filteredHeroes = useMemo(() => {
    const q = query.trim().toLowerCase();
    return heroIndex.list.filter((h) => {
      if (attrFilter !== 'all_attrs' && h.primary_attr !== attrFilter) return false;
      if (onlyMyPool && !poolByHeroId.has(h.id)) return false;
      if (!q) return true;
      return h.localized_name.toLowerCase().includes(q) || h.name.toLowerCase().includes(q);
    });
  }, [heroIndex.list, attrFilter, onlyMyPool, poolByHeroId, query]);

  const hasOtherPicks = enemies.length > 0 || allies.length > 0;
  const hasDraftPicks = hasOtherPicks || myHeroId != null;

  const addEnemyHeroFromScanner = (heroId: number) => {
    if (myHeroId === heroId) setMyHeroId(null);
    setAllies((prev) => prev.filter((id) => id !== heroId));
    setEnemies((prev) => {
      if (prev.includes(heroId)) return prev;
      return prev.length < 5 ? [...prev, heroId] : [...prev.slice(1), heroId];
    });
  };

  const syncDetectedDraft = (newEnemies: number[], newAllies: number[], newMyHeroId: number | null = null) => {
    const cleanEnemies = newEnemies.slice(0, 5);
    const cleanMe = newMyHeroId && !cleanEnemies.includes(newMyHeroId) ? newMyHeroId : null;
    setEnemies(cleanEnemies);
    setMyHeroId(cleanMe);
    setAllies(newAllies.filter((id) => !cleanEnemies.includes(id) && id !== cleanMe).slice(0, 4));
  };

  return (
    <div className="space-y-4">
      <LiveDraftScanner
        heroIndex={heroIndex}
        onAddEnemyHero={addEnemyHeroFromScanner}
        onSyncDetectedDraft={syncDetectedDraft}
        onCaptureStateChange={(active) => {
          if (active) setHudFocusMode(true);
        }}
      />

      {/* Панель управления драфтом: выбор роли, режим пула и слоты врагов/союзников */}
      <Card
        title="Помощник стадии пиков (Draft Simulator)"
        icon={<Swords className="h-3.5 w-3.5 text-primary-bright" />}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {matchups.isLoading && (
              <span className="num flex items-center gap-1.5 text-2xs text-accent">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span className="hidden sm:inline">Матчапы</span> {matchups.loaded}/{matchups.total}
              </span>
            )}
            <button
              type="button"
              onClick={() => setHudFocusMode((v) => !v)}
              className={cn(
                'btn-sm flex items-center gap-1 rounded-lg border text-xs font-semibold transition',
                hudFocusMode
                  ? 'border-win-high/50 bg-win-high/15 text-win-high'
                  : 'border-line bg-surface-2 text-fg-muted hover:text-fg',
              )}
              title="Скрывает большую сетку героев и лишние панели, оставляя на одном экране только пики, баланс команды и советы кого брать"
            >
              <Zap className="h-3.5 w-3.5" />
              {hudFocusMode ? 'Режим «Всё на 1 экране» ВКЛ' : 'Упростить экран (HUD)'}
            </button>
            {hasDraftPicks && (
              <button onClick={resetDraft} className="btn-ghost btn-sm text-fg-muted hover:text-fg">
                <RotateCcw className="h-3.5 w-3.5" /> Сброс
              </button>
            )}
          </div>
        }
      >
        {/* Строка 1: Позиция 1-5 + переключатель источника пула */}
        <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-2xs font-semibold uppercase tracking-wider text-fg-dim">Роль:</span>
            {ROLES.map((r) => {
              const active = r.id === role;
              const isBest = r.id === bestRole;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => onRoleChange(r.id)}
                  className={cn(
                    'touch-manipulation flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition sm:px-3',
                    active
                      ? 'border-primary bg-primary text-white shadow-glow-red'
                      : 'border-line bg-surface-2 text-fg-muted hover:border-line-strong hover:text-fg',
                  )}
                >
                  <RoleIcon role={r.id} className="h-3.5 w-3.5" />
                  <span>{r.label}</span>
                  <span className={cn('num hidden text-2xs sm:inline', active ? 'text-white/80' : 'text-fg-dim')}>
                    pos {r.pos}
                  </span>
                  {isBest && (
                    <span
                      className={cn(
                        'rounded px-1 text-[10px] font-bold',
                        active ? 'bg-white/20 text-white' : 'bg-win-high/15 text-win-high',
                      )}
                    >
                      BEST
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1 self-start rounded-lg border border-line bg-surface-2 p-1 lg:self-auto">
            {POOL_MODES.map((m) => (
              <Tooltip key={m.id} content={m.hint}>
                <button
                  type="button"
                  onClick={() => setPoolMode(m.id)}
                  className={cn(
                    'touch-manipulation rounded-md px-2.5 py-1 text-xs font-semibold transition',
                    poolMode === m.id
                      ? m.id === 'meta'
                        ? 'bg-accent text-black shadow-sm'
                        : 'bg-surface-3 text-fg shadow-sm ring-1 ring-line-strong'
                      : 'text-fg-muted hover:text-fg',
                  )}
                >
                  {m.label}
                </button>
              </Tooltip>
            ))}
          </div>
        </div>

        {/* Строка 2: Слоты пиков Врагов и Союзников */}
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {/* Вражеский пик */}
          <div
            onClick={() => setPickSide('enemy')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && setPickSide('enemy')}
            className={cn(
              'touch-manipulation cursor-pointer rounded-xl border p-3 transition',
              pickSide === 'enemy'
                ? 'border-primary/60 bg-primary/[0.08] shadow-glow-red'
                : 'border-line bg-surface-2/60 hover:border-line-strong',
            )}
          >
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-primary-bright" />
                <span className="text-xs font-bold uppercase tracking-wider text-primary-bright">
                  Враги ({enemies.length}/5)
                </span>
              </div>
              <span className="rounded bg-primary/15 px-2 py-0.5 text-2xs font-semibold text-primary-bright">
                {pickSide === 'enemy' ? 'Выбираем врагов ↓' : 'Нажми для выбора'}
              </span>
            </div>

            <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
              {Array.from({ length: 5 }).map((_, idx) => {
                const heroId = enemies[idx];
                const hero = heroId ? heroIndex.byId.get(heroId) : undefined;
                return hero ? (
                  <button
                    key={hero.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEnemies((prev) => prev.filter((id) => id !== hero.id));
                    }}
                    className="touch-manipulation group relative aspect-[16/10] overflow-hidden rounded-lg border border-primary/50 bg-surface-3 animate-pop-in"
                    title={`Убрать ${hero.localized_name}`}
                  >
                    <HeroImage hero={hero} className="h-full w-full" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                    <span className="absolute bottom-0.5 left-1 right-1 truncate text-left text-[9px] font-semibold text-white sm:text-[10px]">
                      {hero.localized_name}
                    </span>
                    <span className="absolute right-0.5 top-0.5 grid h-4 w-4 place-items-center rounded bg-black/75 text-white">
                      <X className="h-2.5 w-2.5" />
                    </span>
                  </button>
                ) : (
                  <div
                    key={idx}
                    className={cn(
                      'grid aspect-[16/10] place-items-center rounded-lg border border-dashed text-2xs',
                      pickSide === 'enemy' && idx === enemies.length
                        ? 'border-primary/60 bg-primary/10 text-primary-bright'
                        : 'border-line bg-surface/50 text-fg-dim',
                    )}
                  >
                    <Swords className="h-3.5 w-3.5 opacity-60" />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Союзный пик */}
          <div
            onClick={() => setPickSide('ally')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && setPickSide('ally')}
            className={cn(
              'touch-manipulation cursor-pointer rounded-xl border p-3 transition',
              pickSide === 'ally'
                ? 'border-accent/60 bg-accent/[0.08] shadow-glow-cyan'
                : 'border-line bg-surface-2/60 hover:border-line-strong',
            )}
          >
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-accent" />
                <span className="text-xs font-bold uppercase tracking-wider text-accent">
                  Союзники ({allies.length}/4)
                </span>
              </div>
              <span className="rounded bg-accent/15 px-2 py-0.5 text-2xs font-semibold text-accent">
                {pickSide === 'ally' ? 'Выбираем союзников ↓' : 'Нажми для выбора'}
              </span>
            </div>

            <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
              {Array.from({ length: 4 }).map((_, idx) => {
                const heroId = allies[idx];
                const hero = heroId ? heroIndex.byId.get(heroId) : undefined;
                return hero ? (
                  <div
                    key={hero.id}
                    className="group relative aspect-[16/10] overflow-hidden rounded-lg border border-accent/50 bg-surface-3 animate-pop-in"
                  >
                    <HeroImage hero={hero} className="h-full w-full" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setAllies((prev) => prev.filter((id) => id !== hero.id));
                        setMyHeroId(hero.id);
                      }}
                      className="touch-manipulation absolute left-0.5 top-0.5 rounded bg-win-high/90 px-1 py-px text-[8px] font-extrabold text-black transition hover:bg-win-high"
                      title={`Перенести ${hero.localized_name} в слот «ТЫ»`}
                    >
                      Я
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setAllies((prev) => prev.filter((id) => id !== hero.id));
                      }}
                      className="touch-manipulation absolute right-0.5 top-0.5 grid h-4 w-4 place-items-center rounded bg-black/75 text-white hover:bg-win-low"
                      title={`Убрать ${hero.localized_name}`}
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                    <span className="pointer-events-none absolute bottom-0.5 left-1 right-1 truncate text-left text-[9px] font-semibold text-white sm:text-[10px]">
                      {hero.localized_name}
                    </span>
                  </div>
                ) : (
                  <div
                    key={idx}
                    className={cn(
                      'grid aspect-[16/10] place-items-center rounded-lg border border-dashed text-2xs',
                      pickSide === 'ally' && idx === allies.length
                        ? 'border-accent/60 bg-accent/10 text-accent'
                        : 'border-line bg-surface/50 text-fg-dim',
                    )}
                  >
                    <UserPlus className="h-3.5 w-3.5 opacity-60" />
                  </div>
                );
              })}
              {/* 5-й слот — сам игрок */}
              {(() => {
                const myHero = myHeroId ? heroIndex.byId.get(myHeroId) : undefined;
                return myHero ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMyHeroId(null);
                    }}
                    className="touch-manipulation group relative aspect-[16/10] overflow-hidden rounded-lg border-2 border-win-high bg-surface-3 animate-pop-in"
                    title={`Твой пик: ${myHero.localized_name}. Нажми, чтобы очистить`}
                  >
                    <HeroImage hero={myHero} className="h-full w-full" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent" />
                    <span className="absolute left-0.5 top-0.5 rounded bg-win-high px-1 py-px text-[8px] font-extrabold text-black">
                      ТЫ
                    </span>
                    <span className="absolute right-0.5 top-0.5 grid h-4 w-4 place-items-center rounded bg-black/75 text-white">
                      <X className="h-2.5 w-2.5" />
                    </span>
                    <span className="absolute bottom-0.5 left-1 right-1 truncate text-left text-[9px] font-semibold text-white sm:text-[10px]">
                      {myHero.localized_name}
                    </span>
                  </button>
                ) : (
                  <div className="grid aspect-[16/10] place-items-center rounded-lg border border-win-high/40 bg-win-high/10 px-1 text-center text-[9px] font-bold text-win-high sm:text-[10px]">
                    <div>
                      <div>ТЫ</div>
                      <div className="truncate font-normal text-fg-muted">{ROLE_BY_ID[role].label}</div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      </Card>

      {/* ==========================================================================
          РЕЖИМ 1: УПРОЩЁННЫЙ АВТО-HUD (Всё на одном экране без лишних меню)
          Активируется автоматически при включении захвата экрана или в окне Оверлея
         ========================================================================== */}
      {hudFocusMode ? (
        <div className="space-y-3">
          <Card
            title={`Кого пикать прямо сейчас · ${ROLE_BY_ID[role].label}`}
            icon={<Sparkles className="h-3.5 w-3.5 text-win-high" />}
            action={
              <button
                type="button"
                onClick={() => setShowManualGridInHud((v) => !v)}
                className="btn-ghost btn-sm"
              >
                <Grid className="h-3.5 w-3.5" />
                {showManualGridInHud ? 'Скрыть ручную сетку' : 'Открыть ручную сетку героев'}
                {showManualGridInHud ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>
            }
          >
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {recommendations.slice(0, 6).map((rec, idx) => {
                const hero = heroIndex.byId.get(rec.heroId);
                if (!hero) return null;
                const adv = hasOtherPicks ? rec.winAdvantage : rec.total;
                const isPositive = adv >= 0;

                return (
                  <div
                    key={rec.heroId}
                    onClick={() => onOpenBuild(rec.heroId, role)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && onOpenBuild(rec.heroId, role)}
                    className={cn(
                      'card card-interactive touch-manipulation cursor-pointer p-3',
                      idx === 0 && 'border-win-high/60 shadow-glow-green',
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded-lg ring-1 ring-line-strong">
                        <HeroImage hero={hero} className="h-full w-full" />
                        <span
                          className={cn(
                            'num absolute left-1 top-1 rounded px-1.5 py-0.5 text-2xs font-extrabold',
                            idx === 0 ? 'bg-win-high text-black' : 'bg-black/80 text-white',
                          )}
                        >
                          #{idx + 1}
                        </span>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <h3 className="truncate text-sm font-bold">{hero.localized_name}</h3>
                          <span
                            className={cn(
                              'num shrink-0 rounded px-1.5 py-0.5 text-xs font-extrabold',
                              isPositive ? 'bg-win-high/15 text-win-high' : 'bg-win-low/15 text-win-low',
                            )}
                          >
                            {signed(adv, 1)}%
                          </span>
                        </div>

                        <div className="mt-0.5 text-2xs text-fg-muted">
                          Мета: <strong className="num">{pct(rec.metaWr, 1)}</strong>
                          {poolMode !== 'meta' && rec.personalWr != null && (
                            <>
                              {' '}· Твой: <strong className="num">{pct(rec.personalWr, 0)}</strong> ({rec.personalGames})
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-2.5 flex flex-wrap gap-1">
                      {(rec.reasons.length ? rec.reasons.slice(0, 3) : ['Стабильный пик на линию']).map((reason) => (
                        <span
                          key={reason}
                          className={cn(
                            'rounded px-1.5 py-0.5 text-2xs ring-1',
                            reason.startsWith('+')
                              ? 'bg-accent/10 font-medium text-accent ring-accent/25'
                              : 'bg-surface-2 text-fg-muted ring-line',
                          )}
                        >
                          {reason}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {showManualGridInHud && (
            <Card title="Ручной выбор героев" icon={<Shield className="h-3.5 w-3.5 text-accent" />}>
              <div className="mb-3 flex items-center gap-2">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Быстрый поиск героя…"
                  className="input py-1.5 text-xs"
                />
              </div>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
                {filteredHeroes.map((h) => {
                  const isEnemy = enemies.includes(h.id);
                  const isAlly = allies.includes(h.id);
                  const isMe = myHeroId === h.id;
                  return (
                    <button
                      key={h.id}
                      type="button"
                      onClick={() => toggleHeroPick(h.id)}
                      className={cn(
                        'touch-manipulation relative aspect-[16/10] overflow-hidden rounded-lg border text-left',
                        isMe
                          ? 'border-win-high ring-2 ring-win-high'
                          : isEnemy
                            ? 'border-primary ring-2 ring-primary'
                            : isAlly
                              ? 'border-accent ring-2 ring-accent'
                              : 'border-line',
                      )}
                    >
                      <HeroImage hero={h} className="h-full w-full" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                      <span className="absolute bottom-0.5 left-1 right-1 truncate text-[10px] font-semibold text-white">
                        {h.localized_name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </Card>
          )}
        </div>
      ) : (
        /* ==========================================================================
           РЕЖИМ 2: ПОЛНЫЙ ИНТЕРАКТИВНЫЙ РЕЖИМ (Список рекомендаций + Сетка героев)
           ========================================================================== */
        <>
          {/* На мобильных и планшетах (< xl): мгновенная полоса Топ-5 лучших пиков + переключатель Сетка / Список */}
          <div className="space-y-3 xl:hidden">
            <div className="card p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-bold text-fg">
                  <Sparkles className="h-3.5 w-3.5 text-win-high" />
                  Лучшие пики сейчас ({ROLE_BY_ID[role].label})
                </span>
                <span className="text-2xs text-fg-dim">Тап по карточке → билд</span>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {top5Mobile.map((rec, idx) => {
                  const hero = heroIndex.byId.get(rec.heroId);
                  if (!hero) return null;
                  const adv = hasOtherPicks ? rec.winAdvantage : rec.total;
                  return (
                    <button
                      key={rec.heroId}
                      type="button"
                      onClick={() => onOpenBuild(rec.heroId, role)}
                      className={cn(
                        'touch-manipulation flex items-center gap-2 rounded-lg border p-2 text-left transition active:scale-95',
                        idx === 0
                          ? 'border-win-high/60 bg-win-high/10'
                          : 'border-line bg-surface-2 hover:border-line-strong',
                      )}
                    >
                      <div className="relative h-10 w-14 shrink-0 overflow-hidden rounded">
                        <HeroImage hero={hero} className="h-full w-full" />
                        <span className="num absolute left-0.5 top-0.5 rounded bg-black/80 px-1 text-[9px] font-bold text-white">
                          #{idx + 1}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-bold">{hero.localized_name}</div>
                        <div
                          className={cn(
                            'num text-xs font-extrabold',
                            adv >= 0 ? 'text-win-high' : 'text-win-low',
                          )}
                        >
                          {signed(adv, 1)}%
                        </div>
                        <div className="truncate text-[10px] text-fg-dim">
                          {rec.reasons[0] ?? `Мета ${pct(rec.metaWr, 0)}`}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Переключатель на телефоне: Сетка героев (по умолчанию) vs Полный разбор */}
            <div className="grid grid-cols-2 gap-2 rounded-xl border border-line bg-surface p-1">
              <button
                type="button"
                onClick={() => setMobileTab('grid')}
                className={cn(
                  'touch-manipulation flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition',
                  mobileTab === 'grid' ? 'bg-primary text-white shadow-glow-red' : 'text-fg-muted hover:text-fg',
                )}
              >
                <Shield className="h-4 w-4" /> Сетка героев ({filteredHeroes.length})
              </button>
              <button
                type="button"
                onClick={() => setMobileTab('recs')}
                className={cn(
                  'touch-manipulation flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition',
                  mobileTab === 'recs' ? 'bg-accent text-black shadow-glow-cyan' : 'text-fg-muted hover:text-fg',
                )}
              >
                <LayoutList className="h-4 w-4" /> Подробно ({visibleRecs.length})
              </button>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-12">
            {/* Левая колонка (5/12): Рекомендации в реальном времени */}
            <div className={cn('space-y-3 xl:col-span-5', mobileTab === 'grid' ? 'hidden xl:block' : 'block')}>
              <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                <div className="card-title text-fg">
                  <Sparkles className="h-3.5 w-3.5 text-win-high" />
                  Рекомендации ({visibleRecs.length}) · {ROLE_BY_ID[role].label}
                  {poolMode === 'meta' && (
                    <Badge tone="cyan" className="ml-1">
                      Чистая мета
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-1 rounded-lg border border-line bg-surface p-0.5">
                  {COUNT_OPTIONS.map((cnt) => (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() => setVisibleCount(cnt)}
                      className={cn(
                        'num touch-manipulation rounded px-2 py-0.5 text-2xs font-semibold transition',
                        visibleCount === cnt ? 'bg-surface-3 text-fg ring-1 ring-line-strong' : 'text-fg-dim hover:text-fg',
                      )}
                    >
                      {cnt === 999 ? `Все (${recommendations.length})` : `Топ-${cnt}`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2.5 xl:max-h-[680px] xl:overflow-y-auto xl:pr-1">
                {visibleRecs.map((rec, idx) => {
                  const hero = heroIndex.byId.get(rec.heroId);
                  if (!hero) return null;
                  const adv = hasOtherPicks ? rec.winAdvantage : rec.total;
                  const isPositive = adv >= 0;

                  return (
                    <div
                      key={rec.heroId}
                      onClick={() => onOpenBuild(rec.heroId, role)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && onOpenBuild(rec.heroId, role)}
                      className={cn(
                        'card card-interactive touch-manipulation group relative cursor-pointer overflow-hidden p-3.5',
                        idx === 0 && 'border-win-high/50 shadow-glow-green',
                      )}
                    >
                      <div className="flex items-start gap-3.5">
                        {/* Портрет героя + ранг */}
                        <div className="relative h-16 w-28 shrink-0 overflow-hidden rounded-lg ring-1 ring-line-strong">
                          <HeroImage hero={hero} className="h-full w-full transition duration-300 group-hover:scale-105" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />
                          <span
                            className={cn(
                              'num absolute left-1.5 top-1.5 rounded px-1.5 py-0.5 text-2xs font-extrabold',
                              idx === 0 ? 'bg-win-high text-black' : 'bg-black/75 text-white',
                            )}
                          >
                            #{idx + 1}
                          </span>
                          {rec.isSignature && (
                            <span className="absolute bottom-1 left-1.5 flex items-center gap-0.5 text-[10px] font-bold text-win-high">
                              <Star className="h-2.5 w-2.5 fill-current" /> Best Pick
                            </span>
                          )}
                        </div>

                        {/* Название, бейджи и Win Advantage */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <h3 className="truncate text-base font-bold">{hero.localized_name}</h3>
                                <Badge tone={rec.source === 'personal' ? 'green' : 'cyan'}>
                                  {rec.source === 'personal' ? 'Твой пул' : 'Мета'}
                                </Badge>
                              </div>
                              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-2xs text-fg-muted">
                                <span>
                                  Мета патча:{' '}
                                  <strong className={cn('num', toneText[wrTone(rec.metaWr)])}>{pct(rec.metaWr, 1)}</strong>
                                </span>
                                {poolMode !== 'meta' && rec.personalWr != null && (
                                  <span>
                                    Личный:{' '}
                                    <strong className={cn('num', toneText[wrTone(rec.personalWr)])}>
                                      {pct(rec.personalWr, 0)}
                                    </strong>{' '}
                                    <span className="num text-fg-dim">({rec.personalGames} игр)</span>
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Индикатор преимущества */}
                            <div
                              className={cn(
                                'shrink-0 rounded-lg px-2.5 py-1 text-right ring-1',
                                isPositive
                                  ? 'bg-win-high/15 text-win-high ring-win-high/35'
                                  : 'bg-win-low/15 text-win-low ring-win-low/35',
                              )}
                            >
                              <div className="num text-sm font-extrabold leading-tight">{signed(adv, 1)}%</div>
                              <div className="text-[10px] font-medium opacity-80">
                                {hasOtherPicks ? 'Win Adv' : 'Score'}
                              </div>
                            </div>
                          </div>

                          {/* Разбивка против выбранных врагов */}
                          {rec.perEnemy.length > 0 && (
                            <div className="mt-2 flex flex-wrap items-center gap-1.5">
                              {rec.perEnemy.map((pe) => {
                                const enemyHero = heroIndex.byId.get(pe.heroId);
                                return (
                                  <span
                                    key={pe.heroId}
                                    className={cn(
                                      'num inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-2xs font-semibold',
                                      pe.adv >= 0.5
                                        ? 'border-win-high/30 bg-win-high/10 text-win-high'
                                        : pe.adv <= -0.5
                                          ? 'border-win-low/30 bg-win-low/10 text-win-low'
                                          : 'border-line bg-surface-2 text-fg-muted',
                                    )}
                                  >
                                    <HeroImage hero={enemyHero} variant="icon" className="h-3.5 w-3.5 rounded-sm" />
                                    {signed(pe.adv, 1)}%
                                  </span>
                                );
                              })}
                            </div>
                          )}

                          {/* Причины рекомендации + кнопка билда */}
                          <div className="mt-2.5 flex items-center justify-between gap-2">
                            <div className="flex flex-wrap gap-1">
                              {(rec.reasons.length ? rec.reasons.slice(0, 3) : ['Стабильный пик на линию']).map((reason) => (
                                <span
                                  key={reason}
                                  className={cn(
                                    'rounded px-1.5 py-0.5 text-2xs ring-1',
                                    reason.startsWith('+')
                                      ? 'bg-accent/10 font-medium text-accent ring-accent/25'
                                      : 'bg-surface-2 text-fg-muted ring-line',
                                  )}
                                >
                                  {reason}
                                </span>
                              ))}
                            </div>
                            <span className="inline-flex shrink-0 items-center gap-1 text-2xs font-semibold text-accent group-hover:underline">
                              <ScrollText className="h-3 w-3" /> Билд
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Правая колонка (7/12): Интерактивная сетка всех героев */}
            <Card
              title={`Сетка героев (${filteredHeroes.length})`}
              icon={<Shield className="h-3.5 w-3.5 text-accent" />}
              className={cn('xl:col-span-7', mobileTab === 'recs' ? 'hidden xl:block' : 'block')}
              action={
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPickSide('enemy')}
                    className={cn(
                      'touch-manipulation rounded-md px-2 py-1 text-2xs font-bold transition',
                      pickSide === 'enemy' ? 'bg-primary text-white' : 'bg-surface-2 text-fg-muted',
                    )}
                  >
                    + Враг ({enemies.length}/5)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPickSide('ally')}
                    className={cn(
                      'touch-manipulation rounded-md px-2 py-1 text-2xs font-bold transition',
                      pickSide === 'ally' ? 'bg-accent text-black' : 'bg-surface-2 text-fg-muted',
                    )}
                  >
                    + Союз ({allies.length}/4)
                  </button>
                </div>
              }
            >
              {/* Фильтры сетки */}
              <div className="mb-3.5 flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-dim" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Быстрый фильтр героя (Axe, Invoker, Anti-Mage…)"
                    className="input py-2 pl-9 text-xs"
                  />
                  {query && (
                    <button
                      type="button"
                      onClick={() => setQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-fg-dim hover:text-fg"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1">
                  {ATTR_FILTERS.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setAttrFilter(f.id)}
                      className={cn(
                        'touch-manipulation flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-2xs font-semibold transition',
                        attrFilter === f.id
                          ? 'border-accent/50 bg-accent/15 text-accent'
                          : 'border-line bg-surface-2 text-fg-muted hover:text-fg',
                      )}
                    >
                      {f.id !== 'all_attrs' && <span className={cn('h-2 w-2 rounded-full', ATTR_META[f.id].dot)} />}
                      {f.label}
                    </button>
                  ))}

                  <button
                    type="button"
                    onClick={() => setOnlyMyPool((v) => !v)}
                    className={cn(
                      'touch-manipulation flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-2xs font-semibold transition',
                      onlyMyPool
                        ? 'border-win-high/50 bg-win-high/15 text-win-high'
                        : 'border-line bg-surface-2 text-fg-muted hover:text-fg',
                    )}
                  >
                    <Star className="h-3 w-3" /> Мой пул
                  </button>
                </div>
              </div>

              {/* Сетка иконок героев */}
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:max-h-[600px] xl:overflow-y-auto xl:pr-1">
                {filteredHeroes.map((h) => {
                  const isEnemy = enemies.includes(h.id);
                  const isAlly = allies.includes(h.id);
                  const isMe = myHeroId === h.id;
                  const pHero = poolByHeroId.get(h.id);
                  const isSignature = !!pHero?.tags.includes('signature');
                  const rec = recByHeroId.get(h.id);
                  const showAdv = hasOtherPicks && rec && !isEnemy && !isAlly && !isMe;

                  return (
                    <button
                      key={h.id}
                      type="button"
                      onClick={() => toggleHeroPick(h.id)}
                      title={`${h.localized_name}${pHero ? ` · ${pHero.games} игр (${pct(pHero.wr, 0)} WR)` : ''}`}
                      className={cn(
                        'touch-manipulation select-none group relative aspect-[16/10] w-full overflow-hidden rounded-lg border text-left transition duration-150 active:scale-95',
                        isMe && 'border-win-high ring-2 ring-win-high/70',
                        isEnemy && 'border-primary ring-2 ring-primary/60',
                        isAlly && 'border-accent ring-2 ring-accent/60',
                        !isEnemy && !isAlly && !isMe && isSignature && 'border-win-high/70 ring-1 ring-win-high/40',
                        !isEnemy && !isAlly && !isMe && !isSignature && 'border-line hover:border-line-strong',
                      )}
                    >
                      <HeroImage
                        hero={h}
                        className={cn(
                          'h-full w-full transition duration-200 sm:group-hover:scale-110',
                          (isEnemy || isAlly || isMe) && 'opacity-45 grayscale-[40%]',
                        )}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent" />

                      {isSignature && !isEnemy && !isAlly && !isMe && (
                        <span className="absolute left-1 top-1 flex items-center gap-0.5 rounded bg-win-high/90 px-1 py-px text-[9px] font-extrabold text-black">
                          <Star className="h-2 w-2 fill-current" /> BEST
                        </span>
                      )}

                      {showAdv && (
                        <span
                          className={cn(
                            'num absolute right-1 top-1 rounded px-1 py-px text-[9px] font-bold',
                            rec.winAdvantage >= 0 ? 'bg-win-high/90 text-black' : 'bg-win-low/90 text-white',
                          )}
                        >
                          {signed(rec.winAdvantage, 1)}%
                        </span>
                      )}

                      {(isEnemy || isAlly || isMe) && (
                        <span
                          className={cn(
                            'absolute inset-0 grid place-items-center text-[10px] font-extrabold uppercase tracking-wider',
                            isMe ? 'bg-win-high/45 text-white' : isEnemy ? 'bg-primary/45 text-white' : 'bg-accent/45 text-white',
                          )}
                        >
                          <span className="flex items-center gap-0.5 rounded bg-black/75 px-1.5 py-0.5">
                            <Check className="h-3 w-3" /> {isMe ? 'Ты' : isEnemy ? 'Враг' : 'Союз'}
                          </span>
                        </span>
                      )}

                      <span className="absolute bottom-1 left-1.5 right-1.5 truncate text-[11px] font-semibold text-fg sm:text-[10px]">
                        {h.localized_name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
