import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { getMissionToneClasses, getMissionUseMoments, getScoutingMission, ScoutingMissionKey } from '../../utils/scoutingWorkflow';

export default function ScoutWorkflowHeader({
  missionKey,
  title,
  subtitle,
  eyebrow,
  status,
  metric,
  action,
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
  onBack: () => void;
  className?: string;
}) {
  const mission = getScoutingMission(missionKey);
  const useMoments = getMissionUseMoments(missionKey);
  const toneClass = getMissionToneClasses(mission.tone);

  return (
    <header className={`admin-g2 border border-slate-800 bg-slate-900/70 p-4 shadow-xl shadow-slate-950/20 md:p-5 ${className}`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="admin-g2-sm mb-3 inline-flex items-center gap-2 border border-slate-800 bg-slate-950 px-3 py-2 text-sm font-black text-slate-300 transition-colors hover:bg-slate-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
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
          {status && <div className="mt-3">{status}</div>}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row lg:flex-col lg:items-end">
          <div className={`admin-g2-sm hidden max-w-md border px-4 py-3 text-sm font-semibold sm:block ${toneClass}`}>
            <div className="text-[10px] font-black uppercase tracking-[0.18em] opacity-70">Used Next</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {useMoments.slice(0, 4).map(moment => (
                <span key={moment.key} className="admin-g2-sm border border-white/10 bg-slate-950/45 px-2 py-1 text-[11px] font-black text-slate-100">
                  {moment.title}
                </span>
              ))}
            </div>
          </div>
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
