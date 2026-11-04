#!/usr/bin/env node
/**
 * build-consult-tx.mjs
 * ---------------------------------------------------------------
 * Transforms the "ปรึกษา 2026" sheet (src/data/m365Raw.json, refreshed
 * daily by scripts/fetch-m365-data.mjs) into src/data/consultTx.json —
 * one row per consult visit, used for the "ยอดปิดปรึกษา" card and the
 * "ปิดปรึกษา" column of the "ปิดปรึกษา / ปิดมัดจำ แยกตามหัตถการ" table
 * on the Inbox & Lead page.
 *
 * Until 2026-11-04 "ปิดปรึกษา" was derived from "มัดจำ 2026" (RAW_TX) —
 * either counting rows whose "Sale Consult" column had an employee name
 * (the daily-funnel card), or every RAW_TX row regardless of that column
 * (the per-procedure table). Per user direction (2026-11-04): "ปิดมัดจำ"
 * should keep coming from "มัดจำ 2026", but "ปิดปรึกษา" should come from
 * the dedicated "ปรึกษา 2026" sheet instead — that's the sheet the team
 * actually logs every consultation into (1,424 rows vs. "มัดจำ 2026"'s
 * 968), so it's the authoritative source for how many consults closed,
 * not a byproduct of the deposit sheet's optional "Sale Consult" column.
 *
 * Counts EVERY row regardless of its "ปรึกษา / มัดจำ" status column — a
 * row existing at all means that consultation happened and was closed
 * that day, whether or not it later turned into a deposit. (Compare
 * scripts/build-consult-pipeline.mjs, which filters down to ONLY the
 * not-yet-deposited subset — for a different purpose, avoiding double-
 * counting "ยอดขายรวม (Facebook)" on the Overview page. This script wants
 * every consult VISIT, so it keeps them all.)
 *
 * Date = "Date ปิด" (the date the consultation itself was closed/
 * logged) — same column build-consult-pipeline.mjs uses, for the same
 * reason: it's populated on every row, unlike "Date ทักเข้า" (initial
 * contact date, sometimes blank) or "Date Consult" (the consult
 * APPOINTMENT date, which can land months after the row was logged).
 *
 * Surgery -> procedure mapping: same 4 categories as RAW_TX
 * (nose_open/nose_semi/breast_lipo/brow_hairline); anything else
 * bucketed into "other" instead of dropped (see build-or-sales.mjs for
 * why silently dropping unmapped rows is the wrong default).
 *
 * Run manually:
 *   node scripts/build-consult-tx.mjs
 *
 * Run automatically: see .github/workflows/update-m365-data.yml (before
 * scripts/build-funnel.mjs, which reads this file's output)
 * ---------------------------------------------------------------
 */

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

// เดียวกับ build-raw-tx.mjs/build-or-sales.mjs/build-consult-pipeline.mjs — นิยามหัตถการเขียนใหม่ตามที่ผู้ใช้
// ยืนยัน 2026-11-04 (ดูคอมเมนต์ยาวที่ SURGERY_MAP ของ build-raw-tx.mjs สำหรับเหตุผลแต่ละรายการ) หัตถการที่ไม่เข้า
// เกณฑ์ 4 กลุ่มนี้ตกเป็น "other" โดยอัตโนมัติ (mapSurgery คืนค่า "other" เมื่อไม่เจอ key)
const SURGERY_MAP = {
  "nose open": "nose_open",
  "nose open (batten graft)": "nose_open",
  "เสริมจมูกโอเพ่น": "nose_open",
  "เสริมจมูกซี่โครง": "nose_open",

  "semi open": "nose_semi",
  "เสริมคาง": "nose_semi",
  "ตัดตกแต่งคาง": "nose_semi",
  "genioplasty": "nose_semi",
  "หัตถการปาก": "nose_semi",
  "ตกแต่งริมฝีปากบน": "nose_semi",
  "ตกแต่งปากริมฝีปากบน": "nose_semi",
  "ยกมุมปาก": "nose_semi", // เดิมอยู่ยกคิ้ว — ย้ายมากลุ่มปาก (Nose Semi Open) ตามนิยามใหม่ 2026-11-04
  "ปาก": "nose_semi",

  "brow lift": "brow_hairline",
  "ยกคิ้ว": "brow_hairline",
  "ดึงหน้า": "brow_hairline",
  "facelift": "brow_hairline",
  "เสริมหน้าผาก": "brow_hairline",
  "forehead": "brow_hairline",
  "ดูดไขมันใบหน้า": "brow_hairline",
  // กลุ่มหัตถการตาทั้งหมดย้ายมากลุ่มยกคิ้วตามนิยามใหม่ 2026-11-04
  "eye": "brow_hairline",
  "ตัดถุงใต้ตา": "brow_hairline",
  "เก็บหางตา": "brow_hairline",
  "ถุงใต้ตาแผลใน": "brow_hairline",
  "จัดเรียงไขมันใต้ตา": "brow_hairline",
  "เลื่อนไรผม": "brow_hairline",
  "subbrow lift": "brow_hairline",
  "ดึงขมับ": "brow_hairline",

  "breast": "breast_lipo",
  "ตัดหนังหน้าท้อง": "breast_lipo",
  "ดูดไขมัน": "breast_lipo",
  "ดูดไขมันหน้าท้อง": "breast_lipo",
  "full tummy": "breast_lipo",
  // "ฉีดไขมัน"/"เติมไขมัน" ไม่อยู่กลุ่ม Breast อีกต่อไป (Breast มีแค่ Breast/ตัดหนังหน้าท้อง/ดูดไขมัน) ตกเป็น "other"
};
function mapSurgery(raw) {
  return SURGERY_MAP[String(raw || "").trim().toLowerCase()] || "other";
}

function excelDate(s) {
  if (typeof s !== "number") return null;
  const dt = new Date(Math.round((s - 25569) * 86400 * 1000));
  return dt.toISOString().slice(0, 10);
}

function findCol(header, test) {
  return header.findIndex((h) => typeof h === "string" && test(h.trim()));
}

function main() {
  const m365Path = path.resolve("src/data/m365Raw.json");
  const m365 = JSON.parse(readFileSync(m365Path, "utf8"));
  const sheets = m365.workbooks?.data_s45_clinic;
  if (!sheets) {
    console.error('Could not find "data_s45_clinic" workbook in src/data/m365Raw.json.');
    process.exit(1);
  }
  const sheet = sheets["ปรึกษา 2026"];
  if (!sheet) {
    console.error('Sheet "ปรึกษา 2026" not found in src/data/m365Raw.json.');
    process.exit(1);
  }

  const header = sheet[0];
  const closeDateCol = findCol(header, (h) => h === "Date ปิด");
  const onlinePriceCol = findCol(header, (h) => h === "Online price");
  const surgeryCol = findCol(header, (h) => h.toLowerCase().startsWith("surgery"));

  const out = [];
  const skipped = [];
  const unmapped = new Set();
  for (const r of sheet.slice(1)) {
    if (!r.some((c) => c !== "" && c != null)) continue;
    const d = excelDate(r[closeDateCol]);
    if (!d) {
      skipped.push(r);
      continue;
    }
    const surgeryRaw = r[surgeryCol];
    const p = mapSurgery(surgeryRaw);
    if (p === "other" && surgeryRaw) unmapped.add(String(surgeryRaw).trim());
    const onl = typeof r[onlinePriceCol] === "number" ? r[onlinePriceCol] : 0;
    out.push({ d, p, onl });
  }
  out.sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0));

  if (unmapped.size > 0) {
    console.warn(`Surgery names bucketed into "other" (not in SURGERY_MAP): ${[...unmapped].join(", ")}`);
  }
  if (skipped.length > 0) {
    console.warn(`Skipped ${skipped.length} row(s) with no "Date ปิด":`);
    for (const r of skipped) console.warn("  ", JSON.stringify(r));
  }

  const outPath = path.resolve("src/data/consultTx.json");
  writeFileSync(outPath, JSON.stringify(out));
  console.log(`Wrote ${outPath} (${out.length} rows, ${skipped.length} skipped, ${unmapped.size} unmapped surgery name(s))`);
}

main();
