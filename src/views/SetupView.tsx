import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, BarChart3, ClipboardList, Database, History, Lock, Search, ShieldCheck, Swords, Trophy, Wrench } from 'lucide-react';
import {
  EXPECTED_RANGE_OUTPUTS,
  SCOUTING_MISSIONS,
  SCOUTING_DAY_SEQUENCE,
  SCOUTING_USE_MOMENTS,
  ScoutingMissionKey,
  getAdminUseMomentRoute,
  getMissionUseMoments,
  getMissionToneClasses
} from '../utils/scoutingWorkflow';
import { getScoutArchiveUsername, listScoutArchiveRecords } from '../utils/scoutArchive';
import { buildScoutTaskHandoffPath, loadScoutTaskHandoff, ScoutTaskHandoff } from '../utils/scoutTaskHandoff';
import { getCachedPreMatchSheet } from '../utils/preMatchCache';
import { DEFAULT_EVENT_KEY, getStoredEventKey } from '../utils/sharedEventState';
import { isCurrentUserAdmin } from '../utils/adminAuth';

const missionOrder: ScoutingMissionKey[] = ['preScout', 'pitScout', 'matchScout', 'defenseScout'];

const lanePrinciples = [
  {
    title: 'Pre Scout',
    rule: 'Push work here first.',
    detail: 'Use public records, video, history, and model priors while the team still has time.'
  },
  {
    title: 'Pit Scout',
    rule: 'Facts beat claims.',
    detail: 'Trust observed robot specs. Discount self-reported scoring or defense until matches prove it.'
  },
  {
    title: 'Match Scout',
    rule: 'Only live truth.',
    detail: 'Capture actual capability, pressure behavior, reliability, and contradictions without overloading one scout.'
  }
];

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

type MissionLocalStats = Record<ScoutingMissionKey, { records: number; unsynced: number; cachedAt?: number | null }>;

const formatTaskMetric = (value: number | null | undefined, digits = 1) =>
  value == null || !Number.isFinite(value) ? '—' : value.toFixed(digits);

const formatTaskPercent = (value: number | null | undefined) =>
  value == null || !Number.isFinite(value) ? '—' : `${Math.round(value * 100)}%`;

const emptyMissionStats = (): MissionLocalStats => ({
  preScout: { records: 0, unsynced: 0, cachedAt: null },
  pitScout: { records: 0, unsynced: 0 },
  matchScout: { records: 0, unsynced: 0 },
  defenseScout: { records: 0, unsynced: 0 }
});

const missionForArchiveRecordType = (recordType: string): ScoutingMissionKey | null => {
  if (recordType === 'match' || recordType === 'matchV4') return 'matchScout';
  if (recordType === 'matchDefense') return 'defenseScout';
  if (recordType === 'pit') return 'pitScout';
  return null;
};

export default function SetupView() {
  const navigate = useNavigate();
  const location = useLocation();
  const [clickCount, setClickCount] = useState(0);
  const [lastClickTime, setLastClickTime] = useState(0);
  const [pendingTask, setPendingTask] = useState<ScoutTaskHandoff | null>(null);
  const [archiveSummary, setArchiveSummary] = useState(() => ({
    username: '',
    totalRecords: 0,
    unsyncedRecords: 0,
    missionStats: emptyMissionStats()
  }));
  const [canShowAdminTools, setCanShowAdminTools] = useState(false);

  const pendingTaskMission = pendingTask ? SCOUTING_MISSIONS[pendingTask.missionKey] : null;
  const pendingTaskPath = useMemo(() => {
    if (!pendingTask || !pendingTaskMission?.route) return '';
    return buildScoutTaskHandoffPath(pendingTaskMission.route, pendingTask);
  }, [pendingTask, pendingTaskMission]);

  useEffect(() => {
    let cancelled = false;
    const hydrateScoutContext = async () => {
      const nextTask = loadScoutTaskHandoff();
      const missionStats = emptyMissionStats();
      try {
        const eventKey = getStoredEventKey() || DEFAULT_EVENT_KEY;
        const [username, records, preScoutCache, isAdmin] = await Promise.all([
          getScoutArchiveUsername().catch(() => ''),
          listScoutArchiveRecords({ includeDeleted: false }).catch(() => []),
          getCachedPreMatchSheet(eventKey).catch(() => null),
          isCurrentUserAdmin().catch(() => false)
        ]);
        records.forEach(record => {
          const missionKey = missionForArchiveRecordType(record.recordType);
          if (!missionKey) return;
          missionStats[missionKey].records += 1;
          if (record.syncStatus !== 'synced') missionStats[missionKey].unsynced += 1;
        });
        if (preScoutCache) {
          missionStats.preScout.records = preScoutCache.profiles.length;
          missionStats.preScout.cachedAt = preScoutCache.cachedAt;
        }
        if (!cancelled) {
          setPendingTask(nextTask);
          setArchiveSummary({
            username: username || '',
            totalRecords: records.length,
            unsyncedRecords: records.filter(record => record.syncStatus !== 'synced').length,
            missionStats
          });
          setCanShowAdminTools(isAdmin);
        }
      } catch (error) {
        console.warn('Unable to load scout landing context', error);
        if (!cancelled) setPendingTask(nextTask);
      }
    };

    void hydrateScoutContext();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleTitleClick = () => {
    const now = Date.now();
    if (now - lastClickTime > 500) {
      setClickCount(1);
    } else {
      const newCount = clickCount + 1;
      setClickCount(newCount);
      if (newCount >= 5 && canShowAdminTools) {
        navigate('/admin');
        setClickCount(0);
      }
    }
    setLastClickTime(now);
  };

  return (
    <div className="h-full overflow-y-auto bg-slate-950 px-4 py-5 text-white md:px-8">
      <div className="mx-auto flex min-h-full min-w-0 max-w-7xl flex-col gap-5 pb-8">
        <header className="flex flex-col gap-4 border-b border-slate-800 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0" onClick={handleTitleClick} style={{ cursor: 'pointer', userSelect: 'none' }}>
            <div className="text-xs font-black uppercase tracking-[0.35em] text-cyan-300">PowerScout</div>
            <h1 className="mt-1 text-3xl font-black tracking-tight text-white md:text-5xl">Which scouting lane are you in?</h1>
            <p className="mt-2 max-w-2xl break-words text-sm font-semibold leading-relaxed text-slate-400">
              Start with the calmest source of truth available. Pre-scout reduces unknowns, pit scout separates facts from claims, and match scout records what only live action can prove.
            </p>
          </div>
          <div className={`grid gap-2 ${canShowAdminTools ? 'sm:grid-cols-2' : ''} lg:w-[360px]`}>
            {canShowAdminTools && (
              <button
                onClick={() => navigate('/adminv4')}
                className="admin-g2-sm inline-flex items-center justify-center gap-2 border border-cyan-400/30 bg-cyan-500/10 px-4 py-3 text-sm font-black text-cyan-50 transition-colors hover:bg-cyan-500/20"
              >
                <Lock className="h-4 w-4" />
                Admin Tools
              </button>
            )}
            <button
              onClick={() => navigate('/history')}
              className="admin-g2-sm inline-flex items-center justify-center gap-2 border border-violet-400/30 bg-violet-500/10 px-4 py-3 text-sm font-black text-violet-100 transition-colors hover:bg-violet-500/20"
            >
              <History className="h-4 w-4" />
              My Evidence
            </button>
          </div>
        </header>

        {pendingTask && pendingTaskMission && (
          <section className={`admin-g2 border p-4 shadow-sm shadow-slate-950/10 ${getMissionToneClasses(pendingTaskMission.tone)}`}>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="text-xs font-black uppercase tracking-[0.22em] opacity-75">Admin Task Waiting</div>
                <h2 className="mt-1 text-2xl font-black text-white">
                  {pendingTaskMission.title} Team {pendingTask.teamNumber}
                </h2>
                <p className="mt-2 max-w-4xl text-sm font-semibold leading-relaxed opacity-85">
                  {pendingTask.reason || pendingTask.context || pendingTaskMission.question}
                  {pendingTask.detail ? `: ${pendingTask.detail}` : ''}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {pendingTask.eventKey && <TaskChip label={pendingTask.eventKey} />}
                  {pendingTask.matchNumber && <TaskChip label={`${pendingTask.matchType || 'Match'} ${pendingTask.matchNumber}`} />}
                  {pendingTask.alliance && <TaskChip label={pendingTask.alliance} />}
                  {pendingTask.teamName && <TaskChip label={pendingTask.teamName} />}
                </div>
                {pendingTask.ppa && (
                  <details className="admin-g2-sm mt-4 border border-white/10 bg-slate-950/35 p-3">
                    <summary className="cursor-pointer list-none text-xs font-black uppercase tracking-[0.18em] opacity-80">
                      Task context for this assignment
                    </summary>
                  <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(260px,0.42fr)]">
                    <div className="admin-g2-sm border border-white/10 bg-slate-950/35 p-3">
                      <div className="text-[10px] font-black uppercase tracking-[0.18em] opacity-70">Why this team was flagged</div>
                      <div className="mt-3 grid gap-2 sm:grid-cols-4">
                        <TaskMetric label="Floor / Exp / Ceiling" value={`${formatTaskMetric(pendingTask.ppa.floor)} / ${formatTaskMetric(pendingTask.ppa.expected)} / ${formatTaskMetric(pendingTask.ppa.ceiling)}`} />
                        <TaskMetric label="Role" value={pendingTask.ppa.role || 'Needs role evidence'} />
                        <TaskMetric label="Risk" value={`${pendingTask.ppa.uncertainty || 'Needs risk read'} / ${pendingTask.ppa.tailRisk || 'Needs tail read'}`} />
                        <TaskMetric label="Scout Trust" value={formatTaskPercent(pendingTask.ppa.scoutConfidence)} />
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {pendingTask.ppa.coverage && <TaskChip label={pendingTask.ppa.coverage} />}
                        {pendingTask.ppa.model && <TaskChip label={pendingTask.ppa.model} />}
                        {(pendingTask.ppa.warnings || []).slice(0, 2).map(warning => <TaskChip key={warning} label={warning} />)}
                      </div>
                    </div>
                    <div className="admin-g2-sm border border-white/10 bg-slate-950/35 p-3">
                      <div className="text-[10px] font-black uppercase tracking-[0.18em] opacity-70">What To Prove</div>
                      <div className="mt-2 space-y-2">
                        {(pendingTask.ppa.asks || []).slice(0, 3).map(ask => (
                          <div key={ask} className="admin-g2-sm border border-white/10 bg-slate-950/45 px-3 py-2 text-xs font-semibold text-white/90">
                            {ask}
                          </div>
                        ))}
                        {(pendingTask.ppa.asks || []).length === 0 && (
                          <div className="admin-g2-sm border border-white/10 bg-slate-950/45 px-3 py-2 text-xs font-semibold text-white/75">
                            Capture the evidence that explains whether this expected range is trustworthy.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  </details>
                )}
              </div>
              <button
                type="button"
                onClick={() => pendingTaskPath && navigate(pendingTaskPath)}
                disabled={!pendingTaskPath}
                className="admin-g2-sm inline-flex shrink-0 items-center justify-center gap-2 border border-white/15 bg-slate-950/45 px-5 py-3 text-sm font-black text-white transition-colors hover:bg-slate-900 disabled:opacity-50"
              >
                Continue Task
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </section>
        )}

        <section className="grid gap-3 lg:grid-cols-3">
          {lanePrinciples.map(principle => (
            <div key={principle.title} className="admin-g2-sm border border-slate-800 bg-slate-900/55 p-4">
              <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">{principle.title}</div>
              <div className="mt-2 text-lg font-black text-white">{principle.rule}</div>
              <p className="mt-1 text-sm font-semibold leading-relaxed text-slate-400">{principle.detail}</p>
            </div>
          ))}
        </section>

        <main className="grid min-w-0 flex-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="min-w-0">
            <div className="grid gap-4 md:grid-cols-2">
              {missionOrder.map(key => (
                <MissionButton
                  key={key}
                  missionKey={key}
                  stats={archiveSummary.missionStats[key]}
                  isPending={pendingTask?.missionKey === key}
                  onSelect={route => navigate(pendingTask?.missionKey === key && pendingTaskPath ? pendingTaskPath : route)}
                />
              ))}
            </div>

            <details className="admin-g2 mt-5 border border-slate-800 bg-slate-900/55 p-4 shadow-sm shadow-slate-950/10">
              <summary className="cursor-pointer list-none text-sm font-black text-cyan-100">
                Where this evidence goes
              </summary>
              <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">Decision Signals</div>
                  <h2 className="mt-1 text-xl font-black text-white">Each row becomes expected value, floor, ceiling, role, and risk.</h2>
                  <p className="mt-1 text-xs font-semibold leading-relaxed text-slate-400">
                    Capture the evidence that explains whether this expected range is trustworthy. Admin keeps the technical model proof in the data room; scouts only need to record what happened clearly.
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {EXPECTED_RANGE_OUTPUTS.map(item => (
                    <span key={item.label} className="admin-g2-sm border border-cyan-400/20 bg-cyan-500/10 px-3 py-2 text-xs font-black text-cyan-50">
                      {item.label}
                    </span>
                  ))}
                </div>
              </div>
            </details>

            <section className="admin-g2 mt-5 border border-cyan-400/20 bg-cyan-500/5 p-4 shadow-sm shadow-slate-950/10">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">Scouting Day Flow</div>
                  <h2 className="mt-1 text-xl font-black text-white">Collect in the order the model can use.</h2>
                </div>
                <div className="text-sm font-semibold text-slate-400">
                  Do the job in front of you, but know what your row becomes next.
                </div>
              </div>
              <div className="mt-4 grid gap-3 lg:grid-cols-4">
                {SCOUTING_DAY_SEQUENCE.map((item, index) => (
                  <div key={item.step} className="admin-g2-sm border border-slate-800 bg-slate-950/60 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Step {index + 1}</div>
                        <div className="mt-1 text-sm font-black text-white">{item.step}</div>
                      </div>
                      <span className="admin-g2-sm border border-cyan-400/20 bg-cyan-500/10 px-2 py-1 text-[10px] font-black text-cyan-100">
                        Signal
                      </span>
                    </div>
                    <div className="mt-3 text-xs font-semibold leading-relaxed text-slate-300">{item.action}</div>
                    <div className="mt-2 text-xs font-semibold leading-relaxed text-cyan-100/80">{item.result}</div>
                  </div>
                ))}
              </div>
            </section>
          </section>

          <aside className="min-w-0 space-y-5">
            <section className="admin-g2 border border-slate-800 bg-slate-900/65 p-5 shadow-sm shadow-slate-950/10">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">This Device</div>
                  <h2 className="mt-1 text-xl font-black text-white">{archiveSummary.username || 'Scout not named'}</h2>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/history')}
                  className="admin-g2-sm border border-violet-400/30 bg-violet-500/10 p-2 text-violet-100 hover:bg-violet-500/20"
                  aria-label="Open My Evidence"
                >
                  <History className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <DeviceMetric label="Rows" value={archiveSummary.totalRecords} />
                <DeviceMetric label="Unsynced" value={archiveSummary.unsyncedRecords} tone={archiveSummary.unsyncedRecords > 0 ? 'amber' : 'emerald'} />
              </div>
              <div className="admin-g2-sm mt-3 border border-slate-800 bg-slate-950/55 px-3 py-2 text-xs font-semibold text-slate-400">
                {archiveSummary.unsyncedRecords > 0
                  ? 'Open My Evidence before leaving Wi-Fi so these rows can sync or export.'
                  : 'Local archive is clear enough for normal scouting.'}
              </div>
            </section>

            <section className="admin-g2 border border-slate-800 bg-slate-900/65 p-5 shadow-sm shadow-slate-950/10">
              <div className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">Choose By Moment</div>
              <div className="mt-3 space-y-3 text-sm font-semibold leading-relaxed text-slate-300">
                <MomentRule lead="Before enough rows exist" action="open Pre Scout." />
                <MomentRule lead="Robot is in the pit" action="open Pit Scout." />
                <MomentRule lead="Match about to start" action="open Match Scout." />
                <MomentRule lead="Defense mattered" action="open Defense Scout." />
              </div>
            </section>

            {canShowAdminTools && (
              <section className="admin-g2 border border-slate-800 bg-slate-900/65 p-5 shadow-sm shadow-slate-950/10">
                <div className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">Used Later By Admins</div>
                <div className="mt-4 grid gap-2">
                  {Object.values(SCOUTING_USE_MOMENTS).map(moment => (
                    <button
                      key={moment.key}
                      type="button"
                      onClick={() => navigate(getAdminUseMomentRoute(moment.key, location.search))}
                      className="admin-g2-sm border border-slate-800 bg-slate-950/65 px-3 py-3 text-left transition-colors hover:border-cyan-400/40 hover:bg-slate-900"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-cyan-200">{useMomentIcons[moment.key]}</span>
                        <div className="font-black text-white">{moment.title}</div>
                      </div>
                      <div className="mt-1 text-xs font-semibold text-slate-400">{moment.needs.slice(0, 2).join(' / ')}</div>
                    </button>
                  ))}
                </div>
              </section>
            )}
          </aside>
        </main>
      </div>
    </div>
  );
}

function MissionButton({
  missionKey,
  stats,
  isPending,
  onSelect
}: {
  missionKey: ScoutingMissionKey;
  stats: { records: number; unsynced: number; cachedAt?: number | null };
  isPending: boolean;
  onSelect: (route: string) => void;
}) {
  const mission = SCOUTING_MISSIONS[missionKey];
  const usedNext = getMissionUseMoments(missionKey).map(moment => moment.title);
  const isPreScout = missionKey === 'preScout';
  const recordLabel = isPreScout
    ? `${stats.records} public profile${stats.records === 1 ? '' : 's'}`
    : `${stats.records} local row${stats.records === 1 ? '' : 's'}`;
  const syncLabel = isPreScout
    ? stats.records > 0
      ? `cache ${stats.cachedAt ? new Date(stats.cachedAt).toLocaleDateString() : 'ready'}`
      : 'cache needed'
    : stats.unsynced > 0
      ? `${stats.unsynced} unsynced`
      : 'sync clear';
  const syncToneClass = isPreScout
    ? stats.records > 0
      ? 'bg-violet-400/10 text-violet-50'
      : 'bg-amber-400/15 text-amber-50'
    : stats.unsynced > 0
      ? 'bg-amber-400/15 text-amber-50'
      : 'bg-emerald-400/10 text-emerald-50';

  return (
    <button
      type="button"
      onClick={() => mission.route && onSelect(mission.route)}
      className={`admin-g2 group flex min-h-[230px] min-w-0 flex-col justify-between overflow-hidden border p-5 text-left shadow-sm shadow-slate-950/10 transition-all hover:-translate-y-0.5 active:scale-[0.99] ${getMissionToneClasses(mission.tone)} ${isPending ? 'ring-2 ring-white/30' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] opacity-75">
            {missionIcons[missionKey]}
            <span>{mission.shortTitle}</span>
          </div>
          <div className="mt-3 text-2xl font-black text-white">{mission.title}</div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          {isPending && (
            <span className="admin-g2-sm border border-white/15 bg-white/10 px-2 py-1 text-[10px] font-black uppercase text-white">
              Pending
            </span>
          )}
          <span className="admin-g2-sm border border-white/10 bg-slate-950/45 p-2 text-white transition-transform group-hover:translate-x-0.5">
            <ArrowRight className="h-4 w-4" />
          </span>
        </div>
      </div>

      <p className="mt-4 break-words text-sm font-semibold leading-relaxed opacity-85">{mission.question}</p>

      <div className="mt-4 flex flex-wrap gap-2">
        <span className="admin-g2-sm border border-white/10 bg-slate-950/45 px-2.5 py-1.5 text-[11px] font-black text-white/90">
          {recordLabel}
        </span>
        <span className={`admin-g2-sm border border-white/10 px-2.5 py-1.5 text-[11px] font-black ${syncToneClass}`}>
          {syncLabel}
        </span>
        {mission.processedSignals.slice(0, 2).map(signal => (
          <span key={signal} className="admin-g2-sm border border-white/10 bg-slate-950/40 px-2.5 py-1.5 text-[11px] font-black text-white/90">
            {signal}
          </span>
        ))}
        <span className="admin-g2-sm border border-white/10 bg-slate-950/25 px-2.5 py-1.5 text-[11px] font-semibold opacity-75">
          Used in {usedNext.slice(0, 2).join(' + ')}
        </span>
      </div>
    </button>
  );
}

function TaskChip({ label }: { label: string }) {
  return (
    <span className="admin-g2-sm border border-white/10 bg-slate-950/40 px-2.5 py-1.5 text-[11px] font-black text-white/90">
      {label}
    </span>
  );
}

function TaskMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="admin-g2-sm border border-white/10 bg-slate-950/45 px-3 py-2">
      <div className="text-[10px] font-black uppercase tracking-[0.14em] opacity-65">{label}</div>
      <div className="mt-1 text-sm font-black text-white">{value}</div>
    </div>
  );
}

function DeviceMetric({
  label,
  value,
  tone = 'slate'
}: {
  label: string;
  value: number;
  tone?: 'slate' | 'amber' | 'emerald';
}) {
  const toneClass =
    tone === 'amber'
      ? 'border-amber-400/25 bg-amber-500/10 text-amber-100'
      : tone === 'emerald'
        ? 'border-emerald-400/25 bg-emerald-500/10 text-emerald-100'
        : 'border-slate-800 bg-slate-950/55 text-slate-200';
  return (
    <div className={`admin-g2-sm border px-3 py-2 ${toneClass}`}>
      <div className="text-[10px] font-black uppercase tracking-[0.18em] opacity-70">{label}</div>
      <div className="mt-1 text-xl font-black">{value}</div>
    </div>
  );
}

function MomentRule({ lead, action }: { lead: string; action: string }) {
  return (
    <div className="admin-g2-sm border border-slate-800 bg-slate-950/55 px-3 py-2">
      <span className="font-black text-white">{lead}: </span>
      <span>{action}</span>
    </div>
  );
}
