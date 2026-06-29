# Local Vite Env

Vite is configured to read private local env files from this folder.

Use this for local testing keys that must not be committed:

```bash
npm run env:seed:tba
```

That command reads the local PowerScout TBA key JSON from:

```text
~/Library/Application Support/PowerScout/tba-api-key.json
```

and writes:

```text
.vite-env/.env.local
```

Restart the Vite dev server after changing `.env.local`.
