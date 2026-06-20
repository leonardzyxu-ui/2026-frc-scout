import {
  buildPlayoffProjection,
  ProjectedQualificationTeamRow
} from './matchPredictor';
import {
  formatAdminV4PpaRange as formatPpaRange,
  formatAdminV4SignedMetric as formatSignedMetric,
  formatAdminV4WorksheetDate as formatWorksheetDate
} from './adminV4Format';
import { getAdminV4PlayoffStatusLabel as getPlayoffStatusLabel } from './adminV4MatchUtils';
import { PpaInsight, summarizePpaAlliance } from './ppaInsights';

export type AdminV4WorkbookColumn = {
  header: string;
  key: string;
  width?: number;
};

type AdminV4QualPredictionWorkbookRow = {
  key: string;
  title: string;
  scheduledTime: number | null;
  red: { teams: string[]; predictedScore: number };
  blue: { teams: string[]; predictedScore: number };
  predictedWinner: 'Red' | 'Blue' | 'Tie';
  predictionLowConfidence: boolean;
};

const styleWorkbookHeader = (worksheet: any, columnCount: number) => {
  worksheet.views = [{ state: 'frozen', ySplit: 1 }];
  worksheet.autoFilter = {
    from: 'A1',
    to: worksheet.getRow(1).getCell(columnCount).address
  };
  worksheet.getRow(1).font = { bold: true, color: { argb: 'FFF8FAFC' } };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0F172A' }
  };
  worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
};

const styleWorkbookGrid = (worksheet: any) => {
  worksheet.eachRow((row: any, rowNumber: number) => {
    row.eachCell((cell: any) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF334155' } },
        left: { style: 'thin', color: { argb: 'FF334155' } },
        bottom: { style: 'thin', color: { argb: 'FF334155' } },
        right: { style: 'thin', color: { argb: 'FF334155' } }
      };

      if (rowNumber > 1) {
        cell.alignment = { vertical: 'top', wrapText: true };
      }
    });
  });
};

export const addWorkbookSheet = (
  workbook: any,
  title: string,
  columns: AdminV4WorkbookColumn[],
  rows: Array<Record<string, unknown>>
) => {
  const worksheet = workbook.addWorksheet(title);
  worksheet.columns = columns.map(column => ({
    ...column,
    width: column.width ?? Math.min(Math.max(column.header.length + 2, 12), 36)
  }));

  rows.forEach(row => worksheet.addRow(row));
  styleWorkbookHeader(worksheet, columns.length);
  styleWorkbookGrid(worksheet);
  return worksheet;
};

export const addQualificationProjectionSheet = (
  workbook: any,
  title: string,
  rows: ProjectedQualificationTeamRow[],
  teamNameLookup: Record<string, string>
) =>
  addWorkbookSheet(
    workbook,
    title,
    [
      { header: 'Projected Rank', key: 'projectedRank', width: 14 },
      { header: 'Team', key: 'teamNumber', width: 10 },
      { header: 'Team Name', key: 'teamName', width: 24 },
      { header: 'Current TBA Rank', key: 'currentTbaRank', width: 14 },
      { header: 'Projected Total RP', key: 'projectedTotalRp', width: 16 },
      { header: 'Wins', key: 'wins', width: 10 },
      { header: 'Losses', key: 'losses', width: 10 },
      { header: 'Ties', key: 'ties', width: 10 },
      { header: 'Win RP', key: 'projectedWinRp', width: 12 },
      { header: 'Tower RP', key: 'projectedTowerRp', width: 12 },
      { header: 'Energized RP', key: 'projectedEnergizedRp', width: 14 },
      { header: 'Supercharged RP', key: 'projectedSuperchargedRp', width: 16 }
    ],
    rows.map(row => ({
      ...row,
      teamName: teamNameLookup[row.teamNumber] || '',
      currentTbaRank: row.currentTbaRank ?? ''
    }))
  );

export const addQualPredictionSheet = (
  workbook: any,
  title: string,
  rows: AdminV4QualPredictionWorkbookRow[],
  ppaInsightsByTeam?: Record<string, PpaInsight>
) => {
  const includePpaShape = Boolean(ppaInsightsByTeam);
  const ppaShapeColumns = includePpaShape
    ? [
        { header: 'Red Range Floor / Exp / Ceiling', key: 'redPpaRange', width: 28 },
        { header: 'Blue Range Floor / Exp / Ceiling', key: 'bluePpaRange', width: 28 },
        { header: 'Range Expected Edge', key: 'ppaExpectedEdge', width: 20 },
        { header: 'Range Floor Lock', key: 'ppaFloorLock', width: 18 },
        { header: 'Range Trust Read', key: 'ppaTrustRead', width: 18 },
        { header: 'Red Range Risk Notes', key: 'redPpaRiskNotes', width: 36 },
        { header: 'Blue Range Risk Notes', key: 'bluePpaRiskNotes', width: 36 }
      ]
    : [];

  return addWorkbookSheet(
    workbook,
    title,
    [
      { header: 'Match', key: 'title', width: 14 },
      { header: 'Match Key', key: 'key', width: 18 },
      { header: 'Scheduled', key: 'scheduledTime', width: 24 },
      { header: 'Red Teams', key: 'redTeams', width: 22 },
      { header: 'Red Score', key: 'redScore', width: 12 },
      { header: 'Blue Teams', key: 'blueTeams', width: 22 },
      { header: 'Blue Score', key: 'blueScore', width: 12 },
      { header: 'Predicted Winner', key: 'predictedWinner', width: 16 },
      { header: 'Confidence', key: 'confidence', width: 12 },
      ...ppaShapeColumns
    ],
    rows.map(row => {
      const redPpaSummary = ppaInsightsByTeam ? summarizePpaAlliance(row.red.teams, ppaInsightsByTeam) : null;
      const bluePpaSummary = ppaInsightsByTeam ? summarizePpaAlliance(row.blue.teams, ppaInsightsByTeam) : null;
      const ppaExpectedEdge = redPpaSummary && bluePpaSummary ? redPpaSummary.expected - bluePpaSummary.expected : null;
      const ppaLeader = ppaExpectedEdge == null || ppaExpectedEdge === 0 ? 'Even' : ppaExpectedEdge > 0 ? 'Red' : 'Blue';
      const ppaFloorLock = redPpaSummary && bluePpaSummary
        ? ppaExpectedEdge != null && ppaExpectedEdge >= 0
          ? redPpaSummary.floor - bluePpaSummary.ceiling
          : bluePpaSummary.floor - redPpaSummary.ceiling
        : null;
      const ppaTrustRead = redPpaSummary && bluePpaSummary
        ? ppaFloorLock != null && ppaFloorLock > 0
          ? 'Strong edge'
          : redPpaSummary.riskNotes.length > 0 || bluePpaSummary.riskNotes.length > 0 || redPpaSummary.confidenceLabel !== 'Trust for plan' || bluePpaSummary.confidenceLabel !== 'Trust for plan'
            ? 'Scout check'
            : 'Range call'
        : '';
      return {
        title: row.title,
        key: row.key,
        scheduledTime: formatWorksheetDate(row.scheduledTime),
        redTeams: row.red.teams.join(', '),
        redScore: row.red.predictedScore,
        blueTeams: row.blue.teams.join(', '),
        blueScore: row.blue.predictedScore,
        predictedWinner: row.predictedWinner,
        confidence: row.predictionLowConfidence ? 'Low' : 'Standard',
        redPpaRange: redPpaSummary ? formatPpaRange(redPpaSummary) : '',
        bluePpaRange: bluePpaSummary ? formatPpaRange(bluePpaSummary) : '',
        ppaExpectedEdge: ppaExpectedEdge == null ? '' : ppaLeader === 'Even' ? 'Even' : `${ppaLeader} ${formatSignedMetric(Math.abs(ppaExpectedEdge), 1)}`,
        ppaFloorLock: ppaFloorLock == null ? '' : formatSignedMetric(ppaFloorLock, 1),
        ppaTrustRead,
        redPpaRiskNotes: redPpaSummary?.riskNotes.join(' | ') || '',
        bluePpaRiskNotes: bluePpaSummary?.riskNotes.join(' | ') || ''
      };
    })
  );
};

export const addFinalsProjectionSheet = (
  workbook: any,
  title: string,
  projection: ReturnType<typeof buildPlayoffProjection>
) => {
  if (!projection.supported || projection.rounds.length === 0) {
    return addWorkbookSheet(
      workbook,
      title,
      [
        { header: 'Status', key: 'status', width: 18 },
        { header: 'Message', key: 'message', width: 60 }
      ],
      [
        {
          status: 'Unavailable',
          message: projection.reason || 'Finals projection is not available for this event yet.'
        }
      ]
    );
  }

  return addWorkbookSheet(
    workbook,
    title,
    [
      { header: 'Round', key: 'roundTitle', width: 28 },
      { header: 'Match', key: 'title', width: 16 },
      { header: 'Match Key', key: 'matchKey', width: 18 },
      { header: 'Status', key: 'status', width: 14 },
      { header: 'Scheduled', key: 'scheduledTime', width: 24 },
      { header: 'Red Label', key: 'redLabel', width: 18 },
      { header: 'Red Teams', key: 'redTeams', width: 26 },
      { header: 'Red Score', key: 'redScore', width: 12 },
      { header: 'Blue Label', key: 'blueLabel', width: 18 },
      { header: 'Blue Teams', key: 'blueTeams', width: 26 },
      { header: 'Blue Score', key: 'blueScore', width: 12 },
      { header: 'Predicted Winner', key: 'predictedWinnerLabel', width: 18 },
      { header: 'Confidence', key: 'confidence', width: 12 }
    ],
    projection.rounds.flatMap(round =>
      round.matches.map(match => ({
        roundTitle: round.title,
        title: match.title,
        matchKey: match.matchKey,
        status: getPlayoffStatusLabel(match.status),
        scheduledTime: formatWorksheetDate(match.scheduledTime),
        redLabel: match.red.label,
        redTeams: match.red.teamKeys.join(', '),
        redScore: match.red.score ?? '',
        blueLabel: match.blue.label,
        blueTeams: match.blue.teamKeys.join(', '),
        blueScore: match.blue.score ?? '',
        predictedWinnerLabel: match.predictedWinnerLabel,
        confidence: match.confidence ?? ''
      }))
    )
  );
};
