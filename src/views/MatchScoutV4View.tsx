import React, { useEffect, useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Coins, Download, QrCode, RefreshCw, Save, Shield, Target, Trophy } from 'lucide-react';
import { MatchScoutingV4, MatchScoutingV4Role, initialMatchScoutingV4 } from '../types';
import ScoutUsernameGate from '../components/ScoutUsernameGate';
import { SCOUT_ASSIGNMENTS, getScoutAssignmentByName } from '../utils/scoutAssignments';
import { DEFAULT_EVENT_KEY, getPersistentDeviceId } from '../utils/sharedEventState';
import { buildMatchKeyV4, normalizeMatchScoutingV4 } from '../utils/matchScoutingV4';
import {
  getScoutArchiveUsername,
  setScoutArchiveUsername,
  updateScoutArchiveRecordSyncState,
  upsertMatchArchiveRecordV4
} from '../utils/scoutArchive';
import { writeMatchScoutingV4Record } from '../utils/scoutingWrites';
import { compressMatchDataV4 } from '../utils/qrCompression';
import { getPowerCoinBalance, listPowerCoinBets, upsertPowerCoinBet } from '../utils/adminV2LocalStore';
import { MathEngine, TBAMatch } from '../utils/mathEngine';
import { TBA_API_KEY } from '../config';

const DRAFT_KEY = 'match_scout_v4_draft';
const SUBSTITUTES = ['Charlotte', 'Scarlett'] as const;
const ROLE_OPTIONS: MatchScoutingV4Role[] = ['Offense', 'Defense', 'Mixed', 'Support', 'Disabled'];
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
  value,
  onChange,
  steps = [1, 3, 5, 10]
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  steps?: number[];
}) => {
  const [lastValue, setLastValue] = useState<number | null>(null);
  const commitChange = (nextValue: number) => {
    setLastValue(value);
    onChange(nextValue);
  };

  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-black text-white">{label}</h3>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Counted robot output</p>
        </div>
        <div className="rounded-2xl bg-slate-950 px-5 py-3 text-3xl font-black text-cyan-200">{value}</div>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {steps.map(step => (
          <button
            key={step}
            type="button"
            onClick={() => commitChange(value + step)}
            className="rounded-2xl bg-cyan-600 px-3 py-3 text-lg font-black text-white shadow-lg transition hover:bg-cyan-500 active:scale-95"
          >
            +{step}
          </button>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => commitChange(Math.max(0, value - 1))}
          className="rounded-xl bg-slate-800 px-3 py-2 text-sm font-bold text-slate-200 hover:bg-slate-700"
        >
          -1
        </button>
        <button
          type="button"
          onClick={() => commitChange(0)}
          className="rounded-xl bg-rose-950 px-3 py-2 text-sm font-bold text-rose-200 hover:bg-rose-900"
        >
          Reset
        </button>
        <button
          type="button"
          onClick={() => {
            if (lastValue == null) return;
            onChange(lastValue);
            setLastValue(null);
          }}
          disabled={lastValue == null}
          className="rounded-xl bg-amber-500/10 px-3 py-2 text-sm font-bold text-amber-200 hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:bg-slate-900 disabled:text-slate-600"
        >
          Revert Last
        </button>
      </div>
    </div>
  );
};

export default function MatchScoutV4View() {
  const navigate = useNavigate();
  const deviceId = useMemo(() => getPersistentDeviceId(), []);
  const [archiveUsername, setArchiveUsername] = useState('');
  const [pendingUsername, setPendingUsername] = useState('');
  const [isUsernameResolved, setIsUsernameResolved] = useState(false);
  const [data, setData] = useState<MatchScoutingV4>(() => getDefaultData(deviceId));
  const [statusMessage, setStatusMessage] = useState('');
  const [showQr, setShowQr] = useState(false);
  const [betGateOpen, setBetGateOpen] = useState(false);
  const [betSkipped, setBetSkipped] = useState(false);
  const [betLockedMatchKey, setBetLockedMatchKey] = useState('');
  const [betSide, setBetSide] = useState<'Red' | 'Blue'>('Red');
  const [betAmount, setBetAmount] = useState(50);
  const [powerCoinBalance, setPowerCoinBalance] = useState(1000);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [eventMatches, setEventMatches] = useState<TBAMatch[]>([]);
  const [scheduledTeams, setScheduledTeams] = useState<string[]>([]);
  const [isLoadingSchedule, setIsLoadingSchedule] = useState(false);
  const [assignmentWarning, setAssignmentWarning] = useState('');
  const [teamWarning, setTeamWarning] = useState('');

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

  useEffect(() => {
    let cancelled = false;
    const hydrate = async () => {
      try {
        const username = await getScoutArchiveUsername();
        const draftText = localStorage.getItem(DRAFT_KEY);
        const draft = draftText ? JSON.parse(draftText) as Partial<MatchScoutingV4> : null;
        if (cancelled) return;
        setArchiveUsername(username || '');
        setPendingUsername(username || '');
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
    let cancelled = false;
    const hydrateBalance = async () => {
      if (!archiveUsername) return;
      try {
        const balance = await getPowerCoinBalance(normalizedData.eventKey, archiveUsername);
        if (!cancelled) setPowerCoinBalance(balance);
      } catch (error) {
        console.warn('Unable to load PowerCoin balance', error);
      }
    };
    void hydrateBalance();
    return () => {
      cancelled = true;
    };
  }, [archiveUsername, normalizedData.eventKey]);

  useEffect(() => {
    let cancelled = false;
    const hydrateExistingBet = async () => {
      if (!archiveUsername || !currentMatchKey) return;
      try {
        const bets = await listPowerCoinBets(normalizedData.eventKey);
        const existingBet = bets.find(
          bet =>
            bet.matchKey === currentMatchKey &&
            bet.scoutName.trim().toLowerCase() === archiveUsername.trim().toLowerCase()
        );
        if (!cancelled && existingBet) {
          setBetGateOpen(true);
          setBetSkipped(false);
          setBetLockedMatchKey(currentMatchKey);
          setBetSide(existingBet.side);
          setBetAmount(existingBet.amount);
        }
      } catch (error) {
        console.warn('Unable to check existing PowerCoin bet', error);
      }
    };
    void hydrateExistingBet();
    return () => {
      cancelled = true;
    };
  }, [archiveUsername, currentMatchKey, normalizedData.eventKey]);

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

      if (!TBA_API_KEY) {
        setAssignmentWarning('TBA API key missing. Schedule auto-fill is unavailable; team and alliance remain manual.');
        return;
      }

      setIsLoadingSchedule(true);
      try {
        const engine = new MathEngine(TBA_API_KEY);
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
      teamNumber: assignedTeamNumber || normalizedData.teamNumber
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
    selectedAssignment
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

  const handleScoutSelection = (name: string) => {
    const assignment = getScoutAssignmentByName(name);
    if (!assignment) return;
    updateData({
      assignedScoutName: assignment.name,
      assignedSlot: assignment.slotLabel,
      alliance: assignment.alliance,
      substituteScoutName: ''
    });
  };

  const handleBetSubmit = async () => {
    const amount = Math.max(1, Math.min(powerCoinBalance, Math.round(betAmount)));
    if (amount <= 0) {
      setStatusMessage('PowerCoin bet must be at least 1 coin.');
      return;
    }

    const matchKey = currentMatchKey;
    const scoutName = archiveUsername || normalizedData.scoutName;
    const existingBets = await listPowerCoinBets(normalizedData.eventKey).catch(() => []);
    const existingBet = existingBets.find(
      bet =>
        bet.matchKey === matchKey &&
        bet.scoutName.trim().toLowerCase() === scoutName.trim().toLowerCase()
    );

    if (existingBet) {
      setBetGateOpen(true);
      setBetSkipped(false);
      setBetLockedMatchKey(matchKey);
      setBetSide(existingBet.side);
      setBetAmount(existingBet.amount);
      setStatusMessage(`Existing PowerCoin bet is already locked: ${existingBet.amount} on ${existingBet.side}.`);
      return;
    }

    await upsertPowerCoinBet({
      id: `${normalizedData.eventKey}_${matchKey}_${scoutName}`,
      eventKey: normalizedData.eventKey,
      matchKey,
      matchNumber: normalizedData.matchNumber,
      matchType: normalizedData.matchType,
      scoutName,
      side: betSide,
      amount,
      placedAt: Date.now()
    });
    setBetGateOpen(true);
    setBetSkipped(false);
    setBetLockedMatchKey(matchKey);
    setPowerCoinBalance(balance => Math.max(0, balance - amount));
    setStatusMessage(`PowerCoins locked: ${amount} on ${betSide}.`);
  };

  const validate = () => {
    if (!archiveUsername.trim()) return 'Scout username is required.';
    if (!normalizedData.teamNumber.trim()) return 'Team number is required.';
    if (!normalizedData.assignedScoutName.trim()) return 'Select the fixed scout assignment.';
    if (!normalizedData.alliance) return 'Alliance is required.';
    return '';
  };

  const handleSubmit = async () => {
    const validationError = validate();
    if (validationError) {
      setStatusMessage(validationError);
      return;
    }

    setIsSubmitting(true);
    setStatusMessage('Saving locally first...');

    const payload = normalizeMatchScoutingV4({
      ...normalizedData,
      scoutName: archiveUsername,
      matchKey: currentMatchKey,
      timestamp: Date.now(),
      deviceId
    });

    try {
      const archiveRecord = await upsertMatchArchiveRecordV4(payload, archiveUsername, 'local_submit', {
        syncStatus: 'pending_sync',
        lastFirebaseAttemptAt: Date.now(),
        lastFirebaseError: ''
      });

      try {
        const writeResult = await writeMatchScoutingV4Record(payload, { mode: 'strict' });
        if (writeResult.outcome === 'conflict') {
          await updateScoutArchiveRecordSyncState(archiveRecord.recordId, {
            syncStatus: 'unsynced',
            lastFirebaseAttemptAt: Date.now(),
            lastFirebaseError: writeResult.message
          });
          setStatusMessage(`Saved locally. Firebase conflict blocked: ${writeResult.message}`);
          return;
        }

        await updateScoutArchiveRecordSyncState(archiveRecord.recordId, {
          syncStatus: 'synced',
          lastFirebaseAttemptAt: Date.now(),
          lastFirebaseError: ''
        });
        localStorage.removeItem(DRAFT_KEY);
        setData(getDefaultData(deviceId, archiveUsername));
        setBetGateOpen(false);
        setBetSkipped(false);
        setBetLockedMatchKey('');
        setStatusMessage(`Saved locally and synced to Firebase. ${writeResult.message}`);
      } catch (firebaseError) {
        await updateScoutArchiveRecordSyncState(archiveRecord.recordId, {
          syncStatus: 'unsynced',
          lastFirebaseAttemptAt: Date.now(),
          lastFirebaseError: firebaseError instanceof Error ? firebaseError.message : 'Firebase sync failed.'
        });
        setStatusMessage('Saved locally in My History. Firebase failed, so this record is marked unsynced and remains exportable.');
      }
    } catch (localError) {
      console.error('Failed to save V4 record locally', localError);
      setStatusMessage('Local IndexedDB save failed. Submission stopped to prevent data loss.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const canOpenForm = (betGateOpen || betSkipped) && betLockedMatchKey === currentMatchKey;

  return (
    <div className="h-full overflow-y-auto bg-slate-950 px-4 py-6 text-white md:px-8">
      {isUsernameResolved && !archiveUsername && (
        <ScoutUsernameGate
          pendingUsername={pendingUsername}
          setPendingUsername={setPendingUsername}
          onSave={() => void handleUsernameSave()}
        />
      )}

      <div className="mx-auto max-w-6xl space-y-6 pb-24">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="mb-3 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-bold text-slate-300 hover:bg-slate-800"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            <h1 className="text-4xl font-black tracking-tight text-white">Match Scout V4</h1>
            <p className="mt-1 text-sm font-semibold text-slate-400">
              Full offense, defense, reliability, and strategy notes. Local-first before Firebase.
            </p>
          </div>
          <div className="rounded-3xl border border-cyan-400/30 bg-cyan-400/10 px-5 py-4 text-right">
            <div className="text-xs font-black uppercase tracking-widest text-cyan-200">Total Match Points</div>
            <div className="text-5xl font-black text-cyan-100">{totalPoints}</div>
          </div>
        </div>

        {statusMessage && (
          <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm font-bold text-amber-100">
            {statusMessage}
          </div>
        )}

        <section className="grid gap-4 rounded-3xl border border-slate-800 bg-slate-900/70 p-5 md:grid-cols-3">
          <label className="space-y-2">
            <span className="text-xs font-black uppercase tracking-widest text-slate-500">Event</span>
            <input
              value={normalizedData.eventKey}
              onChange={event => updateData({ eventKey: event.target.value })}
              className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 font-mono font-bold text-white outline-none focus:border-cyan-400"
            />
          </label>
          <label className="space-y-2">
            <span className="text-xs font-black uppercase tracking-widest text-slate-500">Match Type</span>
            <div className="grid grid-cols-2 gap-2">
              {(['Practice', 'Qualification'] as const).map(matchType => (
                <button
                  key={matchType}
                  type="button"
                  onClick={() => updateData({ matchType, matchKey: buildMatchKeyV4(matchType, normalizedData.matchNumber) })}
                  className={`rounded-2xl px-4 py-3 font-black ${normalizedData.matchType === matchType ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                >
                  {matchType}
                </button>
              ))}
            </div>
          </label>
          <label className="space-y-2">
            <span className="text-xs font-black uppercase tracking-widest text-slate-500">Match Number</span>
            <input
              type="number"
              min={1}
              value={normalizedData.matchNumber}
              onChange={event => updateData({ matchNumber: Number(event.target.value), matchKey: buildMatchKeyV4(normalizedData.matchType, Number(event.target.value)) })}
              className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 font-mono font-bold text-white outline-none focus:border-cyan-400"
            />
          </label>
          <label className="space-y-2">
            <span className="text-xs font-black uppercase tracking-widest text-slate-500">Scout Username</span>
            <input
              value={archiveUsername}
              onChange={event => {
                setPendingUsername(event.target.value);
                setArchiveUsername(event.target.value);
                updateData({ scoutName: event.target.value });
              }}
              onBlur={() => void handleUsernameSave()}
              className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 font-bold text-white outline-none focus:border-cyan-400"
            />
          </label>
          <label className="space-y-2">
            <span className="text-xs font-black uppercase tracking-widest text-slate-500">Team Number</span>
            <input
              value={normalizedData.teamNumber}
              onChange={event => updateData({ teamNumber: event.target.value.replace(/[^\d]/g, '') })}
              className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 font-mono text-xl font-black text-white outline-none focus:border-cyan-400"
            />
          </label>
          <label className="space-y-2">
            <span className="text-xs font-black uppercase tracking-widest text-slate-500">Alliance</span>
            <div className="grid grid-cols-2 gap-2">
              {(['Red', 'Blue'] as const).map(alliance => (
                <button
                  key={alliance}
                  type="button"
                  onClick={() => updateData({ alliance })}
                  className={`rounded-2xl px-4 py-3 font-black ${normalizedData.alliance === alliance ? (alliance === 'Red' ? 'bg-red-500 text-white' : 'bg-blue-500 text-white') : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                >
                  {alliance}
                </button>
              ))}
            </div>
          </label>
        </section>

        <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
          <div className="mb-4 flex items-center gap-3">
            <Target className="h-5 w-5 text-cyan-300" />
            <h2 className="text-xl font-black text-white">Fixed Scout Assignment</h2>
          </div>
          <div className="grid gap-2 md:grid-cols-6">
            {SCOUT_ASSIGNMENTS.map(assignment => (
              <button
                key={assignment.name}
                type="button"
                onClick={() => handleScoutSelection(assignment.name)}
                className={`rounded-2xl px-3 py-4 text-center font-black transition active:scale-95 ${
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
            <span className="mr-2 self-center text-xs font-black uppercase tracking-widest text-slate-500">Substitute</span>
            {SUBSTITUTES.map(name => (
              <button
                key={name}
                type="button"
                onClick={() => updateData({ substituteScoutName: normalizedData.substituteScoutName === name ? '' : name })}
                className={`rounded-full px-4 py-2 text-sm font-black ${
                  normalizedData.substituteScoutName === name ? 'bg-amber-400 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {name}
              </button>
            ))}
          </div>
          <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-sm text-slate-300">
            Assigned slot: <span className="font-black text-white">{normalizedData.assignedSlot || 'Select scout'}</span>
            {' • '}
            Actual scout: <span className="font-black text-white">{normalizedData.substituteScoutName || archiveUsername || normalizedData.scoutName || 'Unassigned'}</span>
            {isLoadingSchedule && (
              <span className="ml-3 inline-flex items-center gap-2 font-black text-cyan-300">
                <RefreshCw className="h-4 w-4 animate-spin" />
                Loading schedule...
              </span>
            )}
          </div>
          {(assignmentWarning || teamWarning) && (
            <div className="mt-4 space-y-2">
              {assignmentWarning && (
                <div className="flex items-start gap-2 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-200">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  {assignmentWarning}
                </div>
              )}
              {teamWarning && (
                <div className="flex items-start gap-2 rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-200">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  {teamWarning}
                </div>
              )}
            </div>
          )}
        </section>

        {!canOpenForm && (
          <section className="rounded-3xl border border-yellow-400/30 bg-yellow-500/10 p-6">
            <div className="mb-4 flex items-center gap-3">
              <Coins className="h-6 w-6 text-yellow-300" />
              <div>
                <h2 className="text-2xl font-black text-white">PowerCoins Gate</h2>
                <p className="text-sm font-semibold text-yellow-100/80">Bet before scouting, or skip. Current balance: {powerCoinBalance.toFixed(0)} coins.</p>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
              <button
                type="button"
                onClick={() => setBetSide('Red')}
                className={`rounded-2xl px-4 py-4 font-black ${betSide === 'Red' ? 'bg-red-500 text-white' : 'bg-slate-800 text-slate-300'}`}
              >
                Bet Red
              </button>
              <button
                type="button"
                onClick={() => setBetSide('Blue')}
                className={`rounded-2xl px-4 py-4 font-black ${betSide === 'Blue' ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-300'}`}
              >
                Bet Blue
              </button>
              <input
                type="number"
                min={1}
                max={Math.max(1, powerCoinBalance)}
                value={betAmount}
                onChange={event => setBetAmount(Number(event.target.value))}
                className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-4 font-mono font-black text-white outline-none focus:border-yellow-300"
              />
              <button
                type="button"
                onClick={() => void handleBetSubmit()}
                className="rounded-2xl bg-yellow-400 px-6 py-4 font-black text-slate-950 hover:bg-yellow-300"
              >
                Place Bet
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                setBetSkipped(true);
                setBetGateOpen(false);
                setBetLockedMatchKey(currentMatchKey);
                setStatusMessage('PowerCoins skipped for this form.');
              }}
              className="mt-3 rounded-xl bg-slate-800 px-4 py-2 text-sm font-bold text-slate-300 hover:bg-slate-700"
            >
              Skip betting and open form
            </button>
          </section>
        )}

        {canOpenForm && (
          <>
            <section className="grid gap-4 md:grid-cols-3">
              <NumberCounter label="Auto Points" value={normalizedData.autoPoints} onChange={value => updateData({ autoPoints: value })} />
              <NumberCounter label="Teleop Points" value={normalizedData.teleopPoints} onChange={value => updateData({ teleopPoints: value })} />
              <NumberCounter label="Endgame Points" value={normalizedData.endgamePoints} onChange={value => updateData({ endgamePoints: value })} steps={[1, 5, 10, 15]} />
            </section>

            <section className="grid gap-4 md:grid-cols-2">
              <NumberCounter label="Auto Cycles" value={normalizedData.autoCycles} onChange={value => updateData({ autoCycles: value })} steps={[1]} />
              <NumberCounter label="Teleop Cycles" value={normalizedData.teleopCycles} onChange={value => updateData({ teleopCycles: value })} steps={[1]} />
            </section>

            <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
              <div className="mb-4 flex items-center gap-3">
                <Shield className="h-5 w-5 text-emerald-300" />
                <h2 className="text-xl font-black text-white">Defense and Role</h2>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="md:col-span-3 grid gap-2 md:grid-cols-5">
                  {ROLE_OPTIONS.map(role => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => updateData({ rolePlayed: role })}
                      className={`rounded-2xl px-3 py-3 font-black ${normalizedData.rolePlayed === role ? 'bg-emerald-400 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                    >
                      {role}
                    </button>
                  ))}
                </div>
                <label className="space-y-2">
                  <span className="text-xs font-black uppercase tracking-widest text-slate-500">Team they defended</span>
                  <input
                    value={normalizedData.defendedTeamNumber}
                    onChange={event => updateData({ defendedTeamNumber: event.target.value.replace(/[^\d]/g, '') })}
                    className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 font-mono font-bold text-white outline-none focus:border-emerald-400"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-black uppercase tracking-widest text-slate-500">Defender faced</span>
                  <input
                    value={normalizedData.defenderFacedTeamNumber}
                    onChange={event => updateData({ defenderFacedTeamNumber: event.target.value.replace(/[^\d]/g, '') })}
                    className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 font-mono font-bold text-white outline-none focus:border-emerald-400"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-black uppercase tracking-widest text-slate-500">Defense duration seconds</span>
                  <input
                    type="number"
                    min={0}
                    value={normalizedData.defenseDurationSeconds}
                    onChange={event => updateData({ defenseDurationSeconds: Number(event.target.value) })}
                    className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 font-mono font-bold text-white outline-none focus:border-emerald-400"
                  />
                </label>
                <label className="space-y-2 md:col-span-3">
                  <span className="text-xs font-black uppercase tracking-widest text-slate-500">
                    Defense Intensity: {(normalizedData.defenseIntensity * 100).toFixed(2)}%
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

            <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
              <div className="mb-4 flex items-center gap-3">
                <Trophy className="h-5 w-5 text-rose-300" />
                <h2 className="text-xl font-black text-white">Reliability, Fouls, and Failures</h2>
              </div>
              <div className="grid gap-4 md:grid-cols-4">
                <label className="space-y-2">
                  <span className="text-xs font-black uppercase tracking-widest text-slate-500">Fouls</span>
                  <input type="number" min={0} value={normalizedData.fouls} onChange={event => updateData({ fouls: Number(event.target.value) })} className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 font-mono font-bold text-white outline-none focus:border-rose-400" />
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-black uppercase tracking-widest text-slate-500">Tech Fouls</span>
                  <input type="number" min={0} value={normalizedData.techFouls} onChange={event => updateData({ techFouls: Number(event.target.value) })} className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 font-mono font-bold text-white outline-none focus:border-rose-400" />
                </label>
                <label className="space-y-2 md:col-span-2">
                  <span className="text-xs font-black uppercase tracking-widest text-slate-500">Reliability: {(normalizedData.reliabilityScore * 100).toFixed(2)}%</span>
                  <input type="range" min={0} max={1} step={0.0001} value={normalizedData.reliabilityScore} onChange={event => updateData({ reliabilityScore: Number(event.target.value) })} className="w-full accent-rose-400" />
                </label>
              </div>
              <div className="mt-4 grid gap-2 md:grid-cols-4">
                {[
                  ['robotDied', 'Robot Died'],
                  ['commsLost', 'Comms Lost'],
                  ['mechanismBroke', 'Mechanism Broke'],
                  ['tippedOver', 'Tipped Over']
                ].map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => updateData({ [key]: !normalizedData[key as keyof MatchScoutingV4] } as Partial<MatchScoutingV4>)}
                    className={`rounded-2xl px-3 py-3 font-black ${normalizedData[key as keyof MatchScoutingV4] ? 'bg-rose-500 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <label className="mt-4 block space-y-2">
                <span className="text-xs font-black uppercase tracking-widest text-slate-500">Failure Reason</span>
                <input value={normalizedData.failureReason} onChange={event => updateData({ failureReason: event.target.value })} className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-rose-400" />
              </label>
            </section>

            <section className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-xs font-black uppercase tracking-widest text-slate-500">Qualitative Notes</span>
                <textarea value={normalizedData.notes} onChange={event => updateData({ notes: event.target.value })} rows={7} className="w-full rounded-3xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-400" />
              </label>
              <label className="space-y-2">
                <span className="text-xs font-black uppercase tracking-widest text-slate-500">Strategy Notes</span>
                <textarea value={normalizedData.strategyNotes} onChange={event => updateData({ strategyNotes: event.target.value })} rows={7} className="w-full rounded-3xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-400" />
              </label>
            </section>

            <div className="flex flex-wrap items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowQr(value => !value)}
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-800 px-5 py-3 font-black text-slate-200 hover:bg-slate-700"
              >
                <QrCode className="h-5 w-5" />
                QR Export
              </button>
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500 px-8 py-3 text-lg font-black text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
              >
                <Save className="h-5 w-5" />
                Submit Local First
              </button>
            </div>

            {showQr && (
              <div className="rounded-3xl border border-cyan-400/30 bg-cyan-500/10 p-6 text-center">
                <div className="mx-auto inline-block rounded-3xl bg-white p-4">
                  <QRCodeSVG value={compressMatchDataV4(normalizedData)} size={260} level="M" />
                </div>
                <p className="mt-4 flex items-center justify-center gap-2 text-sm font-bold text-cyan-100">
                  <Download className="h-4 w-4" />
                  Scan this in Admin V2 Data Import if Firebase is unavailable.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
