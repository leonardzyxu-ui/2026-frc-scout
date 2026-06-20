import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { AdminButton, AdminModal } from './AdminV4Primitives';
import { SummaryCard } from './AdminV4UiAtoms';

export type PowerCoinSettlementWinner = 'Red' | 'Blue' | 'Tie' | 'Unknown';

export type PowerCoinSettlementRequest = {
  mode: 'single' | 'played';
  title: string;
  description: string;
  matchSummaries: Array<{
    matchKey: string;
    winner: PowerCoinSettlementWinner;
    label?: string;
  }>;
  affectedBetCount: number;
  openStake: number;
};

export type AdminActionConfirmationTone = 'slate' | 'cyan' | 'emerald' | 'amber' | 'rose' | 'fuchsia';

export type AdminActionConfirmation = {
  title: string;
  message: string;
  detail?: string;
  confirmLabel: string;
  tone: AdminActionConfirmationTone;
  resolve: (confirmed: boolean) => void;
};

export function AdminV4ActionConfirmationModal({
  request,
  onCancel,
  onConfirm
}: {
  request: AdminActionConfirmation | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <AdminModal
      open={Boolean(request)}
      title={request?.title || 'Confirm Admin Action'}
      onClose={onCancel}
      footer={(
        <div className="flex flex-wrap items-center justify-end gap-3">
          <AdminButton onClick={onCancel}>Cancel</AdminButton>
          <AdminButton tone={request?.tone || 'amber'} onClick={onConfirm}>
            <AlertTriangle className="h-4 w-4" />{request?.confirmLabel || 'Confirm'}
          </AdminButton>
        </div>
      )}
    >
      {request && (
        <div className="admin-g2 border border-amber-400/30 bg-amber-500/10 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-200" aria-hidden="true" />
            <div>
              <p className="text-sm font-black text-amber-50">{request.message}</p>
              {request.detail && (
                <p className="mt-2 text-sm font-semibold leading-relaxed text-amber-100/75">{request.detail}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </AdminModal>
  );
}

export function AdminV4PowerCoinSettlementModal({
  request,
  formatMetricValue,
  onCancel,
  onConfirm
}: {
  request: PowerCoinSettlementRequest | null;
  formatMetricValue: (value: number | null, digits?: number) => string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <AdminModal
      open={Boolean(request)}
      title={request?.title || 'Confirm Scout Reward Settlement'}
      onClose={onCancel}
      footer={(
        <div className="flex flex-wrap items-center justify-end gap-3">
          <AdminButton onClick={onCancel}>Cancel</AdminButton>
          <AdminButton tone="amber" onClick={onConfirm}>
            <AlertTriangle className="h-4 w-4" />Confirm Settlement
          </AdminButton>
        </div>
      )}
    >
      {request && (
        <div className="space-y-4">
          <div className="admin-g2 border border-amber-400/30 bg-amber-500/10 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-200" aria-hidden="true" />
              <div>
                <p className="text-sm font-black text-amber-50">{request.description}</p>
                <p className="mt-2 text-sm font-semibold text-amber-100/75">
                  This will update {request.affectedBetCount} open reward prediction{request.affectedBetCount === 1 ? '' : 's'}
                  {' '}with {formatMetricValue(request.openStake, 0)} pending point{request.openStake === 1 ? '' : 's'}.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <SummaryCard label="Matches" value={request.matchSummaries.length} />
            <SummaryCard label="Open Reward Predictions" value={request.affectedBetCount} />
            <SummaryCard label="Pending Points" value={formatMetricValue(request.openStake, 0)} />
          </div>

          <div className="max-h-72 overflow-y-auto admin-g2-sm border border-slate-800">
            <table className="min-w-full text-left text-sm">
              <thead className="sticky top-0 bg-slate-950 text-xs uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-4 py-3">Match</th>
                  <th className="px-4 py-3">Applied Winner</th>
                  <th className="px-4 py-3">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {request.matchSummaries.map(match => (
                  <tr key={`${match.matchKey}-${match.winner}`}>
                    <td className="px-4 py-3 font-mono font-black text-white">{match.matchKey.toUpperCase()}</td>
                    <td className="px-4 py-3 font-black text-amber-100">{match.winner}</td>
                    <td className="px-4 py-3 text-slate-400">{match.label || 'Manual selection'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </AdminModal>
  );
}
