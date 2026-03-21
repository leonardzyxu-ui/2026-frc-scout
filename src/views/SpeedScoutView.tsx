import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useScout } from '../context/ScoutContext';
import NumberInput from '../components/NumberInput';

export default function SpeedScoutView() {
  const { matchData, updateMatchData } = useScout();
  const navigate = useNavigate();

  const handleCounter = (counterId: 'auto_score' | 'teleop_fuel' | 'hoard_fuel', increment: number) => {
    const newVal = Math.max(0, matchData.counters[counterId] + increment);
    updateMatchData({
      counters: { ...matchData.counters, [counterId]: newVal }
    });
  };

  const handleCounterInput = (counterId: 'auto_score' | 'teleop_fuel' | 'hoard_fuel', value: number) => {
    updateMatchData({
      counters: { ...matchData.counters, [counterId]: Math.max(0, value) }
    });
  };

  const toggleState = (toggleId: 'auto_mobility' | 'auto_tower' | 'robot_died' | 'defense') => {
    updateMatchData({
      toggles: { ...matchData.toggles, [toggleId]: !matchData.toggles[toggleId] }
    });
  };

  const setEndgame = (level: 'None' | 'L1' | 'L2' | 'L3') => {
    updateMatchData({ endgame: level });
  };

  const handleSubmit = () => {
    if (!matchData.scout) return alert("Missing Info! (Did you enter your Scout Name?)");
    if (!matchData.match) return alert("Missing Info! (Did you enter the Match #?)");
    if (!matchData.team) return alert("Missing Info! (Did you enter the Team #?)");
    if (!matchData.alliance) return alert("Missing Info! (Did you select an Alliance?)");
    
    navigate('/checkout');
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 md:p-6 space-y-8 pb-24">
      <div className="flex justify-between items-center border-b border-white/10 pb-4">
        <div>
          <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500">
            SPEED SCOUT
          </h1>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Single Page Form</p>
        </div>
        <button 
          onClick={() => navigate('/')}
          className="bg-slate-800 px-4 py-2 rounded-lg font-bold text-sm text-slate-300 hover:bg-slate-700"
        >
          Cancel
        </button>
      </div>

      {/* Match Info Inputs */}
      <div className="bg-slate-800/50 border border-white/10 rounded-2xl p-4 space-y-4">
        <h2 className="text-xl font-black text-slate-300 border-b border-white/10 pb-2">MATCH INFO</h2>
        
        <input 
          type="text" 
          value={matchData.scout}
          onChange={(e) => updateMatchData({ scout: e.target.value })}
          className="w-full bg-black/30 border border-white/10 rounded-xl p-4 text-xl outline-none focus:border-blue-500 transition placeholder-gray-600" 
          placeholder="Scout Name (Required)" 
        />
        
        <div className="flex gap-4">
          <NumberInput 
            value={matchData.match}
            onChange={(val) => updateMatchData({ match: val })}
            className="w-1/2 bg-black/30 border border-white/10 rounded-xl p-4 text-2xl font-mono text-center outline-none focus:border-blue-500 transition placeholder-gray-600" 
            placeholder="Match #" 
          />
          <input 
            type="text" 
            inputMode="numeric"
            pattern="[0-9]*"
            value={matchData.team}
            onChange={(e) => {
              const val = e.target.value;
              if (/^\d*$/.test(val)) updateMatchData({ team: val });
            }}
            className="w-1/2 bg-black/30 border border-white/10 rounded-xl p-4 text-2xl font-mono text-center font-bold outline-none focus:border-blue-500 transition placeholder-gray-600" 
            placeholder="Team #" 
          />
        </div>

        <div className="flex rounded-xl overflow-hidden border border-white/10 h-16 bg-black/30">
          <button 
            onClick={() => updateMatchData({ alliance: 'Red' })}
            className={`flex-1 font-black tracking-widest text-lg transition-all duration-200 ${
              matchData.alliance === 'Red' 
                ? 'bg-red-600 text-white shadow-xl scale-105 z-10' 
                : 'text-red-400/50 opacity-50'
            }`}
          >
            RED
          </button>
          <div className="w-px bg-white/10"></div>
          <button 
            onClick={() => updateMatchData({ alliance: 'Blue' })}
            className={`flex-1 font-black tracking-widest text-lg transition-all duration-200 ${
              matchData.alliance === 'Blue' 
                ? 'bg-blue-600 text-white shadow-xl scale-105 z-10' 
                : 'text-blue-400/50 opacity-50'
            }`}
          >
            BLUE
          </button>
        </div>
      </div>

      {/* Auto Section */}
      <div className="space-y-4">
        <h2 className="text-xl font-black text-slate-300 border-b border-white/10 pb-2">AUTONOMOUS</h2>
        
        <div className="grid grid-cols-2 gap-4">
          <button 
            onClick={() => toggleState('auto_mobility')}
            className={`p-4 rounded-xl font-black text-lg transition-all select-none touch-manipulation ${matchData.toggles.auto_mobility ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'bg-slate-800 text-slate-400 border border-white/10'}`}
          >
            MOBILITY
          </button>
          <button 
            onClick={() => toggleState('auto_tower')}
            className={`p-4 rounded-xl font-black text-lg transition-all select-none touch-manipulation ${matchData.toggles.auto_tower ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/50' : 'bg-slate-800 text-slate-400 border border-white/10'}`}
          >
            TOWER (L1)
          </button>
        </div>

        <div className="bg-slate-800/50 border border-white/10 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <span className="font-bold text-lg">Auto Fuel Scored</span>
          <div className="flex items-center gap-2">
            <button onClick={() => handleCounter('auto_score', -1)} className="w-14 h-14 bg-slate-700 rounded-lg font-black text-3xl active:scale-95 select-none touch-manipulation">-</button>
            <NumberInput 
              value={matchData.counters.auto_score}
              onChange={(val) => handleCounterInput('auto_score', val)}
              className="w-20 h-14 bg-black/50 border border-white/10 rounded-lg text-3xl font-black font-mono text-center outline-none focus:border-blue-500"
            />
            <button onClick={() => handleCounter('auto_score', 1)} className="w-14 h-14 bg-blue-600 rounded-lg font-black text-3xl active:scale-95 select-none touch-manipulation">+</button>
          </div>
        </div>
      </div>

      {/* Teleop Section */}
      <div className="space-y-4">
        <h2 className="text-xl font-black text-slate-300 border-b border-white/10 pb-2">TELEOP</h2>
        
        <div className="bg-slate-800/50 border border-white/10 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <span className="font-bold text-lg text-yellow-500">Teleop Fuel Scored</span>
          <div className="flex items-center gap-2">
            <button onClick={() => handleCounter('teleop_fuel', -1)} className="w-14 h-14 bg-slate-700 rounded-lg font-black text-3xl active:scale-95 select-none touch-manipulation">-</button>
            <NumberInput 
              value={matchData.counters.teleop_fuel}
              onChange={(val) => handleCounterInput('teleop_fuel', val)}
              className="w-20 h-14 bg-black/50 border border-white/10 rounded-lg text-3xl font-black font-mono text-center text-yellow-500 outline-none focus:border-yellow-500"
            />
            <button onClick={() => handleCounter('teleop_fuel', 1)} className="w-14 h-14 bg-yellow-600 text-black rounded-lg font-black text-3xl active:scale-95 select-none touch-manipulation">+</button>
          </div>
        </div>

        <div className="bg-slate-800/50 border border-white/10 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <span className="font-bold text-lg text-orange-400">Hoarded Fuel</span>
          <div className="flex items-center gap-2">
            <button onClick={() => handleCounter('hoard_fuel', -1)} className="w-14 h-14 bg-slate-700 rounded-lg font-black text-3xl active:scale-95 select-none touch-manipulation">-</button>
            <NumberInput 
              value={matchData.counters.hoard_fuel}
              onChange={(val) => handleCounterInput('hoard_fuel', val)}
              className="w-20 h-14 bg-black/50 border border-white/10 rounded-lg text-3xl font-black font-mono text-center text-orange-400 outline-none focus:border-orange-500"
            />
            <button onClick={() => handleCounter('hoard_fuel', 1)} className="w-14 h-14 bg-orange-600 text-white rounded-lg font-black text-3xl active:scale-95 select-none touch-manipulation">+</button>
          </div>
        </div>

        <button 
          onClick={() => toggleState('defense')}
          className={`w-full p-4 rounded-xl font-black text-lg transition-all select-none touch-manipulation ${matchData.toggles.defense ? 'bg-red-600 text-white shadow-lg shadow-red-900/50' : 'bg-slate-800 text-slate-400 border border-white/10'}`}
        >
          PLAYED DEFENSE
        </button>
      </div>

      {/* Endgame Section */}
      <div className="space-y-4">
        <h2 className="text-xl font-black text-slate-300 border-b border-white/10 pb-2">ENDGAME</h2>
        
        <div className="grid grid-cols-4 gap-2">
          <button onClick={() => setEndgame('None')} className={`p-4 rounded-xl font-black text-sm transition-all select-none touch-manipulation ${matchData.endgame === 'None' ? 'bg-slate-600 text-white' : 'bg-slate-800 text-slate-400 border border-white/10'}`}>NONE</button>
          <button onClick={() => setEndgame('L1')} className={`p-4 rounded-xl font-black text-sm transition-all select-none touch-manipulation ${matchData.endgame === 'L1' ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/50' : 'bg-slate-800 text-slate-400 border border-white/10'}`}>L1 (10)</button>
          <button onClick={() => setEndgame('L2')} className={`p-4 rounded-xl font-black text-sm transition-all select-none touch-manipulation ${matchData.endgame === 'L2' ? 'bg-purple-500 text-white shadow-lg shadow-purple-900/50' : 'bg-slate-800 text-slate-400 border border-white/10'}`}>L2 (20)</button>
          <button onClick={() => setEndgame('L3')} className={`p-4 rounded-xl font-black text-sm transition-all select-none touch-manipulation ${matchData.endgame === 'L3' ? 'bg-purple-400 text-white shadow-lg shadow-purple-900/50' : 'bg-slate-800 text-slate-400 border border-white/10'}`}>L3 (30)</button>
        </div>

        <button 
          onClick={() => toggleState('robot_died')}
          className={`w-full p-4 rounded-xl font-black text-lg transition-all select-none touch-manipulation ${matchData.toggles.robot_died ? 'bg-red-600 text-white shadow-lg shadow-red-900/50 animate-pulse' : 'bg-slate-800 text-slate-400 border border-white/10'}`}
        >
          ☠️ ROBOT DIED / BROKE
        </button>
      </div>

      <button 
        onClick={handleSubmit}
        className="w-full py-6 bg-gradient-to-r from-green-600 to-emerald-600 rounded-2xl text-2xl font-black shadow-xl active:scale-95 text-white transition-all mt-8"
      >
        PROCEED TO SUBMIT ➔
      </button>
    </div>
  );
}
