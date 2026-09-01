#!/usr/bin/env node
/**
 * build-or-sales.mjs
 * ---------------------------------------------------------------
 * Transforms the "ยอดORจริง+Forecast (พี่เปา)" sheet (src/data/m365Raw.json,
 * refreshed daily by scripts/fetch-m365-data.mjs) into src/data/orSales.json —
 * a daily "real OR closed" sales figure per doctor/procedure.
 *
 * This is the authoritative real-OR ledger the sales team ("พี่เปา") maintains
 * separately from "มัดจำ 2026" (RAW_TX's source) — one row per month+doctor+
 * procedure, with the case's value spread across day-of-month columns (1-31)
 * for the day(s) it actually closed. Comparing the two sources for July 2026
 * found this sheet totals ฿24,171,111 vs RAW_TX's ฿16,445,290 for the same
 * month — RAW_TX (มัดจำ 2026 sheet) is missing a large share of real closed-OR
 * sales, confirming the user's report that "ยอดขายรวมทุกช่องทาง" undercounts.
 * src/App.jsx now sums this file (via computeOrSalesForRange) instead of
 * RAW_TX's `tot` field for that metric, everywhere it's computed live
 * (non-July date ranges — July itself still uses the separately-validated
 * GRAND_TOTAL/CATEGORIES official figures, unchanged by this script).
 *
 * Row shape: [' ', เป้า, Forecast, ต้องทำเพิ่ม, เดือน, แพทย์, หัตถการ, จำนวนเคส,
 * "รวม (บาท)", <day 1>, <day 2>, ..., <day 31>] — "รวม (บาท)" was checked to
 * exactly equal the sum of the day columns for every row in the sheet (0
 * mismatches out of 256), so exploding the day columns loses no data.
 *
 * "จำนวนเคส" is this sheet's own authoritative case count per (month, doctor,
 * procedure) row — the source Inbox & Bad Lead's "จำนวนเคสที่ปิด OR" card
 * should use (per user request), NOT a count of non-empty day-columns: checked
 * against every row in the sheet, the day-column count matches "จำนวนเคส"
 * for only 238/246 rows (some cases split their value across fewer/more day
 * cells than the row's own case count, e.g. a part-payment on one day and the
 * rest on another for what's still a single case) — so it's aggregated
 * directly from "จำนวนเคส" itself, by month + procedure, into casesByMonth.
 * This has no daily granularity (the sheet doesn't record which day within
 * the month each case closed, only which doctor+procedure+month), so it's a
 * whole-month figure, not filterable to a partial-month date range.
 *
 * Doctor names get the same "หมอจิจ๊ะ" -> "หมอจิ๊จ๊ะ" normalization as
 * build-raw-tx.mjs (same typo appears in this sheet too). Surgery names map
 * onto the app's 4 known procedure categories (nose_open/nose_semi/
 * breast_lipo/brow_hairline) where there's a clear match; anything else
 * (Eye/Genioplasty/Forehead/etc.) buckets into "other" so it's still counted
 * in the all-procedures total, matching the "don't silently drop rows"
 * lesson from build-raw-tx.mjs's ตัดถุงใต้ตา incident. A handful of rows have
 * a stray Excel date serial in the "แพทย์" column instead of a name (visible
 * spreadsheet data-entry artifacts) — those fall back to "รอระบุ" like
 * build-raw-tx.mjs does for a blank doctor cell.
 *
 * Run manually:
 *   node scripts/build-or-sales.mjs
 *
 * Run automatically: see .github/workflows/update-m365-data.yml
 * ---------------------------------------------------------------
 */

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const YEAR = 2026;
const THAI_MONTHS = {
  "มกราคม": 1, "กุมภาพันธ์": 2, "มีนาคม": 3, "เมษายน": 4, "พฤษภาคม": 5, "มิถุนายน": 6,
  "กรกฎาคม": 7, "สิงหาคม": 8, "กันยายน": 9, "ตุลาคม": 10, "พฤศจิกายน": 11, "ธันวาคม": 12,
};

// เดียวกับ DOCTOR_NAME_ALIASES ใน build-raw-tx.mjs — ชื่อหมอสะกดต่างกันในชีตนี้เช่นกัน
const DOCTOR_NAME_ALIASES = { "หมอจิจ๊ะ": "หมอจิ๊จ๊ะ" };
function normalizeDoctorName(name) {
  return DOCTOR_NAME_ALIASES[name] || name;
}

const SURGERY_MAP = {
  "nose open": "nose_open",
  "nose open (batten graft)": "nose_open",
  "semi open": "nose_semi",
  "breast": "breast_lipo",
  "ดูดไขมัน": "breast_lipo",
  "ตัดหนังหน้าท้อง": "breast_lipo",
  "ฉีดไขมัน": "breast_lipo",
  "brow lift": "brow_hairline",
  "ยกมุมปาก": "brow_hairline",
  "ดึงหน้า": "brow_hairline",
  "facelift": "brow_hairline",
  "เลื่อนไรผม": "brow_hairline",
};

function findCol(header, test) {
  return header.findIndex((h) => typeof h === "string" && test(h.trim().toLowerCase()));
}

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function main() {
  const m365Path = path.resolve("src/data/m365Raw.json");
  const m365 = JSON.parse(readFileSync(m365Path, "utf8"));
  const sheets = m365.workbooks?.data_s45_clinic;
  if (!sheets) {
    console.error('Could not find "data_s45_clinic" workbook in src/data/m365Raw.json.');
    process.exit(1);
  }
  const sheet = sheets["ยอดORจริง+Forecast (พี่เปา)"];
  if (!sheet) {
    console.error('Sheet "ยอดORจริง+Forecast (พี่เปา)" not found in src/data/m365Raw.json.');
    process.exit(1);
  }

  const header = sheet[0];
  const monthCol = findCol(header, (h) => h === "เดือน");
  const doctorCol = findCol(header, (h) => h === "แพทย์");
  const surgeryCol = findCol(header, (h) => h === "หัตถการ");
  const casesCol = findCol(header, (h) => h === "จำนวนเคส");
  const totalCol = findCol(header, (h) => h.includes("รวม"));
  const firstDayCol = totalCol + 1; // คอลัมน์ถัดจาก "รวม (บาท)" คือวันที่ 1

  const entries = [];
  const casesByMonth = {}; // "2026-08" -> { nose_open, nose_semi, breast_lipo, brow_hairline, other, all }
  const unmappedSurgeries = new Set();
  let mismatchCount = 0;
  let skippedRows = 0;

  for (const r of sheet.slice(1)) {
    if (!r.some((c) => c !== "" && c != null)) continue;
    const monthName = r[monthCol];
    const month = THAI_MONTHS[monthName];
    const surgeryRaw = r[surgeryCol];
    if (!month || !surgeryRaw || surgeryRaw === "รวม") {
      skippedRows++;
      continue; // แถว "อัพเดท"/"รวม" หรือแถวว่าง ไม่ใช่ข้อมูลเคสจริง
    }
    const doctorRaw = r[doctorCol];
    const doctor = typeof doctorRaw === "string" && doctorRaw.trim() ? normalizeDoctorName(doctorRaw.trim()) : "รอระบุ";

    const surgeryKey = SURGERY_MAP[String(surgeryRaw).trim().toLowerCase()];
    if (!surgeryKey) unmappedSurgeries.add(String(surgeryRaw).trim());
    const proc = surgeryKey || "other";

    const monthIso = `${YEAR}-${String(month).padStart(2, "0")}`;
    const casesVal = r[casesCol];
    if (typeof casesVal === "number" && casesVal > 0) {
      const bucket = (casesByMonth[monthIso] ||= { nose_open: 0, nose_semi: 0, breast_lipo: 0, brow_hairline: 0, other: 0, all: 0 });
      bucket[proc] = (bucket[proc] || 0) + casesVal;
      bucket.all += casesVal;
    }

    const totalDays = daysInMonth(YEAR, month);
    let daySum = 0;
    for (let day = 1; day <= 31; day++) {
      const val = r[firstDayCol + day - 1];
      if (typeof val !== "number" || val === 0) continue;
      if (day > totalDays) continue; // วันที่เป็นไปไม่ได้สำหรับเดือนนั้น (เช่น 30 ก.พ.) ข้ามอย่างปลอดภัย
      daySum += val;
      const d = `${YEAR}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      entries.push({ d, doctor, proc, amount: val });
    }
    const total = r[totalCol];
    if (typeof total === "number" && Math.abs(daySum - total) > 1) mismatchCount++;
  }

  entries.sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0));

  if (unmappedSurgeries.size > 0) {
    console.warn(`Surgery names bucketed into "other" (not in SURGERY_MAP): ${[...unmappedSurgeries].join(", ")}`);
  }
  if (mismatchCount > 0) {
    console.warn(`${mismatchCount} row(s) where the day-column sum didn't match the sheet's own "รวม (บาท)" total.`);
  }

  const outPath = path.resolve("src/data/orSales.json");
  writeFileSync(
    outPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        source:
          'Generated by scripts/build-or-sales.mjs from the "ยอดORจริง+Forecast (พี่เปา)" sheet in ' +
          '"Data S45 Clinic (5).xlsx" — the sales team\'s real-OR-closed ledger, exploded from ' +
          "monthly per-doctor/procedure rows into daily entries via their day-of-month columns.",
        entries,
        casesByMonth,
      },
      null,
      2
    )
  );
  console.log(`Wrote ${outPath} (${entries.length} daily entries, ${skippedRows} rows skipped)`);
}

main();
