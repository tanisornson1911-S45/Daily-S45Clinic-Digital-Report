#!/usr/bin/env node
/**
 * build-loa.mjs
 * ---------------------------------------------------------------
 * Transforms the "LOA- <month>" sheets in src/data/m365Raw.json
 * (workbooks.loa_broadcast, refreshed daily by fetch-m365-data.mjs)
 * into src/data/loaData.json, which src/App.jsx imports to drive the
 * LINE OA Broadcast section — replacing what was, until 2026-08-25,
 * a one-off manual paste of LOA_JUNE / LOA_JUL_NORMAL / LOA_AFTERCARE_JUL.
 *
 * Each month sheet's own bottom summary rows are read directly rather
 * than re-derived, so no target/quota guessing is involved:
 *   "จำนวนบรอดแคสต์" -> broadcastReach
 *   "งบบรอดแคสต์"    -> budgetUsed
 *   "งบบลอดคงเหลือ"  -> budgetLeft   (only present from June 2026 onward)
 *   "บลอดคงเหลือ"    -> quotaLeft    (only present from June 2026 onward)
 * Jan-May 2026 sheets have no label text on those two rows at all (they
 * are simply the last two rows) and no budgetLeft/quotaLeft rows —
 * those months genuinely don't have that data in the source file, so
 * this script reports null rather than inventing a number.
 *
 * Column -> category mapping is read from each sheet's own header row
 * (row 0), not a hardcoded position, because the column layout changes
 * between months (Jan/Feb: 3 columns, no date column at all; Mar: adds
 * a date column; Apr-Jun: 5 categories incl. Semi/Branding; Jul/Aug:
 * a structurally different 3-column "Aftercare" layout — see below).
 *
 * IMPORTANT CAVEAT (found 2026-08-25): "LOA- กรกฎาคม" / "LOA- สิงหาคม"
 * in this workbook are the LINE OA *Aftercare* channel (columns หน้าอก/
 * ยกคิ้ว/สกิน match LOA_AFTERCARE_JUL exactly), not the "normal" channel
 * that LOA_JUL_NORMAL (open/semi/breast/brow/branding) was built from.
 * The normal channel's July source was never re-located in this
 * workbook, so July/August normal-channel data is NOT produced by this
 * script — App.jsx keeps the existing hand-typed LOA_JUL_NORMAL for
 * July and has no August normal-channel data at all yet.
 *
 * Run manually:
 *   node scripts/build-loa.mjs
 *
 * Run automatically: see .github/workflows/update-m365-data.yml
 * ---------------------------------------------------------------
 */

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const HEADER_TO_KEY = {
  "จมูก": "open",
  "Open": "open",
  "Semi": "semi",
  "หน้าอก": "breast",
  "ยกคิ้ว": "brow",
  "แบรนด์ดิ้ง": "branding",
  "Branding": "branding",
  "สกิน": "skin",
};

const MONTH_SHEETS = [
  ["LOA- มกราคม", "2026-01"],
  ["LOA- กุมภาพันธ์", "2026-02"],
  ["LOA- มีนาคม", "2026-03"],
  ["LOA- เมษายน", "2026-04"],
  ["LOA- พฤษภาคม", "2026-05"],
  ["LOA- มิถุนายน", "2026-06"],
  ["LOA- กรกฎาคม", "2026-07"], // Aftercare channel only, see caveat above
  ["LOA- สิงหาคม", "2026-08"], // Aftercare channel only, see caveat above
];

function parseSheet(sheet) {
  const header = sheet[0];
  const hasDateCol = header[0] === "วันที่";
  const colOffset = hasDateCol ? 1 : 0;
  const categoryCols = []; // [{ col, key }]
  for (let c = colOffset; c < header.length; c++) {
    const key = HEADER_TO_KEY[header[c]];
    if (key) categoryCols.push({ col: c, key });
  }

  const findRow = (label) => sheet.find((r) => r[0] === label);
  let reachRow = findRow("จำนวนบรอดแคสต์");
  let budgetRow = findRow("งบบรอดแคสต์");
  const budgetLeftRow = findRow("งบบลอดคงเหลือ");
  const quotaLeftRow = findRow("บลอดคงเหลือ");

  // แถวรายวัน = ทุกแถวระหว่าง header กับแถวสรุป "จำนวนบรอดแคสต์" (ใช้เป็น dailyReach ให้ Filter
  // ตามวันที่จริงได้ — ไม่ใช่แค่ยอดรวมทั้งเดือน) — Jan/Feb ไม่มี label แถวสรุปเลย ใช้ 2 แถวสุดท้าย
  // ที่มีข้อมูลเป็นแถวสรุปแทน (reach ก่อน budget) ส่วนที่เหลือคือแถวรายวัน
  let dailyRows;
  if (!reachRow || !budgetRow) {
    const dataRows = sheet.slice(1).filter((r) => r.some((c) => c !== ""));
    reachRow = dataRows[dataRows.length - 2];
    budgetRow = dataRows[dataRows.length - 1];
    dailyRows = dataRows.slice(0, dataRows.length - 2);
  } else {
    const reachRowIdx = sheet.indexOf(reachRow);
    const budgetRowIdx = sheet.indexOf(budgetRow);
    dailyRows = sheet.slice(1, Math.min(reachRowIdx, budgetRowIdx));
  }

  // ตัดท้าย array รายวันที่ทุกหัตถการว่าง/เป็น 0 พร้อมกัน (วันที่ยังไม่ถึง/ยังไม่กรอกจริง) — เก็บไว้
  // เฉพาะเท่าที่มีข้อมูลจริงอย่างน้อย 1 หัตถการ ไม่ตัดตามหัตถการใดหัตถการหนึ่งเพื่อกันวันที่มีจริงแต่บาง
  // หัตถการเป็น 0 (ไม่ได้บรอดวันนั้น) หายไปด้วย
  let lastDay = dailyRows.length;
  while (
    lastDay > 0 &&
    categoryCols.every(({ col }) => !(typeof dailyRows[lastDay - 1]?.[col] === "number" && dailyRows[lastDay - 1][col] !== 0))
  ) {
    lastDay--;
  }
  dailyRows = dailyRows.slice(0, lastDay);

  const categories = {};
  for (const { col, key } of categoryCols) {
    const reach = typeof reachRow?.[col] === "number" ? reachRow[col] : 0;
    const budgetUsed = typeof budgetRow?.[col] === "number" ? budgetRow[col] : 0;
    const budgetLeft = typeof budgetLeftRow?.[col] === "number" ? budgetLeftRow[col] : null;
    const quotaLeft = typeof quotaLeftRow?.[col] === "number" ? quotaLeftRow[col] : null;
    const dailyReach = dailyRows.map((r) => (typeof r[col] === "number" ? r[col] : 0));
    categories[key] = { broadcastReach: reach, budgetUsed, budgetLeft, quotaLeft, dailyReach };
  }
  return categories;
}

function main() {
  const m365Path = path.resolve("src/data/m365Raw.json");
  const m365 = JSON.parse(readFileSync(m365Path, "utf8"));
  const sheets = m365.workbooks?.loa_broadcast;
  if (!sheets) {
    console.error("Could not find workbooks.loa_broadcast in src/data/m365Raw.json.");
    process.exit(1);
  }

  const months = {};
  for (const [sheetName, monthIso] of MONTH_SHEETS) {
    const sheet = sheets[sheetName];
    if (!sheet) {
      console.warn(`Sheet "${sheetName}" not found — skipping ${monthIso}.`);
      continue;
    }
    months[monthIso] = parseSheet(sheet);
    console.log(`${monthIso} (${sheetName}):`, JSON.stringify(months[monthIso]));
  }

  const outPath = path.resolve("src/data/loaData.json");
  writeFileSync(outPath, JSON.stringify({ generatedAt: new Date().toISOString(), months }, null, 2));
  console.log(`\nWrote ${outPath}`);
}

main();
