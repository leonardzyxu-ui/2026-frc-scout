# Scouting Relay Engine Plan

Last reviewed: 2026-06-27 23:35 CST.

This note describes how Admin V4 should use Leo's existing relay projects for faster head-scout coordination during competition. It is a design note, not a secret store. Do not put relay passwords, device secrets, receiver tokens, DirectChat safety codes, Firebase credentials, or TBA keys in this file or in public client code.

## Current State

- Admin V4 Settings has a Relay Readiness check that pings public health endpoints only.
- The official deployed scouting site can be smoke-checked with:

```sh
export https_proxy=http://127.0.0.1:7890 http_proxy=http://127.0.0.1:7890 all_proxy=socks5://127.0.0.1:7890
npm run check:competition
```

- Last live readiness run passed all critical scouting-site checks.
- The Button primary relay returned HTTP 404 during the last check.
- DirectChat backup relay responded with HTTP 200 during the last check.

## Relay Priority

1. The Button is the primary head-scout alert relay.
2. DirectChat is the backup encrypted communication relay.
3. Firebase/local archive remains the durable data path for scouting records.

The relays are for fast coordination, not the source of truth for match data.

## The Button Primary Relay

Local project:

```text
/Users/leoxu/Library/CloudStorage/OneDrive-YKPaoSchool上海民办包玉刚实验学校/developer/The_Button
```

Useful service surfaces:

- `GET /health`
- `POST /api/devices`
- `POST /api/events`
- `POST /api/messages`
- `WS /ws/site`
- `WS /ws/receiver`

Render service name:

```text
the-button
```

Production-style env required by that project:

- `THEBUTTON_JOIN_PASSWORD`
- `THEBUTTON_RECEIVER_TOKEN`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `THEBUTTON_IP_HASH_SALT`

Scouting use:

- Best for urgent head-scout attention, match-cycle alerts, and short broadcast-style events.
- Good fit for "judge/demo mode now", "sync device now", "collect missing evidence", "drive-team needs match plan", and "alliance selection changed" alerts.
- Not currently safe to call authenticated endpoints from the public Firebase client because that would expose join/device credentials.

Current limitation:

- Local source confirms `relay-web/server/render-server.js` serves `GET /health` with `service: "the-button"`.
- `https://the-button.onrender.com/health` currently returns a Django-style HTTP 404 page, which does not match the local Node relay source.
- `https://the-button-relay-web.onrender.com/health` also returns HTTP 404.
- Treat The Button as designed but not currently deployed/reachable as the expected relay target. The next fix is Render service verification: confirm the public URL, root service, and deployed commit for the `relay-web` Node app.

## DirectChat Backup Relay

Local projects:

```text
/Users/leoxu/Library/CloudStorage/OneDrive-YKPaoSchool上海民办包玉刚实验学校/developer/DirectChat
/Users/leoxu/Library/CloudStorage/OneDrive-YKPaoSchool上海民办包玉刚实验学校/developer/DirectChatRelay
```

Useful service surfaces:

- `GET /health`
- `GET /identity/<directchat-id>`
- `GET /ws/<directchat-id>`
- `GET /api/push/vapid-public-key`

Additional account/vault endpoints exist in the relay plan for account sync.

Known deployed backup:

```text
https://directchat-relay.onrender.com/
```

Scouting use:

- Best for backup messages when The Button is slow or down.
- Better for private head-scout communication than public status pings because the relay is designed around encrypted envelopes.
- Do not route scouting row data, team strategy, or private notes through it from Admin V4 until an authenticated, reviewed bridge exists.

Current limitation:

- The DirectChat relay is reachable, but Admin V4 currently performs only public health checks. It does not authenticate, send messages, or store DirectChat identities.

## Safe Integration Stages

### Stage 0: Done

- Admin V4 displays Relay Readiness in Settings.
- The readiness check pings The Button and DirectChat health endpoints.
- The local `npm run check:competition` script verifies live routes, deployed bundle markers, and relay reachability.

### Stage 1: Done

Admin V4 Settings includes a local-only relay outbox panel:

- The UI drafts short operational alerts.
- The user can copy/export the alert payload.
- No relay credential is stored in the website.
- No automatic send happens from public Firebase-hosted code.

This gives the head scout reusable messages without creating a credential leak. The drafts are suitable for The Button or DirectChat, but the website still does not authenticate to either relay.

### Stage 2: Head-Scout Local Agent

First safe slice now exists:

- `npm run check:head-scout` prints a one-screen local status summary.
- It runs the live competition readiness check, reports latest CI, and repeats morning operating cues.
- It does not open browser windows, store relay credentials, or send relay messages.

Build a small local Mac agent or menu-bar app that holds secrets in Keychain and talks to:

- The scouting Firebase site for public route health.
- The TBA API using the locally saved TBA key.
- The Button using receiver/device credentials stored locally.
- DirectChat using the local DirectChat identity already owned by the Mac app.

This is the correct place for authenticated relay sending because credentials stay on Leo's Mac, not in public web assets.

Minimum features:

- Periodic readiness status.
- One-click "open Admin V4", "open Admin V2 prediction graph", and "run competition smoke check".
- Relay health indicator: primary, backup, both down.
- Manual send buttons for prewritten head-scout alerts.
- No automatic destructive actions.

### Stage 3: Competition Automation

Only after Stage 2 is stable:

- Trigger an alert when Admin V4 sees unsynced records.
- Trigger an alert when official source freshness is stale.
- Trigger an alert when the pick list changes during alliance selection.
- Trigger an alert when the Forecast Ledger export is overdue at the end of a match block.

## Do Not Do

- Do not put The Button join password, receiver token, or device secret in Admin V4 client code.
- Do not put DirectChat Account Safety Codes or private keys in Admin V4 client code.
- Do not send raw scouting rows or strategy notes through a relay until the encryption/authentication path is explicitly reviewed.
- Do not depend on relays as the only record of predictions. The Forecast Ledger workbook and local backup remain the durable evidence path.
- Do not create a browser-window-heavy test flow during competition. Use `npm run check:competition` or a local agent.

## Competition-Morning Checklist

- Run `npm run check:competition` with the ClashX proxy env.
- If The Button is still returning HTTP 404 but DirectChat is green, use DirectChat as backup and keep The Button out of the critical path.
- Before practice matches, open Admin V4 Settings and confirm Relay Readiness.
- Before alliance selection, export the full evidence workbook, then use relay alerts only for coordination.
- If both relays fail, keep working through Firebase/local backups and record the relay outage in the event notes.
