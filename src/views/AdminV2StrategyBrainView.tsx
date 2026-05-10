import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Brain, Coins, Download, RefreshCw, Shield, Target, Trophy, Upload, Users } from 'lucide-react';
import {
  AlliancePickRecommendation,
  MatchDefenseScoutingV1,
  MatchScoutingV3,
  MatchScoutingV4,
  PowerCoinBet,
  ScoutAssignmentPlan
} from '../types';
import { AdminV2SelectedMetric } from '../utils/adminV2Settings';
import { TeamHistoricalAverageRow } from '../utils/adminV2Analytics';
import { TBAMatch } from '../utils/mathEngine';
import {
  backtestTimeAwareModels,
  buildAlliancePickRecommendations,
  buildDefenseAttributions,
  buildDefenseImpactLookup,
  buildPpaRatings,
  buildStrategyMatchPlans,
  buildTeamPerformanceProfiles,
  optimizeScoutAssignments
} from '../utils/strategyBrain';
import {
  FirstEventsCredentials,
  clearFirstEventsCredentials,
  listAdminV2CacheEntries,
  listPowerCoinBets,
  loadFirstEventsCredentials,
  loadLatestScoutAssignmentPlan,
  saveFirstEventsCredentials,
  saveScoutAssignmentPlan,
  settlePowerCoinBetsForMatch
} from '../utils/adminV2LocalStore';
import { fetchAndCacheFirstEventBundle, getYearFromEventKey } from '../utils/firstEventsApi';

type StrategyBrainTab = 'foundation' | 'models' | 'profiles' | 'strategy' | 'alliance' | 'scoutOps';

const DEFAULT_SCOUTS = ['Olivia', 'Eason', 'Matilda', 'Sophia', 'Lucas', 'Justin'];

const formatNumber = (value: number | null | undefined, digits = 2) =>
  value == null || !Number.isFinite(value) ? '—' : value.toFixed(digits);

const formatPercent = (value: number | null | undefined, digits = 1) =>
  value == null || !Number.isFinite(value) ? '—' : `${(value * 100).toFixed(digits)}%`;

const metricLabel = (metric: AdminV2SelectedMetric) => metric.toUpperCase();

const parsePickedStatuses = (value: string): Record<string, { status: AlliancePickRecommendation['status']; pickedBy?: string }> => {
  const result: Record<string, { status: AlliancePickRecommendation['status']; pickedBy?: string }> = {};
  value.split('\n').forEach(line => {
    const [teamRaw, statusRaw, pickedByRaw] = line.split(',').map(part => part?.trim());
    const teamNumber = (teamRaw || '').replace(/[^\d]/g, '');
    if (!teamNumber) return;
    const status = statusRaw === 'picked' || statusRaw === 'declined' || statusRaw === 'unavailable' ? statusRaw : 'available';
    result[teamNumber] = { status, pickedBy: pickedByRaw || '' };
  });
  return result;
};

export default function AdminV2StrategyBrainView({
  eventKey,
  selectedMetric,
  ownTeamNumber,
  v4Records,
  v3Records,
  defenseRecords,
  matches,
  teamAverages,
  averageLookup,
  oprRatings,
  dprRatings,
  epaRatings,
  teamNameLookup
}: {
  eventKey: string;
  selectedMetric: AdminV2SelectedMetric;
  ownTeamNumber: string;
  v4Records: MatchScoutingV4[];
  v3Records: MatchScoutingV3[];
  defenseRecords: MatchDefenseScoutingV1[];
  matches: TBAMatch[];
  teamAverages: TeamHistoricalAverageRow[];
  averageLookup: Record<string, number>;
  oprRatings: Record<string, number>;
  dprRatings: Record<string, number>;
  epaRatings: Record<string, number>;
  teamNameLookup: Record<string, string>;
}) {
  const [activeTab, setActiveTab] = useState<StrategyBrainTab>('foundation');
  const [firstCredentials, setFirstCredentials] = useState<FirstEventsCredentials | null>(null);
  const [cacheCount, setCacheCount] = useState(0);
  const [firstStatus, setFirstStatus] = useState('');
  const [firstError, setFirstError] = useState('');
  const [scoutRosterText, setScoutRosterText] = useState(DEFAULT_SCOUTS.join('\n'));
  const [scoutAssignmentPlan, setScoutAssignmentPlan] = useState<ScoutAssignmentPlan | null>(null);
  const [pickedTeamsText, setPickedTeamsText] = useState('');
  const [allianceSeed, setAllianceSeed] = useState(1);
  const [powerCoinBets, setPowerCoinBets] = useState<PowerCoinBet[]>([]);

  useEffect(() => {
    let cancelled = false;
    const hydrate = async () => {
      try {
        const [credentials, cacheEntries, plan, bets] = await Promise.all([
          loadFirstEventsCredentials().catch(() => null),
          listAdminV2CacheEntries(eventKey).catch(() => []),
          loadLatestScoutAssignmentPlan(eventKey).catch(() => null),
          listPowerCoinBets(eventKey).catch(() => [])
        ]);
        if (cancelled) return;
        setFirstCredentials(credentials);
        setCacheCount(cacheEntries.length);
        setScoutAssignmentPlan(plan);
        setPowerCoinBets(bets);
      } catch (error) {
        console.warn('Failed to hydrate Strategy Brain local state', error);
      }
    };
    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [eventKey]);

  const activeMetricRatings = useMemo(
    () => selectedMetric === 'ppc' ? averageLookup : selectedMetric === 'opr' ? oprRatings : epaRatings,
    [averageLookup, epaRatings, oprRatings, selectedMetric]
  );

  const modelBacktests = useMemo(() => backtestTimeAwareModels({
    matches,
    v3Records,
    v4Records,
    epaRatings
  }), [epaRatings, matches, v3Records, v4Records]);

  const ppaRatings = useMemo(() => buildPpaRatings(modelBacktests, {
    PPC: averageLookup,
    'Rolling PPC': averageLookup,
    OPR: oprRatings,
    DPR: dprRatings,
    EPA: epaRatings,
    'Recency EPA': epaRatings
  }), [averageLookup, dprRatings, epaRatings, modelBacktests, oprRatings]);

  const defenseAttributions = useMemo(
    () => buildDefenseAttributions(v4Records, Object.keys(ppaRatings).length ? ppaRatings : activeMetricRatings),
    [activeMetricRatings, ppaRatings, v4Records]
  );
  const defenseImpactLookup = useMemo(() => buildDefenseImpactLookup(defenseAttributions), [defenseAttributions]);
  const teamProfiles = useMemo(() => buildTeamPerformanceProfiles({
    v4Records,
    v3Records,
    defenseRecords,
    ppcRows: teamAverages,
    oprRatings,
    dprRatings,
    epaRatings,
    ppaRatings,
    defenseImpactLookup
  }), [defenseImpactLookup, defenseRecords, dprRatings, epaRatings, oprRatings, ppaRatings, teamAverages, v3Records, v4Records]);
  const strategyPlans = useMemo(
    () => buildStrategyMatchPlans(matches, activeMetricRatings, defenseImpactLookup),
    [activeMetricRatings, defenseImpactLookup, matches]
  );
  const allianceRecommendations = useMemo(
    () => buildAlliancePickRecommendations(teamProfiles, allianceSeed, parsePickedStatuses(pickedTeamsText), ownTeamNumber),
    [allianceSeed, ownTeamNumber, pickedTeamsText, teamProfiles]
  );

  const bestModel = modelBacktests.find(result => result.matchesTested > 0) || null;

  const handleFirstCredentialUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setFirstError('');
    setFirstStatus('Reading FIRST Events credentials...');
    try {
      const parsed = JSON.parse(await file.text()) as Partial<FirstEventsCredentials>;
      if (!parsed.username || !parsed.token) {
        throw new Error('Credential JSON must contain username and token.');
      }
      const saved = await saveFirstEventsCredentials({ username: parsed.username, token: parsed.token });
      setFirstCredentials(saved);
      setFirstStatus('FIRST Events credentials saved locally in IndexedDB.');
    } catch (error) {
      setFirstError(error instanceof Error ? error.message : 'Failed to import FIRST credentials.');
      setFirstStatus('');
    }
  };

  const handleFirstCacheRefresh = async () => {
    if (!firstCredentials) {
      setFirstError('Upload FIRST Events credentials first.');
      return;
    }

    setFirstError('');
    setFirstStatus('Fetching FIRST Events data and caching it locally...');
    try {
      const results = await fetchAndCacheFirstEventBundle(firstCredentials, eventKey);
      const failures = results.filter(result => !result.ok);
      const cacheEntries = await listAdminV2CacheEntries(eventKey);
      setCacheCount(cacheEntries.length);
      setFirstStatus(`FIRST cache refresh complete: ${results.length - failures.length}/${results.length} endpoints saved for ${getYearFromEventKey(eventKey)}.`);
      if (failures.length > 0) {
        setFirstError(failures.map(result => `${result.key}: ${result.error}`).join('\n'));
      }
    } catch (error) {
      setFirstError(error instanceof Error ? error.message : 'FIRST cache refresh failed.');
      setFirstStatus('');
    }
  };

  const handleOptimizeScouts = async () => {
    const scoutNames = scoutRosterText.split('\n').map(name => name.trim()).filter(Boolean);
    const plan = optimizeScoutAssignments(eventKey, matches, scoutNames, ownTeamNumber);
    setScoutAssignmentPlan(plan);
    await saveScoutAssignmentPlan(plan);
  };

  const handleSettlePowerCoins = async (matchKey: string, winner: 'Red' | 'Blue' | 'Tie' | 'Unknown') => {
    await settlePowerCoinBetsForMatch(eventKey, matchKey, winner);
    setPowerCoinBets(await listPowerCoinBets(eventKey));
  };

  const tabClass = (tab: StrategyBrainTab) =>
    `rounded-2xl px-4 py-3 text-sm font-black transition ${
      activeTab === tab ? 'bg-cyan-500 text-slate-950' : 'border border-slate-800 bg-slate-950 text-slate-300 hover:bg-slate-800'
    }`;

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-cyan-500/20 bg-cyan-500/10 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="flex items-center gap-3 text-2xl font-black text-white">
              <Brain className="h-7 w-7 text-cyan-300" />
              Strategy Brain
            </h3>
            <p className="mt-2 max-w-4xl text-sm font-semibold text-cyan-100/80">
              V4 evidence, cached APIs, no-future-data model evaluation, defense attribution, match strategy,
              alliance selection, scout assignment optimization, and PowerCoins live in one Admin V2 workspace.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm">
            <div className="font-black text-slate-400">Best Validated Model</div>
            <div className="mt-1 text-xl font-black text-white">{bestModel?.modelName || 'Pending data'}</div>
            <div className="text-xs text-slate-500">PPA uses validated blend when available.</div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={() => setActiveTab('foundation')} className={tabClass('foundation')}>Data Foundation</button>
        <button onClick={() => setActiveTab('models')} className={tabClass('models')}>Model Lab</button>
        <button onClick={() => setActiveTab('profiles')} className={tabClass('profiles')}>Team Profiles</button>
        <button onClick={() => setActiveTab('strategy')} className={tabClass('strategy')}>Match Strategy</button>
        <button onClick={() => setActiveTab('alliance')} className={tabClass('alliance')}>Alliance Selection</button>
        <button onClick={() => setActiveTab('scoutOps')} className={tabClass('scoutOps')}>Scout Ops + PowerCoins</button>
      </div>

      {activeTab === 'foundation' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
            <h4 className="flex items-center gap-2 text-xl font-black text-white">
              <Download className="h-5 w-5 text-cyan-300" />
              FIRST Events API Local Credentials
            </h4>
            <p className="mt-2 text-sm text-slate-400">
              Upload a local JSON file with <span className="font-mono text-slate-200">{'{"username":"...","token":"..." }'}</span>.
              It stays in this browser IndexedDB only and is never committed.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl bg-cyan-600 px-4 py-3 text-sm font-black text-white hover:bg-cyan-500">
                <Upload className="h-4 w-4" />
                Upload Credential JSON
                <input type="file" accept=".json,application/json" className="hidden" onChange={handleFirstCredentialUpload} />
              </label>
              <button
                onClick={() => void handleFirstCacheRefresh()}
                className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black text-white hover:bg-emerald-500"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh FIRST Cache
              </button>
              <button
                onClick={() => {
                  void clearFirstEventsCredentials().then(() => setFirstCredentials(null));
                }}
                className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-black text-slate-300 hover:bg-slate-800"
              >
                Clear Credentials
              </button>
            </div>
            <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950 p-4 text-sm">
              <div>Credential status: <span className="font-black text-white">{firstCredentials ? `Saved for ${firstCredentials.username}` : 'Not loaded'}</span></div>
              <div>Cached entries for event: <span className="font-black text-white">{cacheCount}</span></div>
              {firstStatus && <div className="mt-2 font-semibold text-emerald-200">{firstStatus}</div>}
              {firstError && <pre className="mt-2 whitespace-pre-wrap rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-amber-100">{firstError}</pre>}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
            <h4 className="flex items-center gap-2 text-xl font-black text-white">
              <Target className="h-5 w-5 text-fuchsia-300" />
              Source Freshness
            </h4>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <MetricCard label="V4 Rows" value={v4Records.length} />
              <MetricCard label="Legacy V3 Rows" value={v3Records.length} />
              <MetricCard label="Defense V1 Rows" value={defenseRecords.length} />
              <MetricCard label="TBA/FIRST Matches" value={matches.length} />
            </div>
            <p className="mt-4 text-sm text-slate-400">
              SSH/LAN transfer is intentionally not the primary path. The reliable backbone is IndexedDB, Firebase,
              QR, JSON archives, local uploaded files, and cached API snapshots.
            </p>
          </section>
        </div>
      )}

      {activeTab === 'models' && (
        <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
          <h4 className="flex items-center gap-2 text-xl font-black text-white">
            <Trophy className="h-5 w-5 text-yellow-300" />
            Model Lab Backtest Leaderboard
          </h4>
          <p className="mt-2 text-sm text-slate-400">
            PPC and OPR rows are evaluated with only scouting or official-score data available before each played match.
            EPA rows use current Statbotics context until we add historical EPA snapshots.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-slate-950 text-xs uppercase tracking-wider text-slate-400">
                <tr>
                  {['Model', 'Source', 'Matches', 'Winner Acc.', 'Score MAE', 'Margin MAE', 'Calibration', 'Low Conf.'].map(header => (
                    <th key={header} className="px-4 py-3 text-left">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {modelBacktests.map(result => (
                  <tr key={result.modelName}>
                    <td className="px-4 py-3 font-black text-white">{result.modelName}</td>
                    <td className="px-4 py-3 text-slate-300">{result.sourceLabel}</td>
                    <td className="px-4 py-3">{result.matchesTested}</td>
                    <td className="px-4 py-3">{formatPercent(result.winnerAccuracy)}</td>
                    <td className="px-4 py-3">{formatNumber(result.scoreMae)}</td>
                    <td className="px-4 py-3">{formatNumber(result.marginMae)}</td>
                    <td className="px-4 py-3">{formatNumber(result.calibrationError)}</td>
                    <td className="px-4 py-3">{formatPercent(result.lowConfidenceRate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {activeTab === 'profiles' && (
        <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
          <h4 className="flex items-center gap-2 text-xl font-black text-white">
            <Users className="h-5 w-5 text-cyan-300" />
            Team Performance Profiles
          </h4>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-slate-950 text-xs uppercase tracking-wider text-slate-400">
                <tr>
                  {['Team', 'Name', 'Matches', 'Peak', 'Worst', 'Low > 0', 'Avg', 'Std Dev', 'Trend', 'PPA', 'Defense Impact'].map(header => (
                    <th key={header} className="px-4 py-3 text-left">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {teamProfiles.map(profile => (
                  <tr key={profile.teamNumber}>
                    <td className="px-4 py-3 font-mono font-black text-white">{profile.teamNumber}</td>
                    <td className="px-4 py-3 text-slate-300">{teamNameLookup[profile.teamNumber] || ''}</td>
                    <td className="px-4 py-3">{profile.matchesPlayed}</td>
                    <td className="px-4 py-3">{formatNumber(profile.peakScore)}</td>
                    <td className="px-4 py-3">{formatNumber(profile.worstScore)}</td>
                    <td className="px-4 py-3">{formatNumber(profile.lowestNonZeroScore)}</td>
                    <td className="px-4 py-3">{formatNumber(profile.averageScore)}</td>
                    <td className="px-4 py-3">{formatNumber(profile.standardDeviation)}</td>
                    <td className={`px-4 py-3 font-black ${profile.recentTrend >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{formatNumber(profile.recentTrend, 3)}</td>
                    <td className="px-4 py-3">{formatNumber(profile.ppa)}</td>
                    <td className="px-4 py-3">{formatNumber(profile.defenseImpact)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {activeTab === 'strategy' && (
        <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
          <h4 className="flex items-center gap-2 text-xl font-black text-white">
            <Shield className="h-5 w-5 text-emerald-300" />
            Match Strategy Simulation ({metricLabel(selectedMetric)})
          </h4>
          <div className="mt-4 grid gap-3">
            {strategyPlans.slice(0, 18).map(plan => (
              <div key={plan.matchKey} className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="font-mono text-lg font-black text-white">{plan.matchKey.toUpperCase()}</div>
                  <div className={`rounded-full px-3 py-1 text-xs font-black ${plan.predictedWinner === 'Red' ? 'bg-red-500/15 text-red-200' : plan.predictedWinner === 'Blue' ? 'bg-blue-500/15 text-blue-200' : 'bg-slate-700 text-slate-200'}`}>
                    {plan.predictedWinner}
                  </div>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl bg-red-500/10 p-3">
                    <div className="font-black text-red-100">Red {formatNumber(plan.baselineRedScore)}</div>
                    <div className="text-sm text-red-100/80">{plan.redTeams.join(', ')}</div>
                    <div className="mt-2 text-xs text-red-100/70">{plan.bestRedPlan}</div>
                  </div>
                  <div className="rounded-xl bg-blue-500/10 p-3">
                    <div className="font-black text-blue-100">Blue {formatNumber(plan.baselineBlueScore)}</div>
                    <div className="text-sm text-blue-100/80">{plan.blueTeams.join(', ')}</div>
                    <div className="mt-2 text-xs text-blue-100/70">{plan.bestBluePlan}</div>
                  </div>
                </div>
                <div className="mt-3 text-sm font-semibold text-slate-300">{plan.winCondition}</div>
                {plan.riskFlags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {plan.riskFlags.map(flag => (
                      <span key={flag} className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-black text-amber-100">{flag}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {strategyPlans.length === 0 && (
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 text-amber-100">
                <AlertTriangle className="mr-2 inline h-5 w-5" />
                No future qualification matches are available yet.
              </div>
            )}
          </div>
        </section>
      )}

      {activeTab === 'alliance' && (
        <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
          <h4 className="flex items-center gap-2 text-xl font-black text-white">
            <Target className="h-5 w-5 text-fuchsia-300" />
            Seed-Aware Alliance Selection
          </h4>
          <div className="mt-4 grid gap-4 lg:grid-cols-[220px_1fr]">
            <div className="space-y-4">
              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-widest text-slate-500">Alliance Seed</span>
                <input type="number" min={1} max={8} value={allianceSeed} onChange={event => setAllianceSeed(Math.max(1, Math.min(8, Number(event.target.value))))} className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 font-mono font-black text-white outline-none focus:border-fuchsia-400" />
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-widest text-slate-500">Picked Teams CSV</span>
                <textarea
                  value={pickedTeamsText}
                  onChange={event => setPickedTeamsText(event.target.value)}
                  rows={10}
                  placeholder="1114,picked,A1&#10;2056,declined&#10;254,unavailable"
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-fuchsia-400"
                />
              </label>
            </div>
            <div className="overflow-x-auto rounded-2xl border border-slate-800">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 bg-slate-950 text-xs uppercase tracking-wider text-slate-400">
                  <tr>
                    {['Team', 'Name', 'Score', 'Seed Fit', 'Role Fit', 'Status', 'Rationale'].map(header => (
                      <th key={header} className="px-4 py-3 text-left">{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {allianceRecommendations.slice(0, 60).map(row => (
                    <tr key={row.teamNumber} className={row.status === 'available' ? '' : 'opacity-50'}>
                      <td className="px-4 py-3 font-mono font-black text-white">{row.teamNumber}</td>
                      <td className="px-4 py-3 text-slate-300">{teamNameLookup[row.teamNumber] || ''}</td>
                      <td className="px-4 py-3">{formatNumber(row.score)}</td>
                      <td className="px-4 py-3">{row.seedFit}</td>
                      <td className="px-4 py-3">{row.roleFit}</td>
                      <td className="px-4 py-3">{row.status}{row.pickedBy ? ` by ${row.pickedBy}` : ''}</td>
                      <td className="px-4 py-3 text-slate-400">{row.rationale}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {activeTab === 'scoutOps' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
            <h4 className="flex items-center gap-2 text-xl font-black text-white">
              <Users className="h-5 w-5 text-cyan-300" />
              Scout Assignment Optimizer
            </h4>
            <textarea
              value={scoutRosterText}
              onChange={event => setScoutRosterText(event.target.value)}
              rows={8}
              className="mt-4 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-400"
            />
            <button onClick={() => void handleOptimizeScouts()} className="mt-3 rounded-2xl bg-cyan-600 px-4 py-3 text-sm font-black text-white hover:bg-cyan-500">
              Optimize Scout Assignments
            </button>
            {scoutAssignmentPlan && (
              <div className="mt-4 max-h-96 overflow-y-auto rounded-2xl border border-slate-800">
                <table className="min-w-full text-sm">
                  <thead className="sticky top-0 bg-slate-950 text-xs uppercase tracking-wider text-slate-400">
                    <tr>
                      {['Match', 'Station', 'Team', 'Scout', 'Reason'].map(header => <th key={header} className="px-4 py-3 text-left">{header}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {scoutAssignmentPlan.assignments.slice(0, 120).map((assignment, index) => (
                      <tr key={`${assignment.matchKey}_${assignment.station}_${index}`}>
                        <td className="px-4 py-3 font-mono text-white">{assignment.matchKey.toUpperCase()}</td>
                        <td className="px-4 py-3">{assignment.station}</td>
                        <td className="px-4 py-3">{assignment.teamNumber}</td>
                        <td className="px-4 py-3 font-black text-cyan-200">{assignment.scoutName}</td>
                        <td className="px-4 py-3 text-slate-400">{assignment.priorityReason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
            <h4 className="flex items-center gap-2 text-xl font-black text-white">
              <Coins className="h-5 w-5 text-yellow-300" />
              PowerCoins
            </h4>
            <p className="mt-2 text-sm text-slate-400">Bets start from 1000 coins per scout per event. Settlement is pari-mutuel.</p>
            <div className="mt-4 max-h-96 overflow-y-auto rounded-2xl border border-slate-800">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 bg-slate-950 text-xs uppercase tracking-wider text-slate-400">
                  <tr>
                    {['Scout', 'Match', 'Side', 'Stake', 'Outcome', 'Payout', 'Actions'].map(header => <th key={header} className="px-4 py-3 text-left">{header}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {powerCoinBets.map(bet => (
                    <tr key={bet.id}>
                      <td className="px-4 py-3 font-black text-white">{bet.scoutName}</td>
                      <td className="px-4 py-3 font-mono">{bet.matchKey.toUpperCase()}</td>
                      <td className={`px-4 py-3 font-black ${bet.side === 'Red' ? 'text-red-300' : 'text-blue-300'}`}>{bet.side}</td>
                      <td className="px-4 py-3">{bet.amount}</td>
                      <td className="px-4 py-3">{bet.outcome || 'open'}</td>
                      <td className="px-4 py-3">{formatNumber(bet.payout)}</td>
                      <td className="px-4 py-3">
                        {!bet.settledAt && (
                          <div className="flex gap-1">
                            {(['Red', 'Blue', 'Tie'] as const).map(winner => (
                              <button key={winner} onClick={() => void handleSettlePowerCoins(bet.matchKey, winner)} className="rounded-lg bg-slate-800 px-2 py-1 text-xs font-black hover:bg-slate-700">{winner}</button>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {powerCoinBets.length === 0 && (
                    <tr><td className="px-4 py-8 text-center text-slate-500" colSpan={7}>No PowerCoin bets yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
      <div className="text-xs font-black uppercase tracking-widest text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-black text-white">{value}</div>
    </div>
  );
}
