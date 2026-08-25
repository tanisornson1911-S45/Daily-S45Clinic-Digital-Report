#!/usr/bin/env node
/**
 * fetch-m365-data.mjs
 * ---------------------------------------------------------------
 * Pulls raw rows from the "Data S45 Clinic (5).xlsx" workbook
 * (live-maintained master file on SharePoint/OneDrive) via the
 * Microsoft Graph Excel API and writes them to src/data/m365Raw.json.
 *
 * This is a STAGING pull only — it writes the raw sheet rows as-is.
 * It is intentionally NOT wired into RAW_TX / MONTHLY_DATA in App.jsx
 * yet. Turning these rows into the numbers the dashboard actually
 * calculates from needs a field-by-field mapping + validation pass
 * against known-correct totals (the same way every other data change
 * in this dashboard has been verified before shipping), because this
 * workbook's sheets are forecast/tracking tables, not a 1:1 match for
 * RAW_TX's per-case shape (d/or/ch/p/doc/dep/onl/tot).
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

// "Data S45 Clinic (5).xlsx" — personal/sales_sup_s45clinic_com/Documents/Desktop/
// (drive + item IDs located via SharePoint search on 2026-08-25)
const DRIVE_ID = "b!EzzI__YZKkOT4A8owKgx9plShVOjW0VJq7Ee489Af4_1GTH3bJdHTYtt0_IUxba2";
const ITEM_ID = "01LCP4JOM2VG676DMNTZA33WKVSVTZLJS5";

// The 3 sheets that hold real (not just planning) transaction/OR data.
const SHEETS = [
  "ปรึกษา 2026",
  "ยอดORจริง+Forecast (พี่เปา)",
  "Forecast OR ยอดออนไลน์ 2026",
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

async function fetchSheetUsedRange(token, sheetName) {
  const encodedSheet = encodeURIComponent(sheetName);
  const url = `https://graph.microsoft.com/v1.0/drives/${DRIVE_ID}/items/${ITEM_ID}/workbook/worksheets('${encodedSheet}')/usedRange(valuesOnly=true)`;
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

  const sheets = {};
  for (const sheetName of SHEETS) {
    console.log(`Fetching sheet "${sheetName}"...`);
    const values = await fetchSheetUsedRange(token, sheetName);
    sheets[sheetName] = values;
    console.log(`  ${values.length} rows`);
  }

  const outDir = path.resolve("src/data");
  await mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, "m365Raw.json");
  await writeFile(
    outPath,
    JSON.stringify({ generatedAt: new Date().toISOString(), sheets }, null, 2)
  );
  console.log(`\nWrote ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
