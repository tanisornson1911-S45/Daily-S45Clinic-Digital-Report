// S45 Dashboard data API — Cloudflare Worker.
//
// Serves the dashboard's data files from KV (pushed nightly by
// scripts/push-to-kv.mjs, see .github/workflows/update-m365-data.yml and
// update-dashboard-data.yml) instead of them being bundled into the public
// frontend JS. Gated by:
//   1. The exact same DASH_USER/DASH_PASS Basic Auth credentials already
//      used by the frontend's Vercel middleware (middleware.js) — set here
//      as Worker secrets, not in this file or wrangler.toml.
//   2. CORS locked to ALLOWED_ORIGIN (the dashboard's own origin) — a
//      cross-origin page's JS can't read the response even if it somehow
//      had valid credentials, and a browser won't even send the request
//      with credentials unless this Worker's CORS headers allow it.
//
// This does NOT stop someone with valid credentials from curling this
// endpoint directly (no CORS enforcement outside a browser) — that's an
// inherent limit of any API a browser-based SPA calls with a shared
// username/password instead of a per-user token. It does stop the much
// more likely risk this whole migration was for: anyone who can reach the
// *website* (or just downloads the public JS bundle) no longer gets every
// customer name/transaction for free — they'd additionally need the
// Basic Auth credentials AND to call this specific Worker URL directly.

// Keep this list in sync with scripts/push-to-kv.mjs's DATA_FILES and
// src/App.jsx's imports from "./data/liveData.js".
const DATA_KEYS = [
  "adSpend",
  "rawTx",
  "consultTx",
  "loaData",
  "loaNormalData",
  "funnelByMonth",
  "adDaily",
  "doctorHeroPosts",
  "antArmyPosts",
  "badLead",
  "orSales",
  "consultPipeline",
  "channelMix",
  "interSale",
  "procedureBudget",
  "noseOpenDoctorAds",
  "weeklyBudget",
];

function corsHeaders(env) {
  return {
    "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

// เทียบแบบ constant-time คร่าวๆ กัน timing attack เดา credential ทีละตัวอักษร — ไม่ได้ป้องกันสมบูรณ์แบบ
// (ยังมี overhead อื่นที่วัดเวลาต่างกันได้) แต่ดีกว่า === ตรงๆ สำหรับของที่เทียบกับ secret
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

function checkAuth(request, env) {
  const auth = request.headers.get("authorization");
  if (!auth) return false;
  const [scheme, encoded] = auth.split(" ");
  if (scheme !== "Basic" || !encoded) return false;
  let decoded;
  try {
    decoded = atob(encoded);
  } catch {
    return false;
  }
  const sep = decoded.indexOf(":");
  if (sep < 0) return false;
  const user = decoded.slice(0, sep);
  const pass = decoded.slice(sep + 1);
  return timingSafeEqual(user, env.DASH_USER || "") && timingSafeEqual(pass, env.DASH_PASS || "");
}

// ยิง workflow_dispatch ของ "Send daily Digital Report to LINE OA" ผ่าน GitHub REST API ตรงๆ — เพิ่ม
// 2026-11-14 แทนที่การพึ่ง GitHub Actions `schedule:` ของ workflow นั้นเอง (ดีเลย์ 5-7+ ชม. ซ้ำๆ 3 วันติด) หรือ
// Routine ของ Claude Code (ล้มเหลวเงียบๆ เพราะ MCP หลุดตอนปลุก 3 วันติดเช่นกัน) — เรียกจาก scheduled() ด้านล่าง
// ซึ่งผูกกับ Cloudflare Cron Trigger (แม่นยำกว่า GitHub Actions schedule มาก และไม่ต้องพึ่ง Claude session เลย)
const GITHUB_REPO = "tanisornson1911-S45/Daily-S45Clinic-Digital-Report";
const REPORT_WORKFLOW_FILE = "send-line-report.yml";

async function dispatchLineReportWorkflow(env) {
  const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/actions/workflows/${REPORT_WORKFLOW_FILE}/dispatches`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.GITHUB_PAT}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      // GitHub REST API ปฏิเสธ request ที่ไม่มี User-Agent (403) — Workers runtime ไม่ใส่ให้อัตโนมัติแบบเบราว์เซอร์
      "User-Agent": "s45-dashboard-api-cron-worker",
    },
    body: JSON.stringify({ ref: "main" }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`GitHub dispatch failed (HTTP ${res.status}): ${text.slice(0, 300)}`);
  }
}

// แจ้งเตือน LINE OA แยกต่างหาก (ตัวเดียวกับที่ scripts/notify-line-failure.mjs ใช้) ถ้า Cron Trigger นี้เองยิง
// GitHub ไม่สำเร็จ — จุดนี้อยู่ "ก่อน" workflow จะเริ่มรันด้วยซ้ำ ถ้าพังตรงนี้แบบเงียบๆ จะไม่มี GitHub Actions job
// เกิดขึ้นเลย แปลว่า step "Notify LINE on failure" ในตัว workflow เองจะไม่มีโอกาสได้ทำงานเลยเช่นกัน — ต้องแจ้งเตือน
// จากตรงนี้โดยตรง กันจุดบอดนี้ไว้
async function notifyDispatchFailure(env, err) {
  if (!env.LINE_ALERT_CHANNEL_ACCESS_TOKEN) return;
  const text = `⚠️ Cloudflare Cron ยิง "Send daily Digital Report to LINE OA" ไม่สำเร็จ\n${String(err?.message || err).slice(0, 500)}`;
  try {
    await fetch("https://api.line.me/v2/bot/message/broadcast", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.LINE_ALERT_CHANNEL_ACCESS_TOKEN}` },
      body: JSON.stringify({ messages: [{ type: "text", text }] }),
    });
  } catch {
    // ยิง LINE แจ้งเตือนเองก็พังอีกไม่มีอะไรทำต่อได้แล้ว — อย่างน้อย error หลักก็ยัง throw ออกไปให้ Cloudflare
    // บันทึกไว้ใน execution log ของ Worker (Workers & Pages -> Logs) ให้เช็คย้อนหลังได้
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("origin");
    const originOk = origin === env.ALLOWED_ORIGIN;

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: originOk ? corsHeaders(env) : {} });
    }

    if (url.pathname !== "/api/data" || request.method !== "GET") {
      return new Response("Not found", { status: 404 });
    }

    if (!originOk) {
      return new Response("Forbidden origin", { status: 403 });
    }

    if (!checkAuth(request, env)) {
      return new Response("Authentication required.", {
        status: 401,
        headers: { ...corsHeaders(env), "WWW-Authenticate": 'Basic realm="S45 Dashboard API"' },
      });
    }

    const entries = await Promise.all(
      DATA_KEYS.map(async (key) => {
        const raw = await env.DATA_KV.get(key);
        return [key, raw ? JSON.parse(raw) : null];
      })
    );
    const body = Object.fromEntries(entries);

    return new Response(JSON.stringify(body), {
      status: 200,
      headers: {
        ...corsHeaders(env),
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  },

  // Cloudflare Cron Trigger (ตั้งไว้ 26 11 * * * UTC = 18:26 น. ไทย — ดูคอมเมนต์หัว wrangler.toml) — เรียกทุกวัน
  // ไม่ต้องเช็ค "ส่งไปแล้วหรือยัง" ที่นี่ เพราะ workflow เองมี dedup guard อยู่แล้ว (scripts/check-report-sent-
  // today.mjs) ยิงซ้ำวันเดียวกันแค่ no-op ไม่ส่งซ้ำ
  async scheduled(event, env, ctx) {
    ctx.waitUntil(
      dispatchLineReportWorkflow(env).catch((err) => notifyDispatchFailure(env, err))
    );
  },
};
