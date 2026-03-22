import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, deleteDoc, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { MatchScoutingV2 } from '../types';
import { Edit2, Trash2, Search, X, Check, AlertTriangle, History, ChevronDown, ChevronUp } from 'lucide-react';

interface RawDataEditorViewProps {
  eventKey: string;
}

export default function RawDataEditorView({ eventKey }: RawDataEditorViewProps) {
  const [data, setData] = useState<(MatchScoutingV2 & { id: string })[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<MatchScoutingV2>>({});
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);

  const adminPassword = import.meta.env.VITE_ADMIN_PASSWORD || 'admin123';

  const fetchData = async () => {
    setIsLoading(true);
    try {
      if (eventKey === 'TEST') {
        setData([]);
        setIsLoading(false);
        return;
      }
      const snapshot = await getDocs(collection(db, 'events', eventKey, 'matchScouting'));
      const matches: (MatchScoutingV2 & { id: string })[] = [];
      snapshot.forEach(doc => {
        matches.push({ ...doc.data(), id: doc.id } as MatchScoutingV2 & { id: string });
      });
      matches.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      setData(matches);
    } catch (error) {
      console.error("Error fetching raw data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [eventKey]);

  const handleDelete = async (id: string) => {
    const password = prompt("Enter admin password to delete this record:");
    if (password !== adminPassword) {
      alert("Incorrect password.");
      return;
    }
    if (!window.confirm("Are you sure you want to delete this record? This cannot be undone.")) return;
    try {
      await deleteDoc(doc(db, 'events', eventKey, 'matchScouting', id));
      setData(prev => prev.filter(item => item.id !== id));
    } catch (error) {
      console.error("Error deleting document:", error);
      alert("Failed to delete record.");
    }
  };

  const handleEdit = (match: MatchScoutingV2 & { id: string }) => {
    setEditingId(match.id);
    setEditForm(match);
  };

  const handleSave = async () => {
    if (!editingId) return;
    const password = prompt("Enter admin password to save changes:");
    if (password !== adminPassword) {
      alert("Incorrect password.");
      return;
    }
    try {
      const originalDoc = data.find(item => item.id === editingId);
      if (!originalDoc) return;

      const newDocId = `${editForm.matchKey}_${editForm.teamNumber}`;
      
      // Calculate changes
      const changes: string[] = [];
      for (const key in editForm) {
        if (key !== 'id' && key !== 'editHistory' && (editForm as any)[key] !== (originalDoc as any)[key]) {
          changes.push(`${key}: ${(originalDoc as any)[key]} -> ${(editForm as any)[key]}`);
        }
      }

      const newHistoryEntry = {
        timestamp: Date.now(),
        editor: 'Admin',
        changes: changes.join(', ')
      };

      const updatedDocData = {
        ...originalDoc,
        ...editForm,
        editHistory: [...(originalDoc.editHistory || []), newHistoryEntry]
      };
      
      if (newDocId !== editingId) {
        // ID changed, create new doc and delete old
        const newDocRef = doc(db, 'events', eventKey, 'matchScouting', newDocId);
        await setDoc(newDocRef, updatedDocData);
        await deleteDoc(doc(db, 'events', eventKey, 'matchScouting', editingId));
        
        setData(prev => prev.map(item => item.id === editingId ? { ...updatedDocData, id: newDocId } : item));
      } else {
        // ID same, just update
        const docRef = doc(db, 'events', eventKey, 'matchScouting', editingId);
        await updateDoc(docRef, updatedDocData);
        setData(prev => prev.map(item => item.id === editingId ? { ...updatedDocData, id: editingId } : item));
      }
      
      setEditingId(null);
    } catch (error) {
      console.error("Error updating document:", error);
      alert("Failed to update record.");
    }
  };

  const toggleHistory = (id: string) => {
    setExpandedHistoryId(prev => prev === id ? null : id);
  };

  const filteredData = data.filter(match => 
    match.teamNumber.includes(searchTerm) || 
    match.matchKey.toLowerCase().includes(searchTerm.toLowerCase()) ||
    match.scoutName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-pulse text-emerald-400 font-bold">Loading Database...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-black text-white">RAW DATA EDITOR</h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search team, match, scout..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:border-emerald-500 outline-none w-64"
          />
        </div>
      </div>

      <div className="bg-amber-900/20 border border-amber-500/50 text-amber-400 p-4 rounded-xl flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
        <div>
          <h3 className="font-bold">Direct Database Access</h3>
          <p className="text-sm opacity-80">Modifying records here directly updates Firestore. Ensure you have verified the data before saving. Deletions are permanent.</p>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-950 text-slate-400 font-mono text-xs uppercase">
              <tr>
                <th className="px-4 py-3">Match</th>
                <th className="px-4 py-3">Team</th>
                <th className="px-4 py-3">Alliance</th>
                <th className="px-4 py-3">Scout</th>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500 font-bold">
                    No records found.
                  </td>
                </tr>
              ) : (
                filteredData.map((match) => (
                  <React.Fragment key={match.id}>
                    <tr className="hover:bg-slate-800/50 transition-colors">
                      {editingId === match.id ? (
                        <td colSpan={6} className="p-4 bg-slate-800/80">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                            <div>
                              <label className="block text-xs text-slate-400 mb-1">Match Key</label>
                              <input className="bg-slate-950 border border-slate-700 rounded px-2 py-1 w-full text-white" value={editForm.matchKey || ''} onChange={e => setEditForm({...editForm, matchKey: e.target.value})} />
                            </div>
                            <div>
                              <label className="block text-xs text-slate-400 mb-1">Team Number</label>
                              <input className="bg-slate-950 border border-slate-700 rounded px-2 py-1 w-full text-white" value={editForm.teamNumber || ''} onChange={e => setEditForm({...editForm, teamNumber: e.target.value})} />
                            </div>
                            <div>
                              <label className="block text-xs text-slate-400 mb-1">Alliance</label>
                              <select className="bg-slate-950 border border-slate-700 rounded px-2 py-1 w-full text-white" value={editForm.alliance || ''} onChange={e => setEditForm({...editForm, alliance: e.target.value as any})}>
                                <option value="Red">Red</option>
                                <option value="Blue">Blue</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs text-slate-400 mb-1">Scout Name</label>
                              <input className="bg-slate-950 border border-slate-700 rounded px-2 py-1 w-full text-white" value={editForm.scoutName || ''} onChange={e => setEditForm({...editForm, scoutName: e.target.value})} />
                            </div>
                            {/* Toggles & Critical Failures */}
                            <div>
                              <label className="block text-xs text-slate-400 mb-1">Climb Level</label>
                              <select className="bg-slate-950 border border-slate-700 rounded px-2 py-1 w-full text-white" value={editForm.climbLevel || 'None'} onChange={e => setEditForm({...editForm, climbLevel: e.target.value as any})}>
                                <option value="None">None</option>
                                <option value="Parked">Parked</option>
                                <option value="Shallow">Shallow</option>
                                <option value="Deep">Deep</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs text-slate-400 mb-1">Tipped Over</label>
                              <input type="checkbox" className="bg-slate-950 border border-slate-700 rounded" checked={editForm.tippedOver || false} onChange={e => setEditForm({...editForm, tippedOver: e.target.checked})} />
                            </div>
                            <div>
                              <label className="block text-xs text-slate-400 mb-1">Robot Died</label>
                              <input type="checkbox" className="bg-slate-950 border border-slate-700 rounded" checked={editForm.robotDied || false} onChange={e => setEditForm({...editForm, robotDied: e.target.checked})} />
                            </div>
                            <div>
                              <label className="block text-xs text-slate-400 mb-1">Comms Lost</label>
                              <input type="checkbox" className="bg-slate-950 border border-slate-700 rounded" checked={editForm.commsLost || false} onChange={e => setEditForm({...editForm, commsLost: e.target.checked})} />
                            </div>
                            <div>
                              <label className="block text-xs text-slate-400 mb-1">Mechanism Broke</label>
                              <input type="checkbox" className="bg-slate-950 border border-slate-700 rounded" checked={editForm.mechanismBroke || false} onChange={e => setEditForm({...editForm, mechanismBroke: e.target.checked})} />
                            </div>
                            {/* Subjective */}
                            <div>
                              <label className="block text-xs text-slate-400 mb-1">Auto Fluidity (1-10)</label>
                              <input type="number" className="bg-slate-950 border border-slate-700 rounded px-2 py-1 w-full text-white" value={editForm.autoFluidity || 0} onChange={e => setEditForm({...editForm, autoFluidity: parseInt(e.target.value)})} />
                            </div>
                            <div>
                              <label className="block text-xs text-slate-400 mb-1">Teleop Fluidity (1-10)</label>
                              <input type="number" className="bg-slate-950 border border-slate-700 rounded px-2 py-1 w-full text-white" value={editForm.teleopFluidity || 0} onChange={e => setEditForm({...editForm, teleopFluidity: parseInt(e.target.value)})} />
                            </div>
                            <div>
                              <label className="block text-xs text-slate-400 mb-1">Driver Pressure (1-10)</label>
                              <input type="number" className="bg-slate-950 border border-slate-700 rounded px-2 py-1 w-full text-white" value={editForm.driverPressure || 0} onChange={e => setEditForm({...editForm, driverPressure: parseInt(e.target.value)})} />
                            </div>
                            <div>
                              <label className="block text-xs text-slate-400 mb-1">Defense Eff. (1-10)</label>
                              <input type="number" className="bg-slate-950 border border-slate-700 rounded px-2 py-1 w-full text-white" value={editForm.defenseEffectiveness || 0} onChange={e => setEditForm({...editForm, defenseEffectiveness: parseInt(e.target.value)})} />
                            </div>
                            <div className="col-span-2 md:col-span-4">
                              <label className="block text-xs text-slate-400 mb-1">Comments</label>
                              <textarea className="bg-slate-950 border border-slate-700 rounded px-2 py-1 w-full text-white h-20" value={editForm.comments || ''} onChange={e => setEditForm({...editForm, comments: e.target.value})} />
                            </div>
                          </div>
                          <div className="flex justify-end space-x-2">
                            <button onClick={handleSave} className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded hover:bg-emerald-500 font-bold">
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
                            <div className="flex items-center gap-2">
                              {match.matchKey.toUpperCase()}
                              {match.editHistory && match.editHistory.length > 0 && (
                                <span className="px-1.5 py-0.5 bg-amber-900/50 text-amber-400 text-[10px] font-black rounded uppercase tracking-wider">Edited</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 font-mono text-emerald-400">{match.teamNumber}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-black px-2 py-0.5 rounded ${match.alliance === 'Red' ? 'bg-red-900/50 text-red-400' : 'bg-blue-900/50 text-blue-400'}`}>
                              {match.alliance.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-300">{match.scoutName}</td>
                          <td className="px-4 py-3 text-slate-500 font-mono text-xs">
                            {new Date(match.timestamp || 0).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right space-x-2">
                            {match.editHistory && match.editHistory.length > 0 && (
                              <button onClick={() => toggleHistory(match.id)} className="p-1.5 bg-slate-800 text-slate-400 rounded hover:bg-slate-700 hover:text-white" title="View History">
                                {expandedHistoryId === match.id ? <ChevronUp className="w-4 h-4" /> : <History className="w-4 h-4" />}
                              </button>
                            )}
                            <button onClick={() => handleEdit(match)} className="p-1.5 bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30">
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDelete(match.id)} className="p-1.5 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </>
                      )}
                    </tr>
                    {expandedHistoryId === match.id && match.editHistory && (
                      <tr className="bg-slate-900/80 border-t border-slate-800">
                        <td colSpan={6} className="p-4">
                          <h4 className="text-sm font-bold text-slate-300 mb-2 flex items-center gap-2">
                            <History className="w-4 h-4" /> Edit History
                          </h4>
                          <ul className="space-y-2">
                            {match.editHistory.map((entry, idx) => (
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
    </div>
  );
}
