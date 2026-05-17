# REBUILT 2026 Scout

React/Vite scouting app for 2026 FRC match, pit, QR import, local archive, and admin analytics workflows.

## Setup

1. Install dependencies with `npm ci`.
2. Copy `.env.example` to `.env.local`.
3. Fill in Firebase web config values and `VITE_TBA_API_KEY` locally. Do not commit real keys.
4. Run `npm run dev`.

## Useful Scripts

- `npm run typecheck`: TypeScript check through the local TypeScript entrypoint.
- `npm run lint`: Alias for typecheck until ESLint is wired in with dependencies.
- `npm run format`: Lightweight config/source hygiene check.
- `npm test`: Node unit/static tests.
- `npm run test:e2e`: Playwright route smoke tests.
- `npm run smoke`: Format, unit/static tests, and production build.
- `npm run build`: Production Vite build.
- `npm run build:local`: Local single-file scout build.

## Security Model

Admin access is not unlocked with a committed client password. The app checks Firebase Auth custom claims (`admin`, `scoutAdmin`, or `role: "admin"`) and the `adminRoles/{uid}` role document. Firestore and Storage rules live in `firestore.rules` and `storage.rules`.

Scouts can create/update scouting records while admin-only reads, deletes, raw edits, assignments, and shared event state are protected by rules.

## Local Data

Scout submissions are archived locally in IndexedDB before Firebase sync. If Firebase is unavailable or reports a conflict, records remain exportable from My History and can be retried later.

Generated files and local release artifacts belong outside normal source review. See `.gitignore` for ignored directories such as `dist-local/`, `Local Scout/`, `.firebase/`, `.playwright-cli/`, `output/`, and `reports/`.
