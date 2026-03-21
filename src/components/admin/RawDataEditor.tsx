import React, { useState } from 'react';
import { MatchData } from '../../types';
import { doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import NumberInput from '../NumberInput';

export default function RawDataEditor({ matches, onRefresh, verifyPassword }: { matches: MatchData[], onRefresh: () => void, verifyPassword: (pwd: string) => Promise<boolean> }) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingMatch, setEditingMatch] = useState<MatchData | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Sort matches by timestamp (newest to oldest), fallback to match number
  const sortedMatches = [...matches].sort((a, b) => {
    if (b.timestamp && a.timestamp) {
      return b.timestamp - a.timestamp;
    }
    return b.match - a.match;
  });

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === sortedMatches.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sortedMatches.map(m => m.docId!)));
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Are you sure you want to permanently delete ${selectedIds.size} matches?`)) return;
    
    const pwd = window.prompt("Please enter admin password to confirm deletion:");
    if (!pwd) return;
    const isValid = await verifyPassword(pwd);
    if (!isValid) {
      alert("Incorrect password.");
      return;
    }

    setIsSaving(true);
    try {
      const promises = Array.from(selectedIds).map(id => deleteDoc(doc(db, 'matches', id)));
      await Promise.all(promises);
      setSelectedIds(new Set());
      onRefresh();
    } catch (err) {
      console.error("Error deleting matches:", err);
      alert("Failed to delete some matches.");
    }
    setIsSaving(false);
  };

  const handleExportSelected = () => {
    if (selectedIds.size === 0) return;
    
    const selectedMatches = sortedMatches.filter(m => selectedIds.has(m.docId!));
    
    // Create CSV header
    const headers = ["Match", "Team", "Scout", "Alliance", "Auto Score", "Teleop Fuel", "Endgame", "Notes", "Device ID", "User Agent"];
    
    // Create CSV rows
    const rows = selectedMatches.map(m => [
      m.match,
      m.team,
      m.scout,
      m.alliance,
      m.counters.auto_score,
      m.counters.teleop_fuel,
      m.endgame,
      `"${m.notes.replace(/"/g, '""')}"`, // Escape quotes in notes
      `"${m.deviceId || ''}"`,
      `"${m.userAgent || ''}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `scout_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSaveEdit = async () => {
    if (!editingMatch || !editingMatch.docId) return;
    
    const pwd = window.prompt("Please enter admin password to confirm changes:");
    if (!pwd) return;
    const isValid = await verifyPassword(pwd);
    if (!isValid) {
      alert("Incorrect password.");
      return;
    }

    setIsSaving(true);
    try {
      // Create a clean copy to update
      const updateData = { ...editingMatch };
      delete updateData.docId; // Don't write docId to fields
      
      await updateDoc(doc(db, 'matches', editingMatch.docId), updateData);
      setEditingMatch(null);
      onRefresh();
    } catch (err) {
      console.error("Error updating match:", err);
      alert("Failed to update match.");
    }
    setIsSaving(false);
  };

  return (
    <div className="flex flex-col h-full gap-4 relative">
      <div className="flex justify-between items-center bg-slate-800/50 p-4 rounded-xl border border-white/10 shrink-0">
        <div>
          <h2 className="text-xl font-bold text-white">Raw Data Editor</h2>
          <p className="text-sm text-gray-400">Select rows to delete or export. Click Edit to change values.</p>
        </div>
        <div className="flex gap-4 items-center">
          <span className="text-sm text-gray-400 font-bold">{selectedIds.size} Selected</span>
          <button 
            onClick={handleExportSelected}
            disabled={selectedIds.size === 0 || isSaving}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg font-bold transition"
          >
            Export CSV
          </button>
          <button 
            onClick={handleDeleteSelected}
            disabled={selectedIds.size === 0 || isSaving}
            className="bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg font-bold transition"
          >
            Delete Selected
          </button>
        </div>
      </div>

      <div className="flex-1 bg-slate-800/50 rounded-xl border border-white/10 overflow-hidden flex flex-col">
        <div className="overflow-auto flex-1 p-0">
          <table className="w-full text-left text-sm text-gray-300">
            <thead className="bg-slate-900/80 sticky top-0 z-10 text-xs uppercase text-gray-400">
              <tr>
                <th className="px-4 py-3 w-12">
                  <input 
                    type="checkbox" 
                    checked={selectedIds.size === sortedMatches.length && sortedMatches.length > 0}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500"
                  />
                </th>
                <th className="px-4 py-3">Match</th>
                <th className="px-4 py-3">Team</th>
                <th className="px-4 py-3">Scout</th>
                <th className="px-4 py-3">Auto Pts</th>
                <th className="px-4 py-3">Teleop Pts</th>
                <th className="px-4 py-3">Endgame</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {sortedMatches.map((m) => (
                <tr key={m.docId} className={`hover:bg-white/5 ${selectedIds.has(m.docId!) ? 'bg-blue-900/20' : ''}`}>
                  <td className="px-4 py-3">
                    <input 
                      type="checkbox" 
                      checked={selectedIds.has(m.docId!)}
                      onChange={() => toggleSelect(m.docId!)}
                      className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-4 py-3 font-bold text-white">{m.match}</td>
                  <td className="px-4 py-3 font-bold text-blue-400">{m.team}</td>
                  <td className="px-4 py-3">{m.scout}</td>
                  <td className="px-4 py-3 text-yellow-400">{m.counters.auto_score}</td>
                  <td className="px-4 py-3 text-yellow-400">{m.counters.teleop_fuel}</td>
                  <td className="px-4 py-3 text-purple-400">{m.endgame}</td>
                  <td className="px-4 py-3 text-right">
                    <button 
                      onClick={() => setEditingMatch(m)}
                      className="text-blue-400 hover:text-blue-300 font-bold text-xs uppercase tracking-wider bg-blue-900/30 px-3 py-1 rounded"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
              {sortedMatches.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">No match data available.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* EDIT MODAL */}
      {editingMatch && (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-2xl font-black text-white mb-6">Edit Match Data</h3>
            
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Match Number</label>
                <NumberInput 
                  value={editingMatch.match} 
                  onChange={val => setEditingMatch({...editingMatch, match: val})}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Team Number</label>
                <input 
                  type="text" 
                  value={editingMatch.team} 
                  onChange={e => setEditingMatch({...editingMatch, team: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Scout Name</label>
                <input 
                  type="text" 
                  value={editingMatch.scout} 
                  onChange={e => setEditingMatch({...editingMatch, scout: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Alliance</label>
                <select 
                  value={editingMatch.alliance} 
                  onChange={e => setEditingMatch({...editingMatch, alliance: e.target.value as any})}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white focus:border-blue-500 outline-none"
                >
                  <option value="Red">Red</option>
                  <option value="Blue">Blue</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Auto Fuel</label>
                <NumberInput 
                  value={editingMatch.counters.auto_score} 
                  onChange={val => setEditingMatch({...editingMatch, counters: {...editingMatch.counters, auto_score: val}})}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Teleop Fuel</label>
                <NumberInput 
                  value={editingMatch.counters.teleop_fuel} 
                  onChange={val => setEditingMatch({...editingMatch, counters: {...editingMatch.counters, teleop_fuel: val}})}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Hoard Fuel</label>
                <NumberInput 
                  value={editingMatch.counters.hoard_fuel} 
                  onChange={val => setEditingMatch({...editingMatch, counters: {...editingMatch.counters, hoard_fuel: val}})}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white focus:border-blue-500 outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4 mb-4 bg-slate-950 p-4 rounded-lg border border-slate-700">
              <label className="flex items-center gap-2 text-sm text-white cursor-pointer">
                <input type="checkbox" checked={editingMatch.toggles.auto_mobility} onChange={e => setEditingMatch({...editingMatch, toggles: {...editingMatch.toggles, auto_mobility: e.target.checked}})} className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-600" />
                Auto Mobility
              </label>
              <label className="flex items-center gap-2 text-sm text-white cursor-pointer">
                <input type="checkbox" checked={editingMatch.toggles.auto_tower} onChange={e => setEditingMatch({...editingMatch, toggles: {...editingMatch.toggles, auto_tower: e.target.checked}})} className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-600" />
                Auto Tower
              </label>
              <label className="flex items-center gap-2 text-sm text-white cursor-pointer">
                <input type="checkbox" checked={editingMatch.toggles.defense} onChange={e => setEditingMatch({...editingMatch, toggles: {...editingMatch.toggles, defense: e.target.checked}})} className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-600" />
                Defense
              </label>
              <label className="flex items-center gap-2 text-sm text-white cursor-pointer">
                <input type="checkbox" checked={editingMatch.toggles.robot_died} onChange={e => setEditingMatch({...editingMatch, toggles: {...editingMatch.toggles, robot_died: e.target.checked}})} className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-600" />
                Robot Died
              </label>
            </div>

            {editingMatch.toggles.robot_died && (
              <div className="mb-4">
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Died Reason</label>
                <input 
                  type="text" 
                  value={editingMatch.diedReason} 
                  onChange={e => setEditingMatch({...editingMatch, diedReason: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white focus:border-blue-500 outline-none"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Endgame</label>
                <select 
                  value={editingMatch.endgame} 
                  onChange={e => setEditingMatch({...editingMatch, endgame: e.target.value as any})}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white focus:border-blue-500 outline-none"
                >
                  <option value="None">None</option>
                  <option value="L1">L1</option>
                  <option value="L2">L2</option>
                  <option value="L3">L3</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Alliance Score</label>
                <NumberInput 
                  value={editingMatch.allianceScore || 0} 
                  onChange={val => setEditingMatch({...editingMatch, allianceScore: val})}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white focus:border-blue-500 outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-5 gap-4 mb-4 bg-slate-950 p-4 rounded-lg border border-slate-700">
              <label className="flex items-center gap-2 text-sm text-white cursor-pointer">
                <input type="checkbox" checked={editingMatch.rp.win} onChange={e => setEditingMatch({...editingMatch, rp: {...editingMatch.rp, win: e.target.checked}})} className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-600" />
                Win RP
              </label>
              <label className="flex items-center gap-2 text-sm text-white cursor-pointer">
                <input type="checkbox" checked={editingMatch.rp.tie} onChange={e => setEditingMatch({...editingMatch, rp: {...editingMatch.rp, tie: e.target.checked}})} className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-600" />
                Tie RP
              </label>
              <label className="flex items-center gap-2 text-sm text-white cursor-pointer">
                <input type="checkbox" checked={editingMatch.rp.climb} onChange={e => setEditingMatch({...editingMatch, rp: {...editingMatch.rp, climb: e.target.checked}})} className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-600" />
                Climb RP
              </label>
              <label className="flex items-center gap-2 text-sm text-white cursor-pointer">
                <input type="checkbox" checked={editingMatch.rp.fuel100} onChange={e => setEditingMatch({...editingMatch, rp: {...editingMatch.rp, fuel100: e.target.checked}})} className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-600" />
                Fuel 100 RP
              </label>
              <label className="flex items-center gap-2 text-sm text-white cursor-pointer">
                <input type="checkbox" checked={editingMatch.rp.fuel360} onChange={e => setEditingMatch({...editingMatch, rp: {...editingMatch.rp, fuel360: e.target.checked}})} className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-600" />
                Fuel 360 RP
              </label>
            </div>

            <div className="mb-6">
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Notes</label>
              <textarea 
                value={editingMatch.notes} 
                onChange={e => setEditingMatch({...editingMatch, notes: e.target.value})}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white focus:border-blue-500 outline-none min-h-[100px]"
              />
            </div>

            <div className="mb-6 bg-slate-950 p-4 rounded-lg border border-slate-700">
              <h4 className="text-xs font-bold text-gray-400 uppercase mb-2">Device Tracking Info</h4>
              <div className="grid grid-cols-1 gap-2 text-sm">
                <div><span className="text-gray-500">Device ID:</span> <span className="text-blue-400 font-mono">{editingMatch.deviceId || 'Unknown'}</span></div>
                <div><span className="text-gray-500">User Agent:</span> <span className="text-gray-300 text-xs">{editingMatch.userAgent || 'Unknown'}</span></div>
              </div>
            </div>

            <div className="flex gap-4 justify-end">
              <button 
                onClick={() => setEditingMatch(null)}
                className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold transition"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveEdit}
                disabled={isSaving}
                className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold transition disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
