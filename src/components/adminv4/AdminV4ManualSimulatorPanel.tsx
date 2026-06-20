import React from 'react';
import { ChevronLeft } from 'lucide-react';
import type { PpaAllianceSummary } from '../../utils/ppaInsights';
import { AdminButton, AdminInput, AdminSurface } from './AdminV4Primitives';
import { PpaAllianceBrief, PpaMatchupReadout } from './AdminV4PpaPanels';
import SimulatorTeamTable, { type AdminV4SimulatorTeamRow } from './AdminV4SimulatorTables';
import { FocusHeader, SummaryCard } from './AdminV4UiAtoms';

export type AdminV4SimulatorWinnerSummary = {
  winner: string | null;
  ppaWinner: string | null;
  roleAdjustedWinner: string | null;
};

export default function AdminV4ManualSimulatorPanel({
  modelAction,
  modelLabel,
  quickEntry,
  redInput,
  blueInput,
  redRows,
  blueRows,
  summary,
  redPpaSummary,
  bluePpaSummary,
  onSetQuickEntry,
  onSetRedInput,
  onSetBlueInput,
  onApplyQuickEntry,
  onBack,
  onOpenPpaWiki,
  onOpenPpaInfoMenu
}: {
  modelAction: React.ReactNode;
  modelLabel: string;
  quickEntry: string;
  redInput: string;
  blueInput: string;
  redRows: AdminV4SimulatorTeamRow[];
  blueRows: AdminV4SimulatorTeamRow[];
  summary: AdminV4SimulatorWinnerSummary;
  redPpaSummary: PpaAllianceSummary;
  bluePpaSummary: PpaAllianceSummary;
  onSetQuickEntry: (value: string) => void;
  onSetRedInput: (value: string) => void;
  onSetBlueInput: (value: string) => void;
  onApplyQuickEntry: () => void;
  onBack: () => void;
  onOpenPpaWiki: () => void;
  onOpenPpaInfoMenu: (event: React.MouseEvent) => void;
}) {
  return (
    <AdminSurface className="p-5">
      <FocusHeader
        eyebrow="Simulator"
        title="Manual Match Simulator"
        description="A focused what-if interface for entering custom alliances. Known future matches are simulated automatically in Matches."
        action={
          <div className="flex flex-wrap items-center gap-3">
            <AdminButton onClick={onBack}><ChevronLeft className="h-4 w-4" />Back to Matches</AdminButton>
            {modelAction}
          </div>
        }
      />
      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_auto]">
        <AdminInput
          value={quickEntry}
          onChange={event => onSetQuickEntry(event.target.value)}
          placeholder="Manual entry: 254 1678 971 vs 1323 4414 5940"
        />
        <AdminButton tone="cyan" onClick={onApplyQuickEntry}>Build Manual Match</AdminButton>
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <AdminSurface className="border-red-500/30 bg-red-500/10 p-4">
          <h3 className="text-lg font-black text-red-100">Red Alliance</h3>
          <textarea
            value={redInput}
            onChange={event => onSetRedInput(event.target.value)}
            rows={4}
            className="admin-g2-sm mt-3 w-full border border-red-500/30 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-red-300"
            placeholder="One team per line or comma separated"
          />
          <SimulatorTeamTable rows={redRows} />
        </AdminSurface>
        <AdminSurface className="border-blue-500/30 bg-blue-500/10 p-4">
          <h3 className="text-lg font-black text-blue-100">Blue Alliance</h3>
          <textarea
            value={blueInput}
            onChange={event => onSetBlueInput(event.target.value)}
            rows={4}
            className="admin-g2-sm mt-3 w-full border border-blue-500/30 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-blue-300"
            placeholder="One team per line or comma separated"
          />
          <SimulatorTeamTable rows={blueRows} />
        </AdminSurface>
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <SummaryCard label={`${modelLabel} Winner`} value={summary.winner || 'Need both alliances'} />
        <SummaryCard label="Range Insight Winner" value={summary.ppaWinner || 'Need both alliances'} />
        <SummaryCard label="Role Adjusted" value={summary.roleAdjustedWinner || 'Need both alliances'} />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <PpaAllianceBrief title="Red Expected Range" summary={redPpaSummary} accentClass="text-red-100" />
        <PpaAllianceBrief title="Blue Expected Range" summary={bluePpaSummary} accentClass="text-blue-100" />
      </div>
      <div className="mt-4">
        <PpaMatchupReadout
          title="Manual Expected Range Matchup"
          redSummary={redPpaSummary}
          blueSummary={bluePpaSummary}
          onInfo={onOpenPpaWiki}
          onInfoContext={onOpenPpaInfoMenu}
        />
      </div>
    </AdminSurface>
  );
}
