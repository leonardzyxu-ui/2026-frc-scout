import React from 'react';
import {
  getMissionToneClasses,
  getScoutingMission,
  EXPECTED_RANGE_COLLECTION_FIELDS,
  ScoutingMissionKey
} from '../../utils/scoutingWorkflow';

export default function ScoutingMissionPanel({
  missionKey,
  compact = false,
  className = ''
}: {
  missionKey: ScoutingMissionKey;
  compact?: boolean;
  className?: string;
}) {
  const mission = getScoutingMission(missionKey);
  const toneClass = getMissionToneClasses(mission.tone);

  if (compact) {
    return (
      <div className={`admin-g2-sm border px-4 py-3 ${toneClass} ${className}`}>
        <CompactMissionList title="Collect Now" items={mission.rawInputs} />

        <details className="admin-g2-sm mt-3 border border-white/10 bg-slate-950/35 px-3 py-2">
          <summary className="cursor-pointer list-none text-xs font-black uppercase tracking-[0.18em] text-slate-100/85">
            Where this evidence goes
          </summary>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <CompactMissionList title="Creates" items={mission.processedSignals} />
            <CompactMissionList title="Used For" items={mission.usedFor.slice(0, 3)} />
          </div>
        </details>

        {missionKey === 'matchScout' && (
          <details className="admin-g2-sm mt-3 border border-white/10 bg-slate-950/35 px-3 py-2">
            <summary className="cursor-pointer list-none text-xs font-black uppercase tracking-[0.18em] text-slate-100/85">
              Open expected-range checklist
            </summary>
            <div className="mt-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div className="text-xs font-semibold text-slate-100/80">
                Capture these after the basics so Admin can separate ceiling, floor, and role.
              </div>
              <div className="flex flex-wrap gap-2 md:justify-end">
                {EXPECTED_RANGE_COLLECTION_FIELDS.slice(0, 3).map(item => (
                  <span key={item} className="admin-g2-sm border border-white/10 bg-slate-950/45 px-2 py-1 text-[11px] font-semibold text-slate-100">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </details>
        )}
      </div>
    );
  }

  return (
    <section className={`admin-g2 border p-5 ${toneClass} ${className}`}>
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.22em] opacity-75">Scouting Mission</div>
          <h2 className="mt-1 text-2xl font-black text-white">{mission.title}</h2>
          <p className="mt-2 text-sm font-semibold opacity-85">{mission.when}</p>
        </div>
        <div className="admin-g2-sm border border-white/10 bg-slate-950/50 px-4 py-3 text-sm font-black text-white">
          {mission.shortTitle}
        </div>
      </div>

      <div className="admin-g2-sm mt-4 border border-white/10 bg-slate-950/45 px-4 py-3 text-sm font-black text-white">
        {mission.question}
      </div>

      <div className="mt-4">
        <MissionList title="Collect" items={mission.rawInputs} />
      </div>

      <details className="admin-g2-sm mt-4 border border-white/10 bg-slate-950/45 p-4">
        <summary className="cursor-pointer list-none text-sm font-black text-white">
          Where this evidence goes
        </summary>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <MissionList title="Creates" items={mission.processedSignals} />
          <MissionList title="Used For" items={mission.usedFor} />
        </div>
      </details>

      {missionKey === 'matchScout' && (
        <details className="admin-g2-sm mt-4 border border-white/10 bg-slate-950/45 p-4">
          <summary className="cursor-pointer list-none text-xs font-black uppercase tracking-[0.18em] opacity-75">
            Expected Range Needs
          </summary>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {EXPECTED_RANGE_COLLECTION_FIELDS.map(item => (
              <div key={item} className="admin-g2-sm border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs font-semibold text-slate-200">
                {item}
              </div>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}

function CompactMissionList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="admin-g2-sm border border-white/10 bg-slate-950/35 px-3 py-2">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] opacity-70">{title}</div>
      <div className="mt-2 flex flex-wrap gap-2">
        {items.map(item => (
          <span key={item} className="admin-g2-sm border border-white/10 bg-slate-950/45 px-2 py-1 text-[11px] font-semibold text-slate-100">
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function MissionList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="admin-g2-sm border border-white/10 bg-slate-950/45 p-4">
      <div className="text-xs font-black uppercase tracking-[0.18em] opacity-70">{title}</div>
      <div className="mt-3 space-y-2">
        {items.map(item => (
          <div key={item} className="text-sm font-semibold text-slate-100">
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}
