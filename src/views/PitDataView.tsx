import React, { useEffect, useMemo, useState } from 'react';
import { collection, deleteDoc, doc, getDocs, setDoc } from 'firebase/firestore';
import { ClipboardList, Download, Edit3, RefreshCw, Save, Search, Trash2, UserCheck, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { PitAssignment, PitScoutingV2 } from '../types';
import { TBA_API_KEY } from '../config';
import { EventTeamRosterRow, fetchEventTeamsSimple } from '../utils/preMatchScouting';
import {
  formatPitChassisSpeed,
  getClimbCapabilityLabel,
  getShooterLabel,
  getTraversalLabel
} from '../utils/pitScouting';
import { getPersistentDeviceId } from '../utils/sharedEventState';
import { downloadCsvFile } from '../utils/csv';

interface PitDataViewProps {
  eventKey: string;
}

type PitStatus =
  | 'unassigned'
  | 'assigned_missing'
  | 'submitted_by_assigned'
  | 'submitted_by_different';

interface PitRosterRow {
  teamNumber: string;
  teamName: string;
  assignedScoutName: string;
  submittedBy: string;
  status: PitStatus;
  lastUpdated: number | null;
  pitData: PitScoutingV2 | null;
}

const STATUS_LABELS: Record<PitStatus, string> = {
  unassigned: 'Unassigned',
  assigned_missing: 'Assigned, Missing',
  submitted_by_assigned: 'Submitted by Assigned Scout',
  submitted_by_different: 'Submitted by Different Scout'
};

const STATUS_CLASSES: Record<PitStatus, string> = {
  unassigned: 'bg-slate-800 text-slate-200 border border-slate-700',
  assigned_missing: 'bg-amber-950/60 text-amber-200 border border-amber-500/30',
  submitted_by_assigned: 'bg-emerald-950/60 text-emerald-200 border border-emerald-500/30',
  submitted_by_different: 'bg-rose-950/60 text-rose-200 border border-rose-500/30'
};

const getTeamName = (rosterTeam: EventTeamRosterRow | undefined, pitData: PitScoutingV2 | null) =>
  pitData?.teamName || rosterTeam?.nickname || '';

const getRowStatus = (assignedScoutName: string, pitData: PitScoutingV2 | null): PitStatus => {
  if (!assignedScoutName) {
    return 'unassigned';
  }

  if (!pitData) {
    return 'assigned_missing';
  }

  if (pitData.scoutName && pitData.scoutName.trim() === assignedScoutName.trim()) {
    return 'submitted_by_assigned';
  }

  return 'submitted_by_different';
};

const formatUpdatedAt = (timestamp: number | null) =>
  timestamp ? new Date(timestamp).toLocaleString() : '';

const formatIsoTimestamp = (timestamp: number | null) =>
  timestamp ? new Date(timestamp).toISOString() : '';

export default function PitDataView({ eventKey }: PitDataViewProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rosterWarning, setRosterWarning] = useState('');
  const [roster, setRoster] = useState<EventTeamRosterRow[]>([]);
  const [pitSubmissions, setPitSubmissions] = useState<Record<string, PitScoutingV2>>({});
  const [assignments, setAssignments] = useState<Record<string, PitAssignment>>({});
  const [filter, setFilter] = useState('');
  const [bulkPasteValue, setBulkPasteValue] = useState('');
  const [rowEdits, setRowEdits] = useState<Record<string, string>>({});
  const [statusMessage, setStatusMessage] = useState('');

  const deviceId = useMemo(() => getPersistentDeviceId(), []);

  const loadPitData = async () => {
    setLoading(true);
    setError('');
    setRosterWarning('');

    try {
      const [pitSnapshot, assignmentSnapshot] = await Promise.all([
        getDocs(collection(db, 'events', eventKey, 'pitScouting')),
        getDocs(collection(db, 'events', eventKey, 'pitAssignments'))
      ]);

      const nextPitSubmissions = Object.fromEntries(
        pitSnapshot.docs.map(docSnap => [docSnap.id, docSnap.data() as PitScoutingV2])
      );
      const nextAssignments = Object.fromEntries(
        assignmentSnapshot.docs.map(docSnap => [docSnap.id, docSnap.data() as PitAssignment])
      );

      setPitSubmissions(nextPitSubmissions);
      setAssignments(nextAssignments);

      try {
        if (eventKey === 'TEST') {
          throw new Error('TEST mode does not have a complete TBA event roster.');
        }

        const rosterRows = await fetchEventTeamsSimple(eventKey, TBA_API_KEY);
        setRoster(rosterRows);
      } catch (rosterError) {
        console.error('Failed to fetch full pit roster from TBA', rosterError);
        const fallbackTeamNumbers = Array.from(
          new Set([...Object.keys(nextPitSubmissions), ...Object.keys(nextAssignments)])
        ).sort((a, b) => Number(a) - Number(b));

        setRoster(
          fallbackTeamNumbers.map(teamNumber => ({
            teamNumber,
            nickname: nextPitSubmissions[teamNumber]?.teamName || ''
          }))
        );
        setRosterWarning('Showing a fallback roster because the full TBA event roster could not be loaded.');
      }
    } catch (loadError) {
      console.error('Failed to load pit data view', loadError);
      setError('Unable to load pit data right now.');
      setRoster([]);
      setPitSubmissions({});
      setAssignments({});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPitData();
  }, [eventKey]);

  const allRows = useMemo<PitRosterRow[]>(() => {
    const rosterMap = new Map(roster.map(entry => [entry.teamNumber, entry]));
    const allTeamNumbers = Array.from(
      new Set([
        ...roster.map(entry => entry.teamNumber),
        ...Object.keys(assignments),
        ...Object.keys(pitSubmissions)
      ])
    ).sort((a, b) => Number(a) - Number(b));

    return allTeamNumbers.map(teamNumber => {
      const rosterTeam = rosterMap.get(teamNumber);
      const pitData = pitSubmissions[teamNumber] || null;
      const assignment = assignments[teamNumber];
      const assignedScoutName = assignment?.assignedScoutName || '';
      return {
        teamNumber,
        teamName: getTeamName(rosterTeam, pitData),
        assignedScoutName,
        submittedBy: pitData?.scoutName || '',
        status: getRowStatus(assignedScoutName, pitData),
        lastUpdated: pitData?.timestamp ?? null,
        pitData
      };
    });
  }, [assignments, pitSubmissions, roster]);

  const filteredRows = useMemo(() => {
    const normalizedFilter = filter.trim().toLowerCase();
    if (!normalizedFilter) {
      return allRows;
    }

    return allRows.filter(row =>
      row.teamNumber.toLowerCase().includes(normalizedFilter) ||
      row.teamName.toLowerCase().includes(normalizedFilter) ||
      row.assignedScoutName.toLowerCase().includes(normalizedFilter) ||
      row.submittedBy.toLowerCase().includes(normalizedFilter) ||
      STATUS_LABELS[row.status].toLowerCase().includes(normalizedFilter)
    );
  }, [allRows, filter]);

  const overallSummary = useMemo(() => {
    const assigned = allRows.filter(row => row.assignedScoutName).length;
    const submitted = allRows.filter(row => row.pitData).length;
    const matched = allRows.filter(row => row.status === 'submitted_by_assigned').length;
    const missing = allRows.filter(row => row.status === 'assigned_missing').length;
    return {
      teams: allRows.length,
      assigned,
      submitted,
      matched,
      missing
    };
  }, [allRows]);

  const scoutSummary = useMemo(() => {
    const grouped = new Map<string, { name: string; assigned: number; submitted: number; matched: number; missing: number }>();

    allRows.forEach(row => {
      if (!row.assignedScoutName) return;

      if (!grouped.has(row.assignedScoutName)) {
        grouped.set(row.assignedScoutName, {
          name: row.assignedScoutName,
          assigned: 0,
          submitted: 0,
          matched: 0,
          missing: 0
        });
      }

      const bucket = grouped.get(row.assignedScoutName)!;
      bucket.assigned += 1;
      if (row.pitData) bucket.submitted += 1;
      if (row.status === 'submitted_by_assigned') bucket.matched += 1;
      if (row.status === 'assigned_missing') bucket.missing += 1;
    });

    return Array.from(grouped.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [allRows]);

  const saveAssignment = async (teamNumber: string, assignedScoutName: string) => {
    const trimmedName = assignedScoutName.trim();

    try {
      if (!trimmedName) {
        await deleteDoc(doc(db, 'events', eventKey, 'pitAssignments', teamNumber));
        setAssignments(prev => {
          const next = { ...prev };
          delete next[teamNumber];
          return next;
        });
        setRowEdits(prev => ({ ...prev, [teamNumber]: '' }));
        return;
      }

      const nextAssignment: PitAssignment = {
        teamNumber,
        assignedScoutName: trimmedName,
        updatedAt: Date.now(),
        updatedByDeviceId: deviceId
      };

      await setDoc(doc(db, 'events', eventKey, 'pitAssignments', teamNumber), nextAssignment);
      setAssignments(prev => ({ ...prev, [teamNumber]: nextAssignment }));
      setRowEdits(prev => ({ ...prev, [teamNumber]: trimmedName }));
    } catch (saveError) {
      console.error('Failed to save pit assignment', saveError);
      setError(`Unable to save assignment for Team ${teamNumber}.`);
    }
  };

  const applyBulkAssignments = async () => {
    const pastedNames = bulkPasteValue
      .split(/\r?\n/)
      .map(entry => entry.trim())
      .filter(Boolean);

    if (pastedNames.length === 0 || allRows.length === 0) {
      return;
    }

    setStatusMessage('');
    setError('');

    try {
      const targets = allRows.slice(0, pastedNames.length);
      await Promise.all(
        targets.map((row, index) => {
          const assignedScoutName = pastedNames[index] ?? '';
          return setDoc(doc(db, 'events', eventKey, 'pitAssignments', row.teamNumber), {
            teamNumber: row.teamNumber,
            assignedScoutName,
            updatedAt: Date.now(),
            updatedByDeviceId: deviceId
          } satisfies PitAssignment);
        })
      );

      const nextAssignments = { ...assignments };
      const nextRowEdits = { ...rowEdits };
      targets.forEach((row, index) => {
        const assignedScoutName = pastedNames[index] ?? '';
        nextAssignments[row.teamNumber] = {
          teamNumber: row.teamNumber,
          assignedScoutName,
          updatedAt: Date.now(),
          updatedByDeviceId: deviceId
        };
        nextRowEdits[row.teamNumber] = assignedScoutName;
      });
      setAssignments(nextAssignments);
      setRowEdits(nextRowEdits);
      setStatusMessage(`Applied ${targets.length} assignment${targets.length === 1 ? '' : 's'} from the ordered roster.`);
    } catch (bulkError) {
      console.error('Failed to apply pit assignments', bulkError);
      setError('Unable to apply the pasted pit assignments.');
    }
  };

  const openPitEdit = (pitData: PitScoutingV2) => {
    localStorage.setItem('edit_pit_data', JSON.stringify({
      eventKey,
      data: pitData
    }));
    navigate('/pit');
  };

  const exportPitCsv = () => {
    const rowsWithData = allRows.filter(row => row.pitData);
    const headers = [
      'team_number',
      'team_name',
      'assigned_scout',
      'submitted_by',
      'status',
      'robot_base_type',
      'is_wcp_bot',
      'is_kit_bot',
      'shooter_count',
      'custom_shooter_text',
      'hopper_enabled',
      'hopper_capacity',
      'climb_capability',
      'expected_balls_match',
      'expected_balls_auto',
      'expected_balls_teleop',
      'balls_per_second',
      'shooting_style',
      'traversal',
      'normalized_chassis_speed',
      'flywheels_per_shooter',
      'adjustable_hood',
      'notes',
      'timestamp'
    ];

    const csvRows = rowsWithData.map(row => {
      const pitData = row.pitData!;
      return [
        row.teamNumber,
        row.teamName,
        row.assignedScoutName,
        row.submittedBy,
        STATUS_LABELS[row.status],
        pitData.robotBaseType,
        pitData.isWcpBot ? 'yes' : 'no',
        pitData.isKitBot ? 'yes' : 'no',
        getShooterLabel(pitData),
        pitData.customTurretCount,
        pitData.canUseHopper ? 'yes' : 'no',
        pitData.hopperCapacity,
        getClimbCapabilityLabel(pitData),
        pitData.expectedHubBallsPerMatch,
        pitData.expectedAutoBalls,
        pitData.expectedTeleopBalls,
        pitData.ballsPerSecond,
        pitData.shootingStyle,
        getTraversalLabel(pitData),
        formatPitChassisSpeed(pitData),
        pitData.shootingFlywheelCount,
        pitData.hoodAdjustable ? 'yes' : 'no',
        pitData.notes,
        formatIsoTimestamp(row.lastUpdated)
      ];
    });

    downloadCsvFile(
      `pit_data_${eventKey}_${new Date().toISOString().split('T')[0]}.csv`,
      headers,
      csvRows
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h2 className="text-2xl font-black text-white flex items-center gap-3">
            <ClipboardList className="w-7 h-7 text-cyan-400" />
            Pit Data
          </h2>
          <p className="text-sm text-slate-400 mt-2">
            Assignment board and submission accountability for pit scouting at <span className="font-mono text-emerald-400">{eventKey}</span>.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={exportPitCsv}
            disabled={loading || allRows.every(row => !row.pitData)}
            className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-3 font-black text-white transition-colors hover:bg-cyan-500 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => void loadPitData()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 font-black text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {(error || rosterWarning || statusMessage) && (
        <div className="space-y-3">
          {error && <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-200">{error}</div>}
          {rosterWarning && <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-100">{rosterWarning}</div>}
          {statusMessage && <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-100">{statusMessage}</div>}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <SummaryCard label="Teams" value={overallSummary.teams} icon={<Users className="h-5 w-5 text-slate-300" />} />
        <SummaryCard label="Assigned" value={overallSummary.assigned} icon={<UserCheck className="h-5 w-5 text-cyan-300" />} />
        <SummaryCard label="Submitted" value={overallSummary.submitted} icon={<ClipboardList className="h-5 w-5 text-purple-300" />} />
        <SummaryCard label="Matched" value={overallSummary.matched} icon={<UserCheck className="h-5 w-5 text-emerald-300" />} />
        <SummaryCard label="Missing" value={overallSummary.missing} icon={<ClipboardList className="h-5 w-5 text-amber-300" />} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
            <h3 className="text-lg font-black text-white">Bulk Assignment</h3>
            <p className="text-sm text-slate-400">
              Paste one scout name per line. Assignments fill top-to-bottom using the full event roster order.
            </p>
            <textarea
              value={bulkPasteValue}
              onChange={(event) => setBulkPasteValue(event.target.value)}
              className="min-h-56 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-cyan-500"
              placeholder={'Scout One\nScout Two\nScout Three'}
            />
            <button
              type="button"
              onClick={() => void applyBulkAssignments()}
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-3 font-black text-white transition-colors hover:bg-cyan-500"
            >
              <Save className="h-4 w-4" />
              Apply Assignments
            </button>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
            <h3 className="text-lg font-black text-white">Assigned Scout Summary</h3>
            {scoutSummary.length === 0 ? (
              <p className="text-sm text-slate-500">No pit assignments yet.</p>
            ) : (
              <div className="space-y-3">
                {scoutSummary.map(summary => (
                  <div key={summary.name} className="rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-3">
                    <div className="font-black text-white">{summary.name}</div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs font-semibold text-slate-400">
                      <span>Assigned: <span className="text-white">{summary.assigned}</span></span>
                      <span>Submitted: <span className="text-white">{summary.submitted}</span></span>
                      <span>Matched: <span className="text-emerald-300">{summary.matched}</span></span>
                      <span>Missing: <span className="text-amber-300">{summary.missing}</span></span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
          <div className="border-b border-slate-800 px-5 py-4">
            <div className="relative max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 py-3 pl-10 pr-4 text-sm text-white outline-none focus:border-cyan-500"
                placeholder="Filter by team, name, assigned scout, submitter, or status"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="admin-sticky-table min-w-[1880px] w-full text-left text-sm">
              <thead className="bg-slate-950 text-xs font-black uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-4 py-3">Edit</th>
                  <th className="px-4 py-3">Team</th>
                  <th className="px-4 py-3">Team Name</th>
                  <th className="px-4 py-3">Assigned Scout</th>
                  <th className="px-4 py-3">Submitted By</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Last Updated</th>
                  <th className="px-4 py-3">Base</th>
                  <th className="px-4 py-3">Shooter Count</th>
                  <th className="px-4 py-3">Hopper</th>
                  <th className="px-4 py-3">Climb</th>
                  <th className="px-4 py-3">Expected Match</th>
                  <th className="px-4 py-3">Expected Auto</th>
                  <th className="px-4 py-3">Expected Teleop</th>
                  <th className="px-4 py-3">Balls / Sec</th>
                  <th className="px-4 py-3">Style</th>
                  <th className="px-4 py-3">Traversal</th>
                  <th className="px-4 py-3">Chassis Speed</th>
                  <th className="px-4 py-3">Flywheels / Shooter</th>
                  <th className="px-4 py-3">Adjustable Hood</th>
                  <th className="px-4 py-3">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {loading ? (
                  <tr>
                    <td colSpan={21} className="px-4 py-10 text-center font-semibold text-slate-500">
                      Loading pit accountability board...
                    </td>
                  </tr>
                ) : filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={21} className="px-4 py-10 text-center font-semibold text-slate-500">
                      No pit rows match the current filter.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map(row => {
                    const assignmentValue = rowEdits[row.teamNumber] ?? row.assignedScoutName;
                    const pitData = row.pitData;
                    return (
                      <tr key={row.teamNumber} className="align-top hover:bg-slate-800/30">
                        <td className="px-4 py-4">
                          {pitData ? (
                            <button
                              type="button"
                              onClick={() => openPitEdit(pitData)}
                              className="rounded-lg bg-blue-500/20 p-2 text-blue-300 transition-colors hover:bg-blue-500/30 hover:text-white"
                              title={`Edit pit data for Team ${row.teamNumber}`}
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>
                          ) : (
                            <span className="text-xs font-semibold text-slate-600">No Data</span>
                          )}
                        </td>
                        <td className="px-4 py-4 font-black text-white">{row.teamNumber}</td>
                        <td className="px-4 py-4 text-slate-200">{row.teamName || ''}</td>
                        <td className="px-4 py-4">
                          <div className="flex items-start gap-2">
                            <input
                              type="text"
                              value={assignmentValue}
                              onChange={(event) =>
                                setRowEdits(prev => ({ ...prev, [row.teamNumber]: event.target.value }))
                              }
                              className="w-40 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500"
                              placeholder="Assign scout"
                            />
                            <button
                              type="button"
                              onClick={() => void saveAssignment(row.teamNumber, assignmentValue)}
                              className="rounded-lg bg-cyan-600 p-2 text-white transition-colors hover:bg-cyan-500"
                              title="Save assignment"
                            >
                              <Save className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void saveAssignment(row.teamNumber, '')}
                              className="rounded-lg bg-slate-800 p-2 text-slate-300 transition-colors hover:bg-slate-700 hover:text-white"
                              title="Clear assignment"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-slate-200">{row.submittedBy || ''}</td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${STATUS_CLASSES[row.status]}`}>
                            {STATUS_LABELS[row.status]}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-slate-400">{formatUpdatedAt(row.lastUpdated)}</td>
                        <td className="px-4 py-4 text-slate-200">{pitData?.robotBaseType || ''}</td>
                        <td className="px-4 py-4 text-slate-200">{pitData ? getShooterLabel(pitData) : ''}</td>
                        <td className="px-4 py-4 text-slate-200">
                          {pitData?.canUseHopper ? `${pitData.hopperCapacity || 0}` : pitData ? 'No' : ''}
                        </td>
                        <td className="px-4 py-4 text-slate-200">{pitData ? getClimbCapabilityLabel(pitData) : ''}</td>
                        <td className="px-4 py-4 text-slate-200">{pitData?.expectedHubBallsPerMatch || ''}</td>
                        <td className="px-4 py-4 text-slate-200">{pitData?.expectedAutoBalls || ''}</td>
                        <td className="px-4 py-4 text-slate-200">{pitData?.expectedTeleopBalls || ''}</td>
                        <td className="px-4 py-4 text-slate-200">{pitData?.ballsPerSecond || ''}</td>
                        <td className="px-4 py-4 text-slate-200">{pitData?.shootingStyle || ''}</td>
                        <td className="px-4 py-4 text-slate-200">{pitData ? getTraversalLabel(pitData) : ''}</td>
                        <td className="px-4 py-4 text-slate-200">{pitData ? formatPitChassisSpeed(pitData) : ''}</td>
                        <td className="px-4 py-4 text-slate-200">{pitData?.shootingFlywheelCount || ''}</td>
                        <td className="px-4 py-4 text-slate-200">
                          {pitData ? (pitData.hoodAdjustable ? 'Yes' : 'No') : ''}
                        </td>
                        <td className="max-w-xs px-4 py-4 text-slate-300">{pitData?.notes || ''}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-black uppercase tracking-wider text-slate-500">{label}</span>
        {icon}
      </div>
      <div className="mt-3 text-3xl font-black text-white">{value}</div>
    </div>
  );
}
