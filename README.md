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

## Local development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```
