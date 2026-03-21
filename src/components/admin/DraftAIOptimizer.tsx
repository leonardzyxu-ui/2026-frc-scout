import React, { useMemo } from 'react';
import { TeamMetrics } from '../../utils/mathEngine';
import { BrainCircuit, Zap, Shield, ArrowUp, Target } from 'lucide-react';

interface DraftAIOptimizerProps {
  metrics: Record<string, TeamMetrics>;
  targetTeam?: string;
}

export default function DraftAIOptimizer({ metrics, targetTeam = '10479' }: DraftAIOptimizerProps) {
  const recommendations = useMemo(() => {
    const teams = Object.values(metrics);
    if (teams.length === 0) return null;

    const target = metrics[targetTeam];
    if (!target) return null;

    // 1. Define Elite Thresholds
    const ELITE_AUTO = 8.0;
    const ELITE_DEFENSE = 7.0;
    const ELITE_CLIMB = 0.8;

    // 2. Calculate Gaps for Target Team
    const autoGap = Math.max(0, ELITE_AUTO - target.avgAutoFluidity);
    const defenseGap = Math.max(0, ELITE_DEFENSE - target.avgDefenseEffectiveness);
    const climbGap = Math.max(0, ELITE_CLIMB - target.avgClimbRate);
    const totalGap = autoGap + defenseGap + climbGap || 1; // Prevent division by zero

    // 3. Normalize Metrics across all teams
    const maxPOPR = Math.max(...teams.map(t => t.popr));
    const minPOPR = Math.min(...teams.map(t => t.popr));
    const poprRange = maxPOPR - minPOPR || 1;

    const scoredTeams = teams
      .filter(t => t.teamNumber !== targetTeam)
      .map(team => {
        // Normalize 0-1
        const normPOPR = (team.popr - minPOPR) / poprRange;
        const normAuto = team.avgAutoFluidity / 10;
        const normDefense = team.avgDefenseEffectiveness / 10;
        const normClimb = team.avgClimbRate;

        // Calculate Synergy Match (60% weight)
        const synergyMatch = 
          (normAuto * (autoGap / totalGap)) + 
          (normDefense * (defenseGap / totalGap)) + 
          (normClimb * (climbGap / totalGap));

        // Final Score: 40% Base POPR + 60% Synergy
        const finalScore = (0.4 * normPOPR) + (0.6 * synergyMatch);

        // Determine Key Reason
        let keyReason = '';
        let reasonIcon = null;
        const contributions = [
          { name: 'Elite Auto', val: normAuto * (autoGap / totalGap), icon: <Zap className="w-4 h-4 text-amber-400" /> },
          { name: 'Elite Defense', val: normDefense * (defenseGap / totalGap), icon: <Shield className="w-4 h-4 text-rose-400" /> },
          { name: 'Reliable Climb', val: normClimb * (climbGap / totalGap), icon: <ArrowUp className="w-4 h-4 text-cyan-400" /> },
          { name: 'Raw Scoring Power', val: normPOPR * 0.4, icon: <Target className="w-4 h-4 text-emerald-400" /> }
        ].sort((a, b) => b.val - a.val);

        keyReason = `Fills Gap: ${contributions[0].name}`;
        reasonIcon = contributions[0].icon;

        return {
          team,
          score: finalScore * 100, // 0-100 scale
          keyReason,
          reasonIcon
        };
      })
      .sort((a, b) => b.score - a.score);

    return {
      target,
      gaps: { autoGap, defenseGap, climbGap, totalGap },
      scoredTeams
    };
  }, [metrics, targetTeam]);

  if (!recommendations || recommendations.scoredTeams.length === 0) {
    return (
      <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 text-center text-slate-500">
        <BrainCircuit className="w-12 h-12 mx-auto mb-4 opacity-20" />
        <p>Insufficient data to run Draft AI.</p>
      </div>
    );
  }

  const { target, gaps, scoredTeams } = recommendations;

  return (
    <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 flex flex-col h-full">
      <div className="flex items-center justify-between mb-6 border-b border-slate-800 pb-4">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <BrainCircuit className="text-fuchsia-400 w-6 h-6" />
          Draft AI Optimizer
        </h2>
        <div className="text-right">
          <div className="text-xs font-bold text-slate-500 tracking-widest uppercase">Target Team</div>
          <div className="text-2xl font-black text-fuchsia-400">{target.teamNumber}</div>
        </div>
      </div>

      {/* Gap Analysis */}
      <div className="mb-6 bg-slate-950 p-4 rounded-xl border border-slate-800">
        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3">Identified Synergy Gaps</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <div className="text-xs text-slate-500 mb-1">Auto Fluidity</div>
            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-amber-400" style={{ width: `${(gaps.autoGap / 8) * 100}%` }} />
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1">Defense</div>
            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-rose-400" style={{ width: `${(gaps.defenseGap / 7) * 100}%` }} />
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1">Climb Rate</div>
            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-cyan-400" style={{ width: `${(gaps.climbGap / 0.8) * 100}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Recommended Pick List */}
      <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
        {scoredTeams.slice(0, 10).map((item, index) => (
          <div key={item.team.teamNumber} className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-center justify-between group hover:border-fuchsia-500/50 transition-colors">
            <div className="flex items-center gap-4">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm ${index === 0 ? 'bg-fuchsia-600 text-white shadow-lg shadow-fuchsia-900/50' : 'bg-slate-800 text-slate-400'}`}>
                #{index + 1}
              </div>
              <div>
                <div className="text-xl font-black text-white">{item.team.teamNumber}</div>
                <div className="flex items-center gap-1.5 text-sm font-medium text-slate-400 mt-0.5">
                  {item.reasonIcon}
                  <span>{item.keyReason}</span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-black text-emerald-400">{item.score.toFixed(1)}</div>
              <div className="text-xs font-bold text-slate-500 tracking-widest uppercase">Synergy</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
