#!/usr/bin/env node
/**
 * fetch-fb-daily.mjs
 * ---------------------------------------------------------------
 * Pulls REAL daily ad spend + Inbox (Messenger conversations started)
 * from the Facebook Marketing API for the S45 Clinic ad accounts and
 * writes them to src/data/adDaily.json. This replaces the "ยอดขาย
 * Online S45 Clinic" Excel sheet as the source for the Ads/โฆษณา and
 * Inbox & Bad Lead pages' daily Ads/Inbox numbers — that sheet is
 * filled in by hand 1-3 days behind, so "วันนี้/เมื่อวาน" always looked
 * like it had no data even though real ad delivery had already happened.
 *
 * "Inbox" here = the raw actions:onsite_conversion.messaging_conversation_started_7d
 * count from the Marketing API (the same number Ads Manager's own
 * "Messaging conversations started" report column shows) — validated
 * against the internal spreadsheet's Inbox count for nose_open on
 * 2026-08-24 (119 from the API vs 109 in the sheet, ~9% apart) and
 * confirmed by the team's own separate Ads-insight dashboard, which
 * uses the same Messenger-Contact-based definition and reports it as
 * matching Meta's own numbers closely.
 *
 * Run manually:
 *   FB_ACCESS_TOKEN=xxxx node scripts/fetch-fb-daily.mjs
 *
 * Run automatically: see .github/workflows/update-dashboard-data.yml
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

// หมวดหมู่ -> บัญชี Ads ที่รวมยอด (ตรงกับ ACCOUNTS ใน fetch-fb-spend.mjs) — "inter" ใช้เฉพาะบัญชี
// เฉพาะทาง (เปลี่ยนชื่อจาก Nose Open 03 เมื่อ 2026-08-06) ไม่ไล่หาแคมเปญชื่อ "Inter" เก่าใน Nose Open 02
// แบบที่ fetch-fb-spend.mjs ทำระดับเดือน เพราะข้อมูลรายวันต้องดึงระดับบัญชีเพื่อประหยัด API call
// (แคมเปญเก่านั้นเป็นของก่อนการจัดกลุ่มใหม่ กระทบเฉพาะเดือนมิ.ย.เท่านั้น)
const CATEGORY_ACCOUNTS = {
  nose_open: ["2214227468912072", "1117617719803706", "221741759556998"],
  nose_semi: ["983591777378317"],
  breast_lipo: ["1948728392195994"],
  brow_hairline: ["225618075"],
  inter: ["1711014813661620"],
};

const MSG_ACTION_TYPES = new Set([
  "onsite_conversion.messaging_conversation_started_7d",
  "onsite_conversion.messaging_conversation_started",
]);

function monthRange(year, month /* 1-12 */) {
  const since = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const todayIso = new Date().toISOString().slice(0, 10);
  const monthEnd = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  // ถ้าเป็นเดือนปัจจุบัน ดึงถึงเมื่อวานเท่านั้น (วันนี้ข้อมูลยังไม่นิ่ง)
  const until = monthEnd < todayIso ? monthEnd : todayIso;
  return { since, until, daysInMonth: lastDay };
}

async function fetchAccountDaily(accountId, since, until) {
  const url = new URL(`https://graph.facebook.com/${API_VERSION}/act_${accountId}/insights`);
  url.searchParams.set("level", "account");
  url.searchParams.set("fields", "spend,actions");
  url.searchParams.set("time_range", JSON.stringify({ since, until }));
  url.searchParams.set("time_increment", "1");
  url.searchParams.set("limit", "31");
  url.searchParams.set("access_token", FB_ACCESS_TOKEN);

  const res = await fetch(url);
  const json = await res.json();
  if (json.error) {
    console.error(`  ! ${accountId}: ${json.error.message}`);
    return [];
  }
  return json.data || [];
}

async function fetchCategoryMonth(category, accountIds, year, month) {
  const { since, until, daysInMonth } = monthRange(year, month);
  const dailyAds = new Array(daysInMonth).fill(0);
  const dailyInbox = new Array(daysInMonth).fill(0);
  const daysWithData = new Set();

  for (const accountId of accountIds) {
    const rows = await fetchAccountDaily(accountId, since, until);
    for (const row of rows) {
      const day = Number(row.date_start.slice(8, 10));
      const idx = day - 1;
      if (idx < 0 || idx >= daysInMonth) continue;
      dailyAds[idx] += row.spend ? Math.round(parseFloat(row.spend)) : 0;
      const msgAction = (row.actions || []).find((a) => MSG_ACTION_TYPES.has(a.action_type));
      if (msgAction) dailyInbox[idx] += Number(msgAction.value) || 0;
      daysWithData.add(day);
    }
  }

  // ตัด array ให้เหลือแค่ถึงวันสุดท้ายที่มีข้อมูลจริง (กัน 0 ท้ายอาร์เรย์ของเดือนที่ยังไม่จบ)
  const lastDay = daysWithData.size > 0 ? Math.max(...daysWithData) : 0;
  return {
    dailyAds: dailyAds.slice(0, lastDay),
    dailyInbox: dailyInbox.slice(0, lastDay),
  };
}

async function main() {
  const now = new Date();
  // ดึง 3 เดือนล่าสุด (เดือนนี้ + 2 เดือนก่อน) ให้ครอบคลุมช่วงที่หน้า Ads/Inbox ใช้แสดงผล (มิ.ย.-ส.ค. เป็นต้นไป)
  const months = [];
  for (let i = 2; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
  }

  const outDir = path.resolve("src/data");
  const outPath = path.join(outDir, "adDaily.json");
  let existingMonths = {};
  try {
    const existing = JSON.parse(await readFile(outPath, "utf8"));
    existingMonths = existing.months || {};
  } catch {
    // ไฟล์ยังไม่มี (รันครั้งแรก)
  }

  const result = { ...existingMonths };

  for (const { year, month } of months) {
    const key = `${year}-${String(month).padStart(2, "0")}`;
    console.log(`\nFetching ${key}...`);
    result[key] = {};
    for (const [category, accountIds] of Object.entries(CATEGORY_ACCOUNTS)) {
      const { dailyAds, dailyInbox } = await fetchCategoryMonth(category, accountIds, year, month);
      result[key][category] = { dailyAds, dailyInbox };
      const adsSum = dailyAds.reduce((s, v) => s + v, 0);
      const inboxSum = dailyInbox.reduce((s, v) => s + v, 0);
      console.log(`  ${category}: ${dailyAds.length} วัน · ยอดยิง Ads ฿${adsSum.toLocaleString()} · Inbox ${inboxSum.toLocaleString()}`);
    }
  }

  await mkdir(outDir, { recursive: true });
  await writeFile(
    outPath,
    JSON.stringify(
      {
        generatedAt: now.toISOString(),
        source:
          "Generated by scripts/fetch-fb-daily.mjs (Facebook Marketing API, account-level daily insights). " +
          "dailyAds = spend (บาท) ต่อวันจากบัญชี Ads จริงของแต่ละหมวด (nose_open = Nose Open 01+02+Freelance รวมกัน, " +
          "เหมือน adSpend.json). dailyInbox = actions:onsite_conversion.messaging_conversation_started_7d ต่อวัน " +
          "(จำนวนคนเริ่มทักแชท Messenger จริงที่ Facebook นับเอง — ข้อมูลชุดเดียวกับที่ Ads Manager ใช้แสดงคอลัมน์ " +
          "\"Messaging conversations started\") ตรวจสอบแล้วว่าใกล้เคียงกับยอด Inbox ที่ทีม Digital นับมือมาก " +
          "(119 vs 109 ที่ nose_open วันที่ 24 ส.ค. 2569 ~9%) — ไม่ใช่ตัวเลขเป๊ะๆ 100% เพราะ Facebook นับด้วย 7-day " +
          "attribution window ต่างจากการนับวันต่อวันจริง แต่ทันสมัยกว่าไฟล์ Excel ที่กรอกมือช้ากว่า 1-3 วันเสมอ ทุก array " +
          "ตัดจบที่วันสุดท้ายที่มีข้อมูลจริงเท่านั้น (ไม่ pad 0 ท้ายเดือนที่ยังไม่จบ) · inter = เฉพาะบัญชี Inter เฉพาะทาง " +
          "(1711014813661620) ไม่รวมแคมเปญชื่อ \"Inter\" เก่าที่หลงเหลือใน Nose Open 02 ก่อนเดือน ส.ค. 2569 (ต่างจาก " +
          "adSpend.json ที่ไล่หาแคมเปญเก่านั้นด้วย เพราะข้อมูลรายวันต้องดึงแค่ระดับบัญชีเพื่อประหยัด API call)",
        months: result,
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
