import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';

// Re-use the generateQRString logic or import it if possible.
// Since it's in CheckoutView, I'll just copy the simple version here for history display.
const generateQRString = (data: any) => {
  const rps = data.rp || {};
  let safeNotes = (data.notes || "").replace(/\|/g, '-').replace(/\n/g, ' ');
  if (safeNotes.length > 250) safeNotes = safeNotes.substring(0, 250);
  return `V5|${data.match}|${data.team}|${data.alliance?.[0] || 'U'}|${data.counters?.auto_score || 0}|${data.toggles?.auto_tower?1:0}|${data.toggles?.auto_mobility?1:0}|${data.counters?.teleop_fuel || 0}|${data.counters?.hoard_fuel || 0}|${data.endgame || 'None'}|${rps.win?1:0}|${rps.tie?1:0}|${rps.fuel100?1:0}|${rps.fuel360?1:0}|${rps.climb?1:0}|${data.toggles?.robot_died?1:0}|${data.scout || 'Unknown'}|${data.allianceScore || 0}|${data.startPos?.x || 0}|${data.startPos?.y || 0}|${safeNotes}|${data.deviceId || ''}|${data.userAgent || ''}`;
};

export default function HistoryView() {
  const navigate = useNavigate();
  const [history, setHistory] = useState<any[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<any | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('scout_history');
    if (stored) {
      try {
        setHistory(JSON.parse(stored).reverse()); // Newest first
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }
  }, []);

  const clearHistory = () => {
    if (window.confirm("Are you sure you want to clear all match history? This cannot be undone.")) {
      localStorage.removeItem('scout_history');
      setHistory([]);
      setSelectedMatch(null);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-white p-4 md:p-6 overflow-y-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">
            MATCH HISTORY
          </h1>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">
            {history.length} Matches Saved Locally
          </p>
        </div>
        <button 
          onClick={() => navigate('/')}
          className="bg-slate-800 px-4 py-2 rounded-lg font-bold text-sm text-slate-300 hover:bg-slate-700"
        >
          Back
        </button>
      </div>

      {history.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
          <div className="text-6xl mb-4">📭</div>
          <p className="font-bold">No match history found.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <button 
            onClick={clearHistory}
            className="w-full py-3 bg-red-900/30 border border-red-500/50 text-red-400 rounded-xl font-bold text-sm hover:bg-red-900/50 transition-colors"
          >
            🗑️ Clear All History
          </button>

          <div className="grid gap-4">
            {history.map((match, idx) => (
              <div key={idx} className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-4">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-2xl font-black text-white">Match {match.match}</div>
                    <div className="text-lg font-bold text-blue-400">Team {match.team}</div>
                    <div className="text-xs text-slate-500 mt-1">
                      {new Date(match.timestamp).toLocaleString()}
                    </div>
                  </div>
                  <button 
                    onClick={() => setSelectedMatch(selectedMatch === match ? null : match)}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg font-bold text-sm transition-colors"
                  >
                    {selectedMatch === match ? 'Hide QR' : 'Show QR'}
                  </button>
                </div>

                {selectedMatch === match && (
                  <div className="mt-4 pt-4 border-t border-slate-800 flex flex-col items-center gap-4">
                    <div className="bg-white p-4 rounded-xl">
                      <QRCodeSVG 
                        value={generateQRString(match)} 
                        size={256} 
                        level="L"
                        includeMargin={false}
                      />
                    </div>
                    <p className="text-xs text-slate-500 font-mono text-center break-all">
                      {generateQRString(match)}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
