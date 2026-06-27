import { RefreshCw } from 'lucide-react';
import { PowerCoinBet } from '../../types';
import { AdminButton, AdminInput } from './AdminV4Primitives';
import { AdminEmptyState, FocusHeader, SummaryCard } from './AdminV4UiAtoms';
import { PowerCoinSettlementWinner } from './AdminV4SafetyModals';

export interface AdminV4ScoutRewardRow {
  scoutName: string;
  balance: number;
  openBets: number;
  openStake: number;
  settledBets: number;
  totalStaked: number;
  totalPayout: number;
  ledgerDelta: number;
}

const formatMetricValue = (value: number | null | undefined, digits: number = 2) =>
  value == null || !Number.isFinite(value) ? '-' : value.toFixed(digits);

const STARTING_REWARD_BALANCE = 1000;

export default function AdminV4ScoutRewardsPanel({
  rows,
  bets,
  status,
  adjustmentScout,
  adjustmentAmount,
  adjustmentReason,
  onSetAdjustmentScout,
  onSetAdjustmentAmount,
  onSetAdjustmentReason,
  onApplyAdjustment,
  onSettleAllPlayed,
  onSettleMatch
}: {
  rows: AdminV4ScoutRewardRow[];
  bets: PowerCoinBet[];
  status: string;
  adjustmentScout: string;
  adjustmentAmount: number;
  adjustmentReason: string;
  onSetAdjustmentScout: (value: string) => void;
  onSetAdjustmentAmount: (value: number) => void;
  onSetAdjustmentReason: (value: string) => void;
  onApplyAdjustment: () => void | Promise<void>;
  onSettleAllPlayed: () => void | Promise<void>;
  onSettleMatch: (matchKey: string, winner: PowerCoinSettlementWinner) => void | Promise<void>;
}) {
  const openBets = bets.filter(bet => !bet.settledAt);
  const normalizedAdjustmentScout = adjustmentScout.trim().toLowerCase();
  const selectedAdjustmentRow = rows.find(row => row.scoutName.trim().toLowerCase() === normalizedAdjustmentScout);
  const adjustmentDelta = Number.isFinite(Number(adjustmentAmount)) ? Math.trunc(Number(adjustmentAmount)) : 0;
  const adjustmentCurrentBalance = selectedAdjustmentRow?.balance ?? STARTING_REWARD_BALANCE;
  const adjustmentAfterBalance = adjustmentCurrentBalance + adjustmentDelta;
  const adjustmentReasonReady = adjustmentReason.trim().length > 0;
  const adjustmentReady = normalizedAdjustmentScout.length > 0 && adjustmentDelta !== 0 && adjustmentReasonReady;
  const adjustmentDeltaLabel = adjustmentDelta > 0 ? `+${adjustmentDelta}` : String(adjustmentDelta);

  return (
    <div className="min-w-0 space-y-5">
      <div className="admin-g2 border border-yellow-400/25 bg-yellow-500/10 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-xl font-black text-white">Scout Rewards</h3>
            <p className="mt-1 text-sm font-semibold text-yellow-50/75">
              Scout rewards are optional incentives managed by the head scout. Reward points start at 1000 per scout per event and never block data capture.
            </p>
          </div>
          <AdminButton
            tone="amber"
            onClick={() => void onSettleAllPlayed()}
            aria-label="Preview and settle played scout reward predictions"
          >
            <RefreshCw className="h-4 w-4" />Settle Played
          </AdminButton>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <SummaryCard label="Tracked Scouts" value={rows.length} />
          <SummaryCard label="Open Reward Predictions" value={openBets.length} />
          <SummaryCard label="Pending Points" value={openBets.reduce((sum, bet) => sum + bet.amount, 0)} />
        </div>
        {status && (
          <div className="mt-3 admin-g2-sm border border-yellow-400/30 bg-yellow-400/10 px-4 py-3 text-sm font-semibold text-yellow-100">
            {status}
          </div>
        )}
      </div>

      <div className="admin-g2 border border-yellow-400/25 bg-slate-950/70 p-4">
        <div className="text-sm font-black text-yellow-100">Manual Reward Adjustment</div>
        <p className="mt-1 text-xs font-semibold text-yellow-100/65">Use ledger adjustments for quality bonuses, cleanup penalties, or demo rewards. Preview the balance change before applying it.</p>
        <div className="mt-3 grid gap-3 xl:grid-cols-[1fr_120px]">
          <AdminInput
            aria-label="Scout reward adjustment scout"
            list="adminv4-powercoin-scouts"
            value={adjustmentScout}
            onChange={event => onSetAdjustmentScout(event.target.value)}
            placeholder="Scout name"
          />
          <AdminInput
            aria-label="Scout reward adjustment amount"
            type="number"
            value={adjustmentAmount}
            onChange={event => onSetAdjustmentAmount(Number(event.target.value))}
          />
        </div>
        <datalist id="adminv4-powercoin-scouts">
          {rows.map(row => <option key={row.scoutName} value={row.scoutName} />)}
        </datalist>
        <div className="mt-3 grid gap-3 xl:grid-cols-[1fr_auto]">
          <AdminInput
            aria-label="Scout reward adjustment reason"
            value={adjustmentReason}
            onChange={event => onSetAdjustmentReason(event.target.value)}
            placeholder="Quality scouting bonus"
          />
          <AdminButton tone="amber" disabled={!adjustmentReady} onClick={() => void onApplyAdjustment()}>Apply</AdminButton>
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-4">
          <div className="admin-g2-sm border border-yellow-400/20 bg-yellow-500/10 px-3 py-2">
            <div className="text-[11px] font-black uppercase tracking-wider text-yellow-100/60">Before Apply</div>
            <div className="mt-1 text-sm font-black text-yellow-50">{formatMetricValue(adjustmentCurrentBalance, 0)}</div>
          </div>
          <div className="admin-g2-sm border border-yellow-400/20 bg-yellow-500/10 px-3 py-2">
            <div className="text-[11px] font-black uppercase tracking-wider text-yellow-100/60">Adjustment</div>
            <div className={`mt-1 text-sm font-black ${adjustmentDelta < 0 ? 'text-rose-200' : 'text-emerald-200'}`}>{adjustmentDeltaLabel}</div>
          </div>
          <div className="admin-g2-sm border border-yellow-400/20 bg-yellow-500/10 px-3 py-2">
            <div className="text-[11px] font-black uppercase tracking-wider text-yellow-100/60">After Apply</div>
            <div className="mt-1 text-sm font-black text-yellow-50">{formatMetricValue(adjustmentAfterBalance, 0)}</div>
          </div>
          <div className={`admin-g2-sm border px-3 py-2 ${adjustmentReasonReady ? 'border-emerald-400/30 bg-emerald-500/10' : 'border-amber-400/30 bg-amber-500/10'}`}>
            <div className="text-[11px] font-black uppercase tracking-wider text-yellow-100/60">Reason Required</div>
            <div className={`mt-1 text-sm font-black ${adjustmentReasonReady ? 'text-emerald-100' : 'text-amber-100'}`}>
              {adjustmentReasonReady ? 'Ready' : 'Missing'}
            </div>
          </div>
        </div>
        {normalizedAdjustmentScout && !selectedAdjustmentRow && (
          <div className="mt-3 admin-g2-sm border border-yellow-400/20 bg-yellow-500/10 px-3 py-2 text-xs font-semibold text-yellow-100/75">
            This scout is not in the current reward table yet, so the preview uses the {STARTING_REWARD_BALANCE}-point starting balance before creating a ledger entry.
          </div>
        )}
      </div>

      {rows.length > 0 && (
        <div className="admin-g2 border border-yellow-400/20 bg-slate-950/70 p-4">
          <div className="text-sm font-black text-white">Top Reward Balances</div>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {rows.slice(0, 3).map((row, index) => (
              <div key={row.scoutName} className="admin-g2-sm border border-yellow-500/20 bg-yellow-500/10 px-3 py-2">
                <div className="text-xs font-black uppercase tracking-widest text-yellow-100/70">#{index + 1}</div>
                <div className="mt-1 font-black text-yellow-100">{row.scoutName}</div>
                <div className="text-sm font-semibold text-yellow-100/70">{formatMetricValue(row.balance, 0)} points</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="admin-g2 border border-slate-800 bg-slate-950/70 p-4">
        <FocusHeader title="Scout Reward Standings" description="Balances include ledger adjustments, pending points, and settled returns." />
        <div className="mt-4 max-h-72 overflow-y-auto admin-g2-sm border border-slate-800">
          <table className="admin-sticky-table min-w-full text-left text-sm">
            <thead className="sticky top-0 bg-slate-950 text-xs uppercase tracking-wider text-slate-400">
              <tr>
                {['Rank', 'Scout', 'Balance', 'Open Reward Predictions', 'Pending Points', 'Settled', 'Allocated', 'Returned'].map(header => <th key={header} className="px-4 py-3">{header}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {rows.map((row, index) => (
                <tr key={row.scoutName}>
                  <td className="px-4 py-3 font-mono font-black text-yellow-200">#{index + 1}</td>
                  <td className="px-4 py-3 font-black text-white">{row.scoutName}</td>
                  <td className="px-4 py-3 font-black text-yellow-200">{formatMetricValue(row.balance, 0)}</td>
                  <td className="px-4 py-3">{row.openBets}</td>
                  <td className="px-4 py-3">{formatMetricValue(row.openStake, 0)}</td>
                  <td className="px-4 py-3">{row.settledBets}</td>
                  <td className="px-4 py-3">{formatMetricValue(row.totalStaked, 0)}</td>
                  <td className="px-4 py-3">{formatMetricValue(row.totalPayout, 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="admin-g2 border border-slate-800 bg-slate-950/70 p-4">
        <FocusHeader title="Open And Settled Reward Predictions" description="Unsettled reward predictions can be settled manually when the official result is known." />
        <div className="mt-4 max-h-96 overflow-y-auto admin-g2-sm border border-slate-800">
          <table className="admin-sticky-table min-w-full text-left text-sm">
            <thead className="sticky top-0 bg-slate-950 text-xs uppercase tracking-wider text-slate-400">
              <tr>
                {['Scout', 'Match', 'Side', 'Points', 'Result', 'Returned Points', 'Actions'].map(header => <th key={header} className="px-4 py-3">{header}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {bets.map(bet => (
                <tr key={bet.id}>
                  <td className="px-4 py-3 font-black text-white">{bet.scoutName}</td>
                  <td className="px-4 py-3 font-mono">{bet.matchKey.toUpperCase()}</td>
                  <td className={`px-4 py-3 font-black ${bet.side === 'Red' ? 'text-red-300' : 'text-blue-300'}`}>{bet.side}</td>
                  <td className="px-4 py-3">{bet.amount}</td>
                  <td className="px-4 py-3">{bet.outcome || 'open'}</td>
                  <td className="px-4 py-3">{formatMetricValue(bet.payout ?? null, 0)}</td>
                  <td className="px-4 py-3">
                    {!bet.settledAt && (
                      <div className="flex flex-wrap gap-2">
                        {(['Red', 'Blue', 'Tie'] as const).map(winner => (
                          <button
                            key={winner}
                            type="button"
                            aria-label={`Preview settlement for ${bet.matchKey.toUpperCase()} as ${winner}`}
                            onClick={() => void onSettleMatch(bet.matchKey, winner)}
                            className="admin-g2-sm min-h-10 border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-black text-slate-100 hover:bg-slate-700"
                          >
                            {winner}
                          </button>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {bets.length === 0 && (
                <tr>
                  <td className="px-4 py-4" colSpan={7}>
                    <AdminEmptyState
                      title="No scout reward predictions yet"
                      why="Reward operations are separate from scouting decisions and should stay quiet until scouts have made local predictions."
                      action="Leave this alone unless your team is actively using the scout reward system."
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
