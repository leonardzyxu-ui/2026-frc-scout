import React, { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { MatchData, TeamStats } from '../types';
import Leaderboard from '../components/admin/Leaderboard';
import TeamLookup from '../components/admin/TeamLookup';
import MatchPredictor from '../components/admin/MatchPredictor';
import Scanner from '../components/admin/Scanner';
import PitScoutStats from '../components/admin/PitScoutStats';
import RawDataEditor from '../components/admin/RawDataEditor';

import { useNavigate } from 'react-router-dom';

const SECRET_HASH = "7dd41e237b514a64cb404ede0ddfa462ced85a3c3ef4a46e015c3063ee34cde2";

async function sha256(message: string) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export default function AdminView() {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'team' | 'predictor' | 'scanner' | 'pit' | 'raw'>('leaderboard');
  const [rawMatches, setRawMatches] = useState<MatchData[]>([]);
  const [leaderboardArray, setLeaderboardArray] = useState<TeamStats[]>([]);
  const [teamDataMap, setTeamDataMap] = useState<Record<string, TeamStats>>({});
  const [isLoading, setIsLoading] = useState(false);

  const verifyPassword = async (input: string) => {
    const hash = await sha256(input);
    return hash === SECRET_HASH;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (await verifyPassword(password)) {
      setIsAuthenticated(true);
      loadData();
    } else {
      setError(true);
      setTimeout(() => setError(false), 500);
    }
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, "matches"));
      const matches: MatchData[] = [];
      const tData: Record<string, TeamStats> = {};
      const lArray: TeamStats[] = [];

      const seenHashes = new Set<string>();
      const docsToDelete: string[] = [];

      const hashMatch = (d: any) => {
        return `${d.match}|${d.team}|${d.scout}|${d.counters?.auto_score}|${d.counters?.teleop_fuel}|${d.toggles?.auto_tower}|${d.toggles?.auto_mobility}|${d.endgame}|${d.notes}`;
      };

      querySnapshot.forEach((docSnap) => {
        const d = docSnap.data() as any;
        d.docId = docSnap.id;
        
        const hash = hashMatch(d);
        if (seenHashes.has(hash)) {
          docsToDelete.push(docSnap.id);
          return; // Skip duplicate
        }
        seenHashes.add(hash);
        
        const ptsAutoFuel = (d.counters?.auto_score || 0) * 1;
        const ptsAutoTower = d.toggles?.auto_tower ? 15 : 0;
        d.autoTotal = ptsAutoFuel + ptsAutoTower;
        const ptsTeleopFuel = (d.counters?.teleop_fuel || 0) * 1; 
        
        let endPts = 0;
        if(d.endgame === 'L1') endPts = 10; 
        if(d.endgame === 'L2') endPts = 20; 
        if(d.endgame === 'L3') endPts = 30;
        d.ptsEndgame = endPts;

        d.totalScore = d.autoTotal + ptsTeleopFuel + d.ptsEndgame;
        d.climbScore = ptsAutoTower + d.ptsEndgame; 
        
        const rps = d.rp || {};
        d.rpEarned = (rps.win ? 3 : 0) + (rps.tie ? 1 : 0) + (rps.climb ? 1 : 0) + (rps.fuel100 ? 1 : 0) + (rps.fuel360 ? 1 : 0);
        d.allianceScore = parseInt(d.allianceScore) || 0;

        matches.push(d);
      });

      if (docsToDelete.length > 0) {
        console.log(`Deleting ${docsToDelete.length} duplicate matches from Firebase...`);
        import('firebase/firestore').then(({ deleteDoc, doc }) => {
          Promise.all(docsToDelete.map(id => deleteDoc(doc(db, 'matches', id)))).catch(console.error);
        });
      }

      matches.forEach(d => {
        const t = d.team;
        if(!tData[t]) {
          tData[t] = { team: t, matches:[], totPoints: 0, totAuto: 0, totTeleop: 0, totEndgame: 0, totClimb: 0, totRPs: 0, deaths: 0, scouts: new Set(), avgPoints: 0, avgAuto: 0, avgTeleop: 0, avgEndgame: 0, avgClimb: 0, avgRPs: 0 };
        }
        tData[t].matches.push(d); 
        tData[t].totPoints += (d as any).totalScore; 
        tData[t].totAuto += (d as any).autoTotal; 
        tData[t].totTeleop += (d.counters?.teleop_fuel || 0); 
        tData[t].totEndgame += (d as any).ptsEndgame; 
        tData[t].totClimb += (d as any).climbScore; 
        tData[t].totRPs += (d as any).rpEarned; 
        if(d.toggles?.robot_died) tData[t].deaths++; 
        if(d.scout) tData[t].scouts.add(d.scout);
      });

      for(let t in tData) {
        const team = tData[t]; 
        const m = team.matches.length;
        team.avgPoints = parseFloat((team.totPoints / m).toFixed(1)); 
        team.avgAuto = parseFloat((team.totAuto / m).toFixed(1)); 
        team.avgTeleop = parseFloat((team.totTeleop / m).toFixed(1)); 
        team.avgEndgame = parseFloat((team.totEndgame / m).toFixed(1)); 
        team.avgClimb = parseFloat((team.totClimb / m).toFixed(1)); 
        team.avgRPs = parseFloat((team.totRPs / m).toFixed(2));
        lArray.push(team);
      }

      setRawMatches(matches);
      setTeamDataMap(tData);
      setLeaderboardArray(lArray);
    } catch (e: any) {
      alert("Load Error: " + e.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <form onSubmit={handleLogin} className="bg-slate-900 p-8 rounded-2xl border border-slate-700 shadow-2xl w-full max-w-md">
          <h3 className="text-2xl font-black text-white mb-2">Admin Security Check</h3>
          <p className="text-slate-400 mb-6 text-sm">Enter passcode to proceed.</p>
          <input 
            type="password" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`w-full bg-slate-950 border rounded-lg p-4 text-xl tracking-widest text-center focus:outline-none mb-6 text-white transition-colors ${error ? 'border-red-500 text-red-500' : 'border-slate-700 focus:border-blue-500'}`} 
            placeholder="•••••"
          />
          <button type="submit" className="w-full py-3 bg-blue-600 rounded-lg font-bold text-white hover:bg-blue-500 transition shadow-lg shadow-blue-900/50">
            Verify
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-white p-4 md:p-6 overflow-hidden">
      <div className="flex justify-between items-end border-b border-slate-800 pb-4 shrink-0">
        <div>
          <h1 className="text-3xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400">Scout Analytics v8.1</h1>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-[0.2em] mt-2">Data Processing & Direct Scanner API</p>
        </div>
        <div className="text-right flex gap-2">
          <button onClick={() => navigate('/admin/qr-scanner')} className="bg-purple-600 px-6 py-2 rounded-lg font-bold hover:bg-purple-500 transition shadow-lg shadow-purple-900/20 active:scale-95 text-white text-sm">
            📷 QR SCANNER
          </button>
          <button onClick={() => navigate('/admin/analytics')} className="bg-emerald-600 px-6 py-2 rounded-lg font-bold hover:bg-emerald-500 transition shadow-lg shadow-emerald-900/20 active:scale-95 text-white text-sm">
            📈 THE SHOWCASE
          </button>
          <button onClick={loadData} className="bg-blue-600 px-6 py-2 rounded-lg font-bold hover:bg-blue-500 transition shadow-lg shadow-blue-900/20 active:scale-95 text-white text-sm">
            {isLoading ? '🔄 LOADING...' : '🔄 FORCE REFRESH'}
          </button>
        </div>
      </div>

      <div className="flex gap-2 mt-4 shrink-0 overflow-x-auto pb-2">
        <button onClick={() => setActiveTab('leaderboard')} className={`px-6 py-3 font-black tracking-widest uppercase text-sm rounded-t-lg border-t border-x transition-colors ${activeTab === 'leaderboard' ? 'bg-blue-600 text-white border-blue-500' : 'bg-slate-800/50 text-slate-400 border-transparent hover:bg-slate-700'}`}>🏆 Leaderboard</button>
        <button onClick={() => setActiveTab('team')} className={`px-6 py-3 font-black tracking-widest uppercase text-sm rounded-t-lg border-t border-x transition-colors ${activeTab === 'team' ? 'bg-blue-600 text-white border-blue-500' : 'bg-slate-800/50 text-slate-400 border-transparent hover:bg-slate-700'}`}>🔍 Team Lookup</button>
        <button onClick={() => setActiveTab('predictor')} className={`px-6 py-3 font-black tracking-widest uppercase text-sm rounded-t-lg border-t border-x transition-colors ${activeTab === 'predictor' ? 'bg-blue-600 text-white border-blue-500' : 'bg-slate-800/50 text-slate-400 border-transparent hover:bg-slate-700'}`}>🔮 Predictor</button>
        <button onClick={() => setActiveTab('pit')} className={`px-6 py-3 font-black tracking-widest uppercase text-sm rounded-t-lg border-t border-x transition-colors ${activeTab === 'pit' ? 'bg-blue-600 text-white border-blue-500' : 'bg-slate-800/50 text-slate-400 border-transparent hover:bg-slate-700'}`}>🛠️ Pit Scout</button>
        <button onClick={() => setActiveTab('raw')} className={`px-6 py-3 font-black tracking-widest uppercase text-sm rounded-t-lg border-t border-x transition-colors ${activeTab === 'raw' ? 'bg-red-600 text-white border-red-500' : 'bg-slate-800/50 text-red-400/50 border-transparent hover:bg-slate-700'}`}>⚙️ Raw Data</button>
        <button onClick={() => setActiveTab('scanner')} className={`px-6 py-3 font-black tracking-widest uppercase text-sm rounded-t-lg border-t border-x transition-colors ml-auto ${activeTab === 'scanner' ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-slate-800/50 text-emerald-400/50 border-transparent hover:bg-slate-700'}`}>📷 Data Import</button>
      </div>

      <div className="flex-1 bg-slate-900 border border-slate-700 rounded-b-xl rounded-tr-xl overflow-hidden shadow-2xl relative flex flex-col">
        {activeTab === 'leaderboard' && <Leaderboard data={leaderboardArray} rawMatches={rawMatches} onRefresh={loadData} />}
        {activeTab === 'team' && <TeamLookup teamDataMap={teamDataMap} rawMatches={rawMatches} onRefresh={loadData} />}
        {activeTab === 'predictor' && <MatchPredictor />}
        {activeTab === 'pit' && <PitScoutStats />}
        {activeTab === 'raw' && <RawDataEditor matches={rawMatches} onRefresh={loadData} verifyPassword={verifyPassword} />}
        {activeTab === 'scanner' && <Scanner onScanSuccess={loadData} existingMatches={rawMatches} />}
      </div>
    </div>
  );
}
