import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowRight, Loader2, Search, UserRound } from 'lucide-react';
import { opendota } from '@/lib/api/opendota';
import { parseSteamInput } from '@/lib/api/steam';
import { cn, timeAgo } from '@/lib/utils';

/**
 * Поиск профиля. Принимает ID32 / ID64 / ссылки Steam, OpenDota, Dotabuff, Stratz / никнейм.
 * Числовые ID и ссылки открываются мгновенно, никнейм → OpenDota /search.
 */
export function ProfileSearch({ variant = 'hero' }: { variant?: 'hero' | 'compact' }) {
  const navigate = useNavigate();
  const [value, setValue] = useState('');
  const [nameQuery, setNameQuery] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const search = useQuery({
    queryKey: ['search', nameQuery],
    queryFn: () => opendota.search(nameQuery!),
    enabled: !!nameQuery,
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = parseSteamInput(value);
    setNotice(null);
    switch (parsed.kind) {
      case 'id':
        setNameQuery(null);
        navigate(`/player/${parsed.accountId}`);
        break;
      case 'vanity':
        // Vanity URL (steamcommunity.com/id/name) резолвится только Steam Web API
        // ISteamUser/ResolveVanityURL с ключом → это задача бэкенда (ключ нельзя светить в браузере).
        setNotice('Короткие ссылки /id/… требуют Steam Web API ключа на сервере. Пробуем найти по нику — или вставь ссылку /profiles/7656…');
        setNameQuery(parsed.vanity);
        break;
      case 'name':
        setNameQuery(parsed.query);
        break;
      default:
        break;
    }
  };

  const hero = variant === 'hero';
  const results = search.data?.slice(0, hero ? 6 : 5) ?? [];

  return (
    <div className={cn('relative w-full', hero ? 'max-w-2xl' : 'max-w-sm')}>
      <form
        onSubmit={submit}
        className={cn(
          'group flex items-center gap-2 rounded-xl border border-line bg-surface/80 backdrop-blur transition focus-within:border-accent/50 focus-within:shadow-glow-cyan',
          hero ? 'p-2 pl-4' : 'p-1 pl-3',
        )}
      >
        <Search className={cn('shrink-0 text-fg-dim group-focus-within:text-accent', hero ? 'h-5 w-5' : 'h-4 w-4')} />
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={hero ? 'Steam ID, ссылка на профиль или никнейм' : 'Другой игрок…'}
          className={cn(
            'min-w-0 flex-1 bg-transparent text-fg placeholder:text-fg-dim focus:outline-none',
            hero ? 'py-2 text-base' : 'py-1 text-sm',
          )}
          aria-label="Steam ID или ссылка на профиль"
          spellCheck={false}
        />
        <button type="submit" className={cn('btn-primary', !hero && 'btn-sm')} disabled={!value.trim()}>
          {search.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : hero ? 'Анализировать' : <ArrowRight className="h-4 w-4" />}
          {hero && !search.isFetching && <ArrowRight className="h-4 w-4" />}
        </button>
      </form>

      {notice && (
        <p className="mt-3 flex items-start gap-2 text-xs text-win-mid">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {notice}
        </p>
      )}

      {nameQuery && !search.isFetching && (
        <div
          className={cn(
            'card mt-3 overflow-hidden p-1 animate-fade-in',
            !hero && 'absolute inset-x-0 top-full z-50 shadow-2xl',
          )}
        >
          {search.isError && <p className="p-3 text-xs text-win-low">Поиск недоступен: {(search.error as Error).message}</p>}
          {search.isSuccess && results.length === 0 && (
            <p className="p-3 text-xs text-fg-muted">По нику «{nameQuery}» ничего не найдено. Попробуй Steam ID.</p>
          )}
          {results.map((r) => (
            <button
              key={r.account_id}
              onClick={() => {
                setNameQuery(null);
                navigate(`/player/${r.account_id}`);
              }}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-surface-2"
            >
              {r.avatarfull ? (
                <img src={r.avatarfull} alt="" className="h-8 w-8 rounded-md" />
              ) : (
                <UserRound className="h-8 w-8 rounded-md bg-surface-3 p-1.5 text-fg-dim" />
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{r.personaname}</div>
                <div className="num text-2xs text-fg-dim">
                  ID {r.account_id}
                  {r.last_match_time && ` · играл ${timeAgo(new Date(r.last_match_time).getTime() / 1000)}`}
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-fg-dim" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
