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
];

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
  for (const { key, driveId, itemId, sheets: sheetNames } of WORKBOOKS) {
    console.log(`Workbook "${key}":`);
    const sheets = {};
    for (const sheetName of sheetNames) {
      console.log(`  Fetching sheet "${sheetName}"...`);
      const values = await fetchSheetUsedRange(token, driveId, itemId, sheetName);
      sheets[sheetName] = values;
      console.log(`    ${values.length} rows`);
    }
    workbooks[key] = sheets;
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
