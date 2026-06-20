import { SCOUTING_MISSIONS, SCOUTING_USE_MOMENTS, ScoutingMissionKey, getMissionToneClasses } from '../../utils/scoutingWorkflow';
import { AdminSurface } from './AdminV4Primitives';
import { FocusHeader } from './AdminV4UiAtoms';

export interface AdminV4CollectionPipelineStage {
  key: ScoutingMissionKey;
  count: number;
  countLabel: string;
  readinessLabel: string;
  readinessDetail: string;
  tone: 'emerald' | 'amber' | 'rose' | 'cyan';
}

export interface AdminV4PpaReadinessCard {
  label: string;
  value: number | string;
  detail: string;
  tone?: 'emerald' | 'amber' | 'rose' | 'cyan';
}

export default function AdminV4DataPipelinePanel({
  stages,
  ppaReadinessCards,
  compact = false
}: {
  stages?: AdminV4CollectionPipelineStage[];
  ppaReadinessCards?: AdminV4PpaReadinessCard[];
  compact?: boolean;
}) {
  const missionKeys: ScoutingMissionKey[] = ['preScout', 'pitScout', 'matchScout', 'defenseScout'];
  const useMoments = [SCOUTING_USE_MOMENTS.matches, SCOUTING_USE_MOMENTS.pickList, SCOUTING_USE_MOMENTS.visualize];
  const displayedStages: AdminV4CollectionPipelineStage[] = stages || missionKeys.map(key => {
    const mission = SCOUTING_MISSIONS[key];
    return {
      key,
      count: 0,
      countLabel: 'signals',
      readinessLabel: mission.title,
      readinessDetail: mission.modelImpact,
      tone: 'cyan'
    };
  });
  const readinessToneClass: Record<AdminV4CollectionPipelineStage['tone'], string> = {
    emerald: 'border-emerald-400/30 bg-emerald-500/15 text-emerald-100',
    amber: 'border-amber-400/30 bg-amber-500/15 text-amber-100',
    rose: 'border-rose-400/30 bg-rose-500/15 text-rose-100',
    cyan: 'border-cyan-400/30 bg-cyan-500/15 text-cyan-100'
  };

  return (
    <AdminSurface className="p-5">
      <FocusHeader
        title={compact ? 'Pipeline Health' : 'Collection Pipeline'}
        description="Raw scouting is organized by when it is collected, then turned into the processed signals each decision moment needs."
      />
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {displayedStages.map(stage => {
          const mission = SCOUTING_MISSIONS[stage.key];
          return (
            <div key={mission.key} className={`admin-g2-sm border p-4 ${getMissionToneClasses(mission.tone)}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.18em] opacity-75">{mission.shortTitle}</div>
                  <div className="mt-2 text-lg font-black text-white">{mission.title}</div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-black text-white">{stage.count}</div>
                  <div className="text-[10px] font-black uppercase tracking-wider opacity-70">{stage.countLabel}</div>
                </div>
              </div>
              <div className={`admin-g2-sm mt-3 inline-flex border px-2 py-1 text-[10px] font-black uppercase ${readinessToneClass[stage.tone]}`}>
                {stage.readinessLabel}
              </div>
              <div className="mt-3 text-xs font-semibold opacity-85">{stage.readinessDetail}</div>
              <div className="mt-3 text-xs font-semibold opacity-80">{mission.processedSignals.slice(0, 3).join(' / ')}</div>
            </div>
          );
        })}
      </div>
      {ppaReadinessCards && ppaReadinessCards.length > 0 && (
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          {ppaReadinessCards.map(card => (
            <div key={card.label} className={`admin-g2-sm border p-4 ${readinessToneClass[card.tone || 'cyan']}`}>
              <div className="text-[10px] font-black uppercase tracking-[0.18em] opacity-75">{card.label}</div>
              <div className="mt-2 text-2xl font-black text-white">{card.value}</div>
              <div className="mt-2 text-xs font-semibold opacity-85">{card.detail}</div>
            </div>
          ))}
        </div>
      )}
      {!compact && (
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {useMoments.map(moment => (
            <div key={moment.key} className="admin-g2-sm border border-slate-800 bg-slate-950 p-4">
              <div className="text-sm font-black text-white">{moment.title}</div>
              <div className="mt-2 text-xs font-semibold text-slate-500">{moment.when}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {moment.needs.slice(0, 4).map(need => (
                  <span key={need} className="admin-g2-sm border border-slate-700 px-2 py-1 text-[11px] font-black text-slate-300">
                    {need}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminSurface>
  );
}
