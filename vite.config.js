import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import obfuscator from "vite-plugin-javascript-obfuscator";

export default defineConfig({
  // ไม่ generate source map ตอน production build (Vite default คือ false อยู่แล้วถ้าไม่ตั้ง แต่ประกาศไว้ตรงนี้
  // ชัดเจน กันใครมาเปิดใน config ภายหลังโดยไม่ทันคิด) — ไม่งั้นใครก็ตามที่เปิดเว็บได้จะกู้โค้ดต้นฉบับอ่านง่ายคืนมา
  // ได้ทันทีผ่าน DevTools แม้จะ obfuscate บันเดิลจริงแค่ไหนก็ตาม
  build: {
    sourcemap: false,
    minify: true, // esbuild (ของ Vite เอง เร็วกว่า terser) — ใช้คู่กับ obfuscator ด้านล่างที่ทำงานเพิ่มเติมหลัง minify
  },
  plugins: [
    react(),
    // เฉพาะตอน build production (apply: "build" ไม่ทำตอน dev server) — สับชื่อ/ซ่อนสตริงในบันเดิล JS เพื่อเพิ่ม
    // ความยากในการแกะโค้ด/logic ธุรกิจ (เช่น SURGERY_MAP, เป้าหมาย/สูตรคำนวณต่างๆ) — ตั้งแต่ 2026-11-09 บันเดิลนี้
    // ไม่มีข้อมูลลูกค้า/ยอดขาย (RAW_TX/CONSULT_TX ฯลฯ) ฝังอยู่แล้ว (ย้ายไป fetch จาก Cloudflare Worker ที่เช็ค
    // Basic Auth+CORS แทน — ดู src/main.jsx/worker/) จึงเหลือแค่ "โค้ด" ที่ obfuscator ตัวนี้ป้องกัน ไม่ใช่ "ข้อมูล"
    // อีกต่อไป — ยังตั้งใจไม่เปิด controlFlowFlattening/deadCodeInjection เพราะทำให้ build ช้าลงมากและไฟล์บวมโดยได้
    // ประโยชน์เพิ่มไม่คุ้ม (เป็น deterrent อยู่ดี ไม่ใช่การป้องกันจริง — ดูคำอธิบายข้อจำกัดที่เคยสรุปให้)
    obfuscator({
      apply: "build",
      // src/main.jsx ต้องไม่ถูก obfuscate — มันมี import("./App.jsx")/import("./WorkerLogin.jsx") แบบ dynamic
      // import() ที่ Rollup ต้องเห็น string literal ตรงๆ ถึงจะ resolve เป็น chunk URL จริงได้ตอน build ถ้า
      // obfuscator เข้ารหัส string พวกนี้เป็น string-array ก่อน (ตั้งแต่ stringArray:true ด้านล่าง) Rollup จะมองไม่
      // เห็นว่าเป็น dynamic import แล้วปล่อย path เดิม (./App.jsx) ผ่านไปตรงๆ กลายเป็น "Failed to load dynamically
      // imported module" ตอนรันจริง (เจอบั๊กนี้จริงตอนทดสอบ) — ไฟล์อื่นๆ (App.jsx, WorkerLogin.jsx เอง ฯลฯ) ที่
      // import() เรียกถึง ยัง obfuscate ตามปกติ เพราะ Rollup resolve เป็น chunk แยกไปแล้วก่อนที่ชั้นในไฟล์นั้นๆ
      // จะถูก obfuscate
      exclude: [/src[\\/]main\.jsx$/],
      options: {
        compact: true,
        simplify: true,
        controlFlowFlattening: false,
        deadCodeInjection: false,
        stringArray: true,
        stringArrayRotate: true,
        stringArrayShuffle: true,
        stringArrayThreshold: 1,
        splitStrings: false,
        identifierNamesGenerator: "hexadecimal",
        renameGlobals: false,
        selfDefending: true,
        disableConsoleOutput: false,
      },
    }),
  ],
});
