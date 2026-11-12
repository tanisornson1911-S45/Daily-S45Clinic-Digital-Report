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
};
