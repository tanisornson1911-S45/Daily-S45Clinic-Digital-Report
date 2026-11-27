#!/usr/bin/env node
// check-pipeline-freshness.mjs
// ---------------------------------------------------------------
// Watchdog ที่ "ไม่พึ่ง" กลไกเดิมเลย (ไม่ใช่ GitHub schedule:, ไม่ใช่ Cloudflare Cron ที่ยิง workflow_dispatch,
// ไม่ใช่ Claude Code routine) — เพิ่ม 2026-11-27 หลังเจอว่า update-m365-data.yml/update-dashboard-data.yml
// ดีเลย์ 5-10 ชม. ต่อเนื่อง 10 วันโดยไม่มีใครรู้ตัวเลย (job เองไม่ fail แค่รันช้า — step "Notify LINE on
// failure" ที่มีอยู่เดิมจึงไม่ทำงาน เพราะเงื่อนไข `if: failure()` ไม่เป็นจริง) ผู้ใช้ขอให้ "อย่าให้เกิดแบบนี้อีก...
// ไม่มีการตรวจสอบเลย และไม่แจ้งอะไรกลับมา" — ตัวนี้คือการตรวจสอบเพิ่มชั้นที่สอง ไม่ใช่แก้ที่ตัวดีเลย์เอง (แก้แล้ว
// ด้วย Cloudflare Cron Trigger ยิง workflow_dispatch ตรงเวลาแทน — ดู worker/src/index.js) แต่เป็น "เซฟตี้เน็ต"
// เผื่อกลไกใดกลไกหนึ่งพังแบบเงียบๆ อีกในอนาคต (เช่น Cloudflare Cron Trigger ถูกลบ/ตั้งผิด, GITHUB_PAT หมดอายุ,
// Worker เอง down) — เช็คจาก "ผลลัพธ์จริง" ของแต่ละ pipeline (ไฟล์ข้อมูลที่ควรถูกคอมมิตวันนี้) ไม่ใช่เช็คว่า
// workflow ถูกเรียกหรือเปล่า จึงจับได้ไม่ว่าตัวกระตุ้นจะพังตรงไหนก็ตาม
//
// เรียกผ่าน workflow_dispatch ของ .github/workflows/pipeline-watchdog.yml โดย Cloudflare Cron Trigger
// 2 รอบใหม่ (ดู CRON_WORKFLOW_MAP ใน worker/src/index.js):
//   mode=morning (08:30 น. ไทย, เผื่อเวลาจากรอบตั้งใจ 01:00/01:30 น. ~7 ชม.) — เช็ค m365Raw.json +
//     adSpend.json ว่า generatedAt เป็นวันนี้ (เวลาไทย) แล้วหรือยัง
//   mode=evening (19:00 น. ไทย, เผื่อเวลาจากรอบตั้งใจ 18:20 น. ~40 นาที) — เช็ค lastReportSent.json ว่า
//     date เป็นวันนี้แล้วหรือยัง (= ส่ง Report LINE OA ของวันนี้แล้ว)
//
// ไม่ fail ทับปัญหาเดิมถ้าส่ง LINE แจ้งเตือนเองไม่สำเร็จ (ดูเหตุผลเดียวกับ notify-line-failure.mjs) แต่ยัง
// exit(1) เมื่อเจอข้อมูลค้าง เพื่อให้ GitHub Actions เองก็ขึ้นสถานะ "failed" ให้เห็นในประวัติ run ด้วย
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const MODE = process.env.MODE;
if (MODE !== "morning" && MODE !== "evening") {
  console.error(`Invalid MODE env var: ${JSON.stringify(MODE)} — must be "morning" or "evening"`);
  process.exit(1);
}

const LINE_ALERT_CHANNEL_ACCESS_TOKEN = process.env.LINE_ALERT_CHANNEL_ACCESS_TOKEN;

const nowIct = new Date(Date.now() + 7 * 60 * 60 * 1000); // ICT = UTC+7
const todayKey = `${nowIct.getUTCFullYear()}-${String(nowIct.getUTCMonth() + 1).padStart(2, "0")}-${String(nowIct.getUTCDate()).padStart(2, "0")}`;

function readJson(relPath) {
  const p = path.resolve(relPath);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

function ictDateOf(isoUtc) {
  if (!isoUtc) return null;
  const d = new Date(new Date(isoUtc).getTime() + 7 * 60 * 60 * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

const problems = [];

if (MODE === "morning") {
  const checks = [
    { file: "src/data/m365Raw.json", label: "update-m365-data.yml (M365/RAW_TX pipeline)" },
    { file: "src/data/adSpend.json", label: "update-dashboard-data.yml (Facebook ad spend pipeline)" },
  ];
  for (const { file, label } of checks) {
    const data = readJson(file);
    const gotDate = ictDateOf(data?.generatedAt);
    if (gotDate !== todayKey) {
      problems.push(`• ${label}: ล่าสุดเป็นข้อมูลวันที่ ${gotDate ?? "(ไม่พบ/อ่านไม่ได้)"} ไม่ใช่วันนี้ (${todayKey})`);
    }
  }
} else {
  const data = readJson("src/data/lastReportSent.json");
  if (data?.date !== todayKey) {
    problems.push(`• send-line-report.yml: ยังไม่มีบันทึกว่าส่ง Report วันนี้ (${todayKey}) — ล่าสุดคือวันที่ ${data?.date ?? "(ไม่พบ/อ่านไม่ได้)"}`);
  }
}

if (problems.length === 0) {
  console.log(`[${MODE}] OK — ข้อมูลที่เช็คทั้งหมดเป็นของวันนี้ (${todayKey}) แล้ว`);
  process.exit(0);
}

console.error(`[${MODE}] พบข้อมูลค้าง:\n${problems.join("\n")}`);

if (LINE_ALERT_CHANNEL_ACCESS_TOKEN) {
  const label = MODE === "morning" ? "เช็คตอนเช้า (คาดว่าควรรันตี 1:00/1:30 น.)" : "เช็คตอนเย็น (คาดว่าควรรันตอน 18:20 น.)";
  const text = [`⚠️ Pipeline Watchdog — ${label}`, "", `พบว่ายังไม่มีข้อมูลของวันนี้ (${todayKey}):`, ...problems, "", "เช็คที่ GitHub Actions ว่า workflow ที่เกี่ยวข้องรันไปหรือยัง/สำเร็จไหม"].join("\n");
  try {
    const res = await fetch("https://api.line.me/v2/bot/message/broadcast", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${LINE_ALERT_CHANNEL_ACCESS_TOKEN}` },
      body: JSON.stringify({ messages: [{ type: "text", text: text.slice(0, 4800) }] }),
    });
    if (!res.ok) {
      console.error(`LINE push failed (${res.status}): ${await res.text().catch(() => "")}`);
    } else {
      console.log("Sent watchdog alert to LINE alert channel.");
    }
  } catch (err) {
    console.error("Could not send LINE watchdog alert:", err.message);
  }
} else {
  console.error("Missing LINE_ALERT_CHANNEL_ACCESS_TOKEN — can't send watchdog alert.");
}

process.exit(1);
