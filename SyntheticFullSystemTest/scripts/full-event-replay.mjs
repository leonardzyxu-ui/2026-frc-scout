#!/usr/bin/env node
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);

const getArg = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
};

const hasFlag = name => args.includes(name);

const manifestPath = getArg('--manifest', 'SyntheticFullSystemTest/manifests/full-local-event.json');
const manifest = JSON.parse(readFileSync(path.resolve(manifestPath), 'utf8'));
const seed = manifest.simulation.seed;
const runStamp = new Date().toISOString().replace(/[-:.]/g, '').replace('T', '-').slice(0, 15);
const runId = `sft-full-${manifest.fixture.eventKey}-${runStamp}-${seed}`;
const defaultOutput = path.join(manifest.artifacts.root, runId);
const outputDir = path.resolve(getArg('--output', defaultOutput));
const force = hasFlag('--force');

if (existsSync(outputDir) && readdirSync(outputDir).length > 0 && !force) {
  throw new Error(`Output directory already contains files: ${outputDir}. Pass --force or choose a new --output.`);
}
mkdirSync(outputDir, { recursive: true });

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const seededRandom = initialSeed => {
  let state = initialSeed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
};

const random = seededRandom(seed);

const sampleNormal = (mean, sd) => {
  const left = Math.max(random(), 1e-9);
  const right = Math.max(random(), 1e-9);
  return mean + sd * Math.sqrt(-2 * Math.log(left)) * Math.cos(2 * Math.PI * right);
};

const shuffle = values => {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
};

const mean = values => (values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length);
const round = (value, digits = 3) => Number(value.toFixed(digits));

const fixture = manifest.fixture;
const teamCount = fixture.teamCount ?? 24;
const qualificationMatches = fixture.qualificationMatches ?? 72;
const playoffMatches = fixture.playoffMatches ?? 13;
const totalMatches = qualificationMatches + playoffMatches;
const excludedTeams = new Set(fixture.excludedTeamKeys ?? []);

const makeTeamKeys = () => {
  const keys = [];
  let number = 8101;
  while (keys.length < teamCount) {
    const teamKey = `frc${number}`;
    if (!excludedTeams.has(teamKey)) keys.push(teamKey);
    number += 1;
  }
  return keys;
};

const teamKeys = makeTeamKeys();
const ownTeamIndex = Math.floor(seededRandom(fixture.pretendOwnTeamPolicy.seed)() * teamKeys.length);
const pretendOwnTeam = fixture.pretendOwnTeamPolicy.teamKey ?? teamKeys[ownTeamIndex];

const profiles = new Map(
  teamKeys.map((teamKey, index) => {
    const offense = clamp(sampleNormal(76, 19), 35, 130);
    const auto = clamp(offense * sampleNormal(0.24, 0.04), 7, 42);
    const teleop = clamp(offense * sampleNormal(0.62, 0.08), 20, 95);
    const endgame = clamp(offense * sampleNormal(0.14, 0.05), 2, 35);
    const defense = clamp(sampleNormal(22, 12), 0, 62);
    const reliability = clamp(sampleNormal(0.88, 0.07), 0.62, 0.99);
    const foulRisk = clamp(sampleNormal(5.8, 2.6), 0.5, 15);
    const publicPriorPower = clamp(offense + defense * 0.18 - foulRisk * 0.7 + sampleNormal(0, 8), 25, 145);
    const claimInflation = clamp(sampleNormal(1.1, 0.12), 0.92, 1.42);

    return [
      teamKey,
      {
        teamKey,
        nickname: `Synthetic ${index + 1}`,
        offense,
        auto,
        teleop,
        endgame,
        defense,
        reliability,
        foulRisk,
        publicPriorPower,
        claimedContribution: clamp(offense * claimInflation, 25, 165),
        truePower: offense + auto * 0.18 + endgame * 0.35 + defense * 0.16 - foulRisk * 0.8
      }
    ];
  })
);

const stationNames = ['red1', 'red2', 'red3', 'blue1', 'blue2', 'blue3'];
const checkpoints = [];
const preScoutRecords = [];
const pitScoutRecords = [];
const matchScoutRows = [];
const officialResults = [];
const predictionEntries = [];
const noFutureChecks = [];
const teamStats = new Map(teamKeys.map(teamKey => [teamKey, { wins: 0, losses: 0, ties: 0, matches: 0, scoreFor: 0, scoreAgainst: 0 }]));
const onlineRatings = new Map(teamKeys.map(teamKey => [teamKey, profiles.get(teamKey).publicPriorPower]));

const addCheckpoint = checkpoint => checkpoints.push({ index: checkpoints.length, ...checkpoint });

const createPreScout = () => {
  teamKeys.forEach(teamKey => {
    const profile = profiles.get(teamKey);
    preScoutRecords.push({
      id: `pre:${fixture.eventKey}:${teamKey}`,
      lane: 'preScout',
      eventKey: fixture.eventKey,
      teamKey,
      availableAt: 'T_MINUS_7_DAYS',
      trustClass: 'public-prior',
      confidence: round(clamp(0.58 + random() * 0.28, 0, 1)),
      simulatedBy: 'synthetic-pre-scout',
      noFutureAfterMatchIndex: -1,
      fields: {
        publicPriorPower: round(profile.publicPriorPower),
        rolePrior: profile.defense > profile.offense * 0.45 ? 'hybrid-defender' : 'scorer',
        watchQuestion: profile.reliability < 0.78 ? 'Verify reliability under defense.' : 'Verify scoring pace.'
      }
    });
  });
};

const createPitScout = () => {
  teamKeys.forEach(teamKey => {
    const profile = profiles.get(teamKey);
    pitScoutRecords.push({
      id: `pit:${fixture.eventKey}:${teamKey}`,
      lane: 'pitScout',
      eventKey: fixture.eventKey,
      teamKey,
      availableAt: 'PIT_SCOUT_WINDOW',
      trustClass: 'objective-observed',
      confidence: round(clamp(0.72 + random() * 0.22, 0, 1)),
      simulatedBy: 'synthetic-pit-scout',
      noFutureAfterMatchIndex: -1,
      fields: {
        drivetrain: random() > 0.18 ? 'swerve' : 'tank',
        mechanismCount: Math.round(clamp(sampleNormal(3.2, 0.8), 1, 5)),
        visibleEndgame: profile.endgame > 12,
        claimedContribution: round(profile.claimedContribution),
        claimTrust: profile.claimedContribution > profile.offense * 1.22 ? 'discount' : 'normal'
      }
    });
  });
};

const chooseQualificationTeams = matchNumber => {
  const rotated = shuffle(teamKeys);
  const start = (matchNumber * 5) % rotated.length;
  const picked = [];
  for (let offset = 0; picked.length < 6; offset += 1) {
    picked.push(rotated[(start + offset) % rotated.length]);
  }
  return {
    red: picked.slice(0, 3),
    blue: picked.slice(3, 6)
  };
};

const simulateAlliance = (teamList, opponentList) => {
  const teamProfiles = teamList.map(teamKey => profiles.get(teamKey));
  const opponentProfiles = opponentList.map(teamKey => profiles.get(teamKey));
  const rawOffense = teamProfiles.reduce((sum, profile) => {
    const reliabilityRoll = random() < profile.reliability ? 1 : clamp(sampleNormal(0.58, 0.12), 0.25, 0.82);
    return sum + (profile.auto + profile.teleop + profile.endgame) * reliabilityRoll + sampleNormal(0, 5);
  }, 0);
  const opponentDefense = opponentProfiles.reduce((sum, profile) => sum + profile.defense, 0);
  const foulBonus = Math.round(clamp(opponentProfiles.reduce((sum, profile) => sum + profile.foulRisk, 0) + sampleNormal(0, 5), 0, 38));
  const score = Math.round(clamp(58 + rawOffense * 2.15 - opponentDefense * 0.48 + foulBonus + sampleNormal(0, 14), 12, 500));

  return {
    score,
    foulBonus,
    componentPoints: {
      auto: Math.round(teamProfiles.reduce((sum, profile) => sum + profile.auto, 0) * 2.05),
      teleop: Math.round(teamProfiles.reduce((sum, profile) => sum + profile.teleop, 0) * 2.05),
      endgame: Math.round(teamProfiles.reduce((sum, profile) => sum + profile.endgame, 0) * 2.05),
      opponentFouls: foulBonus
    }
  };
};

const simulateMatch = ({ matchKey, title, compLevel, matchNumber, redTeams, blueTeams, replayIndex }) => {
  const redResult = simulateAlliance(redTeams, blueTeams);
  const blueResult = simulateAlliance(blueTeams, redTeams);
  const winningAlliance = redResult.score === blueResult.score ? 'tie' : redResult.score > blueResult.score ? 'red' : 'blue';
  return {
    matchKey,
    title,
    compLevel,
    matchNumber,
    replayIndex,
    red: {
      teamKeys: redTeams,
      score: redResult.score,
      componentPoints: redResult.componentPoints
    },
    blue: {
      teamKeys: blueTeams,
      score: blueResult.score,
      componentPoints: blueResult.componentPoints
    },
    winningAlliance
  };
};

const generateQualificationMatches = () => {
  const matches = [];
  for (let matchNumber = 1; matchNumber <= qualificationMatches; matchNumber += 1) {
    const teams = chooseQualificationTeams(matchNumber);
    matches.push(
      simulateMatch({
        matchKey: `qm${matchNumber}`,
        title: `QM ${matchNumber}`,
        compLevel: 'qm',
        matchNumber,
        redTeams: teams.red,
        blueTeams: teams.blue,
        replayIndex: matches.length
      })
    );
  }
  return matches;
};

const updateStats = match => {
  const redWon = match.winningAlliance === 'red';
  const blueWon = match.winningAlliance === 'blue';
  for (const teamKey of match.red.teamKeys) {
    const stats = teamStats.get(teamKey);
    stats.matches += 1;
    stats.scoreFor += match.red.score;
    stats.scoreAgainst += match.blue.score;
    if (redWon) stats.wins += 1;
    else if (blueWon) stats.losses += 1;
    else stats.ties += 1;
  }
  for (const teamKey of match.blue.teamKeys) {
    const stats = teamStats.get(teamKey);
    stats.matches += 1;
    stats.scoreFor += match.blue.score;
    stats.scoreAgainst += match.red.score;
    if (blueWon) stats.wins += 1;
    else if (redWon) stats.losses += 1;
    else stats.ties += 1;
  }
};

const rankedTeams = () =>
  [...teamKeys].sort((left, right) => {
    const a = teamStats.get(left);
    const b = teamStats.get(right);
    const aRank = a.wins * 3 + a.ties + (a.scoreFor - a.scoreAgainst) / 1000;
    const bRank = b.wins * 3 + b.ties + (b.scoreFor - b.scoreAgainst) / 1000;
    return bRank - aRank;
  });

const createAllianceDraft = () => {
  const ranking = rankedTeams();
  const captains = ranking.slice(0, 8);
  const available = ranking.slice(8);
  const alliances = captains.map((captain, index) => ({ seed: index + 1, teams: [captain] }));

  for (const alliance of alliances) {
    const pick = available.shift();
    if (pick) alliance.teams.push(pick);
  }
  for (const alliance of [...alliances].reverse()) {
    const pick = available.shift();
    if (pick) alliance.teams.push(pick);
  }

  return alliances;
};

const simulateAllianceMatch = ({ leftAlliance, rightAlliance, matchNumber, replayIndex }) => {
  const leftAsRed = random() > 0.5;
  const redTeams = leftAsRed ? leftAlliance.teams : rightAlliance.teams;
  const blueTeams = leftAsRed ? rightAlliance.teams : leftAlliance.teams;
  return simulateMatch({
    matchKey: `m${matchNumber}`,
    title: matchNumber === playoffMatches ? 'Finals 2' : `M${matchNumber}`,
    compLevel: 'playoff',
    matchNumber,
    redTeams,
    blueTeams,
    replayIndex
  });
};

const generatePlayoffMatches = (alliances, startingReplayIndex) => {
  const pairings = [
    [0, 7],
    [3, 4],
    [1, 6],
    [2, 5],
    [0, 7],
    [3, 4],
    [1, 6],
    [2, 5],
    [0, 3],
    [1, 2],
    [0, 3],
    [1, 2],
    [0, 1]
  ];
  return pairings.slice(0, playoffMatches).map(([left, right], index) =>
    simulateAllianceMatch({
      leftAlliance: alliances[left],
      rightAlliance: alliances[right],
      matchNumber: index + 1,
      replayIndex: startingReplayIndex + index
    })
  );
};

const predictMatch = match => {
  const allianceProjection = teams =>
    teams.reduce((sum, teamKey) => {
      const profile = profiles.get(teamKey);
      const current = onlineRatings.get(teamKey);
      return sum + current + profile.reliability * 10 - profile.foulRisk * 0.6;
    }, 38);
  const redProjection = allianceProjection(match.red.teamKeys) - mean(match.blue.teamKeys.map(teamKey => profiles.get(teamKey).defense)) * 0.32;
  const blueProjection = allianceProjection(match.blue.teamKeys) - mean(match.red.teamKeys.map(teamKey => profiles.get(teamKey).defense)) * 0.32;
  const margin = redProjection - blueProjection;
  const redWinProbability = 1 / (1 + Math.exp(-margin / 55));
  return {
    predictedWinner: Math.abs(redWinProbability - 0.5) < 0.025 ? 'tie' : redWinProbability >= 0.5 ? 'red' : 'blue',
    redWinProbability: round(redWinProbability),
    predictedRedScore: Math.round(clamp(redProjection * 1.55, 0, 500)),
    predictedBlueScore: Math.round(clamp(blueProjection * 1.55, 0, 500))
  };
};

const updateRatingsFromMatch = match => {
  const updateTeam = (teamKey, allianceScore, opponentScore, won) => {
    const profile = profiles.get(teamKey);
    const oldRating = onlineRatings.get(teamKey);
    const observed = allianceScore / 3 + (allianceScore - opponentScore) * 0.08 + (won ? 6 : -3) + profile.defense * 0.08;
    onlineRatings.set(teamKey, clamp(oldRating * 0.82 + observed * 0.18, 15, 165));
  };
  for (const teamKey of match.red.teamKeys) {
    updateTeam(teamKey, match.red.score, match.blue.score, match.winningAlliance === 'red');
  }
  for (const teamKey of match.blue.teamKeys) {
    updateTeam(teamKey, match.blue.score, match.red.score, match.winningAlliance === 'blue');
  }
};

const createMatchScoutRows = match => {
  const teams = [...match.red.teamKeys, ...match.blue.teamKeys];
  teams.forEach((teamKey, stationIndex) => {
    const profile = profiles.get(teamKey);
    const alliance = stationIndex < 3 ? 'red' : 'blue';
    const allianceScore = alliance === 'red' ? match.red.score : match.blue.score;
    const opponentScore = alliance === 'red' ? match.blue.score : match.red.score;
    matchScoutRows.push({
      id: `match:${fixture.eventKey}:${match.matchKey}:${teamKey}`,
      lane: 'matchScout',
      eventKey: fixture.eventKey,
      matchKey: match.matchKey,
      teamKey,
      alliance,
      station: stationNames[stationIndex],
      availableAt: `${match.matchKey.toUpperCase()}_SCOUT_SYNCED`,
      trustClass: 'live-observed',
      confidence: round(clamp(0.76 + random() * 0.19, 0, 1)),
      simulatedBy: `deterministic-scout-persona-${stationIndex + 1}`,
      noFutureAfterMatchIndex: match.replayIndex,
      fields: {
        rolePlayed: profile.defense > profile.offense * 0.42 && random() > 0.55 ? 'defense' : 'scoring',
        observedContribution: round(clamp(allianceScore / 3 + sampleNormal(0, 8), 0, 180)),
        defensePressureApplied: round(clamp(profile.defense + sampleNormal(0, 5), 0, 75)),
        defensePressureReceived: round(clamp(mean((alliance === 'red' ? match.blue.teamKeys : match.red.teamKeys).map(team => profiles.get(team).defense)) + sampleNormal(0, 4), 0, 75)),
        reliabilityIssue: random() > profile.reliability,
        foulConcern: profile.foulRisk > 9 || random() < 0.08,
        scoreMarginContext: allianceScore - opponentScore
      }
    });
  });
};

const scorePrediction = entry => {
  const actualRedWin = entry.actualWinner === 'red' ? 1 : 0;
  return {
    winnerCorrect: entry.actualWinner === 'tie' ? null : entry.predictedWinner === entry.actualWinner,
    brier: (entry.redWinProbability - actualRedWin) ** 2,
    scoreMae: (Math.abs(entry.predictedRedScore - entry.actualRedScore) + Math.abs(entry.predictedBlueScore - entry.actualBlueScore)) / 2,
    marginMae: Math.abs(
      entry.predictedRedScore - entry.predictedBlueScore - (entry.actualRedScore - entry.actualBlueScore)
    )
  };
};

createPreScout();
createPitScout();
addCheckpoint({ id: 'T_MINUS_7_DAYS', phase: 'pre_scout', availableRecords: preScoutRecords.length });
addCheckpoint({ id: 'PIT_SCOUT_WINDOW', phase: 'pit_scout', availableRecords: preScoutRecords.length + pitScoutRecords.length });

const qualificationSchedule = generateQualificationMatches();
qualificationSchedule.forEach(updateStats);
const alliances = createAllianceDraft();
const playoffSchedule = generatePlayoffMatches(alliances, qualificationSchedule.length);
const allMatches = [...qualificationSchedule, ...playoffSchedule];

teamStats.forEach(stats => {
  stats.wins = 0;
  stats.losses = 0;
  stats.ties = 0;
  stats.matches = 0;
  stats.scoreFor = 0;
  stats.scoreAgainst = 0;
});

allMatches.forEach((match, replayIndex) => {
  const phase = match.compLevel === 'qm' ? 'qualification_replay' : 'playoff_replay';
  addCheckpoint({ id: `${match.matchKey.toUpperCase()}_POSTED`, phase, availableRecords: preScoutRecords.length + pitScoutRecords.length + officialResults.length + matchScoutRows.length });

  const prediction = predictMatch(match);
  const entry = {
    checkpoint: `${match.matchKey.toUpperCase()}_POSTED`,
    matchIndex: replayIndex,
    matchKey: match.matchKey,
    title: match.title,
    phase: match.compLevel === 'qm' ? 'qualification' : 'playoff',
    modelName: 'synthetic-online-power-v1',
    predictedWinner: prediction.predictedWinner,
    actualWinner: match.winningAlliance,
    redWinProbability: prediction.redWinProbability,
    predictedRedScore: prediction.predictedRedScore,
    predictedBlueScore: prediction.predictedBlueScore,
    actualRedScore: match.red.score,
    actualBlueScore: match.blue.score,
    availableRecords: [
      `preScout:${preScoutRecords.length}`,
      `pitScout:${pitScoutRecords.length}`,
      `officialResultsBeforePrediction:${officialResults.length}`,
      `matchScoutRowsBeforePrediction:${matchScoutRows.length}`
    ],
    knownOfficialResultsBeforePrediction: officialResults.length,
    knownScoutRowsBeforePrediction: matchScoutRows.length,
    createdAt: `${match.matchKey.toUpperCase()}_POSTED`
  };
  Object.assign(entry, scorePrediction(entry));
  predictionEntries.push(entry);
  noFutureChecks.push({
    matchKey: match.matchKey,
    matchIndex: replayIndex,
    knownOfficialResultsBeforePrediction: officialResults.length,
    knownScoutRowsBeforePrediction: matchScoutRows.length,
    passed: officialResults.length === replayIndex && matchScoutRows.length === replayIndex * 6
  });

  officialResults.push(match);
  updateStats(match);
  addCheckpoint({ id: `${match.matchKey.toUpperCase()}_FINAL`, phase, availableRecords: preScoutRecords.length + pitScoutRecords.length + officialResults.length + matchScoutRows.length });
  createMatchScoutRows(match);
  updateRatingsFromMatch(match);
  addCheckpoint({ id: `${match.matchKey.toUpperCase()}_SCOUT_SYNCED`, phase, availableRecords: preScoutRecords.length + pitScoutRecords.length + officialResults.length + matchScoutRows.length });
});

addCheckpoint({ id: 'DAY_END', phase: 'reporting', availableRecords: preScoutRecords.length + pitScoutRecords.length + officialResults.length + matchScoutRows.length });
addCheckpoint({ id: 'ALLIANCE_SELECTION_PREP', phase: 'alliance_selection', availableRecords: preScoutRecords.length + pitScoutRecords.length + officialResults.length + matchScoutRows.length + predictionEntries.length });

const decisiveEntries = predictionEntries.filter(entry => entry.actualWinner !== 'tie' && entry.predictedWinner !== 'tie');
const winnerAccuracy = mean(decisiveEntries.map(entry => (entry.winnerCorrect ? 1 : 0)));
const brierScore = mean(predictionEntries.map(entry => entry.brier));
const scoreMae = mean(predictionEntries.map(entry => entry.scoreMae));
const marginMae = mean(predictionEntries.map(entry => entry.marginMae));
const qualificationAccuracy = mean(
  decisiveEntries.filter(entry => entry.phase === 'qualification').map(entry => (entry.winnerCorrect ? 1 : 0))
);
const playoffAccuracy = mean(decisiveEntries.filter(entry => entry.phase === 'playoff').map(entry => (entry.winnerCorrect ? 1 : 0)));

const modelMetrics = {
  modelName: 'synthetic-online-power-v1',
  matchesPredicted: predictionEntries.length,
  decisivePredictions: decisiveEntries.length,
  winnerAccuracy: round(winnerAccuracy),
  qualificationWinnerAccuracy: round(qualificationAccuracy),
  playoffWinnerAccuracy: round(playoffAccuracy),
  brierScore: round(brierScore),
  scoreMae: round(scoreMae, 2),
  marginMae: round(marginMae, 2)
};

const noFutureLeakageAudit = {
  status: noFutureChecks.every(check => check.passed) ? 'passed' : 'failed',
  checkedPredictions: noFutureChecks.length,
  failedChecks: noFutureChecks.filter(check => !check.passed),
  rule: 'Before predicting match N, the runner may know only N prior official results and N*6 prior match-scout rows.'
};

const scoutCoverageByMatch = allMatches.map(match => ({
  matchKey: match.matchKey,
  expectedRows: 6,
  observedRows: matchScoutRows.filter(row => row.matchKey === match.matchKey).length
}));

const scoutCoverageAudit = {
  status: scoutCoverageByMatch.every(row => row.observedRows === row.expectedRows) ? 'passed' : 'failed',
  expectedRowsPerMatch: 6,
  matchesChecked: scoutCoverageByMatch.length,
  totalMatchScoutRows: matchScoutRows.length,
  uncoveredMatches: scoutCoverageByMatch.filter(row => row.observedRows !== row.expectedRows),
  laneCounts: {
    preScout: preScoutRecords.length,
    pitScout: pitScoutRecords.length,
    matchScout: matchScoutRows.length
  }
};

const picklist = rankedTeams().map((teamKey, index) => {
  const profile = profiles.get(teamKey);
  const stats = teamStats.get(teamKey);
  return {
    rank: index + 1,
    teamKey,
    nickname: profile.nickname,
    rating: round(onlineRatings.get(teamKey), 2),
    wins: stats.wins,
    losses: stats.losses,
    averageScoreFor: round(stats.scoreFor / Math.max(1, stats.matches), 1),
    reason: profile.defense > 34 ? 'High live defense value with stable scoring.' : 'Best available scoring and reliability blend.'
  };
});

const pickedTeams = new Set(alliances.flatMap(alliance => alliance.teams.slice(0, 2)));
const bestRemaining = picklist.filter(team => !pickedTeams.has(team.teamKey) && team.teamKey !== pretendOwnTeam).slice(0, 12);
const allianceSelectionReplay = {
  pretendOwnTeam,
  simulatedAllianceCaptains: alliances.map(alliance => ({ seed: alliance.seed, teams: alliance.teams })),
  alreadyPickedTeams: [...pickedTeams],
  bestRemaining,
  nextBestChoice: bestRemaining[0] ?? null
};

const replayEvent = {
  eventKey: fixture.eventKey,
  season: fixture.season,
  pretendOwnTeam,
  teams: teamKeys.map(teamKey => {
    const profile = profiles.get(teamKey);
    return {
      teamKey,
      nickname: profile.nickname,
      truePower: round(profile.truePower, 2),
      publicPriorPower: round(profile.publicPriorPower, 2)
    };
  }),
  matches: allMatches,
  checkpoints
};

const predictionLedger = {
  runId,
  eventKey: fixture.eventKey,
  entries: predictionEntries,
  metrics: modelMetrics
};

const appBridgeSummary = {
  modelCore: {
    status: 'passed',
    evidence: ['prediction-ledger.json', 'model-metrics.json', 'no-future-leakage-audit.json']
  },
  webApp: {
    status: 'artifact-ready',
    evidence: ['morning-report.html', 'prediction-ledger.json'],
    note: 'Run npm run build or browser checks after this replay to validate UI rendering.'
  },
  firebase: {
    status: 'skipped',
    evidence: [],
    note: 'Production writes are disabled for the local full replay.'
  },
  powerScout: {
    status: 'artifact-ready',
    evidence: ['morning-report.html', 'app-bridge-summary.json'],
    note: 'Run PowerScout SwiftPM verification after this replay.'
  }
};

const artifactNames = [
  'run-summary.json',
  'replay-event.json',
  'scout-observations.json',
  'prediction-ledger.json',
  'model-metrics.json',
  'no-future-leakage-audit.json',
  'scout-coverage-audit.json',
  'alliance-selection-replay.json',
  'app-bridge-summary.json',
  'morning-report.html'
];

const htmlEscape = value =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

const morningReportHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Synthetic Full Event Replay Report</title>
  <style>
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #07101f; color: #e5edf8; }
    main { max-width: 1040px; margin: 0 auto; padding: 48px 24px; }
    h1 { margin: 0 0 8px; font-size: 38px; }
    .muted { color: #90a3bd; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 14px; margin: 24px 0; }
    .card { border: 1px solid #20304c; background: #0b1528; border-radius: 8px; padding: 18px; }
    .metric { font-size: 32px; font-weight: 800; color: #f8b21a; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th, td { text-align: left; border-bottom: 1px solid #20304c; padding: 10px 8px; }
    th { color: #90a3bd; font-size: 13px; text-transform: uppercase; }
  </style>
</head>
<body>
  <main>
    <p class="muted">Powerhouse Scouting Synthetic Full System Test</p>
    <h1>${htmlEscape(fixture.eventKey)} Full Event Replay</h1>
    <p class="muted">Run ${htmlEscape(runId)}. Local-only fixture, no production Firebase writes, no live credentials.</p>
    <section class="grid">
      <div class="card"><div class="metric">${allMatches.length}</div><div>matches replayed</div></div>
      <div class="card"><div class="metric">${matchScoutRows.length}</div><div>match scout rows</div></div>
      <div class="card"><div class="metric">${Math.round(modelMetrics.winnerAccuracy * 100)}%</div><div>winner accuracy</div></div>
      <div class="card"><div class="metric">${modelMetrics.scoreMae}</div><div>score MAE</div></div>
    </section>
    <section class="card">
      <h2>Readiness Verdict</h2>
      <p>No-future audit: <strong>${htmlEscape(noFutureLeakageAudit.status)}</strong>. Scout coverage audit: <strong>${htmlEscape(scoutCoverageAudit.status)}</strong>.</p>
      <p>The replay generated pre-scout, pit-scout, match-scout, prediction ledger, model metrics, alliance-selection replay, and app bridge artifacts.</p>
    </section>
    <section class="card">
      <h2>Alliance Selection Next Choices</h2>
      <table>
        <thead><tr><th>Rank</th><th>Team</th><th>Rating</th><th>Reason</th></tr></thead>
        <tbody>
          ${bestRemaining
            .slice(0, 8)
            .map(team => `<tr><td>${team.rank}</td><td>${htmlEscape(team.teamKey)}</td><td>${team.rating}</td><td>${htmlEscape(team.reason)}</td></tr>`)
            .join('')}
        </tbody>
      </table>
    </section>
  </main>
</body>
</html>
`;

const runSummary = {
  runId,
  manifestPath: path.normalize(manifestPath),
  outputDir,
  eventKey: fixture.eventKey,
  season: fixture.season,
  pretendOwnTeam,
  counts: {
    teams: teamKeys.length,
    qualificationMatches,
    playoffMatches,
    totalMatches: allMatches.length,
    checkpoints: checkpoints.length,
    preScoutRecords: preScoutRecords.length,
    pitScoutRecords: pitScoutRecords.length,
    matchScoutRows: matchScoutRows.length,
    predictionEntries: predictionEntries.length
  },
  gates: {
    minMatches: manifest.gates.minMatches,
    minScoutRowsPerMatch: manifest.gates.minScoutRowsPerMatch,
    noFutureLeakage: noFutureLeakageAudit.status,
    scoutCoverage: scoutCoverageAudit.status
  },
  metrics: modelMetrics,
  artifacts: artifactNames.map(name => path.join(outputDir, name))
};

const writeJson = (name, value) => {
  writeFileSync(path.join(outputDir, name), `${JSON.stringify(value, null, 2)}\n`);
};

writeJson('run-summary.json', runSummary);
writeJson('replay-event.json', replayEvent);
writeJson('scout-observations.json', [...preScoutRecords, ...pitScoutRecords, ...matchScoutRows]);
writeJson('prediction-ledger.json', predictionLedger);
writeJson('model-metrics.json', modelMetrics);
writeJson('no-future-leakage-audit.json', noFutureLeakageAudit);
writeJson('scout-coverage-audit.json', scoutCoverageAudit);
writeJson('alliance-selection-replay.json', allianceSelectionReplay);
writeJson('app-bridge-summary.json', appBridgeSummary);
writeFileSync(path.join(outputDir, 'morning-report.html'), morningReportHtml);

for (const artifact of manifest.gates.requiredArtifacts) {
  assert.ok(existsSync(path.join(outputDir, artifact)), `Missing required artifact ${artifact}`);
}
assert.ok(allMatches.length >= manifest.gates.minMatches, `Expected at least ${manifest.gates.minMatches} matches.`);
assert.equal(noFutureLeakageAudit.status, 'passed', 'No-future leakage audit failed.');
assert.equal(scoutCoverageAudit.status, 'passed', 'Scout coverage audit failed.');

process.stdout.write(`${JSON.stringify(runSummary, null, 2)}\n`);

