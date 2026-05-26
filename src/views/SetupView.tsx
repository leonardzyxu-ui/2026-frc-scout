import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, BarChart3, ClipboardList, Database, History, Search, ShieldCheck, Swords, Trophy, Wrench } from 'lucide-react';
import {
  PPA_SHAPE_OUTPUTS,
  SCOUTING_DAY_SEQUENCE,
  SCOUTING_MISSIONS,
  SCOUTING_USE_MOMENTS,
  ScoutingMissionKey,
  getMissionUseMoments,
  getMissionToneClasses
} from '../utils/scoutingWorkflow';

export default function SetupView() {
  const navigate = useNavigate();
  const [clickCount, setClickCount] = useState(0);
  const [lastClickTime, setLastClickTime] = useState(0);
  const missionOrder: ScoutingMissionKey[] = ['preScout', 'pitScout', 'matchScout', 'defenseScout'];
  const missionIcons: Record<ScoutingMissionKey, React.ReactNode> = {
    preScout: <Search className="h-5 w-5" />,
    pitScout: <Wrench className="h-5 w-5" />,
    matchScout: <ClipboardList className="h-5 w-5" />,
    defenseScout: <ShieldCheck className="h-5 w-5" />
  };
  const useMomentIcons: Record<keyof typeof SCOUTING_USE_MOMENTS, React.ReactNode> = {
    now: <Swords className="h-4 w-4" />,
    matches: <Swords className="h-4 w-4" />,
    pickList: <Trophy className="h-4 w-4" />,
    visualize: <BarChart3 className="h-4 w-4" />,
    data: <Database className="h-4 w-4" />
  };

  const handleTitleClick = () => {
    const now = Date.now();
    if (now - lastClickTime > 500) {
      setClickCount(1);
    } else {
      const newCount = clickCount + 1;
      setClickCount(newCount);
      if (newCount >= 5) {
        navigate('/admin');
        setClickCount(0);
      }
    }
    setLastClickTime(now);
  };

  return (
    <div className="h-full overflow-y-auto bg-slate-950 px-4 py-5 text-white md:px-8">
      <div className="mx-auto flex min-h-full max-w-7xl flex-col gap-5 pb-10">
        <header className="flex flex-col gap-4 border-b border-slate-800 pb-5 lg:flex-row lg:items-center lg:justify-between">
          <div onClick={handleTitleClick} style={{ cursor: 'pointer', userSelect: 'none' }}>
            <div className="text-xs font-black uppercase tracking-[0.35em] text-cyan-300">REBUILT</div>
            <h1 className="mt-1 text-3xl font-black tracking-tight text-white md:text-4xl">Scouting Hub</h1>
            <p className="mt-2 max-w-2xl text-sm font-semibold text-slate-400">
              Pick the evidence job you are doing right now. The app turns raw scout observations into PPA shape, future match plans, pick-list context, charts, and reports.
            </p>
          </div>
          <button
            onClick={() => navigate('/history')}
            className="admin-g2-sm inline-flex items-center justify-center gap-2 border border-violet-400/30 bg-violet-500/10 px-4 py-3 text-sm font-black text-violet-100 transition-colors hover:bg-violet-500/20"
          >
            <History className="h-4 w-4" />
            My Device History
          </button>
        </header>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <div className="admin-g2 border border-slate-800 bg-slate-900/65 p-5 shadow-xl shadow-slate-950/25">
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">Head Scout Loop</div>
                <h2 className="mt-1 text-2xl font-black text-white">How today turns into decisions</h2>
              </div>
              <div className="text-sm font-semibold text-slate-400">Collect, validate, model, act.</div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {SCOUTING_DAY_SEQUENCE.map((item, index) => (
                <div key={item.step} className="admin-g2-sm border border-slate-800 bg-slate-950/55 p-4">
                  <div className="flex items-center gap-2">
                    <span className="admin-g2-sm border border-cyan-400/30 bg-cyan-500/10 px-2 py-1 text-xs font-black text-cyan-100">
                      {index + 1}
                    </span>
                    <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">{item.step}</div>
                  </div>
                  <div className="mt-3 text-sm font-black leading-relaxed text-white">{item.action}</div>
                  <div className="mt-2 text-xs font-semibold leading-relaxed text-slate-400">{item.result}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="admin-g2 border border-cyan-400/25 bg-cyan-500/10 p-5 shadow-xl shadow-slate-950/25">
            <div className="text-xs font-black uppercase tracking-[0.22em] text-cyan-200">Model Signal</div>
            <h2 className="mt-1 text-2xl font-black text-white">PPA is a shape</h2>
            <p className="mt-2 text-sm font-semibold leading-relaxed text-cyan-50/75">
              A scout row is not just a score. It helps the model decide expected value, upside, bad-match risk, and the role a team can safely play.
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {PPA_SHAPE_OUTPUTS.map(item => (
                <div key={item.label} className="admin-g2-sm border border-cyan-200/10 bg-slate-950/45 px-3 py-3">
                  <div className="text-sm font-black text-white">{item.label}</div>
                  <div className="mt-1 text-xs font-semibold leading-relaxed text-cyan-50/70">{item.detail}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <main className="grid min-w-0 flex-1 gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
          <section className="admin-g2 min-w-0 border border-slate-800 bg-slate-900/65 p-5 shadow-xl shadow-slate-950/25">
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">Collect</div>
                <h2 className="mt-1 text-2xl font-black text-white">What are you doing now?</h2>
              </div>
              <div className="text-sm font-semibold text-slate-400">Choose the job; Admin V4 uses it where it matters.</div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {missionOrder.map(key => {
                const mission = SCOUTING_MISSIONS[key];
                const usedNext = getMissionUseMoments(key).map(moment => moment.title);
                return (
                  <button
                    key={mission.key}
                    type="button"
                    onClick={() => mission.route && navigate(mission.route)}
                    className={`admin-g2-sm group min-w-0 border p-5 text-left transition-all hover:-translate-y-0.5 active:scale-[0.99] ${getMissionToneClasses(mission.tone)}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] opacity-75">
                          {missionIcons[key]}
                          <span>{mission.shortTitle}</span>
                        </div>
                        <div className="mt-3 text-2xl font-black text-white">{mission.title}</div>
                      </div>
                      <span className="admin-g2-sm shrink-0 border border-white/10 bg-slate-950/45 p-2 text-white transition-transform group-hover:translate-x-0.5">
                        <ArrowRight className="h-4 w-4" />
                      </span>
                    </div>
                    <div className="mt-3 text-sm font-semibold opacity-85">{mission.question}</div>
                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      <MissionChipList title="Creates" items={mission.processedSignals.slice(0, 3)} />
                      <MissionChipList title="Used Next" items={usedNext.slice(0, 3)} />
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <aside className="min-w-0 space-y-5">
            <section className="admin-g2 border border-slate-800 bg-slate-900/65 p-5 shadow-xl shadow-slate-950/25">
              <div className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">Use</div>
              <h2 className="mt-1 text-xl font-black text-white">Where the data goes</h2>
              <div className="mt-4 space-y-3">
                {Object.values(SCOUTING_USE_MOMENTS).map(moment => (
                  <div key={moment.key} className="admin-g2-sm border border-slate-800 bg-slate-950/65 p-3">
                    <div className="flex items-center gap-2">
                      <span className="text-cyan-200">{useMomentIcons[moment.key]}</span>
                      <div className="font-black text-white">{moment.title}</div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {moment.needs.slice(0, 4).map(item => (
                        <span key={item} className="admin-g2-sm border border-slate-800 bg-slate-900 px-2 py-1 text-[11px] font-semibold text-slate-300">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="admin-g2 border border-emerald-400/25 bg-emerald-500/10 p-5 shadow-xl shadow-slate-950/25">
              <div className="text-xs font-black uppercase tracking-[0.22em] text-emerald-200">Rule Of Thumb</div>
              <h2 className="mt-1 text-xl font-black text-white">Choose by moment</h2>
              <div className="mt-3 space-y-2 text-sm font-semibold leading-relaxed text-emerald-50/80">
                <div className="admin-g2-sm border border-emerald-200/10 bg-slate-950/40 px-3 py-2">No match yet: Pre Scout or Pit Scout.</div>
                <div className="admin-g2-sm border border-emerald-200/10 bg-slate-950/40 px-3 py-2">Match is happening: Match Scout your assigned robot.</div>
                <div className="admin-g2-sm border border-emerald-200/10 bg-slate-950/40 px-3 py-2">Defense changed the match: Defense Scout the interaction.</div>
              </div>
            </section>
          </aside>
        </main>
      </div>
    </div>
  );
}

function MissionChipList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="admin-g2-sm border border-white/10 bg-slate-950/35 px-3 py-2">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] opacity-70">{title}</div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {items.map(item => (
          <span key={item} className="admin-g2-sm border border-white/10 bg-slate-950/45 px-2 py-1 text-[11px] font-semibold text-slate-100">
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
