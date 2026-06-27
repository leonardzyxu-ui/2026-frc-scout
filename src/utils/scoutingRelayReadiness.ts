export type ScoutingRelayProviderKey = 'the-button' | 'directchat';

export interface ScoutingRelayProvider {
  key: ScoutingRelayProviderKey;
  label: string;
  role: string;
  defaultBaseUrl: string;
  healthPath: string;
  expectedService: string;
  detail: string;
}

export interface ScoutingRelayHealthResult {
  key: ScoutingRelayProviderKey;
  ok: boolean;
  status: number | null;
  latencyMs: number;
  service: string;
  checkedAt: number;
  error: string;
}

export const SCOUTING_RELAY_PROVIDERS: ScoutingRelayProvider[] = [
  {
    key: 'the-button',
    label: 'The Button',
    role: 'Primary head-scout alert relay',
    defaultBaseUrl: 'https://the-button.onrender.com',
    healthPath: '/health',
    expectedService: 'the-button',
    detail: 'Fast HTTP/WebSocket path for approved devices to reach the receiver app.'
  },
  {
    key: 'directchat',
    label: 'DirectChat',
    role: 'Backup encrypted chat relay',
    defaultBaseUrl: 'https://directchat-relay.onrender.com',
    healthPath: '/health',
    expectedService: 'directchat-relay',
    detail: 'Encrypted envelope relay with identity and WebSocket endpoints.'
  }
];

const normalizeBaseUrl = (value: string) => value.trim().replace(/\/+$/, '');

export async function checkScoutingRelayHealth(
  provider: ScoutingRelayProvider,
  baseUrl = provider.defaultBaseUrl,
  timeoutMs = 3500
): Promise<ScoutingRelayHealthResult> {
  const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${normalizeBaseUrl(baseUrl)}${provider.healthPath}`, {
      cache: 'no-store',
      signal: controller.signal
    });
    const payload = await response.json().catch(() => ({})) as { service?: string };
    const finishedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const service = payload?.service || 'unknown service';
    const serviceMatches = service === provider.expectedService;
    return {
      key: provider.key,
      ok: response.ok && serviceMatches,
      status: response.status,
      latencyMs: Math.max(0, Math.round(finishedAt - startedAt)),
      service,
      checkedAt: Date.now(),
      error: response.ok
        ? serviceMatches
          ? ''
          : `Wrong service: ${service}`
        : `HTTP ${response.status}`
    };
  } catch (error) {
    const finishedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const message = error instanceof Error && error.name === 'AbortError'
      ? 'Timed out'
      : error instanceof Error
        ? error.message
        : 'Relay check failed';
    return {
      key: provider.key,
      ok: false,
      status: null,
      latencyMs: Math.max(0, Math.round(finishedAt - startedAt)),
      service: 'unreachable',
      checkedAt: Date.now(),
      error: message
    };
  } finally {
    globalThis.clearTimeout(timeout);
  }
}
