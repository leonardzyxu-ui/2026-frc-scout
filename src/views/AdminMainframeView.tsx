import React, { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, onSnapshot, setDoc } from 'firebase/firestore';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis
} from 'recharts';
import {
  AlertTriangle,
  ArrowLeft,
  ClipboardList,
  Database,
  ListOrdered,
  RefreshCw,
  Search,
  Share2,
  Shield,
  Swords,
  Target,
  TrendingUp
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { MatchScoutingV2 } from '../types';
import { calculateTestMetrics, MathEngine, TeamMetrics, TestTeamMetrics } from '../utils/mathEngine';
import { TBA_API_KEY } from '../config';
import { getPersistentDeviceId, getSharedEventDocRef, getStoredEventKey, storeEventKey } from '../utils/sharedEventState';
import { loadTbaApiKey } from '../utils/adminV4LocalStore';
import DataControlView from './DataControlView';
import PitDataView from './PitDataView';
import PreMatchView from './PreMatchView';
import PracticeMatchesView from './PracticeMatchesView';
import TeamLookupView from './TeamLookupView';
import RawDataEditorView from './RawDataEditorView';
import TeamSorterView from './TeamSorterView';
import MatchPredictor from '../components/admin/MatchPredictor';

type AdminTab =
  | 'analytics'
  | 'predictor'
  | 'control'
  | 'pitdata'
  | 'practice'
  | 'prematch'
  | 'lookup'
  | 'editor'
  | 'sorter';

type PredictorViewTab = 'quals' | 'playoffs' | 'comparison';
type AnalyticsMode = 'official' | 'test';

const COLORS = ['#38bdf8', '#fb7185', '#34d399', '#fbbf24', '#a78bfa'];

export default function AdminMainframeView({
  initialTab = 'analytics',
  initialPredictorTab = 'quals'
}: {
  initialTab?: AdminTab;
  initialPredictorTab?: PredictorViewTab;
}) {
  const navigate = useNavigate();
  const deviceId = useMemo(() => getPersistentDeviceId(), []);
  const [activeTab, setActiveTab] = useState<AdminTab>(initialTab);
  const [metrics, setMetrics] = useState<Record<string, TeamMetrics>>({});
  const [testMetrics, setTestMetrics] = useState<Record<string, TestTeamMetrics>>({});
  const [analyticsMode, setAnalyticsMode] = useState<AnalyticsMode>('official');
  const [loading, setLoading] = useState(true);
  const [eventKey, setEventKey] = useState(() => getStoredEventKey());
  const [error, setError] = useState('');
  const [searchYear, setSearchYear] = useState(new Date().getFullYear().toString());
  const [searchResults, setSearchResults] = useState<{ key: string; name: string; short_name: string }[]>([]);
  const [isSearchingEvents, setIsSearchingEvents] = useState(false);
  const [localTbaApiKey, setLocalTbaApiKey] = useState('');
  const [isTbaApiKeyReady, setIsTbaApiKeyReady] = useState(false);

  const tbaApiKey = localTbaApiKey || TBA_API_KEY;

  useEffect(() => {
    const unsubscribe = onSnapshot(getSharedEventDocRef(), async (snapshot) => {
      if (snapshot.exists()) {
        const sharedEventKey = snapshot.data().eventKey || getStoredEventKey();
        storeEventKey(sharedEventKey);
        setEventKey(prev => (prev === sharedEventKey ? prev : sharedEventKey));
        return;
      }

      const bootstrapEventKey = getStoredEventKey();
      storeEventKey(bootstrapEventKey);
      setEventKey(prev => (prev === bootstrapEventKey ? prev : bootstrapEventKey));

      try {
        await setDoc(getSharedEventDocRef(), {
          eventKey: bootstrapEventKey,
          updatedAt: Date.now(),
          updatedByDeviceId: deviceId
        }, { merge: true });
      } catch (sharedEventError) {
        console.error('Failed to seed shared event state', sharedEventError);
      }
    }, (sharedEventError) => {
      console.error('Failed to sync shared event state in Admin Mainframe', sharedEventError);
    });

    return () => unsubscribe();
  }, [deviceId]);

  useEffect(() => {
    let cancelled = false;
    void loadTbaApiKey()
      .then(savedTbaApiKey => {
        if (cancelled) return;
        setLocalTbaApiKey(savedTbaApiKey || '');
      })
      .catch(loadError => {
        console.warn('Failed to load local TBA API key for legacy admin.', loadError);
        if (!cancelled) setLocalTbaApiKey('');
      })
      .finally(() => {
        if (!cancelled) setIsTbaApiKeyReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError('');

    try {
      if (eventKey === 'TEST') {
        const snapshot = await getDocs(collection(db, 'events', eventKey, 'matchScouting'));
        const scoutingData = snapshot.docs.map(doc => doc.data() as MatchScoutingV2);
        setMetrics({});
        setTestMetrics(calculateTestMetrics(scoutingData));
        setAnalyticsMode('test');
        return;
      }

      if (!tbaApiKey.trim()) {
        throw new Error('TBA API Key is missing. Save a TBA key in Admin V4 Settings, then reopen Admin V2.');
      }

      const scoutingSnapshot = await getDocs(collection(db, `events/${eventKey}/matchScouting`));
      const scoutingData = scoutingSnapshot.docs.map(doc => doc.data() as MatchScoutingV2);

      const engine = new MathEngine(tbaApiKey.trim());
      const tbaMatches = await engine.fetchEventMatches(eventKey);
      const calculatedMetrics = engine.calculateMetrics(tbaMatches, scoutingData);

      setMetrics(calculatedMetrics);
      setTestMetrics({});
      setAnalyticsMode('official');
    } catch (fetchError: unknown) {
      console.error('Error fetching analytics data:', fetchError);
      setMetrics({});
      setTestMetrics({});
      setAnalyticsMode(eventKey === 'TEST' ? 'test' : 'official');
      if (fetchError instanceof Error) {
        if (
          fetchError.message === 'ERROR: TBA API Key Missing' ||
          fetchError.message.includes('ERROR: No Matches Found')
        ) {
          setError(fetchError.message);
        } else {
          setError(`Failed to load analytics data: ${fetchError.message}`);
        }
      } else {
        setError('Failed to load analytics data: Unknown error');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    storeEventKey(eventKey);
    if (!isTbaApiKeyReady) return;
    if (activeTab === 'analytics' || activeTab === 'control') {
      void fetchData();
    }
  }, [eventKey, activeTab, isTbaApiKeyReady, tbaApiKey]);

  const applySharedEventKey = async (nextEventKey: string) => {
    if (!nextEventKey || nextEventKey === eventKey) return;

    setEventKey(nextEventKey);
    storeEventKey(nextEventKey);
    setError('');

    try {
      await setDoc(getSharedEventDocRef(), {
        eventKey: nextEventKey,
        updatedAt: Date.now(),
        updatedByDeviceId: deviceId
      }, { merge: true });
    } catch (sharedEventError) {
      console.error('Failed to update shared event state', sharedEventError);
      setError('Failed to update shared event state.');
    }
  };

  const searchEvents = async () => {
    if (!isTbaApiKeyReady) return;

    if (!tbaApiKey.trim()) {
      setError('TBA API Key is missing. Save a TBA key in Admin V4 Settings, then reopen Admin V2.');
      return;
    }

    setIsSearchingEvents(true);
    setError('');

    try {
      const response = await fetch(`https://www.thebluealliance.com/api/v3/events/${searchYear}`, {
        headers: { 'X-TBA-Auth-Key': tbaApiKey.trim() }
      });
      if (!response.ok) throw new Error('Failed to fetch events');
      setSearchResults(await response.json());
    } catch (searchError) {
      console.error(searchError);
      setError('Error searching events.');
    } finally {
      setIsSearchingEvents(false);
    }
  };

  const officialMetricsArray = useMemo(
    () => Object.values(metrics).sort((a, b) => b.epac - a.epac),
    [metrics]
  );
  const testMetricsArray = useMemo(
    () => Object.values(testMetrics).sort((a, b) => b.syntheticScore - a.syntheticScore),
    [testMetrics]
  );

  const officialScatterData = useMemo(
    () => officialMetricsArray.map(metric => ({
      team: metric.teamNumber,
      epac: Number(metric.epac.toFixed(2)),
      pressure: Number(metric.avgDriverPressure.toFixed(2)),
      defense: Number(metric.avgDefenseEffectiveness.toFixed(2))
    })),
    [officialMetricsArray]
  );

  const officialTrajectoryData = useMemo(() => {
    const topTeams = officialMetricsArray.slice(0, 5).map(metric => metric.teamNumber);
    const trajectoryMap = new Map<number, { match: number; [team: string]: number }>();

    officialMetricsArray.forEach(metric => {
      if (!topTeams.includes(metric.teamNumber)) return;
      metric.epacHistory.forEach(historyPoint => {
        if (!trajectoryMap.has(historyPoint.match)) {
          trajectoryMap.set(historyPoint.match, { match: historyPoint.match });
        }
        trajectoryMap.get(historyPoint.match)![metric.teamNumber] = Number(historyPoint.epac.toFixed(2));
      });
    });

    return {
      topTeams,
      data: Array.from(trajectoryMap.values()).sort((a, b) => a.match - b.match)
    };
  }, [officialMetricsArray]);

  const testScatterData = useMemo(
    () => testMetricsArray.map(metric => ({
      team: metric.teamNumber,
      score: Number(metric.syntheticScore.toFixed(2)),
      pressure: Number(metric.avgDriverPressure.toFixed(2)),
      defense: Number(metric.avgDefenseEffectiveness.toFixed(2)),
      reliability: Number(metric.reliabilityScore.toFixed(2))
    })),
    [testMetricsArray]
  );

  const testTrajectoryData = useMemo(() => {
    const topTeams = testMetricsArray.slice(0, 5).map(metric => metric.teamNumber);
    const trajectoryMap = new Map<number, { match: number; [team: string]: number }>();

    testMetricsArray.forEach(metric => {
      if (!topTeams.includes(metric.teamNumber)) return;
      metric.syntheticHistory.forEach(historyPoint => {
        if (!trajectoryMap.has(historyPoint.match)) {
          trajectoryMap.set(historyPoint.match, { match: historyPoint.match });
        }
        trajectoryMap.get(historyPoint.match)![metric.teamNumber] = Number(historyPoint.syntheticScore.toFixed(2));
      });
    });

    return {
      topTeams,
      data: Array.from(trajectoryMap.values()).sort((a, b) => a.match - b.match)
    };
  }, [testMetricsArray]);

  const renderOfficialAnalytics = () => (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 flex flex-col h-[400px] lg:col-span-2">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <TrendingUp className="text-purple-400 w-5 h-5" />
            Trajectory Timeline: EPAc over Time (Top 5 Teams)
          </h2>
          <div className="flex-1 w-full relative">
            {loading ? (
              <div className="absolute inset-0 flex items-center justify-center text-slate-500">Calculating...</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={officialTrajectoryData.data} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="match" name="Match" stroke="#94a3b8" />
                  <YAxis name="EPAc" stroke="#94a3b8" />
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc' }} />
                  <Legend />
                  {officialTrajectoryData.topTeams.map((team, index) => (
                    <Line
                      key={team}
                      type="monotone"
                      dataKey={team}
                      stroke={COLORS[index % COLORS.length]}
                      strokeWidth={3}
                      dot={{ r: 4, fill: COLORS[index % COLORS.length], strokeWidth: 0 }}
                      activeDot={{ r: 6 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 flex flex-col h-[400px]">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Target className="text-cyan-400 w-5 h-5" />
            Moneyball: EPAc vs. Driver performance under pressure
          </h2>
          <div className="flex-1 w-full relative">
            {loading ? (
              <div className="absolute inset-0 flex items-center justify-center text-slate-500">Calculating...</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis type="number" dataKey="pressure" name="Avg Driver performance under pressure" stroke="#94a3b8" domain={[0, 10]} />
                  <YAxis type="number" dataKey="epac" name="EPAc" stroke="#94a3b8" />
                  <ZAxis type="category" dataKey="team" name="Team" />
                  <Tooltip
                    cursor={{ strokeDasharray: '3 3' }}
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc' }}
                    itemStyle={{ color: '#38bdf8' }}
                  />
                  <Scatter name="Teams" data={officialScatterData} fill="#38bdf8" />
                </ScatterChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 flex flex-col h-[400px]">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Shield className="text-rose-400 w-5 h-5" />
            Defense Effectiveness vs. EPAc
          </h2>
          <div className="flex-1 w-full relative">
            {loading ? (
              <div className="absolute inset-0 flex items-center justify-center text-slate-500">Calculating...</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis type="number" dataKey="defense" name="Avg Defense" stroke="#94a3b8" domain={[0, 10]} />
                  <YAxis type="number" dataKey="epac" name="EPAc" stroke="#94a3b8" />
                  <ZAxis type="category" dataKey="team" name="Team" />
                  <Tooltip
                    cursor={{ strokeDasharray: '3 3' }}
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc' }}
                    itemStyle={{ color: '#fb7185' }}
                  />
                  <Scatter name="Teams" data={officialScatterData} fill="#fb7185" />
                </ScatterChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className="bg-slate-900/50 rounded-2xl border border-slate-800 overflow-hidden">
        <div className="p-6 border-b border-slate-800">
          <h2 className="text-xl font-bold text-white">Master Analytics Table</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="admin-sticky-table w-full text-left text-sm">
            <thead className="bg-slate-950 text-slate-400 font-mono text-xs uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4 font-semibold">Team</th>
                <th className="px-6 py-4 font-semibold">Matches</th>
                <th className="px-6 py-4 font-semibold text-emerald-400">EPAc</th>
                <th className="px-6 py-4 font-semibold text-emerald-300">Auto EPAc</th>
                <th className="px-6 py-4 font-semibold text-emerald-400">Teleop EPAc</th>
                <th className="px-6 py-4 font-semibold text-emerald-500">Endgame EPAc</th>
                <th className="px-6 py-4 font-semibold text-blue-400">EPA</th>
                <th className="px-6 py-4 font-semibold">Auto Fluidity</th>
                <th className="px-6 py-4 font-semibold">Teleop Fluidity</th>
                <th className="px-6 py-4 font-semibold">Driver Pressure</th>
                <th className="px-6 py-4 font-semibold">Defense Eff.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {loading ? (
                <tr>
                  <td colSpan={11} className="px-6 py-8 text-center text-slate-500">
                    Updating EMA ratings...
                  </td>
                </tr>
              ) : officialMetricsArray.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-6 py-8 text-center text-slate-500">
                    No data available.
                  </td>
                </tr>
              ) : (
                officialMetricsArray.map(metric => (
                  <tr key={metric.teamNumber} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4 font-bold text-white text-base">{metric.teamNumber}</td>
                    <td className="px-6 py-4 text-slate-300">{metric.matchesPlayed}</td>
                    <td className="px-6 py-4 font-mono font-bold text-emerald-400">{metric.epac.toFixed(2)}</td>
                    <td className="px-6 py-4 font-mono text-emerald-300">{metric.autoEpac.toFixed(2)}</td>
                    <td className="px-6 py-4 font-mono text-emerald-400">{metric.teleopEpac.toFixed(2)}</td>
                    <td className="px-6 py-4 font-mono text-emerald-500">{metric.endgameEpac.toFixed(2)}</td>
                    <td className="px-6 py-4 font-mono text-blue-400">{metric.epa.toFixed(2)}</td>
                    <td className="px-6 py-4 text-slate-300">{metric.avgAutoFluidity.toFixed(1)}</td>
                    <td className="px-6 py-4 text-slate-300">{metric.avgTeleopFluidity.toFixed(1)}</td>
                    <td className="px-6 py-4 text-slate-300">{metric.avgDriverPressure.toFixed(1)}</td>
                    <td className="px-6 py-4 text-slate-300">{metric.avgDefenseEffectiveness.toFixed(1)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );

  const renderTestAnalytics = () => (
    <>
      <div className="bg-amber-900/20 border border-amber-500/40 text-amber-100 p-4 rounded-xl">
        <h3 className="font-black text-white">TEST Mode Synthetic Analytics</h3>
        <p className="text-sm mt-2">
          TEST mode uses scout-only synthetic analytics. No TBA, EPA, EPAc, or predictor math is involved.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 flex flex-col h-[400px] lg:col-span-2">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <TrendingUp className="text-purple-400 w-5 h-5" />
            Trajectory Timeline: Synthetic Score Over Match Number (Top 5 Teams)
          </h2>
          <div className="flex-1 w-full relative">
            {loading ? (
              <div className="absolute inset-0 flex items-center justify-center text-slate-500">Calculating...</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={testTrajectoryData.data} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="match" name="Match" stroke="#94a3b8" />
                  <YAxis name="Synthetic Score" stroke="#94a3b8" domain={[0, 10]} />
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc' }} />
                  <Legend />
                  {testTrajectoryData.topTeams.map((team, index) => (
                    <Line
                      key={team}
                      type="monotone"
                      dataKey={team}
                      stroke={COLORS[index % COLORS.length]}
                      strokeWidth={3}
                      dot={{ r: 4, fill: COLORS[index % COLORS.length], strokeWidth: 0 }}
                      activeDot={{ r: 6 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 flex flex-col h-[400px]">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Target className="text-cyan-400 w-5 h-5" />
            Synthetic Score vs. Driver Under Pressure
          </h2>
          <div className="flex-1 w-full relative">
            {loading ? (
              <div className="absolute inset-0 flex items-center justify-center text-slate-500">Calculating...</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis type="number" dataKey="pressure" name="Driver Under Pressure" stroke="#94a3b8" domain={[0, 10]} />
                  <YAxis type="number" dataKey="score" name="Synthetic Score" stroke="#94a3b8" domain={[0, 10]} />
                  <ZAxis type="category" dataKey="team" name="Team" />
                  <Tooltip
                    cursor={{ strokeDasharray: '3 3' }}
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc' }}
                    itemStyle={{ color: '#38bdf8' }}
                  />
                  <Scatter name="Teams" data={testScatterData} fill="#38bdf8" />
                </ScatterChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 flex flex-col h-[400px]">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Shield className="text-rose-400 w-5 h-5" />
            Defense Effectiveness vs. Reliability
          </h2>
          <div className="flex-1 w-full relative">
            {loading ? (
              <div className="absolute inset-0 flex items-center justify-center text-slate-500">Calculating...</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis type="number" dataKey="defense" name="Defense Effectiveness" stroke="#94a3b8" domain={[0, 10]} />
                  <YAxis type="number" dataKey="reliability" name="Reliability" stroke="#94a3b8" domain={[0, 10]} />
                  <ZAxis type="category" dataKey="team" name="Team" />
                  <Tooltip
                    cursor={{ strokeDasharray: '3 3' }}
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc' }}
                    itemStyle={{ color: '#fb7185' }}
                  />
                  <Scatter name="Teams" data={testScatterData} fill="#fb7185" />
                </ScatterChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className="bg-slate-900/50 rounded-2xl border border-slate-800 overflow-hidden">
        <div className="p-6 border-b border-slate-800">
          <h2 className="text-xl font-bold text-white">TEST Sandbox Table</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="admin-sticky-table w-full text-left text-sm">
            <thead className="bg-slate-950 text-slate-400 font-mono text-xs uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4 font-semibold">Team</th>
                <th className="px-6 py-4 font-semibold">Matches Logged</th>
                <th className="px-6 py-4 font-semibold text-emerald-300">Synthetic Score</th>
                <th className="px-6 py-4 font-semibold text-cyan-300">Reliability</th>
                <th className="px-6 py-4 font-semibold text-amber-300">Climb Readiness</th>
                <th className="px-6 py-4 font-semibold">Auto Fluidity</th>
                <th className="px-6 py-4 font-semibold">Teleop Fluidity</th>
                <th className="px-6 py-4 font-semibold">Driver Under Pressure</th>
                <th className="px-6 py-4 font-semibold">Defense Effectiveness</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-center text-slate-500">
                    Building sandbox metrics...
                  </td>
                </tr>
              ) : testMetricsArray.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-center text-slate-500">
                    No TEST data available yet.
                  </td>
                </tr>
              ) : (
                testMetricsArray.map(metric => (
                  <tr key={metric.teamNumber} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4 font-bold text-white text-base">{metric.teamNumber}</td>
                    <td className="px-6 py-4 text-slate-300">{metric.matchesLogged}</td>
                    <td className="px-6 py-4 font-mono font-bold text-emerald-300">{metric.syntheticScore.toFixed(2)}</td>
                    <td className="px-6 py-4 font-mono text-cyan-300">{metric.reliabilityScore.toFixed(2)}</td>
                    <td className="px-6 py-4 font-mono text-amber-300">{metric.climbReadiness.toFixed(2)}</td>
                    <td className="px-6 py-4 text-slate-300">{metric.avgAutoFluidity.toFixed(1)}</td>
                    <td className="px-6 py-4 text-slate-300">{metric.avgTeleopFluidity.toFixed(1)}</td>
                    <td className="px-6 py-4 text-slate-300">{metric.avgDriverPressure.toFixed(1)}</td>
                    <td className="px-6 py-4 text-slate-300">{metric.avgDefenseEffectiveness.toFixed(1)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 font-sans overflow-hidden">
      <aside className="w-72 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0">
        <div className="p-4 border-b border-slate-800">
          <h1 className="text-xl font-black text-white tracking-tight flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            MAINFRAME
          </h1>
        </div>

        <div className="p-4 border-b border-slate-800 space-y-4">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Event</h2>

          <div className="flex flex-col gap-2">
            <button
              onClick={() => void applySharedEventKey('2026MNUM')}
              className={`text-left px-3 py-2.5 rounded-lg text-sm font-mono transition-colors ${eventKey === '2026MNUM' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'bg-slate-950 border border-slate-800 text-slate-400 hover:bg-slate-800'}`}
            >
              2026MNUM (MN North Star)
            </button>
            <button
              onClick={() => void applySharedEventKey('2026cnsh')}
              className={`text-left px-3 py-2.5 rounded-lg text-sm font-mono transition-colors ${eventKey === '2026cnsh' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'bg-slate-950 border border-slate-800 text-slate-400 hover:bg-slate-800'}`}
            >
              2026cnsh (Shanghai)
            </button>
            <button
              onClick={() => void applySharedEventKey('TEST')}
              className={`text-left px-3 py-2.5 rounded-lg text-sm font-mono transition-colors ${eventKey === 'TEST' ? 'bg-amber-600 text-white shadow-lg shadow-amber-900/20' : 'bg-slate-950 border border-slate-800 text-slate-400 hover:bg-slate-800'}`}
            >
              TEST EVENT
            </button>
          </div>

          <div className="pt-4 border-t border-slate-800/50">
            <label className="text-xs text-slate-500 mb-2 block">TBA Event Search</label>
            <div className="flex gap-2 mb-3">
              <input
                type="number"
                value={searchYear}
                onChange={(event) => setSearchYear(event.target.value)}
                className="w-24 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500 transition-colors"
                placeholder="Year"
              />
              <button
                onClick={searchEvents}
                disabled={isSearchingEvents || !isTbaApiKeyReady}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-lg px-3 py-2 transition-colors disabled:opacity-50"
              >
                {isSearchingEvents ? '...' : 'FETCH'}
              </button>
            </div>

            {searchResults.length > 0 && (
              <div className="relative">
                <input
                  type="text"
                  list="tba-events"
                  placeholder="Type to search events..."
                  onChange={(event) => {
                    const value = event.target.value;
                    if (searchResults.some(result => result.key === value)) {
                      void applySharedEventKey(value);
                    }
                  }}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500 transition-colors"
                />
                <datalist id="tba-events">
                  {searchResults.map(result => (
                    <option key={result.key} value={result.key}>
                      {result.name}
                    </option>
                  ))}
                </datalist>
              </div>
            )}
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          <SidebarButton active={activeTab === 'analytics'} onClick={() => setActiveTab('analytics')} icon={<TrendingUp className="w-5 h-5" />} label="Analytics Engine" />
          <SidebarButton active={activeTab === 'predictor'} onClick={() => setActiveTab('predictor')} icon={<Swords className="w-5 h-5" />} label="Match Predictor" />
          <SidebarButton active={activeTab === 'control'} onClick={() => setActiveTab('control')} icon={<Share2 className="w-5 h-5" />} label="Data Control" />
          <SidebarButton active={activeTab === 'pitdata'} onClick={() => setActiveTab('pitdata')} icon={<ClipboardList className="w-5 h-5" />} label="Pit Data" />
          <SidebarButton active={activeTab === 'practice'} onClick={() => setActiveTab('practice')} icon={<TrendingUp className="w-5 h-5" />} label="Practice Matches" />
          <SidebarButton active={activeTab === 'prematch'} onClick={() => setActiveTab('prematch')} icon={<ClipboardList className="w-5 h-5" />} label="Pre Match" />
          <SidebarButton active={activeTab === 'lookup'} onClick={() => setActiveTab('lookup')} icon={<Search className="w-5 h-5" />} label="Team Lookup" />
          <SidebarButton active={activeTab === 'editor'} onClick={() => setActiveTab('editor')} icon={<Database className="w-5 h-5" />} label="Raw Data Editor" />
          <SidebarButton active={activeTab === 'sorter'} onClick={() => setActiveTab('sorter')} icon={<ListOrdered className="w-5 h-5" />} label="Team Sorter" />
        </nav>
      </aside>

      <main className="flex-1 overflow-y-auto bg-slate-950 relative">
        {activeTab === 'analytics' && (
          <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-black text-white">Analytics Engine</h2>
                <p className="text-slate-400 text-sm">
                  Event: <span className="font-mono text-emerald-400">{eventKey}</span>
                </p>
              </div>
              <button
                onClick={() => void fetchData()}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold transition-colors disabled:opacity-50 shadow-lg shadow-emerald-900/20"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                REFRESH
              </button>
            </div>

            {error && (
              <div className="bg-red-900/20 border border-red-500/50 text-red-400 p-4 rounded-xl">
                {error}
              </div>
            )}

            {analyticsMode === 'test' ? renderTestAnalytics() : renderOfficialAnalytics()}
          </div>
        )}

        {activeTab === 'predictor' && (
          <div className="h-full p-4 md:p-8 max-w-7xl mx-auto">
            <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-6 h-full overflow-y-auto">
              <MatchPredictor
                eventKey={eventKey}
                initialViewTab={initialPredictorTab}
                isTbaApiKeyReady={isTbaApiKeyReady}
                tbaApiKey={tbaApiKey}
              />
            </div>
          </div>
        )}

        {activeTab === 'control' && (
          <div className="h-full p-4 md:p-8 max-w-7xl mx-auto">
            <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-6 h-full overflow-y-auto">
              <DataControlView eventKey={eventKey} metrics={metrics} testMetrics={testMetrics} />
            </div>
          </div>
        )}

        {activeTab === 'prematch' && (
          <div className="h-full p-4 md:p-8 max-w-7xl mx-auto">
            <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-6 h-full overflow-y-auto">
              <PreMatchView isEmbedded={true} eventKey={eventKey} />
            </div>
          </div>
        )}

        {activeTab === 'pitdata' && (
          <div className="h-full p-4 md:p-8 max-w-7xl mx-auto">
            <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-6 h-full overflow-y-auto">
              <PitDataView eventKey={eventKey} />
            </div>
          </div>
        )}

        {activeTab === 'practice' && (
          <div className="h-full p-4 md:p-8 max-w-7xl mx-auto">
            <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-6 h-full overflow-y-auto">
              <PracticeMatchesView eventKey={eventKey} />
            </div>
          </div>
        )}

        {activeTab === 'lookup' && (
          <div className="h-full p-4 md:p-8 max-w-7xl mx-auto">
            <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-6 h-full overflow-y-auto">
              <TeamLookupView isEmbedded={true} eventKey={eventKey} />
            </div>
          </div>
        )}

        {activeTab === 'editor' && (
          <div className="h-full p-4 md:p-8 max-w-7xl mx-auto">
            <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-6 h-full overflow-y-auto">
              <RawDataEditorView eventKey={eventKey} />
            </div>
          </div>
        )}

        {activeTab === 'sorter' && (
          <div className="h-full p-4 md:p-8 max-w-7xl mx-auto">
            <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-6 h-full overflow-y-auto">
              <TeamSorterView eventKey={eventKey} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function SidebarButton({
  active,
  onClick,
  icon,
  label
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${
        active
          ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
          : 'text-slate-400 hover:bg-slate-800 hover:text-white border border-transparent'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
