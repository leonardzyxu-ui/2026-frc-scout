import React, { useEffect, useMemo, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertTriangle, Download, QrCode, RefreshCw, Save, Shield, Target, Trophy } from 'lucide-react';
import { MatchScoutingV4, MatchScoutingV4Role, initialMatchScoutingV4 } from '../types';
import ScoutUsernameGate from '../components/ScoutUsernameGate';
import { SCOUT_ASSIGNMENTS, getScoutAssignmentByName } from '../utils/scoutAssignments';
import { DEFAULT_EVENT_KEY, getPersistentDeviceId } from '../utils/sharedEventState';
import { buildMatchKeyV4, normalizeMatchScoutingV4 } from '../utils/matchScoutingV4';
import {
  getScoutArchiveUsername,
  renameScoutArchiveUsername,
  setScoutArchiveUsername,
  updateScoutArchiveRecordSyncState,
  upsertMatchArchiveRecordV4
} from '../utils/scoutArchive';
import { writeMatchScoutingV4Record } from '../utils/scoutingWrites';
import { compressMatchDataV4 } from '../utils/qrCompression';
import { loadTbaApiKey } from '../utils/adminV4LocalStore';
import { MathEngine, TBAMatch } from '../utils/mathEngine';
import { TBA_API_KEY } from '../config';
import ScoutWorkflowHeader, { ScoutSignalHandoff } from '../components/scouting/ScoutWorkflowHeader';
import ScoutingMissionPanel from '../components/scouting/ScoutingMissionPanel';
import { buildScoutEvidenceAdminTask, clearScoutTaskHandoff, getScoutTaskHandoff, getScoutTaskReturnPath } from '../utils/scoutTaskHandoff';
import { verifyScoutIdentityUnlockPassphrase } from '../utils/scoutIdentityLock';

const DRAFT_KEY = 'match_scout_v4_draft';
const EDIT_MODE_KEY = 'match_scout_v4_edit_mode';
const SUBSTITUTES = ['Charlotte', 'Scarlett'] as const;
const ROLE_OPTIONS: MatchScoutingV4Role[] = ['Offense', 'Defense', 'Mixed', 'Support', 'Disabled'];
type MatchScoutStepKey = 'setup' | 'score' | 'role' | 'risk' | 'handoff';
const MATCH_SCOUT_STEPS: Array<{
  key: MatchScoutStepKey;
  label: string;
  question: string;
  output: string;
}> = [
  {
    key: 'setup',
    label: 'Setup',
    question: 'Which robot am I responsible for?',
    output: 'match, scout slot, alliance, team'
  },
  {
    key: 'score',
    label: 'Score Signal',
    question: 'What points and cycles did this robot create?',
    output: 'expected value and repeatability'
  },
  {
    key: 'role',
    label: 'Role Context',
    question: 'Why did that number happen?',
    output: 'scorer, defender, support, or disabled context'
  },
  {
    key: 'risk',
    label: 'Floor Risk',
    question: 'Can strategy trust the ceiling?',
    output: 'reliability, failures, and tail risk'
  },
  {
    key: 'handoff',
    label: 'Handoff',
    question: 'What should the head scout do with this?',
    output: 'notes, QR backup, local-first submit'
  }
];
const FAILURE_TOGGLES: Array<{ key: 'robotDied' | 'commsLost' | 'mechanismBroke' | 'tippedOver'; label: string }> = [
  { key: 'robotDied', label: 'Robot Died' },
  { key: 'commsLost', label: 'Comms Lost' },
  { key: 'mechanismBroke', label: 'Mechanism Broke' },
  { key: 'tippedOver', label: 'Tipped Over' }
];
const EXPECTED_RANGE_SIGNAL_STEPS = [
  { key: 'expected', label: 'Expected Value', detail: 'Auto, teleop, and endgame points set the central expected range.' },
  { key: 'repeatability', label: 'Repeatability', detail: 'Cycles explain whether the score was stable or a one-off spike.' },
  { key: 'role', label: 'Role Context', detail: 'Role and defense fields prevent the model from confusing strategy with weakness.' },
  { key: 'floor', label: 'Floor Risk', detail: 'Reliability and failures define how low the team can realistically fall.' }
];
const inputClass = 'admin-g2-sm w-full border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-400';
const fieldLabelClass = 'text-xs font-black uppercase tracking-widest text-slate-500';
const sanitizeScheduleEventKey = (value: string) => value.toUpperCase().replace(/\s+/g, '');
const getShortMatchKey = (match: TBAMatch) => match.key.split('_')[1]?.toLowerCase() || '';
const normalizeTeamKey = (teamKey: string) => teamKey.replace(/^frc/i, '');

const getDefaultData = (deviceId: string, scoutName = '') =>
  normalizeMatchScoutingV4({
    ...initialMatchScoutingV4,
    eventKey: DEFAULT_EVENT_KEY,
    scoutName,
    deviceId
  });

const NumberCounter = ({
  label,
  description,
  value,
  onChange,
  steps = [1, 3, 5, 10]
}: {
  label: string;
  description: string;
  value: number;
  onChange: (value: number) => void;
  steps?: number[];
}) => {
  const [lastValue, setLastValue] = useState<number | null>(null);
  const [resetArmed, setResetArmed] = useState(false);
  const resetArmTimeoutRef = useRef<number | null>(null);
  const cancelResetArm = () => {
    if (resetArmTimeoutRef.current != null) {
      window.clearTimeout(resetArmTimeoutRef.current);
      resetArmTimeoutRef.current = null;
    }
    setResetArmed(false);
  };
  const armReset = () => {
    setResetArmed(true);
    if (resetArmTimeoutRef.current != null) {
      window.clearTimeout(resetArmTimeoutRef.current);
    }
    resetArmTimeoutRef.current = window.setTimeout(() => {
      resetArmTimeoutRef.current = null;
      setResetArmed(false);
    }, 3000);
  };
  const commitChange = (nextValue: number) => {
    cancelResetArm();
    setLastValue(value);
    onChange(nextValue);
  };
  useEffect(() => () => {
    if (resetArmTimeoutRef.current != null) {
      window.clearTimeout(resetArmTimeoutRef.current);
    }
  }, []);

  return (
    <div className="admin-g2 border border-slate-800 bg-slate-900/80 p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-black text-white">{label}</h3>
          <p className="mt-1 text-xs font-bold uppercase tracking-widest text-slate-500">{description}</p>
        </div>
        <div className="admin-g2-sm border border-cyan-400/20 bg-slate-950 px-5 py-3 text-3xl font-black text-cyan-200">{value}</div>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {steps.map(step => (
          <button
            key={step}
            type="button"
            onClick={() => commitChange(value + step)}
            className="admin-g2-sm border border-cyan-400/40 bg-cyan-500/15 px-3 py-3 text-lg font-black text-cyan-50 transition-colors hover:bg-cyan-500/25 active:scale-95"
          >
            +{step}
          </button>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => commitChange(Math.max(0, value - 1))}
          className="admin-g2-sm bg-slate-800 px-3 py-2 text-sm font-bold text-slate-200 hover:bg-slate-700"
        >
          -1
        </button>
        <button
          type="button"
          onClick={() => {
            if (value === 0) return;
            if (!resetArmed) {
              armReset();
              return;
            }
            commitChange(0);
          }}
          disabled={value === 0}
          aria-label={resetArmed ? `Confirm reset ${label} to zero` : `Arm reset ${label}`}
          className={`admin-g2-sm px-3 py-2 text-sm font-bold disabled:cursor-not-allowed disabled:bg-slate-900 disabled:text-slate-600 ${
            resetArmed ? 'bg-rose-500 text-white hover:bg-rose-400' : 'bg-rose-950 text-rose-200 hover:bg-rose-900'
          }`}
        >
          {resetArmed ? 'Confirm Reset' : 'Reset...'}
        </button>
        <button
          type="button"
          onClick={() => {
            if (lastValue == null) return;
            onChange(lastValue);
            setLastValue(null);
          }}
          disabled={lastValue == null}
          className="admin-g2-sm bg-amber-500/10 px-3 py-2 text-sm font-bold text-amber-200 hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:bg-slate-900 disabled:text-slate-600"
        >
          Revert Last
        </button>
      </div>
      {resetArmed && (
        <div className="mt-2 text-xs font-bold text-rose-200">
          Tap Confirm Reset within 3 seconds to zero {label}. Revert Last can restore it.
        </div>
      )}
    </div>
  );
};

function StepFrame({
  step,
  children
}: {
  step: MatchScoutStepKey;
  children: React.ReactNode;
}) {
  const currentStep = MATCH_SCOUT_STEPS.find(item => item.key === step) || MATCH_SCOUT_STEPS[0]!;
  return (
    <section className="admin-g2 border border-slate-800 bg-slate-900/70 p-4 sm:p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">{currentStep.label}</div>
          <h2 className="mt-1 text-xl font-black text-white sm:text-2xl">{currentStep.question}</h2>
        </div>
        <div className="admin-g2-sm hidden border border-cyan-400/25 bg-cyan-500/10 px-4 py-3 text-sm font-bold text-cyan-50 sm:block">
          Creates: {currentStep.output}
        </div>
      </div>
      {children}
    </section>
  );
}

function PpaSignalStrip({ data }: { data: MatchScoutingV4 }) {
  const totalCycles = data.autoCycles + data.teleopCycles;
  const activeFailures = FAILURE_TOGGLES.filter(({ key }) => data[key]).length;
  const failurePenalty = activeFailures * 8 + data.fouls * 1.5 + data.techFouls * 4;
  const reliabilityFloor = Math.max(0, data.totalMatchPoints * data.reliabilityScore - failurePenalty);
  const cycleBonus = Math.min(18, totalCycles * 1.25);
  const roleBonus =
    data.rolePlayed === 'Defense'
      ? data.defenseIntensity * 10 + Math.min(8, data.defenseDurationSeconds / 15)
      : data.rolePlayed === 'Mixed'
        ? data.defenseIntensity * 5 + Math.min(6, data.defenseDurationSeconds / 25)
        : data.rolePlayed === 'Support'
          ? 3
          : 0;
  const ceilingSignal = Math.max(data.totalMatchPoints, data.totalMatchPoints + cycleBonus + roleBonus);
  const floorLabel = `${Math.round(reliabilityFloor)} pts`;
  const ceilingLabel = `${Math.round(ceilingSignal)} pts`;
  const roleLabel = data.rolePlayed || 'Choose role';
  const headScoutRead = (() => {
    if (data.rolePlayed === 'Disabled' || activeFailures > 1 || data.reliabilityScore < 0.55) {
      return 'Treat this as floor-risk evidence until another clean row confirms recovery.';
    }
    if (data.rolePlayed === 'Defense' || data.defenseIntensity >= 0.5 || data.defenseDurationSeconds >= 45) {
      return 'Tell strategy whether the defense was worth the scoring tradeoff.';
    }
    if (data.totalMatchPoints > 0 && totalCycles === 0) {
      return 'Add cycles or notes so Admin can tell spike scoring from repeatable scoring.';
    }
    if (!data.rolePlayed) {
      return 'Pick the role before submit; the model needs to know why the points happened.';
    }
    return 'Good row shape: expected value, repeatability, role, and floor risk are all represented.';
  })();
  const signalValues: Record<string, string> = {
    expected: `${data.totalMatchPoints} pts`,
    repeatability: `${totalCycles} cycles`,
    role: roleLabel,
    floor: `${(data.reliabilityScore * 100).toFixed(0)}% / ${activeFailures} flags`
  };

  return (
    <section className="admin-g2 border border-cyan-400/25 bg-cyan-500/10 p-5">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.22em] text-cyan-200">Evidence Capture Path</div>
          <h2 className="mt-1 text-xl font-black text-white">Collect the shape, not just the score</h2>
        </div>
        <div className="text-sm font-semibold text-cyan-50/75">
          {data.totalMatchPoints} pts · {totalCycles} cycles · {data.rolePlayed || 'role pending'} · {(data.reliabilityScore * 100).toFixed(0)}% reliability
        </div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-4">
        {EXPECTED_RANGE_SIGNAL_STEPS.map(item => (
          <div key={item.label} className="admin-g2-sm border border-cyan-200/10 bg-slate-950/55 px-3 py-3">
            <div className="text-xs font-black uppercase tracking-wider text-cyan-100">{item.label}</div>
            <div className="mt-2 text-2xl font-black text-white">{signalValues[item.key]}</div>
            <div className="mt-2 text-xs font-semibold text-slate-300">{item.detail}</div>
          </div>
        ))}
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr_1fr_1.4fr]">
        <div className="admin-g2-sm border border-cyan-200/10 bg-slate-950/55 px-3 py-3">
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Row Expected</div>
          <div className="mt-1 text-xl font-black text-cyan-100">{data.totalMatchPoints} pts</div>
          <div className="mt-1 text-xs font-semibold text-slate-400">Direct contribution recorded here.</div>
        </div>
        <div className="admin-g2-sm border border-amber-200/10 bg-slate-950/55 px-3 py-3">
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Floor Guard</div>
          <div className="mt-1 text-xl font-black text-amber-100">{floorLabel}</div>
          <div className="mt-1 text-xs font-semibold text-slate-400">Reliability minus fouls and failure flags.</div>
        </div>
        <div className="admin-g2-sm border border-violet-200/10 bg-slate-950/55 px-3 py-3">
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Ceiling Clue</div>
          <div className="mt-1 text-xl font-black text-violet-100">{ceilingLabel}</div>
          <div className="mt-1 text-xs font-semibold text-slate-400">Points plus repeatability and role context.</div>
        </div>
        <div className="admin-g2-sm border border-emerald-200/10 bg-slate-950/55 px-3 py-3">
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Head Scout Read</div>
          <div className="mt-1 text-sm font-black text-emerald-100">{roleLabel}</div>
          <div className="mt-1 text-xs font-semibold leading-relaxed text-slate-300">{headScoutRead}</div>
        </div>
      </div>
      <div className="mt-3 text-xs font-semibold leading-relaxed text-cyan-50/70">
        This is a live evidence preview for this row only. Admin V4 combines it with prior rows, defense scouting, public context, and the promoted model before producing the final expected-range read.
      </div>
    </section>
  );
}

export default function MatchScoutV4View() {
  const navigate = useNavigate();
  const location = useLocation();
  const taskHandoff = useMemo(() => getScoutTaskHandoff('matchScout', location.search), [location.search]);
  const taskHandoffKey = taskHandoff
    ? [
        taskHandoff.teamNumber,
        taskHandoff.eventKey,
        taskHandoff.matchType,
        taskHandoff.matchNumber,
        taskHandoff.alliance,
        taskHandoff.reason
      ].join(':')
    : '';
  const [completedAdminTaskKey, setCompletedAdminTaskKey] = useState('');
  const activeTaskHandoff = taskHandoffKey && taskHandoffKey === completedAdminTaskKey ? null : taskHandoff;
  const deviceId = useMemo(() => getPersistentDeviceId(), []);
  const [archiveUsername, setArchiveUsername] = useState('');
  const [pendingUsername, setPendingUsername] = useState('');
  const [renameGateOpen, setRenameGateOpen] = useState(false);
  const [identityUnlockPassphrase, setIdentityUnlockPassphrase] = useState('');
  const [identityUnlockError, setIdentityUnlockError] = useState('');
  const [isUsernameResolved, setIsUsernameResolved] = useState(false);
  const [data, setData] = useState<MatchScoutingV4>(() => getDefaultData(deviceId));
  const [statusMessage, setStatusMessage] = useState('');
  const [showQr, setShowQr] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [eventMatches, setEventMatches] = useState<TBAMatch[]>([]);
  const [scheduledTeams, setScheduledTeams] = useState<string[]>([]);
  const [isLoadingSchedule, setIsLoadingSchedule] = useState(false);
  const [assignmentWarning, setAssignmentWarning] = useState('');
  const [teamWarning, setTeamWarning] = useState('');
  const [isEditingExistingRecord, setIsEditingExistingRecord] = useState(false);
  const [teamManuallyEdited, setTeamManuallyEdited] = useState(false);

  const normalizedData = useMemo(() => normalizeMatchScoutingV4(data), [data]);
  const totalPoints = normalizedData.totalMatchPoints;
  const currentMatchKey = useMemo(
    () => buildMatchKeyV4(normalizedData.matchType, normalizedData.matchNumber),
    [normalizedData.matchNumber, normalizedData.matchType]
  );
  const selectedAssignment = useMemo(
    () => getScoutAssignmentByName(normalizedData.assignedScoutName),
    [normalizedData.assignedScoutName]
  );
  const canOpenForm = Boolean(normalizedData.teamNumber && normalizedData.assignedScoutName && normalizedData.alliance);
  useEffect(() => {
    let cancelled = false;
    const hydrate = async () => {
      try {
        const username = await getScoutArchiveUsername();
        const draftText = localStorage.getItem(DRAFT_KEY);
        const editMode = !!draftText && localStorage.getItem(EDIT_MODE_KEY) === 'true';
        if (!draftText) {
          localStorage.removeItem(EDIT_MODE_KEY);
        }
        const draft = draftText ? JSON.parse(draftText) as Partial<MatchScoutingV4> : null;
        if (cancelled) return;
        setArchiveUsername(username || '');
        setPendingUsername(username || '');
        setIsEditingExistingRecord(editMode);
        setTeamManuallyEdited(Boolean(draft?.teamNumber));
        setData(normalizeMatchScoutingV4({
          ...getDefaultData(deviceId, username || ''),
          ...(draft || {}),
          scoutName: draft?.scoutName || username || '',
          deviceId
        }));
      } catch (error) {
        console.error('Failed to hydrate V4 scout form', error);
      } finally {
        if (!cancelled) setIsUsernameResolved(true);
      }
    };

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [deviceId]);

  useEffect(() => {
    if (!isUsernameResolved) return;
    localStorage.setItem(DRAFT_KEY, JSON.stringify(normalizedData));
  }, [isUsernameResolved, normalizedData]);

  useEffect(() => {
    if (!isUsernameResolved || !activeTaskHandoff || isEditingExistingRecord) return;
    setTeamManuallyEdited(Boolean(activeTaskHandoff.teamNumber));
    setData(previous => normalizeMatchScoutingV4({
      ...previous,
      eventKey: activeTaskHandoff.eventKey || previous.eventKey,
      matchType: activeTaskHandoff.matchType || previous.matchType,
      matchNumber: activeTaskHandoff.matchNumber || previous.matchNumber,
      matchKey: activeTaskHandoff.matchKey || buildMatchKeyV4(activeTaskHandoff.matchType || previous.matchType, activeTaskHandoff.matchNumber || previous.matchNumber),
      teamNumber: activeTaskHandoff.teamNumber || previous.teamNumber,
      alliance: activeTaskHandoff.alliance || previous.alliance
    }));
    setStatusMessage(`Admin task loaded: ${activeTaskHandoff.reason || 'collect evidence'} for Team ${activeTaskHandoff.teamNumber}.`);
  }, [activeTaskHandoff, isEditingExistingRecord, isUsernameResolved, taskHandoffKey]);

  useEffect(() => {
    let cancelled = false;
    const fetchMatches = async () => {
      if (normalizedData.eventKey === 'TEST') {
        setEventMatches([]);
        setScheduledTeams([]);
        setAssignmentWarning('');
        setTeamWarning('');
        return;
      }

      const cacheKey = `match_schedule_${sanitizeScheduleEventKey(normalizedData.eventKey)}`;
      const cachedMatches = localStorage.getItem(cacheKey);
      if (cachedMatches) {
        try {
          const parsed = JSON.parse(cachedMatches) as TBAMatch[];
          if (!cancelled) {
            setEventMatches(parsed);
            const teams = new Set<string>();
            parsed.forEach(match => {
              match.alliances.red.team_keys.forEach(teamKey => teams.add(normalizeTeamKey(teamKey)));
              match.alliances.blue.team_keys.forEach(teamKey => teams.add(normalizeTeamKey(teamKey)));
            });
            setScheduledTeams(Array.from(teams));
          }
        } catch (error) {
          console.error('Failed to parse cached V4 schedule', error);
        }
      }

      const localTbaApiKey = await loadTbaApiKey().catch(() => null);
      const effectiveTbaApiKey = localTbaApiKey || TBA_API_KEY;
      if (!effectiveTbaApiKey) {
        setAssignmentWarning(
          cachedMatches
            ? 'Using cached schedule. Upload a local TBA key in Admin V4 Settings to refresh live auto-fill.'
            : 'Schedule auto-fill needs a TBA key. Upload the local API key JSON in Admin V4 Settings, or enter team/alliance manually.'
        );
        return;
      }

      setIsLoadingSchedule(true);
      try {
        const engine = new MathEngine(effectiveTbaApiKey);
        const matches = await engine.fetchEventMatches(normalizedData.eventKey, { includeUnplayed: true });
        if (cancelled) return;
        setEventMatches(matches);
        localStorage.setItem(cacheKey, JSON.stringify(matches));

        const teams = new Set<string>();
        matches.forEach(match => {
          match.alliances.red.team_keys.forEach(teamKey => teams.add(normalizeTeamKey(teamKey)));
          match.alliances.blue.team_keys.forEach(teamKey => teams.add(normalizeTeamKey(teamKey)));
        });
        setScheduledTeams(Array.from(teams));
      } catch (error) {
        console.error('Failed to fetch V4 scout schedule', error);
        if (!cancelled && !cachedMatches) {
          setAssignmentWarning('Unable to load the live schedule. Team number and alliance can still be entered manually.');
        }
      } finally {
        if (!cancelled) setIsLoadingSchedule(false);
      }
    };

    void fetchMatches();
    return () => {
      cancelled = true;
    };
  }, [normalizedData.eventKey]);

  useEffect(() => {
    const generatedMatchKey = buildMatchKeyV4(normalizedData.matchType, normalizedData.matchNumber);
    const assignment = selectedAssignment;

    if (!assignment) {
      updateData({ matchKey: generatedMatchKey });
      setAssignmentWarning('');
      return;
    }

    const scheduledMatch = eventMatches.find(match => getShortMatchKey(match) === generatedMatchKey.toLowerCase());
    const allianceTeamKeys =
      assignment.alliance === 'Red'
        ? scheduledMatch?.alliances.red.team_keys || []
        : scheduledMatch?.alliances.blue.team_keys || [];
    const assignedTeamNumber = normalizeTeamKey(allianceTeamKeys[assignment.positionIndex] || '');

    updateData({
      matchKey: generatedMatchKey,
      assignedSlot: assignment.slotLabel,
      alliance: assignment.alliance,
      teamNumber: !teamManuallyEdited && assignedTeamNumber ? assignedTeamNumber : normalizedData.teamNumber
    });

    if (normalizedData.eventKey === 'TEST') {
      setAssignmentWarning('');
      return;
    }

    if (!scheduledMatch) {
      if (!isLoadingSchedule) {
        setAssignmentWarning(`No scheduled ${generatedMatchKey.toUpperCase()} was found for ${normalizedData.eventKey}. Team number remains editable.`);
      }
      return;
    }

    if (!assignedTeamNumber) {
      setAssignmentWarning(`No team is published yet for ${assignment.slotLabel} in ${generatedMatchKey.toUpperCase()}. Team number remains editable.`);
      return;
    }

    setAssignmentWarning('');
  }, [
    eventMatches,
    isLoadingSchedule,
    normalizedData.eventKey,
    normalizedData.matchNumber,
    normalizedData.matchType,
    normalizedData.teamNumber,
    selectedAssignment,
    teamManuallyEdited
  ]);

  useEffect(() => {
    if (normalizedData.eventKey === 'TEST' || scheduledTeams.length === 0 || !normalizedData.teamNumber) {
      setTeamWarning('');
      return;
    }

    if (!scheduledTeams.includes(normalizedData.teamNumber)) {
      setTeamWarning(`Warning: Team ${normalizedData.teamNumber} is not currently listed in the ${normalizedData.eventKey} schedule.`);
      return;
    }

    setTeamWarning('');
  }, [normalizedData.eventKey, normalizedData.teamNumber, scheduledTeams]);

  const updateData = (patch: Partial<MatchScoutingV4>) => {
    setData(previous => normalizeMatchScoutingV4({ ...previous, ...patch }));
  };

  const handleUsernameSave = async () => {
    const normalized = pendingUsername.trim();
    if (!normalized) {
      setStatusMessage('Scout username is required on this device.');
      return;
    }

    await setScoutArchiveUsername(normalized);
    setArchiveUsername(normalized);
    updateData({ scoutName: normalized });
    setStatusMessage('');
  };

  const handleIdentityRename = async () => {
    const normalized = pendingUsername.trim();
    if (!normalized) {
      setIdentityUnlockError('New scout username is required.');
      return;
    }

    if (normalized === archiveUsername.trim()) {
      setRenameGateOpen(false);
      setIdentityUnlockError('');
      setIdentityUnlockPassphrase('');
      return;
    }

    const unlocked = await verifyScoutIdentityUnlockPassphrase(identityUnlockPassphrase);
    if (!unlocked) {
      setIdentityUnlockError('Admin unlock passphrase is incorrect.');
      return;
    }

    await renameScoutArchiveUsername(normalized, 'unlock_passphrase');
    setArchiveUsername(normalized);
    setPendingUsername(normalized);
    updateData({ scoutName: normalized });
    setRenameGateOpen(false);
    setIdentityUnlockError('');
    setIdentityUnlockPassphrase('');
    setStatusMessage('Scout identity renamed on this device.');
  };

  const handleScoutSelection = (name: string) => {
    const assignment = getScoutAssignmentByName(name);
    if (!assignment) return;
    updateData({
      assignedScoutName: assignment.name,
      assignedSlot: assignment.slotLabel,
      alliance: assignment.alliance,
      substituteScoutName: ''
    });
    setTeamManuallyEdited(false);
  };

  const validate = () => {
    if (!archiveUsername.trim()) return 'Scout username is required.';
    if (!normalizedData.teamNumber.trim()) return 'Team number is required.';
    if (!normalizedData.assignedScoutName.trim()) return 'Select the fixed scout assignment.';
    if (!normalizedData.alliance) return 'Alliance is required.';
    return '';
  };

  const buildCurrentPayload = (scoutNameOverride = archiveUsername) =>
    normalizeMatchScoutingV4({
      ...normalizedData,
      scoutName: scoutNameOverride.trim(),
      matchKey: currentMatchKey,
      timestamp: Date.now(),
      deviceId,
      adminTask: buildScoutEvidenceAdminTask(activeTaskHandoff)
    });

  const resetFormAfterLocalSave = (scoutName = archiveUsername) => {
    localStorage.removeItem(DRAFT_KEY);
    localStorage.removeItem(EDIT_MODE_KEY);
    setIsEditingExistingRecord(false);
    setData(getDefaultData(deviceId, scoutName));
    setTeamManuallyEdited(false);
  };

  const handleSubmit = async () => {
    const validationError = validate();
    if (validationError) {
      setStatusMessage(validationError);
      return;
    }

    setIsSubmitting(true);
    setStatusMessage('Saving locally first...');

    const scoutName = archiveUsername.trim();

    try {
      await setScoutArchiveUsername(scoutName);
      setArchiveUsername(scoutName);
      setPendingUsername(scoutName);

      const payload = buildCurrentPayload(scoutName);
      const archiveRecord = await upsertMatchArchiveRecordV4(payload, scoutName, 'local_submit', {
        syncStatus: 'pending_sync',
        syncMode: isEditingExistingRecord ? 'replace' : 'strict',
        lastFirebaseAttemptAt: Date.now(),
        lastFirebaseError: ''
      });
      if (activeTaskHandoff) {
        setCompletedAdminTaskKey(taskHandoffKey);
        clearScoutTaskHandoff('matchScout');
      }

      try {
        const writeResult = await writeMatchScoutingV4Record(payload, { mode: isEditingExistingRecord ? 'replace' : 'strict' });
        if (writeResult.outcome === 'conflict') {
          await updateScoutArchiveRecordSyncState(archiveRecord.recordId, {
            syncStatus: 'unsynced',
            lastFirebaseAttemptAt: Date.now(),
            lastFirebaseError: writeResult.message
          });
          resetFormAfterLocalSave(scoutName);
          setStatusMessage(`Saved locally. Firebase conflict blocked: ${writeResult.message}`);
          return;
        }

        await updateScoutArchiveRecordSyncState(archiveRecord.recordId, {
          syncStatus: 'synced',
          lastFirebaseAttemptAt: Date.now(),
          lastFirebaseError: ''
        });
        resetFormAfterLocalSave(scoutName);
        setStatusMessage(`Saved locally and synced to Firebase. ${writeResult.message}`);
      } catch (firebaseError) {
        await updateScoutArchiveRecordSyncState(archiveRecord.recordId, {
          syncStatus: 'unsynced',
          lastFirebaseAttemptAt: Date.now(),
          lastFirebaseError: firebaseError instanceof Error ? firebaseError.message : 'Firebase sync failed.'
        });
        resetFormAfterLocalSave(scoutName);
        setStatusMessage('Saved locally in My History. Firebase failed, so this record is marked unsynced and remains exportable.');
      }
    } catch (localError) {
      console.error('Failed to save V4 record locally', localError);
      setStatusMessage('Local IndexedDB save failed. Submission stopped to prevent data loss.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const showUsernameGate = isUsernameResolved && (!archiveUsername || renameGateOpen);

  return (
    <div className="h-full overflow-y-auto bg-slate-950 px-4 py-6 text-white md:px-8">
      {showUsernameGate && (
        <ScoutUsernameGate
          currentUsername={archiveUsername}
          errorMessage={identityUnlockError}
          isUnlockMode={Boolean(archiveUsername && renameGateOpen)}
          onCancel={() => {
            setRenameGateOpen(false);
            setPendingUsername(archiveUsername);
            setIdentityUnlockError('');
            setIdentityUnlockPassphrase('');
          }}
          pendingUsername={pendingUsername}
          setPendingUsername={setPendingUsername}
          unlockPassphrase={identityUnlockPassphrase}
          setUnlockPassphrase={setIdentityUnlockPassphrase}
          onSave={() => void (archiveUsername && renameGateOpen ? handleIdentityRename() : handleUsernameSave())}
        />
      )}

      <div
        aria-hidden={showUsernameGate}
        className={`mx-auto max-w-6xl space-y-6 pb-24 ${showUsernameGate ? 'pointer-events-none select-none blur-sm' : ''}`}
      >
        <ScoutWorkflowHeader
          missionKey="matchScout"
          title="Match Scout"
          subtitle="Capture what the robot actually contributed, plus the role and reliability context the model needs."
          handoff={activeTaskHandoff}
          onBack={() => navigate(getScoutTaskReturnPath(activeTaskHandoff ?? taskHandoff))}
          status={isEditingExistingRecord && (
            <div className="admin-g2-sm inline-flex border border-amber-400/40 bg-amber-400/10 px-3 py-1 text-xs font-black uppercase tracking-wider text-amber-100">
              Editing existing V4 dataset
            </div>
          )}
          metric={(
            <div className="admin-g2-sm border border-cyan-400/30 bg-cyan-400/10 px-3 py-2 text-right sm:px-5 sm:py-4">
              <div className="text-xs font-black uppercase tracking-widest text-cyan-200">Total Points</div>
              <div className="text-3xl font-black text-cyan-100 sm:text-5xl">{totalPoints}</div>
            </div>
          )}
        />

        <ScoutingMissionPanel missionKey="matchScout" compact />

        {statusMessage && (
          <div className="admin-g2-sm border border-amber-400/30 bg-amber-500/10 p-4 text-sm font-bold text-amber-100">
            {statusMessage}
          </div>
        )}

        {canOpenForm && <PpaSignalStrip data={normalizedData} />}

        <div className="scroll-mt-4">
          <StepFrame step="setup">
            <div className="grid gap-4 md:grid-cols-3">
              <label className="space-y-2">
                <span className={fieldLabelClass}>Event</span>
                <input
                  value={normalizedData.eventKey}
                  readOnly
                  className="admin-g2-sm w-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 font-mono font-bold text-cyan-50 outline-none"
                />
                <span className="block text-[11px] font-semibold text-slate-500">
                  Scout event is locked locally; Admin V4 settings do not change scout submissions.
                </span>
              </label>
              <div className="space-y-2">
                <div className={fieldLabelClass}>Match Type</div>
                <div className="grid grid-cols-2 gap-2">
                  {(['Practice', 'Qualification'] as const).map(matchType => (
                    <button
                      key={matchType}
                      type="button"
                      onClick={() => {
                        setTeamManuallyEdited(false);
                        updateData({ matchType, matchKey: buildMatchKeyV4(matchType, normalizedData.matchNumber) });
                      }}
                      className={`admin-g2-sm px-4 py-3 font-black ${normalizedData.matchType === matchType ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                    >
                      {matchType}
                    </button>
                  ))}
                </div>
              </div>
              <label className="space-y-2">
                <span className={fieldLabelClass}>Match Number</span>
                <input
                  type="number"
                  min={1}
                  value={normalizedData.matchNumber}
                  onChange={event => {
                    setTeamManuallyEdited(false);
                    updateData({ matchNumber: Number(event.target.value), matchKey: buildMatchKeyV4(normalizedData.matchType, Number(event.target.value)) });
                  }}
                  className={`${inputClass} font-mono font-bold`}
                />
              </label>
              <label className="space-y-2">
                <span className={fieldLabelClass}>Scout Username</span>
                <input
                  value={archiveUsername}
                  readOnly
                  className={`${inputClass} border-slate-800 font-bold opacity-80`}
                />
                <button
                  type="button"
                  onClick={() => {
                    setPendingUsername(archiveUsername);
                    setRenameGateOpen(true);
                  }}
                  className="admin-g2-sm mt-2 w-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-2 text-sm font-black text-cyan-100 hover:bg-cyan-500/20"
                >
                  Change With Admin Passphrase
                </button>
              </label>
              <label className="space-y-2">
                <span className={fieldLabelClass}>Team Number</span>
                <input
                  value={normalizedData.teamNumber}
                  onChange={event => {
                    setTeamManuallyEdited(true);
                    updateData({ teamNumber: event.target.value.replace(/[^\d]/g, '') });
                  }}
                  className={`${inputClass} font-mono text-xl font-black`}
                />
              </label>
              <div className="space-y-2">
                <div className={fieldLabelClass}>Alliance</div>
                <div className="grid grid-cols-2 gap-2">
                  {(['Red', 'Blue'] as const).map(alliance => (
                    <button
                      key={alliance}
                      type="button"
                      onClick={() => updateData({ alliance })}
                      className={`admin-g2-sm px-4 py-3 font-black ${normalizedData.alliance === alliance ? (alliance === 'Red' ? 'bg-red-500 text-white' : 'bg-blue-500 text-white') : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                    >
                      {alliance}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="admin-g2-sm mt-5 border border-slate-800 bg-slate-950/45 p-4">
              <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-3">
                  <Target className="h-5 w-5 text-cyan-300" />
                  <div>
                    <h2 className="text-xl font-black text-white">Scout Slot</h2>
                    <p className="text-sm font-semibold text-slate-400">Choose the assigned robot slot so the team can autofill from the match schedule.</p>
                  </div>
                </div>
                {isLoadingSchedule && (
                  <span className="admin-g2-sm inline-flex items-center gap-2 border border-cyan-400/30 bg-cyan-400/10 px-3 py-2 text-xs font-black text-cyan-200">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Loading schedule
                  </span>
                )}
              </div>
              <div className="grid gap-2 md:grid-cols-6">
                {SCOUT_ASSIGNMENTS.map(assignment => (
                  <button
                    key={assignment.name}
                    type="button"
                    onClick={() => handleScoutSelection(assignment.name)}
                    className={`admin-g2-sm px-3 py-4 text-center font-black transition active:scale-95 ${
                      normalizedData.assignedScoutName === assignment.name
                        ? assignment.alliance === 'Red'
                          ? 'bg-red-500 text-white'
                          : 'bg-blue-500 text-white'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <div>{assignment.name}</div>
                    <div className="text-xs opacity-80">{assignment.slotLabel}</div>
                  </button>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className={`mr-2 self-center ${fieldLabelClass}`}>Substitute</span>
                {SUBSTITUTES.map(name => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => updateData({ substituteScoutName: normalizedData.substituteScoutName === name ? '' : name })}
                    className={`admin-g2-sm px-4 py-2 text-sm font-black ${
                      normalizedData.substituteScoutName === name ? 'bg-amber-400 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {name}
                  </button>
                ))}
              </div>
              <div className="admin-g2-sm mt-4 border border-slate-800 bg-slate-950/70 px-4 py-3 text-sm text-slate-300">
                Assigned slot: <span className="font-black text-white">{normalizedData.assignedSlot || 'Select scout'}</span>
                {' • '}
                Actual scout: <span className="font-black text-white">{normalizedData.substituteScoutName || archiveUsername || normalizedData.scoutName || 'Unassigned'}</span>
              </div>
              {(assignmentWarning || teamWarning) && (
                <div className="mt-4 space-y-2">
                  {assignmentWarning && (
                    <div className="admin-g2-sm flex items-start gap-2 border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-200">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      {assignmentWarning}
                    </div>
                  )}
                  {teamWarning && (
                    <div className="admin-g2-sm flex items-start gap-2 border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-200">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      {teamWarning}
                    </div>
                  )}
                </div>
              )}
            </div>

            {canOpenForm && (
              <div className="admin-g2-sm mt-5 border border-emerald-400/25 bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-100">
                Setup is ready. Offense, defense, risk, and notes are all unlocked below.
              </div>
            )}
          </StepFrame>

          {canOpenForm && (
            <section className="mt-6 space-y-5">
              <div className="admin-g2 border border-emerald-400/25 bg-emerald-500/10 p-5">
                <div className="text-xs font-black uppercase tracking-[0.22em] text-emerald-200">Live Match Capture</div>
                <h2 className="mt-1 text-2xl font-black text-white">Score and defense can change at any time.</h2>
                <p className="mt-2 max-w-3xl text-sm font-semibold leading-relaxed text-emerald-50/80">
                  Record the match in the order it actually happens. A robot can score, defend, get defended, recover, and score again without changing pages.
                </p>
              </div>

              <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
                <StepFrame step="score">
                  <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
                    <NumberCounter label="Auto Points" description="Expected-value signal before teleop noise." value={normalizedData.autoPoints} onChange={value => updateData({ autoPoints: value })} />
                    <NumberCounter label="Teleop Points" description="Main scoring contribution." value={normalizedData.teleopPoints} onChange={value => updateData({ teleopPoints: value })} />
                    <NumberCounter label="Endgame Points" description="Late-match contribution." value={normalizedData.endgamePoints} onChange={value => updateData({ endgamePoints: value })} steps={[1, 5, 10, 15]} />
                  </section>

                  <section className="mt-4 grid gap-4 md:grid-cols-2">
                    <NumberCounter label="Auto Cycles" description="Autonomous repeatability." value={normalizedData.autoCycles} onChange={value => updateData({ autoCycles: value })} steps={[1]} />
                    <NumberCounter label="Teleop Cycles" description="Teleop repeatability." value={normalizedData.teleopCycles} onChange={value => updateData({ teleopCycles: value })} steps={[1]} />
                  </section>
                </StepFrame>

                <StepFrame step="role">
                  <section>
                    <div className="mb-4 flex items-start gap-3">
                      <Shield className="h-5 w-5 text-emerald-300" />
                      <div>
                        <h2 className="text-xl font-black text-white">Role + Defense</h2>
                        <p className="text-sm font-semibold text-slate-400">Use Mixed when they scored and defended in the same match.</p>
                      </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
                      <div className="grid gap-2 md:col-span-3 md:grid-cols-5 xl:col-span-1 xl:grid-cols-1 2xl:col-span-3 2xl:grid-cols-5">
                        {ROLE_OPTIONS.map(role => (
                          <button
                            key={role}
                            type="button"
                            onClick={() => updateData({ rolePlayed: role })}
                            className={`admin-g2-sm px-3 py-3 font-black ${normalizedData.rolePlayed === role ? 'bg-emerald-400 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                          >
                            {role}
                          </button>
                        ))}
                      </div>
                      <label className="space-y-2">
                        <span className={fieldLabelClass}>Team they defended</span>
                        <input
                          value={normalizedData.defendedTeamNumber}
                          onChange={event => updateData({ defendedTeamNumber: event.target.value.replace(/[^\d]/g, '') })}
                          className={`${inputClass} font-mono font-bold focus:border-emerald-400`}
                        />
                      </label>
                      <label className="space-y-2">
                        <span className={fieldLabelClass}>Defender faced</span>
                        <input
                          value={normalizedData.defenderFacedTeamNumber}
                          onChange={event => updateData({ defenderFacedTeamNumber: event.target.value.replace(/[^\d]/g, '') })}
                          className={`${inputClass} font-mono font-bold focus:border-emerald-400`}
                        />
                      </label>
                      <label className="space-y-2">
                        <span className={fieldLabelClass}>Defense seconds</span>
                        <input
                          type="number"
                          min={0}
                          value={normalizedData.defenseDurationSeconds}
                          onChange={event => updateData({ defenseDurationSeconds: Number(event.target.value) })}
                          className={`${inputClass} font-mono font-bold focus:border-emerald-400`}
                        />
                      </label>
                      <label className="space-y-2 md:col-span-3 xl:col-span-1 2xl:col-span-3">
                        <span className={fieldLabelClass}>
                          Defense Intensity: {(normalizedData.defenseIntensity * 100).toFixed(0)}%
                        </span>
                        <input
                          type="range"
                          min={0}
                          max={1}
                          step={0.0001}
                          value={normalizedData.defenseIntensity}
                          onChange={event => updateData({ defenseIntensity: Number(event.target.value) })}
                          className="w-full accent-emerald-400"
                        />
                      </label>
                    </div>
                  </section>
                </StepFrame>
              </div>

              <StepFrame step="risk">
                <section>
                  <div className="mb-4 flex items-start gap-3">
                    <Trophy className="h-5 w-5 text-rose-300" />
                    <div>
                      <h2 className="text-xl font-black text-white">Problems During The Match</h2>
                      <p className="text-sm font-semibold text-slate-400">Only touch these if something happened. Otherwise leave them alone.</p>
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-4">
                    <label className="space-y-2">
                      <span className={fieldLabelClass}>Fouls</span>
                      <input type="number" min={0} value={normalizedData.fouls} onChange={event => updateData({ fouls: Number(event.target.value) })} className={`${inputClass} font-mono font-bold focus:border-rose-400`} />
                    </label>
                    <label className="space-y-2">
                      <span className={fieldLabelClass}>Tech Fouls</span>
                      <input type="number" min={0} value={normalizedData.techFouls} onChange={event => updateData({ techFouls: Number(event.target.value) })} className={`${inputClass} font-mono font-bold focus:border-rose-400`} />
                    </label>
                    <label className="space-y-2 md:col-span-2">
                      <span className={fieldLabelClass}>Reliability: {(normalizedData.reliabilityScore * 100).toFixed(0)}%</span>
                      <input type="range" min={0} max={1} step={0.0001} value={normalizedData.reliabilityScore} onChange={event => updateData({ reliabilityScore: Number(event.target.value) })} className="w-full accent-rose-400" />
                    </label>
                  </div>
                  <div className="mt-4 grid gap-2 md:grid-cols-4">
                    {FAILURE_TOGGLES.map(({ key, label }) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => updateData({ [key]: !normalizedData[key] })}
                        className={`admin-g2-sm px-3 py-3 font-black ${normalizedData[key] ? 'bg-rose-500 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <label className="mt-4 block space-y-2">
                    <span className={fieldLabelClass}>Failure Reason</span>
                    <input value={normalizedData.failureReason} onChange={event => updateData({ failureReason: event.target.value })} className={`${inputClass} focus:border-rose-400`} />
                  </label>
                </section>
              </StepFrame>

              <StepFrame step="handoff">
                <ScoutSignalHandoff missionKey="matchScout" />
                <section className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2">
                    <span className={fieldLabelClass}>What changed the number?</span>
                    <textarea
                      value={normalizedData.notes}
                      onChange={event => updateData({ notes: event.target.value })}
                      rows={6}
                      className={`${inputClass} min-h-32`}
                      placeholder="Examples: scored early, switched to defense, got defended hard, intake jammed, recovered and climbed."
                    />
                  </label>
                  <label className="space-y-2">
                    <span className={fieldLabelClass}>What should strategy know?</span>
                    <textarea
                      value={normalizedData.strategyNotes}
                      onChange={event => updateData({ strategyNotes: event.target.value })}
                      rows={6}
                      className={`${inputClass} min-h-32`}
                      placeholder="Examples: good second scorer, can defend without dying, avoid traffic near source, verify before pick list."
                    />
                  </label>
                </section>

                <div className="admin-g2 mt-4 flex flex-wrap items-center justify-end gap-3 border border-slate-800 bg-slate-900/70 p-4">
                  <button
                    type="button"
                    onClick={() => setShowQr(value => !value)}
                    className="admin-g2-sm inline-flex items-center gap-2 bg-slate-800 px-5 py-3 font-black text-slate-200 hover:bg-slate-700"
                  >
                    <QrCode className="h-5 w-5" />
                    Offline QR
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSubmit()}
                    disabled={isSubmitting}
                    className="admin-g2-sm inline-flex items-center gap-2 bg-emerald-500 px-8 py-3 text-lg font-black text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
                  >
                    <Save className="h-5 w-5" />
                    Submit Local First
                  </button>
                </div>
              </StepFrame>

              {showQr && (
                <div className="admin-g2 border border-cyan-400/30 bg-cyan-500/10 p-6 text-center">
                  <div className="mx-auto max-w-xl text-left">
                    <div className="text-xs font-black uppercase tracking-[0.2em] text-cyan-100">Offline Backup</div>
                    <p className="mt-2 text-sm font-semibold leading-relaxed text-cyan-50/80">
                      Use this only when Firebase sync is not available. Submit Local First still saves the row on this device.
                    </p>
                  </div>
                  <div className="admin-g2 mx-auto mt-4 inline-block bg-white p-4">
                    <QRCodeSVG value={compressMatchDataV4(buildCurrentPayload())} size={260} level="M" />
                  </div>
                  <p className="mt-4 flex items-center justify-center gap-2 text-sm font-bold text-cyan-100">
                    <Download className="h-4 w-4" />
                    Scan this in Admin V4 Data if Firebase is unavailable.
                  </p>
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
