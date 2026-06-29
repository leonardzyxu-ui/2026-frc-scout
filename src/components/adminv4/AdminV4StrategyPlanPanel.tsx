import { StrategyAllianceRpPath, StrategyMatchPlan } from '../../types';
import { AdminSurface } from './AdminV4Primitives';
import { AdminEmptyState, FocusHeader, MetricField, SummaryCard } from './AdminV4UiAtoms';

const formatMetricValue = (value: number | null | undefined, digits: number = 2) =>
  value == null || !Number.isFinite(value) ? '—' : value.toFixed(digits);

const formatPercentMetric = (value: number | null | undefined, digits: number = 2) =>
  value == null || !Number.isFinite(value) ? '—' : `${(value * 100).toFixed(digits)}%`;

const formatSignedMetric = (value: number | null | undefined, digits = 2) =>
  value == null || !Number.isFinite(value) ? '—' : `${value >= 0 ? '+' : ''}${value.toFixed(digits)}`;

function StrategyRpPathCard({ path }: { path: StrategyAllianceRpPath }) {
  return (
    <div className={`admin-g2-sm border p-4 ${path.alliance === 'Red' ? 'border-red-500/25 bg-red-500/10' : 'border-blue-500/25 bg-blue-500/10'}`}>
      <div className={`text-sm font-black ${path.alliance === 'Red' ? 'text-red-100' : 'text-blue-100'}`}>
        {path.alliance} RP Path
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <MetricField label="Projected RP" value={formatMetricValue(path.projectedRp, 1)} />
        <MetricField label="Win RP" value={formatMetricValue(path.winRp, 1)} />
        <MetricField label="Traversal RP" value={formatMetricValue(path.traversalRp ?? path.towerRp, 1)} />
        <MetricField label="Bonus RP" value={formatMetricValue(path.energizedRp + path.superchargedRp, 1)} />
      </div>
      <p className="mt-3 text-xs font-semibold text-slate-400">{path.note}</p>
    </div>
  );
}

function StrategyRoleOptionList({
  title,
  options,
  accentClass
}: {
  title: string;
  options: StrategyMatchPlan['redRoleOptions'];
  accentClass: string;
}) {
  return (
    <div className="admin-g2-sm border border-slate-800 bg-slate-950/70 p-4">
      <div className={`text-sm font-black ${accentClass}`}>{title}</div>
      <div className="mt-3 space-y-2">
        {options.slice(0, 3).map(option => (
          <div key={`${title}-${option.label}`} className={`admin-g2-sm border px-3 py-2 text-sm ${option.recommended ? 'border-emerald-400/30 bg-emerald-500/10' : 'border-slate-800 bg-slate-950'}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-black text-white">{option.label}</div>
              {option.recommended && <span className="admin-g2-sm border border-emerald-400/30 bg-emerald-500/15 px-2 py-1 text-[10px] font-black uppercase text-emerald-100">Recommended</span>}
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
              <MetricField label="Net" value={formatSignedMetric(option.netMargin, 1)} />
              <MetricField label="Cost" value={formatMetricValue(option.offenseCost, 1)} />
              <MetricField label="Defense" value={formatMetricValue(option.defenseValue, 1)} />
            </div>
            <p className="mt-2 text-xs font-semibold text-slate-400">{option.rationale}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminV4StrategyPlanPanel({
  plan,
  winCondition
}: {
  plan: StrategyMatchPlan | null;
  winCondition: string;
}) {
  if (!plan) {
    return (
      <AdminSurface className="border-amber-400/30 bg-amber-500/10 p-5">
        <FocusHeader
          title="Strategy Plan"
          description="Future matches with known teams show role options, RP paths, risk flags, and counter-strategy here."
        />
        <AdminEmptyState
          className="mt-4"
          title="No future-match strategy plan exists for this row yet"
          why="A strategy plan needs a known future match, alliance teams, and enough source data for the forecast."
          action="Load or refresh the schedule, then open a future match from Matches."
        />
      </AdminSurface>
    );
  }

  return (
    <AdminSurface className="p-5">
      <FocusHeader
        eyebrow="Match Help"
        title="Strategy Plan"
        description={`${plan.modelName} · ${plan.modelLowConfidence ? 'low-trust forecast' : 'standard-trust forecast'}`}
      />
      <div className="mt-5 grid gap-3 md:grid-cols-4">
        <SummaryCard label="Role Winner" value={plan.predictedWinner} />
        <SummaryCard label="Optimized Red" value={formatMetricValue(plan.optimizedRedScore, 1)} />
        <SummaryCard label="Optimized Blue" value={formatMetricValue(plan.optimizedBlueScore, 1)} />
        <SummaryCard label="Model Trust" value={formatPercentMetric(plan.confidence, 0)} />
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <StrategyRoleOptionList title="Red Role Options" options={plan.redRoleOptions} accentClass="text-red-100" />
        <StrategyRoleOptionList title="Blue Role Options" options={plan.blueRoleOptions} accentClass="text-blue-100" />
      </div>
      {plan.shiftEngineRedPlan && plan.shiftEngineBluePlan && (
        <div className="admin-g2-sm mt-4 border border-emerald-400/25 bg-emerald-500/10 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-sm font-black text-emerald-100">Shift Role Simulation</div>
              <p className="mt-1 text-xs font-semibold text-emerald-50/70">
                {plan.shiftEngineObjective === 'qualification-rp' ? 'Qualification objective: margin plus RP path protection.' : 'Playoff objective: maximize point-difference contribution.'}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <MetricField label="Margin" value={formatSignedMetric(plan.shiftEngineExpectedMargin, 1)} />
              <MetricField label="Red Win" value={formatPercentMetric(plan.shiftEngineRedWinProbability, 0)} />
            </div>
          </div>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <MetricField label="Red Best Roles" value={plan.shiftEngineRedPlan} />
            <MetricField label="Blue Best Roles" value={plan.shiftEngineBluePlan} />
          </div>
        </div>
      )}
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <StrategyRpPathCard path={plan.redRpPath} />
        <StrategyRpPathCard path={plan.blueRpPath} />
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1fr]">
        <div className="admin-g2-sm border border-cyan-400/25 bg-cyan-500/10 p-4">
          <div className="text-sm font-black text-cyan-100">Win Condition</div>
          <p className="mt-2 text-sm font-semibold text-cyan-50/80">{winCondition}</p>
        </div>
        <div className="admin-g2-sm border border-fuchsia-400/25 bg-fuchsia-500/10 p-4">
          <div className="text-sm font-black text-fuchsia-100">Counter-Strategy</div>
          <p className="mt-2 text-sm font-semibold text-fuchsia-50/80">{plan.opponentCounterStrategy}</p>
        </div>
      </div>
      {plan.riskFlags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {plan.riskFlags.map(flag => (
            <span key={flag} className="admin-g2-sm border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs font-black text-amber-100">
              {flag}
            </span>
          ))}
        </div>
      )}
    </AdminSurface>
  );
}
