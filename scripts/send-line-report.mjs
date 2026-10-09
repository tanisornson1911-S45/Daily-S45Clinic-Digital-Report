#!/usr/bin/env node
/**
 * send-line-report.mjs
 * ---------------------------------------------------------------
 * Builds the daily "Digital Report" text (same format the team used to type
 * by hand into LINE OA every evening) and sends it via the LINE Messaging
 * API. Rewritten 2026-10-09 to match the team's revised format, which
 * drills into Nose Open + Inter specifically instead of one combined
 * Budget/ROAS/CPR for all procedures (confirmed field-by-field with the
 * user on 2026-10-08/09):
 *
 *   - Budget Nose Open / Budget Inter = this week's Facebook budget
 *     forecast (src/data/weeklyBudget.json, written by
 *     fetch-budget-allocate.mjs from the "<Month><YY> by Week" tab of the
 *     "S45 - Budget Allocate" Google Sheet) — which week (W1-W4) is picked
 *     from today's day-of-month.
 *   - Ads Spend Nose Open = Nose Open 01+02+Freelance combined, Inter-named
 *     campaigns excluded (src/data/adSpend.json's "nose_open", unchanged).
 *   - Ads Spend Inter = the dedicated Inter account + Nose Open 02's
 *     Inter-named campaigns combined (adSpend.json's "inter", unchanged —
 *     confirmed 2026-10-09 this combined definition is what's wanted).
 *   - Target Nose Open/Inter Inbox = 3,600 / 300 per month (constants).
 *   - ROAS ต่อยอดขาย = 4.0 (constant).
 *   - ROAS ที่ได้ ณ ปัจจุบัน = (Ads Revenue Nose Open + Ads Revenue Inter) ÷
 *     (Ads Spend Nose Open + Ads Spend Inter) — "N/A" if Ads Revenue Inter
 *     is "N/A" (see below), per user direction 2026-10-09.
 *   - Ads Revenue Nose Open = sum of src/data/orSales.json ("ยอดORจริง+
 *     Forecast พี่เปา") entries for nose_open this month, joined against
 *     src/data/rawTx.json ("ปิดมัด"/มัดจำ 2026) by (OR date, doctor, proc)
 *     to find each case's channel (orSales itself has no channel column),
 *     filtered to Facebook/Line/Instagram/WhatsApp. "N/A" if there are no
 *     orSales entries for nose_open this month at all.
 *   - Ads Revenue Inter = "N/A" always for now — src/data/interSale.json
 *     ("Inter S45 2026 - Sale part") has NO channel column at all (checked
 *     2026-10-09: neither it nor orSales.json tracks Inter cases by
 *     channel), so there is currently no data source to compute this from.
 *     Revisit once the team points to one (e.g. a "Consultation" sheet in
 *     the same workbook has a "Platform" column but isn't wired in yet).
 *   - CPR Nose Open / CPR Inter = src/data/cprAccountDaily.json (written by
 *     fetch-fb-cpr-breakdown.mjs — see that script's header for the exact
 *     account/campaign scope, which is narrower than Ads Spend's). "N/A" if
 *     that file/month has no data yet or Inbox is 0.
 *
 * The Monitor Ads / Persona Check / per-category budget-status sections
 * below the top metrics are unchanged from the original report design.
 *
 * Run manually (test push to yourself):
 *   GOOGLE_SERVICE_ACCOUNT_KEY='{...}' LINE_CHANNEL_ACCESS_TOKEN=... \
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
// procedureBudget.json/weeklyBudget.json ใช้ชื่อหัตถการภาษาไทยเป็น key — map ไปหา category key แบบเดียวกับ adSpend.json
const PROC_BUDGET_KEY_TO_CATEGORY = {
  เสริมจมูกโอเพ่น: "nose_open",
  "เสริมจมูก Semi Open": "nose_semi",
  "ยกคิ้ว/ดึงหน้า/เลื่อนไรผม": "brow_hairline",
  "เสริมหน้าอก/ดูดไขมัน/ตัดหนัง": "breast_lipo",
  Inter: "inter",
};

const ADS_REVENUE_CHANNELS = new Set(["Facebook", "Line", "Instagram", "WhatsApp"]);
const NA = "N/A";

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
  // คอลัมน์ 1-4 (Ads Revenue/ROAS/Target Lead) ไม่ใช้แล้วหลังปรับรูปแบบรายงาน 2026-10-09 — เหลือแต่ Persona Check
  return {
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

// รวมยอด orSales.json เฉพาะหัตถการ+ช่วงเดือนนี้ แล้ว join กับ rawTx.json ด้วย (OR date, doctor, proc) เพื่อหา
// ช่องทาง (orSales เองไม่มีคอลัมน์ช่องทาง) — คืนค่า null (= "N/A") ถ้าเดือนนี้ไม่มี entry ของหัตถการนี้เลย
function computeAdsRevenue(orSalesEntries, rawTxIndex, procKey, monthStart, monthEnd) {
  const entries = orSalesEntries.filter((e) => e.proc === procKey && e.d >= monthStart && e.d <= monthEnd);
  if (entries.length === 0) return null;
  let total = 0;
  for (const e of entries) {
    const key = `${e.d}|${e.doctor}|${e.proc}`;
    const matches = rawTxIndex.get(key);
    if (!matches || matches.length === 0) continue; // จับคู่ไม่เจอ — ไม่รู้ช่องทาง ไม่นับ
    const ch = matches[0].ch;
    if (ADS_REVENUE_CHANNELS.has(ch)) total += e.amount;
  }
  return total;
}

function buildRawTxIndex(rawTx) {
  const idx = new Map();
  for (const t of rawTx) {
    if (!t.or) continue;
    const key = `${t.or}|${t.doc}|${t.p}`;
    if (!idx.has(key)) idx.set(key, []);
    idx.get(key).push(t);
  }
  return idx;
}

function cprFor(cprAccountDaily, monthKey, field) {
  const m = cprAccountDaily?.months?.[monthKey]?.[field];
  if (!m) return null;
  const spend = (m.dailyAds || []).reduce((a, b) => a + b, 0);
  const inbox = (m.dailyInbox || []).reduce((a, b) => a + b, 0);
  if (inbox <= 0) return null;
  return Math.round(spend / inbox);
}

// Inbox สะสม MTD (เดือนนี้จนถึงวันล่าสุดที่มีข้อมูล) ของขอบเขตบัญชีเดียวกับที่ใช้คำนวณ CPR — สะสมเพิ่มเข้า
// ไปทุกวันตามข้อมูลจริงที่ fetch-fb-cpr-breakdown.mjs ดึงมา (ไม่ใช่แค่ของวันล่าสุดวันเดียว)
function inboxSumFor(cprAccountDaily, monthKey, field) {
  const m = cprAccountDaily?.months?.[monthKey]?.[field];
  if (!m) return null;
  return (m.dailyInbox || []).reduce((a, b) => a + b, 0);
}

async function main() {
  const nowIct = new Date(Date.now() + 7 * 60 * 60 * 1000); // เวลาไทย (ICT = UTC+7)
  const y = nowIct.getUTCFullYear();
  const m = nowIct.getUTCMonth() + 1;
  const d = nowIct.getUTCDate();
  const monthKey = `${y}-${String(m).padStart(2, "0")}`;
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const dateHeaderLabel = `${d}/${m}/${String(y).slice(-2)}`;
  const monthStart = `${monthKey}-01`;
  // ยอดขาย/OR "นิ่งแล้ว" เฉพาะถึงเมื่อวาน (เหมือน adSpend.json/adDaily.json) — ไม่ใช้ถึง "วันนี้" เพราะ
  // orSales.json ผสม Forecast ของทั้งเดือนไว้ด้วย วันนี้เองอาจมีแถว Forecast ที่ดันบังเอิญจับคู่กับ RAW_TX
  // ได้ (บันทึกมัดจำวันเดียวกัน) ทั้งที่เคสยังไม่ปิดจริงแน่นอน
  const yesterdayIct = new Date(nowIct.getTime() - 24 * 60 * 60 * 1000);
  const revenueMonthEnd =
    yesterdayIct.getUTCFullYear() === y && yesterdayIct.getUTCMonth() + 1 === m
      ? `${monthKey}-${String(yesterdayIct.getUTCDate()).padStart(2, "0")}`
      : `${monthKey}-00`; // เมื่อวานข้ามไปเดือนก่อน (วันนี้คือวันที่ 1) — เดือนนี้ยังไม่มีวันที่ "นิ่งแล้ว" เลย (ช่วงว่าง เพราะ "-00" < "-01" เสมอ)

  const procedureBudget = JSON.parse(readFileSync(path.resolve("src/data/procedureBudget.json"), "utf8"));
  const adSpend = JSON.parse(readFileSync(path.resolve("src/data/adSpend.json"), "utf8"));
  const orSales = JSON.parse(readFileSync(path.resolve("src/data/orSales.json"), "utf8"));
  const rawTx = JSON.parse(readFileSync(path.resolve("src/data/rawTx.json"), "utf8"));
  let campaignSnapshot = null;
  try {
    campaignSnapshot = JSON.parse(readFileSync(path.resolve("src/data/campaignSnapshot.json"), "utf8"));
  } catch {
    console.warn("No src/data/campaignSnapshot.json found — Monitor Ads section will be empty.");
  }
  let weeklyBudget = null;
  try {
    weeklyBudget = JSON.parse(readFileSync(path.resolve("src/data/weeklyBudget.json"), "utf8"));
  } catch {
    console.warn("No src/data/weeklyBudget.json found — Budget Nose Open/Inter will be N/A.");
  }
  let cprAccountDaily = null;
  try {
    cprAccountDaily = JSON.parse(readFileSync(path.resolve("src/data/cprAccountDaily.json"), "utf8"));
  } catch {
    console.warn("No src/data/cprAccountDaily.json found — CPR Nose Open/Inter will be N/A.");
  }

  const googleAccessToken = await getGoogleAccessToken(JSON.parse(GOOGLE_SERVICE_ACCOUNT_KEY_RAW));
  const manual = await fetchManualInputRow(googleAccessToken);

  // ---- Budget Nose Open / Inter (งบ Facebook สัปดาห์นี้ จาก weeklyBudget.json) ----
  const weekIdx = d <= 7 ? 0 : d <= 14 ? 1 : d <= 21 ? 2 : 3;
  const weeklyFor = (procName) => {
    const p = weeklyBudget?.procedures?.[procName];
    if (!p) return null;
    const v = p.weeks?.[weekIdx];
    return typeof v === "number" ? v : null;
  };
  const budgetNoseOpen = weeklyFor("เสริมจมูกโอเพ่น");
  const budgetInter = weeklyFor("Inter");

  // ---- Ads Spend Nose Open / Inter (สะสม MTD) ----
  const adsSpendNoseOpen = adSpend.months?.[monthKey]?.nose_open ?? null;
  const adsSpendInter = adSpend.months?.[monthKey]?.inter ?? null;

  // ---- Ads Revenue Nose Open / Inter ----
  const rawTxIndex = buildRawTxIndex(rawTx);
  const adsRevenueNoseOpen = computeAdsRevenue(orSales.entries, rawTxIndex, "nose_open", monthStart, revenueMonthEnd);
  const adsRevenueInter = null; // ไม่มีคอลัมน์ช่องทางในแหล่งข้อมูล Inter เลย (ดูคอมเมนต์หัวไฟล์) — N/A เสมอตอนนี้

  // ---- ROAS ----
  // ถ้ามี Ads Revenue ไม่ครบทั้ง Nose Open และ Inter ให้เอาเฉพาะส่วนที่มีมาคำนวณ (เทียบกับ Ads Spend ของ
  // หัตถการนั้นๆ เท่านั้น) — เป็น N/A ก็ต่อเมื่อไม่มี Ads Revenue เลยสักตัว (ยืนยันกับผู้ใช้ 2026-10-09)
  const roasTarget = 4.0;
  const roasParts = [];
  if (adsRevenueNoseOpen != null && adsSpendNoseOpen != null) roasParts.push({ revenue: adsRevenueNoseOpen, spend: adsSpendNoseOpen });
  if (adsRevenueInter != null && adsSpendInter != null) roasParts.push({ revenue: adsRevenueInter, spend: adsSpendInter });
  const roasActualSpend = roasParts.reduce((s, p) => s + p.spend, 0);
  const roasActual = roasParts.length === 0 || roasActualSpend <= 0 ? null : roasParts.reduce((s, p) => s + p.revenue, 0) / roasActualSpend;

  // ---- CPR ----
  const cprNoseOpen = cprFor(cprAccountDaily, monthKey, "nose_open_cpr");
  const cprInter = cprFor(cprAccountDaily, monthKey, "inter_cpr");
  const inboxNoseOpen = inboxSumFor(cprAccountDaily, monthKey, "nose_open_cpr");
  const inboxInter = inboxSumFor(cprAccountDaily, monthKey, "inter_cpr");

  // ---- Monitor Ads ----
  const monitorAdsText = buildMonitorAdsSection(campaignSnapshot);

  // ---- งบประมาณของ Digital แยกหัตถการ (เหมือนเดิม ไม่เปลี่ยน) ----
  const budgetStatusLines = CATEGORY_ORDER.map((catKey) => {
    const procEntry = Object.entries(PROC_BUDGET_KEY_TO_CATEGORY).find(([, v]) => v === catKey);
    const procName = procEntry?.[0];
    const fbBudgetTotal = procName ? procedureBudget.procedures?.[procName]?.facebookBudgetTotal || 0 : 0;
    const spendMtd = adSpend.months?.[monthKey]?.[catKey] || 0;
    return budgetStatusLine(CATEGORY_DISPLAY_LABEL[catKey], spendMtd, fbBudgetTotal, d, daysInMonth);
  }).join("\n");

  const baht = (v) => (v == null ? NA : `${fmtTHB(v)} บาท`);
  const perInbox = (v) => (v == null ? NA : `${fmtTHB(v)}/Inbox`);
  const inboxCount = (v) => (v == null ? NA : `${fmtTHB(v)} Inbox`);
  const roasStr = (v) => (v == null ? NA : `${v.toFixed(1)}X`);

  const message = `Digital Report ${dateHeaderLabel}

💰Budget Nose Open = ${baht(budgetNoseOpen)}
💰Budget Inter = ${baht(budgetInter)}
💸Ads Spend Nose Open = ${baht(adsSpendNoseOpen)}
💸Ads Spend Inter = ${baht(adsSpendInter)}
📥 Target Nose Open Inbox 3,600 Inbox /เดือน
Inbox ที่ได้ = ${inboxCount(inboxNoseOpen)}
📥 Target Inter Inbox 300 Inbox /เดือน
Inbox ที่ได้ = ${inboxCount(inboxInter)}
📈ROAS ต่อยอดขาย = ${roasStr(roasTarget)}
📍ROAS ที่ได้ ณ ปัจจุบัน = ${roasStr(roasActual)}
💵Ads Revenue Nose Open = ${baht(adsRevenueNoseOpen)}
💵Ads Revenue Inter = ${baht(adsRevenueInter)}
✅CPR Nose Open = ${perInbox(cprNoseOpen)}
✅CPR Inter = ${perInbox(cprInter)}


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
