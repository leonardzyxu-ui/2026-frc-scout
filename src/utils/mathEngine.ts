import { Matrix, solve } from 'ml-matrix';
import { MatchScoutingV2 } from '../types';

export interface TBAMatch {
  key: string;
  comp_level: string;
  match_number: number;
  time: number;
  alliances: {
    red: { score: number; team_keys: string[] };
    blue: { score: number; team_keys: string[] };
  };
}

export interface TeamMetrics {
  teamNumber: string;
  opr: number;
  dpr: number;
  popr: number;
  poprHistory: { match: number; popr: number }[];
  avgAutoFluidity: number;
  avgTeleopFluidity: number;
  avgUnderPressure: number;
  avgDefenseEffectiveness: number;
  avgClimbRate: number;
  matchesPlayed: number;
}

export class MathEngine {
  private tbaApiKey: string;

  constructor(tbaApiKey: string) {
    this.tbaApiKey = tbaApiKey;
  }

  async fetchEventMatches(eventKey: string): Promise<TBAMatch[]> {
    if (!this.tbaApiKey) {
      console.warn("No TBA API Key provided. Math Engine cannot fetch matches.");
      return [];
    }

    try {
      const response = await fetch(`https://www.thebluealliance.com/api/v3/event/${eventKey}/matches`, {
        headers: {
          'X-TBA-Auth-Key': this.tbaApiKey
        }
      });
      if (!response.ok) throw new Error(`TBA API Error: ${response.statusText}`);
      const matches: TBAMatch[] = await response.json();
      
      // Filter out unplayed matches and sort by time
      return matches
        .filter(m => m.alliances.red.score !== -1 && m.alliances.blue.score !== -1)
        .sort((a, b) => a.time - b.time);
    } catch (error) {
      console.error("Failed to fetch TBA matches:", error);
      return [];
    }
  }

  // Solves (A^T A + lambda I) x = A^T b
  private solveRidgeRegression(A_data: number[][], b_data: number[], lambda: number = 0.1): number[] {
    if (A_data.length === 0 || A_data[0].length === 0) return [];
    
    const A = new Matrix(A_data);
    const b = Matrix.columnVector(b_data);
    const At = A.transpose();
    const AtA = At.mmul(A);
    const lambdaI = Matrix.eye(A.columns).mul(lambda);
    const AtA_plus_lambdaI = AtA.add(lambdaI);
    const Atb = At.mmul(b);
    
    try {
      const x = solve(AtA_plus_lambdaI, Atb);
      return x.to1DArray();
    } catch (e) {
      console.error("Matrix solve failed", e);
      return new Array(A.columns).fill(0);
    }
  }

  public calculateMetrics(tbaMatches: TBAMatch[], scoutingData: MatchScoutingV2[], lambda: number = 0.1): Record<string, TeamMetrics> {
    // 1. Identify all unique teams
    const teamSet = new Set<string>();
    tbaMatches.forEach(m => {
      m.alliances.red.team_keys.forEach(tk => teamSet.add(tk.replace('frc', '')));
      m.alliances.blue.team_keys.forEach(tk => teamSet.add(tk.replace('frc', '')));
    });
    const teams = Array.from(teamSet).sort();
    const teamToIndex = new Map<string, number>();
    teams.forEach((t, i) => teamToIndex.set(t, i));

    const numTeams = teams.length;
    if (numTeams === 0) return {};

    // 2. Calculate Event OPR and DPR (Using all matches)
    const A_all: number[][] = [];
    const b_opr: number[] = [];
    const b_dpr: number[] = [];

    tbaMatches.forEach(m => {
      const redRow = new Array(numTeams).fill(0);
      const blueRow = new Array(numTeams).fill(0);

      m.alliances.red.team_keys.forEach(tk => {
        const idx = teamToIndex.get(tk.replace('frc', ''));
        if (idx !== undefined) redRow[idx] = 1;
      });
      m.alliances.blue.team_keys.forEach(tk => {
        const idx = teamToIndex.get(tk.replace('frc', ''));
        if (idx !== undefined) blueRow[idx] = 1;
      });

      A_all.push(redRow);
      b_opr.push(m.alliances.red.score);
      b_dpr.push(m.alliances.blue.score); // Red's DPR is based on Blue's score

      A_all.push(blueRow);
      b_opr.push(m.alliances.blue.score);
      b_dpr.push(m.alliances.red.score); // Blue's DPR is based on Red's score
    });

    const eventOPRs = this.solveRidgeRegression(A_all, b_opr, lambda);
    const eventDPRs = this.solveRidgeRegression(A_all, b_dpr, lambda);

    // 3. Calculate Rolling OPR and POPR
    // poprSum[team] = sum of POPR across matches
    // poprCount[team] = number of matches played
    const poprSum = new Map<string, number>();
    const poprCount = new Map<string, number>();
    const poprHistory = new Map<string, { match: number; popr: number }[]>();
    teams.forEach(t => { 
      poprSum.set(t, 0); 
      poprCount.set(t, 0); 
      poprHistory.set(t, []);
    });

    // For rolling OPR, we iterate through matches
    const A_rolling: number[][] = [];
    const b_rolling: number[] = [];

    tbaMatches.forEach((m) => {
      // Calculate OPRs using matches 0 to index-1
      let currentOPRs = new Array(numTeams).fill(0);
      if (A_rolling.length > 0) {
        currentOPRs = this.solveRidgeRegression(A_rolling, b_rolling, lambda);
      }

      // Calculate POPR for this match
      const processAlliance = (allianceTeams: string[], allianceScore: number) => {
        const teamKeys = allianceTeams.map(tk => tk.replace('frc', ''));
        
        teamKeys.forEach(targetTeam => {
          let expectedPartnerScore = 0;
          teamKeys.forEach(partner => {
            if (partner !== targetTeam) {
              const pIdx = teamToIndex.get(partner);
              if (pIdx !== undefined) {
                expectedPartnerScore += currentOPRs[pIdx];
              }
            }
          });

          const popr = allianceScore - expectedPartnerScore;
          poprSum.set(targetTeam, (poprSum.get(targetTeam) || 0) + popr);
          poprCount.set(targetTeam, (poprCount.get(targetTeam) || 0) + 1);
          poprHistory.get(targetTeam)?.push({ match: m.match_number, popr });
        });
      };

      processAlliance(m.alliances.red.team_keys, m.alliances.red.score);
      processAlliance(m.alliances.blue.team_keys, m.alliances.blue.score);

      // Add this match to the rolling matrices for the NEXT match's predictions
      const redRow = new Array(numTeams).fill(0);
      const blueRow = new Array(numTeams).fill(0);
      m.alliances.red.team_keys.forEach(tk => {
        const idx = teamToIndex.get(tk.replace('frc', ''));
        if (idx !== undefined) redRow[idx] = 1;
      });
      m.alliances.blue.team_keys.forEach(tk => {
        const idx = teamToIndex.get(tk.replace('frc', ''));
        if (idx !== undefined) blueRow[idx] = 1;
      });

      A_rolling.push(redRow);
      b_rolling.push(m.alliances.red.score);
      
      A_rolling.push(blueRow);
      b_rolling.push(m.alliances.blue.score);
    });

    // 4. Aggregate Subjective Scouting Data
    const subjSum = new Map<string, { auto: number; teleop: number; pressure: number; defense: number; defenseCount: number; climbSuccess: number; count: number }>();
    teams.forEach(t => subjSum.set(t, { auto: 0, teleop: 0, pressure: 0, defense: 0, defenseCount: 0, climbSuccess: 0, count: 0 }));

    scoutingData.forEach(sd => {
      const t = sd.teamNumber;
      if (!subjSum.has(t)) return;
      
      const s = subjSum.get(t)!;
      s.auto += sd.autoFluidity;
      s.teleop += sd.teleopFluidity;
      s.pressure += sd.underPressure;
      s.count += 1;

      if (['L1', 'L2', 'L3'].includes(sd.climbStatus)) {
        s.climbSuccess += 1;
      }

      if (sd.playedDefense) {
        s.defense += sd.defenseEffectiveness;
        s.defenseCount += 1;
      }
    });

    // 5. Build Final Metrics Object
    const metrics: Record<string, TeamMetrics> = {};
    teams.forEach((t, i) => {
      const pCount = poprCount.get(t) || 1; // avoid div by zero
      const s = subjSum.get(t)!;
      const sCount = s.count || 1;
      const dCount = s.defenseCount || 1;

      metrics[t] = {
        teamNumber: t,
        opr: eventOPRs[i] || 0,
        dpr: eventDPRs[i] || 0,
        popr: (poprSum.get(t) || 0) / pCount,
        poprHistory: poprHistory.get(t) || [],
        avgAutoFluidity: s.auto / sCount,
        avgTeleopFluidity: s.teleop / sCount,
        avgUnderPressure: s.pressure / sCount,
        avgDefenseEffectiveness: s.defense / dCount,
        avgClimbRate: s.climbSuccess / sCount,
        matchesPlayed: poprCount.get(t) || 0
      };
    });

    return metrics;
  }
}
