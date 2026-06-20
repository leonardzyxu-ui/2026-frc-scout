import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAdminV4TestModeScope,
  getAdminV4MatchLabel,
  sortAdminV4MatchesForTestMode
} from '../src/utils/adminV4TestMode.ts';
import { buildLocalAdminV4TestModeFixture } from '../src/utils/adminV4TestFixture.ts';
import {
  activeWorkspaceKeyFromTab,
  adminReturnTabFromRouteParam,
  adminRouteParamFromTab,
  buildAdminV4Route,
  dataPanelFromAdminRouteParam,
  metricSurfaceFromTab,
  teamReturnTabFromRouteParam,
  workflowFromAdminRouteTab
} from '../src/utils/adminV4Routes.ts';
import { loadAdminV4Settings, saveAdminV4Settings } from '../src/utils/adminV4Settings.ts';
import { buildTeamDefenseMetrics, summarizeDefenseMetricGuardrails } from '../src/utils/adminV4Analytics.ts';
import { formatStrategyWinConditionForAlliance } from '../src/utils/adminV4StrategyCopy.ts';
import {
  getAdminV4TeamSearchSuggestions,
  resolveAdminV4TeamSearchInput
} from '../src/utils/adminV4TeamSearch.ts';
import { getAdminV4SmartSearchSuggestions } from '../src/utils/adminV4SmartSearch.ts';
import {
  countBackupImportCategory,
  DEFAULT_BACKUP_IMPORT_OPTIONS,
  getAdminV4BackupPayload,
  isAdminV4FullLocalBackup
} from '../src/utils/adminV4BackupImport.ts';
import {
  getAdminV4PickListStorageKey,
  loadAdminV4PickListState,
  normalizeAdminV4AllianceSeed,
  normalizeAdminV4PickStatusMap,
  saveAdminV4PickListState
} from '../src/utils/adminV4PickListState.ts';
import {
  describeAdminV4CachedPayload,
  formatAdminV4MetricValue,
  formatAdminV4PercentMetric,
  formatAdminV4PpaRange,
  formatAdminV4SignedMetric,
  getAdminV4FreshnessAge,
  parseAdminV4QuickTeamEntry,
  parseAdminV4TeamNumbers,
  stringifyAdminV4WorkbookCell
} from '../src/utils/adminV4Format.ts';
import {
  formatAdminV4Record,
  getAdminV4CompLevelLabel,
  getAdminV4PlayedMatchWinner,
  getAdminV4PlayoffStatusLabel,
  getAdminV4PredictorViewDescription,
  getAdminV4ResultsViewDescription,
  isAdminV4PlayedMatch,
  isLegacyAdminV4MatchScoutingV2,
  mergeAdminV4V3WithLegacyRows,
  normalizeAdminV4TeamKey,
  sortAdminV4ScoutRowsByMatchThenTeam
} from '../src/utils/adminV4MatchUtils.ts';
import {
  loadUploadedTbaCsvPack,
  saveUploadedTbaCsvPack
} from '../src/utils/adminV4TbaCsv.ts';
import {
  DEFAULT_SCOUT_IDENTITY_UNLOCK_HASH,
  getScoutIdentityUnlockHash,
  saveAdminScoutIdentityPassphrase,
  verifyScoutIdentityUnlockPassphrase
} from '../src/utils/scoutIdentityLock.ts';

const match = (number, redScore = -1, blueScore = -1) => ({
  key: `2026mnum_qm${number}`,
  event_key: '2026mnum',
  comp_level: 'qm',
  match_number: number,
  set_number: 1,
  time: 1770000000 + number * 60,
  predicted_time: 1770000000 + number * 60,
  actual_time: redScore === -1 || blueScore === -1 ? null : 1770000000 + number * 60,
  winning_alliance: redScore === -1 || blueScore === -1 ? '' : redScore > blueScore ? 'red' : 'blue',
  alliances: {
    red: { score: redScore, team_keys: [`frc${number}01`, `frc${number}02`, `frc${number}03`] },
    blue: { score: blueScore, team_keys: [`frc${number}04`, `frc${number}05`, `frc${number}06`] }
  },
  score_breakdown: redScore === -1 || blueScore === -1 ? undefined : { red: { autoPoints: 1 }, blue: { autoPoints: 2 } }
});

test('Admin V4 team search resolves team names, numbers, and display labels', () => {
  const teamNumbers = ['103', '118', '254', '971', '1678', '4414'];
  const teamNameLookup = {
    '103': 'Cybersonics',
    '118': 'Robonauts',
    '254': 'Cheesy Poofs',
    '971': 'Spartan Robotics',
    '1678': 'Citrus Circuits',
    '4414': 'HighTide'
  };

  assert.equal(resolveAdminV4TeamSearchInput({ rawInput: 'Cheesy Poofs', teamNumbers, teamNameLookup }), '254');
  assert.equal(resolveAdminV4TeamSearchInput({ rawInput: 'citrus', teamNumbers, teamNameLookup }), '1678');
  assert.equal(resolveAdminV4TeamSearchInput({ rawInput: '1678 Citrus Circuits', teamNumbers, teamNameLookup }), '1678');
  assert.equal(resolveAdminV4TeamSearchInput({ rawInput: 'Team 118', teamNumbers, teamNameLookup }), '118');
  assert.equal(resolveAdminV4TeamSearchInput({ rawInput: 'not a real team', teamNumbers, teamNameLookup }), '');

  const suggestions = getAdminV4TeamSearchSuggestions({ rawInput: 'robo', teamNumbers, teamNameLookup });
  assert.equal(suggestions[0]?.teamNumber, '118');
  assert.equal(suggestions[0]?.matchLabel, 'Name starts with');
});

test('Admin V4 smart search resolves competition workflows, panels, tools, stats, and teams', () => {
  const teamNumbers = ['118', '254', '1678'];
  const teamNameLookup = {
    '118': 'Robonauts',
    '254': 'Cheesy Poofs',
    '1678': 'Citrus Circuits'
  };
  const statInfo = {
    ppa: {
      title: 'PPA',
      category: 'Derived',
      definition: 'Predictive performance average used for future match help.',
      whereAppears: ['Teams', 'Matches', 'Visualize']
    },
    dpr: {
      title: 'DPR',
      category: 'Secondhand',
      definition: 'Defensive power rating from official match score residuals.',
      whereAppears: ['Teams', 'Stats Wiki']
    },
    epa: {
      title: 'EPA',
      category: 'Secondhand',
      definition: 'External expected points added rating.',
      whereAppears: ['Teams']
    }
  };
  const search = rawInput =>
    getAdminV4SmartSearchSuggestions({
      rawInput,
      teamNumbers,
      teamNameLookup,
      statInfo,
      limit: 4
    })[0];

  assert.equal(search('scout assignment')?.kind, 'panel');
  assert.equal(search('scout assignment')?.panel, 'scouts');
  assert.equal(search('I need scout assignments')?.panel, 'scouts');
  assert.equal(search('schedule splitting for scouts')?.panel, 'scouts');
  assert.equal(search('maximize same teams for team members')?.panel, 'scouts');
  assert.equal(search('who scouts next')?.panel, 'scouts');
  assert.equal(search('who scouts 254')?.panel, 'scouts');
  assert.equal(search('make scout schedule')?.panel, 'scouts');
  assert.equal(search('which scout watches 254')?.panel, 'scouts');
  assert.equal(search('same teams per scout')?.panel, 'scouts');
  assert.equal(search('scout continuity')?.panel, 'scouts');
  assert.equal(search('send scouts to collect missing evidence')?.panel, 'collection');
  assert.equal(search('what should scouts do')?.panel, 'collection');
  assert.equal(search('we missed data')?.panel, 'collection');
  assert.equal(search('missing team data')?.panel, 'collection');
  assert.equal(search('coverage warnings')?.panel, 'collection');
  assert.equal(search('future matches')?.workflowKey, 'predictor');
  assert.equal(search('upcoming match forecasts')?.workflowKey, 'predictor');
  assert.equal(search('drive coach next qual')?.workflowKey, 'predictor');
  assert.equal(search('what is our next match')?.workflowKey, 'predictor');
  assert.equal(search('prepare drive team')?.workflowKey, 'predictor');
  assert.equal(search('refresh schedule')?.panel, 'sources');
  assert.equal(search('is TBA stale')?.panel, 'sources');
  assert.equal(search('refresh official data')?.panel, 'sources');
  assert.equal(search('what if match sim')?.tool, 'manualSimulator');
  assert.equal(search('manual match simulator')?.tool, 'manualSimulator');
  assert.equal(search('try alliance')?.tool, 'manualSimulator');
  assert.equal(search('matches')?.workflowKey, 'predictor');
  assert.equal(search('alliance selection')?.workflowKey, 'pickList');
  assert.equal(search('pick list')?.workflowKey, 'pickList');
  assert.equal(search('playoff shortlist')?.workflowKey, 'pickList');
  assert.equal(search('make pick list')?.workflowKey, 'pickList');
  assert.equal(search('bar chart compare')?.workflowKey, 'visualize');
  assert.equal(search('visualize')?.workflowKey, 'visualize');
  assert.equal(search('compare teams with vertical charts')?.workflowKey, 'visualize');
  assert.equal(search('side by side graphs')?.workflowKey, 'visualize');
  assert.equal(search('compare PPA EPA')?.workflowKey, 'visualize');
  assert.equal(search('stat help')?.tool, 'statsWiki');
  assert.equal(search('what does this stat mean')?.tool, 'statsWiki');
  assert.equal(search('why prediction')?.tool, 'statsWiki');
  assert.equal(search('DPR')?.kind, 'stat');
  assert.equal(search('DPR')?.statKey, 'dpr');
  assert.match(search('DPR')?.description || '', /Secondhand: Defensive power rating/);
  assert.match(search('DPR')?.description || '', /Appears in Teams, Stats Wiki/);
  assert.equal(search('what does DPR mean')?.statKey, 'dpr');
  assert.equal(search('why DPR')?.statKey, 'dpr');
  assert.equal(search('how is DPR calculated')?.statKey, 'dpr');
  assert.equal(search('calculate DPR')?.statKey, 'dpr');
  assert.equal(search('PPA formula')?.statKey, 'ppa');
  assert.match(search('PPA formula')?.description || '', /Appears in Teams, Matches, Visualize/);
  assert.equal(search('EPA rating')?.statKey, 'epa');
  assert.equal(search('Cheesy Poofs')?.teamNumber, '254');
  assert.equal(search('show me Cheesy Poofs')?.teamNumber, '254');
  assert.equal(search('excel judge export')?.workflowKey, 'export');
  assert.equal(search('reports')?.workflowKey, 'export');
  assert.equal(search('I need the judge export')?.workflowKey, 'export');
  assert.equal(search('make spreadsheet')?.workflowKey, 'export');
  assert.equal(search('sync backup')?.panel, 'backup');
  assert.equal(search('local cache backup')?.panel, 'backup');
  assert.equal(search('computer handoff')?.panel, 'backup');
  assert.equal(search('offline rows')?.panel, 'backup');
  assert.equal(search('bad numbers')?.panel, 'audit');
  assert.equal(search('number looks wrong')?.panel, 'audit');
  assert.equal(search('what numbers are suspicious')?.panel, 'audit');
  assert.equal(search('where is source freshness')?.panel, 'sources');
  assert.equal(search('TBA source freshness')?.panel, 'sources');
  assert.equal(search('help me with model trust')?.panel, 'models');
  assert.equal(search('can I trust the forecast')?.panel, 'models');
  assert.equal(search('can I trust this prediction')?.panel, 'models');
  assert.equal(search('prediction accuracy')?.panel, 'models');
  assert.equal(search('API credentials')?.tool, 'settings');
  assert.equal(search('FIRST credentials upload')?.tool, 'settings');
  assert.equal(search('name lock passphrase')?.tool, 'settings');
  assert.equal(search('change event key')?.tool, 'settings');
  assert.equal(search('unlock scout name')?.tool, 'settings');
  assert.equal(search('judge packet')?.workflowKey, 'export');

  const quickNeeds = getAdminV4SmartSearchSuggestions({
    rawInput: '',
    teamNumbers,
    teamNameLookup,
    statInfo,
    limit: 8
  });
  assert.deepEqual(quickNeeds.map(result => result.title), ['What do I do now?', 'Find a team', 'See future matches', 'Assign scouts', 'Compare stats', 'Explain a stat', 'Check sources', 'Export for judges']);
  assert.ok(quickNeeds.every(result => result.matchLabel === 'Quick need'));
  assert.deepEqual(quickNeeds.map(result => result.panel || result.tool || result.workflowKey), ['command', 'sorter', 'predictor', 'scouts', 'visualize', 'statsWiki', 'sources', 'export']);
});

const v3Row = matchNumber => ({
  schemaVersion: 'v3',
  eventKey: '2026MNUM',
  matchType: 'Qualification',
  matchNumber,
  matchKey: `qm${matchNumber}`,
  teamNumber: `${matchNumber}01`,
  scoutName: 'Scout',
  assignedScoutName: '',
  assignedSlot: '',
  alliance: 'Red',
  closeAccuracy: 0,
  middleAccuracy: 0,
  farAccuracy: 0,
  contributionScore: matchNumber,
  startingPosition: '',
  autoPoints: matchNumber,
  autoClimbed: false,
  teleopCycles: 0,
  teleopPoints: matchNumber,
  teleopClimbed: false,
  shootingStyle: '',
  climbLevel: 'None',
  trenchPushing: '',
  passing: '',
  driverSkill: 0,
  teamwork: 0,
  defenseDescription: '',
  generalEvaluation: '',
  totalMatchPoints: matchNumber
});

const v4Row = matchNumber => ({
  schemaVersion: 'v4',
  eventKey: '2026MNUM',
  matchType: 'Qualification',
  matchNumber,
  matchKey: `qm${matchNumber}`,
  teamNumber: `${matchNumber}02`,
  scoutName: 'Scout',
  assignedScoutName: '',
  assignedSlot: '',
  alliance: 'Blue',
  autoPoints: matchNumber,
  autoCycles: 0,
  teleopPoints: matchNumber,
  teleopCycles: 0,
  endgamePoints: 0,
  totalMatchPoints: matchNumber,
  rolePlayed: 'Offense',
  defendedTeamNumber: '',
  defenderFacedTeamNumber: '',
  defenseIntensity: 0,
  defenseDurationSeconds: 0,
  fouls: 0,
  techFouls: 0,
  robotDied: false,
  commsLost: false,
  mechanismBroke: false,
  tippedOver: false,
  failureReason: '',
  reliabilityScore: 1,
  notes: '',
  strategyNotes: ''
});

const defenseRow = matchNumber => ({
  schemaVersion: 'defense-v1',
  eventKey: '2026MNUM',
  matchType: 'Qualification',
  matchNumber,
  matchKey: `qm${matchNumber}`,
  teamNumber: `${matchNumber}03`,
  scoutName: 'Scout',
  assignedScoutName: '',
  assignedSlot: '',
  alliance: 'Red',
  defenseMetric: matchNumber,
  defenseComments: '',
  generalComments: ''
});

test('Admin V4 Test Mode rewinds matches and rows to before the selected match', () => {
  const scope = buildAdminV4TestModeScope({
    enabled: true,
    matchKey: '2026mnum_qm3',
    matches: [match(4, 40, 30), match(2, 20, 10), match(3, 30, 10), match(1, 10, 5)],
    records: [v3Row(1), v3Row(2), v3Row(3)],
    v4Records: [v4Row(2), v4Row(3)],
    defenseRecords: [defenseRow(1), defenseRow(4)]
  });

  assert.equal(scope.active, true);
  assert.equal(scope.selectedMatchLabel, 'QM3');
  assert.deepEqual(scope.records.map(row => row.matchNumber), [1, 2]);
  assert.deepEqual(scope.v4Records.map(row => row.matchNumber), [2]);
  assert.deepEqual(scope.defenseRecords.map(row => row.matchNumber), [1]);
  assert.deepEqual(scope.matches.map(row => getAdminV4MatchLabel(row)), ['QM1', 'QM2', 'QM3', 'QM4']);
  assert.equal(scope.matches[0].alliances.red.score, 10);
  assert.equal(scope.matches[1].alliances.red.score, 20);
  assert.equal(scope.matches[2].alliances.red.score, -1);
  assert.equal(scope.matches[2].score_breakdown, undefined);
  assert.equal(scope.matches[3].alliances.red.score, -1);
  assert.equal(scope.scopedPlayedMatchCount, 2);
  assert.equal(scope.futureMatchCount, 2);
  assert.equal(scope.sourceRecordCount, 7);
  assert.equal(scope.scopedRecordCount, 4);
});

test('Admin V4 Test Mode leaves data unchanged until a cutoff match is selected', () => {
  const matches = [match(2), match(1)];
  const sorted = sortAdminV4MatchesForTestMode(matches);
  const scope = buildAdminV4TestModeScope({
    enabled: true,
    matchKey: '',
    matches,
    records: [v3Row(2)],
    v4Records: [v4Row(2)],
    defenseRecords: [defenseRow(2)]
  });

  assert.equal(scope.active, false);
  assert.deepEqual(sorted.map(row => getAdminV4MatchLabel(row)), ['QM1', 'QM2']);
  assert.equal(scope.records.length, 1);
  assert.equal(scope.v4Records.length, 1);
  assert.equal(scope.defenseRecords.length, 1);
});

test('Admin V4 local fixture uses normalized defense metrics', () => {
  const fixture = buildLocalAdminV4TestModeFixture();
  assert.equal(fixture.matchKey, 'testmode_qm3');
  assert.ok(fixture.defenseRecords.length > 0);
  fixture.defenseRecords.forEach(record => {
    assert.equal(record.schemaVersion, 'defense-v1');
    assert.ok(record.defenseMetric >= 0);
    assert.ok(record.defenseMetric <= 1);
  });
});

test('Admin V4 defense metric aggregation clamps impossible values before display', () => {
  const rows = [
    { ...defenseRow(1), teamNumber: '254', defenseMetric: 2.25 },
    { ...defenseRow(2), teamNumber: '254', defenseMetric: -0.4 },
    { ...defenseRow(3), teamNumber: '254', defenseMetric: 0.5 },
    { ...defenseRow(4), teamNumber: '118', defenseMetric: Number.NaN }
  ];

  const summary = summarizeDefenseMetricGuardrails(rows);
  assert.equal(summary.totalRecords, 4);
  assert.equal(summary.adjustedRecords, 3);
  assert.equal(summary.invalidRecords, 1);

  const metrics = buildTeamDefenseMetrics(rows);
  const team254 = metrics.find(row => row.teamNumber === '254');
  const team118 = metrics.find(row => row.teamNumber === '118');
  assert.ok(team254);
  assert.ok(team118);
  assert.equal(team254.avgDefenseMetric, 0.5);
  assert.equal(team118.avgDefenseMetric, 0);
});

test('Admin V4 routes preserve safe context params while changing workflow state', () => {
  assert.equal(
    buildAdminV4Route('?fixture=test-mode&event=2026MNUM&year=2026&tab=now&match=old', { tab: 'teams', team: '254' }),
    '/adminv4?fixture=test-mode&event=2026MNUM&year=2026&tab=teams&team=254'
  );
  assert.equal(
    buildAdminV4Route('?fixture=test-mode&eventKey=2026MNUM&tab=teams&team=254', { tab: 'wiki', stat: 'ppa', from: 'teams', team: '254' }),
    '/adminv4?fixture=test-mode&eventKey=2026MNUM&tab=wiki&team=254&from=teams&stat=ppa'
  );
  assert.equal(
    buildAdminV4Route('?unsafe=drop-me&fixture=test-mode', { tab: 'data', panel: 'collection' }),
    '/adminv4?fixture=test-mode&tab=data&panel=collection'
  );
});

test('Admin V4 route helpers centralize workflow, return, and metric-surface interpretation', () => {
  assert.equal(workflowFromAdminRouteTab('now'), 'command');
  assert.equal(workflowFromAdminRouteTab('picklist'), 'pickList');
  assert.equal(workflowFromAdminRouteTab('reports'), 'export');
  assert.equal(workflowFromAdminRouteTab('bad'), null);

  assert.equal(dataPanelFromAdminRouteParam('sources'), 'sources');
  assert.equal(dataPanelFromAdminRouteParam('raw'), null);

  assert.equal(activeWorkspaceKeyFromTab('simulator'), 'predictor');
  assert.equal(activeWorkspaceKeyFromTab('rawEditor'), 'import');
  assert.equal(activeWorkspaceKeyFromTab('wiki'), 'command');

  assert.equal(adminReturnTabFromRouteParam('manual'), 'simulator');
  assert.equal(adminReturnTabFromRouteParam('raw-editor'), 'rawEditor');
  assert.equal(teamReturnTabFromRouteParam('teams'), 'sorter');
  assert.equal(teamReturnTabFromRouteParam('wiki'), 'command');

  assert.equal(adminRouteParamFromTab('rawEditor'), 'raw-editor');
  assert.equal(adminRouteParamFromTab('pickList'), 'pick-list');
  assert.equal(metricSurfaceFromTab('teams'), 'teams');
  assert.equal(metricSurfaceFromTab('results'), 'matches');
  assert.equal(metricSurfaceFromTab('export'), 'reports');
});

test('Admin V4 strategy copy only says our alliance when the selected alliance is ours', () => {
  const plan = {
    predictedWinner: 'Blue',
    redRoleOptions: [{ rationale: 'red protects the floor' }],
    blueRoleOptions: [{ rationale: 'blue plays clean offense' }]
  };

  assert.equal(
    formatStrategyWinConditionForAlliance(plan, 'Red', { ownPerspective: true }),
    'Our red alliance win condition: red protects the floor'
  );
  assert.equal(
    formatStrategyWinConditionForAlliance(plan, 'Blue', { ownPerspective: true }),
    'Our blue alliance win condition: blue plays clean offense'
  );
  assert.equal(
    formatStrategyWinConditionForAlliance(plan, 'Blue', { ownPerspective: false }),
    'Blue alliance win condition: blue plays clean offense'
  );
  assert.doesNotMatch(
    formatStrategyWinConditionForAlliance(plan, 'Blue', { ownPerspective: false }),
    /Our blue alliance/
  );
});

test('Admin V4 settings do not persist Test Mode as an ordinary saved setting', () => {
  const values = new Map();
  const previousWindow = globalThis.window;
  globalThis.window = {
    localStorage: {
      getItem: key => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value)
    }
  };

  try {
    saveAdminV4Settings({
      eventKey: '2026MNUM',
      ownTeamNumber: '254',
      selectedMetric: 'ppa',
      searchedTeamNumber: '118',
      testModeEnabled: true,
      testModeEventKey: 'TESTMODE',
      testModeMatchKey: 'testmode_qm3'
    });

    const loaded = loadAdminV4Settings();
    assert.equal(loaded.eventKey, '2026MNUM');
    assert.equal(loaded.ownTeamNumber, '254');
    assert.equal(loaded.testModeEventKey, 'TESTMODE');
    assert.equal(loaded.testModeEnabled, false);
    assert.equal(loaded.testModeMatchKey, '');
    assert.ok(values.has('admin_v4_settings'));
    assert.ok(values.has('admin_v2_settings'));
  } finally {
    if (previousWindow === undefined) {
      delete globalThis.window;
    } else {
      globalThis.window = previousWindow;
    }
  }
});

test('Admin V4 local source storage uses V4 keys while reading legacy V2 keys', () => {
  const values = new Map();
  const previousWindow = globalThis.window;
  globalThis.window = {
    localStorage: {
      getItem: key => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value)
    }
  };

  try {
    values.set('admin_v2_settings', JSON.stringify({
      eventKey: '2026LEGACY',
      ownTeamNumber: '118',
      selectedMetric: 'epa',
      searchedTeamNumber: '254',
      testModeEnabled: true,
      testModeEventKey: 'TESTMODE',
      testModeMatchKey: 'testmode_qm3'
    }));
    assert.equal(loadAdminV4Settings().eventKey, '2026LEGACY');

    const legacyPack = {
      eventKey: '2026legacy',
      loadedAt: 1234,
      teamList: {
        fileName: 'teams.json',
        loadedAt: 1234,
        teamNames: { 254: 'Cheesy Poofs' }
      }
    };
    values.set('adminv2_tba_csv_pack:2026legacy', JSON.stringify(legacyPack));
    assert.equal(loadUploadedTbaCsvPack('2026legacy')?.teamList?.teamNames['254'], 'Cheesy Poofs');

    saveUploadedTbaCsvPack('2026legacy', legacyPack);
    assert.ok(values.has('adminv4_tba_csv_pack:2026legacy'));
    assert.ok(values.has('adminv2_tba_csv_pack:2026legacy'));
  } finally {
    if (previousWindow === undefined) {
      delete globalThis.window;
    } else {
      globalThis.window = previousWindow;
    }
  }
});

test('Scout identity lock stores only hash for scout-facing unlock checks', async () => {
  const values = new Map();
  const previousWindow = globalThis.window;
  globalThis.window = {
    localStorage: {
      getItem: key => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value)
    }
  };

  try {
    assert.equal(getScoutIdentityUnlockHash(), DEFAULT_SCOUT_IDENTITY_UNLOCK_HASH);
    assert.equal(await verifyScoutIdentityUnlockPassphrase('leoscout'), true);
    assert.equal(await verifyScoutIdentityUnlockPassphrase('wrong'), false);

    const customHash = await saveAdminScoutIdentityPassphrase('team-admin-pass');
    assert.equal(values.get('scout_identity_unlock_hash'), customHash);
    assert.equal(values.get('admin_v4_scout_identity_unlock_passphrase'), 'team-admin-pass');
    assert.equal(await verifyScoutIdentityUnlockPassphrase('team-admin-pass'), true);
    assert.equal(await verifyScoutIdentityUnlockPassphrase('leoscout'), false);
  } finally {
    if (previousWindow === undefined) {
      delete globalThis.window;
    } else {
      globalThis.window = previousWindow;
    }
  }
});

test('Admin V4 pick-list local state is normalized and event-scoped', () => {
  assert.equal(getAdminV4PickListStorageKey('2026mnum'), 'adminv4_pick_list_state_2026MNUM');
  assert.equal(normalizeAdminV4AllianceSeed(99), 8);
  assert.equal(normalizeAdminV4AllianceSeed(0), 1);
  assert.deepEqual(
    normalizeAdminV4PickStatusMap({
      frc254: { status: 'picked', pickedBy: 'A1' },
      '118': { status: 'declined' },
      bad: { status: 'picked' },
      '1678': { status: 'available' },
      '1323': { status: 'not-a-status' }
    }),
    {
      254: { status: 'picked', pickedBy: 'A1' },
      118: { status: 'declined', pickedBy: '' }
    }
  );

  const values = new Map();
  const previousWindow = globalThis.window;
  globalThis.window = {
    localStorage: {
      getItem: key => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value)
    }
  };

  try {
    saveAdminV4PickListState('2026mnum', 9, {
      254: { status: 'picked', pickedBy: 'A1' },
      1678: { status: 'available' },
      x999: { status: 'unavailable', pickedBy: 'Other' }
    });
    const loaded = loadAdminV4PickListState('2026MNUM');
    assert.equal(loaded.allianceSeed, 8);
    assert.deepEqual(loaded.statuses, {
      254: { status: 'picked', pickedBy: 'A1' },
      999: { status: 'unavailable', pickedBy: 'Other' }
    });
  } finally {
    if (previousWindow === undefined) {
      delete globalThis.window;
    } else {
      globalThis.window = previousWindow;
    }
  }
});

test('Admin V4 formatting helpers keep operational labels consistent', () => {
  assert.equal(formatAdminV4MetricValue(12.345, 1), '12.3');
  assert.equal(formatAdminV4MetricValue(Number.NaN), '—');
  assert.equal(formatAdminV4PercentMetric(0.875, 1), '87.5%');
  assert.equal(formatAdminV4SignedMetric(3.2, 1), '+3.2');
  assert.equal(formatAdminV4SignedMetric(-1.25, 1), '-1.3');
  assert.equal(formatAdminV4PpaRange({ floor: 41.2, expected: 55.8, ceiling: null }), '41 / 56 / —');
  assert.equal(getAdminV4FreshnessAge(1_000_000, 1_000_040), 'Just now');
  assert.equal(getAdminV4FreshnessAge(1_000_000, 1_000_000 + 11 * 60 * 1000), '11 min ago');
  assert.equal(getAdminV4FreshnessAge(1_000_000, 1_000_000 + 3 * 60 * 60 * 1000), '3 hr ago');
  assert.equal(describeAdminV4CachedPayload([1, 2, 3]), '3 rows');
  assert.equal(describeAdminV4CachedPayload({ a: 1, b: 2 }), '2 keys');
  assert.deepEqual(parseAdminV4TeamNumbers('frc254, 118 1678x'), ['254', '118', '1678']);
  assert.deepEqual(parseAdminV4QuickTeamEntry('254 118 1678 1323 971 4414 604'), {
    redTeams: ['254', '118', '1678', '1323'],
    blueTeams: ['971', '4414', '604']
  });
  assert.match(stringifyAdminV4WorkbookCell('x'.repeat(40000)), /truncated/);
});

test('Admin V4 match helpers keep match/result interpretation centralized', () => {
  assert.equal(normalizeAdminV4TeamKey('frc254'), '254');
  assert.equal(normalizeAdminV4TeamKey('118'), '118');
  assert.equal(isAdminV4PlayedMatch(match(1)), false);
  assert.equal(isAdminV4PlayedMatch(match(1, 100, 90)), true);
  assert.equal(getAdminV4PlayedMatchWinner(match(1, 100, 90)), 'Red');
  assert.equal(getAdminV4PlayedMatchWinner(match(1, 80, 80)), 'Tie');
  assert.equal(getAdminV4CompLevelLabel('qm'), 'Qual');
  assert.equal(getAdminV4CompLevelLabel('pm'), 'Practice');
  assert.equal(getAdminV4CompLevelLabel('custom'), 'CUSTOM');
  assert.equal(formatAdminV4Record({ wins: 8, losses: 2, ties: 1 }), '8-2-1');
  assert.equal(getAdminV4PredictorViewDescription('finals'), 'Full playoff bracket forecast using the selected model with published alliance and playoff structure.');
  assert.equal(getAdminV4ResultsViewDescription('practice'), 'Practice match results ordered from Practice 1 upward.');
  assert.equal(getAdminV4PlayoffStatusLabel('if-necessary'), 'If Necessary');
  assert.equal(getAdminV4PlayoffStatusLabel('pending'), 'Pending');

  assert.deepEqual(
    sortAdminV4ScoutRowsByMatchThenTeam([
      { matchNumber: 2, teamNumber: '118', timestamp: 2 },
      { matchNumber: 1, teamNumber: '254', timestamp: 2 },
      { matchNumber: 1, teamNumber: '118', timestamp: 3 },
      { matchNumber: 1, teamNumber: '118', timestamp: 1 }
    ]).map(row => `${row.matchNumber}:${row.teamNumber}:${row.timestamp}`),
    ['1:118:1', '1:118:3', '1:254:2', '2:118:2']
  );

  const legacyRow = { schemaVersion: 'v3', matchKey: 'qm1', matchNumber: 1, teamNumber: '254', timestamp: 1, totalMatchPoints: 10 };
  const newerRow = { schemaVersion: 'v3', matchKey: 'qm1', matchNumber: 1, teamNumber: '254', timestamp: 2, totalMatchPoints: 20 };
  const otherRow = { schemaVersion: 'v3', matchKey: 'qm1', matchNumber: 1, teamNumber: '118', timestamp: 1, totalMatchPoints: 30 };
  assert.deepEqual(
    mergeAdminV4V3WithLegacyRows([legacyRow], [newerRow, otherRow]).map(row => `${row.teamNumber}:${row.totalMatchPoints}`),
    ['118:30', '254:20']
  );
  assert.equal(isLegacyAdminV4MatchScoutingV2({ eventKey: '2026mnum', matchKey: 'qm1', teamNumber: '254' }), true);
  assert.equal(isLegacyAdminV4MatchScoutingV2({ schemaVersion: 'v3', eventKey: '2026mnum', matchKey: 'qm1', teamNumber: '254' }), false);
});

test('Admin V4 backup import preview counts sections and leaves settings opt-in', () => {
  const backup = {
    format: 'rebuilt-2026-admin-v4-full-local-backup',
    version: 2,
    eventKey: '2026MNUM',
    exportedAt: 1770000000000,
    settings: { eventKey: '2026MNUM', ownTeamNumber: '254', selectedMetric: 'ppa', searchedTeamNumber: '', testModeEnabled: false, testModeEventKey: '', testModeMatchKey: '' },
    uploadedTbaPack: { files: {}, importedAt: 1770000000000, messages: [] },
    preMatchCache: { eventKey: '2026MNUM', profiles: [{ teamNumber: '254' }], adminTaskEvidence: [{ teamNumber: '118' }] },
    scoutArchive: { version: 1, username: 'Scout', exportedAt: 1770000000000, records: [{ id: 'row-1' }, { id: 'row-2' }] },
    adminV4: {
      cacheEntries: [{ id: 'cache-1' }, { id: 'cache-2' }, { id: 'cache-3' }],
      powerCoinBets: [{ id: 'bet-1' }],
      powerCoinLedger: [{ id: 'ledger-1' }, { id: 'ledger-2' }],
      scoutAssignmentPlan: { assignments: [{ matchKey: 'qm1' }, { matchKey: 'qm2' }] },
      modelSnapshots: [{ id: 'model-1' }],
      modelFeatureSnapshots: [{ id: 'feature-1' }, { id: 'feature-2' }]
    }
  };

  assert.equal(isAdminV4FullLocalBackup(backup), true);
  const payload = getAdminV4BackupPayload(backup);
  assert.equal(countBackupImportCategory(backup, payload, 'scoutArchive'), 2);
  assert.equal(countBackupImportCategory(backup, payload, 'sourceCache'), 3);
  assert.equal(countBackupImportCategory(backup, payload, 'scoutRewards'), 3);
  assert.equal(countBackupImportCategory(backup, payload, 'scoutAssignments'), 2);
  assert.equal(countBackupImportCategory(backup, payload, 'modelSnapshots'), 3);
  assert.equal(countBackupImportCategory(backup, payload, 'uploadedTba'), 1);
  assert.equal(countBackupImportCategory(backup, payload, 'preScoutCache'), 2);
  assert.equal(countBackupImportCategory(backup, payload, 'settings'), 1);
  assert.equal(DEFAULT_BACKUP_IMPORT_OPTIONS.settings, false);
  assert.equal(DEFAULT_BACKUP_IMPORT_OPTIONS.scoutArchive, true);
});
