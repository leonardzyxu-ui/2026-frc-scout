import React from 'react';
import { ChevronLeft, Upload } from 'lucide-react';
import { AdminButton, AdminSurface } from './AdminV4Primitives';
import { EmbeddedPanelLoading, FocusHeader } from './AdminV4UiAtoms';

const EmbeddedQRScannerView = React.lazy(() => import('../../views/QRScannerView'));

export default function AdminV4ImportsPanel({
  csvError,
  csvMessages,
  isScannerActive,
  onArchiveChanged,
  onBack,
  onTbaFilesSelected
}: {
  csvError: string;
  csvMessages: Array<{ text: string }>;
  isScannerActive: boolean;
  onArchiveChanged: () => void;
  onBack: () => void;
  onTbaFilesSelected: React.ChangeEventHandler<HTMLInputElement>;
}) {
  return (
    <AdminSurface className="p-5">
      <FocusHeader
        eyebrow="Data"
        title="Imports"
        description="TBA uploads, QR scans, and JSON scout archives."
        action={<AdminButton onClick={onBack}><ChevronLeft className="h-4 w-4" />Back to Data</AdminButton>}
      />
      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <AdminSurface className="p-4">
          <h3 className="text-lg font-black text-white">Official Source Import</h3>
          <p className="mt-2 text-sm text-slate-400">Upload official schedule, rankings, alliances, team list, event metadata, and rating files.</p>
          <label className="mt-4 inline-flex cursor-pointer items-center justify-center gap-2 admin-g2-sm bg-cyan-600 px-5 py-3 text-sm font-black text-white hover:bg-cyan-500">
            <Upload className="h-4 w-4" />Upload Source Files
            <input type="file" accept=".csv,.json,text/csv,application/json" multiple className="hidden" onChange={onTbaFilesSelected} />
          </label>
          {csvError && <div className="mt-4 admin-g2-sm border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-100">{csvError}</div>}
          {csvMessages.length > 0 && (
            <div className="mt-4 space-y-2 text-sm text-cyan-100">
              {csvMessages.map((message, index) => <div key={`${message.text}-${index}`}>{message.text}</div>)}
            </div>
          )}
        </AdminSurface>
        <AdminSurface className="p-4">
          <h3 className="text-lg font-black text-white">Scouting Data Import</h3>
          <p className="mt-2 text-sm text-slate-400">Scan QR payloads or import JSON scout archives.</p>
          <div className="mt-4">
            <React.Suspense fallback={<EmbeddedPanelLoading label="Loading import tools..." />}>
              <EmbeddedQRScannerView isEmbedded={true} isActive={isScannerActive} onArchiveChanged={onArchiveChanged} />
            </React.Suspense>
          </div>
        </AdminSurface>
      </div>
    </AdminSurface>
  );
}
