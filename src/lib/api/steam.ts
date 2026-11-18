/**
 * Steam ID парсинг + Steam OpenID 2.0.
 *
 * Поддерживаемые форматы ввода:
 *   - Steam ID32 (account_id):           86745912
 *   - Steam ID64:                         76561198047011640
 *   - steamcommunity.com/profiles/<ID64>
 *   - steamcommunity.com/openid/id/<ID64> (включая callback URL после входа в Steam)
 *   - steamcommunity.com/id/<vanity>      → поиск по нику / Steam Web API
 *   - [U:1:86745912], STEAM_0:0:43372956
 *   - ссылки OpenDota / Dotabuff / Stratz  (…/players/<ID32>)
 *   - всё остальное трактуем как никнейм → OpenDota /search
 */

const ID64_BASE = 76561197960265728n;

export type ParsedSteamInput =
  | { kind: 'id'; accountId: number }
  | { kind: 'vanity'; vanity: string }
  | { kind: 'name'; query: string }
  | { kind: 'empty' };

export const id64ToId32 = (id64: string): number => Number(BigInt(id64) - ID64_BASE);
export const id32ToId64 = (id32: number): string => (BigInt(id32) + ID64_BASE).toString();

export function parseSteamInput(raw: string): ParsedSteamInput {
  let s = raw.trim();
  if (!s) return { kind: 'empty' };

  try {
    s = decodeURIComponent(s);
  } catch {
    /* оставляем как есть */
  }

  const openid = s.match(/steamcommunity\.com\/openid\/id\/(7656\d{13})/i);
  if (openid) return { kind: 'id', accountId: id64ToId32(openid[1]) };

  const profiles = s.match(/steamcommunity\.com\/profiles\/(7656\d{13})/i);
  if (profiles) return { kind: 'id', accountId: id64ToId32(profiles[1]) };

  const vanity = s.match(/steamcommunity\.com\/id\/([^/?#\s]+)/i);
  if (vanity) return { kind: 'vanity', vanity: vanity[1] };

  const statSite = s.match(/(?:opendota\.com|dotabuff\.com|stratz\.com)\/(?:[a-z]{2}\/)?players?\/(\d+)/i);
  if (statSite) return { kind: 'id', accountId: Number(statSite[1]) };

  const steam3 = s.match(/\[U:1:(\d+)\]/i);
  if (steam3) return { kind: 'id', accountId: Number(steam3[1]) };

  const steam2 = s.match(/^STEAM_[0-5]:([01]):(\d+)$/i);
  if (steam2) return { kind: 'id', accountId: Number(steam2[2]) * 2 + Number(steam2[1]) };

  const anyId64 = s.match(/\b(7656\d{13})\b/);
  if (anyId64) return { kind: 'id', accountId: id64ToId32(anyId64[1]) };

  if (/^\d{1,10}$/.test(s)) return { kind: 'id', accountId: Number(s) };

  return { kind: 'name', query: s };
}

/* ------------------------------- Steam OpenID ------------------------------ */
const OPENID_NS = 'http://specs.openid.net/auth/2.0';

/** URL для редиректа на официальный логин Steam. Пароль вводится только на steamcommunity.com. */
export function buildSteamLoginUrl(returnTo: string, realm: string = window.location.origin): string {
  const params = new URLSearchParams({
    'openid.ns': OPENID_NS,
    'openid.mode': 'checkid_setup',
    'openid.return_to': returnTo,
    'openid.realm': realm,
    'openid.identity': `${OPENID_NS}/identifier_select`,
    'openid.claimed_id': `${OPENID_NS}/identifier_select`,
  });
  return `https://steamcommunity.com/openid/login?${params.toString()}`;
}

/**
 * Достаёт Steam ID64 из ответа OpenID.
 */
export function parseSteamOpenIdCallback(search: string): string | null {
  const params = new URLSearchParams(search);
  const claimed = params.get('openid.claimed_id') ?? params.get('openid.identity') ?? search;
  const m = claimed.match(/steamcommunity\.com\/openid\/id\/(7656\d{13})/i);
  return m ? m[1] : null;
}
