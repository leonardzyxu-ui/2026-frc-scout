import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('client config does not contain committed API key fallbacks', () => {
  const configSource = readFileSync('src/config.ts', 'utf8');
  const firebaseSource = readFileSync('src/firebase.ts', 'utf8');
  const mainSource = readFileSync('src/main.tsx', 'utf8');
  const viteConfigSource = readFileSync('vite.config.ts', 'utf8');
  const packageSource = readFileSync('package.json', 'utf8');
  const seedTbaEnvSource = readFileSync('scripts/seed-tba-env.mjs', 'utf8');
  const postMatchRefreshSource = readFileSync('scripts/powerscout-post-match-refresh.mjs', 'utf8');
  const envExample = readFileSync('.env.example', 'utf8');
  const hardCodedTbaKeyPattern = /(VITE_TBA_API_KEY|MODEL_TBA_API_KEY|TBA_API_KEY)\s*=\s*["']?[A-Za-z0-9]{32,}/;

  assert.doesNotMatch(configSource, hardCodedTbaKeyPattern);
  assert.doesNotMatch(firebaseSource, /AIzaSy/);
  assert.match(firebaseSource, /\/__\/firebase\/init\.json/);
  assert.match(firebaseSource, /firebaseReady/);
  assert.match(mainSource, /firebaseReady/);
  assert.match(mainSource, /finally\(renderApp\)/);
  assert.match(viteConfigSource, /envDir/);
  assert.match(viteConfigSource, /\.vite-env/);
  assert.match(viteConfigSource, /local-tba-dev-proxy/);
  assert.match(viteConfigSource, /PowerScout/);
  assert.match(viteConfigSource, /tba-api-key\.json/);
  assert.doesNotMatch(viteConfigSource, /loadEnv/);
  assert.match(packageSource, /env:seed:tba/);
  assert.match(packageSource, /powerscout:post-match-refresh/);
  assert.match(seedTbaEnvSource, /\.vite-env/);
  assert.match(seedTbaEnvSource, /tba-api-key\.json/);
  assert.doesNotMatch(seedTbaEnvSource, hardCodedTbaKeyPattern);
  assert.match(postMatchRefreshSource, /FIRST_EVENTS_USERNAME/);
  assert.match(postMatchRefreshSource, /ingest:statbotics/);
  assert.match(postMatchRefreshSource, /No secrets are written or printed/);
  assert.doesNotMatch(postMatchRefreshSource, hardCodedTbaKeyPattern);
  assert.match(envExample, /VITE_FIREBASE_API_KEY="replace-me"/);
  assert.match(envExample, /VITE_TBA_API_KEY="replace-me"/);
});

test('legacy client-side admin password hash has been removed', () => {
  const adminAuthSource = readFileSync('src/utils/adminAuth.ts', 'utf8');
  const adminGuardSource = readFileSync('src/components/admin/AdminGuard.tsx', 'utf8');

  assert.doesNotMatch(adminAuthSource, /ADMIN_HASH|sha256|localStorage\.setItem\('admin_unlocked'/);
  assert.doesNotMatch(adminGuardSource, /password|admin_unlocked/i);
  assert.match(adminAuthSource, /getIdTokenResult/);
  assert.match(adminAuthSource, /adminRoles/);
});
