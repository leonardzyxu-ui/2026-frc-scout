import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { MatchScoutingV2, initialMatchScoutingV2 } from '../types';
import NumberInput from '../components/NumberInput';
import { QRCodeSVG } from 'qrcode.react';
import { compressMatchData } from '../utils/qrCompression';
import { QrCode, X } from 'lucide-react';

export default function MatchScoutView() {
  const navigate = useNavigate();
  const [data, setData] = useState<MatchScoutingV2>({
    ...initialMatchScoutingV2,
    deviceId: localStorage.getItem('scout_device_id') || `device_${Math.random().toString(36).substr(2, 9)}`,
    scoutName: localStorage.getItem('scout_name') || ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showQR, setShowQR] = useState(false);

  useEffect(() => {
    localStorage.setItem('scout_device_id', data.deviceId!);
    localStorage.setItem('scout_name', data.scoutName);
  }, [data.deviceId, data.scoutName]);

  const updateData = (updates: Partial<MatchScoutingV2>) => {
    setData(prev => ({ ...prev, ...updates }));
  };

  const handleSubmit = async () => {
    if (!data.scoutName) return alert("Please enter your Scout Name.");
    if (!data.matchKey) return alert("Please enter the Match Key (e.g. qm1).");
    if (!data.teamNumber) return alert("Please enter the Team Number.");
    if (!data.alliance) return alert("Please select an Alliance.");

    if (data.robotDied || data.commsLost || data.mechanismBroke) {
      if (!data.failureReason.trim()) {
        return alert("Please provide a reason for the critical failure.");
      }
    }

    setIsSubmitting(true);
    try {
      const docId = `${data.matchKey}_${data.teamNumber}`;
      const docRef = doc(db, 'events', data.eventKey, 'matchScouting', docId);
      
      const payload = {
        ...data,
        timestamp: Date.now()
      };

      await setDoc(docRef, payload);
      
      // Save locally for history/backup
      const history = JSON.parse(localStorage.getItem('scout_history_v2') || '[]');
      history.push(payload);
      localStorage.setItem('scout_history_v2', JSON.stringify(history));

      alert("Match submitted successfully!");
      
      // Reset for next match
      setData({
        ...initialMatchScoutingV2,
        scoutName: data.scoutName,
        deviceId: data.deviceId,
        eventKey: data.eventKey,
        matchKey: data.matchKey.startsWith('qm') ? `qm${parseInt(data.matchKey.substring(2)) + 1}` : data.matchKey
      });
      
      window.scrollTo(0, 0);
    } catch (error) {
      console.error("Error submitting match:", error);
      alert("Failed to submit match. Please check your connection.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 md:p-6 space-y-8 pb-24 bg-slate-950 text-white">
      <div className="flex justify-between items-center border-b border-white/10 pb-4">
        <div>
          <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-500">
            MATCH SCOUT
          </h1>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Phase 1 Data Collection</p>
        </div>
        <button 
          onClick={() => navigate('/')}
          className="bg-slate-800 px-4 py-2 rounded-lg font-bold text-sm text-slate-300 hover:bg-slate-700"
        >
          Back
        </button>
      </div>

      {/* Meta Info */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4">
        <h2 className="text-xl font-black text-slate-300 border-b border-slate-800 pb-2">META INFO</h2>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Event Key</label>
            <input 
              type="text" 
              value={data.eventKey}
              onChange={(e) => updateData({ eventKey: e.target.value })}
              className="w-full bg-black/50 border border-slate-700 rounded-xl p-3 outline-none focus:border-emerald-500 transition" 
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Scout Name</label>
            <input 
              type="text" 
              value={data.scoutName}
              onChange={(e) => updateData({ scoutName: e.target.value })}
              className="w-full bg-black/50 border border-slate-700 rounded-xl p-3 outline-none focus:border-emerald-500 transition" 
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Match Key</label>
            <input 
              type="text" 
              value={data.matchKey}
              onChange={(e) => updateData({ matchKey: e.target.value })}
              className="w-full bg-black/50 border border-slate-700 rounded-xl p-3 outline-none focus:border-emerald-500 transition font-mono" 
              placeholder="e.g. qm1"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Team Number</label>
            <input 
              type="text" 
              inputMode="numeric"
              pattern="[0-9]*"
              value={data.teamNumber}
              onChange={(e) => {
                const val = e.target.value;
                if (/^\d*$/.test(val)) updateData({ teamNumber: val });
              }}
              className="w-full bg-black/50 border border-slate-700 rounded-xl p-3 outline-none focus:border-emerald-500 transition font-mono font-bold" 
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Alliance</label>
          <div className="flex rounded-xl overflow-hidden border border-slate-700 h-12 bg-black/30">
            <button 
              onClick={() => updateData({ alliance: 'Red' })}
              className={`flex-1 font-black tracking-widest transition-all duration-200 ${
                data.alliance === 'Red' 
                  ? 'bg-red-600 text-white shadow-inner' 
                  : 'text-red-400/50 hover:bg-red-900/20'
              }`}
            >
              RED
            </button>
            <div className="w-px bg-slate-700"></div>
            <button 
              onClick={() => updateData({ alliance: 'Blue' })}
              className={`flex-1 font-black tracking-widest transition-all duration-200 ${
                data.alliance === 'Blue' 
                  ? 'bg-blue-600 text-white shadow-inner' 
                  : 'text-blue-400/50 hover:bg-blue-900/20'
              }`}
            >
              BLUE
            </button>
          </div>
        </div>
      </div>

      {/* Auto */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4">
        <h2 className="text-xl font-black text-slate-300 border-b border-slate-800 pb-2">AUTONOMOUS</h2>
        
        <div className="grid grid-cols-2 gap-4">
          <button 
            onClick={() => updateData({ autoMobility: !data.autoMobility })}
            className={`p-4 rounded-xl font-black text-sm transition-all ${data.autoMobility ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}
          >
            MOBILITY (Left Zone)
          </button>
          <button 
            onClick={() => updateData({ autoTower: !data.autoTower })}
            className={`p-4 rounded-xl font-black text-sm transition-all ${data.autoTower ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}
          >
            TOWER (L1 Climb)
          </button>
        </div>

        <div className="flex items-center justify-between bg-black/30 p-4 rounded-xl border border-slate-700">
          <span className="font-bold text-slate-300">Auto Fuel Scored</span>
          <div className="flex items-center gap-3">
            <button onClick={() => updateData({ autoScore: Math.max(0, data.autoScore - 1) })} className="w-12 h-12 bg-slate-800 rounded-lg font-black text-2xl active:scale-95">-</button>
            <NumberInput 
              value={data.autoScore}
              onChange={(val) => updateData({ autoScore: val })}
              className="w-16 h-12 bg-black/50 border border-slate-600 rounded-lg text-2xl font-black font-mono text-center outline-none focus:border-emerald-500"
            />
            <button onClick={() => updateData({ autoScore: data.autoScore + 1 })} className="w-12 h-12 bg-emerald-600 rounded-lg font-black text-2xl active:scale-95">+</button>
          </div>
        </div>
      </div>

      {/* Teleop */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4">
        <h2 className="text-xl font-black text-slate-300 border-b border-slate-800 pb-2">TELEOP</h2>
        
        <div className="flex items-center justify-between bg-black/30 p-4 rounded-xl border border-slate-700">
          <span className="font-bold text-yellow-500">Teleop Fuel Scored</span>
          <div className="flex items-center gap-3">
            <button onClick={() => updateData({ teleopScore: Math.max(0, data.teleopScore - 1) })} className="w-12 h-12 bg-slate-800 rounded-lg font-black text-2xl active:scale-95">-</button>
            <NumberInput 
              value={data.teleopScore}
              onChange={(val) => updateData({ teleopScore: val })}
              className="w-16 h-12 bg-black/50 border border-slate-600 rounded-lg text-2xl font-black font-mono text-center text-yellow-500 outline-none focus:border-yellow-500"
            />
            <button onClick={() => updateData({ teleopScore: data.teleopScore + 1 })} className="w-12 h-12 bg-yellow-600 text-black rounded-lg font-black text-2xl active:scale-95">+</button>
          </div>
        </div>

        <div className="flex items-center justify-between bg-black/30 p-4 rounded-xl border border-slate-700">
          <span className="font-bold text-orange-400">Hoarded Fuel</span>
          <div className="flex items-center gap-3">
            <button onClick={() => updateData({ hoardScore: Math.max(0, data.hoardScore - 1) })} className="w-12 h-12 bg-slate-800 rounded-lg font-black text-2xl active:scale-95">-</button>
            <NumberInput 
              value={data.hoardScore}
              onChange={(val) => updateData({ hoardScore: val })}
              className="w-16 h-12 bg-black/50 border border-slate-600 rounded-lg text-2xl font-black font-mono text-center text-orange-400 outline-none focus:border-orange-500"
            />
            <button onClick={() => updateData({ hoardScore: data.hoardScore + 1 })} className="w-12 h-12 bg-orange-600 text-white rounded-lg font-black text-2xl active:scale-95">+</button>
          </div>
        </div>
      </div>

      {/* Defense */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4">
        <h2 className="text-xl font-black text-slate-300 border-b border-slate-800 pb-2">DEFENSE</h2>
        
        <button 
          onClick={() => updateData({ playedDefense: !data.playedDefense })}
          className={`w-full p-4 rounded-xl font-black text-lg transition-all ${data.playedDefense ? 'bg-red-600 text-white' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}
        >
          PLAYED DEFENSE?
        </button>

        {data.playedDefense && (
          <div className="space-y-6 pt-4 border-t border-slate-800 animate-in fade-in slide-in-from-top-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Instances</label>
                <div className="flex items-center gap-2">
                  <button onClick={() => updateData({ defenseInstances: Math.max(0, data.defenseInstances - 1) })} className="w-10 h-10 bg-slate-800 rounded-lg font-black text-xl active:scale-95">-</button>
                  <NumberInput 
                    value={data.defenseInstances}
                    onChange={(val) => updateData({ defenseInstances: val })}
                    className="flex-1 h-10 bg-black/50 border border-slate-600 rounded-lg text-xl font-black font-mono text-center outline-none focus:border-red-500"
                  />
                  <button onClick={() => updateData({ defenseInstances: data.defenseInstances + 1 })} className="w-10 h-10 bg-red-600 rounded-lg font-black text-xl active:scale-95">+</button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Duration (sec)</label>
                <NumberInput 
                  value={data.defenseDuration}
                  onChange={(val) => updateData({ defenseDuration: val })}
                  className="w-full h-10 bg-black/50 border border-slate-600 rounded-lg text-xl font-black font-mono text-center outline-none focus:border-red-500"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Effectiveness</label>
                <span className="text-xs font-black text-red-400">{data.defenseEffectiveness} / 10</span>
              </div>
              <input 
                type="range" 
                min="0" max="10" 
                value={data.defenseEffectiveness}
                onChange={(e) => updateData({ defenseEffectiveness: parseInt(e.target.value) })}
                className="w-full accent-red-500"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-bold uppercase mt-1">
                <span>Ineffective</span>
                <span>Shutdown</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Endgame */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4">
        <h2 className="text-xl font-black text-slate-300 border-b border-slate-800 pb-2">ENDGAME</h2>
        
        <div className="grid grid-cols-3 gap-2">
          {['None', 'Parked', 'Failed'].map((status) => (
            <button 
              key={status}
              onClick={() => updateData({ climbStatus: status as any })} 
              className={`p-3 rounded-xl font-black text-xs transition-all ${data.climbStatus === status ? 'bg-slate-600 text-white' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}
            >
              {status.toUpperCase()}
            </button>
          ))}
          {['L1', 'L2', 'L3'].map((status) => (
            <button 
              key={status}
              onClick={() => updateData({ climbStatus: status as any })} 
              className={`p-3 rounded-xl font-black text-xs transition-all ${data.climbStatus === status ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}
            >
              {status} CLIMB
            </button>
          ))}
        </div>
      </div>

      {/* Subjective */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-6">
        <h2 className="text-xl font-black text-slate-300 border-b border-slate-800 pb-2">SUBJECTIVE RATING</h2>
        
        <div>
          <div className="flex justify-between mb-2">
            <label className="text-xs font-bold text-slate-500 uppercase">Auto Fluidity</label>
            <span className="text-xs font-black text-emerald-400">{data.autoFluidity} / 10</span>
          </div>
          <input 
            type="range" min="0" max="10" 
            value={data.autoFluidity}
            onChange={(e) => updateData({ autoFluidity: parseInt(e.target.value) })}
            className="w-full accent-emerald-500"
          />
        </div>

        <div>
          <div className="flex justify-between mb-2">
            <label className="text-xs font-bold text-slate-500 uppercase">Teleop Fluidity</label>
            <span className="text-xs font-black text-emerald-400">{data.teleopFluidity} / 10</span>
          </div>
          <input 
            type="range" min="0" max="10" 
            value={data.teleopFluidity}
            onChange={(e) => updateData({ teleopFluidity: parseInt(e.target.value) })}
            className="w-full accent-emerald-500"
          />
        </div>

        <div>
          <div className="flex justify-between mb-2">
            <label className="text-xs font-bold text-slate-500 uppercase">Under Pressure</label>
            <span className="text-xs font-black text-emerald-400">{data.underPressure} / 10</span>
          </div>
          <input 
            type="range" min="0" max="10" 
            value={data.underPressure}
            onChange={(e) => updateData({ underPressure: parseInt(e.target.value) })}
            className="w-full accent-emerald-500"
          />
          <div className="flex justify-between text-[10px] text-slate-500 font-bold uppercase mt-1">
            <span>Crumbles</span>
            <span>Ice in Veins</span>
          </div>
        </div>
      </div>

      {/* Critical Failures */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4">
        <h2 className="text-xl font-black text-red-400 border-b border-slate-800 pb-2">CRITICAL FAILURES</h2>
        
        <div className="grid grid-cols-3 gap-2">
          <button 
            onClick={() => updateData({ robotDied: !data.robotDied })}
            className={`p-3 rounded-xl font-black text-xs transition-all ${data.robotDied ? 'bg-red-600 text-white' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}
          >
            ROBOT DIED
          </button>
          <button 
            onClick={() => updateData({ commsLost: !data.commsLost })}
            className={`p-3 rounded-xl font-black text-xs transition-all ${data.commsLost ? 'bg-orange-600 text-white' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}
          >
            COMMS LOST
          </button>
          <button 
            onClick={() => updateData({ mechanismBroke: !data.mechanismBroke })}
            className={`p-3 rounded-xl font-black text-xs transition-all ${data.mechanismBroke ? 'bg-yellow-600 text-white' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}
          >
            MECH BROKE
          </button>
        </div>

        {(data.robotDied || data.commsLost || data.mechanismBroke) && (
          <div className="animate-in fade-in slide-in-from-top-4">
            <label className="block text-xs font-bold text-red-400 uppercase mb-1">Failure Reason (Required)</label>
            <input 
              type="text" 
              value={data.failureReason}
              onChange={(e) => updateData({ failureReason: e.target.value })}
              className="w-full bg-black/50 border border-red-900/50 rounded-xl p-3 outline-none focus:border-red-500 transition" 
              placeholder="What happened?"
            />
          </div>
        )}
      </div>

      {/* Notes */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4">
        <h2 className="text-xl font-black text-slate-300 border-b border-slate-800 pb-2">NOTES</h2>
        <textarea 
          value={data.notes}
          onChange={(e) => updateData({ notes: e.target.value })}
          className="w-full bg-black/50 border border-slate-700 rounded-xl p-3 outline-none focus:border-emerald-500 transition min-h-[100px]" 
          placeholder="Any other observations?"
        />
      </div>

      <div className="grid grid-cols-4 gap-4">
        <button 
          onClick={() => setShowQR(true)}
          className="col-span-1 py-6 bg-slate-800 hover:bg-slate-700 rounded-2xl text-white font-black shadow-xl active:scale-95 transition-all flex items-center justify-center"
        >
          <QrCode className="w-8 h-8" />
        </button>
        <button 
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="col-span-3 py-6 bg-gradient-to-r from-emerald-600 to-cyan-600 rounded-2xl text-2xl font-black shadow-xl active:scale-95 text-white transition-all disabled:opacity-50"
        >
          {isSubmitting ? 'SUBMITTING...' : 'SUBMIT MATCH ➔'}
        </button>
      </div>

      {showQR && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-sm p-4">
          <div className="bg-white p-8 rounded-3xl max-w-sm w-full flex flex-col items-center relative">
            <button 
              onClick={() => setShowQR(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-900"
            >
              <X className="w-6 h-6" />
            </button>
            <h3 className="text-2xl font-black text-slate-900 mb-2 text-center">OFFLINE SYNC</h3>
            <p className="text-sm text-slate-500 text-center mb-6 font-medium">
              Have the Lead Scout scan this code to sync your data.
            </p>
            <div className="bg-white p-4 rounded-xl shadow-inner border-2 border-slate-100">
              <QRCodeSVG 
                value={compressMatchData(data)} 
                size={256}
                level="L"
                includeMargin={false}
              />
            </div>
            <div className="mt-6 text-center">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Match</div>
              <div className="text-xl font-black text-slate-900">{data.matchKey} - Team {data.teamNumber}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
