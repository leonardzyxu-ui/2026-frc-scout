import React, { useState } from 'react';
import { TeamMetrics } from '../../utils/mathEngine';
import { Share2, Copy, CheckCircle2 } from 'lucide-react';

interface DataExchangeProps {
  metrics: Record<string, TeamMetrics>;
}

export default function DataExchange({ metrics }: DataExchangeProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const exportData = Object.values(metrics).map(m => ({
      team: m.teamNumber,
      popr: Number(m.popr.toFixed(2)),
      opr: Number(m.opr.toFixed(2)),
      dpr: Number(m.dpr.toFixed(2)),
      auto: Number(m.avgAutoFluidity.toFixed(1)),
      teleop: Number(m.avgTeleopFluidity.toFixed(1)),
      evasion: Number(m.avgUnderPressure.toFixed(1)),
      defense: Number(m.avgDefenseEffectiveness.toFixed(1)),
      climb: Number(m.avgClimbRate.toFixed(2))
    }));

    const jsonString = JSON.stringify(exportData);

    try {
      await navigator.clipboard.writeText(jsonString);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
      alert('Failed to copy to clipboard. Please check browser permissions.');
    }
  };

  return (
    <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 flex flex-col h-full">
      <div className="flex items-center justify-between mb-6 border-b border-slate-800 pb-4">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Share2 className="text-amber-400 w-6 h-6" />
          Scout Exchange Bridge
        </h2>
      </div>

      <div className="flex-1 flex flex-col justify-center items-center text-center space-y-6">
        <div className="space-y-2">
          <h3 className="text-lg font-bold text-white">Gracious Professionalism</h3>
          <p className="text-slate-400 text-sm max-w-sm mx-auto leading-relaxed">
            Export all calculated metrics (POPR, Subjective Averages, Climb Rates) as a minimized JSON payload. 
            Instantly share with alliance partners via Airdrop, Slack, or Email.
          </p>
        </div>

        <div className="w-full max-w-xs mx-auto">
          <button
            onClick={handleCopy}
            className={`w-full py-4 rounded-xl font-black text-lg tracking-wide shadow-lg transition-all active:scale-95 flex items-center justify-center gap-3 ${
              copied 
                ? 'bg-emerald-600 text-white shadow-emerald-900/20' 
                : 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-900/20'
            }`}
          >
            {copied ? (
              <>
                <CheckCircle2 className="w-6 h-6" />
                COPIED TO CLIPBOARD
              </>
            ) : (
              <>
                <Copy className="w-6 h-6" />
                COPY ALLIANCE DATA JSON
              </>
            )}
          </button>
        </div>

        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 w-full text-left">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Payload Preview</div>
          <pre className="text-xs font-mono text-slate-400 overflow-hidden text-ellipsis whitespace-nowrap">
            {JSON.stringify([
              { team: "254", popr: 45.2, opr: 40.1, dpr: 12.5, auto: 9.5, teleop: 9.8, evasion: 8.5, defense: 2.1, climb: 0.95 },
              { team: "..." }
            ])}
          </pre>
        </div>
      </div>
    </div>
  );
}
