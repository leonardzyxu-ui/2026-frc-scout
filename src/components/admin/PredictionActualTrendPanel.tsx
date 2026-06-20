import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CartesianGrid, Legend, Line, LineChart, Tooltip, XAxis, YAxis } from 'recharts';
import { CompletedMatchComparisonRow } from '../../utils/matchPredictor';

type ComparisonPhaseFilter = 'all' | 'qualification' | 'playoff';

interface PredictionActualTrendPanelProps {
  modelName: string;
  eventLabel: string;
  sourceLabel?: string;
  rows: CompletedMatchComparisonRow[];
  isLoading?: boolean;
  errorMessage?: string;
}

interface LinearCalibration {
  slope: number;
  intercept: number;
}

interface ChartComparisonRow extends CompletedMatchComparisonRow {
  chartPredictedWinnerScore: number;
  chartPredictedLoserScore: number;
}

const formatPhaseLabel = (phase: ComparisonPhaseFilter) =>
  phase === 'qualification' ? 'Qualifications' : phase === 'playoff' ? 'Playoffs' : 'All Matches';

const getPickResult = (row: CompletedMatchComparisonRow) => {
  if (row.actualTie || row.predictedTie) return 'Tie';
  return row.winnerPickCorrect ? 'Correct' : 'Incorrect';
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const fitLinearCalibration = (pairs: Array<{ predicted: number; actual: number }>): LinearCalibration => {
  if (pairs.length === 0) return { slope: 1, intercept: 0 };
  if (pairs.length === 1) {
    const pair = pairs[0]!;
    return { slope: 1, intercept: pair.actual - pair.predicted };
  }

  const meanPredicted = pairs.reduce((sum, pair) => sum + pair.predicted, 0) / pairs.length;
  const meanActual = pairs.reduce((sum, pair) => sum + pair.actual, 0) / pairs.length;
  const covariance = pairs.reduce(
    (sum, pair) => sum + (pair.predicted - meanPredicted) * (pair.actual - meanActual),
    0
  );
  const variance = pairs.reduce((sum, pair) => sum + (pair.predicted - meanPredicted) ** 2, 0);
  const rawSlope = variance === 0 ? 1 : covariance / variance;
  const slope = clamp(Number.isFinite(rawSlope) ? rawSlope : 1, 0.35, 2.5);

  return {
    slope,
    intercept: meanActual - slope * meanPredicted
  };
};

const applyCalibration = (value: number, calibration: LinearCalibration) =>
  Math.max(0, calibration.intercept + calibration.slope * value);

function ComparisonTooltip({
  active,
  payload
}: {
  active?: boolean;
  payload?: Array<{ payload: ChartComparisonRow }>;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-950/95 px-4 py-3 shadow-2xl">
      <div className="text-sm font-black text-white">{row.title}</div>
      <div className="mt-1 text-xs font-semibold text-slate-500">{row.matchKey}</div>
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <div className="font-semibold text-amber-300">Actual Winner</div>
        <div className="text-right text-amber-100">{row.actualWinnerScore}</div>
        <div className="font-semibold text-amber-300/80">Predicted Winner</div>
        <div className="text-right text-amber-100">{row.predictedWinnerScore}</div>
        <div className="font-semibold text-amber-300/70">Aligned Winner</div>
        <div className="text-right text-amber-100">{row.chartPredictedWinnerScore.toFixed(1)}</div>
        <div className="font-semibold text-cyan-300">Actual Loser</div>
        <div className="text-right text-cyan-100">{row.actualLoserScore}</div>
        <div className="font-semibold text-cyan-300/80">Predicted Loser</div>
        <div className="text-right text-cyan-100">{row.predictedLoserScore}</div>
        <div className="font-semibold text-cyan-300/70">Aligned Loser</div>
        <div className="text-right text-cyan-100">{row.chartPredictedLoserScore.toFixed(1)}</div>
      </div>
      <div className="mt-3 text-xs font-semibold text-slate-400">
        Pick Result: <span className="text-white">{getPickResult(row)}</span>
      </div>
    </div>
  );
}

function ComparisonTrendChart({
  title,
  subtitle,
  data,
  mode
}: {
  title: string;
  subtitle: string;
  data: CompletedMatchComparisonRow[];
  mode: 'winner' | 'loser';
}) {
  const chartFrameRef = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState(760);
  const isWinnerChart = mode === 'winner';
  const chartData = useMemo<ChartComparisonRow[]>(() => {
    const calibration = fitLinearCalibration(
      data.map(row => ({
        predicted: isWinnerChart ? row.predictedWinnerScore : row.predictedLoserScore,
        actual: isWinnerChart ? row.actualWinnerScore : row.actualLoserScore
      }))
    );

    return data.map(row => ({
      ...row,
      chartPredictedWinnerScore: applyCalibration(row.predictedWinnerScore, calibration),
      chartPredictedLoserScore: applyCalibration(row.predictedLoserScore, calibration)
    }));
  }, [data, isWinnerChart]);

  const valueKeys = isWinnerChart
    ? (['actualWinnerScore', 'chartPredictedWinnerScore'] as const)
    : (['actualLoserScore', 'chartPredictedLoserScore'] as const);

  const chartDomain = useMemo<[number, number]>(() => {
    const values = chartData
      .flatMap(row => valueKeys.map(key => row[key]))
      .filter(value => Number.isFinite(value));
    if (values.length === 0) return [0, 100];

    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const range = Math.max(20, maxValue - minValue);
    const padding = Math.max(10, range * 0.1);

    return [
      Math.max(0, Math.floor((minValue - padding) / 10) * 10),
      Math.ceil((maxValue + padding) / 10) * 10
    ];
  }, [chartData, valueKeys]);

  useEffect(() => {
    const frame = chartFrameRef.current;
    if (!frame) return;

    const updateWidth = () => {
      const nextWidth = Math.floor(frame.getBoundingClientRect().width);
      if (nextWidth > 0) {
        setChartWidth(nextWidth);
      }
    };

    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  const resolvedChartWidth = Math.max(320, chartWidth);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
      <div className="mb-4">
        <h4 className="text-lg font-black text-white">{title}</h4>
        <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
        <p className="mt-2 text-xs font-semibold text-slate-500">
          The dotted line is visually aligned to the event&apos;s scoring scale so the trend comparison is easier to read.
        </p>
      </div>
      <div ref={chartFrameRef} className="h-[340px] min-h-[240px] min-w-0 overflow-hidden">
          <LineChart width={resolvedChartWidth} height={340} data={chartData} margin={{ top: 6, right: 20, bottom: 8, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis
              dataKey="title"
              stroke="#64748b"
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              minTickGap={24}
            />
            <YAxis
              domain={chartDomain}
              stroke="#64748b"
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              tickCount={6}
            />
            <Tooltip content={<ComparisonTooltip />} />
            <Legend wrapperStyle={{ color: '#cbd5e1', fontSize: '12px' }} />
            {isWinnerChart ? (
              <>
                <Line
                  type="monotoneX"
                  dataKey="actualWinnerScore"
                  name="Actual Winner"
                  stroke="#f59e0b"
                  strokeWidth={3}
                  dot={false}
                  activeDot={{ r: 5, fill: '#f59e0b', strokeWidth: 0 }}
                />
                <Line
                  type="monotoneX"
                  dataKey="chartPredictedWinnerScore"
                  name="Aligned Predicted Winner"
                  stroke="#fbbf24"
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  dot={false}
                  activeDot={{ r: 5, fill: '#fbbf24', strokeWidth: 0 }}
                />
              </>
            ) : (
              <>
                <Line
                  type="monotoneX"
                  dataKey="actualLoserScore"
                  name="Actual Loser"
                  stroke="#22d3ee"
                  strokeWidth={3}
                  dot={false}
                  activeDot={{ r: 5, fill: '#22d3ee', strokeWidth: 0 }}
                />
                <Line
                  type="monotoneX"
                  dataKey="chartPredictedLoserScore"
                  name="Aligned Predicted Loser"
                  stroke="#67e8f9"
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  dot={false}
                  activeDot={{ r: 5, fill: '#67e8f9', strokeWidth: 0 }}
                />
              </>
            )}
          </LineChart>
      </div>
    </div>
  );
}

export default function PredictionActualTrendPanel({
  modelName,
  eventLabel,
  sourceLabel,
  rows,
  isLoading = false,
  errorMessage = ''
}: PredictionActualTrendPanelProps) {
  const [phaseFilter, setPhaseFilter] = useState<ComparisonPhaseFilter>('all');

  const filteredRows = useMemo(
    () => rows.filter(row => phaseFilter === 'all' || row.phase === phaseFilter),
    [phaseFilter, rows]
  );

  const summary = useMemo(() => {
    const decisiveRows = filteredRows.filter(row => !row.actualTie && !row.predictedTie && row.winnerPickCorrect !== null);
    const correctRows = decisiveRows.filter(row => row.winnerPickCorrect);
    const meanAbsoluteError =
      filteredRows.length === 0
        ? null
        : filteredRows.reduce((sum, row) => sum + row.absoluteErrorMean, 0) / filteredRows.length;

    return {
      count: filteredRows.length,
      winnerAccuracy: decisiveRows.length === 0 ? null : (correctRows.length / decisiveRows.length) * 100,
      meanAbsoluteError
    };
  }, [filteredRows]);

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 className="text-3xl font-black text-white">Prediction vs Actual</h3>
          <p className="mt-2 text-sm text-slate-400">
            Completed-match backtest using {modelName} predicted scores against actual TBA results from {eventLabel}.
          </p>
          {sourceLabel && <p className="mt-1 text-xs font-semibold text-slate-500">{sourceLabel}</p>}
        </div>
        <div className="inline-flex items-center gap-1 rounded-2xl border border-slate-800 bg-slate-900/60 p-1">
          {(['all', 'qualification', 'playoff'] as ComparisonPhaseFilter[]).map(filter => (
            <button
              key={filter}
              type="button"
              onClick={() => setPhaseFilter(filter)}
              className={`rounded-xl px-4 py-3 text-sm font-black transition-colors ${
                phaseFilter === filter ? 'bg-cyan-500 text-slate-950' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              {formatPhaseLabel(filter)}
            </button>
          ))}
        </div>
      </div>

      {errorMessage && (
        <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm font-semibold text-amber-100">
          {errorMessage}
        </div>
      )}

      {isLoading ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 text-center text-sm font-semibold text-slate-400">
          Loading comparison matches...
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 text-center text-sm font-semibold text-slate-400">
          No completed {phaseFilter === 'all' ? '' : `${formatPhaseLabel(phaseFilter).toLowerCase()} `}matches are available for this comparison yet.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
              <div className="text-xs font-black uppercase tracking-widest text-slate-500">Completed Matches</div>
              <div className="mt-2 text-3xl font-black text-white">{summary.count}</div>
              <div className="mt-2 text-sm text-slate-400">{formatPhaseLabel(phaseFilter)} in this backtest view.</div>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
              <div className="text-xs font-black uppercase tracking-widest text-slate-500">Winner Pick Accuracy</div>
              <div className="mt-2 text-3xl font-black text-amber-300">
                {summary.winnerAccuracy == null ? '--' : `${summary.winnerAccuracy.toFixed(1)}%`}
              </div>
              <div className="mt-2 text-sm text-slate-400">Tie rows are excluded from the percentage.</div>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
              <div className="text-xs font-black uppercase tracking-widest text-slate-500">Mean Absolute Score Error</div>
              <div className="mt-2 text-3xl font-black text-cyan-300">
                {summary.meanAbsoluteError == null ? '--' : summary.meanAbsoluteError.toFixed(1)}
              </div>
              <div className="mt-2 text-sm text-slate-400">Average normalized Winner/Loser score miss.</div>
            </div>
          </div>

          <div className="space-y-5">
            <ComparisonTrendChart
              title="Winners Graph"
              subtitle="Actual vs predicted winner scores across completed matches."
              data={filteredRows}
              mode="winner"
            />
            <ComparisonTrendChart
              title="Losers Graph"
              subtitle="Actual vs predicted loser scores across completed matches."
              data={filteredRows}
              mode="loser"
            />
          </div>
        </>
      )}
    </section>
  );
}
