#!/usr/bin/env node
// notify-line-failure.mjs
// ---------------------------------------------------------------
// ส่ง LINE แจ้งเตือนทันทีที่ pipeline ขั้นตอนไหนล้มเหลว — เพิ่ม 2026-11-12 หลังเจอว่า Facebook token หมดอายุ +
// Cloudflare token หาย ทำให้ Dashboard ข้อมูลค้าง 3 วันโดยไม่มีใครรู้ตัวเลย (GitHub ส่ง email แจ้งแต่ไม่มีใคร
// เช็ค inbox นั้น) เรียกจาก step สุดท้ายของแต่ละ workflow ด้วย `if: failure() || ...`
//
// ส่งเข้า LINE Official Account แยกต่างหากสำหรับแจ้งเตือนระบบโดยเฉพาะ (คนละตัวกับที่ส่งรายงานลูกค้า/
// broadcast จริง — ตั้งใจแยกเพื่อไม่ให้ error แจ้งเตือนไปปนกับ LINE OA ของธุรกิจ) ใช้โหมด broadcast ธรรมดา
// (ไม่ต้องรู้ user id — ใครก็ตามที่ follow LINE OA ตัวนี้ไว้จะได้รับหมด เหมาะกับ OA ที่มีแต่แอดมิน/ทีมแอด follow)
//
// ต้องตั้ง repo secret: LINE_ALERT_CHANNEL_ACCESS_TOKEN (Channel access token ของ LINE OA ที่สร้างแยกไว้
// สำหรับแจ้งเตือนนี้โดยเฉพาะ)
//
// พยายามวิเคราะห์สาเหตุ+วิธีแก้แบบคร่าวๆ ด้วย โดยดึง log ของ job ตัวเองผ่าน GitHub REST API (ต้องมี
// permissions: actions: read ในไฟล์ workflow ที่เรียก) แล้วจับ pattern error ที่เราเคยเจอมาก่อน — ถ้าจับ
// pattern ไม่ได้ก็ยัง fallback ไปแจ้งแค่ชื่อ workflow + ลิงก์ log เต็มให้ไปดูเองได้เสมอ (ไม่ crash)
const LINE_ALERT_CHANNEL_ACCESS_TOKEN = process.env.LINE_ALERT_CHANNEL_ACCESS_TOKEN;
const WORKFLOW_NAME = process.env.WORKFLOW_NAME || process.env.GITHUB_WORKFLOW || "(ไม่ทราบชื่อ workflow)";
const RUN_URL =
  process.env.RUN_URL ||
  (process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID
    ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
    : "");
const HINT = process.env.FAILED_STEPS || "";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO = process.env.GITHUB_REPOSITORY;
const RUN_ID = process.env.GITHUB_RUN_ID;

// รูปแบบ error ที่เคยเจอมาก่อนจริง — เรียงจากเฉพาะเจาะจงไปทั่วไป ตัวแรกที่ match ใช้เลย
const KNOWN_PATTERNS = [
  {
    re: /Error validating access token.*(password|security)/i,
    cause: "Facebook Access Token หมดอายุ/ถูกยกเลิก (มีคนเปลี่ยนรหัสผ่านบัญชีที่สร้าง Token หรือ Facebook รีเซ็ต session)",
    fix: "สร้าง Token ใหม่ (แนะนำ System User Token จาก Business Manager จะไม่หลุดเวลาเปลี่ยนรหัสผ่านส่วนตัวอีก) แล้วอัปเดต GitHub secret FB_ACCESS_TOKEN",
  },
  {
    re: /"code":\s*10000|Authentication error/i,
    cause: "Cloudflare API Token หาย/หมดอายุ/ไม่ถูกต้อง",
    fix: "สร้าง API Token ใหม่ที่ Cloudflare → My Profile → API Tokens (สิทธิ์ Workers KV Storage: Edit) แล้วอัปเดต secret CLOUDFLARE_API_TOKEN",
  },
  {
    re: /\[rejected\]|non-fast-forward|failed to push/i,
    cause: "Push เข้า git ชนกับ commit อื่นที่เข้ามาพร้อมกัน",
    fix: "ปกติ workflow จะลองใหม่อัตโนมัติอยู่แล้ว — ถ้ายัง fail ซ้ำ ให้เข้าไปเช็คว่ามี merge conflict ค้างอยู่ไหม",
  },
  {
    re: /LINE API error/i,
    cause: "ส่งข้อความผ่าน LINE Messaging API ไม่สำเร็จ",
    fix: "เช็คว่า LINE_CHANNEL_ACCESS_TOKEN (ตัวส่งรายงาน) ยังใช้ได้อยู่ หรือเกิน rate limit ของ LINE",
  },
  {
    re: /ENOTFOUND|ETIMEDOUT|ECONNRESET/i,
    cause: "เชื่อมต่อเครือข่ายไม่สำเร็จ",
    fix: "ส่วนใหญ่เป็นปัญหาชั่วคราวจากฝั่ง GitHub/ปลายทาง — ลองกด re-run workflow ได้เลย",
  },
];

async function fetchErrorLinesAndDiagnosis() {
  if (!GITHUB_TOKEN || !REPO || !RUN_ID) return { errorLines: [], diagnosis: null };
  try {
    const headers = { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: "application/vnd.github+json" };
    const jobsRes = await fetch(`https://api.github.com/repos/${REPO}/actions/runs/${RUN_ID}/jobs`, { headers });
    if (!jobsRes.ok) return { errorLines: [], diagnosis: null };
    const jobsJson = await jobsRes.json();
    const job = (jobsJson.jobs || []).find((j) => j.conclusion === "failure") || jobsJson.jobs?.[0];
    if (!job) return { errorLines: [], diagnosis: null };

    const logsRes = await fetch(`https://api.github.com/repos/${REPO}/actions/jobs/${job.id}/logs`, { headers });
    if (!logsRes.ok) return { errorLines: [], diagnosis: null };
    const logText = await logsRes.text();

    const errorLines = logText
      .split("\n")
      .filter((l) => l.includes("##[error]"))
      .map((l) => l.split("##[error]")[1]?.trim())
      .filter(Boolean)
      .slice(-5);

    const haystack = errorLines.join("\n") || logText;
    const diagnosis = KNOWN_PATTERNS.find((p) => p.re.test(haystack)) || null;
    return { errorLines, diagnosis };
  } catch (err) {
    console.error("Could not fetch/diagnose job logs:", err.message);
    return { errorLines: [], diagnosis: null };
  }
}

async function main() {
  if (!LINE_ALERT_CHANNEL_ACCESS_TOKEN) {
    console.error("Missing LINE_ALERT_CHANNEL_ACCESS_TOKEN — can't send failure notification.");
    process.exit(0); // ไม่ fail ทับปัญหาเดิมซ้ำ — แค่แจ้งเตือนไม่ได้เท่านั้น
  }

  const { errorLines, diagnosis } = await fetchErrorLinesAndDiagnosis();

  const lines = [`⚠️ Pipeline ล้มเหลว: ${WORKFLOW_NAME}`];
  if (HINT) lines.push(`Step: ${HINT}`);
  if (errorLines.length) {
    lines.push("", "Error:", ...errorLines.map((l) => `• ${l}`));
  }
  if (diagnosis) {
    lines.push("", `สาเหตุที่เป็นไปได้: ${diagnosis.cause}`, `วิธีแก้: ${diagnosis.fix}`);
  } else if (errorLines.length === 0) {
    lines.push("", "ไม่สามารถดึง log มาวิเคราะห์อัตโนมัติได้ — ดูรายละเอียดที่ลิงก์ด้านล่าง");
  }
  if (RUN_URL) lines.push("", RUN_URL);

  const message = lines.join("\n").slice(0, 4800); // LINE text message limit

  const res = await fetch("https://api.line.me/v2/bot/message/broadcast", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${LINE_ALERT_CHANNEL_ACCESS_TOKEN}` },
    body: JSON.stringify({ messages: [{ type: "text", text: message }] }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.error(`LINE push failed (${res.status}): ${errText}`);
    process.exit(0); // อย่า fail ทับปัญหาเดิม
  }
  console.log("Sent failure notification to LINE alert channel.");
}

main();
