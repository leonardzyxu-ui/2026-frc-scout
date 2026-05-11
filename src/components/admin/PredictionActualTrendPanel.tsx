import React, { useMemo } from 'react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ModelBacktestComparisonRow } from '../../types';

interface PredictionActualTrendPanelProps {
  modelName: string;
  sourceLabel?: string;
  rows: ModelBacktestComparisonRow[];
}

interface LinearCalibration {
  slope: number;
  intercept: number;
}

interface ComparisonPoint extends ModelBacktestComparisonRow {
  actualWinnerScore: number;
  actualLoserScore: number;
  predictedWinnerSideScore: number;
  predictedLoserSideScore: number;
  alignedPredictedWinnerScore: number;
  alignedPredictedLoserScore: number;
  actualWinnerCurve: number;
  predictedWinnerCurve: number;
  actualLoserCurve: number;
  predictedLoserCurve: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const fitLinearCalibration = (pairs: Array<{ predicted: number; actual: number }>): LinearCalibration => {
  if (pairs.length === 0) return { slope: 1, intercept: 0 };
  if (pairs.length === 1) return { slope: 1, intercept: pairs[0].actual - pairs[0].predicted };

  const meanPredicted = pairs.reduce((sum, pair) => sum + pair.predicted, 0) / pairs.length;
  const meanActual = pairs.reduce((sum, pair) => sum + pair.actual, 0) / pairs.length;
  const covariance = pairs.reduce(
    (sum, pair) => sum + (pair.predicted - meanPredicted) * (pair.actual - meanActual),
    0
  );
  const variance = pairs.reduce((sum, pair) => sum + (pair.predicted - meanPredicted) ** 2, 0);
  const rawSlope = variance === 0 ? 1 : covariance / variance;

  return {
    slope: clamp(Number.isFinite(rawSlope) ? rawSlope : 1, 0.35, 2.5),
    intercept: meanActual - clamp(Number.isFinite(rawSlope) ? rawSlope : 1, 0.35, 2.5) * meanPredicted
  };
};

const applyCalibration = (value: number, calibration: LinearCalibration) =>
  Math.max(0, calibration.intercept + calibration.slope * value);

const smoothValueAt = (values: number[], index: number) => {
  const start = Math.max(0, index - 2);
  const end = Math.min(values.length, index + 3);
  const window = values.slice(start, end);
  return window.reduce((sum, value) => sum + value, 0) / Math.max(1, window.length);
};

const getChartDomain = (points: ComparisonPoint[], keys: Array<keyof ComparisonPoint>): [number, number] => {
  const values = points
    .flatMap(point => keys.map(key => point[key]))
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));

  if (values.length === 0) return [0, 100];

  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = Math.max(20, maxValue - minValue);
  const padding = Math.max(10, range * 0.12);

  return [
    Math.max(0, Math.floor((minValue - padding) / 10) * 10),
    Math.ceil((maxValue + padding) / 10) * 10
  ];
};

function TrendTooltip({
  active,
  payload
}: {
  active?: boolean;
  payload?: Array<{ payload: ComparisonPoint }>;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;

  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-950/95 p-4 text-sm shadow-2xl">
      <div className="font-black text-white">{row.title}</div>
      <div className="mt-1 font-mono text-xs text-slate-500">{row.matchKey}</div>
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1">
        <div className="font-semibold text-amber-200">Actual winner side</div>
        <div className="text-right text-amber-50">{row.actualWinnerScore.toFixed(1)}</div>
        <div className="font-semibold text-amber-300/80">Predicted same side</div>
        <div className="text-right text-amber-50">{row.predictedWinnerSideScore.toFixed(1)}</div>
        <div className="font-semibold text-cyan-200">Actual other side</div>
        <div className="text-right text-cyan-50">{row.actualLoserScore.toFixed(1)}</div>
        <div className="font-semibold text-cyan-300/80">Predicted same side</div>
        <div className="text-right text-cyan-50">{row.predictedLoserSideScore.toFixed(1)}</div>
      </div>
      <div className="mt-3 text-xs font-semibold text-slate-400">
        Pick: <span className={row.winnerPickCorrect ? 'text-emerald-200' : 'text-rose-200'}>
          {row.winnerPickCorrect ? 'Correct' : 'Missed'}
        </span>
        {' '}· confidence {(row.confidence * 100).toFixed(0)}%
      </div>
    </div>
  );
}

function TrendChart({
  title,
  subtitle,
  data,
  actualKey,
  predictedKey,
  actualName,
  predictedName,
  actualColor,
  predictedColor
}: {
  title: string;
  subtitle: string;
  data: ComparisonPoint[];
  actualKey: keyof ComparisonPoint;
  predictedKey: keyof ComparisonPoint;
  actualName: string;
  predictedName: string;
  actualColor: string;
  predictedColor: string;
}) {
  const domain = useMemo(() => getChartDomain(data, [actualKey, predictedKey]), [actualKey, data, predictedKey]);

  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-950/80 p-5">
      <div className="mb-4">
        <h5 className="text-base font-black text-white">{title}</h5>
        <p className="mt-1 text-xs font-semibold text-slate-500">{subtitle}</p>
      </div>
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 24, bottom: 8, left: 0 }}>
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
              domain={domain}
              stroke="#64748b"
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              tickCount={6}
            />
            <Tooltip content={<TrendTooltip />} />
            <Legend wrapperStyle={{ color: '#cbd5e1', fontSize: '12px' }} />
            <Line
              type="monotoneX"
              dataKey={actualKey as string}
              name={actualName}
              stroke={actualColor}
              strokeWidth={3}
              dot={false}
              activeDot={{ r: 5, fill: actualColor, strokeWidth: 0 }}
            />
            <Line
              type="monotoneX"
              dataKey={predictedKey as string}
              name={predictedName}
              stroke={predictedColor}
              strokeWidth={2.5}
              strokeDasharray="7 5"
              dot={false}
              activeDot={{ r: 5, fill: predictedColor, strokeWidth: 0 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default function PredictionActualTrendPanel({
  modelName,
  sourceLabel,
  rows
}: PredictionActualTrendPanelProps) {
  const chartData = useMemo<ComparisonPoint[]>(() => {
    const orderedRows = [...rows].sort((left, right) => left.matchNumber - right.matchNumber || left.matchKey.localeCompare(right.matchKey));
    const baseRows = orderedRows.map(row => {
      const redWonOrTied = row.actualRedScore >= row.actualBlueScore;
      const actualWinnerScore = redWonOrTied ? row.actualRedScore : row.actualBlueScore;
      const actualLoserScore = redWonOrTied ? row.actualBlueScore : row.actualRedScore;
      const predictedWinnerSideScore = redWonOrTied ? row.predictedRedScore : row.predictedBlueScore;
      const predictedLoserSideScore = redWonOrTied ? row.predictedBlueScore : row.predictedRedScore;
      return {
        ...row,
        actualWinnerScore,
        actualLoserScore,
        predictedWinnerSideScore,
        predictedLoserSideScore
      };
    });
    const winnerCalibration = fitLinearCalibration(
      baseRows.map(row => ({ predicted: row.predictedWinnerSideScore, actual: row.actualWinnerScore }))
    );
    const loserCalibration = fitLinearCalibration(
      baseRows.map(row => ({ predicted: row.predictedLoserSideScore, actual: row.actualLoserScore }))
    );
    const alignedRows = baseRows.map(row => ({
      ...row,
      alignedPredictedWinnerScore: applyCalibration(row.predictedWinnerSideScore, winnerCalibration),
      alignedPredictedLoserScore: applyCalibration(row.predictedLoserSideScore, loserCalibration)
    }));
    const winnerActualValues = alignedRows.map(row => row.actualWinnerScore);
    const winnerPredictedValues = alignedRows.map(row => row.alignedPredictedWinnerScore);
    const loserActualValues = alignedRows.map(row => row.actualLoserScore);
    const loserPredictedValues = alignedRows.map(row => row.alignedPredictedLoserScore);

    return alignedRows.map((row, index) => ({
      ...row,
      actualWinnerCurve: smoothValueAt(winnerActualValues, index),
      predictedWinnerCurve: smoothValueAt(winnerPredictedValues, index),
      actualLoserCurve: smoothValueAt(loserActualValues, index),
      predictedLoserCurve: smoothValueAt(loserPredictedValues, index)
    }));
  }, [rows]);

  const testedMatches = rows.length;

  return (
    <section className="rounded-3xl border border-cyan-500/20 bg-cyan-500/10 p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h4 className="text-xl font-black text-white">Prediction vs Actual Trend</h4>
          <p className="mt-2 max-w-3xl text-sm text-cyan-100/80">
            Completed-match backtest for {modelName}. The solid curve is official match reality; the dotted curve is the model prediction mapped onto the same scoring scale.
          </p>
          {sourceLabel && <p className="mt-1 text-xs font-semibold text-cyan-100/60">{sourceLabel}</p>}
        </div>
        <div className="rounded-2xl border border-cyan-300/20 bg-slate-950/70 px-4 py-3 text-right">
          <div className="text-xs font-black uppercase tracking-wider text-cyan-200">Compared Matches</div>
          <div className="text-2xl font-black text-white">{testedMatches}</div>
        </div>
      </div>

      {chartData.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/70 px-5 py-10 text-center text-sm font-semibold text-slate-500">
          No completed qualification matches are available for a prediction-vs-actual trend yet.
        </div>
      ) : (
        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          <TrendChart
            title="Winner-Side Score Curve"
            subtitle="Official winning alliance score vs what the model expected for that same alliance."
            data={chartData}
            actualKey="actualWinnerCurve"
            predictedKey="predictedWinnerCurve"
            actualName="Actual winner curve"
            predictedName="Mapped prediction curve"
            actualColor="#f59e0b"
            predictedColor="#fde68a"
          />
          <TrendChart
            title="Other-Side Score Curve"
            subtitle="Official lower-scoring alliance score vs what the model expected for that same alliance."
            data={chartData}
            actualKey="actualLoserCurve"
            predictedKey="predictedLoserCurve"
            actualName="Actual other-side curve"
            predictedName="Mapped prediction curve"
            actualColor="#22d3ee"
            predictedColor="#a5f3fc"
          />
        </div>
      )}
    </section>
  );
}
