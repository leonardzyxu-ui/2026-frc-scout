import React, { useEffect, useMemo, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { AlertTriangle, Filter, RefreshCw, Search, Target, TrendingUp } from 'lucide-react';
import { db } from '../firebase';
import { MatchScoutingV2 } from '../types';
import {
  buildPracticeAnalytics,
  getPracticeLeaderboardMetricValue,
  PracticeLeaderboardMetric,
  PracticeTeamSummary,
  PracticeTrendMetric
} from '../utils/practiceAnalytics';

interface PracticeMatchesViewProps {
  eventKey: string;
}

const COLORS = ['#38bdf8', '#fb7185', '#34d399', '#fbbf24', '#a78bfa'];

const LEADERBOARD_METRICS: { key: PracticeLeaderboardMetric; label: string }[] = [
  { key: 'avgTotalCycles', label: 'Average Total Cycles' },
  { key: 'avgTeleopFluidity', label: 'Average Teleop Fluidity' },
  { key: 'avgAutoFluidity', label: 'Average Auto Fluidity' },
  { key: 'avgDriverPressure', label: 'Average Driver Pressure' },
  { key: 'avgDefenseEffectiveness', label: 'Average Defense Effectiveness' },
  { key: 'defensePlayRate', label: 'Defense Play Rate' },
  { key: 'mainPointContributorRate', label: 'Main Contributor Rate' },
  { key: 'robotFailureRate', label: 'Robot Failure Rate' },
  { key: 'cardCount', label: 'Card Count' }
];

const TREND_METRICS: { key: PracticeTrendMetric; label: string }[] = [
  { key: 'autoFluidity', label: 'Auto Fluidity' },
  { key: 'teleopFluidity', label: 'Teleop Fluidity' },
  { key: 'driverPressure', label: 'Driver Pressure' },
  { key: 'totalCycles', label: 'Total Cycles' }
];

const formatPercent = (value: number) => `${(value * 100).toFixed(0)}%`;

const sortLeaderboard = (
  rows: PracticeTeamSummary[],
  metric: PracticeLeaderboardMetric
) =>
  [...rows].sort((left, right) => {
    const delta = getPracticeLeaderboardMetricValue(right, metric) - getPracticeLeaderboardMetricValue(left, metric);
    if (delta !== 0) return delta;
    return Number(left.teamNumber) - Number(right.teamNumber);
  });

export default function PracticeMatchesView({ eventKey }: PracticeMatchesViewProps) {
  const [records, setRecords] = useState<MatchScoutingV2[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [teamFilter, setTeamFilter] = useState('');
  const [scoutFilter, setScoutFilter] = useState('');
  const [matchFilter, setMatchFilter] = useState('');
  const [leaderboardMetric, setLeaderboardMetric] = useState<PracticeLeaderboardMetric>('avgTotalCycles');
  const [trendMetric, setTrendMetric] = useState<PracticeTrendMetric>('totalCycles');

  const loadPracticeData = async () => {
    setLoading(true);
    setError('');

    try {
      const snapshot = await getDocs(collection(db, 'events', eventKey, 'matchScouting'));
      const allRows = snapshot.docs.map(docSnap => docSnap.data() as MatchScoutingV2);
      setRecords(allRows.filter(row => row.matchType === 'Practice'));
    } catch (loadError) {
      console.error('Failed to load practice matches', loadError);
      setError('Unable to load practice-match scouting right now.');
      setRecords([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPracticeData();
  }, [eventKey]);

  const filteredRecords = useMemo(() => {
    const normalizedTeamFilter = teamFilter.trim().toLowerCase();
    const normalizedScoutFilter = scoutFilter.trim().toLowerCase();
    const normalizedMatchFilter = matchFilter.trim().toLowerCase();

    return records.filter(record => {
      if (normalizedTeamFilter && !record.teamNumber.toLowerCase().includes(normalizedTeamFilter)) {
        return false;
      }
      if (normalizedScoutFilter && !record.scoutName.toLowerCase().includes(normalizedScoutFilter)) {
        return false;
      }
      if (normalizedMatchFilter && !record.matchKey.toLowerCase().includes(normalizedMatchFilter)) {
        return false;
      }
      return true;
    });
  }, [matchFilter, records, scoutFilter, teamFilter]);

  const analytics = useMemo(() => buildPracticeAnalytics(filteredRecords), [filteredRecords]);
  const leaderboardRows = useMemo(
    () => sortLeaderboard(analytics.teams, leaderboardMetric),
    [analytics.teams, leaderboardMetric]
  );

  const hasPracticeRows = records.length > 0;
  const hasFilteredRows = filteredRecords.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h2 className="text-2xl font-black text-white">PRACTICE MATCHES</h2>
          <p className="mt-2 text-sm text-slate-400">
            Event-wide practice scouting dashboard built from the current subjective and operational practice records.
          </p>
        </div>
        <button
          onClick={() => void loadPracticeData()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 font-bold text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          REFRESH PRACTICE DATA
        </button>
      </div>

      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-4 text-amber-100">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
          <div>
            <h3 className="font-black text-white">Practice OPR is intentionally deferred</h3>
            <p className="mt-1 text-sm">
              We already have the legacy OPR solver in the repo, but current practice scouting does not store an alliance
              score or objective scoring total. This dashboard analyzes the practice records deeply without pretending that
              an OPR solve is valid yet.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="mb-4 flex items-center gap-2 text-sm font-black uppercase tracking-widest text-slate-300">
          <Filter className="h-4 w-4 text-emerald-400" />
          Filters
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Team Number</span>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                value={teamFilter}
                onChange={event => setTeamFilter(event.target.value)}
                placeholder="e.g. 2486"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2 pl-9 pr-3 text-sm text-white outline-none transition-colors focus:border-emerald-500"
              />
            </div>
          </label>
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Scout Name</span>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                value={scoutFilter}
                onChange={event => setScoutFilter(event.target.value)}
                placeholder="e.g. Olivia"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2 pl-9 pr-3 text-sm text-white outline-none transition-colors focus:border-emerald-500"
              />
            </div>
          </label>
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Practice Match</span>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                value={matchFilter}
                onChange={event => setMatchFilter(event.target.value)}
                placeholder="e.g. pm6"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2 pl-9 pr-3 text-sm text-white outline-none transition-colors focus:border-emerald-500"
              />
            </div>
          </label>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 px-6 py-16 text-center font-semibold text-slate-400">
          Loading practice-match analytics...
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-6 py-8 text-center font-semibold text-red-200">
          {error}
        </div>
      ) : !hasPracticeRows ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 px-6 py-16 text-center">
          <div className="text-lg font-black text-white">No practice data yet for this event.</div>
          <p className="mt-2 text-sm font-semibold text-slate-500">
            As soon as practice-match scouting is saved, this dashboard will populate automatically.
          </p>
        </div>
      ) : !hasFilteredRows ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 px-6 py-16 text-center">
          <div className="text-lg font-black text-white">No practice rows match the current filters.</div>
          <p className="mt-2 text-sm font-semibold text-slate-500">
            Clear one of the filters above to return to the full practice dashboard.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <PracticeSummaryCard label="Practice Records" value={analytics.summary.totalRecords.toString()} />
            <PracticeSummaryCard label="Distinct Teams" value={analytics.summary.distinctTeams.toString()} />
            <PracticeSummaryCard label="Practice Matches" value={analytics.summary.distinctMatches.toString()} />
            <PracticeSummaryCard label="Defense Play Rate" value={formatPercent(analytics.summary.defensePlayRate)} tone="amber" />
            <PracticeSummaryCard label="Avg Auto Fluidity" value={analytics.summary.avgAutoFluidity.toFixed(1)} />
            <PracticeSummaryCard label="Avg Teleop Fluidity" value={analytics.summary.avgTeleopFluidity.toFixed(1)} />
            <PracticeSummaryCard label="Avg Driver Pressure" value={analytics.summary.avgDriverPressure.toFixed(1)} />
            <PracticeSummaryCard label="Avg Total Cycles" value={analytics.summary.avgTotalCycles.toFixed(1)} tone="emerald" />
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <PracticeChartCard
              title="Practice Coverage by Match"
              subtitle="Rows saved and distinct teams covered per practice match."
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analytics.coverage} margin={{ top: 16, right: 16, bottom: 8, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="matchLabel" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155' }} />
                  <Legend />
                  <Line type="monotoneX" dataKey="rows" name="Saved Rows" stroke="#38bdf8" strokeWidth={3} dot={{ r: 3 }} />
                  <Line type="monotoneX" dataKey="distinctTeams" name="Distinct Teams" stroke="#34d399" strokeWidth={3} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </PracticeChartCard>

            <PracticeChartCard
              title="Team Practice Trends"
              subtitle="Top teams over practice matches for the selected metric."
            >
              <div className="mb-4 flex flex-wrap gap-2">
                {TREND_METRICS.map(option => (
                  <button
                    key={option.key}
                    onClick={() => setTrendMetric(option.key)}
                    className={`rounded-full px-3 py-1.5 text-xs font-black tracking-wider transition-colors ${
                      trendMetric === option.key
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-950 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analytics.trends[trendMetric]} margin={{ top: 16, right: 16, bottom: 8, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="matchLabel" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155' }} />
                  <Legend />
                  {analytics.trendTeams.map((teamNumber, index) => (
                    <Line
                      key={teamNumber}
                      type="monotoneX"
                      dataKey={teamNumber}
                      name={`Team ${teamNumber}`}
                      stroke={COLORS[index % COLORS.length]}
                      strokeWidth={3}
                      dot={{ r: 3 }}
                      connectNulls={true}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </PracticeChartCard>

            <PracticeChartCard
              title="Total Cycles vs Teleop Fluidity"
              subtitle="Every practice row plotted directly from the saved records."
            >
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 16, right: 16, bottom: 8, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis type="number" dataKey="teleopFluidity" name="Teleop Fluidity" stroke="#94a3b8" domain={[0, 10]} />
                  <YAxis type="number" dataKey="totalCycles" name="Total Cycles" stroke="#94a3b8" />
                  <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155' }} />
                  <Scatter name="Practice Rows" data={analytics.scatterCycleVsTeleop} fill="#38bdf8" />
                </ScatterChart>
              </ResponsiveContainer>
            </PracticeChartCard>

            <PracticeChartCard
              title="Driver Pressure vs Total Cycles"
              subtitle="A quick way to see who still cycles well under pressure."
            >
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 16, right: 16, bottom: 8, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis type="number" dataKey="driverPressure" name="Driver Pressure" stroke="#94a3b8" domain={[0, 10]} />
                  <YAxis type="number" dataKey="totalCycles" name="Total Cycles" stroke="#94a3b8" />
                  <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155' }} />
                  <Scatter name="Practice Rows" data={analytics.scatterPressureVsCycles} fill="#fbbf24" />
                </ScatterChart>
              </ResponsiveContainer>
            </PracticeChartCard>

            <PracticeChartCard
              title="Defense Effectiveness vs Driver Pressure"
              subtitle="How defensive performance and pressure handling are pairing up in practice."
            >
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 16, right: 16, bottom: 8, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis type="number" dataKey="driverPressure" name="Driver Pressure" stroke="#94a3b8" domain={[0, 10]} />
                  <YAxis type="number" dataKey="defenseEffectiveness" name="Defense Effectiveness" stroke="#94a3b8" domain={[0, 10]} />
                  <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155' }} />
                  <Scatter name="Practice Rows" data={analytics.scatterDefenseVsPressure} fill="#fb7185" />
                </ScatterChart>
              </ResponsiveContainer>
            </PracticeChartCard>

            <PracticeChartCard
              title="Climb and Failure Distribution"
              subtitle="Practice-wide distribution of climb outcomes and flagged failures."
            >
              <div className="grid h-full grid-cols-1 gap-4 lg:grid-cols-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.climbDistribution} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="label" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" allowDecimals={false} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155' }} />
                    <Bar dataKey="count" name="Climb Count" fill="#34d399" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.failureDistribution} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="label" stroke="#94a3b8" angle={-15} height={48} interval={0} />
                    <YAxis stroke="#94a3b8" allowDecimals={false} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155' }} />
                    <Bar dataKey="count" name="Failure Count" fill="#f87171" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </PracticeChartCard>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
            <div className="flex flex-col gap-4 border-b border-slate-800 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="text-lg font-black text-white">Practice Team Leaderboard</h3>
                <p className="mt-1 text-sm text-slate-400">Current practice rows only. No inferred OPR-style score is being invented here.</p>
              </div>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-300">
                Sort by
                <select
                  value={leaderboardMetric}
                  onChange={event => setLeaderboardMetric(event.target.value as PracticeLeaderboardMetric)}
                  className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
                >
                  {LEADERBOARD_METRICS.map(option => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="overflow-x-auto">
              <table className="admin-sticky-table min-w-[1200px] w-full text-left text-sm">
                <thead className="bg-slate-950 text-xs uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Team</th>
                    <th className="px-4 py-3">Matches</th>
                    <th className="px-4 py-3">Auto</th>
                    <th className="px-4 py-3">Teleop</th>
                    <th className="px-4 py-3">Pressure</th>
                    <th className="px-4 py-3">Cycles</th>
                    <th className="px-4 py-3">Defense Eff.</th>
                    <th className="px-4 py-3">Defense Rate</th>
                    <th className="px-4 py-3">Main Contributor</th>
                    <th className="px-4 py-3">Failure Rate</th>
                    <th className="px-4 py-3">Cards</th>
                    <th className="px-4 py-3">Climb Mix</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {leaderboardRows.map(row => (
                    <tr key={row.teamNumber} className="hover:bg-slate-800/40">
                      <td className="px-4 py-3 font-black text-white">{row.teamNumber}</td>
                      <td className="px-4 py-3 text-slate-300">{row.matches}</td>
                      <td className="px-4 py-3 text-slate-300">{row.avgAutoFluidity.toFixed(1)}</td>
                      <td className="px-4 py-3 text-slate-300">{row.avgTeleopFluidity.toFixed(1)}</td>
                      <td className="px-4 py-3 text-slate-300">{row.avgDriverPressure.toFixed(1)}</td>
                      <td className="px-4 py-3 font-mono text-emerald-300">{row.avgTotalCycles.toFixed(1)}</td>
                      <td className="px-4 py-3 text-slate-300">{row.avgDefenseEffectiveness.toFixed(1)}</td>
                      <td className="px-4 py-3 text-slate-300">{formatPercent(row.defensePlayRate)}</td>
                      <td className="px-4 py-3 text-slate-300">{formatPercent(row.mainPointContributorRate)}</td>
                      <td className="px-4 py-3 text-slate-300">{formatPercent(row.robotFailureRate)}</td>
                      <td className="px-4 py-3 text-slate-300">Y {row.yellowCards} / R {row.redCards}</td>
                      <td className="px-4 py-3 text-slate-400">
                        N {row.climbCounts.None} • L1 {row.climbCounts.L1} • L2 {row.climbCounts.L2} • L3 {row.climbCounts.L3}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
            <div className="border-b border-slate-800 px-5 py-4">
              <h3 className="text-lg font-black text-white">Practice Match-by-Match Table</h3>
              <p className="mt-1 text-sm text-slate-400">Each practice match grouped with the compact per-team metrics scouts actually logged.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="admin-sticky-table min-w-[1300px] w-full text-left text-sm">
                <thead className="bg-slate-950 text-xs uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Practice Match</th>
                    <th className="px-4 py-3">Team</th>
                    <th className="px-4 py-3">Scout</th>
                    <th className="px-4 py-3">Alliance</th>
                    <th className="px-4 py-3">Auto</th>
                    <th className="px-4 py-3">Teleop</th>
                    <th className="px-4 py-3">Pressure</th>
                    <th className="px-4 py-3">Cycles</th>
                    <th className="px-4 py-3">Climb</th>
                    <th className="px-4 py-3">Defense</th>
                    <th className="px-4 py-3">Failures</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {analytics.matches.flatMap(match =>
                    match.records.map((record, index) => (
                      <tr key={`${match.matchKey}:${record.teamNumber}:${record.scoutName}:${index}`} className="hover:bg-slate-800/40">
                        <td className="px-4 py-3 font-black text-white">
                          <div>{match.matchLabel}</div>
                          <div className="text-xs text-slate-500">{match.rowCount} rows / {match.distinctTeams} teams</div>
                        </td>
                        <td className="px-4 py-3 font-mono text-emerald-300">{record.teamNumber}</td>
                        <td className="px-4 py-3 text-slate-300">{record.scoutName || '—'}</td>
                        <td className="px-4 py-3 text-slate-300">{record.alliance || '—'}</td>
                        <td className="px-4 py-3 text-slate-300">{record.autoFluidity}</td>
                        <td className="px-4 py-3 text-slate-300">{record.teleopFluidity}</td>
                        <td className="px-4 py-3 text-slate-300">{record.driverPressure}</td>
                        <td className="px-4 py-3 font-mono text-amber-300">{record.totalCycles}</td>
                        <td className="px-4 py-3 text-slate-300">{record.climbLevel}</td>
                        <td className="px-4 py-3 text-slate-300">{record.playedDefense ? 'Yes' : 'No'}</td>
                        <td className="px-4 py-3 text-slate-400">
                          {record.failureFlags.length > 0 ? record.failureFlags.join(', ') : '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function PracticeSummaryCard({
  label,
  value,
  tone = 'slate'
}: {
  label: string;
  value: string;
  tone?: 'slate' | 'amber' | 'emerald';
}) {
  const toneClasses =
    tone === 'amber'
      ? 'border-amber-500/30 bg-amber-500/10 text-amber-100'
      : tone === 'emerald'
        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
        : 'border-slate-800 bg-slate-900/60 text-slate-100';

  return (
    <div className={`rounded-2xl border px-4 py-4 ${toneClasses}`}>
      <div className="text-xs font-black uppercase tracking-wider text-slate-400">{label}</div>
      <div className="mt-2 text-2xl font-black text-white">{value}</div>
    </div>
  );
}

function PracticeChartCard({
  title,
  subtitle,
  children
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
      <div className="mb-4">
        <h3 className="flex items-center gap-2 text-lg font-black text-white">
          <TrendingUp className="h-5 w-5 text-cyan-400" />
          {title}
        </h3>
        <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
      </div>
      <div className="h-[320px] w-full">{children}</div>
    </div>
  );
}
