import fs from 'node:fs';
import path from 'node:path';
import { writeJsonFile, writeTextFile } from '../util.ts';

const DEFAULT_SCAN_PATHS = ['.playwright-cli'];
const IGNORED_DIRS = new Set(['.git', 'node_modules', 'dist', 'build', '.firebase']);
const SENSITIVE_NAME_PATTERN = /(api[-_ ]?key|secret|token|credential|password|private)/i;
const JSON_PATTERN = /\.json$/i;

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const firstString = (record: Record<string, unknown>, keys: string[], fallback = '') => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim() !== '') return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return fallback;
};

const relativePath = (filePath: string) => {
  const relative = path.relative(process.cwd(), filePath);
  return relative.startsWith('..') ? path.basename(filePath) : relative;
};

const safeIncrement = (counts: Record<string, number>, key: string) => {
  counts[key] = (counts[key] ?? 0) + 1;
};

const addCount = (counts: Record<string, number>, key: string, count: number) => {
  counts[key] = (counts[key] ?? 0) + count;
};

const isSensitiveName = (filePath: string) => SENSITIVE_NAME_PATTERN.test(path.basename(filePath));

const collectJsonFiles = (targets: string[]) => {
  const files: string[] = [];
  const missingPaths: string[] = [];
  const visit = (target: string) => {
    const absolute = path.resolve(target);
    if (!fs.existsSync(absolute)) {
      missingPaths.push(target);
      return;
    }
    const stat = fs.statSync(absolute);
    if (stat.isFile()) {
      if (JSON_PATTERN.test(absolute)) files.push(absolute);
      return;
    }
    if (!stat.isDirectory()) return;
    const basename = path.basename(absolute);
    if (IGNORED_DIRS.has(basename)) return;
    fs.readdirSync(absolute, { withFileTypes: true }).forEach(entry => {
      const child = path.join(absolute, entry.name);
      if (entry.isDirectory()) {
        if (!IGNORED_DIRS.has(entry.name)) visit(child);
      } else if (entry.isFile() && JSON_PATTERN.test(entry.name)) {
        files.push(child);
      }
    });
  };
  targets.forEach(visit);
  return { files: [...new Set(files)].sort(), missingPaths };
};

const getArchiveRecords = (payload: unknown) => {
  const record = asRecord(payload);
  const scoutArchive = asRecord(record.scoutArchive);
  const archiveRecords = asArray(scoutArchive.records);
  const directRecords = asArray(record.records).filter(item => {
    const row = asRecord(item);
    return firstString(row, ['recordType']) !== '';
  });
  return [...archiveRecords, ...directRecords];
};

const summarizeArchiveRecords = (records: unknown[]) => {
  const recordTypes: Record<string, number> = {};
  const eventKeys = new Set<string>();
  let deletedRecords = 0;
  let importableMatchRecords = 0;
  let defenseRecords = 0;
  let pitRecords = 0;

  records.forEach(item => {
    const row = asRecord(item);
    const payload = asRecord(row.payload);
    const recordType = firstString(row, ['recordType'], 'unknown');
    safeIncrement(recordTypes, recordType);
    const eventKey = firstString(payload, ['eventKey']) || firstString(row, ['eventKey']);
    if (eventKey) eventKeys.add(eventKey.toLowerCase());
    if (row.deleted === true) deletedRecords += 1;
    if (recordType === 'pit') pitRecords += 1;
    if (recordType === 'matchDefense') defenseRecords += 1;
    if (
      row.deleted !== true &&
      (recordType === 'match' || recordType === 'matchV4' || recordType === 'matchDefense') &&
      Object.keys(payload).length > 0
    ) {
      importableMatchRecords += 1;
    }
  });

  return { recordTypes, eventKeys, deletedRecords, importableMatchRecords, defenseRecords, pitRecords };
};

const directCollectionSummary = (payload: unknown) => {
  const record = asRecord(payload);
  const collections = [
    ['matchScouting', 'match'],
    ['matchScoutingV3', 'match'],
    ['matchScoutingV4', 'matchV4'],
    ['matchScoutingDefense', 'matchDefense'],
    ['pitScouting', 'pit']
  ] as const;
  const recordTypes: Record<string, number> = {};
  const eventKeys = new Set<string>();
  let importableMatchRecords = 0;
  let defenseRecords = 0;
  let pitRecords = 0;

  collections.forEach(([collectionKey, recordType]) => {
    const rows = asArray(record[collectionKey]);
    if (rows.length === 0) return;
    addCount(recordTypes, `${recordType}:${collectionKey}`, rows.length);
    rows.forEach(item => {
      const row = asRecord(item);
      const eventKey = firstString(row, ['eventKey']);
      if (eventKey) eventKeys.add(eventKey.toLowerCase());
      if (recordType === 'matchDefense') defenseRecords += 1;
      if (recordType === 'pit') pitRecords += 1;
      if (recordType === 'match' || recordType === 'matchV4' || recordType === 'matchDefense') {
        importableMatchRecords += 1;
      }
    });
  });

  return { recordTypes, eventKeys, importableMatchRecords, defenseRecords, pitRecords };
};

export interface LocalBackupInventoryFile {
  file: string;
  archiveRecords: number;
  importableMatchRecords: number;
  defenseRecords: number;
  pitRecords: number;
  deletedRecords: number;
  adminCacheEntries: number;
  eventKeys: string[];
  recordTypes: Record<string, number>;
}

export interface LocalBackupInventoryAudit {
  scannedPaths: string[];
  missingPaths: string[];
  jsonFilesFound: number;
  parsedFiles: number;
  skippedSensitiveName: number;
  parseErrors: number;
  totalArchiveRecords: number;
  totalImportableMatchRecords: number;
  totalDefenseRecords: number;
  totalPitRecords: number;
  totalAdminCacheEntries: number;
  eventKeys: string[];
  recordTypes: Record<string, number>;
  files: LocalBackupInventoryFile[];
}

export const auditLocalBackupInventory = (
  targets = DEFAULT_SCAN_PATHS,
  outputDir = path.resolve('modeling/artifacts/audits/local-backup-inventory')
): LocalBackupInventoryAudit => {
  const { files, missingPaths } = collectJsonFiles(targets.length > 0 ? targets : DEFAULT_SCAN_PATHS);
  const audit: LocalBackupInventoryAudit = {
    scannedPaths: targets.length > 0 ? targets : DEFAULT_SCAN_PATHS,
    missingPaths,
    jsonFilesFound: files.length,
    parsedFiles: 0,
    skippedSensitiveName: 0,
    parseErrors: 0,
    totalArchiveRecords: 0,
    totalImportableMatchRecords: 0,
    totalDefenseRecords: 0,
    totalPitRecords: 0,
    totalAdminCacheEntries: 0,
    eventKeys: [],
    recordTypes: {},
    files: []
  };
  const allEventKeys = new Set<string>();

  files.forEach(filePath => {
    if (isSensitiveName(filePath)) {
      audit.skippedSensitiveName += 1;
      return;
    }

    let payload: unknown;
    try {
      payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      audit.parsedFiles += 1;
    } catch {
      audit.parseErrors += 1;
      return;
    }

    const archiveRecords = getArchiveRecords(payload);
    const archive = summarizeArchiveRecords(archiveRecords);
    const direct = directCollectionSummary(payload);
    const record = asRecord(payload);
    const adminCacheEntries = asArray(asRecord(record.adminV2).cacheEntries).length;
    const eventKeys = new Set([...archive.eventKeys, ...direct.eventKeys]);
    const recordTypes: Record<string, number> = {};
    Object.entries(archive.recordTypes).forEach(([key, count]) => {
      recordTypes[key] = (recordTypes[key] ?? 0) + count;
      audit.recordTypes[key] = (audit.recordTypes[key] ?? 0) + count;
    });
    Object.entries(direct.recordTypes).forEach(([key, count]) => {
      recordTypes[key] = (recordTypes[key] ?? 0) + count;
      audit.recordTypes[key] = (audit.recordTypes[key] ?? 0) + count;
    });
    eventKeys.forEach(eventKey => allEventKeys.add(eventKey));

    const fileSummary: LocalBackupInventoryFile = {
      file: relativePath(filePath),
      archiveRecords: archiveRecords.length,
      importableMatchRecords: archive.importableMatchRecords + direct.importableMatchRecords,
      defenseRecords: archive.defenseRecords + direct.defenseRecords,
      pitRecords: archive.pitRecords + direct.pitRecords,
      deletedRecords: archive.deletedRecords,
      adminCacheEntries,
      eventKeys: [...eventKeys].sort(),
      recordTypes
    };
    audit.totalArchiveRecords += fileSummary.archiveRecords;
    audit.totalImportableMatchRecords += fileSummary.importableMatchRecords;
    audit.totalDefenseRecords += fileSummary.defenseRecords;
    audit.totalPitRecords += fileSummary.pitRecords;
    audit.totalAdminCacheEntries += adminCacheEntries;
    audit.files.push(fileSummary);
  });

  audit.eventKeys = [...allEventKeys].sort();
  const markdown = [
    '# Local Backup Inventory Audit',
    '',
    'This audit counts local scout/archive backup structure without printing raw payloads, scout names, team-level rows, API keys, or credentials.',
    '',
    '## Summary',
    '',
    `- Scanned paths: ${audit.scannedPaths.join(', ')}`,
    `- JSON files found: ${audit.jsonFilesFound}`,
    `- Parsed files: ${audit.parsedFiles}`,
    `- Skipped sensitive-looking filenames before parse: ${audit.skippedSensitiveName}`,
    `- Parse errors: ${audit.parseErrors}`,
    `- Archive records: ${audit.totalArchiveRecords}`,
    `- Importable match/defense records: ${audit.totalImportableMatchRecords}`,
    `- Defense records: ${audit.totalDefenseRecords}`,
    `- Pit records: ${audit.totalPitRecords}`,
    `- Admin cache entries: ${audit.totalAdminCacheEntries}`,
    `- Event keys represented: ${audit.eventKeys.length > 0 ? audit.eventKeys.join(', ') : 'none'}`,
    '',
    '## Files',
    '',
    '| File | Archive Records | Importable Match Records | Defense | Pit | Deleted | Admin Cache Entries | Event Keys | Record Types |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |',
    ...audit.files.map(
      file =>
        `| ${file.file} | ${file.archiveRecords} | ${file.importableMatchRecords} | ${file.defenseRecords} | ${file.pitRecords} | ${file.deletedRecords} | ${file.adminCacheEntries} | ${
          file.eventKeys.join(', ') || 'none'
        } | ${
          Object.entries(file.recordTypes)
            .map(([key, count]) => `${key}: ${count}`)
            .join('; ') || 'none'
        } |`
    )
  ].join('\n');

  writeJsonFile(path.join(outputDir, 'local-backup-inventory.json'), audit);
  writeTextFile(path.join(outputDir, 'LOCAL_BACKUP_INVENTORY.md'), markdown);
  return audit;
};
