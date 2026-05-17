import React, { useEffect, useMemo, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { ArrowDown, ArrowUp, Loader2 } from 'lucide-react';
import { db } from '../firebase';
import { MatchScoutingV2 } from '../types';
import {
  MathEngine,
  TeamMetrics,
  TestTeamMetrics,
  calculateLegacyDprRatings,
  calculateLegacyOprRatings,
  calculateLegacyOprcRatings,
  calculateTestMetrics
} from '../utils/mathEngine';
import { TBA_API_KEY } from '../config';

interface TeamSorterViewProps {
  eventKey: string;
}

type SortField =
  | 'team'
  | 'tbaRank'
  | 'opr'
  | 'dpr'
  | 'oprc'
  | 'epa'
  | 'epac'
  | 'autoEpac'
  | 'teleopEpac'
  | 'endgameEpac'
  | 'autoFluidity'
  | 'teleopFluidity'
  | 'syntheticScore'
  | 'reliabilityScore'
  | 'climbReadiness'
  | 'driverPressure'
  | 'defenseEffectiveness'
  | 'matchesLogged';
type SortDirection = 'asc' | 'desc';

const getHeatmapStyle = (percentile: number) => {
  const hue = 8 + percentile * 132;
  const saturation = 82;
  const lightness = 14 + percentile * 18;
  return {
    backgroundColor: `hsla(${hue}, ${saturation}%, ${lightness}%, 0.45)`,
    boxShadow: `inset 0 0 0 1px hsla(${hue}, 85%, ${Math.min(lightness + 18, 82)}%, 0.2)`
  };
};

export default function TeamSorterView({ eventKey }: TeamSorterViewProps) {
  const [metrics, setMetrics] = useState<Record<string, TeamMetrics>>({});
  const [legacyOpr, setLegacyOpr] = useState<Record<string, number>>({});
  const [legacyDpr, setLegacyDpr] = useState<Record<string, number>>({});
  const [legacyOprc, setLegacyOprc] = useState<Record<string, number>>({});
  const [testMetrics, setTestMetrics] = useState<Record<string, TestTeamMetrics>>({});
  const [tbaRanks, setTbaRanks] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [sortField, setSortField] = useState<SortField>('epac');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const isTestMode = eventKey === 'TEST';

  useEffect(() => {
    const fetchMetricsAndRanks = async () => {
      setIsLoading(true);
      try {
        if (isTestMode) {
          const snapshot = await getDocs(collection(db, 'events', eventKey, 'matchScouting'));
          const scoutingData = snapshot.docs.map(doc => doc.data() as MatchScoutingV2);
          setMetrics({});
          setLegacyOpr({});
          setLegacyDpr({});
          setLegacyOprc({});
          setTbaRanks({});
          setTestMetrics(calculateTestMetrics(scoutingData));
          setSortField('syntheticScore');
          setSortDirection('desc');
          return;
        }

        const tbaApiKey = TBA_API_KEY;
        if (!tbaApiKey) {
          setMetrics({});
          setLegacyOpr({});
          setLegacyDpr({});
          setLegacyOprc({});
          setTbaRanks({});
          setTestMetrics({});
          return;
        }

        const engine = new MathEngine(tbaApiKey);
        const [matches, ranksResponse] = await Promise.all([
          engine.fetchEventMatches(eventKey),
          fetch(`https://www.thebluealliance.com/api/v3/event/${eventKey.toLowerCase()}/rankings`, {
            headers: { 'X-TBA-Auth-Key': tbaApiKey }
          }).then(res => (res.ok ? res.json() : null))
        ]);

        const ranks: Record<string, number> = {};
        if (ranksResponse?.rankings) {
          ranksResponse.rankings.forEach((ranking: { team_key: string; rank: number }) => {
            ranks[ranking.team_key.replace('frc', '')] = ranking.rank;
          });
        }
        setTbaRanks(ranks);

        const snapshot = await getDocs(collection(db, 'events', eventKey, 'matchScouting'));
        const scoutingData = snapshot.docs.map(doc => doc.data() as MatchScoutingV2);

        setMetrics(engine.calculateMetrics(matches, scoutingData));
        setLegacyOpr(calculateLegacyOprRatings(matches));
        setLegacyDpr(calculateLegacyDprRatings(matches));
        setLegacyOprc(calculateLegacyOprcRatings(matches));
        setTestMetrics({});
        setSortField('epac');
        setSortDirection('desc');
      } catch (error) {
        console.error('Error calculating metrics for sorter:', error);
        setMetrics({});
        setLegacyOpr({});
        setLegacyDpr({});
        setLegacyOprc({});
        setTestMetrics({});
        setTbaRanks({});
      } finally {
        setIsLoading(false);
      }
    };

    void fetchMetricsAndRanks();
  }, [eventKey, isTestMode]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection(field === 'dpr' ? 'asc' : 'desc');
    }
  };

  const sortedOfficialTeams = useMemo(() => {
    return Object.entries(metrics).sort((a, b) => {
      const [teamA, metricsA] = a;
      const [teamB, metricsB] = b;

      let valA: number;
      let valB: number;
      switch (sortField) {
        case 'team':
          valA = parseInt(teamA, 10);
          valB = parseInt(teamB, 10);
          break;
        case 'tbaRank':
          valA = tbaRanks[teamA] || 999;
          valB = tbaRanks[teamB] || 999;
          break;
        case 'epa':
          valA = metricsA.epa;
          valB = metricsB.epa;
          break;
        case 'opr':
          valA = legacyOpr[teamA] ?? 0;
          valB = legacyOpr[teamB] ?? 0;
          break;
        case 'dpr':
          valA = legacyDpr[teamA] ?? 0;
          valB = legacyDpr[teamB] ?? 0;
          break;
        case 'oprc':
          valA = legacyOprc[teamA] ?? 0;
          valB = legacyOprc[teamB] ?? 0;
          break;
        case 'epac':
          valA = metricsA.epac;
          valB = metricsB.epac;
          break;
        case 'autoEpac':
          valA = metricsA.autoEpac;
          valB = metricsB.autoEpac;
          break;
        case 'teleopEpac':
          valA = metricsA.teleopEpac;
          valB = metricsB.teleopEpac;
          break;
        case 'endgameEpac':
          valA = metricsA.endgameEpac;
          valB = metricsB.endgameEpac;
          break;
        case 'autoFluidity':
          valA = metricsA.avgAutoFluidity;
          valB = metricsB.avgAutoFluidity;
          break;
        case 'teleopFluidity':
          valA = metricsA.avgTeleopFluidity;
          valB = metricsB.avgTeleopFluidity;
          break;
        case 'driverPressure':
          valA = metricsA.avgDriverPressure;
          valB = metricsB.avgDriverPressure;
          break;
        case 'defenseEffectiveness':
          valA = metricsA.avgDefenseEffectiveness;
          valB = metricsB.avgDefenseEffectiveness;
          break;
        case 'matchesLogged':
          valA = metricsA.matchesPlayed;
          valB = metricsB.matchesPlayed;
          break;
        default:
          valA = 0;
          valB = 0;
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [legacyDpr, legacyOpr, legacyOprc, metrics, sortDirection, sortField, tbaRanks]);

  const epacPercentiles = useMemo(() => {
    const values = Object.values(metrics)
      .map(metric => metric.epac)
      .sort((a, b) => a - b);

    const percentileMap = new Map<string, number>();
    if (values.length <= 1) {
      Object.keys(metrics).forEach(teamNumber => percentileMap.set(teamNumber, 1));
      return percentileMap;
    }

    Object.entries(metrics).forEach(([teamNumber, teamMetrics]) => {
      const firstIndex = values.findIndex(value => value >= teamMetrics.epac);
      const normalizedIndex = firstIndex === -1 ? values.length - 1 : firstIndex;
      percentileMap.set(teamNumber, normalizedIndex / (values.length - 1));
    });

    return percentileMap;
  }, [metrics]);

  const sortedTestTeams = useMemo(() => {
    return Object.entries(testMetrics).sort((a, b) => {
      const [teamA, metricsA] = a;
      const [teamB, metricsB] = b;

      let valA: number;
      let valB: number;
      switch (sortField) {
        case 'team':
          valA = parseInt(teamA, 10);
          valB = parseInt(teamB, 10);
          break;
        case 'syntheticScore':
          valA = metricsA.syntheticScore;
          valB = metricsB.syntheticScore;
          break;
        case 'reliabilityScore':
          valA = metricsA.reliabilityScore;
          valB = metricsB.reliabilityScore;
          break;
        case 'climbReadiness':
          valA = metricsA.climbReadiness;
          valB = metricsB.climbReadiness;
          break;
        case 'autoFluidity':
          valA = metricsA.avgAutoFluidity;
          valB = metricsB.avgAutoFluidity;
          break;
        case 'teleopFluidity':
          valA = metricsA.avgTeleopFluidity;
          valB = metricsB.avgTeleopFluidity;
          break;
        case 'driverPressure':
          valA = metricsA.avgDriverPressure;
          valB = metricsB.avgDriverPressure;
          break;
        case 'defenseEffectiveness':
          valA = metricsA.avgDefenseEffectiveness;
          valB = metricsB.avgDefenseEffectiveness;
          break;
        case 'matchesLogged':
          valA = metricsA.matchesLogged;
          valB = metricsB.matchesLogged;
          break;
        default:
          valA = 0;
          valB = 0;
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [sortDirection, sortField, testMetrics]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 inline ml-1" /> : <ArrowDown className="w-3 h-3 inline ml-1" />;
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
        <div className="text-emerald-400 font-bold animate-pulse">
          {isTestMode ? 'Building TEST synthetic rankings...' : 'Calculating Global Metrics...'}
        </div>
      </div>
    );
  }

  if (isTestMode) {
    if (Object.keys(testMetrics).length === 0) {
      return (
        <div className="flex justify-center items-center h-64 text-slate-500 font-bold">
          No TEST records available yet. Submit scout data to populate the sandbox sorter.
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="bg-amber-900/20 border border-amber-500/40 rounded-xl p-4 text-amber-100">
          <h2 className="text-xl font-black text-white">TEAM SORTER</h2>
          <p className="text-sm mt-2">
            TEST mode uses scout-only synthetic rankings. These are not EPA, EPAc, or official TBA-derived analytics.
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="admin-sticky-table w-full text-left text-sm">
              <thead className="bg-slate-950 text-slate-400 font-mono text-xs uppercase border-b border-slate-800">
                <tr>
                  <th className="px-4 py-4 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('team')}>
                    Team <SortIcon field="team" />
                  </th>
                  <th className="px-4 py-4 cursor-pointer hover:text-white transition-colors text-right" onClick={() => handleSort('matchesLogged')}>
                    Matches Logged <SortIcon field="matchesLogged" />
                  </th>
                  <th className="px-4 py-4 cursor-pointer hover:text-white transition-colors text-right text-emerald-300" onClick={() => handleSort('syntheticScore')}>
                    Synthetic Score <SortIcon field="syntheticScore" />
                  </th>
                  <th className="px-4 py-4 cursor-pointer hover:text-white transition-colors text-right text-cyan-300" onClick={() => handleSort('reliabilityScore')}>
                    Reliability <SortIcon field="reliabilityScore" />
                  </th>
                  <th className="px-4 py-4 cursor-pointer hover:text-white transition-colors text-right text-amber-300" onClick={() => handleSort('climbReadiness')}>
                    Climb Readiness <SortIcon field="climbReadiness" />
                  </th>
                  <th className="px-4 py-4 cursor-pointer hover:text-white transition-colors text-right" onClick={() => handleSort('autoFluidity')}>
                    Auto Fluidity <SortIcon field="autoFluidity" />
                  </th>
                  <th className="px-4 py-4 cursor-pointer hover:text-white transition-colors text-right" onClick={() => handleSort('teleopFluidity')}>
                    Teleop Fluidity <SortIcon field="teleopFluidity" />
                  </th>
                  <th className="px-4 py-4 cursor-pointer hover:text-white transition-colors text-right" onClick={() => handleSort('driverPressure')}>
                    Driver Pressure <SortIcon field="driverPressure" />
                  </th>
                  <th className="px-4 py-4 cursor-pointer hover:text-white transition-colors text-right" onClick={() => handleSort('defenseEffectiveness')}>
                    Defense Effectiveness <SortIcon field="defenseEffectiveness" />
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {sortedTestTeams.map(([teamNumber, teamMetrics]) => (
                  <tr key={teamNumber} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-4 font-bold text-white">{teamNumber}</td>
                    <td className="px-4 py-4 text-right text-slate-300">{teamMetrics.matchesLogged}</td>
                    <td className="px-4 py-4 text-right text-emerald-300 font-mono font-bold">{teamMetrics.syntheticScore.toFixed(2)}</td>
                    <td className="px-4 py-4 text-right text-cyan-300 font-mono">{teamMetrics.reliabilityScore.toFixed(2)}</td>
                    <td className="px-4 py-4 text-right text-amber-300 font-mono">{teamMetrics.climbReadiness.toFixed(2)}</td>
                    <td className="px-4 py-4 text-right text-slate-300">{teamMetrics.avgAutoFluidity.toFixed(1)}</td>
                    <td className="px-4 py-4 text-right text-slate-300">{teamMetrics.avgTeleopFluidity.toFixed(1)}</td>
                    <td className="px-4 py-4 text-right text-slate-300">{teamMetrics.avgDriverPressure.toFixed(1)}</td>
                    <td className="px-4 py-4 text-right text-slate-300">{teamMetrics.avgDefenseEffectiveness.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
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
          {sortedOfficialTeams.length} Teams Analyzed
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="admin-sticky-table w-full text-left text-sm">
            <thead className="bg-slate-950 text-slate-400 font-mono text-xs uppercase border-b border-slate-800">
              <tr>
                <th className="px-4 py-4 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('team')}>
                  Team <SortIcon field="team" />
                </th>
                <th className="px-4 py-4 cursor-pointer hover:text-white transition-colors text-center" onClick={() => handleSort('tbaRank')}>
                  TBA Rank <SortIcon field="tbaRank" />
                </th>
                <th className="px-4 py-4 cursor-pointer hover:text-white transition-colors text-right" onClick={() => handleSort('epa')}>
                  EPA <SortIcon field="epa" />
                </th>
                <th className="px-4 py-4 cursor-pointer hover:text-white transition-colors text-right" onClick={() => handleSort('opr')}>
                  OPR <SortIcon field="opr" />
                </th>
                <th className="px-4 py-4 cursor-pointer hover:text-white transition-colors text-right" onClick={() => handleSort('dpr')}>
                  DPR <SortIcon field="dpr" />
                </th>
                <th className="px-4 py-4 cursor-pointer hover:text-white transition-colors text-right" onClick={() => handleSort('oprc')}>
                  OPRc <SortIcon field="oprc" />
                </th>
                <th className="px-4 py-4 cursor-pointer hover:text-white transition-colors text-right border-l border-slate-800" onClick={() => handleSort('epac')}>
                  EPAc <SortIcon field="epac" />
                </th>
                <th className="px-4 py-4 cursor-pointer hover:text-white transition-colors text-right" onClick={() => handleSort('autoEpac')}>
                  Auto EPAc <SortIcon field="autoEpac" />
                </th>
                <th className="px-4 py-4 cursor-pointer hover:text-white transition-colors text-right" onClick={() => handleSort('teleopEpac')}>
                  Teleop EPAc <SortIcon field="teleopEpac" />
                </th>
                <th className="px-4 py-4 cursor-pointer hover:text-white transition-colors text-right" onClick={() => handleSort('endgameEpac')}>
                  Endgame EPAc <SortIcon field="endgameEpac" />
                </th>
                <th className="px-4 py-4 cursor-pointer hover:text-white transition-colors text-right" onClick={() => handleSort('autoFluidity')}>
                  Auto Fluidity <SortIcon field="autoFluidity" />
                </th>
                <th className="px-4 py-4 cursor-pointer hover:text-white transition-colors text-right" onClick={() => handleSort('teleopFluidity')}>
                  Teleop Fluidity <SortIcon field="teleopFluidity" />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {sortedOfficialTeams.map(([teamNumber, teamMetrics]) => (
                <tr key={teamNumber} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-4 font-bold text-white text-base">{teamNumber}</td>
                  <td className="px-4 py-4 text-slate-300 text-center">{tbaRanks[teamNumber] || '--'}</td>
                  <td className="px-4 py-4 font-mono text-blue-400 text-right">{teamMetrics.epa.toFixed(2)}</td>
                  <td className="px-4 py-4 font-mono text-sky-300 text-right">{(legacyOpr[teamNumber] ?? 0).toFixed(2)}</td>
                  <td className="px-4 py-4 font-mono text-rose-300 text-right">{(legacyDpr[teamNumber] ?? 0).toFixed(2)}</td>
                  <td className="px-4 py-4 font-mono text-cyan-300 text-right">{(legacyOprc[teamNumber] ?? 0).toFixed(2)}</td>
                  <td
                    className="px-4 py-4 font-mono font-bold text-emerald-100 text-right"
                    style={getHeatmapStyle(epacPercentiles.get(teamNumber) ?? 0)}
                    title={`EPAc percentile: ${Math.round((epacPercentiles.get(teamNumber) ?? 0) * 100)}%`}
                  >
                    {teamMetrics.epac.toFixed(2)}
                  </td>
                  <td className="px-4 py-4 font-mono text-emerald-300 text-right">{teamMetrics.autoEpac.toFixed(2)}</td>
                  <td className="px-4 py-4 font-mono text-emerald-400 text-right">{teamMetrics.teleopEpac.toFixed(2)}</td>
                  <td className="px-4 py-4 font-mono text-emerald-500 text-right">{teamMetrics.endgameEpac.toFixed(2)}</td>
                  <td className="px-4 py-4 text-slate-300 text-right">{teamMetrics.avgAutoFluidity.toFixed(1)}</td>
                  <td className="px-4 py-4 text-slate-300 text-right">{teamMetrics.avgTeleopFluidity.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
