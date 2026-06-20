import React, { useLayoutEffect, useRef, useState } from 'react';
import {
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  Cell,
  Legend,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { AdminSurface } from './AdminV4Primitives';
import { AdminV4StatInfoKey } from './AdminV4StatDefinitions';
import { StatInfoButton } from './AdminV4StatControls';
import { AdminEmptyState } from './AdminV4UiAtoms';
import { AdminV4PpaShapeChartRow, AdminV4ScalarChartRow } from './AdminV4ChartTypes';
import { getRiskPillClass } from './AdminV4RiskPill';

const formatMetricValue = (value: number | null, digits: number = 2) =>
  value == null || !Number.isFinite(value) ? '-' : value.toFixed(digits);

const formatPercentMetric = (value: number | null, digits: number = 2) =>
  value == null || !Number.isFinite(value) ? '-' : `${(value * 100).toFixed(digits)}%`;

const MAX_BARS_PER_CHART_PANEL = 12;

export const chunkAdminV4ChartRows = <TRow,>(rows: TRow[], maxRowsPerPanel = MAX_BARS_PER_CHART_PANEL) => {
  const chunkSize = Math.max(1, maxRowsPerPanel);
  const chunks: TRow[][] = [];
  for (let index = 0; index < rows.length; index += chunkSize) {
    chunks.push(rows.slice(index, index + chunkSize));
  }
  return chunks;
};

function useMeasuredChartFrame(defaultHeight: number) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: defaultHeight });

  useLayoutEffect(() => {
    const element = frameRef.current;
    if (!element) return;

    const updateSize = () => {
      const rect = element.getBoundingClientRect();
      const nextWidth = Math.floor(rect.width);
      const nextHeight = Math.floor(rect.height || defaultHeight);
      setSize(current =>
        current.width === nextWidth && current.height === nextHeight
          ? current
          : { width: nextWidth, height: nextHeight }
      );
    };

    updateSize();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updateSize);
    observer?.observe(element);
    window.addEventListener('resize', updateSize);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }, [defaultHeight]);

  return [frameRef, size] as const;
}

type PpaShapeDisplayRow = AdminV4PpaShapeChartRow & {
  floorBase: number;
  rangeWidth: number;
  normalBase: number;
  normalWidth: number;
  displayLabel: string;
  expectedFill: string;
  bandFill: string;
  normalFill: string;
};

function PpaShapeBarPlot({
  chartRows,
  panelLabel
}: {
  chartRows: PpaShapeDisplayRow[];
  panelLabel?: string;
}) {
  const [chartFrameRef, chartSize] = useMeasuredChartFrame(320);

  return (
    <div className="admin-g2-sm border border-slate-800 bg-slate-950/60 p-3">
      {panelLabel && (
        <div className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{panelLabel}</div>
      )}
      <div ref={chartFrameRef} className="h-80 min-w-0" style={{ width: '100%', minWidth: 0 }}>
        {chartSize.width <= 0 || chartSize.height <= 0 ? (
          <div className="admin-g2-sm flex h-full items-center justify-center border border-slate-800 bg-slate-950 text-sm font-semibold text-slate-500">
            Preparing chart...
          </div>
        ) : (
          <RechartsBarChart width={chartSize.width} height={chartSize.height} data={chartRows} margin={{ top: 8, right: 12, left: 0, bottom: 38 }}>
            <CartesianGrid stroke="#1e293b" vertical={false} />
            <XAxis
              dataKey="displayLabel"
              tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 800 }}
              axisLine={{ stroke: '#334155' }}
              tickLine={false}
              interval={0}
              angle={-35}
              textAnchor="end"
              height={50}
            />
            <YAxis
              tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 800 }}
              axisLine={{ stroke: '#334155' }}
              tickLine={false}
              tickFormatter={value => formatMetricValue(Number(value), 0)}
              width={52}
            />
            <Tooltip
              cursor={{ fill: 'rgba(168, 85, 247, 0.08)' }}
              contentStyle={{
                background: '#020617',
                border: '1px solid #334155',
                borderRadius: 16,
                color: '#e2e8f0'
              }}
              formatter={(value, name, item) => {
                const payload = (item as { payload?: PpaShapeDisplayRow }).payload;
                if (name === 'Floor-Ceiling Band' && payload) {
                  return [`${formatMetricValue(payload.floor, 1)} to ${formatMetricValue(payload.ceiling, 1)}`, name];
                }
                if (name === 'Normal Band' && payload) {
                  return [`${formatMetricValue(payload.normalLow, 1)} to ${formatMetricValue(payload.normalHigh, 1)}`, name];
                }
                return [formatMetricValue(Number(value), 2), name];
              }}
              labelFormatter={label => `Team ${label}`}
            />
            <Legend
              wrapperStyle={{ color: '#cbd5e1', fontSize: 11, fontWeight: 800, textTransform: 'uppercase' }}
              iconType="circle"
            />
            <Bar dataKey="floorBase" stackId="riskBand" fill="rgba(0,0,0,0)" legendType="none" maxBarSize={18} />
            <Bar dataKey="rangeWidth" stackId="riskBand" name="Floor-Ceiling Band" radius={[8, 8, 8, 8]} maxBarSize={18}>
              {chartRows.map(row => (
                <Cell key={`${row.key}-range`} fill={row.bandFill} fillOpacity={0.62} />
              ))}
            </Bar>
            <Bar dataKey="normalBase" stackId="normalBand" fill="rgba(0,0,0,0)" legendType="none" maxBarSize={12} />
            <Bar dataKey="normalWidth" stackId="normalBand" name="Normal Band" radius={[8, 8, 8, 8]} maxBarSize={12}>
              {chartRows.map(row => (
                <Cell key={`${row.key}-normal`} fill={row.normalFill} fillOpacity={0.82} />
              ))}
            </Bar>
            <Bar dataKey="expected" name="Expected" radius={[10, 10, 0, 0]} maxBarSize={24}>
              {chartRows.map(row => (
                <Cell key={`${row.key}-expected`} fill={row.expectedFill} />
              ))}
            </Bar>
          </RechartsBarChart>
        )}
      </div>
    </div>
  );
}

type ScalarDisplayRow = AdminV4ScalarChartRow & {
  displayLabel: string;
  fill: string;
};

function VerticalStatBarPlot({
  chartRows,
  panelLabel,
  title,
  valueFormatter
}: {
  chartRows: ScalarDisplayRow[];
  panelLabel?: string;
  title: string;
  valueFormatter: (value: number) => string;
}) {
  const [chartFrameRef, chartSize] = useMeasuredChartFrame(288);

  return (
    <div className="admin-g2-sm border border-slate-800 bg-slate-950/60 p-3">
      {panelLabel && (
        <div className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{panelLabel}</div>
      )}
      <div ref={chartFrameRef} className="h-72 min-w-0" style={{ width: '100%', minWidth: 0 }}>
        {chartSize.width <= 0 || chartSize.height <= 0 ? (
          <div className="admin-g2-sm flex h-full items-center justify-center border border-slate-800 bg-slate-950 text-sm font-semibold text-slate-500">
            Preparing chart...
          </div>
        ) : (
          <RechartsBarChart width={chartSize.width} height={chartSize.height} data={chartRows} margin={{ top: 10, right: 12, left: 0, bottom: 32 }}>
            <CartesianGrid stroke="#1e293b" vertical={false} />
            <XAxis
              dataKey="displayLabel"
              tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 800 }}
              axisLine={{ stroke: '#334155' }}
              tickLine={false}
              interval={0}
              angle={-35}
              textAnchor="end"
              height={45}
            />
            <YAxis
              tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 800 }}
              axisLine={{ stroke: '#334155' }}
              tickLine={false}
              tickFormatter={value => valueFormatter(Number(value))}
              width={52}
            />
            <Tooltip
              cursor={{ fill: 'rgba(14, 165, 233, 0.08)' }}
              contentStyle={{
                background: '#020617',
                border: '1px solid #334155',
                borderRadius: 16,
                color: '#e2e8f0'
              }}
              formatter={value => [valueFormatter(Number(value)), title]}
              labelFormatter={label => `Team ${label}`}
            />
            <Bar dataKey="value" radius={[10, 10, 0, 0]} maxBarSize={36}>
              {chartRows.map(row => (
                <Cell key={row.key} fill={row.fill} />
              ))}
            </Bar>
          </RechartsBarChart>
        )}
      </div>
    </div>
  );
}

export function PpaShapeBarChart({
  rows,
  onInfo,
  onInfoContext
}: {
  rows: AdminV4PpaShapeChartRow[];
  onInfo: (key: AdminV4StatInfoKey) => void;
  onInfoContext: (event: React.MouseEvent, key: AdminV4StatInfoKey) => void;
}) {
  const chartRows = rows.map(row => ({
    ...row,
    floorBase: Math.max(0, row.floor),
    rangeWidth: Math.max(0, row.ceiling - row.floor),
    normalBase: row.normalLow == null ? Math.max(0, row.floor) : Math.max(0, row.normalLow),
    normalWidth: row.normalLow == null || row.normalHigh == null
      ? 0
      : Math.max(0, row.normalHigh - row.normalLow),
    displayLabel: row.label,
    expectedFill:
      row.highlighted === 'both'
        ? '#f59e0b'
        : row.highlighted === 'own'
          ? '#fb923c'
          : row.highlighted === 'searched'
            ? '#38bdf8'
            : '#c084fc',
    bandFill:
      row.tailRisk === 'High'
        ? '#fb7185'
        : row.tailRisk === 'Medium'
          ? '#fbbf24'
          : '#64748b',
    normalFill:
      row.uncertainty === 'High'
        ? '#f97316'
        : row.uncertainty === 'Medium'
          ? '#fde047'
          : '#2dd4bf'
  }));

  return (
    <AdminSurface className="min-h-[460px] min-w-0 p-5" onContextMenu={(event: React.MouseEvent) => onInfoContext(event, 'ppa')}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-black text-white">Expected Range Shape</h3>
          <p className="mt-1 text-sm text-slate-400">
            Expected value is the main bar. The floating bands show floor-to-ceiling risk and the narrower normal range, so the forecast is read as a shape instead of one score.
          </p>
          <p className="mt-2 text-xs font-semibold text-slate-500">
            Click the info button or right-click this chart for the Stats Wiki entry behind the math.
          </p>
        </div>
        <StatInfoButton statKey="ppa" label="Math" onInfo={onInfo} onInfoContext={onInfoContext} />
      </div>

      {chartRows.length === 0 ? (
        <div className="mt-5 h-80 min-w-0" style={{ width: '100%', minWidth: 0 }}>
          <AdminEmptyState
            className="h-full"
            title="No expected range data yet"
            why="No team has enough expected-value, floor, and ceiling context to draw this chart."
            action="Load model/source data or collect match scout rows, then reopen Visualize."
          />
        </div>
      ) : (
        <div className="mt-5 grid gap-4 2xl:grid-cols-2">
          {chunkAdminV4ChartRows(chartRows).map((chunk, index, chunks) => (
            <PpaShapeBarPlot
              key={`ppa-shape-chart-${index}`}
              chartRows={chunk}
              panelLabel={chunks.length > 1 ? `Teams ${index * MAX_BARS_PER_CHART_PANEL + 1}-${index * MAX_BARS_PER_CHART_PANEL + chunk.length}` : undefined}
            />
          ))}
        </div>
      )}

      {chartRows.length > 0 && (
        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {chartRows.slice(0, 6).map(row => (
            <div key={`${row.key}-shape-note`} className="admin-g2-sm border border-slate-800 bg-slate-950/70 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <div className="font-mono text-sm font-black text-white">{row.label}</div>
                <span className={`admin-g2-sm px-2 py-1 text-[10px] font-black uppercase ${getRiskPillClass(row.uncertainty)}`}>
                  {row.uncertainty}
                </span>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-1.5 text-[11px] font-black text-slate-200">
                <span className="admin-g2-sm border border-slate-700 bg-slate-900 px-2 py-1">F {formatMetricValue(row.floor, 1)}</span>
                <span className="admin-g2-sm border border-violet-400/25 bg-violet-500/10 px-2 py-1 text-violet-100">E {formatMetricValue(row.expected, 1)}</span>
                <span className="admin-g2-sm border border-cyan-400/25 bg-cyan-500/10 px-2 py-1 text-cyan-100">C {formatMetricValue(row.ceiling, 1)}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-black">
                <span className="admin-g2-sm border border-violet-400/25 bg-violet-500/10 px-2 py-1 text-violet-100">{row.role}</span>
                <span className={`admin-g2-sm px-2 py-1 ${getRiskPillClass(row.tailRisk)}`}>{row.tailRiskLabel}</span>
                <span className="admin-g2-sm border border-slate-700 px-2 py-1 text-slate-300">{formatPercentMetric(row.scoutConfidence, 0)} scout trust</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminSurface>
  );
}

export function VerticalStatBarChart({
  title,
  subtitle,
  rows,
  valueFormatter,
  infoKey,
  onInfo,
  onInfoContext
}: {
  title: string;
  subtitle?: string;
  rows: AdminV4ScalarChartRow[];
  valueFormatter: (value: number) => string;
  infoKey: AdminV4StatInfoKey;
  onInfo: (key: AdminV4StatInfoKey) => void;
  onInfoContext: (event: React.MouseEvent, key: AdminV4StatInfoKey) => void;
}) {
  const chartRows = rows.map(row => ({
    ...row,
    displayLabel: row.label,
    fill:
      row.highlighted === 'both'
        ? '#f59e0b'
        : row.highlighted === 'own'
          ? '#fb923c'
          : row.highlighted === 'searched'
            ? '#38bdf8'
            : '#22d3ee'
  }));

  return (
    <AdminSurface className="min-h-[360px] min-w-0 p-5" onContextMenu={(event: React.MouseEvent) => onInfoContext(event, infoKey)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-black text-white">{title}</h3>
          {subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}
          <p className="mt-2 text-xs font-semibold text-slate-500">
            Click the info button or right-click this chart for the formula, source, interpretation, and limitations.
          </p>
        </div>
        <StatInfoButton statKey={infoKey} label={title} onInfo={onInfo} onInfoContext={onInfoContext} />
      </div>

      {chartRows.length === 0 ? (
        <div className="mt-5 h-72 min-w-0" style={{ width: '100%', minWidth: 0 }}>
          <AdminEmptyState
            className="h-full"
            title="No chartable team data yet"
            why="The selected stat has no numeric values for the current event and filters."
            action="Choose another stat, load source data, or collect the missing scouting rows."
          />
        </div>
      ) : (
        <div className="mt-5 grid gap-4 2xl:grid-cols-2">
          {chunkAdminV4ChartRows(chartRows).map((chunk, index, chunks) => (
            <VerticalStatBarPlot
              key={`${title}-chart-${index}`}
              chartRows={chunk}
              panelLabel={chunks.length > 1 ? `Teams ${index * MAX_BARS_PER_CHART_PANEL + 1}-${index * MAX_BARS_PER_CHART_PANEL + chunk.length}` : undefined}
              title={title}
              valueFormatter={valueFormatter}
            />
          ))}
        </div>
      )}
    </AdminSurface>
  );
}
