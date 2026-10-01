#!/usr/bin/env node
/**
 * build-bad-lead.mjs
 * ---------------------------------------------------------------
 * Transforms the "Lead Plus Connect.xlsx" workbook (src/data/m365Raw.json,
 * refreshed daily by scripts/fetch-m365-data.mjs — WORKBOOKS.lead_plus_connect,
 * sheets: "auto") into src/data/badLead.json, which src/App.jsx imports for
 * the Inbox & Bad Lead page's Bad Lead/Lead-tag cards.
 *
 * SOURCE FILE HISTORY:
 * - Originally "Bad Lead [Plus Connect].xlsx" — replaced 2026-09-02 (per user
 *   direction) after it turned out to be a filtered/stale export missing real
 *   leads (a same-day manual CSV export had 160 Bad Lead rows vs its 158).
 * - Then "[Lead] Plus Connect.csv" — Plus Connect's full "Contacts" export as
 *   one flat CSV, every contact on the page (6,546 as of 2026-09-02).
 * - Then (2026-09-16, per user direction) the team switched to an Excel
 *   workbook with one sheet per month ("สิงหาคม", "กันยายน", ... — a new sheet
 *   added every month going forward) instead of one flat CSV. IMPORTANT: the
 *   first sheet, "สิงหาคม", turned out to hold the FULL cumulative history
 *   (6,546 rows, dating back to 2025-12-17) rather than just August's leads —
 *   so this script can't assume "one sheet = that month's leads only" is
 *   guaranteed going forward either. To be correct regardless of which sheet
 *   holds the freshest snapshot of a given contact, it reads every sheet and
 *   de-duplicates by the source "id" column (Plus Connect's own contact id),
 *   keeping whichever row has the LATEST "updated_at" timestamp for that id
 *   (not whichever sheet is iterated last — see the 2026-10-01 incident
 *   below for why that distinction matters).
 *
 * - 2026-10-01 incident: this script originally let a later-iterated sheet's
 *   row win a same-id conflict unconditionally (sheet order, not recency).
 *   That was a safe proxy for "most recently updated" ONLY as long as the
 *   team kept refreshing sheets in a consistent chronological name order.
 *   On this date the team refreshed "สิงหาคม" (now a full export through
 *   2026-09-30) while "กันยายน" stayed a stale snapshot frozen at 2026-09-16
 *   — but "กันยายน" still iterates after "สิงหาคม" (object key order), so the
 *   old sheet-order rule would have silently reverted every lead that exists
 *   in both sheets back to its 2026-09-16 state (wrong tags/assignee for any
 *   lead touched between 09-16 and 09-30), even though the newer data was
 *   sitting right there in "สิงหาคม". Comparing "updated_at" directly fixes
 *   this and is correct under any future sheet-naming/refresh pattern.
 *
 * Per user direction (2026-09-02, second round): keep EVERY contact here,
 * not just ones tagged "คุณสมบัติไม่ครบ" — the Tag/"no tag" breakdown in
 * App.jsx must be computed against every incoming lead, not a pre-filtered
 * Bad Lead subset. "คุณสมบัติไม่ครบ" (how the Digital team marks a Bad Lead —
 * see App.jsx's "แผนการดำเนินงานของ Digital ต่อการลดจำนวน Bad Lead" section,
 * step 1) is kept as an ordinary tag in each lead's `tags` array instead of
 * being stripped out or used as a row filter — App.jsx's Tag dropdown lets
 * a viewer select it to see the Bad-Lead-specific subset on demand, same as
 * any other tag.
 *
 * Replaces the old hand-curated BAD_LEAD_TOTAL = 159 (hardcoded, July-only)
 * and the 6 hardcoded sample chat screenshots with real per-lead rows —
 * date-range filterable in App.jsx the same way RAW_TX is.
 *
 * PRIVACY: the source file also has name/first_name/last_name/phone_number/
 * profile_pic/account_name/social_name/email/psid/line_user_id — none of
 * that is carried into badLead.json. Only non-identifying fields (date,
 * platform, channel, tags, assignee, blocked) are kept.
 *
 * The "tags" column mixes real categories (e.g. "ขยะ" for junk/spam,
 * "คุณสมบัติไม่ครบ" for Bad Lead, procedure/campaign hints like "Facelift" or
 * a doctor's name) with auto-added calendar-component tags (a bare year
 * "2026", an English month abbreviation, a bare day-of-month number) that
 * aren't real categories — CALENDAR_TAG_RE below filters only those out
 * before writing meaningfulTags. A lead can end up with zero meaningful
 * tags (never manually tagged with anything beyond the auto calendar tags)
 * — App.jsx's tag Dropdown filter has a "ไม่มี Tag" option for exactly that.
 *
 * Run manually:
 *   node scripts/build-bad-lead.mjs
 *
 * Run automatically: see .github/workflows/update-m365-data.yml
 * ---------------------------------------------------------------
 */

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "June", "July"];
const CALENDAR_TAG_RE = /^(\d{4}|\d{1,2})$/; // bare year or bare day-of-month

function excelDate(s) {
  if (typeof s !== "number") return null;
  const dt = new Date(Math.round((s - 25569) * 86400 * 1000));
  return dt.toISOString().slice(0, 10);
}

function excelDateTime(s) {
  if (typeof s !== "number") return null;
  const dt = new Date(Math.round((s - 25569) * 86400 * 1000));
  return dt.toISOString();
}

// created_at came back as an ISO datetime string when explored via the document reader, but the
// raw Graph API usedRange(valuesOnly=true) call this script actually uses can return a date cell
// as either a serial number or a string depending on the cell's format — handle both.
function parseAnyDateToIso(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number") return excelDate(value);
  if (typeof value === "string") {
    const iso = value.length >= 10 ? value.slice(0, 10) : null;
    if (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  }
  return null;
}

// เหมือน parseAnyDateToIso แต่คงเวลาไว้เต็ม (ไม่ตัดเหลือแค่วันที่) — ใช้กับ "updated_at" ที่ต้องเทียบความใหม่
// ระดับวินาทีระหว่างแถวของ id เดียวกันที่มาจากคนละชีต (อัปเดตวันเดียวกันหลายครั้งได้ ตัดเหลือวันที่เดียวจะเทียบไม่ออก)
function parseAnyDateTimeToIso(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number") return excelDateTime(value);
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return null;
}

function main() {
  const m365Path = path.resolve("src/data/m365Raw.json");
  const m365 = JSON.parse(readFileSync(m365Path, "utf8"));

  const sheets = m365.workbooks?.lead_plus_connect;
  const sheetNames = sheets ? Object.keys(sheets) : [];
  if (!sheets || sheetNames.length === 0) {
    console.error('Could not find any sheets in the "lead_plus_connect" workbook in src/data/m365Raw.json.');
    process.exit(1);
  }

  // รวมทุกชีตแล้ว dedupe ด้วย "id" ของ Plus Connect — เทียบ "updated_at" ของแต่ละแถว ใครใหม่กว่าคนนั้นชนะ
  // (ไม่ใช่ชีตไหนมาทีหลังในลำดับ object key — ดูคอมเมนต์หัวไฟล์ เหตุการณ์ 2026-10-01 ว่าทำไมใช้ลำดับชีตเฉยๆ ไม่พอ)
  const leadsById = new Map(); // id -> { updatedAt, lead }
  const skipped = [];
  let totalRows = 0;
  for (const sheetName of sheetNames) {
    const sheet = sheets[sheetName];
    if (!sheet || sheet.length === 0) {
      console.warn(`  ! Sheet "${sheetName}" is empty — skipping.`);
      continue;
    }
    const header = sheet[0];
    const col = Object.fromEntries(header.map((h, i) => [h, i]));
    const rows = sheet.slice(1).filter((r) => r.some((c) => c !== "" && c != null));
    totalRows += rows.length;
    for (const r of rows) {
      const d = parseAnyDateToIso(r[col.created_at]);
      if (!d) {
        skipped.push(r);
        continue;
      }
      const rawTags = typeof r[col.tags] === "string" ? r[col.tags].split(",").map((t) => t.trim()).filter(Boolean) : [];
      const meaningfulTags = rawTags.filter((t) => !CALENDAR_TAG_RE.test(t) && !MONTH_ABBR.includes(t));
      // fallback key ถ้าแถวไหนไม่มีคอลัมน์ "id" จริงๆ (ไม่ควรเกิดกับไฟล์จริง) กันไม่ให้ id ที่เป็น undefined
      // ทุกแถวถูกมองว่าเป็นคนเดียวกันแล้วทับกันหมด
      const id = r[col.id] ?? `${sheetName}:${totalRows}:${leadsById.size}`;
      // updated_at ว่าง/parse ไม่ได้ (ไม่ควรเกิด) ถือว่าเก่าที่สุด (empty string < ISO string ใดๆ) แทนที่จะ throw ทิ้งแถวไป
      const updatedAt = parseAnyDateTimeToIso(r[col.updated_at]) ?? "";
      const existing = leadsById.get(id);
      if (existing && existing.updatedAt > updatedAt) continue; // แถวที่มีอยู่ใหม่กว่าแถวนี้ — ข้าม ไม่ทับ
      leadsById.set(id, {
        updatedAt,
        lead: {
          d,
          platform: r[col.platform] || null,
          channel: r[col.channel_name] || null,
          assignee: r[col.assignees] || null,
          blocked: String(r[col.blocked]).toUpperCase() === "TRUE",
          junk: rawTags.includes("ขยะ"),
          tags: meaningfulTags,
        },
      });
    }
  }
  const leads = [...leadsById.values()].map((v) => v.lead);
  leads.sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0));

  console.log(`Parsed ${totalRows} contact rows across ${sheetNames.length} sheet(s) (${sheetNames.join(", ")}) into ${leads.length} unique leads.`);
  if (skipped.length > 0) {
    console.warn(`Skipped ${skipped.length} row(s) with no parseable created_at:`);
    for (const r of skipped) console.warn("  ", JSON.stringify(r));
  }

  const outPath = path.resolve("src/data/badLead.json");
  writeFileSync(
    outPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        source:
          'Generated by scripts/build-bad-lead.mjs from the "Lead Plus Connect.xlsx" SharePoint workbook ' +
          `(sheets: ${sheetNames.join(", ")} — one per month, auto-discovered, de-duplicated by contact id ` +
          "across sheets keeping whichever row has the latest \"updated_at\" timestamp per id; full Plus " +
          'Connect "Contacts" export — every contact, not just ones tagged ' +
          '"คุณสมบัติไม่ครบ"; that tag is kept in each lead\'s own tags array so it can be filtered on in ' +
          "App.jsx like any other tag). PII columns (name/phone/email/profile picture/social links) are " +
          "intentionally excluded.",
        leads,
      },
      null,
      2
    )
  );
  console.log(`Wrote ${outPath} (${leads.length} leads, ${skipped.length} skipped)`);
}

main();
