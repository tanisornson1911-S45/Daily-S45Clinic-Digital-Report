#!/usr/bin/env node
/**
 * send-line-report.mjs
 * ---------------------------------------------------------------
 * Builds the daily "Digital Report" text (same format the team used to type
 * by hand into LINE OA every evening) from the dashboard's own data files +
 * one small manually-filled Google Sheet, then sends it via the LINE
 * Messaging API.
 *
 * Field sources (confirmed against real data with the user on 2026-10-08):
 *   - Budget            = this month's grandTotal (src/data/procedureBudget.json)
 *                          ÷ days in month — i.e. today's pacing budget.
 *   - Ads Spend          = this month's "total" so far (src/data/adSpend.json,
 *                          refreshed nightly by fetch-fb-spend.mjs).
 *   - Inbox /เดือน (เป้า) = 9,600 — same hardcoded monthly target already shown
 *                          on the Ads Plan page in App.jsx.
 *   - Inbox /เดือน (จริง) = sum of dailyInbox across every category this month
 *                          so far (src/data/adDaily.json).
 *   - CPR                = Ads Spend ÷ Inbox จริง (both MTD, this month).
 *   - Monitor Ads         = src/data/campaignSnapshot.json's diff, written by
 *                          scripts/fetch-fb-campaign-snapshot.mjs (run right
 *                          before this script — see the workflow).
 *   - งบประมาณของ Digital (ตามแผน/เกิน/ต่ำกว่าแผน) = per-category MTD spend
 *                          (adSpend.json) vs. that category's Facebook budget
 *                          (procedureBudget.json facebookBudgetTotal) prorated
 *                          to today's day-of-month; ±15% = "ตามแผน".
 *   - Ads Revenue, ROAS เป้า/จริง, Target Lead %, Persona Check = NOT
 *                          computable from this dashboard's data (confirmed
 *                          with the user 2026-10-08 — these are numbers the
 *                          team tracks from another source) — read from the
 *                          "S45 - LINE Report Manual Input" Google Sheet's
 *                          last filled-in row instead (same service-account
 *                          JWT auth as fetch-budget-allocate.mjs).
 *
 * Run manually (test push to yourself):
 *   FB_ACCESS_TOKEN=... GOOGLE_SERVICE_ACCOUNT_KEY='{...}' LINE_CHANNEL_ACCESS_TOKEN=... \
 *   LINE_SEND_MODE=test LINE_TEST_USER_ID=U... node scripts/send-line-report.mjs
 *
 * Run automatically: see .github/workflows/send-line-report.yml (defaults to
 * LINE_SEND_MODE=test until the team confirms the report looks right, then
 * flip the workflow's env to LINE_SEND_MODE=broadcast).
 * ---------------------------------------------------------------
 */

import { readFileSync } from "node:fs";
import { createSign } from "node:crypto";
import path from "node:path";

const FB_ACCESS_TOKEN = process.env.FB_ACCESS_TOKEN;
const GOOGLE_SERVICE_ACCOUNT_KEY_RAW = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const LINE_SEND_MODE = process.env.LINE_SEND_MODE || "test"; // "test" | "broadcast"
const LINE_TEST_USER_ID = process.env.LINE_TEST_USER_ID;

const MANUAL_INPUT_SHEET_ID = "1zuZjIzEzRGOuQD0e_1QslEri29DHL6mVJ9BFE6I87bE"; // "S45 - LINE Report Manual Input"

if (!GOOGLE_SERVICE_ACCOUNT_KEY_RAW) {
  console.error("Missing GOOGLE_SERVICE_ACCOUNT_KEY environment variable.");
  process.exit(1);
}
if (!LINE_CHANNEL_ACCESS_TOKEN) {
  console.error("Missing LINE_CHANNEL_ACCESS_TOKEN environment variable.");
  process.exit(1);
}
if (LINE_SEND_MODE === "test" && !LINE_TEST_USER_ID) {
  console.error("LINE_SEND_MODE=test requires LINE_TEST_USER_ID (your own LINE user id).");
  process.exit(1);
}

const CATEGORY_ORDER = ["nose_open", "nose_semi", "brow_hairline", "breast_lipo", "inter"];
const CATEGORY_DISPLAY_LABEL = {
  nose_open: "Nose Open",
  nose_semi: "Semi Open",
  brow_hairline: "Browlift",
  breast_lipo: "Breast",
  inter: "Inter",
};
// procedureBudget.json ใช้ชื่อหัตถการภาษาไทยเป็น key — map ไปหา category key แบบเดียวกับ adSpend.json
const PROC_BUDGET_KEY_TO_CATEGORY = {
  เสริมจมูกโอเพ่น: "nose_open",
  "เสริมจมูก Semi Open": "nose_semi",
  "ยกคิ้ว/ดึงหน้า/เลื่อนไรผม": "brow_hairline",
  "เสริมหน้าอก/ดูดไขมัน/ตัดหนัง": "breast_lipo",
  Inter: "inter",
};

function base64url(buf) {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function getGoogleAccessToken(serviceAccount) {
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
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
  });
  const json = await res.json();
  if (!json.access_token) throw new Error(`Failed to get Google access token: ${JSON.stringify(json)}`);
  return json.access_token;
}

async function fetchManualInputRow(accessToken) {
  const range = "A1:I1000";
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${MANUAL_INPUT_SHEET_ID}/values/${encodeURIComponent(
    range
  )}?valueRenderOption=UNFORMATTED_VALUE`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  const json = await res.json();
  if (json.error) throw new Error(`Manual input sheet read error: ${json.error.message}`);
  const rows = (json.values || []).filter((r) => r.some((c) => c !== "" && c != null));
  if (rows.length < 2) throw new Error("Manual input sheet has no data rows yet (only header, or empty).");
  const last = rows[rows.length - 1]; // แถวล่างสุดที่มีข้อมูล = วันล่าสุดที่ทีมกรอก
  const col = (i) => last[i] ?? "";
  return {
    dateLabel: String(col(0)),
    adsRevenue: Number(col(1)) || 0,
    roasTarget: Number(col(2)) || 0,
    roasActual: Number(col(3)) || 0,
    targetLeadPct: Number(col(4)) || 0,
    personaNoseOpenBrowliftInter: String(col(5)),
    personaBrowlift: String(col(6)),
    personaBreast: String(col(7)),
    personaSemiOpen: String(col(8)),
  };
}

function fmtTHB(n) {
  return new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(Math.round(n));
}

function buildMonitorAdsSection(snapshot) {
  if (!snapshot) return "ยังไม่มีข้อมูล Monitor Ads (รอรัน fetch-fb-campaign-snapshot.mjs ครั้งแรก)";
  const { diff } = snapshot;
  const byCategory = {};
  for (const key of CATEGORY_ORDER) byCategory[key] = { reNew: [], newAds: [], deletedReNew: [] };
  for (const e of diff.reNew || []) byCategory[e.category]?.reNew.push(e.name);
  for (const e of diff.newAds || []) byCategory[e.category]?.newAds.push(e.name);
  for (const e of diff.deletedReNew || []) byCategory[e.category]?.deletedReNew.push(e.name);

  const blocks = [];
  for (const key of CATEGORY_ORDER) {
    const g = byCategory[key];
    if (g.reNew.length === 0 && g.newAds.length === 0 && g.deletedReNew.length === 0) continue;
    const lines = [CATEGORY_DISPLAY_LABEL[key]];
    if (g.reNew.length) {
      lines.push("[Re-new]");
      for (const n of g.reNew) lines.push(n);
    }
    if (g.deletedReNew.length) {
      lines.push("");
      lines.push("[ลบถาวร]");
      for (const n of g.deletedReNew) lines.push(n);
    }
    if (g.newAds.length) {
      lines.push("");
      lines.push("[Ads ขึ้นใหม่]");
      for (const n of g.newAds) lines.push(n);
    }
    blocks.push(lines.join("\n"));
  }
  return blocks.length > 0 ? blocks.join("\n\n") : "ไม่มีการเปิด/ปิด Ads ใหม่เมื่อเทียบกับเมื่อวาน";
}

function budgetStatusLine(label, spendMtd, fbBudgetTotal, dayOfMonth, daysInMonth) {
  if (!fbBudgetTotal) return `${label} = ไม่มีงบเดือนนี้`;
  const expected = fbBudgetTotal * (dayOfMonth / daysInMonth);
  if (expected <= 0) return `${label} = งบประมาณเป็นไปตามแผน`;
  const ratio = spendMtd / expected;
  if (ratio > 1.15) return `${label} = งบประมาณเกินแผน (ใช้ไปแล้ว ${(ratio * 100).toFixed(0)}% ของแผนสะสม)`;
  if (ratio < 0.85) return `${label} = งบประมาณต่ำกว่าแผน (ใช้ไปแล้ว ${(ratio * 100).toFixed(0)}% ของแผนสะสม)`;
  return `${label} = งบประมาณเป็นไปตามแผน`;
}

async function main() {
  const nowIct = new Date(Date.now() + 7 * 60 * 60 * 1000); // เวลาไทย (ICT = UTC+7)
  const y = nowIct.getUTCFullYear();
  const m = nowIct.getUTCMonth() + 1;
  const d = nowIct.getUTCDate();
  const monthKey = `${y}-${String(m).padStart(2, "0")}`;
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const dateHeaderLabel = `${d}/${m}/${String(y).slice(-2)}`;
  const dateTodayLabel = `${d}/${m}/${y}`;

  const procedureBudget = JSON.parse(readFileSync(path.resolve("src/data/procedureBudget.json"), "utf8"));
  const adSpend = JSON.parse(readFileSync(path.resolve("src/data/adSpend.json"), "utf8"));
  const adDaily = JSON.parse(readFileSync(path.resolve("src/data/adDaily.json"), "utf8"));
  let campaignSnapshot = null;
  try {
    campaignSnapshot = JSON.parse(readFileSync(path.resolve("src/data/campaignSnapshot.json"), "utf8"));
  } catch {
    console.warn("No src/data/campaignSnapshot.json found — Monitor Ads section will be empty.");
  }

  const googleAccessToken = await getGoogleAccessToken(JSON.parse(GOOGLE_SERVICE_ACCOUNT_KEY_RAW));
  const manual = await fetchManualInputRow(googleAccessToken);

  // ---- Budget (เป้าใช้งบวันนี้) ----
  const grandTotal = procedureBudget.grandTotal || 0;
  const budgetToday = grandTotal / daysInMonth;

  // ---- Ads Spend MTD ----
  const adsSpendMtd = adSpend.months?.[monthKey]?.total || 0;

  // ---- Inbox MTD (จริง) + เป้า ----
  const INBOX_TARGET_PER_MONTH = 9600;
  const monthAdDaily = adDaily.months?.[monthKey] || {};
  const inboxActualMtd = Object.values(monthAdDaily).reduce((s, v) => s + (v.dailyInbox || []).reduce((a, b) => a + b, 0), 0);

  // ---- CPR ----
  const cpr = inboxActualMtd > 0 ? adsSpendMtd / inboxActualMtd : 0;

  // ---- Monitor Ads ----
  const monitorAdsText = buildMonitorAdsSection(campaignSnapshot);

  // ---- งบประมาณของ Digital แยกหัตถการ ----
  const budgetStatusLines = CATEGORY_ORDER.map((catKey) => {
    const procEntry = Object.entries(PROC_BUDGET_KEY_TO_CATEGORY).find(([, v]) => v === catKey);
    const procName = procEntry?.[0];
    const fbBudgetTotal = procName ? procedureBudget.procedures?.[procName]?.facebookBudgetTotal || 0 : 0;
    const spendMtd = adSpend.months?.[monthKey]?.[catKey] || 0;
    return budgetStatusLine(CATEGORY_DISPLAY_LABEL[catKey], spendMtd, fbBudgetTotal, d, daysInMonth);
  }).join("\n");

  const message = `Digital Report ${dateHeaderLabel}

💰Budget = ${fmtTHB(budgetToday)} บาท
💸Ads Spend = ${fmtTHB(adsSpendMtd)} บาท
📬${fmtTHB(INBOX_TARGET_PER_MONTH)} Inbox / เดือน
📥${fmtTHB(inboxActualMtd)} Inbox /เดือน
📈ROAS ต่อยอดขาย = ${manual.roasTarget.toFixed(1)}X
📍ROAS ที่ได้ ณ ปัจจุบัน = ${manual.roasActual.toFixed(1)}X
💵Ads Revenue = ${fmtTHB(manual.adsRevenue)} (ณ วันนี้ ${dateTodayLabel})
✅CPR = ${fmtTHB(cpr)}/Inbox
❇️Target Lead = ${manual.targetLeadPct}%


🖥️Monitor Ads
${monitorAdsText}

📊Persona Check
Nose Open,Browlift,Inter
${manual.personaNoseOpenBrowliftInter}

ยกคิ้ว-ดึงหน้า
${manual.personaBrowlift}

Breast
${manual.personaBreast}

Semi Open
${manual.personaSemiOpen}

‼️การใช้งบประมาณของ Digital
${budgetStatusLines}`;

  console.log("---- Generated report ----");
  console.log(message);
  console.log("---------------------------");

  await sendToLine(message);
}

async function sendToLine(text) {
  // LINE text message limit is 5000 chars — split on blank-line boundaries if needed, up to 5 messages per call.
  const MAX_LEN = 4800;
  const chunks = [];
  let rest = text;
  while (rest.length > 0 && chunks.length < 5) {
    if (rest.length <= MAX_LEN) {
      chunks.push(rest);
      break;
    }
    let cut = rest.lastIndexOf("\n\n", MAX_LEN);
    if (cut <= 0) cut = MAX_LEN;
    chunks.push(rest.slice(0, cut));
    rest = rest.slice(cut).replace(/^\n+/, "");
  }
  const messages = chunks.map((t) => ({ type: "text", text: t }));

  const isTest = LINE_SEND_MODE === "test";
  const url = isTest ? "https://api.line.me/v2/bot/message/push" : "https://api.line.me/v2/bot/message/broadcast";
  const body = isTest ? { to: LINE_TEST_USER_ID, messages } : { messages };

  console.log(`Sending via LINE Messaging API (mode: ${LINE_SEND_MODE})...`);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`LINE API error (${res.status}): ${errText}`);
  }
  console.log(isTest ? "Sent test push to LINE_TEST_USER_ID." : "Broadcast sent to all LINE OA followers.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
