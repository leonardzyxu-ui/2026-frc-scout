import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('client config does not contain committed API key fallbacks', () => {
  const configSource = readFileSync('src/config.ts', 'utf8');
  const firebaseSource = readFileSync('src/firebase.ts', 'utf8');
  const envExample = readFileSync('.env.example', 'utf8');

  assert.doesNotMatch(configSource, /qec9WcQe/);
  assert.doesNotMatch(firebaseSource, /AIzaSy/);
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
