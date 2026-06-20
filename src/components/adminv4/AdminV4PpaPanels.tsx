import React from 'react';
import { PpaAllianceSummary, PpaInsight } from '../../utils/ppaInsights';
import { AdminSurface } from './AdminV4Primitives';
import { AdminV4StatInfoKey } from './AdminV4StatDefinitions';
import { StatInfoButton } from './AdminV4StatControls';
import { MetricField } from './AdminV4UiAtoms';

const formatMetricValue = (value: number | null | undefined, digits: number = 2) =>
  value == null || !Number.isFinite(value) ? '—' : value.toFixed(digits);

const formatPercentMetric = (value: number | null | undefined, digits: number = 2) =>
  value == null || !Number.isFinite(value) ? '—' : `${(value * 100).toFixed(digits)}%`;

const formatSignedMetric = (value: number | null | undefined, digits = 2) =>
  value == null || !Number.isFinite(value) ? '—' : `${value >= 0 ? '+' : ''}${value.toFixed(digits)}`;

const formatPpaRange = (summary: PpaAllianceSummary) =>
  `${formatMetricValue(summary.floor, 0)} / ${formatMetricValue(summary.expected, 0)} / ${formatMetricValue(summary.ceiling, 0)}`;

export function PpaAllianceMiniReadout({
  summary,
  accentClass
}: {
  summary: PpaAllianceSummary;
  accentClass: string;
}) {
  return (
    <div className="mt-3">
      <div className="grid grid-cols-3 gap-2">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Expected</div>
          <div className={`mt-1 text-sm font-black ${accentClass}`}>{formatMetricValue(summary.expected, 1)}</div>
        </div>
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Floor</div>
          <div className="mt-1 text-sm font-black text-white">{formatMetricValue(summary.floor, 1)}</div>
        </div>
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Ceiling</div>
          <div className="mt-1 text-sm font-black text-white">{formatMetricValue(summary.ceiling, 1)}</div>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <span className="admin-g2-sm border border-slate-700 bg-slate-900/70 px-2 py-1 text-[10px] font-black uppercase text-slate-300">
          {summary.confidenceLabel}
        </span>
        <span className="admin-g2-sm border border-emerald-400/25 bg-emerald-500/10 px-2 py-1 text-[10px] font-black text-emerald-100">
          Defense {formatMetricValue(summary.defenseValue, 1)}
        </span>
      </div>
      <div className="mt-2 text-xs font-semibold leading-relaxed text-slate-500">{summary.rolePlan}</div>
      {summary.riskNotes.length > 0 && (
        <div className="mt-2 space-y-1">
          {summary.riskNotes.slice(0, 2).map(note => (
            <div key={note} className="text-xs font-black text-amber-100">{note}</div>
          ))}
        </div>
      )}
    </div>
  );
}

export function PpaAllianceBrief({
  title,
  summary,
  accentClass
}: {
  title: string;
  summary: PpaAllianceSummary;
  accentClass: string;
}) {
  return (
    <AdminSurface className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className={`text-sm font-black ${accentClass}`}>{title}</div>
          <div className="mt-1 text-xs font-semibold text-slate-500">Expected range, role mix, model trust, and risk.</div>
        </div>
      </div>
      <PpaAllianceMiniReadout summary={summary} accentClass={accentClass} />
    </AdminSurface>
  );
}

export function PpaMatchupReadout({
  title = 'Expected Range Matchup',
  redSummary,
  blueSummary,
  redLabel = 'Red',
  blueLabel = 'Blue',
  onInfo,
  onInfoContext
}: {
  title?: string;
  redSummary: PpaAllianceSummary;
  blueSummary: PpaAllianceSummary;
  redLabel?: string;
  blueLabel?: string;
  onInfo?: () => void;
  onInfoContext?: (event: React.MouseEvent) => void;
}) {
  const expectedEdge = redSummary.expected - blueSummary.expected;
  const floorVsCeilingEdge = expectedEdge >= 0
    ? redSummary.floor - blueSummary.ceiling
    : blueSummary.floor - redSummary.ceiling;
  const expectedLeader = expectedEdge === 0 ? 'Even' : expectedEdge > 0 ? redLabel : blueLabel;
  const overlapLow = Math.max(redSummary.floor, blueSummary.floor);
  const overlapHigh = Math.min(redSummary.ceiling, blueSummary.ceiling);
  const rangeOverlap = Math.max(0, overlapHigh - overlapLow);
  const totalRiskNotes = redSummary.riskNotes.length + blueSummary.riskNotes.length;
  const trustLabel = floorVsCeilingEdge > 0
    ? 'Strong edge'
    : totalRiskNotes > 0 || redSummary.confidenceLabel !== 'Trust for plan' || blueSummary.confidenceLabel !== 'Trust for plan'
      ? 'Scout check'
      : 'Range call';
  const trustClass = floorVsCeilingEdge > 0
    ? 'border-emerald-400/30 bg-emerald-500/15 text-emerald-100'
    : trustLabel === 'Scout check'
      ? 'border-amber-400/30 bg-amber-500/15 text-amber-100'
      : 'border-cyan-400/30 bg-cyan-500/15 text-cyan-100';
  const rangeRead = floorVsCeilingEdge > 0
    ? `${expectedLeader} floor clears opponent ceiling by ${formatMetricValue(floorVsCeilingEdge, 1)}`
    : rangeOverlap > 0
      ? `Ranges overlap by ${formatMetricValue(rangeOverlap, 1)}`
      : 'Ranges barely touch';
  const riskRead = totalRiskNotes > 0
    ? [...redSummary.riskNotes.map(note => `${redLabel}: ${note}`), ...blueSummary.riskNotes.map(note => `${blueLabel}: ${note}`)].slice(0, 2)
    : ['No high-risk notes on this matchup.'];

  return (
    <AdminSurface className="border-violet-400/25 bg-violet-500/10 p-4" onContextMenu={onInfoContext}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.18em] text-violet-200">{title}</div>
          <h3 className="mt-1 text-xl font-black text-white">
            {expectedLeader === 'Even' ? 'Expected value is even' : `${expectedLeader} has the expected edge`}
          </h3>
          <p className="mt-2 max-w-3xl text-sm font-semibold leading-relaxed text-violet-50/80">
            Use expected value for the headline forecast, then use floor vs ceiling and risk notes before treating the plan as reliable.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`admin-g2-sm border px-3 py-2 text-xs font-black uppercase ${trustClass}`}>{trustLabel}</span>
          {onInfo && onInfoContext && (
            <StatInfoButton
              statKey="ppa"
              label="Math"
              onInfo={() => onInfo()}
              onInfoContext={event => onInfoContext(event)}
            />
          )}
        </div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <MetricField label="Expected Edge" value={expectedLeader === 'Even' ? 'Even' : `${expectedLeader} ${formatSignedMetric(Math.abs(expectedEdge), 1)}`} />
        <MetricField label="Floor Lock" value={rangeRead} />
        <MetricField label={`${redLabel} Range`} value={formatPpaRange(redSummary)} />
        <MetricField label={`${blueLabel} Range`} value={formatPpaRange(blueSummary)} />
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {riskRead.map(note => (
          <div key={note} className="admin-g2-sm border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs font-black text-slate-300">
            {note}
          </div>
        ))}
      </div>
    </AdminSurface>
  );
}

export function PpaInsightPanel({
  insight,
  onInfo,
  onInfoContext
}: {
  insight: PpaInsight;
  onInfo: (key: AdminV4StatInfoKey) => void;
  onInfoContext: (event: React.MouseEvent, key: AdminV4StatInfoKey) => void;
}) {
  return (
    <AdminSurface className="p-4" onContextMenu={(event: React.MouseEvent) => onInfoContext(event, 'ppa')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-black uppercase tracking-[0.18em] text-violet-300">Expected Range Shape</div>
          <div className="mt-1 text-2xl font-black text-white">
            {formatMetricValue(insight.projected.expected ?? insight.rating)}
          </div>
          <div className="mt-1 text-xs font-semibold text-slate-500">
            {insight.source.label} · {insight.coverage.label}
          </div>
        </div>
        <StatInfoButton statKey="ppa" label="Math" onInfo={onInfo} onInfoContext={onInfoContext} />
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="grid grid-cols-2 gap-2">
          <MetricField label="Expected" value={formatMetricValue(insight.projected.expected ?? insight.rating)} />
          <MetricField label="Role" value={insight.role.label} />
          <MetricField label="Floor" value={formatMetricValue(insight.projected.floor)} />
          <MetricField label="Ceiling" value={formatMetricValue(insight.projected.ceiling)} />
          <MetricField label="Normal Low" value={formatMetricValue(insight.projected.normalLow)} />
          <MetricField label="Normal High" value={formatMetricValue(insight.projected.normalHigh)} />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <MetricField label="Uncertainty" value={insight.uncertainty.level} />
          <MetricField label="Tail Risk" value={insight.tailRisk.label} />
          <MetricField label="Scout Trust" value={formatPercentMetric(insight.coverage.scoutConfidence, 0)} />
          <MetricField label="Matches Logged" value={`${insight.components.matchesLogged}`} />
          <MetricField label="Defense Impact" value={formatMetricValue(insight.components.defenseImpact)} />
          <MetricField label="Volatility" value={formatMetricValue(insight.components.volatility)} />
        </div>
      </div>

      <div className="mt-3 admin-g2-sm border border-slate-800 bg-slate-950 px-3 py-2 text-sm font-semibold text-slate-300">
        {insight.role.reason}
      </div>
      <div className="mt-2 admin-g2-sm border border-slate-800 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-400">
        {insight.explanation}
      </div>
      <details className="admin-g2-sm mt-3 border border-slate-800 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-400">
        <summary className="cursor-pointer font-black text-slate-300">Advanced model proof</summary>
        <div className="admin-details-body mt-2 text-slate-500">
          {insight.source.validationLine}
        </div>
      </details>
      <div className="mt-3 flex flex-wrap gap-2">
        {([
          ['ppaExpected', 'Expected'],
          ['ppaFloor', 'Floor'],
          ['ppaCeiling', 'Ceiling'],
          ['ppaNormalBand', 'Normal Band'],
          ['ppaRole', 'Role'],
          ['ppaUncertainty', 'Uncertainty'],
          ['ppaTailRisk', 'Tail Risk'],
          ['ppaScoutConfidence', 'Scout Trust'],
          ['ppaCoverage', 'Coverage']
        ] as Array<[AdminV4StatInfoKey, string]>).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => onInfo(key)}
            onContextMenu={event => onInfoContext(event, key)}
            className="admin-g2-sm border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-[11px] font-black text-slate-300 transition-colors hover:border-violet-400/45 hover:text-violet-100"
          >
            {label}
          </button>
        ))}
      </div>
      {(insight.uncertainty.reasons.length > 0 || insight.tailRisk.reasons.length > 0) && (
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          <div className="admin-g2-sm border border-slate-800 bg-slate-950/70 px-3 py-2">
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">Why uncertainty is {insight.uncertainty.level}</div>
            <div className="mt-2 space-y-1 text-xs font-semibold text-slate-300">
              {insight.uncertainty.reasons.slice(0, 3).map(reason => <div key={reason}>{reason}</div>)}
            </div>
          </div>
          <div className="admin-g2-sm border border-slate-800 bg-slate-950/70 px-3 py-2">
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">Tail risk</div>
            <div className="mt-2 space-y-1 text-xs font-semibold text-slate-300">
              {insight.tailRisk.reasons.slice(0, 3).map(reason => <div key={reason}>{reason}</div>)}
            </div>
          </div>
        </div>
      )}
      {insight.warnings.length > 0 && (
        <div className="mt-3 space-y-1">
          {insight.warnings.map(warning => (
            <div key={warning} className="admin-g2-sm border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs font-black text-amber-100">
              {warning}
            </div>
          ))}
        </div>
      )}
    </AdminSurface>
  );
}

export function PpaDecisionReadPanel({
  insight,
  matchesLogged,
  onInfo,
  onInfoContext
}: {
  insight: PpaInsight | null;
  matchesLogged: number;
  onInfo: (key: AdminV4StatInfoKey) => void;
  onInfoContext: (event: React.MouseEvent, key: AdminV4StatInfoKey) => void;
}) {
  const role = insight?.role.label || 'Needs role evidence';
  const trustLabel = insight
    ? insight.uncertainty.level === 'Low' && insight.tailRisk.level === 'Low'
      ? 'Trust for planning'
      : insight.uncertainty.level === 'High' || insight.tailRisk.level === 'High'
        ? 'Verify before making it a firm call'
        : 'Useful with a scout check'
    : 'Needs scouting';
  const rangeLabel = insight?.projected.floor != null && insight.projected.ceiling != null
    ? `${formatMetricValue(insight.projected.floor, 1)} to ${formatMetricValue(insight.projected.ceiling, 1)}`
    : 'Needs range evidence';
  const useCase = (() => {
    if (!insight) return 'Send a match scout or load model/source data before this team drives a forecast.';
    if (insight.role.label === 'Defender') return 'Use as a defensive or disruption option, then compare the opportunity cost against alliance scorers.';
    if (insight.role.label === 'Flex') return 'Use as a swing robot: assign scoring first, then pivot to defense if the match shape needs it.';
    if (insight.uncertainty.level === 'High' || insight.tailRisk.level === 'High') return 'Treat the expected value as a range. Watch one more match before making this a must-pick or must-cover team.';
    return 'Use expected value for forecasts, then use the floor as the value to trust in tight strategy calls.';
  })();
  const nextAction = (() => {
    if (!insight) return 'Collect one V4 match row and one pit/profile note.';
    if (matchesLogged < 2) return 'Get two clean local rows before relying on the model in alliance selection.';
    if (insight.components.defenseImpact != null && insight.components.defenseImpact > Math.max(6, (insight.projected.expected || 0) * 0.2)) return 'Ask drive team whether defense assignment is realistic for the next forecast.';
    if (insight.components.volatility != null && insight.components.volatility > 8) return 'Check recent match notes for role change, failure, or rapid improvement.';
    return 'Compare against next-match partners and shortlist role fit.';
  })();

  return (
    <AdminSurface className="border-cyan-400/25 bg-cyan-500/10 p-4" onContextMenu={(event: React.MouseEvent) => onInfoContext(event, 'ppa')}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">Head Scout Read</div>
          <h3 className="mt-1 text-xl font-black text-white">What to do with this team</h3>
          <p className="mt-2 max-w-3xl text-sm font-semibold leading-relaxed text-cyan-50/80">{useCase}</p>
        </div>
        <StatInfoButton statKey="ppa" label="Range Math" onInfo={onInfo} onInfoContext={onInfoContext} />
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <MetricField label="Role" value={role} />
        <MetricField label="Trust" value={trustLabel} />
        <MetricField label="Useful Range" value={rangeLabel} />
        <MetricField label="Rows Seen" value={`${matchesLogged}`} />
      </div>
      <div className="mt-3 admin-g2-sm border border-slate-800 bg-slate-950 px-3 py-2 text-sm font-semibold text-slate-300">
        Next action: <span className="font-black text-cyan-100">{nextAction}</span>
      </div>
    </AdminSurface>
  );
}

export function PpaMiniShape({
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
