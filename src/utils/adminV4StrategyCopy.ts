import type { StrategyMatchPlan } from '../types.ts';

export const formatStrategyWinConditionForAlliance = (
  plan: StrategyMatchPlan | null,
  alliance?: 'Red' | 'Blue' | '',
  options: { ownPerspective?: boolean } = {}
) => {
  if (!plan) return '';
  const selectedAlliance =
    alliance === 'Red' || alliance === 'Blue'
      ? alliance
      : plan.predictedWinner === 'Red' || plan.predictedWinner === 'Blue'
        ? plan.predictedWinner
        : '';
  if (!selectedAlliance) return 'Win condition: prevent penalties and chase bonus RP.';
  const bestRoleOption = (selectedAlliance === 'Red' ? plan.redRoleOptions : plan.blueRoleOptions)[0] || null;
  const allianceLabel = options.ownPerspective ? `Our ${selectedAlliance.toLowerCase()} alliance` : `${selectedAlliance} alliance`;
  return `${allianceLabel} win condition: ${bestRoleOption?.rationale || 'protect scoring floor, avoid foul leakage, and only send defense when the modeled net swing stays positive.'}`;
};
