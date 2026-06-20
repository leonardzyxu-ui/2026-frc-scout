import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { getMissionToneClasses, getMissionUseMoments, getScoutingMission, ScoutingMissionKey } from '../../utils/scoutingWorkflow';
import { ScoutTaskHandoff } from '../../utils/scoutTaskHandoff';

const formatTaskMetric = (value: number | null | undefined, digits = 1) =>
  value == null || !Number.isFinite(value) ? '—' : value.toFixed(digits);

const formatTaskPercent = (value: number | null | undefined) =>
  value == null || !Number.isFinite(value) ? '—' : `${Math.round(value * 100)}%`;

const formatTaskBand = (low: number | null | undefined, high: number | null | undefined) =>
  low == null && high == null ? '—' : `${formatTaskMetric(low)} to ${formatTaskMetric(high)}`;

const getTaskMatchLabel = (handoff: ScoutTaskHandoff) => {
  if (!handoff.matchNumber) return '';
  const matchPrefix = handoff.matchType === 'Practice' ? 'Practice' : 'QM';
  return `${matchPrefix}${handoff.matchNumber}`;
};

const getPrimaryScoutTask = (handoff: ScoutTaskHandoff) => {
  const matchLabel = getTaskMatchLabel(handoff);
  const matchCopy = matchLabel ? ` in ${matchLabel}` : '';
  return `Watch Team ${handoff.teamNumber}${matchCopy}.`;
};

const getPrimaryScoutAsk = (handoff: ScoutTaskHandoff) => {
  const firstAsk = handoff.ppa?.asks?.find(Boolean);
  if (firstAsk) return firstAsk;
  if (handoff.reason) return handoff.reason;
  return 'Record what you actually see, especially failures, fouls, defense, and cycle changes.';
};

export default function ScoutWorkflowHeader({
  missionKey,
  title,
  subtitle,
  eyebrow,
  status,
  metric,
  action,
  handoff,
  onBack,
  className = ''
}: {
  missionKey: ScoutingMissionKey;
  title?: string;
  subtitle?: string;
  eyebrow?: string;
  status?: React.ReactNode;
  metric?: React.ReactNode;
  action?: React.ReactNode;
  handoff?: ScoutTaskHandoff | null;
  onBack: () => void;
  className?: string;
}) {
  const mission = getScoutingMission(missionKey);
  const toneClass = getMissionToneClasses(mission.tone);
  const backLabel = handoff?.returnLabel ? `Back to ${handoff.returnLabel}` : 'Back';

  return (
    <header className={`admin-g2 border border-slate-800 bg-slate-900/70 p-4 shadow-sm shadow-slate-950/10 md:p-5 ${className}`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="admin-g2-sm mb-3 inline-flex items-center gap-2 border border-slate-800 bg-slate-950 px-3 py-2 text-sm font-black text-slate-300 transition-colors hover:bg-slate-800"
          >
            <ArrowLeft className="h-4 w-4" />
            {backLabel}
          </button>
          <div className="text-xs font-black uppercase tracking-[0.24em] text-slate-500">
            {eyebrow || mission.shortTitle}
          </div>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-white md:text-4xl">
            {title || mission.title}
          </h1>
          <p className="mt-2 hidden max-w-3xl text-sm font-semibold text-slate-400 sm:block">
            {subtitle || mission.question}
          </p>
          {handoff?.teamNumber && (
            <div className="mt-3 space-y-3">
              <div className={`admin-g2-sm max-w-4xl border px-3 py-3 text-sm font-semibold ${toneClass}`}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] opacity-70">Scout Task</div>
                    <div className="mt-1 text-lg font-black text-white">{getPrimaryScoutTask(handoff)}</div>
                    <div className="mt-1 text-sm font-semibold text-white/80">{getPrimaryScoutAsk(handoff)}</div>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-1.5">
                    {handoff.teamName && <span className="admin-g2-sm border border-white/10 bg-slate-950/35 px-2 py-1 text-xs font-black text-white/80">{handoff.teamName}</span>}
                    {handoff.alliance && <span className="admin-g2-sm border border-white/10 bg-slate-950/35 px-2 py-1 text-xs font-black text-white/80">{handoff.alliance}</span>}
                  </div>
                </div>
              </div>
              {handoff.ppa && (
                <details className={`admin-g2-sm max-w-4xl border p-3 text-xs font-semibold ${toneClass}`}>
                  <summary className="cursor-pointer list-none">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-black uppercase tracking-[0.18em] opacity-70">Task Context</span>
                      <span className="text-white">Open task context</span>
                      <span className="opacity-80">Why this task was sent and what evidence closes it.</span>
                    </div>
                  </summary>
                  <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="font-black uppercase tracking-[0.18em] opacity-70">Task Evidence Brief</div>
                      {(handoff.detail || handoff.context) && (
                        <div className="admin-g2-sm mt-2 border border-white/10 bg-slate-950/35 px-3 py-2 text-white/85">
                          <div className="font-black uppercase tracking-[0.12em] opacity-65">Why This Is Being Asked</div>
                          <div className="mt-1 leading-relaxed">{handoff.detail || handoff.context}</div>
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 lg:max-w-sm">
                      <div className="font-black uppercase tracking-[0.18em] opacity-70">What To Prove</div>
                      <div className="mt-2 space-y-1.5">
                        {(handoff.ppa.asks || []).slice(0, 3).map(ask => (
                          <div key={ask} className="admin-g2-sm border border-white/10 bg-slate-950/35 px-2 py-1.5 text-white/90">
                            {ask}
                          </div>
                        ))}
                        {(handoff.ppa.asks || []).length === 0 && (
                          <div className="admin-g2-sm border border-white/10 bg-slate-950/35 px-2 py-1.5 text-white/70">
                            Capture the evidence that explains whether this expected range is trustworthy.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <details className="admin-g2-sm mt-3 border border-white/10 bg-slate-950/35 px-3 py-2">
                    <summary className="cursor-pointer list-none font-black text-white/85">
                      Advanced range and model context
                    </summary>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                      <div className="admin-g2-sm border border-white/10 bg-slate-950/35 px-3 py-2">
                        <div className="font-black uppercase tracking-[0.12em] opacity-65">Expected</div>
                        <div className="mt-1 text-sm font-black text-white">{formatTaskMetric(handoff.ppa.expected)}</div>
                      </div>
                      <div className="admin-g2-sm border border-white/10 bg-slate-950/35 px-3 py-2">
                        <div className="font-black uppercase tracking-[0.12em] opacity-65">Floor / Ceiling</div>
                        <div className="mt-1 text-sm font-black text-white">
                          {formatTaskMetric(handoff.ppa.floor)} / {formatTaskMetric(handoff.ppa.ceiling)}
                        </div>
                      </div>
                      <div className="admin-g2-sm border border-white/10 bg-slate-950/35 px-3 py-2">
                        <div className="font-black uppercase tracking-[0.12em] opacity-65">Normal Band</div>
                        <div className="mt-1 text-sm font-black text-white">{formatTaskBand(handoff.ppa.normalLow, handoff.ppa.normalHigh)}</div>
                      </div>
                      <div className="admin-g2-sm border border-white/10 bg-slate-950/35 px-3 py-2">
                        <div className="font-black uppercase tracking-[0.12em] opacity-65">Role</div>
                        <div className="mt-1 text-sm font-black text-white">{handoff.ppa.role || 'Needs role evidence'}</div>
                      </div>
                      <div className="admin-g2-sm border border-white/10 bg-slate-950/35 px-3 py-2">
                        <div className="font-black uppercase tracking-[0.12em] opacity-65">Risk / Trust</div>
                        <div className="mt-1 text-sm font-black text-white">
                          {handoff.ppa.uncertainty || 'Needs risk read'} / {formatTaskPercent(handoff.ppa.scoutConfidence)}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-black uppercase tracking-[0.12em] opacity-80">
                      {handoff.ppa.coverage && <span>{handoff.ppa.coverage}</span>}
                      {handoff.ppa.model && <span>{handoff.ppa.model}</span>}
                      {handoff.ppa.tailRisk && <span>Tail risk: {handoff.ppa.tailRisk}</span>}
                    </div>
                    {(handoff.ppa.warnings || []).length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {(handoff.ppa.warnings || []).slice(0, 3).map(warning => (
                          <span key={warning} className="admin-g2-sm border border-amber-300/20 bg-amber-300/10 px-2 py-1 text-[11px] font-black text-amber-50">
                            {warning}
                          </span>
                        ))}
                      </div>
                    )}
                  </details>
                </details>
              )}
            </div>
          )}
          {status && <div className="mt-3">{status}</div>}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row lg:flex-col lg:items-end">
          {(metric || action) && (
            <div className="flex flex-wrap items-stretch justify-end gap-3">
              {metric}
              {action}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export function ScoutSignalHandoff({
  missionKey,
  title = 'Where Evidence Goes'
}: {
  missionKey: ScoutingMissionKey;
  title?: string;
}) {
  const mission = getScoutingMission(missionKey);
  const useMoments = getMissionUseMoments(missionKey);
  const toneClass = getMissionToneClasses(mission.tone);

  return (
    <section className={`admin-g2 border p-4 ${toneClass}`}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.2em] opacity-75">{title}</div>
          <h3 className="mt-1 text-xl font-black text-white">Submit clean evidence first</h3>
          <p className="mt-2 max-w-3xl text-sm font-semibold leading-relaxed opacity-85">
            Your job is to record what happened. Admin can use the submitted row for match plans, pick lists, and reports after review.
          </p>
        </div>
      </div>

      <details className="admin-g2-sm mt-4 border border-white/10 bg-slate-950/35 px-3 py-3">
        <summary className="cursor-pointer list-none text-xs font-black uppercase tracking-[0.18em] text-white/80">
          Open admin-use details
        </summary>
        <div className="mt-3 text-xs font-semibold leading-relaxed opacity-85">{mission.modelImpact}</div>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div className="admin-g2-sm border border-white/10 bg-slate-950/35 px-3 py-3">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] opacity-70">Raw Inputs</div>
            <div className="mt-2 text-xs font-semibold opacity-85">{mission.rawInputs.slice(0, 4).join(' / ')}</div>
          </div>
          <div className="admin-g2-sm border border-white/10 bg-slate-950/35 px-3 py-3">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] opacity-70">Processed Signals</div>
            <div className="mt-2 text-xs font-semibold opacity-85">{mission.processedSignals.slice(0, 4).join(' / ')}</div>
          </div>
          <div className="admin-g2-sm border border-white/10 bg-slate-950/35 px-3 py-3">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] opacity-70">Used For</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {useMoments.slice(0, 4).map(moment => (
                <span
                  key={moment.key}
                  className="admin-g2-sm border border-white/10 bg-slate-950/45 px-2 py-1 text-[11px] font-black text-white"
                >
                  {moment.title}
                </span>
              ))}
            </div>
          </div>
        </div>
      </details>
    </section>
  );
}
