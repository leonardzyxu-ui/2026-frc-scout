import { useCallback, useMemo, useState } from 'react';
import type { AdminV4SelectedMetric } from '../../utils/adminV4Settings';
import {
  parseAdminV4QuickTeamEntry,
  parseAdminV4TeamNumbers
} from '../../utils/adminV4Format';
import type { UploadedTbaCsvCoprsData } from '../../utils/adminV4TbaCsv';
import type { StatboticsNormalizedTeamEpa } from '../../utils/statbotics';
import {
  summarizePpaAlliance,
  type PpaAllianceSummary,
  type PpaInsight
} from '../../utils/ppaInsights';
import type { AdminV4SimulatorTeamRow } from './AdminV4SimulatorTables';

type TeamAverageMetricRow = {
  avgAutoPoints?: number | null;
  avgTeleopPoints?: number | null;
};

export type AdminV4ManualSimulatorSummary = {
  redScore: number;
  blueScore: number;
  redPpaScore: number;
  bluePpaScore: number;
  redDefenseSwing: number;
  blueDefenseSwing: number;
  redRoleAdjustedScore: number;
  blueRoleAdjustedScore: number;
  redMissing: AdminV4SimulatorTeamRow[];
  blueMissing: AdminV4SimulatorTeamRow[];
  totalTeams: number;
  margin: number;
  ppaMargin: number;
  roleAdjustedMargin: number;
  winner: string | null;
  ppaWinner: string | null;
  roleAdjustedWinner: string | null;
};

export type UseAdminV4ManualSimulatorInput = {
  activeMetricRatings: Record<string, number>;
  selectedMetric: AdminV4SelectedMetric;
  teamAverageLookupByTeam: Record<string, TeamAverageMetricRow>;
  csvOprComponents: UploadedTbaCsvCoprsData['componentPoints'];
  epaByTeam: Record<string, StatboticsNormalizedTeamEpa>;
  teamNameLookup: Record<string, string>;
  ppaRatings: Record<string, number>;
  ppaInsightsByTeam: Record<string, PpaInsight>;
  defenseImpactLookup: Record<string, number>;
};

const pickWinner = (
  redRows: AdminV4SimulatorTeamRow[],
  blueRows: AdminV4SimulatorTeamRow[],
  redScore: number,
  blueScore: number
) => {
  if (redRows.length === 0 || blueRows.length === 0) return null;
  if (redScore === blueScore) return 'Tie';
  return redScore > blueScore ? 'Red' : 'Blue';
};

export default function useAdminV4ManualSimulator({
  activeMetricRatings,
  selectedMetric,
  teamAverageLookupByTeam,
  csvOprComponents,
  epaByTeam,
  teamNameLookup,
  ppaRatings,
  ppaInsightsByTeam,
  defenseImpactLookup
}: UseAdminV4ManualSimulatorInput) {
  const [simulatorQuickEntry, setSimulatorQuickEntry] = useState('');
  const [redSimulatorInput, setRedSimulatorInput] = useState('');
  const [blueSimulatorInput, setBlueSimulatorInput] = useState('');

  const redSimulatorTeams = useMemo(
    () => parseAdminV4TeamNumbers(redSimulatorInput),
    [redSimulatorInput]
  );
  const blueSimulatorTeams = useMemo(
    () => parseAdminV4TeamNumbers(blueSimulatorInput),
    [blueSimulatorInput]
  );

  const buildSimulatorRow = useCallback(
    (teamNumber: string): AdminV4SimulatorTeamRow => {
      const teamAverage = teamAverageLookupByTeam[teamNumber];
      const epaMetrics = epaByTeam[teamNumber];
      const oprComponents = csvOprComponents[teamNumber];
      const rating = activeMetricRatings[teamNumber] ?? 0;
      const defenseImpact = defenseImpactLookup[teamNumber] ?? null;
      const ppaInsight = ppaInsightsByTeam[teamNumber] || null;
      const recommendedRole = ppaInsight?.role.label || ((defenseImpact ?? 0) > rating ? 'Defender' : 'Primary Scorer');

      return {
        teamNumber,
        teamName: teamNameLookup[teamNumber] || '',
        rating,
        ppaRating: ppaInsight?.rating ?? ppaRatings[teamNumber] ?? null,
        ppaInsight,
        defenseImpact: ppaInsight?.components.defenseImpact ?? defenseImpact,
        recommendedRole,
        auto:
          selectedMetric === 'ppc'
            ? teamAverage?.avgAutoPoints ?? null
            : selectedMetric === 'opr'
              ? oprComponents?.autoPoints ?? null
              : selectedMetric === 'epa'
                ? epaMetrics?.autoEPA ?? null
                : null,
        teleop:
          selectedMetric === 'ppc'
            ? teamAverage?.avgTeleopPoints ?? null
            : selectedMetric === 'opr'
              ? oprComponents?.teleopPoints ?? null
              : selectedMetric === 'epa'
                ? epaMetrics?.teleopEPA ?? null
                : null
      };
    },
    [
      activeMetricRatings,
      csvOprComponents,
      defenseImpactLookup,
      epaByTeam,
      ppaInsightsByTeam,
      ppaRatings,
      selectedMetric,
      teamAverageLookupByTeam,
      teamNameLookup
    ]
  );

  const redSimulatorRows = useMemo(
    () => redSimulatorTeams.map(teamNumber => buildSimulatorRow(teamNumber)),
    [buildSimulatorRow, redSimulatorTeams]
  );
  const blueSimulatorRows = useMemo(
    () => blueSimulatorTeams.map(teamNumber => buildSimulatorRow(teamNumber)),
    [blueSimulatorTeams, buildSimulatorRow]
  );

  const redSimulatorPpaSummary: PpaAllianceSummary = useMemo(
    () => summarizePpaAlliance(redSimulatorTeams, ppaInsightsByTeam),
    [ppaInsightsByTeam, redSimulatorTeams]
  );
  const blueSimulatorPpaSummary: PpaAllianceSummary = useMemo(
    () => summarizePpaAlliance(blueSimulatorTeams, ppaInsightsByTeam),
    [blueSimulatorTeams, ppaInsightsByTeam]
  );

  const simulatorSummary: AdminV4ManualSimulatorSummary = useMemo(() => {
    const redScore = redSimulatorRows.reduce((sum, row) => sum + row.rating, 0);
    const blueScore = blueSimulatorRows.reduce((sum, row) => sum + row.rating, 0);
    const redPpaScore = redSimulatorPpaSummary.expected;
    const bluePpaScore = blueSimulatorPpaSummary.expected;
    const redDefenseSwing = redSimulatorRows.reduce((sum, row) => sum + (row.recommendedRole === 'Defender' ? row.defenseImpact ?? 0 : 0), 0);
    const blueDefenseSwing = blueSimulatorRows.reduce((sum, row) => sum + (row.recommendedRole === 'Defender' ? row.defenseImpact ?? 0 : 0), 0);
    const redRoleOffense = redSimulatorRows.reduce((sum, row) => sum + (row.recommendedRole !== 'Defender' ? row.rating : 0), 0);
    const blueRoleOffense = blueSimulatorRows.reduce((sum, row) => sum + (row.recommendedRole !== 'Defender' ? row.rating : 0), 0);
    const redRoleAdjustedScore = Math.max(0, redRoleOffense - blueDefenseSwing);
    const blueRoleAdjustedScore = Math.max(0, blueRoleOffense - redDefenseSwing);
    const redMissing = redSimulatorRows.filter(row => !(row.teamNumber in activeMetricRatings));
    const blueMissing = blueSimulatorRows.filter(row => !(row.teamNumber in activeMetricRatings));
    const totalTeams = redSimulatorRows.length + blueSimulatorRows.length;

    return {
      redScore,
      blueScore,
      redPpaScore,
      bluePpaScore,
      redDefenseSwing,
      blueDefenseSwing,
      redRoleAdjustedScore,
      blueRoleAdjustedScore,
      redMissing,
      blueMissing,
      totalTeams,
      margin: Math.abs(redScore - blueScore),
      ppaMargin: Math.abs(redPpaScore - bluePpaScore),
      roleAdjustedMargin: Math.abs(redRoleAdjustedScore - blueRoleAdjustedScore),
      winner: pickWinner(redSimulatorRows, blueSimulatorRows, redScore, blueScore),
      ppaWinner: pickWinner(redSimulatorRows, blueSimulatorRows, redPpaScore, bluePpaScore),
      roleAdjustedWinner: pickWinner(redSimulatorRows, blueSimulatorRows, redRoleAdjustedScore, blueRoleAdjustedScore)
    };
  }, [
    activeMetricRatings,
    blueSimulatorPpaSummary.expected,
    blueSimulatorRows,
    redSimulatorPpaSummary.expected,
    redSimulatorRows
  ]);

  const applyQuickSimulatorEntry = useCallback(() => {
    const { redTeams, blueTeams } = parseAdminV4QuickTeamEntry(simulatorQuickEntry);
    setRedSimulatorInput(redTeams.join(', '));
    setBlueSimulatorInput(blueTeams.join(', '));
  }, [simulatorQuickEntry]);

  return {
    simulatorQuickEntry,
    redSimulatorInput,
    blueSimulatorInput,
    redSimulatorRows,
    blueSimulatorRows,
    redSimulatorPpaSummary,
    blueSimulatorPpaSummary,
    simulatorSummary,
    setSimulatorQuickEntry,
    setRedSimulatorInput,
    setBlueSimulatorInput,
    applyQuickSimulatorEntry
  };
}
