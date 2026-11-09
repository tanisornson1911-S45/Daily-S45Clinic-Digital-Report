import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import obfuscator from "vite-plugin-javascript-obfuscator";

export default defineConfig({
  plugins: [
    react(),
    // เฉพาะตอน build production (apply: "build" ไม่ทำตอน dev server) — สับชื่อ/ซ่อนสตริงในบันเดิล JS เพื่อ
    // เพิ่มความยากในการแกะโค้ด/logic ธุรกิจ (เช่น SURGERY_MAP, เป้าหมาย/สูตรคำนวณต่างๆ) ตั้งใจไม่เปิด
    // controlFlowFlattening/deadCodeInjection เพราะบันเดิลมีข้อมูล JSON ฝังอยู่เยอะมาก (RAW_TX/CONSULT_TX ฯลฯ)
    // เปิดสองตัวนี้จะทำให้ build ช้าลงมากและไฟล์บวมโดยไม่ได้ป้องกันอะไรเพิ่ม (ข้อมูลยังเป็น string/number literal
    // เหมือนเดิม ต้อง decode ได้เสมอให้แอพทำงาน) — ดูคำอธิบายข้อจำกัดเพิ่มเติมที่ README
    obfuscator({
      apply: "build",
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
