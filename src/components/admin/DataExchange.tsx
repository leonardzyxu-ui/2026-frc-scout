import React, { useState } from 'react';
import { TeamMetrics, TestTeamMetrics } from '../../utils/mathEngine';
import { Share2, Download, CheckCircle2 } from 'lucide-react';

interface DataExchangeProps {
  eventKey: string;
  metrics: Record<string, TeamMetrics>;
  testMetrics?: Record<string, TestTeamMetrics>;
}

export default function DataExchange({ eventKey, metrics, testMetrics = {} }: DataExchangeProps) {
  const [downloadStatus, setDownloadStatus] = useState<'idle' | 'success'>('idle');

  const handleDownload = () => {
    const headers = eventKey === 'TEST'
      ? ["team", "synthetic_score", "reliability", "climb_readiness", "auto_fluidity", "teleop_fluidity", "driver_pressure", "defense_effectiveness", "matches_logged"]
      : ["team", "epac", "epa", "auto_epac", "teleop_epac", "endgame_epac", "auto_fluidity", "teleop_fluidity", "driver_pressure", "defense_effectiveness", "matches_played"];
    const rows = eventKey === 'TEST'
      ? Object.values(testMetrics).map(m => [
          m.teamNumber,
          Number(m.syntheticScore.toFixed(2)),
          Number(m.reliabilityScore.toFixed(2)),
          Number(m.climbReadiness.toFixed(2)),
          Number(m.avgAutoFluidity.toFixed(1)),
          Number(m.avgTeleopFluidity.toFixed(1)),
          Number(m.avgDriverPressure.toFixed(1)),
          Number(m.avgDefenseEffectiveness.toFixed(1)),
          m.matchesLogged
        ])
      : Object.values(metrics).map(m => [
          m.teamNumber,
          Number(m.epac.toFixed(2)),
          Number(m.epa.toFixed(2)),
          Number(m.autoEpac.toFixed(2)),
          Number(m.teleopEpac.toFixed(2)),
          Number(m.endgameEpac.toFixed(2)),
          Number(m.avgAutoFluidity.toFixed(1)),
          Number(m.avgTeleopFluidity.toFixed(1)),
          Number(m.avgDriverPressure.toFixed(1)),
          Number(m.avgDefenseEffectiveness.toFixed(1)),
          m.matchesPlayed
        ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `scout_data_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    setDownloadStatus('success');
    setTimeout(() => setDownloadStatus('idle'), 3000);
  };

  return (
    <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 flex flex-col h-full">
      <div className="flex items-center justify-between mb-6 border-b border-slate-800 pb-4">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Share2 className="text-amber-400 w-6 h-6" />
          Data Control Export
        </h2>
      </div>

      <div className="flex-1 flex flex-col justify-center items-center text-center space-y-6">
        <div className="space-y-2">
          <h3 className="text-lg font-bold text-white">Event Export</h3>
          <p className="text-slate-400 text-sm max-w-sm mx-auto leading-relaxed">
            {eventKey === 'TEST'
              ? 'Export synthetic TEST-mode scout analytics as a CSV file from the Data Control workspace. Share sandbox data or inspect it offline.'
              : 'Export all calculated EPA/EPAc metrics, breakdowns, and subjective averages as a CSV file from the Data Control workspace.'}
          </p>
        </div>

        <div className="w-full max-w-xs mx-auto">
          <button
            onClick={handleDownload}
            className={`w-full py-4 rounded-xl font-black text-lg tracking-wide shadow-lg transition-all active:scale-95 flex items-center justify-center gap-3 ${
              downloadStatus === 'success'
                ? 'bg-emerald-600 text-white shadow-emerald-900/20' 
                : 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-900/20'
            }`}
          >
            {downloadStatus === 'success' ? (
              <>
                <CheckCircle2 className="w-6 h-6" />
                DOWNLOADED
              </>
            ) : (
              <>
                <Download className="w-6 h-6" />
                DOWNLOAD CSV
              </>
            )}
          </button>
        </div>

        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 w-full text-left">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Payload Preview</div>
          <pre className="text-xs font-mono text-slate-400 overflow-hidden text-ellipsis whitespace-nowrap">
            {eventKey === 'TEST'
              ? 'team,synthetic_score,reliability,climb_readiness,auto_fluidity,teleop_fluidity,driver_pressure,defense_effectiveness,matches_logged'
              : 'team,epac,epa,auto_epac,teleop_epac,endgame_epac,auto_fluidity,teleop_fluidity,driver_pressure,defense_effectiveness,matches_played'}
            <br/>
            {eventKey === 'TEST'
              ? '254,8.4,9.0,7.0,8.5,8.9,8.1,6.2,4'
              : '254,31.8,28.4,9.2,14.1,8.5,8.7,8.9,7.8,6.1,7'}
            <br/>
            ...
          </pre>
        </div>
      </div>
    </div>
  );
}
