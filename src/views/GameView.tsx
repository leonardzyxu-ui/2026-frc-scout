import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useScout } from '../context/ScoutContext';

const TOTAL_TIME = 160;

export default function GameView() {
  const { matchData, updateMatchData } = useScout();
  const navigate = useNavigate();
  const [elapsed, setElapsed] = useState(0);
  const [defenseStartTime, setDefenseStartTime] = useState<number>(0);
  const [overlayText, setOverlayText] = useState<string | null>(null);
  const [reviewPhase, setReviewPhase] = useState<'auto' | 'teleop'>('teleop');

  useEffect(() => {
    if (!matchData.startTime) {
      navigate('/');
      return;
    }

    const initialElapsed = (Date.now() - matchData.startTime) / 1000;
    if (initialElapsed >= TOTAL_TIME || matchData.toggles.robot_died) {
      setElapsed(initialElapsed);
      return; // Don't auto-navigate if returning to an already finished match
    }

    const interval = setInterval(() => {
      if (matchData.toggles.robot_died) return;
      
      const currentElapsed = (Date.now() - matchData.startTime) / 1000;
      setElapsed(currentElapsed);

      if (currentElapsed >= TOTAL_TIME) {
        clearInterval(interval);
        navigate('/checkout');
      }
    }, 250);

    return () => clearInterval(interval);
  }, [matchData.startTime, matchData.toggles.robot_died, navigate]);

  const remaining = Math.max(0, TOTAL_TIME - elapsed);
  const isMatchOver = elapsed >= TOTAL_TIME;
  const isAuto = isMatchOver ? reviewPhase === 'auto' : elapsed < 20;
  const isTeleop = isMatchOver ? reviewPhase === 'teleop' : elapsed >= 20;
  
  // Phase logic
  let active = false;
  let phaseText = "PRE-MATCH";
  
  if (elapsed < 20) {
    active = true;
    phaseText = "AUTO // ACTIVE";
  } else if (elapsed < TOTAL_TIME) {
    active = true;
    if (elapsed < 30) {
      phaseText = "TRANSITION";
    } else if (elapsed >= 130) {
      phaseText = "ENDGAME";
    } else {
      phaseText = "TELEOP // ACTIVE";
    }
  }
  
  if (isMatchOver) {
    active = false;
    phaseText = "MATCH OVER";
  }

  const getTimer = useCallback(() => ((Date.now() - matchData.startTime) / 1000).toFixed(1), [matchData.startTime]);

  const recordBatch = (amount: number) => {
    if (!active && !isAuto) {
      if (navigator.vibrate) navigator.vibrate([50, 50]);
      return;
    }
    if (navigator.vibrate) navigator.vibrate(40);
    
    updateMatchData({
      counters: { ...matchData.counters, teleop_fuel: matchData.counters.teleop_fuel + amount },
      actions: [...matchData.actions, { t: getTimer(), id: 'score', val: amount }]
    });
  };

  const undoLastBatch = () => {
    const actions = [...matchData.actions];
    let index = -1;
    for (let i = actions.length - 1; i >= 0; i--) {
      if (actions[i].id === 'score') {
        index = i;
        break;
      }
    }
    if (index !== -1) {
      const val = actions[index].val;
      actions.splice(index, 1);
      updateMatchData({
        counters: { ...matchData.counters, teleop_fuel: Math.max(0, matchData.counters.teleop_fuel - val) },
        actions
      });
    }
  };

  const toggleDefense = () => {
    if (!defenseStartTime) {
      setDefenseStartTime(Date.now());
    } else {
      const dur = (Date.now() - defenseStartTime) / 1000;
      updateMatchData({
        actions: [...matchData.actions, { t: getTimer(), id: 'defense_dur', val: dur }],
        toggles: { ...matchData.toggles, defense: true }
      });
      setDefenseStartTime(0);
    }
  };

  const selectEndgame = (level: 'None' | 'L1' | 'L2' | 'L3') => {
    updateMatchData({ endgame: level });
    if (level !== 'None') {
      setOverlayText(`LEVEL ${level.replace('L', '')} CLIMB`);
    } else {
      setOverlayText(null);
    }
  };

  const handleRobotDied = () => {
    if (window.confirm("Mark Robot as DIED? This ends scouting for this match.")) {
      const reason = window.prompt("Why and how did the robot die? (e.g. Battery fell out, flipped)");
      updateMatchData({
        toggles: { ...matchData.toggles, robot_died: true },
        diedReason: reason || "No reason given"
      });
      navigate('/checkout');
    }
  };

  // Keybinds
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const key = e.key.toLowerCase();
      
      if (isAuto) {
        if (key === 'm') updateMatchData({ toggles: { ...matchData.toggles, auto_mobility: !matchData.toggles.auto_mobility } });
        if (key === '-' || key === '_') updateMatchData({ counters: { ...matchData.counters, auto_score: Math.max(0, matchData.counters.auto_score - 1) } });
        if (key === '=' || key === '+') updateMatchData({ counters: { ...matchData.counters, auto_score: matchData.counters.auto_score + 1 } });
        if (key === 't') {
          const newTower = !matchData.toggles.auto_tower;
          updateMatchData({ toggles: { ...matchData.toggles, auto_tower: newTower, auto_mobility: newTower ? true : matchData.toggles.auto_mobility } });
          if (newTower) setOverlayText("AUTO L1 CLIMB");
          else setOverlayText(null);
        }
      }
      
      if (isTeleop) {
        if (key === '1') recordBatch(1);
        if (key === '2') recordBatch(2);
        if (key === '3') recordBatch(3);
        if (key === '4') recordBatch(4);
        if (key === '5') recordBatch(5);
        if (key === 'z') undoLastBatch();
        if (key === 'h') updateMatchData({ counters: { ...matchData.counters, hoard_fuel: matchData.counters.hoard_fuel + 1 } });
        if (key === 'd') toggleDefense();
      }
      
      if (isTeleop || elapsed >= 130) {
        if (key === 'q') selectEndgame('None');
        if (key === 'w') selectEndgame('L1');
        if (key === 'e') selectEndgame('L2');
        if (key === 'r') selectEndgame('L3');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAuto, isTeleop, matchData, elapsed, defenseStartTime]);

  return (
    <div className="flex flex-col h-full relative">
      {/* HEADER */}
      <div className="h-24 flex justify-between items-center px-4 bg-slate-800/50 backdrop-blur-md border-b border-white/10 shrink-0 z-50 shadow-2xl">
        <div className="flex flex-col justify-center h-full items-start pl-2 w-1/3">
          <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">STATUS</div>
          <div className={`text-3xl font-black italic tracking-tighter leading-none transition-all duration-300 ${active ? 'text-green-400 drop-shadow-[0_0_15px_rgba(74,222,128,0.8)]' : 'text-red-400 drop-shadow-[0_0_15px_rgba(248,113,113,0.8)]'}`}>
            {phaseText}
          </div>
        </div>
        <div className="flex justify-center w-1/3">
          <div className="text-6xl font-mono font-bold tracking-tighter text-white drop-shadow-2xl tabular-nums">
            {Math.floor(remaining / 60)}:{(Math.floor(remaining % 60)).toString().padStart(2, '0')}
          </div>
        </div>
        <div className="flex justify-end h-full py-3 w-1/3">
          {elapsed >= TOTAL_TIME ? (
            <button 
              onClick={() => navigate('/checkout')}
              className="w-32 h-full bg-emerald-500/20 border-2 border-emerald-500 text-emerald-100 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-emerald-600 hover:text-white transition animate-pulse flex flex-col items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.4)]"
            >
              <span className="text-2xl mb-1">✅</span><span>CHECKOUT</span>
            </button>
          ) : (
            <button 
              onClick={handleRobotDied}
              className="w-32 h-full bg-red-500/20 border-2 border-red-500 text-red-100 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-red-600 hover:text-white transition animate-pulse flex flex-col items-center justify-center shadow-[0_0_15px_rgba(220,38,38,0.4)]"
            >
              <span className="text-2xl mb-1">☠️</span><span>ROBOT DIED</span>
            </button>
          )}
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 p-4 overflow-y-auto relative z-30 pb-32">
        
        {isMatchOver && (
          <div className="flex rounded-xl overflow-hidden border border-white/10 mb-4 bg-slate-800/50">
            <button 
              onClick={() => setReviewPhase('auto')}
              className={`flex-1 py-3 font-black tracking-widest uppercase text-sm transition-colors ${reviewPhase === 'auto' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-700'}`}
            >
              Review Auto
            </button>
            <div className="w-px bg-white/10"></div>
            <button 
              onClick={() => setReviewPhase('teleop')}
              className={`flex-1 py-3 font-black tracking-widest uppercase text-sm transition-colors ${reviewPhase === 'teleop' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-700'}`}
            >
              Review Teleop
            </button>
          </div>
        )}

        {/* AUTO PHASE */}
        {isAuto && (
          <div className="flex flex-col gap-4 h-full relative">
            {!matchData.toggles.auto_mobility && matchData.counters.auto_score === 0 && !matchData.toggles.auto_tower && (
              <div className="absolute inset-0 z-20 flex flex-col gap-4">
                <button 
                  onClick={() => updateMatchData({ toggles: { ...matchData.toggles, auto_mobility: true } })}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 rounded-3xl flex flex-col items-center justify-center gap-4 shadow-2xl border-b-8 border-emerald-800 relative transition-colors"
                >
                  <span className="absolute top-4 left-6 text-emerald-900 font-mono text-xl">[ M ]</span>
                  <span className="text-8xl animate-bounce">🏁</span>
                  <span className="text-4xl font-black text-white tracking-tighter">ROBOT MOVED</span>
                  <span className="text-sm font-bold text-emerald-200 tracking-widest uppercase">Tap to Unlock Scoring</span>
                </button>
                <button 
                  onClick={() => updateMatchData({ toggles: { ...matchData.toggles, auto_mobility: false } })} // Just to dismiss gatekeeper
                  className="h-24 bg-gray-700/80 hover:bg-gray-600/80 active:bg-gray-500/80 rounded-2xl flex items-center justify-center gap-2 border-2 border-white/10 transition-colors"
                >
                  <span className="text-gray-400 font-bold uppercase tracking-wider">Stationary / Shooting Only</span>
                </button>
              </div>
            )}
            
            <div className={`flex flex-col gap-4 h-full transition-opacity duration-500 ${(!matchData.toggles.auto_mobility && matchData.counters.auto_score === 0 && !matchData.toggles.auto_tower) ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
              <button 
                onClick={() => updateMatchData({ toggles: { ...matchData.toggles, auto_mobility: !matchData.toggles.auto_mobility } })}
                className={`bg-slate-800/60 hover:bg-slate-700/60 active:bg-slate-600/60 backdrop-blur-md rounded-xl border border-white/10 h-20 w-full flex items-center justify-between px-8 transition-colors shrink-0 relative select-none touch-manipulation ${matchData.toggles.auto_mobility ? 'bg-emerald-500/20 border-l-8 border-l-emerald-500' : 'border-l-8 border-l-transparent'}`}
              >
                <span className="absolute top-2 left-2 text-[10px] text-gray-500 font-mono pointer-events-none">[ M ]</span>
                <span className="text-2xl font-bold flex items-center gap-4 pl-4 pointer-events-none"><span className="text-4xl">🏁</span> Mobility</span>
                <div className="flex flex-col items-end pointer-events-none">
                  <span className={`text-sm font-black uppercase tracking-widest px-4 py-2 rounded-lg ${matchData.toggles.auto_mobility ? 'text-emerald-400 bg-emerald-900/50 border border-emerald-500/50' : 'text-gray-500 bg-black/30 border border-white/10'}`}>
                    {matchData.toggles.auto_mobility ? 'YES' : 'NO'}
                  </span>
                </div>
              </button>
              
              <div className="bg-slate-800/60 backdrop-blur-md rounded-xl border border-white/10 flex-1 flex flex-col p-4 border-t-4 border-t-yellow-500/50 justify-between min-h-[300px]">
                <div className="flex justify-between items-start shrink-0">
                  <span className="text-sm text-yellow-500 font-bold tracking-[0.2em] uppercase">Auto Fuel</span>
                  <span className="text-8xl font-black leading-none text-white pointer-events-none">{matchData.counters.auto_score}</span>
                </div>
                <div className="flex gap-4 flex-1 mt-4">
                  <button 
                    onClick={() => updateMatchData({ counters: { ...matchData.counters, auto_score: Math.max(0, matchData.counters.auto_score - 1) } })}
                    className="w-32 rounded-3xl bg-white/5 text-white/50 text-6xl font-bold flex items-center justify-center border-2 border-white/10 hover:bg-white/10 active:bg-white/20 transition-colors relative select-none touch-manipulation"
                  >
                    <span className="absolute top-2 left-3 text-sm opacity-30 font-mono pointer-events-none">[ - ]</span>-
                  </button>
                  <button 
                    onClick={() => updateMatchData({ counters: { ...matchData.counters, auto_score: matchData.counters.auto_score + 1 } })}
                    className="flex-1 rounded-3xl bg-yellow-500 hover:bg-yellow-400 active:bg-yellow-600 text-black text-7xl font-black shadow-2xl flex items-center justify-center gap-2 border-b-8 border-yellow-700 relative transition-colors select-none touch-manipulation"
                  >
                    <span className="absolute top-2 left-3 text-sm text-black/50 font-mono pointer-events-none">[ = ]</span>+1
                  </button>
                </div>
              </div>
              
              <button 
                onClick={() => {
                  const newTower = !matchData.toggles.auto_tower;
                  updateMatchData({ toggles: { ...matchData.toggles, auto_tower: newTower, auto_mobility: newTower ? true : matchData.toggles.auto_mobility } });
                  if (newTower) setOverlayText("AUTO L1 CLIMB");
                  else setOverlayText(null);
                }}
                className={`bg-slate-800/60 hover:bg-slate-700/60 active:bg-slate-600/60 backdrop-blur-md rounded-xl border border-white/10 h-28 w-full flex items-center justify-center gap-6 transition-colors z-[50] shrink-0 relative select-none touch-manipulation ${matchData.toggles.auto_tower ? 'bg-purple-600 hover:bg-purple-500 active:bg-purple-700 border-b-8 border-b-purple-900' : 'border-b-8 border-b-transparent'}`}
              >
                <span className="absolute top-2 left-3 text-sm text-gray-500 font-mono pointer-events-none">[ T ]</span>
                <span className="text-5xl pointer-events-none">🗼</span>
                <div className="text-left pointer-events-none">
                  <div className="text-3xl font-black leading-none">Tower L1</div>
                  <div className="text-sm text-gray-400 font-bold tracking-wider mt-1">AUTO CLIMB (+15)</div>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* TELEOP PHASE */}
        {isTeleop && (
          <div className="flex flex-col gap-3 h-full">
            <div className="bg-slate-800/60 backdrop-blur-md rounded-xl border border-white/10 p-4 flex flex-col gap-4 flex-1 relative overflow-hidden min-h-[300px]">
              <div className="flex justify-between items-end px-2">
                <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Total Scored</span>
                <span className="text-7xl font-black text-white leading-none">{matchData.counters.teleop_fuel}</span>
              </div>
              <div className="grid grid-cols-3 gap-3 flex-1">
                {[1, 2, 3, 4, 5].map((num) => (
                  <button 
                    key={num}
                    onClick={() => recordBatch(num)}
                    className={`relative rounded-xl font-black text-4xl shadow-lg border-b-4 transition-colors select-none touch-manipulation ${active ? 'bg-yellow-500 text-black border-yellow-700 hover:bg-yellow-400 active:bg-yellow-600' : 'bg-gray-800 text-gray-500 border-gray-900 opacity-50 cursor-not-allowed'}`}
                  >
                    <span className="absolute top-1 left-2 text-xs opacity-40 font-mono pointer-events-none">[ {num} ]</span>+{num}
                  </button>
                ))}
                <button 
                  onClick={undoLastBatch}
                  className="relative bg-gray-800 hover:bg-gray-700 active:bg-gray-600 rounded-xl text-xs font-bold text-red-400 border border-red-500/30 flex flex-col items-center justify-center transition-colors select-none touch-manipulation"
                >
                  <span className="absolute top-1 left-2 text-xs text-red-900 font-mono pointer-events-none">[ Z ]</span>
                  <span className="text-3xl mb-1 pointer-events-none">↩️</span>
                  <span className="pointer-events-none">UNDO</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 shrink-0">
              <button 
                onClick={() => updateMatchData({ counters: { ...matchData.counters, hoard_fuel: matchData.counters.hoard_fuel + 1 } })}
                className="relative bg-slate-800/60 hover:bg-slate-700/60 active:bg-slate-600/60 backdrop-blur-md rounded-xl border border-white/10 h-20 flex flex-col items-center justify-center border-t-4 border-t-blue-500 transition-colors select-none touch-manipulation"
              >
                <span className="absolute top-1 left-2 text-xs text-blue-500 font-mono pointer-events-none">[ H ]</span>
                <span className="text-sm text-blue-300 font-bold uppercase tracking-wider pointer-events-none">📦 Hoard/Feed</span>
                <span className="text-2xl font-black text-white mt-1 pointer-events-none">{matchData.counters.hoard_fuel}</span>
              </button>
              <button 
                onClick={toggleDefense}
                className={`relative bg-slate-800/60 hover:bg-slate-700/60 active:bg-slate-600/60 backdrop-blur-md rounded-xl border border-white/10 h-20 flex flex-col items-center justify-center border-t-4 border-t-red-500 transition-colors select-none touch-manipulation ${defenseStartTime ? 'bg-red-600 hover:bg-red-500 active:bg-red-700' : ''}`}
              >
                <span className="absolute top-1 left-2 text-xs text-red-500 font-mono pointer-events-none">[ D ]</span>
                <span className="text-3xl pointer-events-none">🛡️</span>
                <span className={`font-bold text-xs uppercase tracking-wider mt-1 pointer-events-none ${defenseStartTime ? 'text-white' : 'text-red-300'}`}>
                  {defenseStartTime ? 'DEFENDING' : 'Defense Off'}
                </span>
              </button>
            </div>

            {elapsed >= 130 && (
              <div className="bg-slate-800/60 backdrop-blur-md rounded-xl border border-indigo-500 p-4 shadow-[0_0_20px_rgba(99,102,241,0.3)] z-[50] shrink-0">
                <div className="text-center text-xs font-black text-indigo-300 uppercase tracking-widest mb-3">Climb Status (TOWER)</div>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => selectEndgame('L1')} className={`relative p-4 rounded-xl font-bold border text-lg transition-colors select-none touch-manipulation ${matchData.endgame === 'L1' ? 'bg-indigo-600 hover:bg-indigo-500 border-white shadow-lg' : 'bg-white/5 hover:bg-white/10 active:bg-white/20 border-white/10'}`}>
                    <span className="absolute top-1 left-2 text-xs text-white/30 font-mono pointer-events-none">[ W ]</span><span className="pointer-events-none">🧱 L1 (10)</span>
                  </button>
                  <button onClick={() => selectEndgame('L2')} className={`relative p-4 rounded-xl font-bold border text-lg transition-colors select-none touch-manipulation ${matchData.endgame === 'L2' ? 'bg-indigo-600 hover:bg-indigo-500 border-white shadow-lg' : 'bg-white/5 hover:bg-white/10 active:bg-white/20 border-white/10'}`}>
                    <span className="absolute top-1 left-2 text-xs text-white/30 font-mono pointer-events-none">[ E ]</span><span className="pointer-events-none">🧗 L2 (20)</span>
                  </button>
                  <button onClick={() => selectEndgame('L3')} className={`relative col-span-2 p-4 rounded-xl font-bold border text-xl transition-colors select-none touch-manipulation ${matchData.endgame === 'L3' ? 'bg-indigo-600 hover:bg-indigo-500 border-white shadow-lg' : 'bg-white/5 hover:bg-white/10 active:bg-white/20 border-white/10'}`}>
                    <span className="absolute top-1 left-2 text-xs text-white/30 font-mono pointer-events-none">[ R ]</span><span className="pointer-events-none">👑 High L3 (30)</span>
                  </button>
                  <button onClick={() => selectEndgame('None')} className={`relative col-span-2 p-3 rounded-xl font-bold border text-sm transition-colors select-none touch-manipulation ${matchData.endgame === 'None' ? 'bg-red-900/50 hover:bg-red-800/50 border-red-500 text-red-100' : 'bg-red-900/30 hover:bg-red-800/30 active:bg-red-700/30 border-red-500/50 text-red-200'}`}>
                    <span className="absolute top-1 left-2 text-[10px] text-red-500 font-mono pointer-events-none">[ Q ]</span><span className="pointer-events-none">❌ Cancel Climb / Parked</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* BLOCKING OVERLAY FOR CLIMB */}
        {overlayText && (
          <div 
            onClick={() => {
              if (matchData.toggles.auto_tower) updateMatchData({ toggles: { ...matchData.toggles, auto_tower: false } });
              if (matchData.endgame !== 'None') updateMatchData({ endgame: 'None' });
              setOverlayText(null);
            }}
            className="absolute inset-0 z-[55] bg-black/90 backdrop-blur-sm flex flex-col items-center justify-center space-y-6 cursor-pointer text-center px-4"
          >
            <div className="text-8xl animate-bounce">🧗</div>
            <div className="text-5xl font-black text-white drop-shadow-lg">{overlayText}</div>
            <div className="px-6 py-3 bg-white/10 rounded-full text-lg font-bold text-gray-300 backdrop-blur-md border border-white/20">Scoring Disabled</div>
            <div className="absolute bottom-32 text-sm font-bold text-white/70 animate-pulse bg-black/60 px-6 py-3 rounded-full">Tap Anywhere to Cancel</div>
          </div>
        )}

      </div>
    </div>
  );
}
