#!/usr/bin/env node
/**
 * fetch-fb-cpr-breakdown.mjs
 * ---------------------------------------------------------------
 * Pulls daily campaign-level Facebook spend + Inbox for the specific
 * account/campaign scope the team wants for the LINE OA report's CPR
 * fields (confirmed with the user 2026-10-09 — narrower than adDaily.json's
 * "nose_open"/"inter" categories, which are account-level and include the
 * Freelance Nett account / don't exclude legacy Inter campaigns):
 *
 *   - CPR Nose Open = Nose Open 01 + Nose Open 02 ONLY (no Freelance Nett),
 *     EXCLUDING any campaign whose name contains "Inter".
 *   - CPR Inter = the dedicated Inter account + Nose Open 02's campaigns,
 *     but ONLY the ones whose name contains "Inter" (same campaigns the
 *     "Nose Open" bucket above excludes).
 *
 * Needs campaign-level (not account-level) daily insights specifically for
 * Nose Open 02, since that single account contains a mix of both kinds of
 * campaigns that must be split — fetch-fb-daily.mjs's account-level pull
 * can't make this distinction (see its own header comment).
 *
 * Writes src/data/cprAccountDaily.json, rolling/merging with whatever's
 * already on disk the same way adDaily.json does (current month + history
 * preserved, not re-fetched).
 *
 * Run manually:
 *   FB_ACCESS_TOKEN=xxxx node scripts/fetch-fb-cpr-breakdown.mjs
 *
 * Run automatically: see .github/workflows/send-line-report.yml
 * ---------------------------------------------------------------
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const FB_ACCESS_TOKEN = process.env.FB_ACCESS_TOKEN;
const API_VERSION = "v21.0";

if (!FB_ACCESS_TOKEN) {
  console.error("Missing FB_ACCESS_TOKEN environment variable.");
  process.exit(1);
}

const NOSE_OPEN_01 = "2214227468912072";
const NOSE_OPEN_02 = "1117617719803706";
const INTER_DEDICATED = "1711014813661620";

const MSG_ACTION_TYPES = new Set(["onsite_conversion.total_messaging_connection"]);
const INTER_NAME_MATCH = /inter/i;

function monthRange(year, month /* 1-12 */) {
  const since = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const todayIso = new Date().toISOString().slice(0, 10);
  const monthEnd = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  const until = monthEnd < todayIso ? monthEnd : todayIso;
  return { since, until, daysInMonth: lastDay };
}

// ดึง insight ระดับแคมเปญรายวัน (ไม่ใช่ระดับบัญชี) เพื่อแยกแคมเปญชื่อ Inter ออกจากแคมเปญอื่นในบัญชีเดียวกันได้
async function fetchCampaignDaily(accountId, since, until) {
  const rows = [];
  let url = new URL(`https://graph.facebook.com/${API_VERSION}/act_${accountId}/insights`);
  url.searchParams.set("level", "campaign");
  url.searchParams.set("fields", "campaign_name,spend,actions");
  url.searchParams.set("time_range", JSON.stringify({ since, until }));
  url.searchParams.set("time_increment", "1");
  url.searchParams.set("limit", "500");
  url.searchParams.set("access_token", FB_ACCESS_TOKEN);

  while (url) {
    const res = await fetch(url);
    const json = await res.json();
    if (json.error) {
      console.error(`  ! act_${accountId}: ${json.error.message}`);
      break;
    }
    rows.push(...(json.data || []));
    url = json.paging?.next ? new URL(json.paging.next) : null;
  }
  return rows;
}

function addRowsToDaily(rows, dailyAds, dailyInbox, daysInMonth, filterFn) {
  for (const row of rows) {
    const name = row.campaign_name || "";
    if (filterFn && !filterFn(name)) continue;
    const day = Number(row.date_start.slice(8, 10));
    const idx = day - 1;
    if (idx < 0 || idx >= daysInMonth) continue;
    dailyAds[idx] += row.spend ? Math.round(parseFloat(row.spend)) : 0;
    const msgAction = (row.actions || []).find((a) => MSG_ACTION_TYPES.has(a.action_type));
    if (msgAction) dailyInbox[idx] += Number(msgAction.value) || 0;
  }
}

async function fetchMonth(year, month) {
  const { since, until, daysInMonth } = monthRange(year, month);
  const untilDay = Number(until.slice(8, 10));

  const noseOpenCprAds = new Array(daysInMonth).fill(0);
  const noseOpenCprInbox = new Array(daysInMonth).fill(0);
  const interCprAds = new Array(daysInMonth).fill(0);
  const interCprInbox = new Array(daysInMonth).fill(0);

  console.log(`  Fetching Nose Open 01 campaigns (${since} - ${until})...`);
  const rows01 = await fetchCampaignDaily(NOSE_OPEN_01, since, until);
  addRowsToDaily(rows01, noseOpenCprAds, noseOpenCprInbox, daysInMonth, (name) => !INTER_NAME_MATCH.test(name));

  console.log(`  Fetching Nose Open 02 campaigns (${since} - ${until})...`);
  const rows02 = await fetchCampaignDaily(NOSE_OPEN_02, since, until);
  addRowsToDaily(rows02, noseOpenCprAds, noseOpenCprInbox, daysInMonth, (name) => !INTER_NAME_MATCH.test(name));
  addRowsToDaily(rows02, interCprAds, interCprInbox, daysInMonth, (name) => INTER_NAME_MATCH.test(name));

  console.log(`  Fetching dedicated Inter account campaigns (${since} - ${until})...`);
  const rowsInter = await fetchCampaignDaily(INTER_DEDICATED, since, until);
  addRowsToDaily(rowsInter, interCprAds, interCprInbox, daysInMonth, null);

  return {
    nose_open_cpr: { dailyAds: noseOpenCprAds.slice(0, untilDay), dailyInbox: noseOpenCprInbox.slice(0, untilDay) },
    inter_cpr: { dailyAds: interCprAds.slice(0, untilDay), dailyInbox: interCprInbox.slice(0, untilDay) },
  };
}

async function main() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const key = `${year}-${String(month).padStart(2, "0")}`;

  const outDir = path.resolve("src/data");
  const outPath = path.join(outDir, "cprAccountDaily.json");
  let existingMonths = {};
  try {
    const existing = JSON.parse(await readFile(outPath, "utf8"));
    existingMonths = existing.months || {};
  } catch {
    // ไฟล์ยังไม่มี (รันครั้งแรก)
  }

  console.log(`Fetching ${key}...`);
  const monthData = await fetchMonth(year, month);
  const result = { ...existingMonths, [key]: monthData };

  const adsSum = (s) => s.dailyAds.reduce((a, b) => a + b, 0);
  const inboxSum = (s) => s.dailyInbox.reduce((a, b) => a + b, 0);
  console.log(
    `  nose_open_cpr: ${monthData.nose_open_cpr.dailyAds.length} วัน · ฿${adsSum(monthData.nose_open_cpr).toLocaleString()} · Inbox ${inboxSum(
      monthData.nose_open_cpr
    ).toLocaleString()}`
  );
  console.log(
    `  inter_cpr: ${monthData.inter_cpr.dailyAds.length} วัน · ฿${adsSum(monthData.inter_cpr).toLocaleString()} · Inbox ${inboxSum(
      monthData.inter_cpr
    ).toLocaleString()}`
  );

  await mkdir(outDir, { recursive: true });
  await writeFile(
    outPath,
    JSON.stringify(
      {
        generatedAt: now.toISOString(),
        source:
          "Generated by scripts/fetch-fb-cpr-breakdown.mjs (Facebook Marketing API, campaign-level daily insights). " +
          "nose_open_cpr = Nose Open 01 + Nose Open 02 ONLY (no Freelance Nett), excluding any campaign named " +
          '"Inter" — narrower scope than adDaily.json\'s "nose_open" category, per user direction 2026-10-09 ' +
          "(CPR specifically). inter_cpr = the dedicated Inter account + Nose Open 02's campaigns named \"Inter\" " +
          "only. Used by scripts/send-line-report.mjs for the daily LINE OA report's CPR Nose Open / CPR Inter " +
          "fields — CPR = spend ÷ Inbox for the month so far.",
        months: result,
      },
      null,
      2
    )
  );
  console.log(`Wrote ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
