import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { deleteDoc, doc } from 'firebase/firestore';
import { AlertTriangle, ArrowLeft, Download, QrCode } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { db } from '../firebase';
import { MatchDefenseScoutingV1, initialMatchDefenseScoutingV1 } from '../types';
import { DEFAULT_EVENT_KEY, getPersistentDeviceId } from '../utils/sharedEventState';
import { MathEngine, TBAMatch } from '../utils/mathEngine';
import { TBA_API_KEY } from '../config';
import {
  buildMatchKeyV3
} from '../utils/matchScoutingV3';
import {
  normalizeMatchDefenseScoutingV1
} from '../utils/matchDefenseScouting';
import { compressMatchDefenseData } from '../utils/qrCompression';
import { buildScoutDraftKey, deleteScoutDraft, getScoutDraft, setScoutDraft } from '../utils/scoutDrafts';
import {
  getScoutArchiveUsername,
  setScoutArchiveUsername,
  updateScoutArchiveRecordSyncState,
  upsertMatchDefenseArchiveRecord
} from '../utils/scoutArchive';
import { getMatchDefenseDocId, writeMatchDefenseScoutingRecord } from '../utils/scoutingWrites';
import { SCOUT_ASSIGNMENTS } from '../utils/scoutAssignments';
import ScoutUsernameGate from '../components/ScoutUsernameGate';

export const MATCH_DEFENSE_EDIT_STORAGE_KEY = 'edit_match_defense_data_v1';

const MATCH_DEFENSE_EVENT_KEY_STORAGE = 'match_scout_v3_event_key';
const MATCH_DEFENSE_ASSIGNED_SCOUT_STORAGE = 'match_defense_assigned_scout';
const MATCH_DEFENSE_MATCH_TYPE_STORAGE = 'match_defense_match_type';
const MATCH_DEFENSE_MATCH_NUMBER_STORAGE = 'match_defense_match_number';
const MATCH_DEFENSE_TEAM_STORAGE = 'match_defense_team';
const SUBSTITUTE_SCOUTS = ['Charlotte', 'Scarlett'] as const;
const MATCH_TYPES: MatchDefenseScoutingV1['matchType'][] = ['Practice', 'Qualification'];

interface MatchDefenseDraftPayload {
  data: MatchDefenseScoutingV1;
}

const sanitizeEventKey = (value: string) => value.toUpperCase().replace(/\s+/g, '');
const getShortMatchKey = (match: TBAMatch) => match.key.split('_')[1]?.toLowerCase() || '';

const getStoredMatchType = (): MatchDefenseScoutingV1['matchType'] => {
  const stored = localStorage.getItem(MATCH_DEFENSE_MATCH_TYPE_STORAGE);
  return stored === 'Practice' ? 'Practice' : 'Qualification';
};

const getStoredMatchNumber = () => {
  const stored = parseInt(localStorage.getItem(MATCH_DEFENSE_MATCH_NUMBER_STORAGE) || '1', 10);
  return Number.isFinite(stored) && stored > 0 ? stored : 1;
};

const getStoredAssignedScout = () => localStorage.getItem(MATCH_DEFENSE_ASSIGNED_SCOUT_STORAGE) || '';
const getStoredTeamNumber = () => localStorage.getItem(MATCH_DEFENSE_TEAM_STORAGE) || '';
const toPositiveInt = (value: string) => {
  const parsed = parseInt(value.replace(/\D/g, ''), 10);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatDefensePercent = (value: number) => `${(value * 100).toFixed(2)}%`;

function SectionCard({
  title,
  subtitle,
  children
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5 md:p-6">
      <div className="mb-5 border-b border-slate-800 pb-3">
        <h2 className="text-xl font-black text-white">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}
      </div>
      <div className="space-y-5">{children}</div>
    </div>
  );
}

function ChoiceButton({
  active,
  label,
  onClick,
  disabled = false
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-xl px-3 py-3 text-sm font-black transition-all ${
        active
          ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-900/20'
          : 'border border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-800'
      } ${disabled ? 'cursor-not-allowed opacity-50 hover:bg-slate-950' : ''}`}
    >
      {label}
    </button>
  );
}

function DefenseMetricSlider({
  value,
  onChange
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
      <div className="mb-2 flex items-center justify-between">
        <label className="text-xs font-black uppercase tracking-wider text-slate-500">Defense Metric</label>
        <span className="font-mono text-sm font-black text-emerald-300">{formatDefensePercent(value)}</span>
      </div>
      <input
        type="range"
        min="0"
        max="100"
        step="0.01"
        value={(value * 100).toFixed(2)}
        onChange={event => onChange(Number((parseFloat(event.target.value) / 100).toFixed(4)))}
        className="w-full accent-emerald-500"
      />
      <div className="mt-1 flex justify-between text-[10px] font-bold uppercase tracking-wide text-slate-500">
        <span>0%</span>
        <span>100%</span>
      </div>
      <div className="mt-2 text-xs text-slate-500">Stored as a 0–1 float with 0.0001 precision.</div>
    </div>
  );
}

export default function MatchDefenseScoutView() {
  const navigate = useNavigate();
  const storedEventKey = sanitizeEventKey(localStorage.getItem(MATCH_DEFENSE_EVENT_KEY_STORAGE) || DEFAULT_EVENT_KEY);
  const storedAssignedScout = getStoredAssignedScout();
  const storedMatchType = getStoredMatchType();
  const storedMatchNumber = getStoredMatchNumber();
  const storedTeamNumber = getStoredTeamNumber();
  const persistentDeviceId = useMemo(() => getPersistentDeviceId(), []);
  const storedAssignment = useMemo(
    () => SCOUT_ASSIGNMENTS.find(assignment => assignment.name === storedAssignedScout) || null,
    [storedAssignedScout]
  );

  const [data, setData] = useState<MatchDefenseScoutingV1>(() =>
    normalizeMatchDefenseScoutingV1({
      ...initialMatchDefenseScoutingV1,
      eventKey: storedEventKey,
      matchType: storedMatchType,
      matchNumber: storedMatchNumber,
      matchKey: buildMatchKeyV3(storedMatchType, storedMatchNumber),
      teamNumber: storedTeamNumber,
      scoutName: storedAssignedScout,
      assignedScoutName: storedAssignedScout,
      assignedSlot: storedAssignment?.slotLabel || '',
      alliance: storedAssignment?.alliance || '',
      deviceId: persistentDeviceId
    })
  );
  const [isEditing, setIsEditing] = useState(false);
  const [originalDocId, setOriginalDocId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [bootResolved, setBootResolved] = useState(false);
  const [isDraftHydrated, setIsDraftHydrated] = useState(false);
  const [archiveUsername, setArchiveUsernameState] = useState('');
  const [pendingArchiveUsername, setPendingArchiveUsername] = useState('');
  const [isArchiveUsernameResolved, setIsArchiveUsernameResolved] = useState(false);
  const [eventMatches, setEventMatches] = useState<TBAMatch[]>([]);
  const [scheduledTeams, setScheduledTeams] = useState<string[]>([]);
  const [isLoadingSchedule, setIsLoadingSchedule] = useState(false);
  const [assignmentWarning, setAssignmentWarning] = useState('');
  const [teamWarning, setTeamWarning] = useState('');
  const skipNextDraftSaveRef = useRef(false);

  const selectedAssignment = useMemo(
    () => SCOUT_ASSIGNMENTS.find(assignment => assignment.name === data.assignedScoutName) || null,
    [data.assignedScoutName]
  );

  const activeDraftKey = useMemo(() => {
    if (!bootResolved) return '';
    if (isEditing) {
      return buildScoutDraftKey('matchDefense', 'edit', `${data.eventKey}:${originalDocId || getMatchDefenseDocId(data)}`);
    }
    return buildScoutDraftKey('matchDefense', 'new', data.eventKey);
  }, [bootResolved, data, isEditing, originalDocId]);

  const updateData = (updates: Partial<MatchDefenseScoutingV1>) => {
    setData(prev => normalizeMatchDefenseScoutingV1({ ...prev, ...updates }));
  };

  const showNotification = (message: string, type: 'success' | 'error') => {
    setNotification({ message, type });
    window.setTimeout(() => setNotification(null), 3000);
  };

  useEffect(() => {
    let cancelled = false;

    const hydrateArchiveUsername = async () => {
      try {
        const storedUsername = await getScoutArchiveUsername();
        if (cancelled) return;
        setArchiveUsernameState(storedUsername || '');
        setPendingArchiveUsername(storedUsername || '');
      } catch (error) {
        console.error('Failed to hydrate scout username', error);
      } finally {
        if (!cancelled) {
          setIsArchiveUsernameResolved(true);
        }
      }
    };

    void hydrateArchiveUsername();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleArchiveUsernameSave = async () => {
    const normalized = pendingArchiveUsername.trim();
    if (!normalized) {
      showNotification('Please enter a scout username for this device.', 'error');
      return;
    }

    try {
      await setScoutArchiveUsername(normalized);
      setArchiveUsernameState(normalized);
      setPendingArchiveUsername(normalized);
    } catch (error) {
      console.error('Failed to save scout username', error);
      showNotification('Unable to save the scout username on this device.', 'error');
    }
  };

  useEffect(() => {
    const editPayload = localStorage.getItem(MATCH_DEFENSE_EDIT_STORAGE_KEY);
    if (!editPayload) {
      setBootResolved(true);
      return;
    }

    try {
      const parsed = JSON.parse(editPayload) as MatchDefenseScoutingV1;
      const nextData = normalizeMatchDefenseScoutingV1({ ...parsed, deviceId: parsed.deviceId || persistentDeviceId });
      setData(nextData);
      setIsEditing(true);
      setOriginalDocId(getMatchDefenseDocId(nextData));
    } catch (error) {
      console.error('Failed to parse defense edit payload', error);
    } finally {
      localStorage.removeItem(MATCH_DEFENSE_EDIT_STORAGE_KEY);
      setBootResolved(true);
    }
  }, [persistentDeviceId]);

  useEffect(() => {
    if (!bootResolved || !activeDraftKey) return;

    let cancelled = false;

    const hydrateDraft = async () => {
      try {
        const draft = await getScoutDraft<MatchDefenseDraftPayload>(activeDraftKey);
        if (cancelled || !draft) return;
        setData(normalizeMatchDefenseScoutingV1(draft.data.data));
      } catch (error) {
        console.error('Failed to hydrate defense draft', error);
      } finally {
        if (!cancelled) {
          setIsDraftHydrated(true);
        }
      }
    };

    setIsDraftHydrated(false);
    void hydrateDraft();

    return () => {
      cancelled = true;
    };
  }, [activeDraftKey, bootResolved]);

  useEffect(() => {
    if (!bootResolved || !isDraftHydrated || !activeDraftKey) return;
    if (skipNextDraftSaveRef.current) {
      skipNextDraftSaveRef.current = false;
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void setScoutDraft<MatchDefenseDraftPayload>(
        activeDraftKey,
        'matchDefense',
        isEditing ? 'edit' : 'new',
        isEditing ? `${data.eventKey}:${originalDocId || getMatchDefenseDocId(data)}` : data.eventKey,
        { data }
      );
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [activeDraftKey, bootResolved, data, isDraftHydrated, isEditing, originalDocId]);

  useEffect(() => {
    if (isEditing) return;
    localStorage.setItem(MATCH_DEFENSE_EVENT_KEY_STORAGE, data.eventKey);
    localStorage.setItem(MATCH_DEFENSE_ASSIGNED_SCOUT_STORAGE, data.assignedScoutName);
    localStorage.setItem(MATCH_DEFENSE_MATCH_TYPE_STORAGE, data.matchType);
    localStorage.setItem(MATCH_DEFENSE_MATCH_NUMBER_STORAGE, String(data.matchNumber));
    localStorage.setItem(MATCH_DEFENSE_TEAM_STORAGE, data.teamNumber);
  }, [data.assignedScoutName, data.eventKey, data.matchNumber, data.matchType, data.teamNumber, isEditing]);

  useEffect(() => {
    const fetchMatches = async () => {
      if (data.eventKey === 'TEST') {
        setEventMatches([]);
        setScheduledTeams([]);
        setAssignmentWarning('');
        return;
      }

      const cacheKey = `match_schedule_${sanitizeEventKey(data.eventKey)}`;
      const cachedMatches = localStorage.getItem(cacheKey);
      if (cachedMatches) {
        try {
          const parsed = JSON.parse(cachedMatches) as TBAMatch[];
          setEventMatches(parsed);
          const teams = new Set<string>();
          parsed.forEach(match => {
            match.alliances.red.team_keys.forEach(teamKey => teams.add(teamKey.replace('frc', '')));
            match.alliances.blue.team_keys.forEach(teamKey => teams.add(teamKey.replace('frc', '')));
          });
          setScheduledTeams(Array.from(teams));
        } catch (error) {
          console.error('Failed to parse cached schedule', error);
        }
      }

      if (!TBA_API_KEY) {
        setAssignmentWarning('TBA API key missing. Schedule auto-fill is unavailable; team and alliance remain manual.');
        return;
      }

      setIsLoadingSchedule(true);
      try {
        const engine = new MathEngine(TBA_API_KEY);
        const matches = await engine.fetchEventMatches(data.eventKey, { includeUnplayed: true });
        setEventMatches(matches);
        localStorage.setItem(cacheKey, JSON.stringify(matches));

        const teams = new Set<string>();
        matches.forEach(match => {
          match.alliances.red.team_keys.forEach(teamKey => teams.add(teamKey.replace('frc', '')));
          match.alliances.blue.team_keys.forEach(teamKey => teams.add(teamKey.replace('frc', '')));
        });
        setScheduledTeams(Array.from(teams));
      } catch (error) {
        console.error('Failed to fetch event matches for assignment', error);
        setAssignmentWarning('Unable to load the live schedule. Team number and alliance can still be entered manually.');
      } finally {
        setIsLoadingSchedule(false);
      }
    };

    void fetchMatches();
  }, [data.eventKey]);

  useEffect(() => {
    if (isEditing) return;

    const generatedMatchKey = buildMatchKeyV3(data.matchType, data.matchNumber);
    const assignment = selectedAssignment;

    setData(prev => ({
      ...prev,
      matchKey: generatedMatchKey
    }));

    if (!assignment) {
      setAssignmentWarning('');
      setData(prev =>
        normalizeMatchDefenseScoutingV1({
          ...prev,
          assignedSlot: '',
          alliance: '',
          scoutName: prev.substituteScoutName || prev.assignedScoutName
        })
      );
      return;
    }

    const scheduledMatch = eventMatches.find(match => getShortMatchKey(match) === generatedMatchKey.toLowerCase());
    const allianceTeamKeys =
      assignment.alliance === 'Red'
        ? scheduledMatch?.alliances.red.team_keys || []
        : scheduledMatch?.alliances.blue.team_keys || [];
    const assignedTeamKey = allianceTeamKeys[assignment.positionIndex] || '';
    const assignedTeamNumber = assignedTeamKey.replace('frc', '');

    setData(prev =>
      normalizeMatchDefenseScoutingV1({
        ...prev,
        matchKey: generatedMatchKey,
        assignedSlot: assignment.slotLabel,
        scoutName: prev.substituteScoutName || assignment.name,
        alliance: assignment.alliance,
        teamNumber: assignedTeamNumber || prev.teamNumber
      })
    );

    if (!scheduledMatch) {
      setAssignmentWarning(`No scheduled ${generatedMatchKey.toUpperCase()} was found for ${data.eventKey}. Team number remains editable.`);
      return;
    }

    if (!assignedTeamNumber) {
      setAssignmentWarning(`No team is published yet for ${assignment.slotLabel} in ${generatedMatchKey.toUpperCase()}. Team number remains editable.`);
      return;
    }

    setAssignmentWarning('');
  }, [data.eventKey, data.matchNumber, data.matchType, eventMatches, isEditing, selectedAssignment]);

  useEffect(() => {
    if (data.eventKey === 'TEST' || scheduledTeams.length === 0 || !data.teamNumber) {
      setTeamWarning('');
      return;
    }

    if (!scheduledTeams.includes(data.teamNumber)) {
      setTeamWarning(`Warning: Team ${data.teamNumber} is not currently listed in the ${data.eventKey} schedule.`);
      return;
    }

    setTeamWarning('');
  }, [data.eventKey, data.teamNumber, scheduledTeams]);

  const updateMatchIdentity = (
    updates: Partial<Pick<MatchDefenseScoutingV1, 'eventKey' | 'matchType' | 'matchNumber' | 'teamNumber' | 'alliance'>>
  ) => {
    const next = normalizeMatchDefenseScoutingV1({
      ...data,
      ...updates,
      matchKey: buildMatchKeyV3(updates.matchType || data.matchType, updates.matchNumber || data.matchNumber)
    });
    setData(next);
  };

  const handleAssignedScoutChange = (assignedScoutName: string) => {
    const assignment = SCOUT_ASSIGNMENTS.find(option => option.name === assignedScoutName);
    updateData({
      assignedScoutName,
      assignedSlot: assignment?.slotLabel || '',
      scoutName: data.substituteScoutName || assignedScoutName,
      substituteScoutName: data.substituteScoutName || '',
      alliance: assignment?.alliance || ''
    });
  };

  const handleSubstituteSelect = (substituteName: (typeof SUBSTITUTE_SCOUTS)[number]) => {
    if (!data.assignedScoutName) return;

    if (data.substituteScoutName === substituteName) {
      updateData({
        substituteScoutName: '',
        scoutName: data.assignedScoutName
      });
      return;
    }

    updateData({
      substituteScoutName: substituteName,
      scoutName: substituteName
    });
  };

  const handleSubmit = async () => {
    if (!archiveUsername) {
      showNotification('Please set a scout username for this device first.', 'error');
      return;
    }
    if (!data.assignedScoutName) {
      showNotification('Please select the assigned scout.', 'error');
      return;
    }
    if (!data.eventKey.trim()) {
      showNotification('Please enter an event key.', 'error');
      return;
    }
    if (!data.teamNumber.trim()) {
      showNotification('Please enter a team number.', 'error');
      return;
    }
    if (!data.alliance) {
      showNotification('Please select the alliance color.', 'error');
      return;
    }
    if (data.eventKey !== 'TEST' && scheduledTeams.length > 0 && !scheduledTeams.includes(data.teamNumber)) {
      showNotification(`Team ${data.teamNumber} is not scheduled for this event. Please verify the team number.`, 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = normalizeMatchDefenseScoutingV1({
        ...data,
        scoutName: data.substituteScoutName || data.assignedScoutName,
        deviceId: data.deviceId || persistentDeviceId,
        timestamp: Date.now(),
        matchKey: buildMatchKeyV3(data.matchType, data.matchNumber)
      });

      const docId = getMatchDefenseDocId(payload);
      const mode = isEditing && originalDocId === docId ? 'replace' : 'strict';
      const archiveRecord = await upsertMatchDefenseArchiveRecord(payload, archiveUsername, 'local_submit', {
        syncStatus: 'pending_sync',
        lastFirebaseAttemptAt: Date.now(),
        lastFirebaseError: ''
      });
      await deleteScoutDraft(activeDraftKey);
      skipNextDraftSaveRef.current = true;
      let syncMessage = isEditing ? 'Defense record updated successfully.' : 'Defense record submitted successfully.';
      let syncMessageType: 'success' | 'error' = 'success';
      let syncedRemotely = false;

      try {
        const writeResult = await writeMatchDefenseScoutingRecord(payload, { mode });

        if (writeResult.outcome === 'conflict') {
          await updateScoutArchiveRecordSyncState(archiveRecord.recordId, {
            syncStatus: 'unsynced',
            lastFirebaseAttemptAt: Date.now(),
            lastFirebaseError: 'Conflicting defense record already exists in Firebase.'
          });
          syncMessage = 'Saved locally. Firebase reported a conflict, so this defense record is unsynced in My History.';
          syncMessageType = 'error';
        } else {
          await updateScoutArchiveRecordSyncState(archiveRecord.recordId, {
            syncStatus: 'synced',
            lastFirebaseAttemptAt: Date.now(),
            lastFirebaseError: ''
          });
          syncedRemotely = true;
        }
      } catch (syncError) {
        console.error('Error syncing defense record to Firebase', syncError);
        await updateScoutArchiveRecordSyncState(archiveRecord.recordId, {
          syncStatus: 'unsynced',
          lastFirebaseAttemptAt: Date.now(),
          lastFirebaseError: syncError instanceof Error ? syncError.message : 'Firebase sync failed.'
        });
        syncMessage = 'Saved locally. Firebase sync failed, so this defense record is unsynced in My History.';
        syncMessageType = 'error';
      }

      if (syncedRemotely && isEditing && originalDocId && originalDocId !== docId) {
        try {
          await deleteDoc(doc(db, 'events', payload.eventKey, 'matchScoutingDefense', originalDocId));
        } catch (deleteError) {
          console.error('Failed to remove previous defense document after key change', deleteError);
        }
      }

      showNotification(syncMessage, syncMessageType);

      if (isEditing) {
        window.setTimeout(() => navigate('/history'), 900);
        return;
      }

      const nextMatchNumber = data.matchNumber + 1;
      setData(
        normalizeMatchDefenseScoutingV1({
          ...initialMatchDefenseScoutingV1,
          eventKey: payload.eventKey,
          matchType: payload.matchType,
          matchNumber: nextMatchNumber,
          matchKey: buildMatchKeyV3(payload.matchType, nextMatchNumber),
          teamNumber: '',
          scoutName: payload.assignedScoutName,
          assignedScoutName: payload.assignedScoutName,
          assignedSlot: payload.assignedSlot,
          alliance: payload.alliance,
          deviceId: payload.deviceId || persistentDeviceId
        })
      );
      window.scrollTo(0, 0);
    } catch (error) {
      console.error('Error submitting defense record', error);
      showNotification('Failed to submit the defense record.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-slate-950 p-4 pb-24 text-white md:p-6">
      {notification && (
        <div
          className={`fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-full px-6 py-3 font-bold shadow-2xl ${
            notification.type === 'error' ? 'bg-red-500 text-white' : 'bg-emerald-500 text-white'
          }`}
        >
          {notification.message}
        </div>
      )}

      {isArchiveUsernameResolved && !archiveUsername && (
        <div className="mb-6">
          <ScoutUsernameGate
            pendingUsername={pendingArchiveUsername}
            setPendingUsername={setPendingArchiveUsername}
            onSave={() => void handleArchiveUsernameSave()}
          />
        </div>
      )}

      <div className="mb-6 flex items-center justify-between border-b border-white/10 pb-4">
        <div>
          <h1 className="bg-gradient-to-r from-cyan-400 via-blue-400 to-emerald-400 bg-clip-text text-3xl font-black text-transparent">
            {isEditing ? 'EDIT DEFENSE SCOUT' : 'DEFENSE SCOUT'}
          </h1>
          <p className="mt-1 text-xs font-bold uppercase tracking-[0.25em] text-slate-500">
            Sparse scouting form for defense observations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowQr(true)}
            className="rounded-xl bg-slate-800 px-4 py-3 text-sm font-black text-slate-200 hover:bg-slate-700"
          >
            <QrCode className="mr-2 inline h-4 w-4" />
            QR Export
          </button>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="rounded-xl bg-slate-800 px-4 py-3 text-sm font-black text-slate-200 hover:bg-slate-700"
          >
            <ArrowLeft className="mr-2 inline h-4 w-4" />
            Back
          </button>
        </div>
      </div>

      <div className="space-y-6">
        <SectionCard title="Match Meta" subtitle="Core identifiers plus fixed scout-slot assignment for this defense entry.">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="space-y-2">
              <span className="text-xs font-black uppercase tracking-wider text-slate-500">Archive Username</span>
              <input
                value={archiveUsername}
                readOnly
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-white opacity-80"
              />
            </label>
            <label className="space-y-2">
              <span className="text-xs font-black uppercase tracking-wider text-slate-500">Event Key</span>
              <input
                value={data.eventKey}
                onChange={event => {
                  const nextEventKey = sanitizeEventKey(event.target.value || DEFAULT_EVENT_KEY);
                  updateMatchIdentity({ eventKey: nextEventKey || DEFAULT_EVENT_KEY });
                }}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-500"
              />
            </label>
            <div className="space-y-2 md:col-span-2">
              <span className="text-xs font-black uppercase tracking-wider text-slate-500">Assigned Scout</span>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                {SCOUT_ASSIGNMENTS.map(option => (
                  <ChoiceButton
                    key={option.name}
                    active={data.assignedScoutName === option.name}
                    label={`${option.name} • ${option.slotLabel.replace('Red', 'R').replace('Blue', 'B')}`}
                    onClick={() => handleAssignedScoutChange(option.name)}
                    disabled={isEditing}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <span className="text-xs font-black uppercase tracking-wider text-slate-500">Substitute</span>
              <div className="grid grid-cols-2 gap-2">
                {SUBSTITUTE_SCOUTS.map(option => (
                  <ChoiceButton
                    key={option}
                    active={data.substituteScoutName === option}
                    label={option}
                    onClick={() => handleSubstituteSelect(option)}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <span className="text-xs font-black uppercase tracking-wider text-slate-500">Match Type</span>
              <div className="grid grid-cols-2 gap-2">
                {MATCH_TYPES.map(option => (
                  <ChoiceButton
                    key={option}
                    active={data.matchType === option}
                    label={option}
                    onClick={() => updateMatchIdentity({ matchType: option })}
                    disabled={isEditing}
                  />
                ))}
              </div>
            </div>
            <label className="space-y-2">
              <span className="text-xs font-black uppercase tracking-wider text-slate-500">Match Number</span>
              <input
                value={String(data.matchNumber)}
                onChange={event => updateMatchIdentity({ matchNumber: Math.max(1, toPositiveInt(event.target.value) || 1) })}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-500"
                inputMode="numeric"
                pattern="[0-9]*"
              />
            </label>
            <label className="space-y-2">
              <span className="text-xs font-black uppercase tracking-wider text-slate-500">Generated Match Key</span>
              <input
                value={data.matchKey.toUpperCase()}
                readOnly
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 font-mono text-white opacity-80"
              />
            </label>
            <label className="space-y-2">
              <span className="text-xs font-black uppercase tracking-wider text-slate-500">Team Number</span>
              <input
                value={data.teamNumber}
                onChange={event => updateMatchIdentity({ teamNumber: event.target.value.replace(/[^\d]/g, '') })}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-500"
                inputMode="numeric"
                pattern="[0-9]*"
              />
            </label>
            <div className="space-y-2">
              <span className="text-xs font-black uppercase tracking-wider text-slate-500">Alliance</span>
              <div className="grid grid-cols-2 gap-2">
                {(['Red', 'Blue'] as const).map(option => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => updateMatchIdentity({ alliance: option })}
                    className={`rounded-xl px-3 py-3 text-sm font-black transition-all ${
                      data.alliance === option
                        ? option === 'Red'
                          ? 'bg-red-600 text-white'
                          : 'bg-blue-600 text-white'
                        : 'border border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
              <div className="text-xs font-black uppercase tracking-wider text-emerald-200">
                Schedule Status
              </div>
              <div className="mt-1 text-sm font-black text-white">
                {isLoadingSchedule ? 'Loading schedule…' : assignmentWarning ? 'Manual override' : 'Auto-filled'}
              </div>
            </div>
          </div>

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
        </SectionCard>

        <SectionCard
          title="Defense Evaluation"
          subtitle="Log one precise defense percentage plus detailed comments."
        >
          <DefenseMetricSlider
            value={data.defenseMetric}
            onChange={value => updateData({ defenseMetric: value })}
          />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <label className="space-y-2">
              <span className="text-xs font-black uppercase tracking-wider text-slate-500">Defense Comments</span>
              <textarea
                value={data.defenseComments}
                onChange={event => updateData({ defenseComments: event.target.value })}
                className="min-h-[180px] w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-500"
                placeholder="Describe how effective this team is on defense, where they disrupt, and how they change the match."
              />
            </label>
            <label className="space-y-2">
              <span className="text-xs font-black uppercase tracking-wider text-slate-500">General Comments</span>
              <textarea
                value={data.generalComments}
                onChange={event => updateData({ generalComments: event.target.value })}
                className="min-h-[180px] w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-500"
                placeholder="Anything else we should know about this team in this match."
              />
            </label>
          </div>
        </SectionCard>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto]">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/80 px-5 py-4">
            <div className="text-xs font-black uppercase tracking-wider text-slate-500">Current Defense Metric</div>
            <div className="mt-1 text-4xl font-black text-white">{formatDefensePercent(data.defenseMetric)}</div>
            <div className="mt-2 text-sm text-slate-400">Stored as {data.defenseMetric.toFixed(4)}</div>
          </div>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="rounded-3xl bg-gradient-to-r from-emerald-600 to-cyan-600 px-8 py-6 text-xl font-black text-white shadow-xl transition-all hover:from-emerald-500 hover:to-cyan-500 disabled:opacity-50"
          >
            {isSubmitting ? 'SAVING DEFENSE ENTRY…' : isEditing ? 'UPDATE DEFENSE ENTRY' : 'SUBMIT DEFENSE ENTRY'}
          </button>
        </div>
      </div>

      {showQr && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-sm">
          <div className="relative flex w-full max-w-sm flex-col items-center rounded-3xl bg-white p-8">
            <button
              type="button"
              onClick={() => setShowQr(false)}
              className="absolute right-4 top-4 rounded-full bg-slate-100 p-2 text-slate-700 hover:bg-slate-200"
            >
              <Download className="h-4 w-4 rotate-45" />
            </button>
            <h3 className="mb-3 text-xl font-black text-slate-900">Defense Offline QR Export</h3>
            <p className="mb-5 text-center text-sm text-slate-600">
              Scan this from an admin device if internet access is unavailable.
            </p>
            <QRCodeSVG
              value={compressMatchDefenseData(
                normalizeMatchDefenseScoutingV1({
                  ...data,
                  scoutName: archiveUsername || data.scoutName,
                  matchKey: buildMatchKeyV3(data.matchType, data.matchNumber)
                })
              )}
              size={280}
              includeMargin
            />
            <div className="mt-5 text-center text-xs font-mono text-slate-500">
              {data.matchKey.toUpperCase()} / Team {data.teamNumber || 'TBD'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
