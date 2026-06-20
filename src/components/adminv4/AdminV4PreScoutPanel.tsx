import React from 'react';
import { ChevronLeft } from 'lucide-react';
import { AdminButton, AdminSurface } from './AdminV4Primitives';
import { EmbeddedPanelLoading, FocusHeader, SummaryCard } from './AdminV4UiAtoms';

const EmbeddedPreMatchView = React.lazy(() => import('../../views/PreMatchView'));

export default function AdminV4PreScoutPanel({
  cachedProfileCount,
  eventKey,
  evidenceTeamCount,
  returnedEvidenceCount,
  onBack,
  onCacheChanged
}: {
  cachedProfileCount: number;
  eventKey: string;
  evidenceTeamCount: number;
  returnedEvidenceCount: number;
  onBack: () => void;
  onCacheChanged: () => void;
}) {
  return (
    <AdminSurface className="p-5">
      <FocusHeader
        eyebrow="Data / Collection Workflow"
        title="Pre Scout"
        description="Public team research lives here because it seeds early model context and tells pit scouts what they must verify manually."
        action={<AdminButton onClick={onBack}><ChevronLeft className="h-4 w-4" />Back to Collection</AdminButton>}
      />
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <SummaryCard label="Cached Profiles" value={cachedProfileCount} />
        <SummaryCard label="Evidence Returns" value={returnedEvidenceCount} />
        <SummaryCard label="Evidence Teams" value={evidenceTeamCount} />
      </div>
      {returnedEvidenceCount > 0 && (
        <div className="admin-g2-sm mt-4 border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-100">
          Returned Pre Scout evidence is included in Reports, backup export, source freshness, and the admin task feedback loop.
        </div>
      )}
      <div className="mt-5">
        <React.Suspense fallback={<EmbeddedPanelLoading label="Loading Pre Scout..." />}>
          <EmbeddedPreMatchView isEmbedded={true} eventKey={eventKey} onCacheChanged={onCacheChanged} />
        </React.Suspense>
      </div>
    </AdminSurface>
  );
}
