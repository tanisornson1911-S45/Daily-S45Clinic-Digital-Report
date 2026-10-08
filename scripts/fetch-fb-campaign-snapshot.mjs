#!/usr/bin/env node
/**
 * fetch-fb-campaign-snapshot.mjs
 * ---------------------------------------------------------------
 * Pulls the list of currently-ACTIVE Facebook ad campaigns (id + name) across
 * all 7 ad accounts (same accounts as fetch-fb-spend.mjs's ACCOUNTS + the
 * dedicated Inter account), and diffs that list against yesterday's snapshot
 * (src/data/campaignSnapshot.json from the previous run) to find which
 * campaigns were turned on/off since yesterday.
 *
 * This feeds the "Monitor Ads" section of the daily LINE OA report
 * (scripts/send-line-report.mjs) — per user direction (2026-10-08):
 *   - A campaign that's new today (wasn't active yesterday) whose name
 *     contains "[Re-new]" -> listed under "[Re-new]"
 *   - A campaign that's gone today (was active yesterday) whose name
 *     contained "[Re-new]" -> listed under "[ลบถาวร]"
 *   - A campaign that's new today WITHOUT "[Re-new]" in its name -> listed
 *     under "[Ads ขึ้นใหม่]"
 *   - A campaign that's gone today without "[Re-new]" in its name is NOT
 *     reported (per user's rule — only [Re-new] removals are tracked)
 *
 * Uses the Marketing API's /campaigns edge (effective_status filter), NOT
 * /insights — a campaign with ฿0 spend on a given day still shows up here,
 * which insights-based endpoints would silently miss.
 *
 * First-ever run (no previous snapshot file on disk): writes the snapshot
 * with an empty diff (nothing to compare against yet) rather than reporting
 * every currently-active campaign as "new".
 *
 * Run manually:
 *   FB_ACCESS_TOKEN=xxxx node scripts/fetch-fb-campaign-snapshot.mjs
 *
 * Run automatically: see .github/workflows/send-line-report.yml
 * ---------------------------------------------------------------
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

const FB_ACCESS_TOKEN = process.env.FB_ACCESS_TOKEN;
const API_VERSION = "v21.0";

if (!FB_ACCESS_TOKEN) {
  console.error("Missing FB_ACCESS_TOKEN environment variable.");
  process.exit(1);
}

// เหมือน fetch-fb-spend.mjs's ACCOUNTS — 6 บัญชีหมวดหลัก + บัญชี Inter เฉพาะทางแยกต่างหาก
const ACCOUNTS = {
  nose_open_01: { id: "2214227468912072", category: "nose_open" },
  nose_open_02: { id: "1117617719803706", category: "nose_open" },
  nose_open_freelance: { id: "221741759556998", category: "nose_open" },
  semi_open: { id: "983591777378317", category: "nose_semi" },
  breast: { id: "1948728392195994", category: "breast_lipo" },
  brow_facelift: { id: "225618075", category: "brow_hairline" },
  inter: { id: "1711014813661620", category: "inter" },
};

const INTER_NAME_MATCH = /inter/i;
const RENEW_TAG_RE = /\[re-new\]/i;

const CATEGORY_LABELS = {
  nose_open: "Nose Open",
  nose_semi: "เสริมจมูก Semi Open",
  breast_lipo: "เสริมหน้าอก/ดูดไขมัน",
  brow_hairline: "ยกคิ้ว/เลื่อนไรผม/ดึงหน้า",
  inter: "Inter",
};

async function fetchActiveCampaigns(accountId) {
  const campaigns = {};
  let url = new URL(`https://graph.facebook.com/${API_VERSION}/act_${accountId}/campaigns`);
  url.searchParams.set("fields", "id,name,effective_status");
  url.searchParams.set("filtering", JSON.stringify([{ field: "effective_status", operator: "IN", value: ["ACTIVE"] }]));
  url.searchParams.set("limit", "200");
  url.searchParams.set("access_token", FB_ACCESS_TOKEN);

  while (url) {
    const res = await fetch(url);
    const json = await res.json();
    if (json.error) {
      console.error(`  ! act_${accountId}: ${json.error.message}`);
      break;
    }
    for (const c of json.data || []) campaigns[c.id] = c.name;
    url = json.paging?.next ? new URL(json.paging.next) : null;
  }
  return campaigns;
}

function categoryFor(accountCategory, campaignName) {
  // แคมเปญชื่อมีคำว่า "Inter" ถือเป็นหมวด Inter เสมอ ไม่ว่าจะอยู่บัญชีไหน (เหมือน fetch-fb-spend.mjs)
  if (accountCategory !== "inter" && INTER_NAME_MATCH.test(campaignName)) return "inter";
  return accountCategory;
}

async function main() {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  const outPath = path.resolve("src/data/campaignSnapshot.json");
  const previous = existsSync(outPath) ? JSON.parse(readFileSync(outPath, "utf8")) : null;
  const previousCampaigns = previous?.campaigns || {};
  const isBootstrap = previous === null;

  // { id: { name, category } }
  const current = {};
  for (const [accountName, { id, category }] of Object.entries(ACCOUNTS)) {
    console.log(`Fetching active campaigns for ${accountName}...`);
    const campaigns = await fetchActiveCampaigns(id);
    for (const [campId, name] of Object.entries(campaigns)) {
      current[campId] = { name, category: categoryFor(category, name) };
    }
  }
  console.log(`Found ${Object.keys(current).length} active campaign(s) across ${Object.keys(ACCOUNTS).length} account(s).`);

  const diff = { reNew: [], newAds: [], deletedReNew: [] };
  if (!isBootstrap) {
    for (const [campId, { name, category }] of Object.entries(current)) {
      if (previousCampaigns[campId]) continue; // มีอยู่แล้วเมื่อวาน ไม่ใช่แคมเปญใหม่
      const entry = { id: campId, name, category };
      if (RENEW_TAG_RE.test(name)) diff.reNew.push(entry);
      else diff.newAds.push(entry);
    }
    for (const [campId, prev] of Object.entries(previousCampaigns)) {
      if (current[campId]) continue; // ยังแอคทีฟอยู่ ไม่ได้ถูกลบ
      if (RENEW_TAG_RE.test(prev.name)) diff.deletedReNew.push({ id: campId, name: prev.name, category: prev.category });
    }
  } else {
    console.log("No previous snapshot found — first run, writing baseline (no diff reported).");
  }

  writeFileSync(
    outPath,
    JSON.stringify(
      {
        generatedAt: now.toISOString(),
        source:
          'Generated by scripts/fetch-fb-campaign-snapshot.mjs (Facebook Marketing API /campaigns edge, effective_status=ACTIVE, ' +
          "across all 7 ad accounts — same accounts as adSpend.json). campaigns = today's full active-campaign snapshot (becomes " +
          "tomorrow's run's 'yesterday' to diff against). diff = campaigns that turned on/off since the previous run's snapshot " +
          '— reNew (new today, name has "[Re-new]"), newAds (new today, no tag), deletedReNew (gone today, had "[Re-new]" ' +
          "tag — other removals aren't tracked, per user direction 2026-10-08). Feeds the \"Monitor Ads\" section of the daily " +
          "LINE OA report (scripts/send-line-report.mjs).",
        date: today,
        campaigns: current,
        diff,
        categoryLabels: CATEGORY_LABELS,
      },
      null,
      2
    )
  );
  console.log(`Wrote ${outPath} (reNew: ${diff.reNew.length}, newAds: ${diff.newAds.length}, deletedReNew: ${diff.deletedReNew.length})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
