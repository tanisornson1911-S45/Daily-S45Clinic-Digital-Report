# S45 Ads Dashboard

Internal marketing dashboard for S45 Clinic — Facebook Ads spend, sales funnel,
and ROAS tracking across procedure categories.

## Stack

- Vite + React + Tailwind CSS + Recharts
- `src/data/adSpend.json` holds live ad-spend figures, refreshed daily by
  `.github/workflows/update-dashboard-data.yml` (see `scripts/fetch-fb-spend.mjs`
  and `REALTIME_SYNC_SETUP.md` for the automated sync setup)
- Deployed on Vercel from the `main` branch — every push to `main` triggers a
  production redeploy

## Local development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```
