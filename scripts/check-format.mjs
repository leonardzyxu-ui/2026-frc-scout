import { readFileSync } from 'node:fs';

const jsonFiles = [
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'firebase.json',
  'metadata.json'
];

const errors = [];

for (const file of jsonFiles) {
  try {
    JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    errors.push(`${file}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (errors.length > 0) {
  console.error(errors.join('\n'));
  process.exit(1);
}

console.log(`Checked ${jsonFiles.length} JSON config files.`);
