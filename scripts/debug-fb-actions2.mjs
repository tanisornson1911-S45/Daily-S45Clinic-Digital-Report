#!/usr/bin/env node
/**
 * TEMPORARY diagnostic — compare messaging_conversation_started_7d vs
 * total_messaging_connection against the team's own Ads Insight dashboard
 * numbers for nose_open (01+02+Freelance) on 2026-08-27:
 *   spend = 45,200.68, Total Messaging Contacts = 133
 */
const FB_ACCESS_TOKEN = process.env.FB_ACCESS_TOKEN;
const API_VERSION = "v21.0";
const ACCOUNTS = {
  nose_open_01: "2214227468912072",
  nose_open_02: "1117617719803706",
  nose_open_freelance: "221741759556998",
};
const DATE = "2026-08-27";

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
  let totalSpend = 0;
  let totalMsgStarted = 0;
  let totalMsgConnection = 0;
  for (const [name, id] of Object.entries(ACCOUNTS)) {
    console.log(`\n=== ${name} (${id}) ===`);
    const row = await fetchActions(id);
    if (!row) {
      console.log("  no data");
      continue;
    }
    const spend = row.spend ? parseFloat(row.spend) : 0;
    totalSpend += spend;
    console.log(`  spend: ${spend}`);
    const actions = row.actions || [];
    for (const a of actions) console.log(`    ${a.action_type} = ${a.value}`);
    const started = actions.find((a) => a.action_type === "onsite_conversion.messaging_conversation_started_7d");
    const connection = actions.find((a) => a.action_type === "onsite_conversion.total_messaging_connection");
    if (started) totalMsgStarted += Number(started.value);
    if (connection) totalMsgConnection += Number(connection.value);
    console.log(`  >> messaging_conversation_started_7d: ${started?.value ?? "n/a"}`);
    console.log(`  >> total_messaging_connection: ${connection?.value ?? "n/a"}`);
  }
  console.log(`\n============================================`);
  console.log(`TOTAL spend (3 nose_open accounts, ${DATE}): ${totalSpend}`);
  console.log(`TOTAL messaging_conversation_started_7d: ${totalMsgStarted}`);
  console.log(`TOTAL total_messaging_connection: ${totalMsgConnection}`);
  console.log(`Team's Ads Insight dashboard reports: spend 45,200.68, Total Messaging Contacts 133`);
  console.log(`============================================`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
