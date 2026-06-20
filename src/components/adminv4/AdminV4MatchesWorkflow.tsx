import React from 'react';
import { Info, Swords } from 'lucide-react';
import { AdminButton, AdminSurface } from './AdminV4Primitives';
import { AdminEmptyState, FocusHeader, MetricField, SummaryCard, TeamList } from './AdminV4UiAtoms';

export interface AdminV4MatchForecastRow {
  key: string;
  title: string;
  redTeams: string[];
  blueTeams: string[];
  redScore: string;
  blueScore: string;
  predictedWinner: string;
  predictionLowConfidence: boolean;
  includesOwnTeam: boolean;
  ownAlliance: 'Red' | 'Blue' | '';
  ourPpaLabel: string;
  ourPpaRange: string;
  opponentPpaLabel: string;
  opponentPpaRange: string;
  evidenceGapCount: number;
  riskTeamCount: number;
  attentionText: string;
  trustLabel: string;
  trustTone: 'amber' | 'emerald';
  trustDetail: string;
}

export interface AdminV4PlayedMatchRow {
  key: string;
  label: string;
  redScore: number;
  blueScore: number;
}

export interface AdminV4MatchesNextAction {
  label: string;
  detail: string;
  actionLabel: string;
  tone: 'rose' | 'amber' | 'emerald' | 'fuchsia' | 'cyan';
  onAction: () => void;
}

const getPriorityCardClass = (row: AdminV4MatchForecastRow) => {
  if (row.includesOwnTeam) return 'border-fuchsia-400/35 bg-fuchsia-500/10';
  if (row.evidenceGapCount > 0 || row.riskTeamCount > 0) return 'border-amber-400/30 bg-amber-500/10';
  return 'border-slate-800 bg-slate-950';
};

export function AdminV4MatchesWorkflow({
  predictorUnavailableMessage,
  predictorIsLoading,
  predictorMatchSourceLabel,
  modelAction,
  nextAction,
  priorityRows,
  forecastRows,
  playedRows,
  ownTeamNumber,
  searchedTeamNumber,
  teamNameLookup,
  onManualSimulator,
  onOpenMatch,
  onOpenPpaWiki,
  onOpenPpaInfoMenu
}: {
  predictorUnavailableMessage: string;
  predictorIsLoading: boolean;
  predictorMatchSourceLabel: string;
  modelAction: React.ReactNode;
  nextAction: AdminV4MatchesNextAction;
  priorityRows: AdminV4MatchForecastRow[];
  forecastRows: AdminV4MatchForecastRow[];
  playedRows: AdminV4PlayedMatchRow[];
  ownTeamNumber: string;
  searchedTeamNumber: string;
  teamNameLookup: Record<string, string>;
  onManualSimulator: () => void;
  onOpenMatch: (matchKey: string) => void;
  onOpenPpaWiki: () => void;
  onOpenPpaInfoMenu: (event: React.MouseEvent) => void;
}) {
  const nextActionToneClass: Record<AdminV4MatchesNextAction['tone'], string> = {
    rose: 'border-rose-400/30 bg-rose-500/10 text-rose-50',
    amber: 'border-amber-400/30 bg-amber-500/10 text-amber-50',
    emerald: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-50',
    fuchsia: 'border-fuchsia-400/30 bg-fuchsia-500/10 text-fuchsia-50',
    cyan: 'border-cyan-400/30 bg-cyan-500/10 text-cyan-50'
  };
  const matchControls = (
    <div className="flex flex-wrap items-center gap-3">
      {modelAction}
      <AdminButton tone="fuchsia" onClick={onManualSimulator}>
        <Swords className="h-4 w-4" />Manual Simulator
      </AdminButton>
    </div>
  );

  return (
    <div className="space-y-5">
      <AdminSurface className="p-5">
        <FocusHeader
          eyebrow="Matches"
          title="Automatic Future Match Simulations"
          description={`Every known future match is simulated here first. Manual simulator is reserved for custom what-if alliances. Source: ${predictorMatchSourceLabel}`}
        />
        {predictorUnavailableMessage && <div className="mt-4 admin-g2-sm border border-amber-400/30 bg-amber-500/10 p-4 text-sm font-semibold text-amber-100">{predictorUnavailableMessage}</div>}
        {predictorIsLoading && <div className="mt-4 text-sm font-black text-cyan-100">Loading predictor data...</div>}
        <button
          type="button"
          onClick={nextAction.onAction}
          className={`admin-g2 mt-5 hidden w-full flex-col gap-3 border p-4 text-left transition-colors hover:bg-slate-900 md:flex md:flex-row md:items-center md:justify-between ${nextActionToneClass[nextAction.tone]}`}
        >
          <span className="min-w-0">
            <span className="block text-[10px] font-black uppercase tracking-[0.18em] opacity-75">Do This First</span>
            <span className="mt-1 block text-lg font-black text-white">{nextAction.label}</span>
            <span className="mt-1 block text-sm font-semibold leading-relaxed opacity-85">{nextAction.detail}</span>
          </span>
          <span className="admin-g2-sm shrink-0 border border-white/15 bg-white/10 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-white/85">
            {nextAction.actionLabel}
          </span>
        </button>
        <section className="admin-g2-sm mt-4 border border-fuchsia-400/25 bg-fuchsia-500/10 p-3 md:hidden">
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-fuchsia-200">Phone Match Prep</div>
          <div className="mt-1 text-sm font-black text-white">Use the next known match first; use manual sim only for custom alliances.</div>
          <div className="mt-3 grid gap-2">
            <button
              type="button"
              onClick={nextAction.onAction}
              className={`admin-g2-sm flex min-h-14 items-center justify-between gap-3 border px-3 py-2 text-left transition-colors ${nextActionToneClass[nextAction.tone]}`}
              aria-label={`Open match prep shortcut: ${nextAction.label}. ${nextAction.detail}`}
              title={`Open ${nextAction.label}`}
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-black text-white">{nextAction.label}</span>
                <span className="mt-0.5 block truncate text-[11px] font-semibold opacity-80">{nextAction.detail}</span>
              </span>
              <span className="admin-g2-sm shrink-0 border border-white/15 bg-white/10 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-white/80">
                {nextAction.actionLabel}
              </span>
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onManualSimulator}
                className="admin-g2-sm min-h-12 border border-fuchsia-400/30 bg-fuchsia-500/10 px-3 py-2 text-left text-xs font-black text-fuchsia-50 transition-colors hover:bg-fuchsia-500/15"
                aria-label="Open manual simulator for a custom what-if alliance"
                title="Manual simulator is for custom what-if alliances"
              >
                Manual What-if
              </button>
              <button
                type="button"
                onClick={onOpenPpaWiki}
                onContextMenu={onOpenPpaInfoMenu}
                className="admin-g2-sm min-h-12 border border-cyan-400/30 bg-cyan-500/10 px-3 py-2 text-left text-xs font-black text-cyan-50 transition-colors hover:bg-cyan-500/15"
                aria-label="Open expected range math for match forecasts"
                title="Open expected range math"
              >
                Forecast Math
              </button>
            </div>
          </div>
        </section>
        <div className="mt-4 hidden md:block">{matchControls}</div>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <SummaryCard label="Auto Simulations" value={forecastRows.length} />
          <SummaryCard label="Next Known Match" value={forecastRows[0]?.title || 'None'} />
          <SummaryCard label="Manual Simulator" value="Custom only" />
        </div>
        <div className="mt-5 grid gap-3 xl:grid-cols-4">
          {priorityRows.map(row => (
            <button
              key={`priority-${row.key}`}
              type="button"
              onClick={() => onOpenMatch(row.key)}
              className={`admin-g2-sm border p-4 text-left transition-colors hover:bg-slate-900 ${getPriorityCardClass(row)}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-mono text-sm font-black text-white">{row.title}</div>
                  <div className="mt-1 text-xs font-semibold text-slate-500">
                    {row.ownAlliance ? `Our alliance: ${row.ownAlliance}` : 'Neutral watch'}
                  </div>
                </div>
                <span className="admin-g2-sm border border-white/10 bg-white/10 px-2 py-1 text-[10px] font-black uppercase text-white/70">
                  {row.predictionLowConfidence ? 'Low trust' : 'Plan'}
                </span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <MetricField label={row.ourPpaLabel} value={row.ourPpaRange} />
                <MetricField label={row.opponentPpaLabel} value={row.opponentPpaRange} />
                <MetricField label="Evidence Gaps" value={`${row.evidenceGapCount}`} />
                <MetricField label="Risk Teams" value={`${row.riskTeamCount}`} />
              </div>
              <div className="mt-3 text-xs font-semibold leading-relaxed text-slate-400">{row.attentionText}</div>
            </button>
          ))}
          {priorityRows.length === 0 && (
            <AdminEmptyState
              title="No automatic future simulations yet"
              why="Matches can only auto-simulate when the event schedule has future matches with known teams."
              action="Refresh live sources, upload a schedule in Data / Imports, or use Manual Simulator for a custom what-if."
              className="xl:col-span-4"
            />
          )}
        </div>
        <div className="mt-4 max-h-[620px] overflow-auto admin-g2-sm border border-slate-800">
          <table className="admin-sticky-table min-w-full text-left text-sm">
            <thead className="sticky top-0 bg-slate-950 text-xs uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-4 py-3">Simulation</th>
                <th className="px-4 py-3">Red</th>
                <th className="px-4 py-3">Blue</th>
                <th className="px-4 py-3">Red Score</th>
                <th className="px-4 py-3">Blue Score</th>
                <th className="px-4 py-3">
                  <button
                    type="button"
                    onClick={onOpenPpaWiki}
                    onContextMenu={onOpenPpaInfoMenu}
                    className="admin-g2-sm inline-flex min-h-10 items-center gap-2 px-2 text-left hover:bg-slate-900 hover:text-white"
                  >
                    Expected Range <Info className="h-3.5 w-3.5" />
                  </button>
                </th>
                <th className="px-4 py-3">Winner</th>
                <th className="px-4 py-3">Trust</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {forecastRows.map(row => (
                <tr
                  key={row.key}
                  role="button"
                  tabIndex={0}
                  className="cursor-pointer hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
                  onClick={() => onOpenMatch(row.key)}
                  onKeyDown={event => {
                    if (event.key !== 'Enter' && event.key !== ' ') return;
                    event.preventDefault();
                    onOpenMatch(row.key);
                  }}
                >
                  <td className="px-4 py-3">
                    <div className="font-mono font-black text-white">{row.title}</div>
                    {row.includesOwnTeam && (
                      <div className="mt-1 text-[10px] font-black uppercase tracking-[0.16em] text-fuchsia-200">Our match</div>
                    )}
                  </td>
                  <td className="px-4 py-3"><TeamList teams={row.redTeams} ownTeamNumber={ownTeamNumber} searchedTeamNumber={searchedTeamNumber} teamNameLookup={teamNameLookup} /></td>
                  <td className="px-4 py-3"><TeamList teams={row.blueTeams} ownTeamNumber={ownTeamNumber} searchedTeamNumber={searchedTeamNumber} teamNameLookup={teamNameLookup} /></td>
                  <td className="px-4 py-3 font-black text-red-100">{row.redScore}</td>
                  <td className="px-4 py-3 font-black text-blue-100">{row.blueScore}</td>
                  <td className="px-4 py-3">
                    <div className="grid gap-1 text-xs font-semibold text-slate-400">
                      <div><span className="font-black text-red-100">R</span> {row.ownAlliance === 'Blue' ? row.opponentPpaRange : row.ourPpaRange}</div>
                      <div><span className="font-black text-blue-100">B</span> {row.ownAlliance === 'Blue' ? row.ourPpaRange : row.opponentPpaRange}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-black text-cyan-100">{row.predictedWinner}</td>
                  <td className="px-4 py-3">
                    <div className={`admin-g2-sm inline-flex px-2 py-1 text-xs font-black ${row.trustTone === 'amber' ? 'border border-amber-400/30 bg-amber-500/10 text-amber-100' : 'border border-emerald-400/30 bg-emerald-500/10 text-emerald-100'}`}>
                      {row.trustLabel}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">{row.trustDetail}</div>
                  </td>
                </tr>
              ))}
              {forecastRows.length === 0 && (
                <tr>
                  <td className="px-4 py-4" colSpan={8}>
                    <AdminEmptyState
                      title="Future match table is waiting for a schedule"
                      why="This table affects drive-team prep. Without a future schedule, the app cannot keep you on the current upcoming match."
                      action="Load TBA/FIRST schedule data, upload TBA files, or open the manual simulator for a one-off check."
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </AdminSurface>

      <AdminSurface className="p-5">
        <FocusHeader title="Played Results" description="Kept here for context without turning Matches into a giant results dump." />
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {playedRows.map(match => (
            <button key={match.key} type="button" onClick={() => onOpenMatch(match.key)} className="admin-g2-sm border border-slate-800 bg-slate-950 p-3 text-left hover:bg-slate-900">
              <div className="font-mono text-sm font-black text-white">{match.label}</div>
              <div className="mt-2 text-xs text-slate-400">Red {match.redScore} / Blue {match.blueScore}</div>
            </button>
          ))}
          {playedRows.length === 0 && (
            <AdminEmptyState
              title="No played results loaded"
              why="Played results explain whether forecasts are calibrated and which local reward predictions can settle."
              action="Refresh official sources or upload played match results once they exist."
              className="md:col-span-2 xl:col-span-5"
            />
          )}
        </div>
      </AdminSurface>
    </div>
  );
}

export default AdminV4MatchesWorkflow;
