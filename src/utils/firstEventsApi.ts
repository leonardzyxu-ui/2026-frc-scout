import { FirstEventsCredentials, buildFirstEventsAuthHeader, putAdminV2CacheEntry } from './adminV2LocalStore';

const FIRST_API_BASE = 'https://frc-api.firstinspires.org/v3.0';

export const getYearFromEventKey = (eventKey: string) => {
  const match = eventKey.match(/^(\d{4})/);
  return match ? Number(match[1]) : new Date().getFullYear();
};

export const getFirstEventCode = (eventKey: string) => eventKey.replace(/^\d{4}/, '').toUpperCase();

export async function fetchFirstEventsJson<T>(
  credentials: FirstEventsCredentials,
  year: number,
  endpoint: string
): Promise<T> {
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const response = await fetch(`${FIRST_API_BASE}/${year}${normalizedEndpoint}`, {
    headers: {
      Authorization: buildFirstEventsAuthHeader(credentials),
      Accept: 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`FIRST Events API ${response.status}: ${await response.text()}`);
  }

  return (await response.json()) as T;
}

export async function fetchAndCacheFirstEventBundle(credentials: FirstEventsCredentials, eventKey: string) {
  const year = getYearFromEventKey(eventKey);
  const eventCode = getFirstEventCode(eventKey);
  const endpoints = [
    ['event', `/events?eventCode=${encodeURIComponent(eventCode)}`],
    ['teams', `/teams?eventCode=${encodeURIComponent(eventCode)}`],
    ['qual-schedule', `/schedule/${encodeURIComponent(eventCode)}?tournamentLevel=qual`],
    ['practice-schedule', `/schedule/${encodeURIComponent(eventCode)}?tournamentLevel=practice`],
    ['qual-matches', `/matches/${encodeURIComponent(eventCode)}?tournamentLevel=qual`],
    ['playoff-matches', `/matches/${encodeURIComponent(eventCode)}?tournamentLevel=playoff`],
    ['rankings', `/rankings/${encodeURIComponent(eventCode)}`],
    ['alliances', `/alliances/${encodeURIComponent(eventCode)}`],
    ['qual-scores', `/scores/${encodeURIComponent(eventCode)}/qual`]
  ] as const;

  const results: Array<{ key: string; ok: boolean; error?: string }> = [];

  for (const [key, endpoint] of endpoints) {
    try {
      const payload = await fetchFirstEventsJson<unknown>(credentials, year, endpoint);
      await putAdminV2CacheEntry({
        eventKey,
        year,
        source: 'FIRST',
        key,
        payload
      });
      results.push({ key, ok: true });
    } catch (error) {
      results.push({ key, ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  }

  return results;
}
