import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { MatchScoutingV3Alliance } from '../types';
import { buildMatchScoutTimelineEntries } from '../utils/matchScoutTimeline';
import { loadAdminV4Settings } from '../utils/adminV4Settings';
import {
  loadStrategyPreviewSnapshot,
  type StrategyPreviewSnapshot
} from '../utils/strategyPreviewSnapshot';
import {
  compareAllianceStrategies,
  type ShiftAllianceRolePlan,
  type ShiftStrategyAssignment,
  type ShiftStrategyRole,
  type ShiftStrategyTeamInput
} from '../utils/shiftStrategyEngine';

const roleLabels: Record<ShiftStrategyRole, string> = {
  offense: 'Score',
  defense: 'Defend',
  stockpile: 'Stockpile'
};

const formatPercent = (value: number) => `${Math.round(value * 100)}%`;
const formatSigned = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(1)}`;
const formatPoints = (value: number) => Math.max(0, Math.round(value));
const formatSavedAt = (value: number) => {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : 'unknown time';
};

const previewPanelClass = 'admin-g2-lg rounded-[2rem] border border-slate-700/70 bg-slate-900/72 shadow-2xl shadow-slate-950/25';
const previewTileClass = 'admin-g2 rounded-[1.75rem] border border-slate-700/70 bg-slate-950/55';
const shiftCardClass = 'flex h-32 shrink-0 flex-col justify-between overflow-hidden rounded-[1.35rem] border px-3 py-3';
const shiftActionTextClass = 'mt-2 flex h-11 items-center overflow-hidden text-sm font-black leading-[1.2]';

function AllianceSplitReadout({
  value,
  label,
  source,
  statusLabel,
  redLabel = 'Red',
  blueLabel = 'Blue'
}: {
  value: MatchScoutingV3Alliance;
  label: string;
  source: string;
  statusLabel: string;
  redLabel?: string;
  blueLabel?: string;
}) {
  const options = [
    { value: 'Red' as const, label: redLabel, activeClass: 'bg-red-500 text-white shadow-lg shadow-red-950/30' },
    { value: 'Blue' as const, label: blueLabel, activeClass: 'bg-sky-400 text-slate-950 shadow-lg shadow-sky-950/30' }
  ];
  return (
    <section className={`${previewPanelClass} p-5`}>
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">{label}</div>
        <div className="rounded-full border border-white/10 bg-slate-950/55 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-cyan-200">
          {statusLabel}
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 overflow-hidden rounded-full border border-white/10 bg-slate-950/70 p-1">
        {options.map(option => {
          const active = value === option.value;
          return (
            <div
              key={option.value}
              aria-current={active ? 'true' : undefined}
              className={`rounded-full px-5 py-4 text-center text-base font-black transition-all ${
                active
                  ? option.activeClass
                  : 'bg-slate-950/70 text-slate-400'
              }`}
            >
              {option.label}
            </div>
          );
        })}
      </div>
      <div className="mt-3 text-xs font-semibold text-slate-400">{source}</div>
    </section>
  );
}

function MetricTile({ label, value, tone }: { label: string; value: string; tone: 'win' | 'margin' }) {
  return (
    <section className={`${previewTileClass} px-5 py-4`}>
      <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">{label}</div>
      <div className={`mt-2 text-4xl font-black ${tone === 'win' ? 'text-emerald-200' : 'text-cyan-100'}`}>
        {value}
      </div>
    </section>
  );
}

function ProjectedScoreFaceoff({
  redScore,
  blueScore,
  redTeams,
  blueTeams
}: {
  redScore: number;
  blueScore: number;
  redTeams: ShiftStrategyTeamInput[];
  blueTeams: ShiftStrategyTeamInput[];
}) {
  const redTeamNumbers = redTeams.map(team => team.teamNumber);
  const blueTeamNumbers = blueTeams.map(team => team.teamNumber);
  const teamPillClass = "rounded-full border border-white/10 bg-slate-950/65 px-3 py-1 text-xs font-black tracking-[0.14em] text-slate-200";
  return (
    <section className="mt-5 rounded-[2rem] border border-slate-700/70 bg-slate-950/55 px-5 py-5">
      <div className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">Projected Score</div>
      <div className="mx-auto mt-2 grid max-w-4xl grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-2 sm:gap-4">
        <div className="min-w-0 justify-self-end text-right">
          <div className="text-xs font-black uppercase tracking-[0.2em] text-red-200/70">Red</div>
          <div className="text-8xl font-black leading-[0.85] tracking-wide text-red-400 sm:text-9xl">
            {formatPoints(redScore)}
          </div>
        </div>
        <div className="pb-4 text-center text-lg font-black uppercase tracking-[0.2em] text-yellow-300 sm:pb-6">
          vs
        </div>
        <div className="min-w-0 justify-self-start">
          <div className="text-xs font-black uppercase tracking-[0.2em] text-sky-200/70">Blue</div>
          <div className="text-8xl font-black leading-[0.85] tracking-wide text-sky-300 sm:text-9xl">
            {formatPoints(blueScore)}
          </div>
        </div>
      </div>
      <div className="mx-auto mt-3 grid max-w-4xl grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-4">
        <div className="flex flex-wrap justify-end gap-2">
          {redTeamNumbers.map(team => <span key={team} className={teamPillClass}>{team}</span>)}
        </div>
        <div className="h-px w-8 bg-yellow-300/30" aria-hidden="true" />
        <div className="flex flex-wrap justify-start gap-2">
          {blueTeamNumbers.map(team => <span key={team} className={teamPillClass}>{team}</span>)}
        </div>
      </div>
    </section>
  );
}

const getAssignmentForTeam = (plan: ShiftAllianceRolePlan, teamNumber: string) =>
  plan.assignments.find(assignment => assignment.teamNumber === teamNumber) || plan.assignments[0];

const getDefenseTargets = (
  assignment: ShiftStrategyAssignment,
  opponentTeams: ShiftStrategyTeamInput[]
) => {
  const targets = [...opponentTeams].sort((left, right) => right.contribution - left.contribution);
  const first = targets[0]?.teamNumber;
  const second = assignment.mean >= 28 ? targets[1]?.teamNumber : '';
  return [first, second].filter((target): target is string => Boolean(target));
};

const describeShiftAction = (
  assignment: ShiftStrategyAssignment,
  teamAlliance: MatchScoutingV3Alliance,
  shiftAlliance: MatchScoutingV3Alliance,
  opponentTeams: ShiftStrategyTeamInput[]
) => {
  if (assignment.role === 'defense') {
    const targets = getDefenseTargets(assignment, opponentTeams);
    return targets.length > 1
      ? `Defend Team ${targets[0]} + Team ${targets[1]}`
      : `Defend Team ${targets[0] || 'their top scorer'}`;
  }
  if (assignment.role === 'stockpile') return 'Stockpile Fuel';
  if (teamAlliance === shiftAlliance) return `Score ${formatPoints(assignment.mean)} Points`;
  return 'Stockpile Fuel';
};

const getShiftCardTone = (shiftAlliance: MatchScoutingV3Alliance, teamAlliance: MatchScoutingV3Alliance) => {
  if (shiftAlliance === 'Red') {
    return shiftAlliance === teamAlliance
      ? 'border-red-300/50 bg-red-500/18 text-red-50'
      : 'border-red-500/15 bg-red-950/15 text-slate-300';
  }
  return shiftAlliance === teamAlliance
    ? 'border-sky-300/50 bg-sky-400/18 text-sky-50'
    : 'border-sky-500/15 bg-sky-950/15 text-slate-300';
};

function StrategyTeamColumn({
  team,
  alliance,
  plan,
  opponentTeams,
  timelineEntries
}: {
  team: ShiftStrategyTeamInput;
  alliance: MatchScoutingV3Alliance;
  plan: ShiftAllianceRolePlan;
  opponentTeams: ShiftStrategyTeamInput[];
  timelineEntries: ReturnType<typeof buildMatchScoutTimelineEntries>;
}) {
  const assignment = getAssignmentForTeam(plan, team.teamNumber);
  if (!assignment) return null;

  return (
    <article className="min-w-[230px] rounded-[1.85rem] border border-slate-700/80 bg-slate-950/55 p-3">
      <div className="rounded-[1.5rem] border border-white/10 bg-slate-900/75 px-4 py-3">
        <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">{alliance}</div>
        <div className="mt-1 text-xl font-black text-white">Team {team.teamNumber}</div>
        <div className="mt-1 text-xs font-bold text-slate-400">{roleLabels[assignment.role]} plan</div>
      </div>
      <div className="mt-3 space-y-2">
        {timelineEntries.map(entry => {
          const actionText = describeShiftAction(assignment, alliance, entry.shiftAlliance, opponentTeams);
          const actionIsLong = actionText.length > 24;
          return (
            <section
              key={`${team.teamNumber}-${entry.id}`}
              className={`${shiftCardClass} ${getShiftCardTone(entry.shiftAlliance, alliance)}`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="truncate text-[10px] font-black uppercase tracking-[0.18em] opacity-70">
                  Shift {entry.index + 1} · {entry.shiftAlliance}
                </div>
                <div className="shrink-0 rounded-full bg-slate-950/45 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] opacity-80">
                  {entry.shiftAlliance === alliance ? 'Active' : 'Other'}
                </div>
              </div>
              <div className={`${shiftActionTextClass} ${actionIsLong ? 'text-[13px]' : ''}`}>
                {actionText}
              </div>
            </section>
          );
        })}
      </div>
    </article>
  );
}

function ShiftExplorer({
  ourAlliance,
  firstShiftAlliance,
  redTeams,
  blueTeams,
  redPlan,
  bluePlan
}: {
  ourAlliance: MatchScoutingV3Alliance;
  firstShiftAlliance: MatchScoutingV3Alliance;
  redTeams: ShiftStrategyTeamInput[];
  blueTeams: ShiftStrategyTeamInput[];
  redPlan: ShiftAllianceRolePlan;
  bluePlan: ShiftAllianceRolePlan;
}) {
  const timelineEntries = useMemo(
    () => buildMatchScoutTimelineEntries([], firstShiftAlliance, ourAlliance),
    [firstShiftAlliance, ourAlliance]
  );
  const columns = [
    ...redTeams.map(team => ({ team, alliance: 'Red' as const, plan: redPlan, opponentTeams: blueTeams })),
    ...blueTeams.map(team => ({ team, alliance: 'Blue' as const, plan: bluePlan, opponentTeams: redTeams }))
  ];

  return (
    <section data-testid="strategy-shift-preview-timeline" className={`${previewPanelClass} mt-5 p-5`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">Explore Shifts</div>
          <h2 className="mt-1 text-2xl font-black text-white">Per-team shift plan</h2>
        </div>
        <div className="rounded-full border border-white/10 bg-slate-950/55 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-slate-300">
          First shift: {firstShiftAlliance}
        </div>
      </div>
      <div className="mt-5 overflow-x-auto pb-2">
        <div className="grid min-w-max grid-flow-col auto-cols-[230px] gap-3">
          {columns.map(column => (
            <StrategyTeamColumn
              key={`${column.alliance}-${column.team.teamNumber}`}
              team={column.team}
              alliance={column.alliance}
              plan={column.plan}
              opponentTeams={column.opponentTeams}
              timelineEntries={timelineEntries}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function SnapshotSourceNotice({
  snapshot,
  fallbackReason
}: {
  snapshot: StrategyPreviewSnapshot;
  fallbackReason: string | null;
}) {
  const isFallback = snapshot.source === 'fallback-demo';
  return (
    <section className={`mt-5 rounded-[1.35rem] border px-4 py-3 text-sm font-bold ${
      isFallback
        ? 'border-amber-300/35 bg-amber-300/10 text-amber-100'
        : 'border-emerald-300/25 bg-emerald-300/10 text-emerald-100'
    }`}>
      {isFallback
        ? `Fallback demo data. ${fallbackReason || 'Open Admin V4 Matches to publish the next real plan.'}`
        : `Live local strategy snapshot from Admin V4: ${snapshot.matchKey} saved ${formatSavedAt(snapshot.savedAt)} with ${snapshot.modelName}.`}
    </section>
  );
}

export default function StrategyPreviewView() {
  const [isExplorerOpen, setIsExplorerOpen] = useState(true);
  const expectedEventKey = useMemo(() => loadAdminV4Settings().eventKey, []);
  const { snapshot, fallbackReason } = useMemo(
    () => loadStrategyPreviewSnapshot(undefined, { expectedEventKey }),
    [expectedEventKey]
  );
  const { ourAlliance, firstShiftAlliance, redTeams, blueTeams } = snapshot;
  const isLiveSnapshot = snapshot.source === 'admin-v4-local-plan';
  const sourceBadge = isLiveSnapshot ? 'Admin V4 local plan' : 'Demo fallback';

  const result = useMemo(
    () => compareAllianceStrategies(
      redTeams,
      blueTeams,
      { strategyObjective: snapshot.matchType === 'Qualification' ? 'qualification-rp' : 'alliance-selection' }
    ),
    [blueTeams, redTeams, snapshot.matchType]
  );
  const ourWinProbability = ourAlliance === 'Red' ? result.redWinProbability : result.blueWinProbability;
  const expectedMargin = ourAlliance === 'Red' ? result.expectedMargin : -result.expectedMargin;

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-6 text-white">
      <main className="mx-auto max-w-6xl">
        <header className={`${previewPanelClass} p-5 sm:p-6`}>
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">Shift Strategy Preview</div>
              <h1 className="mt-2 text-3xl font-black sm:text-4xl">Next match dashboard</h1>
              <p className="mt-2 max-w-3xl text-sm font-semibold leading-relaxed text-slate-400">
                Drive-team view: win chance, expected margin, alliance side, and a shift-by-shift plan when you need to drill down.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsExplorerOpen(value => !value)}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950 shadow-lg shadow-cyan-950/30 transition hover:bg-cyan-200"
            >
              Explore Shifts
              {isExplorerOpen ? <ChevronUp className="h-4 w-4" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
            </button>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <MetricTile label="Our Win Prob" value={formatPercent(ourWinProbability)} tone="win" />
            <MetricTile label="Our Margin" value={formatSigned(expectedMargin)} tone="margin" />
          </div>

          <ProjectedScoreFaceoff
            redScore={result.expectedRedScore}
            blueScore={result.expectedBlueScore}
            redTeams={redTeams}
            blueTeams={blueTeams}
          />
          <SnapshotSourceNotice snapshot={snapshot} fallbackReason={fallbackReason} />
        </header>

        <section className="mt-5 grid gap-4 lg:grid-cols-2">
          <AllianceSplitReadout
            value={ourAlliance}
            label="Our Alliance"
            statusLabel={sourceBadge}
            source={isLiveSnapshot ? `${snapshot.eventKey} ${snapshot.matchKey}` : 'No real next-match plan has been published yet.'}
          />
          <AllianceSplitReadout
            value={firstShiftAlliance}
            label="First Alliance Shift"
            statusLabel={sourceBadge}
            source={isLiveSnapshot ? `Projected from model baseline: ${snapshot.modelName}` : 'Fallback fixture uses Red as the first shift.'}
            redLabel="Red first"
            blueLabel="Blue first"
          />
        </section>

        {isExplorerOpen && (
          <ShiftExplorer
            ourAlliance={ourAlliance}
            firstShiftAlliance={firstShiftAlliance}
            redTeams={redTeams}
            blueTeams={blueTeams}
            redPlan={result.redBestPlan}
            bluePlan={result.blueBestPlan}
          />
        )}
      </main>
    </div>
  );
}
