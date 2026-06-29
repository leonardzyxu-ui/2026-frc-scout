import { ChevronLeft, Download, Users } from 'lucide-react';
import type { PowerCoinBet, ScoutAssignmentPlan } from '../../types';
import { AdminButton, AdminSurface } from './AdminV4Primitives';
import { AdminEmptyState, FocusHeader, SummaryCard, TeamBadge } from './AdminV4UiAtoms';
import AdminV4ScoutRewardsPanel, { type AdminV4ScoutRewardRow } from './AdminV4ScoutRewardsPanel';
import type { PowerCoinSettlementWinner } from './AdminV4SafetyModals';

export interface AdminV4ScoutExposureRow {
  scoutNumber: number | null;
  scoutName: string;
  assignments: number;
  distinctTeams: number;
  repeatFocus: number;
  ourTeamFocusAssignments: number;
  topTeamExposures: Array<{ teamNumber: string; count: number }>;
}

const formatMetricValue = (value: number | null | undefined, digits: number = 2) =>
  value == null || !Number.isFinite(value) ? '—' : value.toFixed(digits);

const formatLocalTimestamp = (timestamp: number | null | undefined) =>
  timestamp
    ? new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    }).format(new Date(timestamp))
    : '—';

export default function AdminV4ScoutStaffingPanel({
  adjustmentAmount,
  adjustmentReason,
  adjustmentScout,
  bets,
  ownTeamNumber,
  powerCoinRows,
  powerCoinStatus,
  scoutAssignmentPlan,
  scoutControlStatus,
  scoutExposureRows,
  scoutRosterText,
  searchedTeamNumber,
  teamNameLookup,
  onApplyAdjustment,
  onBack,
  onDisqualifyBet,
  onExportCoverageGaps,
  onExportScoutAssignments,
  onOptimizeScouts,
  onSetAdjustmentAmount,
  onSetAdjustmentReason,
  onSetAdjustmentScout,
  onSettleAllPlayed,
  onSettleMatch,
  onSetScoutRosterText
}: {
  adjustmentAmount: number;
  adjustmentReason: string;
  adjustmentScout: string;
  bets: PowerCoinBet[];
  ownTeamNumber: string;
  powerCoinRows: AdminV4ScoutRewardRow[];
  powerCoinStatus: string;
  scoutAssignmentPlan: ScoutAssignmentPlan | null;
  scoutControlStatus: string;
  scoutExposureRows: AdminV4ScoutExposureRow[];
  scoutRosterText: string;
  searchedTeamNumber: string;
  teamNameLookup: Record<string, string>;
  onApplyAdjustment: () => void | Promise<void>;
  onBack: () => void;
  onDisqualifyBet: (betId: string, disqualified: boolean) => void | Promise<void>;
  onExportCoverageGaps: () => void;
  onExportScoutAssignments: () => void;
  onOptimizeScouts: () => void | Promise<void>;
  onSetAdjustmentAmount: (value: number) => void;
  onSetAdjustmentReason: (value: string) => void;
  onSetAdjustmentScout: (value: string) => void;
  onSettleAllPlayed: () => void | Promise<void>;
  onSettleMatch: (matchKey: string, winner: PowerCoinSettlementWinner) => void | Promise<void>;
  onSetScoutRosterText: (value: string) => void;
}) {
  return (
    <AdminSurface className="p-5">
      <FocusHeader
        eyebrow="Data"
        title="Scout Staffing"
        description="Numbered scout roster, focus-team plans, coverage gaps, incentives, and cleanup live here because they are operations work, not the match-day decision surface."
        action={<AdminButton onClick={onBack}><ChevronLeft className="h-4 w-4" />Back to Data</AdminButton>}
      />

      <div className="mt-5 grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <div className="min-w-0 space-y-5">
          <div className="admin-g2 border border-cyan-400/25 bg-cyan-500/10 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-black text-white">Scout Focus Builder</h3>
                <p className="mt-1 text-sm font-semibold text-cyan-50/75">Paste one numbered scout per line. The optimizer sorts by scout number, then tries to make each scout a specialist in a small set of teams while balancing match coverage.</p>
              </div>
              <div className="admin-g2-sm bg-cyan-400/15 px-3 py-1 text-xs font-black uppercase tracking-wider text-cyan-100">
                {scoutAssignmentPlan ? formatLocalTimestamp(scoutAssignmentPlan.createdAt) : 'No plan'}
              </div>
            </div>
            <textarea
              value={scoutRosterText}
              onChange={event => onSetScoutRosterText(event.target.value)}
              rows={6}
              className="admin-g2-sm mt-4 w-full border border-cyan-300/25 bg-slate-950 px-4 py-3 text-sm font-semibold text-white outline-none focus:border-cyan-300"
              placeholder={'1, Scout Name\n2, Scout Name\n3, Scout Name'}
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <AdminButton tone="cyan" onClick={() => void onOptimizeScouts()}>
                <Users className="h-4 w-4" />Optimize Focus Plan
              </AdminButton>
              <AdminButton tone="slate" onClick={onExportScoutAssignments}>
                <Download className="h-4 w-4" />Export Focus Plan
              </AdminButton>
              <AdminButton tone="amber" onClick={onExportCoverageGaps}>
                <Download className="h-4 w-4" />Export Gaps
              </AdminButton>
            </div>
            {scoutControlStatus && (
              <div className="mt-3 admin-g2-sm border border-cyan-400/30 bg-cyan-400/10 px-4 py-3 text-sm font-semibold text-cyan-100">
                {scoutControlStatus}
              </div>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-5">
            <SummaryCard label="Focus Rows" value={scoutAssignmentPlan?.assignments.length ?? 0} />
            <SummaryCard label="Scouts" value={scoutAssignmentPlan?.scoutCount ?? 0} />
            <SummaryCard label="Avg Load" value={scoutAssignmentPlan ? formatMetricValue(scoutAssignmentPlan.assignments.length / Math.max(1, scoutAssignmentPlan.scoutCount), 1) : '—'} />
            <SummaryCard label="Our Team" value={scoutAssignmentPlan?.assignments.filter(assignment => assignment.priorityReason === 'Our match priority').length ?? 0} />
            <SummaryCard label="Gaps" value={scoutAssignmentPlan?.coverageGaps?.length ?? 0} />
          </div>

          {(scoutAssignmentPlan?.coverageGaps?.length || 0) > 0 && (
            <div className="admin-g2 border border-amber-400/25 bg-amber-500/10 p-4">
              <div className="text-sm font-black text-amber-100">Coverage Gaps</div>
              <p className="mt-1 text-xs font-semibold text-amber-100/70">Fix these before the match starts so nobody assumes every team has a focused scout.</p>
              <div className="mt-3 max-h-52 overflow-y-auto admin-g2-sm border border-amber-300/20">
                <table className="admin-sticky-table min-w-full text-left text-sm">
                  <thead className="sticky top-0 bg-amber-950 text-xs uppercase tracking-wider text-amber-100">
                    <tr>
                    {['Match', 'Team Position', 'Team', 'Reason'].map(header => <th key={header} className="px-4 py-3">{header}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-amber-300/10">
                    {scoutAssignmentPlan?.coverageGaps?.map((gap, index) => (
                      <tr key={`${gap.matchKey}_${gap.station}_${index}`}>
                        <td className="px-4 py-3 font-mono font-black text-amber-50">{gap.matchKey.toUpperCase()}</td>
                        <td className="px-4 py-3 text-amber-100">{gap.alliance} {gap.alliancePosition}</td>
                        <td className="px-4 py-3 text-amber-100">
                          <TeamBadge teamNumber={gap.teamNumber} ownTeamNumber={ownTeamNumber} searchedTeamNumber={searchedTeamNumber} teamName={teamNameLookup[gap.teamNumber] || ''} />
                        </td>
                        <td className="px-4 py-3 text-amber-100/80">{gap.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="admin-g2 border border-slate-800 bg-slate-950/70 p-4">
            <FocusHeader title="Scout Load" description="Who is assigned, what teams they repeatedly see, and whether our own team gets focused coverage." />
            <div className="mt-4 max-h-72 overflow-y-auto admin-g2-sm border border-slate-800">
              <table className="admin-sticky-table min-w-full text-left text-sm">
                <thead className="sticky top-0 bg-slate-950 text-xs uppercase tracking-wider text-slate-400">
                  <tr>
                    {['Scout #', 'Scout', 'Focus Rows', 'Teams', 'Repeat Focus', 'Our Team', 'Top Exposures'].map(header => <th key={header} className="px-4 py-3">{header}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {scoutExposureRows.map(row => (
                    <tr key={row.scoutName}>
                      <td className="px-4 py-3 font-mono font-black text-cyan-200">{row.scoutNumber ?? '—'}</td>
                      <td className="px-4 py-3 font-black text-cyan-100">{row.scoutName}</td>
                      <td className="px-4 py-3">{row.assignments}</td>
                      <td className="px-4 py-3">{row.distinctTeams}</td>
                      <td className="px-4 py-3">{row.repeatFocus}</td>
                      <td className="px-4 py-3">{row.ourTeamFocusAssignments}</td>
                      <td className="px-4 py-3 text-slate-400">
                        {row.topTeamExposures.length === 0 ? '—' : (
                          <div className="flex flex-wrap gap-1.5">
                            {row.topTeamExposures.map(exposure => (
                              <span key={`${row.scoutName}_${exposure.teamNumber}`} className="inline-flex items-center gap-1 admin-g2-sm bg-slate-900 px-1.5 py-1">
                                <TeamBadge teamNumber={exposure.teamNumber} ownTeamNumber={ownTeamNumber} searchedTeamNumber={searchedTeamNumber} teamName={teamNameLookup[exposure.teamNumber] || ''} />
                                <span className="pr-1 text-xs font-black text-slate-400">x{exposure.count}</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {scoutExposureRows.length === 0 && (
                    <tr>
                      <td className="px-4 py-4" colSpan={7}>
                        <AdminEmptyState
                          title="No scout focus plan yet"
                          why="Scout load and repeat exposure are only meaningful after a numbered roster exists."
                          action="Paste scout number and name lines, build the focus plan, then check coverage balance."
                        />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="admin-g2 border border-slate-800 bg-slate-950/70 p-4">
            <FocusHeader title="Team Focus Plan" description="The match-by-match team plan scouts need before quals or practice matches." />
            <div className="mt-4 max-h-96 overflow-y-auto admin-g2-sm border border-slate-800">
              <table className="admin-sticky-table min-w-full text-left text-sm">
                <thead className="sticky top-0 bg-slate-950 text-xs uppercase tracking-wider text-slate-400">
                  <tr>
                    {['Match', 'Scout #', 'Scout', 'Focus Team', 'Team Position', 'Reason'].map(header => <th key={header} className="px-4 py-3">{header}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {scoutAssignmentPlan?.assignments.map((assignment, index) => (
                    <tr key={`${assignment.matchKey}_${assignment.station}_${index}`}>
                      <td className="px-4 py-3 font-mono text-white">{assignment.matchKey.toUpperCase()}</td>
                      <td className="px-4 py-3 font-mono font-black text-cyan-200">{assignment.scoutNumber ?? '—'}</td>
                      <td className="px-4 py-3 font-black text-cyan-200">{assignment.scoutName}</td>
                      <td className="px-4 py-3">
                        <TeamBadge teamNumber={assignment.teamNumber} ownTeamNumber={ownTeamNumber} searchedTeamNumber={searchedTeamNumber} teamName={teamNameLookup[assignment.teamNumber] || ''} />
                      </td>
                      <td className="px-4 py-3">{assignment.alliance} {assignment.alliancePosition}</td>
                      <td className="px-4 py-3 text-slate-400">{assignment.priorityReason}</td>
                    </tr>
                  ))}
                  {(!scoutAssignmentPlan || scoutAssignmentPlan.assignments.length === 0) && (
                    <tr>
                      <td className="px-4 py-4" colSpan={6}>
                        <AdminEmptyState
                          title="No team-focus assignments yet"
                          why="Scouts need a concrete match, focused team, and reason before this sheet can be used at the field."
                          action="Build the focus plan from the numbered roster and loaded schedule."
                        />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <AdminV4ScoutRewardsPanel
          rows={powerCoinRows}
          bets={bets}
          status={powerCoinStatus}
          adjustmentScout={adjustmentScout}
          adjustmentAmount={adjustmentAmount}
          adjustmentReason={adjustmentReason}
          onSetAdjustmentScout={onSetAdjustmentScout}
          onSetAdjustmentAmount={onSetAdjustmentAmount}
          onSetAdjustmentReason={onSetAdjustmentReason}
          onApplyAdjustment={onApplyAdjustment}
          onDisqualifyBet={onDisqualifyBet}
          onSettleAllPlayed={onSettleAllPlayed}
          onSettleMatch={onSettleMatch}
        />
      </div>
    </AdminSurface>
  );
}
