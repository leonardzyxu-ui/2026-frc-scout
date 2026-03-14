import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useScout } from '../context/ScoutContext';
import { useLocalFile } from '../context/LocalFileContext';
import { db } from '../firebase';
import { collection, addDoc } from 'firebase/firestore';
import { QRCodeSVG } from 'qrcode.react';
import NumberInput from '../components/NumberInput';

export default function CheckoutView() {
  const { matchData, updateMatchData, resetMatchData } = useScout();
  const { fileHandle } = useLocalFile();
  const navigate = useNavigate();
  const isLocalMode = import.meta.env.VITE_LOCAL_MODE === 'true';
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [qrPayload, setQrPayload] = useState('');

  const ptsAutoFuel = matchData.counters.auto_score * 1; 
  const ptsAutoTower = matchData.toggles.auto_tower ? 15 : 0; 
  const autoTotal = ptsAutoFuel + ptsAutoTower; 
  const ptsTeleopFuel = matchData.counters.teleop_fuel * 1; 
  
  let ptsClimb = 0; 
  if (matchData.endgame === 'L1') ptsClimb = 10; 
  if (matchData.endgame === 'L2') ptsClimb = 20; 
  if (matchData.endgame === 'L3') ptsClimb = 30;

  const botTotal = autoTotal + ptsTeleopFuel + ptsClimb;

  const toggleRP = (type: keyof typeof matchData.rp) => {
    const newRp = { ...matchData.rp, [type]: !matchData.rp[type] };
    if (type === 'win' && newRp.win) newRp.tie = false;
    if (type === 'tie' && newRp.tie) newRp.win = false;
    if (type === 'fuel360' && newRp.fuel360) newRp.fuel100 = true;
    if (type === 'fuel100' && !newRp.fuel100) newRp.fuel360 = false;
    updateMatchData({ rp: newRp });
  };

  const fetchOfficialScore = async () => {
    if (isLocalMode) return matchData.allianceScore; // Skip API calls in local mode
    const matchKey = `${matchData.eventKey}_qm${matchData.match}`;
    let officialScore = matchData.allianceScore;

    // Try Statbotics first
    try {
      const sbRes = await fetch(`https://api.statbotics.io/v3/match/${matchKey}`);
      if (sbRes.ok) {
        const sbData = await sbRes.json();
        if (sbData && sbData.result) {
          const allianceKey = matchData.alliance.toLowerCase();
          if (sbData.result[`${allianceKey}_score`] !== undefined) {
            officialScore = sbData.result[`${allianceKey}_score`];
            return officialScore;
          }
        }
      }
    } catch (e) {
      console.warn("Statbotics fetch failed", e);
    }

    // Try TBA as fallback
    const tbaKey = import.meta.env.VITE_TBA_API_KEY;
    if (tbaKey) {
      try {
        const tbaRes = await fetch(`https://www.thebluealliance.com/api/v3/match/${matchKey}`, {
          headers: { 'X-TBA-Auth-Key': tbaKey }
        });
        if (tbaRes.ok) {
          const tbaData = await tbaRes.json();
          if (tbaData && tbaData.alliances) {
            const allianceKey = matchData.alliance.toLowerCase();
            if (tbaData.alliances[allianceKey] && tbaData.alliances[allianceKey].score !== -1) {
              officialScore = tbaData.alliances[allianceKey].score;
              return officialScore;
            }
          }
        }
      } catch (e) {
        console.warn("TBA fetch failed", e);
      }
    }

    return officialScore;
  };

  const generateQRString = (data: any) => {
    const rps = data.rp;
    let safeNotes = data.notes.replace(/\|/g, '-').replace(/\n/g, ' ');
    if (safeNotes.length > 250) safeNotes = safeNotes.substring(0, 250);
    return `V5|${data.match}|${data.team}|${data.alliance[0]}|${data.counters.auto_score}|${data.toggles.auto_tower?1:0}|${data.toggles.auto_mobility?1:0}|${data.counters.teleop_fuel}|${data.counters.hoard_fuel}|${data.endgame}|${rps.win?1:0}|${rps.tie?1:0}|${rps.fuel100?1:0}|${rps.fuel360?1:0}|${rps.climb?1:0}|${data.toggles.robot_died?1:0}|${data.scout}|${data.allianceScore}|${data.startPos.x}|${data.startPos.y}|${safeNotes}|${data.deviceId || ''}|${data.userAgent || ''}`;
  };

  const handleSubmit = async () => {
    if (!matchData.notes.trim()) {
      alert("⚠️ REQUIRED: Please write something in the Scout Notes before submitting!");
      return;
    }
    if (isNaN(matchData.allianceScore)) {
      alert("Please enter the Final Alliance Score.");
      return;
    }

    setIsSubmitting(true);

    // Fetch official score to override if available
    const officialScore = await fetchOfficialScore();
    const finalData = {
      ...matchData,
      allianceScore: officialScore,
      timestamp: new Date().toISOString()
    };

    // Save locally
    const history = JSON.parse(localStorage.getItem('scout_history') || '[]');
    history.push(finalData);
    localStorage.setItem('scout_history', JSON.stringify(history));

    if (isLocalMode) {
      if (!fileHandle) {
        alert("No output file selected! Please go back to Setup and select matchInfo.json");
        setIsSubmitting(false);
        return;
      }
      try {
        const qrString = generateQRString(finalData);
        const file = await fileHandle.getFile();
        let content = await file.text();
        let arr = [];
        if (content.trim()) {
            try { arr = JSON.parse(content); } catch(e) { console.warn("Could not parse existing file, starting fresh."); }
        }
        if (!Array.isArray(arr)) arr = [];
        arr.push(qrString);

        const writable = await fileHandle.createWritable();
        await writable.write(JSON.stringify(arr, null, 2));
        await writable.close();

        alert("SAVED TO LOCAL FILE!");
        resetMatchData();
        navigate('/');
      } catch (err: any) {
        console.error(err);
        alert('Error saving file: ' + err.message);
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // Try Firebase
    try {
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 10000));
      await Promise.race([
        addDoc(collection(db, "matches"), finalData),
        timeoutPromise
      ]);
      
      // Success
      alert("SAVED!");
      resetMatchData();
      navigate('/');
    } catch (e) {
      // Fallback to QR
      setQrPayload(generateQRString(finalData));
      setShowQR(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (showQR) {
    return (
      <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center p-6 text-center overflow-y-auto">
        <h2 className="text-4xl font-black text-red-500 mb-2 animate-pulse">⚠️ OFFLINE MODE</h2>
        <p className="text-white font-bold text-lg leading-tight mb-1">Data saved to Local Vault.</p>
        <p className="text-yellow-400 font-bold text-sm mb-4">Please take a screenshot of the QR code below.</p>
        
        <div className="bg-white p-4 rounded-xl shadow-[0_0_30px_rgba(255,255,255,0.2)] mb-4">
          <QRCodeSVG value={qrPayload} size={250} level="L" />
        </div>

        <div className="bg-slate-800 p-4 rounded-xl border border-white/10 text-center mb-8 w-full max-w-md">
           <div className="text-sm text-gray-400 font-bold uppercase tracking-widest mb-2">Match Summary</div>
           <div className="grid grid-cols-3 gap-4 divide-x divide-white/10">
             <div><div className="text-xs text-gray-500">MATCH</div><div className="text-xl font-black text-white">{matchData.match}</div></div>
             <div><div className="text-xs text-gray-500">TEAM</div><div className="text-xl font-black text-blue-400">{matchData.team}</div></div>
             <div><div className="text-xs text-gray-500">PTS</div><div className="text-xl font-black text-emerald-400">{botTotal}</div></div>
           </div>
        </div>
        
        <button 
          onClick={() => {
            if (window.confirm("Are you sure you took a screenshot?")) {
              resetMatchData();
              navigate('/');
            }
          }} 
          className="w-full max-w-md py-6 bg-green-600 border-b-8 border-green-800 rounded-3xl font-black text-2xl text-white active:scale-95 active:border-b-0 active:translate-y-2"
        >
          ✅ SCREENSHOT TAKEN
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col p-6 overflow-y-auto h-full bg-[#0f172a] pb-12">
      <h2 className="text-4xl font-black text-white mb-4 text-center tracking-tighter">CHECKOUT</h2>
      
      <div className="bg-slate-800/60 backdrop-blur-md rounded-xl border border-white/10 p-4 mb-6 flex justify-around items-center text-center">
        <div><span className="text-xs text-gray-400 block font-bold">Auto</span><span className="text-xl font-black text-blue-400">{autoTotal}</span></div>
        <div><span className="text-xs text-gray-400 block font-bold">Teleop</span><span className="text-xl font-black text-yellow-400">{ptsTeleopFuel}</span></div>
        <div><span className="text-xs text-gray-400 block font-bold">Climb</span><span className="text-xl font-black text-purple-400">{matchData.endgame === 'None' ? '-' : `${matchData.endgame} (${ptsClimb})`}</span></div>
        <div className="border-l border-white/20 pl-4"><span className="text-xs text-green-300 block font-bold">Bot Est.</span><span className="text-3xl font-black text-green-400">{botTotal}</span></div>
      </div>

      <div className="bg-slate-800/60 backdrop-blur-md rounded-xl border border-white/10 p-5 flex flex-col mb-6 border-t-4 border-t-blue-500">
        <label className="text-sm font-bold text-blue-300 uppercase tracking-widest mb-3">1. Final Alliance Score</label>
        <NumberInput 
          value={matchData.allianceScore}
          onChange={(val) => updateMatchData({ allianceScore: val })}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-4xl font-black outline-none focus:border-blue-500 transition text-white text-center shadow-inner" 
          placeholder="000" 
        />
        <p className="text-xs text-gray-400 mt-2 text-center">We will attempt to auto-correct this using Statbotics/TBA on submit.</p>
        
        <label className="text-sm font-bold text-blue-300 uppercase tracking-widest mt-6 mb-3">2. Ranking Points Earned</label>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <button onClick={() => toggleRP('win')} className={`py-4 rounded-xl font-black text-xl border-2 transition-all active:scale-95 ${matchData.rp.win ? 'bg-blue-600 border-blue-400 text-white' : 'bg-white/5 border-white/10 text-gray-400'}`}>Win +3</button>
          <button onClick={() => toggleRP('tie')} className={`py-4 rounded-xl font-black text-xl border-2 transition-all active:scale-95 ${matchData.rp.tie ? 'bg-blue-600 border-blue-400 text-white' : 'bg-white/5 border-white/10 text-gray-400'}`}>Tie +1</button>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <button onClick={() => toggleRP('fuel100')} className={`py-4 rounded-xl font-bold border-2 transition-all active:scale-95 text-sm ${matchData.rp.fuel100 ? 'bg-blue-600 border-blue-400 text-white' : 'bg-white/5 border-white/10 text-gray-400'}`}>100 +1</button>
          <button onClick={() => toggleRP('fuel360')} className={`py-4 rounded-xl font-bold border-2 transition-all active:scale-95 text-sm ${matchData.rp.fuel360 ? 'bg-blue-600 border-blue-400 text-white' : 'bg-white/5 border-white/10 text-gray-400'}`}>360 +1</button>
          <button onClick={() => toggleRP('climb')} className={`py-4 rounded-xl font-bold border-2 transition-all active:scale-95 text-sm ${matchData.rp.climb ? 'bg-blue-600 border-blue-400 text-white' : 'bg-white/5 border-white/10 text-gray-400'}`}>Climb +1</button>
        </div>
      </div>

      <div className="bg-slate-800/60 backdrop-blur-md rounded-xl border border-white/10 p-4 flex flex-col mb-6 border-t-4 border-t-red-500 relative">
        <span className="absolute top-2 right-4 text-red-500 font-bold">*REQUIRED</span>
        <label className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-2">Scout Notes / Feedback</label>
        <textarea 
          value={matchData.notes}
          onChange={(e) => updateMatchData({ notes: e.target.value })}
          className="w-full bg-black/30 border border-white/10 rounded-xl p-4 text-lg outline-none focus:border-red-500 transition text-white placeholder-gray-600" 
          rows={3} 
          placeholder="Thoughts on driving, robustness, defense..."
        />
      </div>

      <div className="flex gap-4">
        <button 
          onClick={() => navigate(matchData.startTime ? '/game' : '/speed')} 
          className="w-1/3 py-6 bg-gray-700 rounded-2xl font-bold text-lg text-gray-300 active:scale-95 border border-white/10 hover:bg-gray-600 transition"
        >
          BACK
        </button>
        <button 
          onClick={handleSubmit} 
          disabled={isSubmitting}
          className="w-2/3 py-6 bg-green-600 rounded-2xl font-black text-3xl text-white shadow-xl shadow-green-900/40 active:scale-95 hover:bg-green-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'SAVING...' : 'SUBMIT'}
        </button>
      </div>
    </div>
  );
}
