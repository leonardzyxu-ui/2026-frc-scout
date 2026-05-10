import React, { useEffect, useMemo, useState } from 'react';
import { collection, deleteDoc, doc, getDocs } from 'firebase/firestore';
import {
  AlertTriangle,
  Check,
  ChevronUp,
  Edit2,
  Eye,
  EyeOff,
  History,
  Lock,
  Search,
  Shield,
  Trash2,
  X
} from 'lucide-react';
import { db } from '../firebase';
import { MatchScoutingV3 } from '../types';
import { verifyAdminPassword } from '../utils/adminAuth';
import { MathEngine, TBAMatch } from '../utils/mathEngine';
import { TBA_API_KEY } from '../config';
import {
  buildMatchValidationGroups,
  filterMatchValidationGroups,
  getRowAnomalyLabel,
  MatchEditorRecord,
  MatchRowAnomaly,
  MatchValidationGroup
} from '../utils/rawDataValidation';
import { buildMatchKeyV3, normalizeMatchScoutingV3 } from '../utils/matchScoutingV3';
import { getMatchV3DocId, writeMatchScoutingV3Record } from '../utils/scoutingWrites';

interface RawDataEditorViewProps {
  eventKey: string;
}

type RawDataSubtab = 'quals' | 'practice';

const RAW_DATA_EDITOR_SESSION_KEY = 'raw_data_editor_unlocked';

const ANOMALY_CLASSES: Record<MatchRowAnomaly, string> = {
  wrong_team_for_slot: 'bg-rose-500/15 text-rose-200',
  scout_assignment_mismatch: 'bg-amber-500/15 text-amber-200',
  unexpected_team: 'bg-fuchsia-500/15 text-fuchsia-200',
  duplicate_record: 'bg-red-500/15 text-red-200'
};

const toNumber = (value: string, fallback = 0) => {
  const parsed = parseInt(value || `${fallback}`, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toDecimal = (value: string, fallback = 0) => {
  const parsed = parseFloat(value || `${fallback}`);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const isPracticeMatchKey = (matchKey: string) => (matchKey || '').trim().toLowerCase().startsWith('pm');

const isQualificationMatchKey = (matchKey: string) => (matchKey || '').trim().toLowerCase().startsWith('qm');

const isPracticeRecord = (record: MatchScoutingV3) =>
  record.matchType === 'Practice' || isPracticeMatchKey(record.matchKey);

const isQualificationRecord = (record: MatchScoutingV3) =>
  record.matchType === 'Qualification' || isQualificationMatchKey(record.matchKey);

const isPracticeScheduleMatch = (match: TBAMatch) => isPracticeMatchKey(match.key);

const isQualificationScheduleMatch = (match: TBAMatch) => isQualificationMatchKey(match.key);

const buildUpdatedRecord = (
  originalRecord: MatchEditorRecord,
  editForm: Partial<MatchScoutingV3>
): MatchScoutingV3 => {
  const { id: _id, ...originalWithoutId } = originalRecord;
  return normalizeMatchScoutingV3({
    ...originalWithoutId,
    ...editForm,
    eventKey: (editForm.eventKey || originalRecord.eventKey).trim(),
    matchKey: (editForm.matchKey || originalRecord.matchKey).trim().toLowerCase(),
    teamNumber: (editForm.teamNumber || originalRecord.teamNumber).trim(),
    scoutName: (editForm.scoutName || originalRecord.scoutName).trim(),
    assignedScoutName: (editForm.assignedScoutName || originalRecord.assignedScoutName).trim(),
    assignedSlot: (editForm.assignedSlot || originalRecord.assignedSlot).trim(),
    substituteScoutName: editForm.substituteScoutName ?? originalRecord.substituteScoutName ?? '',
    defenseDescription: (editForm.defenseDescription || originalRecord.defenseDescription).trim(),
    generalEvaluation: (editForm.generalEvaluation || originalRecord.generalEvaluation).trim(),
    editHistory: editForm.editHistory ?? originalRecord.editHistory ?? []
  });
};

export default function RawDataEditorView({ eventKey }: RawDataEditorViewProps) {
  const [data, setData] = useState<MatchEditorRecord[]>([]);
  const [scheduleMatches, setScheduleMatches] = useState<TBAMatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [scheduleWarning, setScheduleWarning] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeSubtab, setActiveSubtab] = useState<RawDataSubtab>('quals');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<MatchScoutingV3>>({});
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    type: 'delete' | 'save' | 'alert';
    message: string;
    targetId?: string;
  }>({ isOpen: false, type: 'alert', message: '' });
  const [passwordInput, setPasswordInput] = useState('');
  const [isEntryAuthorized, setIsEntryAuthorized] = useState(false);
  const [entryPassword, setEntryPassword] = useState('');
  const [entryError, setEntryError] = useState(false);
  const [showEntryPassword, setShowEntryPassword] = useState(false);

  useEffect(() => {
    setIsEntryAuthorized(sessionStorage.getItem(RAW_DATA_EDITOR_SESSION_KEY) === 'true');
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    setScheduleWarning('');

    try {
      const snapshot = await getDocs(collection(db, 'events', eventKey, 'matchScoutingV3'));
      const matches: MatchEditorRecord[] = snapshot.docs.map(docSnap => ({
        ...(docSnap.data() as MatchScoutingV3),
        id: docSnap.id
      }));
      setData(matches);

      if (!TBA_API_KEY) {
        setScheduleMatches([]);
        setScheduleWarning('TBA API key missing. Match completeness and team-slot validation are limited.');
      } else if (eventKey === 'TEST') {
        setScheduleMatches([]);
        setScheduleWarning('TEST mode has no authoritative TBA schedule. Only local duplicate checks are active.');
      } else {
        try {
          const engine = new MathEngine(TBA_API_KEY);
          const matchesFromTba = await engine.fetchEventMatches(eventKey, { includeUnplayed: true });
          setScheduleMatches(matchesFromTba);
        } catch (error) {
          console.error('Failed to load TBA schedule for raw data validation', error);
          setScheduleMatches([]);
          setScheduleWarning('Unable to load the TBA schedule. Missing-team and wrong-team checks are limited.');
        }
      }
    } catch (error) {
      console.error('Error fetching raw data:', error);
      setScheduleMatches([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isEntryAuthorized) {
      setIsLoading(false);
      return;
    }

    void fetchData();
  }, [eventKey, isEntryAuthorized]);

  const handleEntryUnlock = async (event: React.FormEvent) => {
    event.preventDefault();

    if (await verifyAdminPassword(entryPassword)) {
      sessionStorage.setItem(RAW_DATA_EDITOR_SESSION_KEY, 'true');
      setIsEntryAuthorized(true);
      setEntryPassword('');
      setEntryError(false);
      return;
    }

    setEntryError(true);
    window.setTimeout(() => setEntryError(false), 500);
  };

  const handleDeleteClick = (id: string) => {
    setModalState({
      isOpen: true,
      type: 'delete',
      message: 'Enter admin password to delete this record. This cannot be undone.',
      targetId: id
    });
    setPasswordInput('');
  };

  const executeDelete = async () => {
    if (!(await verifyAdminPassword(passwordInput))) {
      setModalState({ isOpen: true, type: 'alert', message: 'Incorrect password.' });
      return;
    }
    const id = modalState.targetId;
    if (!id) return;

    try {
      await deleteDoc(doc(db, 'events', eventKey, 'matchScoutingV3', id));
      setData(prev => prev.filter(item => item.id !== id));
      setModalState({ isOpen: false, type: 'alert', message: '' });
    } catch (error) {
      console.error('Error deleting document:', error);
      setModalState({ isOpen: true, type: 'alert', message: 'Failed to delete record.' });
    }
  };

  const handleEdit = (match: MatchEditorRecord) => {
    setEditingId(match.id);
    setEditForm(match);
  };

  const handleSaveClick = () => {
    if (!editingId) return;
    setModalState({ isOpen: true, type: 'save', message: 'Enter admin password to save changes.' });
    setPasswordInput('');
  };

  const executeSave = async () => {
    if (!(await verifyAdminPassword(passwordInput))) {
      setModalState({ isOpen: true, type: 'alert', message: 'Incorrect password.' });
      return;
    }

    try {
      const originalDoc = data.find(item => item.id === editingId);
      if (!originalDoc) return;

      const updatedDocData = buildUpdatedRecord(originalDoc, editForm);
      const newDocId = getMatchV3DocId(updatedDocData);

      const changes: string[] = [];
      for (const key in editForm) {
        if (key !== 'id' && key !== 'editHistory' && (editForm as any)[key] !== (originalDoc as any)[key]) {
          changes.push(`${key}: ${(originalDoc as any)[key]} -> ${(editForm as any)[key]}`);
        }
      }

      updatedDocData.editHistory = [
        ...(originalDoc.editHistory || []),
        {
          timestamp: Date.now(),
          editor: 'Admin',
          changes: changes.join(', ') || 'Edited in Raw Data Editor'
        }
      ];

      const writeResult = await writeMatchScoutingV3Record(updatedDocData, {
        mode: newDocId === editingId ? 'replace' : 'strict'
      });

      if (writeResult.outcome === 'duplicate') {
        setModalState({
          isOpen: true,
          type: 'alert',
          message: newDocId === editingId
            ? 'No substantive changes were detected.'
            : 'An identical record already exists at the target match/team.'
        });
        return;
      }

      if (writeResult.outcome === 'conflict') {
        setModalState({
          isOpen: true,
          type: 'alert',
          message: 'A conflicting record already exists at the target match/team. Resolve the conflict manually first.'
        });
        return;
      }

      if (newDocId !== editingId) {
        await deleteDoc(doc(db, 'events', eventKey, 'matchScoutingV3', editingId as string));
      }

      setData(prev => prev.map(item => item.id === editingId ? { ...updatedDocData, id: newDocId } : item));
      setEditingId(null);
      setModalState({ isOpen: false, type: 'alert', message: '' });
    } catch (error) {
      console.error('Error updating document:', error);
      setModalState({ isOpen: true, type: 'alert', message: 'Failed to update record.' });
    }
  };

  const toggleHistory = (id: string) => {
    setExpandedHistoryId(prev => prev === id ? null : id);
  };

  const visibleData = useMemo(
    () => data.filter(record => (activeSubtab === 'practice' ? isPracticeRecord(record) : isQualificationRecord(record))),
    [activeSubtab, data]
  );

  const visibleScheduleMatches = useMemo(
    () =>
      scheduleMatches.filter(match =>
        activeSubtab === 'practice' ? isPracticeScheduleMatch(match) : isQualificationScheduleMatch(match)
      ),
    [activeSubtab, scheduleMatches]
  );

  const groupedMatches = useMemo<MatchValidationGroup[]>(
    () => buildMatchValidationGroups(visibleData, visibleScheduleMatches),
    [visibleData, visibleScheduleMatches]
  );

  const filteredGroups = useMemo(
    () => filterMatchValidationGroups(groupedMatches, searchTerm),
    [groupedMatches, searchTerm]
  );

  const summary = useMemo(() => {
    const missingSlots = groupedMatches.reduce((sum, group) => sum + group.missingSlots.length, 0);
    const anomalyRows = groupedMatches.reduce(
      (sum, group) => sum + group.rows.filter(row => row.anomalies.length > 0).length,
      0
    );
    return {
      groups: groupedMatches.length,
      rows: visibleData.length,
      missingSlots,
      anomalyRows
    };
  }, [groupedMatches, visibleData.length]);

  const activeTitle = activeSubtab === 'practice' ? 'PRACTICE MATCHES' : 'QUALS';
  const activeDescription =
    activeSubtab === 'practice'
      ? 'Practice rows grouped by match. Schedule-aware checks stay soft when no authoritative practice schedule exists.'
      : 'Qualification rows grouped by match with missing-slot, wrong-team, duplicate-row, and scout-slot validation.';

  const effectiveScheduleWarning = useMemo(() => {
    if (scheduleWarning) {
      return scheduleWarning;
    }

    if (activeSubtab === 'practice' && visibleData.length > 0 && visibleScheduleMatches.length === 0) {
      return 'No authoritative TBA practice schedule was found. Practice validation is running in local-only mode where needed.';
    }

    return '';
  }, [activeSubtab, scheduleWarning, visibleData.length, visibleScheduleMatches.length]);

  if (!isEntryAuthorized) {
    return (
      <div className="flex items-center justify-center min-h-[480px]">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 via-red-500 to-fuchsia-500" />
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-slate-950 rounded-full flex items-center justify-center border border-slate-800 shadow-inner">
              <Lock className="w-8 h-8 text-amber-400" />
            </div>
          </div>

          <h2 className="text-2xl font-black text-center mb-2 tracking-tight text-white">RAW DATA EDITOR LOCKED</h2>
          <p className="text-slate-400 text-center text-sm mb-8 font-medium">
            Re-enter the admin password before accessing direct Firestore editing.
          </p>

          <form onSubmit={handleEntryUnlock} className="space-y-4">
            <div className="relative">
              <input
                type={showEntryPassword ? 'text' : 'password'}
                value={entryPassword}
                onChange={(e) => setEntryPassword(e.target.value)}
                placeholder="••••••••••••"
                className={`w-full bg-slate-950 border rounded-xl p-4 text-center tracking-widest text-lg text-white focus:outline-none transition-all ${
                  entryError
                    ? 'border-red-500 text-red-300 shadow-[0_0_15px_rgba(239,68,68,0.2)]'
                    : 'border-slate-800 focus:border-amber-500 focus:shadow-[0_0_15px_rgba(245,158,11,0.2)]'
                }`}
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowEntryPassword(prev => !prev)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
              >
                {showEntryPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            <button
              type="submit"
              className="w-full py-4 bg-gradient-to-r from-amber-600 to-red-600 hover:from-amber-500 hover:to-red-500 text-white rounded-xl font-black tracking-wide shadow-lg shadow-amber-900/20 transition-all active:scale-95"
            >
              UNLOCK RAW DATA EDITOR
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-pulse text-emerald-400 font-bold">Loading Database...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h2 className="text-2xl font-black text-white">RAW DATA EDITOR</h2>
          <p className="mt-2 text-sm text-slate-400">
            {activeDescription}
          </p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder={`Search ${activeTitle.toLowerCase()}, team, scout, slot...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:border-emerald-500 outline-none w-72"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        {([
          { key: 'quals', label: 'Quals' },
          { key: 'practice', label: 'Practice Matches' }
        ] as { key: RawDataSubtab; label: string }[]).map(option => (
          <button
            key={option.key}
            onClick={() => setActiveSubtab(option.key)}
            className={`rounded-full px-4 py-2 text-sm font-black tracking-wider transition-colors ${
              activeSubtab === option.key
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryPill label="Matches" value={summary.groups} />
        <SummaryPill label="Rows" value={summary.rows} />
        <SummaryPill label="Missing Slots" value={summary.missingSlots} tone="amber" />
        <SummaryPill label="Flagged Rows" value={summary.anomalyRows} tone="rose" />
      </div>

      <div className="bg-amber-900/20 border border-amber-500/50 text-amber-400 p-4 rounded-xl flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
        <div>
          <h3 className="font-bold">Direct Database Access</h3>
          <p className="text-sm opacity-80">Editing here updates Firestore directly. Conflicting records are blocked automatically instead of silently overwriting existing data.</p>
        </div>
      </div>

      {effectiveScheduleWarning && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-100">
          {effectiveScheduleWarning}
        </div>
      )}

      {filteredGroups.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 px-6 py-12 text-center text-slate-500 font-semibold">
          No matches found for the current filter.
        </div>
      ) : (
        filteredGroups.map(group => (
          <div key={group.matchKey} className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
            <div className="border-b border-slate-800 px-5 py-4">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-black text-white">{group.displayMatchKey}</h3>
                    {!group.scheduleKnown && (
                      <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-black tracking-wider text-slate-200">
                        Schedule Unknown
                      </span>
                    )}
                    {group.warnings.map(warning => (
                      <span
                        key={warning}
                        className={`rounded-full px-3 py-1 text-xs font-black tracking-wider ${
                          warning.startsWith('Missing')
                            ? 'bg-amber-500/15 text-amber-200'
                            : warning === 'Schedule Unknown'
                              ? 'bg-slate-800 text-slate-200'
                              : 'bg-rose-500/15 text-rose-200'
                        }`}
                      >
                        {warning}
                      </span>
                    ))}
                  </div>
                  <p className="mt-2 text-sm text-slate-400">
                    {group.scheduleKnown
                      ? `${group.rows.length} saved row${group.rows.length === 1 ? '' : 's'} / ${group.expectedSlots.length} scheduled slot${group.expectedSlots.length === 1 ? '' : 's'}`
                      : `${group.rows.length} saved row${group.rows.length === 1 ? '' : 's'} with no TBA schedule available`}
                  </p>
                </div>
              </div>
            </div>

            {group.missingSlots.length > 0 && (
              <div className="border-b border-amber-500/20 bg-amber-500/5 px-5 py-4">
                <h4 className="text-xs font-black uppercase tracking-widest text-amber-200">Missing Slots</h4>
                <div className="mt-3 flex flex-wrap gap-2">
                  {group.missingSlots.map(slot => (
                    <div key={slot.key} className="rounded-xl border border-amber-500/30 bg-amber-950/40 px-3 py-2 text-xs font-semibold text-amber-100">
                      {slot.slotLabel}: Team {slot.teamNumber}
                      {slot.assignedScoutName ? ` • ${slot.assignedScoutName}` : ''}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="admin-sticky-table min-w-[1400px] w-full text-left text-sm">
                <thead className="bg-slate-950 text-slate-400 font-mono text-xs uppercase">
                  <tr>
                    <th className="px-4 py-3">Slot</th>
                    <th className="px-4 py-3">Expected Team</th>
                    <th className="px-4 py-3">Saved Team</th>
                    <th className="px-4 py-3">Alliance</th>
                    <th className="px-4 py-3">Scout</th>
                    <th className="px-4 py-3">Assigned</th>
                    <th className="px-4 py-3">Timestamp</th>
                    <th className="px-4 py-3">Flags</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {group.rows.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-slate-500 font-bold">
                        No saved scouting rows for this match yet.
                      </td>
                    </tr>
                  ) : (
                    group.rows.map((row) => (
                      <React.Fragment key={row.record.id}>
                        <tr className="hover:bg-slate-800/50 transition-colors align-top">
                          {editingId === row.record.id ? (
                            <td colSpan={9} className="p-4 bg-slate-800/80">
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                                <div>
                                  <label className="block text-xs text-slate-400 mb-1">Match Type</label>
                                  <select
                                    className="bg-slate-950 border border-slate-700 rounded px-2 py-1 w-full text-white"
                                    value={editForm.matchType || 'Qualification'}
                                    onChange={e => {
                                      const nextMatchType = e.target.value as MatchScoutingV3['matchType'];
                                      const nextMatchNumber = editForm.matchNumber || row.record.matchNumber;
                                      setEditForm({
                                        ...editForm,
                                        matchType: nextMatchType,
                                        matchKey: buildMatchKeyV3(nextMatchType, nextMatchNumber)
                                      });
                                    }}
                                  >
                                    <option value="Practice">Practice</option>
                                    <option value="Qualification">Qualification</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-xs text-slate-400 mb-1">Match Number</label>
                                  <input
                                    type="number"
                                    className="bg-slate-950 border border-slate-700 rounded px-2 py-1 w-full text-white"
                                    value={editForm.matchNumber ?? row.record.matchNumber}
                                    onChange={e => {
                                      const nextMatchNumber = toNumber(e.target.value, row.record.matchNumber);
                                      const nextMatchType = editForm.matchType || row.record.matchType;
                                      setEditForm({
                                        ...editForm,
                                        matchNumber: nextMatchNumber,
                                        matchKey: buildMatchKeyV3(nextMatchType, nextMatchNumber)
                                      });
                                    }}
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs text-slate-400 mb-1">Team Number</label>
                                  <input className="bg-slate-950 border border-slate-700 rounded px-2 py-1 w-full text-white" value={editForm.teamNumber || ''} onChange={e => setEditForm({ ...editForm, teamNumber: e.target.value })} />
                                </div>
                                <div>
                                  <label className="block text-xs text-slate-400 mb-1">Alliance</label>
                                  <select className="bg-slate-950 border border-slate-700 rounded px-2 py-1 w-full text-white" value={editForm.alliance || ''} onChange={e => setEditForm({ ...editForm, alliance: e.target.value as MatchScoutingV3['alliance'] })}>
                                    <option value="Red">Red</option>
                                    <option value="Blue">Blue</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-xs text-slate-400 mb-1">Scout Name</label>
                                  <input className="bg-slate-950 border border-slate-700 rounded px-2 py-1 w-full text-white" value={editForm.scoutName || ''} onChange={e => setEditForm({ ...editForm, scoutName: e.target.value })} />
                                </div>
                                <div>
                                  <label className="block text-xs text-slate-400 mb-1">Assigned Scout</label>
                                  <input className="bg-slate-950 border border-slate-700 rounded px-2 py-1 w-full text-white" value={editForm.assignedScoutName || ''} onChange={e => setEditForm({ ...editForm, assignedScoutName: e.target.value })} />
                                </div>
                                <div>
                                  <label className="block text-xs text-slate-400 mb-1">Assigned Slot</label>
                                  <input className="bg-slate-950 border border-slate-700 rounded px-2 py-1 w-full text-white" value={editForm.assignedSlot || ''} onChange={e => setEditForm({ ...editForm, assignedSlot: e.target.value })} />
                                </div>
                                <div>
                                  <label className="block text-xs text-slate-400 mb-1">Substitute</label>
                                  <select
                                    className="bg-slate-950 border border-slate-700 rounded px-2 py-1 w-full text-white"
                                    value={editForm.substituteScoutName || ''}
                                    onChange={e => setEditForm({ ...editForm, substituteScoutName: e.target.value as MatchScoutingV3['substituteScoutName'] })}
                                  >
                                    <option value="">None</option>
                                    <option value="Charlotte">Charlotte</option>
                                    <option value="Scarlett">Scarlett</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-xs text-slate-400 mb-1">Starting Position</label>
                                  <select className="bg-slate-950 border border-slate-700 rounded px-2 py-1 w-full text-white" value={editForm.startingPosition || ''} onChange={e => setEditForm({ ...editForm, startingPosition: e.target.value as MatchScoutingV3['startingPosition'] })}>
                                    <option value="">None</option>
                                    <option value="Left">Left</option>
                                    <option value="Center">Center</option>
                                    <option value="Right">Right</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-xs text-slate-400 mb-1">Shooting Style</label>
                                  <select className="bg-slate-950 border border-slate-700 rounded px-2 py-1 w-full text-white" value={editForm.shootingStyle || ''} onChange={e => setEditForm({ ...editForm, shootingStyle: e.target.value as MatchScoutingV3['shootingStyle'] })}>
                                    <option value="">None</option>
                                    <option value="On the Fly">On the Fly</option>
                                    <option value="Stationary">Stationary</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-xs text-slate-400 mb-1">Climb Level</label>
                                  <select className="bg-slate-950 border border-slate-700 rounded px-2 py-1 w-full text-white" value={editForm.climbLevel || 'None'} onChange={e => setEditForm({ ...editForm, climbLevel: e.target.value as MatchScoutingV3['climbLevel'] })}>
                                    <option value="None">None</option>
                                    <option value="L1">L1</option>
                                    <option value="L2">L2</option>
                                    <option value="L3">L3</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-xs text-slate-400 mb-1">Auto Points</label>
                                  <input type="number" className="bg-slate-950 border border-slate-700 rounded px-2 py-1 w-full text-white" value={editForm.autoPoints ?? row.record.autoPoints} onChange={e => setEditForm({ ...editForm, autoPoints: toNumber(e.target.value, row.record.autoPoints) })} />
                                </div>
                                <div>
                                  <label className="block text-xs text-slate-400 mb-1">Teleop Points</label>
                                  <input type="number" className="bg-slate-950 border border-slate-700 rounded px-2 py-1 w-full text-white" value={editForm.teleopPoints ?? row.record.teleopPoints} onChange={e => setEditForm({ ...editForm, teleopPoints: toNumber(e.target.value, row.record.teleopPoints) })} />
                                </div>
                                <div>
                                  <label className="block text-xs text-slate-400 mb-1">Teleop Cycles</label>
                                  <input type="number" className="bg-slate-950 border border-slate-700 rounded px-2 py-1 w-full text-white" value={editForm.teleopCycles ?? row.record.teleopCycles} onChange={e => setEditForm({ ...editForm, teleopCycles: toNumber(e.target.value, row.record.teleopCycles) })} />
                                </div>
                                <div>
                                  <label className="block text-xs text-slate-400 mb-1">Auto Climbed</label>
                                  <input type="checkbox" className="bg-slate-950 border border-slate-700 rounded" checked={editForm.autoClimbed ?? row.record.autoClimbed} onChange={e => setEditForm({ ...editForm, autoClimbed: e.target.checked })} />
                                </div>
                                <div>
                                  <label className="block text-xs text-slate-400 mb-1">Teleop Climbed</label>
                                  <input type="checkbox" className="bg-slate-950 border border-slate-700 rounded" checked={editForm.teleopClimbed ?? row.record.teleopClimbed} onChange={e => setEditForm({ ...editForm, teleopClimbed: e.target.checked })} />
                                </div>
                                <div>
                                  <label className="block text-xs text-slate-400 mb-1">Close Accuracy</label>
                                  <input type="number" step="0.01" className="bg-slate-950 border border-slate-700 rounded px-2 py-1 w-full text-white" value={editForm.closeAccuracy ?? row.record.closeAccuracy} onChange={e => setEditForm({ ...editForm, closeAccuracy: toDecimal(e.target.value, row.record.closeAccuracy) })} />
                                </div>
                                <div>
                                  <label className="block text-xs text-slate-400 mb-1">Middle Accuracy</label>
                                  <input type="number" step="0.01" className="bg-slate-950 border border-slate-700 rounded px-2 py-1 w-full text-white" value={editForm.middleAccuracy ?? row.record.middleAccuracy} onChange={e => setEditForm({ ...editForm, middleAccuracy: toDecimal(e.target.value, row.record.middleAccuracy) })} />
                                </div>
                                <div>
                                  <label className="block text-xs text-slate-400 mb-1">Far Accuracy</label>
                                  <input type="number" step="0.01" className="bg-slate-950 border border-slate-700 rounded px-2 py-1 w-full text-white" value={editForm.farAccuracy ?? row.record.farAccuracy} onChange={e => setEditForm({ ...editForm, farAccuracy: toDecimal(e.target.value, row.record.farAccuracy) })} />
                                </div>
                                <div>
                                  <label className="block text-xs text-slate-400 mb-1">Contribution Score</label>
                                  <input type="number" step="0.01" className="bg-slate-950 border border-slate-700 rounded px-2 py-1 w-full text-white" value={editForm.contributionScore ?? row.record.contributionScore} onChange={e => setEditForm({ ...editForm, contributionScore: toDecimal(e.target.value, row.record.contributionScore) })} />
                                </div>
                                <div>
                                  <label className="block text-xs text-slate-400 mb-1">Driver Skill</label>
                                  <input type="number" step="0.01" className="bg-slate-950 border border-slate-700 rounded px-2 py-1 w-full text-white" value={editForm.driverSkill ?? row.record.driverSkill} onChange={e => setEditForm({ ...editForm, driverSkill: toDecimal(e.target.value, row.record.driverSkill) })} />
                                </div>
                                <div>
                                  <label className="block text-xs text-slate-400 mb-1">Teamwork</label>
                                  <input type="number" step="0.01" className="bg-slate-950 border border-slate-700 rounded px-2 py-1 w-full text-white" value={editForm.teamwork ?? row.record.teamwork} onChange={e => setEditForm({ ...editForm, teamwork: toDecimal(e.target.value, row.record.teamwork) })} />
                                </div>
                                <div>
                                  <label className="block text-xs text-slate-400 mb-1">Trench Pushing</label>
                                  <select className="bg-slate-950 border border-slate-700 rounded px-2 py-1 w-full text-white" value={editForm.trenchPushing || ''} onChange={e => setEditForm({ ...editForm, trenchPushing: e.target.value as MatchScoutingV3['trenchPushing'] })}>
                                    <option value="">None</option>
                                    <option value="Cannot">Cannot</option>
                                    <option value="Limited">Limited</option>
                                    <option value="Strong">Strong</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-xs text-slate-400 mb-1">Passing</label>
                                  <select className="bg-slate-950 border border-slate-700 rounded px-2 py-1 w-full text-white" value={editForm.passing || ''} onChange={e => setEditForm({ ...editForm, passing: e.target.value as MatchScoutingV3['passing'] })}>
                                    <option value="">None</option>
                                    <option value="Cannot">Cannot</option>
                                    <option value="Limited">Limited</option>
                                    <option value="Strong">Strong</option>
                                  </select>
                                </div>
                                <div className="col-span-2">
                                  <label className="block text-xs text-slate-400 mb-1">Defense Description</label>
                                  <textarea className="bg-slate-950 border border-slate-700 rounded px-2 py-1 w-full text-white h-20" value={editForm.defenseDescription ?? row.record.defenseDescription} onChange={e => setEditForm({ ...editForm, defenseDescription: e.target.value })} />
                                </div>
                                <div className="col-span-2">
                                  <label className="block text-xs text-slate-400 mb-1">General Evaluation</label>
                                  <textarea className="bg-slate-950 border border-slate-700 rounded px-2 py-1 w-full text-white h-20" value={editForm.generalEvaluation ?? row.record.generalEvaluation} onChange={e => setEditForm({ ...editForm, generalEvaluation: e.target.value })} />
                                </div>
                              </div>
                              <div className="flex justify-end space-x-2">
                                <button onClick={handleSaveClick} className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded hover:bg-emerald-500 font-bold">
                                  <Check className="w-4 h-4" /> Save Changes
                                </button>
                                <button onClick={() => setEditingId(null)} className="flex items-center gap-1 px-3 py-1.5 bg-slate-700 text-slate-300 rounded hover:bg-slate-600 font-bold">
                                  <X className="w-4 h-4" /> Cancel
                                </button>
                              </div>
                            </td>
                          ) : (
                            <>
                              <td className="px-4 py-3 font-bold text-white">
                                {row.expectedSlotLabel || row.record.assignedSlot || '—'}
                              </td>
                              <td className="px-4 py-3 font-mono text-slate-300">
                                {row.expectedTeamNumber || '—'}
                              </td>
                              <td className="px-4 py-3 font-mono text-emerald-400">{row.record.teamNumber}</td>
                              <td className="px-4 py-3">
                                <span className={`text-xs font-black px-2 py-0.5 rounded ${row.record.alliance === 'Red' ? 'bg-red-900/50 text-red-400' : 'bg-blue-900/50 text-blue-400'}`}>
                                  {row.record.alliance.toUpperCase()}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-slate-300">
                                <div className="font-semibold text-white">{row.record.scoutName}</div>
                                {row.record.substituteScoutName && (
                                  <div className="text-xs text-slate-500">Substitute: {row.record.substituteScoutName}</div>
                                )}
                              </td>
                              <td className="px-4 py-3 text-slate-300">
                                <div>{row.record.assignedScoutName || '—'}</div>
                                <div className="text-xs text-slate-500">{row.record.assignedSlot || 'No Slot'}</div>
                              </td>
                              <td className="px-4 py-3 text-slate-500 font-mono text-xs">
                                {new Date(row.record.timestamp || 0).toLocaleString()}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex flex-wrap gap-2">
                                  {row.anomalies.length === 0 ? (
                                    <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-black tracking-wider text-emerald-200">
                                      OK
                                    </span>
                                  ) : (
                                    row.anomalies.map(anomaly => (
                                      <span key={anomaly} className={`rounded-full px-3 py-1 text-xs font-black tracking-wider ${ANOMALY_CLASSES[anomaly]}`}>
                                        {getRowAnomalyLabel(anomaly)}
                                      </span>
                                    ))
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right space-x-2">
                                {row.record.editHistory && row.record.editHistory.length > 0 && (
                                  <button onClick={() => toggleHistory(row.record.id)} className="p-1.5 bg-slate-800 text-slate-400 rounded hover:bg-slate-700 hover:text-white" title="View History">
                                    {expandedHistoryId === row.record.id ? <ChevronUp className="w-4 h-4" /> : <History className="w-4 h-4" />}
                                  </button>
                                )}
                                <button onClick={() => handleEdit(row.record)} className="p-1.5 bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30">
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button onClick={() => handleDeleteClick(row.record.id)} className="p-1.5 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </>
                          )}
                        </tr>
                        {expandedHistoryId === row.record.id && row.record.editHistory && (
                          <tr className="bg-slate-900/80 border-t border-slate-800">
                            <td colSpan={9} className="p-4">
                              <h4 className="text-sm font-bold text-slate-300 mb-2 flex items-center gap-2">
                                <History className="w-4 h-4" /> Edit History
                              </h4>
                              <ul className="space-y-2">
                                {row.record.editHistory.map((entry, idx) => (
                                  <li key={idx} className="text-xs text-slate-400 bg-slate-950 p-2 rounded border border-slate-800">
                                    <div className="flex justify-between mb-1">
                                      <span className="font-bold text-slate-300">{entry.editor}</span>
                                      <span className="font-mono">{new Date(entry.timestamp).toLocaleString()}</span>
                                    </div>
                                    <div className="font-mono text-amber-400/80">{entry.changes}</div>
                                  </li>
                                ))}
                              </ul>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}

      {modalState.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
              {modalState.type === 'alert' ? <AlertTriangle className="w-6 h-6 text-amber-500" /> : <Shield className="w-6 h-6 text-emerald-500" />}
              {modalState.type === 'alert' ? 'Notice' : 'Admin Authorization'}
            </h3>
            <p className="text-slate-300 mb-6 leading-relaxed">{modalState.message}</p>

            {(modalState.type === 'delete' || modalState.type === 'save') && (
              <input
                type="password"
                placeholder="Enter Admin Password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white mb-6 focus:outline-none focus:border-emerald-500 transition-colors"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    modalState.type === 'delete' ? executeDelete() : executeSave();
                  }
                }}
              />
            )}

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setModalState({ isOpen: false, type: 'alert', message: '' })}
                className="px-4 py-2 rounded-lg font-bold text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
              >
                {modalState.type === 'alert' ? 'Close' : 'Cancel'}
              </button>
              {(modalState.type === 'delete' || modalState.type === 'save') && (
                <button
                  onClick={modalState.type === 'delete' ? executeDelete : executeSave}
                  className={`px-6 py-2 rounded-lg font-bold text-white transition-colors ${
                    modalState.type === 'delete' ? 'bg-red-600 hover:bg-red-500' : 'bg-emerald-600 hover:bg-emerald-500'
                  }`}
                >
                  Confirm
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryPill({
  label,
  value,
  tone = 'slate'
}: {
  label: string;
  value: number;
  tone?: 'slate' | 'amber' | 'rose';
}) {
  const toneClasses =
    tone === 'amber'
      ? 'border-amber-500/30 bg-amber-500/10 text-amber-100'
      : tone === 'rose'
        ? 'border-rose-500/30 bg-rose-500/10 text-rose-100'
        : 'border-slate-800 bg-slate-900/60 text-white';

  return (
    <div className={`rounded-2xl border p-4 ${toneClasses}`}>
      <div className="text-xs font-black uppercase tracking-wider opacity-70">{label}</div>
      <div className="mt-2 text-2xl font-black">{value}</div>
    </div>
  );
}
