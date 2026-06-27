import React from 'react';
import { Info } from 'lucide-react';
import { AdminSurface } from './AdminV4Primitives';
import { AdminEmptyState, FocusHeader, SummaryCard, TeamList } from './AdminV4UiAtoms';

export type AdminV4NowTone = 'rose' | 'amber' | 'emerald' | 'fuchsia' | 'cyan';

export interface AdminV4NowAction {
  label: string;
  detail: string;
  tone: AdminV4NowTone;
  actionLabel: string;
  onAction: () => void;
}

export interface AdminV4NowMatchRow {
  key: string;
  title: string;
  redTeams: string[];
  blueTeams: string[];
  forecast: string;
  ourLabel: string;
  ourRange: string;
  opponentLabel: string;
  opponentRange: string;
  matchRiskNotes: number;
  trust: string;
}

export interface AdminV4NowAlert {
  label: string;
  detail: string;
  tone: AdminV4NowTone;
}

export interface AdminV4CompetitionNeed {
  label: string;
  detail: string;
  actionLabel: string;
  tone: AdminV4NowTone;
  onAction: () => void;
}

export type AdminV4CompetitionPhaseKey = 'practice' | 'qualifications' | 'selection';

export interface AdminV4CompetitionPhase {
  key: AdminV4CompetitionPhaseKey;
  label: string;
  detail: string;
  actionLabel: string;
  tone: AdminV4NowTone;
  onAction: () => void;
}

const toneClass = (tone: AdminV4NowTone) => {
  if (tone === 'rose') return 'border-rose-400/30 bg-rose-500/10 text-rose-100 hover:bg-rose-500/15';
  if (tone === 'amber') return 'border-amber-400/30 bg-amber-500/10 text-amber-100 hover:bg-amber-500/15';
  if (tone === 'emerald') return 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/15';
  if (tone === 'fuchsia') return 'border-fuchsia-400/30 bg-fuchsia-500/10 text-fuchsia-100 hover:bg-fuchsia-500/15';
  return 'border-cyan-400/30 bg-cyan-500/10 text-cyan-100 hover:bg-cyan-500/15';
};

const alertToneClass = (tone: AdminV4NowTone) => {
  if (tone === 'rose') return 'border-rose-400/30 bg-rose-500/10 text-rose-100';
  if (tone === 'amber') return 'border-amber-400/30 bg-amber-500/10 text-amber-100';
  if (tone === 'emerald') return 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100';
  if (tone === 'fuchsia') return 'border-fuchsia-400/30 bg-fuchsia-500/10 text-fuchsia-100';
  return 'border-cyan-400/30 bg-cyan-500/10 text-cyan-100';
};

function ActionCard({
  action,
  primary = false
}: {
  action: AdminV4NowAction;
  primary?: boolean;
}) {
  if (primary) {
    return (
      <button
        type="button"
        onClick={action.onAction}
        className={`admin-g2 w-full border p-4 text-left transition-colors sm:p-5 ${toneClass(action.tone)}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="text-xs font-black uppercase tracking-[0.2em] opacity-80">
            Next Best Action
          </div>
          <span className="admin-g2-sm shrink-0 border border-white/15 bg-white/10 px-3 py-2 text-xs font-black uppercase text-white/80">
            {action.actionLabel}
          </span>
        </div>
        <h3 className="mt-3 text-xl font-black leading-tight text-white sm:text-2xl">
          {action.label}
        </h3>
        <p className="mt-2 max-w-2xl text-sm font-semibold leading-relaxed">{action.detail}</p>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={action.onAction}
      className={`admin-g2-sm w-full border p-4 text-left transition-colors ${toneClass(action.tone)}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-black uppercase tracking-[0.18em] opacity-80">{action.label}</div>
          <p className="mt-2 text-sm font-semibold leading-relaxed">{action.detail}</p>
        </div>
        <span className="admin-g2-sm shrink-0 border border-white/15 bg-white/10 px-2 py-1 text-[10px] font-black uppercase text-white/80">
          {action.actionLabel}
        </span>
      </div>
    </button>
  );
}

export function AdminV4NowWorkflow({
  matchLabel,
  matchDayTrust,
  requiredAction,
  headScoutBrief,
  primaryAction,
  secondaryActions,
  activeCompetitionPhase,
  competitionPhases,
  competitionNeeds,
  predictorMatchSourceLabel,
  modelAction,
  nextMatches,
  ownTeamNumber,
  searchedTeamNumber,
  teamNameLookup,
  isLocalMode,
  loadedScoutingRows,
  playedMatchCount,
  firstCredentialsSaved,
  commandAlerts,
  onOpenMatch,
  onOpenPpaWiki,
  onOpenPpaInfoMenu
}: {
  matchLabel: string;
  matchDayTrust: string;
  requiredAction: string;
  headScoutBrief: React.ReactNode;
  primaryAction: AdminV4NowAction;
  secondaryActions: AdminV4NowAction[];
  activeCompetitionPhase: AdminV4CompetitionPhaseKey;
  competitionPhases: AdminV4CompetitionPhase[];
  competitionNeeds: AdminV4CompetitionNeed[];
  predictorMatchSourceLabel: string;
  modelAction: React.ReactNode;
  nextMatches: AdminV4NowMatchRow[];
  ownTeamNumber: string;
  searchedTeamNumber: string;
  teamNameLookup: Record<string, string>;
  isLocalMode: boolean;
  loadedScoutingRows: number;
  playedMatchCount: number;
  firstCredentialsSaved: boolean;
  commandAlerts: AdminV4NowAlert[];
  onOpenMatch: (matchKey: string) => void;
  onOpenPpaWiki: () => void;
  onOpenPpaInfoMenu: (event: React.MouseEvent) => void;
}) {
  return (
    <div className="space-y-5">
      <AdminSurface className="p-5">
        <FocusHeader
          eyebrow="Match Now"
          title="Next Decision"
          description="One match-day command surface: the next match, whether to trust it, and the safest next click."
        />
        <div className="mt-5 grid gap-3 lg:grid-cols-3">
          <SummaryCard label={ownTeamNumber ? 'Our Next Match' : 'Next Match'} value={matchLabel} />
          <SummaryCard label="Match-Day Trust" value={matchDayTrust} />
          <SummaryCard label="Required Action" value={requiredAction} />
        </div>
        <section aria-label="Competition phase selector" className="admin-g2-sm mt-4 border border-cyan-400/25 bg-slate-950/75 p-3">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">Competition Phase</div>
              <div className="mt-1 text-sm font-black text-white">Select the day we are operating in.</div>
            </div>
            <div className="text-[11px] font-semibold text-slate-500">Selection stays local on this device.</div>
          </div>
          <div className="mt-3 grid gap-2 lg:grid-cols-3">
            {competitionPhases.map(phase => {
              const active = phase.key === activeCompetitionPhase;
              return (
                <button
                  key={phase.key}
                  type="button"
                  onClick={phase.onAction}
                  className={`admin-g2-sm flex min-h-28 flex-col justify-between border px-3 py-3 text-left transition-colors ${
                    active ? 'border-white/30 bg-white/10 text-white' : toneClass(phase.tone)
                  }`}
                  aria-pressed={active}
                  aria-label={`Set competition phase to ${phase.label}. ${phase.detail}`}
                  title={`Set phase: ${phase.label}`}
                >
                  <span>
                    <span className="flex items-start justify-between gap-2">
                      <span className="text-base font-black text-white">{phase.label}</span>
                      {active && (
                        <span className="admin-g2-sm border border-white/15 bg-white/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-white/80">
                          Active
                        </span>
                      )}
                    </span>
                    <span className="mt-2 block text-xs font-semibold leading-relaxed opacity-85">{phase.detail}</span>
                  </span>
                  <span className="mt-3 text-[10px] font-black uppercase tracking-[0.14em] opacity-75">{phase.actionLabel}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section
          aria-label="Competition need launcher"
          className="admin-g2-sm mt-4 border border-slate-800 bg-slate-950/75 p-3"
        >
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">Fast Situation Switches</div>
              <div className="mt-1 text-sm font-black text-white">Start with the problem, not the tab name.</div>
            </div>
            <div className="text-[11px] font-semibold text-slate-500">These open focused workflows.</div>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {competitionNeeds.map(need => (
              <button
                key={need.label}
                type="button"
                onClick={need.onAction}
                className={`admin-g2-sm flex min-h-20 flex-col justify-between border px-3 py-3 text-left transition-colors ${toneClass(need.tone)}`}
                aria-label={`Competition mode: ${need.label}. ${need.detail}`}
                title={`Open ${need.label}`}
              >
                <span className="text-sm font-black text-white">{need.label}</span>
                <span className="mt-1 line-clamp-2 text-xs font-semibold leading-relaxed opacity-85">{need.detail}</span>
                <span className="mt-2 text-[10px] font-black uppercase tracking-[0.14em] opacity-75">{need.actionLabel}</span>
              </button>
            ))}
          </div>
        </section>
        <section className="admin-g2-sm mt-4 border border-cyan-400/25 bg-cyan-500/10 p-3 md:hidden">
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">Phone Shortcuts</div>
          <div className="mt-1 text-sm font-black text-white">Tap the match-day job, not the tab name</div>
          <div className="mt-3 grid gap-2">
            {[primaryAction, ...secondaryActions].slice(0, 4).map(action => (
              <button
                key={`phone-${action.label}`}
                type="button"
                onClick={action.onAction}
                className={`admin-g2-sm flex min-h-14 items-center justify-between gap-3 border px-3 py-2 text-left transition-colors ${toneClass(action.tone)}`}
                aria-label={`Open phone shortcut: ${action.label}. ${action.detail}`}
                title={`Open ${action.label}`}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-black text-white">{action.label}</span>
                  <span className="mt-0.5 block truncate text-[11px] font-semibold opacity-80">{action.detail}</span>
                </span>
                <span className="admin-g2-sm shrink-0 border border-white/15 bg-white/10 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-white/80">
                  {action.actionLabel}
                </span>
              </button>
            ))}
          </div>
        </section>
        <div className="mt-5 hidden gap-4 md:grid xl:grid-cols-[minmax(0,1fr)_360px]">
          <ActionCard action={primaryAction} primary />

          <section
            aria-label="Other useful match-day actions"
            className="admin-g2-sm border border-slate-800 bg-slate-950/75 p-3"
          >
            <div className="text-sm font-black text-slate-200">
              Other Useful Actions
            </div>
            <div className="mt-3 space-y-2">
              {secondaryActions.map(action => (
                <ActionCard key={action.label} action={action} />
              ))}
              {secondaryActions.length === 0 && (
                <AdminEmptyState
                  title="No secondary action is queued"
                  why="The next best action is currently the only required match-day task."
                  action="Use the primary action, or open search if you need another workflow."
                />
              )}
            </div>
          </section>
        </div>

        <details className="admin-g2-sm mt-4 border border-fuchsia-400/25 bg-slate-950/75 p-3">
          <summary className="cursor-pointer list-none text-sm font-black text-fuchsia-100">
            Open Match Plan Details
          </summary>
          <div className="admin-details-body mt-4">
            {headScoutBrief}
          </div>
        </details>
      </AdminSurface>

      <AdminSurface className="min-w-0 p-4">
        <FocusHeader
          title="Why And What Is Next"
          description="Secondary details are collapsed so Match Now stays focused on the current decision."
        />
        <div className="mt-4 space-y-3">
          <details className="admin-g2-sm border border-slate-800 bg-slate-950/75 p-3">
            <summary className="cursor-pointer list-none text-sm font-black text-slate-200">
              Upcoming Matches And Forecast Source
            </summary>
            <div className="admin-details-body">
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm font-semibold text-slate-400">Forecast source: <span className="font-black text-slate-100">{predictorMatchSourceLabel}</span></div>
                {modelAction}
              </div>
              <div className="admin-g2-sm mt-4 min-w-0 overflow-x-auto border border-slate-800">
                <table className="admin-sticky-table min-w-[420px] text-left text-sm sm:min-w-full">
                  <thead className="bg-slate-950 text-xs uppercase tracking-wider text-slate-400">
                    <tr>
                      <th className="px-4 py-3">Match</th>
                      <th className="px-4 py-3">Red</th>
                      <th className="px-4 py-3">Blue</th>
                      <th className="px-4 py-3">Forecast</th>
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
                      <th className="px-4 py-3">Trust</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {nextMatches.map(match => (
                      <tr
                        key={match.key}
                        role="button"
                        tabIndex={0}
                        className="cursor-pointer hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
                        onClick={() => onOpenMatch(match.key)}
                        onKeyDown={event => {
                          if (event.key !== 'Enter' && event.key !== ' ') return;
                          event.preventDefault();
                          onOpenMatch(match.key);
                        }}
                      >
                        <td className="px-4 py-3 font-mono font-black text-white">{match.title}</td>
                        <td className="px-4 py-3"><TeamList teams={match.redTeams} ownTeamNumber={ownTeamNumber} searchedTeamNumber={searchedTeamNumber} teamNameLookup={teamNameLookup} /></td>
                        <td className="px-4 py-3"><TeamList teams={match.blueTeams} ownTeamNumber={ownTeamNumber} searchedTeamNumber={searchedTeamNumber} teamNameLookup={teamNameLookup} /></td>
                        <td className="px-4 py-3 font-black text-cyan-100">{match.forecast}</td>
                        <td className="px-4 py-3">
                          <div className="grid gap-1 text-xs font-semibold text-slate-400">
                            <div><span className="font-black text-white">{match.ourLabel}</span> {match.ourRange}</div>
                            <div><span className="font-black text-white">{match.opponentLabel}</span> {match.opponentRange}</div>
                            {match.matchRiskNotes > 0 && (
                              <div className="font-black text-amber-100">
                                {match.matchRiskNotes} range warning{match.matchRiskNotes === 1 ? '' : 's'}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">{match.trust}</td>
                      </tr>
                    ))}
                    {nextMatches.length === 0 && (
                      <tr>
                        <td className="px-4 py-4" colSpan={6}>
                          <AdminEmptyState
                            title="No next match can be briefed yet"
                            why="Match Now is only useful when the app knows a future match and the teams in it."
                            action="Refresh official sources or upload a schedule in Data / Imports before using this as the head-scout brief."
                          />
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </details>

          <details className="admin-g2-sm border border-slate-800 bg-slate-950/75 p-3">
            <summary className="cursor-pointer list-none text-sm font-black text-slate-200">
              Source Status And Warnings
            </summary>
            <div className="admin-details-body mt-4 grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
              <div className="admin-g2-sm border border-slate-800 bg-slate-950 p-4">
                <div className="text-sm font-black text-white">Newest Updates</div>
                <div className="mt-3 space-y-2 text-sm text-slate-400">
                  <div>Data mode: <span className="font-black text-slate-100">{isLocalMode ? 'Local archive' : 'Firebase'}</span></div>
                  <div>Loaded scouting rows: <span className="font-black text-slate-100">{loadedScoutingRows}</span></div>
                  <div>Played matches seen: <span className="font-black text-slate-100">{playedMatchCount}</span></div>
                  <div>FIRST credentials: <span className="font-black text-slate-100">{firstCredentialsSaved ? 'Saved locally' : 'Not saved'}</span></div>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {commandAlerts.map(alert => (
                  <div key={alert.label} className={`admin-g2-sm border p-3 ${alertToneClass(alert.tone)}`}>
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] opacity-80">{alert.label}</div>
                    <div className="mt-1 text-xs font-semibold">{alert.detail}</div>
                  </div>
                ))}
              </div>
            </div>
          </details>
        </div>
      </AdminSurface>
    </div>
  );
}

export default AdminV4NowWorkflow;
