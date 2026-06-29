import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');
const sourcePath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(homedir(), 'Library', 'Application Support', 'PowerScout', 'tba-api-key.json');
const envDir = path.join(repoRoot, '.vite-env');
const envPath = path.join(envDir, '.env.local');

const extractKey = (rawText) => {
  const trimmed = rawText.trim();
  if (!trimmed) return '';
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return trimmed;

  const parsed = JSON.parse(trimmed);
  if (typeof parsed === 'string') return parsed.trim();
  const candidateKeys = ['tbaApiKey', 'tba_api_key', 'apiKey', 'key', 'token', 'TBA_API_KEY', 'VITE_TBA_API_KEY'];
  for (const key of candidateKeys) {
    if (typeof parsed?.[key] === 'string' && parsed[key].trim()) return parsed[key].trim();
  }
  return '';
};

const setEnvValue = (existingText, key, value) => {
  const lines = existingText.split(/\r?\n/);
  let replaced = false;
  const nextLines = lines.map((line) => {
    if (!line.trim().startsWith(`${key}=`)) return line;
    replaced = true;
    return `${key}=${JSON.stringify(value)}`;
  });
  if (!replaced) nextLines.push(`${key}=${JSON.stringify(value)}`);
  return `${nextLines.filter((line, index) => line || index < nextLines.length - 1).join('\n')}\n`;
};

if (!existsSync(sourcePath)) {
  console.error(`TBA key source JSON was not found: ${sourcePath}`);
  process.exit(1);
}

const apiKey = extractKey(readFileSync(sourcePath, 'utf8'));
if (!apiKey) {
  console.error(`No TBA key field was found in: ${sourcePath}`);
  process.exit(1);
}

mkdirSync(envDir, { recursive: true });
const existingText = existsSync(envPath) ? readFileSync(envPath, 'utf8') : '';
let nextText = setEnvValue(existingText, 'VITE_TBA_API_KEY', apiKey);
nextText = setEnvValue(nextText, 'MODEL_TBA_API_KEY', apiKey);
writeFileSync(envPath, nextText, 'utf8');
chmodSync(envPath, 0o600);

console.log(`Seeded local TBA env file: ${envPath}`);
console.log('Restart the Vite dev server so import.meta.env picks up the key.');
