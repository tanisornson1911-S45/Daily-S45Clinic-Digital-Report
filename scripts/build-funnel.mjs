#!/usr/bin/env node
/**
 * build-funnel.mjs
 * ---------------------------------------------------------------
 * Builds FUNNEL_DATA_AUG-shaped daily Ads→Inbox→Sales funnel data
 * (src/data/funnelAug.json) for the Inbox & Bad Lead page, the same
 * way FUNNEL_DATA_JUL was originally hand-derived in App.jsx:
 *
 *   dailyAds / dailyInbox   <- src/data/m365Raw.json, workbook
 *                              "online_sales_daily" (the
 *                              "ยอดขาย Online S45 Clinic.xlsx" file),
 *                              sheet "ส.ค.69" — real daily numbers,
 *                              read directly (see parseSheet below).
 *   dailyConsult/dailyDeposit/dailyOr/dailyOrCases
 *                           <- derived from src/data/rawTx.json
 *                              (the same "มัดจำ 2026" ledger RAW_TX
 *                              uses), because that sheet's own
 *                              consult/deposit/OR rows are all 0 for
 *                              August (not filled in real time — same
 *                              situation the FUNNEL_DATA_JUL comment
 *                              in App.jsx documents for July).
 *   sales/basket/closeRate/adsCost/adsCostOr
 *                           <- same formulas FUNNEL_DATA_JUL used:
 *                              sales = sum of Total price (fallback
 *                              Online price) for cases with Deposit>0
 *                              or a Sale Consult name filled, counted
 *                              once each; basket = sales/closedCount;
 *                              closeRate = closedCount/inbox;
 *                              adsCost = ads/sales; adsCostOr = ads/or.
 *
 * "inter" has no separate rows in rawTx.json (Inter cases are folded
 * into nose_open there — see App.jsx comments near CATEGORIES), so
 * its consult/deposit/or/sales stay null, same as FUNNEL_DATA_JUL.
 *
 * Run manually (after fetch-m365-data.mjs + build-raw-tx.mjs):
 *   node scripts/build-funnel.mjs
 * ---------------------------------------------------------------
 */

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const MONTH_ISO = "2026-08";
const SHEET_NAME = "ส.ค.69";
const LABEL = "รวมทุกหัตถการ";

// Fixed block order in the sheet: label row, then "ยอดยิง Ads", then "Inbox".
const BLOCK_KEYS = ["nose_open", "nose_semi", "breast_lipo", "brow_hairline", "inter", "all"];
const BLOCK_LABELS = {
  nose_open: "เสริมจมูกโอเพ่น (Nose Open)",
  nose_semi: "เสริมจมูก Semi Open",
  breast_lipo: "เสริมหน้าอก/ดูดไขมัน",
  brow_hairline: "ยกคิ้ว/เลื่อนไรผม/ยกมุมปาก",
  inter: "Inter",
  all: LABEL,
};

function parseSheet(sheet) {
  // Find every row whose col0 is a non-empty string label immediately followed
  // by a "ยอดยิง Ads" row and an "Inbox" row two rows down — that's a category block.
  const blockStarts = [];
  for (let i = 0; i < sheet.length - 2; i++) {
    if (typeof sheet[i][0] === "string" && sheet[i][0].trim() !== "" && sheet[i + 1][0] === "ยอดยิง Ads" && sheet[i + 2][0] === "Inbox") {
      blockStarts.push(i);
    }
  }
  if (blockStarts.length !== BLOCK_KEYS.length) {
    throw new Error(`Expected ${BLOCK_KEYS.length} category blocks in sheet "${SHEET_NAME}", found ${blockStarts.length}.`);
  }

  const toNum = (v) => (typeof v === "number" ? v : null);
  const blocks = {};
  blockStarts.forEach((rowIdx, i) => {
    const key = BLOCK_KEYS[i];
    const adsRow = sheet[rowIdx + 1];
    const inboxRow = sheet[rowIdx + 2];
    // col0 = label, col1 = cumulative-to-date total, col2..col32 = days 1-31.
    const dailyAdsFull = adsRow.slice(2).map(toNum);
    const dailyInboxFull = inboxRow.slice(2).map(toNum);
    blocks[key] = {
      adsTotal: toNum(adsRow[1]),
      inboxTotal: toNum(inboxRow[1]),
      dailyAdsFull,
      dailyInboxFull,
    };
  });
  return blocks;
}

function main() {
  const m365Path = path.resolve("src/data/m365Raw.json");
  const m365 = JSON.parse(readFileSync(m365Path, "utf8"));
  const sheet = m365.workbooks?.online_sales_daily?.[SHEET_NAME];
  if (!sheet) {
    console.error(`Could not find workbooks.online_sales_daily["${SHEET_NAME}"] in src/data/m365Raw.json.`);
    process.exit(1);
  }
  const blocks = parseSheet(sheet);

  // Real coverage = the run of non-null daily values from day 1 (the sheet leaves
  // future days blank until the team fills them in). The sheet's own "รวมหัตถการ"
  // total row has broken #REF! formulas in places, so measure off the 5 real
  // category rows instead and take the minimum — keeps every array the same length
  // without fabricating a day none of the 5 actually has data for yet.
  const realKeys = ["nose_open", "nose_semi", "breast_lipo", "brow_hairline", "inter"];
  const coverageOf = (arr) => {
    let n = 0;
    while (n < 31 && arr[n] != null) n++;
    return n;
  };
  const daysWithData = Math.min(...realKeys.map((k) => coverageOf(blocks[k].dailyAdsFull)));
  console.log(`Real daily coverage: ${daysWithData} day(s) of ${MONTH_ISO}.`);

  const rawTxPath = path.resolve("src/data/rawTx.json");
  const rawTx = JSON.parse(readFileSync(rawTxPath, "utf8"));
  const monthTx = rawTx.filter((t) => t.d.startsWith(MONTH_ISO));

  const out = {};
  const closeCounts = {};
  for (const key of realKeys) {
    const b = blocks[key];
    const dailyAds = b.dailyAdsFull.slice(0, daysWithData);
    const dailyInbox = b.dailyInboxFull.slice(0, daysWithData);

    if (key === "inter") {
      // No separate "inter" tag in rawTx.json (Inter cases are folded into
      // nose_open there — see App.jsx comments near CATEGORIES/GRAND_TOTAL), so
      // consult/deposit/OR/sales can't be derived for it, same as FUNNEL_DATA_JUL.
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
    const dailyConsult = new Array(daysWithData).fill(0);
    const dailyDeposit = new Array(daysWithData).fill(0);
    const dailyOr = new Array(daysWithData).fill(0);
    const dailyOrCases = new Array(daysWithData).fill(0);

    const dayIndex = (iso) => {
      const day = Number(iso.slice(8, 10));
      return day >= 1 && day <= daysWithData ? day - 1 : -1;
    };

    let closedCount = 0;
    let sales = 0;
    let orTotal = 0;
    // FUNNEL_CLOSE_COUNTS_JUL-shaped: consult = cases with a Sale Consult name,
    // deposit = cases with Deposit > 0, counted (and valued) separately — not the
    // same as the merged closedCount/sales above, which counts each case once.
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
        const oi = dayIndex(t.or);
        if (oi >= 0) {
          dailyOr[oi] += amt;
          dailyOrCases[oi]++;
        }
        orTotal += amt;
      }
      if (t.dep > 0 || t.cons) {
        closedCount++;
        sales += amt;
      }
    }

    // Sum from the truncated daily arrays, not the sheet's own cumulative column1
    // (which can reflect a different "as of" day per category) — keeps the
    // displayed total consistent with the daily bars, same convention as FUNNEL_DATA_JUL.
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
      _closedCount: closedCount, // internal only, used to derive "all" below; stripped before writing
    };
    closeCounts[key] = { consult: consultCount, deposit: depositCount, consultValue, depositValue };
  }

  // "all" = same convention as FUNNEL_DATA_JUL.all in App.jsx: ads/inbox/dailyAds/
  // dailyInbox sum ALL 5 categories (incl. inter); or/sales/dailyOr/dailyConsult/
  // dailyDeposit/dailyOrCases sum only the 4 non-inter categories (inter's are
  // null); basket/closeRate/adsCost/adsCostOr are then derived the same formulas.
  const nonInter = ["nose_open", "nose_semi", "breast_lipo", "brow_hairline"];
  const sumArr = (arrs) => arrs[0].map((_, i) => arrs.reduce((s, a) => s + a[i], 0));
  const allAds = realKeys.reduce((s, k) => s + out[k].ads, 0);
  const allInbox = realKeys.reduce((s, k) => s + out[k].inbox, 0);
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
    dailyAds: sumArr(realKeys.map((k) => out[k].dailyAds)),
    dailyInbox: sumArr(realKeys.map((k) => out[k].dailyInbox)),
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

  const outPath = path.resolve("src/data/funnelAug.json");
  writeFileSync(
    outPath,
    JSON.stringify({ generatedAt: new Date().toISOString(), daysWithData, data: out, closeCounts }, null, 2)
  );
  console.log(`Wrote ${outPath}`);
  for (const key of BLOCK_KEYS) {
    console.log(key, JSON.stringify({ ads: out[key].ads, inbox: out[key].inbox, sales: out[key].sales, closeRate: out[key].closeRate }));
  }
}

main();
