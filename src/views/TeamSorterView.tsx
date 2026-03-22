import React, { useState, useEffect } from 'react';
import { MathEngine, TeamMetrics } from '../utils/mathEngine';
import { ArrowDown, ArrowUp, Loader2 } from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { MatchScoutingV2 } from '../types';

interface TeamSorterViewProps {
  eventKey: string;
}

type SortField = 'team' | 'opr' | 'dpr' | 'oprc' | 'autoFluidity' | 'teleopFluidity';
type SortDirection = 'asc' | 'desc';

export default function TeamSorterView({ eventKey }: TeamSorterViewProps) {
  const [metrics, setMetrics] = useState<Record<string, TeamMetrics>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [sortField, setSortField] = useState<SortField>('opr');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  useEffect(() => {
    const fetchMetrics = async () => {
      setIsLoading(true);
      try {
        const tbaApiKey = import.meta.env.VITE_TBA_API_KEY;
        if (!tbaApiKey || eventKey === 'TEST') {
          setMetrics({});
          setIsLoading(false);
          return;
        }

        // Fetch TBA Matches
        const engine = new MathEngine(tbaApiKey);
        const matches = await engine.fetchEventMatches(eventKey);

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

    fetchMetrics();
  }, [eventKey]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sortedTeams = Object.entries(metrics).sort((a, b) => {
    const [teamA, metricsA] = a;
    const [teamB, metricsB] = b;

    let valA, valB;
    switch (sortField) {
      case 'team':
        valA = parseInt(teamA);
        valB = parseInt(teamB);
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
      case 'autoFluidity':
        valA = metricsA.avgAutoFluidity;
        valB = metricsB.avgAutoFluidity;
        break;
      case 'teleopFluidity':
        valA = metricsA.avgTeleopFluidity;
        valB = metricsB.avgTeleopFluidity;
        break;
    }

    if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
    if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

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

  if (Object.keys(metrics).length === 0) {
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
                <th className="px-6 py-4 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('team')}>
                  Team <SortIcon field="team" />
                </th>
                <th className="px-6 py-4 cursor-pointer hover:text-white transition-colors text-right" onClick={() => handleSort('opr')}>
                  OPR <SortIcon field="opr" />
                </th>
                <th className="px-6 py-4 cursor-pointer hover:text-white transition-colors text-right" onClick={() => handleSort('dpr')}>
                  DPR <SortIcon field="dpr" />
                </th>
                <th className="px-6 py-4 cursor-pointer hover:text-white transition-colors text-right" onClick={() => handleSort('oprc')}>
                  OPRc <SortIcon field="oprc" />
                </th>
                <th className="px-6 py-4 cursor-pointer hover:text-white transition-colors text-right" onClick={() => handleSort('autoFluidity')}>
                  Auto Fluidity <SortIcon field="autoFluidity" />
                </th>
                <th className="px-6 py-4 cursor-pointer hover:text-white transition-colors text-right" onClick={() => handleSort('teleopFluidity')}>
                  Teleop Fluidity <SortIcon field="teleopFluidity" />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {sortedTeams.map(([team, m], idx) => (
                <tr key={team} className="hover:bg-slate-800/50 transition-colors">
                  <td className="px-6 py-4 font-bold text-white flex items-center gap-3">
                    <span className="text-slate-600 font-mono text-xs w-4">{idx + 1}.</span>
                    {team}
                  </td>
                  <td className="px-6 py-4 font-mono text-emerald-400 text-right font-bold">
                    {m.opr.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 font-mono text-red-400 text-right">
                    {m.dpr.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 font-mono text-blue-400 text-right">
                    {m.oprc.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 font-mono text-slate-300 text-right">
                    {m.avgAutoFluidity.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 font-mono text-slate-300 text-right">
                    {m.avgTeleopFluidity.toFixed(2)}
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
