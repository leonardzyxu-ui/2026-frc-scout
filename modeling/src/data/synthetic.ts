import type { HistoricalMatch, ScoutingObservation, StatboticsTeamSignal } from '../types.ts';
import { clamp } from '../util.ts';

const seededRandom = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
};

const sampleNormal = (random: () => number, mean: number, sd: number) => {
  const left = Math.max(random(), 1e-9);
  const right = Math.max(random(), 1e-9);
  return mean + sd * Math.sqrt(-2 * Math.log(left)) * Math.cos(2 * Math.PI * right);
};

export const buildSyntheticResearchData = (options: {
  seasons?: number[];
  eventsPerSeason?: number;
  teamsPerEvent?: number;
  matchesPerEvent?: number;
  seed?: number;
}) => {
  const seasons = options.seasons ?? [2024, 2025, 2026];
  const eventsPerSeason = options.eventsPerSeason ?? 3;
  const teamsPerEvent = options.teamsPerEvent ?? 24;
  const matchesPerEvent = options.matchesPerEvent ?? 36;
  const random = seededRandom(options.seed ?? 6907);
  const matches: HistoricalMatch[] = [];
  const observations: ScoutingObservation[] = [];
  const statboticsSignals: StatboticsTeamSignal[] = [];
  const globalStrength = new Map<string, { offense: number; defense: number; fouls: number }>();

  seasons.forEach(season => {
    for (let eventIndex = 1; eventIndex <= eventsPerSeason; eventIndex += 1) {
      const eventKey = `${season}sim${eventIndex}`;
      const teams = Array.from({ length: teamsPerEvent }, (_, index) => {
        const teamNumber = 1000 + eventIndex * 100 + index;
        const teamKey = `frc${teamNumber}`;
        if (!globalStrength.has(teamKey)) {
          globalStrength.set(teamKey, {
            offense: clamp(sampleNormal(random, 30 + (season - 2024) * 2, 9), 5, 65),
            defense: clamp(sampleNormal(random, 8, 9), 0, 45),
            fouls: clamp(sampleNormal(random, 2, 2), 0, 12)
          });
        }
        return teamKey;
      });

      teams.forEach(teamKey => {
        const strength = globalStrength.get(teamKey);
        if (!strength) return;
        statboticsSignals.push({
          id: `synthetic:${eventKey}:${teamKey}`,
          teamKey,
          season,
          eventKey,
          overallEpa: strength.offense + strength.defense * 0.18 - strength.fouls * 0.35,
          autoEpa: strength.offense * 0.26,
          teleopEpa: strength.offense * 0.62,
          endgameEpa: strength.offense * 0.12,
          sourceKind: 'team_event',
          raw: { synthetic: true }
        });
      });

      for (let matchNumber = 1; matchNumber <= matchesPerEvent; matchNumber += 1) {
        const shuffled = [...teams].sort(() => random() - 0.5);
        const redTeams = shuffled.slice(0, 3);
        const blueTeams = shuffled.slice(3, 6);
        const redStrengths = redTeams.map(team => globalStrength.get(team)).filter(Boolean) as Array<{
          offense: number;
          defense: number;
          fouls: number;
        }>;
        const blueStrengths = blueTeams.map(team => globalStrength.get(team)).filter(Boolean) as Array<{
          offense: number;
          defense: number;
          fouls: number;
        }>;
        const redDefender = redTeams[redStrengths.findIndex(strength => strength.defense - strength.offense * 0.75 > 4)];
        const blueDefender = blueTeams[blueStrengths.findIndex(strength => strength.defense - strength.offense * 0.75 > 4)];
        const redDefense = redDefender ? globalStrength.get(redDefender)?.defense ?? 0 : 0;
        const blueDefense = blueDefender ? globalStrength.get(blueDefender)?.defense ?? 0 : 0;
        const redOffense = redStrengths.reduce((sum, strength, index) => {
          const team = redTeams[index];
          return sum + strength.offense * (team === redDefender ? 0.25 : 1);
        }, 0);
        const blueOffense = blueStrengths.reduce((sum, strength, index) => {
          const team = blueTeams[index];
          return sum + strength.offense * (team === blueDefender ? 0.25 : 1);
        }, 0);
        const redFouls = Math.round(clamp(sampleNormal(random, redStrengths.reduce((sum, s) => sum + s.fouls, 0), 4), 0, 30));
        const blueFouls = Math.round(
          clamp(sampleNormal(random, blueStrengths.reduce((sum, s) => sum + s.fouls, 0), 4), 0, 30)
        );
        const redScore = Math.round(clamp(redOffense - blueDefense + blueFouls + sampleNormal(random, 0, 9), 0, 220));
        const blueScore = Math.round(clamp(blueOffense - redDefense + redFouls + sampleNormal(random, 0, 9), 0, 220));
        const key = `${eventKey}_qm${matchNumber}`;

        matches.push({
          key,
          eventKey,
          season,
          compLevel: 'qm',
          matchNumber,
          setNumber: 1,
          startTime: Date.UTC(season, eventIndex, matchNumber, 12, 0, 0) / 1000,
          red: {
            score: redScore,
            teamKeys: redTeams,
            foulPoints: blueFouls,
            techFoulCount: Math.floor(blueFouls / 10),
            foulCount: Math.floor(blueFouls / 3),
            componentPoints: { syntheticOffense: Math.round(redOffense), syntheticOpponentFouls: blueFouls },
            rawBreakdown: { synthetic: true }
          },
          blue: {
            score: blueScore,
            teamKeys: blueTeams,
            foulPoints: redFouls,
            techFoulCount: Math.floor(redFouls / 10),
            foulCount: Math.floor(redFouls / 3),
            componentPoints: { syntheticOffense: Math.round(blueOffense), syntheticOpponentFouls: redFouls },
            rawBreakdown: { synthetic: true }
          },
          winningAlliance: redScore === blueScore ? '' : redScore > blueScore ? 'red' : 'blue',
          source: 'Synthetic'
        });

        [...redTeams, ...blueTeams].forEach((teamKey, index) => {
          const strength = globalStrength.get(teamKey);
          if (!strength || random() > 0.45) return;
          observations.push({
            id: `synthetic:${key}:${teamKey}`,
            source: 'Synthetic',
            eventKey,
            matchKey: `qm${matchNumber}`,
            teamKey,
            alliance: index < 3 ? 'red' : 'blue',
            offensePoints: clamp(sampleNormal(random, strength.offense, 4), 0, 80),
            defenseValue: clamp(sampleNormal(random, strength.defense, 5), 0, 60),
            playedDefense: teamKey === redDefender || teamKey === blueDefender,
            reliabilityPenalty: clamp(sampleNormal(random, strength.fouls / 3, 1.5), 0, 10),
            observedAt: Date.UTC(season, eventIndex, matchNumber, 11, 30, 0) / 1000,
            raw: { synthetic: true }
          });
        });
      }
    }
  });

  return { matches, observations, statboticsSignals };
};
