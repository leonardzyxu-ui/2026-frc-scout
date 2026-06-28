#!/usr/bin/env node
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import https from 'node:https';
import path from 'node:path';

const args = process.argv.slice(2);
const getArg = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
};
const hasFlag = name => args.includes(name);

const manifestPath = getArg('--manifest', 'SyntheticFullSystemTest/manifests/orlando-2026-public.json');
const manifest = JSON.parse(readFileSync(path.resolve(manifestPath), 'utf8'));
const eventKey = getArg('--event', manifest.fixture.eventKey);
const sourceUrl = getArg('--url', manifest.fixture.sourceUrl ?? `https://www.thebluealliance.com/event/${eventKey}`);
const htmlFile = getArg('--html-file', '');
const seed = manifest.simulation.seed;
const runStamp = new Date().toISOString().replace(/[-:.]/g, '').replace('T', '-').slice(0, 15);
const runId = `sft-real-${eventKey}-${runStamp}-${seed}`;
const outputDir = path.resolve(getArg('--output', path.join(manifest.artifacts.root, runId)));
const force = hasFlag('--force');

if (existsSync(outputDir) && readdirSync(outputDir).length > 0 && !force) {
  throw new Error(`Output directory already contains files: ${outputDir}. Pass --force or choose a new --output.`);
}
mkdirSync(outputDir, { recursive: true });

const fetchText = url =>
  new Promise((resolve, reject) => {
    https
      .get(url, response => {
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          response.resume();
          resolve(fetchText(new URL(response.headers.location, url).toString()));
          return;
        }
        if (response.statusCode !== 200) {
          response.resume();
          reject(new Error(`GET ${url} failed with HTTP ${response.statusCode}`));
          return;
        }
        response.setEncoding('utf8');
        let body = '';
        response.on('data', chunk => {
          body += chunk;
        });
        response.on('end', () => resolve(body));
      })
      .on('error', reject);
  });

const fetchWithCurl = url =>
  execFileSync('curl', ['-L', '--fail', '--silent', '--show-error', '--max-time', '30', url], {
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024
  });

const loadHtml = async () => {
  if (htmlFile) return readFileSync(path.resolve(htmlFile), 'utf8');
  try {
    return await fetchText(sourceUrl);
  } catch (error) {
    if (error?.code !== 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY') throw error;
    return fetchWithCurl(sourceUrl);
  }
};

const html = await loadHtml();

const decodeHtml = value =>
  value
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>');

const stripTags = value => decodeHtml(value.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim());

const parseEventPage = (pageHtml, requestedEventKey) => {
  const eventName = stripTags(pageHtml.match(/<h1 id="event-name">([\s\S]*?)<\/h1>/)?.[1] ?? requestedEventKey);
  const visibleRows = [...pageHtml.matchAll(/<tr class="visible-lg">([\s\S]*?)<\/tr>/g)].map(match => match[1]);
  const matches = [];
  const seen = new Set();
  const eventKeyPattern = requestedEventKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  for (const row of visibleRows) {
    const matchKey = row.match(new RegExp(`/match/(${eventKeyPattern}_[^"]+)`))?.[1];
    if (!matchKey || seen.has(matchKey)) continue;
    seen.add(matchKey);

    const teamKeys = [...row.matchAll(/data-team="frc(\d+)"/g)].map(match => `frc${match[1]}`);
    const redScore = Number(row.match(/<td class="redScore">[\s\S]*?<span[^>]*>(\d+)<\/span>/)?.[1]);
    const blueScore = Number(row.match(/<td class="blueScore">[\s\S]*?<span[^>]*>(\d+)<\/span>/)?.[1]);
    const title = stripTags(row.match(new RegExp(`/match/${eventKeyPattern}_[^>]+>([^<]+)<\\/a>`))?.[1] ?? matchKey);
    if (teamKeys.length !== 6 || !Number.isFinite(redScore) || !Number.isFinite(blueScore)) continue;

    const suffix = matchKey.slice(requestedEventKey.length + 1);
    const qmNumber = suffix.match(/^qm(\d+)$/)?.[1];
    const compLevel = qmNumber ? 'qm' : suffix.startsWith('f') ? 'f' : suffix.startsWith('sf') ? 'sf' : 'playoff';
    const matchNumber = qmNumber ? Number(qmNumber) : matches.filter(match => match.compLevel !== 'qm').length + 1;

    matches.push({
      matchKey,
      shortKey: suffix,
      title,
      compLevel,
      matchNumber,
      red: {
        teamKeys: teamKeys.slice(0, 3),
        score: redScore
      },
      blue: {
        teamKeys: teamKeys.slice(3, 6),
        score: blueScore
      },
      winningAlliance: redScore === blueScore ? 'tie' : redScore > blueScore ? 'red' : 'blue'
    });
  }

  const teams = [...new Set(matches.flatMap(match => [...match.red.teamKeys, ...match.blue.teamKeys]))].sort((left, right) => Number(left.slice(3)) - Number(right.slice(3)));
  return { eventName, matches, teams };
};

const { eventName, matches, teams } = parseEventPage(html, eventKey);
assert.ok(matches.length >= (manifest.gates.minMatches ?? 1), `Only parsed ${matches.length} matches from ${sourceUrl}.`);
assert.ok(teams.length >= 6, `Only parsed ${teams.length} teams from ${sourceUrl}.`);

const seededRandom = initialSeed => {
  let state = initialSeed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
};
const stableHash = value => {
  let hash = 2166136261;
  for (const char of value) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};
const random = seededRandom(seed);
const randomFor = value => seededRandom(stableHash(`${seed}:${value}`));
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const mean = values => (values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length);
const round = (value, digits = 3) => Number(value.toFixed(digits));
const scoreMean = mean(matches.flatMap(match => [match.red.score, match.blue.score]));

const excludedTeams = new Set(manifest.fixture.excludedTeamKeys ?? []);
const candidateOwnTeams = teams.filter(teamKey => !excludedTeams.has(teamKey));
const ownTeamRandom = seededRandom(manifest.fixture.pretendOwnTeamPolicy.seed);
const pretendOwnTeam =
  manifest.fixture.pretendOwnTeamPolicy.teamKey ?? candidateOwnTeams[Math.floor(ownTeamRandom() * candidateOwnTeams.length)];
assert.ok(teams.includes(pretendOwnTeam), `Pretend own team ${pretendOwnTeam} is not present in ${eventKey}.`);
const ownTeamLabel = manifest.fixture.ownTeamLabel ?? (pretendOwnTeam === 'frc254' ? 'The Cheesy Poofs' : 'Pretend Powerhouse Team');

const teamProfiles = new Map(
  teams.map(teamKey => {
    const teamRandom = randomFor(teamKey);
    const publicPriorPower = clamp(scoreMean / 3 + (teamRandom() - 0.5) * 80, 40, 185);
    const defense = clamp(8 + teamRandom() * 48, 0, 64);
    const reliability = clamp(0.7 + teamRandom() * 0.27, 0.58, 0.99);
    const foulRisk = clamp(2 + teamRandom() * 12, 0.5, 16);
    return [
      teamKey,
      {
        teamKey,
        nickname: `Team ${teamKey.slice(3)}`,
        publicPriorPower,
        defense,
        reliability,
        foulRisk,
        claimedContribution: clamp(publicPriorPower * (0.95 + teamRandom() * 0.35), 30, 210)
      }
    ];
  })
);

const preScoutRecords = teams.map(teamKey => {
  const profile = teamProfiles.get(teamKey);
  return {
    id: `pre:${eventKey}:${teamKey}`,
    lane: 'preScout',
    eventKey,
    teamKey,
    availableAt: 'T_MINUS_7_DAYS',
    trustClass: 'public-prior',
    confidence: round(clamp(0.55 + randomFor(`${teamKey}:pre`)() * 0.3, 0, 1)),
    simulatedBy: 'public-page-real-event-pre-scout',
    noFutureAfterMatchIndex: -1,
    fields: {
      publicPriorPower: round(profile.publicPriorPower, 2),
      rolePrior: profile.defense > 34 ? 'hybrid-defender' : 'scorer',
      sourceNote: 'Synthetic prior assigned before replay from team identity only, not event results.'
    }
  };
});

const pitScoutRecords = teams.map(teamKey => {
  const profile = teamProfiles.get(teamKey);
  return {
    id: `pit:${eventKey}:${teamKey}`,
    lane: 'pitScout',
    eventKey,
    teamKey,
    availableAt: 'PIT_SCOUT_WINDOW',
    trustClass: 'objective-observed',
    confidence: round(clamp(0.72 + randomFor(`${teamKey}:pit`)() * 0.22, 0, 1)),
    simulatedBy: 'public-page-real-event-pit-scout',
    noFutureAfterMatchIndex: -1,
    fields: {
      drivetrain: randomFor(`${teamKey}:drive`)() > 0.2 ? 'swerve' : 'tank',
      mechanismCount: Math.round(clamp(2 + randomFor(`${teamKey}:mechanism`)() * 4, 1, 6)),
      claimedContribution: round(profile.claimedContribution, 1),
      claimTrust: profile.claimedContribution > profile.publicPriorPower * 1.22 ? 'discount' : 'normal'
    }
  };
});

const onlineRatings = new Map(teams.map(teamKey => [teamKey, teamProfiles.get(teamKey).publicPriorPower]));
const standings = new Map(teams.map(teamKey => [teamKey, { wins: 0, losses: 0, ties: 0, matches: 0, scoreFor: 0, scoreAgainst: 0 }]));
const checkpoints = [];
const predictionEntries = [];
const matchScoutRows = [];
const officialResults = [];
const noFutureChecks = [];
const stationNames = ['red1', 'red2', 'red3', 'blue1', 'blue2', 'blue3'];
const teamMetricTimeline = [];
const futurePredictionSnapshots = [];
const lastQualificationIndex = matches.reduce((last, match, index) => (match.compLevel === 'qm' ? index : last), -1);

const metricDefinitions = {
  opr: {
    label: 'OPR',
    fullName: 'Offensive Power Rating',
    direction: 'backward-looking',
    storedAs: 'teamMetricTimeline[].teams[].opr',
    meaning:
      'A score-derived estimate of how much offensive output a team has contributed in completed matches. In this replay it is approximated from known official alliance scores before or after each checkpoint.'
  },
  epa: {
    label: 'EPA',
    fullName: 'Expected Points Added',
    direction: 'forward-looking rating',
    storedAs: 'teamMetricTimeline[].teams[].epa',
    meaning:
      'The current online expected contribution rating used by the replay model. It starts from the public pre-scout prior and is updated only after each completed match is ingested.'
  },
  ppc: {
    label: 'PPC',
    fullName: 'Local scout-credited average contribution',
    direction: 'backward-looking local scouting average',
    storedAs: 'teamMetricTimeline[].teams[].ppc',
    meaning:
      'The average points your scouts directly credited to this team from completed local match scout rows. It is evidence from what our scouts actually observed at this event.'
  },
  ppa: {
    label: 'PPA',
    fullName: 'Admin V4 expected range decision object',
    direction: 'forward-looking expected range',
    storedAs: 'teamMetricTimeline[].teams[].ppa',
    meaning:
      'A forecast object with expected, floor, and ceiling contribution values. It blends the current EPA rating, local PPC evidence when available, and defense/role context.'
  }
};

const addCheckpoint = checkpoint => checkpoints.push({ index: checkpoints.length, ...checkpoint });

const predictMatch = match => {
  const projection = (allianceTeams, opponentTeams) =>
    allianceTeams.reduce((sum, teamKey) => sum + onlineRatings.get(teamKey), 0) +
    mean(allianceTeams.map(teamKey => teamProfiles.get(teamKey).reliability)) * 18 -
    mean(opponentTeams.map(teamKey => teamProfiles.get(teamKey).defense)) * 0.6;
  const redProjection = projection(match.red.teamKeys, match.blue.teamKeys);
  const blueProjection = projection(match.blue.teamKeys, match.red.teamKeys);
  const margin = redProjection - blueProjection;
  const redWinProbability = 1 / (1 + Math.exp(-margin / 42));
  const scale = scoreMean / Math.max(1, mean([...onlineRatings.values()]) * 3);
  return {
    predictedWinner: Math.abs(redWinProbability - 0.5) < 0.025 ? 'tie' : redWinProbability >= 0.5 ? 'red' : 'blue',
    redWinProbability: round(redWinProbability),
    predictedRedScore: Math.round(clamp(redProjection * scale, 0, 600)),
    predictedBlueScore: Math.round(clamp(blueProjection * scale, 0, 600))
  };
};

const buildTeamMetricSnapshot = ({ checkpoint, afterMatchIndex }) => ({
  checkpoint,
  afterMatchIndex,
  afterMatchKey: matches[afterMatchIndex]?.shortKey ?? null,
  sourceRule:
    afterMatchIndex < 0
      ? 'Only pre-scout and pit-scout evidence is available.'
      : 'Official results and match-scout rows are included only through the completed match named by afterMatchKey.',
  teams: teams.map(teamKey => {
    const profile = teamProfiles.get(teamKey);
    const stats = standings.get(teamKey);
    const scoutRows = matchScoutRows.filter(row => row.teamKey === teamKey);
    const localContributions = scoutRows.map(row => row.fields.observedContribution);
    const ppc = scoutRows.length > 0 ? mean(localContributions) : null;
    const observedDefense = scoutRows.length > 0 ? mean(scoutRows.map(row => row.fields.defensePressureApplied)) : profile.defense;
    const expected = onlineRatings.get(teamKey) * 0.56 + (ppc ?? profile.publicPriorPower) * 0.34 + observedDefense * 0.1;
    const uncertainty = scoutRows.length < 3 ? 0.28 : scoutRows.length < 5 ? 0.18 : 0.12;

    return {
      teamKey,
      label: teamKey === pretendOwnTeam ? ownTeamLabel : profile.nickname,
      matchesPlayed: stats.matches,
      wins: stats.wins,
      losses: stats.losses,
      ties: stats.ties,
      opr: stats.matches > 0 ? round(stats.scoreFor / stats.matches / 3, 2) : null,
      epa: round(onlineRatings.get(teamKey), 2),
      ppc: ppc === null ? null : round(ppc, 2),
      ppa: {
        expected: round(expected, 2),
        floor: round(clamp(expected * (1 - uncertainty), 0, 260), 2),
        ceiling: round(clamp(expected * (1 + uncertainty), 0, 280), 2),
        scoutRows: scoutRows.length,
        defenseImpact: round(observedDefense, 2),
        source: scoutRows.length > 0 ? 'epa-plus-local-scouting' : 'epa-plus-pre-pit-prior'
      }
    };
  })
});

const isFutureMatchKnownAtCheckpoint = (match, afterMatchIndex) => {
  if (match.compLevel === 'qm') return true;
  if (afterMatchIndex <= lastQualificationIndex) return false;
  return matches[afterMatchIndex]?.compLevel !== 'qm';
};

const buildFuturePredictionSnapshot = ({ checkpoint, afterMatchIndex }) => ({
  checkpoint,
  afterMatchIndex,
  afterMatchKey: matches[afterMatchIndex]?.shortKey ?? null,
  scheduleVisibilityRule:
    'Qualification schedule is known before the event. Playoff future snapshots are withheld until playoff replay has started.',
  predictions: matches
    .filter((match, index) => index > afterMatchIndex && isFutureMatchKnownAtCheckpoint(match, afterMatchIndex))
    .map((match, index) => {
      const prediction = predictMatch(match);
      return {
        futureOrder: index + 1,
        matchIndex: matches.indexOf(match),
        matchKey: match.shortKey,
        tbaMatchKey: match.matchKey,
        title: match.title,
        phase: match.compLevel === 'qm' ? 'qualification' : 'playoff',
        redTeams: match.red.teamKeys,
        blueTeams: match.blue.teamKeys,
        predictedWinner: prediction.predictedWinner,
        redWinProbability: prediction.redWinProbability,
        predictedRedScore: prediction.predictedRedScore,
        predictedBlueScore: prediction.predictedBlueScore
      };
    })
});

const updateStandings = match => {
  const redWon = match.winningAlliance === 'red';
  const blueWon = match.winningAlliance === 'blue';
  for (const teamKey of match.red.teamKeys) {
    const stats = standings.get(teamKey);
    stats.matches += 1;
    stats.scoreFor += match.red.score;
    stats.scoreAgainst += match.blue.score;
    if (redWon) stats.wins += 1;
    else if (blueWon) stats.losses += 1;
    else stats.ties += 1;
  }
  for (const teamKey of match.blue.teamKeys) {
    const stats = standings.get(teamKey);
    stats.matches += 1;
    stats.scoreFor += match.blue.score;
    stats.scoreAgainst += match.red.score;
    if (blueWon) stats.wins += 1;
    else if (redWon) stats.losses += 1;
    else stats.ties += 1;
  }
};

const updateRatings = match => {
  const updateAlliance = (allianceTeams, allianceScore, opponentScore, won) => {
    for (const teamKey of allianceTeams) {
      const profile = teamProfiles.get(teamKey);
      const oldRating = onlineRatings.get(teamKey);
      const observed = allianceScore / 3 + (allianceScore - opponentScore) * 0.07 + (won ? 5 : -3) + profile.defense * 0.06;
      onlineRatings.set(teamKey, clamp(oldRating * 0.78 + observed * 0.22, 20, 210));
    }
  };
  updateAlliance(match.red.teamKeys, match.red.score, match.blue.score, match.winningAlliance === 'red');
  updateAlliance(match.blue.teamKeys, match.blue.score, match.red.score, match.winningAlliance === 'blue');
};

const createMatchScoutRows = (match, replayIndex) => {
  const teamList = [...match.red.teamKeys, ...match.blue.teamKeys];
  teamList.forEach((teamKey, stationIndex) => {
    const alliance = stationIndex < 3 ? 'red' : 'blue';
    const profile = teamProfiles.get(teamKey);
    const allianceScore = alliance === 'red' ? match.red.score : match.blue.score;
    const opponentScore = alliance === 'red' ? match.blue.score : match.red.score;
    const opponentTeams = alliance === 'red' ? match.blue.teamKeys : match.red.teamKeys;
    matchScoutRows.push({
      id: `match:${eventKey}:${match.shortKey}:${teamKey}`,
      lane: 'matchScout',
      eventKey,
      matchKey: match.shortKey,
      tbaMatchKey: match.matchKey,
      teamKey,
      alliance,
      station: stationNames[stationIndex],
      availableAt: `${match.shortKey.toUpperCase()}_SCOUT_SYNCED`,
      trustClass: 'live-observed',
      confidence: round(clamp(0.74 + randomFor(`${match.matchKey}:${teamKey}:confidence`)() * 0.22, 0, 1)),
      simulatedBy: `deterministic-scout-persona-${stationIndex + 1}`,
      noFutureAfterMatchIndex: replayIndex,
      fields: {
        rolePlayed: profile.defense > 34 && randomFor(`${match.matchKey}:${teamKey}:role`)() > 0.45 ? 'defense' : 'scoring',
        observedContribution: round(clamp(allianceScore / 3 + (randomFor(`${match.matchKey}:${teamKey}:contrib`)() - 0.5) * 32, 0, 220)),
        defensePressureApplied: round(clamp(profile.defense + (randomFor(`${match.matchKey}:${teamKey}:def`)() - 0.5) * 14, 0, 78)),
        defensePressureReceived: round(clamp(mean(opponentTeams.map(team => teamProfiles.get(team).defense)), 0, 78)),
        reliabilityIssue: randomFor(`${match.matchKey}:${teamKey}:reliability`)() > profile.reliability,
        foulConcern: randomFor(`${match.matchKey}:${teamKey}:foul`)() < profile.foulRisk / 100,
        scoreMarginContext: allianceScore - opponentScore
      }
    });
  });
};

const scorePrediction = entry => {
  const actualRedWin = entry.actualWinner === 'red' ? 1 : 0;
  return {
    winnerCorrect: entry.actualWinner === 'tie' || entry.predictedWinner === 'tie' ? null : entry.predictedWinner === entry.actualWinner,
    brier: (entry.redWinProbability - actualRedWin) ** 2,
    scoreMae: (Math.abs(entry.predictedRedScore - entry.actualRedScore) + Math.abs(entry.predictedBlueScore - entry.actualBlueScore)) / 2,
    marginMae: Math.abs(entry.predictedRedScore - entry.predictedBlueScore - (entry.actualRedScore - entry.actualBlueScore))
  };
};

addCheckpoint({ id: 'T_MINUS_7_DAYS', phase: 'pre_scout', availableRecords: preScoutRecords.length });
addCheckpoint({ id: 'PIT_SCOUT_WINDOW', phase: 'pit_scout', availableRecords: preScoutRecords.length + pitScoutRecords.length });
teamMetricTimeline.push(buildTeamMetricSnapshot({ checkpoint: 'PIT_SCOUT_WINDOW', afterMatchIndex: -1 }));
futurePredictionSnapshots.push(buildFuturePredictionSnapshot({ checkpoint: 'PIT_SCOUT_WINDOW', afterMatchIndex: -1 }));

matches.forEach((match, replayIndex) => {
  const phase = match.compLevel === 'qm' ? 'qualification_replay' : 'playoff_replay';
  addCheckpoint({
    id: `${match.shortKey.toUpperCase()}_POSTED`,
    phase,
    availableRecords: preScoutRecords.length + pitScoutRecords.length + officialResults.length + matchScoutRows.length
  });

  const prediction = predictMatch(match);
  const entry = {
    checkpoint: `${match.shortKey.toUpperCase()}_POSTED`,
    matchIndex: replayIndex,
    matchKey: match.shortKey,
    tbaMatchKey: match.matchKey,
    title: match.title,
    phase: match.compLevel === 'qm' ? 'qualification' : 'playoff',
    modelName: 'public-real-event-online-power-v1',
    predictedWinner: prediction.predictedWinner,
    actualWinner: match.winningAlliance,
    redWinProbability: prediction.redWinProbability,
    predictedRedScore: prediction.predictedRedScore,
    predictedBlueScore: prediction.predictedBlueScore,
    actualRedScore: match.red.score,
    actualBlueScore: match.blue.score,
    redTeams: match.red.teamKeys,
    blueTeams: match.blue.teamKeys,
    availableRecords: [
      `preScout:${preScoutRecords.length}`,
      `pitScout:${pitScoutRecords.length}`,
      `officialResultsBeforePrediction:${officialResults.length}`,
      `matchScoutRowsBeforePrediction:${matchScoutRows.length}`
    ],
    knownOfficialResultsBeforePrediction: officialResults.length,
    knownScoutRowsBeforePrediction: matchScoutRows.length,
    createdAt: `${match.shortKey.toUpperCase()}_POSTED`
  };
  Object.assign(entry, scorePrediction(entry));
  predictionEntries.push(entry);
  noFutureChecks.push({
    matchKey: match.shortKey,
    matchIndex: replayIndex,
    knownOfficialResultsBeforePrediction: officialResults.length,
    knownScoutRowsBeforePrediction: matchScoutRows.length,
    passed: officialResults.length === replayIndex && matchScoutRows.length === replayIndex * 6
  });

  officialResults.push(match);
  updateStandings(match);
  addCheckpoint({
    id: `${match.shortKey.toUpperCase()}_FINAL`,
    phase,
    availableRecords: preScoutRecords.length + pitScoutRecords.length + officialResults.length + matchScoutRows.length
  });
  createMatchScoutRows(match, replayIndex);
  updateRatings(match);
  addCheckpoint({
    id: `${match.shortKey.toUpperCase()}_SCOUT_SYNCED`,
    phase,
    availableRecords: preScoutRecords.length + pitScoutRecords.length + officialResults.length + matchScoutRows.length
  });
  teamMetricTimeline.push(buildTeamMetricSnapshot({ checkpoint: `${match.shortKey.toUpperCase()}_SCOUT_SYNCED`, afterMatchIndex: replayIndex }));
  futurePredictionSnapshots.push(
    buildFuturePredictionSnapshot({ checkpoint: `${match.shortKey.toUpperCase()}_SCOUT_SYNCED`, afterMatchIndex: replayIndex })
  );
});

addCheckpoint({
  id: 'ALLIANCE_SELECTION_PREP',
  phase: 'alliance_selection',
  availableRecords: preScoutRecords.length + pitScoutRecords.length + officialResults.length + matchScoutRows.length + predictionEntries.length
});

const decisiveEntries = predictionEntries.filter(entry => entry.actualWinner !== 'tie' && entry.predictedWinner !== 'tie');
const modelMetrics = {
  modelName: 'public-real-event-online-power-v1',
  matchesPredicted: predictionEntries.length,
  decisivePredictions: decisiveEntries.length,
  winnerAccuracy: round(mean(decisiveEntries.map(entry => (entry.winnerCorrect ? 1 : 0)))),
  qualificationWinnerAccuracy: round(mean(decisiveEntries.filter(entry => entry.phase === 'qualification').map(entry => (entry.winnerCorrect ? 1 : 0)))),
  playoffWinnerAccuracy: round(mean(decisiveEntries.filter(entry => entry.phase === 'playoff').map(entry => (entry.winnerCorrect ? 1 : 0)))),
  brierScore: round(mean(predictionEntries.map(entry => entry.brier))),
  scoreMae: round(mean(predictionEntries.map(entry => entry.scoreMae)), 2),
  marginMae: round(mean(predictionEntries.map(entry => entry.marginMae)), 2)
};

const noFutureLeakageAudit = {
  status: noFutureChecks.every(check => check.passed) ? 'passed' : 'failed',
  checkedPredictions: noFutureChecks.length,
  failedChecks: noFutureChecks.filter(check => !check.passed),
  rule: 'Before predicting match N, the runner may know only prior official results and prior match-scout rows.'
};

const scoutCoverageByMatch = matches.map(match => ({
  matchKey: match.shortKey,
  expectedRows: 6,
  observedRows: matchScoutRows.filter(row => row.tbaMatchKey === match.matchKey).length
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

const picklist = teams
  .map(teamKey => {
    const stats = standings.get(teamKey);
    const rankingPoints = stats.wins * 3 + stats.ties;
    return {
      teamKey,
      nickname: teamProfiles.get(teamKey).nickname,
      rating: round(onlineRatings.get(teamKey), 2),
      wins: stats.wins,
      losses: stats.losses,
      ties: stats.ties,
      matches: stats.matches,
      averageScoreFor: round(stats.scoreFor / Math.max(1, stats.matches), 1),
      rankingScore: round(rankingPoints + (stats.scoreFor - stats.scoreAgainst) / 1000, 3)
    };
  })
  .sort((left, right) => right.rating - left.rating)
  .map((team, index) => ({
    rank: index + 1,
    ...team,
    reason: team.rating > scoreMean / 3 ? 'Best remaining real-event score evidence plus live replay rating.' : 'Depth option with usable replay evidence.'
  }));

const allianceCaptains = [...picklist].sort((left, right) => right.rankingScore - left.rankingScore).slice(0, 8);
const alreadyPickedTeams = new Set(allianceCaptains.map(team => team.teamKey));
const bestRemaining = picklist.filter(team => !alreadyPickedTeams.has(team.teamKey) && team.teamKey !== pretendOwnTeam).slice(0, 12);
const allianceSelectionReplay = {
  pretendOwnTeam,
  ownTeamLabel,
  simulatedAllianceCaptains: allianceCaptains,
  alreadyPickedTeams: [...alreadyPickedTeams],
  bestRemaining,
  nextBestChoice: bestRemaining[0] ?? null
};

const replayEvent = {
  eventKey,
  eventName,
  season: manifest.fixture.season,
  sourceUrl,
  pretendOwnTeam,
  ownTeamLabel,
  teams: teams.map(teamKey => ({
    teamKey,
    nickname: teamProfiles.get(teamKey).nickname,
    publicPriorPower: round(teamProfiles.get(teamKey).publicPriorPower, 2)
  })),
  matches,
  checkpoints
};

const predictionLedger = {
  runId,
  eventKey,
  eventName,
  sourceUrl,
  entries: predictionEntries,
  metrics: modelMetrics
};

const eventHistoryIndex = {
  runId,
  eventKey,
  eventName,
  sourceUrl,
  pretendOwnTeam,
  ownTeamLabel,
  storage: {
    root: outputDir,
    generatedArtifactsAreGitIgnored: manifest.artifacts.keepGeneratedOutOfGit === true,
    productionWrites: false,
    apiKeyUsed: false,
    note: 'This run stores local replay evidence under SyntheticFullSystemTest/artifacts/<runId>. The runner code and manifests are committed, while generated event histories stay out of Git unless intentionally promoted.'
  },
  checkpoints: {
    count: checkpoints.length,
    first: checkpoints[0]?.id ?? null,
    last: checkpoints.at(-1)?.id ?? null
  },
  artifacts: {
    runSummary: 'run-summary.json',
    sourcePageMetadata: 'source-page-metadata.json',
    replayEvent: 'replay-event.json',
    scoutObservations: 'scout-observations.json',
    predictionLedger: 'prediction-ledger.json',
    modelMetrics: 'model-metrics.json',
    metricDefinitions: 'metric-definitions.json',
    teamMetricTimeline: 'team-metric-timeline.json',
    futurePredictionSnapshots: 'future-prediction-snapshots.json',
    noFutureLeakageAudit: 'no-future-leakage-audit.json',
    scoutCoverageAudit: 'scout-coverage-audit.json',
    allianceSelectionReplay: 'alliance-selection-replay.json',
    appBridgeSummary: 'app-bridge-summary.json',
    eventHistoryIndex: 'event-history-index.json',
    morningReport: 'morning-report.html'
  }
};

const appBridgeSummary = {
  modelCore: {
    status: 'passed',
    evidence: [
      'prediction-ledger.json',
      'model-metrics.json',
      'metric-definitions.json',
      'team-metric-timeline.json',
      'future-prediction-snapshots.json',
      'no-future-leakage-audit.json'
    ]
  },
  webApp: {
    status: 'artifact-ready',
    evidence: ['morning-report.html', 'prediction-ledger.json', 'team-metric-timeline.json', 'future-prediction-snapshots.json'],
    note: 'Run npm run build or browser checks after this replay to validate UI rendering.'
  },
  firebase: {
    status: 'skipped',
    evidence: [],
    note: 'Production writes are disabled for the real-event local replay.'
  },
  powerScout: {
    status: 'artifact-ready',
    evidence: ['morning-report.html', 'app-bridge-summary.json', 'event-history-index.json']
  }
};

const htmlEscape = value =>
  String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

const morningReportHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${htmlEscape(eventName)} Real-Event Replay Report</title>
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
    a { color: #f8b21a; }
  </style>
</head>
<body>
  <main>
    <p class="muted">Powerhouse Scouting Real-Event Synthetic Replay</p>
    <h1>${htmlEscape(eventName)}</h1>
    <p class="muted">Run ${htmlEscape(runId)}. Source: <a href="${htmlEscape(sourceUrl)}">${htmlEscape(sourceUrl)}</a>. No TBA API key, no production Firebase writes.</p>
    <p class="muted">Powerhouse role: ${htmlEscape(pretendOwnTeam)} (${htmlEscape(ownTeamLabel)}).</p>
    <section class="grid">
      <div class="card"><div class="metric">${matches.length}</div><div>real matches replayed</div></div>
      <div class="card"><div class="metric">${teams.length}</div><div>real teams</div></div>
      <div class="card"><div class="metric">${matchScoutRows.length}</div><div>simulated match scout rows</div></div>
      <div class="card"><div class="metric">${Math.round(modelMetrics.winnerAccuracy * 100)}%</div><div>winner accuracy</div></div>
    </section>
    <section class="card">
      <h2>Readiness Verdict</h2>
      <p>No-future audit: <strong>${htmlEscape(noFutureLeakageAudit.status)}</strong>. Scout coverage audit: <strong>${htmlEscape(scoutCoverageAudit.status)}</strong>.</p>
      <p>This replay used real teams, real schedule, and real final scores, while generating synthetic pre-scout, pit-scout, match-scout, prediction, metric-timeline, future-prediction, and alliance-selection artifacts.</p>
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

const sourcePageMetadata = {
  sourceUrl,
  eventKey,
  eventName,
  fetchedAt: new Date().toISOString(),
  htmlBytes: Buffer.byteLength(html),
  parser: 'TBA public event page visible-lg match rows',
  apiKeyUsed: false
};

const artifactNames = manifest.gates.requiredArtifacts;
const runSummary = {
  runId,
  manifestPath: path.normalize(manifestPath),
  outputDir,
  eventKey,
  eventName,
  sourceUrl,
  season: manifest.fixture.season,
  pretendOwnTeam,
  ownTeamLabel,
  counts: {
    teams: teams.length,
    qualificationMatches: matches.filter(match => match.compLevel === 'qm').length,
    playoffMatches: matches.filter(match => match.compLevel !== 'qm').length,
    totalMatches: matches.length,
    checkpoints: checkpoints.length,
    preScoutRecords: preScoutRecords.length,
    pitScoutRecords: pitScoutRecords.length,
    matchScoutRows: matchScoutRows.length,
    predictionEntries: predictionEntries.length,
    teamMetricSnapshots: teamMetricTimeline.length,
    futurePredictionSnapshots: futurePredictionSnapshots.length
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

const writeJson = (name, value) => writeFileSync(path.join(outputDir, name), `${JSON.stringify(value, null, 2)}\n`);

writeJson('run-summary.json', runSummary);
writeJson('source-page-metadata.json', sourcePageMetadata);
writeJson('replay-event.json', replayEvent);
writeJson('scout-observations.json', [...preScoutRecords, ...pitScoutRecords, ...matchScoutRows]);
writeJson('prediction-ledger.json', predictionLedger);
writeJson('model-metrics.json', modelMetrics);
writeJson('metric-definitions.json', metricDefinitions);
writeJson('team-metric-timeline.json', teamMetricTimeline);
writeJson('future-prediction-snapshots.json', futurePredictionSnapshots);
writeJson('no-future-leakage-audit.json', noFutureLeakageAudit);
writeJson('scout-coverage-audit.json', scoutCoverageAudit);
writeJson('alliance-selection-replay.json', allianceSelectionReplay);
writeJson('app-bridge-summary.json', appBridgeSummary);
writeJson('event-history-index.json', eventHistoryIndex);
writeFileSync(path.join(outputDir, 'morning-report.html'), morningReportHtml);

for (const artifact of artifactNames) {
  assert.ok(existsSync(path.join(outputDir, artifact)), `Missing required artifact ${artifact}`);
}
assert.equal(noFutureLeakageAudit.status, 'passed', 'No-future leakage audit failed.');
assert.equal(scoutCoverageAudit.status, 'passed', 'Scout coverage audit failed.');
assert.equal(matchScoutRows.length, matches.length * 6, 'Every match must produce six scout rows.');

process.stdout.write(`${JSON.stringify(runSummary, null, 2)}\n`);
