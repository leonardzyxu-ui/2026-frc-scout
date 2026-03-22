import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, deleteDoc, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { MatchScoutingV2 } from '../types';
import { Edit2, Trash2, Search, X, Check, AlertTriangle } from 'lucide-react';

interface RawDataEditorViewProps {
  eventKey: string;
}

export default function RawDataEditorView({ eventKey }: RawDataEditorViewProps) {
  const [data, setData] = useState<MatchScoutingV2[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<MatchScoutingV2>>({});

  const fetchData = async () => {
    setIsLoading(true);
    try {
      if (eventKey === 'TEST') {
        setData([]);
        setIsLoading(false);
        return;
      }
      const snapshot = await getDocs(collection(db, 'events', eventKey, 'matchScouting'));
      const matches: MatchScoutingV2[] = [];
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
    if (!window.confirm("Are you sure you want to delete this record? This cannot be undone.")) return;
    try {
      await deleteDoc(doc(db, 'events', eventKey, 'matchScouting', id));
      setData(prev => prev.filter(item => (item as any).id !== id));
    } catch (error) {
      console.error("Error deleting document:", error);
      alert("Failed to delete record.");
    }
  };

  const handleEdit = (match: MatchScoutingV2 & { id?: string }) => {
    setEditingId(match.id || null);
    setEditForm(match);
  };

  const handleSave = async () => {
    if (!editingId) return;
    try {
      const originalDoc = data.find((item: any) => item.id === editingId);
      if (!originalDoc) return;

      const newDocId = `${editForm.matchKey}_${editForm.teamNumber}`;
      
      if (newDocId !== editingId) {
        // ID changed, create new doc and delete old
        const newDocRef = doc(db, 'events', eventKey, 'matchScouting', newDocId);
        await setDoc(newDocRef, { ...originalDoc, ...editForm });
        await deleteDoc(doc(db, 'events', eventKey, 'matchScouting', editingId));
        
        setData(prev => prev.map(item => (item as any).id === editingId ? { ...item, ...editForm, id: newDocId } : item));
      } else {
        // ID same, just update
        const docRef = doc(db, 'events', eventKey, 'matchScouting', editingId);
        await updateDoc(docRef, editForm);
        setData(prev => prev.map(item => (item as any).id === editingId ? { ...item, ...editForm } : item));
      }
      
      setEditingId(null);
    } catch (error) {
      console.error("Error updating document:", error);
      alert("Failed to update record.");
    }
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
                filteredData.map((match: any) => (
                  <tr key={match.id} className="hover:bg-slate-800/50 transition-colors">
                    {editingId === match.id ? (
                      <>
                        <td className="px-4 py-2">
                          <input 
                            className="bg-slate-950 border border-slate-700 rounded px-2 py-1 w-20 text-white"
                            value={editForm.matchKey || ''}
                            onChange={e => setEditForm({...editForm, matchKey: e.target.value})}
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input 
                            className="bg-slate-950 border border-slate-700 rounded px-2 py-1 w-20 text-white"
                            value={editForm.teamNumber || ''}
                            onChange={e => setEditForm({...editForm, teamNumber: e.target.value})}
                          />
                        </td>
                        <td className="px-4 py-2">
                          <select 
                            className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white"
                            value={editForm.alliance || ''}
                            onChange={e => setEditForm({...editForm, alliance: e.target.value as any})}
                          >
                            <option value="Red">Red</option>
                            <option value="Blue">Blue</option>
                          </select>
                        </td>
                        <td className="px-4 py-2">
                          <input 
                            className="bg-slate-950 border border-slate-700 rounded px-2 py-1 w-24 text-white"
                            value={editForm.scoutName || ''}
                            onChange={e => setEditForm({...editForm, scoutName: e.target.value})}
                          />
                        </td>
                        <td className="px-4 py-2 text-slate-400 font-mono text-xs">
                          {new Date(match.timestamp || 0).toLocaleString()}
                        </td>
                        <td className="px-4 py-2 text-right space-x-2">
                          <button onClick={handleSave} className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded hover:bg-emerald-500/30">
                            <Check className="w-4 h-4" />
                          </button>
                          <button onClick={() => setEditingId(null)} className="p-1.5 bg-slate-700 text-slate-300 rounded hover:bg-slate-600">
                            <X className="w-4 h-4" />
                          </button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3 font-bold text-white">{match.matchKey.toUpperCase()}</td>
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
                          <button onClick={() => handleEdit(match)} className="p-1.5 bg-slate-800 text-slate-300 rounded hover:bg-slate-700 transition">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete(match.id)} className="p-1.5 bg-red-900/30 text-red-400 rounded hover:bg-red-900/50 transition">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      <div className="bg-amber-900/20 border border-amber-900/50 rounded-lg p-4 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
        <div className="text-sm text-amber-200/80">
          <strong className="text-amber-400 block mb-1">Warning: Direct Database Access</strong>
          Editing raw data directly modifies the Firestore database. Changes here will immediately affect analytics and team lookups. Use with caution.
        </div>
      </div>
    </div>
  );
}
