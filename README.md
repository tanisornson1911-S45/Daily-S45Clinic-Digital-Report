# S45 Ads Dashboard

Internal marketing dashboard for S45 Clinic — Facebook Ads spend, sales funnel,
and ROAS tracking across procedure categories.

## Stack

- **Frontend**: Vite + React + Tailwind CSS + Recharts, deployed on Vercel from
  the `main` branch (every push triggers a production redeploy). Protected by
  HTTP Basic Auth (`middleware.js`, `DASH_USER`/`DASH_PASS` Vercel env vars).
- **Data API**: `worker/` — a Cloudflare Worker that serves all dashboard data
  from Cloudflare KV, gated by the same Basic Auth credentials + CORS locked to
  the dashboard's own origin. The production frontend no longer bundles
  `src/data/*.json` directly (that used to ship every customer name/transaction
  in the public JS) — it fetches them from this Worker at runtime instead; see
  `src/main.jsx`. **`npm run dev` still imports the local JSON files directly**
  (no Worker/login needed for local development).
- `src/data/*.json` is refreshed nightly by `.github/workflows/update-m365-data.yml`
  and `update-dashboard-data.yml`, which also push the results into the
  Worker's KV namespace via `scripts/push-to-kv.mjs` (see `REALTIME_SYNC_SETUP.md`
  for the Microsoft/Facebook side of the sync setup).
- The same Worker also has a Cloudflare Cron Trigger (`scheduled()` in
  `worker/src/index.js`) that fires the daily LINE report workflow directly
  via the GitHub API at 18:26 ICT — this is the reliable path (Cloudflare
  Cron Triggers run on time, unlike GitHub Actions' own `schedule:`, which
  showed repeated multi-hour delays). `send-line-report.yml`'s own
  `schedule:` and the Claude Code routine that also call it are kept as
  redundant backups; a dedup guard (`scripts/check-report-sent-today.mjs`)
  stops any of them from sending twice.

## One-time Cloudflare Worker setup (required for production)

Claude cannot do this part — it has no Cloudflare account access. From
`worker/`:

1. `npx wrangler login`
2. `npx wrangler kv namespace create S45_DATA` — copy the returned `id` into
   `worker/wrangler.toml`'s `[[kv_namespaces]]` block
3. `npx wrangler secret put DASH_USER` / `npx wrangler secret put DASH_PASS` —
   same values as the Vercel `DASH_USER`/`DASH_PASS` env vars
4. Set `ALLOWED_ORIGIN` in `worker/wrangler.toml` to the dashboard's exact
   production URL, then `npx wrangler deploy`
5. In Vercel, set `VITE_WORKER_URL` to the deployed Worker's URL (this is a
   **build-time** env var — Vercel redeploys/rebuilds automatically when you
   add or change it, but the frontend bundle won't include the data-loading
   code paths at all until a build actually runs with it set)
6. In GitHub repo secrets, add `CLOUDFLARE_API_TOKEN` (needs "Workers KV
   Storage: Edit"), `CLOUDFLARE_ACCOUNT_ID`, and `CLOUDFLARE_KV_NAMESPACE_ID`
   (the same id from step 2) — the nightly pipeline will start pushing fresh
   data into KV automatically from the next run onward; until these are set,
   `scripts/push-to-kv.mjs` just skips itself with a warning (the rest of the
   pipeline keeps working as before)
7. (added 2026-11-14) This same Worker also fires the daily LINE report —
   see `scheduled()` in `worker/src/index.js`, a Cloudflare Cron Trigger
   that calls the GitHub API directly, replacing the unreliable GitHub
   Actions `schedule:`/Claude-routine approach (repeated multi-hour delays —
   see that function's comments). Needs two more Worker secrets:
   `npx wrangler secret put GITHUB_PAT` (a fine-grained GitHub PAT scoped to
   just this repo, "Actions: Read and write" permission only — used to call
   `workflow_dispatch` on `send-line-report.yml`) and
   `npx wrangler secret put LINE_ALERT_CHANNEL_ACCESS_TOKEN` (same value as
   the GitHub secret of the same name — used to alert if the dispatch call
   itself fails). If deploying by pasting code into the Cloudflare Dashboard
   rather than `wrangler deploy`, also add the Cron Trigger manually:
   Workers & Pages → this Worker → **Triggers** tab → **Cron Triggers** →
   Add → `26 11 * * *` (UTC; `[triggers]` in `wrangler.toml` only takes
   effect on an actual `wrangler deploy`).

## Local development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```
