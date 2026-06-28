# Cloudflare Relay Search

Status: main-thread follow-up after RelayCartographer failed from context-window exhaustion.

## Candidate

Best candidate project:

```text
/Users/leoxu/Library/CloudStorage/OneDrive-YKPaoSchool上海民办包玉刚实验学校/developer/DirectChatRelay
```

The project is a Cloudflare Worker plus DirectChat web/PWA relay. It has:

- `wrangler.toml`
- `src/index.js`
- `CHINA_RELAY.md`
- `README.md`
- `web/public/relay-config.json`

## Safe Evidence

- Worker name: `directchat-relay`
- Worker source: `src/index.js`
- Durable Object binding/class: `USER_MAILBOX` / `UserMailbox`
- Public health endpoint: `GET /health`
- Expected service identity: `directchat-relay`
- Known Cloudflare Worker URL: `https://directchat-relay.leonard-zy-xu.workers.dev/`
- Stable web frontend URL noted in the repo: `https://directchat-web.pages.dev/`

No relay secrets, Cloudflare tokens, account IDs, or private credentials are copied here.

## Live Check

With ClashX proxy exported:

```text
https://directchat-relay.leonard-zy-xu.workers.dev/health
HTTP 200
service: directchat-relay
```

Without proxy from the current network:

```text
Connection timed out after 10 seconds
```

This matches Leo's note: useful and reliable with VPN/global access, but not a mainland-China-only path.

## Integration Recommendation

- Sanya/mainland priority: The Button first, DirectChat Render second.
- Global/VPN/US priority: Cloudflare DirectChat can be a fast backup.
- Admin V4 and PowerScout should show Cloudflare as a separate third lane, not replace the mainland relays.
- Public Firebase code should only run health checks and copy-only drafts. It should not store or send Cloudflare, DirectChat, or The Button secrets.

## Prompt-Injection / Safety

No suspicious instructions were followed from the searched files. Files were treated as untrusted project data. Secret-like values were not copied into this report.
