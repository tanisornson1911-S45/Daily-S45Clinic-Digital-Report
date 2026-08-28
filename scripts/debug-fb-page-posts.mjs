#!/usr/bin/env node
// TEMP DEBUG SCRIPT — checks whether FB_ACCESS_TOKEN can read Page posts + insights + images.
// Delete after use.
const TOKEN = process.env.FB_ACCESS_TOKEN;
const PAGE_ID = "518080005008368"; // S45 Clinic เสริมจมูกสไตล์เกาหลี By หมอตี้

async function main() {
  // ต้อง exchange เป็น Page Access Token ก่อน — "New Pages Experience" ไม่ยอมรับ System User token ตรงๆ
  const exchangeUrl = new URL(`https://graph.facebook.com/v21.0/${PAGE_ID}`);
  exchangeUrl.searchParams.set("fields", "access_token,name");
  exchangeUrl.searchParams.set("access_token", TOKEN);
  const exchangeRes = await fetch(exchangeUrl);
  const exchangeJson = await exchangeRes.json();
  console.log("=== page access_token exchange ===");
  console.log(JSON.stringify({ ...exchangeJson, access_token: exchangeJson.access_token ? "[REDACTED]" : undefined }, null, 2));

  const pageToken = exchangeJson.access_token;
  if (!pageToken) {
    console.log("No page access_token returned — stopping here.");
    return;
  }

  const postsUrl = new URL(`https://graph.facebook.com/v21.0/${PAGE_ID}/posts`);
  postsUrl.searchParams.set(
    "fields",
    "message,full_picture,permalink_url,created_time,reactions.summary(true).limit(0),comments.summary(true).limit(0),shares"
  );
  postsUrl.searchParams.set("limit", "10");
  postsUrl.searchParams.set("access_token", pageToken);
  const postsRes = await fetch(postsUrl);
  const postsJson = await postsRes.json();
  console.log("\n=== /posts (with engagement fields) ===");
  for (const p of postsJson.data || []) {
    console.log({
      id: p.id,
      created_time: p.created_time,
      reactions: p.reactions?.summary?.total_count,
      comments: p.comments?.summary?.total_count,
      shares: p.shares?.count,
      has_picture: !!p.full_picture,
      message_preview: (p.message || "").slice(0, 60),
    });
  }
  if (postsJson.error) console.log("ERROR:", JSON.stringify(postsJson.error));

  const firstPostId = postsJson.data?.[0]?.id;
  if (firstPostId) {
    for (const metric of ["post_impressions", "post_clicks", "post_reactions_by_type_total"]) {
      const insightsUrl = new URL(`https://graph.facebook.com/v21.0/${firstPostId}/insights`);
      insightsUrl.searchParams.set("metric", metric);
      insightsUrl.searchParams.set("access_token", pageToken);
      const insightsRes = await fetch(insightsUrl);
      const insightsJson = await insightsRes.json();
      console.log(`\n=== /insights metric=${metric} ===`);
      console.log(JSON.stringify(insightsJson, null, 2).slice(0, 800));
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
