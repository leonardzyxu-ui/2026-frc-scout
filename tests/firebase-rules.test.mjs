import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const firestoreRules = readFileSync('firestore.rules', 'utf8');
const storageRules = readFileSync('storage.rules', 'utf8');

test('Firestore rules define an admin role contract', () => {
  assert.match(firestoreRules, /function hasAdminClaim/);
  assert.match(firestoreRules, /function hasAdminRoleDoc/);
  assert.match(firestoreRules, /match \/adminRoles\/\{uid\}/);
  assert.match(firestoreRules, /match \/adminSecrets\/\{docId\}/);
  assert.match(firestoreRules, /match \/adminSecrets\/\{docId\}[\s\S]*allow read, write: if isAdmin\(\)/);
});

test('Firestore rules protect scouting collections with admin read/delete and scout writes', () => {
  for (const collectionName of [
    'matchScouting',
    'matchScoutingV3',
    'matchScoutingV4',
    'matchScoutingDefense',
    'pitScouting'
  ]) {
    assert.match(firestoreRules, new RegExp(collectionName));
  }

  assert.match(firestoreRules, /allow read: if isAdmin\(\)/);
  assert.match(firestoreRules, /allow delete: if isAdmin\(\)/);
  assert.match(firestoreRules, /allow create, update: if canWriteScoutRecord/);
});

test('Rulesets end with deny-by-default coverage', () => {
  assert.match(firestoreRules, /match \/\{document=\*\*\}[\s\S]*allow read, write: if false/);
  assert.match(storageRules, /match \/\{allPaths=\*\*\}[\s\S]*allow read, write: if isAdmin\(\)/);
});
