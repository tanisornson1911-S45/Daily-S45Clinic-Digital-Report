// Vercel serverless function — pulls the last 30 days of insights from the
// Meta Graph API using a System User token (server-side only, never exposed
// to the browser) and upserts them into Supabase. Triggered by vercel.json's
// cron schedule, or manually via POST for a "sync now" button.
//
// Required env vars (Vercel Project Settings -> Environment Variables):
//   FB_SYSTEM_USER_TOKEN   Long-lived Meta System User access token with
//                          ads_read on the ad accounts below.
//   FB_AD_ACCOUNT_IDS      Comma-separated ad account ids, no "act_" prefix.
//   SUPABASE_URL           Same project as VITE_SUPABASE_URL.
//   SUPABASE_SERVICE_ROLE_KEY  Service-role key (bypasses RLS) — server only.
//
// See supabase/schema.sql for the tables this writes to, and .env.example
// for the full list of variables this project uses.

import { createClient } from "@supabase/supabase-js";

const GRAPH_VERSION = "v20.0";

async function graphGet(path, params, token) {
  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  url.searchParams.set("access_token", token);
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message || `Graph API error on ${path}`);
  return json;
}

function actionCount(actions, type) {
  const row = (actions || []).find((a) => a.action_type === type);
  return row ? Math.round(Number(row.value)) : 0;
}

export default async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const token = process.env.FB_SYSTEM_USER_TOKEN;
  const accountIds = (process.env.FB_AD_ACCOUNT_IDS || "").split(",").map((s) => s.trim()).filter(Boolean);
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!token || !accountIds.length || !supabaseUrl || !serviceKey) {
    return res.status(500).json({
      error: "Missing FB_SYSTEM_USER_TOKEN, FB_AD_ACCOUNT_IDS, SUPABASE_URL, or SUPABASE_SERVICE_ROLE_KEY",
    });
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const today = new Date().toISOString().slice(0, 10);

  try {
    for (const accountId of accountIds) {
      const account = await graphGet(`act_${accountId}`, { fields: "name,currency" }, token);
      await supabase.from("ad_accounts").upsert({
        id: accountId,
        name: account.name,
        currency: account.currency,
        updated_at: new Date().toISOString(),
      });

      const accountInsights = await graphGet(
        `act_${accountId}/insights`,
        { fields: "spend,impressions,reach,clicks,ctr,actions", date_preset: "last_30d" },
        token
      );
      const row = accountInsights.data?.[0];
      if (row) {
        await supabase.from("insights_daily").upsert({
          entity_level: "account",
          entity_id: accountId,
          account_id: accountId,
          date: today,
          spend: Number(row.spend || 0),
          impressions: Number(row.impressions || 0),
          reach: Number(row.reach || 0),
          clicks: Number(row.clicks || 0),
          ctr: Number(row.ctr || 0),
          messaging_conversations: actionCount(row.actions, "onsite_conversion.messaging_conversation_started_7d"),
          purchases: actionCount(row.actions, "omni_purchase"),
        });
      }

      const campaigns = await graphGet(
        `act_${accountId}/campaigns`,
        { fields: "id,name,status,daily_budget", limit: "200" },
        token
      );
      for (const c of campaigns.data || []) {
        await supabase.from("campaigns").upsert({
          id: c.id,
          account_id: accountId,
          name: c.name,
          status: c.status,
          daily_budget: c.daily_budget ? Number(c.daily_budget) / 100 : null,
          updated_at: new Date().toISOString(),
        });

        const campaignInsights = await graphGet(
          `${c.id}/insights`,
          { fields: "spend,ctr,actions,purchase_roas", date_preset: "last_30d" },
          token
        );
        const cRow = campaignInsights.data?.[0];
        if (cRow) {
          await supabase.from("insights_daily").upsert({
            entity_level: "campaign",
            entity_id: c.id,
            account_id: accountId,
            date: today,
            spend: Number(cRow.spend || 0),
            impressions: 0,
            reach: 0,
            clicks: 0,
            ctr: Number(cRow.ctr || 0),
            messaging_conversations: actionCount(cRow.actions, "onsite_conversion.messaging_conversation_started_7d"),
            purchases: actionCount(cRow.actions, "omni_purchase"),
          });
        }
      }
    }

    await supabase.from("sync_state").upsert({ id: 1, last_synced_at: new Date().toISOString(), last_status: "ok", last_error: null });
    return res.status(200).json({ ok: true, synced: accountIds.length });
  } catch (err) {
    await supabase.from("sync_state").upsert({ id: 1, last_synced_at: new Date().toISOString(), last_status: "error", last_error: String(err.message || err) });
    return res.status(500).json({ error: String(err.message || err) });
  }
}
