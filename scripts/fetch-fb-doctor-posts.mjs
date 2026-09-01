#!/usr/bin/env node
/**
 * fetch-fb-doctor-posts.mjs
 * ---------------------------------------------------------------
 * Pulls real Facebook posts from the Page "S45 Clinic เสริมจมูกสไตล์เกาหลี
 * By หมอตี้" ONCE, then builds two outputs from the same fetch:
 *
 * 1. src/data/doctorHeroPosts.json — top-engagement post per doctor
 *    (matched by name/hashtag in the caption) — powers the "เคสเด่นคุณหมอ"
 *    card, replacing the old hand-curated DOCTOR_HERO_CASES links.
 * 2. src/data/antArmyPosts.json — ALL fetched posts grouped by หัตถการ
 *    (matched by procedure keyword in the caption), sorted by engagement —
 *    powers the "กองทัพมด" section's per-procedure post list, replacing the
 *    old hand-pasted ANT_ARMY_LINKS array. Not capped per category (the
 *    user asked for "ทุกตัว" — every one) — natural ceiling is MAX_POSTS/
 *    MAX_AGE_DAYS below.
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
 * engagement score = reactions + comments*3 + shares*5 + clicks*4 (weighted so
 * a share/comment/click counts for more than a passive like, same idea as
 * most social-media "engagement rate" formulas). Clicks come from
 * post_clicks via a batched call to /{post-id}/insights — reach/impressions
 * metrics (post_impressions, post_impressions_unique) were tried first but
 * are deprecated on this Page/API version ("(#100) The value must be a
 * valid insights metric"), so there is no impressions denominator available
 * for a true CTR — post_clicks is used as a raw intent signal instead.
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

// หมวดหมู่หมอ -> ชื่อที่ต้องเจอ "ในแฮชแท็ก" ของโพสต์เท่านั้น (ต้องมี # นำหน้าอยู่ในตัวเดียวกัน เช่น
// "#หมอจิ๊จ๊ะs45clinic", "#BaobeiNoseByหมอจิ๊จ๊ะ") — เดิม match แบบ substring อิสระ (ไม่บังคับ #) ทำให้ทุกโพสต์
// ของเพจ "เข้าข่ายหมอตี้" หมดเพราะทุกโพสต์มีข้อความท้ายโพสต์ซ้ำกัน "Line : เสริมจมูก By หมอตี้" ติดมาด้วย (เป็นข้อความ
// ติดต่อ/แบรนดิ้งท้ายเพจ ไม่ใช่การระบุหมอที่ทำเคสจริง) ผู้ใช้ยืนยันว่าต้องดูจากแฮชแท็ก #หมอตี้ เท่านั้น — ดู
// hasDoctorHashtag() ด้านล่างที่บังคับให้ชื่อต้องอยู่ใน token ที่ขึ้นต้นด้วย # จริงๆ
const DOCTORS = [
  { key: "doctor_tee", label: "หมอตี้", match: "หมอตี้" },
  { key: "doctor_rose", label: "หมอโรส", match: "หมอโรส" },
  { key: "doctor_jijar", label: "หมอจิ๊จ๊ะ", match: "หมอจิ๊จ๊ะ" },
  { key: "doctor_bright", label: "หมอไบร์ท", match: "หมอไบร์ท" },
  { key: "doctor_toon", label: "หมอตูน", match: "หมอตูน" },
  { key: "doctor_che", label: "หมอเช", match: "หมอเช" },
];

// หัตถการ -> คำ/regex ที่ค้นหาในแคปชั่นโพสต์ (ให้ตรงกับ 4 หมวดที่ใช้อยู่แล้วทั้งแอป — PROC_LABELS_SHORT
// ใน App.jsx: nose_open/nose_semi/brow_hairline/breast_lipo) โพสต์หนึ่งอาจเข้าได้หลายหัตถการถ้าพูดถึง
// มากกว่า 1 อย่าง (เช่นเคสทำทั้งจมูก+หน้าอก) — ไม่ตัดให้เหลือหัตถการเดียว
const PROCEDURES = [
  { key: "nose_open", label: "Nose Open", re: /เสริมจมูกโอเพ่น|nose\s*open|จมูกโอเพ่น/i },
  { key: "nose_semi", label: "Semi Open", re: /semi\s*open|เสริมจมูก.{0,6}semi/i },
  { key: "brow_hairline", label: "Brow Lift (ยกคิ้ว)", re: /ยกคิ้ว|เลื่อนไรผม|brow\s*lift/i },
  { key: "breast_lipo", label: "Breast/ดูดไขมัน", re: /เสริมหน้าอก|ดูดไขมัน|ตัดหนังหน้าท้อง|หน้าอก/i },
];

const MAX_POSTS = 300; // เพดานจำนวนโพสต์ที่ไล่ดู กันดึงย้อนหลังไม่มีที่สิ้นสุด
const MAX_AGE_DAYS = 180; // ไม่ไล่ดูโพสต์เก่ากว่า 6 เดือน
const TOP_N_PER_DOCTOR = 3; // เก็บ Top 3 ต่อหมอ ไว้ให้เลือกดูเพิ่มได้ในอนาคต ไม่ใช่แค่ 1 โพสต์

// ต้องเจอชื่อหมอ "ภายในแฮชแท็กเดียวกัน" (token ที่ขึ้นต้นด้วย # ไม่มีช่องว่างคั่น) เท่านั้น — ไม่นับข้อความ
// นอกแฮชแท็ก (เช่น ท้ายโพสต์ที่พิมพ์ "By หมอตี้" ธรรมดาไม่มี # ซึ่งเป็นข้อความติดต่อ/แบรนดิ้งซ้ำทุกโพสต์)
function hasDoctorHashtag(message, name) {
  const tags = message.match(/#\S+/g) || [];
  return tags.some((t) => t.includes(name));
}

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

// ดึง post_clicks ของทุกโพสต์ผ่าน Batch API (สูงสุด 50 request ต่อ 1 batch call) แทนการยิงทีละ
// โพสต์ ลดจำนวน HTTP round-trip เมื่อมีโพสต์หลักร้อยตัว — โพสต์ไหนดึงไม่ได้ (error/ไม่มีข้อมูล) ถือเป็น 0
async function fetchClicksForPosts(pageToken, postIds) {
  const clicksMap = {};
  const CHUNK_SIZE = 50;
  for (let i = 0; i < postIds.length; i += CHUNK_SIZE) {
    const chunk = postIds.slice(i, i + CHUNK_SIZE);
    const batch = chunk.map((id) => ({ method: "GET", relative_url: `${id}/insights?metric=post_clicks` }));
    const res = await fetch(`https://graph.facebook.com/${API_VERSION}/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ access_token: pageToken, batch }),
    });
    const json = await res.json();
    if (!Array.isArray(json)) {
      console.error(`  ! batch clicks fetch error: ${JSON.stringify(json).slice(0, 300)}`);
      continue;
    }
    json.forEach((entry, idx) => {
      const postId = chunk[idx];
      if (!entry || entry.code !== 200) return;
      try {
        const body = JSON.parse(entry.body);
        const value = body?.data?.[0]?.values?.[0]?.value;
        if (typeof value === "number") clicksMap[postId] = value;
      } catch {
        // ปล่อยเป็น 0 ถ้า parse ไม่ได้
      }
    });
  }
  return clicksMap;
}

function engagementScoreOf(post, clicks) {
  const reactions = post.reactions?.summary?.total_count || 0;
  const comments = post.comments?.summary?.total_count || 0;
  const shares = post.shares?.count || 0;
  const clickCount = clicks || 0;
  return { reactions, comments, shares, clicks: clickCount, score: reactions + comments * 3 + shares * 5 + clickCount * 4 };
}

async function main() {
  console.log(`Exchanging for Page access token (page ${PAGE_ID})...`);
  const pageToken = await getPageAccessToken();

  console.log("Fetching posts...");
  const posts = await fetchAllPosts(pageToken);
  console.log(`Fetched ${posts.length} posts (last ${MAX_AGE_DAYS} days, cap ${MAX_POSTS}).`);

  console.log("Fetching post_clicks (batched)...");
  const clicksMap = await fetchClicksForPosts(pageToken, posts.map((p) => p.id));
  console.log(`Got clicks for ${Object.keys(clicksMap).length}/${posts.length} posts.`);

  const byDoctor = {};
  for (const { key, label, match } of DOCTORS) {
    const matches = posts
      .filter((p) => p.message && hasDoctorHashtag(p.message, match))
      .map((p) => {
        const { reactions, comments, shares, clicks, score } = engagementScoreOf(p, clicksMap[p.id]);
        return {
          postId: p.id,
          message: p.message,
          fullPicture: p.full_picture || null,
          permalinkUrl: p.permalink_url,
          createdTime: p.created_time,
          reactions,
          comments,
          shares,
          clicks,
          engagementScore: score,
        };
      })
      .sort((a, b) => b.engagementScore - a.engagementScore)
      .slice(0, TOP_N_PER_DOCTOR);
    byDoctor[key] = { label, cases: matches };
    console.log(`  ${label}: ${matches.length} เคส (จาก ${posts.filter((p) => p.message && hasDoctorHashtag(p.message, match)).length} โพสต์ที่พบแฮชแท็ก)`);
  }

  const outDir = path.resolve("src/data");
  await mkdir(outDir, { recursive: true });

  const heroPath = path.join(outDir, "doctorHeroPosts.json");
  await writeFile(
    heroPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        source: `Generated by scripts/fetch-fb-doctor-posts.mjs (Facebook Graph API, Page ${PAGE_ID}). ` +
          `เลือกโพสต์ ${TOP_N_PER_DOCTOR} อันดับแรกต่อหมอ จากคะแนน engagement = reactions + comments*3 + shares*5 + clicks*4 ` +
          `เฉพาะโพสต์ที่มีชื่อ/แฮชแท็กหมอนั้นอยู่ในแคปชั่น และไม่เก่ากว่า ${MAX_AGE_DAYS} วัน`,
        doctors: byDoctor,
      },
      null,
      2
    )
  );
  console.log(`Wrote ${heroPath}`);

  const byProcedure = {};
  for (const { key, label, re } of PROCEDURES) {
    const matches = posts
      .filter((p) => p.message && re.test(p.message))
      .map((p) => {
        const { reactions, comments, shares, clicks, score } = engagementScoreOf(p, clicksMap[p.id]);
        return {
          postId: p.id,
          message: p.message,
          fullPicture: p.full_picture || null,
          permalinkUrl: p.permalink_url,
          createdTime: p.created_time,
          reactions,
          comments,
          shares,
          clicks,
          engagementScore: score,
        };
      })
      .sort((a, b) => b.engagementScore - a.engagementScore);
    byProcedure[key] = { label, posts: matches };
    console.log(`  ${label}: ${matches.length} โพสต์`);
  }

  const antArmyPath = path.join(outDir, "antArmyPosts.json");
  await writeFile(
    antArmyPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        source: `Generated by scripts/fetch-fb-doctor-posts.mjs (Facebook Graph API, Page ${PAGE_ID}). ` +
          `โพสต์ทั้งหมด (ไม่ตัดจำนวน) ย้อนหลัง ${MAX_AGE_DAYS} วัน ที่มีคำ/หัตถการที่ตรงในแคปชั่น เรียงจากคะแนน ` +
          `engagement = reactions + comments*3 + shares*5 + clicks*4 มากไปน้อย — ใช้เลือกโพสต์ Organic ที่เข้าถึง/มี ` +
          `Engagement ดีมาทำ Ads Messenger ต่อ (กลยุทธ์ "กองทัพมด")`,
        procedures: byProcedure,
      },
      null,
      2
    )
  );
  console.log(`Wrote ${antArmyPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
