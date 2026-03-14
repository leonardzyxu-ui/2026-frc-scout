import React, { useState } from 'react';
import { TeamStats, MatchData } from '../../types';
import Heatmap from './Heatmap';
import { GoogleGenAI } from '@google/genai';
import ReactMarkdown from 'react-markdown';
import { doc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase';

interface TeamLookupProps {
  teamDataMap: Record<string, TeamStats>;
  rawMatches: MatchData[];
  onRefresh: () => void;
}

export default function TeamLookup({ teamDataMap, rawMatches, onRefresh }: TeamLookupProps) {
  const [searchTeam, setSearchTeam] = useState('');
  const [activeTeam, setActiveTeam] = useState<TeamStats | null>(null);
  const [aiInsights, setAiInsights] = useState<string | null>(null);
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [selectedMatches, setSelectedMatches] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);

  const handleSearch = () => {
    if (teamDataMap[searchTeam]) {
      setActiveTeam(teamDataMap[searchTeam]);
      setAiInsights(null); // Reset AI insights on new search
      setSelectedMatches(new Set());
    } else {
      setActiveTeam(null);
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedMatches);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedMatches(newSelected);
  };

  const toggleSelectAll = () => {
    if (!activeTeam) return;
    if (selectedMatches.size === activeTeam.matches.length) {
      setSelectedMatches(new Set());
    } else {
      setSelectedMatches(new Set(activeTeam.matches.map(m => m.docId!)));
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedMatches.size === 0) return;
    if (!window.confirm(`Are you sure you want to permanently delete ${selectedMatches.size} matches?`)) return;

    setIsSaving(true);
    try {
      const promises = Array.from(selectedMatches).map(id => deleteDoc(doc(db, 'matches', id)));
      await Promise.all(promises);
      setSelectedMatches(new Set());
      onRefresh();
      // Also clear active team since its data is now stale
      setActiveTeam(null);
    } catch (err) {
      console.error("Error deleting matches:", err);
      alert("Failed to delete some matches.");
    }
    setIsSaving(false);
  };

  const handleExportSelected = () => {
    if (selectedMatches.size === 0 || !activeTeam) return;
    
    const matchesToExport = activeTeam.matches.filter(m => selectedMatches.has(m.docId!));
    
    // Create CSV header
    const headers = ["Match", "Team", "Scout", "Alliance", "Auto Score", "Teleop Fuel", "Endgame", "Notes"];
    
    // Create CSV rows
    const rows = matchesToExport.map(m => [
      m.match,
      m.team,
      m.scout,
      m.alliance,
      m.counters.auto_score,
      m.counters.teleop_fuel,
      m.endgame,
      `"${m.notes.replace(/"/g, '""')}"` // Escape quotes in notes
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `team_${activeTeam.team}_matches_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const fetchAiInsights = async () => {
    if (!activeTeam) return;
    setIsLoadingAi(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Find recent news, performance, and information about FIRST Robotics Competition (FRC) Team ${activeTeam.team}. Summarize their history and any notable achievements.`,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });
      setAiInsights(response.text || "No insights found.");
    } catch (error: any) {
      console.error("AI Error:", error);
      setAiInsights(`Failed to load AI insights. Error: ${error.message || JSON.stringify(error)}`);
    } finally {
      setIsLoadingAi(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col p-6 overflow-y-auto h-full">
      <div className="flex gap-4 items-center mb-8 shrink-0">
        <input 
          type="number" 
          value={searchTeam}
          onChange={(e) => setSearchTeam(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          className="bg-black/50 border-2 border-blue-500 rounded-xl p-4 text-3xl font-black w-64 outline-none focus:border-blue-400 text-white" 
          placeholder="Team #"
        />
        <button 
          onClick={handleSearch}
          className="bg-blue-600 px-8 py-4 rounded-xl font-black text-xl hover:bg-blue-500 transition shadow-lg active:scale-95 text-white"
        >
          Search
        </button>
      </div>

      {!activeTeam ? (
        <div className="flex-1 flex items-center justify-center text-slate-600 font-bold text-xl">
          {searchTeam && !teamDataMap[searchTeam] ? `No data found for Team ${searchTeam}.` : "Enter a team number to see data."}
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            <div className="bg-slate-800/70 backdrop-blur-md rounded-xl border border-white/10 p-4 flex flex-col items-center justify-center bg-green-900/20 border-green-500/30">
              <span className="text-xs text-green-400 font-bold uppercase tracking-widest text-center">Avg Bot Pts</span>
              <span className="text-4xl font-black mt-1">{activeTeam.avgPoints}</span>
            </div>
            <div className="bg-slate-800/70 backdrop-blur-md rounded-xl border border-white/10 p-4 flex flex-col items-center justify-center">
              <span className="text-xs text-blue-400 font-bold uppercase tracking-widest text-center">Avg Auto</span>
              <span className="text-3xl font-black mt-1">{activeTeam.avgAuto}</span>
            </div>
            <div className="bg-slate-800/70 backdrop-blur-md rounded-xl border border-white/10 p-4 flex flex-col items-center justify-center">
              <span className="text-xs text-yellow-400 font-bold uppercase tracking-widest text-center">Avg Teleop</span>
              <span className="text-3xl font-black mt-1">{activeTeam.avgTeleop}</span>
            </div>
            <div className="bg-slate-800/70 backdrop-blur-md rounded-xl border border-white/10 p-4 flex flex-col items-center justify-center">
              <span className="text-xs text-purple-400 font-bold uppercase tracking-widest text-center">Avg Endgame</span>
              <span className="text-3xl font-black mt-1">{activeTeam.avgEndgame}</span>
            </div>
            <div className="bg-slate-800/70 backdrop-blur-md rounded-xl border border-white/10 p-4 flex flex-col items-center justify-center">
              <span className="text-xs text-orange-400 font-bold uppercase tracking-widest text-center">Avg Climb</span>
              <span className="text-3xl font-black mt-1" title="Auto Tower + Endgame Climb">{activeTeam.avgClimb}</span>
            </div>
            <div className="bg-slate-800/70 backdrop-blur-md rounded-xl border border-white/10 p-4 flex flex-col items-center justify-center bg-indigo-900/20">
              <span className="text-xs text-indigo-300 font-bold uppercase tracking-widest text-center">Total RPs</span>
              <span className="text-3xl font-black mt-1">{activeTeam.totRPs}</span>
            </div>
            <div className="bg-slate-800/70 backdrop-blur-md rounded-xl border border-white/10 p-4 flex flex-col items-center justify-center bg-red-900/20">
              <span className="text-xs text-red-400 font-bold uppercase tracking-widest text-center">Deaths</span>
              <span className="text-3xl font-black mt-1">{activeTeam.deaths}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Heatmap */}
            <div className="bg-slate-800/70 backdrop-blur-md rounded-xl border border-white/10 p-4">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Starting Positions</h3>
              <Heatmap positions={activeTeam.matches.map(m => m.startPos)} />
            </div>

            {/* AI Insights */}
            <div className="bg-slate-800/70 backdrop-blur-md rounded-xl border border-white/10 p-4 flex flex-col">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">AI Insights (Google Search)</h3>
                <button 
                  onClick={fetchAiInsights}
                  disabled={isLoadingAi}
                  className="bg-indigo-600 px-4 py-2 rounded font-bold text-xs hover:bg-indigo-500 transition active:scale-95 text-white disabled:opacity-50"
                >
                  {isLoadingAi ? 'Generating...' : '✨ Generate Insights'}
                </button>
              </div>
              <div className="flex-1 bg-slate-900/50 rounded-lg p-4 overflow-y-auto text-sm text-slate-300">
                {aiInsights ? (
                  <div className="markdown-body prose prose-invert max-w-none">
                    <ReactMarkdown>{aiInsights}</ReactMarkdown>
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-500 italic">
                    Click generate to search the web for recent info on Team {activeTeam.team}.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Match History Table */}
          <div className="bg-slate-800/70 backdrop-blur-md rounded-xl border border-white/10 overflow-hidden mt-4">
            <div className="p-4 bg-slate-800 border-b border-slate-700 flex justify-between items-center">
              <span className="font-bold uppercase tracking-widest text-sm">Match History</span>
              <div className="flex gap-4 items-center">
                {selectedMatches.size > 0 && (
                  <span className="text-sm text-gray-400 font-bold">{selectedMatches.size} Selected</span>
                )}
                <button 
                  onClick={handleExportSelected}
                  disabled={selectedMatches.size === 0 || isSaving}
                  className="bg-blue-600 px-4 py-2 rounded font-bold text-xs hover:bg-blue-500 transition active:scale-95 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  📊 Export CSV
                </button>
                <button 
                  onClick={handleDeleteSelected}
                  disabled={selectedMatches.size === 0 || isSaving}
                  className="bg-red-600 px-4 py-2 rounded font-bold text-xs hover:bg-red-500 transition active:scale-95 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  🗑️ Delete Selected
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left whitespace-nowrap">
                <thead className="text-[10px] uppercase bg-slate-900 text-slate-400">
                  <tr>
                    <th className="px-4 py-3 w-12">
                      <input 
                        type="checkbox" 
                        checked={selectedMatches.size === activeTeam.matches.length && activeTeam.matches.length > 0}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500"
                      />
                    </th>
                    <th className="px-4 py-3">Match</th>
                    <th className="px-4 py-3 text-green-400 font-bold border-l border-slate-700">Bot Pts</th>
                    <th className="px-4 py-3 text-blue-300">Auto</th>
                    <th className="px-4 py-3 text-yellow-400">TeleFuel</th>
                    <th className="px-4 py-3 text-purple-400 border-r border-slate-700">Endgame</th>
                    <th className="px-4 py-3">Mob/Twr</th>
                    <th className="px-4 py-3 border-l border-slate-700 bg-indigo-900/20">Alli Score</th>
                    <th className="px-4 py-3 bg-indigo-900/20 border-r border-slate-700">Reported RPs</th>
                    <th className="px-4 py-3 text-slate-400">Scout</th>
                    <th className="px-4 py-3">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {[...activeTeam.matches].sort((a,b) => b.match - a.match).map(m => {
                    const rps = m.rp;
                    const dFlag = m.toggles.robot_died ? <span className="text-red-500 ml-1" title={`Died: ${m.diedReason}`}>☠️</span> : null;
                    return (
                      <tr key={m.docId} className={`border-b border-slate-800 hover:bg-slate-800/50 ${selectedMatches.has(m.docId!) ? 'bg-blue-900/20' : ''}`}>
                        <td className="px-4 py-2">
                          <input 
                            type="checkbox" 
                            checked={selectedMatches.has(m.docId!)}
                            onChange={() => toggleSelect(m.docId!)}
                            className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-4 py-2 font-mono text-slate-300">Q{m.match}</td>
                        <td className="px-4 py-2 font-black text-green-400 border-l border-slate-700">{(m as any).totalScore}{dFlag}</td>
                        <td className="px-4 py-2 text-blue-300">{(m as any).autoTotal}</td>
                        <td className="px-4 py-2 font-bold text-yellow-400">{m.counters.teleop_fuel}</td>
                        <td className="px-4 py-2 font-bold text-purple-400 border-r border-slate-700">{m.endgame === 'None' ? '-' : m.endgame} ({(m as any).ptsEndgame})</td>
                        <td className="px-4 py-2 text-slate-400">{m.toggles.auto_mobility ? 'Yes' : '-'} / {m.toggles.auto_tower ? 'L1' : '-'}</td>
                        <td className="px-4 py-2 font-mono text-indigo-300 bg-indigo-900/20 border-l border-slate-700">{m.allianceScore}</td>
                        <td className="px-4 py-2 bg-indigo-900/20 border-r border-slate-700">
                          {rps.win && <span className="inline-flex items-center px-1.5 py-0.5 rounded font-black text-[10px] mr-1 bg-green-500 text-black">W</span>}
                          {rps.tie && <span className="inline-flex items-center px-1.5 py-0.5 rounded font-black text-[10px] mr-1 bg-slate-400 text-black">T</span>}
                          {rps.fuel100 && <span className="inline-flex items-center px-1.5 py-0.5 rounded font-black text-[10px] mr-1 bg-yellow-500 text-black">E</span>}
                          {rps.fuel360 && <span className="inline-flex items-center px-1.5 py-0.5 rounded font-black text-[10px] mr-1 bg-red-500 text-white">S</span>}
                          {rps.climb && <span className="inline-flex items-center px-1.5 py-0.5 rounded font-black text-[10px] mr-1 bg-purple-500 text-white">C</span>}
                        </td>
                        <td className="px-4 py-2 text-[10px] text-blue-300 font-bold">{m.scout}</td>
                        <td className="px-4 py-2 text-xs text-slate-500 max-w-[200px] truncate cursor-help border-l border-slate-700" title={m.notes}>{m.notes}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
