import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import { setLiveData } from "./data/liveData.js";
import { enableBasicProtection } from "./protect.js";

enableBasicProtection();

// ตั้งแต่ 2026-11-09: production ไม่ import ไฟล์ src/data/*.json ตรงๆ เข้าบันเดิลอีกต่อไป (ของเดิมทำให้ข้อมูล
// ลูกค้า/ยอดขายทั้งหมดอยู่ใน JS ที่ดาวน์โหลดได้ฟรีสำหรับใครก็ตามที่เปิดเว็บได้ แม้จะ obfuscate แค่ไหนก็ซ่อนค่าจริง
// ไม่ได้) — ดึงจาก Cloudflare Worker API (worker/) แทน ซึ่งเช็ค Basic Auth (DASH_USER/DASH_PASS ชุดเดียวกับ
// middleware.js) + CORS (เฉพาะ origin ของเว็บนี้) ก่อนตอบข้อมูลทุกครั้ง — ดู src/data/liveData.js สำหรับเหตุผลที่
// ต้องโหลดข้อมูลให้เสร็จก่อน dynamic import("./App.jsx") แทนที่จะ fetch ใน useEffect ของ App เอง
//
// dev (npm run dev) ยังคง import ไฟล์ local ตรงๆ เหมือนเดิมทุกประการ — ไม่ต้องรัน Worker/ไม่ต้อง login ตอนพัฒนา
const WORKER_URL = import.meta.env.VITE_WORKER_URL;
const SESSION_KEY = "s45_worker_auth"; // sessionStorage: base64("user:pass") — หายเองตอนปิดแท็บ

const root = ReactDOM.createRoot(document.getElementById("root"));

async function mountApp() {
  const { default: App } = await import("./App.jsx");
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

function renderError(message) {
  document.getElementById("root").innerHTML =
    `<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:sans-serif;color:#475569;padding:24px;text-align:center;">${message}</div>`;
}

async function renderLogin(errorMessage) {
  const { default: WorkerLogin } = await import("./WorkerLogin.jsx");
  root.render(
    <React.StrictMode>
      <WorkerLogin errorMessage={errorMessage} onSubmit={handleLoginSubmit} />
    </React.StrictMode>
  );
}

// authHeaderValue = "Basic <base64>" ทั้งก้อน — คืน true ถ้าโหลดสำเร็จแล้ว mount แอพ, false ถ้าไม่สำเร็จ
async function tryFetchAndMount(authHeaderValue) {
  let res;
  try {
    res = await fetch(`${WORKER_URL}/api/data`, { headers: { Authorization: authHeaderValue } });
  } catch {
    return "NETWORK_ERROR";
  }
  if (res.status === 401 || res.status === 403) return "UNAUTHORIZED";
  if (!res.ok) return "SERVER_ERROR";
  const data = await res.json();
  setLiveData(data);
  await mountApp();
  return "OK";
}

async function handleLoginSubmit(user, pass) {
  const encoded = btoa(`${user}:${pass}`);
  const outcome = await tryFetchAndMount(`Basic ${encoded}`);
  if (outcome === "OK") {
    sessionStorage.setItem(SESSION_KEY, encoded);
    return;
  }
  const messages = {
    UNAUTHORIZED: "Username หรือ Password ไม่ถูกต้อง",
    NETWORK_ERROR: "เชื่อมต่อ Worker API ไม่สำเร็จ ลองใหม่อีกครั้ง",
    SERVER_ERROR: "เกิดข้อผิดพลาดจากฝั่งเซิร์ฟเวอร์ ลองใหม่อีกครั้ง",
  };
  await renderLogin(messages[outcome] || "เกิดข้อผิดพลาด ลองใหม่อีกครั้ง");
}

async function bootstrapProd() {
  if (!WORKER_URL) {
    renderError(
      "ยังไม่ได้ตั้งค่า VITE_WORKER_URL (Vercel Project Settings → Environment Variables) — ต้องตั้งเป็น URL ของ Cloudflare Worker ก่อนใช้งาน"
    );
    return;
  }
  const saved = sessionStorage.getItem(SESSION_KEY);
  if (saved) {
    const outcome = await tryFetchAndMount(`Basic ${saved}`);
    if (outcome === "OK") return;
    sessionStorage.removeItem(SESSION_KEY);
  }
  await renderLogin(null);
}

// dev: import ไฟล์ src/data/*.json ทั้ง 16 ไฟล์ตรงๆ เหมือนพฤติกรรมเดิมก่อน 2026-11-09 — key ต้องตรงกับที่
// worker/src/index.js ส่งกลับมา (DATA_KEYS) และ scripts/push-to-kv.mjs push ขึ้น KV (DATA_FILES)
async function bootstrapDev() {
  const loaders = {
    adSpend: () => import("./data/adSpend.json"),
    rawTx: () => import("./data/rawTx.json"),
    consultTx: () => import("./data/consultTx.json"),
    loaData: () => import("./data/loaData.json"),
    loaNormalData: () => import("./data/loaNormalData.json"),
    funnelByMonth: () => import("./data/funnelByMonth.json"),
    adDaily: () => import("./data/adDaily.json"),
    doctorHeroPosts: () => import("./data/doctorHeroPosts.json"),
    antArmyPosts: () => import("./data/antArmyPosts.json"),
    badLead: () => import("./data/badLead.json"),
    orSales: () => import("./data/orSales.json"),
    consultPipeline: () => import("./data/consultPipeline.json"),
    channelMix: () => import("./data/channelMix.json"),
    interSale: () => import("./data/interSale.json"),
    procedureBudget: () => import("./data/procedureBudget.json"),
    noseOpenDoctorAds: () => import("./data/noseOpenDoctorAds.json"),
  };
  const entries = await Promise.all(Object.entries(loaders).map(async ([key, load]) => [key, (await load()).default]));
  setLiveData(Object.fromEntries(entries));
  await mountApp();
}

if (import.meta.env.DEV) {
  bootstrapDev();
} else {
  bootstrapProd();
}
