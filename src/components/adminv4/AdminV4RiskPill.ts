import { PpaRiskLevel } from '../../utils/ppaInsights';

export const getRiskPillClass = (level: PpaRiskLevel) => {
  if (level === 'Low') return 'border border-emerald-400/30 bg-emerald-500/15 text-emerald-100';
  if (level === 'Medium') return 'border border-amber-400/30 bg-amber-500/15 text-amber-100';
  return 'border border-rose-400/30 bg-rose-500/15 text-rose-100';
};
