// protect.js — เลเยอร์กันการแกะ/คัดลอกหน้าเว็บแบบง่ายๆ (deterrent เท่านั้น ไม่ใช่การรักษาความปลอดภัยจริง —
// ดูคำอธิบายข้อจำกัดใน README หรือข้อความที่ Claude สรุปให้ตอนเพิ่มไฟล์นี้) ทำงานเฉพาะ production build
// (import.meta.env.PROD) เพื่อไม่ให้รบกวนตอน dev (npm run dev ยังเปิด DevTools/คลิกขวาได้ปกติ)
//
// ปิดได้ 3 อย่าง: คลิกขวา (context menu), คีย์ลัดเปิด DevTools/View Source ที่พบบ่อย, และแปะข้อความเตือนใน
// console กันคนถูกหลอกให้ไปวางสคริปต์แปลกๆ เอง (self-XSS) — ไม่ปิดการเลือก/คัดลอกข้อความ เพราะทีมยังต้องใช้
// copy ชื่อลูกค้า/ตัวเลขจากตารางไปใช้งานต่อจริงในชีวิตประจำวัน
export function enableBasicProtection() {
  if (!import.meta.env.PROD) return;

  document.addEventListener("contextmenu", (e) => e.preventDefault());

  document.addEventListener("keydown", (e) => {
    const key = e.key?.toUpperCase();
    const blocked =
      key === "F12" ||
      (e.ctrlKey && e.shiftKey && (key === "I" || key === "J" || key === "C")) ||
      (e.metaKey && e.altKey && (key === "I" || key === "J" || key === "C")) || // Safari/Mac เทียบเท่า Ctrl+Shift+...
      (e.ctrlKey && key === "U") ||
      (e.metaKey && e.altKey && key === "U");
    if (blocked) e.preventDefault();
  });

  console.log(
    "%cหยุดก่อน!",
    "color:#dc2626;font-size:28px;font-weight:bold;"
  );
  console.log(
    "%cหน้านี้เป็นข้อมูลภายในของ S45 Clinic ห้ามคัดลอก/เผยแพร่โดยไม่ได้รับอนุญาต หากมีใครให้คุณ copy/paste โค้ดลงตรงนี้ นั่นคือการหลอกเอาข้อมูล — อย่าทำ",
    "font-size:14px;"
  );
}
