import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const run = (name, command, args, timeout = 120000) => {
  console.log(`\n[smoke] ${name}`);
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    timeout
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`${name} failed with status ${result.status}`);
  }
};

const appSource = readFileSync('src/App.tsx', 'utf8');
for (const route of ['/scout', '/pit', '/history', '/admin', '/adminv4']) {
  if (!appSource.includes(route)) {
    throw new Error(`Expected route ${route} to be present in src/App.tsx`);
  }
}

run('format checks', 'npm', ['run', 'format']);
run('unit/static tests', 'npm', ['test']);
run('production build', 'npm', ['run', 'build'], 180000);

console.log('\n[smoke] complete');
