#!/usr/bin/env node
/**
 * build-raw-tx.mjs
 * ---------------------------------------------------------------
 * Transforms the raw "มัดจำ 2026" sheet rows (src/data/m365Raw.json,
 * refreshed daily by scripts/fetch-m365-data.mjs) into RAW_TX's
 * per-case shape and writes them to src/data/rawTx.json, which
 * src/App.jsx imports directly.
 *
 * This replaces what was, until 2026-08-25, a one-off manual paste
 * into App.jsx — running this script (locally or in CI) after
 * fetch-m365-data.mjs now keeps RAW_TX (and everything derived from
 * it: MONTHLY_DATA, CATEGORIES, FB_SURGERY, OTHER_CHANNEL_DATA,
 * DOCTOR_PROC, OR_LEAD_TIME_DAYS) in sync with the live source
 * automatically.
 *
 * Surgery -> dashboard category mapping and the cascade rules below
 * were derived and validated on 2026-08-25 by cross-checking against
 * previously-confirmed monthly deposit/online totals (exact match for
 * 4/7 months, ~2% drift for the rest from routine live-sheet
 * corrections) — see the PR that introduced this script for the
 * validation notes.
 *
 * Run manually:
 *   node scripts/build-raw-tx.mjs
 *
 * Run automatically: see .github/workflows/update-m365-data.yml
 * (runs after fetch-m365-data.mjs, same commit)
 * ---------------------------------------------------------------
 */

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const SURGERY_MAP = {
  "เลื่อนไรผม": "brow_hairline",
  "Nose Open": "nose_open",
  "Brow Lift": "brow_hairline",
  "Breast": "breast_lipo",
  "Semi Open": "nose_semi",
  "ขูดสารเหลวหน้าผาก": "other",
  "Full Tummy": "breast_lipo",
  "Full Face": "other",
  "ตกแต่งริมฝีปากบน": "other",
  "ตัดปีก": "other",
  "ฉีดไขมัน": "breast_lipo",
  "Eye": "other",
  "ถอดพัก": "other",
  "Forehead": "other",
  "Ultera": "other",
  "ดูดไขมัน": "breast_lipo",
  "Skin": "other",
  "Filler": "other",
  "ยกมุมปาก": "brow_hairline",
  "ตัดชิ้นเนื้อที่หู": "other",
  "เสริมคาง": "other",
  "Nose Open (Batten Graft)": "nose_open",
  "Genioplasty": "other",
  "เติมไขมัน": "breast_lipo",
  "เสริมหน้าผาก": "other",
  "ถอดซิลิโคน": "other",
  "ถอดซิลิโคนหน้าผาก": "other",
  "เสริมขมับ": "other",
  "เทค5": "other",
  "ตกแต่งปลายจมูก": "other",
  "facelift": "brow_hairline",
  "ดึงหน้า": "brow_hairline",
};

// ผู้กรอกข้อมูลบางครั้งพิมพ์ชื่อหมอขาดวรรณยุกต์/สะกดต่างกัน ทำให้คนเดียวกันถูกนับแยกเป็นคนละหมอในสรุปยอด
// มัดจำ/จำนวนเคสแยกตามหมอ — normalize ให้เหลือชื่อเดียวตรงนี้ก่อนเขียนลง RAW_TX
const DOCTOR_NAME_ALIASES = {
  "หมอจิจ๊ะ": "หมอจิ๊จ๊ะ", // ขาดวรรณยุกต์ตรี (ไม้ตรี) บนพยางค์แรก
};
function normalizeDoctorName(name) {
  return DOCTOR_NAME_ALIASES[name] || name;
}

function excelDate(s) {
  if (typeof s !== "number") return null;
  const dt = new Date(Math.round((s - 25569) * 86400 * 1000));
  return dt.toISOString().slice(0, 10);
}

function main() {
  const m365Path = path.resolve("src/data/m365Raw.json");
  const m365 = JSON.parse(readFileSync(m365Path, "utf8"));

  // Tolerate both the current { workbooks: { data_s45_clinic: { sheets } } }
  // shape and the older flat { sheets } shape from before the Inter Sale
  // Part workbook was added, so this script keeps working either way.
  const sheets = m365.workbooks?.data_s45_clinic || m365.sheets;
  if (!sheets) {
    console.error('Could not find "มัดจำ 2026" sheet data in src/data/m365Raw.json.');
    process.exit(1);
  }
  const sheet = sheets["มัดจำ 2026"];
  if (!sheet) {
    console.error('Sheet "มัดจำ 2026" not found in src/data/m365Raw.json.');
    process.exit(1);
  }

  const rows = sheet.slice(1).filter((r) => r.some((c) => c !== "" && c != null));

  const out = [];
  const skipped = [];
  for (const r of rows) {
    const dt = excelDate(r[1]);
    const surgery = r[6];
    if (!dt || !surgery) {
      skipped.push(r);
      continue;
    }
    const p = SURGERY_MAP[surgery];
    if (!p) {
      skipped.push(r);
      continue;
    }
    const doc = r[5] && r[5] !== "" ? normalizeDoctorName(r[5]) : "รอระบุ";
    const or = excelDate(r[8]); // null if a string placeholder ("รอระบุ", "ยกเลิก", ...) or empty
    const dep = typeof r[9] === "number" ? r[9] : 0;
    const onl = typeof r[10] === "number" ? r[10] : 0;
    const tot = typeof r[11] === "number" ? r[11] : 0;
    const ch = typeof r[15] === "string" && r[15] !== "" ? r[15] : "Sale หาเอง";
    // cons = true if the "Sale Consult" column (index 3, employee name) is filled — used by
    // scripts/build-funnel.mjs to derive daily consult-close counts the same way
    // FUNNEL_DATA_JUL in App.jsx was originally hand-derived (see its comment).
    const cons = typeof r[3] === "string" && r[3].trim() !== "";
    out.push({ d: dt, or, ch, p, doc, dep, onl, tot, cons });
  }
  out.sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0));

  if (skipped.length > 0) {
    console.warn(`Skipped ${skipped.length} row(s) with no recognizable date/surgery:`);
    for (const r of skipped) console.warn("  ", JSON.stringify(r));
  }

  const outPath = path.resolve("src/data/rawTx.json");
  writeFileSync(outPath, JSON.stringify(out));
  console.log(`Wrote ${outPath} (${out.length} rows, ${skipped.length} skipped)`);
}

main();
