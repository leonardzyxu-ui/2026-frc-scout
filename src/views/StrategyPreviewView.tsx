import React, { useMemo, useState } from 'react';
import { Activity, Crosshair, Shield, Target, TrendingUp } from 'lucide-react';
import type { MatchScoutingV3Alliance } from '../types';
import {
  buildMatchScoutTimelineEntries,
  deriveMatchScoutShiftRole,
  normalizeMatchScoutShiftActions
} from '../utils/matchScoutTimeline';
import {
  compareAllianceStrategies,
  type ShiftAllianceRolePlan,
  type ShiftStrategyObjective,
  type ShiftStrategyRole,
  type ShiftStrategyTeamInput
} from '../utils/shiftStrategyEngine';

const redTeams: ShiftStrategyTeamInput[] = [
  { teamNumber: '254', contribution: 82, contributionDeviation: 11, defense: 24, defenseDeviation: 7, traversal: 8, traversalDeviation: 3 },
  { teamNumber: '1678', contribution: 64, contributionDeviation: 14, defense: 19, defenseDeviation: 8, traversal: 6, traversalDeviation: 4 },
  { teamNumber: '971', contribution: 48, contributionDeviation: 18, defense: 34, defenseDeviation: 9, traversal: 5, traversalDeviation: 4 }
];

const blueTeams: ShiftStrategyTeamInput[] = [
  { teamNumber: '1323', contribution: 78, contributionDeviation: 13, defense: 21, defenseDeviation: 8, traversal: 7, traversalDeviation: 3 },
  { teamNumber: '4414', contribution: 58, contributionDeviation: 15, defense: 27, defenseDeviation: 9, traversal: 5, traversalDeviation: 4 },
  { teamNumber: '5940', contribution: 43, contributionDeviation: 16, defense: 31, defenseDeviation: 10, traversal: 4, traversalDeviation: 4 }
];

const roleLabels: Record<ShiftStrategyRole, string> = {
  offense: 'Score',
  defense: 'Defend',
  stockpile: 'Stockpile'
};

const roleIcons: Record<ShiftStrategyRole, React.ElementType> = {
  offense: Target,
  defense: Shield,
  stockpile: Crosshair
};

const getOppositeAlliance = (alliance: MatchScoutingV3Alliance): MatchScoutingV3Alliance =>
  alliance === 'Red' ? 'Blue' : alliance === 'Blue' ? 'Red' : '';

const getAllianceTone = (alliance: MatchScoutingV3Alliance) =>
  alliance === 'Red'
    ? 'border-red-400/40 bg-red-950/55 text-red-50'
    : 'border-blue-400/40 bg-blue-950/55 text-blue-50';

const formatPercent = (value: number) => `${Math.round(value * 100)}%`;
const formatSigned = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(1)}`;

function TeamRolePill({ role, teamNumber, mean }: { role: ShiftStrategyRole; teamNumber: string; mean: number }) {
  const Icon = roleIcons[role];
  return (
    <div className="flex items-center justify-between gap-3 border border-white/10 bg-slate-950/45 px-3 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <Icon className="h-4 w-4 shrink-0 text-cyan-200" aria-hidden="true" />
        <span className="truncate font-black text-white">Team {teamNumber}</span>
      </div>
      <div className="shrink-0 text-right">
        <div className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">{roleLabels[role]}</div>
        <div className="font-mono text-sm font-black text-cyan-100">{mean.toFixed(1)}</div>
      </div>
    </div>
  );
}

function PlanSummary({ title, plan }: { title: string; plan: ShiftAllianceRolePlan }) {
  return (
    <section className="border border-slate-800 bg-slate-900/70 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">{title}</div>
          <div className="mt-1 text-lg font-black text-white">{formatSigned(plan.pointDifferenceMean)} point-difference contribution</div>
        </div>
        <TrendingUp className="h-5 w-5 text-emerald-200" aria-hidden="true" />
      </div>
      <div className="mt-4 grid gap-2">
        {plan.assignments.map(assignment => (
          <TeamRolePill
            key={`${assignment.teamNumber}-${assignment.role}`}
            role={assignment.role}
            teamNumber={assignment.teamNumber}
            mean={assignment.mean}
          />
        ))}
      </div>
      {plan.saturationWarning && (
        <div className="mt-3 border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-xs font-semibold text-amber-50">
          {plan.saturationWarning}
        </div>
      )}
    </section>
  );
}

export default function StrategyPreviewView() {
  const [ourAlliance, setOurAlliance] = useState<MatchScoutingV3Alliance>('Red');
  const [firstShiftAlliance, setFirstShiftAlliance] = useState<MatchScoutingV3Alliance>('Red');
  const [objective, setObjective] = useState<ShiftStrategyObjective>('qualification-rp');

  const result = useMemo(() => compareAllianceStrategies(redTeams, blueTeams, { strategyObjective: objective }), [objective]);
  const timelineEntries = useMemo(
    () => buildMatchScoutTimelineEntries([], firstShiftAlliance, ourAlliance),
    [firstShiftAlliance, ourAlliance]
  );
  const ourPlan = ourAlliance === 'Red' ? result.redBestPlan : result.blueBestPlan;
  const opponentAlliance = getOppositeAlliance(ourAlliance);
  const opponentPlan = opponentAlliance === 'Red' ? result.redBestPlan : result.blueBestPlan;
  const ourWinProbability = ourAlliance === 'Red' ? result.redWinProbability : result.blueWinProbability;
  const expectedMargin = ourAlliance === 'Red' ? result.expectedMargin : -result.expectedMargin;

  const getPlanForShift = (alliance: MatchScoutingV3Alliance) => alliance === ourAlliance ? ourPlan : opponentPlan;

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-6 text-white">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-col gap-4 border-b border-slate-800 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">Shift Strategy Preview</div>
            <h1 className="mt-2 text-3xl font-black">Scout-form mirror for the next match</h1>
            <p className="mt-2 max-w-3xl text-sm font-semibold leading-relaxed text-slate-400">
              Same alternating shift rhythm as Match Scout, but read-only: opponent behavior is predicted, and our response plan is highlighted.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="border border-slate-800 bg-slate-900/70 px-3 py-2">
              <div className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Our Win</div>
              <div className="mt-1 font-mono text-xl font-black text-emerald-200">{formatPercent(ourWinProbability)}</div>
            </div>
            <div className="border border-slate-800 bg-slate-900/70 px-3 py-2">
              <div className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Margin</div>
              <div className="mt-1 font-mono text-xl font-black text-cyan-100">{formatSigned(expectedMargin)}</div>
            </div>
            <div className="border border-slate-800 bg-slate-900/70 px-3 py-2">
              <div className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Objective</div>
              <div className="mt-1 text-sm font-black text-white">{objective === 'qualification-rp' ? 'Quals + RP' : 'Point Diff'}</div>
            </div>
          </div>
        </header>

        <section className="mt-5 grid gap-3 lg:grid-cols-3">
          <div className="border border-slate-800 bg-slate-900/70 p-4">
            <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Our Alliance</div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {(['Red', 'Blue'] as const).map(alliance => (
                <button
                  key={alliance}
                  type="button"
                  onClick={() => setOurAlliance(alliance)}
                  className={`px-4 py-3 font-black ${ourAlliance === alliance ? 'bg-cyan-300 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                >
                  {alliance}
                </button>
              ))}
            </div>
          </div>

          <div className="border border-slate-800 bg-slate-900/70 p-4">
            <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">First Shift</div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {(['Red', 'Blue'] as const).map(alliance => (
                <button
                  key={alliance}
                  type="button"
                  onClick={() => setFirstShiftAlliance(alliance)}
                  className={`px-4 py-3 font-black ${firstShiftAlliance === alliance ? 'bg-cyan-300 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                >
                  {alliance} first
                </button>
              ))}
            </div>
          </div>

          <div className="border border-slate-800 bg-slate-900/70 p-4">
            <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Objective</div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {([
                ['qualification-rp', 'Quals + RP'],
                ['point-difference', 'Point Diff']
              ] as Array<[ShiftStrategyObjective, string]>).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setObjective(value)}
                  className={`px-4 py-3 font-black ${objective === value ? 'bg-cyan-300 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-5 grid gap-4 lg:grid-cols-2">
          <PlanSummary title="Our Recommended Response" plan={ourPlan} />
          <PlanSummary title="Opponent Predicted Behavior" plan={opponentPlan} />
        </section>

        <section data-testid="strategy-shift-preview-timeline" className="mt-5 space-y-3">
          {timelineEntries.map(entry => {
            const plan = getPlanForShift(entry.shiftAlliance);
            const actions = normalizeMatchScoutShiftActions({ actions: plan.assignments.map(assignment => assignment.role), role: deriveMatchScoutShiftRole(plan.assignments.map(assignment => assignment.role)) });
            return (
              <article key={entry.id} className={`border p-4 ${getAllianceTone(entry.shiftAlliance)}`}>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="text-xs font-black uppercase tracking-[0.22em] opacity-70">
                      Shift {entry.index + 1} · {entry.phase || 'teleop'} · {entry.shiftAlliance}
                    </div>
                    <h2 className="mt-1 text-xl font-black">
                      {entry.shiftAlliance === ourAlliance ? 'Our recommended move' : 'Opponent predicted move'}
                    </h2>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-slate-300">
                    <Activity className="h-4 w-4" aria-hidden="true" />
                    {actions.map(role => roleLabels[role]).join(' + ')}
                  </div>
                </div>
                <div className="mt-4 grid gap-2 md:grid-cols-3">
                  {plan.assignments.map(assignment => (
                    <TeamRolePill
                      key={`${entry.id}-${assignment.teamNumber}`}
                      role={assignment.role}
                      teamNumber={assignment.teamNumber}
                      mean={assignment.mean}
                    />
                  ))}
                </div>
              </article>
            );
          })}
        </section>
      </div>
    </div>
  );
}
