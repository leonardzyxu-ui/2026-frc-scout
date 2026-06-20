import React from 'react';
import { BarChart3 } from 'lucide-react';
import { AdminButton, AdminSurface } from './AdminV4Primitives';
import { AdminV4StatInfoKey } from './AdminV4StatDefinitions';
import { PlainStatTeachingStrip, StatChip } from './AdminV4StatControls';
import type {
  AdminV4PpaShapeChartRow,
  AdminV4ScalarChartRow
} from './AdminV4ChartTypes';
import {
  PpaShapeBarChart,
  VerticalStatBarChart
} from './AdminV4Charts';
import { FocusHeader } from './AdminV4UiAtoms';

export type AdminV4VisualMetricKey =
  | 'power'
  | 'defense'
  | 'volatility'
  | 'ppa'
  | 'ppaExpected'
  | 'ppaFloor'
  | 'ppaCeiling'
  | 'ppaScoutConfidence'
  | 'ppaTailRisk'
  | 'ppc'
  | 'autoPpc'
  | 'teleopPpc'
  | 'opr'
  | 'epa'
  | 'dpr'
  | 'tbaRank'
  | 'matches';

export interface AdminV4VisualChartConfig {
  title: string;
  subtitle: string;
  rows: AdminV4ScalarChartRow[];
  formatter: (value: number) => string;
}

export const getAdminV4VisualMetricInfoKey = (metric: AdminV4VisualMetricKey): AdminV4StatInfoKey => {
  if (metric === 'power') return 'ppa';
  if (metric === 'defense') return 'defenseMetric';
  return metric;
};

const metricOptions: Array<{ key: AdminV4VisualMetricKey; label: string }> = [
  { key: 'ppa', label: 'Expected Range' },
  { key: 'ppaExpected', label: 'Expected Value' },
  { key: 'ppaFloor', label: 'Range Floor' },
  { key: 'ppaCeiling', label: 'Range Ceiling' },
  { key: 'ppaScoutConfidence', label: 'Scout Trust' },
  { key: 'ppaTailRisk', label: 'Tail Risk' },
  { key: 'ppc', label: 'Local Avg' },
  { key: 'autoPpc', label: 'Auto Local Avg' },
  { key: 'teleopPpc', label: 'Teleop Local Avg' },
  { key: 'defense', label: 'Defense' },
  { key: 'opr', label: 'Official Avg' },
  { key: 'epa', label: 'Public Rating' },
  { key: 'dpr', label: 'Defense Against' },
  { key: 'volatility', label: 'Volatility' },
  { key: 'matches', label: 'Matches Logged' },
  { key: 'tbaRank', label: 'TBA Rank' }
];

const visualPresets: Array<{
  label: string;
  question: string;
  detail: string;
  metrics: AdminV4VisualMetricKey[];
}> = [
  { label: 'Drive Team', question: 'Who helps the next match?', detail: 'Expected range, downside, risk, and defense.', metrics: ['ppa', 'ppaFloor', 'ppaTailRisk', 'defense'] },
  { label: 'Pick List', question: 'Who survives playoffs?', detail: 'Expected value, floor, ceiling, and role balance.', metrics: ['ppa', 'ppaFloor', 'ppaCeiling', 'defense'] },
  { label: 'Judges', question: 'Can we explain the model?', detail: 'Trust, validation proxies, and evidence count.', metrics: ['ppa', 'ppaScoutConfidence', 'opr', 'epa', 'matches'] },
  { label: 'Raw Scouting', question: 'What did scouts directly see?', detail: 'Firsthand point creation and coverage.', metrics: ['ppc', 'autoPpc', 'teleopPpc', 'matches'] }
];

export function AdminV4VisualizeWorkflow({
  visualMetricKeys,
  visualAdvancedPickerOpen,
  visualChartConfigs,
  ppaShapeRows,
  onSetVisualMetricKeys,
  onSetVisualAdvancedPickerOpen,
  onToggleVisualMetric,
  onOpenWiki,
  onOpenInfoMenu
}: {
  visualMetricKeys: AdminV4VisualMetricKey[];
  visualAdvancedPickerOpen: boolean;
  visualChartConfigs: Record<AdminV4VisualMetricKey, AdminV4VisualChartConfig>;
  ppaShapeRows: AdminV4PpaShapeChartRow[];
  onSetVisualMetricKeys: (metrics: AdminV4VisualMetricKey[]) => void;
  onSetVisualAdvancedPickerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  onToggleVisualMetric: (metric: AdminV4VisualMetricKey) => void;
  onOpenWiki: (key: AdminV4StatInfoKey) => void;
  onOpenInfoMenu: (event: React.MouseEvent, key: AdminV4StatInfoKey) => void;
}) {
  const activePresetLabel = visualPresets.find(preset =>
    preset.metrics.length === visualMetricKeys.length &&
    preset.metrics.every(metric => visualMetricKeys.includes(metric))
  )?.label || 'Custom';
  const firstSelectedMetric = visualMetricKeys[0] || 'ppa';
  const activePreset = visualPresets.find(preset => preset.label === activePresetLabel);
  const visualizeFirstAction = activePresetLabel === 'Custom'
    ? {
      label: 'Start from a competition question',
      detail: 'Custom charts are useful after you know the moment. Start with Drive Team, Pick List, Judges, or Raw Scouting, then fine tune.',
      actionLabel: 'Use Drive Team',
      onAction: () => onSetVisualMetricKeys(visualPresets[0]!.metrics)
    }
    : {
      label: activePreset?.question || 'Explain the first chart',
      detail: activePreset?.detail || 'Open the wiki entry before comparing teams so the chart means something under pressure.',
      actionLabel: 'Explain Stat',
      onAction: () => onOpenWiki(getAdminV4VisualMetricInfoKey(firstSelectedMetric))
    };
  const visualizeControls = (
    <AdminButton tone={visualAdvancedPickerOpen ? 'cyan' : 'slate'} onClick={() => onSetVisualAdvancedPickerOpen(previous => !previous)}>
      <BarChart3 className="h-4 w-4" />
      {visualAdvancedPickerOpen ? 'Hide Stat Picker' : 'Fine Tune Stats'}
    </AdminButton>
  );

  return (
    <div className="space-y-5">
      <AdminSurface className="p-5">
        <FocusHeader
          eyebrow="Visualize"
          title="Choose The Question"
          description="Start with the scouting moment first. Each selected stat renders as its own vertical chart panel with x-axis teams and y-axis values."
        />
        <button
          type="button"
          onClick={visualizeFirstAction.onAction}
          className="admin-g2 mt-4 flex w-full flex-col gap-3 border border-cyan-400/30 bg-cyan-500/10 p-4 text-left text-cyan-100 transition-colors hover:bg-cyan-500/15 md:flex-row md:items-center md:justify-between"
        >
          <span className="min-w-0">
            <span className="block text-[10px] font-black uppercase tracking-[0.18em] opacity-75">Do This First</span>
            <span className="mt-1 block text-lg font-black text-white">{visualizeFirstAction.label}</span>
            <span className="mt-1 block text-sm font-semibold leading-relaxed opacity-85">{visualizeFirstAction.detail}</span>
          </span>
          <span className="admin-g2-sm shrink-0 border border-white/15 bg-white/10 px-3 py-2 text-xs font-black uppercase text-white/80">
            {visualizeFirstAction.actionLabel}
          </span>
        </button>
        <div className="mt-4">{visualizeControls}</div>
        <details className="admin-g2-sm mt-4 border border-slate-800 bg-slate-950/75 p-3">
          <summary className="cursor-pointer list-none text-sm font-black text-slate-100">
            Show Metric Translation
          </summary>
          <div className="admin-details-body mt-3">
            <PlainStatTeachingStrip
              title="Chart Metric Translation"
              description="Start with a question, then click any metric to open the exact Stats Wiki entry before comparing teams. Right-click metric chips or chart panels for Get Info."
              stats={activePresetLabel === 'Raw Scouting'
                ? ['localAvg', 'matches', 'scoutTrust', 'defense']
                : activePresetLabel === 'Judges'
                  ? ['expected', 'scoutTrust', 'officialAvg', 'publicRating']
                  : ['expected', 'floor', 'tailRisk', 'defense']}
              onInfo={onOpenWiki}
              onInfoContext={onOpenInfoMenu}
            />
          </div>
        </details>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {visualPresets.map(preset => (
            <button
              key={preset.label}
              type="button"
              onClick={() => onSetVisualMetricKeys(preset.metrics)}
              className={`admin-g2-sm border px-4 py-3 text-left transition-colors ${
                activePresetLabel === preset.label
                  ? 'border-cyan-400/50 bg-cyan-500/15 text-cyan-50'
                  : 'border-slate-800 bg-slate-950 text-slate-200 hover:border-cyan-400/40 hover:bg-cyan-500/10'
              }`}
            >
              <div className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">{preset.label}</div>
              <div className="mt-2 text-sm font-black text-white">{preset.question}</div>
              <div className="mt-1 text-xs font-semibold text-slate-400">{preset.detail}</div>
            </button>
          ))}
        </div>
        {visualAdvancedPickerOpen && (
          <div className="admin-g2-sm mt-4 border border-slate-800 bg-slate-950 p-3">
            <div className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-slate-500">Selected: {activePresetLabel}</div>
            <div className="flex flex-wrap gap-2">
              {metricOptions.map(option => (
                <StatChip
                  key={option.key}
                  statKey={getAdminV4VisualMetricInfoKey(option.key)}
                  label={option.label}
                  selected={visualMetricKeys.includes(option.key)}
                  onToggle={() => onToggleVisualMetric(option.key)}
                  onInfo={key => onOpenWiki(key)}
                  onInfoContext={onOpenInfoMenu}
                />
              ))}
            </div>
          </div>
        )}
      </AdminSurface>
      <div className="grid gap-5 xl:grid-cols-2">
        {visualMetricKeys.length === 0 && (
          <AdminSurface className="p-5">
            <h3 className="text-lg font-black text-white">No Stats Selected</h3>
            <p className="mt-2 text-sm font-semibold text-slate-400">Pick a stat above or use a preset to build the chart workspace.</p>
          </AdminSurface>
        )}
        {visualMetricKeys.map(metric => {
          const config = visualChartConfigs[metric];
          if (metric === 'ppa') {
            return (
              <PpaShapeBarChart
                key={metric}
                rows={ppaShapeRows}
                onInfo={key => onOpenWiki(key)}
                onInfoContext={onOpenInfoMenu}
              />
            );
          }
          return (
            <VerticalStatBarChart
              key={metric}
              title={config.title}
              subtitle={config.subtitle}
              rows={config.rows}
              valueFormatter={config.formatter}
              infoKey={getAdminV4VisualMetricInfoKey(metric)}
              onInfo={key => onOpenWiki(key)}
              onInfoContext={onOpenInfoMenu}
            />
          );
        })}
      </div>
    </div>
  );
}

export default AdminV4VisualizeWorkflow;
