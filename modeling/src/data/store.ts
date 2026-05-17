import path from 'node:path';
import Database, { type Database as SqliteDatabase } from 'better-sqlite3';
import type {
  HistoricalMatch,
  ScoutingObservation,
  StatboticsTeamSignal,
  DataSource,
  ResearchRun
} from '../types.ts';
import { compactResearchRun, ensureDir } from '../util.ts';

export const DEFAULT_MODELING_DB_PATH = path.resolve('modeling/artifacts/cache/research.sqlite');

interface RawPayloadInput {
  source: DataSource;
  endpointKey: string;
  eventKey?: string | null;
  season?: number | null;
  payload: unknown;
}

const nowIso = () => new Date().toISOString();

const encode = (value: unknown) => JSON.stringify(value);
const decode = <T>(value: unknown, fallback: T): T => {
  if (typeof value !== 'string' || value.length === 0) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

export class ResearchStore {
  private db: SqliteDatabase;

  constructor(filename = DEFAULT_MODELING_DB_PATH) {
    ensureDir(path.dirname(filename));
    this.db = new Database(filename);
    this.db.pragma('journal_mode = WAL');
    this.init();
  }

  init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS raw_payloads (
        source TEXT NOT NULL,
        endpoint_key TEXT NOT NULL,
        event_key TEXT NOT NULL DEFAULT '',
        season INTEGER NOT NULL DEFAULT 0,
        fetched_at TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        PRIMARY KEY (source, endpoint_key, event_key, season)
      );

      CREATE TABLE IF NOT EXISTS matches (
        match_key TEXT PRIMARY KEY,
        event_key TEXT NOT NULL,
        season INTEGER NOT NULL,
        comp_level TEXT NOT NULL,
        match_number INTEGER NOT NULL,
        set_number INTEGER NOT NULL,
        start_time INTEGER,
        red_json TEXT NOT NULL,
        blue_json TEXT NOT NULL,
        winning_alliance TEXT,
        source TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_matches_event ON matches(event_key);
      CREATE INDEX IF NOT EXISTS idx_matches_season ON matches(season);

      CREATE TABLE IF NOT EXISTS statbotics_signals (
        id TEXT PRIMARY KEY,
        team_key TEXT NOT NULL,
        season INTEGER NOT NULL,
        event_key TEXT,
        overall_epa REAL,
        auto_epa REAL,
        teleop_epa REAL,
        endgame_epa REAL,
        source_kind TEXT NOT NULL,
        raw_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_statbotics_team_season ON statbotics_signals(team_key, season);
      CREATE INDEX IF NOT EXISTS idx_statbotics_event ON statbotics_signals(event_key);

      CREATE TABLE IF NOT EXISTS scouting_observations (
        id TEXT PRIMARY KEY,
        source TEXT NOT NULL,
        event_key TEXT NOT NULL,
        match_key TEXT NOT NULL,
        team_key TEXT NOT NULL,
        alliance TEXT,
        offense_points REAL,
        defense_value REAL,
        played_defense INTEGER,
        reliability_penalty REAL,
        observed_at INTEGER,
        raw_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_scouting_match ON scouting_observations(event_key, match_key);
      CREATE INDEX IF NOT EXISTS idx_scouting_team ON scouting_observations(team_key);

      CREATE TABLE IF NOT EXISTS research_runs (
        run_id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        best_model_name TEXT,
        summary_json TEXT NOT NULL
      );
    `);
  }

  upsertRawPayload(input: RawPayloadInput) {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO raw_payloads
          (source, endpoint_key, event_key, season, fetched_at, payload_json)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(input.source, input.endpointKey, input.eventKey ?? '', input.season ?? 0, nowIso(), encode(input.payload));
  }

  upsertMatches(matches: HistoricalMatch[]) {
    const statement = this.db.prepare(
      `INSERT OR REPLACE INTO matches
        (match_key, event_key, season, comp_level, match_number, set_number, start_time,
         red_json, blue_json, winning_alliance, source, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    const write = this.db.transaction((items: HistoricalMatch[]) => {
      items.forEach(match => {
        statement.run(
          match.key,
          match.eventKey,
          match.season,
          match.compLevel,
          match.matchNumber,
          match.setNumber,
          match.startTime,
          encode(match.red),
          encode(match.blue),
          match.winningAlliance ?? null,
          match.source,
          nowIso()
        );
      });
    });
    write(matches);
  }

  getMatches(filters: { eventKey?: string; season?: number } = {}): HistoricalMatch[] {
    const clauses: string[] = [];
    const params: unknown[] = [];
    if (filters.eventKey) {
      clauses.push('event_key = ?');
      params.push(filters.eventKey);
    }
    if (filters.season) {
      clauses.push('season = ?');
      params.push(filters.season);
    }

    const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = this.db
      .prepare(`SELECT * FROM matches ${where} ORDER BY season, COALESCE(start_time, 0), event_key, comp_level, match_number`)
      .all(...params) as Array<Record<string, unknown>>;

    return rows.map(row => ({
      key: String(row.match_key),
      eventKey: String(row.event_key),
      season: Number(row.season),
      compLevel: String(row.comp_level),
      matchNumber: Number(row.match_number),
      setNumber: Number(row.set_number),
      startTime: row.start_time == null ? null : Number(row.start_time),
      red: decode(String(row.red_json), {
        score: -1,
        teamKeys: [],
        foulPoints: null,
        techFoulCount: null,
        foulCount: null,
        componentPoints: {}
      }),
      blue: decode(String(row.blue_json), {
        score: -1,
        teamKeys: [],
        foulPoints: null,
        techFoulCount: null,
        foulCount: null,
        componentPoints: {}
      }),
      winningAlliance: (row.winning_alliance as HistoricalMatch['winningAlliance']) ?? null,
      source: row.source as DataSource
    }));
  }

  upsertStatboticsSignals(signals: StatboticsTeamSignal[]) {
    const statement = this.db.prepare(
      `INSERT OR REPLACE INTO statbotics_signals
        (id, team_key, season, event_key, overall_epa, auto_epa, teleop_epa, endgame_epa, source_kind, raw_json, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    const write = this.db.transaction((items: StatboticsTeamSignal[]) => {
      items.forEach(signal => {
        statement.run(
          signal.id,
          signal.teamKey,
          signal.season,
          signal.eventKey,
          signal.overallEpa,
          signal.autoEpa,
          signal.teleopEpa,
          signal.endgameEpa,
          signal.sourceKind,
          encode(signal.raw),
          nowIso()
        );
      });
    });
    write(signals);
  }

  getStatboticsSignals(): StatboticsTeamSignal[] {
    const rows = this.db.prepare('SELECT * FROM statbotics_signals ORDER BY season, team_key').all() as Array<
      Record<string, unknown>
    >;
    return rows.map(row => ({
      id: String(row.id),
      teamKey: String(row.team_key),
      season: Number(row.season),
      eventKey: row.event_key == null ? null : String(row.event_key),
      overallEpa: row.overall_epa == null ? null : Number(row.overall_epa),
      autoEpa: row.auto_epa == null ? null : Number(row.auto_epa),
      teleopEpa: row.teleop_epa == null ? null : Number(row.teleop_epa),
      endgameEpa: row.endgame_epa == null ? null : Number(row.endgame_epa),
      sourceKind: row.source_kind as StatboticsTeamSignal['sourceKind'],
      raw: decode(row.raw_json, {})
    }));
  }

  upsertScoutingObservations(observations: ScoutingObservation[]) {
    const statement = this.db.prepare(
      `INSERT OR REPLACE INTO scouting_observations
        (id, source, event_key, match_key, team_key, alliance, offense_points, defense_value,
         played_defense, reliability_penalty, observed_at, raw_json, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    const write = this.db.transaction((items: ScoutingObservation[]) => {
      items.forEach(observation => {
        statement.run(
          observation.id,
          observation.source,
          observation.eventKey,
          observation.matchKey,
          observation.teamKey,
          observation.alliance,
          observation.offensePoints,
          observation.defenseValue,
          observation.playedDefense == null ? null : observation.playedDefense ? 1 : 0,
          observation.reliabilityPenalty,
          observation.observedAt,
          encode(observation.raw),
          nowIso()
        );
      });
    });
    write(observations);
  }

  getScoutingObservations(): ScoutingObservation[] {
    const rows = this.db.prepare('SELECT * FROM scouting_observations ORDER BY event_key, match_key').all() as Array<
      Record<string, unknown>
    >;
    return rows.map(row => ({
      id: String(row.id),
      source: row.source as DataSource,
      eventKey: String(row.event_key),
      matchKey: String(row.match_key),
      teamKey: String(row.team_key),
      alliance: row.alliance === 'red' || row.alliance === 'blue' ? row.alliance : null,
      offensePoints: row.offense_points == null ? null : Number(row.offense_points),
      defenseValue: row.defense_value == null ? null : Number(row.defense_value),
      playedDefense: row.played_defense == null ? null : Number(row.played_defense) === 1,
      reliabilityPenalty: row.reliability_penalty == null ? null : Number(row.reliability_penalty),
      observedAt: row.observed_at == null ? null : Number(row.observed_at),
      raw: decode(row.raw_json, {})
    }));
  }

  saveResearchRun(run: ResearchRun) {
    const compact = compactResearchRun(run);
    this.db
      .prepare(
        `INSERT OR REPLACE INTO research_runs
          (run_id, created_at, best_model_name, summary_json)
         VALUES (?, ?, ?, ?)`
      )
      .run(compact.runId, compact.createdAt, compact.bestModelName, encode(compact));
  }

  getLatestResearchRun(): ResearchRun | null {
    const row = this.db
      .prepare('SELECT summary_json FROM research_runs ORDER BY created_at DESC LIMIT 1')
      .get() as Record<string, unknown> | undefined;
    return row ? decode(String(row.summary_json), null) : null;
  }

  close() {
    this.db.close();
  }
}
