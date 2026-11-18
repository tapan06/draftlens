/**
 * Двухуровневый кэш для ответов публичных API:
 *   1) память (Map) — мгновенно в рамках сессии;
 *   2) localStorage с TTL — переживает перезагрузку вкладки (для «тяжёлых» и редко
 *      меняющихся данных: heroStats, матчапы, константы предметов).
 * + дедупликация одинаковых запросов «в полёте».
 *
 * Для продакшена: крупные константы (abilities ~1.3 MB) лучше класть в IndexedDB
 * (например, через idb-keyval) или отдавать со своего бэкенда/CDN.
 */

type Entry<T> = { v: T; exp: number };

const PREFIX = 'dl:cache:v1:';
const memory = new Map<string, Entry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

export const TTL = {
  m5: 5 * 60_000,
  m10: 10 * 60_000,
  m30: 30 * 60_000,
  h6: 6 * 3_600_000,
  h12: 12 * 3_600_000,
  h24: 24 * 3_600_000,
} as const;

export interface CacheOptions {
  /** Сохранять ли в localStorage (по умолчанию true). */
  persist?: boolean;
}

function readPersisted<T>(key: string, now: number): Entry<T> | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as Entry<T>;
    if (entry.exp > now) return entry;
    localStorage.removeItem(PREFIX + key);
  } catch {
    /* повреждённая запись или недоступный storage — игнорируем */
  }
  return null;
}

function writePersisted<T>(key: string, entry: Entry<T>) {
  const payload = JSON.stringify(entry);
  try {
    localStorage.setItem(PREFIX + key, payload);
  } catch {
    // Квота переполнена — чистим наш кэш и пробуем ещё раз один раз.
    clearCache();
    try {
      localStorage.setItem(PREFIX + key, payload);
    } catch {
      /* слишком большой объект — остаётся только в памяти */
    }
  }
}

export async function cached<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>,
  { persist = true }: CacheOptions = {},
): Promise<T> {
  const now = Date.now();

  const mem = memory.get(key) as Entry<T> | undefined;
  if (mem && mem.exp > now) return mem.v;

  if (persist) {
    const stored = readPersisted<T>(key, now);
    if (stored) {
      memory.set(key, stored);
      return stored.v;
    }
  }

  const pending = inflight.get(key) as Promise<T> | undefined;
  if (pending) return pending;

  const promise = fetcher()
    .then((v) => {
      const entry: Entry<T> = { v, exp: Date.now() + ttlMs };
      memory.set(key, entry);
      if (persist) writePersisted(key, entry);
      return v;
    })
    .finally(() => inflight.delete(key));

  inflight.set(key, promise);
  return promise;
}

/** Инвалидация по префиксу ключа (например, `player:123` после refresh). */
export function invalidate(prefix: string) {
  for (const k of memory.keys()) if (k.startsWith(prefix)) memory.delete(k);
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith(PREFIX + prefix)) localStorage.removeItem(k);
    }
  } catch {
    /* noop */
  }
}

export function clearCache() {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith(PREFIX)) localStorage.removeItem(k);
    }
  } catch {
    /* noop */
  }
}
