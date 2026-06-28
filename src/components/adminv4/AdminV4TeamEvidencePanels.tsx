import React from 'react';
import { ScoutEvidenceAdminTask, TeamPerformanceProfile } from '../../types';
import { PpaInsight, PpaRiskLevel } from '../../utils/ppaInsights';
import { SCOUTING_MISSIONS, ScoutingMissionKey, getMissionToneClasses } from '../../utils/scoutingWorkflow';
import { ScoutTaskAlliance, ScoutTaskMatchType, ScoutTaskPpaContext } from '../../utils/scoutTaskHandoff';
import { AdminSurface } from './AdminV4Primitives';
import { AdminV4StatInfoKey } from './AdminV4StatDefinitions';
import { StatInfoButton } from './AdminV4StatControls';
import { AdminEmptyState, MetricField } from './AdminV4UiAtoms';
import { PpaMiniShape } from './AdminV4PpaPanels';

export interface AdminV4TeamEvidenceStatus {
  teamNumber: string;
  matchRows: number;
  defenseRows: number;
  pitRows: number;
  preScoutRows: number;
  scoutConfidence: number;
  uncertainty: PpaRiskLevel;
  roleLabel: string;
  needsAttention: boolean;
  attentionReasons: string[];
}

export interface AdminV4TeamEvidenceTimelineItem {
  key: string;
  missionKey: ScoutingMissionKey;
  sourceLabel: string;
  title: string;
  subtitle: string;
  timestamp: number;
  signalLabel: string;
  signalValue: string;
  pills: string[];
  notes: string;
  adminTask?: ScoutEvidenceAdminTask;
}

export interface AdminV4ScoutWorkItem {
  id: string;
  teamNumber: string;
  teamName?: string;
  missionKey: ScoutingMissionKey;
  label: string;
  reason: string;
  detail: string;
  priority: number;
  context: string;
  matchKey?: string;
  matchType?: ScoutTaskMatchType;
  matchNumber?: number;
  alliance?: ScoutTaskAlliance;
  ppa?: ScoutTaskPpaContext;
}

const formatMetricValue = (value: number | null | undefined, digits: number = 2) =>
  value == null || !Number.isFinite(value) ? '—' : value.toFixed(digits);

const formatPercentMetric = (value: number | null | undefined, digits: number = 2) =>
  value == null || !Number.isFinite(value) ? '—' : `${(value * 100).toFixed(digits)}%`;

const formatLocalTimestamp = (timestamp: number | null | undefined) =>
  timestamp
    ? new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      }).format(new Date(timestamp))
    : 'No timestamp - verify source';

export function TeamEvidenceCoveragePanel({
  status,
  tasks,
  onOpenTask
}: {
  status: AdminV4TeamEvidenceStatus;
  tasks: AdminV4ScoutWorkItem[];
  onOpenTask: (task: AdminV4ScoutWorkItem) => void;
}) {
  const evidenceCounts = [
    { label: 'Pre', value: status.preScoutRows, detail: 'public context' },
    { label: 'Pit', value: status.pitRows, detail: 'capability prior' },
    { label: 'Match', value: status.matchRows, detail: 'expected-range evidence' },
    { label: 'Defense', value: status.defenseRows, detail: 'role guard' }
  ];

  return (
    <AdminSurface className="border-emerald-400/25 bg-emerald-500/10 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200">Evidence Coverage</div>
          <h3 className="mt-1 text-xl font-black text-white">What this team still needs</h3>
          <p className="mt-2 max-w-3xl text-sm font-semibold leading-relaxed text-emerald-50/80">
            This turns the team page into a scout dispatch surface: collect the missing evidence before trusting the expected range in forecasts or alliance selection.
          </p>
        </div>
        <span className={`admin-g2-sm shrink-0 border px-3 py-2 text-xs font-black uppercase tracking-[0.14em] ${
          status.needsAttention
            ? 'border-amber-400/30 bg-amber-500/10 text-amber-100'
            : 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100'
        }`}>
          {status.needsAttention ? 'Needs scout check' : 'Coverage ready'}
        </span>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-4">
        {evidenceCounts.map(item => (
          <div key={item.label} className="admin-g2-sm border border-white/10 bg-slate-950/35 px-3 py-2">
            <div className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-100/70">{item.label}</div>
            <div className="mt-1 text-xl font-black text-white">{item.value}</div>
            <div className="mt-1 text-[11px] font-semibold text-emerald-50/65">{item.detail}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <div className="admin-g2-sm border border-white/10 bg-slate-950/35 p-3">
          <div className="text-xs font-black uppercase tracking-[0.16em] text-emerald-100/75">Open Gaps</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {status.attentionReasons.length > 0 ? (
              status.attentionReasons.map(reason => (
                <span key={reason} className="admin-g2-sm border border-amber-300/25 bg-amber-500/10 px-2 py-1 text-[11px] font-black text-amber-100">
                  {reason}
                </span>
              ))
            ) : (
              <span className="text-sm font-semibold text-emerald-100/75">No major evidence gaps on this device.</span>
            )}
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {tasks.map(task => {
            const mission = SCOUTING_MISSIONS[task.missionKey];
            return (
              <button
                key={task.id}
                type="button"
                onClick={() => onOpenTask(task)}
                className={`admin-g2-sm border px-3 py-2 text-left transition-transform hover:-translate-y-0.5 ${getMissionToneClasses(mission.tone)}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs font-black text-white">{mission.title}</div>
                    <div className="mt-1 text-[11px] font-black uppercase tracking-[0.12em] opacity-75">{task.reason}</div>
                  </div>
                  <span className="admin-g2-sm border border-white/10 bg-slate-950/35 px-2 py-1 text-[10px] font-black uppercase text-white/75">
                    Open
                  </span>
                </div>
                {task.ppa?.asks?.[0] ? (
                  <div className="mt-2 text-[11px] font-semibold leading-relaxed text-white/80">{task.ppa.asks[0]}</div>
                ) : (
                  <div className="mt-2 text-[11px] font-semibold leading-relaxed text-white/70">{task.detail}</div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </AdminSurface>
  );
}

export function TeamEvidenceTimelinePanel({
  rows,
  teamNumber,
  onInfo,
  onInfoContext
}: {
  rows: AdminV4TeamEvidenceTimelineItem[];
  teamNumber: string;
  onInfo: (key: AdminV4StatInfoKey) => void;
  onInfoContext: (event: React.MouseEvent, key: AdminV4StatInfoKey) => void;
}) {
  const sourceCounts = rows.reduce<Record<string, number>>((counts, row) => {
    counts[row.sourceLabel] = (counts[row.sourceLabel] || 0) + 1;
    return counts;
  }, {});

  return (
    <AdminSurface className="border-violet-400/25 bg-violet-500/10 p-4" onContextMenu={(event: React.MouseEvent) => onInfoContext(event, 'ppa')}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.18em] text-violet-200">Evidence Timeline</div>
          <h3 className="mt-1 text-xl font-black text-white">Why Team {teamNumber}'s expected range exists</h3>
          <p className="mt-2 max-w-3xl text-sm font-semibold leading-relaxed text-violet-50/80">
            This is the raw evidence chain behind the decision shape: public context, pit priors, match rows, defense reads, and returned admin-task questions.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <span className="admin-g2-sm border border-white/10 bg-slate-950/35 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-violet-100">
            {rows.length} evidence row{rows.length === 1 ? '' : 's'}
          </span>
          <StatInfoButton statKey="ppa" label="Evidence chain" onInfo={onInfo} onInfoContext={onInfoContext} />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {Object.entries(sourceCounts).map(([source, count]) => (
          <span key={source} className="admin-g2-sm border border-white/10 bg-slate-950/40 px-2 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-violet-100/80">
            {source}: {count}
          </span>
        ))}
        {rows.length === 0 && (
          <AdminEmptyState
            className="w-full"
            title="No local evidence rows are attached to this team yet"
            why="The team detail cannot explain its expected range without submitted pre-scout, pit, match, or defense rows."
            action="Send a scout task or import a local evidence backup for this event."
          />
        )}
      </div>

      <div className="admin-scrollbar-hidden mt-4 max-h-[560px] overflow-y-auto pr-1">
        <div className="space-y-3">
          {rows.map(row => {
            const mission = SCOUTING_MISSIONS[row.missionKey];
            const ppa = row.adminTask?.ppa;
            return (
              <div key={row.key} className={`admin-g2-sm border p-3 ${getMissionToneClasses(mission.tone)}`}>
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_150px]">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="admin-g2-sm border border-white/10 bg-slate-950/45 px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-white/75">
                        {row.sourceLabel}
                      </span>
                      <span className="text-[11px] font-black uppercase tracking-[0.14em] opacity-70">{formatLocalTimestamp(row.timestamp)}</span>
                    </div>
                    <div className="mt-2 text-base font-black text-white">{row.title}</div>
                    <p className="mt-1 text-xs font-semibold leading-relaxed opacity-85">{row.subtitle}</p>
                    {row.notes && (
                      <div className="admin-g2-sm mt-2 border border-white/10 bg-slate-950/35 px-3 py-2 text-xs font-semibold leading-relaxed text-white/85">
                        {row.notes}
                      </div>
                    )}
                  </div>
                  <div className="admin-g2-sm border border-white/10 bg-slate-950/35 px-3 py-2">
                    <div className="text-[10px] font-black uppercase tracking-[0.14em] opacity-65">{row.signalLabel}</div>
                    <div className="mt-1 text-lg font-black text-white">{row.signalValue}</div>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {row.pills.map(pill => (
                    <span key={pill} className="admin-g2-sm border border-white/10 bg-slate-950/35 px-2 py-1 text-[11px] font-black text-white/80">
                      {pill}
                    </span>
                  ))}
                  {row.adminTask && (
                    <span className="admin-g2-sm border border-cyan-300/25 bg-cyan-500/10 px-2 py-1 text-[11px] font-black text-cyan-50">
                      admin task returned
                    </span>
                  )}
                </div>

                {ppa && (
                  <div className="admin-g2-sm mt-3 border border-cyan-300/20 bg-cyan-500/10 p-3 text-xs font-semibold text-cyan-50/85">
                    <div className="flex flex-wrap gap-2 text-[11px] font-black uppercase tracking-[0.12em] text-cyan-100">
                      <span>Range {formatMetricValue(ppa.floor ?? null, 1)} / {formatMetricValue(ppa.expected ?? null, 1)} / {formatMetricValue(ppa.ceiling ?? null, 1)}</span>
                      {ppa.role && <span>{ppa.role}</span>}
                      {ppa.uncertainty && <span>{ppa.uncertainty}</span>}
                      {ppa.coverage && <span>{ppa.coverage}</span>}
                    </div>
                    {(ppa.asks || []).length > 0 && (
                      <div className="mt-2 leading-relaxed">
                        Asked to prove: <span className="font-black text-white">{ppa.asks?.[0]}</span>
                      </div>
                    )}
                    {(ppa.warnings || []).length > 0 && (
                      <div className="mt-1 leading-relaxed text-amber-100">
                        Warning: {ppa.warnings?.[0]}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </AdminSurface>
  );
}

export function TeamPerformanceProfilePanel({
  profile,
  ppaInsight
}: {
  profile: TeamPerformanceProfile;
  ppaInsight: PpaInsight | null;
}) {
  const width = 240;
  const height = 76;
  const padding = 8;
  const curve = profile.curve;
  const values = curve.flatMap(point => [point.score, point.fittedScore, point.upperBand]);
  const minValue = Math.min(0, ...values);
  const maxValue = Math.max(1, ...values);
  const xFor = (index: number) =>
    curve.length <= 1 ? width / 2 : padding + (index / (curve.length - 1)) * (width - padding * 2);
  const yFor = (value: number) =>
    height - padding - ((value - minValue) / Math.max(1, maxValue - minValue)) * (height - padding * 2);
  const pathFor = (accessor: (point: TeamPerformanceProfile['curve'][number]) => number) =>
    curve
      .map((point, index) => `${index === 0 ? 'M' : 'L'} ${xFor(index).toFixed(1)} ${yFor(accessor(point)).toFixed(1)}`)
      .join(' ');

  return (
    <div className="admin-g2-sm border border-slate-800 bg-slate-900/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-black uppercase tracking-wider text-slate-500">Performance Profile</div>
          <div className="mt-1 text-sm font-semibold text-slate-300">
            {profile.matchesPlayed} match{profile.matchesPlayed === 1 ? '' : 'es'} · trend {formatMetricValue(profile.recentTrend, 3)}
          </div>
        </div>
        <span className={`admin-g2-sm px-2 py-1 text-xs font-black ${profile.recentTrend >= 0 ? 'bg-emerald-500/15 text-emerald-200' : 'bg-rose-500/15 text-rose-200'}`}>
          {profile.recentTrend >= 0 ? 'RISING' : 'FALLING'}
        </span>
      </div>

      {curve.length > 0 ? (
        <svg className="mt-3 h-20 w-full overflow-visible" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Team ${profile.teamNumber} performance curve`}>
          <path d={pathFor(point => point.lowerBand)} fill="none" stroke="rgb(51 65 85)" strokeWidth="1" strokeDasharray="3 3" />
          <path d={pathFor(point => point.upperBand)} fill="none" stroke="rgb(51 65 85)" strokeWidth="1" strokeDasharray="3 3" />
          <path d={pathFor(point => point.fittedScore)} fill="none" stroke="rgb(34 211 238)" strokeWidth="2.5" strokeLinecap="round" />
          <path d={pathFor(point => point.score)} fill="none" stroke="rgb(244 114 182)" strokeWidth="2" strokeLinecap="round" />
          {curve.map((point, index) => (
            <circle key={`${point.matchKey}-${index}`} cx={xFor(index)} cy={yFor(point.score)} r="2.3" fill="rgb(244 114 182)" />
          ))}
        </svg>
      ) : (
        <AdminEmptyState
          className="mt-3"
          title="No scouted point curve yet"
          why="A trend line needs match rows for this team before it can show performance movement."
          action="Collect match scout rows or import the local archive for this event."
        />
      )}

      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <div className="admin-g2-sm col-span-2 border border-violet-400/25 bg-violet-500/10 px-3 py-3">
          <div className="text-xs font-black uppercase tracking-wider text-violet-200">Contribution Range Shape</div>
          <div className="mt-2">
            <PpaMiniShape insight={ppaInsight} fallbackRating={profile.ppa} />
          </div>
        </div>
        <MetricField label="Contribution" value={formatMetricValue(profile.contribution)} />
        <MetricField label="Peak" value={formatMetricValue(profile.peakScore)} />
        <MetricField label="Floor" value={formatMetricValue(profile.floorScore)} />
        <MetricField label="Floor Non Zero" value={formatMetricValue(profile.floorNonZeroScore)} />
        <MetricField label="Ceiling" value={formatMetricValue(profile.ceilingScore)} />
        <MetricField label="Contribution Deviation" value={formatMetricValue(profile.contributionDeviation)} />
        <MetricField label="Projected" value={formatMetricValue(profile.projectedNextScore)} />
        <MetricField label="Defense" value={formatMetricValue(profile.defense)} />
        <MetricField label="Defense Deviation" value={formatMetricValue(profile.defenseDeviation)} />
      </div>
    </div>
  );
}

export function AdminTaskPpaClosurePanel({ task }: { task: ScoutEvidenceAdminTask }) {
  const ppa = task.ppa;
  if (!ppa) return null;
  const asks = ppa.asks || [];
  const warnings = ppa.warnings || [];

  return (
    <div className="mt-3 admin-g2-sm border border-cyan-400/20 bg-cyan-500/10 p-3 text-xs font-semibold text-cyan-50">
      <div className="font-black uppercase tracking-[0.16em] text-cyan-100/75">Expected-Range Question Closed</div>
      <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        <MetricField label="Expected" value={formatMetricValue(ppa.expected ?? null, 1)} />
        <MetricField label="Floor / Ceiling" value={`${formatMetricValue(ppa.floor ?? null, 1)} / ${formatMetricValue(ppa.ceiling ?? null, 1)}`} />
        <MetricField label="Normal Band" value={`${formatMetricValue(ppa.normalLow ?? null, 1)} to ${formatMetricValue(ppa.normalHigh ?? null, 1)}`} />
        <MetricField label="Role" value={ppa.role || 'Needs role evidence'} />
        <MetricField label="Risk / Trust" value={`${ppa.uncertainty || 'Needs risk read'} / ${formatPercentMetric(ppa.scoutConfidence ?? null, 0)}`} />
      </div>
      {(asks.length > 0 || warnings.length > 0) && (
        <div className="mt-3 grid gap-2 lg:grid-cols-2">
          {asks.length > 0 && (
            <div>
              <div className="font-black uppercase tracking-[0.14em] text-cyan-100/70">Admin Asked</div>
              <div className="mt-1 space-y-1">
                {asks.slice(0, 2).map(ask => (
                  <div key={ask} className="admin-g2-sm border border-cyan-300/20 bg-slate-950/45 px-2 py-1.5 text-cyan-50">
                    {ask}
                  </div>
                ))}
              </div>
            </div>
          )}
          {warnings.length > 0 && (
            <div>
              <div className="font-black uppercase tracking-[0.14em] text-amber-100/70">Model Warnings</div>
              <div className="mt-1 space-y-1">
                {warnings.slice(0, 2).map(warning => (
                  <div key={warning} className="admin-g2-sm border border-amber-300/20 bg-amber-500/10 px-2 py-1.5 text-amber-50">
                    {warning}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.12em] text-cyan-100/70">
        {ppa.coverage && <span>{ppa.coverage}</span>}
        {ppa.model && <span>{ppa.model}</span>}
        {ppa.tailRisk && <span>Tail risk: {ppa.tailRisk}</span>}
      </div>
    </div>
  );
}
