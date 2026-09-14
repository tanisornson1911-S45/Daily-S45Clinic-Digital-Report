#!/usr/bin/env node
/**
 * fetch-fb-doctor-campaigns.mjs
 * ---------------------------------------------------------------
 * TEMP DIAGNOSTIC (2026-09-14) — dumps every campaign name + latest-day
 * spend/Inbox for the 3 Nose Open ad accounts, so we can see the real
 * naming convention before writing the doctor-name parser for the
 * per-doctor Nose Open budget planner's CPR/forecast feature. Will be
 * replaced with the real extraction script once the naming pattern is
 * confirmed.
 * ---------------------------------------------------------------
 */

const FB_ACCESS_TOKEN = process.env.FB_ACCESS_TOKEN;
const API_VERSION = "v21.0";

if (!FB_ACCESS_TOKEN) {
  console.error("Missing FB_ACCESS_TOKEN environment variable.");
  process.exit(1);
}

// เหมือน fetch-fb-spend.mjs / fetch-fb-daily.mjs — 3 บัญชีที่รวมกันเป็นหมวด nose_open
const NOSE_OPEN_ACCOUNTS = {
  nose_open_01: "2214227468912072",
  nose_open_02: "1117617719803706",
  nose_open_freelance: "221741759556998",
};

const MSG_ACTION_TYPES = new Set(["onsite_conversion.total_messaging_connection"]);

async function fetchCampaignInsights(accountId, since, until) {
  const url = new URL(`https://graph.facebook.com/${API_VERSION}/act_${accountId}/insights`);
  url.searchParams.set("level", "campaign");
  url.searchParams.set("fields", "campaign_name,spend,actions");
  url.searchParams.set("time_range", JSON.stringify({ since, until }));
  url.searchParams.set("limit", "200");
  url.searchParams.set("access_token", FB_ACCESS_TOKEN);

  const res = await fetch(url);
  const json = await res.json();
  if (json.error) {
    console.error(`  ! ${accountId}: ${json.error.message}`);
    return [];
  }
  return json.data || [];
}

async function main() {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const since = yesterday.toISOString().slice(0, 10);
  const until = since;

  console.log(`=== Campaign-level insights for ${since} (yesterday) ===\n`);

  for (const [name, accountId] of Object.entries(NOSE_OPEN_ACCOUNTS)) {
    console.log(`--- ${name} (act_${accountId}) ---`);
    const rows = await fetchCampaignInsights(accountId, since, until);
    if (rows.length === 0) {
      console.log("  (no rows)");
      continue;
    }
    for (const r of rows) {
      const msgAction = (r.actions || []).find((a) => MSG_ACTION_TYPES.has(a.action_type));
      const inbox = msgAction ? Number(msgAction.value) : 0;
      console.log(`  "${r.campaign_name}" | spend=${r.spend ?? 0} | inbox=${inbox}`);
    }
  }

  // ลองอีกครั้งกับช่วง 7 วันล่าสุด รวมยอด เผื่อบางแคมเปญไม่มีการยิงเมื่อวานนี้พอดี
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const since7 = weekAgo.toISOString().slice(0, 10);
  console.log(`\n=== Campaign-level insights for ${since7}..${since} (last 7 days) ===\n`);
  for (const [name, accountId] of Object.entries(NOSE_OPEN_ACCOUNTS)) {
    console.log(`--- ${name} (act_${accountId}) ---`);
    const rows = await fetchCampaignInsights(accountId, since7, since);
    if (rows.length === 0) {
      console.log("  (no rows)");
      continue;
    }
    for (const r of rows) {
      const msgAction = (r.actions || []).find((a) => MSG_ACTION_TYPES.has(a.action_type));
      const inbox = msgAction ? Number(msgAction.value) : 0;
      console.log(`  "${r.campaign_name}" | spend=${r.spend ?? 0} | inbox=${inbox}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
