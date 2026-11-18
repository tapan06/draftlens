import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { id64ToId32, parseSteamOpenIdCallback } from '@/lib/api/steam';

/**
 * Возврат со Steam OpenID: /auth/steam?openid.mode=id_res&openid.claimed_id=…
 * В проде этот маршрут должен обрабатывать БЭКЕНД (проверка подписи, выдача сессии) —
 * см. docs/ARCHITECTURE.md → «Steam OpenID backend».
 */
export function SteamCallbackPage() {
  const navigate = useNavigate();
  const [error, setError] = useState(false);

  useEffect(() => {
    const id64 = parseSteamOpenIdCallback(window.location.search);
    if (!id64) {
      setError(true);
      return;
    }
    const accountId = id64ToId32(id64);
    localStorage.setItem('dl:me', String(accountId));
    navigate(`/player/${accountId}`, { replace: true });
  }, [navigate]);

  return (
    <div className="grid min-h-screen place-items-center p-6">
      {error ? (
        <div className="card max-w-md p-6 text-center">
          <AlertTriangle className="mx-auto mb-3 text-win-mid" />
          <h1 className="text-lg font-bold">Не удалось войти через Steam</h1>
          <p className="mt-2 text-fg-muted">Ответ Steam не содержит Steam ID. Попробуй ещё раз или введи ID вручную.</p>
          <Link to="/" className="btn-primary mt-5">
            На главную
          </Link>
        </div>
      ) : (
        <div className="flex items-center gap-3 text-fg-muted">
          <Loader2 className="animate-spin" /> Входим через Steam…
        </div>
      )}
    </div>
  );
}
