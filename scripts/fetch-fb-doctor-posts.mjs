#!/usr/bin/env node
/**
 * fetch-fb-doctor-posts.mjs
 * ---------------------------------------------------------------
 * Pulls real Facebook posts from the Page "S45 Clinic เสริมจมูกสไตล์เกาหลี
 * By หมอตี้" and picks the highest-engagement post per doctor (matched by
 * hashtag/name appearing in the post caption) to replace the old
 * hand-curated DOCTOR_HERO_CASES links in src/App.jsx — this way the
 * "เคสเด่นคุณหมอ" card shows a real post image automatically instead of a
 * link-only placeholder, and updates itself as new posts get engagement.
 *
 * Auth: same System User token as fetch-fb-daily.mjs, but Page posts need
 * an actual Page Access Token (not the System User token directly) — verified
 * live that "New Pages Experience" pages reject the System User token for
 * /PAGE_ID/posts with "(#190) Invalid OAuth 2.0 Access Token" until you
 * exchange it via GET /PAGE_ID?fields=access_token. Requires the System
 * User to additionally have pages_read_engagement + pages_show_list +
 * pages_read_user_content (the last one specifically for reading
 * reactions/comments/shares counts on posts — confirmed via live testing
 * 2026-08-28, needed enabling a "Page" use case on the app first before it
 * was selectable).
 *
 * engagement score = reactions + comments*3 + shares*5 (weighted so a
 * share/comment counts for more than a passive like, same idea as most
 * social-media "engagement rate" formulas)
 *
 * Run manually:
 *   FB_ACCESS_TOKEN=xxxx node scripts/fetch-fb-doctor-posts.mjs
 *
 * Run automatically: see .github/workflows/update-dashboard-data.yml
 * ---------------------------------------------------------------
 */

import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const FB_ACCESS_TOKEN = process.env.FB_ACCESS_TOKEN;
const API_VERSION = "v21.0";
const PAGE_ID = "518080005008368"; // S45 Clinic เสริมจมูกสไตล์เกาหลี By หมอตี้

if (!FB_ACCESS_TOKEN) {
  console.error("Missing FB_ACCESS_TOKEN environment variable.");
  process.exit(1);
}

// หมวดหมู่หมอ -> คำที่ค้นหาในแคปชั่นโพสต์ (ไม่บังคับต้องมี # นำหน้า เพราะโพสต์จริงบางอันติด
// แฮชแท็กแบบไม่มีช่องว่าง เช่น "#หมอจิ๊จ๊ะs45clinic" — ใช้ substring match พอ)
const DOCTORS = [
  { key: "doctor_tee", label: "หมอตี้", match: "หมอตี้" },
  { key: "doctor_rose", label: "หมอโรส", match: "หมอโรส" },
  { key: "doctor_jijar", label: "หมอจิ๊จ๊ะ", match: "หมอจิ๊จ๊ะ" },
  { key: "doctor_bright", label: "หมอไบร์ท", match: "หมอไบร์ท" },
  { key: "doctor_toon", label: "หมอตูน", match: "หมอตูน" },
  { key: "doctor_che", label: "หมอเช", match: "หมอเช" },
];

const MAX_POSTS = 300; // เพดานจำนวนโพสต์ที่ไล่ดู กันดึงย้อนหลังไม่มีที่สิ้นสุด
const MAX_AGE_DAYS = 180; // ไม่ไล่ดูโพสต์เก่ากว่า 6 เดือน
const TOP_N_PER_DOCTOR = 3; // เก็บ Top 3 ต่อหมอ ไว้ให้เลือกดูเพิ่มได้ในอนาคต ไม่ใช่แค่ 1 โพสต์

async function getPageAccessToken() {
  const url = new URL(`https://graph.facebook.com/${API_VERSION}/${PAGE_ID}`);
  url.searchParams.set("fields", "access_token,name");
  url.searchParams.set("access_token", FB_ACCESS_TOKEN);
  const res = await fetch(url);
  const json = await res.json();
  if (json.error) throw new Error(`Page token exchange failed: ${json.error.message}`);
  return json.access_token;
}

async function fetchAllPosts(pageToken) {
  const posts = [];
  const cutoff = Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

  let url = new URL(`https://graph.facebook.com/${API_VERSION}/${PAGE_ID}/posts`);
  url.searchParams.set(
    "fields",
    "message,full_picture,permalink_url,created_time,reactions.summary(true).limit(0),comments.summary(true).limit(0),shares"
  );
  url.searchParams.set("limit", "50");
  url.searchParams.set("access_token", pageToken);

  let nextUrl = url.toString();
  while (nextUrl && posts.length < MAX_POSTS) {
    const res = await fetch(nextUrl);
    const json = await res.json();
    if (json.error) {
      console.error(`  ! posts fetch error: ${json.error.message}`);
      break;
    }
    for (const p of json.data || []) {
      if (new Date(p.created_time).getTime() < cutoff) {
        nextUrl = null; // เก่าเกินไปแล้ว หยุดไล่หน้าต่อไป
        break;
      }
      posts.push(p);
    }
    if (nextUrl) nextUrl = json.paging?.next || null;
  }
  return posts;
}

function engagementScoreOf(post) {
  const reactions = post.reactions?.summary?.total_count || 0;
  const comments = post.comments?.summary?.total_count || 0;
  const shares = post.shares?.count || 0;
  return { reactions, comments, shares, score: reactions + comments * 3 + shares * 5 };
}

async function main() {
  console.log(`Exchanging for Page access token (page ${PAGE_ID})...`);
  const pageToken = await getPageAccessToken();

  console.log("Fetching posts...");
  const posts = await fetchAllPosts(pageToken);
  console.log(`Fetched ${posts.length} posts (last ${MAX_AGE_DAYS} days, cap ${MAX_POSTS}).`);

  const byDoctor = {};
  for (const { key, label, match } of DOCTORS) {
    const matches = posts
      .filter((p) => p.message && p.message.includes(match))
      .map((p) => {
        const { reactions, comments, shares, score } = engagementScoreOf(p);
        return {
          postId: p.id,
          message: p.message,
          fullPicture: p.full_picture || null,
          permalinkUrl: p.permalink_url,
          createdTime: p.created_time,
          reactions,
          comments,
          shares,
          engagementScore: score,
        };
      })
      .sort((a, b) => b.engagementScore - a.engagementScore)
      .slice(0, TOP_N_PER_DOCTOR);
    byDoctor[key] = { label, cases: matches };
    console.log(`  ${label}: ${matches.length} เคส (จาก ${posts.filter((p) => p.message?.includes(match)).length} โพสต์ที่พบชื่อ)`);
  }

  const outDir = path.resolve("src/data");
  const outPath = path.join(outDir, "doctorHeroPosts.json");
  await mkdir(outDir, { recursive: true });
  await writeFile(
    outPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        source: `Generated by scripts/fetch-fb-doctor-posts.mjs (Facebook Graph API, Page ${PAGE_ID}). ` +
          `เลือกโพสต์ ${TOP_N_PER_DOCTOR} อันดับแรกต่อหมอ จากคะแนน engagement = reactions + comments*3 + shares*5 ` +
          `เฉพาะโพสต์ที่มีชื่อ/แฮชแท็กหมอนั้นอยู่ในแคปชั่น และไม่เก่ากว่า ${MAX_AGE_DAYS} วัน`,
        doctors: byDoctor,
      },
      null,
      2
    )
  );
  console.log(`\nWrote ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
