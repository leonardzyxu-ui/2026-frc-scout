import { sanitizeAdminV4TeamNumber } from './adminV4TeamSearch.ts';

export const formatAdminV4MetricValue = (
  value: number | null | undefined,
  digits: number = 2
) => value == null || !Number.isFinite(value) ? '—' : value.toFixed(digits);

export const formatAdminV4PercentMetric = (
  value: number | null | undefined,
  digits: number = 2
) => value == null || !Number.isFinite(value) ? '—' : `${(value * 100).toFixed(digits)}%`;

export const formatAdminV4SignedMetric = (
  value: number | null | undefined,
  digits = 2
) => value == null || !Number.isFinite(value) ? '—' : `${value >= 0 ? '+' : ''}${value.toFixed(digits)}`;

export const formatAdminV4PpaRange = (summary: {
  floor: number | null | undefined;
  expected: number | null | undefined;
  ceiling: number | null | undefined;
}) =>
  `${formatAdminV4MetricValue(summary.floor, 0)} / ${formatAdminV4MetricValue(summary.expected, 0)} / ${formatAdminV4MetricValue(summary.ceiling, 0)}`;

export const stringifyAdminV4WorkbookCell = (value: unknown) => {
  const text = JSON.stringify(value ?? null);
  return text.length > 30000 ? `${text.slice(0, 30000)}... [truncated]` : text;
};

export const formatAdminV4MaybeValue = (value: string | number | null | undefined) =>
  value == null || value === '' ? '—' : String(value);

export const formatAdminV4WorksheetDate = (timestampSeconds: number | null | undefined) => {
  if (!timestampSeconds) return '';
  return new Date(timestampSeconds * 1000).toISOString();
};

export const formatAdminV4LocalTimestamp = (timestamp: number | null | undefined) =>
  timestamp
    ? new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    }).format(new Date(timestamp))
    : '—';

export const getAdminV4FreshnessAge = (
  timestamp: number | null | undefined,
  now = Date.now()
) => {
  if (!timestamp) return 'No source timestamp';
  const ageMs = Math.max(0, now - timestamp);
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (ageMs < minute) return 'Just now';
  if (ageMs < hour) return `${Math.floor(ageMs / minute)} min ago`;
  if (ageMs < day) return `${Math.floor(ageMs / hour)} hr ago`;
  return `${Math.floor(ageMs / day)} day${Math.floor(ageMs / day) === 1 ? '' : 's'} ago`;
};

export const describeAdminV4CachedPayload = (payload: unknown) => {
  if (Array.isArray(payload)) return `${payload.length} rows`;
  if (payload && typeof payload === 'object') return `${Object.keys(payload as Record<string, unknown>).length} keys`;
  if (payload == null) return 'Empty payload';
  return typeof payload;
};

export const downloadAdminV4JsonFile = (filename: string, payload: unknown) => {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const parseAdminV4TeamNumbers = (value: string) =>
  value
    .split(/[\s,]+/)
    .map(team => sanitizeAdminV4TeamNumber(team))
    .filter(Boolean);

export const parseAdminV4QuickTeamEntry = (value: string) => {
  const teams = parseAdminV4TeamNumbers(value);
  const redCount = teams.length <= 6 ? Math.min(3, teams.length) : Math.ceil(teams.length / 2);

  return {
    redTeams: teams.slice(0, redCount),
    blueTeams: teams.slice(redCount)
  };
};
