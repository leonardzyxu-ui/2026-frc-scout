import React, { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { MatchScoutingV2 } from '../types';
import { MathEngine, TBAMatch, TeamMetrics } from '../utils/mathEngine';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ZAxis, LineChart, Line, Legend } from 'recharts';
import { RefreshCw, TrendingUp, Target, Shield, ArrowLeft, ScanLine, Search, Database, ListOrdered, X, BrainCircuit, Share2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// We will import the other views as components to render in tabs
import QRScannerView from './QRScannerView';
import TeamLookupView from './TeamLookupView';
import RawDataEditorView from './RawDataEditorView';
import TeamSorterView from './TeamSorterView';
import DraftAIOptimizer from '../components/admin/DraftAIOptimizer';
import DataExchange from '../components/admin/DataExchange';

export default function AdminMainframeView() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'analytics' | 'scanner' | 'lookup' | 'editor' | 'sorter' | 'draft' | 'exchange'>('analytics');
  const [metrics, setMetrics] = useState<Record<string, TeamMetrics>>({});
  const [loading, setLoading] = useState(true);
  
  // Global Event State Management
  const [eventKey, setEventKey] = useState(() => localStorage.getItem('globalEventKey') || '2026mnum');
  const [error, setError] = useState('');
  const [searchYear, setSearchYear] = useState(new Date().getFullYear().toString());
  const [searchResults, setSearchResults] = useState<{ key: string; name: string; short_name: string }[]>([]);
  const [isSearchingEvents, setIsSearchingEvents] = useState(false);

  const tbaApiKey = import.meta.env.VITE_TBA_API_KEY || '';

  useEffect(() => {
    localStorage.setItem('globalEventKey', eventKey);
    if (activeTab === 'analytics') {
      fetchData();
    }
  }, [eventKey, activeTab]);

  const searchEvents = async () => {
    if (!tbaApiKey) {
      setError("TBA API Key is missing.");
      return;
    }
    setIsSearchingEvents(true);
    setError('');
    try {
      const response = await fetch(`https://www.thebluealliance.com/api/v3/events/${searchYear}`, {
        headers: { 'X-TBA-Auth-Key': tbaApiKey }
      });
      if (!response.ok) throw new Error("Failed to fetch events");
      const data = await response.json();
      setSearchResults(data);
    } catch (err) {
      console.error(err);
      setError("Error searching events.");
    }
    setIsSearchingEvents(false);
  };

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      if (eventKey === 'TEST') {
        // Handle test mode if needed, or just skip fetching TBA
        setMetrics({});
        setLoading(false);
        return;
      }

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

      // 3. Calculate Metrics
      const calculatedMetrics = engine.calculateMetrics(tbaMatches, scoutingData);
      setMetrics(calculatedMetrics);
    } catch (err: unknown) {
      console.error("Error fetching analytics data:", err);
      if (err instanceof Error) {
        if (err.message === "ERROR: TBA API Key Missing" || err.message === "ERROR: No Matches Found for this Event.") {
          setError(err.message);
        } else {
          setError('Failed to load analytics data: ' + err.message);
        }
      } else {
        setError('Failed to load analytics data: Unknown error');
      }
    }
    setLoading(false);
  };

  const metricsArray = Object.values(metrics).sort((a, b) => b.oprc - a.oprc);

  // Prepare data for Moneyball Scatter Plot
  const scatterData = metricsArray.map(m => ({
    team: m.teamNumber,
    oprc: Number(m.oprc.toFixed(2)),
    pressure: Number(m.avgDriverPressure.toFixed(2)),
    defense: Number(m.avgDefenseEffectiveness.toFixed(2))
  }));

  // Prepare data for Trajectory Timeline
  const topTeams = metricsArray.slice(0, 5).map(m => m.teamNumber);
  const trajectoryDataMap = new Map<number, { match: number; [team: string]: number }>();
  
  metricsArray.forEach(m => {
    if (topTeams.includes(m.teamNumber)) {
      m.oprcHistory.forEach(h => {
        if (!trajectoryDataMap.has(h.match)) {
          trajectoryDataMap.set(h.match, { match: h.match });
        }
        trajectoryDataMap.get(h.match)![m.teamNumber] = Number(h.oprc.toFixed(2));
      });
    }
  });
  
  const trajectoryData = Array.from(trajectoryDataMap.values()).sort((a, b) => a.match - b.match);
  const colors = ['#38bdf8', '#fb7185', '#34d399', '#fbbf24', '#a78bfa'];

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 font-sans overflow-hidden">
      {/* Sidebar */}
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
        
        {/* Event Selection */}
        <div className="p-4 border-b border-slate-800 space-y-4">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Event</h2>
          
          {/* Quick Selects */}
          <div className="flex flex-col gap-2">
            <button 
              onClick={() => setEventKey('2026mnum')} 
              className={`text-left px-3 py-2.5 rounded-lg text-sm font-mono transition-colors ${eventKey === '2026mnum' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'bg-slate-950 border border-slate-800 text-slate-400 hover:bg-slate-800'}`}
            >
              2026mnum (MN North Star)
            </button>
            <button 
              onClick={() => setEventKey('2026cnsh')} 
              className={`text-left px-3 py-2.5 rounded-lg text-sm font-mono transition-colors ${eventKey === '2026cnsh' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'bg-slate-950 border border-slate-800 text-slate-400 hover:bg-slate-800'}`}
            >
              2026cnsh (Shanghai)
            </button>
            <button 
              onClick={() => setEventKey('TEST')} 
              className={`text-left px-3 py-2.5 rounded-lg text-sm font-mono transition-colors ${eventKey === 'TEST' ? 'bg-amber-600 text-white shadow-lg shadow-amber-900/20' : 'bg-slate-950 border border-slate-800 text-slate-400 hover:bg-slate-800'}`}
            >
              TEST EVENT
            </button>
          </div>

          {/* Advanced Search */}
          <div className="pt-4 border-t border-slate-800/50">
            <label className="text-xs text-slate-500 mb-2 block">TBA Event Search</label>
            <div className="flex gap-2 mb-3">
              <input 
                type="number" 
                value={searchYear} 
                onChange={e => setSearchYear(e.target.value)} 
                className="w-24 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500 transition-colors" 
                placeholder="Year"
              />
              <button 
                onClick={searchEvents} 
                disabled={isSearchingEvents} 
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
                  onChange={(e) => {
                    const val = e.target.value;
                    if (searchResults.some(ev => ev.key === val)) {
                      setEventKey(val);
                    }
                  }}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500 transition-colors"
                />
                <datalist id="tba-events">
                  {searchResults.map(ev => (
                    <option key={ev.key} value={ev.key}>{ev.name}</option>
                  ))}
                </datalist>
              </div>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          <SidebarButton active={activeTab === 'analytics'} onClick={() => setActiveTab('analytics')} icon={<TrendingUp className="w-5 h-5" />} label="Analytics Engine" />
          <SidebarButton active={activeTab === 'draft'} onClick={() => setActiveTab('draft')} icon={<BrainCircuit className="w-5 h-5" />} label="Draft AI Optimizer" />
          <SidebarButton active={activeTab === 'exchange'} onClick={() => setActiveTab('exchange')} icon={<Share2 className="w-5 h-5" />} label="Data Exchange" />
          <SidebarButton active={activeTab === 'scanner'} onClick={() => setActiveTab('scanner')} icon={<ScanLine className="w-5 h-5" />} label="QR Scanner" />
          <SidebarButton active={activeTab === 'lookup'} onClick={() => setActiveTab('lookup')} icon={<Search className="w-5 h-5" />} label="Team Lookup" />
          <SidebarButton active={activeTab === 'editor'} onClick={() => setActiveTab('editor')} icon={<Database className="w-5 h-5" />} label="Raw Data Editor" />
          <SidebarButton active={activeTab === 'sorter'} onClick={() => setActiveTab('sorter')} icon={<ListOrdered className="w-5 h-5" />} label="Team Sorter" />
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto bg-slate-950 relative">
        {activeTab === 'analytics' && (
          <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-black text-white">Analytics Engine</h2>
                <p className="text-slate-400 text-sm">Event: <span className="font-mono text-emerald-400">{eventKey}</span></p>
              </div>
              <button 
                onClick={fetchData}
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

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              {/* Trajectory Timeline */}
              <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 flex flex-col h-[400px] lg:col-span-2">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <TrendingUp className="text-purple-400 w-5 h-5" />
                  Trajectory Timeline: OPRc over Time (Top 5 Teams)
                </h2>
                <div className="flex-1 w-full relative">
                  {loading ? (
                    <div className="absolute inset-0 flex items-center justify-center text-slate-500">Calculating...</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={trajectoryData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="match" name="Match" stroke="#94a3b8" />
                        <YAxis name="OPRc" stroke="#94a3b8" />
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
                  Moneyball: OPRc vs. Driver performance under pressure
                </h2>
                <div className="flex-1 w-full relative">
                  {loading ? (
                    <div className="absolute inset-0 flex items-center justify-center text-slate-500">Calculating...</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis type="number" dataKey="pressure" name="Avg Driver performance under pressure" stroke="#94a3b8" domain={[0, 10]} />
                        <YAxis type="number" dataKey="oprc" name="OPRc" stroke="#94a3b8" />
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

              {/* Defense vs OPRc Scatter Plot */}
              <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 flex flex-col h-[400px]">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <Shield className="text-rose-400 w-5 h-5" />
                  Defense Effectiveness vs. OPRc
                </h2>
                <div className="flex-1 w-full relative">
                  {loading ? (
                    <div className="absolute inset-0 flex items-center justify-center text-slate-500">Calculating...</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis type="number" dataKey="defense" name="Avg Defense" stroke="#94a3b8" domain={[0, 10]} />
                        <YAxis type="number" dataKey="oprc" name="OPRc" stroke="#94a3b8" />
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
                      <th className="px-6 py-4 font-semibold text-emerald-400">OPRc</th>
                      <th className="px-6 py-4 font-semibold text-emerald-300">Auto OPRc</th>
                      <th className="px-6 py-4 font-semibold text-emerald-400">Teleop OPRc</th>
                      <th className="px-6 py-4 font-semibold text-emerald-500">Endgame OPRc</th>
                      <th className="px-6 py-4 font-semibold text-blue-400">OPR</th>
                      <th className="px-6 py-4 font-semibold text-rose-400">DPR</th>
                      <th className="px-6 py-4 font-semibold">Auto Fluidity</th>
                      <th className="px-6 py-4 font-semibold">Teleop Fluidity</th>
                      <th className="px-6 py-4 font-semibold">Driver Pressure</th>
                      <th className="px-6 py-4 font-semibold">Defense Eff.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {loading ? (
                      <tr>
                        <td colSpan={12} className="px-6 py-8 text-center text-slate-500">
                          Processing Matrix Calculations...
                        </td>
                      </tr>
                    ) : metricsArray.length === 0 ? (
                      <tr>
                        <td colSpan={12} className="px-6 py-8 text-center text-slate-500">
                          No data available.
                        </td>
                      </tr>
                    ) : (
                      metricsArray.map((m) => (
                        <tr key={m.teamNumber} className="hover:bg-slate-800/30 transition-colors">
                          <td className="px-6 py-4 font-bold text-white text-base">{m.teamNumber}</td>
                          <td className="px-6 py-4 text-slate-300">{m.matchesPlayed}</td>
                          <td className="px-6 py-4 font-mono font-bold text-emerald-400">{m.oprc.toFixed(2)}</td>
                          <td className="px-6 py-4 font-mono text-emerald-300">{m.autoOprc?.toFixed(2) || '--'}</td>
                          <td className="px-6 py-4 font-mono text-emerald-400">{m.teleopOprc?.toFixed(2) || '--'}</td>
                          <td className="px-6 py-4 font-mono text-emerald-500">{m.endgameOprc?.toFixed(2) || '--'}</td>
                          <td className="px-6 py-4 font-mono text-blue-400">{m.opr.toFixed(2)}</td>
                          <td className="px-6 py-4 font-mono text-rose-400">{m.dpr.toFixed(2)}</td>
                          <td className="px-6 py-4 text-slate-300">{m.avgAutoFluidity.toFixed(1)}</td>
                          <td className="px-6 py-4 text-slate-300">{m.avgTeleopFluidity.toFixed(1)}</td>
                          <td className="px-6 py-4 text-slate-300">{m.avgDriverPressure.toFixed(1)}</td>
                          <td className="px-6 py-4 text-slate-300">{m.avgDefenseEffectiveness.toFixed(1)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'scanner' && (
          <div className="h-full p-4 md:p-8 max-w-7xl mx-auto">
            <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-6 h-full overflow-y-auto">
              <QRScannerView isEmbedded={true} />
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

        {activeTab === 'draft' && (
          <div className="h-full p-4 md:p-8 max-w-7xl mx-auto">
            <div className="h-full overflow-y-auto">
              <DraftAIOptimizer metrics={metrics} targetTeam="10479" />
            </div>
          </div>
        )}

        {activeTab === 'exchange' && (
          <div className="h-full p-4 md:p-8 max-w-7xl mx-auto">
            <div className="h-full overflow-y-auto">
              <DataExchange metrics={metrics} />
            </div>
          </div>
        )}

      </main>
    </div>
  );
}

function SidebarButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
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
