import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { MathEngine, TeamMetrics } from '../utils/mathEngine';
import { MatchScoutingV2 } from '../types';
import { Search, Activity, Shield, Target, Camera, Database, Ruler, Scale, Car, MapPin, ArrowLeft } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useNavigate } from 'react-router-dom';

interface PitData {
  teamNumber: string;
  drivetrain: string;
  weight: string;
  dimensions: string;
  autoStart: string;
  photoUrl: string;
}

export default function TeamLookupView() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchedTeam, setSearchedTeam] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [pitData, setPitData] = useState<PitData | null>(null);
  const [metrics, setMetrics] = useState<TeamMetrics | null>(null);

  const eventKey = '2024casj'; // Default or from config
  const tbaApiKey = import.meta.env.VITE_TBA_API_KEY || '';

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setLoading(true);
    setError('');
    setSearchedTeam(searchQuery.trim());
    setPitData(null);
    setMetrics(null);

    try {
      // 1. Fetch Pit Data
      const pitDocRef = doc(db, `events/${eventKey}/pitScouting`, searchQuery.trim());
      const pitDocSnap = await getDoc(pitDocRef);
      if (pitDocSnap.exists()) {
        setPitData(pitDocSnap.data() as PitData);
      }

      // 2. Fetch Analytics Data
      // To get metrics for a single team, we currently need to fetch all event data
      // and run the MathEngine. In a production app, this would be pre-calculated
      // and stored in Firestore, but we'll run it client-side here.
      const scoutingRef = collection(db, `events/${eventKey}/matchScouting`);
      const snapshot = await getDocs(scoutingRef);
      const scoutingData: MatchScoutingV2[] = [];
      snapshot.forEach(d => {
        scoutingData.push(d.data() as MatchScoutingV2);
      });

      const engine = new MathEngine(tbaApiKey);
      const tbaMatches = await engine.fetchEventMatches(eventKey);

      if (tbaMatches.length > 0) {
        const calculatedMetrics = engine.calculateMetrics(tbaMatches, scoutingData);
        if (calculatedMetrics[searchQuery.trim()]) {
          setMetrics(calculatedMetrics[searchQuery.trim()]);
        } else {
          setError(`No match data found for team ${searchQuery.trim()}.`);
        }
      } else {
        setError('Failed to fetch TBA matches for analytics.');
      }

    } catch (err: any) {
      console.error('Error fetching team data:', err);
      setError('An error occurred while fetching data.');
    } finally {
      setLoading(false);
    }
  };

  // Calculate Consistency Index (Standard Deviation of POPR)
  const calculateConsistency = (history: { match: number; popr: number }[]) => {
    if (!history || history.length < 2) return 0;
    const mean = history.reduce((sum, h) => sum + h.popr, 0) / history.length;
    const variance = history.reduce((sum, h) => sum + Math.pow(h.popr - mean, 2), 0) / history.length;
    // Lower standard deviation = higher consistency. Let's invert it or just show std dev.
    // We'll show standard deviation directly, but maybe label it "Volatility" or just "Consistency (Std Dev)"
    return Math.sqrt(variance);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-4 md:p-8 font-sans pb-24">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Header & Search Bar */}
        <div className="bg-slate-900/50 p-6 md:p-10 rounded-3xl border border-slate-800 shadow-2xl relative">
          <button 
            onClick={() => navigate('/')}
            className="absolute top-6 left-6 p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight mb-6 text-center">
            Team Lookup Hub
          </h1>
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

        {error && (
          <div className="bg-red-900/20 border border-red-500/50 text-red-400 p-6 rounded-2xl text-center font-medium">
            {error}
          </div>
        )}

        {/* Results Panel */}
        {!loading && searchedTeam && (pitData || metrics) && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            <div className="flex items-center gap-4 border-b border-slate-800 pb-4">
              <h2 className="text-4xl font-black text-white">Team {searchedTeam}</h2>
              <div className="px-3 py-1 bg-blue-900/30 text-blue-400 border border-blue-800/50 rounded-full text-sm font-bold tracking-widest">
                {metrics ? `${metrics.matchesPlayed} MATCHES` : 'NO MATCH DATA'}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* Left Column: Pit Data & Image */}
              <div className="space-y-8 lg:col-span-1">
                
                {/* Image */}
                <div className="bg-slate-900/50 rounded-2xl border border-slate-800 overflow-hidden aspect-square flex items-center justify-center relative group">
                  {pitData?.photoUrl ? (
                    <img 
                      src={pitData.photoUrl} 
                      alt={`Team ${searchedTeam} Robot`} 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="text-slate-600 flex flex-col items-center gap-3">
                      <Camera className="w-12 h-12 opacity-50" />
                      <span className="font-medium tracking-widest text-sm">NO IMAGE</span>
                    </div>
                  )}
                </div>

                {/* Pit Data */}
                <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 space-y-6">
                  <h3 className="text-xl font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
                    <Database className="w-5 h-5 text-blue-400" />
                    Hardware Specs
                  </h3>
                  
                  {pitData ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-slate-400">
                          <Car className="w-4 h-4" />
                          <span>Drivetrain</span>
                        </div>
                        <span className="font-bold text-white">{pitData.drivetrain || 'N/A'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-slate-400">
                          <Scale className="w-4 h-4" />
                          <span>Weight</span>
                        </div>
                        <span className="font-bold text-white">{pitData.weight ? `${pitData.weight} kg` : 'N/A'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-slate-400">
                          <Ruler className="w-4 h-4" />
                          <span>Dimensions</span>
                        </div>
                        <span className="font-bold text-white">{pitData.dimensions || 'N/A'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-slate-400">
                          <MapPin className="w-4 h-4" />
                          <span>Auto Start</span>
                        </div>
                        <span className="font-bold text-white">{pitData.autoStart || 'N/A'}</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-slate-500 italic text-center py-4">No pit scouting data available.</p>
                  )}
                </div>
              </div>

              {/* Right Column: Analytics */}
              <div className="lg:col-span-2 space-y-8">
                
                {/* Top Level Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 flex flex-col items-center justify-center text-center">
                    <span className="text-slate-400 text-sm font-bold tracking-widest mb-2">POPR</span>
                    <span className="text-4xl font-black text-emerald-400">{metrics?.popr.toFixed(1) || '--'}</span>
                  </div>
                  <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 flex flex-col items-center justify-center text-center">
                    <span className="text-slate-400 text-sm font-bold tracking-widest mb-2">OPR</span>
                    <span className="text-4xl font-black text-blue-400">{metrics?.opr.toFixed(1) || '--'}</span>
                  </div>
                  <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 flex flex-col items-center justify-center text-center">
                    <span className="text-slate-400 text-sm font-bold tracking-widest mb-2">DPR</span>
                    <span className="text-4xl font-black text-rose-400">{metrics?.dpr.toFixed(1) || '--'}</span>
                  </div>
                  <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 flex flex-col items-center justify-center text-center">
                    <span className="text-slate-400 text-sm font-bold tracking-widest mb-2 text-center leading-tight">CONSISTENCY<br/>(STD DEV)</span>
                    <span className="text-3xl font-black text-purple-400">
                      {metrics ? calculateConsistency(metrics.poprHistory).toFixed(2) : '--'}
                    </span>
                  </div>
                </div>

                {/* Subjective Averages */}
                <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 space-y-6">
                  <h3 className="text-xl font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
                    <Activity className="w-5 h-5 text-amber-400" />
                    Subjective Averages (0-10)
                  </h3>
                  
                  {metrics ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm font-bold">
                          <span className="text-slate-400">Auto Fluidity</span>
                          <span className="text-white">{metrics.avgAutoFluidity.toFixed(1)}</span>
                        </div>
                        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full bg-amber-400 rounded-full" style={{ width: `${(metrics.avgAutoFluidity / 10) * 100}%` }} />
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm font-bold">
                          <span className="text-slate-400">Teleop Fluidity</span>
                          <span className="text-white">{metrics.avgTeleopFluidity.toFixed(1)}</span>
                        </div>
                        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full bg-amber-500 rounded-full" style={{ width: `${(metrics.avgTeleopFluidity / 10) * 100}%` }} />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between text-sm font-bold">
                          <span className="text-slate-400">Under Pressure (Evasion)</span>
                          <span className="text-white">{metrics.avgUnderPressure.toFixed(1)}</span>
                        </div>
                        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full bg-cyan-400 rounded-full" style={{ width: `${(metrics.avgUnderPressure / 10) * 100}%` }} />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between text-sm font-bold">
                          <span className="text-slate-400">Defense Effectiveness</span>
                          <span className="text-white">{metrics.avgDefenseEffectiveness.toFixed(1)}</span>
                        </div>
                        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full bg-rose-400 rounded-full" style={{ width: `${(metrics.avgDefenseEffectiveness / 10) * 100}%` }} />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-slate-500 italic text-center py-4">No subjective data available.</p>
                  )}
                </div>

                {/* POPR Trajectory */}
                {metrics && metrics.poprHistory.length > 0 && (
                  <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 flex flex-col h-[300px]">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3 mb-4">
                      <Target className="w-5 h-5 text-emerald-400" />
                      POPR Trajectory
                    </h3>
                    <div className="flex-1 w-full relative">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={metrics.poprHistory} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                          <XAxis dataKey="match" stroke="#64748b" tick={{fontSize: 12}} tickLine={false} axisLine={false} />
                          <YAxis stroke="#64748b" tick={{fontSize: 12}} tickLine={false} axisLine={false} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#f8fafc', borderRadius: '0.5rem' }}
                            itemStyle={{ color: '#34d399' }}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="popr" 
                            name="POPR"
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
            <Search className="w-12 h-12 mx-auto mb-4 opacity-20" />
            No data found for Team {searchedTeam}.
          </div>
        )}

      </div>
    </div>
  );
}
