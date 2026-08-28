#!/usr/bin/env node
// TEMP DEBUG SCRIPT — checks whether FB_ACCESS_TOKEN can read Page posts + insights + images.
// Delete after use.
const TOKEN = process.env.FB_ACCESS_TOKEN;
const PAGE_ID = "518080005008368"; // S45 Clinic เสริมจมูกสไตล์เกาหลี By หมอตี้

async function main() {
  const postsUrl = new URL(`https://graph.facebook.com/v21.0/${PAGE_ID}/posts`);
  postsUrl.searchParams.set("fields", "message,full_picture,permalink_url,created_time");
  postsUrl.searchParams.set("limit", "5");
  postsUrl.searchParams.set("access_token", TOKEN);
  const postsRes = await fetch(postsUrl);
  const postsJson = await postsRes.json();
  console.log("=== /posts ===");
  console.log(JSON.stringify(postsJson, null, 2).slice(0, 3000));

  const firstPostId = postsJson.data?.[0]?.id;
  if (firstPostId) {
    const insightsUrl = new URL(`https://graph.facebook.com/v21.0/${firstPostId}/insights`);
    insightsUrl.searchParams.set("metric", "post_impressions_unique,post_engaged_users,post_reactions_like_total");
    insightsUrl.searchParams.set("access_token", TOKEN);
    const insightsRes = await fetch(insightsUrl);
    const insightsJson = await insightsRes.json();
    console.log("\n=== /insights ===");
    console.log(JSON.stringify(insightsJson, null, 2).slice(0, 3000));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
