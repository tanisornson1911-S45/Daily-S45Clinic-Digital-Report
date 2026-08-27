#!/usr/bin/env node
/**
 * TEMPORARY diagnostic script — NOT part of the regular pipeline.
 * Fetches the raw Facebook Marketing API "actions" breakdown (the same data
 * Ads Manager's own report columns use, e.g. "Messaging conversations started")
 * for the 3 nose_open ad accounts on a single day, and compares the summed
 * messaging_conversation_started count against the internal spreadsheet's
 * reported Inbox number for that day, to check whether they agree.
 *
 * Run manually: FB_ACCESS_TOKEN=xxxx node scripts/debug-fb-actions.mjs
 */

const FB_ACCESS_TOKEN = process.env.FB_ACCESS_TOKEN;
const API_VERSION = "v21.0";

if (!FB_ACCESS_TOKEN) {
  console.error("Missing FB_ACCESS_TOKEN environment variable.");
  process.exit(1);
}

const ACCOUNTS = {
  nose_open_01: "2214227468912072",
  nose_open_02: "1117617719803706",
  nose_open_freelance: "221741759556998",
};

const DATE = "2026-08-24";
const INTERNAL_INBOX_FOR_DATE = 109; // ยอด Inbox nose_open ตามชีตทีม Digital วันที่ 24 ส.ค. 2569

async function fetchActions(accountId) {
  const url = new URL(`https://graph.facebook.com/${API_VERSION}/act_${accountId}/insights`);
  url.searchParams.set("level", "account");
  url.searchParams.set("fields", "spend,actions");
  url.searchParams.set("time_range", JSON.stringify({ since: DATE, until: DATE }));
  url.searchParams.set("access_token", FB_ACCESS_TOKEN);

  const res = await fetch(url);
  const json = await res.json();
  if (json.error) {
    console.error(`  ! ${accountId}: ${json.error.message}`);
    return null;
  }
  return json.data?.[0] || null;
}

async function main() {
  let totalMsg = 0;
  let anyFound = false;

  for (const [name, id] of Object.entries(ACCOUNTS)) {
    console.log(`\n=== ${name} (${id}) ===`);
    const row = await fetchActions(id);
    if (!row) {
      console.log("  no data returned");
      continue;
    }
    console.log(`  spend: ${row.spend ?? "n/a"}`);
    const actions = row.actions || [];
    console.log(`  raw actions (${actions.length}):`);
    for (const a of actions) {
      console.log(`    ${a.action_type} = ${a.value}`);
    }
    const msgAction = actions.find(
      (a) =>
        a.action_type === "onsite_conversion.messaging_conversation_started_7d" ||
        a.action_type === "onsite_conversion.messaging_conversation_started"
    );
    if (msgAction) {
      console.log(`  >> messaging_conversation_started: ${msgAction.value}`);
      totalMsg += Number(msgAction.value);
      anyFound = true;
    } else {
      console.log("  >> messaging_conversation_started: not present in actions array");
    }
  }

  console.log(`\n============================================`);
  console.log(`TOTAL messaging_conversation_started (raw actions, all 3 nose_open accounts, ${DATE}): ${anyFound ? totalMsg : "N/A"}`);
  console.log(`Internal spreadsheet Inbox for nose_open on ${DATE}: ${INTERNAL_INBOX_FOR_DATE}`);
  console.log(`============================================`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
