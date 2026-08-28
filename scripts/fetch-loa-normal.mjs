#!/usr/bin/env node
/**
 * fetch-loa-normal.mjs
 * ---------------------------------------------------------------
 * Pulls the LINE OA Broadcast "ปกติ" (normal) channel data — Open/Semi/
 * หน้าอก/ยกคิ้ว/แบรนด์ดิ้ง — from the Google Sheet "S45 - สรุปค่าใช้จ่ายให้บัญชี"
 * and writes it to src/data/loaNormalData.json.
 *
 * Why a separate script/file from build-loa.mjs + loaData.json: the LOA
 * "ปกติ" channel's real July/August source turned out to live in this
 * Google Sheet, not in the SharePoint "...After Care.xlsx" workbook that
 * fetch-m365-data.mjs/build-loa.mjs already pull (that workbook's "LOA-
 * กรกฎาคม"/"LOA- สิงหาคม" sheets are the Aftercare channel only — see the
 * caveat at the top of build-loa.mjs). Jan-Jun normal-channel data already
 * comes correctly from loaData.json (that workbook had both channels
 * combined through June), so this script only needs July onward.
 *
 * Auth: Google service account, JWT bearer flow (no OAuth consent screen
 * needed) — the service account must be shared on the Sheet as Viewer.
 *
 * Run manually:
 *   GOOGLE_SERVICE_ACCOUNT_KEY='{"client_email":...,"private_key":...}' node scripts/fetch-loa-normal.mjs
 *
 * Run automatically: see .github/workflows/update-m365-data.yml
 *
 * Store the service account's JSON key as a repo secret named
 * GOOGLE_SERVICE_ACCOUNT_KEY (Settings → Secrets and variables → Actions).
 * ---------------------------------------------------------------
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createSign } from "node:crypto";
import path from "node:path";

const SPREADSHEET_ID = "1vrX6lnDxeYDyllXSmYP00Ly594N57PH1I7wPZffxy_A"; // "S45 - สรุปค่าใช้จ่ายให้บัญชี"
const SERVICE_ACCOUNT_KEY_RAW = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

if (!SERVICE_ACCOUNT_KEY_RAW) {
  console.error("Missing GOOGLE_SERVICE_ACCOUNT_KEY environment variable.");
  process.exit(1);
}

const HEADER_TO_KEY = {
  "จมูก": "open",
  "Open": "open",
  "Semi": "semi",
  "หน้าอก": "breast",
  "ยกคิ้ว": "brow",
  "แบรนด์ดิ้ง": "branding",
  "Branding": "branding",
};

const THAI_MONTH_TO_NUM = {
  "มกราคม": "01",
  "กุมภาพันธ์": "02",
  "มีนาคม": "03",
  "เมษายน": "04",
  "พฤษภาคม": "05",
  "มิถุนายน": "06",
  "กรกฎาคม": "07",
  "สิงหาคม": "08",
  "กันยายน": "09",
  "ตุลาคม": "10",
  "พฤศจิกายน": "11",
  "ธันวาคม": "12",
};

// เอาเฉพาะเดือน ก.ค. 2569 เป็นต้นไป — ม.ค.-มิ.ย. มาจาก loaData.json (ไฟล์ SharePoint) อยู่แล้ว
const MIN_MONTH_ISO = "2026-07";

function base64url(buf) {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function getAccessToken(serviceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets.readonly",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };
  const signInput = `${base64url(Buffer.from(JSON.stringify(header)))}.${base64url(Buffer.from(JSON.stringify(claim)))}`;
  const signer = createSign("RSA-SHA256");
  signer.update(signInput);
  signer.end();
  const signature = signer.sign(serviceAccount.private_key);
  const jwt = `${signInput}.${base64url(signature)}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const json = await res.json();
  if (!json.access_token) throw new Error(`Failed to get Google access token: ${JSON.stringify(json)}`);
  return json.access_token;
}

async function listSheetTitles(accessToken) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}?fields=sheets.properties.title`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  const json = await res.json();
  if (json.error) throw new Error(`Sheets metadata error: ${json.error.message}`);
  return json.sheets.map((s) => s.properties.title);
}

async function fetchSheetValues(accessToken, title) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(title)}?valueRenderOption=UNFORMATTED_VALUE`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  const json = await res.json();
  if (json.error) throw new Error(`Sheets values error (${title}): ${json.error.message}`);
  return json.values || [];
}

// เหมือน parseSheet ใน build-loa.mjs — อ่านคอลัมน์จาก header row จริง ไม่ hardcode ตำแหน่ง
function parseSheet(sheet) {
  const header = sheet[0] || [];
  const hasDateCol = header[0] === "วันที่";
  const colOffset = hasDateCol ? 1 : 0;
  const categoryCols = [];
  for (let c = colOffset; c < header.length; c++) {
    const key = HEADER_TO_KEY[header[c]];
    if (key) categoryCols.push({ col: c, key });
  }

  const findRow = (label) => sheet.find((r) => r[0] === label);
  const reachRow = findRow("จำนวนบรอดแคสต์");
  const budgetRow = findRow("งบบรอดแคสต์");
  const budgetLeftRow = findRow("งบบลอดคงเหลือ");
  const quotaLeftRow = findRow("บลอดคงเหลือ");

  const categories = {};
  for (const { col, key } of categoryCols) {
    const reach = typeof reachRow?.[col] === "number" ? reachRow[col] : 0;
    const budgetUsed = typeof budgetRow?.[col] === "number" ? budgetRow[col] : 0;
    const budgetLeft = typeof budgetLeftRow?.[col] === "number" ? budgetLeftRow[col] : null;
    const quotaLeft = typeof quotaLeftRow?.[col] === "number" ? quotaLeftRow[col] : null;
    categories[key] = { broadcastReach: reach, budgetUsed, budgetLeft, quotaLeft };
  }
  return categories;
}

function mergeCategories(a, b) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const out = {};
  for (const key of keys) {
    const ca = a[key] || { broadcastReach: 0, budgetUsed: 0, budgetLeft: null, quotaLeft: null };
    const cb = b[key] || { broadcastReach: 0, budgetUsed: 0, budgetLeft: null, quotaLeft: null };
    out[key] = {
      broadcastReach: ca.broadcastReach + cb.broadcastReach,
      budgetUsed: ca.budgetUsed + cb.budgetUsed,
      budgetLeft: ca.budgetLeft == null && cb.budgetLeft == null ? null : (ca.budgetLeft || 0) + (cb.budgetLeft || 0),
      quotaLeft: ca.quotaLeft == null && cb.quotaLeft == null ? null : (ca.quotaLeft || 0) + (cb.quotaLeft || 0),
    };
  }
  return out;
}

async function main() {
  const serviceAccount = JSON.parse(SERVICE_ACCOUNT_KEY_RAW);
  const accessToken = await getAccessToken(serviceAccount);

  const titles = await listSheetTitles(accessToken);
  const loaTitles = titles.filter((t) => /^LOA-\s*/.test(t));

  // จัดกลุ่มชีตตามเดือน (อาจมีมากกว่า 1 ชีตต่อเดือน เช่น 2 บัญชีในเดือนเดียวกัน — รวมกัน)
  const titlesByMonth = {};
  for (const title of loaTitles) {
    const monthName = title.replace(/^LOA-\s*/, "").trim();
    const monthNum = THAI_MONTH_TO_NUM[monthName];
    if (!monthNum) {
      console.warn(`  ! ไม่รู้จักชื่อเดือน "${monthName}" จากชีต "${title}" — ข้าม`);
      continue;
    }
    const monthIso = `2026-${monthNum}`;
    if (monthIso < MIN_MONTH_ISO) continue; // ม.ค.-มิ.ย. ใช้ loaData.json (ไฟล์ SharePoint) อยู่แล้ว
    (titlesByMonth[monthIso] ||= []).push(title);
  }

  const outDir = path.resolve("src/data");
  const outPath = path.join(outDir, "loaNormalData.json");
  let existingMonths = {};
  try {
    const existing = JSON.parse(await readFile(outPath, "utf8"));
    existingMonths = existing.months || {};
  } catch {
    // ไฟล์ยังไม่มี (รันครั้งแรก)
  }

  const months = { ...existingMonths };
  for (const [monthIso, sheetTitles] of Object.entries(titlesByMonth)) {
    let merged = {};
    for (const title of sheetTitles) {
      const sheet = await fetchSheetValues(accessToken, title);
      merged = mergeCategories(merged, parseSheet(sheet));
    }
    months[monthIso] = merged;
    console.log(`${monthIso} (${sheetTitles.join(" + ")}):`, JSON.stringify(merged));
  }

  await mkdir(outDir, { recursive: true });
  await writeFile(
    outPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        source:
          "Generated by scripts/fetch-loa-normal.mjs (Google Sheets API, spreadsheet " +
          `${SPREADSHEET_ID} = \"S45 - สรุปค่าใช้จ่ายให้บัญชี\"). ` +
          "ครอบคลุมเฉพาะ ก.ค. 2569 เป็นต้นไป (ก่อนหน้านั้นใช้ src/data/loaData.json จากไฟล์ SharePoint " +
          '\"S45 - ยอดบลอดแคส LINE OA After Care.xlsx\" ซึ่งมีข้อมูลช่องปกติรวมอยู่ในชีตเดียวกันถึง มิ.ย. 2569). ' +
          "ถ้าเดือนไหนยังไม่มีชีต \"LOA- <เดือน>\" ในไฟล์ต้นฉบับ จะไม่ปรากฏใน months (ไม่ใช่ error).",
        months,
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
