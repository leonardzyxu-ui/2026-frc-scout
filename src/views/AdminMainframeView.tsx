import React, { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { MatchScoutingV2 } from '../types';
import { MathEngine, TBAMatch, TeamMetrics } from '../utils/mathEngine';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ZAxis, LineChart, Line, Legend } from 'recharts';
import { RefreshCw, TrendingUp, Target, Shield, ArrowLeft, ScanLine, Search, Database, ListOrdered, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// We will import the other views as components to render in tabs
import QRScannerView from './QRScannerView';
import TeamLookupView from './TeamLookupView';
import RawDataEditorView from './RawDataEditorView';
import TeamSorterView from './TeamSorterView';

export default function AdminMainframeView() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'analytics' | 'scanner' | 'lookup' | 'editor' | 'sorter'>('analytics');
  const [metrics, setMetrics] = useState<Record<string, TeamMetrics>>({});
  const [loading, setLoading] = useState(true);
  
  // Global Event State Management
  const [eventKey, setEventKey] = useState(() => localStorage.getItem('globalEventKey') || '2024casj');
  const [error, setError] = useState('');
  const [showEventSearch, setShowEventSearch] = useState(false);
  const [searchYear, setSearchYear] = useState(new Date().getFullYear().toString());
  const [searchResults, setSearchResults] = useState<any[]>([]);
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
      alert("TBA API Key is missing.");
      return;
    }
    setIsSearchingEvents(true);
    try {
      const response = await fetch(`https://www.thebluealliance.com/api/v3/events/${searchYear}`, {
        headers: { 'X-TBA-Auth-Key': tbaApiKey }
      });
      if (!response.ok) throw new Error("Failed to fetch events");
      const data = await response.json();
      setSearchResults(data);
    } catch (err) {
      console.error(err);
      alert("Error searching events.");
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
  const trajectoryDataMap = new Map<number, any>();
  
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
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans flex flex-col">
      {/* Admin Header */}
      <header className="bg-slate-900 border-b border-slate-800 p-4 shrink-0">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/')}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight">
                ADMIN MAINFRAME
              </h1>
              <p className="text-slate-400 text-sm">Central Command & Analytics</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-slate-950 px-4 py-2 rounded-lg border border-slate-800">
              <span className="text-sm text-slate-400 font-medium">EVENT KEY</span>
              <input
                type="text"
                value={eventKey}
                onChange={(e) => setEventKey(e.target.value)}
                className="bg-transparent text-white font-mono focus:outline-none w-24"
              />
              <button 
                onClick={() => setShowEventSearch(true)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <Search className="w-4 h-4" />
              </button>
            </div>
            {activeTab === 'analytics' && (
              <button 
                onClick={fetchData}
                disabled={loading}
                className="p-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Event Search Modal */}
      {showEventSearch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-lg w-full flex flex-col max-h-[80vh]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-black text-white">TBA EVENT SEARCH</h3>
              <button onClick={() => setShowEventSearch(false)} className="text-slate-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="flex gap-2 mb-4">
              <input 
                type="number" 
                value={searchYear}
                onChange={(e) => setSearchYear(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white outline-none focus:border-emerald-500 w-24"
              />
              <button 
                onClick={searchEvents}
                disabled={isSearchingEvents}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg px-4 py-2 transition-colors disabled:opacity-50"
              >
                {isSearchingEvents ? 'SEARCHING...' : 'SEARCH'}
              </button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 pr-2">
              {searchResults.length === 0 && !isSearchingEvents && (
                <div className="text-center text-slate-500 py-8">No events found.</div>
              )}
              {searchResults.map(event => (
                <button
                  key={event.key}
                  onClick={() => {
                    setEventKey(event.key);
                    setShowEventSearch(false);
                  }}
                  className="w-full text-left p-3 rounded-lg bg-slate-950 border border-slate-800 hover:border-emerald-500 transition-colors flex flex-col"
                >
                  <span className="font-bold text-white">{event.name}</span>
                  <span className="text-xs font-mono text-emerald-400">{event.key} • {new Date(event.start_date).toLocaleDateString()}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="bg-slate-900/50 border-b border-slate-800 px-4 shrink-0 overflow-x-auto">
        <div className="max-w-7xl mx-auto flex gap-2 py-2">
          <TabButton 
            active={activeTab === 'analytics'} 
            onClick={() => setActiveTab('analytics')} 
            icon={<TrendingUp className="w-4 h-4" />} 
            label="Analytics Engine" 
          />
          <TabButton 
            active={activeTab === 'scanner'} 
            onClick={() => setActiveTab('scanner')} 
            icon={<ScanLine className="w-4 h-4" />} 
            label="QR Scanner" 
          />
          <TabButton 
            active={activeTab === 'lookup'} 
            onClick={() => setActiveTab('lookup')} 
            icon={<Search className="w-4 h-4" />} 
            label="Team Lookup" 
          />
          <TabButton 
            active={activeTab === 'editor'} 
            onClick={() => setActiveTab('editor')} 
            icon={<Database className="w-4 h-4" />} 
            label="Raw Data Editor" 
          />
          <TabButton 
            active={activeTab === 'sorter'} 
            onClick={() => setActiveTab('sorter')} 
            icon={<ListOrdered className="w-4 h-4" />} 
            label="Team Sorter" 
          />
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-8">
          
          {activeTab === 'analytics' && (
            <>
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
                    Moneyball: OPRc vs. Under Pressure
                  </h2>
                  <div className="flex-1 w-full relative">
                    {loading ? (
                      <div className="absolute inset-0 flex items-center justify-center text-slate-500">Calculating...</div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                          <XAxis type="number" dataKey="pressure" name="Avg Under Pressure" stroke="#94a3b8" domain={[0, 10]} />
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
                            <td className="px-6 py-4 font-mono font-bold text-emerald-400">{m.oprc.toFixed(2)}</td>
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
            </>
          )}

          {activeTab === 'scanner' && (
            <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-6">
              <QRScannerView isEmbedded={true} />
            </div>
          )}

          {activeTab === 'lookup' && (
            <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-6">
              <TeamLookupView isEmbedded={true} eventKey={eventKey} />
            </div>
          )}

          {activeTab === 'editor' && (
            <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-6">
              <RawDataEditorView eventKey={eventKey} />
            </div>
          )}

          {activeTab === 'sorter' && (
            <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-6">
              <TeamSorterView eventKey={eventKey} />
            </div>
          )}

        </div>
      </main>
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors whitespace-nowrap ${
        active 
          ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' 
          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-transparent'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
