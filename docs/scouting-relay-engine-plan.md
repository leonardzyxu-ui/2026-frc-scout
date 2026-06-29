# Scouting Relay Engine Plan

Last reviewed: 2026-06-28 09:16 CST.

This note describes how Admin V4 should use Leo's existing relay projects for faster head-scout coordination during competition. It is a design note, not a secret store. Do not put relay passwords, device secrets, receiver tokens, DirectChat safety codes, Firebase credentials, or TBA keys in this file or in public client code.

## Current State

- Admin V4 Settings has a Relay Readiness check that pings public health endpoints only and requires the expected service identity.
- The official deployed scouting site can be smoke-checked with:

```sh
export https_proxy=http://127.0.0.1:7890 http_proxy=http://127.0.0.1:7890 all_proxy=socks5://127.0.0.1:7890
npm run check:competition
```

- Last live readiness run passed all critical scouting-site checks.
- The Button primary relay returned HTTP 404 during the last check.
- DirectChat mainland backup relay responded with HTTP 200 and `service: "directchat-relay"` during the last check.
- Cloudflare DirectChat responded with HTTP 200 and `service: "directchat-relay"` through the ClashX proxy; the same health check timed out without the proxy from this network.

## Relay Priority

1. The Button is the primary head-scout alert relay.
2. DirectChat on Render is the mainland/Sanya backup encrypted communication relay.
3. Cloudflare DirectChat is the global/VPN backup relay for US travel or VPN-backed operation.
4. Firebase/local archive remains the durable data path for scouting records.

The relays are for fast coordination, not the source of truth for match data.

## Relay Pager Mode

Admin-to-scout relay messages should behave like a pager, not a group chat.

- Admin can ping one scout by locked scout number.
- Admin can broadcast one message to all scouts.
- Scouts receive an immediate notification on their device.
- Scouts do not reply into a shared chat thread, and "send to all" must not create a group conversation.
- Message routing should use the locked scout number as the identifier and scout name only as display text.
- The shared web contract is `src/utils/scoutRelayPager.ts`; authenticated transport still belongs in the local Mac/relay layer so relay credentials do not enter Firebase-hosted client code.

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
- Local validation passed: `relay-web/npm run check` completes, and a local `PORT=8787 npm start` responds at `http://127.0.0.1:8787/health` with `service: "the-button"`.
- `https://the-button.onrender.com/health` currently returns a Django-style HTTP 404 page, which does not match the local Node relay source.
- `https://the-button-relay-web.onrender.com/health` also returns HTTP 404.
- The local The Button repo is clean on `main` and matches `origin/main` at `b139386` (`Fix nuke lifecycle and website profile flow`).
- The local `render.yaml` defines Render service `the-button` as `runtime: node`, `rootDir: relay-web`, `buildCommand: npm ci && npm run build`, and `startCommand: npm start`.
- The live `https://the-button.onrender.com/health` response includes `x-render-origin-server: WSGIServer/0.2 CPython/3.11.11`, so Render is serving a Python/WSGI app at that hostname, not the local Node relay described by this repo.
- Treat The Button as designed but currently pointed at the wrong deployed service/app. The next fix is Render Dashboard verification: confirm the `the-button` service is linked to `leonardzyxu-ui/The_Button`, branch `main`, root directory `relay-web`, and commit `b139386` or later, then redeploy. Do not put The Button secrets into the scouting website to work around this.

## DirectChat Mainland Backup Relay

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
- Best backup for Sanya/mainland-China conditions among the currently known relays.
- Better for private head-scout communication than public status pings because the relay is designed around encrypted envelopes.
- Do not route scouting row data, team strategy, or private notes through it from Admin V4 until an authenticated, reviewed bridge exists.

Current limitation:

- The DirectChat relay is reachable, but Admin V4 currently performs only public health checks. It does not authenticate, send messages, or store DirectChat identities.
- Latest live check returned JSON from `https://directchat-relay.onrender.com/health` with `service: "directchat-relay"` and `runtime: "render-upstash"`, matching the local Node Render service shape.

## Cloudflare DirectChat Global/VPN Backup

Local project:

```text
/Users/leoxu/Library/CloudStorage/OneDrive-YKPaoSchool上海民办包玉刚实验学校/developer/DirectChatRelay
```

Useful service surfaces:

- `GET /health`
- `GET /identity/<directchat-id>`
- `GET /ws/<directchat-id>`
- `GET /api/push/vapid-public-key`

Known deployed global backup:

```text
https://directchat-relay.leonard-zy-xu.workers.dev/
```

Scouting use:

- Use when operating in the United States, outside mainland China, or with a reliable VPN.
- Keep it visible in Admin V4 and PowerScout as a fast global fallback.
- Do not treat it as the only Sanya relay because `workers.dev` can time out in mainland China without VPN.

Current evidence:

- Local project `wrangler.toml` defines Worker `directchat-relay` with `src/index.js` and Durable Object `UserMailbox`.
- The Cloudflare Worker `GET /health` source returns `service: "directchat-relay"`.
- With ClashX proxy exported, `https://directchat-relay.leonard-zy-xu.workers.dev/health` returned HTTP 200 with `service: "directchat-relay"`.
- Without the proxy from this network, the same URL timed out after 10 seconds.
- The repo's `CHINA_RELAY.md` already warns that `workers.dev` is not reliable from mainland China without a VPN and recommends keeping Cloudflare as the global fallback.

## Safe Integration Stages

### Stage 0: Done

- Admin V4 displays Relay Readiness in Settings.
- The readiness check pings The Button, DirectChat, and Cloudflare DirectChat health endpoints and rejects a response whose JSON `service` value does not match the expected relay.
- The local `npm run check:competition` script verifies live routes, deployed bundle markers, and relay reachability.

### Stage 1: Done

Admin V4 Settings includes a local-only relay outbox panel:

- The UI drafts short operational alerts.
- The user can copy/export the alert payload.
- No relay credential is stored in the website.
- No automatic send happens from public Firebase-hosted code.

This gives the head scout reusable messages without creating a credential leak. The drafts are suitable for The Button, DirectChat, or Cloudflare DirectChat, but the website still does not authenticate to any relay.

### Stage 2: Head-Scout Local Agent

First safe slice now exists:

- `npm run check:head-scout` prints a one-screen local status summary.
- It runs the live competition readiness check, reports latest CI, prints copyable Admin V4/Admin V2 links, and repeats morning operating cues.
- It does not open browser windows, store relay credentials, or send relay messages.

Build a small local Mac agent or menu-bar app that holds secrets in Keychain and talks to:

- The scouting Firebase site for public route health.
- The TBA API using the locally saved TBA key.
- The Button using receiver/device credentials stored locally.
- DirectChat or Cloudflare DirectChat using the local DirectChat identity already owned by the Mac app.

This is the correct place for authenticated relay sending because credentials stay on Leo's Mac, not in public web assets.

Minimum features:

- Periodic readiness status.
- One-click "open Admin V4", "open Admin V2 prediction graph", and "run competition smoke check".
- Relay health indicator: primary, mainland backup, global/VPN backup, all down.
- Region-aware relay hint: Sanya/mainland path versus global/VPN fallback.
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
- Do not put Cloudflare API tokens, Wrangler credentials, account IDs, or Worker secrets in Admin V4 client code.
- Do not send raw scouting rows or strategy notes through a relay until the encryption/authentication path is explicitly reviewed.
- Do not depend on relays as the only record of predictions. The Forecast Ledger workbook and local backup remain the durable evidence path.
- Do not create a browser-window-heavy test flow during competition. Use `npm run check:competition` or a local agent.

## Competition-Morning Checklist

- Run `npm run check:competition` with the ClashX proxy env.
- If The Button is still returning HTTP 404 but DirectChat is green, use DirectChat as the Sanya/mainland backup and keep The Button out of the critical path.
- If only Cloudflare is green, use it only with VPN/global access and do not treat it as enough for Sanya.
- Before practice matches, open Admin V4 Settings and confirm Relay Readiness.
- Before alliance selection, export the full evidence workbook, then use relay alerts only for coordination.
- If both relays fail, keep working through Firebase/local backups and record the relay outage in the event notes.
