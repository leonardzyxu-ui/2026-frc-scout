import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { MatchScoutingV2, initialMatchScoutingV2 } from '../types';
import NumberInput from '../components/NumberInput';
import { QRCodeSVG } from 'qrcode.react';
import { compressMatchData } from '../utils/qrCompression';
import { QrCode, AlertTriangle, ArrowLeft, RefreshCw } from 'lucide-react';
import { MathEngine, TBAMatch } from '../utils/mathEngine';
import { TBA_API_KEY } from '../config';
import { DEFAULT_EVENT_KEY, getPersistentDeviceId, getSharedEventDocRef, getStoredEventKey } from '../utils/sharedEventState';
import { SCOUT_ASSIGNMENTS } from '../utils/scoutAssignments';
import { getMatchDocId, writeMatchScoutingRecord } from '../utils/scoutingWrites';
import { buildScoutDraftKey, deleteScoutDraft, getScoutDraft, setScoutDraft } from '../utils/scoutDrafts';
import { getScoutArchiveUsername, setScoutArchiveUsername, upsertMatchArchiveRecord } from '../utils/scoutArchive';
import ScoutUsernameGate from '../components/ScoutUsernameGate';

const MATCH_SCOUT_EVENT_KEY_STORAGE = 'match_scout_event_key';
const MATCH_SCOUT_ASSIGNED_SCOUT_STORAGE = 'match_scout_assigned_scout';
const MATCH_SCOUT_MATCH_TYPE_STORAGE = 'match_scout_match_type';
const MATCH_SCOUT_MATCH_NUMBER_STORAGE = 'match_scout_match_number';
const MATCH_EDIT_STORAGE_KEY = 'edit_match_data';
const SUBSTITUTE_SCOUTS = ['Charlotte', 'Matilda', 'Scarlett'] as const;

type MatchType = MatchScoutingV2['matchType'];
type SubstituteScoutName = (typeof SUBSTITUTE_SCOUTS)[number];

interface MatchScoutDraftPayload {
  data: MatchScoutingV2;
  matchNumber: number;
  hasLocalEventOverride: boolean;
}

const sanitizeEventKey = (value: string) => value.toUpperCase().replace(/\s+/g, '');

const buildMatchKey = (matchType: MatchType, matchNumber: number) =>
  `${matchType === 'Practice' ? 'pm' : 'qm'}${Math.max(1, matchNumber)}`;

const parseMatchNumber = (matchKey: string) => {
  const match = matchKey.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 1;
};

const parseMatchType = (matchKey: string): MatchType =>
  matchKey.toLowerCase().startsWith('pm') ? 'Practice' : 'Qualification';

const getShortMatchKey = (match: TBAMatch) => match.key.split('_')[1]?.toLowerCase() || '';

const getStoredMatchScoutEventKey = () =>
  localStorage.getItem(MATCH_SCOUT_EVENT_KEY_STORAGE) || getStoredEventKey() || DEFAULT_EVENT_KEY;

const getStoredAssignedScout = () => localStorage.getItem(MATCH_SCOUT_ASSIGNED_SCOUT_STORAGE) || '';

const getStoredMatchType = (): MatchType => {
  const stored = localStorage.getItem(MATCH_SCOUT_MATCH_TYPE_STORAGE);
  return stored === 'Practice' ? 'Practice' : 'Qualification';
};

const getStoredMatchNumber = () => {
  const stored = parseInt(localStorage.getItem(MATCH_SCOUT_MATCH_NUMBER_STORAGE) || '1', 10);
  return Number.isFinite(stored) && stored > 0 ? stored : 1;
};

const hydrateMatchRecord = (raw: Partial<MatchScoutingV2>): MatchScoutingV2 => {
  const legacyRaw = raw as Partial<MatchScoutingV2> & {
    cardStatus?: 'None' | 'Yellow' | 'Red' | 'Both';
  };
  const matchType = raw.matchType || parseMatchType(raw.matchKey || initialMatchScoutingV2.matchKey);
  const assignedScoutName = raw.assignedScoutName || raw.scoutName || '';
  const yellowCard =
    raw.yellowCard ??
    (legacyRaw.cardStatus === 'Yellow' || legacyRaw.cardStatus === 'Both');
  const redCard =
    raw.redCard ??
    (legacyRaw.cardStatus === 'Red' || legacyRaw.cardStatus === 'Both');

  return {
    ...initialMatchScoutingV2,
    ...raw,
    eventKey: raw.eventKey || initialMatchScoutingV2.eventKey,
    matchType,
    assignedScoutName,
    scoutName: raw.scoutName || assignedScoutName,
    assignedSlot: raw.assignedSlot || '',
    substituteScoutName: raw.substituteScoutName || '',
    matchKey: raw.matchKey || buildMatchKey(matchType, 1),
    teamNumber: raw.teamNumber || '',
    alliance: raw.alliance || '',
    totalCycles: raw.totalCycles ?? 0,
    mainPointContributor: raw.mainPointContributor ?? false,
    yellowCard,
    yellowCardReason: raw.yellowCardReason || '',
    redCard,
    redCardReason: raw.redCardReason || '',
    climbLevel: raw.climbLevel || 'None',
    comments: raw.comments || '',
    deviceId: raw.deviceId || getPersistentDeviceId()
  };
};

export default function MatchScoutView() {
  const navigate = useNavigate();
  const initialEventKey = sanitizeEventKey(getStoredMatchScoutEventKey());
  const initialAssignedScoutName = getStoredAssignedScout();
  const initialMatchType = getStoredMatchType();
  const initialMatchNumber = getStoredMatchNumber();
  const sharedEventDefault = sanitizeEventKey(getStoredEventKey());

  const [data, setData] = useState<MatchScoutingV2>(() => ({
    ...initialMatchScoutingV2,
    deviceId: getPersistentDeviceId(),
    eventKey: initialEventKey,
    matchType: initialMatchType,
    matchKey: buildMatchKey(initialMatchType, initialMatchNumber),
    assignedScoutName: initialAssignedScoutName,
    scoutName: initialAssignedScoutName
  }));
  const [matchNumber, setMatchNumber] = useState(initialMatchNumber);
  const [sharedEventKey, setSharedEventKey] = useState(sharedEventDefault);
  const [hasLocalEventOverride, setHasLocalEventOverride] = useState(initialEventKey !== sharedEventDefault);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [eventMatches, setEventMatches] = useState<TBAMatch[]>([]);
  const [scheduledTeams, setScheduledTeams] = useState<string[]>([]);
  const [isLoadingSchedule, setIsLoadingSchedule] = useState(false);
  const [assignmentWarning, setAssignmentWarning] = useState('');
  const [teamWarning, setTeamWarning] = useState('');
  const [notification, setNotification] = useState<{ message: string; type: 'error' | 'success' } | null>(null);
  const [bootModeResolved, setBootModeResolved] = useState(false);
  const [isDraftHydrated, setIsDraftHydrated] = useState(false);
  const [editContextId, setEditContextId] = useState<string | null>(null);
  const [originalDocId, setOriginalDocId] = useState<string | null>(null);
  const [archiveUsername, setArchiveUsernameState] = useState('');
  const [pendingArchiveUsername, setPendingArchiveUsername] = useState('');
  const [isArchiveUsernameResolved, setIsArchiveUsernameResolved] = useState(false);
  const skipNextDraftSaveRef = useRef(false);

  const selectedAssignment = useMemo(
    () => SCOUT_ASSIGNMENTS.find(assignment => assignment.name === data.assignedScoutName) || null,
    [data.assignedScoutName]
  );

  const updateData = (updates: Partial<MatchScoutingV2>) => {
    setData(prev => ({ ...prev, ...updates }));
  };

  const showNotification = (message: string, type: 'error' | 'success') => {
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
        console.error('Failed to hydrate scout archive username', error);
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
      console.error('Failed to save scout archive username', error);
      showNotification('Unable to save the scout username on this device.', 'error');
    }
  };

  useEffect(() => {
    const editDataStr = localStorage.getItem(MATCH_EDIT_STORAGE_KEY);
    if (!editDataStr) {
      setBootModeResolved(true);
      return;
    }

    try {
      const editData = hydrateMatchRecord(JSON.parse(editDataStr));
      setData(editData);
      setMatchNumber(parseMatchNumber(editData.matchKey));
      setHasLocalEventOverride(true);
      setIsEditing(true);
      setEditContextId(`${editData.eventKey}:${editData.matchKey}:${editData.teamNumber}`);
      setOriginalDocId(getMatchDocId(editData));
    } catch (error) {
      console.error('Failed to parse edit data', error);
    } finally {
      localStorage.removeItem(MATCH_EDIT_STORAGE_KEY);
      setBootModeResolved(true);
    }
  }, []);

  const activeDraftKey = useMemo(() => {
    if (!bootModeResolved) return '';

    if (isEditing) {
      const contextId =
        editContextId || `${data.eventKey}:${data.matchKey}:${data.teamNumber || 'pending'}`;
      return buildScoutDraftKey('match', 'edit', contextId);
    }

    return buildScoutDraftKey('match', 'new', data.eventKey);
  }, [bootModeResolved, data.eventKey, data.matchKey, data.teamNumber, editContextId, isEditing]);

  useEffect(() => {
    if (!bootModeResolved || !activeDraftKey) return;

    let cancelled = false;

    const hydrateDraft = async () => {
      try {
        const draft = await getScoutDraft<MatchScoutDraftPayload>(activeDraftKey);
        if (cancelled || !draft) {
          return;
        }

        setData(hydrateMatchRecord(draft.data.data));
        setMatchNumber(draft.data.matchNumber);
        setHasLocalEventOverride(draft.data.hasLocalEventOverride);
      } catch (error) {
        console.error('Failed to hydrate match scout draft', error);
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
  }, [activeDraftKey, bootModeResolved]);

  useEffect(() => {
    if (!bootModeResolved || !isDraftHydrated || !activeDraftKey) return;

    if (skipNextDraftSaveRef.current) {
      skipNextDraftSaveRef.current = false;
      return;
    }

    void setScoutDraft(
      activeDraftKey,
      'match',
      isEditing ? 'edit' : 'new',
      isEditing ? editContextId || activeDraftKey : data.eventKey,
      {
        data,
        matchNumber,
        hasLocalEventOverride
      }
    );
  }, [
    activeDraftKey,
    bootModeResolved,
    data,
    editContextId,
    hasLocalEventOverride,
    isDraftHydrated,
    isEditing,
    matchNumber
  ]);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      getSharedEventDocRef(),
      (snapshot) => {
        if (!snapshot.exists()) return;

        const nextSharedEventKey = sanitizeEventKey(snapshot.data().eventKey || getStoredEventKey() || DEFAULT_EVENT_KEY);
        setSharedEventKey(nextSharedEventKey);

        if (isEditing || hasLocalEventOverride) return;

        localStorage.setItem(MATCH_SCOUT_EVENT_KEY_STORAGE, nextSharedEventKey);
        setData(prev => ({
          ...prev,
          eventKey: nextSharedEventKey
        }));
      },
      (error) => {
        console.error('Failed to sync shared event key for Match Scout', error);
      }
    );

    return () => unsubscribe();
  }, [hasLocalEventOverride, isEditing]);

  useEffect(() => {
    if (isEditing) return;

    localStorage.setItem(MATCH_SCOUT_EVENT_KEY_STORAGE, data.eventKey);
    localStorage.setItem(MATCH_SCOUT_ASSIGNED_SCOUT_STORAGE, data.assignedScoutName);
    localStorage.setItem(MATCH_SCOUT_MATCH_TYPE_STORAGE, data.matchType);
    localStorage.setItem(MATCH_SCOUT_MATCH_NUMBER_STORAGE, String(matchNumber));
  }, [data.assignedScoutName, data.eventKey, data.matchType, isEditing, matchNumber]);

  useEffect(() => {
    if (!isEditing) {
      setData(prev => ({
        ...prev,
        matchKey: buildMatchKey(prev.matchType, matchNumber)
      }));
    }
  }, [isEditing, matchNumber]);

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

    const generatedMatchKey = buildMatchKey(data.matchType, matchNumber);
    const assignment = selectedAssignment;

    setData(prev => ({
      ...prev,
      matchKey: generatedMatchKey
    }));

    if (!assignment) {
      setAssignmentWarning('');
      setData(prev => ({
        ...prev,
        assignedSlot: '',
        scoutName: prev.substituteScoutName || prev.assignedScoutName
      }));
      return;
    }

    const scheduledMatch = eventMatches.find(match => getShortMatchKey(match) === generatedMatchKey.toLowerCase());
    const allianceTeamKeys =
      assignment.alliance === 'Red'
        ? scheduledMatch?.alliances.red.team_keys || []
        : scheduledMatch?.alliances.blue.team_keys || [];
    const assignedTeamKey = allianceTeamKeys[assignment.positionIndex] || '';
    const assignedTeamNumber = assignedTeamKey.replace('frc', '');

    setData(prev => ({
      ...prev,
      matchKey: generatedMatchKey,
      assignedSlot: assignment.slotLabel,
      scoutName: prev.substituteScoutName || assignment.name,
      alliance: assignment.alliance,
      teamNumber: assignedTeamNumber
    }));

    if (!scheduledMatch) {
      setAssignmentWarning(`No scheduled ${generatedMatchKey.toUpperCase()} was found for ${data.eventKey}. Team number remains editable.`);
      return;
    }

    if (!assignedTeamNumber) {
      setAssignmentWarning(`No team is published yet for ${assignment.slotLabel} in ${generatedMatchKey.toUpperCase()}. Team number remains editable.`);
      return;
    }

    setAssignmentWarning('');
  }, [data.eventKey, data.matchType, eventMatches, isEditing, matchNumber, selectedAssignment]);

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

  const handleAssignedScoutChange = (assignedScoutName: string) => {
    const assignment = SCOUT_ASSIGNMENTS.find(option => option.name === assignedScoutName);
    updateData({
      assignedScoutName,
      assignedSlot: assignment?.slotLabel || '',
      scoutName: data.substituteScoutName || assignedScoutName
    });
  };

  const handleMatchTypeChange = (matchType: MatchType) => {
    updateData({
      matchType,
      matchKey: buildMatchKey(matchType, matchNumber)
    });
  };

  const handleEventKeyChange = (value: string) => {
    const nextEventKey = sanitizeEventKey(value);
    setHasLocalEventOverride(nextEventKey !== sharedEventKey);
    updateData({ eventKey: nextEventKey || DEFAULT_EVENT_KEY });
  };

  const handleSubstituteSelect = (substituteName: SubstituteScoutName) => {
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
    if (!archiveUsername) return showNotification('Please set a scout username for this device first.', 'error');
    if (!data.assignedScoutName) return showNotification('Please select the assigned scout.', 'error');
    if (!matchNumber) return showNotification('Please enter a valid match number.', 'error');
    if (!data.teamNumber) return showNotification('Please enter the Team Number.', 'error');
    if (data.eventKey !== 'TEST' && scheduledTeams.length > 0 && !scheduledTeams.includes(data.teamNumber)) {
      return showNotification(`Team ${data.teamNumber} is not scheduled for this event. Please verify the team number.`, 'error');
    }
    if (!data.alliance) return showNotification('Please confirm the alliance side.', 'error');
    if (data.yellowCard && !data.yellowCardReason.trim()) {
      return showNotification('Please explain why they received a yellow card.', 'error');
    }
    if (data.redCard && !data.redCardReason.trim()) {
      return showNotification('Please explain why they received a red card.', 'error');
    }

    setIsSubmitting(true);
    try {
      const payload: MatchScoutingV2 = {
        ...data,
        matchKey: buildMatchKey(data.matchType, matchNumber),
        scoutName: data.substituteScoutName || data.assignedScoutName,
        assignedScoutName: data.assignedScoutName,
        assignedSlot: data.assignedSlot,
        substituteScoutName: data.substituteScoutName || '',
        timestamp: Date.now()
      };

      const docId = getMatchDocId(payload);
      const existingDoc = await getDoc(doc(db, 'events', payload.eventKey, 'matchScouting', docId));
      if (existingDoc.exists()) {
        const existingData = existingDoc.data() as MatchScoutingV2;
        if (isEditing || !originalDocId || originalDocId === docId) {
          const history = existingData.editHistory || [];
          payload.editHistory = [
            ...history,
            {
              timestamp: Date.now(),
              editor: payload.scoutName,
              changes: 'Match updated by scout'
            }
          ];
        }
      }

      const writeResult = await writeMatchScoutingRecord(payload, {
        mode: isEditing && (!!originalDocId && originalDocId === docId) ? 'replace' : 'strict'
      });

      if (writeResult.outcome === 'duplicate') {
        showNotification('This exact match record already exists.', 'error');
        return;
      }

      if (writeResult.outcome === 'conflict') {
        showNotification('A conflicting match record already exists. Resolve it in Admin Raw Data.', 'error');
        return;
      }

      await upsertMatchArchiveRecord(payload, archiveUsername, 'local_submit');

      await deleteScoutDraft(activeDraftKey);
      skipNextDraftSaveRef.current = true;

      showNotification(isEditing ? 'Match updated successfully!' : 'Match submitted successfully!', 'success');

      if (isEditing) {
        setTimeout(() => navigate('/history'), 1500);
        return;
      }

      const nextMatchNumber = matchNumber + 1;
      setMatchNumber(nextMatchNumber);
      setData({
        ...initialMatchScoutingV2,
        deviceId: payload.deviceId,
        eventKey: payload.eventKey,
        matchType: payload.matchType,
        matchKey: buildMatchKey(payload.matchType, nextMatchNumber),
        assignedScoutName: payload.assignedScoutName,
        assignedSlot: payload.assignedSlot,
        scoutName: payload.assignedScoutName,
        substituteScoutName: '',
        totalCycles: 0,
        yellowCard: false,
        yellowCardReason: '',
        redCard: false,
        redCardReason: ''
      });

      window.scrollTo(0, 0);
    } catch (error) {
      console.error('Error submitting match:', error);
      showNotification('Failed to submit match. Please check your connection.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 md:p-6 space-y-8 pb-24 bg-slate-950 text-white">
      {notification && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-full font-bold shadow-2xl transition-all animate-in fade-in slide-in-from-top-4 ${
          notification.type === 'error' ? 'bg-red-500 text-white' : 'bg-emerald-500 text-white'
        }`}>
          {notification.message}
        </div>
      )}

      {isArchiveUsernameResolved && !archiveUsername && (
        <ScoutUsernameGate
          pendingUsername={pendingArchiveUsername}
          setPendingUsername={setPendingArchiveUsername}
          onSave={() => void handleArchiveUsernameSave()}
        />
      )}

      <div className="flex justify-between items-center border-b border-white/10 pb-4">
        <div>
          <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-500">
            {isEditing ? 'EDIT MATCH' : 'MATCH SCOUT'}
          </h1>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Guided Assignment Scouting Workflow</p>
        </div>
        <button
          onClick={() => navigate('/')}
          className="bg-slate-800 px-4 py-2 rounded-lg font-bold text-sm text-slate-300 hover:bg-slate-700"
        >
          <ArrowLeft className="w-4 h-4 inline mr-2" />
          Back
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-5">
        <h2 className="text-xl font-black text-slate-300 border-b border-slate-800 pb-2">ASSIGNMENT</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Event Key</label>
            <input
              type="text"
              value={data.eventKey}
              disabled={isEditing}
              onChange={(e) => handleEventKeyChange(e.target.value)}
              className={`w-full bg-black/50 border border-slate-700 rounded-xl p-3 outline-none uppercase ${isEditing ? 'opacity-50 cursor-not-allowed' : 'focus:border-emerald-500 transition'}`}
            />
            <p className="mt-2 text-[11px] font-bold tracking-wide text-slate-500 uppercase">
              Default event is {DEFAULT_EVENT_KEY}. Local override only.
            </p>
          </div>
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Assigned Scout</label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {SCOUT_ASSIGNMENTS.map((assignment) => (
                <button
                  key={assignment.name}
                  type="button"
                  disabled={isEditing}
                  onClick={() => handleAssignedScoutChange(assignment.name)}
                  className={`py-3 rounded-xl font-black text-sm transition-all ${
                    data.assignedScoutName === assignment.name
                      ? 'bg-cyan-600 text-white shadow-inner'
                      : 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700'
                  } ${isEditing ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {assignment.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Match Type</label>
            <div className="flex rounded-xl overflow-hidden border border-slate-700 h-12 bg-black/30">
              {(['Practice', 'Qualification'] as MatchType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  disabled={isEditing}
                  onClick={() => handleMatchTypeChange(type)}
                  className={`flex-1 font-black tracking-widest transition-all duration-200 ${
                    data.matchType === type
                      ? 'bg-purple-600 text-white shadow-inner'
                      : 'text-slate-400 hover:bg-slate-800'
                  } ${isEditing ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {type.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Match Number</label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isEditing}
                onClick={() => setMatchNumber(prev => Math.max(1, prev - 1))}
                className={`w-10 h-10 bg-slate-800 rounded-lg font-black text-xl active:scale-95 ${isEditing ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                -
              </button>
              <NumberInput
                value={matchNumber}
                onChange={(value) => setMatchNumber(Math.max(1, value))}
                className={`flex-1 h-10 bg-black/50 border border-slate-600 rounded-lg text-xl font-black font-mono text-center outline-none ${isEditing ? 'opacity-50 cursor-not-allowed' : 'focus:border-emerald-500'}`}
              />
              <button
                type="button"
                disabled={isEditing}
                onClick={() => setMatchNumber(prev => prev + 1)}
                className={`w-10 h-10 bg-emerald-600 rounded-lg font-black text-xl active:scale-95 ${isEditing ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                +
              </button>
            </div>
          </div>

          <div className="bg-black/30 border border-slate-700 rounded-xl p-3">
            <div className="text-xs font-bold text-slate-500 uppercase">Generated Match Key</div>
            <div className="text-2xl font-black text-white font-mono mt-1">{data.matchKey.toUpperCase()}</div>
            <div className="text-[11px] font-bold text-slate-500 uppercase mt-2">
              Slot: {data.assignedSlot || 'Select scout'}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {SUBSTITUTE_SCOUTS.map((substituteName) => (
            <button
              key={substituteName}
              type="button"
              disabled={isEditing || !data.assignedScoutName}
              onClick={() => handleSubstituteSelect(substituteName)}
              className={`px-4 py-2 rounded-xl font-black text-sm transition-all ${
                data.substituteScoutName === substituteName
                  ? 'bg-amber-600 text-white'
                  : 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700'
              } ${isEditing ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              Substitute: {substituteName}
            </button>
          ))}
          <div className="text-sm font-bold text-slate-400">
            Actual scout: <span className="text-white">{data.scoutName || 'Unassigned'}</span>
          </div>
          {isLoadingSchedule && (
            <div className="text-sm font-bold text-cyan-300 flex items-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin" />
              Loading schedule...
            </div>
          )}
        </div>

        {assignmentWarning && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-200">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            {assignmentWarning}
          </div>
        )}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4">
        <h2 className="text-xl font-black text-slate-300 border-b border-slate-800 pb-2">MATCH META</h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Alliance</label>
            <div className="flex rounded-xl overflow-hidden border border-slate-700 h-12 bg-black/30">
              <button
                type="button"
                disabled={isEditing}
                onClick={() => updateData({ alliance: 'Red' })}
                className={`flex-1 font-black tracking-widest transition-all duration-200 ${
                  data.alliance === 'Red'
                    ? 'bg-red-600 text-white shadow-inner'
                    : 'text-red-400/50 hover:bg-red-900/20'
                } ${isEditing ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                RED
              </button>
              <div className="w-px bg-slate-700" />
              <button
                type="button"
                disabled={isEditing}
                onClick={() => updateData({ alliance: 'Blue' })}
                className={`flex-1 font-black tracking-widest transition-all duration-200 ${
                  data.alliance === 'Blue'
                    ? 'bg-blue-600 text-white shadow-inner'
                    : 'text-blue-400/50 hover:bg-blue-900/20'
                } ${isEditing ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                BLUE
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Team Number</label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={data.teamNumber}
              disabled={isEditing}
              onChange={(e) => {
                const val = e.target.value;
                if (/^\d*$/.test(val)) updateData({ teamNumber: val });
              }}
              className={`w-full bg-black/50 border rounded-xl p-3 outline-none transition font-mono font-bold ${
                teamWarning
                  ? 'border-amber-500 focus:border-amber-400'
                  : 'border-slate-700 focus:border-emerald-500'
              } ${isEditing ? 'opacity-50 cursor-not-allowed' : ''}`}
            />
            {teamWarning && (
              <div className="flex items-center gap-1 mt-2 text-amber-400 text-xs font-bold animate-in fade-in">
                <AlertTriangle className="w-3 h-3" />
                {teamWarning}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-6">
        <h2 className="text-xl font-black text-slate-300 border-b border-slate-800 pb-2">OBJECTIVE SNAPSHOT</h2>

        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Total Number of Cycles per Match</label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => updateData({ totalCycles: Math.max(0, data.totalCycles - 1) })}
              className="w-10 h-10 bg-slate-800 rounded-lg font-black text-xl active:scale-95"
            >
              -
            </button>
            <NumberInput
              value={data.totalCycles}
              onChange={(value) => updateData({ totalCycles: Math.max(0, value) })}
              className="flex-1 h-10 bg-black/50 border border-slate-600 rounded-lg text-xl font-black font-mono text-center outline-none focus:border-emerald-500"
            />
            <button
              type="button"
              onClick={() => updateData({ totalCycles: data.totalCycles + 1 })}
              className="w-10 h-10 bg-emerald-600 rounded-lg font-black text-xl active:scale-95"
              aria-label="Add cycle"
            >
              +
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Main Point Contributor</label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'YES', value: true },
              { label: 'NO', value: false }
            ].map(option => (
              <button
                key={option.label}
                type="button"
                onClick={() => updateData({ mainPointContributor: option.value })}
                className={`py-3 rounded-xl font-black text-sm transition-all ${
                  data.mainPointContributor === option.value
                    ? 'bg-emerald-600 text-white shadow-inner'
                    : 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Cards</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() =>
                updateData({
                  yellowCard: !data.yellowCard,
                  yellowCardReason: data.yellowCard ? '' : data.yellowCardReason
                })
              }
              className={`py-3 rounded-xl font-black text-sm transition-all ${
                data.yellowCard
                  ? 'bg-yellow-500 text-slate-950 shadow-inner'
                  : 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700'
              }`}
            >
              YELLOW CARD
            </button>
            <button
              type="button"
              onClick={() =>
                updateData({
                  redCard: !data.redCard,
                  redCardReason: data.redCard ? '' : data.redCardReason
                })
              }
              className={`py-3 rounded-xl font-black text-sm transition-all ${
                data.redCard
                  ? 'bg-red-600 text-white shadow-inner'
                  : 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700'
              }`}
            >
              RED CARD
            </button>
          </div>

          {data.yellowCard && (
            <div>
              <label className="block text-xs font-bold text-yellow-300 uppercase mb-1">Why did they get a yellow card?</label>
              <input
                type="text"
                value={data.yellowCardReason}
                onChange={(e) => updateData({ yellowCardReason: e.target.value })}
                className="w-full bg-black/50 border border-yellow-500/40 rounded-xl p-3 outline-none focus:border-yellow-400 transition"
                placeholder="Reason for yellow card"
              />
            </div>
          )}

          {data.redCard && (
            <div>
              <label className="block text-xs font-bold text-red-300 uppercase mb-1">Why did they get a red card?</label>
              <input
                type="text"
                value={data.redCardReason}
                onChange={(e) => updateData({ redCardReason: e.target.value })}
                className="w-full bg-black/50 border border-red-500/40 rounded-xl p-3 outline-none focus:border-red-400 transition"
                placeholder="Reason for red card"
              />
            </div>
          )}
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-6">
        <h2 className="text-xl font-black text-slate-300 border-b border-slate-800 pb-2">SUBJECTIVE RATING</h2>

        <div>
          <div className="flex justify-between mb-2">
            <label className="text-xs font-bold text-slate-500 uppercase">Auto Fluidity</label>
            <span className="text-xs font-black text-emerald-400">{data.autoFluidity} / 10</span>
          </div>
          <input
            type="range"
            min="0"
            max="10"
            value={data.autoFluidity}
            onChange={(e) => updateData({ autoFluidity: parseInt(e.target.value, 10) })}
            className="w-full accent-emerald-500"
          />
          <div className="flex justify-between text-[10px] text-slate-500 font-bold uppercase mt-1">
            <span>Terrible</span>
            <span>Perfect</span>
          </div>
        </div>

        <div>
          <div className="flex justify-between mb-2">
            <label className="text-xs font-bold text-slate-500 uppercase">Teleop Fluidity</label>
            <span className="text-xs font-black text-emerald-400">{data.teleopFluidity} / 10</span>
          </div>
          <input
            type="range"
            min="0"
            max="10"
            value={data.teleopFluidity}
            onChange={(e) => updateData({ teleopFluidity: parseInt(e.target.value, 10) })}
            className="w-full accent-emerald-500"
          />
          <div className="flex justify-between text-[10px] text-slate-500 font-bold uppercase mt-1">
            <span>Terrible</span>
            <span>Perfect</span>
          </div>
        </div>

        <div>
          <div className="flex justify-between mb-2">
            <label className="text-xs font-bold text-slate-500 uppercase">Driver performance under pressure</label>
            <span className="text-xs font-black text-emerald-400">{data.driverPressure} / 10</span>
          </div>
          <input
            type="range"
            min="0"
            max="10"
            value={data.driverPressure}
            onChange={(e) => updateData({ driverPressure: parseInt(e.target.value, 10) })}
            className="w-full accent-emerald-500"
          />
          <div className="flex justify-between text-[10px] text-slate-500 font-bold uppercase mt-1">
            <span>Terrible</span>
            <span>Perfect</span>
          </div>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4">
        <h2 className="text-xl font-black text-slate-300 border-b border-slate-800 pb-2">DEFENSE</h2>

        <button
          type="button"
          onClick={() => updateData({ playedDefense: !data.playedDefense })}
          className={`w-full p-4 rounded-xl font-black text-lg transition-all ${data.playedDefense ? 'bg-red-600 text-white' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}
        >
          PLAYED DEFENSE?
        </button>

        {data.playedDefense && (
          <div className="space-y-6 pt-4 border-t border-slate-800 animate-in fade-in slide-in-from-top-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Number of times</label>
                <div className="flex items-center gap-2">
                  <button onClick={() => updateData({ defenseInstances: Math.max(0, data.defenseInstances - 1) })} className="w-10 h-10 bg-slate-800 rounded-lg font-black text-xl active:scale-95">-</button>
                  <NumberInput
                    value={data.defenseInstances}
                    onChange={(val) => updateData({ defenseInstances: val })}
                    className="flex-1 h-10 bg-black/50 border border-slate-600 rounded-lg text-xl font-black font-mono text-center outline-none focus:border-red-500"
                  />
                  <button onClick={() => updateData({ defenseInstances: data.defenseInstances + 1 })} className="w-10 h-10 bg-red-600 rounded-lg font-black text-xl active:scale-95">+</button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Duration</label>
                <select
                  value={data.defenseDuration}
                  onChange={(e) => updateData({ defenseDuration: e.target.value })}
                  className="w-full h-10 bg-black/50 border border-slate-600 rounded-lg text-xl font-black font-mono text-center outline-none focus:border-red-500"
                >
                  <option value="<1">&lt;1</option>
                  <option value="<2">&lt;2</option>
                  <option value="<3">&lt;3</option>
                  <option value="<4">&lt;4</option>
                  <option value="<5">&lt;5</option>
                  <option value="<6">&lt;6</option>
                </select>
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Effectiveness</label>
                <span className="text-xs font-black text-red-400">{data.defenseEffectiveness} / 10</span>
              </div>
              <input
                type="range"
                min="0"
                max="10"
                value={data.defenseEffectiveness}
                onChange={(e) => updateData({ defenseEffectiveness: parseInt(e.target.value, 10) })}
                className="w-full accent-red-500"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-bold uppercase mt-1">
                <span>Ineffective</span>
                <span>Effective</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-6">
        <div>
          <h2 className="text-xl font-black text-slate-300 border-b border-slate-800 pb-2 mb-4">ENDGAME</h2>
          <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Climb Level</label>
          <div className="grid grid-cols-4 gap-2">
            {(['None', 'L1', 'L2', 'L3'] as MatchScoutingV2['climbLevel'][]).map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => updateData({ climbLevel: level })}
                className={`py-3 rounded-xl font-black text-xs transition-all ${
                  data.climbLevel === level
                    ? 'bg-emerald-600 text-white shadow-inner'
                    : 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700'
                }`}
              >
                {level.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-xl font-black text-red-400 border-b border-slate-800 pb-2 mb-4">CRITICAL FAILURES</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <button
              type="button"
              onClick={() => updateData({ robotDied: !data.robotDied })}
              className={`p-3 rounded-xl font-black text-xs transition-all ${data.robotDied ? 'bg-red-600 text-white' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}
            >
              ROBOT DIED
            </button>
            <button
              type="button"
              onClick={() => updateData({ commsLost: !data.commsLost })}
              className={`p-3 rounded-xl font-black text-xs transition-all ${data.commsLost ? 'bg-orange-600 text-white' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}
            >
              COMMS LOST
            </button>
            <button
              type="button"
              onClick={() => updateData({ mechanismBroke: !data.mechanismBroke })}
              className={`p-3 rounded-xl font-black text-xs transition-all ${data.mechanismBroke ? 'bg-yellow-600 text-white' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}
            >
              MECH BROKE
            </button>
            <button
              type="button"
              onClick={() => updateData({ tippedOver: !data.tippedOver })}
              className={`p-3 rounded-xl font-black text-xs transition-all ${data.tippedOver ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}
            >
              TIPPED OVER
            </button>
          </div>

          {(data.robotDied || data.commsLost || data.mechanismBroke || data.tippedOver) && (
            <div className="animate-in fade-in slide-in-from-top-4 mt-4">
              <label className="block text-xs font-bold text-red-400 uppercase mb-1">Failure Reason</label>
              <input
                type="text"
                value={data.failureReason}
                onChange={(e) => updateData({ failureReason: e.target.value })}
                className="w-full bg-black/50 border border-red-900/50 rounded-xl p-3 outline-none focus:border-red-500 transition"
                placeholder="What happened?"
              />
            </div>
          )}
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4">
        <h2 className="text-xl font-black text-slate-300 border-b border-slate-800 pb-2">NOTES</h2>
        <textarea
          value={data.notes}
          onChange={(e) => updateData({ notes: e.target.value })}
          className="w-full bg-black/50 border border-slate-700 rounded-xl p-3 outline-none focus:border-emerald-500 transition min-h-[100px]"
          placeholder="Any other observations?"
        />
      </div>

      <div className="grid grid-cols-4 gap-4">
        <button
          type="button"
          onClick={() => setShowQR(true)}
          className="col-span-1 py-6 bg-slate-800 hover:bg-slate-700 rounded-2xl text-white font-black shadow-xl active:scale-95 transition-all flex items-center justify-center"
        >
          <QrCode className="w-8 h-8" />
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="col-span-3 py-6 bg-gradient-to-r from-emerald-600 to-cyan-600 rounded-2xl text-2xl font-black shadow-xl active:scale-95 text-white transition-all disabled:opacity-50"
        >
          {isSubmitting ? 'SUBMITTING...' : (isEditing ? 'UPDATE MATCH ➔' : 'SUBMIT MATCH ➔')}
        </button>
      </div>

      {showQR && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-sm p-4">
          <div className="bg-white p-8 rounded-3xl max-w-sm w-full flex flex-col items-center relative">
            <button
              onClick={() => setShowQR(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-900"
            >
              <AlertTriangle className="w-5 h-5 rotate-45" />
            </button>
            <h3 className="text-xl font-black text-slate-900 mb-4">Offline QR Export</h3>
            <p className="text-center text-sm text-slate-600 mb-6">
              Scan this code from the Admin device if internet is unavailable.
            </p>
            <div className="p-4 bg-white rounded-2xl shadow-lg">
              <QRCodeSVG
                value={compressMatchData({
                  ...data,
                  matchKey: buildMatchKey(data.matchType, matchNumber),
                  scoutName: data.substituteScoutName || data.assignedScoutName
                })}
                size={280}
                level="L"
                includeMargin
              />
            </div>
            <div className="mt-5 text-center text-xs font-mono text-slate-500 break-all">
              {buildMatchKey(data.matchType, matchNumber)} / Team {data.teamNumber || 'TBD'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
