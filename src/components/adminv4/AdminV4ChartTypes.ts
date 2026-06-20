import { PpaRoleRecommendation, PpaRiskLevel } from '../../utils/ppaInsights';

export interface AdminV4ChartRowBase {
  key: string;
  label: string;
  secondary?: string;
  highlighted?: 'own' | 'searched' | 'both';
}

export interface AdminV4ScalarChartRow extends AdminV4ChartRowBase {
  value: number;
}

export interface AdminV4PpaShapeChartRow extends AdminV4ChartRowBase {
  expected: number;
  floor: number;
  ceiling: number;
  normalLow: number | null;
  normalHigh: number | null;
  role: PpaRoleRecommendation;
  uncertainty: PpaRiskLevel;
  tailRisk: PpaRiskLevel;
  tailRiskLabel: string;
  scoutConfidence: number;
  coverageLabel: string;
}
