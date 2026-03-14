import React, { useState } from 'react';

interface PredictorState {
  r1: string; r2: string; r3: string;
  b1: string; b2: string; b3: string;
}

const TeamInput = ({ label, value, onChange, color, onEnter }: { label: string, value: string, onChange: (v: string) => void, color: 'red' | 'blue', onEnter?: () => void }) => (
  <div className="flex flex-col gap-1">
    <label className={`text-xs font-bold uppercase tracking-widest ${color === 'red' ? 'text-red-400' : 'text-blue-400'}`}>{label}</label>
    <input 
      type="text" 
      inputMode="numeric"
      pattern="[0-9]*"
      value={value}
      onChange={(e) => {
        const val = e.target.value;
        if (/^\d*$/.test(val)) onChange(val);
      }}
      onKeyDown={(e) => e.key === 'Enter' && onEnter && onEnter()}
      className={`bg-black/50 border-2 rounded-xl p-3 text-xl font-black outline-none transition-colors text-white ${color === 'red' ? 'border-red-900 focus:border-red-500' : 'border-blue-900 focus:border-blue-500'}`} 
    />
  </div>
);

export default function MatchPredictor() {
  const [teams, setTeams] = useState<PredictorState>({
    r1: '', r2: '', r3: '',
    b1: '', b2: '', b3: ''
  });
  
  const [eventKey, setEventKey] = useState('2026sh');
  const [matchNumber, setMatchNumber] = useState('');
  const [predictionMode, setPredictionMode] = useState<'statbotics' | 'tba' | 'both'>('statbotics');
  const [prediction, setPrediction] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingMatch, setIsFetchingMatch] = useState(false);

  const fetchMatchTeams = async () => {
    if (!matchNumber) return;
    setIsFetchingMatch(true);
    try {
      const apiKey = import.meta.env.VITE_TBA_API_KEY;
      if (!apiKey) {
        alert("TBA API Key is missing in .env");
        return;
      }
      // Match key format: {eventKey}_qm{matchNumber}
      const res = await fetch(`https://www.thebluealliance.com/api/v3/match/${eventKey}_qm${matchNumber}`, {
        headers: { 'X-TBA-Auth-Key': apiKey }
      });
      if (res.ok) {
        const data = await res.json();
        const redTeams = data.alliances.red.team_keys.map((k: string) => k.replace('frc', ''));
        const blueTeams = data.alliances.blue.team_keys.map((k: string) => k.replace('frc', ''));
        setTeams({
          r1: redTeams[0] || '', r2: redTeams[1] || '', r3: redTeams[2] || '',
          b1: blueTeams[0] || '', b2: blueTeams[1] || '', b3: blueTeams[2] || ''
        });
      } else {
        alert("Match not found on TBA.");
      }
    } catch (e) {
      console.error("Error fetching match:", e);
      alert("Failed to fetch match from TBA.");
    } finally {
      setIsFetchingMatch(false);
    }
  };

  const handlePredict = async () => {
    setIsLoading(true);
    try {
      const fetchEPA = async (team: string) => {
        if (!team) return 0;
        try {
          const res = await fetch(`https://api.statbotics.io/v3/team_year/${team}/2026`);
          if (res.ok) {
            const data = await res.json();
            if (data.epa?.total_points?.mean !== undefined) return data.epa.total_points.mean;
          }
          const fallbackRes = await fetch(`https://api.statbotics.io/v3/team/${team}`);
          if (fallbackRes.ok) {
            const data = await fallbackRes.json();
            return data.norm_epa?.recent / 15 || 0; 
          }
        } catch (e) {
          console.warn(`Failed to fetch EPA for team ${team}`);
        }
        return 0;
      };

      const fetchOPR = async (team: string) => {
        if (!team) return 0;
        try {
          const apiKey = import.meta.env.VITE_TBA_API_KEY;
          if (!apiKey) return 0;
          const res = await fetch(`https://www.thebluealliance.com/api/v3/event/${eventKey}/oprs`, {
            headers: { 'X-TBA-Auth-Key': apiKey }
          });
          if (res.ok) {
            const data = await res.json();
            return data.oprs[`frc${team}`] || 0;
          }
        } catch (e) {
          console.warn(`Failed to fetch OPR for team ${team}`);
        }
        return 0;
      };

      let r1Stat = 0, r2Stat = 0, r3Stat = 0, b1Stat = 0, b2Stat = 0, b3Stat = 0;
      let r1Opr = 0, r2Opr = 0, r3Opr = 0, b1Opr = 0, b2Opr = 0, b3Opr = 0;

      if (predictionMode === 'statbotics' || predictionMode === 'both') {
        [r1Stat, r2Stat, r3Stat, b1Stat, b2Stat, b3Stat] = await Promise.all([
          fetchEPA(teams.r1), fetchEPA(teams.r2), fetchEPA(teams.r3),
          fetchEPA(teams.b1), fetchEPA(teams.b2), fetchEPA(teams.b3)
        ]);
      }

      if (predictionMode === 'tba' || predictionMode === 'both') {
        // To optimize, we can fetch OPRs once for the event, but for simplicity we fetch per team or just fetch the event once
        const apiKey = import.meta.env.VITE_TBA_API_KEY;
        if (apiKey) {
          const res = await fetch(`https://www.thebluealliance.com/api/v3/event/${eventKey}/oprs`, {
            headers: { 'X-TBA-Auth-Key': apiKey }
          });
          if (res.ok) {
            const data = await res.json();
            r1Opr = data.oprs[`frc${teams.r1}`] || 0;
            r2Opr = data.oprs[`frc${teams.r2}`] || 0;
            r3Opr = data.oprs[`frc${teams.r3}`] || 0;
            b1Opr = data.oprs[`frc${teams.b1}`] || 0;
            b2Opr = data.oprs[`frc${teams.b2}`] || 0;
            b3Opr = data.oprs[`frc${teams.b3}`] || 0;
          }
        }
      }

      let redTotal = 0;
      let blueTotal = 0;
      let redProb = 0;
      let blueProb = 0;
      let breakdownRed: number[] = [];
      let breakdownBlue: number[] = [];
      let breakdownRedStat: number[] = [];
      let breakdownBlueStat: number[] = [];
      let breakdownRedOpr: number[] = [];
      let breakdownBlueOpr: number[] = [];

      const calcProb = (r: number, b: number) => 1 / (1 + Math.pow(10, -(r - b) / 400));

      if (predictionMode === 'statbotics') {
        redTotal = r1Stat + r2Stat + r3Stat;
        blueTotal = b1Stat + b2Stat + b3Stat;
        redProb = calcProb(redTotal, blueTotal);
        blueProb = 1 - redProb;
        breakdownRed = [r1Stat, r2Stat, r3Stat];
        breakdownBlue = [b1Stat, b2Stat, b3Stat];
      } else if (predictionMode === 'tba') {
        redTotal = r1Opr + r2Opr + r3Opr;
        blueTotal = b1Opr + b2Opr + b3Opr;
        redProb = calcProb(redTotal, blueTotal);
        blueProb = 1 - redProb;
        breakdownRed = [r1Opr, r2Opr, r3Opr];
        breakdownBlue = [b1Opr, b2Opr, b3Opr];
      } else {
        const redStatTotal = r1Stat + r2Stat + r3Stat;
        const blueStatTotal = b1Stat + b2Stat + b3Stat;
        const redOprTotal = r1Opr + r2Opr + r3Opr;
        const blueOprTotal = b1Opr + b2Opr + b3Opr;

        redTotal = (redStatTotal + redOprTotal) / 2;
        blueTotal = (blueStatTotal + blueOprTotal) / 2;

        const probStat = calcProb(redStatTotal, blueStatTotal);
        const probOpr = calcProb(redOprTotal, blueOprTotal);
        
        redProb = (probStat + probOpr) / 2;
        blueProb = 1 - redProb;

        breakdownRed = [(r1Stat+r1Opr)/2, (r2Stat+r2Opr)/2, (r3Stat+r3Opr)/2];
        breakdownBlue = [(b1Stat+b1Opr)/2, (b2Stat+b2Opr)/2, (b3Stat+b3Opr)/2];
        breakdownRedStat = [r1Stat, r2Stat, r3Stat];
        breakdownBlueStat = [b1Stat, b2Stat, b3Stat];
        breakdownRedOpr = [r1Opr, r2Opr, r3Opr];
        breakdownBlueOpr = [b1Opr, b2Opr, b3Opr];
      }

      setPrediction({
        red: { total: redTotal.toFixed(1), breakdown: breakdownRed, breakdownStat: breakdownRedStat, breakdownOpr: breakdownRedOpr, prob: (redProb * 100).toFixed(1) },
        blue: { total: blueTotal.toFixed(1), breakdown: breakdownBlue, breakdownStat: breakdownBlueStat, breakdownOpr: breakdownBlueOpr, prob: (blueProb * 100).toFixed(1) },
        mode: predictionMode
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col p-6 overflow-y-auto h-full items-center">
      <div className="w-full max-w-4xl">
        <h2 className="text-3xl font-black text-white mb-6 text-center bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">Match Predictor</h2>
        
        <div className="bg-slate-800/50 border border-white/10 p-6 rounded-3xl mb-8 shadow-xl">
          <div className="flex flex-col md:flex-row gap-4 items-end mb-6">
            <div className="flex-1 w-full">
              <label className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1 block">Event</label>
              <select 
                value={eventKey} 
                onChange={(e) => setEventKey(e.target.value)}
                className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white outline-none focus:border-blue-500"
              >
                <option value="2026sh">Shanghai Regional (2026sh)</option>
                <option value="2026mnmi2">Minnesota North Star (2026mnmi2)</option>
              </select>
            </div>
            <div className="flex-1 w-full">
              <label className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1 block">Match Number</label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={matchNumber}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (/^\d*$/.test(val)) setMatchNumber(val);
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && fetchMatchTeams()}
                  className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white outline-none focus:border-blue-500"
                  placeholder="e.g. 1"
                />
                <button 
                  onClick={fetchMatchTeams}
                  disabled={isFetchingMatch}
                  className="bg-blue-600 px-4 rounded-xl font-bold text-white hover:bg-blue-500 transition disabled:opacity-50"
                >
                  {isFetchingMatch ? '...' : 'GET'}
                </button>
              </div>
            </div>
          </div>

          <div className="flex justify-center gap-2 mb-6 bg-black/30 p-1 rounded-xl w-fit mx-auto border border-white/5">
            <button 
              onClick={() => setPredictionMode('statbotics')}
              className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${predictionMode === 'statbotics' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
            >
              Statbotics (EPA)
            </button>
            <button 
              onClick={() => setPredictionMode('tba')}
              className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${predictionMode === 'tba' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
            >
              TBA (OPR)
            </button>
            <button 
              onClick={() => setPredictionMode('both')}
              className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${predictionMode === 'both' ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
            >
              Average Both
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          <div className="bg-red-900/10 border border-red-500/30 p-6 rounded-3xl flex flex-col gap-4 shadow-[0_0_30px_rgba(239,68,68,0.05)]">
            <h3 className="text-xl font-black text-red-500 text-center">RED ALLIANCE</h3>
            <TeamInput label="Team 1" value={teams.r1} onChange={(v) => setTeams({...teams, r1: v})} color="red" onEnter={handlePredict} />
            <TeamInput label="Team 2" value={teams.r2} onChange={(v) => setTeams({...teams, r2: v})} color="red" onEnter={handlePredict} />
            <TeamInput label="Team 3" value={teams.r3} onChange={(v) => setTeams({...teams, r3: v})} color="red" onEnter={handlePredict} />
          </div>
          
          <div className="bg-blue-900/10 border border-blue-500/30 p-6 rounded-3xl flex flex-col gap-4 shadow-[0_0_30px_rgba(59,130,246,0.05)]">
            <h3 className="text-xl font-black text-blue-500 text-center">BLUE ALLIANCE</h3>
            <TeamInput label="Team 1" value={teams.b1} onChange={(v) => setTeams({...teams, b1: v})} color="blue" onEnter={handlePredict} />
            <TeamInput label="Team 2" value={teams.b2} onChange={(v) => setTeams({...teams, b2: v})} color="blue" onEnter={handlePredict} />
            <TeamInput label="Team 3" value={teams.b3} onChange={(v) => setTeams({...teams, b3: v})} color="blue" onEnter={handlePredict} />
          </div>
        </div>

        <button 
          onClick={handlePredict}
          disabled={isLoading}
          className="w-full py-5 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl font-black text-2xl text-white shadow-[0_0_40px_rgba(79,70,229,0.3)] active:scale-95 hover:from-indigo-500 hover:to-purple-500 transition-all disabled:opacity-50"
        >
          {isLoading ? 'CALCULATING...' : 'PREDICT OUTCOME'}
        </button>

        {prediction && (
          <div className="mt-8 bg-slate-800/70 backdrop-blur-md rounded-3xl border border-white/10 p-8 shadow-2xl">
            <h3 className="text-center text-sm font-bold text-slate-400 uppercase tracking-widest mb-6">
              Predicted Results ({prediction.mode === 'statbotics' ? 'EPA' : prediction.mode === 'tba' ? 'OPR' : 'EPA + OPR Avg'})
            </h3>
            
            <div className="grid grid-cols-2 gap-8">
              <div className="flex flex-col items-center text-center">
                <span className="text-6xl font-black text-red-500 mb-2 drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]">{prediction.red.total}</span>
                <span className="text-sm text-red-300 font-bold mb-4 bg-red-900/30 px-3 py-1 rounded-full">{prediction.red.prob}% Win Prob</span>
                <div className="text-xs text-slate-400 font-mono space-y-1 w-full">
                  {prediction.mode === 'both' ? (
                    <div className="flex flex-col gap-2">
                      <div className="bg-black/30 p-2 rounded">
                        <div className="font-bold text-slate-300 mb-1">EPA (Statbotics)</div>
                        {prediction.red.breakdownStat.map((val: number, i: number) => (
                          <div key={i}>T{i+1}: {val.toFixed(1)}</div>
                        ))}
                      </div>
                      <div className="bg-black/30 p-2 rounded">
                        <div className="font-bold text-slate-300 mb-1">OPR (TBA)</div>
                        {prediction.red.breakdownOpr.map((val: number, i: number) => (
                          <div key={i}>T{i+1}: {val.toFixed(1)}</div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    prediction.red.breakdown.map((val: number, i: number) => (
                      <div key={i} className="bg-black/30 px-2 py-1 rounded">T{i+1}: {val.toFixed(1)}</div>
                    ))
                  )}
                </div>
              </div>
              
              <div className="flex flex-col items-center text-center border-l border-white/10">
                <span className="text-6xl font-black text-blue-500 mb-2 drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]">{prediction.blue.total}</span>
                <span className="text-sm text-blue-300 font-bold mb-4 bg-blue-900/30 px-3 py-1 rounded-full">{prediction.blue.prob}% Win Prob</span>
                <div className="text-xs text-slate-400 font-mono space-y-1 w-full">
                  {prediction.mode === 'both' ? (
                    <div className="flex flex-col gap-2">
                      <div className="bg-black/30 p-2 rounded">
                        <div className="font-bold text-slate-300 mb-1">EPA (Statbotics)</div>
                        {prediction.blue.breakdownStat.map((val: number, i: number) => (
                          <div key={i}>T{i+1}: {val.toFixed(1)}</div>
                        ))}
                      </div>
                      <div className="bg-black/30 p-2 rounded">
                        <div className="font-bold text-slate-300 mb-1">OPR (TBA)</div>
                        {prediction.blue.breakdownOpr.map((val: number, i: number) => (
                          <div key={i}>T{i+1}: {val.toFixed(1)}</div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    prediction.blue.breakdown.map((val: number, i: number) => (
                      <div key={i} className="bg-black/30 px-2 py-1 rounded">T{i+1}: {val.toFixed(1)}</div>
                    ))
                  )}
                </div>
              </div>
            </div>
            
            <div className="mt-8 h-6 w-full bg-slate-900 rounded-full overflow-hidden flex shadow-inner">
              <div className="h-full bg-gradient-to-r from-red-600 to-red-500 transition-all duration-1000" style={{ width: `${prediction.red.prob}%` }}></div>
              <div className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-1000" style={{ width: `${prediction.blue.prob}%` }}></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
