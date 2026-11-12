#!/usr/bin/env node
/**
 * push-to-kv.mjs
 * ---------------------------------------------------------------
 * Pushes the dashboard's data files (src/data/*.json) into the Cloudflare
 * KV namespace the s45-dashboard-api Worker reads from (see worker/).
 *
 * This is the piece that replaces "the frontend bundles these JSON files
 * at build time" with "the frontend fetches them at runtime from a Worker
 * that's gated by Basic Auth + CORS" (per user direction 2026-11-09) — the
 * nightly pipeline already rebuilds these files locally (build-raw-tx.mjs
 * etc.); this script is just the last step that ships the result to KV
 * instead of (well, in addition to — see below) committing it to git.
 *
 * Only pushes files that exist AND are referenced in DATA_FILES below —
 * files other scripts in this repo write (m365Raw.json, campaignSnapshot.json,
 * cprAccountDaily.json) are pipeline-internal only (never imported by
 * src/App.jsx), so they're intentionally not pushed — no point exposing them
 * through the public API surface. weeklyBudget.json WAS pipeline-internal
 * too, until 2026-11-12 when App.jsx's "แผนดำเนินการร่วม Digital & PO" section
 * started reading it directly (replacing a hand-typed October-only table) —
 * moved into DATA_FILES below at that point.
 *
 * Still committing the JSON files to git too (unchanged from before) —
 * this script doesn't replace that, it's additive. The git copies remain
 * useful as the source other pipeline scripts chain-read from, and as a
 * debuggable history/backup.
 *
 * Uses the Cloudflare REST API directly (fetch) rather than the wrangler
 * CLI, so CI doesn't need to install/auth wrangler just for this one step.
 *
 * Required env vars (GitHub Actions repo secrets):
 *   CLOUDFLARE_API_TOKEN       — needs "Workers KV Storage: Edit" permission
 *   CLOUDFLARE_ACCOUNT_ID
 *   CLOUDFLARE_KV_NAMESPACE_ID — the id wrangler printed from
 *                                `wrangler kv namespace create S45_DATA`
 *
 * Run manually (needs the same env vars set locally):
 *   node scripts/push-to-kv.mjs
 *
 * Run automatically: appended as the last step of both
 * .github/workflows/update-m365-data.yml and update-dashboard-data.yml
 * (each only has a subset of these files fresh after its own run, but
 * pushing all of DATA_FILES every time is harmless/idempotent — whichever
 * files weren't touched this run just get re-pushed with the same content).
 * ---------------------------------------------------------------
 */

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

// Keep in sync with worker/src/index.js's DATA_KEYS and src/App.jsx's
// imports from "./data/liveData.js".
const DATA_FILES = [
  "adSpend",
  "rawTx",
  "consultTx",
  "loaData",
  "loaNormalData",
  "funnelByMonth",
  "adDaily",
  "doctorHeroPosts",
  "antArmyPosts",
  "badLead",
  "orSales",
  "consultPipeline",
  "channelMix",
  "interSale",
  "procedureBudget",
  "noseOpenDoctorAds",
  "weeklyBudget",
];

async function main() {
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const namespaceId = process.env.CLOUDFLARE_KV_NAMESPACE_ID;
  if (!apiToken || !accountId || !namespaceId) {
    console.error(
      "Missing CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_KV_NAMESPACE_ID — skipping KV push " +
        "(set these as repo secrets once the Cloudflare Worker/KV namespace exist; see worker/wrangler.toml)."
    );
    process.exit(0); // ไม่ fail ทั้ง pipeline ถ้ายังไม่ได้ตั้งค่า Cloudflare — ให้ส่วนอื่น (git commit) ทำงานต่อได้ปกติ
  }

  let pushed = 0;
  let missing = 0;
  for (const name of DATA_FILES) {
    const filePath = path.resolve(`src/data/${name}.json`);
    if (!existsSync(filePath)) {
      console.warn(`  ! src/data/${name}.json not found — skipping.`);
      missing++;
      continue;
    }
    const value = readFileSync(filePath, "utf8");
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/values/${name}`,
      {
        method: "PUT",
        headers: { Authorization: `Bearer ${apiToken}`, "Content-Type": "text/plain" },
        body: value,
      }
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`  ! Failed to push "${name}" (HTTP ${res.status}): ${text.slice(0, 300)}`);
      process.exit(1);
    }
    pushed++;
  }

  console.log(`Pushed ${pushed}/${DATA_FILES.length} file(s) to Cloudflare KV (${missing} missing/skipped).`);
}

main();
