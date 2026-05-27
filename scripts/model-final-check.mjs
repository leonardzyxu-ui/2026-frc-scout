import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = path.join(repoRoot, 'modeling/artifacts/reports/final-judge-dashboard');
const summaryPath = path.join(outputDir, 'final-check-summary.json');
const humanSummaryPath = path.join(outputDir, 'FINAL_CHECK_SUMMARY.md');
const MINIMUM_FINAL_CHECK_TESTS = 38;
const FINAL_DEADLINE_TARGET = 'Saturday May 23 2026 18:00 CST';
const FINAL_DEADLINE_LOCAL = '2026-05-23 18:00:00 CST (Asia/Shanghai, UTC+08:00)';
const FINAL_DEADLINE_MS = Date.parse('2026-05-23T18:00:00+08:00');
const REQUIRED_QUICK_JUMP_TARGETS = [
  'start-here-story',
  'final-gate-proof',
  'screenshot-proof-index',
  'documentation-proof-index',
  'live-demo-runbook',
  'claim-boundaries',
  'leakage-audit',
  'hostile-judge-cross-exam',
  'judge-rubric-alignment',
  'judge-dry-run-scorecard',
  'judge-story-spine',
  'finalist-comparison',
  'model-anatomy',
  'model-source-map',
  'prediction-behavior',
  'strategy-example',
  'failure-mode-atlas',
  'evidence-matrix',
  'risk-register',
  'final-readiness-check',
  'final-package-map',
  'model-leaderboard',
  'what-should-surprise',
  'starred-html-coverage',
  'source-code-evidence-lock'
];
const REQUIRED_SOURCE_DIGESTS = [
  { label: 'Best model code', path: 'modeling/src/modeling/train.ts' },
  { label: 'Walk-forward features', path: 'modeling/src/modeling/features.ts' },
  { label: 'Model diagnostics', path: 'modeling/src/modeling/diagnostics.ts' },
  { label: 'Report scoring code', path: 'modeling/src/reporting/report.ts' },
  { label: 'Training CLI', path: 'modeling/src/cli.ts' },
  { label: 'Research log', path: 'modeling/MODELING_RESEARCH_LOG.md' }
];

const formatShanghaiTimestamp = date => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      hourCycle: 'h23'
    })
      .formatToParts(date)
      .map(part => [part.type, part.value])
  );
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second} CST (Asia/Shanghai, UTC+08:00)`;
};

const plannedSteps = [
  { label: 'Regenerate dashboard package', command: 'npm run model:dashboard' },
  { label: 'Refresh browser QA and screenshots', command: 'npm run model:qa-dashboard' },
  { label: 'Type-check modeling code', command: 'npm run model:typecheck' },
  { label: 'Run full test suite', command: 'npm run test' }
];

const runCommand = command =>
  new Promise(resolve => {
    const startedAtMs = Date.now();
    const child = spawn(command, {
      cwd: repoRoot,
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env
    });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', chunk => {
      const text = chunk.toString();
      stdout += text;
      process.stdout.write(text);
    });
    child.stderr.on('data', chunk => {
      const text = chunk.toString();
      stderr += text;
      process.stderr.write(text);
    });
    child.on('close', exitCode => {
      const endedAtMs = Date.now();
      resolve({
        command,
        status: exitCode === 0 ? 'passed' : 'failed',
        exitCode,
        startedAt: new Date(startedAtMs).toISOString(),
        endedAt: new Date(endedAtMs).toISOString(),
        durationMs: endedAtMs - startedAtMs,
        stdoutTail: stdout.slice(-4000),
        stderrTail: stderr.slice(-4000)
      });
    });
  });

const markdownCell = value => String(value ?? 'n/a').replace(/\|/g, '\\|').replace(/\n/g, '<br>');

const buildViewportLine = viewport => {
  if (!viewport || typeof viewport !== 'object') return 'n/a';
  return `body ${viewport.missingText ?? 'n/a'}, header ${viewport.missingHeaderText ?? 'n/a'}, forbidden ${
    viewport.forbiddenMatches ?? 'n/a'
  }, overflow ${viewport.pageOverflow === false ? 'no' : viewport.pageOverflow ?? 'n/a'}, offenders ${
    viewport.outsideTableOffenders ?? 'n/a'
  }`;
};

const shortHash = value => (typeof value === 'string' && value.length >= 12 ? value.slice(0, 12) : 'n/a');

const buildHumanSummary = summary => {
  const steps = Array.isArray(summary.steps) ? summary.steps : [];
  const claim = summary.postChecks?.handoffClaimDigest;
  const testSuite = summary.postChecks?.testSuiteHealth;
  const browserQa = summary.postChecks?.browserQaHealth;
  const navigationAnchors = summary.postChecks?.navigationAnchors;
  const sourceCodeEvidence = summary.postChecks?.sourceCodeEvidence;
  const screenshots = summary.postChecks?.screenshotDimensions?.screenshots ?? {};
  const finalVerifier = summary.finalVerifier ?? {};

  return `# Final Check Summary

Generated (UTC): ${summary.generatedAt ?? new Date().toISOString()}
Generated (CST / Asia-Shanghai): ${summary.generatedAtLocal ?? formatShanghaiTimestamp(new Date())}

## Deadline Proof

- Deadline target: ${summary.deadlineProof?.target ?? FINAL_DEADLINE_TARGET}
- Deadline local time: ${summary.deadlineProof?.deadlineLocal ?? FINAL_DEADLINE_LOCAL}
- Generated before deadline: ${summary.deadlineProof?.generatedBeforeDeadline === true ? 'yes' : summary.deadlineProof?.generatedBeforeDeadline ?? 'n/a'}

## Result

${String(summary.status ?? 'unknown').toUpperCase()}

${summary.explanation ?? 'No explanation recorded.'}

## Promoted Model Claim

- Deadline target: ${claim?.deadlineTarget ?? 'n/a'}
- Displayed model: ${claim?.currentDisplayedModelShortName ?? 'n/a'}
- Weighted score MAE: ${claim?.headlineMetrics?.weightedScoreMae ?? 'n/a'}
- Weighted margin MAE: ${claim?.headlineMetrics?.weightedMarginMae ?? 'n/a'}
- Weighted Brier: ${claim?.headlineMetrics?.weightedBrier ?? 'n/a'}
- Deployment score: ${claim?.headlineMetrics?.deploymentScore ?? 'n/a'}

## Command Steps

| Step | Command | Status | Exit code | Duration ms |
| --- | --- | --- | ---: | ---: |
${steps
  .map(
    step =>
      `| ${markdownCell(step.label)} | \`${markdownCell(step.command)}\` | ${markdownCell(step.status)} | ${markdownCell(
        step.exitCode
      )} | ${markdownCell(step.durationMs)} |`
  )
  .join('\n')}

## Test Suite

- Test suite status: ${testSuite?.status ?? 'n/a'}
- Test command: \`${testSuite?.command ?? 'npm run test'}\`
- Tests passed: ${testSuite?.pass ?? 'n/a'}/${testSuite?.tests ?? 'n/a'}
- Failed/cancelled tests: ${testSuite?.fail ?? 'n/a'}/${testSuite?.cancelled ?? 'n/a'}
- Skipped/planned tests: ${testSuite?.skipped ?? 'n/a'}/${testSuite?.todo ?? 'n/a'}

## Post-Checks

- Post-check status: ${summary.postChecks?.status ?? 'n/a'}
- Port 4177 closed: ${summary.postChecks?.port4177Closed === true ? 'yes' : summary.postChecks?.port4177Closed ?? 'n/a'}
- Deliverables coverage: ${summary.postChecks?.deliverablesCoverage?.files ?? 'n/a'} files / ${
    summary.postChecks?.deliverablesCoverage?.manifestPaths ?? 'n/a'
  } manifest paths
- Files missing from deliverables.json: ${
    summary.postChecks?.deliverablesCoverage?.missingFromDeliverables?.length
      ? summary.postChecks.deliverablesCoverage.missingFromDeliverables.join(', ')
      : 'none'
  }
- Manifest paths missing on disk: ${
    summary.postChecks?.deliverablesCoverage?.missingOnDisk?.length
      ? summary.postChecks.deliverablesCoverage.missingOnDisk.join(', ')
      : 'none'
  }
- Entry-point final-check text: ${
    summary.postChecks?.entryPointFinalCheckText
      ? Object.entries(summary.postChecks.entryPointFinalCheckText)
          .map(([fileName, present]) => `${fileName}=${present ? 'yes' : 'no'}`)
          .join(', ')
      : 'n/a'
  }
- Quick Jump anchor status: ${navigationAnchors?.status ?? 'n/a'}
- Quick Jump anchor targets: ${
    Array.isArray(navigationAnchors?.targets) ? navigationAnchors.targets.map(target => `#${target}`).join(', ') : 'n/a'
  }
- Source code evidence status: ${sourceCodeEvidence?.status ?? 'n/a'}
- Source code fingerprints matched: ${
    Array.isArray(sourceCodeEvidence?.entries)
      ? `${sourceCodeEvidence.entries.filter(entry => entry?.manifestMatches === true).length}/${sourceCodeEvidence.entries.length}`
      : 'n/a'
  }

## Source Code Evidence

| Label | Path | Bytes | SHA-256 |
| --- | --- | ---: | --- |
${
  Array.isArray(sourceCodeEvidence?.entries)
    ? sourceCodeEvidence.entries
        .map(
          entry =>
            `| ${markdownCell(entry.label)} | \`${markdownCell(entry.path)}\` | ${markdownCell(entry.bytes)} | \`${markdownCell(
              shortHash(entry.sha256)
            )}\` |`
        )
        .join('\n')
    : '| n/a | n/a | n/a | n/a |'
}

## Browser QA

- Browser QA status: ${browserQa?.status ?? 'n/a'}
- Checked at: ${browserQa?.checkedAt ?? 'n/a'}
- Required body text count: ${browserQa?.requiredBodyText ?? 'n/a'}
- Console issues: ${browserQa?.consoleIssues ?? 'n/a'}
- Page errors: ${browserQa?.pageErrors ?? 'n/a'}
- Desktop checks: ${buildViewportLine(browserQa?.desktop)}
- Mobile checks: ${buildViewportLine(browserQa?.mobile)}

## Screenshot Dimensions

| Screenshot | Width | Height |
| --- | ---: | ---: |
${Object.entries(screenshots)
  .map(([name, dimensions]) => {
    const row = dimensions && typeof dimensions === 'object' ? dimensions : {};
    return `| ${markdownCell(name)} | ${markdownCell(row.width)} | ${markdownCell(row.height)} |`;
  })
  .join('\n')}

## Final Verifier

- Command: \`${finalVerifier.command ?? 'npm run model:verify-dashboard'}\`
- Runs after summary write: ${finalVerifier.runsAfterSummaryWrite === true ? 'yes' : finalVerifier.runsAfterSummaryWrite ?? 'n/a'}
- Status: ${finalVerifier.status ?? 'n/a'}
- Exit code: ${finalVerifier.exitCode ?? 'n/a'}
- Duration ms: ${finalVerifier.durationMs ?? 'n/a'}
- Final summary verified by second run: ${finalVerifier.verifiedFinalSummaryWithSecondRun === true ? 'yes' : finalVerifier.verifiedFinalSummaryWithSecondRun ?? 'n/a'}

## What This Proves

This file proves the local handoff gate ran and recorded its own result. It does not prove the model is perfect; it proves the generated package, browser QA, screenshots, typecheck, tests, manifest coverage, and final verifier agreed after the latest edit.
`;
};

const writeSummary = summary => {
  const generatedAt = summary.generatedAt ?? new Date().toISOString();
  const enrichedSummary = {
    ...summary,
    generatedAt,
    generatedAtLocal: summary.generatedAtLocal ?? formatShanghaiTimestamp(new Date(generatedAt)),
    deadlineProof: summary.deadlineProof ?? {
      target: FINAL_DEADLINE_TARGET,
      deadlineLocal: FINAL_DEADLINE_LOCAL,
      generatedBeforeDeadline: Date.parse(generatedAt) <= FINAL_DEADLINE_MS
    }
  };
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(summaryPath, `${JSON.stringify(enrichedSummary, null, 2)}\n`);
  fs.writeFileSync(humanSummaryPath, buildHumanSummary(enrichedSummary));
};

const isPortOpen = (host, port) =>
  new Promise(resolve => {
    const socket = net.createConnection({ host, port });
    const finish = value => {
      socket.destroy();
      resolve(value);
    };

    socket.setTimeout(1000);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
  });

const collectManifestPaths = manifest => {
  const manifestPaths = new Set();
  Object.values(manifest).forEach(value => {
    if (typeof value === 'string' && value.startsWith(outputDir)) {
      manifestPaths.add(path.basename(value));
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.values(value).forEach(nested => {
        if (typeof nested === 'string' && nested.startsWith(outputDir)) {
          manifestPaths.add(path.basename(nested));
        }
      });
    }
  });
  return manifestPaths;
};

const auditDeliverablesCoverage = () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(outputDir, 'deliverables.json'), 'utf8'));
  const manifestPaths = collectManifestPaths(manifest);
  const files = fs.readdirSync(outputDir).filter(name => fs.statSync(path.join(outputDir, name)).isFile()).sort();
  const ignored = new Set(['.DS_Store']);

  return {
    files: files.length,
    manifestPaths: manifestPaths.size,
    missingFromDeliverables: files.filter(name => !ignored.has(name) && !manifestPaths.has(name)),
    missingOnDisk: [...manifestPaths].filter(name => !fs.existsSync(path.join(outputDir, name))).sort()
  };
};

const auditHandoffClaimDigest = () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(outputDir, 'deliverables.json'), 'utf8'));
  const headlineMetrics =
    manifest.headlineMetrics && typeof manifest.headlineMetrics === 'object' && !Array.isArray(manifest.headlineMetrics)
      ? manifest.headlineMetrics
      : {};
  const allPassed =
    typeof manifest.deadlineTarget === 'string' &&
    typeof manifest.currentDisplayedModelShortName === 'string' &&
    typeof manifest.currentDisplayedModel === 'string' &&
    typeof headlineMetrics.weightedScoreMae === 'string' &&
    typeof headlineMetrics.weightedMarginMae === 'string' &&
    typeof headlineMetrics.weightedBrier === 'string' &&
    typeof headlineMetrics.deploymentScore === 'string';

  return {
    status: allPassed ? 'passed' : 'failed',
    deadlineTarget: manifest.deadlineTarget ?? null,
    currentDisplayedModelShortName: manifest.currentDisplayedModelShortName ?? null,
    currentDisplayedModel: manifest.currentDisplayedModel ?? null,
    headlineMetrics: {
      weightedScoreMae: headlineMetrics.weightedScoreMae ?? null,
      weightedMarginMae: headlineMetrics.weightedMarginMae ?? null,
      weightedBrier: headlineMetrics.weightedBrier ?? null,
      deploymentScore: headlineMetrics.deploymentScore ?? null
    }
  };
};

const auditEntryPointText = () =>
  Object.fromEntries(
    ['README.md', 'OPEN_THIS_FIRST.md', 'DELIVERABLES.md', 'EVIDENCE_MATRIX.md'].map(name => [
      name,
      fs.readFileSync(path.join(outputDir, name), 'utf8').includes('npm run model:final-check')
    ])
  );

const extractAnchorTargets = html => [
  ...new Set(
    [...html.matchAll(/href=["']#([^"']+)["']/g)]
      .map(match => match[1])
      .filter(target => typeof target === 'string' && target.length > 0)
  )
];

const extractIds = html => [
  ...new Set(
    [...html.matchAll(/\sid=["']([^"']+)["']/g)]
      .map(match => match[1])
      .filter(target => typeof target === 'string' && target.length > 0)
  )
];

const auditNavigationAnchors = () => {
  const html = fs.readFileSync(path.join(outputDir, 'index.html'), 'utf8');
  const targets = extractAnchorTargets(html);
  const ids = new Set(extractIds(html));
  const missingTargets = REQUIRED_QUICK_JUMP_TARGETS.filter(target => !targets.includes(target));
  const missingTargetIds = targets.filter(target => !ids.has(target));
  const allPassed = missingTargets.length === 0 && missingTargetIds.length === 0;

  return {
    status: allPassed ? 'passed' : 'failed',
    requiredTargets: REQUIRED_QUICK_JUMP_TARGETS,
    targets,
    missingTargets,
    missingTargetIds
  };
};

const sha256File = filePath => crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');

const auditSourceCodeEvidence = () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(outputDir, 'artifact-fingerprints.json'), 'utf8'));
  const artifacts = Array.isArray(manifest.artifacts) ? manifest.artifacts : [];
  const entries = REQUIRED_SOURCE_DIGESTS.map(expected => {
    const absolutePath = path.join(repoRoot, expected.path);
    const manifestEntry = artifacts.find(entry => entry?.label === expected.label && entry?.path === expected.path);
    const exists = fs.existsSync(absolutePath);
    const bytes = exists ? fs.statSync(absolutePath).size : null;
    const sha256 = exists ? sha256File(absolutePath) : null;
    const manifestMatches = Boolean(
      manifestEntry &&
        exists &&
        manifestEntry.bytes === bytes &&
        manifestEntry.sha256 === sha256
    );

    return {
      label: expected.label,
      path: expected.path,
      exists,
      bytes,
      sha256,
      manifestBytes: manifestEntry?.bytes ?? null,
      manifestSha256: manifestEntry?.sha256 ?? null,
      manifestMatches
    };
  });
  const missingFiles = entries.filter(entry => !entry.exists).map(entry => entry.path);
  const mismatchedFingerprints = entries.filter(entry => !entry.manifestMatches).map(entry => entry.path);

  return {
    status: missingFiles.length === 0 && mismatchedFingerprints.length === 0 ? 'passed' : 'failed',
    requiredPaths: REQUIRED_SOURCE_DIGESTS.map(entry => entry.path),
    entries,
    missingFiles,
    mismatchedFingerprints
  };
};

const readPngDimensions = filePath => {
  const header = fs.readFileSync(filePath).subarray(0, 24);
  const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (header.length < 24 || !header.subarray(0, 8).equals(pngSignature)) {
    return { width: 0, height: 0 };
  }
  return {
    width: header.readUInt32BE(16),
    height: header.readUInt32BE(20)
  };
};

const summarizeViewportCheck = check => ({
  missingText: Array.isArray(check?.missingText) ? check.missingText.length : null,
  missingHeaderText: Array.isArray(check?.missingHeaderText) ? check.missingHeaderText.length : null,
  forbiddenMatches: Array.isArray(check?.forbiddenMatches) ? check.forbiddenMatches.length : null,
  pageOverflow: check?.pageOverflow,
  outsideTableOffenders: Array.isArray(check?.outsideTableOffenders) ? check.outsideTableOffenders.length : null,
  viewport: check?.page?.viewport ?? null,
  scrollHeight: check?.scrollHeight ?? null
});

const auditBrowserQaHealth = () => {
  const summary = JSON.parse(fs.readFileSync(path.join(outputDir, 'browser-qa-summary.json'), 'utf8'));
  const desktop = summarizeViewportCheck(summary.desktopCheck);
  const mobile = summarizeViewportCheck(summary.mobileCheck);
  const consoleIssues = Array.isArray(summary.consoleIssues) ? summary.consoleIssues.length : null;
  const pageErrors = Array.isArray(summary.pageErrors) ? summary.pageErrors.length : null;
  const allPassed =
    desktop.missingText === 0 &&
    desktop.missingHeaderText === 0 &&
    desktop.forbiddenMatches === 0 &&
    desktop.pageOverflow === false &&
    desktop.outsideTableOffenders === 0 &&
    mobile.missingText === 0 &&
    mobile.missingHeaderText === 0 &&
    mobile.forbiddenMatches === 0 &&
    mobile.pageOverflow === false &&
    mobile.outsideTableOffenders === 0 &&
    consoleIssues === 0 &&
    pageErrors === 0;

  return {
    status: allPassed ? 'passed' : 'failed',
    checkedAt: summary.checkedAt,
    requiredBodyText: Array.isArray(summary.requiredBodyText) ? summary.requiredBodyText.length : null,
    consoleIssues,
    pageErrors,
    desktop,
    mobile
  };
};

const auditScreenshotDimensions = () => {
  const screenshots = {
    hero: readPngDimensions(path.join(outputDir, 'dashboard-hero-screenshot.png')),
    onePageJudgeStory: readPngDimensions(path.join(outputDir, 'one-page-judge-story-screenshot.png')),
    startHereStory: readPngDimensions(path.join(outputDir, 'start-here-story-screenshot.png')),
    mobileHero: readPngDimensions(path.join(outputDir, 'dashboard-mobile-hero-screenshot.png')),
    printPreview: readPngDimensions(path.join(outputDir, 'dashboard-print-preview-screenshot.png')),
    sourceEvidence: readPngDimensions(path.join(outputDir, 'dashboard-source-evidence-screenshot.png')),
    finalGate: readPngDimensions(path.join(outputDir, 'dashboard-final-gate-screenshot.png')),
    starredCoverage: readPngDimensions(path.join(outputDir, 'dashboard-starred-coverage-screenshot.png')),
    storySpine: readPngDimensions(path.join(outputDir, 'dashboard-story-spine-screenshot.png')),
    modelAnatomy: readPngDimensions(path.join(outputDir, 'dashboard-model-anatomy-screenshot.png')),
    accuracyStats: readPngDimensions(path.join(outputDir, 'dashboard-accuracy-stats-screenshot.png')),
    modelScores: readPngDimensions(path.join(outputDir, 'dashboard-model-scores-screenshot.png')),
    mobile: readPngDimensions(path.join(outputDir, 'dashboard-mobile-screenshot.png')),
    fullPage: readPngDimensions(path.join(outputDir, 'dashboard-fullpage-screenshot.png'))
  };
  const allPassed =
    screenshots.hero.width >= 1200 &&
    screenshots.hero.height >= 700 &&
    screenshots.onePageJudgeStory.width >= 1200 &&
    screenshots.onePageJudgeStory.height >= 800 &&
    screenshots.startHereStory.width >= 1200 &&
    screenshots.startHereStory.height >= 800 &&
    screenshots.mobileHero.width >= 700 &&
    screenshots.mobileHero.height >= 1000 &&
    screenshots.printPreview.width >= 1200 &&
    screenshots.printPreview.height >= 800 &&
    screenshots.sourceEvidence.width >= 1200 &&
    screenshots.sourceEvidence.height >= 800 &&
    screenshots.finalGate.width >= 1200 &&
    screenshots.finalGate.height >= 800 &&
    screenshots.starredCoverage.width >= 1200 &&
    screenshots.starredCoverage.height >= 800 &&
    screenshots.storySpine.width >= 1200 &&
    screenshots.storySpine.height >= 800 &&
    screenshots.modelAnatomy.width >= 1200 &&
    screenshots.modelAnatomy.height >= 800 &&
    screenshots.accuracyStats.width >= 1200 &&
    screenshots.accuracyStats.height >= 800 &&
    screenshots.modelScores.width >= 1200 &&
    screenshots.modelScores.height >= 800 &&
    screenshots.mobile.width >= 700 &&
    screenshots.mobile.height >= 1000 &&
    screenshots.fullPage.width >= 1200 &&
    screenshots.fullPage.height >= 1000;

  return {
    status: allPassed ? 'passed' : 'failed',
    screenshots
  };
};

const parseTestCount = (text, label) => {
  const match = text.match(new RegExp(`(?:^|\\n).*\\b${label}\\s+(\\d+)`, 'i'));
  return match ? Number(match[1]) : null;
};

const auditTestSuiteHealth = steps => {
  const testStep = steps.find(step => step.command === 'npm run test');
  const output = `${testStep?.stdoutTail ?? ''}\n${testStep?.stderrTail ?? ''}`;
  const tests = parseTestCount(output, 'tests');
  const pass = parseTestCount(output, 'pass');
  const fail = parseTestCount(output, 'fail');
  const cancelled = parseTestCount(output, 'cancelled');
  const skipped = parseTestCount(output, 'skipped');
  const todo = parseTestCount(output, 'todo');
  const allPassed =
    testStep?.status === 'passed' &&
    testStep?.exitCode === 0 &&
    typeof tests === 'number' &&
    tests >= MINIMUM_FINAL_CHECK_TESTS &&
    pass === tests &&
    fail === 0 &&
    cancelled === 0;

  return {
    status: allPassed ? 'passed' : 'failed',
    command: testStep?.command ?? 'npm run test',
    exitCode: testStep?.exitCode ?? null,
    durationMs: testStep?.durationMs ?? null,
    tests,
    pass,
    fail,
    cancelled,
    skipped,
    todo
  };
};

const runPostChecks = async steps => {
  const port4177Open = await isPortOpen('127.0.0.1', 4177);
  const deliverablesCoverage = auditDeliverablesCoverage();
  const handoffClaimDigest = auditHandoffClaimDigest();
  const entryPointFinalCheckText = auditEntryPointText();
  const testSuiteHealth = auditTestSuiteHealth(steps);
  const navigationAnchors = auditNavigationAnchors();
  const sourceCodeEvidence = auditSourceCodeEvidence();
  const browserQaHealth = auditBrowserQaHealth();
  const screenshotDimensions = auditScreenshotDimensions();
  const allPassed =
    !port4177Open &&
    deliverablesCoverage.missingFromDeliverables.length === 0 &&
    deliverablesCoverage.missingOnDisk.length === 0 &&
    handoffClaimDigest.status === 'passed' &&
    Object.values(entryPointFinalCheckText).every(Boolean) &&
    testSuiteHealth.status === 'passed' &&
    navigationAnchors.status === 'passed' &&
    sourceCodeEvidence.status === 'passed' &&
    browserQaHealth.status === 'passed' &&
    screenshotDimensions.status === 'passed';

  return {
    status: allPassed ? 'passed' : 'failed',
    port4177Closed: !port4177Open,
    deliverablesCoverage,
    handoffClaimDigest,
    entryPointFinalCheckText,
    testSuiteHealth,
    navigationAnchors,
    sourceCodeEvidence,
    browserQaHealth,
    screenshotDimensions
  };
};

const collectPostCheckFailures = postChecks => {
  const failures = [];
  if (!postChecks.port4177Closed) failures.push('Port 4177 is still open after browser QA.');
  if (postChecks.deliverablesCoverage?.missingFromDeliverables?.length) {
    failures.push(
      `Files missing from deliverables.json: ${postChecks.deliverablesCoverage.missingFromDeliverables.join(', ')}`
    );
  }
  if (postChecks.deliverablesCoverage?.missingOnDisk?.length) {
    failures.push(`Manifest paths missing on disk: ${postChecks.deliverablesCoverage.missingOnDisk.join(', ')}`);
  }
  if (postChecks.handoffClaimDigest?.status !== 'passed') {
    failures.push('Promoted-model claim digest is incomplete.');
  }
  if (postChecks.testSuiteHealth?.status !== 'passed') {
    failures.push(
      `Test-suite digest failed: ${postChecks.testSuiteHealth?.pass}/${postChecks.testSuiteHealth?.tests} passed, fail/cancelled=${postChecks.testSuiteHealth?.fail}/${postChecks.testSuiteHealth?.cancelled}.`
    );
  }
  if (postChecks.navigationAnchors?.status !== 'passed') {
    failures.push(
      `Navigation anchor digest failed: missing targets=${postChecks.navigationAnchors?.missingTargets?.join(', ') || 'none'}, missing ids=${
        postChecks.navigationAnchors?.missingTargetIds?.join(', ') || 'none'
      }.`
    );
  }
  if (postChecks.sourceCodeEvidence?.status !== 'passed') {
    failures.push(
      `Source-code evidence digest failed: missing files=${postChecks.sourceCodeEvidence?.missingFiles?.join(', ') || 'none'}, mismatched fingerprints=${
        postChecks.sourceCodeEvidence?.mismatchedFingerprints?.join(', ') || 'none'
      }.`
    );
  }
  Object.entries(postChecks.entryPointFinalCheckText ?? {})
    .filter(([, present]) => !present)
    .forEach(([fileName]) => failures.push(`${fileName} does not mention npm run model:final-check.`));

  const browserQa = postChecks.browserQaHealth;
  if (browserQa?.status !== 'passed') {
    failures.push(
      `Browser QA digest failed: desktop body/header/forbidden/offenders=${browserQa?.desktop?.missingText}/${browserQa?.desktop?.missingHeaderText}/${browserQa?.desktop?.forbiddenMatches}/${browserQa?.desktop?.outsideTableOffenders}, mobile body/header/forbidden/offenders=${browserQa?.mobile?.missingText}/${browserQa?.mobile?.missingHeaderText}/${browserQa?.mobile?.forbiddenMatches}/${browserQa?.mobile?.outsideTableOffenders}, console/page errors=${browserQa?.consoleIssues}/${browserQa?.pageErrors}.`
    );
  }
  if (postChecks.screenshotDimensions?.status !== 'passed') {
    failures.push(`Screenshot dimension digest failed: ${JSON.stringify(postChecks.screenshotDimensions?.screenshots ?? {})}`);
  }
  return failures;
};

const summarizeFailure = async steps => {
  writeSummary({
    generatedAt: new Date().toISOString(),
    status: 'failed',
    explanation: 'One of the final handoff commands failed before the verifier could run.',
    steps,
    finalVerifier: {
      command: 'npm run model:verify-dashboard',
      runsAfterSummaryWrite: false
    }
  });
};

const steps = [];
for (const step of plannedSteps) {
  const result = await runCommand(step.command);
  steps.push({ ...step, ...result });
  if (result.status !== 'passed') {
    await summarizeFailure(steps);
    console.error(`Final check failed during "${step.command}". Summary written to ${path.relative(repoRoot, summaryPath)}.`);
    process.exit(result.exitCode ?? 1);
  }
}

writeSummary({
  generatedAt: new Date().toISOString(),
  status: 'pre_verification_steps_passed',
  explanation:
    'Dashboard generation, browser QA/screenshot refresh, modeling typecheck, and tests passed. Post-checks are about to run, then the final verifier checks this summary file too.',
  steps,
  postChecks: {
    status: 'pending'
  },
  finalVerifier: {
    command: 'npm run model:verify-dashboard',
    runsAfterSummaryWrite: true
  }
});

const postChecks = await runPostChecks(steps);
writeSummary({
  generatedAt: new Date().toISOString(),
  status: postChecks.status === 'passed' ? 'awaiting_verifier' : 'failed',
  explanation:
    postChecks.status === 'passed'
      ? 'Dashboard generation, browser QA/screenshot refresh, modeling typecheck, tests, and post-checks passed. The verifier runs after this summary is written, then the runner writes the final passed summary and verifies that final summary again.'
      : 'One or more final post-checks failed before the verifier could run.',
  steps,
  postChecks,
  finalVerifier: {
    command: 'npm run model:verify-dashboard',
    runsAfterSummaryWrite: postChecks.status === 'passed',
    status: postChecks.status === 'passed' ? 'pending' : 'not_run'
  }
});

if (postChecks.status !== 'passed') {
  const failures = collectPostCheckFailures(postChecks);
  console.error('Final post-checks failed:');
  failures.forEach(failure => console.error(`- ${failure}`));
  console.error(`Final check summary: ${path.relative(repoRoot, summaryPath)}`);
  process.exit(1);
}

const verification = await runCommand('npm run model:verify-dashboard');
if (verification.status !== 'passed') {
  writeSummary({
    generatedAt: new Date().toISOString(),
    status: 'failed',
    explanation: 'The final verifier failed after pre-verification steps passed.',
    steps: [...steps, { label: 'Verify final package', ...verification }],
    postChecks,
    finalVerifier: {
      command: 'npm run model:verify-dashboard',
      runsAfterSummaryWrite: false
    }
  });
  process.exit(verification.exitCode ?? 1);
}

writeSummary({
  generatedAt: new Date().toISOString(),
  status: 'passed',
  explanation:
    'Dashboard generation, browser QA/screenshot refresh, modeling typecheck, tests, post-checks, and a verifier pass all succeeded. The verifier is run once more after this final summary is written so the final summary is verified too.',
  steps,
  postChecks,
  finalVerifier: {
    command: 'npm run model:verify-dashboard',
    runsAfterSummaryWrite: true,
    status: verification.status,
    exitCode: verification.exitCode,
    durationMs: verification.durationMs,
    verifiedFinalSummaryWithSecondRun: true
  }
});

const finalVerification = await runCommand('npm run model:verify-dashboard');
if (finalVerification.status !== 'passed') {
  writeSummary({
    generatedAt: new Date().toISOString(),
    status: 'failed',
    explanation: 'The final verifier failed after the final passed summary was written.',
    steps: [
      ...steps,
      { label: 'Verify final package before final summary', ...verification },
      { label: 'Verify final passed summary', ...finalVerification }
    ],
    postChecks,
    finalVerifier: {
      command: 'npm run model:verify-dashboard',
      runsAfterSummaryWrite: false,
      status: finalVerification.status,
      exitCode: finalVerification.exitCode,
      durationMs: finalVerification.durationMs
    }
  });
  process.exit(finalVerification.exitCode ?? 1);
}

console.log(`Final check summary: ${path.relative(repoRoot, summaryPath)}`);
console.log(`Human-readable final check summary: ${path.relative(repoRoot, humanSummaryPath)}`);
