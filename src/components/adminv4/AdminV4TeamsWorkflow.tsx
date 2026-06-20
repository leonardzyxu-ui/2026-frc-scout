import React from 'react';
import { ArrowUpDown, Info } from 'lucide-react';
import { PpaInsight, PpaRiskLevel } from '../../utils/ppaInsights';
import { AdminButton, AdminSurface } from './AdminV4Primitives';
import { AdminV4StatInfoKey } from './AdminV4StatDefinitions';
import { PlainStatTeachingStrip } from './AdminV4StatControls';
import { getRiskPillClass } from './AdminV4RiskPill';
import { AdminEmptyState, FocusHeader, SummaryCard, TeamBadge } from './AdminV4UiAtoms';

export type AdminV4SorterField = 'team' | 'tbaRank' | 'matches' | 'ppa' | 'ppc' | 'autoPpc' | 'teleopPpc' | 'defenseMetric' | 'epa' | 'opr' | 'dpr';
export type AdminV4SorterDirection = 'asc' | 'desc';

export interface AdminV4TeamsRow {
  teamNumber: string;
  teamName: string;
  matches: number;
  ppa: number | null;
  ppaRole: string;
  ppaUncertainty: PpaRiskLevel;
  ppaCoverage: string;
  ppc: number | null;
  autoPpc: number | null;
  teleopPpc: number | null;
  defenseMetric: number | null;
  defenseRecords: number;
  epa: number | null;
  opr: number | null;
  dpr: number | null;
  tbaRank: number | null;
}

export interface AdminV4TeamsDecisionCue {
  label: string;
  detail: string;
  actionLabel: string;
  tone: 'rose' | 'amber' | 'emerald' | 'fuchsia' | 'cyan';
  onAction: () => void;
}

const teamSortOptions: Array<{ field: AdminV4SorterField; label: string }> = [
  { field: 'ppa', label: 'Expected value' },
  { field: 'matches', label: 'Matches logged' },
  { field: 'tbaRank', label: 'TBA rank' },
  { field: 'ppc', label: 'Local avg' },
  { field: 'autoPpc', label: 'Auto local' },
  { field: 'teleopPpc', label: 'Teleop local' },
  { field: 'defenseMetric', label: 'Defense' },
  { field: 'epa', label: 'Public rating' },
  { field: 'opr', label: 'Official avg' },
  { field: 'dpr', label: 'Defense against' },
  { field: 'team', label: 'Team number' }
];
const basicTeamSortFields = new Set<AdminV4SorterField>(['ppa', 'matches', 'team']);

const formatMetricValue = (value: number | null, digits: number = 2) =>
  value == null || !Number.isFinite(value) ? '-' : value.toFixed(digits);

const formatPercentMetric = (value: number | null, digits: number = 2) =>
  value == null || !Number.isFinite(value) ? '-' : `${(value * 100).toFixed(digits)}%`;

const getTeamDecisionAction = (row: AdminV4TeamsRow) =>
  row.matches < 2 ? 'Collect match evidence' : row.defenseRecords === 0 ? 'Check defense role' : 'Open profile';

const shouldIgnoreTeamCardOpen = (target: EventTarget | null) =>
  target instanceof Element && Boolean(target.closest('[data-adminv4-stop-team-open="true"]'));

function MobileMetricLabel({
  label,
  infoKey,
  onInfo,
  onInfoContext
}: {
  label: string;
  infoKey: AdminV4StatInfoKey;
  onInfo: (key: AdminV4StatInfoKey) => void;
  onInfoContext: (event: React.MouseEvent, key: AdminV4StatInfoKey) => void;
}) {
  return (
    <button
      type="button"
      data-adminv4-stop-team-open="true"
      onPointerDown={event => event.stopPropagation()}
      onMouseDown={event => event.stopPropagation()}
      onClick={event => {
        event.stopPropagation();
        onInfo(infoKey);
      }}
      onContextMenu={event => {
        event.preventDefault();
        event.stopPropagation();
        onInfoContext(event, infoKey);
      }}
      className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-slate-500 transition-colors hover:text-cyan-200"
      aria-label={`Get info for ${label}`}
      title={`Get info for ${label}`}
    >
      {label}
      <Info className="h-3 w-3" />
    </button>
  );
}

function PpaMiniShape({
  insight,
  fallbackRating
}: {
  insight: PpaInsight | null;
  fallbackRating: number | null;
}) {
  const expected = insight?.projected.expected ?? insight?.rating ?? fallbackRating;
  const floor = insight?.projected.floor ?? null;
  const ceiling = insight?.projected.ceiling ?? null;
  const hasRange = floor != null || ceiling != null;
  const riskLabel = insight?.tailRisk.label || insight?.coverage.label || 'No shape context';

  return (
    <div className="min-w-[150px]">
      <div className="text-sm font-black text-violet-100">{formatMetricValue(expected, 1)}</div>
      <div className="mt-0.5 text-[11px] font-semibold text-slate-400">
        {hasRange ? `${formatMetricValue(floor, 1)} to ${formatMetricValue(ceiling, 1)}` : 'range pending'}
      </div>
      <div className="mt-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">{riskLabel}</div>
    </div>
  );
}

function SortableHeader({
  label,
  field,
  activeField,
  direction,
  onClick,
  infoKey,
  onInfo,
  onInfoContext,
  align = 'text-left'
}: {
  label: string;
  field: AdminV4SorterField;
  activeField: AdminV4SorterField;
  direction: AdminV4SorterDirection;
  onClick: (field: AdminV4SorterField) => void;
  infoKey?: AdminV4StatInfoKey;
  onInfo?: (key: AdminV4StatInfoKey) => void;
  onInfoContext?: (event: React.MouseEvent, key: AdminV4StatInfoKey) => void;
  align?: string;
}) {
  const isActive = activeField === field;

  return (
    <th
      className={`cursor-pointer px-4 py-3 transition-colors hover:text-white ${align}`}
      onClick={() => onClick(field)}
      onContextMenu={event => {
        if (!infoKey) return;
        event.preventDefault();
        if (onInfoContext) {
          onInfoContext(event, infoKey);
        }
      }}
    >
      <span className="inline-flex items-center gap-1.5">
        {label}
        {isActive && <ArrowUpDown className={`h-3.5 w-3.5 ${direction === 'asc' ? 'rotate-180' : ''}`} />}
        {infoKey && onInfo && (
          <button
            type="button"
            onClick={event => {
              event.stopPropagation();
              onInfo(infoKey);
            }}
            onContextMenu={event => {
              event.preventDefault();
              event.stopPropagation();
              onInfoContext?.(event, infoKey);
            }}
            className="admin-g2-sm inline-flex h-7 w-7 items-center justify-center border border-slate-800 bg-slate-950 text-slate-500 transition-colors hover:border-cyan-400/50 hover:text-cyan-200"
            aria-label={`Get info for ${label}`}
            title={`Get info for ${label}`}
          >
            <Info className="h-3.5 w-3.5" />
          </button>
        )}
        {infoKey && <span className="sr-only">Right click or press the info button for metric info.</span>}
      </span>
    </th>
  );
}

export function AdminV4TeamsWorkflow({
  rows,
  sorterField,
  sorterDirection,
  teamsAdvancedStats,
  ownTeamNumber,
  searchedTeamNumber,
  ppaInsightsByTeam,
  decisionCue,
  modelAction,
  summary,
  onOpenTeam,
  onSort,
  onToggleSortDirection,
  onToggleAdvancedStats,
  onOpenWiki,
  onOpenInfoMenu
}: {
  rows: AdminV4TeamsRow[];
  sorterField: AdminV4SorterField;
  sorterDirection: AdminV4SorterDirection;
  teamsAdvancedStats: boolean;
  ownTeamNumber: string;
  searchedTeamNumber: string;
  ppaInsightsByTeam: Record<string, PpaInsight>;
  decisionCue: AdminV4TeamsDecisionCue;
  modelAction: React.ReactNode;
  summary: {
    teamsLoaded: number;
    ppaShapes: number;
    lowConfidence: number;
    matchRows: number;
  };
  onOpenTeam: (teamNumber: string) => void;
  onSort: (field: AdminV4SorterField) => void;
  onToggleSortDirection: () => void;
  onToggleAdvancedStats: () => void;
  onOpenWiki: (key: AdminV4StatInfoKey) => void;
  onOpenInfoMenu: (event: React.MouseEvent, key: AdminV4StatInfoKey) => void;
}) {
  const visibleSortOptions = teamsAdvancedStats
    ? teamSortOptions
    : teamSortOptions.filter(option => basicTeamSortFields.has(option.field));
  const activeSortLabel = visibleSortOptions.find(option => option.field === sorterField)?.label || 'Expected value';
  const cueToneClass: Record<AdminV4TeamsDecisionCue['tone'], string> = {
    rose: 'border-rose-400/30 bg-rose-500/10 text-rose-50',
    amber: 'border-amber-400/30 bg-amber-500/10 text-amber-50',
    emerald: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-50',
    fuchsia: 'border-fuchsia-400/30 bg-fuchsia-500/10 text-fuchsia-50',
    cyan: 'border-cyan-400/30 bg-cyan-500/10 text-cyan-50'
  };
  const teamControls = (
    <div className="flex flex-wrap items-center gap-3">
      <AdminButton tone="slate" onClick={() => onOpenWiki('ppa')}>
        <Info className="h-4 w-4" />Metric Guide
      </AdminButton>
      {modelAction}
      <AdminButton tone={teamsAdvancedStats ? 'cyan' : 'slate'} onClick={onToggleAdvancedStats}>
        {teamsAdvancedStats ? 'Hide Advanced Stats' : 'Advanced Stats'}
      </AdminButton>
    </div>
  );

  return (
    <AdminSurface className="p-5">
      <FocusHeader
        eyebrow="Teams"
        title="Team Decision Board"
        description="Default view shows role, expected value, trust, and next action. Turn on advanced stats when you need raw model columns."
      />
      <button
        type="button"
        onClick={decisionCue.onAction}
        className={`admin-g2 mt-4 flex w-full flex-col gap-3 border p-4 text-left transition-colors hover:bg-slate-900 md:flex-row md:items-center md:justify-between ${cueToneClass[decisionCue.tone]}`}
      >
        <span className="min-w-0">
          <span className="block text-[10px] font-black uppercase tracking-[0.18em] opacity-75">Do This First</span>
          <span className="mt-1 block text-lg font-black text-white">{decisionCue.label}</span>
          <span className="mt-1 block text-sm font-semibold leading-relaxed opacity-85">{decisionCue.detail}</span>
        </span>
        <span className="admin-g2-sm shrink-0 border border-white/15 bg-white/10 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-white/85">
          {decisionCue.actionLabel}
        </span>
      </button>
      <div className="mt-4">{teamControls}</div>
      <details className="admin-g2-sm mt-4 border border-slate-800 bg-slate-950/75 p-3">
        <summary className="cursor-pointer list-none text-sm font-black text-slate-100">
          Show Leaderboard Metric Translation
        </summary>
        <div className="admin-details-body mt-3">
          <PlainStatTeachingStrip
            title="Leaderboard Column Translation"
            description="Use this before sorting. Click a metric to open the exact Stats Wiki entry; right-click any metric label, info icon, or sortable column for Get Info."
            stats={teamsAdvancedStats
              ? ['expected', 'floor', 'tailRisk', 'scoutTrust', 'localAvg', 'officialAvg', 'publicRating', 'defense']
              : ['expected', 'floor', 'tailRisk', 'scoutTrust']}
            onInfo={onOpenWiki}
            onInfoContext={onOpenInfoMenu}
          />
        </div>
      </details>
      <div className="mt-5 grid gap-3 md:grid-cols-4">
        <SummaryCard label="Teams Loaded" value={summary.teamsLoaded} />
        <SummaryCard label="Ranges Ready" value={summary.ppaShapes} />
        <SummaryCard label="Low Scout Trust" value={summary.lowConfidence} />
        <SummaryCard label="Match Rows" value={summary.matchRows} />
      </div>

      <div className="mt-4 flex flex-col gap-3 lg:hidden">
        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <label className="admin-g2-sm border border-slate-800 bg-slate-950 px-3 py-2">
            <span className="block text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Sort Teams By</span>
            <select
              value={sorterField}
              onChange={event => onSort(event.target.value as AdminV4SorterField)}
              className="mt-1 w-full bg-transparent text-sm font-black text-white outline-none"
            >
              {visibleSortOptions.map(option => <option key={option.field} value={option.field}>{option.label}</option>)}
            </select>
          </label>
          <AdminButton
            tone="slate"
            onClick={onToggleSortDirection}
            className="justify-center"
          >
            <ArrowUpDown className="h-4 w-4" />{sorterDirection === 'asc' ? 'Ascending' : 'Descending'}
          </AdminButton>
        </div>
        <div className="text-xs font-semibold text-slate-500">
          Sorted by {activeSortLabel}. Tap a team to open the full profile and match history.
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:hidden">
        {rows.map(row => {
          const insight = ppaInsightsByTeam[row.teamNumber];
          const expected = insight?.projected.expected ?? row.ppa;
          const floor = insight?.projected.floor ?? expected;
          const ceiling = insight?.projected.ceiling ?? expected;
          return (
            <div
              key={row.teamNumber}
              role="button"
              tabIndex={0}
              onClick={event => {
                if (shouldIgnoreTeamCardOpen(event.target)) return;
                onOpenTeam(row.teamNumber);
              }}
              onKeyDown={event => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                onOpenTeam(row.teamNumber);
              }}
              className="admin-g2-sm cursor-pointer border border-slate-800 bg-slate-950 p-4 text-left hover:border-cyan-400/40 hover:bg-slate-900"
            >
              <div className="flex items-start justify-between gap-3">
                <TeamBadge teamNumber={row.teamNumber} ownTeamNumber={ownTeamNumber} searchedTeamNumber={searchedTeamNumber} teamName={row.teamName} />
                <div className="text-right">
                  <MobileMetricLabel label="Expected" infoKey="ppa" onInfo={onOpenWiki} onInfoContext={onOpenInfoMenu} />
                  <div className="text-xl font-black text-violet-100">{formatMetricValue(expected, 1)}</div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <div className="admin-g2-sm border border-slate-800 bg-slate-900/60 px-3 py-2">
                  <MobileMetricLabel label="Floor" infoKey="ppaFloor" onInfo={onOpenWiki} onInfoContext={onOpenInfoMenu} />
                  <div className="mt-1 font-black text-white">{formatMetricValue(floor, 1)}</div>
                </div>
                <div className="admin-g2-sm border border-slate-800 bg-slate-900/60 px-3 py-2">
                  <MobileMetricLabel label="Ceiling" infoKey="ppaCeiling" onInfo={onOpenWiki} onInfoContext={onOpenInfoMenu} />
                  <div className="mt-1 font-black text-white">{formatMetricValue(ceiling, 1)}</div>
                </div>
                <div className="admin-g2-sm border border-slate-800 bg-slate-900/60 px-3 py-2">
                  <MobileMetricLabel label="Matches" infoKey="matches" onInfo={onOpenWiki} onInfoContext={onOpenInfoMenu} />
                  <div className="mt-1 font-black text-white">{row.matches}</div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="admin-g2-sm border border-slate-700 px-2 py-1 text-[11px] font-black uppercase text-slate-300">{row.ppaRole}</span>
                <span className={`admin-g2-sm px-2 py-1 text-[11px] font-black uppercase ${getRiskPillClass(row.ppaUncertainty)}`}>{row.ppaUncertainty}</span>
                <span className="admin-g2-sm border border-cyan-400/30 bg-cyan-500/10 px-2 py-1 text-[11px] font-black text-cyan-100">{row.ppaCoverage}</span>
              </div>
              {teamsAdvancedStats ? (
                <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs font-semibold text-slate-400">
                  <div>
                    <MobileMetricLabel label="Local avg" infoKey="ppc" onInfo={onOpenWiki} onInfoContext={onOpenInfoMenu} />
                    <span className="ml-1 font-black text-cyan-100">{formatMetricValue(row.ppc, 1)}</span>
                  </div>
                  <div>
                    <MobileMetricLabel label="Defense" infoKey="defenseMetric" onInfo={onOpenWiki} onInfoContext={onOpenInfoMenu} />
                    <span className="ml-1 font-black text-emerald-100">{formatPercentMetric(row.defenseMetric)}</span>
                  </div>
                  <div>
                    <MobileMetricLabel label="Official avg" infoKey="opr" onInfo={onOpenWiki} onInfoContext={onOpenInfoMenu} />
                    <span className="ml-1 font-black text-fuchsia-100">{formatMetricValue(row.opr, 1)}</span>
                  </div>
                  <div>
                    <MobileMetricLabel label="Public rating" infoKey="epa" onInfo={onOpenWiki} onInfoContext={onOpenInfoMenu} />
                    <span className="ml-1 font-black text-blue-100">{formatMetricValue(row.epa, 1)}</span>
                  </div>
                </div>
              ) : (
                <div className="mt-4 admin-g2-sm border border-slate-800 bg-slate-900/60 px-3 py-2">
                  <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Next Action</div>
                  <div className="mt-1 text-sm font-black text-white">{getTeamDecisionAction(row)}</div>
                </div>
              )}
              <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-800 pt-3">
                <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">{row.tbaRank ? `TBA #${row.tbaRank}` : 'No TBA rank'}</span>
                <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Open Profile</span>
              </div>
            </div>
          );
        })}
        {rows.length === 0 && (
          <AdminEmptyState
            title="No teams are loaded yet"
            why="Teams needs an event roster, schedule upload, Firebase rows, or local fixture data before it can build the leaderboard."
            action="Open Data / Imports and load official sources or a local backup."
          />
        )}
      </div>

      <div className="admin-g2-sm mt-4 hidden min-w-0 overflow-x-auto border border-slate-800 lg:block">
        <table className="admin-sticky-table min-w-full text-left text-sm">
          <thead className="sticky top-0 bg-slate-950 text-xs uppercase tracking-wider text-slate-400">
            <tr>
              <SortableHeader label="Team" field="team" activeField={sorterField} direction={sorterDirection} onClick={onSort} infoKey="team" onInfo={onOpenWiki} onInfoContext={onOpenInfoMenu} />
              {!teamsAdvancedStats ? (
                <>
                  <th className="px-4 py-3">Role</th>
                  <SortableHeader label="Expected Value" field="ppa" activeField={sorterField} direction={sorterDirection} onClick={onSort} infoKey="ppa" onInfo={onOpenWiki} onInfoContext={onOpenInfoMenu} align="text-right" />
                  <th className="px-4 py-3">Trust</th>
                  <th className="px-4 py-3">Next Action</th>
                </>
              ) : (
                <>
                  <SortableHeader label="TBA Rank" field="tbaRank" activeField={sorterField} direction={sorterDirection} onClick={onSort} infoKey="tbaRank" onInfo={onOpenWiki} onInfoContext={onOpenInfoMenu} />
                  <SortableHeader label="Matches" field="matches" activeField={sorterField} direction={sorterDirection} onClick={onSort} infoKey="matches" onInfo={onOpenWiki} onInfoContext={onOpenInfoMenu} align="text-right" />
                  <SortableHeader label="Expected" field="ppa" activeField={sorterField} direction={sorterDirection} onClick={onSort} infoKey="ppa" onInfo={onOpenWiki} onInfoContext={onOpenInfoMenu} align="text-right" />
                  <SortableHeader label="Local Avg" field="ppc" activeField={sorterField} direction={sorterDirection} onClick={onSort} infoKey="ppc" onInfo={onOpenWiki} onInfoContext={onOpenInfoMenu} align="text-right" />
                  <SortableHeader label="Auto" field="autoPpc" activeField={sorterField} direction={sorterDirection} onClick={onSort} infoKey="autoPpc" onInfo={onOpenWiki} onInfoContext={onOpenInfoMenu} align="text-right" />
                  <SortableHeader label="Teleop" field="teleopPpc" activeField={sorterField} direction={sorterDirection} onClick={onSort} infoKey="teleopPpc" onInfo={onOpenWiki} onInfoContext={onOpenInfoMenu} align="text-right" />
                  <SortableHeader label="Defense" field="defenseMetric" activeField={sorterField} direction={sorterDirection} onClick={onSort} infoKey="defenseMetric" onInfo={onOpenWiki} onInfoContext={onOpenInfoMenu} align="text-right" />
                  <SortableHeader label="Public Rating" field="epa" activeField={sorterField} direction={sorterDirection} onClick={onSort} infoKey="epa" onInfo={onOpenWiki} onInfoContext={onOpenInfoMenu} align="text-right" />
                  <SortableHeader label="Official Avg" field="opr" activeField={sorterField} direction={sorterDirection} onClick={onSort} infoKey="opr" onInfo={onOpenWiki} onInfoContext={onOpenInfoMenu} align="text-right" />
                  <SortableHeader label="Defense Against" field="dpr" activeField={sorterField} direction={sorterDirection} onClick={onSort} infoKey="dpr" onInfo={onOpenWiki} onInfoContext={onOpenInfoMenu} align="text-right" />
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {rows.map(row => {
              const insight = ppaInsightsByTeam[row.teamNumber] || null;
              return (
                <tr
                  key={row.teamNumber}
                  role="button"
                  tabIndex={0}
                  className="cursor-pointer hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
                  onClick={() => onOpenTeam(row.teamNumber)}
                  onKeyDown={event => {
                    if (event.key !== 'Enter' && event.key !== ' ') return;
                    event.preventDefault();
                    onOpenTeam(row.teamNumber);
                  }}
                >
                  <td className="px-4 py-3"><TeamBadge teamNumber={row.teamNumber} ownTeamNumber={ownTeamNumber} searchedTeamNumber={searchedTeamNumber} teamName={row.teamName} /></td>
                  {!teamsAdvancedStats ? (
                    <>
                      <td className="px-4 py-3">
                        <span className="admin-g2-sm border border-slate-700 px-2 py-1 text-xs font-black uppercase text-slate-300">{row.ppaRole}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="font-black text-violet-100">{formatMetricValue(insight?.projected.expected ?? row.ppa, 1)}</div>
                        <div className="mt-1 text-xs font-semibold text-slate-500">
                          Floor {formatMetricValue(insight?.projected.floor ?? row.ppa, 1)} · Ceiling {formatMetricValue(insight?.projected.ceiling ?? row.ppa, 1)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`admin-g2-sm px-2 py-1 text-xs font-black uppercase ${getRiskPillClass(row.ppaUncertainty)}`}>{row.ppaUncertainty}</span>
                        <div className="mt-1 text-xs font-semibold text-slate-500">{row.ppaCoverage}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {getTeamDecisionAction(row)}
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3 text-slate-300">{row.tbaRank ? `#${row.tbaRank}` : 'Needs official rankings'}</td>
                      <td className="px-4 py-3 text-right">{row.matches}</td>
                      <td className="px-4 py-3">
                        <PpaMiniShape insight={insight} fallbackRating={row.ppa} />
                        <div className="mt-1 flex gap-1">
                          <span className="admin-g2-sm border border-slate-700 px-2 py-0.5 text-[10px] font-black uppercase text-slate-300">{row.ppaRole}</span>
                          <span className={`admin-g2-sm px-2 py-0.5 text-[10px] font-black uppercase ${getRiskPillClass(row.ppaUncertainty)}`}>{row.ppaUncertainty}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-black text-cyan-100">{formatMetricValue(row.ppc)}</td>
                      <td className="px-4 py-3 text-right text-slate-300">{formatMetricValue(row.autoPpc)}</td>
                      <td className="px-4 py-3 text-right text-slate-300">{formatMetricValue(row.teleopPpc)}</td>
                      <td className="px-4 py-3 text-right font-black text-emerald-200">{formatPercentMetric(row.defenseMetric)}</td>
                      <td className="px-4 py-3 text-right text-blue-200">{formatMetricValue(row.epa)}</td>
                      <td className="px-4 py-3 text-right text-fuchsia-200">{formatMetricValue(row.opr)}</td>
                      <td className="px-4 py-3 text-right text-rose-200">{formatMetricValue(row.dpr)}</td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </AdminSurface>
  );
}

export default AdminV4TeamsWorkflow;
