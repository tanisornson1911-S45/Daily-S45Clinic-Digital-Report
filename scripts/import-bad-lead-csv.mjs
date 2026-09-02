#!/usr/bin/env node
/**
 * import-bad-lead-csv.mjs
 * ---------------------------------------------------------------
 * One-off importer for a manually-exported Plus Connect "Contacts" CSV
 * (e.g. "Contacts_02092026.csv") into src/data/badLead.json — same output
 * shape as scripts/build-bad-lead.mjs (which runs nightly from the
 * SharePoint "Bad Lead [Plus Connect]" workbook), but reads a full,
 * unfiltered contacts export instead: every contact on the page, not just
 * ones already tagged "คุณสมบัติไม่ครบ". This script filters down to that
 * tag itself, exactly like the sheet the automated pipeline reads is
 * already pre-filtered to.
 *
 * NOTE: this is a manual, one-time refresh — there is no API to re-fetch
 * this exact "Contacts" CSV automatically. The nightly update-m365-data.yml
 * workflow will overwrite src/data/badLead.json again on its next run,
 * regenerated from the SharePoint sheet as usual (same underlying data,
 * refreshed automatically). Run this script again by hand whenever a newer
 * CSV export is available and you want to top up sooner than the next
 * scheduled run.
 *
 * PRIVACY: same as build-bad-lead.mjs — only non-identifying fields
 * (date, platform, channel, tags, assignee, blocked) are kept; name/phone/
 * email/profile picture/social links/psid/line_user_id are dropped.
 *
 * Run manually:
 *   node scripts/import-bad-lead-csv.mjs <path-to-csv>
 * ---------------------------------------------------------------
 */

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const csvPath = process.argv[2];
if (!csvPath) {
  console.error("Usage: node scripts/import-bad-lead-csv.mjs <path-to-csv>");
  process.exit(1);
}

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "June", "July"];
const CALENDAR_TAG_RE = /^(\d{4}|\d{1,2})$/; // bare year or bare day-of-month
const REDUNDANT_TAGS = new Set(["คุณสมบัติไม่ครบ"]); // true for every row by definition — not informative per-row
const BAD_LEAD_TAG = "คุณสมบัติไม่ครบ";

// RFC4180-ish CSV parser (handles quoted fields with embedded commas/quotes/newlines — this
// export's "contactslink"/"page_configs" columns are JSON blobs full of commas inside quotes,
// so a naive line.split(",") would corrupt every row).
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  const n = text.length;
  while (i < n) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === ",") {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (c === "\r") {
      i++;
      continue;
    }
    if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
      continue;
    }
    field += c;
    i++;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function parseAnyDateToIso(value) {
  if (value == null || value === "") return null;
  const iso = value.length >= 10 ? value.slice(0, 10) : null;
  if (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return null;
}

function main() {
  const raw = readFileSync(csvPath, "utf8").replace(/^﻿/, ""); // strip BOM
  const rows = parseCsv(raw);
  const header = rows[0];
  const col = Object.fromEntries(header.map((h, i) => [h, i]));
  const dataRows = rows.slice(1).filter((r) => r.some((c) => c !== "" && c != null));

  const leads = [];
  const skipped = [];
  let notBadLead = 0;
  for (const r of dataRows) {
    const rawTags = typeof r[col.tags] === "string" ? r[col.tags].split(",").map((t) => t.trim()).filter(Boolean) : [];
    if (!rawTags.includes(BAD_LEAD_TAG)) {
      notBadLead++;
      continue; // เฉพาะ contact ที่ติดแท็ก "คุณสมบัติไม่ครบ" เท่านั้นถือเป็น Bad Lead — เหมือน sheet ที่ pipeline อัตโนมัติใช้
    }
    const d = parseAnyDateToIso(r[col.created_at]);
    if (!d) {
      skipped.push(r);
      continue;
    }
    const meaningfulTags = rawTags.filter((t) => !CALENDAR_TAG_RE.test(t) && !MONTH_ABBR.includes(t) && !REDUNDANT_TAGS.has(t));
    leads.push({
      d,
      platform: r[col.platform] || null,
      channel: r[col.channel_name] || null,
      assignee: r[col.assignees] || null,
      blocked: String(r[col.blocked]).toUpperCase() === "TRUE",
      junk: rawTags.includes("ขยะ"),
      tags: meaningfulTags,
    });
  }
  leads.sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0));

  console.log(`Parsed ${dataRows.length} contact rows (${notBadLead} without "${BAD_LEAD_TAG}" tag skipped).`);
  if (skipped.length > 0) {
    console.warn(`Skipped ${skipped.length} row(s) with no parseable created_at.`);
  }

  const outPath = path.resolve("src/data/badLead.json");
  writeFileSync(
    outPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        source:
          `Manually imported by scripts/import-bad-lead-csv.mjs from a Plus Connect "Contacts" export ` +
          `(${path.basename(csvPath)}) filtered to contacts tagged "${BAD_LEAD_TAG}". One-time snapshot — ` +
          "the nightly update-m365-data.yml workflow regenerates this file automatically from the " +
          '"Bad Lead [Plus Connect]" SharePoint sheet on its normal schedule, same underlying data. PII ' +
          "columns (name/phone/email/profile picture/social links) are intentionally excluded.",
        leads,
      },
      null,
      2
    )
  );
  console.log(`Wrote ${outPath} (${leads.length} leads)`);
}

main();
