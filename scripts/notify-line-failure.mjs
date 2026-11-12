#!/usr/bin/env node
// notify-line-failure.mjs
// ---------------------------------------------------------------
// ส่ง LINE push message แจ้งเตือนแอดมิน (LINE_TEST_USER_ID — คนเดียว ไม่ broadcast ให้ลูกค้าทุกคน) ทันทีที่
// pipeline ขั้นตอนไหนล้มเหลว — เพิ่ม 2026-11-12 หลังเจอว่า Facebook token หมดอายุ + Cloudflare token หาย
// ทำให้ Dashboard ข้อมูลค้าง 3 วันโดยไม่มีใครรู้ตัวเลย (GitHub ส่ง email แจ้งแต่ไม่มีใครเช็ค inbox นั้น) เรียกจาก
// step สุดท้ายของแต่ละ workflow ด้วย `if: failure() || ...` (ดูคอมเมนต์ใน workflow ไฟล์ที่เรียกใช้)
//
// ต้องมี secret ที่มีอยู่แล้ว (ไม่ต้องเพิ่มใหม่): LINE_CHANNEL_ACCESS_TOKEN, LINE_TEST_USER_ID
const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const LINE_TEST_USER_ID = process.env.LINE_TEST_USER_ID;
const WORKFLOW_NAME = process.env.WORKFLOW_NAME || "(ไม่ทราบชื่อ workflow)";
const RUN_URL = process.env.RUN_URL || "";
const FAILED_STEPS = process.env.FAILED_STEPS || "";

if (!LINE_CHANNEL_ACCESS_TOKEN || !LINE_TEST_USER_ID) {
  console.error("Missing LINE_CHANNEL_ACCESS_TOKEN / LINE_TEST_USER_ID — can't send failure notification.");
  process.exit(0); // ไม่ fail ทับปัญหาเดิมซ้ำ — แค่แจ้งเตือนไม่ได้เท่านั้น
}

const lines = [`⚠️ Pipeline ล้มเหลว: ${WORKFLOW_NAME}`];
if (FAILED_STEPS) lines.push(`Step ที่พัง: ${FAILED_STEPS}`);
if (RUN_URL) lines.push(RUN_URL);
const message = lines.join("\n");

const res = await fetch("https://api.line.me/v2/bot/message/push", {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}` },
  body: JSON.stringify({ to: LINE_TEST_USER_ID, messages: [{ type: "text", text: message }] }),
});
if (!res.ok) {
  const errText = await res.text().catch(() => "");
  console.error(`LINE push failed (${res.status}): ${errText}`);
  process.exit(0); // อย่า fail ทับปัญหาเดิม
}
console.log("Sent failure notification to LINE.");
