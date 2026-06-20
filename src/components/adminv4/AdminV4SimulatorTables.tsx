import { PpaInsight } from '../../utils/ppaInsights';
import { getRiskPillClass } from './AdminV4RiskPill';
import { PpaMiniShape } from './AdminV4PpaPanels';
import { AdminEmptyState } from './AdminV4UiAtoms';

export interface AdminV4SimulatorTeamRow {
  teamNumber: string;
  teamName: string;
  rating: number;
  ppaRating: number | null;
  ppaInsight: PpaInsight | null;
  defenseImpact: number | null;
  recommendedRole: string;
  auto: number | null;
  teleop: number | null;
}

const formatMetricValue = (value: number | null, digits: number = 2) =>
  value == null || !Number.isFinite(value) ? '-' : value.toFixed(digits);

export function SimulatorTeamTable({
  rows
}: {
  rows: AdminV4SimulatorTeamRow[];
}) {
  return (
    <div className="admin-g2-sm mt-4 overflow-x-auto border border-slate-800">
      <table className="admin-sticky-table min-w-full text-left text-sm">
        <thead className="bg-slate-950 text-xs uppercase tracking-wider text-slate-400">
          <tr>
            <th className="px-3 py-2">Team</th>
            <th className="px-3 py-2 text-right">Rating</th>
            <th className="px-3 py-2">Expected Range</th>
            <th className="px-3 py-2 text-right">Defense</th>
            <th className="px-3 py-2">Role</th>
            <th className="px-3 py-2">Trust</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {rows.map(row => (
            <tr key={row.teamNumber}>
              <td className="px-3 py-2">
                <div className="font-mono font-black text-white">{row.teamNumber}</div>
                {row.teamName && <div className="text-xs text-slate-500">{row.teamName}</div>}
              </td>
              <td className="px-3 py-2 text-right font-black text-cyan-100">{formatMetricValue(row.rating)}</td>
              <td className="px-3 py-2">
                <PpaMiniShape insight={row.ppaInsight} fallbackRating={row.ppaRating} />
              </td>
              <td className="px-3 py-2 text-right text-emerald-200">{formatMetricValue(row.defenseImpact)}</td>
              <td className="px-3 py-2 text-slate-300">{row.recommendedRole}</td>
              <td className="px-3 py-2">
                <span className={`admin-g2-sm px-2 py-1 text-xs font-black ${getRiskPillClass(row.ppaInsight?.uncertainty.level || 'High')}`}>
                  {row.ppaInsight?.uncertainty.level || 'High'}
                </span>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td className="px-3 py-4" colSpan={6}>
                <AdminEmptyState
                  title="No teams entered for this alliance"
                  why="The simulator needs team numbers before it can estimate score, role, risk, or defense impact."
                  action="Enter one to three team numbers for each alliance."
                />
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default SimulatorTeamTable;
