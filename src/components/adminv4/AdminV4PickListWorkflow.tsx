import React from 'react';
import { ArrowLeft, Info, ListChecks } from 'lucide-react';
import { AlliancePickRecommendation } from '../../types';
import { PpaInsight } from '../../utils/ppaInsights';
import { AdminButton, AdminInput, AdminSurface } from './AdminV4Primitives';
import { PlainStatTeachingStrip } from './AdminV4StatControls';
import { AdminEmptyState, FocusHeader, SummaryCard, TeamBadge } from './AdminV4UiAtoms';
import { getRiskPillClass } from './AdminV4RiskPill';

export interface AdminV4PickLane {
  key: 'floor' | 'ceiling' | 'role';
  title: string;
  detail: string;
  metricLabel: string;
  rows: AlliancePickRecommendation[];
}

export interface AdminV4PickListDecisionCue {
  label: string;
  detail: string;
  actionLabel: string;
  onAction: () => void;
}

export function AdminV4PickListWorkflow({
  pickStatusUndoActive,
  pickListMeetingMode,
  allianceSeed,
  ownAllianceLabel,
  summary,
  decisionCue,
  selectedAllianceShape,
  selectedAllianceTeams,
  otherPickedRows,
  pickLanes,
  pickBoardRows,
  topAvailableRows,
  ownTeamNumber,
  searchedTeamNumber,
  teamNameLookup,
  ppaInsightsByTeam,
  getLaneValue,
  getLaneReason,
  getDecisionScore,
  getStatusClass,
  renderPickStatusActions,
  renderPpaMiniShape,
  onUndoStatus,
  onToggleMeetingMode,
  onSetAllianceSeed,
  onOpenTeam,
  onOpenWiki,
  onOpenInfoMenu
}: {
  pickStatusUndoActive: boolean;
  pickListMeetingMode: boolean;
  allianceSeed: number;
  ownAllianceLabel: string;
  summary: {
    ourPicks: number;
    taken: number;
    available: number;
    topAvailableTeam: string;
  };
  decisionCue: AdminV4PickListDecisionCue;
  selectedAllianceShape: React.ReactNode;
  selectedAllianceTeams: string[];
  otherPickedRows: AlliancePickRecommendation[];
  pickLanes: AdminV4PickLane[];
  pickBoardRows: AlliancePickRecommendation[];
  topAvailableRows: AlliancePickRecommendation[];
  ownTeamNumber: string;
  searchedTeamNumber: string;
  teamNameLookup: Record<string, string>;
  ppaInsightsByTeam: Record<string, PpaInsight>;
  getLaneValue: (laneKey: AdminV4PickLane['key'], row: AlliancePickRecommendation) => string;
  getLaneReason: (laneKey: AdminV4PickLane['key'], row: AlliancePickRecommendation) => string;
  getDecisionScore: (row: AlliancePickRecommendation) => string;
  getStatusClass: (status: AlliancePickRecommendation['status']) => string;
  renderPickStatusActions: (row: AlliancePickRecommendation, size?: 'compact' | 'table') => React.ReactNode;
  renderPpaMiniShape: (row: AlliancePickRecommendation) => React.ReactNode;
  onUndoStatus: () => void;
  onToggleMeetingMode: () => void;
  onSetAllianceSeed: (seed: number) => void;
  onOpenTeam: (teamNumber: string) => void;
  onOpenWiki: () => void;
  onOpenInfoMenu: (event: React.MouseEvent) => void;
}) {
  const pickListControls = (
    <div className="flex flex-wrap items-center gap-2">
      {pickListMeetingMode && (
        <span className="admin-g2-sm border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-amber-100">
          Meeting Mode
        </span>
      )}
      {pickStatusUndoActive && (
        <AdminButton tone="amber" onClick={onUndoStatus}>
          <ArrowLeft className="h-4 w-4" />
          Undo Status
        </AdminButton>
      )}
      <AdminButton tone={pickListMeetingMode ? 'amber' : 'slate'} onClick={onToggleMeetingMode}>
        <ListChecks className="h-4 w-4" />
        {pickListMeetingMode ? 'Show Full Board' : 'Meeting Mode'}
      </AdminButton>
    </div>
  );

  return (
    <div className="space-y-5">
      <AdminSurface className="p-5">
        <FocusHeader
          eyebrow="Pick List"
          title="Alliance Selection Board"
          description="Alliance selection should answer one question fast: who helps this exact alliance win playoff matches?"
        />
        <button
          type="button"
          onClick={decisionCue.onAction}
          className="admin-g2 mt-5 flex w-full flex-col gap-3 border border-amber-400/30 bg-amber-500/10 p-4 text-left text-amber-100 transition-colors hover:bg-amber-500/15 md:flex-row md:items-center md:justify-between"
        >
          <span className="min-w-0">
            <span className="block text-[10px] font-black uppercase tracking-[0.18em] opacity-75">Do This First</span>
            <span className="mt-1 block text-lg font-black text-white">{decisionCue.label}</span>
            <span className="mt-1 block text-sm font-semibold leading-relaxed opacity-85">{decisionCue.detail}</span>
          </span>
          <span className="admin-g2-sm shrink-0 border border-white/15 bg-white/10 px-3 py-2 text-xs font-black uppercase text-white/80">
            {decisionCue.actionLabel}
          </span>
        </button>
        <div className="mt-4">{pickListControls}</div>
        <details className="admin-g2-sm mt-4 border border-slate-800 bg-slate-950/75 p-3">
          <summary className="cursor-pointer list-none text-sm font-black text-slate-100">
            Show Pick-List Metric Translation
          </summary>
          <div className="admin-details-body mt-3">
            <PlainStatTeachingStrip
              title="Pick-List Metric Translation"
              stats={['floor', 'ceiling', 'tailRisk', 'defense']}
              onInfo={onOpenWiki}
              onInfoContext={onOpenInfoMenu}
            />
          </div>
        </details>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <SummaryCard label="Alliance Seed" value={`A${allianceSeed}`} />
          <SummaryCard label="Our Picks" value={summary.ourPicks} />
          <SummaryCard label="Taken" value={summary.taken} />
          <SummaryCard label="Available" value={summary.available} />
          <SummaryCard label="Top Available" value={summary.topAvailableTeam || 'None'} />
        </div>
      </AdminSurface>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        {selectedAllianceShape}
        <AdminSurface className="border-amber-400/25 bg-amber-500/10 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-black text-amber-100">Selection Need</div>
              <div className="mt-1 text-xs font-semibold text-amber-50/60">This changes with seed and live pick status.</div>
            </div>
            <button
              type="button"
              onClick={onOpenWiki}
              onContextMenu={onOpenInfoMenu}
              className="admin-g2-sm border border-amber-300/30 bg-amber-300/10 p-2 text-amber-100 hover:bg-amber-300/20"
              aria-label="Get info about expected range"
            >
              <Info className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-4 space-y-3 text-sm font-semibold text-amber-50/75">
            <div>Tracking: <span className="font-black text-white">our alliance is {ownAllianceLabel}</span></div>
            <div>Seed mode: <span className="font-black text-white">{allianceSeed <= 2 ? 'protect floor' : allianceSeed >= 7 ? 'hunt upside' : 'balance value'}</span></div>
            <div>Next lens: <span className="font-black text-white">{allianceSeed <= 2 ? 'Safe Floor' : allianceSeed >= 7 ? 'Upside Ceiling' : 'Role Balance'}</span></div>
            <div>
              <div className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-amber-100/70">Alliance So Far</div>
              <div className="flex flex-wrap gap-2">
                {selectedAllianceTeams.map(teamNumber => (
                  <span key={teamNumber} className="admin-g2-sm border border-amber-300/30 bg-slate-950/70 px-2 py-1 font-mono text-xs font-black text-white">
                    {teamNumber}
                  </span>
                ))}
                {selectedAllianceTeams.length === 0 && (
                  <AdminEmptyState
                    title="No teams marked for our alliance"
                    why="Alliance context changes which teams fit. Until a team is marked, the board can rank candidates but not explain our exact alliance shape."
                    action="Mark our current team/alliance members as Our Pick, or keep using lanes as a neutral shortlist."
                  />
                )}
              </div>
            </div>
            {otherPickedRows.length > 0 && (
              <div>
                <div className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-amber-100/70">Taken By Others</div>
                <div className="flex flex-wrap gap-2">
                  {otherPickedRows.slice(0, 10).map(row => (
                    <span key={row.teamNumber} className="admin-g2-sm border border-slate-700 bg-slate-950/70 px-2 py-1 font-mono text-xs font-black text-slate-300">
                      {row.teamNumber} {row.pickedBy || 'taken'}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </AdminSurface>
      </div>

      <AdminSurface className="p-5">
        <FocusHeader
          title="Decision Lanes"
          description="Use the lane that matches the moment instead of trying to read one giant ranking as absolute truth."
        />
        <div className="mt-5 grid gap-4 xl:grid-cols-3">
          {pickLanes.map(lane => (
            <div key={lane.title} className="admin-g2-sm border border-slate-800 bg-slate-950/80 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-black text-white">{lane.title}</div>
                  <p className="mt-1 text-xs font-semibold text-slate-500">{lane.detail}</p>
                </div>
                <div className="admin-g2-sm border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] font-black uppercase text-slate-400">
                  {lane.metricLabel}
                </div>
              </div>
              <div className="mt-4 space-y-2">
                {lane.rows.map(row => {
                  const insight = ppaInsightsByTeam[row.teamNumber];
                  return (
                    <div
                      key={`${lane.title}-${row.teamNumber}`}
                      className="admin-g2-sm grid grid-cols-[minmax(0,1fr)_auto] gap-3 border border-slate-800 bg-slate-950/70 p-3"
                    >
                      <button
                        type="button"
                        onClick={() => onOpenTeam(row.teamNumber)}
                        className="min-w-0 text-left"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-black text-white">{row.teamNumber}</span>
                          <span className={`admin-g2-sm px-2 py-0.5 text-[10px] font-black ${getRiskPillClass(insight?.tailRisk.level || 'High')}`}>
                            {insight?.tailRisk.level || 'High'} risk
                          </span>
                        </div>
                        <div className="mt-1 truncate text-xs font-semibold text-slate-500">{teamNameLookup[row.teamNumber] || insight?.role.label || row.roleFit}</div>
                        <div className="mt-2 text-xs font-semibold text-slate-400">
                          {insight?.role.label || row.roleFit} - score {getDecisionScore(row)}
                        </div>
                        <div className="mt-1 text-xs font-semibold text-slate-500">
                          {getLaneReason(lane.key, row)}
                        </div>
                      </button>
                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <div className="text-right text-xs font-black text-amber-100">{getLaneValue(lane.key, row)}</div>
                        {pickListMeetingMode ? (
                          <span className={`admin-g2-sm inline-flex border px-2 py-1 text-[10px] font-black uppercase ${getStatusClass(row.status)}`}>
                            {row.status}{row.pickedBy ? ` ${row.pickedBy}` : ''}
                          </span>
                        ) : renderPickStatusActions(row)}
                      </div>
                    </div>
                  );
                })}
                {lane.rows.length === 0 && (
                  <AdminEmptyState
                    title={`No useful ${lane.title.toLowerCase()} lane yet`}
                    why="This lane is hidden from decision pressure when the available teams do not have differentiating data for this lens."
                    action="Collect more match, pit, or defense evidence, then revisit this lane."
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      </AdminSurface>

      {!pickListMeetingMode && (
        <AdminSurface className="p-5">
          <FocusHeader
            title="Full Live Board"
            description="Advanced status editing and evidence tracing. Meeting Mode keeps this hidden so selection discussion stays on lanes and shortlist."
          />
          <div className="mt-5 grid gap-4 lg:grid-cols-[280px_1fr]">
            <div className="space-y-4">
              <div className="admin-g2-sm border border-slate-800 bg-slate-950 p-4">
                <label className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Our Alliance Seed</label>
                <AdminInput
                  type="number"
                  min={1}
                  max={8}
                  value={allianceSeed}
                  onChange={event => onSetAllianceSeed(Math.max(1, Math.min(8, Number(event.target.value) || 1)))}
                  className="mt-2 w-full font-mono text-lg"
                />
                <p className="mt-3 text-xs font-semibold text-slate-400">
                  Early seeds favor floor and reliability. Lower seeds look harder at peak and upset value.
                </p>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {Array.from({ length: 8 }, (_, index) => index + 1).map(seed => (
                  <AdminButton
                    key={seed}
                    tone={allianceSeed === seed ? 'amber' : 'slate'}
                    className="px-0"
                    onClick={() => onSetAllianceSeed(seed)}
                  >
                    A{seed}
                  </AdminButton>
                ))}
              </div>
              <div className="admin-g2-sm border border-slate-800 bg-slate-950 p-4 text-sm text-slate-400">
                <div className="font-black text-white">Decision Rules</div>
                <div className="mt-3 space-y-2">
                  <div>Use expected value as the strength lens.</div>
                  <div>Use floor, ceiling, and tail risk before trusting it.</div>
                  <div>Use role fit to avoid three robots doing the same job.</div>
                  <div>Use Our Pick only for teams on our alliance; use Taken when another alliance removes a team.</div>
                </div>
              </div>
            </div>

            <div className="admin-g2-sm overflow-x-auto border border-slate-800">
              <table className="admin-sticky-table min-w-full text-left text-sm">
                <thead className="sticky top-0 bg-slate-950 text-xs uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Team</th>
                    <th className="px-4 py-3">Pick Score</th>
                    <th className="px-4 py-3">
                      <button
                        type="button"
                        onClick={onOpenWiki}
                        onContextMenu={onOpenInfoMenu}
                        className="inline-flex items-center gap-1 text-left hover:text-white"
                      >
                        Expected Range <Info className="h-3.5 w-3.5" />
                      </button>
                    </th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Risk</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Status Menu</th>
                    <th className="px-4 py-3">Why</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {pickBoardRows.map(row => {
                    const insight = ppaInsightsByTeam[row.teamNumber];
                    return (
                      <tr key={row.teamNumber} className={row.status === 'available' ? 'hover:bg-slate-900' : 'opacity-55'}>
                        <td className="px-4 py-3">
                          <button type="button" onClick={() => onOpenTeam(row.teamNumber)} className="text-left">
                            <TeamBadge teamNumber={row.teamNumber} ownTeamNumber={ownTeamNumber} searchedTeamNumber={searchedTeamNumber} teamName={teamNameLookup[row.teamNumber] || ''} />
                          </button>
                        </td>
                        <td className="px-4 py-3 font-black text-amber-100">{getDecisionScore(row)}</td>
                        <td className="px-4 py-3">{renderPpaMiniShape(row)}</td>
                        <td className="px-4 py-3">
                          <div className="font-black text-slate-100">{insight?.role.label || row.roleFit}</div>
                          <div className="text-xs text-slate-500">{row.seedFit}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className={`admin-g2-sm inline-flex px-2 py-1 text-xs font-black ${getRiskPillClass(insight?.uncertainty.level || 'High')}`}>
                            {insight?.uncertainty.level || 'High'}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">{insight?.tailRisk.label || 'No range risk context'}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`admin-g2-sm inline-flex border px-2 py-1 text-xs font-black uppercase ${getStatusClass(row.status)}`}>
                            {row.status}{row.pickedBy ? ` ${row.pickedBy}` : ''}
                          </span>
                        </td>
                        <td className="px-4 py-3">{renderPickStatusActions(row, 'table')}</td>
                        <td className="max-w-sm px-4 py-3 text-slate-400">{row.rationale}</td>
                      </tr>
                    );
                  })}
                  {pickBoardRows.length === 0 && (
                    <tr>
                      <td className="px-4 py-4" colSpan={8}>
                        <AdminEmptyState
                          title="Pick board has no team profiles"
                          why="Alliance selection needs team rows, scoring evidence, and role context before status editing is meaningful."
                          action="Import the event team list or collect match/pit rows, then return to the pick list."
                        />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </AdminSurface>
      )}

      <AdminSurface className="p-5">
        <FocusHeader title="Available Shortlist" description="A meeting-friendly shortlist of available teams after live pick status is applied." />
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {topAvailableRows.map(row => {
            const insight = ppaInsightsByTeam[row.teamNumber];
            return (
              <button
                key={row.teamNumber}
                type="button"
                onClick={() => onOpenTeam(row.teamNumber)}
                className="admin-g2-sm border border-slate-800 bg-slate-950 p-4 text-left hover:border-amber-400/40 hover:bg-slate-900"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xl font-black text-white">{row.teamNumber}</div>
                    <div className="mt-1 text-xs font-semibold text-slate-500">{teamNameLookup[row.teamNumber] || row.roleFit}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-black text-amber-100">{getDecisionScore(row)}</div>
                    <div className="text-[10px] font-black uppercase text-slate-500">Pick Score</div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-start gap-3">
                  <div className="admin-g2-sm border border-violet-400/30 bg-violet-500/10 px-3 py-2">
                    {renderPpaMiniShape(row)}
                  </div>
                  <span className={`admin-g2-sm px-2 py-1 text-[11px] font-black ${getRiskPillClass(insight?.tailRisk.level || 'High')}`}>
                    {insight?.tailRisk.level || 'High'} risk
                  </span>
                </div>
              </button>
            );
          })}
          {topAvailableRows.length === 0 && (
            <AdminEmptyState
              title="No available teams remain"
              why="Every known team is currently filtered out by pick status or missing profile data."
              action="Undo a mistaken status, clear stale Taken/Out labels, or load the event team list if this is early setup."
              className="md:col-span-2 xl:col-span-4"
            />
          )}
        </div>
      </AdminSurface>
    </div>
  );
}

export default AdminV4PickListWorkflow;
