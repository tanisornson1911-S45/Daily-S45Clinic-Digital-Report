#!/usr/bin/env node
/**
 * build-inter.mjs
 * ---------------------------------------------------------------
 * Transforms the "Inter S45 2026 - Sale part" per-month case-ledger sheets
 * (src/data/m365Raw.json, refreshed daily by scripts/fetch-m365-data.mjs)
 * into src/data/interSale.json — one row per Inter (international patient)
 * case/line-item, date-range filterable in App.jsx the same way RAW_TX is.
 *
 * Replaces the old hand-typed INTER_BY_DOCTOR_MONTH, which only ever had
 * two months (jun26/jul26) entered once and never updated — any other
 * month/date-range picked on the dashboard showed "ไม่มีข้อมูล" even
 * though the source workbook has been fetched automatically every night
 * all along (it just wasn't wired into anything). NOTE: there is no
 * "June 06" sheet in the actual workbook (only Jan/Feb/March/April/May/
 * July/August exist) — App.jsx keeps the old jun26 static object as a
 * fallback specifically for June since there's no source to regenerate it
 * from; every other month comes from this script.
 *
 * Sheet layout: header row 0, one row per case/line-item. A patient with
 * multiple procedures (e.g. Nose Open + Breast in the same visit) gets one
 * row per procedure — later rows leave HN/Date blank (spreadsheet-style
 * "same as row above"), so this script forward-fills the date from the
 * last row that had one. Column names vary slightly month to month
 * ("Medical check up\nEtc." / "Medical check up +etc" / "Medical chech up"
 * typo / plain "Medical check up", "Date" vs "Date OR") — resolved by
 * fuzzy header matching (findCol) instead of fixed indices.
 *
 * deposit = Online price + Medical check up/Etc. column (NOT Top up)
 * total = the Total column, as-is — same formula the old hand-typed
 * INTER_BY_DOCTOR_MONTH used (see its comment in App.jsx).
 *
 * Doctor codes (TY/BOY/BIG/PED/PEK/NORN/TERNG/ROSE/CHE/TUNE/BRITE/JIJA/...)
 * are kept as their own opaque buckets — deliberately NOT mapped onto the
 * Thai-named doctor roster used elsewhere in the app (RAW_TX, doctor-hero
 * posts). The original hand-typed INTER_DOCTOR_LABELS already treated e.g.
 * "BOY"/"PEK" as generic "หมอ Boy"/"หมอ Pek" labels rather than the Thai
 * "หมอบอย"/"หมอเป๊ก" spelling used in RAW_TX, so this keeps that existing
 * convention instead of guessing whether they're the same person — App.jsx
 * merges any new code into INTER_DOCTOR_LABELS automatically as "หมอ
 * <CODE>", no per-code mapping needed here.
 *
 * Surgery names map onto INTER_PROC_LABELS' existing categories where
 * there's a clear match (OPEN RHINO -> nose_open, Breast Augmentation ->
 * breast, ...); anything else (Filler/Forehead/Eye/Fat transfer/Lips)
 * buckets into "other" rather than being silently dropped (see the
 * "ตัดถุงใต้ตา" incident in build-raw-tx.mjs's history for why dropping
 * unmapped rows is the wrong default).
 *
 * Run manually:
 *   node scripts/build-inter.mjs
 *
 * Run automatically: see .github/workflows/update-m365-data.yml
 * ---------------------------------------------------------------
 */

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

// ชื่อชีต -> เดือน ISO (ตรงกับ sheets ที่ fetch-m365-data.mjs ระบุไว้ให้ workbook นี้)
const SHEET_MONTH = {
  "Jan 01": "2026-01",
  "Feb02": "2026-02",
  "March 03": "2026-03",
  "April 04": "2026-04",
  "May 05": "2026-05",
  "June 06": "2026-06", // ไม่เคยเจอจริงในไฟล์ (ดูคอมเมนต์ด้านบน) แต่เผื่อไว้เผื่อมีคนสร้างชีตนี้ในอนาคต
  "July 07": "2026-07",
  "August 08": "2026-08",
};

const SURGERY_MAP = {
  "nose open": "nose_open",
  "open rhino": "nose_open",
  "semi open": "nose_semi",
  breast: "breast",
  "breast augmentation": "breast",
  endotine: "endotine",
  "etc.": "etc",
  etc: "etc",
  "brow lift": "brow_lift",
  "lipo (face)": "lipo_face",
};

function findCol(header, test) {
  return header.findIndex((h) => typeof h === "string" && test(h.trim().toLowerCase()));
}

function excelDate(s) {
  const dt = new Date(Math.round((s - 25569) * 86400 * 1000));
  return dt.toISOString().slice(0, 10);
}

// รองรับทั้ง Excel serial number และสตริงรูปแบบ D/M/YYYY (แบบไทย วันขึ้นก่อน) ที่เจอในชีต — คัดปีที่ผิดเพี้ยน
// ชัดเจนออก (เช่น "31/1/1969" ในชีต Jan 01 ซึ่งเป็นรอยกรอกผิดที่มองเห็นได้ชัดเมื่อเทียบกับชื่อชีต/แถวข้างเคียง — ทั้ง
// รูปแบบสตริงตรงๆ และ Excel serial ของวันที่นั้น ต้องเช็คช่วงปีทั้งคู่ ไม่ใช่แค่ตอน parse จากสตริง)
function parseInterDate(raw) {
  let iso = null;
  if (typeof raw === "number") iso = excelDate(raw);
  else if (typeof raw === "string") {
    const m = raw.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) {
      const [, d, mo, y] = m;
      iso = `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
  }
  if (!iso) return null;
  const yearNum = Number(iso.slice(0, 4));
  if (yearNum < 2025 || yearNum > 2027) return null;
  return iso;
}

function main() {
  const m365Path = path.resolve("src/data/m365Raw.json");
  const m365 = JSON.parse(readFileSync(m365Path, "utf8"));
  const wb = m365.workbooks?.inter_sale_part;
  if (!wb) {
    console.error('Could not find "inter_sale_part" workbook in src/data/m365Raw.json.');
    process.exit(1);
  }

  const cases = [];
  const doctorLabels = {};
  const unmappedSurgeries = new Set();
  const skipped = [];

  for (const [sheetName, monthIso] of Object.entries(SHEET_MONTH)) {
    const sheet = wb[sheetName];
    if (!sheet || sheet.length < 2) continue; // ชีตนี้ไม่มีในไฟล์ตอนนี้ (เช่น June) — ข้ามเงียบๆ
    const header = sheet[0];
    const dateCol = findCol(header, (h) => h.includes("date"));
    const doctorCol = findCol(header, (h) => h === "doctor");
    const surgeryCol = findCol(header, (h) => h === "surgery");
    const onlineCol = findCol(header, (h) => h === "online price");
    const medicalCol = findCol(header, (h) => h.includes("medical"));
    const totalCol = findCol(header, (h) => h === "total");
    if (doctorCol < 0 || surgeryCol < 0 || totalCol < 0) {
      console.warn(`  ! Sheet "${sheetName}": couldn't find Doctor/Surgery/Total columns — skipping sheet.`);
      continue;
    }

    let lastDate = `${monthIso}-01`; // fallback ถ้าแถวแรกๆ ของชีตไม่มีวันที่ระบุเลย
    for (const r of sheet.slice(1)) {
      if (!r.some((c) => c !== "" && c != null)) continue; // แถวว่างล้วน
      const rawDate = dateCol >= 0 ? r[dateCol] : null;
      const parsedDate = parseInterDate(rawDate);
      if (parsedDate) lastDate = parsedDate; // มีวันที่ระบุ -> ใช้และจำไว้ใช้กับแถวถัดไปที่ว่าง (เคสเดียวกัน หลายหัตถการ)

      const doctorRaw = r[doctorCol];
      const surgeryRaw = r[surgeryCol];
      const total = r[totalCol];
      if (!doctorRaw || !surgeryRaw || typeof total !== "number") continue; // แถวสรุป/ว่าง ไม่ใช่เคสจริง

      const doctorCode = String(doctorRaw).trim().toLowerCase();
      if (!doctorLabels[doctorCode]) doctorLabels[doctorCode] = String(doctorRaw).trim().toUpperCase();

      const surgeryKey = SURGERY_MAP[String(surgeryRaw).trim().toLowerCase()];
      if (!surgeryKey) unmappedSurgeries.add(String(surgeryRaw).trim());
      const proc = surgeryKey || "other";

      const online = typeof r[onlineCol] === "number" ? r[onlineCol] : 0;
      const medical = medicalCol >= 0 && typeof r[medicalCol] === "number" ? r[medicalCol] : 0;
      const deposit = online + medical;

      cases.push({ d: lastDate, doctor: doctorCode, proc, deposit, total });
    }
  }

  cases.sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0));

  if (unmappedSurgeries.size > 0) {
    console.warn(`Surgery names bucketed into "other" (not in SURGERY_MAP): ${[...unmappedSurgeries].join(", ")}`);
  }

  const outPath = path.resolve("src/data/interSale.json");
  writeFileSync(
    outPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        source:
          'Generated by scripts/build-inter.mjs from the "Inter S45 2026 - Sale part.xlsx" SharePoint workbook ' +
          "(per-case ledger, one sheet per month). No June sheet exists in the source file — App.jsx keeps the " +
          "old hand-verified jun26 static totals for that month specifically.",
        doctorLabels,
        cases,
      },
      null,
      2
    )
  );
  console.log(`Wrote ${outPath} (${cases.length} case rows, ${Object.keys(doctorLabels).length} doctor codes)`);
}

main();
