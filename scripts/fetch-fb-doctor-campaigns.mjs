#!/usr/bin/env node
/**
 * fetch-fb-doctor-campaigns.mjs
 * ---------------------------------------------------------------
 * Pulls REAL per-doctor "เสริมจมูกโอเพ่น" ad spend + Inbox (Total Messaging
 * Contacts) from the Facebook Marketing API for the latest day with data
 * (yesterday — today's numbers aren't settled yet, same convention as
 * fetch-fb-daily.mjs), and writes them to src/data/noseOpenDoctorAds.json.
 *
 * This replaces the Budget Allocate Google Sheet's per-doctor "งบที่ใช้
 * ปัจจุบัน"/"แชทปัจจุบัน" columns as the CPR/forecast basis in the "แผน
 * เพิ่มเติม Digital Team" budget planner — those sheet columns turned out to
 * be a single-day snapshot too (confirmed 2026-09-14 by comparing the
 * account-wide total against real API data), but self-reported/manually
 * tracked, whereas this script reads the real numbers directly.
 *
 * Doctor attribution: campaign names already encode which doctor a campaign
 * is for (e.g. "S48 - TOF - MSG - NoseOpen - หมอโรส Dr.Rose 01/07/69",
 * "DR.CHE l INBOX", "N04(Dr.toon) - ..."), confirmed via a diagnostic dump
 * of all 3 Nose Open ad accounts' campaign names on 2026-09-14 — each
 * doctor is matched against both their Thai name and English "Dr.X" alias
 * (nose_open_freelance's campaigns are ALL Dr.Che's own account and use
 * "DR.CHE"/"Dr.Che" only, no Thai name). A few campaigns name two doctors
 * together (e.g. "หมอจิ๊จ๊ะDr.Jija+หมอไบร์ทDr.Brite") — spend/Inbox for
 * those is split evenly between the doctors matched. Campaigns naming no
 * target doctor (generic/page-level creatives, or "หมอตี้"/"Dr.Ty" who has
 * no budget this month per the Budget Allocate sheet) are left unattributed
 * and excluded from every doctor's total. Any campaign whose name contains
 * "Inter" (case-insensitive — real examples use "[INTER]") is excluded
 * entirely regardless of doctor match, since this data is for Nose Open
 * only (per explicit user instruction 2026-09-14) — same match pattern as
 * fetch-fb-spend.mjs's INTER_NAME_MATCH.
 *
 * Run manually:
 *   FB_ACCESS_TOKEN=xxxx node scripts/fetch-fb-doctor-campaigns.mjs
 *
 * Run automatically: see .github/workflows/update-dashboard-data.yml
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

// เหมือน fetch-fb-spend.mjs / fetch-fb-daily.mjs — 3 บัญชีที่รวมกันเป็นหมวด nose_open
const NOSE_OPEN_ACCOUNTS = {
  nose_open_01: "2214227468912072",
  nose_open_02: "1117617719803706",
  nose_open_freelance: "221741759556998",
};

const MSG_ACTION_TYPES = new Set(["onsite_conversion.total_messaging_connection"]);
const INTER_NAME_MATCH = /inter/i;

// ชื่อคุณหมอในชื่อแคมเปญ (ไทย + English "Dr.X" alias) — ยืนยันจาก diagnostic dump จริง 2569-09-14
const DOCTOR_NAME_PATTERNS = {
  หมอโรส: [/หมอโรส/, /dr\.?\s*rose/i],
  หมอตูน: [/หมอตูน/, /dr\.?\s*toon/i],
  หมอเช: [/หมอเช/, /dr\.?\s*che/i],
  หมอจิ๊จ๊ะ: [/หมอจิ๊จ๊ะ/, /dr\.?\s*jija/i],
  หมอไบร์ท: [/หมอไบร์ท/, /dr\.?\s*brite/i],
};

function matchDoctors(campaignName) {
  return Object.entries(DOCTOR_NAME_PATTERNS)
    .filter(([, patterns]) => patterns.some((re) => re.test(campaignName)))
    .map(([name]) => name);
}

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
  const date = yesterday.toISOString().slice(0, 10);

  const doctors = {};
  for (const name of Object.keys(DOCTOR_NAME_PATTERNS)) doctors[name] = { spend: 0, inbox: 0 };
  let unattributedSpend = 0;
  let unattributedInbox = 0;
  let interExcludedSpend = 0;
  let interExcludedCampaigns = 0;

  console.log(`Fetching Nose Open campaign-level insights for ${date} (yesterday)...`);
  for (const [accountName, accountId] of Object.entries(NOSE_OPEN_ACCOUNTS)) {
    const rows = await fetchCampaignInsights(accountId, date, date);
    console.log(`  ${accountName}: ${rows.length} campaign(s) with activity`);
    for (const r of rows) {
      const campaignName = r.campaign_name || "";
      const spend = r.spend ? parseFloat(r.spend) : 0;
      const msgAction = (r.actions || []).find((a) => MSG_ACTION_TYPES.has(a.action_type));
      const inbox = msgAction ? Number(msgAction.value) || 0 : 0;

      if (INTER_NAME_MATCH.test(campaignName)) {
        interExcludedSpend += spend;
        interExcludedCampaigns += 1;
        continue;
      }

      const matched = matchDoctors(campaignName);
      if (matched.length === 0) {
        unattributedSpend += spend;
        unattributedInbox += inbox;
        continue;
      }
      const share = 1 / matched.length;
      for (const name of matched) {
        doctors[name].spend += spend * share;
        doctors[name].inbox += inbox * share;
      }
    }
  }

  for (const name of Object.keys(doctors)) {
    doctors[name].spend = Math.round(doctors[name].spend);
    doctors[name].inbox = Math.round(doctors[name].inbox);
    console.log(`  ${name}: ฿${doctors[name].spend.toLocaleString()} · Inbox ${doctors[name].inbox}`);
  }
  console.log(
    `  (ไม่รวมแคมเปญ Inter ${interExcludedCampaigns} รายการ ฿${Math.round(interExcludedSpend).toLocaleString()} · ไม่ระบุคุณหมอ ฿${Math.round(
      unattributedSpend
    ).toLocaleString()}/Inbox ${Math.round(unattributedInbox)})`
  );

  const outDir = path.resolve("src/data");
  const outPath = path.join(outDir, "noseOpenDoctorAds.json");
  await mkdir(outDir, { recursive: true });
  await writeFile(
    outPath,
    JSON.stringify(
      {
        generatedAt: now.toISOString(),
        source:
          "Generated by scripts/fetch-fb-doctor-campaigns.mjs (Facebook Marketing API, campaign-level insights " +
          "for the 3 Nose Open ad accounts — nose_open_01/02/freelance, same accounts as adSpend.json's nose_open " +
          "category). date = วันล่าสุดที่ข้อมูลนิ่งแล้ว (เมื่อวาน). ดึงจากชื่อแคมเปญที่มีชื่อคุณหมอระบุอยู่แล้ว — " +
          "แคมเปญที่ระบุ 2 คุณหมอพร้อมกันแบ่งงบ/Inbox เท่าๆ กัน แคมเปญที่ไม่ระบุคุณหมอ (หรือระบุหมอตี้ ซึ่งไม่มีงบเดือนนี้) " +
          "ไม่ถูกนับ · แคมเปญที่มีคำว่า \"Inter\" ในชื่อ (ตรวจสอบแล้วใช้ \"[INTER]\" ตัวใหญ่ในวงเล็บเหลี่ยม) ถูกตัดออกทั้งหมด " +
          "เพราะข้อมูลชุดนี้ใช้เฉพาะเสริมจมูกโอเพ่น ไม่เกี่ยวกับ Inter",
        date,
        doctors,
      },
      null,
      2
    )
  );
  console.log(`\nWrote ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
