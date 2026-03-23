import React, { useState, useEffect, useMemo } from 'react';
import { MathEngine, TeamMetrics } from '../utils/mathEngine';
import { ArrowDown, ArrowUp, Loader2 } from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { MatchScoutingV2 } from '../types';

interface TeamSorterViewProps {
  eventKey: string;
}

type SortField = 'team' | 'tbaRank' | 'opr' | 'dpr' | 'oprc' | 'autoOprc' | 'teleopOprc' | 'endgameOprc' | 'autoFluidity' | 'teleopFluidity';
type SortDirection = 'asc' | 'desc';

export default function TeamSorterView({ eventKey }: TeamSorterViewProps) {
  const [metrics, setMetrics] = useState<Record<string, TeamMetrics>>({});
  const [tbaRanks, setTbaRanks] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [sortField, setSortField] = useState<SortField>('oprc');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  useEffect(() => {
    const fetchMetricsAndRanks = async () => {
      setIsLoading(true);
      try {
        const tbaApiKey = import.meta.env.VITE_TBA_API_KEY;
        if (!tbaApiKey || eventKey === 'TEST') {
          setMetrics({});
          setTbaRanks({});
          setIsLoading(false);
          return;
        }

        const engine = new MathEngine(tbaApiKey);
        
        // Fetch TBA Matches & Ranks in parallel
        const [matches, ranksResponse] = await Promise.all([
          engine.fetchEventMatches(eventKey),
          fetch(`https://www.thebluealliance.com/api/v3/event/${eventKey}/rankings`, {
            headers: { 'X-TBA-Auth-Key': tbaApiKey }
          }).then(res => res.ok ? res.json() : null)
        ]);

        // Process TBA Ranks
        const ranks: Record<string, number> = {};
        if (ranksResponse && ranksResponse.rankings) {
          ranksResponse.rankings.forEach((r: any) => {
            const teamNum = r.team_key.replace('frc', '');
            ranks[teamNum] = r.rank;
          });
        }
        setTbaRanks(ranks);

        // Fetch Scouting Data
        const snapshot = await getDocs(collection(db, 'events', eventKey, 'matchScouting'));
        const scoutingData = snapshot.docs.map(doc => doc.data() as MatchScoutingV2);

        const calculatedMetrics = engine.calculateMetrics(matches, scoutingData);
        setMetrics(calculatedMetrics);
      } catch (error) {
        console.error("Error calculating metrics for sorter:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMetricsAndRanks();
  }, [eventKey]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sortedTeams = useMemo(() => {
    return Object.entries(metrics).sort((a, b) => {
      const [teamA, metricsA] = a;
      const [teamB, metricsB] = b;

      let valA, valB;
      switch (sortField) {
        case 'team':
          valA = parseInt(teamA);
          valB = parseInt(teamB);
          break;
        case 'tbaRank':
          valA = tbaRanks[teamA] || 999;
          valB = tbaRanks[teamB] || 999;
          break;
        case 'opr':
          valA = metricsA.opr;
          valB = metricsB.opr;
          break;
        case 'dpr':
          valA = metricsA.dpr;
          valB = metricsB.dpr;
          break;
        case 'oprc':
          valA = metricsA.oprc;
          valB = metricsB.oprc;
          break;
        case 'autoOprc':
          valA = metricsA.autoOprc;
          valB = metricsB.autoOprc;
          break;
        case 'teleopOprc':
          valA = metricsA.teleopOprc;
          valB = metricsB.teleopOprc;
          break;
        case 'endgameOprc':
          valA = metricsA.endgameOprc;
          valB = metricsB.endgameOprc;
          break;
        case 'autoFluidity':
          valA = metricsA.avgAutoFluidity;
          valB = metricsB.avgAutoFluidity;
          break;
        case 'teleopFluidity':
          valA = metricsA.avgTeleopFluidity;
          valB = metricsB.avgTeleopFluidity;
          break;
        default:
          valA = 0;
          valB = 0;
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [metrics, tbaRanks, sortField, sortDirection]);

  // Calculate min/max for heatmaps
  const stats = useMemo(() => {
    const vals = Object.values(metrics);
    if (vals.length === 0) return null;
    return {
      oprc: { min: Math.min(...vals.map(v => v.oprc)), max: Math.max(...vals.map(v => v.oprc)) },
      autoOprc: { min: Math.min(...vals.map(v => v.autoOprc)), max: Math.max(...vals.map(v => v.autoOprc)) },
      teleopOprc: { min: Math.min(...vals.map(v => v.teleopOprc)), max: Math.max(...vals.map(v => v.teleopOprc)) },
      endgameOprc: { min: Math.min(...vals.map(v => v.endgameOprc)), max: Math.max(...vals.map(v => v.endgameOprc)) },
      opr: { min: Math.min(...vals.map(v => v.opr)), max: Math.max(...vals.map(v => v.opr)) },
      dpr: { min: Math.min(...vals.map(v => v.dpr)), max: Math.max(...vals.map(v => v.dpr)) },
    };
  }, [metrics]);

  const getHeatmapColor = (value: number, min: number, max: number, invert = false) => {
    if (max === min) return 'transparent';
    let normalized = (value - min) / (max - min);
    if (invert) normalized = 1 - normalized;
    // HSL: 0 is red, 120 is green. We go from red (low) to green (high)
    const hue = Math.max(0, Math.min(120, normalized * 120));
    return `hsla(${hue}, 90%, 45%, 0.5)`;
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 inline ml-1" /> : <ArrowDown className="w-3 h-3 inline ml-1" />;
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
        <div className="text-emerald-400 font-bold animate-pulse">Calculating Global Metrics...</div>
      </div>
    );
  }

  if (Object.keys(metrics).length === 0 || !stats) {
    return (
      <div className="flex justify-center items-center h-64 text-slate-500 font-bold">
        No metrics available. Ensure TBA API key is set and event has matches.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-black text-white">TEAM SORTER</h2>
        <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">
          {sortedTeams.length} Teams Analyzed
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-950 text-slate-400 font-mono text-xs uppercase border-b border-slate-800">
              <tr>
                <th className="px-4 py-4 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('team')}>
                  Team <SortIcon field="team" />
                </th>
                <th className="px-4 py-4 cursor-pointer hover:text-white transition-colors text-center" onClick={() => handleSort('tbaRank')}>
                  TBA Rank <SortIcon field="tbaRank" />
                </th>
                <th className="px-4 py-4 cursor-pointer hover:text-white transition-colors text-right" onClick={() => handleSort('opr')}>
                  OPR <SortIcon field="opr" />
                </th>
                <th className="px-4 py-4 cursor-pointer hover:text-white transition-colors text-right" onClick={() => handleSort('dpr')}>
                  DPR <SortIcon field="dpr" />
                </th>
                <th className="px-4 py-4 cursor-pointer hover:text-white transition-colors text-right border-l border-slate-800" onClick={() => handleSort('oprc')}>
                  OPRc <SortIcon field="oprc" />
                </th>
                <th className="px-4 py-4 cursor-pointer hover:text-white transition-colors text-right" onClick={() => handleSort('autoOprc')}>
                  Auto OPRc <SortIcon field="autoOprc" />
                </th>
                <th className="px-4 py-4 cursor-pointer hover:text-white transition-colors text-right" onClick={() => handleSort('teleopOprc')}>
                  Teleop OPRc <SortIcon field="teleopOprc" />
                </th>
                <th className="px-4 py-4 cursor-pointer hover:text-white transition-colors text-right" onClick={() => handleSort('endgameOprc')}>
                  Endgame OPRc <SortIcon field="endgameOprc" />
                </th>
                <th className="px-4 py-4 cursor-pointer hover:text-white transition-colors text-right border-l border-slate-800" onClick={() => handleSort('autoFluidity')}>
                  Auto Fluidity <SortIcon field="autoFluidity" />
                </th>
                <th className="px-4 py-4 cursor-pointer hover:text-white transition-colors text-right" onClick={() => handleSort('teleopFluidity')}>
                  Teleop Fluidity <SortIcon field="teleopFluidity" />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {sortedTeams.map(([team, m], idx) => (
                <tr key={team} className="hover:bg-slate-800/50 transition-colors">
                  <td className="px-4 py-3 font-bold text-white flex items-center gap-3">
                    <span className="text-slate-600 font-mono text-xs w-4">{idx + 1}.</span>
                    {team}
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-300 text-center font-bold">
                    {tbaRanks[team] || '--'}
                  </td>
                  <td className="px-4 py-3 font-mono text-white text-right font-bold" style={{ backgroundColor: getHeatmapColor(m.opr, stats.opr.min, stats.opr.max) }}>
                    {m.opr.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 font-mono text-white text-right" style={{ backgroundColor: getHeatmapColor(m.dpr, stats.dpr.min, stats.dpr.max, true) }}>
                    {m.dpr.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 font-mono text-white text-right font-black border-l border-slate-800/50" style={{ backgroundColor: getHeatmapColor(m.oprc, stats.oprc.min, stats.oprc.max) }}>
                    {m.oprc.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 font-mono text-white text-right" style={{ backgroundColor: getHeatmapColor(m.autoOprc, stats.autoOprc.min, stats.autoOprc.max) }}>
                    {m.autoOprc.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 font-mono text-white text-right" style={{ backgroundColor: getHeatmapColor(m.teleopOprc, stats.teleopOprc.min, stats.teleopOprc.max) }}>
                    {m.teleopOprc.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 font-mono text-white text-right" style={{ backgroundColor: getHeatmapColor(m.endgameOprc, stats.endgameOprc.min, stats.endgameOprc.max) }}>
                    {m.endgameOprc.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-300 text-right border-l border-slate-800/50">
                    {m.avgAutoFluidity.toFixed(1)}
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-300 text-right">
                    {m.avgTeleopFluidity.toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
