#!/usr/bin/env node
// check-report-sent-today.mjs
// ---------------------------------------------------------------
// Dedup guard for send-line-report.yml. ตั้งแต่ 2026-11-11 workflow นี้มีสองตัวจับเวลาที่อาจยิงพร้อม/ใกล้
// กันได้ (GitHub Actions `schedule:` ของตัวเอง + Routine ของ Claude Code ที่ยิง workflow_dispatch) เพื่อให้
// รายงานยังออกตรงเวลาแม้ตัวหนึ่งหลุด/ดีเลย์ — ถ้าไม่มี guard นี้ อาจส่งรายงานซ้ำวันละ 2 รอบ (เคยเกิดมาแล้ว
// 2026-10-12) เช็คจาก src/data/lastReportSent.json (คอมมิตไว้หลังส่งสำเร็จแต่ละวันโดย workflow เอง) เทียบกับ
// วันนี้ (เวลาไทย) — ถ้าตรงกันคือส่งไปแล้ววันนี้ ให้ workflow ข้าม step fetch/send ที่เหลือทั้งหมด
import { readFileSync, existsSync, appendFileSync } from "node:fs";
import path from "node:path";

const nowIct = new Date(Date.now() + 7 * 60 * 60 * 1000); // ICT = UTC+7
const todayKey = `${nowIct.getUTCFullYear()}-${String(nowIct.getUTCMonth() + 1).padStart(2, "0")}-${String(nowIct.getUTCDate()).padStart(2, "0")}`;

const markerPath = path.resolve("src/data/lastReportSent.json");
let lastDate = null;
if (existsSync(markerPath)) {
  try {
    lastDate = JSON.parse(readFileSync(markerPath, "utf8")).date ?? null;
  } catch {
    lastDate = null;
  }
}

const alreadySent = lastDate === todayKey;
console.log(`Today (ICT): ${todayKey} — last sent marker: ${lastDate ?? "none"} — already sent today: ${alreadySent}`);

const outputFile = process.env.GITHUB_OUTPUT;
if (outputFile) {
  appendFileSync(outputFile, `already_sent=${alreadySent}\ntoday=${todayKey}\n`);
}
