import React, { useState } from 'react';
import { TeamMetrics } from '../../utils/mathEngine';
import { Share2, Copy, CheckCircle2 } from 'lucide-react';

interface DataExchangeProps {
  metrics: Record<string, TeamMetrics>;
}

export default function DataExchange({ metrics }: DataExchangeProps) {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleCopy = async () => {
    const headers = ["team", "oprc", "opr", "dpr", "auto", "teleop", "evasion", "defense"];
    const exportData = [
      headers,
      ...Object.values(metrics).map(m => [
        m.teamNumber,
        Number(m.oprc.toFixed(2)),
        Number(m.opr.toFixed(2)),
        Number(m.dpr.toFixed(2)),
        Number(m.avgAutoFluidity.toFixed(1)),
        Number(m.avgTeleopFluidity.toFixed(1)),
        Number(m.avgDriverPressure.toFixed(1)),
        Number(m.avgDefenseEffectiveness.toFixed(1))
      ])
    ];

    const jsonString = JSON.stringify(exportData);

    try {
      await navigator.clipboard.writeText(jsonString);
      setCopyStatus('success');
      setTimeout(() => setCopyStatus('idle'), 3000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
      setCopyStatus('error');
      setTimeout(() => setCopyStatus('idle'), 3000);
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
          <h3 className="text-lg font-bold text-white">Data Export</h3>
          <p className="text-slate-400 text-sm max-w-sm mx-auto leading-relaxed">
            Export all calculated metrics (OPRc, Subjective Averages, Defense Ratings) as a minimized JSON payload. 
            Instantly share with alliance partners via Airdrop, Slack, or Email.
          </p>
        </div>

        <div className="w-full max-w-xs mx-auto">
          <button
            onClick={handleCopy}
            className={`w-full py-4 rounded-xl font-black text-lg tracking-wide shadow-lg transition-all active:scale-95 flex items-center justify-center gap-3 ${
              copyStatus === 'success'
                ? 'bg-emerald-600 text-white shadow-emerald-900/20' 
                : copyStatus === 'error'
                ? 'bg-red-600 text-white shadow-red-900/20'
                : 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-900/20'
            }`}
          >
            {copyStatus === 'success' ? (
              <>
                <CheckCircle2 className="w-6 h-6" />
                COPIED TO CLIPBOARD
              </>
            ) : copyStatus === 'error' ? (
              <>
                <Share2 className="w-6 h-6" />
                COPY FAILED (CHECK PERMISSIONS)
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
              ["team", "oprc", "opr", "dpr", "auto", "teleop", "evasion", "defense"],
              ["254", 45.2, 40.1, 12.5, 9.5, 9.8, 8.5, 2.1],
              ["..."]
            ])}
          </pre>
        </div>
      </div>
    </div>
  );
}
