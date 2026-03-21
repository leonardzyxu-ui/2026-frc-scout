import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useScout } from '../context/ScoutContext';
import { useLocalFile } from '../context/LocalFileContext';
import FieldMap from '../components/FieldMap';
import NumberInput from '../components/NumberInput';

export default function SetupView() {
  const { matchData, updateMatchData } = useScout();
  const { fileHandle, setFileHandle } = useLocalFile();
  const navigate = useNavigate();
  const isLocalMode = import.meta.env.VITE_LOCAL_MODE === 'true';

  const handleStart = () => {
    if (isLocalMode && !fileHandle) return alert("Missing Info! (Did you select an Output File?)");
    if (!matchData.scout) return alert("Missing Info! (Did you enter your Scout Name?)");
    if (!matchData.match) return alert("Missing Info! (Did you enter the Match #?)");
    if (!matchData.team) return alert("Missing Info! (Did you enter the Team #?)");
    if (!matchData.alliance) return alert("Missing Info! (Did you select an Alliance?)");
    if (matchData.startPos.x === null) return alert("Please tap the field map to set the robot's Starting Position!");

    updateMatchData({ startTime: Date.now() });
    navigate('/scout');
  };

  const handleOpenFile = async () => {
    try {
      if (!('showOpenFilePicker' in window)) {
        alert("Your browser does not support the File System Access API. Please use a recent version of Chrome, Edge, or Opera.");
        return;
      }
      const [handle] = await (window as any).showOpenFilePicker({
        types: [{ description: 'JSON File', accept: { 'application/json': ['.json'] } }],
        multiple: false
      });
      
      // Request write permission upfront so we don't have to ask later during checkout
      if ((await handle.queryPermission({ mode: 'readwrite' })) !== 'granted') {
        const permission = await handle.requestPermission({ mode: 'readwrite' });
        if (permission !== 'granted') {
          alert("Write permission is required to save data to this file.");
          return;
        }
      }
      
      setFileHandle(handle);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateFile = async () => {
    try {
      if (!('showSaveFilePicker' in window)) {
        alert("Your browser does not support the File System Access API. Please use a recent version of Chrome, Edge, or Opera.");
        return;
      }
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: 'matchInfo.json',
        types: [{ description: 'JSON File', accept: { 'application/json': ['.json'] } }]
      });
      setFileHandle(handle);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex flex-col p-6 space-y-6 overflow-y-auto h-full pb-12">
      <div className="text-center mt-4">
        <h1 className="text-6xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400">
          REBUILT
        </h1>
        <p className="text-xs font-bold text-gray-500 tracking-[0.5em] uppercase mt-2">Scout v7.1 (Map Edition)</p>
      </div>

      {isLocalMode && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <button 
              className={`flex-1 p-3 rounded-xl border-2 font-bold text-center cursor-pointer transition-all active:scale-95 ${fileHandle ? 'bg-slate-800/60 border-slate-600 text-slate-300' : 'bg-blue-900/30 border-blue-500 text-blue-400'}`} 
              onClick={handleOpenFile}
            >
              📂 Open Existing
            </button>
            <button 
              className={`flex-1 p-3 rounded-xl border-2 font-bold text-center cursor-pointer transition-all active:scale-95 ${fileHandle ? 'bg-slate-800/60 border-slate-600 text-slate-300' : 'bg-green-900/30 border-green-500 text-green-400'}`} 
              onClick={handleCreateFile}
            >
              ✨ Create New
            </button>
          </div>
          <div className={`p-2 rounded-lg font-bold text-center text-sm ${fileHandle ? 'bg-emerald-900/30 text-emerald-400' : 'bg-red-900/30 text-red-400 animate-pulse'}`}>
            {fileHandle ? `✅ Output File: ${fileHandle.name}` : '⚠️ Please open or create an output file'}
          </div>
        </div>
      )}

      <div className="bg-slate-800/60 backdrop-blur-md rounded-2xl border border-white/10 p-6 space-y-5">
        <input 
          type="text" 
          value={matchData.scout}
          onChange={(e) => updateMatchData({ scout: e.target.value })}
          onKeyDown={(e) => e.key === 'Enter' && handleStart()}
          className="w-full bg-black/30 border border-white/10 rounded-2xl p-5 text-2xl outline-none focus:border-blue-500 transition placeholder-gray-600" 
          placeholder="Scout Name (Required)" 
        />
        
        <div className="flex gap-4">
          <NumberInput 
            value={matchData.match}
            onChange={(val) => updateMatchData({ match: val })}
            className="w-1/2 bg-black/30 border border-white/10 rounded-2xl p-5 text-3xl font-mono text-center outline-none focus:border-blue-500 transition placeholder-gray-600" 
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
            className="w-1/2 bg-black/30 border border-white/10 rounded-2xl p-5 text-3xl font-mono text-center font-bold outline-none focus:border-blue-500 transition placeholder-gray-600" 
            placeholder="Team #" 
          />
        </div>

        <div className="flex rounded-2xl overflow-hidden border border-white/10 h-20 bg-black/30">
          <button 
            onClick={() => updateMatchData({ alliance: 'Red' })}
            className={`flex-1 font-black tracking-widest text-xl transition-all duration-200 ${
              matchData.alliance === 'Red' 
                ? 'bg-red-600 text-white text-2xl shadow-xl scale-105 z-10' 
                : 'text-red-400/50 opacity-50'
            }`}
          >
            RED
          </button>
          <div className="w-px bg-white/10"></div>
          <button 
            onClick={() => updateMatchData({ alliance: 'Blue' })}
            className={`flex-1 font-black tracking-widest text-xl transition-all duration-200 ${
              matchData.alliance === 'Blue' 
                ? 'bg-blue-600 text-white text-2xl shadow-xl scale-105 z-10' 
                : 'text-blue-400/50 opacity-50'
            }`}
          >
            BLUE
          </button>
        </div>

        <div className="pt-2 border-t border-white/10">
          <label className="block text-sm font-bold text-gray-300 uppercase tracking-widest mb-2 flex justify-between">
            <span>Starting Position</span>
            <span className={`font-mono ${matchData.startPos.x !== null ? 'text-green-400' : 'text-blue-400'}`}>
              {matchData.startPos.x !== null ? `(${matchData.startPos.x}%, ${matchData.startPos.y}%)` : '-'}
            </span>
          </label>
          <FieldMap />
          <p className="text-xs text-gray-500 mt-2 text-center">Tap the map to set the robot's starting position (Required)</p>
        </div>
      </div>

      <button 
        onClick={handleStart}
        className="w-full py-8 bg-gradient-to-r from-green-600 to-emerald-600 rounded-2xl text-3xl font-black shadow-xl active:scale-95 text-white transition-all transform hover:scale-[1.01]"
      >
        START MATCH
      </button>

      <button 
        onClick={() => navigate('/scout')}
        className="w-full py-4 bg-cyan-900/30 border-2 border-cyan-800/50 rounded-2xl text-xl font-bold shadow-lg active:scale-95 text-cyan-300 transition-all hover:bg-cyan-900/50"
      >
        📝 MATCH SCOUT (V2)
      </button>

      <div className="grid grid-cols-2 gap-4">
        <button 
          onClick={() => navigate('/pit')}
          className="w-full py-4 bg-fuchsia-900/30 border-2 border-fuchsia-800/50 rounded-2xl text-lg font-bold shadow-lg active:scale-95 text-fuchsia-300 transition-all hover:bg-fuchsia-900/50"
        >
          🛠️ PIT SCOUT
        </button>

        <button 
          onClick={() => navigate('/lookup')}
          className="w-full py-4 bg-emerald-900/30 border-2 border-emerald-800/50 rounded-2xl text-lg font-bold shadow-lg active:scale-95 text-emerald-300 transition-all hover:bg-emerald-900/50"
        >
          🔍 TEAM LOOKUP
        </button>
      </div>

      <button 
        onClick={() => navigate('/scanner')}
        className="w-full py-4 bg-purple-900/30 border-2 border-purple-800/50 rounded-2xl text-xl font-bold shadow-lg active:scale-95 text-purple-300 transition-all hover:bg-purple-900/50"
      >
        📷 QR SCANNER
      </button>

      <button 
        onClick={() => navigate('/admin')}
        className="w-full py-4 bg-red-900/30 border-2 border-red-800/50 rounded-2xl text-xl font-bold shadow-lg active:scale-95 text-red-300 transition-all hover:bg-red-900/50"
      >
        🔒 ADMIN MAINFRAME
      </button>
    </div>
  );
}
