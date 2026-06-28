import React from 'react';
import { Info } from 'lucide-react';
import { AdminV4SelectedMetric } from '../../utils/adminV4Settings';
import { AdminV4StatInfoKey } from './AdminV4StatDefinitions';

export const ADMIN_V4_MODEL_LABELS: Record<AdminV4SelectedMetric, string> = {
  ppc: 'Contribution',
  opr: 'Official Avg',
  epa: 'Public Rating',
  ppa: 'Range'
};

export const ADMIN_V4_MODEL_OPTIONS: AdminV4SelectedMetric[] = ['ppa', 'ppc', 'opr', 'epa'];

export const ADMIN_V4_MODEL_HELP: Record<AdminV4SelectedMetric, { meaning: string; use: string; watch: string }> = {
  ppa: {
    meaning: 'Admin V4 contribution range from local scouting, public context, uncertainty, and risk.',
    use: 'Match plans, pick list, simulator, and charts.',
    watch: 'Confidence, tail risk, and evidence gaps before trusting one number.'
  },
  ppc: {
    meaning: 'Contribution directly credited by your scouts at this event.',
    use: 'Checking what scouts actually saw.',
    watch: 'Missed rows, scout consistency, and role changes.'
  },
  opr: {
    meaning: 'Official-score contribution estimate from alliance scores and partners.',
    use: 'Broad cross-check against local scouting.',
    watch: 'Partner strength, fouls, defense, and schedule luck.'
  },
  epa: {
    meaning: 'Public Statbotics strength estimate for when local evidence is thin.',
    use: 'Early-event baseline and outside sanity check.',
    watch: 'External model lag and differences from your scouting priorities.'
  }
};

export type AdminV4PlainStatKey =
  | 'expected'
  | 'floor'
  | 'ceiling'
  | 'tailRisk'
  | 'scoutTrust'
  | 'defense'
  | 'localAvg'
  | 'officialAvg'
  | 'publicRating'
  | 'matches';

const ADMIN_V4_PLAIN_STAT_HELP: Record<AdminV4PlainStatKey, {
  label: string;
  plain: string;
  infoKey: AdminV4StatInfoKey;
}> = {
  expected: {
    label: 'Contribution',
    plain: 'Best current guess, not a promise.',
    infoKey: 'ppa'
  },
  floor: {
    label: 'Floor',
    plain: 'Cautious value to trust in tight calls.',
    infoKey: 'ppa'
  },
  ceiling: {
    label: 'Ceiling',
    plain: 'Upside if the robot hits its good outcome.',
    infoKey: 'ppa'
  },
  tailRisk: {
    label: 'Tail Risk',
    plain: 'How likely the range is to disappoint.',
    infoKey: 'volatility'
  },
  scoutTrust: {
    label: 'Scout Trust',
    plain: 'How much local evidence backs the number.',
    infoKey: 'matches'
  },
  defense: {
    label: 'Defense',
    plain: 'Whether defense changes the match, not just activity.',
    infoKey: 'defenseMetric'
  },
  localAvg: {
    label: 'Contribution',
    plain: 'What our scouts directly credited.',
    infoKey: 'ppc'
  },
  officialAvg: {
    label: 'Official Avg',
    plain: 'Alliance-score estimate from official results.',
    infoKey: 'opr'
  },
  publicRating: {
    label: 'Public Rating',
    plain: 'Outside baseline when local evidence is thin.',
    infoKey: 'epa'
  },
  matches: {
    label: 'Matches Logged',
    plain: 'How much match evidence this read has.',
    infoKey: 'matches'
  }
};

export function PlainStatTeachingStrip({
  title = 'Metric Translation',
  description = 'Click any metric to open the Stats Wiki for the formula, source data, interpretation, and limitations. Right-click any metric for Get Info.',
  stats,
  onInfo,
  onInfoContext
}: {
  title?: string;
  description?: string;
  stats: AdminV4PlainStatKey[];
  onInfo: (key: AdminV4StatInfoKey) => void;
  onInfoContext: (event: React.MouseEvent, key: AdminV4StatInfoKey) => void;
}) {
  return (
    <div className="admin-g2-sm border border-slate-800 bg-slate-950/75 p-3">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{title}</div>
        <div className="max-w-2xl text-xs font-semibold leading-relaxed text-slate-500">{description}</div>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        {stats.map(stat => {
          const item = ADMIN_V4_PLAIN_STAT_HELP[stat];
          return (
            <button
              key={stat}
              type="button"
              onClick={() => onInfo(item.infoKey)}
              onContextMenu={event => {
                event.preventDefault();
                onInfoContext(event, item.infoKey);
              }}
              className="admin-g2-sm min-h-16 border border-slate-800 bg-slate-900/60 px-3 py-2 text-left transition-colors hover:border-cyan-400/40 hover:bg-cyan-500/10"
              aria-label={`Open Stats Wiki for ${item.label}: ${item.plain}`}
              title={`Open Stats Wiki for ${item.label}. Right-click for Get Info.`}
            >
              <span className="flex items-start justify-between gap-2">
                <span className="text-xs font-black text-slate-100">{item.label}</span>
                <Info className="h-3.5 w-3.5 shrink-0 text-slate-500" />
              </span>
              <span className="mt-1 block text-xs font-semibold leading-relaxed text-slate-400">{item.plain}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ModelToggleGroup({
  selectedMetric,
  onChange,
  label = 'Model',
  onInfo,
  onInfoContext
}: {
  selectedMetric: AdminV4SelectedMetric;
  onChange: (metric: AdminV4SelectedMetric) => void;
  label?: string;
  onInfo?: (key: AdminV4StatInfoKey) => void;
  onInfoContext?: (event: React.MouseEvent, key: AdminV4StatInfoKey) => void;
}) {
  const selectedLabel = ADMIN_V4_MODEL_LABELS[selectedMetric];
  const selectedHelp = ADMIN_V4_MODEL_HELP[selectedMetric];

  return (
    <div className="inline-flex flex-wrap items-center gap-2">
      <span className="text-xs font-black uppercase tracking-wider text-slate-500">{label}</span>
      <div className="flex flex-wrap gap-1">
        {ADMIN_V4_MODEL_OPTIONS.map(metric => {
          const isActive = selectedMetric === metric;
          const labelText = ADMIN_V4_MODEL_LABELS[metric];
          return (
            <div
              key={metric}
              className={`admin-g2-sm inline-flex items-stretch overflow-hidden border transition-colors ${
                isActive
                  ? 'border-cyan-400/40 bg-cyan-600 text-white'
                  : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700 hover:bg-slate-900 hover:text-white'
              }`}
              onContextMenu={event => onInfoContext?.(event, metric)}
            >
              <button
                type="button"
                onClick={() => onChange(metric)}
                className="min-h-10 px-3 py-2.5 text-xs font-black transition-colors"
                title={`${labelText} model`}
              >
                {labelText}
              </button>
            </div>
          );
        })}
      </div>
      {onInfo && onInfoContext && (
        <button
          type="button"
          onClick={() => onInfo(selectedMetric)}
          onContextMenu={event => onInfoContext(event, selectedMetric)}
          className="admin-g2-sm inline-flex h-10 w-10 items-center justify-center border border-slate-800 bg-slate-950 text-slate-400 transition-colors hover:border-cyan-400/50 hover:text-cyan-200"
          aria-label={`Explain selected model ${selectedLabel}`}
          title={`Get info for ${selectedLabel}`}
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      )}
      <div
        role="note"
        aria-label={`Selected model explanation: ${selectedLabel}`}
        onContextMenu={event => onInfoContext?.(event, selectedMetric)}
        className="admin-g2-sm max-w-md border border-slate-800 bg-slate-950 px-3 py-2 text-xs font-semibold leading-relaxed text-slate-400"
      >
        <div>
          <span className="font-black text-slate-100">{selectedLabel}</span>
          <span className="ml-1">{selectedHelp.meaning}</span>
        </div>
        <div className="mt-1 text-[11px] text-slate-500">
          Use: {selectedHelp.use} Watch: {selectedHelp.watch}
        </div>
      </div>
    </div>
  );
}

export function StatInfoButton({
  statKey,
  label,
  onInfo,
  onInfoContext
}: {
  statKey: AdminV4StatInfoKey;
  label: string;
  onInfo: (key: AdminV4StatInfoKey) => void;
  onInfoContext: (event: React.MouseEvent, key: AdminV4StatInfoKey) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onInfo(statKey)}
      onContextMenu={event => onInfoContext(event, statKey)}
      className="admin-g2-sm inline-flex h-10 w-10 items-center justify-center border border-slate-700 bg-slate-950 text-slate-400 transition-colors hover:border-cyan-400/50 hover:text-cyan-200"
      aria-label={`Get info for ${label}`}
      title={`Get info for ${label}`}
    >
      <Info className="h-3.5 w-3.5" />
    </button>
  );
}

export function StatChip({
  statKey,
  label,
  selected,
  onToggle,
  onInfo,
  onInfoContext
}: {
  statKey: AdminV4StatInfoKey;
  label: string;
  selected: boolean;
  onToggle: () => void;
  onInfo: (key: AdminV4StatInfoKey) => void;
  onInfoContext: (event: React.MouseEvent, key: AdminV4StatInfoKey) => void;
}) {
  return (
    <div
      className={`admin-g2-sm inline-flex items-center gap-1 border p-1 ${
        selected ? 'border-cyan-400/40 bg-cyan-500/15' : 'border-slate-800 bg-slate-950'
      }`}
      onContextMenu={event => onInfoContext(event, statKey)}
    >
      <button
        type="button"
        onClick={onToggle}
        className={`admin-g2-sm min-h-10 px-3 py-2 text-xs font-black ${
          selected ? 'text-cyan-50' : 'text-slate-400 hover:text-white'
        }`}
      >
        {label}
      </button>
      <StatInfoButton statKey={statKey} label={label} onInfo={onInfo} onInfoContext={onInfoContext} />
    </div>
  );
}
