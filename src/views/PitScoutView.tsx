import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, QrCode, Save, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useNavigate } from 'react-router-dom';
import { PitScoutingV2 } from '../types';
import {
  DEFAULT_EVENT_KEY,
  getPersistentDeviceId
} from '../utils/sharedEventState';
import { normalizePitChassisSpeed } from '../utils/pitScouting';
import { compressPitData } from '../utils/qrCompression';
import { writePitScoutingRecord } from '../utils/scoutingWrites';
import { buildScoutDraftKey, deleteScoutDraft, getScoutDraft, setScoutDraft } from '../utils/scoutDrafts';
import {
  getScoutArchiveUsername,
  setScoutArchiveUsername,
  updateScoutArchiveRecordSyncState,
  upsertPitArchiveRecord
} from '../utils/scoutArchive';
import ScoutUsernameGate from '../components/ScoutUsernameGate';

const PIT_EDIT_STORAGE_KEY = 'edit_pit_data';
const PIT_SCOUT_NAME_STORAGE_KEY = 'pit_scout_name';

type BallField = 'match' | 'auto' | 'teleop';

interface PitScoutDraftPayload {
  form: PitScoutingV2;
  ballFieldHistory: BallField[];
}

interface PendingPitEdit {
  eventKey: string;
  data: PitScoutingV2;
}

const getStoredPitScoutName = () => localStorage.getItem(PIT_SCOUT_NAME_STORAGE_KEY) || '';

const createInitialPitForm = (scoutName = getStoredPitScoutName()): PitScoutingV2 => ({
  teamNumber: '',
  teamName: '',
  scoutName,
  robotBaseType: '',
  isWcpBot: false,
  isKitBot: false,
  turretCount: '',
  customTurretCount: '',
  canUseHopper: false,
  hopperCapacity: 0,
  canClimbL1: false,
  canClimbL2: false,
  canClimbL3: false,
  noClimbCapability: false,
  expectedHubBallsPerMatch: 0,
  expectedAutoBalls: 0,
  expectedTeleopBalls: 0,
  ballsPerSecond: 0,
  shootingStyle: '',
  canCrossTrench: false,
  isBumpOnly: false,
  chassisSpeed: 0,
  chassisSpeedDistanceUnit: '',
  chassisSpeedTimeUnit: '',
  shootingFlywheelCount: 0,
  hoodAdjustable: false,
  notes: ''
});

const sanitizeDigits = (value: string) => value.replace(/\D/g, '');
const parseNonNegativeInteger = (value: string) => {
  const digits = sanitizeDigits(value);
  return digits ? parseInt(digits, 10) : 0;
};

function ChoiceButton({
  active,
  label,
  onClick,
  tone = 'emerald',
  disabled = false
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  tone?: 'emerald' | 'blue' | 'amber' | 'purple' | 'rose';
  disabled?: boolean;
}) {
  const activeClasses = {
    emerald: 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20',
    blue: 'bg-blue-600 text-white shadow-lg shadow-blue-900/20',
    amber: 'bg-amber-600 text-white shadow-lg shadow-amber-900/20',
    purple: 'bg-purple-600 text-white shadow-lg shadow-purple-900/20',
    rose: 'bg-rose-600 text-white shadow-lg shadow-rose-900/20'
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-xl px-3 py-3 text-sm font-bold transition-all ${
        active ? activeClasses[tone] : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
      } ${disabled ? 'opacity-40 cursor-not-allowed hover:bg-slate-800' : ''}`}
    >
      {label}
    </button>
  );
}

export default function PitScoutView() {
  const navigate = useNavigate();
  const [eventKey, setEventKey] = useState(() => DEFAULT_EVENT_KEY);
  const [form, setForm] = useState<PitScoutingV2>(() => createInitialPitForm());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [error, setError] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editingTeamNumber, setEditingTeamNumber] = useState('');
  const [bootModeResolved, setBootModeResolved] = useState(false);
  const [isDraftHydrated, setIsDraftHydrated] = useState(false);
  const [ballFieldHistory, setBallFieldHistory] = useState<BallField[]>([]);
  const [showQr, setShowQr] = useState(false);
  const [archiveUsername, setArchiveUsernameState] = useState('');
  const [pendingArchiveUsername, setPendingArchiveUsername] = useState('');
  const [isArchiveUsernameResolved, setIsArchiveUsernameResolved] = useState(false);
  const skipNextDraftSaveRef = useRef(false);

  const activeDraftKey = useMemo(() => {
    if (!bootModeResolved) return '';
    if (isEditing) {
      return buildScoutDraftKey('pit', 'edit', `${eventKey}:${editingTeamNumber || form.teamNumber || 'pending'}`);
    }
    return buildScoutDraftKey('pit', 'new', eventKey);
  }, [bootModeResolved, editingTeamNumber, eventKey, form.teamNumber, isEditing]);

  const updateForm = (updates: Partial<PitScoutingV2>) => {
    setForm(prev => ({ ...prev, ...updates }));
  };

  useEffect(() => {
    let cancelled = false;

    const hydrateArchiveUsername = async () => {
      try {
        const storedUsername = await getScoutArchiveUsername();
        if (cancelled) return;
        setArchiveUsernameState(storedUsername || '');
        setPendingArchiveUsername(storedUsername || '');
        if (storedUsername) {
          setForm(prev => ({
            ...prev,
            scoutName: prev.scoutName || storedUsername
          }));
        }
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
      setError('Please enter a scout username for this device.');
      return;
    }

    try {
      await setScoutArchiveUsername(normalized);
      setArchiveUsernameState(normalized);
      setPendingArchiveUsername(normalized);
      setForm(prev => ({
        ...prev,
        scoutName: prev.scoutName || normalized
      }));
      setError('');
    } catch (error) {
      console.error('Failed to save scout archive username', error);
      setError('Unable to save the scout username on this device.');
    }
  };

  useEffect(() => {
    const editDataStr = localStorage.getItem(PIT_EDIT_STORAGE_KEY);
    if (!editDataStr) {
      setBootModeResolved(true);
      return;
    }

    try {
      const parsed = JSON.parse(editDataStr) as PendingPitEdit;
      setForm({ ...createInitialPitForm(''), ...parsed.data, scoutName: parsed.data.scoutName || '' });
      setEventKey(parsed.eventKey || DEFAULT_EVENT_KEY);
      setIsEditing(true);
      setEditingTeamNumber(parsed.data.teamNumber);
    } catch (editError) {
      console.error('Failed to parse pit edit payload', editError);
    } finally {
      localStorage.removeItem(PIT_EDIT_STORAGE_KEY);
      setBootModeResolved(true);
    }
  }, []);

  useEffect(() => {
    if (!bootModeResolved || !activeDraftKey) return;

    let cancelled = false;

    const hydrateDraft = async () => {
      try {
        const draft = await getScoutDraft<PitScoutDraftPayload>(activeDraftKey);
        if (cancelled || !draft) return;

        setForm({ ...createInitialPitForm(), ...draft.data.form });
        setBallFieldHistory(draft.data.ballFieldHistory || []);
      } catch (draftError) {
        console.error('Failed to hydrate pit scout draft', draftError);
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

    void setScoutDraft(activeDraftKey, 'pit', isEditing ? 'edit' : 'new', isEditing ? editingTeamNumber || form.teamNumber : eventKey, {
      form,
      ballFieldHistory
    });
  }, [activeDraftKey, ballFieldHistory, bootModeResolved, editingTeamNumber, eventKey, form, isDraftHydrated, isEditing]);

  useEffect(() => {
    localStorage.setItem(PIT_SCOUT_NAME_STORAGE_KEY, form.scoutName || '');
  }, [form.scoutName]);

  const handleBaseTypeSelect = (robotBaseType: PitScoutingV2['robotBaseType']) => {
    updateForm({
      robotBaseType,
      isWcpBot: robotBaseType === 'WCP',
      isKitBot: robotBaseType === 'KitBot'
    });
  };

  const handleTraversalSelect = (mode: 'trench' | 'bump') => {
    updateForm({
      canCrossTrench: mode === 'trench',
      isBumpOnly: mode === 'bump'
    });
  };

  const handleNoClimbToggle = () => {
    if (form.noClimbCapability) {
      updateForm({ noClimbCapability: false });
      return;
    }

    updateForm({
      noClimbCapability: true,
      canClimbL1: false,
      canClimbL2: false,
      canClimbL3: false
    });
  };

  const handleClimbToggle = (level: 'canClimbL1' | 'canClimbL2' | 'canClimbL3') => {
    updateForm({
      noClimbCapability: false,
      [level]: !form[level]
    } as Partial<PitScoutingV2>);
  };

  const handleBallFieldChange = (field: BallField, rawValue: string) => {
    const value = parseNonNegativeInteger(rawValue);
    const nextValues = {
      match: form.expectedHubBallsPerMatch,
      auto: form.expectedAutoBalls,
      teleop: form.expectedTeleopBalls
    };
    nextValues[field] = value;

    const nextHistory = [...ballFieldHistory.filter(entry => entry !== field), field].slice(-2);

    if (nextHistory.length === 2) {
      const [olderField, newerField] = nextHistory;
      if (
        (olderField === 'auto' && newerField === 'teleop') ||
        (olderField === 'teleop' && newerField === 'auto')
      ) {
        nextValues.match = nextValues.auto + nextValues.teleop;
      } else if (
        (olderField === 'match' && newerField === 'auto') ||
        (olderField === 'auto' && newerField === 'match')
      ) {
        if (nextValues.match < nextValues.auto) {
          nextValues.match = nextValues.auto;
        }
        nextValues.teleop = nextValues.match - nextValues.auto;
      } else if (
        (olderField === 'match' && newerField === 'teleop') ||
        (olderField === 'teleop' && newerField === 'match')
      ) {
        if (nextValues.match < nextValues.teleop) {
          nextValues.match = nextValues.teleop;
        }
        nextValues.auto = nextValues.match - nextValues.teleop;
      }
    }

    setForm(prev => ({
      ...prev,
      expectedHubBallsPerMatch: nextValues.match,
      expectedAutoBalls: nextValues.auto,
      expectedTeleopBalls: nextValues.teleop
    }));
    setBallFieldHistory(nextHistory);
  };

  const buildPersistedPitData = () => {
    const normalizedChassisSpeed = normalizePitChassisSpeed(
      form.chassisSpeed,
      form.chassisSpeedDistanceUnit,
      form.chassisSpeedTimeUnit
    );

    return {
      ...form,
      teamNumber: form.teamNumber.trim(),
      teamName: form.teamName.trim(),
      scoutName: form.scoutName.trim(),
      customTurretCount: form.turretCount === 'More' ? form.customTurretCount.trim() : '',
      noClimbCapability: form.noClimbCapability,
      canClimbL1: form.noClimbCapability ? false : form.canClimbL1,
      canClimbL2: form.noClimbCapability ? false : form.canClimbL2,
      canClimbL3: form.noClimbCapability ? false : form.canClimbL3,
      chassisSpeed: normalizedChassisSpeed.chassisSpeed,
      chassisSpeedDistanceUnit: normalizedChassisSpeed.chassisSpeedDistanceUnit,
      chassisSpeedTimeUnit: normalizedChassisSpeed.chassisSpeedTimeUnit,
      deviceId: getPersistentDeviceId(),
      timestamp: Date.now()
    };
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccessMessage('');

    if (!archiveUsername) {
      setError('Please set a scout username for this device first.');
      return;
    }

    const persistedData = buildPersistedPitData();
    const trimmedTeamNumber = persistedData.teamNumber;
    const trimmedTeamName = persistedData.teamName;
    const trimmedScoutName = persistedData.scoutName;
    if (!trimmedTeamNumber) {
      setError('Team number is required.');
      return;
    }
    if (!trimmedTeamName) {
      setError('Team Name is required.');
      return;
    }
    if (!trimmedScoutName) {
      setError('Scout Name is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const archiveRecord = await upsertPitArchiveRecord(eventKey, persistedData, archiveUsername, 'local_submit', {
        syncStatus: 'pending_sync',
        lastFirebaseAttemptAt: Date.now(),
        lastFirebaseError: ''
      });
      await deleteScoutDraft(activeDraftKey);
      skipNextDraftSaveRef.current = true;

      let syncMessage = `Successfully saved pit data for Team ${trimmedTeamNumber}`;
      let syncFailed = false;

      try {
        const writeResult = await writePitScoutingRecord(eventKey, persistedData, {
          mode: isEditing && (!!editingTeamNumber || !!trimmedTeamNumber) ? 'replace' : 'strict'
        });

        if (writeResult.outcome === 'conflict') {
          await updateScoutArchiveRecordSyncState(archiveRecord.recordId, {
            syncStatus: 'unsynced',
            lastFirebaseAttemptAt: Date.now(),
            lastFirebaseError: 'Conflicting pit record already exists in Firebase.'
          });
          syncMessage = `Saved locally for Team ${trimmedTeamNumber}. Firebase reported a conflict, so this pit is unsynced in My History.`;
          syncFailed = true;
        } else {
          await updateScoutArchiveRecordSyncState(archiveRecord.recordId, {
            syncStatus: 'synced',
            lastFirebaseAttemptAt: Date.now(),
            lastFirebaseError: ''
          });
        }
      } catch (syncError) {
        console.error('Error syncing pit data to Firebase:', syncError);
        await updateScoutArchiveRecordSyncState(archiveRecord.recordId, {
          syncStatus: 'unsynced',
          lastFirebaseAttemptAt: Date.now(),
          lastFirebaseError: syncError instanceof Error ? syncError.message : 'Firebase sync failed.'
        });
        syncMessage = `Saved locally for Team ${trimmedTeamNumber}. Firebase sync failed, so this pit is unsynced in My History.`;
        syncFailed = true;
      }

      if (syncFailed) {
        setError(syncMessage);
      } else {
        setSuccessMessage(syncMessage);
      }

      if (isEditing) {
        window.setTimeout(() => navigate('/history'), 1200);
        return;
      }

      setForm(createInitialPitForm());
      setBallFieldHistory([]);
      window.setTimeout(() => setSuccessMessage(''), 3000);
    } catch (submitError) {
      console.error('Error saving pit data:', submitError);
      setError('Failed to save pit data. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-4 md:p-8 font-sans pb-24">
      <div className="max-w-4xl mx-auto space-y-6">
        {isArchiveUsernameResolved && !archiveUsername && (
          <ScoutUsernameGate
            pendingUsername={pendingArchiveUsername}
            setPendingUsername={setPendingArchiveUsername}
            onSave={() => void handleArchiveUsernameSave()}
          />
        )}

        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate('/')}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="flex-1 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight">
                {isEditing ? 'EDIT PIT' : 'PIT SCOUT'}
              </h2>
              <p className="text-sm text-slate-400 mt-1">
                Structured capability interview for the 2026 robot package.
              </p>
            </div>
            <div className="text-right">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                {eventKey}
              </div>
              <div className="text-[11px] font-bold text-slate-600 uppercase tracking-widest mt-1">
                {isEditing ? 'History Edit' : 'Admin Controlled'}
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-900/50 border border-red-500 text-red-200 p-3 rounded-lg text-sm font-medium">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="bg-emerald-900/50 border border-emerald-500 text-emerald-200 p-3 rounded-lg text-sm font-medium flex items-center gap-2">
            <Check className="w-4 h-4" /> {successMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
            <h3 className="text-lg font-black text-white">Team Identity</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-300 uppercase tracking-wider">Team Number</label>
                <input
                  type="number"
                  value={form.teamNumber}
                  onChange={(e) => updateForm({ teamNumber: e.target.value })}
                  disabled={isEditing}
                  className={`w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white font-mono text-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all ${isEditing ? 'opacity-50 cursor-not-allowed' : ''}`}
                  placeholder="e.g. 254"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-300 uppercase tracking-wider">Team Name</label>
                <input
                  type="text"
                  value={form.teamName}
                  onChange={(e) => updateForm({ teamName: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                  placeholder="Required"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-300 uppercase tracking-wider">Scout Name</label>
                <input
                  type="text"
                  value={form.scoutName}
                  onChange={(e) => updateForm({ scoutName: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                  placeholder="Required"
                  required
                />
              </div>
            </div>
          </section>

          <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
            <h3 className="text-lg font-black text-white">Build & Chassis</h3>

            <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-300 uppercase tracking-wider">Robot Base Type</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {(['WCP', 'KitBot', 'Custom'] as const).map(option => (
                  <ChoiceButton
                    key={option}
                    active={form.robotBaseType === option}
                    label={option}
                    onClick={() => handleBaseTypeSelect(option)}
                  />
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2 md:col-span-1">
                <label className="block text-sm font-bold text-slate-300 uppercase tracking-wider">Chassis Speed</label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={form.chassisSpeed || ''}
                  onChange={(e) => updateForm({ chassisSpeed: Number(e.target.value) || 0 })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white font-mono focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                  placeholder="e.g. 4.5"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="block text-sm font-bold text-slate-300 uppercase tracking-wider">Speed Units</label>
                <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-3 items-center">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {(['meters', 'feet', 'miles', 'kilometers', 'yards'] as const).map(option => (
                      <ChoiceButton
                        key={option}
                        active={form.chassisSpeedDistanceUnit === option}
                        label={option}
                        onClick={() => updateForm({ chassisSpeedDistanceUnit: option })}
                        tone="blue"
                      />
                    ))}
                  </div>
                  <div className="text-center text-slate-500 font-black uppercase tracking-widest text-sm">per</div>
                  <div className="grid grid-cols-3 gap-2">
                    {(['seconds', 'minutes', 'hours'] as const).map(option => (
                      <ChoiceButton
                        key={option}
                        active={form.chassisSpeedTimeUnit === option}
                        label={option}
                        onClick={() => updateForm({ chassisSpeedTimeUnit: option })}
                        tone="blue"
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-300 uppercase tracking-wider">Field Traversal</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <ChoiceButton
                  active={form.canCrossTrench}
                  label="Can Pass Trench"
                  onClick={() => handleTraversalSelect('trench')}
                  tone="blue"
                />
                <ChoiceButton
                  active={form.isBumpOnly}
                  label="Bump Robot Only"
                  onClick={() => handleTraversalSelect('bump')}
                  tone="blue"
                />
              </div>
            </div>
          </section>

          <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
            <h3 className="text-lg font-black text-white">Scoring System</h3>

            <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-300 uppercase tracking-wider">Shooter Count</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(['1', '2', '3', 'More'] as const).map(option => (
                  <ChoiceButton
                    key={option}
                    active={form.turretCount === option}
                    label={option}
                    onClick={() => updateForm({ turretCount: option })}
                    tone="amber"
                  />
                ))}
              </div>
              {form.turretCount === 'More' && (
                <input
                  type="text"
                  value={form.customTurretCount}
                  onChange={(e) => updateForm({ customTurretCount: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition-all"
                  placeholder="Describe the shooter setup"
                />
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-300 uppercase tracking-wider">Hopper</label>
                <div className="grid grid-cols-2 gap-2">
                  <ChoiceButton
                    active={form.canUseHopper}
                    label="Has Hopper"
                    onClick={() => updateForm({ canUseHopper: true })}
                    tone="amber"
                  />
                  <ChoiceButton
                    active={!form.canUseHopper}
                    label="No Hopper"
                    onClick={() => updateForm({ canUseHopper: false, hopperCapacity: 0 })}
                    tone="amber"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-300 uppercase tracking-wider">Hopper Capacity</label>
                <input
                  type="number"
                  min="0"
                  value={form.hopperCapacity || ''}
                  onChange={(e) => updateForm({ hopperCapacity: Number(e.target.value) || 0 })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white font-mono focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition-all"
                  placeholder="Balls in hopper"
                  disabled={!form.canUseHopper}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-300 uppercase tracking-wider">Expected Balls / Match</label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={String(form.expectedHubBallsPerMatch)}
                  onChange={(e) => handleBallFieldChange('match', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white font-mono focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                  placeholder="Total"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-300 uppercase tracking-wider">Expected Auto Balls</label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={String(form.expectedAutoBalls)}
                  onChange={(e) => handleBallFieldChange('auto', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white font-mono focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                  placeholder="Auto"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-300 uppercase tracking-wider">Expected Teleop Balls</label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={String(form.expectedTeleopBalls)}
                  onChange={(e) => handleBallFieldChange('teleop', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white font-mono focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                  placeholder="Teleop"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-300 uppercase tracking-wider">Balls Per Second</label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={form.ballsPerSecond || ''}
                  onChange={(e) => updateForm({ ballsPerSecond: Number(e.target.value) || 0 })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white font-mono focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                  placeholder="e.g. 2.5"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-300 uppercase tracking-wider">Number of flywheels per shooter</label>
                <input
                  type="number"
                  min="0"
                  value={form.shootingFlywheelCount || ''}
                  onChange={(e) => updateForm({ shootingFlywheelCount: Number(e.target.value) || 0 })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white font-mono focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                  placeholder="e.g. 2"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-300 uppercase tracking-wider">Shooting Style</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['On the Fly', 'Fixed Point'] as const).map(option => (
                    <ChoiceButton
                      key={option}
                      active={form.shootingStyle === option}
                      label={option}
                      onClick={() => updateForm({ shootingStyle: option })}
                      tone="purple"
                    />
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-300 uppercase tracking-wider">Adjustable Hood (firing angle)</label>
                <div className="grid grid-cols-2 gap-2">
                  <ChoiceButton
                    active={form.hoodAdjustable}
                    label="Yes"
                    onClick={() => updateForm({ hoodAdjustable: true })}
                    tone="purple"
                  />
                  <ChoiceButton
                    active={!form.hoodAdjustable}
                    label="No"
                    onClick={() => updateForm({ hoodAdjustable: false })}
                    tone="purple"
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
            <h3 className="text-lg font-black text-white">Endgame Capability</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <ChoiceButton
                active={form.noClimbCapability}
                label="None"
                onClick={handleNoClimbToggle}
                tone="rose"
              />
              <ChoiceButton
                active={form.canClimbL1}
                label="L1"
                onClick={() => handleClimbToggle('canClimbL1')}
                disabled={form.noClimbCapability}
              />
              <ChoiceButton
                active={form.canClimbL2}
                label="L2"
                onClick={() => handleClimbToggle('canClimbL2')}
                disabled={form.noClimbCapability}
              />
              <ChoiceButton
                active={form.canClimbL3}
                label="L3"
                onClick={() => handleClimbToggle('canClimbL3')}
                disabled={form.noClimbCapability}
              />
            </div>
          </section>

          <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3">
            <h3 className="text-lg font-black text-white">Notes</h3>
            <textarea
              value={form.notes}
              onChange={(e) => updateForm({ notes: e.target.value })}
              className="w-full min-h-28 bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
              placeholder="Anything the team mentioned that matters for strategy or pit prep."
            />
          </section>

          <div className="grid grid-cols-4 gap-4">
            <button
              type="button"
              onClick={() => setShowQr(true)}
              className="col-span-1 py-4 bg-slate-800 hover:bg-slate-700 rounded-2xl text-white font-black shadow-xl active:scale-95 transition-all flex items-center justify-center"
            >
              <QrCode className="w-8 h-8" />
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="col-span-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-lg py-4 rounded-xl shadow-lg shadow-emerald-900/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? 'SAVING...' : isEditing ? 'UPDATE PIT DATA' : 'SAVE PIT DATA'}
              {!isSubmitting && <Save className="w-5 h-5" />}
            </button>
          </div>
        </form>
      </div>

      {showQr && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-sm p-4">
          <div className="bg-white p-8 rounded-3xl max-w-sm w-full flex flex-col items-center relative">
            <button
              onClick={() => setShowQr(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-900"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-black text-slate-900 mb-4">Offline Pit QR Export</h3>
            <p className="text-center text-sm text-slate-600 mb-6">
              Scan this code from the Admin device if internet is unavailable.
            </p>
            <div className="p-4 bg-white rounded-2xl shadow-lg">
              <QRCodeSVG
                value={compressPitData({
                  eventKey,
                  data: buildPersistedPitData()
                })}
                size={280}
                level="L"
                includeMargin
              />
            </div>
            <div className="mt-5 text-center text-xs font-mono text-slate-500 break-all">
              Team {form.teamNumber || 'TBD'} / {form.scoutName || 'Unknown Scout'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
