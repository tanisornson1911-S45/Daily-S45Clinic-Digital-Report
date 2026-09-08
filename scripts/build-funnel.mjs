#!/usr/bin/env node
/**
 * build-funnel.mjs
 * ---------------------------------------------------------------
 * Builds daily Ads→Inbox→Sales funnel data for every month from
 * MIN_MONTH_ISO onward, writing src/data/funnelByMonth.json keyed by ISO
 * month ("2026-08", "2026-09", ...). App.jsx imports this one file — new
 * months just add a new key, no code change needed on either side.
 *
 * dailyAds/dailyInbox for a month come from ONE of two sources, in this
 * priority order:
 *   1. workbooks.online_sales_daily in src/data/m365Raw.json — that
 *      month's own sheet in "ยอดขาย Online S45 Clinic.xlsx" (e.g. "ส.ค.69"),
 *      when the team has created it.
 *   2. src/data/adDaily.json — real daily spend/Inbox pulled directly from
 *      the Facebook Marketing API (scripts/fetch-fb-daily.mjs), used when
 *      the Excel sheet for that month doesn't exist yet.
 *
 * Per user direction (2026-09-08): "ส่วนนั้นเคยบอกแล้วว่าให้ดึงด้วย MCP Meta
 * สำหรับข้อมูล Inbox ที่ไปรอไฟล์ Sharepoint" — the dashboard's Inbox/Sales
 * Funnel cards were showing "no data" for September 2026 because the team
 * hadn't created that month's SharePoint sheet yet, even though real
 * September ad spend + Inbox numbers were already available live from the
 * Facebook Marketing API the whole time (adDaily.json already covers the
 * current month + 2 prior, refreshed daily by the OTHER pipeline —
 * .github/workflows/update-dashboard-data.yml). There's no reason to make
 * the dashboard wait on a hand-maintained Excel tab when the same numbers
 * already exist as real API data — fetch-fb-daily.mjs's own header comment
 * says as much ("This replaces the Excel sheet as the source for daily
 * Ads/Inbox numbers"), it just hadn't been wired in as a fallback here yet.
 * The Excel sheet is still preferred when both exist for the same month
 * (it's the longer-established, cross-verified source) — adDaily.json only
 * fills the gap for months the Excel sheet doesn't cover yet. Once the team
 * adds that month's sheet, the next pipeline run switches back to it
 * automatically.
 *
 * MIN_MONTH_ISO = "2026-08": June and July are NOT included here — they
 * stay as the hand-verified FUNNEL_DATA / FUNNEL_DATA_JUL constants in
 * App.jsx (frozen historical snapshots, also reused as the fixed baseline
 * for the "Option การกระตุ้นยอดขาย" what-if calculator, so intentionally
 * not swapped for a freshly-rebuilt version). August was the first month
 * this script ever built live, so that's kept as the boundary.
 *
 * dailyConsult/dailyDeposit/dailyOr/dailyOrCases <- always derived from
 * src/data/rawTx.json (the same "มัดจำ 2026" ledger RAW_TX uses) regardless
 * of which source fed dailyAds/dailyInbox, because neither the Excel sheet
 * nor the Facebook API has these — the sheet's own consult/deposit/OR rows
 * aren't filled in in real time, and Facebook obviously doesn't know about
 * clinic consults/deposits.
 *
 * sales/basket/closeRate/adsCost/adsCostOr <- same formulas as before:
 * sales = sum of Total price (fallback Online price) for cases with
 * Deposit>0 or a Sale Consult name filled, counted once each; basket =
 * sales/closedCount; closeRate = closedCount/inbox; adsCost = ads/sales;
 * adsCostOr = ads/or.
 *
 * A month whose Excel sheet doesn't match the expected 6-block layout
 * (label row + "ยอดยิง Ads" + "Inbox", once per category) falls through to
 * the adDaily.json source instead of failing outright — e.g. "ม.ค.69" is
 * missing one category block AND predates the Facebook Marketing API
 * pipeline, so it's skipped with a warning either way (expected, shouldn't
 * take the nightly pipeline down).
 *
 * Run manually (after fetch-m365-data.mjs + build-raw-tx.mjs):
 *   node scripts/build-funnel.mjs
 * ---------------------------------------------------------------
 */

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const MIN_MONTH_ISO = "2026-08";
const LABEL = "รวมทุกหัตถการ";
const REAL_KEYS = ["nose_open", "nose_semi", "breast_lipo", "brow_hairline", "inter"];

// Sheet names follow "<Thai month abbr, with its own trailing dot(s)><2-digit BE year>",
// e.g. "ส.ค.69" = สิงหาคม + BE 2569 (= AD 2026). BE full year = 2500 + yy (valid for AD 1957-2057,
// plenty of headroom); AD = BE - 543.
const THAI_ABBR_TO_MONTH_NUM = {
  "ม.ค.": 1,
  "ก.พ.": 2,
  "มี.ค.": 3,
  "เม.ย.": 4,
  "พ.ค.": 5,
  "มิ.ย.": 6,
  "ก.ค.": 7,
  "ส.ค.": 8,
  "ก.ย.": 9,
  "ต.ค.": 10,
  "พ.ย.": 11,
  "ธ.ค.": 12,
};
function sheetNameToIso(name) {
  for (const [abbr, monthNum] of Object.entries(THAI_ABBR_TO_MONTH_NUM)) {
    if (name.startsWith(abbr)) {
      const yy = Number(name.slice(abbr.length));
      if (!Number.isInteger(yy)) continue;
      const adYear = 2500 + yy - 543;
      return `${adYear}-${String(monthNum).padStart(2, "0")}`;
    }
  }
  return null;
}

// Fixed block order in the sheet: label row, then "ยอดยิง Ads", then "Inbox".
const BLOCK_KEYS = [...REAL_KEYS, "all"];
const BLOCK_LABELS = {
  nose_open: "เสริมจมูกโอเพ่น (Nose Open)",
  nose_semi: "เสริมจมูก Semi Open",
  breast_lipo: "เสริมหน้าอก/ดูดไขมัน",
  brow_hairline: "ยกคิ้ว/เลื่อนไรผม/ยกมุมปาก",
  inter: "Inter",
  all: LABEL,
};

// แปลงชีต Excel ของเดือนหนึ่งเป็น blocks {key: {dailyAdsFull, dailyInboxFull}} — throw ถ้า layout ไม่ตรง
// (จำนวน block ไม่ครบ 6) ให้ caller เป็นคนตัดสินใจว่าจะ fallback ไปแหล่งอื่นหรือข้ามเดือนนี้ไปเลย
function blocksFromExcelSheet(sheet, sheetName) {
  const blockStarts = [];
  for (let i = 0; i < sheet.length - 2; i++) {
    if (typeof sheet[i][0] === "string" && sheet[i][0].trim() !== "" && sheet[i + 1][0] === "ยอดยิง Ads" && sheet[i + 2][0] === "Inbox") {
      blockStarts.push(i);
    }
  }
  if (blockStarts.length !== BLOCK_KEYS.length) {
    throw new Error(`Expected ${BLOCK_KEYS.length} category blocks in sheet "${sheetName}", found ${blockStarts.length}.`);
  }
  const toNum = (v) => (typeof v === "number" ? v : null);
  const blocks = {};
  blockStarts.forEach((rowIdx, i) => {
    const key = BLOCK_KEYS[i];
    const adsRow = sheet[rowIdx + 1];
    const inboxRow = sheet[rowIdx + 2];
    // col0 = label, col1 = cumulative-to-date total, col2..col32 = days 1-31.
    blocks[key] = { dailyAdsFull: adsRow.slice(2).map(toNum), dailyInboxFull: inboxRow.slice(2).map(toNum) };
  });
  return blocks;
}

// แปลงข้อมูล Facebook Marketing API รายวันของเดือนหนึ่ง (src/data/adDaily.json, ดึงโดย
// scripts/fetch-fb-daily.mjs) เป็น blocks รูปแบบเดียวกับ blocksFromExcelSheet — array ของไฟล์นี้ถูกตัดจบที่
// วันสุดท้ายที่มีข้อมูลจริงอยู่แล้ว (ไม่มี null คั่น) จึงใช้ตรงๆ เป็น dailyAdsFull/dailyInboxFull ได้เลย
// (coverageOf() ด้านล่างนับความยาว array ได้ถูกต้องเหมือนกันไม่ว่าจะมาจากแหล่งไหน)
function blocksFromAdDaily(monthData) {
  const blocks = {};
  for (const key of REAL_KEYS) {
    const c = monthData?.[key];
    if (!c || !Array.isArray(c.dailyAds) || !Array.isArray(c.dailyInbox)) return null; // ต้องมีครบทุกหมวดถึงจะสร้างเดือนนี้ได้
    blocks[key] = { dailyAdsFull: c.dailyAds, dailyInboxFull: c.dailyInbox };
  }
  return blocks;
}

// Builds one month's funnel breakdown from pre-parsed blocks (source-agnostic — Excel sheet or
// adDaily.json, caller already picked which).
function buildMonthFunnel(monthIso, blocks, rawTx) {
  const DAYS_IN_MONTH = new Date(Number(monthIso.slice(0, 4)), Number(monthIso.slice(5, 7)), 0).getDate();

  // Real coverage = the run of non-null daily values from day 1 (both sources leave future days
  // blank/absent until real data exists), measured PER CATEGORY — not the minimum across all 5,
  // which would force every category's daily array down to whichever one lagged furthest behind
  // even on days the other 4 categories already had real data for. Each category keeps its own
  // real coverage; "all" sums whichever categories have data for each day.
  const coverageOf = (arr) => {
    let n = 0;
    while (n < 31 && arr[n] != null) n++;
    return n;
  };
  const coverageByKey = Object.fromEntries(REAL_KEYS.map((k) => [k, coverageOf(blocks[k].dailyAdsFull)]));
  const daysWithData = Math.max(...Object.values(coverageByKey)); // "all" array length — most any category has
  console.log(`Per-category daily coverage for ${monthIso}:`, coverageByKey, `-> using ${daysWithData} day(s) for "all"`);

  const monthTx = rawTx.filter((t) => t.d.startsWith(monthIso));

  const out = {};
  const closeCounts = {};
  for (const key of REAL_KEYS) {
    const b = blocks[key];
    // เก็บความยาวจริงของหมวดนี้ไว้ (อาจสั้นกว่า daysWithData ถ้าหมวดนี้กรอกช้ากว่าหมวดอื่น) แพด 0 ต่อท้ายให้ยาว
    // เท่า daysWithData เพื่อให้บวกรวมกับหมวดอื่นใน "all" ตรงตำแหน่งวันได้ — ไม่ใช่การเดาตัวเลข แค่ทำให้ยาวเท่ากัน
    const ownCoverage = coverageByKey[key];
    const dailyAds = Array.from({ length: daysWithData }, (_, i) => (i < ownCoverage ? b.dailyAdsFull[i] : 0));
    const dailyInbox = Array.from({ length: daysWithData }, (_, i) => (i < ownCoverage ? b.dailyInboxFull[i] : 0));

    if (key === "inter") {
      // No separate "inter" tag in rawTx.json (Inter cases are folded into
      // nose_open there — see App.jsx comments near CATEGORIES/GRAND_TOTAL), so
      // consult/deposit/OR/sales can't be derived for it.
      // ads/inbox totals are summed from the truncated daily arrays (not the
      // sheet's own cumulative column1, which can reflect a different "as of" day
      // per category) so the displayed total always matches the daily bars exactly.
      out[key] = {
        label: BLOCK_LABELS[key],
        ads: dailyAds.reduce((s, v) => s + v, 0),
        inbox: dailyInbox.reduce((s, v) => s + v, 0),
        or: null,
        sales: null,
        basket: null,
        closeRate: null,
        adsCost: null,
        adsCostOr: null,
        dailyAds,
        dailyInbox,
        dailyOr: null,
        dailyConsult: null,
        dailyDeposit: null,
        dailyOrCases: null,
      };
      continue;
    }

    const catTx = monthTx.filter((t) => t.p === key);
    // ความยาวของ 4 array นี้ไม่ผูกกับ daysWithData (ความคืบหน้าของแหล่ง Ads/Inbox ล่าช้ากว่าจริงเสมอ) —
    // deposit/consult/OR มาจาก rawTx.json (ไฟล์ "มัดจำ 2026" ที่อัปเดตสดจริง ไม่มีความล่าช้าแบบนั้น) ใช้
    // DAYS_IN_MONTH (ครบทุกวันของเดือน) แทน ไม่งั้นวันท้ายๆ ที่มีเคสปิดมัดจำ/OR จริงแล้วจะถูกตัดทิ้งเงียบๆ
    const dailyConsult = new Array(DAYS_IN_MONTH).fill(0);
    const dailyDeposit = new Array(DAYS_IN_MONTH).fill(0);
    const dailyOr = new Array(DAYS_IN_MONTH).fill(0);
    const dailyOrCases = new Array(DAYS_IN_MONTH).fill(0);

    // ใช้กับ t.d (วันทัก) เท่านั้น — รับประกันอยู่ในเดือนนี้แล้วจาก monthTx filter ด้านบน
    const dayIndex = (iso) => {
      const day = Number(iso.slice(8, 10));
      return day >= 1 && day <= DAYS_IN_MONTH ? day - 1 : -1;
    };
    // ใช้กับ t.or (วันผ่าตัด) โดยเฉพาะ — ต้อง "อยู่ในเดือนนี้จริง" ก่อน ไม่ใช่แค่ตัวเลขวันที่ 1-31 ตรงกันโดยบังเอิญ
    // (เคสที่ d อยู่เดือนนี้ แต่นัดผ่าตัด (or) เดือนอื่น ไม่ควรถูกนับเป็นวันที่ตรงกันของเดือนนี้โดยบังเอิญ)
    const orDayIndex = (iso) => (iso.startsWith(monthIso) ? dayIndex(iso) : -1);

    let closedCount = 0;
    let sales = 0;
    let orTotal = 0;
    let consultCount = 0;
    let consultValue = 0;
    let depositCount = 0;
    let depositValue = 0;
    for (const t of catTx) {
      const di = dayIndex(t.d);
      const amt = t.tot > 0 ? t.tot : t.onl;
      if (di >= 0 && t.dep > 0) dailyDeposit[di]++;
      if (di >= 0 && t.cons) dailyConsult[di]++;
      if (t.dep > 0) {
        depositCount++;
        depositValue += amt;
      }
      if (t.cons) {
        consultCount++;
        consultValue += amt;
      }
      if (t.or) {
        // นับเฉพาะเคสที่ "วันผ่าตัดจริง" (t.or) อยู่ในเดือนนี้จริงๆ — เคสที่ทักเข้ามาเดือนนี้แต่นัดผ่าตัดเดือนอื่น
        // ไม่นับเป็น "ปิด OR" ของเดือนนี้
        const oi = orDayIndex(t.or);
        if (oi >= 0) {
          dailyOr[oi] += amt;
          dailyOrCases[oi]++;
          orTotal += amt;
        }
      }
      if (t.dep > 0 || t.cons) {
        closedCount++;
        sales += amt;
      }
    }

    // Sum from the truncated daily arrays, not the sheet's own cumulative column1
    // (which can reflect a different "as of" day per category) — keeps the
    // displayed total consistent with the daily bars.
    const adsTotal = dailyAds.reduce((s, v) => s + v, 0);
    const inboxTotal = dailyInbox.reduce((s, v) => s + v, 0);
    out[key] = {
      label: BLOCK_LABELS[key],
      ads: adsTotal,
      inbox: inboxTotal,
      or: orTotal,
      sales,
      basket: closedCount > 0 ? sales / closedCount : 0,
      closeRate: inboxTotal > 0 ? closedCount / inboxTotal : 0,
      adsCost: sales > 0 ? adsTotal / sales : 0,
      adsCostOr: orTotal > 0 ? adsTotal / orTotal : 0,
      dailyAds,
      dailyInbox,
      dailyOr,
      dailyConsult,
      dailyDeposit,
      dailyOrCases,
      _closedCount: closedCount, // internal only, used to derive "all" below; stripped before returning
    };
    closeCounts[key] = { consult: consultCount, deposit: depositCount, consultValue, depositValue };
  }

  // "all" = ads/inbox/dailyAds/dailyInbox sum ALL 5 categories (incl. inter); or/sales/dailyOr/
  // dailyConsult/dailyDeposit/dailyOrCases sum only the 4 non-inter categories (inter's are null);
  // basket/closeRate/adsCost/adsCostOr are then derived the same formulas.
  const nonInter = ["nose_open", "nose_semi", "breast_lipo", "brow_hairline"];
  const sumArr = (arrs) => arrs[0].map((_, i) => arrs.reduce((s, a) => s + a[i], 0));
  const allAds = REAL_KEYS.reduce((s, k) => s + out[k].ads, 0);
  const allInbox = REAL_KEYS.reduce((s, k) => s + out[k].inbox, 0);
  const allOr = nonInter.reduce((s, k) => s + out[k].or, 0);
  const allSales = nonInter.reduce((s, k) => s + out[k].sales, 0);
  const allClosedCount = nonInter.reduce((s, k) => s + out[k]._closedCount, 0);
  out.all = {
    label: BLOCK_LABELS.all,
    ads: allAds,
    inbox: allInbox,
    or: allOr,
    sales: allSales,
    basket: allClosedCount > 0 ? allSales / allClosedCount : 0,
    closeRate: allInbox > 0 ? allClosedCount / allInbox : 0,
    adsCost: allSales > 0 ? allAds / allSales : 0,
    adsCostOr: allOr > 0 ? allAds / allOr : 0,
    dailyAds: sumArr(REAL_KEYS.map((k) => out[k].dailyAds)),
    dailyInbox: sumArr(REAL_KEYS.map((k) => out[k].dailyInbox)),
    dailyOr: sumArr(nonInter.map((k) => out[k].dailyOr)),
    dailyConsult: sumArr(nonInter.map((k) => out[k].dailyConsult)),
    dailyDeposit: sumArr(nonInter.map((k) => out[k].dailyDeposit)),
    dailyOrCases: sumArr(nonInter.map((k) => out[k].dailyOrCases)),
  };

  for (const k of nonInter) delete out[k]._closedCount;

  closeCounts.all = nonInter.reduce(
    (acc, k) => ({
      consult: acc.consult + closeCounts[k].consult,
      deposit: acc.deposit + closeCounts[k].deposit,
      consultValue: acc.consultValue + closeCounts[k].consultValue,
      depositValue: acc.depositValue + closeCounts[k].depositValue,
    }),
    { consult: 0, deposit: 0, consultValue: 0, depositValue: 0 }
  );

  return { daysWithData, data: out, closeCounts };
}

function main() {
  const m365Path = path.resolve("src/data/m365Raw.json");
  const m365 = JSON.parse(readFileSync(m365Path, "utf8"));
  const sheets = m365.workbooks?.online_sales_daily || {};

  const rawTxPath = path.resolve("src/data/rawTx.json");
  const rawTx = JSON.parse(readFileSync(rawTxPath, "utf8"));

  let adDaily = {};
  try {
    adDaily = JSON.parse(readFileSync(path.resolve("src/data/adDaily.json"), "utf8")).months || {};
  } catch {
    console.warn("  ! src/data/adDaily.json not found — Facebook Marketing API fallback unavailable this run.");
  }

  // ISO-sorted list of candidate months at or after MIN_MONTH_ISO — the union of (a) Excel sheet
  // tabs that convert to a recognizable "<Thai month abbr><2-digit BE year>" name, and (b) months
  // present in adDaily.json (real Facebook Marketing API data, refreshed daily by the OTHER
  // pipeline — see module comment above for why this fallback exists). Neither list is hardcoded;
  // both grow on their own as their respective source gains new months.
  const excelIsoToName = {};
  for (const name of Object.keys(sheets)) {
    const iso = sheetNameToIso(name);
    if (iso) excelIsoToName[iso] = name;
  }
  const candidateMonths = [...new Set([...Object.keys(excelIsoToName), ...Object.keys(adDaily)])]
    .filter((iso) => iso >= MIN_MONTH_ISO)
    .sort();

  const months = {};
  for (const iso of candidateMonths) {
    let blocks = null;
    let source = null;
    let sourceKind = null; // "excel" | "facebook_api" — machine-readable, App.jsx uses this to word the footnote accurately
    if (excelIsoToName[iso]) {
      try {
        blocks = blocksFromExcelSheet(sheets[excelIsoToName[iso]], excelIsoToName[iso]);
        source = `sheet "${excelIsoToName[iso]}"`;
        sourceKind = "excel";
      } catch (err) {
        console.warn(`  ! Excel sheet for ${iso} ("${excelIsoToName[iso]}") didn't parse: ${err.message}`);
      }
    }
    if (!blocks && adDaily[iso]) {
      blocks = blocksFromAdDaily(adDaily[iso]);
      if (blocks) {
        source = "adDaily.json (Facebook Marketing API — no Excel sheet yet)";
        sourceKind = "facebook_api";
      }
    }
    if (!blocks) {
      console.warn(`  ! Skipping ${iso}: no usable source (Excel sheet missing/malformed, adDaily.json missing/incomplete).`);
      continue;
    }
    try {
      months[iso] = { ...buildMonthFunnel(iso, blocks, rawTx), sourceKind };
      console.log(`Built ${iso} from ${source}: ads=${months[iso].data.all.ads} inbox=${months[iso].data.all.inbox}`);
    } catch (err) {
      console.warn(`  ! Skipping ${iso} (source: ${source}): ${err.message}`);
    }
  }

  if (Object.keys(months).length === 0) {
    console.error(`No month >= ${MIN_MONTH_ISO} built successfully — check "ยอดขาย Online S45 Clinic.xlsx" and src/data/adDaily.json.`);
    process.exit(1);
  }

  const outPath = path.resolve("src/data/funnelByMonth.json");
  writeFileSync(outPath, JSON.stringify({ generatedAt: new Date().toISOString(), minMonth: MIN_MONTH_ISO, months }, null, 2));
  console.log(`Wrote ${outPath} (months: ${Object.keys(months).sort().join(", ")})`);
}

main();
