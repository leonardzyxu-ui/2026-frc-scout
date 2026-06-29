import assert from 'node:assert/strict';
import { optimizeScoutAssignments } from '../../src/utils/strategyBrain.ts';
import type { ScoutAssignmentPlan } from '../../src/types.ts';
import type { TBAMatch } from '../../src/utils/mathEngine.ts';

const SHANGHAI_2026_QUALS_CSV = `
qualification,1,1,4613,8155,8019,5889,8815,5453,39,49,0,0
qualification,1,2,6385,8014,9192,10251,5451,10566,0,7,0,0
qualification,1,3,5419,8802,8214,8818,10450,8329,76,24,0,0
qualification,1,4,9616,5446,6766,6907,9165,9194,5,21,0,0
qualification,1,5,9122,5864,10571,5849,3166,11783,20,30,0,0
qualification,1,6,8483,10679,10675,5794,11771,6328,20,29,0,0
qualification,1,7,10564,10253,10569,5805,10669,7037,29,26,0,0
qualification,1,8,8836,6705,11785,9830,11525,10420,15,57,0,0
qualification,1,9,5805,8818,5849,6766,9165,4613,55,7,0,0
qualification,1,10,9830,11783,5446,9122,10569,5864,58,49,0,0
qualification,1,11,8483,8155,10251,10253,9194,6328,34,34,0,0
qualification,1,12,10571,11771,8815,10679,3166,5419,4,36,0,0
qualification,1,13,6907,10566,10450,8019,10564,5451,43,37,0,0
qualification,1,14,11525,8802,11785,5453,9192,5794,17,31,0,0
qualification,1,15,10253,6705,9616,10420,8836,8329,67,17,0,0
qualification,1,16,5446,5451,8815,9122,10669,8802,11,27,0,0
qualification,1,17,10566,9830,8014,5849,10450,8155,59,37,0,0
qualification,1,18,9192,10675,11783,6705,5805,5794,28,35,0,0
qualification,1,19,5419,9165,8329,10564,5864,5889,57,62,0,0
qualification,1,20,10420,5453,6907,11771,10679,6766,47,57,0,0
qualification,1,21,4613,3166,8483,11525,11785,10571,29,24,0,0
qualification,1,22,9194,10251,8818,7037,5515,10253,33,54,0,0
qualification,1,23,11783,8155,9165,6907,8815,10564,38,53,0,0
qualification,1,24,11525,7037,10675,5446,5889,6705,69,38,0,0
qualification,1,25,3166,5794,8818,10669,5515,8483,73,38,0,0
qualification,1,26,9830,4613,10566,8214,9616,5419,48,62,0,0
qualification,1,27,6328,10420,5453,10253,5849,10251,11,79,0,0
qualification,1,28,8802,9192,5805,9122,6766,10450,49,54,0,0
qualification,1,29,10679,5864,8329,11771,8019,8014,42,58,0,0
qualification,1,30,10569,10571,11785,5451,10564,9194,18,45,0,0
qualification,1,31,6705,8815,10450,5794,9616,9122,60,30,0,0
qualification,1,32,4613,5453,8836,8155,11771,9192,23,41,0,0
qualification,1,33,6766,8483,5515,3166,9830,8019,53,73,0,0
qualification,1,34,11783,5805,6907,10571,10420,7037,36,30,0,0
qualification,1,35,10669,8014,8214,8818,10569,5446,80,69,0,0
qualification,1,36,10251,5864,5451,5889,10566,8802,54,60,0,0
qualification,1,37,11785,9165,10253,5419,10675,6328,51,29,0,0
qualification,1,38,9194,8818,5794,8019,6705,11771,24,39,0,0
qualification,1,39,10420,8014,8155,10564,10669,6766,63,46,0,0
qualification,1,40,10675,10569,8802,9830,10571,9616,7,25,0,0
qualification,1,41,5515,5864,5419,11783,8214,8836,72,40,0,0
qualification,1,42,10251,4613,6328,5446,11525,9165,3,60,0,0
qualification,1,43,9122,10450,5453,11785,10253,6907,46,51,0,0
qualification,1,44,8483,8329,9192,10679,8815,5889,35,43,0,0
qualification,1,45,8802,7037,9830,10566,10675,4613,27,45,0,0
qualification,1,46,11771,8214,5515,6705,5451,6328,11,63,0,0
qualification,1,47,10669,10564,5453,5446,5849,5794,47,57,0,0
qualification,1,48,9122,10251,9194,8818,11525,5889,34,45,0,0
qualification,1,49,6907,10569,10679,11785,10571,8155,29,55,0,0
qualification,1,50,10253,3166,10450,9165,8014,5419,25,65,0,0
qualification,1,51,5849,5515,8815,6766,5864,9192,63,48,0,0
qualification,1,52,10420,11783,9616,5805,8483,8019,57,59,0,0
qualification,1,53,8214,5419,10675,6907,10566,10253,47,64,0,0
qualification,1,54,5794,10679,5451,5446,11785,8155,11,46,0,0
qualification,1,55,9122,5515,8836,10564,8818,4613,19,42,0,0
qualification,1,56,11525,3166,6766,8329,10571,10251,62,37,0,0
qualification,1,57,8815,7037,10569,8014,6705,10420,29,72,0,0
qualification,1,58,11783,10669,5453,8483,9616,5889,35,44,0,0
qualification,1,59,5864,6328,8815,9122,5805,9165,38,22,0,0
`.trim();

const SCOUT_ROSTER_INPUT = ['1, Scout One', '2, Scout Two', '3, Scout Three', '4, Scout Four', '5, Scout Five', '6, Scout Six'];
const SCOUT_NAMES = ['Scout One', 'Scout Two', 'Scout Three', 'Scout Four', 'Scout Five', 'Scout Six'];
const OWN_TEAM_NUMBER = '5515';

const toMatch = (line: string): TBAMatch => {
  const [
    compLevel,
    setNumber,
    matchNumber,
    red1,
    red2,
    red3,
    blue1,
    blue2,
    blue3,
    redScore,
    blueScore
  ] = line.split(',');
  assert.equal(compLevel, 'qualification');
  const number = Number(matchNumber);
  return {
    key: `2026cnsh_qm${number}`,
    event_key: '2026cnsh',
    comp_level: 'qm',
    match_number: number,
    set_number: Number(setNumber),
    time: null,
    predicted_time: null,
    actual_time: null,
    winning_alliance: '',
    alliances: {
      red: { score: Number(redScore), team_keys: [red1, red2, red3].map(team => `frc${team}`) },
      blue: { score: Number(blueScore), team_keys: [blue1, blue2, blue3].map(team => `frc${team}`) }
    }
  };
};

const buildShanghaiMatches = () =>
  SHANGHAI_2026_QUALS_CSV
    .split('\n')
    .map(line => toMatch(line.trim()))
    .sort((left, right) => left.match_number - right.match_number);

const countContinuityPairs = (exposureCounts: ScoutAssignmentPlan['exposureCounts']) =>
  Object.values(exposureCounts)
    .flatMap(teamMap => Object.values(teamMap))
    .reduce((sum, count) => sum + count * Math.max(0, count - 1) / 2, 0);

const countRepeatedScoutTeamPairs = (exposureCounts: ScoutAssignmentPlan['exposureCounts']) =>
  Object.values(exposureCounts)
    .flatMap(teamMap => Object.values(teamMap))
    .filter(count => count > 1).length;

const getLoads = (plan: ScoutAssignmentPlan) => {
  const loads = Object.fromEntries(plan.scoutNames.map(scout => [scout, 0]));
  plan.assignments.forEach(assignment => {
    loads[assignment.scoutName] = (loads[assignment.scoutName] || 0) + 1;
  });
  return loads;
};

const buildStationRotationExposureCounts = (matches: TBAMatch[]) => {
  const exposureCounts: ScoutAssignmentPlan['exposureCounts'] = Object.fromEntries(SCOUT_NAMES.map(scout => [scout, {}]));
  matches.forEach(match => {
    [...match.alliances.red.team_keys, ...match.alliances.blue.team_keys]
      .map(team => team.replace(/^frc/i, ''))
      .forEach((teamNumber, index) => {
        const scout = SCOUT_NAMES[index]!;
        exposureCounts[scout]![teamNumber] = (exposureCounts[scout]![teamNumber] || 0) + 1;
      });
  });
  return exposureCounts;
};

const matches = buildShanghaiMatches();
const plan = optimizeScoutAssignments('2026cnsh', matches, SCOUT_ROSTER_INPUT, OWN_TEAM_NUMBER);
const loads = getLoads(plan);
const loadValues = Object.values(loads);
const stationRotationExposureCounts = buildStationRotationExposureCounts(matches);
const stationRotationContinuityPairs = countContinuityPairs(stationRotationExposureCounts);
const optimizedContinuityPairs = countContinuityPairs(plan.exposureCounts);
const optimizedRepeatedPairs = countRepeatedScoutTeamPairs(plan.exposureCounts);
const assignmentsByMatch = new Map<string, typeof plan.assignments>();
const teamNumbers = Array.from(new Set(matches.flatMap(match => [
  ...match.alliances.red.team_keys,
  ...match.alliances.blue.team_keys
].map(team => team.replace(/^frc/i, '')))));
const teamAppearanceCounts = new Map<string, number>();
matches.flatMap(match => [
  ...match.alliances.red.team_keys,
  ...match.alliances.blue.team_keys
].map(team => team.replace(/^frc/i, ''))).forEach(teamNumber => {
  teamAppearanceCounts.set(teamNumber, (teamAppearanceCounts.get(teamNumber) || 0) + 1);
});
const repeatableTeamNumbers = teamNumbers.filter(teamNumber => (teamAppearanceCounts.get(teamNumber) || 0) > 1);
const teamsWithoutRepeatOwner = repeatableTeamNumbers.filter(teamNumber =>
  !Object.values(plan.exposureCounts).some(teamMap => (teamMap[teamNumber] || 0) > 1)
);

plan.assignments.forEach(assignment => {
  const rows = assignmentsByMatch.get(assignment.matchKey) || [];
  rows.push(assignment);
  assignmentsByMatch.set(assignment.matchKey, rows);
});

assert.equal(matches.length, 59);
assert.equal(plan.assignments.length, matches.length * 6);
assert.equal(plan.coverageGaps?.length ?? 0, 0);
assert.equal(Math.max(...loadValues) - Math.min(...loadValues), 0);
assert.equal(plan.assignments.filter(assignment => assignment.teamNumber === OWN_TEAM_NUMBER).length, 7);

matches.forEach(match => {
  const rows = assignmentsByMatch.get(match.key) || [];
  assert.equal(rows.length, 6, `${match.key} should have six covered stations`);
  assert.equal(new Set(rows.map(row => row.station)).size, 6, `${match.key} should cover six unique stations`);
  assert.equal(new Set(rows.map(row => row.scoutName)).size, 6, `${match.key} should not assign one scout twice`);
});

const maxSameTeamAssignments = Math.max(
  ...Object.values(plan.exposureCounts).flatMap(teamMap => Object.values(teamMap))
);

const summary = {
  eventKey: '2026cnsh',
  matches: matches.length,
  assignments: plan.assignments.length,
  loads,
  stationRotationContinuityPairs,
  optimizedContinuityPairs,
  optimizedRepeatedPairs,
  uniqueTeams: teamNumbers.length,
  repeatableTeams: repeatableTeamNumbers.length,
  teamsWithoutRepeatOwner: teamsWithoutRepeatOwner.length,
  maxSameTeamAssignments,
  ownTeamAssignments: plan.assignments.filter(assignment => assignment.teamNumber === OWN_TEAM_NUMBER).length
};

console.log(JSON.stringify(summary));

assert.ok(
  optimizedContinuityPairs >= stationRotationContinuityPairs * 4,
  `expected continuity ${optimizedContinuityPairs} to beat station baseline ${stationRotationContinuityPairs}`
);
assert.ok(optimizedRepeatedPairs >= repeatableTeamNumbers.length, `expected at least one repeated owner per repeatable event team on average, saw ${optimizedRepeatedPairs}`);
assert.deepEqual(teamsWithoutRepeatOwner, []);

assert.ok(maxSameTeamAssignments >= 7, `expected at least one scout to stay with a team for seven matches, saw ${maxSameTeamAssignments}`);
