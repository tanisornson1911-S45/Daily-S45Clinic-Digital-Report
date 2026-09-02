#!/usr/bin/env node
/**
 * fetch-m365-data.mjs
 * ---------------------------------------------------------------
 * Pulls raw rows from the "Data S45 Clinic (5).xlsx" and
 * "Inter S45 2026 - Sale part.xlsx" workbooks (live-maintained master
 * files on SharePoint/OneDrive) via the Microsoft Graph Excel API and
 * writes them to src/data/m365Raw.json.
 *
 * This is a raw staging pull — scripts/build-raw-tx.mjs (run right
 * after this, see .github/workflows/update-m365-data.yml) is what
 * turns the "มัดจำ 2026" sheet into src/data/rawTx.json, which
 * src/App.jsx imports as RAW_TX. The Inter Sale Part workbook is
 * pulled for reconciliation/reference but is not currently mapped
 * into the dashboard (see App.jsx comments near CATEGORIES/GRAND_TOTAL
 * for why — most Inter cases are already recorded in "มัดจำ 2026").
 *
 * Auth: Azure AD app registration, client-credentials (app-only) flow
 * with the Files.Read.All Application permission + admin consent.
 *
 * Run manually:
 *   MS_TENANT_ID=xxx MS_CLIENT_ID=xxx MS_CLIENT_SECRET=xxx node scripts/fetch-m365-data.mjs
 *
 * Run automatically: see .github/workflows/update-m365-data.yml
 *
 * Store the 3 values as repo secrets in GitHub (Settings → Secrets and
 * variables → Actions → New repository secret): MS_TENANT_ID,
 * MS_CLIENT_ID, MS_CLIENT_SECRET.
 * ---------------------------------------------------------------
 */

import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const TENANT_ID = process.env.MS_TENANT_ID;
const CLIENT_ID = process.env.MS_CLIENT_ID;
const CLIENT_SECRET = process.env.MS_CLIENT_SECRET;

if (!TENANT_ID || !CLIENT_ID || !CLIENT_SECRET) {
  console.error("Missing MS_TENANT_ID / MS_CLIENT_ID / MS_CLIENT_SECRET environment variable(s).");
  process.exit(1);
}

// Workbooks + the sheets in each that hold real (not just planning) data.
// Drive/item IDs located via SharePoint search.
const WORKBOOKS = [
  {
    key: "data_s45_clinic",
    // "Data S45 Clinic (5).xlsx" — personal/sales_sup_s45clinic_com/Documents/Desktop/ (2026-08-25)
    driveId: "b!EzzI__YZKkOT4A8owKgx9plShVOjW0VJq7Ee489Af4_1GTH3bJdHTYtt0_IUxba2",
    itemId: "01LCP4JOM2VG676DMNTZA33WKVSVTZLJS5",
    sheets: [
      "มัดจำ 2026",
      "ปรึกษา 2026",
      "ยอดORจริง+Forecast (พี่เปา)",
      "Forecast OR ยอดออนไลน์ 2026",
    ],
  },
  {
    key: "inter_sale_part",
    // "Inter S45 2026 - Sale part.xlsx" — personal/marketinginter_s45clinic_com/Documents/ (2026-08-25)
    // Per-case Inter (international patient) ledger, one sheet per month, with its own
    // Online price / Total price columns — the authoritative source for Inter's sales
    // figures. Many of the same cases also appear in "มัดจำ 2026" (same patient, tracked
    // by the general sales-ops team too) — see App.jsx comments near CATEGORIES/RAW_TX
    // for how those are de-duplicated.
    driveId: "b!UYH87cOq2UqumY8MIpZRT6PLpRROcdpBpT3eeYIb3NJC5-zjt4pTQ6CIgsAcPJdX",
    itemId: "01HRTVWCEESO57GCA255BYTDGHN5JQ5KDI",
    sheets: ["Jan 01", "Feb02", "March 03", "April 04", "May 05", "June 06", "July 07", "August 08"],
  },
  {
    key: "online_sales_daily",
    // "ยอดขาย Online S45 Clinic.xlsx" — same drive as "Data S45 Clinic (5).xlsx"
    // (personal/sales_sup_s45clinic_com/Documents/Desktop/, 2026-08-25). Per-month sheet
    // named "<เดือนย่อ>.69" (e.g. "ส.ค.69" = สิงหาคม 2569/Aug 2026) holding the daily
    // Ads/Inbox rows per procedure category that FUNNEL_DATA/FUNNEL_DATA_JUL in App.jsx
    // were originally hand-typed from. Sheet-name guesses for months without a sheet yet
    // are skipped gracefully (see the try/catch below) — only fetch what actually exists.
    driveId: "b!EzzI__YZKkOT4A8owKgx9plShVOjW0VJq7Ee489Af4_1GTH3bJdHTYtt0_IUxba2",
    itemId: "01LCP4JOJGDXP4EFAZNVD22P2GZY4UPDHG",
    sheets: ["ม.ค.69", "ก.พ.69", "มี.ค.69", "เม.ย.69", "พ.ค.69", "มิ.ย.69", "ก.ค.69", "ส.ค.69"],
  },
  {
    key: "loa_broadcast",
    // "S45 - ยอดบลอดแคส LINE OA After Care.xlsx" — personal/digital_mkt_s45clinic_com/Documents/ (2026-08-25)
    // Daily LINE OA broadcast reach per procedure category, one "LOA- <month>" sheet per
    // month (column layout varies by month — some months split Open/Semi/หน้าอก/ยกคิ้ว/
    // แบรนด์ดิ้ง, earlier months only have จมูก/หน้าอก/ยกคิ้ว). This is a raw staging pull
    // only for now — turning it into LOA_JUNE/LOA_JUL_NORMAL-shaped data (broadcastReach/
    // budgetUsed/budgetLeft/quotaLeft/timesLeft) needs a per-month column-mapping transform
    // that hasn't been written yet (see the "connect every section" audit in the PR that
    // added this workbook). "Summary" has month-over-month rollups including Inbox by doctor.
    driveId: "b!xxDvakZnBUOmKljZWLuYZ9g177OXvLtHthxJClpsEqA5xrnAHB8PRI3WaLvrDur8",
    itemId: "01JXWUHPAC7HVGV4MFYJDYUVKEHAQZRYME",
    sheets: [
      "Summary",
      "LOA- มกราคม",
      "LOA- กุมภาพันธ์",
      "LOA- มีนาคม",
      "LOA- เมษายน",
      "LOA- พฤษภาคม",
      "LOA- มิถุนายน",
      "LOA- กรกฎาคม",
      "LOA- สิงหาคม",
    ],
  },
];

// ไฟล์ CSV ธรรมดา (ไม่ใช่ Excel workbook) — ดึงผ่าน Graph "/content" (โหลดไฟล์ดิบ) แทน
// "/workbook/worksheets" ที่ใช้กับ WORKBOOKS ด้านบน แล้ว parse เป็น 2D array รูปแบบเดียวกับที่ sheet
// จาก Excel คืนมา (row 0 = header) เพื่อให้ build script ฝั่งปลายทางใช้ร่วมกับโค้ดเดิมได้โดยไม่ต้องแก้เยอะ
const CSV_SOURCES = [
  {
    key: "lead_plus_connect",
    // "[Lead] Plus Connect.csv" — personal/digital_mkt_s45clinic_com/Documents/ (2026-09-02)
    // Export "Contacts" เต็มจาก Plus Connect (ทุก contact บนเพจ ไม่ใช่แค่ที่ติดแท็ก Bad Lead) — แทนที่
    // "Bad Lead [Plus Connect].xlsx" เดิมซึ่งพบว่าเป็นไฟล์ที่กรองมาแล้วและตกหล่นบางแถว ผู้ใช้ยืนยันให้ใช้ไฟล์นี้
    // แทน — scripts/build-bad-lead.mjs กรองเหลือเฉพาะแถวที่ติดแท็ก "คุณสมบัติไม่ครบ" เอง (เหมือนที่
    // scripts/import-bad-lead-csv.mjs ทำกับไฟล์ CSV ตัวอย่างที่ผู้ใช้ส่งมาก่อนหน้านี้) คอลัมน์เดียวกันทุก
    // ประการกับไฟล์เดิม (created_at, platform, channel_name, tags, assignees, blocked, ฯลฯ) บวกคอลัมน์ PII
    // ที่ build-bad-lead.mjs ทิ้งอยู่แล้วเหมือนเดิม
    driveId: "b!xxDvakZnBUOmKljZWLuYZ9g177OXvLtHthxJClpsEqA5xrnAHB8PRI3WaLvrDur8",
    itemId: "01JXWUHPB7EVK3IYCQMZD3VSCB562DMNRD",
    sheetLabel: "Sheet1", // ชื่อ virtual "sheet" ให้ตรงกับที่ workbooks.bad_lead_plus_connect.Sheet1 เคยใช้
  },
];

// RFC4180-ish CSV parser (รองรับฟิลด์ quoted ที่มี comma/quote/newline ข้างในได้ — คอลัมน์ "contactslink"/
// "page_configs" ของไฟล์นี้เป็น JSON ที่มี comma อยู่ในเครื่องหมายคำพูด ถ้า split(",") ตรงๆ แถวจะพังหมด)
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  const n = text.length;
  while (i < n) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === ",") {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (c === "\r") {
      i++;
      continue;
    }
    if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
      continue;
    }
    field += c;
    i++;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

async function fetchCsvFileAsRows(token, driveId, itemId) {
  const url = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}/content`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    throw new Error(`CSV content fetch failed: ${res.status} ${await res.text()}`);
  }
  const text = (await res.text()).replace(/^﻿/, ""); // strip BOM
  return parseCsv(text);
}

async function getAccessToken() {
  const url = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`Token request failed: ${json.error_description || json.error}`);
  }
  return json.access_token;
}

async function listWorksheetNames(token, driveId, itemId) {
  const url = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}/workbook/worksheets?$select=name,position`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`Worksheet list fetch failed: ${json.error?.message || res.status}`);
  }
  return json.value.sort((a, b) => a.position - b.position).map((w) => w.name);
}

async function fetchSheetUsedRange(token, driveId, itemId, sheetName) {
  const encodedSheet = encodeURIComponent(sheetName);
  const url = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}/workbook/worksheets('${encodedSheet}')/usedRange(valuesOnly=true)`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`Sheet "${sheetName}" fetch failed: ${json.error?.message || res.status}`);
  }
  return json.values; // 2D array of raw cell values, row 0 = header
}

async function main() {
  console.log("Authenticating with Microsoft Graph...");
  const token = await getAccessToken();

  const workbooks = {};
  for (const { key, driveId, itemId, sheets: sheetsSpec } of WORKBOOKS) {
    console.log(`Workbook "${key}":`);
    let sheetNames = sheetsSpec;
    if (sheetsSpec === "auto") {
      sheetNames = await listWorksheetNames(token, driveId, itemId);
      console.log(`  Real worksheet list: ${sheetNames.join(", ")}`);
    }
    const sheets = {};
    for (const sheetName of sheetNames) {
      console.log(`  Fetching sheet "${sheetName}"...`);
      try {
        const values = await fetchSheetUsedRange(token, driveId, itemId, sheetName);
        sheets[sheetName] = values;
        console.log(`    ${values.length} rows`);
      } catch (err) {
        // A sheet that's missing/renamed/not-yet-created (e.g. next month's LOA sheet
        // before anyone has added it) shouldn't take down the whole pipeline — skip it
        // and keep going so "มัดจำ 2026" (RAW_TX's source) still gets fetched.
        console.warn(`    ! Skipping "${sheetName}": ${err.message}`);
      }
    }
    workbooks[key] = sheets;
  }

  for (const { key, driveId, itemId, sheetLabel } of CSV_SOURCES) {
    console.log(`CSV "${key}":`);
    try {
      const values = await fetchCsvFileAsRows(token, driveId, itemId);
      workbooks[key] = { [sheetLabel]: values };
      console.log(`  ${values.length} rows`);
    } catch (err) {
      console.warn(`  ! Skipping "${key}": ${err.message}`);
    }
  }

  const outDir = path.resolve("src/data");
  await mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, "m365Raw.json");
  await writeFile(
    outPath,
    JSON.stringify({ generatedAt: new Date().toISOString(), workbooks }, null, 2)
  );
  console.log(`\nWrote ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
