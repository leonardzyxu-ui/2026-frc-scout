import { ChevronLeft } from 'lucide-react';
import {
  ModelBacktestResult,
  ModelFeatureSnapshot,
  ModelLabSnapshot,
  ScoutCalibrationRow
} from '../../types';
import { AdminButton, AdminSurface } from './AdminV4Primitives';
import { AdminEmptyState, FocusHeader, SummaryCard } from './AdminV4UiAtoms';

const judgeModelBenchmark = {
  modelName: 'Conservative Role Forecast',
  decidedMatches: 14685,
  winnerAccuracy: 0.753,
  confidence65Accuracy: 0.83,
  confidence75Accuracy: 0.877
};

const formatMetricValue = (value: number | null | undefined, digits = 2) =>
  value == null || !Number.isFinite(value) ? '—' : value.toFixed(digits);

const formatPercentMetric = (value: number | null | undefined, digits = 2) =>
  value == null || !Number.isFinite(value) ? '—' : `${(value * 100).toFixed(digits)}%`;

const formatSignedMetric = (value: number | null | undefined, digits = 2) =>
  value == null || !Number.isFinite(value) ? '—' : `${value >= 0 ? '+' : ''}${value.toFixed(digits)}`;

const formatLocalTimestamp = (timestamp: number | null | undefined) =>
  timestamp
    ? new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    }).format(new Date(timestamp))
    : '—';

const formatFeatureTeamList = (
  teams: string[],
  featuresByTeam: Record<string, Record<string, number>>
) =>
  teams.map(team => {
    const features = featuresByTeam[team] || {};
    return [
      `${team}: local avg ${formatMetricValue(features.ppcBefore ?? null, 1)}`,
      `${formatMetricValue(features.scoutingRowsBefore ?? null, 0)} scout rows`,
      `official avg ${formatMetricValue(features.oprBefore ?? null, 1)}`,
      `${formatMetricValue(features.officialMatchesBefore ?? null, 0)} official matches`
    ].join(' / ');
  }).join(' / ');

export interface AdminV4ModelJudgeSummary {
  winnerAccuracy: number | null;
  correctWinnerPicks: number;
  decidedMatches: number;
  highConfidenceMatches: number;
  highConfidenceAccuracy: number | null;
}

export default function AdminV4ModelValidationPanel({
  backtests,
  bestForecastLayerName,
  bestModelBacktest,
  judgeSummary,
  latestFeatureSnapshot,
  latestModelSnapshot,
  modelSnapshotStatus,
  ppaTeamCount,
  promotionCandidateCount,
  scoutCalibrationRows,
  usableModelCount,
  featureMatchSnapshots,
  onBack
}: {
  backtests: ModelBacktestResult[];
  bestForecastLayerName: string;
  bestModelBacktest: ModelBacktestResult | null | undefined;
  judgeSummary: AdminV4ModelJudgeSummary;
  latestFeatureSnapshot: ModelFeatureSnapshot | null;
  latestModelSnapshot: ModelLabSnapshot | null;
  modelSnapshotStatus: string;
  ppaTeamCount: number;
  promotionCandidateCount: number;
  scoutCalibrationRows: ScoutCalibrationRow[];
  usableModelCount: number;
  featureMatchSnapshots: NonNullable<ModelFeatureSnapshot['matchSnapshots']>;
  onBack: () => void;
}) {
  const calibrationBins = bestModelBacktest?.calibrationBins || [];
  const recentFeatureSnapshots = featureMatchSnapshots.slice(-10);

  return (
    <div className="space-y-5">
      <AdminSurface className="p-5">
        <FocusHeader
          eyebrow="Data"
          title="Model Trust"
          description="Use this before trusting forecasts: promoted model, backtest proof, before-match inputs, and expected-range formation."
          action={<AdminButton onClick={onBack}><ChevronLeft className="h-4 w-4" />Back to Data</AdminButton>}
        />

        <div className="mt-5 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="admin-g2-sm border border-emerald-400/30 bg-emerald-500/10 p-5">
            <div className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200">Baseline For Comparison</div>
            <div className="mt-2 text-3xl font-black text-white">{judgeModelBenchmark.modelName}</div>
            <p className="mt-2 text-sm font-semibold text-emerald-50/85">
              Winner-pick accuracy benchmark from the model research path: {formatPercentMetric(judgeModelBenchmark.winnerAccuracy, 1)} across {judgeModelBenchmark.decidedMatches.toLocaleString()} decided matches.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <SummaryCard label="At 65% Trust" value={formatPercentMetric(judgeModelBenchmark.confidence65Accuracy, 1)} />
              <SummaryCard label="At 75% Trust" value={formatPercentMetric(judgeModelBenchmark.confidence75Accuracy, 1)} />
              <SummaryCard label="Range Teams" value={ppaTeamCount} />
            </div>
          </div>

          <div className="admin-g2-sm border border-cyan-400/30 bg-cyan-500/10 p-5">
            <div className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">Current Event Backtest</div>
            <div className="mt-2 text-3xl font-black text-white">{bestModelBacktest?.modelName || 'Run validation snapshot'}</div>
            <p className="mt-2 text-sm font-semibold text-cyan-50/80">
              {bestModelBacktest
                ? bestModelBacktest.uncertaintyNote
                : 'Collect played qualification matches and scout rows before judging the event-local model.'}
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <SummaryCard label="Winner Accuracy" value={formatPercentMetric(judgeSummary.winnerAccuracy, 1)} />
              <SummaryCard label="Correct Picks" value={`${judgeSummary.correctWinnerPicks}/${judgeSummary.decidedMatches}`} />
              <SummaryCard label="High Trust" value={judgeSummary.highConfidenceMatches} />
              <SummaryCard label="High Trust Acc." value={formatPercentMetric(judgeSummary.highConfidenceAccuracy, 1)} />
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <SummaryCard label="Usable Models" value={usableModelCount} />
          <SummaryCard label="Promotion Candidates" value={`${promotionCandidateCount}/${backtests.length}`} />
          <SummaryCard label="Forecast Layer" value={bestForecastLayerName} />
          <SummaryCard label="Latest Snapshot" value={latestModelSnapshot ? formatLocalTimestamp(latestModelSnapshot.createdAt) : 'None'} />
        </div>
        <div className="mt-5 admin-g2 border border-fuchsia-400/25 bg-fuchsia-500/10 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-fuchsia-200">Forecast Ledger</div>
              <h3 className="mt-1 text-lg font-black text-white">Prediction Evidence Is Time-Stamped</h3>
              <p className="mt-2 max-w-3xl text-sm font-semibold leading-relaxed text-fuchsia-50/80">
                Every model refresh keeps the latest model snapshot and before-match feature snapshots together, so practice and qualification predictions can be reviewed by what was known at that point in time.
              </p>
            </div>
            <div className="grid min-w-[260px] gap-3 sm:grid-cols-2">
              <SummaryCard label="Match Snapshots" value={featureMatchSnapshots.length} />
              <SummaryCard label="Latest Feature Set" value={latestFeatureSnapshot ? formatLocalTimestamp(latestFeatureSnapshot.createdAt) : 'None'} />
            </div>
          </div>
        </div>
        {modelSnapshotStatus && (
          <div className="mt-4 admin-g2-sm border border-slate-800 bg-slate-950 p-4 text-sm font-semibold text-slate-300">
            {modelSnapshotStatus}
            {latestFeatureSnapshot && (
              <span className="ml-2 text-slate-500">
                Feature teams: {Object.keys(latestFeatureSnapshot.featuresByTeam).length}; match snapshots: {latestFeatureSnapshot.matchSnapshots?.length ?? 0}.
              </span>
            )}
          </div>
        )}

        <div className="mt-5 overflow-x-auto admin-g2-sm border border-slate-800">
          <table className="admin-sticky-table min-w-full text-left text-sm">
            <thead className="sticky top-0 bg-slate-950 text-xs uppercase tracking-wider text-slate-400">
              <tr>
                {['Model', 'Promote', 'Ratings', 'Leakage', 'Matches', 'Winner Acc.', 'Avg Trust', 'Brier', 'Score Miss', 'Margin Miss', 'Low Trust', 'Source'].map(header => (
                  <th key={header} className="px-4 py-3">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {backtests.map(result => (
                <tr key={result.modelName} className={result.modelName === bestModelBacktest?.modelName ? 'bg-cyan-500/5' : ''}>
                  <td className="px-4 py-3 font-black text-white">{result.modelName}</td>
                  <td className="px-4 py-3">
                    <span className={`admin-g2-sm px-2 py-1 text-xs font-black ${result.eligibleForPromotion ? 'bg-emerald-500/15 text-emerald-200' : 'bg-amber-500/15 text-amber-200'}`}>
                      {result.eligibleForPromotion ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td className="px-4 py-3">{result.supportsTeamRatings ? 'Yes' : 'No'}</td>
                  <td className="px-4 py-3">{result.leakageRisk}</td>
                  <td className="px-4 py-3">{result.matchesTested}</td>
                  <td className="px-4 py-3">{formatPercentMetric(result.winnerAccuracy, 1)}</td>
                  <td className="px-4 py-3">{formatPercentMetric(result.averageConfidence, 1)}</td>
                  <td className="px-4 py-3">{formatMetricValue(result.brierScore, 3)}</td>
                  <td className="px-4 py-3">{formatMetricValue(result.scoreMae)}</td>
                  <td className="px-4 py-3">{formatMetricValue(result.marginMae)}</td>
                  <td className="px-4 py-3">{formatPercentMetric(result.lowConfidenceRate, 1)}</td>
                  <td className="max-w-sm px-4 py-3 text-slate-400">{result.sourceLabel}</td>
                </tr>
              ))}
              {backtests.length === 0 && (
                <tr>
                  <td className="px-4 py-4" colSpan={12}>
                    <AdminEmptyState
                      title="No model backtests yet"
                      why="The Data model room cannot defend a promoted model until played matches and prior-only features exist."
                      action="Load official results and scouting rows, then refresh Data to generate backtests."
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </AdminSurface>

      <div className="grid gap-5 xl:grid-cols-2">
        <AdminSurface className="p-4">
          <FocusHeader title="Calibration Bins" description="Predicted win rate should be close to actual win rate in each trust band." />
          <div className="mt-4 overflow-x-auto admin-g2-sm border border-slate-800">
            <table className="admin-sticky-table min-w-full text-left text-sm">
              <thead className="sticky top-0 bg-slate-950 text-xs uppercase tracking-wider text-slate-400">
                <tr>
                  {['Bin', 'Matches', 'Predicted', 'Actual', 'Gap'].map(header => <th key={header} className="px-4 py-3">{header}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {calibrationBins.map(bin => (
                  <tr key={`${bin.modelName}-${bin.binLabel}`}>
                    <td className="px-4 py-3 font-black text-white">{bin.binLabel}</td>
                    <td className="px-4 py-3">{bin.matches}</td>
                    <td className="px-4 py-3">{formatPercentMetric(bin.predictedWinRate, 1)}</td>
                    <td className="px-4 py-3">{formatPercentMetric(bin.actualWinRate, 1)}</td>
                    <td className="px-4 py-3">{formatPercentMetric(bin.calibrationGap, 1)}</td>
                  </tr>
                ))}
                {calibrationBins.length === 0 && (
                  <tr>
                    <td className="px-4 py-4" colSpan={5}>
                      <AdminEmptyState
                        title="No calibration bins yet"
                        why="Calibration needs enough past predictions to compare predicted win rate against actual outcomes."
                        action="Refresh after more played official matches are loaded."
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </AdminSurface>

        <AdminSurface className="p-4">
          <FocusHeader title="Scout Calibration" description="Compares V4 scout-side alliance totals with official alliance scores." />
          <div className="mt-4 overflow-x-auto admin-g2-sm border border-slate-800">
            <table className="admin-sticky-table min-w-full text-left text-sm">
              <thead className="sticky top-0 bg-slate-950 text-xs uppercase tracking-wider text-slate-400">
                <tr>
                  {['Scout', 'Assigned', 'Rows', 'Matches', 'Bias', 'Avg Error', 'Abs Error'].map(header => <th key={header} className="px-4 py-3">{header}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {scoutCalibrationRows.map(row => (
                  <tr key={`${row.scoutName}-${row.assignedScoutName}`}>
                    <td className="px-4 py-3 font-black text-white">{row.scoutName}</td>
                    <td className="px-4 py-3 text-slate-300">{row.assignedScoutName || '—'}</td>
                    <td className="px-4 py-3">{row.rows}</td>
                    <td className="px-4 py-3">{row.matches}</td>
                    <td className={`px-4 py-3 font-black ${row.biasLabel === 'balanced' ? 'text-emerald-300' : row.biasLabel === 'under-counting' ? 'text-amber-300' : 'text-rose-300'}`}>{row.biasLabel}</td>
                    <td className="px-4 py-3">{formatSignedMetric(row.averageOfficialMinusScout)}</td>
                    <td className="px-4 py-3">{formatMetricValue(row.averageAbsoluteError)}</td>
                  </tr>
                ))}
                {scoutCalibrationRows.length === 0 && (
                  <tr>
                    <td className="px-4 py-4" colSpan={7}>
                      <AdminEmptyState
                        title="No scout calibration rows yet"
                        why="Scout calibration needs V4 match rows and official alliance scores for the same matches."
                        action="Load official results and keep scouting through played matches."
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </AdminSurface>
      </div>

      <AdminSurface className="p-4">
        <FocusHeader title="Forecast Ledger: What Was Known Before Matches" description="The inputs available before each played qualification match. This protects the backtest from future leakage and gives the head scout a prediction audit trail." />
        <div className="mt-4 overflow-x-auto admin-g2-sm border border-slate-800">
          <table className="admin-sticky-table min-w-full text-left text-sm">
            <thead className="sticky top-0 bg-slate-950 text-xs uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-4 py-3">Match</th>
                <th className="px-4 py-3">Red Before-Match Features</th>
                <th className="px-4 py-3">Blue Before-Match Features</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {recentFeatureSnapshots.map(snapshot => (
                <tr key={snapshot.matchKey}>
                  <td className="px-4 py-3 font-mono font-black text-white">{snapshot.matchKey.toUpperCase()}</td>
                  <td className="px-4 py-3 text-xs text-red-100/80">{formatFeatureTeamList(snapshot.redTeams, snapshot.featuresByTeam)}</td>
                  <td className="px-4 py-3 text-xs text-blue-100/80">{formatFeatureTeamList(snapshot.blueTeams, snapshot.featuresByTeam)}</td>
                </tr>
              ))}
              {recentFeatureSnapshots.length === 0 && (
                <tr>
                  <td className="px-4 py-4" colSpan={3}>
                    <AdminEmptyState
                      title="No before-match feature snapshots yet"
                      why="Feature snapshots prove the model did not peek at the match result it was trying to predict."
                      action="Run forecasts after official schedules and played match results are loaded."
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </AdminSurface>
    </div>
  );
}
