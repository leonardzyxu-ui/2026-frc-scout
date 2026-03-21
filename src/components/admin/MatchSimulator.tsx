import React, { useState, useEffect } from 'react';
import { TeamMetrics } from '../../utils/mathEngine';
import { Dices, Send, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface MatchSimulatorProps {
  metrics: Record<string, TeamMetrics>;
}

interface SimulationResult {
  redWinProb: number;
  blueWinProb: number;
  redAvgScore: number;
  blueAvgScore: number;
  redTeams: string[];
  blueTeams: string[];
  synergyNotes: string;
}

export default function MatchSimulator({ metrics }: MatchSimulatorProps) {
  const [red1, setRed1] = useState('');
  const [red2, setRed2] = useState('');
  const [red3, setRed3] = useState('');
  const [blue1, setBlue1] = useState('');
  const [blue2, setBlue2] = useState('');
  const [blue3, setBlue3] = useState('');

  const [isSimulating, setIsSimulating] = useState(false);
  const [result, setResult] = useState<SimulationResult | null>(null);
  
  const [webhookUrl, setWebhookUrl] = useState('');
  const [isPushing, setIsPushing] = useState(false);
  const [webhookStatus, setWebhookStatus] = useState<'idle' | 'success' | 'error'>('idle');

  useEffect(() => {
    const savedUrl = localStorage.getItem('discordWebhookUrl');
    if (savedUrl) setWebhookUrl(savedUrl);
  }, []);

  const handleWebhookChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setWebhookUrl(e.target.value);
    localStorage.setItem('discordWebhookUrl', e.target.value);
  };

  const calculateConsistency = (history: { match: number; popr: number }[]) => {
    if (!history || history.length < 2) return 5.0; // Default std dev if not enough data
    const mean = history.reduce((sum, h) => sum + h.popr, 0) / history.length;
    const variance = history.reduce((sum, h) => sum + Math.pow(h.popr - mean, 2), 0) / history.length;
    return Math.sqrt(variance) || 5.0;
  };

  const randomNormal = (mean: number, stdDev: number) => {
    const u = 1 - Math.random();
    const v = Math.random();
    const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return z * stdDev + mean;
  };

  const generateSynergyNotes = (redTeams: string[], blueTeams: string[]) => {
    let redAuto = 0, blueAuto = 0;
    let redEndgame = 0, blueEndgame = 0;

    redTeams.forEach(t => {
      if (metrics[t]) {
        redAuto += metrics[t].avgAutoFluidity;
        redEndgame += metrics[t].avgClimbRate;
      }
    });
    blueTeams.forEach(t => {
      if (metrics[t]) {
        blueAuto += metrics[t].avgAutoFluidity;
        blueEndgame += metrics[t].avgClimbRate;
      }
    });

    const autoAdvantage = redAuto > blueAuto ? 'Red' : 'Blue';
    const endgameAdvantage = redEndgame > blueEndgame ? 'Red' : 'Blue';

    if (autoAdvantage === endgameAdvantage) {
      return `${autoAdvantage} Alliance shows superior performance in both Autonomous fluidity and Endgame reliability.`;
    } else {
      return `${autoAdvantage} dominates in Auto, but ${endgameAdvantage} has superior Endgame reliability.`;
    }
  };

  const runSimulation = () => {
    const redTeams = [red1, red2, red3].filter(Boolean);
    const blueTeams = [blue1, blue2, blue3].filter(Boolean);

    if (redTeams.length !== 3 || blueTeams.length !== 3) {
      alert("Please enter 3 teams for both alliances.");
      return;
    }

    setIsSimulating(true);
    setResult(null);
    setWebhookStatus('idle');

    // Simulate async work to not block UI thread completely
    setTimeout(() => {
      const ITERATIONS = 10000;
      let redWins = 0;
      let blueWins = 0;
      let redTotalScore = 0;
      let blueTotalScore = 0;

      const getTeamStats = (team: string) => {
        const m = metrics[team];
        if (!m) return { mean: 0, stdDev: 5.0 }; // Fallback
        return { mean: m.popr, stdDev: calculateConsistency(m.poprHistory) };
      };

      const redStats = redTeams.map(getTeamStats);
      const blueStats = blueTeams.map(getTeamStats);

      for (let i = 0; i < ITERATIONS; i++) {
        let redScore = 0;
        let blueScore = 0;

        redStats.forEach(stat => redScore += Math.max(0, randomNormal(stat.mean, stat.stdDev)));
        blueStats.forEach(stat => blueScore += Math.max(0, randomNormal(stat.mean, stat.stdDev)));

        redTotalScore += redScore;
        blueTotalScore += blueScore;

        if (redScore > blueScore) redWins++;
        else if (blueScore > redScore) blueWins++;
        // Ties are ignored in win probability calculation
      }

      const totalDecisive = redWins + blueWins || 1;

      setResult({
        redWinProb: (redWins / totalDecisive) * 100,
        blueWinProb: (blueWins / totalDecisive) * 100,
        redAvgScore: redTotalScore / ITERATIONS,
        blueAvgScore: blueTotalScore / ITERATIONS,
        redTeams,
        blueTeams,
        synergyNotes: generateSynergyNotes(redTeams, blueTeams)
      });

      setIsSimulating(false);
    }, 100);
  };

  const pushToDiscord = async () => {
    if (!webhookUrl || !result) return;
    setIsPushing(true);
    setWebhookStatus('idle');

    const payload = {
      username: "REBUILT Oracle",
      avatar_url: "https://i.imgur.com/4M34hiw.png", // Generic bot avatar
      embeds: [
        {
          title: `Oracle Match Prediction: ${result.redTeams.join(', ')} vs ${result.blueTeams.join(', ')}`,
          color: 9647082, // #9333ea (Purple)
          fields: [
            {
              name: "Win Probability",
              value: `🔴 Red: **${result.redWinProb.toFixed(1)}%** | 🔵 Blue: **${result.blueWinProb.toFixed(1)}%**`,
              inline: false
            },
            {
              name: "Projected Score",
              value: `🔴 **${result.redAvgScore.toFixed(1)}** - 🔵 **${result.blueAvgScore.toFixed(1)}**`,
              inline: false
            },
            {
              name: "Key Synergy Notes",
              value: result.synergyNotes,
              inline: false
            }
          ],
          footer: {
            text: "Powered by REBUILT Monte Carlo Simulator (10,000 Iterations)"
          },
          timestamp: new Date().toISOString()
        }
      ]
    };

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        setWebhookStatus('success');
      } else {
        throw new Error('Discord API returned an error');
      }
    } catch (err) {
      console.error('Webhook Error:', err);
      setWebhookStatus('error');
    } finally {
      setIsPushing(false);
    }
  };

  return (
    <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 flex flex-col h-full">
      <div className="flex items-center justify-between mb-6 border-b border-slate-800 pb-4">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Dices className="text-blue-400 w-6 h-6" />
          Monte Carlo Simulator
        </h2>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Red Alliance */}
        <div className="space-y-3 p-4 bg-red-950/30 border border-red-900/50 rounded-xl">
          <h3 className="text-sm font-black text-red-500 tracking-widest uppercase text-center mb-2">Red Alliance</h3>
          <input type="number" value={red1} onChange={e => setRed1(e.target.value)} placeholder="Team 1" className="w-full bg-slate-950 border border-red-900/50 rounded-lg p-3 text-center text-white font-bold focus:outline-none focus:border-red-500" />
          <input type="number" value={red2} onChange={e => setRed2(e.target.value)} placeholder="Team 2" className="w-full bg-slate-950 border border-red-900/50 rounded-lg p-3 text-center text-white font-bold focus:outline-none focus:border-red-500" />
          <input type="number" value={red3} onChange={e => setRed3(e.target.value)} placeholder="Team 3" className="w-full bg-slate-950 border border-red-900/50 rounded-lg p-3 text-center text-white font-bold focus:outline-none focus:border-red-500" />
        </div>

        {/* Blue Alliance */}
        <div className="space-y-3 p-4 bg-blue-950/30 border border-blue-900/50 rounded-xl">
          <h3 className="text-sm font-black text-blue-500 tracking-widest uppercase text-center mb-2">Blue Alliance</h3>
          <input type="number" value={blue1} onChange={e => setBlue1(e.target.value)} placeholder="Team 1" className="w-full bg-slate-950 border border-blue-900/50 rounded-lg p-3 text-center text-white font-bold focus:outline-none focus:border-blue-500" />
          <input type="number" value={blue2} onChange={e => setBlue2(e.target.value)} placeholder="Team 2" className="w-full bg-slate-950 border border-blue-900/50 rounded-lg p-3 text-center text-white font-bold focus:outline-none focus:border-blue-500" />
          <input type="number" value={blue3} onChange={e => setBlue3(e.target.value)} placeholder="Team 3" className="w-full bg-slate-950 border border-blue-900/50 rounded-lg p-3 text-center text-white font-bold focus:outline-none focus:border-blue-500" />
        </div>
      </div>

      <button
        onClick={runSimulation}
        disabled={isSimulating}
        className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:opacity-50 text-white rounded-xl font-black text-lg tracking-wide shadow-lg shadow-blue-900/20 transition-all active:scale-95 mb-6"
      >
        {isSimulating ? 'SIMULATING 10,000 MATCHES...' : 'RUN 10,000 SIMULATIONS'}
      </button>

      {result && (
        <div className="bg-slate-950 p-6 rounded-xl border border-slate-800 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="text-center p-4 bg-red-950/30 border border-red-900/50 rounded-lg">
              <div className="text-3xl font-black text-red-500 mb-1">{result.redWinProb.toFixed(1)}%</div>
              <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Win Prob</div>
              <div className="text-lg font-bold text-white mt-2">{result.redAvgScore.toFixed(1)} pts</div>
            </div>
            <div className="text-center p-4 bg-blue-950/30 border border-blue-900/50 rounded-lg">
              <div className="text-3xl font-black text-blue-500 mb-1">{result.blueWinProb.toFixed(1)}%</div>
              <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Win Prob</div>
              <div className="text-lg font-bold text-white mt-2">{result.blueAvgScore.toFixed(1)} pts</div>
            </div>
          </div>

          <div className="space-y-4 border-t border-slate-800 pt-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Discord Webhook URL</label>
              <input 
                type="password" 
                value={webhookUrl}
                onChange={handleWebhookChange}
                placeholder="https://discord.com/api/webhooks/..."
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-purple-500"
              />
            </div>

            <button
              onClick={pushToDiscord}
              disabled={isPushing || !webhookUrl}
              className="w-full py-3 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-900 disabled:opacity-50 text-white rounded-lg font-bold tracking-wide shadow-lg shadow-purple-900/20 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <Send className="w-5 h-5" />
              {isPushing ? 'PUSHING...' : 'Push Prediction to Discord 🚀'}
            </button>

            {webhookStatus === 'success' && (
              <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium justify-center">
                <CheckCircle2 className="w-4 h-4" /> Successfully pushed to Discord!
              </div>
            )}
            {webhookStatus === 'error' && (
              <div className="flex items-center gap-2 text-red-400 text-sm font-medium justify-center">
                <AlertTriangle className="w-4 h-4" /> Failed to push to Discord. Check URL.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
