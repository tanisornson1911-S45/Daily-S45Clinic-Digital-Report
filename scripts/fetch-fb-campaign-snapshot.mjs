#!/usr/bin/env node
/**
 * fetch-fb-campaign-snapshot.mjs
 * ---------------------------------------------------------------
 * Pulls the list of currently NON-DELETED Facebook ad campaigns (id + name +
 * effective_status — so both ACTIVE and PAUSED/off-but-not-deleted ones)
 * across all 7 ad accounts (same accounts as fetch-fb-spend.mjs's ACCOUNTS +
 * the dedicated Inter account), and diffs that list against yesterday's
 * snapshot (src/data/campaignSnapshot.json from the previous run) to find
 * which campaigns were turned on/off, or truly deleted, since yesterday.
 *
 * This feeds the "Monitor Ads" section of the daily LINE OA report
 * (scripts/send-line-report.mjs) — per user direction (2026-10-08, extended
 * 2026-10-19 to also report Off-but-not-deleted):
 *   - A campaign that's newly ACTIVE today (wasn't active yesterday) whose
 *     name contains "[Re-new]" -> listed under "[Re-new]"
 *   - A campaign that's newly ACTIVE today WITHOUT "[Re-new]" in its name ->
 *     listed under "[Ads ขึ้นใหม่]"
 *   - A campaign that was active yesterday and is GONE entirely today (not
 *     found in the API response at all — truly deleted/archived) whose name
 *     contained "[Re-new]" -> listed under "[ลบถาวร]" (per user's rule — only
 *     [Re-new] full deletions are tracked)
 *   - A campaign that was active yesterday and STILL EXISTS today but with a
 *     non-ACTIVE effective_status (e.g. PAUSED — turned off, not deleted) ->
 *     listed under "[Off - ปิดชั่วคราว ไม่ได้ลบ]", regardless of [Re-new] tag
 *     (added 2026-10-19 per user request to surface this case explicitly,
 *     since it used to be silently indistinguishable from "still active")
 *
 * Uses the Marketing API's /campaigns edge, NOT /insights — a campaign with
 * ฿0 spend on a given day still shows up here, which insights-based endpoints
 * would silently miss. No effective_status filter is applied on the request
 * itself (so the default scope — ACTIVE + PAUSED, excluding DELETED/ARCHIVED —
 * comes back), which is exactly what lets us tell "paused" apart from "truly
 * gone" by whether the campaign id still appears in the response at all.
 *
 * First-ever run (no previous snapshot file on disk): writes the snapshot
 * with an empty diff (nothing to compare against yet) rather than reporting
 * every currently-active campaign as "new".
 *
 * Run manually:
 *   FB_ACCESS_TOKEN=xxxx node scripts/fetch-fb-campaign-snapshot.mjs
 *
 * Run automatically: see .github/workflows/send-line-report.yml
 * ---------------------------------------------------------------
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

const FB_ACCESS_TOKEN = process.env.FB_ACCESS_TOKEN;
const API_VERSION = "v21.0";

if (!FB_ACCESS_TOKEN) {
  console.error("Missing FB_ACCESS_TOKEN environment variable.");
  process.exit(1);
}

// เหมือน fetch-fb-spend.mjs's ACCOUNTS — 6 บัญชีหมวดหลัก + บัญชี Inter เฉพาะทางแยกต่างหาก
const ACCOUNTS = {
  nose_open_01: { id: "2214227468912072", category: "nose_open" },
  nose_open_02: { id: "1117617719803706", category: "nose_open" },
  nose_open_freelance: { id: "221741759556998", category: "nose_open" },
  semi_open: { id: "983591777378317", category: "nose_semi" },
  breast: { id: "1948728392195994", category: "breast_lipo" },
  brow_facelift: { id: "225618075", category: "brow_hairline" },
  inter: { id: "1711014813661620", category: "inter" },
};

const INTER_NAME_MATCH = /inter/i;
const RENEW_TAG_RE = /\[re-new\]/i;

const CATEGORY_LABELS = {
  nose_open: "Nose Open",
  nose_semi: "เสริมจมูก Semi Open",
  breast_lipo: "เสริมหน้าอก/ดูดไขมัน",
  brow_hairline: "ยกคิ้ว/เลื่อนไรผม/ดึงหน้า",
  inter: "Inter",
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ดึงหนึ่งหน้า พร้อม retry (backoff 1s/2s/4s) สำหรับ error ชั่วคราว (rate limit ฯลฯ) — คืน null ถ้า fail
// ครบ 3 ครั้งแล้วยังไม่ได้ (ต่างจากเดิมที่ log error แล้ว break เงียบๆ จนได้ผลลัพธ์ไม่ครบไปปนกับของจริง)
async function fetchPage(url, accountId, pageNum) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(url);
    const json = await res.json();
    if (!json.error) return json;
    console.error(`  ! act_${accountId} page ${pageNum} attempt ${attempt}/3: ${json.error.message}`);
    if (attempt < 3) await sleep(1000 * 2 ** (attempt - 1));
  }
  return null;
}

// คืน { campaigns, complete } — complete=false หมายถึงบัญชีนี้ดึงไม่ครบ (error ค้างหลัง retry หรือโดนตัดหน้า
// กลางคัน) ต้องไม่เอาผลไม่ครบไปปนกับของจริงในการ diff (เคยทำให้แคมเปญที่ยังไม่ถูกลบจริงขึ้น "[ลบถาวร]" ผิดๆ
// เพราะหน้าที่ดึงไม่ทันไปอยู่ในหน้าที่ error ทิ้งไป — ผู้ใช้แจ้ง 2026-10-24: "วันนี้มี Ads ลบและขึ้นใหม่เยอะกว่านี้")
async function fetchCampaigns(accountId) {
  // ไม่ใส่ effective_status filter — ขอบเขต default ของ API คือ ACTIVE + PAUSED (ไม่รวม DELETED/ARCHIVED)
  // ซึ่งตรงกับที่ต้องการพอดี: แคมเปญที่ "ยังอยู่แต่ Off" จะโผล่มาเป็น PAUSED ส่วนแคมเปญที่ถูกลบจริงจะหายไปเลย
  const campaigns = {}; // { id: { name, status } }
  let url = new URL(`https://graph.facebook.com/${API_VERSION}/act_${accountId}/campaigns`);
  url.searchParams.set("fields", "id,name,effective_status");
  url.searchParams.set("limit", "200");
  url.searchParams.set("access_token", FB_ACCESS_TOKEN);

  let pageNum = 0;
  while (url) {
    pageNum++;
    const json = await fetchPage(url, accountId, pageNum);
    if (json === null) {
      console.error(`  ! act_${accountId}: giving up after page ${pageNum} failed 3x — marking account INCOMPLETE`);
      return { campaigns, complete: false };
    }
    for (const c of json.data || []) campaigns[c.id] = { name: c.name, status: c.effective_status };
    url = json.paging?.next ? new URL(json.paging.next) : null;
  }
  console.log(`  act_${accountId}: ${pageNum} page(s), ${Object.keys(campaigns).length} campaign(s)`);
  return { campaigns, complete: true };
}

function categoryFor(accountCategory, campaignName) {
  // แคมเปญชื่อมีคำว่า "Inter" ถือเป็นหมวด Inter เสมอ ไม่ว่าจะอยู่บัญชีไหน (เหมือน fetch-fb-spend.mjs)
  if (accountCategory !== "inter" && INTER_NAME_MATCH.test(campaignName)) return "inter";
  return accountCategory;
}

async function main() {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  const outPath = path.resolve("src/data/campaignSnapshot.json");
  const previous = existsSync(outPath) ? JSON.parse(readFileSync(outPath, "utf8")) : null;
  const previousCampaigns = previous?.campaigns || {};
  const isBootstrap = previous === null;

  // แคมเปญเก่า (ก่อน 2026-10-19) ไม่มี status บันทึกไว้ เพราะตอนนั้น fetch เฉพาะ ACTIVE เท่านั้น — ถ้าไม่มี
  // status ให้ถือว่าเป็น ACTIVE (สมมติฐานที่ถูกต้องสำหรับ snapshot เก่าแบบนั้น)
  const wasActiveYesterday = (prev) => (prev.status ?? "ACTIVE") === "ACTIVE";

  // { id: { name, category, status, account } } — รวมทั้ง ACTIVE และ PAUSED (ไม่ใช่แค่ ACTIVE แล้ว ตั้งแต่
  // 2026-10-19 เพื่อให้แยกออกว่าแคมเปญที่หายไปจาก snapshot คือ "ถูกลบจริง" ไม่ใช่แค่ "ถูก Off") — account เก็บไว้
  // ตั้งแต่ 2026-10-24 เพื่อให้รู้ได้ว่าแคมเปญเก่าเป็นของบัญชีไหน ตอนบัญชีนั้นดึงข้อมูลวันถัดไปไม่ครบ (ดู incompleteAccounts)
  const current = {};
  const incompleteAccounts = []; // accountName ที่ดึงไม่ครบ (error ค้างหลัง retry) — ดูคอมเมนต์ fetchCampaigns
  for (const [accountName, { id, category }] of Object.entries(ACCOUNTS)) {
    console.log(`Fetching campaigns for ${accountName}...`);
    const { campaigns, complete } = await fetchCampaigns(id);
    if (!complete) incompleteAccounts.push(accountName);
    for (const [campId, { name, status }] of Object.entries(campaigns)) {
      current[campId] = { name, category: categoryFor(category, name), status, account: accountName };
    }
  }
  const activeCount = Object.values(current).filter((c) => c.status === "ACTIVE").length;
  console.log(
    `Found ${Object.keys(current).length} campaign(s) (${activeCount} active) across ${Object.keys(ACCOUNTS).length} account(s).`
  );
  if (incompleteAccounts.length > 0) {
    console.warn(
      `INCOMPLETE fetch for: ${incompleteAccounts.join(", ")} — diff for these accounts' previously-known campaigns ` +
        "is skipped this run (can't tell real deletions from fetch gaps), new campaigns found are still reported."
    );
    // เติมแคมเปญเดิมของบัญชีที่ดึงไม่ครบกลับเข้า current (ถ้ามี account tag จาก snapshot ก่อนหน้า) เพื่อไม่ให้
    // snapshot วันนี้ที่ไม่ครบไปกลายเป็น baseline ของพรุ่งนี้ — ไม่งั้นพอพรุ่งนี้ดึงครบปกติ แคมเปญเดิมที่หายไปจาก
    // snapshot วันนี้ (เพราะดึงไม่ครบ ไม่ใช่เพราะถูกลบ) จะโผล่มาเป็น "ขึ้นใหม่"/"Re-new" ผิดๆ ซ้อนอีกชั้น
    let restored = 0;
    for (const [campId, prev] of Object.entries(previousCampaigns)) {
      if (prev.account && incompleteAccounts.includes(prev.account) && !current[campId]) {
        current[campId] = prev;
        restored++;
      }
    }
    if (restored > 0) console.warn(`  restored ${restored} campaign(s) from yesterday's snapshot for incomplete account(s).`);
  }

  const diff = { reNew: [], newAds: [], deletedReNew: [], turnedOff: [] };
  if (!isBootstrap) {
    for (const [campId, { name, category, status }] of Object.entries(current)) {
      if (status !== "ACTIVE") continue; // ไม่ใช่แคมเปญที่เพิ่งเปิดใหม่ (Active) วันนี้
      if (previousCampaigns[campId] && wasActiveYesterday(previousCampaigns[campId])) continue; // แอคทีฟอยู่แล้วเมื่อวาน ไม่ใช่ของใหม่
      const entry = { id: campId, name, category };
      if (RENEW_TAG_RE.test(name)) diff.reNew.push(entry);
      else diff.newAds.push(entry);
    }
    for (const [campId, prev] of Object.entries(previousCampaigns)) {
      if (!wasActiveYesterday(prev)) continue; // เมื่อวานก็ Off อยู่แล้ว ไม่ใช่การเปลี่ยนแปลงใหม่
      // บัญชีเดิมของแคมเปญนี้ดึงวันนี้ไม่ครบ -> ข้าม ไม่ตัดสินว่า "ลบ"/"Off" เพราะอาจแค่ไม่ได้ถูกดึงมา ไม่ใช่หายไปจริง
      // (snapshot เก่าก่อน 2026-10-24 ไม่มี prev.account บันทึกไว้ -> ข้ามการป้องกันนี้ไม่ได้สำหรับรอบแรกหลังอัปเดต)
      if (prev.account && incompleteAccounts.includes(prev.account)) continue;
      if (!current[campId]) {
        // หายไปจาก API เลย = ถูกลบ/archived จริง (ไม่ใช่แค่ Off)
        if (RENEW_TAG_RE.test(prev.name)) diff.deletedReNew.push({ id: campId, name: prev.name, category: prev.category });
      } else if (current[campId].status !== "ACTIVE") {
        // ยังอยู่ในระบบ แต่ไม่ใช่ ACTIVE แล้ว = ถูก Off ไม่ได้ลบ
        diff.turnedOff.push({
          id: campId,
          name: current[campId].name,
          category: current[campId].category,
          status: current[campId].status,
        });
      }
    }
  } else {
    console.log("No previous snapshot found — first run, writing baseline (no diff reported).");
  }

  writeFileSync(
    outPath,
    JSON.stringify(
      {
        generatedAt: now.toISOString(),
        source:
          "Generated by scripts/fetch-fb-campaign-snapshot.mjs (Facebook Marketing API /campaigns edge, no effective_status " +
          "filter -> default scope ACTIVE+PAUSED, excludes DELETED/ARCHIVED, across all 7 ad accounts — same accounts as " +
          "adSpend.json). campaigns = today's full non-deleted-campaign snapshot incl. status (becomes tomorrow's run's " +
          "'yesterday' to diff against). diff = changes since the previous run's snapshot — reNew (newly ACTIVE today, name " +
          'has "[Re-new]"), newAds (newly ACTIVE today, no tag), deletedReNew (active yesterday, gone entirely from the API ' +
          'today i.e. truly deleted/archived, had "[Re-new]" tag — other full deletions aren\'t tracked, per user direction ' +
          "2026-10-08), turnedOff (active yesterday, still exists today but effective_status != ACTIVE i.e. paused/off, NOT " +
          "deleted — any name, added 2026-10-19 per user request). incompleteAccounts (added 2026-10-24, per user report " +
          'that a day\'s real ad churn was undercounted) = account names whose /campaigns fetch failed 3x even with retry ' +
          "this run — diff for their previously-known campaigns is skipped (can't tell a real deletion from a fetch gap), " +
          "so Monitor Ads may be undercounted for these accounts specifically that day. Feeds the \"Monitor Ads\" section " +
          "of the daily LINE OA report (scripts/send-line-report.mjs).",
        date: today,
        campaigns: current,
        diff,
        incompleteAccounts,
        categoryLabels: CATEGORY_LABELS,
      },
      null,
      2
    )
  );
  console.log(
    `Wrote ${outPath} (reNew: ${diff.reNew.length}, newAds: ${diff.newAds.length}, deletedReNew: ${diff.deletedReNew.length}, turnedOff: ${diff.turnedOff.length}, incompleteAccounts: ${incompleteAccounts.length})`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
