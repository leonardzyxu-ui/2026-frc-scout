import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Database, Download, RefreshCw, Search, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PreMatchTeamProfile, QualificationStatus } from '../types';
import { fetchEventTeamNumbers, fetchPreMatchTeamProfile } from '../utils/preMatchScouting';
import { getCachedPreMatchSheet, setCachedPreMatchSheet } from '../utils/preMatchCache';
import { TBA_API_KEY } from '../config';
import { DEFAULT_EVENT_KEY, getStoredEventKey } from '../utils/sharedEventState';

type SortField =
  | 'team'
  | 'nickname'
  | 'media'
  | 'awards'
  | 'events'
  | 'districtRank'
  | 'districtPoints'
  | 'qualification';

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
    binary += String.fromCharCode(bytes[i]);
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

export default function PreMatchView({
  isEmbedded = false,
  eventKey: propEventKey
}: {
  isEmbedded?: boolean;
  eventKey?: string;
}) {
  const navigate = useNavigate();
  const [rows, setRows] = useState<SpreadsheetRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');
  const [sortField, setSortField] = useState<SortField>('team');
  const [sortAscending, setSortAscending] = useState(true);
  const [cacheTimestamp, setCacheTimestamp] = useState<number | null>(null);
  const [showingCachedData, setShowingCachedData] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState<'idle' | 'loading' | 'success'>('idle');

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

      const teamNumbers = await fetchEventTeamNumbers(eventKey, TBA_API_KEY);
      const results = await Promise.allSettled(
        teamNumbers.map(teamNumber => fetchPreMatchTeamProfile(teamNumber, eventKey, TBA_API_KEY))
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
      if (rejectedCount > 0) {
        setError(`${rejectedCount} team profile${rejectedCount === 1 ? '' : 's'} failed to load from TBA. The rest of the sheet is still available.`);
      }
    } catch (err) {
      console.error('Error loading pre-match sheet:', err);
      const message = err instanceof Error ? err.message : 'Failed to load the pre-match sheet.';
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

  return (
    <div className={isEmbedded ? 'pb-24' : 'min-h-screen bg-slate-950 text-slate-200 p-4 md:p-8 font-sans pb-24'}>
      <div className={isEmbedded ? 'space-y-8' : 'max-w-[1400px] mx-auto space-y-8'}>
        <div className="bg-slate-900/50 p-6 md:p-10 rounded-3xl border border-slate-800 shadow-2xl relative">
          {!isEmbedded && (
            <button
              onClick={() => navigate('/')}
              className="absolute top-6 left-6 p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
          )}
          <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight mb-4 text-center">
            Pre Match Sheet
          </h1>
          <p className="text-slate-400 text-center max-w-4xl mx-auto mb-6">
            Spreadsheet-style event overview for pre-match prep. Every team in the active event is listed with direct TBA coverage, conservative qualification signals, and explicit scouting gaps.
          </p>
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <span className="px-3 py-1 bg-blue-900/30 text-blue-300 border border-blue-800/50 rounded-full font-bold tracking-widest">
                {eventKey}
              </span>
              <span className="px-3 py-1 bg-slate-900/70 text-slate-300 border border-slate-800 rounded-full font-semibold">
                {summary.total} teams loaded
              </span>
              {cacheTimestamp && (
                <span className="inline-flex items-center gap-2 px-3 py-1 bg-slate-900/70 text-slate-300 border border-slate-800 rounded-full font-semibold">
                  <Database className="w-4 h-4 text-cyan-300" />
                  IndexedDB cache {cacheLabel}
                </span>
              )}
            </div>
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <div className="relative min-w-[280px]">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input
                  type="text"
                  value={filter}
                  onChange={(event) => setFilter(event.target.value)}
                  placeholder="Filter by team, nickname, or location"
                  className="w-full pl-12 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-cyan-500 transition-colors"
                />
              </div>
              <button
                onClick={() => void handleExportWorkbook()}
                disabled={filteredRows.length === 0 || downloadStatus === 'loading'}
                className={`inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold transition-colors disabled:opacity-50 ${
                  downloadStatus === 'success'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-100'
                }`}
              >
                <Download className="w-4 h-4" />
                {downloadStatus === 'loading'
                  ? 'BUILDING XLSX'
                  : downloadStatus === 'success'
                    ? 'XLSX EXPORTED'
                    : 'EXPORT XLSX'}
              </button>
              <button
                onClick={() => void loadEventSheet()}
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-bold transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                REFRESH SHEET
              </button>
            </div>
          </div>
          {(showingCachedData || loading) && eventKey !== 'TEST' && (
            <div className="mt-5 rounded-2xl border border-cyan-500/20 bg-cyan-950/20 px-4 py-3 text-sm text-cyan-100">
              {showingCachedData
                ? 'Showing the IndexedDB cache immediately while the newest TBA data refreshes in the background.'
                : 'Refreshing the live TBA sheet now.'}
            </div>
          )}
        </div>

        {eventKey === 'TEST' && (
          <div className="bg-amber-900/20 border border-amber-500/50 text-amber-300 p-5 rounded-2xl text-center font-medium">
            Pre Match research is unavailable in TEST mode because it depends on a real TBA event feed.
          </div>
        )}

        {error && (
          <div className="bg-red-900/20 border border-red-500/50 text-red-300 p-6 rounded-2xl text-center font-medium">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
            <div className="text-xs font-black uppercase tracking-widest text-slate-500">Teams In Sheet</div>
            <div className="text-3xl font-black text-white mt-2">{summary.total}</div>
          </div>
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
            <div className="text-xs font-black uppercase tracking-widest text-slate-500">Teams With Media</div>
            <div className="text-3xl font-black text-blue-300 mt-2">{summary.teamsWithMedia}</div>
          </div>
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
            <div className="text-xs font-black uppercase tracking-widest text-slate-500">Likely Qualified</div>
            <div className="text-3xl font-black text-emerald-300 mt-2">{summary.likelyQualified}</div>
          </div>
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
            <div className="text-xs font-black uppercase tracking-widest text-slate-500">Missing Media</div>
            <div className="text-3xl font-black text-amber-300 mt-2">{summary.missingMedia}</div>
          </div>
        </div>

        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden">
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
                              className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-950/70 px-2 py-1 text-[11px] font-semibold text-blue-200 hover:border-blue-500/40"
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
                      <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-black uppercase tracking-widest ${QUALIFICATION_STYLES[profile.qualificationStatus]}`}>
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
                            <div key={item.label} className="rounded-xl border border-amber-500/20 bg-amber-950/20 px-3 py-2">
                              <div className="text-xs font-black text-amber-100">{item.label}</div>
                              <div className="text-[11px] text-amber-100/80 mt-1">{item.detail}</div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 px-3 py-2 text-xs font-semibold text-emerald-200">
                          Main tracked TBA fields available
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="space-y-2">
                        {manualRequired.map(item => (
                          <div key={item.label} className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 px-3 py-2">
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
      </div>
    </div>
  );
}
