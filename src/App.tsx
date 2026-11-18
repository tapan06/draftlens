import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { SearchPage } from '@/pages/SearchPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { SteamCallbackPage } from '@/pages/SteamCallbackPage';
import { id64ToId32, parseSteamOpenIdCallback } from '@/lib/api/steam';

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();

  // Перехватываем возврат со Steam OpenID на любом маршруте (?, /auth/steam и т.д.)
  useEffect(() => {
    if (!location.search.includes('openid')) return;
    const id64 = parseSteamOpenIdCallback(location.search);
    if (id64) {
      const accountId = id64ToId32(id64);
      localStorage.setItem('dl:me', String(accountId));
      navigate(`/player/${accountId}`, { replace: true });
    }
  }, [location.search, navigate]);

  return (
    <Routes>
      <Route path="/" element={<SearchPage />} />
      <Route path="/player/:accountId" element={<DashboardPage />} />
      <Route path="/auth/steam" element={<SteamCallbackPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
