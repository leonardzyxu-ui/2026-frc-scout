import type { MatchDefenseScoutingV1, MatchScoutingV3, MatchScoutingV4 } from '../types.ts';
import type { TBAMatch } from './mathEngine.ts';
import { normalizeMatchDefenseScoutingV1 } from './matchDefenseScouting.ts';

export const LOCAL_ADMIN_V4_TEST_MODE_FIXTURE_EVENT_KEY = 'TESTMODE';

export interface LocalAdminV4TestModeFixture {
  eventKey: string;
  matchKey: string;
  ownTeamNumber: string;
  searchedTeamNumber: string;
  matches: TBAMatch[];
  records: MatchScoutingV3[];
  v4Records: MatchScoutingV4[];
  defenseRecords: MatchDefenseScoutingV1[];
  teamNames: Record<string, string>;
}

export const buildLocalAdminV4TestModeFixture = (): LocalAdminV4TestModeFixture => {
  const eventKey = LOCAL_ADMIN_V4_TEST_MODE_FIXTURE_EVENT_KEY;
  const teamNames: Record<string, string> = {
    '103': 'Cybersonics',
    '118': 'Robonauts',
    '254': 'Cheesy Poofs',
    '971': 'Spartan Robotics',
    '1678': 'Citrus Circuits',
    '4414': 'HighTide'
  };
  const allianceRows = [
    { n: 1, red: ['frc103', 'frc254', 'frc118'], blue: ['frc4414', 'frc1678', 'frc971'], rs: 98, bs: 87 },
    { n: 2, red: ['frc4414', 'frc103', 'frc971'], blue: ['frc118', 'frc254', 'frc1678'], rs: 84, bs: 102 },
    { n: 3, red: ['frc103', 'frc1678', 'frc254'], blue: ['frc118', 'frc971', 'frc4414'], rs: 91, bs: 89 },
    { n: 4, red: ['frc254', 'frc971', 'frc4414'], blue: ['frc103', 'frc118', 'frc1678'], rs: 78, bs: 96 },
    { n: 5, red: ['frc1678', 'frc118', 'frc4414'], blue: ['frc254', 'frc103', 'frc971'], rs: -1, bs: -1 }
  ];
  const matches: TBAMatch[] = allianceRows.map(row => ({
    key: `${eventKey.toLowerCase()}_qm${row.n}`,
    event_key: eventKey,
    comp_level: 'qm',
    match_number: row.n,
    set_number: 1,
    time: 1775324800 + row.n * 600,
    predicted_time: 1775324800 + row.n * 600,
    actual_time: row.rs >= 0 && row.bs >= 0 ? 1775324800 + row.n * 600 : null,
    winning_alliance: row.rs < 0 || row.bs < 0 ? '' : row.rs >= row.bs ? 'red' : 'blue',
    alliances: {
      red: { score: row.rs, team_keys: row.red },
      blue: { score: row.bs, team_keys: row.blue }
    },
    score_breakdown: row.rs >= 0 && row.bs >= 0
      ? {
          red: { autoPoints: 18 + row.n, teleopPoints: row.rs - 30, endGamePoints: 12 },
          blue: { autoPoints: 16 + row.n, teleopPoints: row.bs - 28, endGamePoints: 10 }
        }
      : undefined
  }));

  const makeV3Row = (matchNumber: number, teamNumber: string, alliance: MatchScoutingV3['alliance'], points: number): MatchScoutingV3 => ({
    schemaVersion: 'v3',
    eventKey,
    matchType: 'Qualification',
    matchNumber,
    matchKey: `${eventKey.toLowerCase()}_qm${matchNumber}`,
    teamNumber,
    scoutName: 'Fixture Scout',
    assignedScoutName: 'Fixture Scout',
    assignedSlot: `${alliance} ${teamNumber}`,
    alliance,
    timestamp: 1775324800000 + matchNumber * 600000 + Number(teamNumber),
    closeAccuracy: 8,
    middleAccuracy: 7,
    farAccuracy: 6,
    contributionScore: Math.round(points / 3),
    startingPosition: 'Center',
    autoPoints: Math.max(0, Math.round(points * 0.22)),
    autoClimbed: points > 24,
    teleopCycles: Math.max(1, Math.round(points / 8)),
    teleopPoints: Math.max(0, Math.round(points * 0.62)),
    teleopClimbed: points > 28,
    shootingStyle: 'On the Fly',
    climbLevel: points > 34 ? 'L3' : points > 24 ? 'L2' : 'L1',
    trenchPushing: points > 30 ? 'Strong' : 'Limited',
    passing: points > 26 ? 'Strong' : 'Limited',
    driverSkill: Math.min(10, Math.max(1, Math.round(points / 5))),
    teamwork: Math.min(10, Math.max(1, Math.round(points / 6))),
    defenseDescription: points < 24 ? 'Saw pressure in traffic.' : '',
    generalEvaluation: 'Local Test Mode fixture row.',
    totalMatchPoints: points
  });

  const makeV4Row = (matchNumber: number, teamNumber: string, alliance: MatchScoutingV4['alliance'], points: number): MatchScoutingV4 => ({
    schemaVersion: 'v4',
    eventKey,
    matchType: 'Qualification',
    matchNumber,
    matchKey: `${eventKey.toLowerCase()}_qm${matchNumber}`,
    teamNumber,
    scoutName: 'Fixture Scout',
    assignedScoutName: 'Fixture Scout',
    assignedSlot: `${alliance} ${teamNumber}`,
    alliance,
    timestamp: 1775324800000 + matchNumber * 600000 + Number(teamNumber) + 1000,
    autoPoints: Math.max(0, Math.round(points * 0.24)),
    autoCycles: Math.max(0, Math.round(points / 14)),
    teleopPoints: Math.max(0, Math.round(points * 0.58)),
    teleopCycles: Math.max(1, Math.round(points / 7)),
    endgamePoints: points > 32 ? 12 : 6,
    totalMatchPoints: points,
    rolePlayed: points > 30 ? 'Offense' : points > 24 ? 'Mixed' : 'Defense',
    defendedTeamNumber: points < 25 ? '254' : '',
    defenderFacedTeamNumber: points > 32 ? '4414' : '',
    defenseIntensity: points < 25 ? 8 : 3,
    defenseDurationSeconds: points < 25 ? 70 : 18,
    fouls: 0,
    techFouls: 0,
    robotDied: false,
    commsLost: false,
    mechanismBroke: false,
    tippedOver: false,
    failureReason: '',
    reliabilityScore: points > 24 ? 9 : 7,
    notes: 'Local Test Mode fixture row.',
    strategyNotes: 'Used only for local screenshot verification.'
  });

  const makeDefenseRow = (matchNumber: number, teamNumber: string, alliance: MatchDefenseScoutingV1['alliance'], defenseMetric: number) =>
    normalizeMatchDefenseScoutingV1({
      eventKey,
      matchType: 'Qualification',
      matchNumber,
      matchKey: `${eventKey.toLowerCase()}_qm${matchNumber}`,
      teamNumber,
      scoutName: 'Fixture Scout',
      assignedScoutName: 'Fixture Scout',
      assignedSlot: `${alliance} ${teamNumber}`,
      alliance,
      timestamp: 1775324800000 + matchNumber * 600000 + Number(teamNumber) + 2000,
      defenseMetric,
      defenseComments: defenseMetric > 0.6 ? 'Disrupted cycles cleanly.' : '',
      generalComments: 'Local Test Mode fixture row.'
    });

  return {
    eventKey,
    matchKey: `${eventKey.toLowerCase()}_qm3`,
    ownTeamNumber: '103',
    searchedTeamNumber: '103',
    matches,
    records: [
      makeV3Row(1, '103', 'Red', 32),
      makeV3Row(1, '254', 'Red', 38),
      makeV3Row(1, '4414', 'Blue', 29),
      makeV3Row(2, '103', 'Red', 24),
      makeV3Row(2, '118', 'Blue', 35),
      makeV3Row(2, '1678', 'Blue', 37),
      makeV3Row(3, '103', 'Red', 36),
      makeV3Row(3, '971', 'Blue', 30)
    ],
    v4Records: [
      makeV4Row(1, '103', 'Red', 34),
      makeV4Row(1, '254', 'Red', 40),
      makeV4Row(2, '103', 'Red', 25),
      makeV4Row(2, '118', 'Blue', 36),
      makeV4Row(3, '103', 'Red', 37),
      makeV4Row(3, '1678', 'Red', 39)
    ],
    defenseRecords: [
      makeDefenseRow(1, '4414', 'Blue', 0.7),
      makeDefenseRow(2, '103', 'Red', 0.5),
      makeDefenseRow(3, '118', 'Blue', 0.8)
    ],
    teamNames
  };
};
