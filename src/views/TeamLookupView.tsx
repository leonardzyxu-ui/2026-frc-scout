import React, { useState } from 'react';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import {
  Activity,
  ArrowLeft,
  CheckCircle2,
  Database,
  Gauge,
  Search,
  Sparkles,
  Target
} from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { MatchScoutingV2, PitScoutingV2 } from '../types';
import { MathEngine, TeamMetrics } from '../utils/mathEngine';
import { formatPitChassisSpeed, getClimbCapabilityLabel, getShooterLabel, getTraversalLabel } from '../utils/pitScouting';
import { TBA_API_KEY } from '../config';
import { DEFAULT_EVENT_KEY, getStoredEventKey } from '../utils/sharedEventState';
import { getTbaUserFacingError, isTbaAuthError } from '../utils/tbaErrors';

const calculateConsistency = (history: { match: number; epac: number }[]) => {
  if (!history || history.length < 2) return 0;
  const mean = history.reduce((sum, entry) => sum + entry.epac, 0) / history.length;
  const variance =
    history.reduce((sum, entry) => sum + Math.pow(entry.epac - mean, 2), 0) / history.length;
  return Math.sqrt(variance);
};

function MetricBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm font-bold">
        <span className="text-slate-400">{label}</span>
        <span className="text-white">{value.toFixed(1)}</span>
      </div>
      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${(value / 10) * 100}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-slate-400 text-sm">{label}</span>
      <span className="font-bold text-white text-right">{value}</span>
    </div>
  );
}

const formatYesNo = (value: boolean) => (value ? 'Yes' : 'No');

export default function TeamLookupView({
  isEmbedded = false,
  eventKey: propEventKey
}: {
  isEmbedded?: boolean;
  eventKey?: string;
}) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchedTeam, setSearchedTeam] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pitData, setPitData] = useState<PitScoutingV2 | null>(null);
  const [metrics, setMetrics] = useState<TeamMetrics | null>(null);

  const eventKey = propEventKey || getStoredEventKey() || DEFAULT_EVENT_KEY;
  const tbaApiKey = TBA_API_KEY;

  const handleSearch = async (event: React.FormEvent) => {
    event.preventDefault();
    const teamNumber = searchQuery.trim();
    if (!teamNumber) return;

    setLoading(true);
    setError('');
    setSearchedTeam(teamNumber);
    setPitData(null);
    setMetrics(null);

    try {
      const pitDocRef = doc(db, `events/${eventKey}/pitScouting`, teamNumber);
      const pitDocSnap = await getDoc(pitDocRef);
      if (pitDocSnap.exists()) {
        setPitData(pitDocSnap.data() as PitScoutingV2);
      }

      if (eventKey === 'TEST') {
        if (!pitDocSnap.exists()) {
          setError(`No pit scouting data found for team ${teamNumber} in TEST mode.`);
        }
        return;
      }

      const scoutingRef = collection(db, `events/${eventKey}/matchScouting`);
      const snapshot = await getDocs(scoutingRef);
      const scoutingData = snapshot.docs.map(docSnapshot => docSnapshot.data() as MatchScoutingV2);

      const engine = new MathEngine(tbaApiKey);
      const tbaMatches = await engine.fetchEventMatches(eventKey);
      const calculatedMetrics = engine.calculateMetrics(tbaMatches, scoutingData);

      if (calculatedMetrics[teamNumber]) {
        setMetrics(calculatedMetrics[teamNumber]);
      } else if (!pitDocSnap.exists()) {
        setError(`No pit or match analytics found for team ${teamNumber}.`);
      } else {
        setError(`No match analytics found for team ${teamNumber} at ${eventKey}.`);
      }
    } catch (lookupError) {
      console.error('Error fetching team data:', lookupError);
      if (lookupError instanceof Error) {
        if (
          lookupError.message.includes('ERROR: No Matches Found')
        ) {
          setError(lookupError.message);
        } else if (isTbaAuthError(lookupError)) {
          setError(getTbaUserFacingError(lookupError));
        } else {
          setError('An error occurred while fetching analytics.');
        }
      } else {
        setError('An error occurred while fetching data.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={isEmbedded ? 'pb-24' : 'min-h-screen bg-slate-950 text-slate-200 p-4 md:p-8 font-sans pb-24'}>
      <div className={isEmbedded ? 'space-y-8' : 'max-w-5xl mx-auto space-y-8'}>
        <div className="bg-slate-900/50 p-6 md:p-10 rounded-3xl border border-slate-800 shadow-2xl relative">
          {!isEmbedded && (
            <button
              onClick={() => navigate('/')}
              className="absolute top-6 left-6 p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
          )}
          <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight mb-4 text-center">
            Team Lookup Hub
          </h1>
          <p className="text-slate-400 text-center max-w-3xl mx-auto mb-6">
            Fast operational lookup for pit questionnaire details and event analytics already modeled from scout data.
          </p>
          <form onSubmit={handleSearch} className="relative max-w-2xl mx-auto">
            <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none">
              <Search className="h-8 w-8 text-slate-500" />
            </div>
            <input
              type="number"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-20 pr-6 py-6 bg-slate-950 border-2 border-slate-800 rounded-2xl text-3xl font-black text-emerald-400 placeholder-slate-700 focus:outline-none focus:border-emerald-500 transition-colors shadow-inner"
              placeholder="Enter Team #"
            />
            <button
              type="submit"
              disabled={loading || !searchQuery.trim()}
              className="absolute inset-y-3 right-3 px-8 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold rounded-xl transition-colors"
            >
              {loading ? 'SEARCHING...' : 'SEARCH'}
            </button>
          </form>
        </div>

        {eventKey === 'TEST' && (
          <div className="bg-amber-900/20 border border-amber-500/50 text-amber-300 p-5 rounded-2xl text-center font-medium">
            TEST mode loads pit scouting data only. Official analytics lookup is unavailable without a real TBA event feed.
          </div>
        )}

        {error && (
          <div className="bg-red-900/20 border border-red-500/50 text-red-300 p-6 rounded-2xl text-center font-medium">
            {error}
          </div>
        )}

        {!loading && searchedTeam && (pitData || metrics) && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col gap-4 border-b border-slate-800 pb-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <h2 className="text-4xl font-black text-white">Team {searchedTeam}</h2>
                <div className="flex flex-wrap items-center gap-3 mt-3 text-sm">
                  <span className="px-3 py-1 bg-blue-900/30 text-blue-300 border border-blue-800/50 rounded-full font-bold tracking-widest">
                    {eventKey}
                  </span>
                  {pitData?.teamName && (
                    <span className="px-3 py-1 bg-slate-800 text-slate-200 border border-slate-700 rounded-full font-bold tracking-widest">
                      {pitData.teamName}
                    </span>
                  )}
                  {metrics && (
                    <span className="px-3 py-1 bg-emerald-900/30 text-emerald-300 border border-emerald-800/50 rounded-full font-bold tracking-widest">
                      {metrics.matchesPlayed} MATCHES MODELED
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="space-y-8 lg:col-span-1">
                <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 space-y-6">
                  <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                    <Database className="w-5 h-5 text-emerald-400" />
                    <h3 className="text-xl font-bold text-white">Pit Questionnaire</h3>
                  </div>
                  {pitData ? (
                    <div className="space-y-6">
                      <div className="space-y-3">
                        <h4 className="text-xs font-black uppercase tracking-widest text-slate-500">
                          Build & Chassis
                        </h4>
                        <DetailRow label="Robot Base" value={pitData.robotBaseType || 'N/A'} />
                        <DetailRow
                          label="WCP / KitBot"
                          value={`${formatYesNo(pitData.isWcpBot)} / ${formatYesNo(pitData.isKitBot)}`}
                        />
                        <DetailRow
                          label="Traversal"
                          value={getTraversalLabel(pitData) || 'Needs pit verification'}
                        />
                        <DetailRow
                          label="Chassis Speed"
                          value={formatPitChassisSpeed(pitData)}
                        />
                      </div>

                      <div className="space-y-3">
                        <h4 className="text-xs font-black uppercase tracking-widest text-slate-500">
                          Scoring & Shooting
                        </h4>
                        <DetailRow label="Shooter Count" value={getShooterLabel(pitData) || 'N/A'} />
                        <DetailRow
                          label="Hopper"
                          value={
                            pitData.canUseHopper
                              ? `${pitData.hopperCapacity || 0} ball${pitData.hopperCapacity === 1 ? '' : 's'}`
                              : 'No'
                          }
                        />
                        <DetailRow
                          label="Expected Balls"
                          value={
                            pitData.expectedHubBallsPerMatch
                              ? `${pitData.expectedHubBallsPerMatch} total`
                              : 'N/A'
                          }
                        />
                        <DetailRow
                          label="Auto / Teleop"
                          value={`${pitData.expectedAutoBalls || 0} / ${pitData.expectedTeleopBalls || 0}`}
                        />
                        <DetailRow
                          label="Balls / Second"
                          value={pitData.ballsPerSecond || 'N/A'}
                        />
                        <DetailRow label="Shooting Style" value={pitData.shootingStyle || 'N/A'} />
                        <DetailRow
                          label="Number of flywheels per shooter"
                          value={pitData.shootingFlywheelCount || 'N/A'}
                        />
                        <DetailRow
                          label="Adjustable Hood (firing angle)"
                          value={formatYesNo(pitData.hoodAdjustable)}
                        />
                      </div>

                      <div className="space-y-3">
                        <h4 className="text-xs font-black uppercase tracking-widest text-slate-500">
                          Endgame
                        </h4>
                        <DetailRow
                          label="Climb Levels"
                          value={getClimbCapabilityLabel(pitData) || 'None Reported'}
                        />
                      </div>

                      <div className="space-y-3">
                        <h4 className="text-xs font-black uppercase tracking-widest text-slate-500">
                          Submission
                        </h4>
                        <DetailRow label="Submitted By" value={pitData.scoutName || 'Scout name missing'} />
                      </div>

                      {pitData.notes && (
                        <div className="space-y-2">
                          <h4 className="text-xs font-black uppercase tracking-widest text-slate-500">
                            Notes
                          </h4>
                          <p className="text-sm text-slate-300 leading-relaxed">{pitData.notes}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="py-8 text-center text-slate-500">
                      <Gauge className="w-10 h-10 mx-auto mb-3 opacity-40" />
                      <p className="font-medium">No pit scouting questionnaire available.</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="lg:col-span-2 space-y-8">
                <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
                  <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                    <Sparkles className="w-5 h-5 text-amber-400" />
                    <h3 className="text-xl font-bold text-white">Scout + TBA Analytics</h3>
                  </div>
                  <p className="text-sm text-slate-400 mt-4">
                    These values combine official TBA match results with your team&apos;s subjective scouting data through the new EPAc learning model.
                  </p>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                    <div className="bg-slate-950/60 p-6 rounded-2xl border border-slate-800 flex flex-col items-center justify-center text-center">
                      <span className="text-slate-400 text-sm font-bold tracking-widest mb-2">EPAc</span>
                      <span className="text-4xl font-black text-emerald-400">
                        {metrics?.epac.toFixed(1) || '--'}
                      </span>
                    </div>
                    <div className="bg-slate-950/60 p-6 rounded-2xl border border-slate-800 flex flex-col items-center justify-center text-center">
                      <span className="text-slate-400 text-sm font-bold tracking-widest mb-2">EPA</span>
                      <span className="text-4xl font-black text-blue-400">
                        {metrics?.epa.toFixed(1) || '--'}
                      </span>
                    </div>
                    <div className="bg-slate-950/60 p-6 rounded-2xl border border-slate-800 flex flex-col items-center justify-center text-center">
                      <span className="text-slate-400 text-sm font-bold tracking-widest mb-2">MATCHES</span>
                      <span className="text-4xl font-black text-rose-400">
                        {metrics?.matchesPlayed || '--'}
                      </span>
                    </div>
                    <div className="bg-slate-950/60 p-6 rounded-2xl border border-slate-800 flex flex-col items-center justify-center text-center">
                      <span className="text-slate-400 text-sm font-bold tracking-widest mb-2">CONSISTENCY</span>
                      <span className="text-3xl font-black text-purple-400">
                        {metrics ? calculateConsistency(metrics.epacHistory).toFixed(2) : '--'}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mt-4">
                    <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 flex flex-col items-center justify-center text-center">
                      <span className="text-slate-400 text-xs font-bold tracking-widest mb-1">AUTO EPAc</span>
                      <span className="text-2xl font-black text-emerald-300">
                        {metrics?.autoEpac?.toFixed(1) || '--'}
                      </span>
                    </div>
                    <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 flex flex-col items-center justify-center text-center">
                      <span className="text-slate-400 text-xs font-bold tracking-widest mb-1">TELEOP EPAc</span>
                      <span className="text-2xl font-black text-emerald-400">
                        {metrics?.teleopEpac?.toFixed(1) || '--'}
                      </span>
                    </div>
                    <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 flex flex-col items-center justify-center text-center">
                      <span className="text-slate-400 text-xs font-bold tracking-widest mb-1">ENDGAME EPAc</span>
                      <span className="text-2xl font-black text-emerald-500">
                        {metrics?.endgameEpac?.toFixed(1) || '--'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 space-y-6">
                  <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                    <Activity className="w-5 h-5 text-amber-400" />
                    <h3 className="text-xl font-bold text-white">Subjective Averages (0-10)</h3>
                  </div>
                  {metrics ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <MetricBar label="Auto Fluidity" value={metrics.avgAutoFluidity} color="#fbbf24" />
                      <MetricBar label="Teleop Fluidity" value={metrics.avgTeleopFluidity} color="#f59e0b" />
                      <MetricBar label="Driver Pressure" value={metrics.avgDriverPressure} color="#22d3ee" />
                      <MetricBar label="Defense Effectiveness" value={metrics.avgDefenseEffectiveness} color="#fb7185" />
                    </div>
                  ) : (
                    <p className="text-slate-500 italic text-center py-4">
                      No analytical scouting averages available yet.
                    </p>
                  )}
                </div>

                {metrics && metrics.epacHistory.length > 0 && (
                  <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 flex flex-col h-[320px]">
                    <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                      <Target className="w-5 h-5 text-emerald-400" />
                      <h3 className="text-xl font-bold text-white">EPAc Trajectory</h3>
                    </div>
                    <div className="flex-1 w-full relative mt-4">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={metrics.epacHistory} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                          <XAxis
                            dataKey="match"
                            stroke="#64748b"
                            tick={{ fontSize: 12 }}
                            tickLine={false}
                            axisLine={false}
                          />
                          <YAxis stroke="#64748b" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: '#0f172a',
                              borderColor: '#1e293b',
                              color: '#f8fafc',
                              borderRadius: '0.5rem'
                            }}
                            itemStyle={{ color: '#34d399' }}
                          />
                          <Line
                            type="monotone"
                            dataKey="epac"
                            name="EPAc"
                            stroke="#34d399"
                            strokeWidth={3}
                            dot={{ r: 4, fill: '#34d399', strokeWidth: 0 }}
                            activeDot={{ r: 6 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {!loading && searchedTeam && !pitData && !metrics && !error && (
          <div className="bg-slate-900/50 border border-slate-800 text-slate-400 p-12 rounded-3xl text-center font-medium">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-4 opacity-20" />
            No data found for Team {searchedTeam}.
          </div>
        )}
      </div>
    </div>
  );
}
