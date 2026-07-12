#!/usr/bin/env node
/**
 * fetch-fb-spend.mjs
 * ---------------------------------------------------------------
 * Pulls real monthly ad spend from the Facebook Marketing API for
 * the S45 Clinic ad accounts and writes it to src/data/adSpend.json.
 *
 * Run manually:
 *   FB_ACCESS_TOKEN=xxxx node scripts/fetch-fb-spend.mjs
 *
 * Run automatically: see .github/workflows/update-dashboard-data.yml
 *
 * Requires a System User access token with ads_read permission on
 * business "เสริมจมูกเกาหลี By หมอตี๋" (business_id 998717160298356).
 * Generate one at https://business.facebook.com/settings/system-users
 * and store it as the FB_ACCESS_TOKEN repo secret in GitHub
 * (Settings → Secrets and variables → Actions → New repository secret).
 * ---------------------------------------------------------------
 */

import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const FB_ACCESS_TOKEN = process.env.FB_ACCESS_TOKEN;
const API_VERSION = "v21.0";

if (!FB_ACCESS_TOKEN) {
  console.error("Missing FB_ACCESS_TOKEN environment variable.");
  process.exit(1);
}

// S45 ad accounts -> dashboard category key
// (IDs confirmed live via Facebook Ads MCP on 2026-07-12)
const ACCOUNTS = {
  nose_open_01: { id: "2214227468912072", category: "nose_open" },
  nose_open_02: { id: "1117617719803706", category: "nose_open" },
  nose_open_03: { id: "1711014813661620", category: "nose_open" },
  semi_open: { id: "983591777378317", category: "nose_semi" },
  breast: { id: "1948728392195994", category: "breast_lipo" },
  brow_facelift: { id: "225618075", category: "brow_hairline" },
};

// "Inter" category is NOT a whole ad account — it's whichever campaigns
// inside Nose Open 02 have "Inter" in their name (confirmed with the team
// on 2026-07-12). Sum spend across those campaigns instead of the account.
const INTER_ACCOUNT_ID = "1117617719803706"; // Nose Open 02
const INTER_NAME_MATCH = /inter/i;

async function fetchInterCampaignSpend(accountId, since, until) {
  const url = new URL(`https://graph.facebook.com/${API_VERSION}/act_${accountId}/insights`);
  url.searchParams.set("level", "campaign");
  url.searchParams.set("fields", "campaign_name,spend");
  url.searchParams.set("time_range", JSON.stringify({ since, until }));
  url.searchParams.set("limit", "200");
  url.searchParams.set("access_token", FB_ACCESS_TOKEN);

  const res = await fetch(url);
  const json = await res.json();
  if (json.error) {
    console.error(`  ! Inter campaigns (${accountId}): ${json.error.message}`);
    return 0;
  }
  const rows = json.data || [];
  const matched = rows.filter((r) => INTER_NAME_MATCH.test(r.campaign_name || ""));
  const total = matched.reduce((sum, r) => sum + (r.spend ? parseFloat(r.spend) : 0), 0);
  console.log(`  Inter campaigns matched: ${matched.length} (of ${rows.length} in account)`);
  return Math.round(total);
}

function monthRange(year, month /* 1-12 */) {
  const since = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const until = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { since, until };
}

async function fetchAccountSpend(accountId, since, until) {
  const url = new URL(`https://graph.facebook.com/${API_VERSION}/act_${accountId}/insights`);
  url.searchParams.set("fields", "spend");
  url.searchParams.set("time_range", JSON.stringify({ since, until }));
  url.searchParams.set("access_token", FB_ACCESS_TOKEN);

  const res = await fetch(url);
  const json = await res.json();
  if (json.error) {
    console.error(`  ! ${accountId}: ${json.error.message}`);
    return 0;
  }
  const spend = json.data?.[0]?.spend;
  return spend ? Math.round(parseFloat(spend)) : 0;
}

async function main() {
  const now = new Date();
  // Pull the last 6 full months plus month-to-date, matching the
  // dashboard's existing oct25..jul26 trend table.
  const months = [];
  for (let i = 9; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
  }

  const result = {}; // { "2026-06": { nose_open: 824506, ... }, ... }

  for (const { year, month } of months) {
    const { since, until } = monthRange(year, month);
    const key = `${year}-${String(month).padStart(2, "0")}`;
    console.log(`Fetching ${key} (${since} → ${until})...`);
    result[key] = {};

    let accountsTotal = 0;
    for (const [name, { id, category }] of Object.entries(ACCOUNTS)) {
      const spend = await fetchAccountSpend(id, since, until);
      result[key][category] = (result[key][category] || 0) + spend;
      accountsTotal += spend;
      console.log(`  ${name} (${category}): ฿${spend.toLocaleString()}`);
    }

    const interSpend = await fetchInterCampaignSpend(INTER_ACCOUNT_ID, since, until);
    result[key].inter = interSpend;
    console.log(`  inter (campaigns matching "Inter" in Nose Open 02): ฿${interSpend.toLocaleString()}`);

    // 'inter' campaigns live inside Nose Open 02, whose full spend is already in
    // the nose_open category — so summing the category fields would double-count
    // them. Store an explicit month 'total' = sum of the 6 ad accounts instead,
    // which the dashboard's liveMonthTotal() prefers over summing the breakdown.
    result[key].total = accountsTotal;
    console.log(`  total (6 accounts, no inter double-count): ฿${accountsTotal.toLocaleString()}`);
  }

  const outDir = path.resolve("src/data");
  await mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, "adSpend.json");
  await writeFile(
    outPath,
    JSON.stringify({ generatedAt: now.toISOString(), months: result }, null, 2)
  );
  console.log(`\nWrote ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
