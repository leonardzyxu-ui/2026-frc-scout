import React from 'react';
import { PowerCoinBet, PowerCoinLedgerEntry, ScoutAssignmentPlan } from '../../types';
import { TBAMatch } from '../../utils/mathEngine';
import {
  getPowerCoinBalance,
  listPowerCoinBets,
  listPowerCoinLedger,
  loadLatestScoutAssignmentPlan,
  saveScoutAssignmentPlan,
  settlePowerCoinBetsForMatch,
  upsertPowerCoinLedgerEntry,
  type AdminV4AuditLogEntry
} from '../../utils/adminV4LocalStore';
import {
  getAdminV4PlayedMatchWinner,
  isAdminV4PlayedMatch
} from '../../utils/adminV4MatchUtils';
import { getAdminV4MatchLabel } from '../../utils/adminV4TestMode';
import type { AdminV4ScoutRewardRow } from './AdminV4ScoutRewardsPanel';
import type {
  AdminActionConfirmation,
  PowerCoinSettlementRequest,
  PowerCoinSettlementWinner
} from './AdminV4SafetyModals';
import { optimizeScoutAssignments } from '../../utils/strategyBrain';
import { downloadCsvFile } from '../../utils/csv';

export const DEFAULT_ADMIN_V4_SCOUTS = ['Olivia', 'Eason', 'Matilda', 'Sophia', 'Lucas', 'Justin'];

const STARTING_REWARD_POINTS = 1000;

type AdminV4ConfirmationRequester = (details: Omit<AdminActionConfirmation, 'resolve'>) => Promise<boolean>;

type AdminV4AuditRecorder = (
  action: string,
  detail: string,
  severity?: AdminV4AuditLogEntry['severity']
) => Promise<void>;

export function useAdminV4ScoutRewards({
  activePredictorMatches,
  eventKey,
  ownTeamNumber,
  recordAdminAudit,
  requestAdminActionConfirmation
}: {
  activePredictorMatches: TBAMatch[];
  eventKey: string;
  ownTeamNumber: string;
  recordAdminAudit: AdminV4AuditRecorder;
  requestAdminActionConfirmation: AdminV4ConfirmationRequester;
}) {
  const [scoutAssignmentPlan, setScoutAssignmentPlan] = React.useState<ScoutAssignmentPlan | null>(null);
  const [scoutRosterText, setScoutRosterText] = React.useState(DEFAULT_ADMIN_V4_SCOUTS.join('\n'));
  const [scoutControlStatus, setScoutControlStatus] = React.useState('');
  const [powerCoinBets, setPowerCoinBets] = React.useState<PowerCoinBet[]>([]);
  const [powerCoinLedger, setPowerCoinLedger] = React.useState<PowerCoinLedgerEntry[]>([]);
  const [powerCoinStatus, setPowerCoinStatus] = React.useState('');
  const [powerCoinSettlementRequest, setPowerCoinSettlementRequest] = React.useState<PowerCoinSettlementRequest | null>(null);
  const [powerCoinAdjustmentScout, setPowerCoinAdjustmentScout] = React.useState('');
  const [powerCoinAdjustmentAmount, setPowerCoinAdjustmentAmount] = React.useState(100);
  const [powerCoinAdjustmentReason, setPowerCoinAdjustmentReason] = React.useState('Quality scouting bonus');

  const refreshScoutOpsState = React.useCallback(async () => {
    const [plan, bets, ledger] = await Promise.all([
      loadLatestScoutAssignmentPlan(eventKey).catch(() => null),
      listPowerCoinBets(eventKey).catch(() => []),
      listPowerCoinLedger(eventKey).catch(() => [])
    ]);
    setScoutAssignmentPlan(plan);
    setPowerCoinBets(bets);
    setPowerCoinLedger(ledger);
  }, [eventKey]);

  React.useEffect(() => {
    void refreshScoutOpsState();
  }, [refreshScoutOpsState]);

  React.useEffect(() => {
    if (scoutAssignmentPlan?.scoutNames?.length) {
      setScoutRosterText(scoutAssignmentPlan.scoutNames.join('\n'));
    }
  }, [scoutAssignmentPlan]);

  const powerCoinRows = React.useMemo<AdminV4ScoutRewardRow[]>(() => {
    const scouts = Array.from(new Set([
      ...DEFAULT_ADMIN_V4_SCOUTS,
      ...(scoutAssignmentPlan?.scoutNames || []),
      ...powerCoinBets.map(bet => bet.scoutName),
      ...powerCoinLedger.map(entry => entry.scoutName)
    ])).filter(Boolean);

    return scouts.map(scoutName => {
      const normalizedScoutName = scoutName.trim().toLowerCase();
      const scoutBets = powerCoinBets.filter(bet => bet.scoutName.trim().toLowerCase() === normalizedScoutName);
      const scoutLedger = powerCoinLedger.filter(entry => entry.scoutName.trim().toLowerCase() === normalizedScoutName);
      const ledgerDelta = scoutLedger.reduce((sum, entry) => sum + entry.delta, 0);
      const pendingPoints = scoutBets.filter(bet => !bet.settledAt).reduce((sum, bet) => sum + bet.amount, 0);
      const settledDelta = scoutBets
        .filter(bet => bet.settledAt)
        .reduce((sum, bet) => sum + ((bet.payout ?? 0) - bet.amount), 0);
      return {
        scoutName,
        balance: STARTING_REWARD_POINTS + ledgerDelta - pendingPoints + settledDelta,
        openBets: scoutBets.filter(bet => !bet.settledAt).length,
        openStake: pendingPoints,
        settledBets: scoutBets.filter(bet => bet.settledAt).length,
        totalStaked: scoutBets.reduce((sum, bet) => sum + bet.amount, 0),
        totalPayout: scoutBets.reduce((sum, bet) => sum + (bet.payout ?? 0), 0),
        ledgerDelta
      };
    }).sort((left, right) => right.balance - left.balance || left.scoutName.localeCompare(right.scoutName));
  }, [powerCoinBets, powerCoinLedger, scoutAssignmentPlan]);

  const getOpenPowerCoinImpact = React.useCallback((matchKeys: string[]) => {
    const keySet = new Set(matchKeys);
    const openBets = powerCoinBets.filter(bet => !bet.settledAt && keySet.has(bet.matchKey));
    return {
      affectedBetCount: openBets.length,
      openStake: openBets.reduce((sum, bet) => sum + bet.amount, 0)
    };
  }, [powerCoinBets]);

  const handleSettlePowerCoins = React.useCallback((matchKey: string, winner: PowerCoinSettlementWinner) => {
    const impact = getOpenPowerCoinImpact([matchKey]);
    if (impact.affectedBetCount === 0) {
      setPowerCoinStatus(`No open scout reward predictions exist for ${matchKey.toUpperCase()}.`);
      return;
    }
    setPowerCoinSettlementRequest({
      mode: 'single',
      title: 'Settle One Match',
      description: 'This changes the local scout reward ledger. Use it only after the official match result is known.',
      matchSummaries: [{ matchKey, winner }],
      ...impact
    });
  }, [getOpenPowerCoinImpact]);

  const handleSettleAllPlayedPowerCoins = React.useCallback(async () => {
    const openMatchKeys = new Set(powerCoinBets.filter(bet => !bet.settledAt).map(bet => bet.matchKey));
    const playedMatchesWithOpenBets = activePredictorMatches
      .filter(match => openMatchKeys.has(match.key) && isAdminV4PlayedMatch(match))
      .sort((left, right) => left.match_number - right.match_number || left.key.localeCompare(right.key));

    if (playedMatchesWithOpenBets.length === 0) {
      setPowerCoinStatus('No open scout reward predictions have played official match results yet.');
      return;
    }
    const impact = getOpenPowerCoinImpact(playedMatchesWithOpenBets.map(match => match.key));
    setPowerCoinSettlementRequest({
      mode: 'played',
      title: 'Settle Played Matches',
      description: 'This applies official winners to every played match with open local predictions.',
      matchSummaries: playedMatchesWithOpenBets.map(match => ({
        matchKey: match.key,
        winner: getAdminV4PlayedMatchWinner(match),
        label: getAdminV4MatchLabel(match)
      })),
      ...impact
    });
  }, [activePredictorMatches, getOpenPowerCoinImpact, powerCoinBets]);

  const confirmPowerCoinSettlement = React.useCallback(async () => {
    if (!powerCoinSettlementRequest) return;
    const request = powerCoinSettlementRequest;
    setPowerCoinSettlementRequest(null);
    let settledBets = 0;
    for (const match of request.matchSummaries) {
      settledBets += await settlePowerCoinBetsForMatch(eventKey, match.matchKey, match.winner);
    }

    await refreshScoutOpsState();
    const matchCount = request.matchSummaries.length;
    const verb = request.mode === 'played' ? 'Auto-settled' : 'Settled';
    setPowerCoinStatus(`${verb} ${settledBets} scout reward prediction${settledBets === 1 ? '' : 's'} across ${matchCount} match${matchCount === 1 ? '' : 'es'}.`);
    await recordAdminAudit(
      request.mode === 'played' ? 'Auto-settled played scout reward predictions' : 'Settled scout reward predictions',
      `${verb} ${settledBets} local prediction${settledBets === 1 ? '' : 's'} across ${matchCount} match${matchCount === 1 ? '' : 'es'}.`,
      'warning'
    );
  }, [eventKey, powerCoinSettlementRequest, recordAdminAudit, refreshScoutOpsState]);

  const handlePowerCoinAdjustment = React.useCallback(async () => {
    const scoutName = powerCoinAdjustmentScout.trim();
    const delta = Math.trunc(Number(powerCoinAdjustmentAmount));
    if (!scoutName) {
      setPowerCoinStatus('Choose a scout before adding a reward adjustment.');
      return;
    }
    if (!Number.isFinite(delta) || delta === 0) {
      setPowerCoinStatus('Reward adjustment must be a non-zero integer.');
      return;
    }
    if (!powerCoinAdjustmentReason.trim()) {
      setPowerCoinStatus('Reward adjustment needs a reason before it can be applied.');
      return;
    }

    const currentBalance = await getPowerCoinBalance(eventKey, scoutName);
    const nextBalance = currentBalance + delta;
    const confirmed = await requestAdminActionConfirmation({
      title: 'Apply Reward Adjustment',
      message: `Apply scout reward adjustment for ${scoutName}?`,
      detail: `Current balance: ${currentBalance}. Change: ${delta > 0 ? '+' : ''}${delta}. New balance: ${nextBalance}. Reason: ${powerCoinAdjustmentReason.trim()}.`,
      confirmLabel: 'Apply Adjustment',
      tone: 'amber'
    });
    if (!confirmed) return;
    const createdAt = Date.now();
    await upsertPowerCoinLedgerEntry({
      id: `${eventKey}_${scoutName.replace(/\s+/g, '_').toLowerCase()}_${createdAt}`,
      eventKey,
      scoutName,
      delta,
      reason: powerCoinAdjustmentReason.trim() || 'Admin adjustment',
      balanceAfter: nextBalance,
      createdAt
    });
    await refreshScoutOpsState();
    setPowerCoinStatus(`${delta > 0 ? 'Added' : 'Removed'} ${Math.abs(delta)} reward point${Math.abs(delta) === 1 ? '' : 's'} ${delta > 0 ? 'to' : 'from'} ${scoutName}.`);
    await recordAdminAudit(
      'Adjusted scout reward ledger',
      `${delta > 0 ? 'Added' : 'Removed'} ${Math.abs(delta)} local reward point${Math.abs(delta) === 1 ? '' : 's'} ${delta > 0 ? 'to' : 'from'} ${scoutName}. Reason: ${powerCoinAdjustmentReason.trim()}.`,
      'warning'
    );
  }, [
    eventKey,
    powerCoinAdjustmentAmount,
    powerCoinAdjustmentReason,
    powerCoinAdjustmentScout,
    recordAdminAudit,
    refreshScoutOpsState,
    requestAdminActionConfirmation
  ]);

  const handleOptimizeScouts = React.useCallback(async () => {
    const scoutNames = scoutRosterText.split('\n').map(name => name.trim()).filter(Boolean);
    const plan = optimizeScoutAssignments(eventKey, activePredictorMatches, scoutNames, ownTeamNumber);
    const repeatedTeamPairings = Object.values(plan.exposureCounts).reduce(
      (sum, teamCounts) => sum + Object.values(teamCounts).filter(count => count > 1).length,
      0
    );
    setScoutAssignmentPlan(plan);
    await saveScoutAssignmentPlan(plan);
    setScoutControlStatus(`Optimized ${plan.assignments.length} scout assignments across ${plan.scoutNames.length} scouts with ${repeatedTeamPairings} repeated scout-team pairing${repeatedTeamPairings === 1 ? '' : 's'}.`);
  }, [activePredictorMatches, eventKey, ownTeamNumber, scoutRosterText]);

  const handleExportScoutAssignmentsCsv = React.useCallback(() => {
    if (!scoutAssignmentPlan || scoutAssignmentPlan.assignments.length === 0) {
      setScoutControlStatus('Build a scout assignment plan before exporting.');
      return;
    }

    downloadCsvFile(
      `scout_assignments_${eventKey}_${new Date().toISOString().split('T')[0]}.csv`,
      ['eventKey', 'matchType', 'matchNumber', 'matchKey', 'station', 'teamNumber', 'scoutName', 'priorityReason'],
      scoutAssignmentPlan.assignments.map(assignment => [
        scoutAssignmentPlan.eventKey,
        assignment.matchType,
        assignment.matchNumber,
        assignment.matchKey,
        assignment.station,
        assignment.teamNumber,
        assignment.scoutName,
        assignment.priorityReason
      ])
    );
    setScoutControlStatus(`Exported ${scoutAssignmentPlan.assignments.length} scout assignments as CSV.`);
  }, [eventKey, scoutAssignmentPlan]);

  const handleExportScoutCoverageGapsCsv = React.useCallback(() => {
    const gaps = scoutAssignmentPlan?.coverageGaps || [];
    if (!scoutAssignmentPlan || gaps.length === 0) {
      setScoutControlStatus('No scout coverage gaps exist in the current plan.');
      return;
    }

    downloadCsvFile(
      `scout_coverage_gaps_${eventKey}_${new Date().toISOString().split('T')[0]}.csv`,
      ['eventKey', 'matchType', 'matchNumber', 'matchKey', 'station', 'teamNumber', 'reason'],
      gaps.map(gap => [
        scoutAssignmentPlan.eventKey,
        gap.matchType,
        gap.matchNumber,
        gap.matchKey,
        gap.station,
        gap.teamNumber,
        gap.reason
      ])
    );
    setScoutControlStatus(`Exported ${gaps.length} scout coverage gap${gaps.length === 1 ? '' : 's'} as CSV.`);
  }, [eventKey, scoutAssignmentPlan]);

  return {
    confirmPowerCoinSettlement,
    handleExportScoutAssignmentsCsv,
    handleExportScoutCoverageGapsCsv,
    handleOptimizeScouts,
    handlePowerCoinAdjustment,
    handleSettleAllPlayedPowerCoins,
    handleSettlePowerCoins,
    powerCoinAdjustmentAmount,
    powerCoinAdjustmentReason,
    powerCoinAdjustmentScout,
    powerCoinBets,
    powerCoinLedger,
    powerCoinRows,
    powerCoinSettlementRequest,
    powerCoinStatus,
    refreshScoutOpsState,
    scoutAssignmentPlan,
    scoutControlStatus,
    scoutRosterText,
    setPowerCoinAdjustmentAmount,
    setPowerCoinAdjustmentReason,
    setPowerCoinAdjustmentScout,
    setPowerCoinSettlementRequest,
    setPowerCoinStatus,
    setScoutAssignmentPlan,
    setScoutRosterText
  };
}

export default useAdminV4ScoutRewards;
