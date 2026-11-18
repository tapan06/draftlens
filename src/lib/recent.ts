/** Недавно открытые профили (localStorage) — быстрый повторный вход без ввода ID. */
export interface RecentProfile {
  accountId: number;
  name: string;
  avatar: string | null;
  ts: number;
}

const KEY = 'dl:recentProfiles';

export function getRecentProfiles(): RecentProfile[] {
  try {
    return (JSON.parse(localStorage.getItem(KEY) ?? '[]') as RecentProfile[]).slice(0, 5);
  } catch {
    return [];
  }
}

export function pushRecentProfile(p: Omit<RecentProfile, 'ts'>) {
  const next = [{ ...p, ts: Date.now() }, ...getRecentProfiles().filter((r) => r.accountId !== p.accountId)].slice(0, 5);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* noop */
  }
}
