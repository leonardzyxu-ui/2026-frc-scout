import React, { useState, useEffect, useMemo } from 'react';
import { TeamStats, MatchData } from '../../types';
import { doc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase';

interface LeaderboardProps {
  data: TeamStats[];
  rawMatches: MatchData[];
  onRefresh: () => void;
}

type SortKey = keyof TeamStats | 'matches';
type MatchSortKey = 'match' | 'dataPoints' | 'scouts' | 'teams';

export default function Leaderboard({ data, rawMatches, onRefresh }: LeaderboardProps) {
  const [groupBy, setGroupBy] = useState<'team' | 'match'>('team');
  
  // Team Sort State
  const [sortCol, setSortCol] = useState<SortKey>('avgPoints');
  const [sortAsc, setSortAsc] = useState(false);
  
  // Match Sort State
  const [matchSortCol, setMatchSortCol] = useState<MatchSortKey>('match');
  const [matchSortAsc, setMatchSortAsc] = useState(true);

  // Selection State
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragSelectState, setDragSelectState] = useState(true);
  
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const handleGlobalMouseUp = () => setIsDragging(false);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);

  // Reset selection when grouping changes
  useEffect(() => {
    setSelectedItems(new Set());
    setLastSelectedIndex(null);
  }, [groupBy]);

  // --- Data Processing ---
  const matchStats = useMemo(() => {
    const map = new Map<number, { match: number, dataPoints: number, scouts: Set<string>, teams: Set<string> }>();
    rawMatches.forEach(m => {
      if (!map.has(m.match)) {
        map.set(m.match, { match: m.match, dataPoints: 0, scouts: new Set(), teams: new Set() });
      }
      const st = map.get(m.match)!;
      st.dataPoints++;
      if (m.scout) st.scouts.add(m.scout);
      if (m.team) st.teams.add(m.team);
    });
    return Array.from(map.values());
  }, [rawMatches]);

  const sortedTeamData = useMemo(() => {
    return [...data].sort((a, b) => {
      let valA: any = sortCol === 'matches' ? a.matches.length : a[sortCol];
      let valB: any = sortCol === 'matches' ? b.matches.length : b[sortCol];
      if (sortCol === 'team') {
        valA = parseInt(valA) || valA;
        valB = parseInt(valB) || valB;
      }
      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [data, sortCol, sortAsc]);

  const sortedMatchData = useMemo(() => {
    return [...matchStats].sort((a, b) => {
      let valA: any = a[matchSortCol];
      let valB: any = b[matchSortCol];
      if (matchSortCol === 'scouts') { valA = a.scouts.size; valB = b.scouts.size; }
      if (matchSortCol === 'teams') { valA = a.teams.size; valB = b.teams.size; }
      
      if (valA < valB) return matchSortAsc ? -1 : 1;
      if (valA > valB) return matchSortAsc ? 1 : -1;
      return 0;
    });
  }, [matchStats, matchSortCol, matchSortAsc]);

  const currentData = groupBy === 'team' ? sortedTeamData : sortedMatchData;

  // --- Selection Logic ---
  const handleRowMouseDown = (id: string, index: number, e: React.MouseEvent) => {
    if (e.shiftKey && lastSelectedIndex !== null) {
      // Shift-click bulk select
      const start = Math.min(lastSelectedIndex, index);
      const end = Math.max(lastSelectedIndex, index);
      const isSelecting = !selectedItems.has(id);
      const newSelected = new Set(selectedItems);
      for (let i = start; i <= end; i++) {
        const rowId = groupBy === 'team' ? (currentData[i] as TeamStats).team : (currentData[i] as any).match.toString();
        if (isSelecting) newSelected.add(rowId);
        else newSelected.delete(rowId);
      }
      setSelectedItems(newSelected);
      setLastSelectedIndex(index);
      // Prevent text selection while shift clicking
      e.preventDefault();
    } else {
      // Normal click / start drag
      setIsDragging(true);
      const isSelecting = !selectedItems.has(id);
      setDragSelectState(isSelecting);
      
      const newSelected = new Set(selectedItems);
      if (isSelecting) newSelected.add(id);
      else newSelected.delete(id);
      setSelectedItems(newSelected);
      setLastSelectedIndex(index);
    }
  };

  const handleRowMouseEnter = (id: string, index: number) => {
    if (isDragging) {
      const newSelected = new Set(selectedItems);
      if (dragSelectState) newSelected.add(id);
      else newSelected.delete(id);
      setSelectedItems(newSelected);
      setLastSelectedIndex(index);
    }
  };

  const toggleSelectAll = () => {
    if (selectedItems.size === currentData.length && currentData.length > 0) {
      setSelectedItems(new Set());
    } else {
      const allIds = currentData.map(d => groupBy === 'team' ? (d as TeamStats).team : (d as any).match.toString());
      setSelectedItems(new Set(allIds));
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedItems.size === 0) return;
    const msg = groupBy === 'team' 
      ? `Are you sure you want to permanently delete ALL matches for the ${selectedItems.size} selected teams?`
      : `Are you sure you want to permanently delete ALL data points for the ${selectedItems.size} selected matches?`;
      
    if (!window.confirm(msg)) return;

    setIsSaving(true);
    try {
      let matchesToDelete: MatchData[] = [];
      if (groupBy === 'team') {
        matchesToDelete = rawMatches.filter(m => selectedItems.has(m.team));
      } else {
        matchesToDelete = rawMatches.filter(m => selectedItems.has(m.match.toString()));
      }
      
      const promises = matchesToDelete.map(m => deleteDoc(doc(db, 'matches', m.docId!)));
      await Promise.all(promises);
      setSelectedItems(new Set());
      onRefresh();
    } catch (err) {
      console.error("Error deleting matches:", err);
      alert("Failed to delete some matches.");
    }
    setIsSaving(false);
  };

  const requestSort = (col: SortKey) => {
    if (sortCol === col) setSortAsc(!sortAsc);
    else { setSortCol(col); setSortAsc(col === 'team'); }
  };

  const requestMatchSort = (col: MatchSortKey) => {
    if (matchSortCol === col) setMatchSortAsc(!matchSortAsc);
    else { setMatchSortCol(col); setMatchSortAsc(col === 'match'); }
  };

  const exportCSV = () => {
    if (groupBy === 'team') {
      const dataToExport = selectedItems.size > 0 
        ? sortedTeamData.filter(t => selectedItems.has(t.team))
        : sortedTeamData;

      if (dataToExport.length === 0) return alert("No data to export");
      let csvContent = "data:text/csv;charset=utf-8,Team,MatchesPlayed,AvgReportedRP,TotalReportedRP,AvgBotPoints,TotalBotPoints,AvgAuto,TotalAuto,AvgTeleopFuel,TotalTeleopFuel,AvgEndgame,TotalEndgame,Deaths,Scouts\n";
      
      dataToExport.forEach(t => {
        const scoutList = Array.from(t.scouts).join(" / ");
        const row = [
          t.team, t.matches.length, t.avgRPs, t.totRPs, t.avgPoints, t.totPoints, 
          t.avgAuto, t.totAuto, t.avgTeleop, t.totTeleop, t.avgEndgame, t.totEndgame, 
          t.deaths, `"${scoutList}"`
        ].join(",");
        csvContent += row + "\r\n";
      });
      
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `REBUILT_Leaderboard_Teams_${new Date().toISOString().slice(0,10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      const dataToExport = selectedItems.size > 0 
        ? sortedMatchData.filter(m => selectedItems.has(m.match.toString()))
        : sortedMatchData;

      if (dataToExport.length === 0) return alert("No data to export");
      let csvContent = "data:text/csv;charset=utf-8,Match,DataPoints,TeamsScouted,Scouts\n";
      
      dataToExport.forEach(m => {
        const teamList = Array.from(m.teams).join(" / ");
        const scoutList = Array.from(m.scouts).join(" / ");
        const row = [
          m.match, m.dataPoints, `"${teamList}"`, `"${scoutList}"`
        ].join(",");
        csvContent += row + "\r\n";
      });
      
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `REBUILT_Leaderboard_Matches_${new Date().toISOString().slice(0,10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const Th = ({ label, sortKey, className = '' }: { label: string, sortKey: SortKey, className?: string }) => (
    <th 
      className={`px-4 py-3 cursor-pointer select-none hover:bg-white/5 transition-colors ${className}`} 
      onClick={() => requestSort(sortKey)}
    >
      {label}
      <span className={`ml-1 text-[10px] ${sortCol === sortKey ? 'opacity-100 text-blue-400' : 'opacity-30'}`}>
        {sortCol === sortKey ? (sortAsc ? '▲' : '▼') : '▼'}
      </span>
    </th>
  );

  const MatchTh = ({ label, sortKey, className = '' }: { label: string, sortKey: MatchSortKey, className?: string }) => (
    <th 
      className={`px-4 py-3 cursor-pointer select-none hover:bg-white/5 transition-colors ${className}`} 
      onClick={() => requestMatchSort(sortKey)}
    >
      {label}
      <span className={`ml-1 text-[10px] ${matchSortCol === sortKey ? 'opacity-100 text-blue-400' : 'opacity-30'}`}>
        {matchSortCol === sortKey ? (matchSortAsc ? '▲' : '▼') : '▼'}
      </span>
    </th>
  );

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 bg-slate-800/50 border-b border-slate-700 flex justify-between items-center shrink-0 flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-700">
            <button 
              onClick={() => setGroupBy('team')}
              className={`px-4 py-1.5 text-sm font-bold rounded-md transition-colors ${groupBy === 'team' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              By Team
            </button>
            <button 
              onClick={() => setGroupBy('match')}
              className={`px-4 py-1.5 text-sm font-bold rounded-md transition-colors ${groupBy === 'match' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              By Match
            </button>
          </div>
          <span className="text-xs font-bold text-slate-400">
            Tip: Click & drag across rows, or Shift+Click to select multiple.
          </span>
        </div>

        <div className="flex gap-4 items-center">
          {selectedItems.size > 0 && (
            <span className="text-sm text-gray-400 font-bold">{selectedItems.size} Selected</span>
          )}
          <button onClick={exportCSV} className="bg-emerald-600 px-4 py-2 rounded font-bold text-xs hover:bg-emerald-500 transition active:scale-95 text-white">
            📊 Export CSV
          </button>
          <button 
            onClick={handleDeleteSelected}
            disabled={selectedItems.size === 0 || isSaving}
            className="bg-red-600 px-4 py-2 rounded font-bold text-xs hover:bg-red-500 transition active:scale-95 text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            🗑️ Delete Selected
          </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-auto select-none">
        <table className="w-full text-sm text-left whitespace-nowrap">
          <thead className="text-[10px] uppercase bg-slate-950 text-slate-400 sticky top-0 z-10 shadow-md">
            <tr>
              <th className="px-4 py-3 w-12">
                <input 
                  type="checkbox" 
                  checked={selectedItems.size === currentData.length && currentData.length > 0}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
              </th>
              {groupBy === 'team' ? (
                <>
                  <Th label="Team" sortKey="team" />
                  <Th label="Matches" sortKey="matches" className="border-r border-slate-800" />
                  <Th label="Avg RP" sortKey="avgRPs" className="text-indigo-300 bg-indigo-900/10" />
                  <Th label="Tot RP" sortKey="totRPs" className="text-indigo-300 bg-indigo-900/10 border-r border-slate-800" />
                  <Th label="Avg Bot Pts" sortKey="avgPoints" className="text-green-400 bg-green-900/10" />
                  <Th label="Total Bot Pts" sortKey="totPoints" className="text-green-400 bg-green-900/10 border-r border-slate-800" />
                  <Th label="Avg Auto" sortKey="avgAuto" className="text-blue-300" />
                  <Th label="Tot Auto" sortKey="totAuto" className="text-blue-300 border-r border-slate-800" />
                  <Th label="Avg Teleop" sortKey="avgTeleop" className="text-yellow-400" />
                  <Th label="Tot Teleop" sortKey="totTeleop" className="text-yellow-400 border-r border-slate-800" />
                  <Th label="Avg Endgame" sortKey="avgEndgame" className="text-purple-400" />
                  <Th label="Tot Endgame" sortKey="totEndgame" className="text-purple-400 border-r border-slate-800" />
                  <Th label="Deaths" sortKey="deaths" className="text-red-400 border-r border-slate-800" />
                  <th className="px-4 py-3 text-slate-500">Scouts</th>
                </>
              ) : (
                <>
                  <MatchTh label="Match #" sortKey="match" className="border-r border-slate-800" />
                  <MatchTh label="Data Points" sortKey="dataPoints" className="text-blue-400 bg-blue-900/10 border-r border-slate-800" />
                  <MatchTh label="Teams Scouted" sortKey="teams" className="text-slate-300 border-r border-slate-800" />
                  <MatchTh label="Scouts" sortKey="scouts" className="text-slate-400" />
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {currentData.length === 0 ? (
              <tr><td colSpan={20} className="p-8 text-center text-slate-500">No data.</td></tr>
            ) : (
              groupBy === 'team' ? (
                sortedTeamData.map((t, index) => {
                  const id = t.team;
                  const isSelected = selectedItems.has(id);
                  return (
                    <tr 
                      key={id} 
                      onMouseDown={(e) => handleRowMouseDown(id, index, e)}
                      onMouseEnter={() => handleRowMouseEnter(id, index)}
                      className={`hover:bg-slate-800 transition-colors cursor-pointer ${isSelected ? 'bg-blue-900/30' : ''}`}
                    >
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <input 
                          type="checkbox" 
                          checked={isSelected}
                          readOnly
                          className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500 pointer-events-none"
                        />
                      </td>
                      <td className="px-4 py-3 font-black text-white text-base">{t.team}</td>
                      <td className="px-4 py-3 font-mono text-slate-400 border-r border-slate-800">{t.matches.length}</td>
                      <td className="px-4 py-3 font-bold text-indigo-300 bg-indigo-900/10">{t.avgRPs}</td>
                      <td className="px-4 py-3 text-indigo-400 bg-indigo-900/10 border-r border-slate-800">{t.totRPs}</td>
                      <td className="px-4 py-3 font-black text-green-400 bg-green-900/10 text-base">{t.avgPoints}</td>
                      <td className="px-4 py-3 font-bold text-green-500 bg-green-900/10 border-r border-slate-800">{t.totPoints}</td>
                      <td className="px-4 py-3 font-bold text-blue-300">{t.avgAuto}</td>
                      <td className="px-4 py-3 text-blue-400 border-r border-slate-800">{t.totAuto}</td>
                      <td className="px-4 py-3 font-bold text-yellow-400">{t.avgTeleop}</td>
                      <td className="px-4 py-3 text-yellow-500 border-r border-slate-800">{t.totTeleop}</td>
                      <td className="px-4 py-3 font-bold text-purple-400">{t.avgEndgame}</td>
                      <td className="px-4 py-3 text-purple-500 border-r border-slate-800">{t.totEndgame}</td>
                      <td className={`px-4 py-3 font-bold border-r border-slate-800 ${t.deaths > 0 ? 'text-red-500' : 'text-slate-600'}`}>{t.deaths}</td>
                      <td className="px-4 py-3 text-xs text-slate-500 truncate max-w-[120px]" title={Array.from(t.scouts).join(", ")}>
                        {Array.from(t.scouts).join(", ")}
                      </td>
                    </tr>
                  );
                })
              ) : (
                sortedMatchData.map((m, index) => {
                  const id = m.match.toString();
                  const isSelected = selectedItems.has(id);
                  return (
                    <tr 
                      key={id} 
                      onMouseDown={(e) => handleRowMouseDown(id, index, e)}
                      onMouseEnter={() => handleRowMouseEnter(id, index)}
                      className={`hover:bg-slate-800 transition-colors cursor-pointer ${isSelected ? 'bg-blue-900/30' : ''}`}
                    >
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <input 
                          type="checkbox" 
                          checked={isSelected}
                          readOnly
                          className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500 pointer-events-none"
                        />
                      </td>
                      <td className="px-4 py-3 font-black text-white text-base border-r border-slate-800">Q{m.match}</td>
                      <td className={`px-4 py-3 font-bold bg-blue-900/10 border-r border-slate-800 ${m.dataPoints < 6 ? 'text-red-400' : 'text-blue-400'}`}>
                        {m.dataPoints} {m.dataPoints < 6 && '⚠️'}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-300 border-r border-slate-800">
                        {Array.from(m.teams).join(", ")}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-400">
                        {Array.from(m.scouts).join(", ")}
                      </td>
                    </tr>
                  );
                })
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
