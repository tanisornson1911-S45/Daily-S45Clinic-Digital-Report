#!/usr/bin/env node
/**
 * fetch-budget-allocate.mjs
 * ---------------------------------------------------------------
 * Pulls the real "Budget Allocate : <Month>" channel-mix totals (Facebook/
 * Line Broadcast/Line Ads/Google/TikTok) from the Google Sheet
 * "S45 - Budget Allocate" and writes them to src/data/channelMix.json.
 * This replaces the hand-typed CHANNEL_MIX constant in App.jsx (frozen on
 * July's numbers) as the source for the Overview page's "สัดส่วนงบโฆษณาแยก
 * ตามช่องทาง" chart.
 *
 * NOTE: this is a *different* file from the SharePoint "S45 - Budget
 * Allocate.xlsx" workbook fetch-m365-data.mjs's "budget_allocate" entry
 * pulls — that file turned out to be a stale/unrelated copy with no
 * current-month sheet. The real, actively-maintained file is this Google
 * Sheet (confirmed by the user via screenshot, tabs up to "September26").
 *
 * Auth: Google service account, JWT bearer flow (same as fetch-loa-normal.mjs)
 * — the sheet is shared "anyone with the link can edit" so no separate
 * per-file sharing step is needed for the service account.
 *
 * Sheet layout is inconsistent month to month (Oct25 splits Facebook into
 * K.Net/K.Ice/In House ad-account columns; Feb26 onward add a single
 * "งบที่ตั้งไว้" (budget set) column alongside "ใช้ไปแล้ว"/"%"/"งบที่เหลือ"
 * usage-tracking columns under the same merged "Facebook"/"Google" header).
 * Parsing is header-driven and forward-fills the merged top group header
 * (Facebook/Line Official Account/Google/TikTok) across its sub-columns,
 * then sums only the budget-allocation sub-columns per group (excluding
 * ใช้ไปแล้ว/งบที่เหลือ/% usage-tracking columns) — validated against the
 * July26 and August26 "Total" rows by hand: July -> Facebook 1,385,000 /
 * Line Broadcast 121,000 / Line Ads 53,000 / Google 180,000, exactly
 * matching the previous hand-typed CHANNEL_MIX constant.
 *
 * Only unambiguous single-tab-per-month sheets are pulled (e.g. "August26")
 * — months with multiple versioned tabs in the workbook (e.g. "Jan26(V.2)"
 * + "Jan26(V.3)", "Mar26" + "Mar26.2") are skipped rather than guessing
 * which version is authoritative; see MONTH_TAB_RE below.
 *
 * Run manually:
 *   GOOGLE_SERVICE_ACCOUNT_KEY='{"client_email":...,"private_key":...}' node scripts/fetch-budget-allocate.mjs
 *
 * Run automatically: see .github/workflows/update-m365-data.yml
 * ---------------------------------------------------------------
 */

import { writeFile, mkdir } from "node:fs/promises";
import { createSign } from "node:crypto";
import path from "node:path";

const SPREADSHEET_ID = "1epT2d0Iob8WJwmHMZPskDtxb7L-nGvZq1LTa5SBTlvY"; // "S45 - Budget Allocate"
const SERVICE_ACCOUNT_KEY_RAW = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

if (!SERVICE_ACCOUNT_KEY_RAW) {
  console.error("Missing GOOGLE_SERVICE_ACCOUNT_KEY environment variable.");
  process.exit(1);
}

const MONTH_NUM = {
  Oct: "10", October: "10",
  Nov: "11", November: "11",
  Dec: "12", December: "12",
  Jan: "01", January: "01",
  Feb: "02", February: "02",
  Mar: "03", March: "03",
  Apr: "04", April: "04",
  May: "05",
  Jun: "06", June: "06",
  Jul: "07", July: "07",
  Aug: "08", August: "08",
  Sep: "09", September: "09",
};
// เอาเฉพาะชีตที่ชื่อ "<เดือน><ปีย่อ 2 หลัก>" ตรงเป๊ะ ไม่มีหาง (V.2)/.2/ฯลฯ — เดือนที่มีหลายเวอร์ชัน
// (เช่น "Jan26(V.2)"+"Jan26(V.3)", "Mar26"+"Mar26.2") ข้ามไปเลย แทนที่จะเดาว่าเวอร์ชันไหนถูกต้อง
const MONTH_TAB_RE = new RegExp(`^(${Object.keys(MONTH_NUM).join("|")})(\\d{2})$`);

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
  // ห้ามส่งชื่อชีตเปล่าๆ เป็น range ตรงๆ — ถ้าชื่อชีตเป็นตัวอักษร+ตัวเลขล้วน (เช่น "Oct25") Sheets API จะตีความ
  // เป็นการอ้างอิงเซลล์ A1 (คอลัมน์ OCT แถว 25) แทนชื่อชีต ทำให้ error "exceeds grid limits" — ต้องระบุ range
  // เต็มแบบ "<ชื่อชีต>!A1:AC3000" ให้ชัดเจนไม่กำกวมเสมอ
  const range = `${title}!A1:AC3000`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(range)}?valueRenderOption=UNFORMATTED_VALUE`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  const json = await res.json();
  if (json.error) throw new Error(`Sheets values error (${title}): ${json.error.message}`);
  return json.values || [];
}

// คอลัมน์ย่อยที่เป็นแค่ตัวติดตามการใช้งบ (ไม่ใช่ตัวเลขงบที่จัดสรรจริง) — ต้องข้ามตอนรวมยอดต่อกลุ่ม
// (Facebook/Google/TikTok) ไม่งั้นยอดจะบวกเกิน (เช่น เอาทั้ง "งบที่ตั้งไว้" และ "ใช้ไปแล้ว"/"งบที่เหลือ" มารวมกัน)
const TRACKING_SUBHEADER_RE = /ใช้ไปแล้ว|เหลือ|^%$|Cost|\/day/;
const GROUP_SUM_HEADERS = new Set(["Facebook", "Google", "TikTok"]);

function parseBudgetSheet(sheet, title) {
  const labelCol = sheet.reduce((found, row, i) => (found !== -1 ? found : row.indexOf("หัตถการ") !== -1 ? row.indexOf("หัตถการ") : -1), -1);
  const topGroupRowIdx = sheet.findIndex((row) => row.includes("หัตถการ"));
  if (labelCol === -1 || topGroupRowIdx === -1) {
    console.warn(`  ! "${title}": ไม่พบแถวหัวตาราง ("หัตถการ") — ข้าม`);
    return null;
  }
  const subHeaderRow = sheet[topGroupRowIdx + 1] || [];
  const topGroupRow = sheet[topGroupRowIdx];
  const width = Math.max(topGroupRow.length, subHeaderRow.length);

  // Forward-fill แถวหัวกลุ่มบนสุด (Facebook/Line Official Account/Google/TikTok เป็นเซลล์ merge เดียวคร่อม
  // หลายคอลัมน์ — ตอน fetch ผ่าน values.get ค่าจะอยู่แค่คอลัมน์ซ้ายสุดของ merge เท่านั้น คอลัมน์อื่นว่างเปล่า)
  const colGroup = [];
  let current = "";
  for (let c = 0; c < width; c++) {
    const v = topGroupRow[c];
    if (typeof v === "string" && v.trim()) current = v.trim();
    colGroup[c] = current;
  }

  const totalRowIdx = sheet.findIndex((row, i) => i > topGroupRowIdx + 1 && String(row[labelCol] ?? "").trim() === "Total");
  if (totalRowIdx === -1) {
    console.warn(`  ! "${title}": ไม่พบแถว "Total" — ข้าม`);
    return null;
  }
  const totalRow = sheet[totalRowIdx];

  const sumGroup = (groupName) => {
    let sum = 0;
    for (let c = 0; c < width; c++) {
      if (colGroup[c] !== groupName) continue;
      const sub = String(subHeaderRow[c] ?? "").trim();
      if (TRACKING_SUBHEADER_RE.test(sub)) continue;
      const v = totalRow[c];
      if (typeof v === "number") sum += v;
    }
    return sum;
  };
  const findLeafCol = (subHeaderExact) => {
    const c = subHeaderRow.findIndex((v) => String(v ?? "").trim() === subHeaderExact);
    return c === -1 ? 0 : typeof totalRow[c] === "number" ? totalRow[c] : 0;
  };

  const facebook = sumGroup("Facebook");
  const google = sumGroup("Google");
  const tiktok = sumGroup("TikTok");
  const line_broadcast = findLeafCol("Line Broadcast");
  const line_ads = findLeafCol("Line Ads");
  const total = facebook + google + tiktok + line_broadcast + line_ads;

  return { facebook, line_broadcast, line_ads, google, tiktok, total };
}

// ผู้กรอกข้อมูลในชีตสะกดชื่อคุณหมอต่างจากที่ใช้ในที่อื่นของ dashboard — normalize ก่อนใช้
const DOCTOR_NAME_ALIASES = {
  "หมอไบท์": "หมอไบร์ท",
  "หมอจิจ๊ะ": "หมอจิ๊จ๊ะ",
};
// แถวย่อยใต้แต่ละหัตถการที่ไม่ใช่ชื่อคุณหมอจริง (งบรวม/เฉลี่ย/ไม่ระบุตัวบุคคล) — ข้ามตอนดึงรายชื่อคุณหมอ
const NON_DOCTOR_ROW_LABELS = new Set(["Awareness", "ไม่เเจ้งหมอ", "ไม่แจ้งหมอ", "รวมหมอ"]);
// บางหัตถการ (เช่น "เสริมจมูก Semi Open") มีแถวย่อยที่เป็นการแบ่งงบข้ามหัตถการ/แผนก (เช่น "Inter",
// "Nose Open", "ยกคิ้ว/เลื่อนไรผม", "หน้าอก") ปนอยู่กับแถวชื่อคุณหมอจริง — ชื่อคุณหมอทุกคนในชีตนี้มีคำว่า "หมอ"
// นำหน้าเสมอ จึงกรองแถวที่ไม่มีคำว่า "หมอ" ออกเพื่อไม่ให้ parser ทั่วไปดึงชื่อหัตถการ/แผนกอื่นมาปนเป็น
// "ชื่อคุณหมอ" ผิดๆ (ตรวจพบจริงจากการดึงข้อมูล September26 เมื่อ 2569-09-14)
function looksLikeDoctorName(name) {
  return name.includes("หมอ");
}
// "Inter" มีโครงสร้างซ้อน 3 ชั้น (Inter > หัตถการย่อย > คุณหมอ) ต่างจากหัตถการอื่นที่เป็น 2 ชั้น
// (หัตถการ > คุณหมอ) ตรงๆ — ข้ามไปเพื่อไม่ให้ parser ทั่วไปดึงชื่อหัตถการย่อยมาปนเป็น "ชื่อคุณหมอ" ผิดๆ
const SKIP_TOP_LEVEL_LABELS = new Set(["Inter", "Total"]);

// ดึงงบแยกรายคุณหมอของ "ทุกหัตถการ" (ยกเว้น Inter) จากชีต Budget Allocate — ใช้เป็นฐานข้อมูลของแผนปรับ
// งบประมาณบนหน้า Ads "แผนเพิ่มเติม Digital Team". โครงสร้างคอลัมน์ตรวจสอบจริงจากการ diagnostic-dump ชีต
// "September26" เมื่อ 2569-09-14 (แถว 9-50) — แถวระดับหัตถการบนสุดมีเลขในคอลัมน์ "Target" ส่วนแถวย่อยราย
// คุณหมอ (Target ว่าง) จะอยู่ถัดไปจนกว่าจะเจอแถวหัตถการบนสุดถัดไปหรือแถว "Total".
function parseAllProcedureDoctorBudgets(sheet, title) {
  const labelCol = sheet.reduce((found, row) => (found !== -1 ? found : row.indexOf("หัตถการ") !== -1 ? row.indexOf("หัตถการ") : -1), -1);
  const topGroupRowIdx = sheet.findIndex((row) => row.includes("หัตถการ"));
  if (labelCol === -1 || topGroupRowIdx === -1) return null;
  const topGroupRow = sheet[topGroupRowIdx];
  const subHeaderRow = sheet[topGroupRowIdx + 1] || [];
  const targetCol = topGroupRow.indexOf("Target");
  const totalRowIdx = sheet.findIndex((row, i) => i > topGroupRowIdx + 1 && String(row[labelCol] ?? "").trim() === "Total");
  if (targetCol === -1 || totalRowIdx === -1) return null;

  let currentGroup = "";
  const colGroup = [];
  for (let c = 0; c < topGroupRow.length; c++) {
    const v = topGroupRow[c];
    if (typeof v === "string" && v.trim()) currentGroup = v.trim();
    colGroup[c] = currentGroup;
  }
  const fbBudgetCol = subHeaderRow.findIndex((v, c) => colGroup[c] === "Facebook" && String(v ?? "").trim() === "งบที่ตั้งไว้");
  const lineBroadcastCol = subHeaderRow.findIndex((v, c) => colGroup[c] === "Line Official Account" && String(v ?? "").trim() === "Line Broadcast");
  const lineAdsCol = subHeaderRow.findIndex((v, c) => colGroup[c] === "Line Official Account" && String(v ?? "").trim() === "Line Ads");
  const googleCol = topGroupRow.indexOf("Google");
  const totalBudgetCol = topGroupRow.indexOf("รวมงบ");
  const currentSpendCol = topGroupRow.indexOf("งบที่ใช้ปัจจุบัน");
  const targetChatCol = topGroupRow.indexOf("เป้าเเชท");
  const actualChatCol = topGroupRow.indexOf("แชทปัจจุบัน");
  if ([fbBudgetCol, lineBroadcastCol, lineAdsCol, googleCol, totalBudgetCol, currentSpendCol, targetChatCol, actualChatCol].some((c) => c === -1)) {
    console.warn(`  ! "${title}": โครงสร้างคอลัมน์ของชีตไม่ตรงกับที่คาดไว้ — ข้ามการดึงงบรายหัตถการ/คุณหมอ`);
    return null;
  }

  const num = (v) => (typeof v === "number" ? v : 0);
  const totalRow = sheet[totalRowIdx];
  const grandTotal = num(totalRow[totalBudgetCol]);

  // หาแถวระดับหัตถการบนสุดทุกแถว (Target มีเลข, อยู่ระหว่างแถวหัวตารางกับแถว Total, ไม่ใช่ Inter/Total)
  const topLevelIdxs = [];
  for (let i = topGroupRowIdx + 1; i < totalRowIdx; i++) {
    const row = sheet[i];
    const label = String(row[labelCol] ?? "").trim();
    if (typeof row[targetCol] === "number" && !SKIP_TOP_LEVEL_LABELS.has(label)) topLevelIdxs.push(i);
  }

  const procedures = [];
  for (let k = 0; k < topLevelIdxs.length; k++) {
    const rowIdx = topLevelIdxs[k];
    const row = sheet[rowIdx];
    const label = String(row[labelCol] ?? "").trim();
    const subRowEnd = k + 1 < topLevelIdxs.length ? topLevelIdxs[k + 1] : totalRowIdx;

    const doctorsByName = {};
    for (let i = rowIdx + 1; i < subRowEnd; i++) {
      const subRow = sheet[i];
      const rawName = String(subRow[labelCol] ?? "").trim();
      if (!rawName || NON_DOCTOR_ROW_LABELS.has(rawName) || !looksLikeDoctorName(rawName)) continue;
      const budgetSet = num(subRow[fbBudgetCol]);
      if (budgetSet <= 0) continue; // ไม่มีงบตั้งไว้เดือนนี้ (เช่นหมอตี้ในเสริมจมูกโอเพ่น) — ไม่รวมในแผนปรับงบ
      const name = DOCTOR_NAME_ALIASES[rawName] || rawName;
      doctorsByName[name] = {
        name,
        budgetSet,
        currentSpend: num(subRow[currentSpendCol]),
        targetChat: num(subRow[targetChatCol]),
        actualChat: num(subRow[actualChatCol]),
      };
    }
    const doctors = Object.values(doctorsByName);
    if (doctors.length === 0) {
      console.warn(`  ! "${title}": หัตถการ "${label}" ไม่พบคุณหมอที่มีงบตั้งไว้ — ข้ามหัตถการนี้`);
      continue;
    }

    procedures.push({
      key: label,
      target: num(row[targetCol]),
      facebookBudgetTotal: num(row[fbBudgetCol]),
      lineBroadcast: num(row[lineBroadcastCol]),
      lineAds: num(row[lineAdsCol]),
      google: num(row[googleCol]),
      total: num(row[totalBudgetCol]),
      doctors,
    });
  }

  if (procedures.length === 0) {
    console.warn(`  ! "${title}": ไม่พบหัตถการที่ดึงงบรายคุณหมอได้เลย`);
    return null;
  }

  return { tabTitle: title, grandTotal, procedures };
}

async function main() {
  const serviceAccount = JSON.parse(SERVICE_ACCOUNT_KEY_RAW);
  const accessToken = await getAccessToken(serviceAccount);

  const titles = await listSheetTitles(accessToken);
  console.log(`Real worksheet list (${titles.length}): ${titles.join(", ")}`);

  const monthsSeen = {};
  const ambiguousMonths = new Set();
  for (const title of titles) {
    const m = MONTH_TAB_RE.exec(title);
    if (!m) continue;
    const monthIso = `20${m[2]}-${MONTH_NUM[m[1]]}`;
    if (monthsSeen[monthIso]) ambiguousMonths.add(monthIso);
    (monthsSeen[monthIso] ||= []).push(title);
  }

  const latestIso = Object.keys(monthsSeen).filter((iso) => !ambiguousMonths.has(iso)).sort().pop();

  const months = {};
  let procedureBudget = null;
  for (const [monthIso, tabTitles] of Object.entries(monthsSeen)) {
    if (ambiguousMonths.has(monthIso)) {
      console.warn(`  ! ${monthIso}: มีหลายชีต (${tabTitles.join(", ")}) — ไม่แน่ใจว่าอันไหนถูกต้อง ข้ามเดือนนี้`);
      continue;
    }
    const title = tabTitles[0];
    const sheet = await fetchSheetValues(accessToken, title);
    const parsed = parseBudgetSheet(sheet, title);
    if (!parsed) continue;
    months[monthIso] = parsed;
    console.log(`${monthIso} (${title}):`, JSON.stringify(parsed));

    if (monthIso === latestIso) {
      procedureBudget = parseAllProcedureDoctorBudgets(sheet, title);
      if (procedureBudget) {
        for (const proc of procedureBudget.procedures) {
          console.log(`  ${proc.key} per-doctor budget (${title}):`, JSON.stringify(proc.doctors));
        }
      }
    }
  }

  const outDir = path.resolve("src/data");
  await mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, "channelMix.json");
  await writeFile(
    outPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        source:
          "Generated by scripts/fetch-budget-allocate.mjs (Google Sheets API, spreadsheet " +
          `${SPREADSHEET_ID} = \"S45 - Budget Allocate\"). ` +
          "แต่ละเดือนคือแถว \"Total\" ของชีต \"<เดือน><ปีย่อ>\" นั้นๆ — เดือนที่มีหลายเวอร์ชันชีต (ไม่แน่ใจว่าอันไหน " +
          "ถูกต้อง) จะไม่ปรากฏใน months.",
        months,
      },
      null,
      2
    )
  );
  console.log(`\nWrote ${outPath}`);

  if (procedureBudget) {
    const procedureOutPath = path.join(outDir, "procedureBudget.json");
    const proceduresByKey = {};
    for (const proc of procedureBudget.procedures) {
      proceduresByKey[proc.key] = { ...proc, otherProceduresTotal: procedureBudget.grandTotal - proc.total };
    }
    await writeFile(
      procedureOutPath,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          source:
            "Generated by scripts/fetch-budget-allocate.mjs — งบแยกรายคุณหมอของทุกหัตถการ (ยกเว้น Inter ซึ่งมี " +
            `โครงสร้างซ้อน 3 ชั้นต่างจากหัตถการอื่น) ของเดือนล่าสุด (${procedureBudget.tabTitle}) จากชีต ` +
            "\"S45 - Budget Allocate\". ใช้เป็นฐานข้อมูลของ \"แผนปรับงบประมาณ\" บนหน้า Ads — แถวคุณหมอที่งบเป็น 0 " +
            "เดือนนี้ (เช่นหมอตี้ในเสริมจมูกโอเพ่น) และแถวไม่ใช่คุณหมอ (Awareness ฯลฯ) ไม่รวมอยู่ในแผนนี้. " +
            "otherProceduresTotal ต่อหัตถการ = งบรวมทุกหัตถการ (grandTotal) ลบงบของหัตถการนั้นเอง.",
          month: latestIso,
          tabTitle: procedureBudget.tabTitle,
          grandTotal: procedureBudget.grandTotal,
          procedures: proceduresByKey,
        },
        null,
        2
      )
    );
    console.log(`Wrote ${procedureOutPath}`);
  } else {
    console.warn("  ! ไม่สามารถดึงงบรายคุณหมอของเดือนล่าสุดได้ — จะไม่เขียน procedureBudget.json (ใช้ไฟล์เดิมถ้ามี)");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
