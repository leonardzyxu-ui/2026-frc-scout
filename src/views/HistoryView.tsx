import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { useScout } from '../context/ScoutContext';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import NumberInput from '../components/NumberInput';

import { useLocalFile } from '../context/LocalFileContext';

// Re-use the generateQRString logic or import it if possible.
// Since it's in CheckoutView, I'll just copy the simple version here for history display.
const generateQRString = (data: any) => {
  const rps = data.rp || {};
  let safeNotes = (data.notes || "").replace(/\|/g, '-').replace(/\n/g, ' ');
  if (safeNotes.length > 250) safeNotes = safeNotes.substring(0, 250);
  return `V5|${data.match}|${data.team}|${data.alliance?.[0] || 'U'}|${data.counters?.auto_score || 0}|${data.toggles?.auto_tower?1:0}|${data.toggles?.auto_mobility?1:0}|${data.counters?.teleop_fuel || 0}|${data.counters?.hoard_fuel || 0}|${data.endgame || 'None'}|${rps.win?1:0}|${rps.tie?1:0}|${rps.fuel100?1:0}|${rps.fuel360?1:0}|${rps.climb?1:0}|${data.toggles?.robot_died?1:0}|${data.scout || 'Unknown'}|${data.allianceScore || 0}|${data.startPos?.x || 0}|${data.startPos?.y || 0}|${safeNotes}|${data.deviceId || ''}|${data.userAgent || ''}`;
};

export default function HistoryView() {
  const navigate = useNavigate();
  const { matchData } = useScout();
  const { fileHandle } = useLocalFile();
  const [history, setHistory] = useState<any[]>([]);
  const [cloudMatches, setCloudMatches] = useState<any[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<any | null>(null);
  const [viewMode, setViewMode] = useState<'local' | 'cloud'>('local');
  const [editingMatch, setEditingMatch] = useState<any | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingCloud, setIsLoadingCloud] = useState(false);

  const isLocalMode = import.meta.env.VITE_LOCAL_MODE === 'true';

  useEffect(() => {
    const stored = localStorage.getItem('scout_history');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        parsed.sort((a: any, b: any) => b.match - a.match);
        setHistory(parsed);
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }
  }, []);

  const fetchCloudMatches = async () => {
    if (!matchData.deviceId || isLocalMode) return;
    setIsLoadingCloud(true);
    try {
      const q = query(collection(db, 'matches'), where('deviceId', '==', matchData.deviceId));
      const snapshot = await getDocs(q);
      const matches = snapshot.docs.map(doc => ({ ...doc.data(), docId: doc.id }));
      matches.sort((a: any, b: any) => b.match - a.match);
      setCloudMatches(matches);
    } catch (e) {
      console.error("Failed to fetch cloud matches", e);
    } finally {
      setIsLoadingCloud(false);
    }
  };

  useEffect(() => {
    if (viewMode === 'cloud') {
      fetchCloudMatches();
    }
  }, [viewMode, matchData.deviceId]);

  const clearHistory = () => {
    if (window.confirm("Are you sure you want to clear all match history? This cannot be undone.")) {
      localStorage.removeItem('scout_history');
      setHistory([]);
      setSelectedMatch(null);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingMatch) return;
    setIsSaving(true);
    
    if (viewMode === 'cloud' && editingMatch.docId) {
      try {
        const updateData = { ...editingMatch };
        delete updateData.docId;
        await updateDoc(doc(db, 'matches', editingMatch.docId), updateData);
        await fetchCloudMatches();
        setEditingMatch(null);
      } catch (e) {
        console.error("Failed to update cloud match", e);
        alert("Failed to update match.");
      }
    } else if (viewMode === 'local') {
      // Update local history
      const updatedHistory = history.map(m => m === selectedMatch ? editingMatch : m);
      setHistory(updatedHistory);
      localStorage.setItem('scout_history', JSON.stringify([...updatedHistory].reverse()));
      
      // Update file if available
      if (fileHandle) {
        try {
          const file = await fileHandle.getFile();
          const content = await file.text();
          let arr = [];
          if (content.trim()) {
            arr = JSON.parse(content);
          }
          if (Array.isArray(arr)) {
            const oldQR = generateQRString(selectedMatch);
            const newQR = generateQRString(editingMatch);
            const idx = arr.indexOf(oldQR);
            if (idx !== -1) {
              arr[idx] = newQR;
            } else {
              const matchIdx = arr.findIndex((qr: string) => {
                const parts = qr.split('|');
                return parts[1] == selectedMatch.match && parts[2] == selectedMatch.team;
              });
              if (matchIdx !== -1) {
                arr[matchIdx] = newQR;
              } else {
                arr.push(newQR);
              }
            }
            const writable = await fileHandle.createWritable();
            await writable.write(JSON.stringify(arr, null, 2));
            await writable.close();
          }
        } catch (e) {
          console.error("Failed to update local file", e);
          alert("Failed to update the output file. The local vault may be out of sync.");
        }
      }

      setEditingMatch(null);
      setSelectedMatch(editingMatch);
    }
    
    setIsSaving(false);
  };

  const currentList = viewMode === 'local' ? history : cloudMatches;

  return (
    <div className="flex flex-col h-full bg-slate-950 text-white p-4 md:p-6 overflow-y-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">
            MATCH HISTORY
          </h1>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">
            {viewMode === 'local' ? `${history.length} Matches Saved Locally` : `Cloud Matches for Scout: ${matchData.scout || 'Unknown'}`}
          </p>
        </div>
        <button 
          onClick={() => navigate('/')}
          className="bg-slate-800 px-4 py-2 rounded-lg font-bold text-sm text-slate-300 hover:bg-slate-700"
        >
          Back
        </button>
      </div>

      {!isLocalMode && (
        <div className="flex bg-slate-900 rounded-xl p-1 mb-6 border border-slate-800">
          <button 
            onClick={() => setViewMode('local')}
            className={`flex-1 py-2 rounded-lg font-bold text-sm transition-colors ${viewMode === 'local' ? 'bg-slate-800 text-white shadow' : 'text-slate-400 hover:text-white'}`}
          >
            Local Vault
          </button>
          <button 
            onClick={() => setViewMode('cloud')}
            className={`flex-1 py-2 rounded-lg font-bold text-sm transition-colors ${viewMode === 'cloud' ? 'bg-slate-800 text-white shadow' : 'text-slate-400 hover:text-white'}`}
          >
            Cloud Matches
          </button>
        </div>
      )}

      {viewMode === 'cloud' && isLoadingCloud ? (
        <div className="flex-1 flex items-center justify-center text-slate-500 font-bold animate-pulse">
          Loading cloud matches...
        </div>
      ) : currentList.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
          <div className="text-6xl mb-4">📭</div>
          <p className="font-bold">No match history found.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {viewMode === 'local' && (
            <button 
              onClick={clearHistory}
              className="w-full py-3 bg-red-900/30 border border-red-500/50 text-red-400 rounded-xl font-bold text-sm hover:bg-red-900/50 transition-colors"
            >
              🗑️ Clear All History
            </button>
          )}

          <div className="grid gap-4">
            {currentList.map((match, idx) => (
              <div key={idx} className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-4">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-2xl font-black text-white">Match {match.match}</div>
                    <div className="text-lg font-bold text-blue-400">Team {match.team}</div>
                    <div className="text-xs text-slate-500 mt-1">
                      {match.timestamp ? new Date(match.timestamp).toLocaleString() : 'Unknown Date'}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => {
                        setSelectedMatch(match);
                        setEditingMatch(JSON.parse(JSON.stringify(match)));
                      }}
                      className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-bold text-sm transition-colors"
                    >
                      Edit
                    </button>
                    {viewMode === 'local' && (
                      <button 
                        onClick={() => setSelectedMatch(selectedMatch === match ? null : match)}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg font-bold text-sm transition-colors"
                      >
                        {selectedMatch === match ? 'Hide QR' : 'Show QR'}
                      </button>
                    )}
                  </div>
                </div>

                {viewMode === 'local' && selectedMatch === match && !editingMatch && (
                  <div className="mt-4 pt-4 border-t border-slate-800 flex flex-col items-center gap-4">
                    <div className="bg-white p-4 rounded-xl">
                      <QRCodeSVG 
                        value={generateQRString(match)} 
                        size={256} 
                        level="L"
                        includeMargin={false}
                      />
                    </div>
                    <p className="text-xs text-slate-500 font-mono text-center break-all">
                      {generateQRString(match)}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

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
                  value={editingMatch.counters?.auto_score || 0} 
                  onChange={val => setEditingMatch({...editingMatch, counters: {...(editingMatch.counters || {}), auto_score: val}})}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Teleop Fuel</label>
                <NumberInput 
                  value={editingMatch.counters?.teleop_fuel || 0} 
                  onChange={val => setEditingMatch({...editingMatch, counters: {...(editingMatch.counters || {}), teleop_fuel: val}})}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Hoard Fuel</label>
                <NumberInput 
                  value={editingMatch.counters?.hoard_fuel || 0} 
                  onChange={val => setEditingMatch({...editingMatch, counters: {...(editingMatch.counters || {}), hoard_fuel: val}})}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white focus:border-blue-500 outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4 mb-4 bg-slate-950 p-4 rounded-lg border border-slate-700">
              <label className="flex items-center gap-2 text-sm text-white cursor-pointer">
                <input type="checkbox" checked={editingMatch.toggles?.auto_mobility || false} onChange={e => setEditingMatch({...editingMatch, toggles: {...(editingMatch.toggles || {}), auto_mobility: e.target.checked}})} className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-600" />
                Auto Mobility
              </label>
              <label className="flex items-center gap-2 text-sm text-white cursor-pointer">
                <input type="checkbox" checked={editingMatch.toggles?.auto_tower || false} onChange={e => setEditingMatch({...editingMatch, toggles: {...(editingMatch.toggles || {}), auto_tower: e.target.checked}})} className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-600" />
                Auto Tower
              </label>
              <label className="flex items-center gap-2 text-sm text-white cursor-pointer">
                <input type="checkbox" checked={editingMatch.toggles?.defense || false} onChange={e => setEditingMatch({...editingMatch, toggles: {...(editingMatch.toggles || {}), defense: e.target.checked}})} className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-600" />
                Defense
              </label>
              <label className="flex items-center gap-2 text-sm text-white cursor-pointer">
                <input type="checkbox" checked={editingMatch.toggles?.robot_died || false} onChange={e => setEditingMatch({...editingMatch, toggles: {...(editingMatch.toggles || {}), robot_died: e.target.checked}})} className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-600" />
                Robot Died
              </label>
            </div>

            {editingMatch.toggles?.robot_died && (
              <div className="mb-4">
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Death Reason</label>
                <input 
                  type="text" 
                  value={editingMatch.deathReason || ''} 
                  onChange={e => setEditingMatch({...editingMatch, deathReason: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white focus:border-blue-500 outline-none"
                  placeholder="Why did the robot die?"
                />
              </div>
            )}

            <div className="mb-4">
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Endgame</label>
              <select 
                value={editingMatch.endgame || 'None'} 
                onChange={e => setEditingMatch({...editingMatch, endgame: e.target.value as any})}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white focus:border-blue-500 outline-none"
              >
                <option value="None">None</option>
                <option value="Parked">Parked</option>
                <option value="Climbed">Climbed</option>
              </select>
            </div>

            <div className="mb-6">
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Notes</label>
              <textarea 
                value={editingMatch.notes || ''} 
                onChange={e => setEditingMatch({...editingMatch, notes: e.target.value})}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white focus:border-blue-500 outline-none"
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-4">
              <button 
                onClick={() => setEditingMatch(null)}
                className="px-6 py-2 rounded-lg font-bold text-gray-400 hover:text-white transition"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveEdit}
                disabled={isSaving}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-8 py-2 rounded-lg font-bold transition"
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
