import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarClock, RefreshCw, Sparkles, Swords, Trophy } from 'lucide-react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { TBA_API_KEY } from '../../config';
import { calculateLegacyOprRatings, calculateLegacyOprcRatings, TBAMatch } from '../../utils/mathEngine';
import {
  buildCompletedMatchComparisons,
  buildPlayoffProjection,
  buildQualificationProjection,
  buildQualificationPredictions,
  CompletedMatchComparisonRow,
  getPredictorModelSummary,
  PredictedAllianceSide,
  PredictedMatchRow,
  ProjectedQualificationTeamRow,
  QualificationModel,
  QualificationProjectionResult,
  TBAEliminationAlliance,
  TBAEventSummary
} from '../../utils/matchPredictor';
import { fetchEventStatboticsEpa, StatboticsNormalizedTeamEpa } from '../../utils/statbotics';

interface MatchPredictorProps {
  eventKey: string;
}

type ComparisonPhaseFilter = 'all' | 'qualification' | 'playoff';
type PredictorViewTab = 'quals' | 'playoffs' | 'comparison';
type QualificationRankingTab = QualificationModel;

interface TbaRankingsResponse {
  rankings?: Array<{
    team_key: string;
    rank: number;
  }>;
}

const isPlayedMatch = (match: TBAMatch) =>
  match.alliances.red.score !== -1 && match.alliances.blue.score !== -1;

const formatTimestamp = (timestamp: number | null) => {
  if (!timestamp) return 'Time pending';

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(timestamp * 1000));
};

const formatTeamList = (teamKeys: string[]) =>
  teamKeys.length > 0 ? teamKeys.map(teamKey => teamKey.replace('frc', '')).join(' • ') : 'TBD';

const formatPhaseLabel = (phase: ComparisonPhaseFilter | 'qualification' | 'playoff') =>
  phase === 'qualification' ? 'Qualifications' : phase === 'playoff' ? 'Playoffs' : 'All Matches';

const formatRecord = (row: Pick<ProjectedQualificationTeamRow, 'wins' | 'losses' | 'ties'>) =>
  `${row.wins}-${row.losses}-${row.ties}`;

const normalizeTeamKey = (teamKey: string) => teamKey.replace('frc', '');

const getPickResult = (row: CompletedMatchComparisonRow) => {
  if (row.actualTie || row.predictedTie) return 'Tie';
  return row.winnerPickCorrect ? 'Correct' : 'Incorrect';
};

function ComparisonTooltip({
  active,
  payload
}: {
  active?: boolean;
  payload?: Array<{ payload: ChartComparisonRow }>;
}) {
  if (!active || !payload?.length) return null;

  const row = payload[0]?.payload;
  if (!row) return null;

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-950/95 px-4 py-3 shadow-2xl">
      <div className="text-sm font-black text-white">{row.title}</div>
      <div className="text-xs font-semibold text-slate-500 mt-1">{row.matchKey}</div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-3 text-sm">
        <div className="text-amber-300 font-semibold">Actual Winner</div>
        <div className="text-right text-amber-100">{row.actualWinnerScore}</div>
        <div className="text-amber-300/80 font-semibold">Predicted Winner</div>
        <div className="text-right text-amber-100">{row.predictedWinnerScore}</div>
        <div className="text-amber-300/70 font-semibold">Aligned Winner</div>
        <div className="text-right text-amber-100">{row.chartPredictedWinnerScore.toFixed(1)}</div>
        <div className="text-cyan-300 font-semibold">Actual Loser</div>
        <div className="text-right text-cyan-100">{row.actualLoserScore}</div>
        <div className="text-cyan-300/80 font-semibold">Predicted Loser</div>
        <div className="text-right text-cyan-100">{row.predictedLoserScore}</div>
        <div className="text-cyan-300/70 font-semibold">Aligned Loser</div>
        <div className="text-right text-cyan-100">{row.chartPredictedLoserScore.toFixed(1)}</div>
      </div>
      <div className="mt-3 text-xs font-semibold text-slate-400">
        Pick Result: <span className="text-white">{getPickResult(row)}</span>
      </div>
    </div>
  );
}

interface LinearCalibration {
  slope: number;
  intercept: number;
}

interface ChartComparisonRow extends CompletedMatchComparisonRow {
  chartPredictedWinnerScore: number;
  chartPredictedLoserScore: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const fitLinearCalibration = (pairs: Array<{ predicted: number; actual: number }>): LinearCalibration => {
  if (pairs.length === 0) {
    return { slope: 1, intercept: 0 };
  }

  if (pairs.length === 1) {
    const pair = pairs[0]!;
    return {
      slope: 1,
      intercept: pair.actual - pair.predicted
    };
  }

  const meanPredicted = pairs.reduce((sum, pair) => sum + pair.predicted, 0) / pairs.length;
  const meanActual = pairs.reduce((sum, pair) => sum + pair.actual, 0) / pairs.length;

  const covariance = pairs.reduce(
    (sum, pair) => sum + (pair.predicted - meanPredicted) * (pair.actual - meanActual),
    0
  );
  const variance = pairs.reduce(
    (sum, pair) => sum + Math.pow(pair.predicted - meanPredicted, 2),
    0
  );

  const rawSlope = variance === 0 ? 1 : covariance / variance;
  const slope = clamp(Number.isFinite(rawSlope) ? rawSlope : 1, 0.35, 2.5);
  const intercept = meanActual - slope * meanPredicted;

  return { slope, intercept };
};

const applyCalibration = (value: number, calibration: LinearCalibration) =>
  Math.max(0, calibration.intercept + calibration.slope * value);

function ComparisonTrendChart({
  title,
  subtitle,
  data,
  mode
}: {
  title: string;
  subtitle: string;
  data: CompletedMatchComparisonRow[];
  mode: 'winner' | 'loser';
}) {
  const isWinnerChart = mode === 'winner';
  const chartData = useMemo<ChartComparisonRow[]>(() => {
    const calibration = fitLinearCalibration(
      data.map(row => ({
        predicted: isWinnerChart ? row.predictedWinnerScore : row.predictedLoserScore,
        actual: isWinnerChart ? row.actualWinnerScore : row.actualLoserScore
      }))
    );

    return data.map(row => ({
      ...row,
      chartPredictedWinnerScore: applyCalibration(row.predictedWinnerScore, calibration),
      chartPredictedLoserScore: applyCalibration(row.predictedLoserScore, calibration)
    }));
  }, [data, isWinnerChart]);

  const valueKeys = isWinnerChart
    ? (['actualWinnerScore', 'chartPredictedWinnerScore'] as const)
    : (['actualLoserScore', 'chartPredictedLoserScore'] as const);

  const chartDomain = useMemo<[number, number]>(() => {
    const values = chartData
      .flatMap(row => valueKeys.map(key => row[key]))
      .filter(value => Number.isFinite(value));

    if (values.length === 0) {
      return [0, 100];
    }

    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const range = Math.max(20, maxValue - minValue);
    const padding = Math.max(10, range * 0.1);
    const minDomain = Math.max(0, Math.floor((minValue - padding) / 10) * 10);
    const maxDomain = Math.ceil((maxValue + padding) / 10) * 10;

    return [minDomain, maxDomain];
  }, [chartData, valueKeys]);

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
      <div className="mb-4">
        <h4 className="text-lg font-black text-white">{title}</h4>
        <p className="text-sm text-slate-400 mt-1">{subtitle}</p>
        <p className="text-xs font-semibold text-slate-500 mt-2">
          The dotted line is visually aligned to the event&apos;s scoring scale so the trend comparison is easier to read.
        </p>
      </div>
      <div className="h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 6, right: 20, bottom: 8, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis
              dataKey="title"
              stroke="#64748b"
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              minTickGap={24}
            />
            <YAxis
              domain={chartDomain}
              stroke="#64748b"
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              tickCount={6}
            />
            <Tooltip content={<ComparisonTooltip />} />
            <Legend wrapperStyle={{ color: '#cbd5e1', fontSize: '12px' }} />
            {isWinnerChart ? (
              <>
                <Line
                  type="monotoneX"
                  dataKey="actualWinnerScore"
                  name="Actual Winner"
                  stroke="#f59e0b"
                  strokeWidth={3}
                  dot={false}
                  activeDot={{ r: 5, fill: '#f59e0b', strokeWidth: 0 }}
                />
                <Line
                  type="monotoneX"
                  dataKey="chartPredictedWinnerScore"
                  name="Aligned Predicted Winner"
                  stroke="#fbbf24"
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  dot={false}
                  activeDot={{ r: 5, fill: '#fbbf24', strokeWidth: 0 }}
                />
              </>
            ) : (
              <>
                <Line
                  type="monotoneX"
                  dataKey="actualLoserScore"
                  name="Actual Loser"
                  stroke="#22d3ee"
                  strokeWidth={3}
                  dot={false}
                  activeDot={{ r: 5, fill: '#22d3ee', strokeWidth: 0 }}
                />
                <Line
                  type="monotoneX"
                  dataKey="chartPredictedLoserScore"
                  name="Aligned Predicted Loser"
                  stroke="#67e8f9"
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  dot={false}
                  activeDot={{ r: 5, fill: '#67e8f9', strokeWidth: 0 }}
                />
              </>
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function AllianceSide({
  side,
  color,
  isWinner
}: {
  side: PredictedAllianceSide;
  color: 'red' | 'blue';
  isWinner: boolean;
}) {
  return (
    <div className={`rounded-xl border p-4 ${color === 'red' ? 'border-red-500/30 bg-red-950/20' : 'border-blue-500/30 bg-blue-950/20'}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className={`text-xs font-black uppercase tracking-widest ${color === 'red' ? 'text-red-300' : 'text-blue-300'}`}>
              {side.label}
            </div>
            {isWinner && (
              <span
                className="inline-flex items-center justify-center rounded-full bg-amber-400/20 border border-amber-300/40 p-1"
                title="Winning side"
              >
                <Trophy className="w-3 h-3 text-amber-300" />
              </span>
            )}
          </div>
          <div className="text-sm text-slate-300 mt-1">{formatTeamList(side.teamKeys)}</div>
        </div>
        <div className={`text-2xl font-black ${color === 'red' ? 'text-red-300' : 'text-blue-300'}`}>
          {side.score == null ? '--' : side.score.toFixed(1)}
        </div>
      </div>
      {side.actualScore != null && (
        <div className="mt-2 text-xs font-semibold text-slate-400">
          Actual: {side.actualScore}
        </div>
      )}
      {side.isBye && (
        <div className="mt-2 text-xs font-semibold text-amber-300">BYE</div>
      )}
    </div>
  );
}

function PredictionCard({ match }: { match: PredictedMatchRow }) {
  const winnerColor =
    match.predictedWinner === 'red'
      ? 'text-red-300'
      : match.predictedWinner === 'blue'
        ? 'text-blue-300'
        : 'text-slate-300';

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-black text-white">{match.title}</div>
          <div className="text-xs font-semibold text-slate-500 mt-1">{formatTimestamp(match.scheduledTime)}</div>
        </div>
        <div className="text-right">
          <div className={`text-xs font-black uppercase tracking-widest ${
            match.status === 'played'
              ? 'text-emerald-300'
              : match.status === 'bye'
                ? 'text-amber-300'
                : match.status === 'if-necessary'
                  ? 'text-slate-400'
                  : 'text-cyan-300'
          }`}>
            {match.status === 'played'
              ? 'Actual Result'
              : match.status === 'bye'
                ? 'Auto Advance'
                : match.status === 'if-necessary'
                  ? 'If Necessary'
                  : 'Predicted'}
          </div>
          {match.confidence != null && (
            <div className="text-xs font-semibold text-slate-400 mt-1">{match.confidence}% confidence</div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <AllianceSide side={match.red} color="red" isWinner={match.predictedWinner === 'red'} />
        <AllianceSide side={match.blue} color="blue" isWinner={match.predictedWinner === 'blue'} />
      </div>

      <div className="flex items-center justify-between gap-4 pt-2 border-t border-slate-800">
        <div className="text-xs font-semibold text-slate-500">{match.matchKey}</div>
        <div className={`text-sm font-black ${winnerColor}`}>
          {match.predictedWinnerLabel}
        </div>
      </div>
    </div>
  );
}

function QualificationRankingSummaryCard({
  projection,
  title
}: {
  projection: QualificationProjectionResult;
  title: string;
}) {
  const leader = projection.summary.leader;

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
      <div className="text-xs font-black uppercase tracking-widest text-slate-500">{title}</div>
      {leader ? (
        <>
          <div className="mt-3 flex items-end justify-between gap-4">
            <div>
              <div className="text-3xl font-black text-white">#{leader.projectedRank}</div>
              <div className="text-sm text-slate-400 mt-2">Team {leader.teamNumber}</div>
            </div>
            <div className="text-right">
              <div className="text-xs font-black uppercase tracking-widest text-slate-500">Projected RP</div>
              <div className="text-3xl font-black text-cyan-300 mt-2">{leader.projectedTotalRp}</div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-xs font-black uppercase tracking-widest text-slate-500">Record</div>
              <div className="mt-2 font-bold text-white">{formatRecord(leader)}</div>
            </div>
            <div>
              <div className="text-xs font-black uppercase tracking-widest text-slate-500">Current TBA Rank</div>
              <div className="mt-2 font-bold text-white">
                {leader.currentTbaRank != null ? `#${leader.currentTbaRank}` : '--'}
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="text-sm text-slate-400 mt-3">No qualification teams are available for this event yet.</div>
      )}
    </div>
  );
}

export default function MatchPredictor({ eventKey }: MatchPredictorProps) {
  const [matches, setMatches] = useState<TBAMatch[]>([]);
  const [alliances, setAlliances] = useState<TBAEliminationAlliance[] | null>(null);
  const [eventSummary, setEventSummary] = useState<TBAEventSummary | null>(null);
  const [localOprcRatings, setLocalOprcRatings] = useState<Record<string, number>>({});
  const [localOprRatings, setLocalOprRatings] = useState<Record<string, number>>({});
  const [currentTbaRanks, setCurrentTbaRanks] = useState<Record<string, number>>({});
  const [currentTbaRankOrder, setCurrentTbaRankOrder] = useState<string[]>([]);
  const [statboticsEpaByTeam, setStatboticsEpaByTeam] = useState<Record<string, StatboticsNormalizedTeamEpa>>({});
  const [statboticsEpaWarning, setStatboticsEpaWarning] = useState('');
  const [isStatboticsLoading, setIsStatboticsLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [comparisonPhaseFilter, setComparisonPhaseFilter] = useState<ComparisonPhaseFilter>('all');
  const [predictorViewTab, setPredictorViewTab] = useState<PredictorViewTab>('quals');
  const [qualificationRankingTab, setQualificationRankingTab] = useState<QualificationRankingTab>('epa');
  const [qualificationThreshold, setQualificationThreshold] = useState(55);

  const fetchPredictorData = async () => {
    if (eventKey === 'TEST') {
      setMatches([]);
      setAlliances(null);
      setEventSummary(null);
      setLocalOprcRatings({});
      setLocalOprRatings({});
      setCurrentTbaRanks({});
      setCurrentTbaRankOrder([]);
      setStatboticsEpaByTeam({});
      setStatboticsEpaWarning('');
      setError('');
      return;
    }

    setIsLoading(true);
    setError('');
    setStatboticsEpaWarning('');
    try {
      const normalizedEventKey = eventKey.trim().toLowerCase();
      const headers = { 'X-TBA-Auth-Key': TBA_API_KEY };
      const [matchesResponse, alliancesResponse, summaryResponse, rankingsResponse] = await Promise.all([
        fetch(`https://www.thebluealliance.com/api/v3/event/${normalizedEventKey}/matches`, { headers }),
        fetch(`https://www.thebluealliance.com/api/v3/event/${normalizedEventKey}/alliances`, { headers }),
        fetch(`https://www.thebluealliance.com/api/v3/event/${normalizedEventKey}/simple`, { headers }),
        fetch(`https://www.thebluealliance.com/api/v3/event/${normalizedEventKey}/rankings`, { headers })
      ]);

      if (!matchesResponse.ok) {
        const errorText = await matchesResponse.text();
        throw new Error(`Failed to fetch TBA matches: ${matchesResponse.status} ${matchesResponse.statusText} - ${errorText}`);
      }

      const nextMatches = (await matchesResponse.json()) as TBAMatch[];
      const nextAlliances = alliancesResponse.ok
        ? ((await alliancesResponse.json()) as TBAEliminationAlliance[])
        : null;
      const nextSummary = summaryResponse.ok
        ? ((await summaryResponse.json()) as TBAEventSummary)
        : null;
      const nextRankings = rankingsResponse.ok
        ? ((await rankingsResponse.json()) as TbaRankingsResponse)
        : null;
      const nextLocalOprcRatings = calculateLegacyOprcRatings(nextMatches);
      const nextLocalOprRatings = calculateLegacyOprRatings(nextMatches);
      const nextTbaRanks: Record<string, number> = {};
      const nextTbaRankOrder: string[] = [];

      nextRankings?.rankings?.forEach(ranking => {
        const teamNumber = normalizeTeamKey(ranking.team_key);
        nextTbaRanks[teamNumber] = ranking.rank;
        nextTbaRankOrder.push(teamNumber);
      });

      setMatches(nextMatches);
      setAlliances(nextAlliances);
      setEventSummary(nextSummary);
      setLocalOprcRatings(nextLocalOprcRatings);
      setLocalOprRatings(nextLocalOprRatings);
      setCurrentTbaRanks(nextTbaRanks);
      setCurrentTbaRankOrder(nextTbaRankOrder);

      const qualificationTeamNumbers = Array.from(
        new Set(
          nextMatches
            .filter(match => match.comp_level === 'qm')
            .flatMap(match => [
              ...match.alliances.red.team_keys.map(normalizeTeamKey),
              ...match.alliances.blue.team_keys.map(normalizeTeamKey)
            ])
        )
      ).sort((a, b) => Number.parseInt(a, 10) - Number.parseInt(b, 10));

      setStatboticsEpaByTeam({});
      setIsStatboticsLoading(true);
      void fetchEventStatboticsEpa(normalizedEventKey, qualificationTeamNumbers)
        .then(result => {
          setStatboticsEpaByTeam(result.epaByTeam);

          if (result.missingTeams.length > 0) {
            setStatboticsEpaWarning(
              `EPA data is unavailable for ${result.missingTeams.length} team${result.missingTeams.length === 1 ? '' : 's'}. The EPA tab will fall back to OPRc where needed.`
            );
            return;
          }

          if (result.usedTeamYearFallback > 0) {
            setStatboticsEpaWarning(
              `${result.usedTeamYearFallback} team${result.usedTeamYearFallback === 1 ? '' : 's'} are using Statbotics team-year EPA because event-specific EPA was not available yet.`
            );
            return;
          }

          setStatboticsEpaWarning('');
        })
        .catch(fetchError => {
          console.error('Error loading Statbotics EPA data:', fetchError);
          setStatboticsEpaByTeam({});
          setStatboticsEpaWarning('EPA data is unavailable right now. The EPA tab will use OPRc until Statbotics responds again.');
        })
        .finally(() => {
          setIsStatboticsLoading(false);
        });
    } catch (err) {
      console.error('Error loading predictor data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load predictor data.');
      setMatches([]);
      setAlliances(null);
      setEventSummary(null);
      setLocalOprcRatings({});
      setLocalOprRatings({});
      setCurrentTbaRanks({});
      setCurrentTbaRankOrder([]);
      setStatboticsEpaByTeam({});
      setStatboticsEpaWarning('');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchPredictorData();
  }, [eventKey]);

  const completedQualificationMatches = useMemo(
    () => matches.filter(match => match.comp_level === 'qm' && isPlayedMatch(match)).length,
    [matches]
  );

  const qualificationThresholdReached = completedQualificationMatches >= qualificationThreshold;

  useEffect(() => {
    if (!qualificationThresholdReached && qualificationRankingTab !== 'epa') {
      setQualificationRankingTab('epa');
    }
  }, [qualificationRankingTab, qualificationThresholdReached]);

  const completedMatches = useMemo(
    () => matches.filter(isPlayedMatch),
    [matches]
  );

  const qualificationPredictions = useMemo(
    () => buildQualificationPredictions(matches, localOprcRatings),
    [localOprcRatings, matches]
  );

  const epaOverallRatings = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(statboticsEpaByTeam).map(([teamNumber, metrics]) => [
          teamNumber,
          metrics.overallEPA
        ])
      ),
    [statboticsEpaByTeam]
  );

  const epaBonusMetrics = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(statboticsEpaByTeam).map(([teamNumber, metrics]) => [
          teamNumber,
          {
            fuelEPA: metrics.fuelEPA,
            towerEPA: metrics.towerEPA
          }
        ])
      ),
    [statboticsEpaByTeam]
  );

  const completedComparisons = useMemo(
    () => buildCompletedMatchComparisons(matches, localOprcRatings, alliances, eventSummary),
    [alliances, eventSummary, localOprcRatings, matches]
  );

  const modelSummary = useMemo(
    () => getPredictorModelSummary(completedComparisons),
    [completedComparisons]
  );

  const playoffProjection = useMemo(
    () => buildPlayoffProjection(
      alliances,
      matches.filter(match => match.comp_level !== 'qm'),
      completedMatches,
      localOprcRatings,
      eventSummary
    ),
    [alliances, completedMatches, eventSummary, localOprcRatings, matches]
  );

  const hasUsableEpaMetrics = useMemo(
    () => Object.keys(epaOverallRatings).length > 0,
    [epaOverallRatings]
  );

  const qualificationProjections = useMemo(() => {
    const epaProjection = buildQualificationProjection({
      matches,
      currentTbaRanks,
      currentTbaRankOrder,
      modelLabel: hasUsableEpaMetrics ? 'EPA' : 'EPA (OPRc Fallback)',
      overallRatings: hasUsableEpaMetrics ? epaOverallRatings : localOprcRatings,
      qualificationBonusMetrics: hasUsableEpaMetrics ? epaBonusMetrics : undefined
    });

    const oprcProjection = buildQualificationProjection({
      matches,
      currentTbaRanks,
      currentTbaRankOrder,
      modelLabel: 'OPRc',
      overallRatings: localOprcRatings,
      qualificationBonusMetrics: hasUsableEpaMetrics ? epaBonusMetrics : undefined
    });

    const oprProjection = buildQualificationProjection({
      matches,
      currentTbaRanks,
      currentTbaRankOrder,
      modelLabel: 'OPR',
      overallRatings: localOprRatings,
      qualificationBonusMetrics: hasUsableEpaMetrics ? epaBonusMetrics : undefined
    });

    return {
      epa: epaProjection,
      oprc: oprcProjection,
      opr: oprProjection
    } as Record<QualificationRankingTab, QualificationProjectionResult>;
  }, [
    currentTbaRankOrder,
    currentTbaRanks,
    epaBonusMetrics,
    epaOverallRatings,
    hasUsableEpaMetrics,
    localOprRatings,
    localOprcRatings,
    matches
  ]);

  const activeQualificationProjection = qualificationProjections[qualificationRankingTab];

  const filteredComparisons = useMemo(
    () =>
      completedComparisons.filter(row =>
        comparisonPhaseFilter === 'all' ? true : row.phase === comparisonPhaseFilter
      ),
    [comparisonPhaseFilter, completedComparisons]
  );

  const comparisonSummary = useMemo(() => {
    const decisiveRows = filteredComparisons.filter(row => row.winnerPickCorrect !== null);
    const correctRows = decisiveRows.filter(row => row.winnerPickCorrect).length;
    return {
      count: filteredComparisons.length,
      winnerAccuracy: decisiveRows.length > 0 ? (correctRows / decisiveRows.length) * 100 : null,
      meanAbsoluteError:
        filteredComparisons.length > 0
          ? filteredComparisons.reduce((sum, row) => sum + row.absoluteErrorMean, 0) / filteredComparisons.length
          : null
    };
  }, [filteredComparisons]);

  const handleRefresh = async () => {
    await fetchPredictorData();
  };

  const predictorBusy = isLoading;
  const noCompletedMatchesYet = completedMatches.length === 0;

  if (eventKey === 'TEST') {
    return (
      <div className="bg-amber-950/30 border border-amber-500/30 text-amber-100 p-6 rounded-2xl flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />
        <div>
          <h3 className="font-black text-white">Match Predictor Unavailable in TEST Mode</h3>
          <p className="text-sm text-amber-100/80 mt-2">
            TEST mode has no TBA schedule or official match result feed, so the predictor cannot generate qualification or playoff forecasts.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-3xl font-black text-white flex items-center gap-3">
            <Swords className="w-8 h-8 text-cyan-400" />
            MATCH PREDICTOR
          </h2>
          <p className="text-slate-400 mt-2 max-w-3xl">
            Forecast qualification and playoff matches using our local OPRc model, updated from official TBA match results throughout the event.
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={predictorBusy}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${predictorBusy ? 'animate-spin' : ''}`} />
          REFRESH PREDICTOR
        </button>
      </div>

      {error && (
        <div className="bg-red-950/40 border border-red-500/40 text-red-200 p-5 rounded-2xl flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div className="font-medium">{error}</div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
          <div className="text-xs font-black uppercase tracking-widest text-slate-500">Match Prediction Model</div>
          <div className="text-2xl font-black text-white mt-2">{modelSummary.label}</div>
          <div className="text-sm text-slate-400 mt-2">
            Match cards, playoff projections, and backtests are using local OPRc. Qualification ranking projection has its own EPA / OPRc / OPR model tabs below.
          </div>
        </div>
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
          <div className="text-xs font-black uppercase tracking-widest text-slate-500">Calibration</div>
          <div className="text-2xl font-black text-white mt-2">{modelSummary.calibrationMatches}</div>
          <div className="text-sm text-slate-400 mt-2">
            Completed matches feeding the current OPRc ratings.
          </div>
        </div>
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
          <div className="text-xs font-black uppercase tracking-widest text-slate-500">Winner Accuracy</div>
          <div className="text-2xl font-black text-cyan-300 mt-2">
            {(modelSummary.winnerAccuracy * 100).toFixed(1)}%
          </div>
          <div className="text-sm text-slate-400 mt-2">Across completed event matches so far.</div>
        </div>
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
          <div className="text-xs font-black uppercase tracking-widest text-slate-500">Score Error</div>
          <div className="text-2xl font-black text-amber-300 mt-2">
            {modelSummary.meanAbsoluteError.toFixed(1)}
          </div>
          <div className="text-sm text-slate-400 mt-2">Average absolute alliance score error.</div>
        </div>
      </div>

      {noCompletedMatchesYet && !error && (
        <div className="bg-amber-950/30 border border-amber-500/30 text-amber-100 p-5 rounded-2xl flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />
          <div className="font-medium">
            No completed matches are available yet. We can still show the schedule, but the backtest cards will stay empty until the first official results arrive.
          </div>
        </div>
      )}

      <div className="inline-flex w-full flex-wrap items-center gap-2 rounded-2xl border border-slate-800 bg-slate-900/60 p-2">
        {([
          { key: 'quals', label: 'Quals Prediction' },
          { key: 'playoffs', label: 'Playoffs Prediction' },
          { key: 'comparison', label: 'Prediction vs Actual' }
        ] as Array<{ key: PredictorViewTab; label: string }>).map(tab => (
          <button
            key={tab.key}
            onClick={() => setPredictorViewTab(tab.key)}
            className={`rounded-xl px-4 py-3 text-sm font-black transition-colors ${
              predictorViewTab === tab.key
                ? 'bg-cyan-500 text-slate-950'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {predictorViewTab === 'comparison' && (
        <section className="space-y-5">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h3 className="text-2xl font-black text-white">Prediction vs Actual</h3>
              <p className="text-sm text-slate-400 mt-1">
                Completed-match backtest using our local OPRc predicted scores against actual TBA results.
              </p>
            </div>
            <div className="inline-flex items-center gap-1 rounded-xl border border-slate-800 bg-slate-900/60 p-1">
              {(['all', 'qualification', 'playoff'] as ComparisonPhaseFilter[]).map(filter => (
                <button
                  key={filter}
                  onClick={() => setComparisonPhaseFilter(filter)}
                  className={`px-3 py-2 rounded-lg text-sm font-bold transition-colors ${
                    comparisonPhaseFilter === filter
                      ? 'bg-cyan-500 text-slate-950'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  {formatPhaseLabel(filter)}
                </button>
              ))}
            </div>
          </div>

          {filteredComparisons.length === 0 ? (
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 text-slate-400">
              No completed {comparisonPhaseFilter === 'all' ? '' : `${formatPhaseLabel(comparisonPhaseFilter).toLowerCase()} `}matches are available yet for backtesting.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
                  <div className="text-xs font-black uppercase tracking-widest text-slate-500">Completed Matches</div>
                  <div className="text-3xl font-black text-white mt-2">{comparisonSummary.count}</div>
                  <div className="text-sm text-slate-400 mt-2">{formatPhaseLabel(comparisonPhaseFilter)} in this backtest view.</div>
                </div>
                <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
                  <div className="text-xs font-black uppercase tracking-widest text-slate-500">Winner Pick Accuracy</div>
                  <div className="text-3xl font-black text-amber-300 mt-2">
                    {comparisonSummary.winnerAccuracy == null ? '--' : `${comparisonSummary.winnerAccuracy.toFixed(1)}%`}
                  </div>
                  <div className="text-sm text-slate-400 mt-2">Tie rows are excluded from the percentage.</div>
                </div>
                <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
                  <div className="text-xs font-black uppercase tracking-widest text-slate-500">Mean Absolute Score Error</div>
                  <div className="text-3xl font-black text-cyan-300 mt-2">
                    {comparisonSummary.meanAbsoluteError == null ? '--' : comparisonSummary.meanAbsoluteError.toFixed(1)}
                  </div>
                  <div className="text-sm text-slate-400 mt-2">Average normalized Winner/Loser score miss.</div>
                </div>
              </div>

              <div className="space-y-4">
                <ComparisonTrendChart
                  title="Winners Graph"
                  subtitle="Actual vs predicted winner scores across completed matches."
                  data={filteredComparisons}
                  mode="winner"
                />
                <ComparisonTrendChart
                  title="Losers Graph"
                  subtitle="Actual vs predicted loser scores across completed matches."
                  data={filteredComparisons}
                  mode="loser"
                />
              </div>

              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
                <div className="p-5 border-b border-slate-800">
                  <h4 className="text-lg font-black text-white">Match-by-Match Comparison</h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="admin-sticky-table w-full min-w-[1100px] text-left">
                    <thead className="bg-slate-950/80 text-slate-400 text-xs font-black uppercase tracking-wider">
                      <tr>
                        <th className="px-4 py-3">Match</th>
                        <th className="px-4 py-3">Phase</th>
                        <th className="px-4 py-3">Winner</th>
                        <th className="px-4 py-3">Predicted</th>
                        <th className="px-4 py-3">Actual</th>
                        <th className="px-4 py-3">Loser</th>
                        <th className="px-4 py-3">Predicted</th>
                        <th className="px-4 py-3">Actual</th>
                        <th className="px-4 py-3">Raw Red / Blue</th>
                        <th className="px-4 py-3">Pick</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-sm">
                      {filteredComparisons.map(row => {
                        const pickResult = getPickResult(row);
                        return (
                          <tr key={row.id} className="align-top">
                            <td className="px-4 py-4">
                              <div className="font-black text-white">{row.title}</div>
                              <div className="text-xs text-slate-500 mt-1">{row.matchKey}</div>
                            </td>
                            <td className="px-4 py-4">
                              <span className="inline-flex rounded-full bg-slate-800 px-3 py-1 text-xs font-bold text-slate-200">
                                {formatPhaseLabel(row.phase)}
                              </span>
                            </td>
                            <td className="px-4 py-4">
                              <div className="font-bold text-amber-200">{row.actualWinnerLabel}</div>
                              <div className="text-xs text-slate-400 mt-1">
                                {row.actualTie
                                  ? `${formatTeamList(row.redTeamKeys)} vs ${formatTeamList(row.blueTeamKeys)}`
                                  : row.actualWinnerLabel === row.redLabel
                                    ? formatTeamList(row.redTeamKeys)
                                    : formatTeamList(row.blueTeamKeys)}
                              </div>
                              {!row.actualTie && row.predictedWinnerLabel !== row.actualWinnerLabel && (
                                <div className="text-[11px] text-slate-500 mt-2">
                                  Predicted: {row.predictedWinnerLabel}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-4 text-amber-300 font-black">{row.predictedWinnerScore.toFixed(1)}</td>
                            <td className="px-4 py-4 text-amber-100 font-black">{row.actualWinnerScore}</td>
                            <td className="px-4 py-4">
                              <div className="font-bold text-cyan-200">{row.actualLoserLabel}</div>
                              <div className="text-xs text-slate-400 mt-1">
                                {row.actualTie
                                  ? `${formatTeamList(row.redTeamKeys)} vs ${formatTeamList(row.blueTeamKeys)}`
                                  : row.actualLoserLabel === row.redLabel
                                    ? formatTeamList(row.redTeamKeys)
                                    : formatTeamList(row.blueTeamKeys)}
                              </div>
                              {!row.actualTie && row.predictedLoserLabel !== row.actualLoserLabel && (
                                <div className="text-[11px] text-slate-500 mt-2">
                                  Predicted: {row.predictedLoserLabel}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-4 text-cyan-300 font-black">{row.predictedLoserScore.toFixed(1)}</td>
                            <td className="px-4 py-4 text-cyan-100 font-black">{row.actualLoserScore}</td>
                            <td className="px-4 py-4">
                              <div className="text-xs text-slate-300">
                                <span className="text-red-300 font-bold">Pred</span>{' '}
                                {row.redLabel}: {row.predictedRedScore.toFixed(1)} / {row.blueLabel}: {row.predictedBlueScore.toFixed(1)}
                              </div>
                              <div className="text-xs text-slate-400 mt-1">
                                <span className="text-red-200 font-bold">Act</span>{' '}
                                {row.redLabel}: {row.actualRedScore} / {row.blueLabel}: {row.actualBlueScore}
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <span
                                className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${
                                  pickResult === 'Correct'
                                    ? 'bg-emerald-500/15 text-emerald-300'
                                    : pickResult === 'Incorrect'
                                      ? 'bg-rose-500/15 text-rose-300'
                                      : 'bg-amber-500/15 text-amber-300'
                                }`}
                              >
                                {pickResult}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </section>
      )}

      {predictorViewTab === 'quals' && (
        <section className="space-y-5">
          <div className="flex items-center gap-3">
            <CalendarClock className="w-6 h-6 text-cyan-400" />
            <div>
              <h3 className="text-2xl font-black text-white">Qualification Forecast</h3>
              <p className="text-sm text-slate-400">Future qualification matches only, sorted by schedule.</p>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <h4 className="text-xl font-black text-white">Projected Final Qualification Ranking</h4>
                <p className="text-sm text-slate-400 mt-2 max-w-3xl">
                  We recompute the full qualification table locally from played results plus future-match projections. Before Q{qualificationThreshold}, EPA is the live model; OPRc and OPR unlock once the threshold is met or you lower it.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <label className="text-sm font-bold text-slate-300">
                  Qualification Threshold
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={qualificationThreshold}
                    onChange={event => {
                      const nextValue = Number.parseInt(event.target.value, 10);
                      if (Number.isFinite(nextValue) && nextValue > 0) {
                        setQualificationThreshold(nextValue);
                      }
                    }}
                    className="mt-2 block w-36 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-cyan-400"
                  />
                </label>
                <button
                  onClick={() => setQualificationThreshold(55)}
                  className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm font-bold text-slate-200 hover:bg-slate-900 transition-colors"
                >
                  Reset to Q55
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
              <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-5">
                <div className="text-xs font-black uppercase tracking-widest text-slate-500">Qualification Progress</div>
                <div className="text-3xl font-black text-white mt-2">
                  {completedQualificationMatches} / {qualificationThreshold}
                </div>
                <div className="text-sm text-slate-400 mt-2">
                  {qualificationThresholdReached
                    ? 'The ranking-model threshold is active.'
                    : 'EPA stays primary until this threshold is reached.'}
                </div>
              </div>
              <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-5">
                <div className="text-xs font-black uppercase tracking-widest text-slate-500">Active Tab</div>
                <div className="text-3xl font-black text-white mt-2">
                  {activeQualificationProjection.summary.activeModelLabel}
                </div>
                <div className="text-sm text-slate-400 mt-2">
                  {qualificationRankingTab === 'epa'
                    ? 'EPA uses Statbotics split EPA when available.'
                    : 'This table keeps the same RP rules but swaps the alliance-strength model.'}
                </div>
              </div>
              <QualificationRankingSummaryCard
                projection={activeQualificationProjection}
                title="Projected Event Leader"
              />
              <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-5">
                <div className="text-xs font-black uppercase tracking-widest text-slate-500">Projected Teams</div>
                <div className="text-3xl font-black text-white mt-2">
                  {activeQualificationProjection.summary.totalTeams}
                </div>
                <div className="text-sm text-slate-400 mt-2">
                  All qualification teams are recomputed from scratch with current TBA rank order as the RP tie-break.
                </div>
              </div>
            </div>

            <div className="inline-flex w-full flex-wrap items-center gap-2 rounded-2xl border border-slate-800 bg-slate-950/70 p-2">
              {([
                {
                  key: 'epa',
                  label: 'EPA',
                  disabled: false,
                  note: hasUsableEpaMetrics ? 'Live before Q55' : 'OPRc fallback'
                },
                {
                  key: 'oprc',
                  label: 'OPRc',
                  disabled: !qualificationThresholdReached,
                  note: qualificationThresholdReached ? 'Unlocked' : `Locked until Q${qualificationThreshold}`
                },
                {
                  key: 'opr',
                  label: 'OPR',
                  disabled: !qualificationThresholdReached,
                  note: qualificationThresholdReached ? 'Unlocked' : `Locked until Q${qualificationThreshold}`
                }
              ] as Array<{
                key: QualificationRankingTab;
                label: string;
                disabled: boolean;
                note: string;
              }>).map(tab => (
                <button
                  key={tab.key}
                  onClick={() => {
                    if (!tab.disabled) {
                      setQualificationRankingTab(tab.key);
                    }
                  }}
                  disabled={tab.disabled}
                  className={`rounded-xl px-4 py-3 text-left transition-colors ${
                    qualificationRankingTab === tab.key
                      ? 'bg-cyan-500 text-slate-950'
                      : tab.disabled
                        ? 'bg-slate-900 text-slate-500 cursor-not-allowed'
                        : 'text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  <div className="text-sm font-black">{tab.label}</div>
                  <div
                    className={`text-[11px] mt-1 ${
                      qualificationRankingTab === tab.key ? 'text-slate-900/80' : 'text-slate-500'
                    }`}
                  >
                    {tab.note}
                  </div>
                </button>
              ))}
            </div>

            {qualificationRankingTab === 'epa' && statboticsEpaWarning && (
              <div className="bg-amber-950/30 border border-amber-500/30 rounded-2xl p-4 text-sm text-amber-100 flex items-start gap-3">
                <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                <div>{statboticsEpaWarning}</div>
              </div>
            )}

            {isStatboticsLoading && qualificationRankingTab === 'epa' && (
              <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 text-sm text-slate-300">
                Loading Statbotics EPA splits for this event…
              </div>
            )}

            {!qualificationThresholdReached && qualificationRankingTab === 'epa' && (
              <div className="bg-cyan-950/30 border border-cyan-500/30 rounded-2xl p-4 text-sm text-cyan-100">
                EPA is the primary qualification-status model until Qualification {qualificationThreshold} is complete.
              </div>
            )}

            <div className="bg-slate-950/70 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="p-5 border-b border-slate-800">
                <h5 className="text-lg font-black text-white">
                  {activeQualificationProjection.summary.activeModelLabel} Final Ranking Projection
                </h5>
                <p className="text-sm text-slate-400 mt-1">
                  Played quals use actual results. Future quals use model-driven winner picks plus your simplified RP rules.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="admin-sticky-table w-full min-w-[1100px] text-left">
                  <thead className="bg-slate-950/80 text-slate-400 text-xs font-black uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3">Proj Rank</th>
                      <th className="px-4 py-3">Team</th>
                      <th className="px-4 py-3">Current Rank</th>
                      <th className="px-4 py-3">Projected RP</th>
                      <th className="px-4 py-3">Record</th>
                      <th className="px-4 py-3">Win RP</th>
                      <th className="px-4 py-3">Tower RP</th>
                      <th className="px-4 py-3">Energized RP</th>
                      <th className="px-4 py-3">Supercharged RP</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-sm">
                    {activeQualificationProjection.rows.map(row => (
                      <tr key={`${qualificationRankingTab}-${row.teamNumber}`} className="align-top">
                        <td className="px-4 py-4 font-black text-white">#{row.projectedRank}</td>
                        <td className="px-4 py-4 font-black text-cyan-200">{row.teamNumber}</td>
                        <td className="px-4 py-4 text-slate-300">
                          {row.currentTbaRank != null ? `#${row.currentTbaRank}` : '--'}
                        </td>
                        <td className="px-4 py-4 font-black text-white">{row.projectedTotalRp}</td>
                        <td className="px-4 py-4 text-slate-300">{formatRecord(row)}</td>
                        <td className="px-4 py-4 text-slate-300">{row.projectedWinRp}</td>
                        <td className="px-4 py-4 text-slate-300">{row.projectedTowerRp}</td>
                        <td className="px-4 py-4 text-slate-300">{row.projectedEnergizedRp}</td>
                        <td className="px-4 py-4 text-slate-300">{row.projectedSuperchargedRp}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {qualificationPredictions.length === 0 ? (
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 text-slate-400">
              Qualification schedule complete. Once alliance selection is published, the playoff predictor tab becomes active.
            </div>
          ) : (
            <div className="grid grid-cols-1 2xl:grid-cols-2 gap-4">
              {qualificationPredictions.map(match => (
                <PredictionCard key={match.id} match={match} />
              ))}
            </div>
          )}
        </section>
      )}

      {predictorViewTab === 'playoffs' && (
        <section className="space-y-5">
          <div className="flex items-center gap-3">
            <Trophy className="w-6 h-6 text-amber-400" />
            <div>
              <h3 className="text-2xl font-black text-white">Playoff Projection</h3>
              <p className="text-sm text-slate-400">Double-elimination bracket forecast driven by alliance selection and live playoff results.</p>
            </div>
          </div>

          {!playoffProjection.alliancesAvailable ? (
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 text-slate-400">
              Waiting for alliance selection. The moment TBA publishes the alliances, we can project the bracket from Match 1 onward.
            </div>
          ) : !playoffProjection.supported ? (
            <div className="bg-red-950/40 border border-red-500/40 rounded-2xl p-6 text-red-200">
              {playoffProjection.reason || 'This playoff structure is not supported by the current predictor.'}
            </div>
          ) : (
            <div className="space-y-6">
              {playoffProjection.champion && (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-2xl p-6">
                    <div className="text-xs font-black uppercase tracking-widest text-emerald-300">Projected Champion</div>
                    <div className="text-3xl font-black text-white mt-2">{playoffProjection.champion.label}</div>
                    <div className="text-sm text-emerald-100/80 mt-2">{formatTeamList(playoffProjection.champion.teamKeys)}</div>
                  </div>
                  {playoffProjection.finalist && (
                    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
                      <div className="text-xs font-black uppercase tracking-widest text-slate-400">Projected Finalist</div>
                      <div className="text-3xl font-black text-white mt-2">{playoffProjection.finalist.label}</div>
                      <div className="text-sm text-slate-300 mt-2">{formatTeamList(playoffProjection.finalist.teamKeys)}</div>
                    </div>
                  )}
                </div>
              )}

              {playoffProjection.rounds.map(round => (
                <div key={round.title} className="space-y-4">
                  <h4 className="text-lg font-black text-white">{round.title}</h4>
                  <div className="grid grid-cols-1 2xl:grid-cols-2 gap-4">
                    {round.matches.map(match => (
                      <PredictionCard key={match.id} match={match} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
