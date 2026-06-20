import { ChevronLeft } from 'lucide-react';
import { AdminButton, AdminSurface } from './AdminV4Primitives';
import { AdminEmptyState, FocusHeader, SummaryCard } from './AdminV4UiAtoms';

export interface AdminV4SourceStatusRow {
  id: string;
  source: string;
  key: string;
  detail: string;
  timestamp: number;
}

export default function AdminV4SourceFreshnessPanel({
  formatFreshnessAge,
  formatLocalTimestamp,
  preMatchProfileCount,
  preScoutEvidenceTeamCount,
  preScoutTaskCount,
  sourceStatusRows,
  sourceStatusSummary,
  onBack
}: {
  formatFreshnessAge: (timestamp: number | null | undefined) => string;
  formatLocalTimestamp: (timestamp: number | null | undefined) => string;
  preMatchProfileCount: number;
  preScoutEvidenceTeamCount: number;
  preScoutTaskCount: number;
  sourceStatusRows: AdminV4SourceStatusRow[];
  sourceStatusSummary: {
    latestTimestamp: number;
    uniqueSources: number;
    rowCount: number;
  };
  onBack: () => void;
}) {
  return (
    <AdminSurface className="p-5">
      <FocusHeader
        eyebrow="Data"
        title="Source Freshness"
        description="Official schedule, rankings, uploaded files, public profiles, and returned scout evidence for this admin device."
        action={<AdminButton onClick={onBack}><ChevronLeft className="h-4 w-4" />Back to Data</AdminButton>}
      />
      <div className="mt-5 grid gap-3 md:grid-cols-5">
        <SummaryCard label="Source Rows" value={sourceStatusSummary.rowCount} />
        <SummaryCard label="Source Types" value={sourceStatusSummary.uniqueSources} />
        <SummaryCard label="Latest Update" value={formatFreshnessAge(sourceStatusSummary.latestTimestamp)} />
        <SummaryCard label="Pre Scout Profiles" value={preMatchProfileCount} />
        <SummaryCard label="Pre Evidence" value={preScoutEvidenceTeamCount} />
      </div>
      {preScoutTaskCount > 0 && (
        <div className="admin-g2-sm mt-4 border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-100">
          {preScoutTaskCount} returned Pre Scout task{preScoutTaskCount === 1 ? '' : 's'} across {preScoutEvidenceTeamCount} team{preScoutEvidenceTeamCount === 1 ? '' : 's'} are loaded as local source data.
        </div>
      )}
      {preMatchProfileCount === 0 && (
        <div className="admin-g2-sm mt-4 border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-100">
          Pre Scout public-profile cache is not loaded yet. Open Data / Pre Scout to build before-event context for pit priorities and range guardrails.
        </div>
      )}
      <div className="mt-4 overflow-x-auto admin-g2-sm border border-slate-800">
        <table className="admin-sticky-table min-w-full text-left text-sm">
          <thead className="bg-slate-950 text-xs uppercase tracking-wider text-slate-400">
            <tr>
              {['Source', 'Dataset', 'Detail', 'Freshness', 'Loaded'].map(header => <th key={header} className="px-4 py-3">{header}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {sourceStatusRows.map(row => (
              <tr key={row.id}>
                <td className="px-4 py-3 font-black text-cyan-100">{row.source}</td>
                <td className="px-4 py-3 font-mono text-xs text-white">{row.key}</td>
                <td className="px-4 py-3 text-slate-300">{row.detail}</td>
                <td className="px-4 py-3 font-black text-cyan-100">{formatFreshnessAge(row.timestamp)}</td>
                <td className="px-4 py-3 text-slate-400">{formatLocalTimestamp(row.timestamp)}</td>
              </tr>
            ))}
            {sourceStatusRows.length === 0 && (
              <tr>
                <td className="px-4 py-4" colSpan={5}>
                  <AdminEmptyState
                    title="Official schedule/source missing"
                    why="Scout evidence may still exist, but schedule, rankings, teams, and official results are missing from this device cache."
                    action="Refresh live sources with local credentials or upload TBA/FIRST files in Imports."
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AdminSurface>
  );
}
