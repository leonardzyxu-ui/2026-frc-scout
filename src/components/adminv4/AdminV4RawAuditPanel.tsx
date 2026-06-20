import { ChevronLeft } from 'lucide-react';
import { AdminButton, AdminInput, AdminSurface } from './AdminV4Primitives';
import { FocusHeader, SummaryCard } from './AdminV4UiAtoms';

export type AdminV4RawAuditTab = 'quals' | 'practice';

export interface AdminV4RawAuditSummary {
  visibleMatches: number;
  missingSlotCount: number;
  anomalyRowCount: number;
  submittedRowCount: number;
}

export interface AdminV4RawAuditGroup {
  displayMatchKey: string;
  scheduleKnown: boolean;
  missingSlots: unknown[];
  warnings: string[];
  rows: unknown[];
}

export function AdminV4RawAuditPanel({
  groups,
  search,
  summary,
  viewTab,
  onBack,
  onSetSearch,
  onSetViewTab
}: {
  groups: AdminV4RawAuditGroup[];
  search: string;
  summary: AdminV4RawAuditSummary;
  viewTab: AdminV4RawAuditTab;
  onBack: () => void;
  onSetSearch: (value: string) => void;
  onSetViewTab: (tab: AdminV4RawAuditTab) => void;
}) {
  return (
    <AdminSurface className="p-5">
      <FocusHeader
        eyebrow="Data"
        title="Raw Data Audit"
        description="One focused coverage and anomaly audit. This is not appended below every workflow anymore."
        action={<AdminButton onClick={onBack}><ChevronLeft className="h-4 w-4" />Back to Data</AdminButton>}
      />
      <div className="mt-5 grid gap-3 md:grid-cols-4">
        <SummaryCard label="Visible Matches" value={summary.visibleMatches} />
        <SummaryCard label="Missing Slots" value={summary.missingSlotCount} />
        <SummaryCard label="Anomalies" value={summary.anomalyRowCount} />
        <SummaryCard label="Submitted Rows" value={summary.submittedRowCount} />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {(['quals', 'practice'] as AdminV4RawAuditTab[]).map(tab => (
          <AdminButton key={tab} tone={viewTab === tab ? 'cyan' : 'slate'} onClick={() => onSetViewTab(tab)}>
            {tab === 'quals' ? 'Qualifications' : 'Practice'}
          </AdminButton>
        ))}
        <AdminInput
          value={search}
          onChange={event => onSetSearch(event.target.value)}
          placeholder="Filter match, team, scout, anomaly"
          className="min-w-72"
        />
      </div>
      <div className="mt-4 max-h-[560px] overflow-y-auto admin-g2-sm border border-slate-800">
        <table className="admin-sticky-table min-w-full text-left text-sm">
          <thead className="sticky top-0 bg-slate-950 text-xs uppercase tracking-wider text-slate-400">
            <tr>
              <th className="px-4 py-3">Match</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Missing</th>
              <th className="px-4 py-3">Warnings</th>
              <th className="px-4 py-3">Rows</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {groups.map(group => (
              <tr key={group.displayMatchKey}>
                <td className="px-4 py-3 font-mono font-black text-white">{group.displayMatchKey}</td>
                <td className="px-4 py-3">{group.scheduleKnown ? 'Scheduled' : 'Schedule missing'}</td>
                <td className="px-4 py-3 text-amber-100">{group.missingSlots.length}</td>
                <td className="px-4 py-3 text-slate-400">{group.warnings.join(', ') || 'None'}</td>
                <td className="px-4 py-3">{group.rows.length}</td>
              </tr>
            ))}
            {groups.length === 0 && (
              <tr>
                <td className="px-4 py-8 text-center text-slate-500" colSpan={5}>
                  No raw audit rows match this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AdminSurface>
  );
}

export default AdminV4RawAuditPanel;
