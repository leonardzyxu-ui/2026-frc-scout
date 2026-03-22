import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { MatchScoutingV2, initialMatchScoutingV2 } from '../types';
import NumberInput from '../components/NumberInput';
import { QRCodeSVG } from 'qrcode.react';
import { compressMatchData } from '../utils/qrCompression';
import { QrCode, X, AlertTriangle } from 'lucide-react';
import { MathEngine, TBAMatch } from '../utils/mathEngine';

export default function MatchScoutView() {
  const navigate = useNavigate();
  const [data, setData] = useState<MatchScoutingV2>({
    ...initialMatchScoutingV2,
    deviceId: localStorage.getItem('scout_device_id') || `device_${Math.random().toString(36).substr(2, 9)}`,
    scoutName: localStorage.getItem('scout_name') || '',
    eventKey: localStorage.getItem('globalEventKey') || localStorage.getItem('setting_event') || '2026mnum'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  const [scheduledTeams, setScheduledTeams] = useState<string[]>([]);
  const [teamWarning, setTeamWarning] = useState('');

  useEffect(() => {
    // Check if we are editing a match
    const editDataStr = localStorage.getItem('edit_match_data');
    if (editDataStr) {
      try {
        const editData = JSON.parse(editDataStr);
        setData(editData);
        setIsEditing(true);
        localStorage.removeItem('edit_match_data');
      } catch (e) {
        console.error("Failed to parse edit data", e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('scout_device_id', data.deviceId!);
    localStorage.setItem('scout_name', data.scoutName);
  }, [data.deviceId, data.scoutName]);

  useEffect(() => {
    // Fetch and cache scheduled teams for validation
    const fetchTeams = async () => {
      if (data.eventKey === 'TEST') return;
      
      const cachedTeamsStr = localStorage.getItem(`teams_${data.eventKey}`);
      if (cachedTeamsStr) {
        try {
          setScheduledTeams(JSON.parse(cachedTeamsStr));
        } catch (e) {}
      }

      const tbaApiKey = import.meta.env.VITE_TBA_API_KEY;
      if (!tbaApiKey) return;

      try {
        const engine = new MathEngine(tbaApiKey);
        const matches = await engine.fetchEventMatches(data.eventKey);
        const teams = new Set<string>();
        matches.forEach(m => {
          m.alliances.red.team_keys.forEach(tk => teams.add(tk.replace('frc', '')));
          m.alliances.blue.team_keys.forEach(tk => teams.add(tk.replace('frc', '')));
        });
        const teamsArray = Array.from(teams);
        if (teamsArray.length > 0) {
          setScheduledTeams(teamsArray);
          localStorage.setItem(`teams_${data.eventKey}`, JSON.stringify(teamsArray));
        }
      } catch (e) {
        console.error("Failed to fetch teams for validation", e);
      }
    };
    fetchTeams();
  }, [data.eventKey]);

  useEffect(() => {
    if (data.eventKey === 'TEST' || scheduledTeams.length === 0 || !data.teamNumber) {
      setTeamWarning('');
      return;
    }
    if (!scheduledTeams.includes(data.teamNumber)) {
      setTeamWarning(`Warning: Team ${data.teamNumber} is not scheduled for this event.`);
    } else {
      setTeamWarning('');
    }
  }, [data.teamNumber, scheduledTeams, data.eventKey]);

  const updateData = (updates: Partial<MatchScoutingV2>) => {
    setData(prev => ({ ...prev, ...updates }));
  };

  const handleSubmit = async () => {
    if (!data.scoutName) return alert("Please enter your Scout Name.");
    if (!data.matchKey) return alert("Please enter the Match Key (e.g. qm1).");
    if (!data.teamNumber) return alert("Please enter the Team Number.");
    if (data.eventKey !== 'TEST' && scheduledTeams.length > 0 && !scheduledTeams.includes(data.teamNumber)) {
      return alert(`Team ${data.teamNumber} is not scheduled for this event. Please check the team number.`);
    }
    if (!data.alliance) return alert("Please select an Alliance.");

    setIsSubmitting(true);
    try {
      const docId = `${data.matchKey}_${data.teamNumber}`;
      const docRef = doc(db, 'events', data.eventKey, 'matchScouting', docId);
      
      let payload = { ...data, timestamp: Date.now() };

      // Versioning logic
      const existingDoc = await getDoc(docRef);
      if (existingDoc.exists()) {
        const existingData = existingDoc.data() as MatchScoutingV2;
        const history = existingData.editHistory || [];
        // Remove editHistory from the old data before pushing to history array
        const { editHistory, ...oldData } = existingData;
        payload.editHistory = [...history, oldData];
      }

      await setDoc(docRef, payload);
      
      alert(isEditing ? "Match updated successfully!" : "Match submitted successfully!");
      
      if (isEditing) {
        navigate('/history');
        return;
      }

      // Post-Submit Loop: Auto-increment match number, retain scout, alliance
      let nextMatchKey = data.matchKey;
      const matchNumMatch = data.matchKey.match(/(\D+)(\d+)/);
      if (matchNumMatch) {
        nextMatchKey = `${matchNumMatch[1]}${parseInt(matchNumMatch[2]) + 1}`;
      }

      setData({
        ...initialMatchScoutingV2,
        scoutName: data.scoutName,
        deviceId: data.deviceId,
        eventKey: data.eventKey,
        alliance: data.alliance,
        matchKey: nextMatchKey,
        teamNumber: ''
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
            {isEditing ? 'EDIT MATCH' : 'MATCH SCOUT'}
          </h1>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Analytics Engine Data Collection</p>
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
              disabled={isEditing}
              className={`w-full bg-black/50 border border-slate-700 rounded-xl p-3 outline-none focus:border-emerald-500 transition ${isEditing ? 'opacity-50 cursor-not-allowed' : ''}`} 
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
              disabled={isEditing}
              className={`w-full bg-black/50 border border-slate-700 rounded-xl p-3 outline-none focus:border-emerald-500 transition font-mono ${isEditing ? 'opacity-50 cursor-not-allowed' : ''}`} 
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
              disabled={isEditing}
              onChange={(e) => {
                const val = e.target.value;
                if (/^\d*$/.test(val)) updateData({ teamNumber: val });
              }}
              className={`w-full bg-black/50 border rounded-xl p-3 outline-none transition font-mono font-bold ${teamWarning ? 'border-amber-500 focus:border-amber-400' : 'border-slate-700 focus:border-emerald-500'} ${isEditing ? 'opacity-50 cursor-not-allowed' : ''}`} 
            />
            {teamWarning && (
              <div className="flex items-center gap-1 mt-2 text-amber-400 text-xs font-bold animate-in fade-in">
                <AlertTriangle className="w-3 h-3" />
                {teamWarning}
              </div>
            )}
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
          <div className="flex justify-between text-[10px] text-slate-500 font-bold uppercase mt-1">
            <span>Terrible</span>
            <span>Perfect</span>
          </div>
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
          <div className="flex justify-between text-[10px] text-slate-500 font-bold uppercase mt-1">
            <span>Terrible</span>
            <span>Perfect</span>
          </div>
        </div>

        <div>
          <div className="flex justify-between mb-2">
            <label className="text-xs font-bold text-slate-500 uppercase">Driver performance under pressure</label>
            <span className="text-xs font-black text-emerald-400">{data.driverPressure} / 10</span>
          </div>
          <input 
            type="range" min="0" max="10" 
            value={data.driverPressure}
            onChange={(e) => updateData({ driverPressure: parseInt(e.target.value) })}
            className="w-full accent-emerald-500"
          />
          <div className="flex justify-between text-[10px] text-slate-500 font-bold uppercase mt-1">
            <span>Terrible</span>
            <span>Perfect</span>
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
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Number of times</label>
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
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Duration</label>
                <select 
                  value={data.defenseDuration}
                  onChange={(e) => updateData({ defenseDuration: e.target.value })}
                  className="w-full h-10 bg-black/50 border border-slate-600 rounded-lg text-xl font-black font-mono text-center outline-none focus:border-red-500"
                >
                  <option value="<1">&lt;1</option>
                  <option value="<2">&lt;2</option>
                  <option value="<3">&lt;3</option>
                  <option value="<4">&lt;4</option>
                  <option value="<5">&lt;5</option>
                  <option value="<6">&lt;6</option>
                </select>
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
                <span>Effective</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Endgame & Failures */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-6">
        <div>
          <h2 className="text-xl font-black text-slate-300 border-b border-slate-800 pb-2 mb-4">ENDGAME</h2>
          <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Climb Level</label>
          <div className="grid grid-cols-4 gap-2">
            {['None', 'Parked', 'Shallow', 'Deep'].map((level) => (
              <button
                key={level}
                onClick={() => updateData({ climbLevel: level as any })}
                className={`py-3 rounded-xl font-black text-xs transition-all ${
                  data.climbLevel === level
                    ? 'bg-emerald-600 text-white shadow-inner'
                    : 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700'
                }`}
              >
                {level.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-xl font-black text-red-400 border-b border-slate-800 pb-2 mb-4">CRITICAL FAILURES</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
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
            <button 
              onClick={() => updateData({ tippedOver: !data.tippedOver })}
              className={`p-3 rounded-xl font-black text-xs transition-all ${data.tippedOver ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}
            >
              TIPPED OVER
            </button>
          </div>

          {(data.robotDied || data.commsLost || data.mechanismBroke || data.tippedOver) && (
            <div className="animate-in fade-in slide-in-from-top-4 mt-4">
              <label className="block text-xs font-bold text-red-400 uppercase mb-1">Failure Reason</label>
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
          {isSubmitting ? 'SUBMITTING...' : (isEditing ? 'UPDATE MATCH ➔' : 'SUBMIT MATCH ➔')}
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
