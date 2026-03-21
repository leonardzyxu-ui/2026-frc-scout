import React, { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { MatchScoutingV2 } from '../types';
import { MathEngine, TBAMatch, TeamMetrics } from '../utils/mathEngine';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ZAxis, LineChart, Line, Legend } from 'recharts';
import { RefreshCw, TrendingUp, Target, Shield, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import DraftAIOptimizer from '../components/admin/DraftAIOptimizer';
import MatchSimulator from '../components/admin/MatchSimulator';
import DataExchange from '../components/admin/DataExchange';

export default function AdminAnalyticsView() {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState<Record<string, TeamMetrics>>({});
  const [loading, setLoading] = useState(true);
  const [eventKey, setEventKey] = useState('2024casj'); // Default or from config
  const [error, setError] = useState('');

  const tbaApiKey = import.meta.env.VITE_TBA_API_KEY || '';

  useEffect(() => {
    fetchData();
  }, [eventKey]);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      // 1. Fetch Firebase Data
      const scoutingRef = collection(db, `events/${eventKey}/matchScouting`);
      const snapshot = await getDocs(scoutingRef);
      const scoutingData: MatchScoutingV2[] = [];
      snapshot.forEach(doc => {
        scoutingData.push(doc.data() as MatchScoutingV2);
      });

      // 2. Fetch TBA Data
      const engine = new MathEngine(tbaApiKey);
      const tbaMatches = await engine.fetchEventMatches(eventKey);

      if (tbaMatches.length === 0) {
        setError('No TBA matches found or API key missing.');
      }

      // 3. Calculate Metrics
      const calculatedMetrics = engine.calculateMetrics(tbaMatches, scoutingData);
      setMetrics(calculatedMetrics);
    } catch (err) {
      console.error("Error fetching analytics data:", err);
      setError('Failed to load analytics data.');
    }
    setLoading(false);
  };

  const metricsArray = Object.values(metrics).sort((a, b) => b.popr - a.popr);

  // Prepare data for Moneyball Scatter Plot
  const scatterData = metricsArray.map(m => ({
    team: m.teamNumber,
    popr: Number(m.popr.toFixed(2)),
    pressure: Number(m.avgUnderPressure.toFixed(2)),
    defense: Number(m.avgDefenseEffectiveness.toFixed(2))
  }));

  // Prepare data for Trajectory Timeline
  // We want to show the top 5 teams by POPR
  const topTeams = metricsArray.slice(0, 5).map(m => m.teamNumber);
  const trajectoryDataMap = new Map<number, any>();
  
  metricsArray.forEach(m => {
    if (topTeams.includes(m.teamNumber)) {
      m.poprHistory.forEach(h => {
        if (!trajectoryDataMap.has(h.match)) {
          trajectoryDataMap.set(h.match, { match: h.match });
        }
        trajectoryDataMap.get(h.match)![m.teamNumber] = Number(h.popr.toFixed(2));
      });
    }
  });
  
  const trajectoryData = Array.from(trajectoryDataMap.values()).sort((a, b) => a.match - b.match);
  const colors = ['#38bdf8', '#fb7185', '#34d399', '#fbbf24', '#a78bfa'];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/')}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div>
              <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
                <TrendingUp className="text-emerald-500 w-8 h-8" />
                THE SHOWCASE
              </h1>
              <p className="text-slate-400 mt-1">Advanced FRC Analytics & Math Engine</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-slate-950 px-4 py-2 rounded-lg border border-slate-800">
              <span className="text-sm text-slate-400 font-medium">EVENT KEY</span>
              <input 
                type="text" 
                value={eventKey}
                onChange={(e) => setEventKey(e.target.value)}
                className="bg-transparent text-white font-mono w-24 focus:outline-none"
              />
            </div>
            <button 
              onClick={fetchData}
              disabled={loading}
              className="p-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-900/20 border border-red-500/50 text-red-400 p-4 rounded-xl">
            {error}
          </div>
        )}

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Trajectory Timeline */}
          <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 flex flex-col h-[400px] lg:col-span-2">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <TrendingUp className="text-purple-400 w-5 h-5" />
              Trajectory Timeline: POPR over Time (Top 5 Teams)
            </h2>
            <div className="flex-1 w-full relative">
              {loading ? (
                <div className="absolute inset-0 flex items-center justify-center text-slate-500">Calculating...</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trajectoryData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="match" name="Match" stroke="#94a3b8" />
                    <YAxis name="POPR" stroke="#94a3b8" />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc' }}
                    />
                    <Legend />
                    {topTeams.map((team, index) => (
                      <Line 
                        key={team} 
                        type="monotone" 
                        dataKey={team} 
                        stroke={colors[index % colors.length]} 
                        strokeWidth={3}
                        dot={{ r: 4, fill: colors[index % colors.length], strokeWidth: 0 }}
                        activeDot={{ r: 6 }}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Moneyball Scatter Plot */}
          <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 flex flex-col h-[400px]">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Target className="text-cyan-400 w-5 h-5" />
              Moneyball: POPR vs. Under Pressure
            </h2>
            <div className="flex-1 w-full relative">
              {loading ? (
                <div className="absolute inset-0 flex items-center justify-center text-slate-500">Calculating...</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis type="number" dataKey="pressure" name="Avg Under Pressure" stroke="#94a3b8" domain={[0, 10]} />
                    <YAxis type="number" dataKey="popr" name="POPR" stroke="#94a3b8" />
                    <ZAxis type="category" dataKey="team" name="Team" />
                    <Tooltip 
                      cursor={{ strokeDasharray: '3 3' }}
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc' }}
                      itemStyle={{ color: '#38bdf8' }}
                    />
                    <Scatter name="Teams" data={scatterData} fill="#38bdf8" />
                  </ScatterChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Defense vs POPR Scatter Plot */}
          <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 flex flex-col h-[400px]">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Shield className="text-rose-400 w-5 h-5" />
              Defense Effectiveness vs. POPR
            </h2>
            <div className="flex-1 w-full relative">
              {loading ? (
                <div className="absolute inset-0 flex items-center justify-center text-slate-500">Calculating...</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis type="number" dataKey="defense" name="Avg Defense" stroke="#94a3b8" domain={[0, 10]} />
                    <YAxis type="number" dataKey="popr" name="POPR" stroke="#94a3b8" />
                    <ZAxis type="category" dataKey="team" name="Team" />
                    <Tooltip 
                      cursor={{ strokeDasharray: '3 3' }}
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc' }}
                      itemStyle={{ color: '#fb7185' }}
                    />
                    <Scatter name="Teams" data={scatterData} fill="#fb7185" />
                  </ScatterChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        {/* Phase 5: God Tier Ecosystem */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1">
            <DraftAIOptimizer metrics={metrics} />
          </div>
          <div className="lg:col-span-1">
            <MatchSimulator metrics={metrics} />
          </div>
          <div className="lg:col-span-1">
            <DataExchange metrics={metrics} />
          </div>
        </div>

        {/* Master Table */}
        <div className="bg-slate-900/50 rounded-2xl border border-slate-800 overflow-hidden">
          <div className="p-6 border-b border-slate-800">
            <h2 className="text-xl font-bold text-white">Master Analytics Table</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-950 text-slate-400 font-mono text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4 font-semibold">Team</th>
                  <th className="px-6 py-4 font-semibold">Matches</th>
                  <th className="px-6 py-4 font-semibold text-emerald-400">POPR</th>
                  <th className="px-6 py-4 font-semibold text-blue-400">OPR</th>
                  <th className="px-6 py-4 font-semibold text-rose-400">DPR</th>
                  <th className="px-6 py-4 font-semibold">Auto Fluidity</th>
                  <th className="px-6 py-4 font-semibold">Teleop Fluidity</th>
                  <th className="px-6 py-4 font-semibold">Under Pressure</th>
                  <th className="px-6 py-4 font-semibold">Defense Eff.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-8 text-center text-slate-500">
                      Processing Matrix Calculations...
                    </td>
                  </tr>
                ) : metricsArray.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-8 text-center text-slate-500">
                      No data available.
                    </td>
                  </tr>
                ) : (
                  metricsArray.map((m) => (
                    <tr key={m.teamNumber} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4 font-bold text-white text-base">{m.teamNumber}</td>
                      <td className="px-6 py-4 text-slate-300">{m.matchesPlayed}</td>
                      <td className="px-6 py-4 font-mono font-bold text-emerald-400">{m.popr.toFixed(2)}</td>
                      <td className="px-6 py-4 font-mono text-blue-400">{m.opr.toFixed(2)}</td>
                      <td className="px-6 py-4 font-mono text-rose-400">{m.dpr.toFixed(2)}</td>
                      <td className="px-6 py-4 text-slate-300">{m.avgAutoFluidity.toFixed(1)}</td>
                      <td className="px-6 py-4 text-slate-300">{m.avgTeleopFluidity.toFixed(1)}</td>
                      <td className="px-6 py-4 text-slate-300">{m.avgUnderPressure.toFixed(1)}</td>
                      <td className="px-6 py-4 text-slate-300">{m.avgDefenseEffectiveness.toFixed(1)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
