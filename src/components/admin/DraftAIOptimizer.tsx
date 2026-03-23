import React, { useState, useMemo } from 'react';
import { TeamMetrics } from '../../utils/mathEngine';
import { BrainCircuit, Zap, Shield, ArrowUp, Target, AlertTriangle } from 'lucide-react';

interface DraftAIOptimizerProps {
  metrics: Record<string, TeamMetrics>;
  targetTeam?: string;
}

const COMPARISONS = [
  { id: 0, left: 'Auto OPRc', right: 'Teleop OPRc' },
  { id: 1, left: 'Auto OPRc', right: 'Defense' },
  { id: 2, left: 'Auto OPRc', right: 'Pressure' },
  { id: 3, left: 'Teleop OPRc', right: 'Defense' },
  { id: 4, left: 'Teleop OPRc', right: 'Pressure' },
  { id: 5, left: 'Defense', right: 'Pressure' },
];

const getRatioText = (v: number) => {
  if (v < 0) return `${-v + 1}:1`;
  if (v > 0) return `1:${v + 1}`;
  return `1:1`;
};

const getRatio = (v: number) => {
  if (v < 0) return -v + 1;
  if (v > 0) return 1 / (v + 1);
  return 1;
};

const normalize = (val: number, min: number, max: number) => {
  if (max === min) return 0;
  return (val - min) / (max - min);
};

export default function DraftAIOptimizer({ metrics, targetTeam = '10479' }: DraftAIOptimizerProps) {
  const [sliders, setSliders] = useState<number[]>([0, 0, 0, 0, 0, 0]);

  const handleSliderChange = (index: number, val: number) => {
    const newSliders = [...sliders];
    newSliders[index] = val;
    setSliders(newSliders);
  };

  const ahpResults = useMemo(() => {
    const matrix = [
      [1, getRatio(sliders[0]), getRatio(sliders[1]), getRatio(sliders[2])],
      [1 / getRatio(sliders[0]), 1, getRatio(sliders[3]), getRatio(sliders[4])],
      [1 / getRatio(sliders[1]), 1 / getRatio(sliders[3]), 1, getRatio(sliders[5])],
      [1 / getRatio(sliders[2]), 1 / getRatio(sliders[4]), 1 / getRatio(sliders[5]), 1]
    ];

    // 1. Column sums
    const colSums = [0, 0, 0, 0];
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        colSums[j] += matrix[i][j];
      }
    }

    // 2. Normalize columns and get row averages (Weights)
    const weights = [0, 0, 0, 0];
    for (let i = 0; i < 4; i++) {
      let rowSum = 0;
      for (let j = 0; j < 4; j++) {
        rowSum += matrix[i][j] / colSums[j];
      }
      weights[i] = rowSum / 4;
    }

    // 3. Calculate Lambda Max for Consistency Ratio
    let lambdaMax = 0;
    for (let i = 0; i < 4; i++) {
      let weightedSum = 0;
      for (let j = 0; j < 4; j++) {
        weightedSum += matrix[i][j] * weights[j];
      }
      lambdaMax += weightedSum / weights[i];
    }
    lambdaMax /= 4;

    // 4. Calculate Consistency Ratio (CR)
    const CI = (lambdaMax - 4) / 3;
    const CR = CI / 0.90; // Random Index for n=4 is 0.90

    return { weights, CR };
  }, [sliders]);

  const recommendations = useMemo(() => {
    const teams = Object.values(metrics);
    if (teams.length === 0) return null;

    const { weights } = ahpResults;

    const minMax = {
      auto: { min: Infinity, max: -Infinity },
      teleop: { min: Infinity, max: -Infinity },
      defense: { min: Infinity, max: -Infinity },
      pressure: { min: Infinity, max: -Infinity },
    };

    teams.forEach(t => {
      if (t.autoOprc < minMax.auto.min) minMax.auto.min = t.autoOprc;
      if (t.autoOprc > minMax.auto.max) minMax.auto.max = t.autoOprc;
      
      if (t.teleopOprc < minMax.teleop.min) minMax.teleop.min = t.teleopOprc;
      if (t.teleopOprc > minMax.teleop.max) minMax.teleop.max = t.teleopOprc;
      
      if (t.avgDefenseEffectiveness < minMax.defense.min) minMax.defense.min = t.avgDefenseEffectiveness;
      if (t.avgDefenseEffectiveness > minMax.defense.max) minMax.defense.max = t.avgDefenseEffectiveness;
      
      if (t.avgDriverPressure < minMax.pressure.min) minMax.pressure.min = t.avgDriverPressure;
      if (t.avgDriverPressure > minMax.pressure.max) minMax.pressure.max = t.avgDriverPressure;
    });

    const scoredTeams = teams
      .filter(t => t.teamNumber !== targetTeam)
      .map(team => {
        const normAuto = normalize(team.autoOprc, minMax.auto.min, minMax.auto.max);
        const normTeleop = normalize(team.teleopOprc, minMax.teleop.min, minMax.teleop.max);
        const normDefense = normalize(team.avgDefenseEffectiveness, minMax.defense.min, minMax.defense.max);
        const normPressure = normalize(team.avgDriverPressure, minMax.pressure.min, minMax.pressure.max);

        const score = (
          normAuto * weights[0] +
          normTeleop * weights[1] +
          normDefense * weights[2] +
          normPressure * weights[3]
        ) * 100;

        const contributions = [
          { name: 'Auto OPRc', val: normAuto * weights[0], icon: <Zap className="w-4 h-4 text-amber-400" /> },
          { name: 'Teleop OPRc', val: normTeleop * weights[1], icon: <ArrowUp className="w-4 h-4 text-cyan-400" /> },
          { name: 'Defense', val: normDefense * weights[2], icon: <Shield className="w-4 h-4 text-rose-400" /> },
          { name: 'Driver Pressure', val: normPressure * weights[3], icon: <Target className="w-4 h-4 text-emerald-400" /> }
        ].sort((a, b) => b.val - a.val);

        return {
          team,
          score,
          keyReason: `Strongest in: ${contributions[0].name}`,
          reasonIcon: contributions[0].icon
        };
      })
      .sort((a, b) => b.score - a.score);

    return scoredTeams;
  }, [metrics, targetTeam, ahpResults]);

  if (!recommendations || recommendations.length === 0) {
    return (
      <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 text-center text-slate-500">
        <BrainCircuit className="w-12 h-12 mx-auto mb-4 opacity-20" />
        <p>Insufficient data to run Draft AI.</p>
      </div>
    );
  }

  const { weights, CR } = ahpResults;

  return (
    <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 flex flex-col h-full">
      <div className="flex items-center justify-between mb-6 border-b border-slate-800 pb-4">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <BrainCircuit className="text-fuchsia-400 w-6 h-6" />
          Draft AI Optimizer (AHP)
        </h2>
        <div className="text-right">
          <div className="text-xs font-bold text-slate-500 tracking-widest uppercase">Target Team</div>
          <div className="text-2xl font-black text-fuchsia-400">{targetTeam}</div>
        </div>
      </div>

      {/* Strategy Configuration */}
      <div className="mb-6">
        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3">Strategy Configuration (Pairwise)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {COMPARISONS.map((comp, idx) => (
            <div key={idx} className="bg-slate-950 p-4 rounded-xl border border-slate-800">
              <div className="flex justify-between items-center text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
                <span className={sliders[idx] < 0 ? 'text-fuchsia-400' : ''}>{comp.left}</span>
                <span className="text-white bg-slate-800 px-2 py-1 rounded-md">{getRatioText(sliders[idx])}</span>
                <span className={sliders[idx] > 0 ? 'text-fuchsia-400' : ''}>{comp.right}</span>
              </div>
              <input 
                type="range" 
                min="-8" 
                max="8" 
                step="1" 
                value={sliders[idx]} 
                onChange={(e) => handleSliderChange(idx, parseInt(e.target.value))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-fuchsia-500"
              />
            </div>
          ))}
        </div>
      </div>

      {/* CR Warning */}
      {CR > 0.1 && (
        <div className="bg-yellow-500/10 border border-yellow-500/50 text-yellow-500 p-3 rounded-xl mb-6 flex items-center gap-3 text-sm font-medium">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          Warning: Strategy logic is mathematically inconsistent (CR = {CR.toFixed(2)}). Consider adjusting the sliders to be more transitive.
        </div>
      )}

      {/* AHP Weights */}
      <div className="mb-6 bg-slate-950 p-4 rounded-xl border border-slate-800">
        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3">AHP Calculated Weights</h3>
        <div className="grid grid-cols-4 gap-4">
          <div>
            <div className="text-xs text-slate-500 mb-1">Auto OPRc</div>
            <div className="text-lg font-black text-amber-400">{(weights[0] * 100).toFixed(1)}%</div>
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1">Teleop OPRc</div>
            <div className="text-lg font-black text-cyan-400">{(weights[1] * 100).toFixed(1)}%</div>
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1">Defense</div>
            <div className="text-lg font-black text-rose-400">{(weights[2] * 100).toFixed(1)}%</div>
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1">Pressure</div>
            <div className="text-lg font-black text-emerald-400">{(weights[3] * 100).toFixed(1)}%</div>
          </div>
        </div>
      </div>

      {/* Recommended Pick List */}
      <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
        {recommendations.slice(0, 10).map((item, index) => (
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
