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

// นิยามหมวดหัตถการ — เขียนใหม่ทั้งหมดตามที่ผู้ใช้ยืนยัน 2026-11-04 (แทนที่นิยามเดิมก่อนหน้ารวมถึงการยืนยัน
// 2026-10-30 เรื่องกลุ่มหัตถการตา): Nose Open = Nose Open/เสริมจมูกโอเพ่น/เสริมจมูกซี่โครง, Nose Semi Open =
// Semi Open/เสริมคาง/ปาก (รวม "ยกมุมปาก" — ย้ายมาจากยกคิ้วเดิม เพราะเป็นหัตถการกลุ่มปาก), ยกคิ้ว = ยกคิ้ว(Brow
// Lift)/ดึงหน้า/Facelift/เสริมหน้าผาก/ดูดไขมันใบหน้า/Eye (รวมหัตถการกลุ่มตาทั้งหมดตาม Eye ไปด้วยกันตามที่ผู้ใช้
// ยืนยัน — ตัดถุงใต้ตา/เก็บหางตา/ถุงใต้ตาแผลใน/จัดเรียงไขมันใต้ตา — และ "เลื่อนไรผม"/"Subbrow lift"/"ดึงขมับ" ที่เป็น
// หัตถการกลุ่มยก/ดึงหน้าผาก-ขมับเดียวกัน), Breast = Breast/ตัดหนังหน้าท้อง/ดูดไขมัน "เท่านั้น" ตามที่ผู้ใช้ย้ำ (ไม่รวม
// ฉีดไขมัน/เติมไขมัน อีกต่อไป เพราะเป็นการฉีด/เติมไขมันที่ไม่จำเพาะว่าเป็นส่วนไหนของร่างกาย — "Full Tummy" ยังคงอยู่
// เพราะเป็นชื่อภาษาอังกฤษของหัตถการเดียวกับ "ตัดหนังหน้าท้อง" ที่ระบุไว้ชัดเจน)
// หัตถการที่ไม่เข้าเกณฑ์ 4 กลุ่มนี้เลย ใส่เป็น "other" ไว้ (ไม่ใช่ตัดออกจาก map ทั้งหมด) ตามที่ผู้ใช้ยืนยันว่าให้นับรวมใน
// ยอดรวมทุกหัตถการได้ แต่ไม่จัดอยู่หมวดใดหมวดหนึ่ง — "other" ไม่อยู่ใน DAILY_CATEGORY_KEYS/GRAND_TOTAL_SALES_
// CATEGORIES ของ App.jsx จึงไม่ถูกนับในการ์ดสรุปแยกตามหัตถการ/"รวมทุกหัตถการ" ที่กรองด้วย key เหล่านั้น แต่ยังอยู่ใน
// RAW_TX เอง (ไม่ถูกข้าม/ดร็อปทิ้งแบบที่เคยเกิดกับหัตถการที่ไม่มีใน map เลย — ดูประวัติ Subbrow lift/ตัดตกแต่งคาง ฯลฯ)
const SURGERY_MAP = {
  "Nose Open": "nose_open",
  "Nose Open (Batten Graft)": "nose_open",
  "เสริมจมูกโอเพ่น": "nose_open",
  "เสริมจมูกซี่โครง": "nose_open",

  "Semi Open": "nose_semi",
  "เสริมคาง": "nose_semi", // เดิม "other" — ย้ายมากลุ่ม Nose Semi Open (ปาก/คาง) ตามนิยามใหม่ 2026-11-04
  "ตัดตกแต่งคาง": "nose_semi", // กลุ่มคางเดียวกับ "เสริมคาง"
  "Genioplasty": "nose_semi", // เดิม "other" — ชื่อทางการแพทย์ของหัตถการคาง อยู่กลุ่มเดียวกับ เสริมคาง/ตัดตกแต่งคาง
  "หัตถการปาก": "nose_semi",
  "ตกแต่งริมฝีปากบน": "nose_semi", // เดิม "other" — เป็นหัตถการกลุ่มปาก
  "ยกมุมปาก": "nose_semi", // เดิมอยู่ยกคิ้ว — ย้ายมากลุ่มปาก (Nose Semi Open) ตามนิยามใหม่ 2026-11-04
  "ปาก": "nose_semi",

  "Brow Lift": "brow_hairline",
  "ยกคิ้ว": "brow_hairline",
  "ดึงหน้า": "brow_hairline",
  "facelift": "brow_hairline",
  "เสริมหน้าผาก": "brow_hairline", // เดิม "other"
  "Forehead": "brow_hairline", // เดิม "other" — ชื่อภาษาอังกฤษของ "เสริมหน้าผาก"
  "ดูดไขมันใบหน้า": "brow_hairline",
  // กลุ่มหัตถการตาทั้งหมด (Eye/ตัดถุงใต้ตา/เก็บหางตา/ถุงใต้ตาแผลใน/จัดเรียงไขมันใต้ตา) ย้ายจาก Nose Semi Open (ตามที่
  // เคยยืนยัน 2026-10-30) มาอยู่กลุ่มยกคิ้วแทน ตามนิยามใหม่ 2026-11-04 ที่ระบุ "Eye" ไว้ในกลุ่มยกคิ้วโดยตรง
  "Eye": "brow_hairline",
  "ตัดถุงใต้ตา": "brow_hairline",
  "เก็บหางตา": "brow_hairline",
  "ถุงใต้ตาแผลใน": "brow_hairline",
  "จัดเรียงไขมันใต้ตา": "brow_hairline",
  "เลื่อนไรผม": "brow_hairline", // ไม่ได้ระบุชื่อตรงๆ ในนิยามใหม่ แต่เป็นหัตถการกลุ่มหน้าผาก/แนวผมเดียวกับ "เสริมหน้าผาก"
  "Subbrow lift": "brow_hairline", // หัตถการย่อยของ Brow Lift โดยตรง
  "ดึงขมับ": "brow_hairline", // กลุ่มดึง/ยกเดียวกับ "ดึงหน้า" (คนละตัวกับ "เสริมขมับ" ที่เป็นการฉีด/เสริม ไม่ใช่การดึง)

  "Breast": "breast_lipo",
  "ตัดหนังหน้าท้อง": "breast_lipo",
  "ดูดไขมัน": "breast_lipo",
  "ดูดไขมันหน้าท้อง": "breast_lipo",
  "Full Tummy": "breast_lipo", // ชื่อภาษาอังกฤษของหัตถการเดียวกับ "ตัดหนังหน้าท้อง"

  // หัตถการด้านล่างนี้ไม่เข้าเกณฑ์ทั้ง 4 กลุ่มใหม่ — เก็บเป็น "other" ไว้ (ไม่ตัดออกจาก map) กันไม่ให้แถวหายไปจาก
  // RAW_TX ทั้งก้อนแบบที่เคยเกิดกับหัตถการที่ไม่มีใน map เลย (ดูคอมเมนต์ด้านบน SURGERY_MAP)
  "ขูดสารเหลวหน้าผาก": "other",
  "Full Face": "other",
  "ตัดปีก": "other",
  "ฉีดไขมัน": "other", // เดิม breast_lipo — ย้ายออกตามนิยามใหม่ 2026-11-04 (Breast มีแค่ Breast/ตัดหนังหน้าท้อง/ดูดไขมัน)
  "เติมไขมัน": "other", // เดิม breast_lipo — ย้ายออกตามนิยามใหม่ 2026-11-04 เช่นกัน
  "ถอดพัก": "other",
  "Ultera": "other",
  "Skin": "other",
  "Filler": "other",
  "ตัดชิ้นเนื้อที่หู": "other",
  "ถอดซิลิโคน": "other",
  "ถอดซิลิโคนหน้าผาก": "other",
  "ถอดซิลิโคนจมูก": "other", // เดิมไม่มีใน map เลยทำให้แถวนี้ถูกข้ามไปทั้งแถว — เพิ่มเป็น "other" กันข้อมูลหาย
  "เสริมขมับ": "other",
  "เทค4": "other", // เดิมไม่มีใน map เลยทำให้แถวนี้ถูกข้ามไปทั้งแถว — เพิ่มเป็น "other" กันข้อมูลหาย
  "เทค5": "other",
  "ตกแต่งปลายจมูก": "other",
  "ดูดเหนียง": "other", // เดิมไม่มีใน map เลยทำให้แถวนี้ถูกข้ามไปทั้งแถว — เพิ่มเป็น "other" กันข้อมูลหาย
  "ร้อยไหม": "other", // เดิมไม่มีใน map เลยทำให้แถวนี้ถูกข้ามไปทั้งแถว — เพิ่มเป็น "other" กันข้อมูลหาย
  "หัตถการ จี้RF": "other", // เดิมไม่มีใน map เลยทำให้แถวนี้ถูกข้ามไปทั้งแถว — เพิ่มเป็น "other" กันข้อมูลหาย
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
    // sale = column 16, "Sale ปิดมัดจำ" (the employee who closed THIS deposit — distinct from
    // "Sale Consult" at column 3, who just handled the initial consult). Was read from the sheet
    // for years but silently discarded — App.jsx's "สรุปยอดปิดมัดจำ แยกตาม Sale" card (added 2569-09-09
    // per user request) needs the actual name, not just a presence flag.
    const sale = typeof r[16] === "string" && r[16].trim() !== "" ? r[16].trim() : "รอระบุ";
    // name/saleOnline/saleConsult — เพิ่ม 2026-11-04 สำหรับรายชื่อลูกค้า "ปิดมัดจำ"/"ปิด OR" บนหน้า Inbox & Lead
    // (ปิด OR ใช้แถวเดียวกันนี้กรองด้วย "or" แทน "d" — ดูคอมเมนต์ที่ใช้งานใน App.jsx) name = คอลัมน์ 4 "Customer
    // name", saleOnline = คอลัมน์ 2 "Sale Online", saleConsult = คอลัมน์ 3 (คนละตัวกับ "cons" ที่เป็นแค่ boolean)
    const name = typeof r[4] === "string" && r[4].trim() !== "" ? r[4].trim() : null;
    const saleOnline = typeof r[2] === "string" && r[2].trim() !== "" ? r[2].trim() : null;
    const saleConsult = typeof r[3] === "string" && r[3].trim() !== "" ? r[3].trim() : null;
    out.push({ d: dt, or, ch, p, doc, dep, onl, tot, cons, sale, name, saleOnline, saleConsult });
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
