import React, { useEffect, useMemo, useState } from 'react';
import { Database, Download, RefreshCw, Search, Shield } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { PreMatchTeamProfile, QualificationStatus } from '../types';
import { fetchEventTeamNumbers, fetchPreMatchTeamProfile } from '../utils/preMatchScouting';
import { getCachedPreMatchSheet, recordPreScoutAdminTaskEvidence, setCachedPreMatchSheet } from '../utils/preMatchCache';
import { TBA_API_KEY } from '../config';
import { DEFAULT_EVENT_KEY, getStoredEventKey } from '../utils/sharedEventState';
import { loadTbaApiKey } from '../utils/adminV2LocalStore';
import ScoutWorkflowHeader, { ScoutSignalHandoff } from '../components/scouting/ScoutWorkflowHeader';
import ScoutingMissionPanel from '../components/scouting/ScoutingMissionPanel';
import { buildScoutEvidenceAdminTask, clearScoutTaskHandoff, getScoutTaskHandoff, getScoutTaskReturnPath } from '../utils/scoutTaskHandoff';

type SortField =
  | 'team'
  | 'nickname'
  | 'media'
  | 'awards'
  | 'events'
  | 'districtRank'
  | 'districtPoints'
  | 'qualification';
type PreScoutWorkspaceKey = 'briefing' | 'priorities' | 'sheet' | 'export';

interface MissingInfoItem {
  label: string;
  detail: string;
}

interface SpreadsheetRow {
  profile: PreMatchTeamProfile;
  missingFromTba: MissingInfoItem[];
  manualRequired: MissingInfoItem[];
}

interface GapColumnDefinition {
  columnKey: string;
  header: string;
  itemLabel: string;
}

interface ExportColumnDefinition {
  header: string;
  key: string;
  width: number;
}

const buildSpreadsheetRows = (profiles: PreMatchTeamProfile[]): SpreadsheetRow[] =>
  profiles.map(profile => ({
    profile,
    missingFromTba: buildUnavailableFromTba(profile),
    manualRequired: buildManualOnlyItems(profile.teamNumber)
  }));

const QUALIFICATION_STYLES: Record<QualificationStatus, string> = {
  likely_qualified: 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200',
  likely_not_qualified: 'bg-rose-950/60 border-rose-500/40 text-rose-200',
  unknown: 'bg-amber-950/60 border-amber-500/40 text-amber-200'
};

const QUALIFICATION_LABELS: Record<QualificationStatus, string> = {
  likely_qualified: 'Likely Qualified',
  likely_not_qualified: 'Likely Not Qualified',
  unknown: 'Unknown'
};

const qualificationSortRank: Record<QualificationStatus, number> = {
  likely_qualified: 0,
  unknown: 1,
  likely_not_qualified: 2
};

const TBA_GAP_COLUMNS: GapColumnDefinition[] = [
  { columnKey: 'missing_robot_media', header: 'Missing: Robot Image / Video', itemLabel: 'Robot image / video' },
  { columnKey: 'missing_robot_registry', header: 'Missing: Robot Registry', itemLabel: 'Robot registry' },
  { columnKey: 'missing_season_awards', header: 'Missing: Season Awards', itemLabel: 'Season awards' },
  { columnKey: 'missing_season_results', header: 'Missing: Season Results', itemLabel: 'Season results' },
  { columnKey: 'missing_district_standing', header: 'Missing: District Standing / Points', itemLabel: 'District standing / points' },
  { columnKey: 'missing_district_point_detail', header: 'Missing: District Point Detail', itemLabel: 'District point detail' },
  { columnKey: 'missing_official_champs_flag', header: 'Missing: Official Champs Flag', itemLabel: 'Official Champs flag' }
];

const MANUAL_ONLY_COLUMNS: GapColumnDefinition[] = [
  { columnKey: 'manual_mechanism_quality', header: 'Manual: Mechanism Quality', itemLabel: 'Mechanism quality' },
  { columnKey: 'manual_strategy', header: 'Manual: Strategy', itemLabel: 'Strategy' },
  { columnKey: 'manual_driver_quality', header: 'Manual: Driver Quality', itemLabel: 'Driver quality' },
  { columnKey: 'manual_reliability_details', header: 'Manual: Reliability Details', itemLabel: 'Reliability details' },
  { columnKey: 'manual_pit_photo_specs', header: 'Manual: Pit Photo / Specs', itemLabel: 'Pit photo / specs' }
];

const EXPORT_MANUAL_COLUMNS: ExportColumnDefinition[] = [
  { header: 'Manual Robot Photo', key: 'manualRobotPhoto', width: 22 },
  { header: 'Manual Pit Specs', key: 'manualPitSpecs', width: 22 },
  { header: 'Manual Mechanism Quality', key: 'manualMechanismQuality', width: 24 },
  { header: 'Manual Strategy', key: 'manualStrategy', width: 24 },
  { header: 'Manual Driver Quality', key: 'manualDriverQuality', width: 24 },
  { header: 'Manual Reliability Notes', key: 'manualReliabilityNotes', width: 24 }
];
const labelClass = 'text-xs font-black uppercase tracking-widest text-slate-500';
const inputClass = 'admin-g2-sm border border-slate-800 bg-slate-950 px-4 py-3 text-white outline-none transition-colors focus:border-cyan-500';
const PRE_SCOUT_WORKSPACES: Array<{
  key: PreScoutWorkspaceKey;
  label: string;
  question: string;
}> = [
  {
    key: 'briefing',
    label: 'Briefing',
    question: 'What do we know before local rows exist?'
  },
  {
    key: 'priorities',
    label: 'Pit Priorities',
    question: 'Which teams need human verification first?'
  },
  {
    key: 'sheet',
    label: 'Research Sheet',
    question: 'What public context did TBA provide?'
  },
  {
    key: 'export',
    label: 'Export',
    question: 'How do we hand this to scouts?'
  }
];

function PreScoutWorkspaceNav({
  activeWorkspace,
  onChange,
  counts
}: {
  activeWorkspace: PreScoutWorkspaceKey;
  onChange: (workspace: PreScoutWorkspaceKey) => void;
  counts: Record<PreScoutWorkspaceKey, string>;
}) {
  return (
    <nav className="admin-g2 border border-slate-800 bg-slate-900/70 p-3">
      <div className="grid auto-cols-[minmax(190px,1fr)] grid-flow-col gap-2 overflow-x-auto pb-1 lg:grid-flow-row lg:grid-cols-4 lg:overflow-visible lg:pb-0">
        {PRE_SCOUT_WORKSPACES.map(item => {
          const isActive = activeWorkspace === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onChange(item.key)}
              className={`admin-g2-sm border p-3 text-left transition ${
                isActive
                  ? 'border-violet-300 bg-violet-400/15 text-violet-50 ring-1 ring-violet-300/40'
                  : 'border-slate-800 bg-slate-950/65 text-slate-300 hover:border-slate-700 hover:bg-slate-900'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-black text-white">{item.label}</span>
                <span className="admin-g2-sm border border-white/10 bg-slate-950/65 px-2 py-1 text-[11px] font-black text-violet-100">
                  {counts[item.key]}
                </span>
              </div>
              <div className="mt-2 text-xs font-semibold text-slate-400">{item.question}</div>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function PreScoutFrame({
  title,
  subtitle,
  children
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="admin-g2 border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
      <div className="mb-4">
        <div className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">Pre Scout</div>
        <h2 className="mt-1 text-xl font-black text-white sm:text-2xl">{title}</h2>
        <p className="mt-1 text-sm font-semibold text-slate-400">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

const buildUnavailableFromTba = (profile: PreMatchTeamProfile): MissingInfoItem[] => {
  const items: MissingInfoItem[] = [];

  if (profile.mediaAssets.length === 0) {
    items.push({
      label: 'Robot image / video',
      detail: `TBA has no crowdsourced media for Team ${profile.teamNumber}.`
    });
  }

  if (profile.robotMetadata.length === 0) {
    items.push({
      label: 'Robot registry',
      detail: `No robot registry entry returned for Team ${profile.teamNumber}.`
    });
  }

  if (profile.seasonAwards.length === 0) {
    items.push({
      label: 'Season awards',
      detail: `No awards are currently listed in TBA for Team ${profile.teamNumber}.`
    });
  }

  if (profile.seasonEvents.length === 0) {
    items.push({
      label: 'Season results',
      detail: `No season event results were returned for Team ${profile.teamNumber}.`
    });
  }

  if (!profile.districtStanding) {
    items.push({
      label: 'District standing / points',
      detail: `TBA does not expose district standing here, or this team is likely in the regional model.`
    });
  } else if (
    profile.districtStanding.rank == null &&
    profile.districtStanding.totalPoints == null &&
    profile.districtStanding.eventPoints.every(entry => entry.points == null)
  ) {
    items.push({
      label: 'District point detail',
      detail: `District data exists but usable point totals have not been published.`
    });
  }

  if (profile.qualificationStatus === 'unknown') {
    items.push({
      label: 'Official Champs flag',
      detail: `TBA does not provide a universal official Championship qualification yes/no field.`
    });
  }

  return items;
};

const buildManualOnlyItems = (teamNumber: string): MissingInfoItem[] => [
  {
    label: 'Mechanism quality',
    detail: `Need manual confirmation of how well Team ${teamNumber}'s mechanisms actually work.`
  },
  {
    label: 'Strategy',
    detail: `Need human scouting on how Team ${teamNumber} prefers to play and adapt.`
  },
  {
    label: 'Driver quality',
    detail: `Need manual read on drive quality, pace, and pressure handling.`
  },
  {
    label: 'Reliability details',
    detail: `Need manual notes on browns, partial failures, and match-to-match reliability.`
  },
  {
    label: 'Pit photo / specs',
    detail: `Need scout-captured robot photo and pit-specific hardware details.`
  }
];

const getPitPriorityRows = (rows: SpreadsheetRow[], limit = 8) =>
  [...rows]
    .sort((left, right) => {
      const leftScore = left.missingFromTba.length + (left.profile.qualificationStatus === 'unknown' ? 2 : 0) + (left.profile.mediaAssets.length === 0 ? 2 : 0);
      const rightScore = right.missingFromTba.length + (right.profile.qualificationStatus === 'unknown' ? 2 : 0) + (right.profile.mediaAssets.length === 0 ? 2 : 0);
      if (rightScore !== leftScore) return rightScore - leftScore;
      return Number(left.profile.teamNumber) - Number(right.profile.teamNumber);
    })
    .slice(0, limit);

const compareRows = (a: SpreadsheetRow, b: SpreadsheetRow, sortField: SortField, ascending: boolean) => {
  const direction = ascending ? 1 : -1;
  let result = 0;

  switch (sortField) {
    case 'team':
      result = Number(a.profile.teamNumber) - Number(b.profile.teamNumber);
      break;
    case 'nickname':
      result = a.profile.nickname.localeCompare(b.profile.nickname);
      break;
    case 'media':
      result = a.profile.mediaAssets.length - b.profile.mediaAssets.length;
      break;
    case 'awards':
      result = a.profile.seasonAwards.length - b.profile.seasonAwards.length;
      break;
    case 'events':
      result = a.profile.seasonEvents.length - b.profile.seasonEvents.length;
      break;
    case 'districtRank':
      result = (a.profile.districtStanding?.rank ?? Number.POSITIVE_INFINITY) - (b.profile.districtStanding?.rank ?? Number.POSITIVE_INFINITY);
      break;
    case 'districtPoints':
      result = (a.profile.districtStanding?.totalPoints ?? -1) - (b.profile.districtStanding?.totalPoints ?? -1);
      break;
    case 'qualification':
      result = qualificationSortRank[a.profile.qualificationStatus] - qualificationSortRank[b.profile.qualificationStatus];
      break;
  }

  if (result === 0) {
    result = Number(a.profile.teamNumber) - Number(b.profile.teamNumber);
  }

  return result * direction;
};

const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i] ?? 0);
  }
  return window.btoa(binary);
};

const detectImageExtension = (url: string, contentType: string | null): 'png' | 'jpeg' | 'gif' | null => {
  const normalizedType = (contentType || '').toLowerCase();
  if (normalizedType.includes('png')) return 'png';
  if (normalizedType.includes('jpeg') || normalizedType.includes('jpg')) return 'jpeg';
  if (normalizedType.includes('gif')) return 'gif';

  const normalizedUrl = url.toLowerCase();
  if (normalizedUrl.includes('.png')) return 'png';
  if (normalizedUrl.includes('.gif')) return 'gif';
  if (normalizedUrl.includes('.jpg') || normalizedUrl.includes('.jpeg')) return 'jpeg';

  return null;
};

const getEmbeddableImage = async (profile: PreMatchTeamProfile) => {
  const candidate = profile.mediaAssets.find(asset => asset.kind === 'image' && (asset.directUrl || asset.viewUrl));
  if (!candidate) {
    return null;
  }

  const sourceUrl = candidate.directUrl || candidate.viewUrl;

  try {
    const response = await fetch(sourceUrl, { mode: 'cors' });
    if (!response.ok) {
      return null;
    }

    const extension = detectImageExtension(sourceUrl, response.headers.get('content-type'));
    if (!extension) {
      return null;
    }

    const buffer = await response.arrayBuffer();
    return {
      base64: `data:image/${extension};base64,${arrayBufferToBase64(buffer)}`,
      extension
    };
  } catch (error) {
    console.warn(`Unable to embed image for Team ${profile.teamNumber}:`, error);
    return null;
  }
};

function PreScoutBriefing({
  rows,
  loading,
  showingCachedData,
  cacheLabel
}: {
  rows: SpreadsheetRow[];
  loading: boolean;
  showingCachedData: boolean;
  cacheLabel: string;
}) {
  const coveragePercent = rows.length
    ? Math.round((rows.filter(row => row.profile.mediaAssets.length > 0 || row.profile.robotMetadata.length > 0).length / rows.length) * 100)
    : 0;
  const unknownQualification = rows.filter(row => row.profile.qualificationStatus === 'unknown').length;
  const missingPublicContext = rows.filter(row => row.missingFromTba.length > 0).length;
  const pitPriorityRows = getPitPriorityRows(rows, 4);
  const publicFallbackRows = rows.filter(row => row.profile.mediaAssets.length > 0 || row.profile.robotMetadata.length > 0);
  const thinPpaContextRows = rows.filter(row =>
    row.profile.qualificationStatus === 'unknown' ||
    row.profile.seasonEvents.length === 0 ||
    row.missingFromTba.length >= 3
  );
  const matchScoutWatchRows = [...rows]
    .sort((left, right) => {
      const scoreRow = (row: SpreadsheetRow) =>
        (row.profile.qualificationStatus === 'unknown' ? 3 : 0) +
        (row.profile.seasonEvents.length === 0 ? 2 : 0) +
        (row.profile.mediaAssets.length === 0 ? 1 : 0) +
        (row.profile.robotMetadata.length === 0 ? 1 : 0) +
        (row.profile.seasonAwards.length === 0 ? 1 : 0);
      return scoreRow(right) - scoreRow(left) || Number(left.profile.teamNumber) - Number(right.profile.teamNumber);
    })
    .slice(0, 4);
  const sourceLabel = loading
    ? 'Refreshing live TBA'
    : showingCachedData
      ? `Cache first${cacheLabel ? ` · ${cacheLabel}` : ''}`
      : rows.length
        ? 'Live or refreshed'
        : 'Waiting for event data';

  const cards = [
    {
      label: 'Public Fallback',
      value: rows.length ? `${publicFallbackRows.length}/${rows.length}` : 'No event',
      detail: 'Teams with media or robot registry context before local scouting starts.'
    },
    {
      label: 'Pit Queue',
      value: pitPriorityRows[0]?.profile.teamNumber || String(missingPublicContext),
      detail: pitPriorityRows[0]
        ? `Start with ${pitPriorityRows[0].profile.teamNumber}: ${pitPriorityRows[0].missingFromTba[0]?.label || 'manual verification'}`
        : 'Teams with missing public context should be checked first.'
    },
    {
      label: 'Match Scout Watch',
      value: matchScoutWatchRows[0]?.profile.teamNumber || 'Pending',
      detail: matchScoutWatchRows[0]
        ? 'First local match rows should prove or disprove this thin public context.'
        : 'Load an event before match-watch priorities can be produced.'
    },
    {
      label: 'PPA Guardrail',
      value: rows.length ? `${Math.max(0, rows.length - thinPpaContextRows.length)}/${rows.length}` : sourceLabel,
      detail: rows.length
        ? 'Teams with enough public context to serve as fallback, not final proof.'
        : 'Old cache is shown immediately while new TBA data refreshes.'
    },
    {
      label: 'Source Freshness',
      value: sourceLabel,
      detail: 'Old cache is shown immediately while new TBA data refreshes.'
    }
  ];

  return (
    <section className="admin-g2 border border-violet-400/25 bg-violet-500/10 p-5">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.22em] text-violet-200">Pre Scout Briefing</div>
          <h2 className="mt-1 text-xl font-black text-white">Know what is public, then assign what humans must verify</h2>
        </div>
        <div className="text-sm font-semibold text-violet-50/75">
          Creates public fallback context, pit priorities, and early confidence guardrails.
        </div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {cards.map(card => (
          <div key={card.label} className="admin-g2-sm border border-violet-200/10 bg-slate-950/55 px-3 py-3">
            <div className="text-xs font-black uppercase tracking-wider text-violet-100">{card.label}</div>
            <div className="mt-2 text-lg font-black text-white">{card.value}</div>
            <div className="mt-2 text-xs font-semibold text-slate-300">{card.detail}</div>
          </div>
        ))}
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr_1fr]">
        <div className="admin-g2-sm border border-violet-200/10 bg-slate-950/45 p-4">
          <div className={labelClass}>Pre Scout Prior Map</div>
          <div className="mt-3 text-sm font-semibold leading-relaxed text-slate-300">
            Public context creates the first fallback. Missing context becomes pit priority. Thin context becomes match-scout watchlist. None of it is final PPA until local rows arrive.
          </div>
        </div>
        <div className="admin-g2-sm border border-amber-300/20 bg-amber-400/10 p-4">
          <div className={labelClass}>Verify First</div>
          <div className="mt-3 text-sm font-black text-amber-100">
            {pitPriorityRows[0]
              ? `Pit Scout Team ${pitPriorityRows[0].profile.teamNumber}: ${pitPriorityRows[0].missingFromTba[0]?.label || 'manual robot context'}`
              : 'Load an event, then verify teams with missing robot and public-context data.'}
          </div>
          <div className="mt-2 text-xs font-semibold leading-relaxed text-amber-50/75">
            This is the first question that should leave Pre Scout and become a human scouting task.
          </div>
        </div>
        <div className="admin-g2-sm border border-cyan-300/20 bg-cyan-400/10 p-4">
          <div className={labelClass}>Watch In First Matches</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {matchScoutWatchRows.length > 0 ? matchScoutWatchRows.map(row => (
              <span key={row.profile.teamKey} className="admin-g2-sm border border-cyan-200/10 bg-slate-950/55 px-2 py-1 font-mono text-xs font-black text-cyan-100">
                {row.profile.teamNumber}
              </span>
            )) : (
              <span className="text-sm font-semibold text-slate-400">Waiting for event data.</span>
            )}
          </div>
          <div className="mt-2 text-xs font-semibold leading-relaxed text-cyan-50/75">
            These teams need early local rows before Admin trusts public fallback.
          </div>
        </div>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="admin-g2-sm border border-white/10 bg-slate-950/45 p-4">
          <div className={labelClass}>Used Next</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {['Pit Scout priority', 'first-match expectations', 'judge/demo context', 'missing-data warnings'].map(item => (
              <span key={item} className="admin-g2-sm border border-white/10 bg-slate-900/70 px-2 py-1 text-[11px] font-semibold text-slate-100">
                {item}
              </span>
            ))}
          </div>
        </div>
        <div className="admin-g2-sm border border-white/10 bg-slate-950/45 p-4">
          <div className={labelClass}>First Pit Targets</div>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {pitPriorityRows.length > 0 ? pitPriorityRows.map(row => (
              <div key={row.profile.teamKey} className="admin-g2-sm border border-slate-800 bg-slate-950/70 px-3 py-2">
                <div className="font-mono text-sm font-black text-white">{row.profile.teamNumber}</div>
                <div className="mt-1 text-xs font-semibold text-slate-300">{row.profile.nickname || 'Nickname unavailable'}</div>
                <div className="mt-1 text-[11px] text-amber-100/85">
                  {row.missingFromTba.slice(0, 2).map(item => item.label).join(' · ') || 'Public context mostly present'}
                </div>
              </div>
            )) : (
              <div className="text-sm font-semibold text-slate-400">Load an event to generate pit priorities.</div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export default function PreMatchView({
  isEmbedded = false,
  eventKey: propEventKey,
  onCacheChanged
}: {
  isEmbedded?: boolean;
  eventKey?: string;
  onCacheChanged?: () => void | Promise<void>;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const taskHandoff = useMemo(() => getScoutTaskHandoff('preScout', location.search), [location.search]);
  const taskHandoffKey = taskHandoff
    ? [taskHandoff.teamNumber, taskHandoff.eventKey, taskHandoff.reason].join(':')
    : '';
  const [completedAdminTaskKey, setCompletedAdminTaskKey] = useState('');
  const activeTaskHandoff = taskHandoffKey && taskHandoffKey === completedAdminTaskKey ? null : taskHandoff;
  const [rows, setRows] = useState<SpreadsheetRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');
  const [sortField, setSortField] = useState<SortField>('team');
  const [sortAscending, setSortAscending] = useState(true);
  const [cacheTimestamp, setCacheTimestamp] = useState<number | null>(null);
  const [showingCachedData, setShowingCachedData] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState<'idle' | 'loading' | 'success'>('idle');
  const [taskCaptureStatus, setTaskCaptureStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [taskCaptureMessage, setTaskCaptureMessage] = useState('');
  const [activeWorkspace, setActiveWorkspace] = useState<PreScoutWorkspaceKey>('briefing');

  const eventKey = propEventKey || getStoredEventKey() || DEFAULT_EVENT_KEY;

  const loadEventSheet = async () => {
    setLoading(true);
    setError('');
    let hydratedFromCache = false;

    try {
      if (eventKey === 'TEST') {
        setRows([]);
        setCacheTimestamp(null);
        setShowingCachedData(false);
        setError('Pre Match research is unavailable in TEST mode because it depends on a real TBA event feed.');
        return;
      }

      const cachedSheet = await getCachedPreMatchSheet(eventKey);
      if (cachedSheet && cachedSheet.profiles.length > 0) {
        setRows(buildSpreadsheetRows(cachedSheet.profiles));
        setCacheTimestamp(cachedSheet.cachedAt);
        setShowingCachedData(true);
        hydratedFromCache = true;
      } else {
        setCacheTimestamp(null);
        setShowingCachedData(false);
      }

      const localTbaApiKey = await loadTbaApiKey().catch(() => null);
      const effectiveTbaApiKey = localTbaApiKey || TBA_API_KEY;
      if (!effectiveTbaApiKey) {
        setError(
          hydratedFromCache
            ? 'Showing the IndexedDB cache. Upload a local TBA key in Admin V4 Settings to refresh Pre Scout live.'
            : 'Pre Scout needs a TBA key before it can build public team research. Upload the local API key JSON in Admin V4 Settings.'
        );
        return;
      }

      const teamNumbers = await fetchEventTeamNumbers(eventKey, effectiveTbaApiKey);
      const results = await Promise.allSettled(
        teamNumbers.map(teamNumber => fetchPreMatchTeamProfile(teamNumber, eventKey, effectiveTbaApiKey))
      );

      const profiles = results
        .filter((result): result is PromiseFulfilledResult<PreMatchTeamProfile> => result.status === 'fulfilled')
        .map(result => result.value);
      const nextRows = buildSpreadsheetRows(profiles);

      const rejectedCount = results.filter(result => result.status === 'rejected').length;
      if (nextRows.length === 0) {
        throw new Error('No pre-match profiles could be loaded for this event.');
      }

      setRows(nextRows);
      const cachedAt = await setCachedPreMatchSheet(eventKey, profiles);
      setCacheTimestamp(cachedAt);
      setShowingCachedData(false);
      await onCacheChanged?.();
      if (rejectedCount > 0) {
        setError(`${rejectedCount} team profile${rejectedCount === 1 ? '' : 's'} failed to load from TBA. The rest of the sheet is still available.`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load the pre-match sheet.';
      console.warn('Pre Scout live refresh failed', message);
      if (!hydratedFromCache) {
        setRows([]);
        setShowingCachedData(false);
      } else {
        setShowingCachedData(true);
      }
      setError(hydratedFromCache ? `Showing the IndexedDB cache while live refresh failed. ${message}` : message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadEventSheet();
  }, [eventKey]);

  useEffect(() => {
    if (!activeTaskHandoff?.teamNumber) return;
    setFilter(activeTaskHandoff.teamNumber);
    setActiveWorkspace('sheet');
  }, [activeTaskHandoff, taskHandoffKey]);

  const filteredRows = useMemo(() => {
    const query = filter.trim().toLowerCase();
    const matchingRows = query
      ? rows.filter(({ profile }) =>
          profile.teamNumber.includes(query) ||
          profile.nickname.toLowerCase().includes(query) ||
          profile.location.toLowerCase().includes(query)
        )
      : rows;

    return [...matchingRows].sort((a, b) => compareRows(a, b, sortField, sortAscending));
  }, [filter, rows, sortAscending, sortField]);

  const summary = useMemo(() => {
    const teamsWithMedia = rows.filter(row => row.profile.mediaAssets.length > 0).length;
    const likelyQualified = rows.filter(row => row.profile.qualificationStatus === 'likely_qualified').length;
    const missingMedia = rows.filter(row => row.missingFromTba.some(item => item.label === 'Robot image / video')).length;
    return {
      total: rows.length,
      teamsWithMedia,
      likelyQualified,
      missingMedia
    };
  }, [rows]);

  const priorityRows = useMemo(() => getPitPriorityRows(rows, 8), [rows]);
  const activeTaskRow = useMemo(
    () => activeTaskHandoff?.teamNumber
      ? rows.find(row => row.profile.teamNumber === activeTaskHandoff.teamNumber) || null
      : null,
    [activeTaskHandoff, rows]
  );
  const workspaceCounts = useMemo<Record<PreScoutWorkspaceKey, string>>(() => ({
    briefing: `${summary.total}`,
    priorities: `${priorityRows.length}`,
    sheet: `${filteredRows.length}`,
    export: cacheTimestamp ? 'cached' : 'xlsx'
  }), [cacheTimestamp, filteredRows.length, priorityRows.length, summary.total]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAscending(prev => !prev);
      return;
    }
    setSortField(field);
    setSortAscending(true);
  };

  const handleExportWorkbook = async () => {
    setDownloadStatus('loading');

    try {
      const ExcelJS = await import('exceljs');
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'REBUILT 2026';
      workbook.created = new Date();

      const worksheet = workbook.addWorksheet('Pre Match Sheet', {
        views: [{ state: 'frozen', ySplit: 1, xSplit: 2 }]
      });

      worksheet.columns = [
        { header: 'Team', key: 'teamNumber', width: 10 },
        { header: 'Nickname', key: 'nickname', width: 24 },
        { header: 'Location', key: 'location', width: 24 },
        { header: 'Robot Image', key: 'robotImage', width: 16 },
        { header: 'Media Count', key: 'mediaCount', width: 12 },
        { header: 'Media Labels', key: 'mediaLabels', width: 24 },
        { header: 'Robot Registry Count', key: 'robotRegistryCount', width: 16 },
        { header: 'Robot Registry Names', key: 'robotRegistryNames', width: 24 },
        { header: 'Awards Count', key: 'awardsCount', width: 12 },
        { header: 'Award Names', key: 'awardNames', width: 28 },
        { header: 'Season Event Count', key: 'seasonEventCount', width: 14 },
        { header: 'Season Event Names', key: 'seasonEventNames', width: 32 },
        { header: 'District Rank', key: 'districtRank', width: 12 },
        { header: 'District Points', key: 'districtPoints', width: 14 },
        { header: 'Qualification', key: 'qualification', width: 18 },
        ...EXPORT_MANUAL_COLUMNS
      ];

      worksheet.getRow(1).font = { bold: true, color: { argb: 'FFF8FAFC' } };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0F172A' }
      };
      worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      worksheet.autoFilter = {
        from: 'A1',
        to: worksheet.getRow(1).getCell(worksheet.columns.length).address
      };

      for (const row of filteredRows) {
        const { profile } = row;
        const rowData: Record<string, string | number> = {
          teamNumber: profile.teamNumber,
          nickname: profile.nickname,
          location: profile.location,
          robotImage: '',
          mediaCount: profile.mediaAssets.length,
          mediaLabels: profile.mediaAssets.map(asset => asset.label).join(' | '),
          robotRegistryCount: profile.robotMetadata.length,
          robotRegistryNames: profile.robotMetadata.map(robot => `${robot.year} ${robot.name}`).join(' | '),
          awardsCount: profile.seasonAwards.length,
          awardNames: profile.seasonAwards.map(award => award.name).join(' | '),
          seasonEventCount: profile.seasonEvents.length,
          seasonEventNames: profile.seasonEvents.map(event => event.name).join(' | '),
          districtRank: profile.districtStanding?.rank ?? '',
          districtPoints: profile.districtStanding?.totalPoints ?? '',
          qualification: profile.qualificationStatus === 'unknown' ? '' : QUALIFICATION_LABELS[profile.qualificationStatus],
          manualRobotPhoto: '',
          manualPitSpecs: '',
          manualMechanismQuality: '',
          manualStrategy: '',
          manualDriverQuality: '',
          manualReliabilityNotes: ''
        };

        const excelRow = worksheet.addRow(rowData);
        excelRow.height = 72;
        excelRow.alignment = { vertical: 'top', wrapText: true };

        const image = await getEmbeddableImage(profile);
        if (image) {
          const imageId = workbook.addImage({
            base64: image.base64,
            extension: image.extension
          });

          worksheet.addImage(imageId, {
            tl: { col: 3.15, row: excelRow.number - 0.85 },
            ext: { width: 72, height: 72 }
          });
        }
      }

      worksheet.eachRow((row, rowNumber) => {
        row.eachCell(cell => {
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
          };

          if (rowNumber > 1) {
            cell.alignment = { vertical: 'top', wrapText: true };
          }
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `prematch_sheet_${eventKey}_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setDownloadStatus('success');
      window.setTimeout(() => setDownloadStatus('idle'), 2500);
    } catch (err) {
      console.error('Failed to export Pre Match workbook:', err);
      setError(err instanceof Error ? err.message : 'Failed to export the Pre Match workbook.');
      setDownloadStatus('idle');
    }
  };

  const handleCapturePreScoutTask = async () => {
    if (!activeTaskHandoff?.teamNumber) return;
    const adminTask = buildScoutEvidenceAdminTask(activeTaskHandoff);
    if (!adminTask) {
      setTaskCaptureStatus('error');
      setTaskCaptureMessage('Unable to capture this Pre Scout task because the admin handoff is missing a team.');
      return;
    }

    setTaskCaptureStatus('saving');
    setTaskCaptureMessage('');

    try {
      const row = activeTaskRow;
      const updatedSheet = await recordPreScoutAdminTaskEvidence(eventKey, {
        teamNumber: activeTaskHandoff.teamNumber,
        teamName: activeTaskHandoff.teamName || row?.profile.nickname || '',
        task: adminTask,
        profileAvailable: Boolean(row),
        qualificationStatus: row?.profile.qualificationStatus,
        qualificationReason: row?.profile.qualificationReason,
        missingFromTba: row
          ? row.missingFromTba.map(item => `${item.label}: ${item.detail}`)
          : ['No public profile row is loaded for this team yet.'],
        manualRequired: (row ? row.manualRequired : buildManualOnlyItems(activeTaskHandoff.teamNumber))
          .map(item => `${item.label}: ${item.detail}`)
      });

      if (updatedSheet) {
        setCacheTimestamp(updatedSheet.cachedAt);
      }
      setCompletedAdminTaskKey(taskHandoffKey);
      clearScoutTaskHandoff('preScout');
      await onCacheChanged?.();
      setTaskCaptureStatus('success');
      setTaskCaptureMessage(`Captured Pre Scout admin evidence for Team ${activeTaskHandoff.teamNumber}.`);
      window.setTimeout(() => setTaskCaptureMessage(''), 3000);
    } catch (err) {
      console.error('Failed to capture Pre Scout admin evidence:', err);
      setTaskCaptureStatus('error');
      setTaskCaptureMessage(err instanceof Error ? err.message : 'Failed to capture Pre Scout admin evidence.');
    }
  };

  const cacheLabel = useMemo(() => {
    if (!cacheTimestamp) return '';
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    }).format(cacheTimestamp);
  }, [cacheTimestamp]);

  const renderSortableHeader = (label: string, field: SortField) => (
    <button
      type="button"
      onClick={() => toggleSort(field)}
      className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-white transition-colors"
    >
      {label}
      {sortField === field && <span className="text-[10px] text-cyan-300">{sortAscending ? '▲' : '▼'}</span>}
    </button>
  );

  const dataActionBar = (
    <div className="admin-g2-sm border border-slate-800 bg-slate-950/55 p-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <span className="admin-g2-sm border border-blue-800/50 bg-blue-900/30 px-3 py-1 font-bold tracking-widest text-blue-300">
            {eventKey}
          </span>
          <span className="admin-g2-sm border border-slate-800 bg-slate-900/70 px-3 py-1 font-semibold text-slate-300">
            {summary.total} teams loaded
          </span>
          {cacheTimestamp && (
            <span className="admin-g2-sm inline-flex items-center gap-2 border border-slate-800 bg-slate-900/70 px-3 py-1 font-semibold text-slate-300">
              <Database className="h-4 w-4 text-cyan-300" />
              IndexedDB cache {cacheLabel}
            </span>
          )}
        </div>
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative min-w-[280px]">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder="Filter by team, nickname, or location"
              className={`${inputClass} w-full pl-12 pr-4`}
            />
          </div>
          <button
            onClick={() => void handleExportWorkbook()}
            disabled={filteredRows.length === 0 || downloadStatus === 'loading'}
            className={`admin-g2-sm inline-flex items-center justify-center gap-2 px-5 py-3 font-bold transition-colors disabled:opacity-50 ${
              downloadStatus === 'success'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-800 text-slate-100 hover:bg-slate-700'
            }`}
          >
            <Download className="h-4 w-4" />
            {downloadStatus === 'loading'
              ? 'BUILDING XLSX'
              : downloadStatus === 'success'
                ? 'XLSX EXPORTED'
                : 'EXPORT XLSX'}
          </button>
          <button
            onClick={() => void loadEventSheet()}
            disabled={loading}
            className="admin-g2-sm inline-flex items-center justify-center gap-2 bg-cyan-600 px-5 py-3 font-bold text-white transition-colors hover:bg-cyan-500 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            REFRESH SHEET
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className={isEmbedded ? 'pb-24' : 'min-h-screen bg-slate-950 text-slate-200 p-4 md:p-8 font-sans pb-24'}>
      <div className={isEmbedded ? 'space-y-8' : 'max-w-[1400px] mx-auto space-y-8'}>
        {!isEmbedded && (
          <>
            <ScoutWorkflowHeader
              missionKey="preScout"
              title="Pre Scout"
              subtitle="Build the event spreadsheet, find public context, and expose the gaps pit and match scouts must verify."
              handoff={activeTaskHandoff}
              onBack={() => navigate(getScoutTaskReturnPath(activeTaskHandoff ?? taskHandoff))}
              metric={(
                <div className="admin-g2-sm hidden border border-violet-400/30 bg-violet-500/10 px-4 py-3 text-right sm:block">
                  <div className="text-xs font-black uppercase tracking-widest text-violet-200">{eventKey}</div>
                  <div className="mt-1 text-2xl font-black text-white">{summary.total} teams</div>
                </div>
              )}
            />
            <ScoutingMissionPanel missionKey="preScout" compact />
          </>
        )}

        {activeTaskHandoff && (
          <div className="admin-g2 border border-violet-400/30 bg-violet-500/10 p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.2em] text-violet-200">Admin Pre Scout Task</div>
                <h3 className="mt-1 text-xl font-black text-white">Return public-context evidence for Team {activeTaskHandoff.teamNumber}</h3>
                <p className="mt-2 max-w-3xl text-sm font-semibold text-violet-50/75">
                  This records the visible TBA/public-context gaps against the admin task, so Data can show Pre Scout as returned evidence instead of an untracked viewing step.
                </p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-violet-50/80">
                  <span className="admin-g2-sm border border-white/10 bg-slate-950/35 px-2 py-1">{activeTaskHandoff.reason || 'public context'}</span>
                  <span className="admin-g2-sm border border-white/10 bg-slate-950/35 px-2 py-1">
                    {activeTaskRow ? `${activeTaskRow.missingFromTba.length} TBA gaps` : 'profile row not loaded'}
                  </span>
                  {activeTaskHandoff.ppa?.coverage && (
                    <span className="admin-g2-sm border border-white/10 bg-slate-950/35 px-2 py-1">{activeTaskHandoff.ppa.coverage}</span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => void handleCapturePreScoutTask()}
                disabled={taskCaptureStatus === 'saving'}
                className="admin-g2-sm inline-flex shrink-0 items-center justify-center gap-2 bg-violet-500 px-5 py-3 font-black text-white shadow-lg shadow-violet-950/25 transition-colors hover:bg-violet-400 disabled:opacity-50"
              >
                <Shield className="h-4 w-4" />
                {taskCaptureStatus === 'saving' ? 'CAPTURING...' : 'CAPTURE PRE SCOUT EVIDENCE'}
              </button>
            </div>
          </div>
        )}

        {taskCaptureMessage && (
          <div className={`admin-g2-sm border px-4 py-3 text-sm font-bold ${
            taskCaptureStatus === 'error'
              ? 'border-rose-500/40 bg-rose-500/10 text-rose-100'
              : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100'
          }`}>
            {taskCaptureMessage}
          </div>
        )}

        <PreScoutWorkspaceNav activeWorkspace={activeWorkspace} onChange={setActiveWorkspace} counts={workspaceCounts} />

        {eventKey === 'TEST' && (
          <div className="admin-g2 border border-amber-500/50 bg-amber-900/20 p-5 text-center font-medium text-amber-300">
            Pre Match research is unavailable in TEST mode because it depends on a real TBA event feed.
          </div>
        )}

        {error && (
          <div className="admin-g2 border border-red-500/50 bg-red-900/20 p-6 text-center font-medium text-red-300">
            {error}
          </div>
        )}

        {(showingCachedData || loading) && eventKey !== 'TEST' && (
          <div className="admin-g2-sm border border-cyan-500/20 bg-cyan-950/20 px-4 py-3 text-sm text-cyan-100">
            {showingCachedData
              ? 'Showing the IndexedDB cache immediately while the newest TBA data refreshes in the background.'
              : 'Refreshing the live TBA sheet now.'}
          </div>
        )}

        {activeWorkspace === 'briefing' && (
          <>
            <PreScoutBriefing rows={rows} loading={loading} showingCachedData={showingCachedData} cacheLabel={cacheLabel} />
            <div className="mt-4 grid grid-cols-2 gap-4 xl:grid-cols-4">
              <div className="admin-g2-sm border border-slate-800 bg-slate-950/55 p-5">
                <div className={labelClass}>Teams In Sheet</div>
                <div className="mt-2 text-3xl font-black text-white">{summary.total}</div>
              </div>
              <div className="admin-g2-sm border border-slate-800 bg-slate-950/55 p-5">
                <div className={labelClass}>Teams With Media</div>
                <div className="mt-2 text-3xl font-black text-blue-300">{summary.teamsWithMedia}</div>
              </div>
              <div className="admin-g2-sm border border-slate-800 bg-slate-950/55 p-5">
                <div className={labelClass}>Likely Qualified</div>
                <div className="mt-2 text-3xl font-black text-emerald-300">{summary.likelyQualified}</div>
              </div>
              <div className="admin-g2-sm border border-slate-800 bg-slate-950/55 p-5">
                <div className={labelClass}>Missing Media</div>
                <div className="mt-2 text-3xl font-black text-amber-300">{summary.missingMedia}</div>
              </div>
            </div>
          </>
        )}

        {activeWorkspace === 'priorities' && (
          <PreScoutFrame
            title="Pit Priority Queue"
            subtitle="These teams need human verification first because public context is thin, ambiguous, or missing."
          >
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {priorityRows.length > 0 ? priorityRows.map(row => (
                <div key={row.profile.teamKey} className="admin-g2-sm border border-slate-800 bg-slate-950/65 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-mono text-lg font-black text-white">{row.profile.teamNumber}</div>
                      <div className="mt-1 text-sm font-bold text-slate-200">{row.profile.nickname || 'Nickname unavailable'}</div>
                    </div>
                    <div className={`admin-g2-sm border px-2 py-1 text-[10px] font-black uppercase tracking-wider ${QUALIFICATION_STYLES[row.profile.qualificationStatus]}`}>
                      {QUALIFICATION_LABELS[row.profile.qualificationStatus]}
                    </div>
                  </div>
                  <div className="mt-3 space-y-2">
                    {row.missingFromTba.slice(0, 3).map(item => (
                      <div key={item.label} className="admin-g2-sm border border-amber-500/20 bg-amber-950/25 px-3 py-2">
                        <div className="text-xs font-black text-amber-100">{item.label}</div>
                        <div className="mt-1 text-[11px] text-amber-100/75">{item.detail}</div>
                      </div>
                    ))}
                    {row.missingFromTba.length === 0 && (
                      <div className="text-xs font-semibold text-slate-400">Public context mostly present. Use Pit Scout for mechanism/reliability confirmation.</div>
                    )}
                  </div>
                </div>
              )) : (
                <div className="admin-g2-sm border border-slate-800 bg-slate-950/65 p-6 text-sm font-semibold text-slate-400">
                  Load an event to generate a priority queue.
                </div>
              )}
            </div>
          </PreScoutFrame>
        )}

        {activeWorkspace === 'export' && (
          <PreScoutFrame
            title="Export And Refresh"
            subtitle="Keep the event sheet fresh, then hand scouts a workbook with public context and manual verification columns."
          >
            <ScoutSignalHandoff missionKey="preScout" />
            {dataActionBar}
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div className="admin-g2-sm border border-slate-800 bg-slate-950/55 p-4">
                <div className={labelClass}>Workbook Includes</div>
                <div className="mt-3 space-y-2 text-sm font-semibold text-slate-300">
                  <div>Public TBA media, robot registry, awards, event results</div>
                  <div>District rank/points and qualification estimate</div>
                  <div>Manual verification columns for pit and strategy notes</div>
                </div>
              </div>
              <div className="admin-g2-sm border border-slate-800 bg-slate-950/55 p-4">
                <div className={labelClass}>Model Use</div>
                <div className="mt-3 text-sm font-semibold text-slate-300">
                  This creates the public fallback and tells PPA where confidence is thin before local scouting rows arrive.
                </div>
              </div>
              <div className="admin-g2-sm border border-slate-800 bg-slate-950/55 p-4">
                <div className={labelClass}>Source State</div>
                <div className="mt-3 text-sm font-semibold text-slate-300">
                  {loading
                    ? 'Refreshing live TBA now.'
                    : cacheTimestamp
                      ? `IndexedDB cache from ${cacheLabel}.`
                      : 'No local pre-match cache yet.'}
                </div>
              </div>
            </div>
          </PreScoutFrame>
        )}

        {activeWorkspace === 'sheet' && (
          <PreScoutFrame
            title="Research Sheet"
            subtitle="Use this when you need the full row-by-row public context. Sort columns and filter by team, nickname, or location."
          >
        {dataActionBar}
        <div className="admin-g2 mt-4 overflow-hidden border border-slate-800 bg-slate-900/50">
          <div className="p-5 border-b border-slate-800 flex items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-black text-white">Event Pre-Match Spreadsheet</h3>
              <p className="text-sm text-slate-400 mt-1">
                Scan this list to see what TBA already gives us and what still needs human scouting.
              </p>
            </div>
            {loading && <div className="text-sm font-bold text-cyan-300">Loading team profiles…</div>}
          </div>
          <div className="overflow-x-auto">
            <table className="admin-sticky-table w-full min-w-[1600px] text-left">
              <thead className="bg-slate-950/80">
                <tr>
                  <th className="px-4 py-3">{renderSortableHeader('Team', 'team')}</th>
                  <th className="px-4 py-3">{renderSortableHeader('Nickname', 'nickname')}</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">{renderSortableHeader('Media', 'media')}</th>
                  <th className="px-4 py-3">Robot Registry</th>
                  <th className="px-4 py-3">{renderSortableHeader('Awards', 'awards')}</th>
                  <th className="px-4 py-3">{renderSortableHeader('Season Events', 'events')}</th>
                  <th className="px-4 py-3">{renderSortableHeader('District Rank', 'districtRank')}</th>
                  <th className="px-4 py-3">{renderSortableHeader('District Points', 'districtPoints')}</th>
                  <th className="px-4 py-3">{renderSortableHeader('Qualification', 'qualification')}</th>
                  <th className="px-4 py-3">Unavailable From TBA</th>
                  <th className="px-4 py-3">Manual Scout Required</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredRows.map(({ profile, missingFromTba, manualRequired }) => (
                  <tr key={profile.teamKey} className="align-top">
                    <td className="px-4 py-4">
                      <div className="font-black text-white">{profile.teamNumber}</div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="font-bold text-white">{profile.nickname}</div>
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-300">{profile.location}</td>
                    <td className="px-4 py-4">
                      <div className="text-sm font-bold text-white">{profile.mediaAssets.length}</div>
                      {profile.mediaAssets.length > 0 ? (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {profile.mediaAssets.slice(0, 2).map(asset => (
                            <a
                              key={asset.id}
                              href={asset.viewUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="admin-g2-sm inline-flex items-center gap-1 border border-slate-700 bg-slate-950/70 px-2 py-1 text-[11px] font-semibold text-blue-200 hover:border-blue-500/40"
                            >
                              {asset.label}
                            </a>
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs text-slate-500 mt-2">No media</div>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      {profile.robotMetadata.length > 0 ? (
                        <div className="space-y-1">
                          {profile.robotMetadata.slice(0, 2).map(robot => (
                            <div key={robot.key} className="text-sm text-slate-200">
                              {robot.name}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-sm text-slate-500">Missing</div>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="font-bold text-white">{profile.seasonAwards.length}</div>
                      {profile.seasonAwards.length > 0 && (
                        <div className="text-xs text-slate-400 mt-2">
                          {profile.seasonAwards.slice(0, 2).map(award => award.name).join(' • ')}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="font-bold text-white">{profile.seasonEvents.length}</div>
                      {profile.seasonEvents.length > 0 && (
                        <div className="text-xs text-slate-400 mt-2">
                          {profile.seasonEvents.slice(0, 2).map(event => event.name).join(' • ')}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-300">
                      {profile.districtStanding?.rank != null ? `#${profile.districtStanding.rank}` : '--'}
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-300">
                      {profile.districtStanding?.totalPoints != null ? profile.districtStanding.totalPoints : '--'}
                    </td>
                    <td className="px-4 py-4">
                      <div className={`admin-g2-sm inline-flex items-center gap-2 border px-3 py-1 text-xs font-black uppercase tracking-widest ${QUALIFICATION_STYLES[profile.qualificationStatus]}`}>
                        <Shield className="w-3.5 h-3.5" />
                        {QUALIFICATION_LABELS[profile.qualificationStatus]}
                      </div>
                      <div className="text-xs text-slate-400 mt-2 max-w-[240px]">
                        {profile.qualificationReason}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      {missingFromTba.length > 0 ? (
                        <div className="space-y-2">
                          {missingFromTba.map(item => (
                            <div key={item.label} className="admin-g2-sm border border-amber-500/20 bg-amber-950/20 px-3 py-2">
                              <div className="text-xs font-black text-amber-100">{item.label}</div>
                              <div className="text-[11px] text-amber-100/80 mt-1">{item.detail}</div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="admin-g2-sm border border-emerald-500/20 bg-emerald-950/20 px-3 py-2 text-xs font-semibold text-emerald-200">
                          Main tracked TBA fields available
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="space-y-2">
                        {manualRequired.map(item => (
                          <div key={item.label} className="admin-g2-sm border border-emerald-500/20 bg-emerald-950/20 px-3 py-2">
                            <div className="text-xs font-black text-emerald-100">{item.label}</div>
                            <div className="text-[11px] text-emerald-100/80 mt-1">{item.detail}</div>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
          </PreScoutFrame>
        )}
      </div>
    </div>
  );
}
