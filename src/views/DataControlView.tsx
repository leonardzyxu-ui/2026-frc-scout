import React, { useState } from 'react';
import { Download, Share2, Upload } from 'lucide-react';
import { TeamMetrics, TestTeamMetrics } from '../utils/mathEngine';
import QRScannerView from './QRScannerView';
import DataExchange from '../components/admin/DataExchange';

type DataControlTab = 'import' | 'export';

interface DataControlViewProps {
  eventKey: string;
  metrics: Record<string, TeamMetrics>;
  testMetrics: Record<string, TestTeamMetrics>;
}

export default function DataControlView({ eventKey, metrics, testMetrics }: DataControlViewProps) {
  const [activeTab, setActiveTab] = useState<DataControlTab>('import');

  const tabButtonClass = (tab: DataControlTab) =>
    `inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-black tracking-wide transition-all ${
      activeTab === tab
        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20'
        : 'bg-slate-950 text-slate-400 border border-slate-800 hover:bg-slate-800 hover:text-white'
    }`;

  return (
    <div className="space-y-6 h-full">
      <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-2xl font-black text-white flex items-center gap-3">
              <Share2 className="w-7 h-7 text-emerald-400" />
              Data Control
            </h2>
            <p className="text-sm text-slate-400 mt-2">
              Manage offline import, staging, and event data export from one operational workspace.
            </p>
          </div>
          <div className="inline-flex gap-2 rounded-2xl bg-slate-900/70 border border-slate-800 p-2">
            <button type="button" onClick={() => setActiveTab('import')} className={tabButtonClass('import')}>
              <Upload className="w-4 h-4" />
              Import
            </button>
            <button type="button" onClick={() => setActiveTab('export')} className={tabButtonClass('export')}>
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>
      </div>

      <div className={activeTab === 'import' ? 'block' : 'hidden'} aria-hidden={activeTab !== 'import'}>
        <QRScannerView isEmbedded={true} isActive={activeTab === 'import'} />
      </div>

      <div className={activeTab === 'export' ? 'block' : 'hidden'} aria-hidden={activeTab !== 'export'}>
        <DataExchange eventKey={eventKey} metrics={metrics} testMetrics={testMetrics} />
      </div>
    </div>
  );
}
