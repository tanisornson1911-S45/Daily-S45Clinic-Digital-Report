import React, { useMemo, useState } from "react";
import {
  TrendingUp,
  Wallet,
  Percent,
  Target,
  ChevronDown,
  Lightbulb,
  Trophy,
  Stethoscope,
  ArrowUpDown,
  AlertTriangle,
  Megaphone,
  Users,
  Activity,
  PhoneCall,
  MapPin,
  Calendar,
  Layers,
  Rocket,
  ClipboardCheck,
  MessageCircle,
  Store,
  XCircle,
  Ban,
  Search,
  ArrowRightCircle,
  Zap,
  ExternalLink,
  Image as ImageIcon,
  UserCircle2,
  CheckCircle2,
  Clock,
  Sun,
  Moon,
  Menu,
  X,
  LayoutGrid,
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import {
  BarChart,
  Bar,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
  ResponsiveContainer,
} from "recharts";
import adSpendData from "./data/adSpend.json";
import RAW_TX_DATA from "./data/rawTx.json";
import LOA_DATA from "./data/loaData.json";
import LOA_NORMAL_DATA from "./data/loaNormalData.json";
import FUNNEL_AUG_DATA from "./data/funnelAug.json";
import AD_DAILY from "./data/adDaily.json";
const loaDataByMonth = LOA_DATA.months;
const loaNormalDataByMonth = LOA_NORMAL_DATA.months;

// ============================================================
// LIVE AD SPEND — src/data/adSpend.json ถูกเขียนทับอัตโนมัติโดย
// .github/workflows/update-dashboard-data.yml (รัน scripts/fetch-fb-spend.mjs
// ทุกวัน ดึงจาก Facebook Marketing API จริง) ตัวเลข hardcode ด้านล่างนี้เป็น
// "ค่าสำรอง" (fallback) ใช้ตอนที่ยังไม่เคยรัน workflow หรือเดือนนั้นไม่มีในไฟล์
// ============================================================
function liveSpend(monthKey, categoryKey, fallback) {
  const value = adSpendData?.months?.[monthKey]?.[categoryKey];
  return typeof value === "number" ? value : fallback;
}
// รวมยอด spend ทั้งเดือนจาก adSpend.json — รองรับทั้งเดือนที่มี breakdown ราย
// หมวด (เช่น 2026-06) และเดือนที่มีแค่ยอดรวมเดียว (field "total")
function liveMonthTotal(monthKey, fallback) {
  const month = adSpendData?.months?.[monthKey];
  if (!month) return fallback;
  if (typeof month.total === "number") return month.total;
  const categoryValues = Object.values(month).filter((v) => typeof v === "number");
  return categoryValues.length ? categoryValues.reduce((a, b) => a + b, 0) : fallback;
}
// MONTHLY_DATA ใช้ key แบบ oct25/nov25/... ส่วน adSpend.json ใช้ ISO "YYYY-MM" — แมประหว่างสองแบบตรงนี้
const MONTH_ISO = { oct25: "2025-10", nov25: "2025-11", dec25: "2025-12", jan26: "2026-01", feb26: "2026-02", mar26: "2026-03", apr26: "2026-04", may26: "2026-05", jun26: "2026-06", jul26: "2026-07", aug26: "2026-08" };

// ============================================================
// RAW_TX — ข้อมูลธุรกรรมจริงทุกแถว (ชีท "มัดจำ 2026" ใน Data S45 Clinic (5).xlsx) มาจาก
// src/data/rawTx.json ซึ่งสร้างอัตโนมัติทุกวันโดย scripts/build-raw-tx.mjs (รันหลัง
// scripts/fetch-m365-data.mjs ใน .github/workflows/update-m365-data.yml) ใช้คำนวณสด
// ตามช่วงวันที่ที่เลือก และเป็นฐานให้ CATEGORIES/FB_SURGERY/OTHER_CHANNEL_DATA/DOCTOR_PROC/
// OR_LEAD_TIME_DAYS ด้านล่างคำนวณสดตาม CURRENT_SPEND_MONTH ด้วย (ไม่ต้อง paste ตัวเลขมือแล้ว)
// or = OR Date จริง (null ถ้ายังไม่ระบุ/ยกเลิก) · tot = Total price จริงเท่านั้น (0 ถ้ายังไม่ปิด ไม่ประมาณจาก Online price)
// ============================================================
const RAW_TX = RAW_TX_DATA;

// เดือนที่ใช้เป็น "ค่าเริ่มต้น/ปัจจุบัน" ของหน้าแรก — แก้ตรงนี้เดือนเดียวเวลาเลื่อนเดือน
// (CATEGORIES/FB_SURGERY/OTHER_CHANNEL_DATA/DOCTOR_PROC/OR_LEAD_TIME_DAYS ทั้งหมดคำนวณจาก
// RAW_TX กรองเดือนนี้ — เลื่อนเดือนแล้วค่าทุกตัวขยับตามอัตโนมัติ ไม่ต้องแก้ที่อื่นอีก)
const CURRENT_SPEND_MONTH = "2026-07";

// helper: แถว RAW_TX ทั้งหมดในเดือน CURRENT_SPEND_MONTH (ISO "YYYY-MM")
function txInMonth(monthIso) {
  return RAW_TX.filter((t) => t.d.startsWith(monthIso));
}
// helper: รวม deposit/online/sales(Total price จริง) ของ RAW_TX ในเดือนหนึ่ง กรองหมวดหัตถการ
// (ไม่รวม "other" ตามธรรมเนียมเดิม) — ใช้สร้าง CATEGORIES ให้สดจาก RAW_TX แทนพิมพ์ตัวเลขมือ
function liveCategoryTotals(monthIso, categoryKey) {
  const rows = txInMonth(monthIso).filter((t) => t.p === categoryKey);
  return {
    deposit: rows.reduce((s, t) => s + t.dep, 0),
    online: rows.reduce((s, t) => s + t.onl, 0),
    sales: rows.reduce((s, t) => s + (t.tot || 0), 0),
  };
}

// ============================================================
// SOURCE 1 — เดือน CURRENT_SPEND_MONTH (ปัจจุบัน ก.ค. 2026) — deposit/online/sales คำนวณสดจาก
// RAW_TX ทุกครั้งที่โหลดหน้า (liveCategoryTotals) ไม่ใช่ตัวเลขพิมพ์มือแล้ว ตั้งแต่ 2026-08-25
// target: ชีต Budget Allocate July26 คอลัมน์ Target (ค่าเป้าหมายทางธุรกิจ พิมพ์มือ ต้องอัปเดตเองทุกเดือน)
// spend: ใช้ค่าสดจาก src/data/adSpend.json (เดือน CURRENT_SPEND_MONTH) ถ้ามี ไม่งั้น fallback เป็นตัวเลขที่ดึงมาล่าสุด
// sales = Total price จริงเท่านั้น (ไม่ประมาณเคสที่ยังไม่ปิดด้วย Online price) ไม่รวมหมวด "other"
// หมายเหตุ: เคส Inter ในไฟล์ธุรกรรมไม่ได้แท็กแยกเป็นหมวดของตัวเอง (ถูกแท็ก Nose Open ปนอยู่ใน RAW_TX) จึง
// เป็นไปได้ที่ nose_open ด้านล่างนี้ทับซ้อนกับยอด "inter" บางส่วน — เหมือนปัญหาเดียวกับที่เจอฝั่งงบ Ads (ดู
// categorySpendForRange) ยังไม่มีวิธีแยกที่แน่นอนจากข้อมูลที่มี · GRAND_TOTAL ด้านล่างตัดปัญหานี้ด้วยการไม่รวม
// "inter" เข้ายอดขายรวม (ทีมยืนยัน 2026-08-25 ว่า RAW_TX/Data S45 เป็น Core Data ที่ถูกต้องกว่า)
// inter: ยังพิมพ์มือจากไฟล์ Inter_S45_2026_Sale_partJuly_07 (online=ยอด Online price รวม, sales=ยอด Total รวม,
// deposit=0 ตามธรรมเนียมเดิม) — แสดงอ้างอิงต่อหัตถการเท่านั้น
// targetPct = sales / target (คำนวณสดด้านล่างหลังสร้าง CATEGORIES)
// ============================================================
const CATEGORIES = {
  nose_open: { label: "เสริมจมูกโอเพ่น", spend: liveSpend(CURRENT_SPEND_MONTH, "nose_open", 892768), ...liveCategoryTotals(CURRENT_SPEND_MONTH, "nose_open"), target: 20000000 },
  breast_lipo: { label: "เสริมหน้าอก/ดูดไขมัน/ตัดหนังหน้าท้อง", spend: liveSpend(CURRENT_SPEND_MONTH, "breast_lipo", 46232), ...liveCategoryTotals(CURRENT_SPEND_MONTH, "breast_lipo"), target: 3000000 },
  brow_hairline: { label: "ยกคิ้ว/เลื่อนไรผม/ยกมุมปาก", spend: liveSpend(CURRENT_SPEND_MONTH, "brow_hairline", 503632), ...liveCategoryTotals(CURRENT_SPEND_MONTH, "brow_hairline"), target: 6000000 },
  nose_semi: { label: "เสริมจมูก Semi Open", spend: liveSpend(CURRENT_SPEND_MONTH, "nose_semi", 101825), ...liveCategoryTotals(CURRENT_SPEND_MONTH, "nose_semi"), target: 3000000 },
  // inter: ยังคงพิมพ์มือจากไฟล์ Inter_S45_2026_Sale_partJuly_07 (deposit=0 ตามธรรมเนียมเดิม) — ไม่ดึงจาก
  // RAW_TX เพราะเคส Inter ส่วนใหญ่ถูกนับอยู่ใน nose_open ด้านบนแล้ว (ทีมยืนยันว่า RAW_TX/Data S45 เป็น Core
  // Data ที่ถูกต้องกว่า 2026-08-25) แถวนี้ใช้แสดงอ้างอิงต่อหัตถการเท่านั้น ไม่รวมเข้า GRAND_TOTAL (ดูด้านล่าง)
  inter: { label: "Inter", spend: liveSpend(CURRENT_SPEND_MONTH, "inter", 34375), deposit: 0, online: 3493380, sales: 4236880, target: 2000000 },
};
for (const c of Object.values(CATEGORIES)) c.targetPct = c.target > 0 ? c.sales / c.target : 0;

// แถว "รวม" สีน้ำตาลท้ายชีตต้นฉบับ — ค่าโฆษณาคอลัมน์นี้คือ Facebook เท่านั้น
// (ยอดมัดจำ/Online/Total Price เป็นยอดขายรวมของคลินิก ไม่แยกช่องทาง)
// spend: รวมจาก CATEGORIES ด้านบน (ซึ่งอ่านค่าสดจาก adSpend.json แล้ว) แทนตัวเลขคงที่เดิม
// deposit/online/sales: รวมจาก CATEGORIES ด้านบนเช่นกัน (ก.ค. 2026)
// หมายเหตุ 25 ส.ค. 2026: deposit/online/sales รวมเฉพาะ 4 หมวดหลัก (ไม่รวม "inter") เพราะทีมยืนยันว่า
// เคส Inter ส่วนใหญ่ถูกบันทึกซ้ำอยู่ใน "มัดจำ 2026" (Data S45 Clinic — Core Data ที่ถูกต้องกว่า) อยู่แล้ว
// ภายใต้หมวด nose_open การรวม CATEGORIES.inter.sales เข้าไปด้วยจะนับซ้ำ — ตัดออกจากยอดขายรวม (แต่ spend
// ยังรวม inter ตามเดิม เพราะเป็นค่าโฆษณาจริงที่แยกบัญชี ไม่ใช่ยอดขายที่มาซ้ำ)
const GRAND_TOTAL_SALES_CATEGORIES = ["nose_open", "breast_lipo", "brow_hairline", "nose_semi"];
const GRAND_TOTAL = {
  spend: Object.values(CATEGORIES).reduce((sum, c) => sum + (c.spend || 0), 0),
  deposit: GRAND_TOTAL_SALES_CATEGORIES.reduce((sum, k) => sum + (CATEGORIES[k].deposit || 0), 0),
  online: GRAND_TOTAL_SALES_CATEGORIES.reduce((sum, k) => sum + (CATEGORIES[k].online || 0), 0),
  sales: GRAND_TOTAL_SALES_CATEGORIES.reduce((sum, k) => sum + (CATEGORIES[k].sales || 0), 0),
};

// ============================================================
// ข้อมูลรายเดือน (ต.ค. 2025 – ส.ค. 2026) สำหรับ Filter เลือกเดือน
// spend: ดึงสดจาก Facebook Ads MCP จริง (6 บัญชี รวม Nose Open 01-03, Semi Open, เสริมหน้าอก, ยกคิ้ว-ดึงหน้า)
// deposit/online/sales: คำนวณจาก RAW_TX ทั้งเดือน (อัปเดต 25 ส.ค. 2026 จากชีท "มัดจำ 2026" ใน
// Data S45 Clinic (5).xlsx ผ่าน M365 pipeline — ยืนยันเป็น master ledger จริงที่ RAW_TX สร้างมาจากตั้งแต่แรก)
// ไฟล์นี้ไม่ครอบคลุมย้อนไปถึง ต.ค.-ธ.ค. 2025 จึงไม่มียอดขายให้เดือนเหล่านั้น
// นิยาม (ยืนยันกับทีม 25 ส.ค. 2026): deposit = ยอดมัดจำ (ลูกค้าจองคิว+จ่ายมัดจำล็อคสิทธิ์),
// online = ราคาที่คาดการณ์ไว้สำหรับหัตถการที่ลูกค้าเลือก (ไม่ใช่ยอดขายจริง),
// sales = ผลรวม Total price เท่านั้น (ยอดขายจริงที่ลูกค้าจ่ายจริง เคสที่ยังไม่ปิด OR นับเป็น 0 ไม่ใช้ Online
// price มาประมาณแทน) — เดือนที่ยังไม่จบ (ส.ค.) ยอด sales จึงต่ำกว่ายอด deposit/online ตามสัดส่วนเคสที่ยังไม่ปิด
// หมายเหตุ: มิ.ย. 2026 ใช้ตัวเลข deposit/online/sales จากชีต Budget Allocate (แหล่งทางการที่ใช้ทั้ง Dashboard) — เดือนอื่นคำนวณจาก
// RAW_TX โดยตรง อาจมีนิยาม/ขอบเขตต่างจากมิ.ย.เล็กน้อย
// ============================================================
const MONTHLY_DATA = {
  oct25: { label: "ตุลาคม 2025", spend: liveMonthTotal(MONTH_ISO.oct25, 849372), deposit: null, online: null, sales: null },
  nov25: { label: "พฤศจิกายน 2025", spend: liveMonthTotal(MONTH_ISO.nov25, 843033), deposit: null, online: null, sales: null },
  dec25: { label: "ธันวาคม 2025", spend: liveMonthTotal(MONTH_ISO.dec25, 1002106), deposit: null, online: null, sales: null },
  jan26: { label: "มกราคม 2026", spend: liveMonthTotal(MONTH_ISO.jan26, 1081752), deposit: 3061630, online: 16386430, sales: 10617920 },
  feb26: { label: "กุมภาพันธ์ 2026", spend: liveMonthTotal(MONTH_ISO.feb26, 1418462), deposit: 1749390, online: 12370740, sales: 9233500 },
  mar26: { label: "มีนาคม 2026", spend: liveMonthTotal(MONTH_ISO.mar26, 1191297), deposit: 3156361, online: 19166790, sales: 14987720 },
  apr26: { label: "เมษายน 2026", spend: liveMonthTotal(MONTH_ISO.apr26, 1048204), deposit: 2028990, online: 10430890, sales: 11281413 },
  may26: { label: "พฤษภาคม 2026", spend: liveMonthTotal(MONTH_ISO.may26, 1430197), deposit: 3298481, online: 12855190, sales: 14065500 },
  // spend: เท่ากับ GRAND_TOTAL.spend เสมอ (คำนวณจาก adSpend.json เดือน 2026-06 ถ้ามี)
  jun26: { label: "มิถุนายน 2026", spend: GRAND_TOTAL.spend, deposit: 2678980, online: 11608200, sales: 10448010 },
  // สเปนด์ ก.ค. 2026 อัปเดต 13 ส.ค. 2026 เป็น 1,673,928.18 บาท (ปัดเป็น 1673928) ตามตัวเลขที่ทีมยืนยันมา ครอบคลุม
  // ทุกบัญชีและทุกแคมเปญทั้งที่ปิด/ลบ/รันอยู่ — สูงกว่ายอดที่ดึงจาก Facebook Ads MCP account-level ตรงๆ (1,550,958)
  // เพราะ MCP ดึงยอดระดับบัญชีไม่ครบทุกแคมเปญที่ถูกลบ (ดู comment ใน src/data/adSpend.json "UPDATE 2026-08-13")
  // sales อัปเดต 25 ส.ค. 2026: 16,281,890 (Total price จริงเท่านั้น) แทน 19,544,667 เดิมที่ประมาณเคสยังไม่ปิดด้วย
  // Online price แทน — ทีมยืนยันแล้วว่ายอดขายรวมต้องนับจาก Total price จริงเท่านั้น ไม่ใช้ Online price มาประมาณ
  jul26: { label: "กรกฎาคม 2026", spend: liveMonthTotal(MONTH_ISO.jul26, 1673928), deposit: 3609892, online: 11298798, sales: 16281890 },
  // สเปนด์สดถึงวันนี้จาก Facebook Ads MCP · deposit/online/sales จาก RAW_TX ครอบคลุมถึงวันที่ล่าสุดที่ pipeline ดึงมาได้
  // (ไม่ระบุช่วงวันที่ในป้ายชื่อ เพราะระบบนี้อัปเดตต่อเนื่องไปเรื่อยๆ ทุกเดือน ไม่ใช่หยุดที่วันใดวันหนึ่งตายตัว)
  aug26: { label: "สิงหาคม 2026", spend: liveMonthTotal(MONTH_ISO.aug26, 1246200), deposit: 1053986, online: 6508500, sales: 6125600 },
};
const MONTH_OPTIONS = Object.entries(MONTHLY_DATA).map(([k, v]) => [k, v.label]);



// helper: จัดกลุ่ม RAW_TX เดือน CURRENT_SPEND_MONTH ตามหัตถการ กรองด้วย predicate ของ channel
// (cases/deposit/online/total) — ใช้สร้าง FB_SURGERY/OTHER_CHANNEL_DATA สดแทนพิมพ์ตัวเลขมือ
function liveSurgeryByChannel(monthIso, channelPredicate, otherLabel) {
  const rows = txInMonth(monthIso).filter(channelPredicate);
  const defs = [
    ["nose_open", "Nose Open"],
    ["brow_hairline", "Brow Lift"],
    ["breast_lipo", "Breast"],
    ["nose_semi", "Semi Open"],
    ["other", otherLabel],
  ];
  return defs.map(([key, label]) => {
    const sub = rows.filter((t) => t.p === key);
    return {
      key,
      label,
      cases: sub.length,
      deposit: sub.reduce((s, t) => s + t.dep, 0),
      online: sub.reduce((s, t) => s + t.onl, 0),
      total: sub.reduce((s, t) => s + (t.tot || 0), 0),
    };
  });
}

// ============================================================
// SOURCE 2 — RAW_TX เดือน CURRENT_SPEND_MONTH กรอง Channel = Facebook เท่านั้น กรุ๊ปตามหัตถการ
// คำนวณสดทุกครั้งที่โหลดหน้า (liveSurgeryByChannel) — spend: ใช้ค่าสดจาก adSpend.json เช่นเดียวกับ CATEGORIES
// ============================================================
const FB_SURGERY_SPEND_FALLBACK = { nose_open: 892768, brow_hairline: 503632, breast_lipo: 46232, nose_semi: 101825 };
const FB_SURGERY = liveSurgeryByChannel(CURRENT_SPEND_MONTH, (t) => t.ch === "Facebook", "อื่นๆ (Eye/เสริมขมับ)").map((r) => ({
  ...r,
  spend: r.key === "other" ? null : liveSpend(CURRENT_SPEND_MONTH, r.key, FB_SURGERY_SPEND_FALLBACK[r.key]),
}));
const FB_BY_KEY = Object.fromEntries(FB_SURGERY.map((r) => [r.key, r]));
const FB_TOTAL = FB_SURGERY.reduce(
  (acc, r) => ({
    cases: acc.cases + r.cases,
    deposit: acc.deposit + r.deposit,
    online: acc.online + r.online,
    total: acc.total + r.total,
  }),
  { cases: 0, deposit: 0, online: 0, total: 0 }
);

// ============================================================
// SOURCE 2b — RAW_TX เดือน CURRENT_SPEND_MONTH กรอง Channel = Line / WhatsApp / (Sale หาเอง + ช่องทางส่วนตัว BA)
// คำนวณสดทุกครั้งที่โหลดหน้า เหมือน FB_SURGERY
// ============================================================
const OTHER_CHANNEL_META = {
  line: { label: "LINE", color: "green" },
  whatsapp: { label: "WhatsApp", color: "emerald" },
  sale_ba: { label: "ช่องทางอื่น (Sale หรือ BA)", color: "amber" },
};
const OTHER_CHANNEL_DATA = {
  line: liveSurgeryByChannel(CURRENT_SPEND_MONTH, (t) => t.ch === "Line", "อื่นๆ (Eye ฯลฯ)"),
  whatsapp: liveSurgeryByChannel(CURRENT_SPEND_MONTH, (t) => t.ch === "WhatsApp", "อื่นๆ (Eye/ETC. ฯลฯ)"),
  sale_ba: liveSurgeryByChannel(CURRENT_SPEND_MONTH, (t) => t.ch === "Sale หาเอง" || t.ch === "ช่องทางส่วนตัว BA", "อื่นๆ (Eye ฯลฯ)"),
};
const otherChannelTotalOf = (rows) =>
  rows.reduce(
    (acc, r) => ({ cases: acc.cases + r.cases, deposit: acc.deposit + r.deposit, online: acc.online + r.online, total: acc.total + r.total }),
    { cases: 0, deposit: 0, online: 0, total: 0 }
  );

// computeFbTotalsForRange / computeOtherChannelTotalsForRange: เหมือน activeFbTotal/activeOtherChannelTotal
// ใน component แต่รับ range เป็นพารามิเตอร์ได้อิสระ (pure function) — ใช้คำนวณยอดของ compareRange เพื่อทำ
// ป้าย % เทียบ (MoMBadge) บนการ์ดสรุปของแต่ละ section โดยไม่ต้องผูกกับ dateRange หลักที่เลือกอยู่จริง
function computeFbTotalsForRange(range) {
  if (range.start === "2026-07-01" && range.end === "2026-07-31") return FB_TOTAL;
  const fb = RAW_TX.filter((t) => t.d >= range.start && t.d <= range.end && t.ch === "Facebook");
  return {
    cases: fb.length,
    total: fb.reduce((s, r) => s + r.tot, 0),
    online: fb.reduce((s, r) => s + r.onl, 0),
    deposit: fb.reduce((s, r) => s + r.dep, 0),
  };
}
function computeOtherChannelTotalsForRange(range, filter) {
  if (range.start === "2026-07-01" && range.end === "2026-07-31") return otherChannelTotalOf(OTHER_CHANNEL_DATA[filter]);
  const chMatch =
    filter === "line"
      ? (t) => t.ch === "Line"
      : filter === "whatsapp"
        ? (t) => t.ch === "WhatsApp"
        : (t) => t.ch === "Sale หาเอง" || t.ch === "ช่องทางส่วนตัว BA";
  const rows = RAW_TX.filter((t) => t.d >= range.start && t.d <= range.end && chMatch(t));
  return {
    cases: rows.length,
    total: rows.reduce((s, r) => s + r.tot, 0),
    online: rows.reduce((s, r) => s + r.onl, 0),
    deposit: rows.reduce((s, r) => s + r.dep, 0),
  };
}

// ============================================================
// SOURCE 3 — RAW_TX เดือน CURRENT_SPEND_MONTH ทุกช่องทาง เฉพาะแถวที่มีมัดจำ (dep > 0)
// กรุ๊ปตาม Doctor + Surgery คำนวณสดทุกครั้งที่โหลดหน้า — key ตรงกับหมวดหัตถการเดียวกับด้านบน
// ชื่อหมอคงไว้ตามที่พิมพ์ในไฟล์ต้นฉบับเป๊ะ (มีสะกดต่างกัน "จิจ๊ะ"/"จิ๊จ๊ะ" และแถวเคสร่วม 2 หมอ ไม่ได้รวมให้เอง)
// ============================================================
function liveDoctorProc(monthIso) {
  const rows = txInMonth(monthIso).filter((t) => t.dep > 0);
  const map = new Map();
  for (const t of rows) {
    const k = `${t.doc}|${t.p}`;
    if (!map.has(k)) map.set(k, { doctor: t.doc, key: t.p, cases: 0, deposit: 0, online: 0, total: 0 });
    const e = map.get(k);
    e.cases += 1;
    e.deposit += t.dep;
    e.online += t.onl;
    e.total += t.tot || 0;
  }
  return [...map.values()];
}
const DOCTOR_PROC = liveDoctorProc(CURRENT_SPEND_MONTH);

const DOCTOR_PROC_LABELS = {
  nose_open: "เสริมจมูกโอเพ่น",
  breast_lipo: "เสริมหน้าอก/ดูดไขมัน/ตัดหนังหน้าท้อง",
  brow_hairline: "ยกคิ้ว/เลื่อนไรผม/ยกมุมปาก",
  nose_semi: "เสริมจมูก Semi Open",
  other: "อื่นๆ (Eye/เสริมคาง/เสริมหน้าผาก)",
};
const DOCTOR_PROC_OPTIONS = [["all", "รวมทุกหัตถการ"], ...Object.entries(DOCTOR_PROC_LABELS)];
// รายชื่อหมอทั้งหมด ใช้เป็นตัวเลือก Dropdown "แยกหมอ" ในสรุปเคสมัดจำแยกตามหมอ — รวมทั้งชื่อจาก DOCTOR_PROC (มิ.ย.)
// และชื่อจริงทั้งหมดที่พบในไฟล์ธุรกรรม RAW_TX (ครอบคลุมทุกเดือน) เพราะสะกดไม่ตรงกันบางชื่อ (เช่น "หมอจิจ๊ะ" ในไฟล์มิ.ย.
// กับ "หมอจิ๊จ๊ะ" ในไฟล์ธุรกรรมดิบ) และมีหมอบางคนที่ไม่มีเคสมัดจำในมิ.ย.เลยจึงไม่อยู่ใน DOCTOR_PROC แต่มีเคสในเดือนอื่น
// ตัดค่า "รอระบุ" ออกเพราะไม่ใช่ชื่อหมอจริง (แปลว่ายังไม่ได้ระบุ)
const DOCTOR_NAME_OPTIONS = [
  ["all", "ทุกคน (รวม)"],
  ...[...new Set([...DOCTOR_PROC.map((r) => r.doctor), ...RAW_TX.map((t) => t.doc)])]
    .filter((name) => name && name !== "รอระบุ")
    .sort()
    .map((name) => [name, name]),
];

const DOCTOR_TOTAL = DOCTOR_PROC.reduce(
  (acc, r) => ({ cases: acc.cases + r.cases, deposit: acc.deposit + r.deposit }),
  { cases: 0, deposit: 0 }
);

// ============================================================
// Inter — เคสจริงแยกตามหมอ + หัตถการ แยกเป็นรายเดือน
// มิ.ย. 2026 จากไฟล์ Inter_S45_2026_Sale_part_June_06, ก.ค. 2026 จากไฟล์ Inter_S45_2026_Sale_partJuly_07 (อัปโหลด 2026-08-07)
// deposit (ยอดมัดจำ) = Online Price + Medical check up Etc. (ไม่รวม Top up)
// total (ยอด OR / Total) = คอลัมน์ Total ในไฟล์ต้นฉบับ
// ============================================================
// เดือนที่แสดงผลตอนนี้ผูกกับ Filter วันที่หลักของหน้า (ดู interMonthKey/interMonthDataKey ใน component)
// ไม่มี Dropdown เดือนแยกอีกต่อไป — มีข้อมูลจริงแค่ มิ.ย./ก.ค. 2569 เท่านั้น (INTER_BY_DOCTOR_MONTH ด้านล่าง)
const INTER_PROC_LABELS = {
  nose_open: "Nose Open",
  breast: "Breast",
  endotine: "Endotine",
  etc: "ETC. (ดูดไขมันหน้า/ตัดกระพุ้งแก้ม)",
  brow_lift: "Brow Lift",
  lipo_face: "Lipo (Face)",
};
const INTER_PROC_OPTIONS = [["all", "ทุกหัตถการ"], ...Object.entries(INTER_PROC_LABELS)];
const INTER_DOCTOR_LABELS = {
  all: "ทุกคน (รวม)",
  norn: "หมอ NORN",
  boy: "หมอ Boy",
  pek: "หมอ Pek",
  ty: "หมอ TY",
  big: "หมอ BIG",
  ped: "หมอ Ped",
  terng: "หมอ Terng",
};
const INTER_DOCTOR_OPTIONS = Object.entries(INTER_DOCTOR_LABELS);
const INTER_BY_DOCTOR_MONTH = {
  jun26: {
    all: [
      { key: "nose_open", label: "Nose Open", cases: 4, deposit: 1721000, total: 1721000 },
      { key: "breast", label: "Breast", cases: 2, deposit: 149980, total: 270000 },
      { key: "endotine", label: "Endotine", cases: 1, deposit: 130390, total: 130390 },
      { key: "etc", label: "ETC. (ดูดไขมันหน้า/ตัดกระพุ้งแก้ม)", cases: 2, deposit: 438950, total: 438950 },
      { key: "brow_lift", label: "Brow Lift", cases: 1, deposit: 100000, total: 100000 },
    ],
    norn: [{ key: "endotine", label: "Endotine", cases: 1, deposit: 130390, total: 130390 }],
    boy: [{ key: "breast", label: "Breast", cases: 2, deposit: 149980, total: 270000 }],
    pek: [{ key: "etc", label: "ETC. (ดูดไขมันหน้า/ตัดกระพุ้งแก้ม)", cases: 1, deposit: 313990, total: 313990 }],
    ty: [{ key: "nose_open", label: "Nose Open", cases: 3, deposit: 1101000, total: 1101000 }],
    big: [{ key: "nose_open", label: "Nose Open", cases: 1, deposit: 620000, total: 620000 }],
    ped: [{ key: "etc", label: "ETC. (ดูดไขมันหน้า/ตัดกระพุ้งแก้ม)", cases: 1, deposit: 124960, total: 124960 }],
    terng: [{ key: "brow_lift", label: "Brow Lift", cases: 1, deposit: 100000, total: 100000 }],
  },
  // ก.ค. 2026: 7 เคส (HN012410, 013091, 013166, 013033, 013031, 013304 + เคสเสริม Lipo Face ของหมอ Pek ที่ไม่มี HN แยกในไฟล์)
  // ยอดรวมตรงกับแถว "รวม" ท้ายไฟล์เป๊ะ (Online 3,493,380 + Top up 701,450 + Medical check up 42,050 = Total 4,236,880)
  jul26: {
    all: [
      { key: "nose_open", label: "Nose Open (OPEN RHINO)", cases: 6, deposit: 3530840, total: 4086820 },
      { key: "lipo_face", label: "Lipo (Face)", cases: 1, deposit: 4590, total: 150060 },
    ],
    ty: [{ key: "nose_open", label: "Nose Open (OPEN RHINO)", cases: 5, deposit: 2983150, total: 3473150 }],
    big: [{ key: "nose_open", label: "Nose Open (OPEN RHINO)", cases: 1, deposit: 547690, total: 613670 }],
    pek: [{ key: "lipo_face", label: "Lipo (Face)", cases: 1, deposit: 4590, total: 150060 }],
    norn: [],
    boy: [],
    ped: [],
    terng: [],
  },
};

// ============================================================
// SOURCE 4 — Ads → Inbox → Sales funnel รายวัน มิ.ย. 2026 แยกตามหัตถการ
// (ยอดยิง Ads, Inbox, ยอดขายบิลปรึกษา+มัดจำ, ยอด OR รายวัน)
// ============================================================
const FUNNEL_DATA = {"nose_open": {"label": "เสริมจมูกโอเพ่น (Nose Open)", "ads": 866798, "inbox": 3104, "or": 2466440, "sales": 15982920, "basket": 319658, "closeRate": 0.0161, "adsCost": 0.0542, "adsCostOr": 0.3514, "dailyAds": [37351, 37125, 33514, 30154, 24158, 21513, 29961, 31318, 28778, 26120, 26166, 20350, 22931, 28165, 28181, 25724, 23664, 27867, 26273, 22405, 31614, 31112, 25645, 25512, 26320, 30865, 31078, 37299, 39633, 36002], "dailyInbox": [128, 143, 122, 105, 74, 87, 119, 107, 87, 109, 109, 89, 82, 122, 101, 60, 99, 108, 90, 85, 130, 112, 90, 69, 92, 106, 116, 144, 131, 88], "dailyOr": [175990, 0, 0, 0, 614480, 464990, 0, 0, 0, 230000, 555990, 0, 424990, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], "dailyConsult": [0, 3, 1, 1, 1, 2, 1, 2, 1, 1, 2, 1, 2, 1, 2, 2, 2, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], "dailyDeposit": [1, 1, 1, 4, 2, 1, 0, 1, 0, 2, 1, 0, 1, 1, 2, 2, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], "dailyOrCases": [1, 0, 0, 0, 2, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 2, 0, 3, 0, 0, 2, 3, 1, 2, 1, 0, 0, 1]}, "nose_semi": {"label": "เสริมจมูก Semi Open", "ads": 84916, "inbox": 809, "or": 623394, "sales": 1118500, "basket": 43019, "closeRate": 0.0321, "adsCost": 0.0759, "adsCostOr": 0.1362, "dailyAds": [2809, 2944, 2974, 2854, 2615, 2339, 3450, 3504, 3093, 2925, 2990, 2514, 2334, 2906, 2694, 2856, 2688, 2601, 2291, 1717, 2724, 3427, 3174, 2648, 2260, 2664, 2491, 3522, 3796, 3112], "dailyInbox": [24, 30, 39, 27, 23, 18, 23, 35, 31, 22, 15, 16, 22, 25, 19, 22, 28, 14, 21, 22, 24, 47, 49, 28, 23, 25, 37, 32, 34, 34], "dailyOr": [12900, 33949, 0, 0, 0, 52900, 0, 0, 47989, 0, 161489, 102489, 0, 0, 55889, 97889, 57900, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], "dailyConsult": [0, 1, 0, 0, 1, 0, 1, 3, 0, 0, 1, 0, 1, 1, 0, 2, 0, 2, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], "dailyDeposit": [0, 0, 0, 2, 0, 0, 2, 1, 3, 0, 0, 0, 0, 1, 0, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], "dailyOrCases": [1, 1, 0, 0, 0, 1, 0, 0, 1, 0, 2, 1, 0, 0, 2, 2, 1, 1, 0, 1, 0, 0, 1, 0, 1, 0, 0, 0, 2, 1]}, "breast_lipo": {"label": "เสริมหน้าอก/ดูดไขมัน", "ads": 58989, "inbox": 314, "or": 1182720, "sales": 914280, "basket": 76190, "closeRate": 0.0382, "adsCost": 0.0645, "adsCostOr": 0.0499, "dailyAds": [2908, 2889, 2619, 2524, 2141, 1721, 2667, 3013, 3240, 2673, 2180, 1378, 1054, 2018, 1937, 1563, 1561, 1653, 1524, 1219, 2034, 1752, 1737, 1649, 1666, 1290, 1032, 1923, 1871, 1555], "dailyInbox": [12, 8, 11, 11, 7, 6, 4, 13, 15, 12, 9, 5, 5, 4, 13, 9, 7, 11, 15, 11, 16, 10, 13, 7, 14, 7, 17, 19, 13, 10], "dailyOr": [0, 0, 0, 0, 0, 0, 0, 0, 76760, 288460, 0, 0, 313990, 0, 0, 256880, 246630, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], "dailyConsult": [0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 2, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0], "dailyDeposit": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], "dailyOrCases": [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 3, 0, 0, 1, 0, 0, 0, 2, 0, 0, 0, 0, 0, 1]}, "brow_hairline": {"label": "ยกคิ้ว/เลื่อนไรผม/ยกมุมปาก", "ads": 389661, "inbox": 2973, "or": 1875107, "sales": 3390900, "basket": 154132, "closeRate": 0.0074, "adsCost": 0.1149, "adsCostOr": 0.2078, "dailyAds": [14773, 15594, 13907, 13119, 13462, 11171, 13632, 14500, 15124, 13359, 10399, 10952, 8095, 11689, 11457, 10591, 12754, 11551, 12214, 10186, 13850, 14375, 14529, 14961, 14232, 13831, 12656, 14994, 15161, 12543], "dailyInbox": [93, 110, 104, 109, 123, 94, 87, 87, 97, 101, 81, 88, 79, 97, 100, 84, 106, 87, 110, 96, 115, 99, 104, 104, 85, 113, 98, 106, 112, 104], "dailyOr": [266380, 0, 0, 337780, 246280, 366997, 0, 0, 0, 0, 215890, 0, 235890, 0, 0, 205890, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], "dailyConsult": [0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 1, 1, 1, 0, 0, 1, 0, 0, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], "dailyDeposit": [1, 1, 0, 1, 1, 0, 2, 0, 1, 0, 2, 1, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], "dailyOrCases": [1, 0, 0, 2, 2, 2, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1]}, "inter": {"label": "Inter", "ads": 32371, "inbox": 143, "or": 2660340, "sales": 2660340, "basket": 266034, "closeRate": 0.0, "adsCost": 0.012168, "adsCostOr": 0.012168, "dailyAds": [582, 521, 503, 516, 696, 724, 912, 1020, 1008, 809, 810, 842, 796, 1092, 1009, 1838, 1750, 1180, 1527, 1089, 1867, 1895, 1194, 1013, 1045, 1029, 965, 1341, 1396, 1402], "dailyInbox": [0, 5, 0, 5, 0, 2, 4, 0, 1, 3, 3, 1, 0, 3, 0, 6, 20, 13, 10, 9, 12, 11, 9, 3, 2, 3, 5, 3, 7, 3], "dailyOr": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], "dailyConsult": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], "dailyDeposit": [0, 0, 0, 0, 1, 0, 0, 0, 0, 2, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 1, 0, 0], "dailyOrCases": [0, 0, 0, 0, 1, 0, 0, 0, 0, 2, 1, 0, 1, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 1, 0, 0]}, "all": {"label": "รวมทุกหัตถการ", "ads": 1400365, "inbox": 7343, "or": 6147661, "sales": 21406600, "basket": 194605, "closeRate": 0.015, "adsCost": 0.0654, "adsCostOr": 0.2278, "dailyAds": [58423, 59073, 53517, 49167, 43072, 37468, 50623, 53354, 51243, 45077, 41735, 35194, 34414, 44778, 44270, 40734, 40667, 43672, 42302, 35526, 50223, 50666, 45085, 44770, 44478, 48651, 47256, 57738, 60461, 53212], "dailyInbox": [257, 296, 276, 257, 227, 207, 237, 242, 231, 247, 217, 199, 188, 251, 233, 181, 260, 233, 246, 223, 297, 279, 265, 211, 216, 254, 273, 304, 297, 239], "dailyOr": [455270, 33949, 0, 337780, 860760, 884887, 0, 0, 124749, 518460, 933369, 102489, 974870, 0, 55889, 560659, 304530, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], "dailyConsult": [0, 4, 2, 2, 2, 2, 3, 5, 3, 1, 4, 2, 4, 4, 2, 5, 2, 7, 2, 2, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0], "dailyDeposit": [2, 2, 1, 7, 4, 1, 4, 2, 4, 4, 4, 1, 3, 2, 6, 5, 1, 0, 0, 4, 0, 0, 0, 2, 0, 0, 0, 1, 0, 0], "dailyOrCases": [3, 1, 0, 2, 5, 3, 0, 0, 3, 3, 4, 1, 4, 0, 2, 4, 6, 3, 0, 6, 0, 1, 3, 8, 3, 3, 1, 2, 2, 4]}};
// FUNNEL_DATA_JUL — ก.ค. 2026: Ads+Inbox รายวันจริงจากไฟล์ "ยอดขาย Online S45 Clinic" (validated, sum ตรงกับยอดรวมในไฟล์)
// ไฟล์นั้นไม่มีแถวปิดบิลปรึกษา/มัดจำ/OR รายวันของ ก.ค. กรอกไว้เลย (เป็น 0 ทุกวัน) จึงคำนวณ dailyDeposit/
// dailyConsult/dailyOrCases/dailyOr (+ or/adsCostOr ระดับเดือน) เองจากไฟล์ธุรกรรมจริง Data_S45_Clinic แทน:
// dailyDeposit = จำนวนเคสที่มี Deposit > 0 ต่อวัน (ตาม "Date"), dailyConsult = จำนวนเคสที่คอลัมน์ Sale Consult
// มีชื่อพนักงานกรอกต่อวัน (ตาม "Date"), dailyOr/dailyOrCases = ยอด Total price/จำนวนเคสที่ "OR Date" ตรงกับวันนั้น
// จริง (ทั้งสองชุดตรวจสอบวิธีคำนวณแล้วว่า reconcile กับตัวเลข "ยอด OR จริง" ที่ยืนยันแล้วของเดือนมิ.ย. เป๊ะ)
// หมายเหตุ: ในข้อมูลจริงแทบทุกเคสที่มีมัดจำจะมีชื่อ Sale Consult กำกับด้วยเสมอ ตัวเลข 2 ชุดนี้เลยใกล้เคียงกันมาก
// sales/basket/closeRate/adsCost ระดับเดือน: ตัวเลข "sales" ก้อนใหญ่แบบเดียวกับที่ใช้สร้าง FUNNEL_DATA เดือนมิ.ย.
// (เช่น nose_open = 15,982,920) ไม่มีนิยามที่ reduce กลับไปเป็นคอลัมน์ไหนในไฟล์ธุรกรรมได้เป๊ะ (ลองแล้วหลายสูตรไม่ตรง)
// จึงประมาณแทนด้วย "มูลค่ารวมของเคสที่ปิดแล้ว" = ผลรวม Total price (fallback Online price ถ้ายังไม่ปิด OR) เฉพาะ
// เคสที่ dep>0 หรือมี Sale Consult กำกับในวันนั้น (นับเคสละ 1 ครั้งแม้เข้าเงื่อนไขทั้งคู่) แล้วคำนวณ basket/closeRate/
// adsCost ต่อจากค่านี้ — closeRate ที่ได้ (nose_open 1.67%) ใกล้เคียงกับของเดือนมิ.ย. (1.61%) มาก จึงน่าเชื่อถือ
// พอสมควร แต่เป็นคนละวิธีคำนวณกับมิ.ย. เป๊ะๆ ไม่ควรเทียบสองเดือนนี้แบบตัวต่อตัว · inter ยังไม่มี dailyDeposit/
// dailyConsult/dailyOr/sales เพราะไฟล์ธุรกรรมไม่ได้แท็ก Inter แยกเป็นหัตถการของตัวเอง
const FUNNEL_DATA_JUL = {"nose_open":{"label":"เสริมจมูกโอเพ่น (Nose Open)","ads":892767,"inbox":3062,"or":6626530,"sales":12529150,"basket":245670,"closeRate":0.0167,"adsCost":0.0713,"adsCostOr":0.1347,"dailyAds":[38976,38675,30634,24129,32514,41376,38901,35513,29774,29358,27026,36429,35839,34642,31636,32543,27069,23359,32162,32172,30347,28415,24412,20961,17493,22561,23996,21752,16222,16422,17460],"dailyInbox":[107,112,95,94,119,119,105,106,97,109,95,120,117,112,114,105,101,124,127,117,122,87,83,56,61,86,101,60,60,65,86],"dailyOr":[0,0,0,0,0,219000,0,210000,0,219100,199000,0,785700,0,0,0,379000,0,0,249000,80500,589000,59900,165000,409900,0,659000,742000,936510,447020,276900],"dailyConsult":[2,1,0,2,2,2,3,3,3,2,1,1,2,1,3,1,0,2,2,1,2,1,1,0,4,0,3,1,2,2,1],"dailyDeposit":[2,1,0,2,2,2,3,3,3,2,1,1,2,1,3,1,0,2,2,1,2,1,1,0,4,0,3,0,2,2,1],"dailyOrCases":[0,0,0,0,0,1,0,1,0,2,1,0,1,0,0,0,1,0,0,1,1,1,1,1,2,0,2,3,3,3,2]},"nose_semi":{"label":"เสริมจมูก Semi Open","ads":101825,"inbox":913,"or":216600,"sales":1039100,"basket":34637,"closeRate":0.0329,"adsCost":0.098,"adsCostOr":0.4701,"dailyAds":[2051,3039,3044,2660,3466,3740,3442,3242,3195,3562,2996,4476,4573,4224,3516,3213,3142,2507,3552,3495,3257,3426,3221,3078,2654,3451,3620,3597,3071,2608,2708],"dailyInbox":[22,21,24,35,24,23,27,26,33,36,36,39,32,28,29,30,39,24,36,25,28,44,39,34,28,29,30,25,20,17,30],"dailyOr":[0,0,0,0,65900,0,0,0,0,0,0,0,60000,0,0,0,0,0,0,47900,0,0,0,0,0,0,27900,0,14900,0,0],"dailyConsult":[1,0,1,1,0,2,1,0,0,1,0,0,2,3,3,2,0,0,1,0,0,2,0,1,0,0,2,1,3,0,3],"dailyDeposit":[1,0,1,1,0,2,1,0,0,1,0,0,2,3,3,2,0,0,1,0,0,2,0,1,0,0,2,1,3,0,3],"dailyOrCases":[0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,1,0,0,0,0,1,0,1,1,2,1,0]},"breast_lipo":{"label":"เสริมหน้าอก/ดูดไขมัน","ads":46229,"inbox":458,"or":512100,"sales":765200,"basket":85022,"closeRate":0.0197,"adsCost":0.0604,"adsCostOr":0.0903,"dailyAds":[1616,1448,1217,988,1777,1952,1659,1454,1578,1365,1062,1849,1958,1764,1770,1728,1503,836,1598,1781,1632,1469,1366,1151,852,1648,1820,1544,1344,1439,1065],"dailyInbox":[7,13,11,10,21,23,16,16,21,13,17,18,19,19,13,15,15,13,14,16,18,17,18,11,7,12,15,9,14,16,11],"dailyOr":[0,0,0,0,0,0,0,119900,0,79900,0,0,199000,0,0,59900,0,0,0,0,0,0,0,0,0,0,0,0,53400,0,0],"dailyConsult":[0,1,1,1,0,0,2,0,1,1,0,0,0,1,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0],"dailyDeposit":[0,1,1,1,0,0,2,0,1,1,0,0,0,1,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0],"dailyOrCases":[0,0,0,0,0,0,0,1,0,1,0,0,1,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0]},"brow_hairline":{"label":"ยกคิ้ว/เลื่อนไรผม/ยกมุมปาก","ads":503634,"inbox":3708,"or":2736400,"sales":4386077,"basket":141486,"closeRate":0.0084,"adsCost":0.1148,"adsCostOr":0.184,"dailyAds":[14587,12589,17104,14631,18854,19484,17754,15903,16109,17294,14095,19779,20362,16137,14525,13732,14414,10588,13291,20136,19293,18696,22121,20888,17084,22012,20535,15321,8854,8861,8600],"dailyInbox":[79,77,101,111,129,126,118,111,117,99,101,136,127,119,124,116,128,116,120,146,154,156,159,158,142,164,133,126,71,74,70],"dailyOr":[0,0,0,0,0,0,0,0,119000,0,0,0,214900,0,0,233400,0,0,0,0,154900,0,509700,0,250000,0,374800,0,0,405690,474010],"dailyConsult":[0,0,3,1,0,1,2,2,1,0,1,1,0,1,1,1,0,1,1,1,1,1,2,1,0,0,0,1,3,2,2],"dailyDeposit":[0,0,3,1,0,1,2,2,1,0,1,1,0,1,1,1,0,1,1,1,1,1,2,1,0,0,0,1,3,2,2],"dailyOrCases":[0,0,0,0,0,0,0,0,1,0,0,0,1,0,0,2,0,0,0,0,1,0,3,0,2,0,2,0,0,4,2]},"inter":{"label":"Inter","ads":34374,"inbox":348,"or":null,"sales":null,"basket":null,"closeRate":null,"adsCost":null,"adsCostOr":null,"dailyAds":[1534,1232,919,624,1272,1227,1143,1109,1070,853,668,1247,1091,926,797,814,952,792,1325,1030,1026,1060,995,933,777,1094,1145,928,2200,1761,1832],"dailyInbox":[6,8,8,6,6,8,13,9,11,14,6,12,14,10,8,7,8,11,10,5,12,12,8,7,10,10,8,6,33,35,27],"dailyOr":null,"dailyConsult":null,"dailyDeposit":null,"dailyOrCases":null},"all":{"label":"รวมทุกหัตถการ","ads":1578829,"inbox":8489,"or":10091630,"sales":18719527,"basket":154707,"closeRate":0.0143,"adsCost":0.0843,"adsCostOr":0.1564,"dailyAds":[58764,56983,52918,43032,57883,67779,62899,57221,51726,52432,45847,63780,63823,57693,52244,52030,47080,38082,51928,58614,55555,53066,52115,47011,38860,50766,51116,43142,31691,31091,31665],"dailyInbox":[221,231,239,256,299,299,279,268,279,271,255,325,309,288,288,273,291,288,307,309,334,316,307,266,248,301,287,226,198,207,224],"dailyOr":[0,0,0,0,65900,219000,0,329900,119000,299000,199000,0,1259600,0,0,293300,379000,0,0,296900,235400,589000,569600,165000,659900,0,1061700,742000,1004810,852710,750910],"dailyConsult":[3,2,5,5,2,5,8,5,5,4,2,2,4,6,7,4,0,3,4,2,3,4,4,2,4,0,5,3,8,4,6],"dailyDeposit":[3,2,5,5,2,5,8,5,5,4,2,2,4,6,7,4,0,3,4,2,3,4,4,2,4,0,5,2,8,4,6],"dailyOrCases":[0,0,0,0,1,1,0,2,1,3,1,0,4,0,0,3,1,0,0,2,2,1,4,1,5,0,5,4,6,8,4]}};
// ============================================================
// SOURCE 5 — ชีต "LOA- มิถุนายน" (LINE OA Broadcast) จากไฟล์สรุปค่าใช้จ่ายให้บัญชี
// broadcastReach = จำนวนบรอดแคสต์ (คนที่ถูกส่งถึงสะสมทั้งเดือน)
// budgetUsed/budgetLeft = งบบรอดแคสต์ที่ใช้ไปแล้ว/คงเหลือ (บาท)
// quotaLeft = จำนวนบลอดคงเหลือ (โควตาคน/ครั้งที่ยังส่งได้อีก)
// timesLeft = จำนวนครั้งที่ยังบลอดได้อีก (คำนวณจากงบคงเหลือ ตามชีตต้นฉบับ)
// ============================================================
// buildLoaRows: แปลงข้อมูลเดือนหนึ่งจาก src/data/loaData.json (สร้างสดทุกวันโดย
// scripts/build-loa.mjs จากชีท "LOA- <เดือน>" จริง) เป็น array รูปแบบเดียวกับที่ component
// ใช้อยู่เดิม — timesLeft คำนวณจาก quotaLeft ÷ peoplePerBroadcast (สูตรเดียวกับชีตต้นฉบับ)
// budgetLeft/quotaLeft เป็น null สำหรับเดือน ม.ค.-พ.ค. เพราะชีตต้นฉบับเดือนเหล่านั้นไม่มีแถวคงเหลือ
// ให้เลย (ไม่ใช่ค่าที่คำนวณเองได้ ต้องมีเป้าหมายงบ/โควตารายเดือนจากทีมก่อน)
function buildLoaRows(monthIso, defs, peoplePerBroadcast) {
  const month = loaDataByMonth[monthIso];
  if (!month) return null;
  return defs.map(({ sourceKey, key, label }) => {
    const c = month[sourceKey] || { broadcastReach: 0, budgetUsed: 0, budgetLeft: null, quotaLeft: null };
    return {
      key,
      label,
      broadcastReach: c.broadcastReach,
      budgetUsed: c.budgetUsed,
      budgetLeft: c.budgetLeft,
      quotaLeft: c.quotaLeft,
      timesLeft: c.quotaLeft != null ? c.quotaLeft / peoplePerBroadcast : null,
    };
  });
}
const LOA_NORMAL_DEFS = [
  { sourceKey: "open", key: "open", label: "Open (เสริมจมูกโอเพ่น)" },
  { sourceKey: "semi", key: "semi", label: "Semi (เสริมจมูก Semi Open)" },
  { sourceKey: "breast", key: "breast", label: "หน้าอก/ดูดไขมัน" },
  { sourceKey: "brow", key: "brow", label: "ยกคิ้ว/เลื่อนไรผม" },
  { sourceKey: "branding", key: "branding", label: "แบรนด์ดิ้ง" },
];
const LOA_AFTERCARE_DEFS = [
  { sourceKey: "breast", key: "breast_ac", label: "หน้าอก (Aftercare)" },
  { sourceKey: "brow", key: "brow_ac", label: "ยกคิ้ว (Aftercare)" },
  { sourceKey: "skin", key: "skin_ac", label: "สกิน (Aftercare)" },
];
// LOA_JUNE — ใช้เฉพาะการ์ด Insight เดือนมิถุนายนบนหน้าภาพรวม (ตั้งใจให้คงที่ ไม่ผูกกับ Filter วันที่หลัก
// ดูการ์ด LOA Broadcast บนหน้า Ads/loaRangeRows() ด้านล่างสำหรับเวอร์ชัน Filter ตามวันที่จริง)
const LOA_JUNE = buildLoaRows("2026-06", LOA_NORMAL_DEFS, 39000);
const LOA_MONTHLY_BUDGET = 120000; // ยอดบลอดต่อเดือน
const LOA_MONTHLY_QUOTA = 2000000; // จำนวนบลอดต่อเดือน
const LOA_PEOPLE_PER_BROADCAST = 39000; // ตามชีตต้นฉบับ: * 39000 คนต่อการบลอด 1 ครั้ง

const LOA_CHANNEL_META = {
  normal: { label: "ปกติ", monthlyBudget: 120000, monthlyQuota: 2000000, peoplePerBroadcast: 39000 },
  aftercare: { label: "Line OA Aftercare", monthlyBudget: 30000, monthlyQuota: 500000, peoplePerBroadcast: 26000 },
};
const LOA_CHANNEL_OPTIONS = [
  ["normal", "ปกติ"],
  ["aftercare", "Line OA Aftercare"],
];
// หมายเหตุ: ช่องทาง "ปกติ" มีข้อมูลรายวันจริงตั้งแต่ มิ.ย. 2569 เป็นต้นไป (มิ.ย.จาก loaData.json/
// ไฟล์ SharePoint, ก.ค.เป็นต้นไปจาก loaNormalData.json/Google Sheet) ส่วน "Aftercare" มีข้อมูลรายวันจริง
// ตั้งแต่ ก.ค. 2569 เป็นต้นไป (loaData.json เช่นกัน) — ทั้ง 2 ช่องทางจึง Filter ตามช่วงวันที่ที่เลือกได้จริง
// (ไม่ใช่แค่ยอดรวมทั้งเดือนอีกต่อไป) ดู loaRangeRows() ด้านล่าง

// ช่วงเดือนที่แต่ละช่องทางมีข้อมูลรายวันจริง (source ต่างไฟล์กันตามเดือน — ดูหมายเหตุด้านบน)
function loaChannelMonthSources(channel) {
  if (channel === "aftercare") {
    return [
      { monthIso: "2026-07", src: loaDataByMonth["2026-07"] },
      { monthIso: "2026-08", src: loaDataByMonth["2026-08"] },
    ];
  }
  return [
    { monthIso: "2026-06", src: loaDataByMonth["2026-06"] },
    { monthIso: "2026-07", src: loaNormalDataByMonth["2026-07"] },
    { monthIso: "2026-08", src: loaNormalDataByMonth["2026-08"] },
  ];
}
function loaLastDayIso(monthIso) {
  const [y, m] = monthIso.split("-").map(Number);
  return `${monthIso}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`;
}
// loaRangeRows: คำนวณยอด Broadcast/งบ ของช่องทางหนึ่ง "เฉพาะช่วงวันที่ที่เลือกจริง" จาก dailyReach
// รายวัน (รวมข้าม เดือนได้ถ้าช่วงที่เลือกคาบเกี่ยวหลายเดือน) — งบ/โควตาคงเหลือ คำนวณแบบ "คงเหลือ ณ วันสุดท้าย
// ของช่วงที่เลือก" เทียบกับงบ/โควตาเต็มเดือนของเดือนที่ช่วงนั้นสิ้นสุด (งบตั้งไว้ = budgetUsed+budgetLeft ล่าสุด
// ที่ดึงมาของเดือนนั้น) คืน null ถ้าช่วงที่เลือกไม่คาบเกี่ยวเดือนที่มีข้อมูลรายวันของช่องทางนี้เลย
function loaRangeRows(channel, dateRange, defs) {
  const peoplePerBroadcast = LOA_CHANNEL_META[channel].peoplePerBroadcast;
  const monthSources = loaChannelMonthSources(channel);
  const capMonthIso = dateRange.end.slice(0, 7);
  const capSrc = monthSources.find((m) => m.monthIso === capMonthIso)?.src;

  const rows = [];
  for (const { sourceKey, key, label } of defs) {
    let reach = 0;
    let coveredAny = false;
    for (const { monthIso, src } of monthSources) {
      const c = src?.[sourceKey];
      if (!c || !c.dailyReach || c.dailyReach.length === 0) continue;
      reach += sumDailyOverlap(dateRange, `${monthIso}-01`, loaLastDayIso(monthIso), c.dailyReach);
      coveredAny = true;
    }
    if (!coveredAny) continue;

    const budgetUsed = reach * 0.06;
    let budgetLeft = null;
    let quotaLeft = null;
    const capCategory = capSrc?.[sourceKey];
    if (capCategory?.dailyReach?.length && capCategory.budgetUsed != null && capCategory.budgetLeft != null) {
      const capBudget = capCategory.budgetUsed + capCategory.budgetLeft;
      const monthStart = `${capMonthIso}-01`;
      const cumulativeReach = sumDailyOverlap({ start: monthStart, end: dateRange.end }, monthStart, loaLastDayIso(capMonthIso), capCategory.dailyReach);
      budgetLeft = capBudget - cumulativeReach * 0.06;
      if (capCategory.quotaLeft != null) {
        const capQuota = capCategory.broadcastReach + capCategory.quotaLeft;
        quotaLeft = capQuota - cumulativeReach;
      }
    }
    rows.push({
      key,
      label,
      broadcastReach: reach,
      budgetUsed,
      budgetLeft,
      quotaLeft,
      timesLeft: quotaLeft != null ? quotaLeft / peoplePerBroadcast : null,
    });
  }
  return rows.length ? rows : null;
}

// ============================================================
// สัดส่วนงบโฆษณาแยกตามช่องทาง (ชีต Budget Allocate July26, แถว Total บรรทัด 39) — ใช้สรุปว่าช่องทางไหนแทบไม่ได้ใช้งบ
// ก.ค. ไม่มีงบ TikTok เลย (ต่างจาก มิ.ย. ที่มี 10,000) จึงไม่มีแถว TikTok ในเดือนนี้
// ============================================================
const CHANNEL_MIX = [
  { key: "facebook", label: "Facebook", budget: 1385000 },
  { key: "google", label: "Google", budget: 180000 },
  { key: "line_broadcast", label: "Line Broadcast", budget: 121000 },
  { key: "line_ads", label: "Line Ads", budget: 53000 },
  { key: "tiktok", label: "TikTok", budget: 0 },
];
const CHANNEL_MIX_TOTAL = CHANNEL_MIX.reduce((s, c) => s + c.budget, 0);


// ============================================================
// SOURCE 6 — ตัวอย่างแชท Bad Lead (159 แชทขยะ/กดลิงก์ รวมทุกหัตถการ ก.ค. 2569)
// รูปตัวอย่างด้านล่างยังเป็นชุดเดิมจาก มิ.ย. 2569 (ยังไม่ได้รับไฟล์ภาพตัวอย่างของ ก.ค. มาแทน)
// แสดงตัวอย่าง 6 จาก 159 แชท (ไม่ฝังทั้งหมดเพราะไฟล์จะใหญ่เกินไป)
// ============================================================
const BAD_LEAD_SAMPLES = [
  "data:image/jpeg;base64,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",
  "data:image/jpeg;base64,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",
  "data:image/jpeg;base64,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",
  "data:image/jpeg;base64,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",
  "data:image/jpeg;base64,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",
  "data:image/jpeg;base64,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",
];
const BAD_LEAD_TOTAL = 159;

// ============================================================
// จำนวนปิดบิลปรึกษา / ปิดบิลมัดจำ แยกตามหัตถการ (จากไฟล์ ยอดขาย Online S45 Clinic ชีต มิ.ย. 2569)
// consult/deposit = จำนวนเคส (บิล), consultValue/depositValue = มูลค่ารวมเป็นบาท (ยอดขายบิลปรึกษา / ยอดขายปิดบิลมัดจำ)
// ============================================================
const FUNNEL_CLOSE_COUNTS = {
  nose_open: { consult: 29, deposit: 21, consultValue: 9278900, depositValue: 6704020 },
  nose_semi: { consult: 14, deposit: 12, consultValue: 699700, depositValue: 418800 },
  breast_lipo: { consult: 6, deposit: 6, consultValue: 125670, depositValue: 788610 },
  brow_hairline: { consult: 10, deposit: 12, consultValue: 1257200, depositValue: 2133700 },
  inter: { consult: 0, deposit: 9, consultValue: 0, depositValue: 2540320 },
  all: { consult: 59, deposit: 60, consultValue: 11361470, depositValue: 12585450 },
};
// FUNNEL_CLOSE_COUNTS_JUL — ก.ค. 2569: ไฟล์ "Online S45 Clinic" ไม่มีเลขนี้กรอกไว้เหมือนมิ.ย. (ดูคอมเมนต์ที่
// FUNNEL_DATA_JUL) จึงคำนวณเองจาก Data_S45_Clinic ด้วยนิยามเดียวกับที่ใช้เติม FUNNEL_DATA_JUL.dailyConsult/
// dailyDeposit: consult = เคสที่คอลัมน์ Sale Consult มีชื่อ, deposit = เคสที่ Deposit > 0 ทั้งเดือน · consultValue/
// depositValue = ผลรวม Total price (fallback Online price ถ้ายังไม่ปิด OR) ของเคสกลุ่มนั้นๆ — inter ยังคำนวณไม่ได้
// เพราะไฟล์ธุรกรรมไม่ได้แท็ก Inter แยก จึงไม่มี key นี้ (ตารางที่ใช้ค่านี้ต้องเช็ค key มีอยู่จริงก่อน render)
const FUNNEL_CLOSE_COUNTS_JUL = {
  nose_open: { consult: 51, deposit: 50, consultValue: 12529150, depositValue: 12441030 },
  nose_semi: { consult: 30, deposit: 30, consultValue: 1039100, depositValue: 1039100 },
  breast_lipo: { consult: 9, deposit: 9, consultValue: 765200, depositValue: 765200 },
  brow_hairline: { consult: 31, deposit: 31, consultValue: 4386077, depositValue: 4386077 },
  all: { consult: 121, deposit: 120, consultValue: 18719527, depositValue: 18631407 },
};
// FUNNEL_DATA_AUG / FUNNEL_CLOSE_COUNTS_AUG — ส.ค. 2569 ถึงวันที่ 23 (src/data/funnelAug.json,
// สร้างสดโดย scripts/build-funnel.mjs): dailyAds/dailyInbox มาจากไฟล์ "ยอดขาย Online S45 Clinic"
// (ชีต "ส.ค.69") ตรงๆ — consult/deposit/OR รายวันคำนวณจาก RAW_TX ด้วยนิยามเดียวกับ FUNNEL_DATA_JUL
// (ดูคอมเมนต์ด้านบน) เพราะชีตต้นฉบับยังไม่กรอกตัวเลขกลุ่มนี้เหมือนกัน · inter ไม่มี key ใน
// FUNNEL_CLOSE_COUNTS_AUG เหตุผลเดียวกับ FUNNEL_CLOSE_COUNTS_JUL
const FUNNEL_DATA_AUG = FUNNEL_AUG_DATA.data;
const FUNNEL_CLOSE_COUNTS_AUG = FUNNEL_AUG_DATA.closeCounts;

// ============================================================
// ลิงก์อ้างอิง Organic Post / Insight ที่ทีม Digital นำมาต่อยอดเป็น Ads Messenger
// (กลยุทธ์กองทัพมด กระตุ้นยอด Inbox Nose Open) — ลิงก์จาก Facebook เข้าถึงไม่ได้ผ่านระบบอัตโนมัติ
// จึงแสดงเป็นรายการลิงก์อ้างอิงแทนการฝังรูป/วิดีโอ
// ============================================================
const ANT_ARMY_LINKS = [
  "https://www.facebook.com/content/insights/?content_id=1422064096623619",
  "https://www.facebook.com/content/insights/?content_id=UzpfSTEwMDA2NDYwMTI2NTEyMjoxMDA4MzcwOTI1MjY2Nzk1OjE2OTI2MTAwOTg0NDUwMzc%3D",
  "https://www.facebook.com/content/insights/?content_id=UzpfSTEwMDA2NDYwMTI2NTEyMjoxNDIxODkwOTg5OTc0MjYzOjE0MjE4OTA5ODk5NzQyNjM%3D",
  "https://www.facebook.com/content/insights/?content_id=UzpfSTEwMDA2NDYwMTI2NTEyMjoxNDIwOTgyMzQwMDY1MTI4OjE0MjA5ODIzNDAwNjUxMjg%3D",
  "https://www.facebook.com/content/insights/?content_id=UzpfSTEwMDA2NDYwMTI2NTEyMjoxNDE4NDU0MjAzNjUxMjc1OjE0MTg0NTQyMDM2NTEyNzU%3D",
  "https://www.facebook.com/share/v/1CrCFkos1u/",
  "https://www.facebook.com/share/r/1W77PGNTXS/",
  "https://www.facebook.com/share/r/1BG2Uxk4y3/",
  "https://www.facebook.com/share/r/1EqstFxy39/",
  "https://www.facebook.com/share/r/1BbvRrs4zj/",
  "https://www.facebook.com/S45CLINIC/posts/pfbid0bweBtN8gGhkN2f3vwCvduzxSt9nAgXQSYLb8u9bzx9fQNhbZXwjY5Dtai1hzgCxql",
  "https://www.facebook.com/S45CLINIC/posts/pfbid044w5mbynq5FLLDwxDmjvzbM2Tjvp17u7gKBGTyRZdwjZXT2R2ZK9CFZJmMA9Xsqkl",
  "https://www.facebook.com/share/r/1KzrPBH7dP/",
  "https://www.facebook.com/share/r/1EForHRxSw/",
  "https://www.facebook.com/share/r/18pxj1qWjg/",
  "https://www.facebook.com/S45CLINIC/posts/pfbid0ZzwHPycAMWSPnijTZuNTZqigCk5QtABsaivkJvyyvcjGZFS1C1vMkMentpEiae1Vl",
  "https://www.facebook.com/share/r/1HVnVqqLjG/",
  "https://www.facebook.com/share/r/1NWMKAzbBs/",
  "https://www.facebook.com/share/r/1BZwqH58Zx/",
  "https://www.facebook.com/share/r/17moxRzdgv/",
  "https://www.facebook.com/share/r/1CDs6DebcS/",
  "https://www.facebook.com/share/r/1BRrMxV2b9/",
  "https://www.facebook.com/share/r/1EXTNHabGP/",
  "https://www.facebook.com/share/r/1DGkTWfjCW/",
  "https://www.facebook.com/S45CLINIC/posts/pfbid0UxMzs2fwFfWZNA6e3nhf6SiVU4nTsiZZucX4iMiZBvNQN22WSLQtZeQBmzEtBVb8l",
  "https://www.facebook.com/share/r/1BvXaa17fZ/",
  "https://www.facebook.com/S45CLINIC/posts/pfbid02vaAYT6waHigioLzfa63AR44Uj9XL1yaGjbCQfH11oFKqR68F2jhovWQN1QhKe1jzl",
  "https://www.facebook.com/share/r/1HcM67hxqC/",
  "https://www.facebook.com/share/r/1a9Ydqxaea/",
];
const S45_LOGO = "data:image/webp;base64,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";

// ============================================================
// ระยะเวลาจากวันที่ทักเข้ามา (Date) ถึงวันผ่าตัดจริง (OR Date) แยกตามหัตถการ
// ใช้ "มัธยฐาน (Median)" แทนค่าเฉลี่ย เพราะข้อมูลจริงมีเคสที่ใช้เวลานานผิดปกติ (สูงสุดถึง 180 วัน) ปนอยู่
// ซึ่งจะดึงค่าเฉลี่ยให้สูงเกินจริง มัธยฐานสะท้อน "ค่าปกติทั่วไป" ได้แม่นยำกว่า
// คำนวณสดจาก RAW_TX เดือน CURRENT_SPEND_MONTH เฉพาะเคสที่มี OR Date แล้วจริง (สูตรเดียวกับ
// activeLeadTime ที่ใช้คำนวณเดือนอื่นๆ แบบสด — ดูใน component ด้านล่าง)
// ============================================================
const LEAD_TIME_LABELS = { nose_open: "Nose Open", nose_semi: "Semi Open", brow_hairline: "ยกคิ้ว", breast_lipo: "เสริมหน้าอก/ดูดไขมัน", all: "รวมทุกหัตถการ" };
function liveLeadTimeDays(monthIso) {
  const rows = txInMonth(monthIso).filter((t) => t.or && t.or >= t.d);
  const calc = (list) => {
    if (list.length === 0) return null;
    const days = list.map((t) => Math.round((new Date(t.or) - new Date(t.d)) / 86400000)).sort((a, b) => a - b);
    const mid = Math.floor(days.length / 2);
    const median = days.length % 2 ? days[mid] : (days[mid - 1] + days[mid]) / 2;
    return { median, min: days[0], max: days[days.length - 1], n: days.length };
  };
  const result = {};
  for (const k of ["nose_open", "nose_semi", "brow_hairline", "breast_lipo"]) {
    const r = calc(rows.filter((t) => t.p === k));
    result[k] = r ? { label: LEAD_TIME_LABELS[k], medianDays: r.median, minDays: r.min, maxDays: r.max, n: r.n } : { label: LEAD_TIME_LABELS[k], medianDays: null, n: null };
  }
  const rAll = calc(rows);
  result.all = rAll ? { label: LEAD_TIME_LABELS.all, medianDays: rAll.median, minDays: rAll.min, maxDays: rAll.max, n: rAll.n } : { label: LEAD_TIME_LABELS.all, medianDays: null, n: null };
  return result;
}
const OR_LEAD_TIME_DAYS = liveLeadTimeDays(CURRENT_SPEND_MONTH);

const AD_COST_THRESHOLD = 0.1;

// ============================================================
// เคสเด่นคุณหมอ (Hero Case) ที่จะนำมากระตุ้นยอด Inbox Nose Open — ลิงก์ Facebook เข้าถึงอัตโนมัติไม่ได้
// จึงแสดงเป็นการ์ดอ้างอิงลิงก์แทนการฝังรูปจริง
// ============================================================
const DOCTOR_HERO_CASES = {
  doctor_tee: {
    label: "หมอตี้",
    cases: [{ patient: "คุณแคนดี้", url: "https://www.facebook.com/share/p/1GAEbPmVFE/?mibextid=wwXIfr" }],
  },
  doctor_rose: {
    label: "หมอโรส",
    cases: [
      { patient: "คุณกาน", url: "https://www.facebook.com/share/p/1CTTQkXxxJ/" },
      { patient: "คุณหนิงหนิง", url: "https://www.facebook.com/share/p/1Cid3iAnQA/" },
    ],
  },
  doctor_che: {
    label: "หมอเช",
    cases: [{ patient: "คุณลิซ่า", url: "https://www.facebook.com/share/p/1JfcTBg7Eo/" }],
  },
  doctor_toon: {
    label: "หมอตูน",
    cases: [
      { patient: "คุณบี", url: "https://www.facebook.com/share/p/192w9K6CJK/" },
      {
        patient: "คุณผ้าแพร",
        url: "https://www.facebook.com/S45CLINIC/posts/pfbid0uDDEW9ZguMAxrXyPhEiHxWa93HcvUEDXM8N1tpdAifp5Bg1qDJbv5FES8z3TRsk6l?rdid=DLCSHTDnTtkRbxS9",
      },
    ],
  },
};

const fmtTHB = (n) => new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(Math.round(n));

function Select({ icon: Icon, value, onChange, options }) {
  return (
    <div className="relative">
      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
        <Icon size={16} />
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none bg-white border border-slate-200 rounded-xl pl-9 pr-9 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200 cursor-pointer"
      >
        {options.map(([val, label]) => (
          <option key={val} value={val}>{label}</option>
        ))}
      </select>
      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
        <ChevronDown size={16} />
      </div>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, sub, tone = "slate", delta, goodDirection = "up" }) {
  const tones = {
    slate: "bg-slate-50 text-slate-600",
    green: "bg-emerald-50 text-emerald-600",
    blue: "bg-blue-50 text-blue-600",
    red: "bg-rose-50 text-rose-600",
    indigo: "bg-indigo-50 text-indigo-600",
  };
  const hasDelta = typeof delta === "number" && Number.isFinite(delta);
  const isUp = hasDelta && delta > 0;
  const isFlat = hasDelta && Math.abs(delta) < 0.05;
  const isGood = isFlat ? null : isUp === (goodDirection === "up");
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm overflow-hidden min-w-0">
      <div className="flex items-center justify-between gap-x-2 gap-y-1 mb-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${tones[tone]}`}>
            <Icon size={16} />
          </div>
          <span className="text-sm text-slate-500 font-medium">{label}</span>
        </div>
        {hasDelta && (
          <span
            className={`flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-md shrink-0 whitespace-nowrap ${
              isFlat ? "bg-slate-50 text-slate-400" : isGood ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
            }`}
          >
            {!isFlat && (isUp ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
            {Math.abs(delta).toFixed(1)}%
          </span>
        )}
      </div>
      <div className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight break-words">{value}</div>
      {sub && <div className={`text-xs mt-1 font-medium break-words ${tone === "red" ? "text-rose-500" : "text-slate-400"}`}>{sub}</div>}
    </div>
  );
}

// ป้าย % เทียบเดือนก่อนหน้า (MoM) แบบย่อ ใช้กับกล่องสถิติเล็กๆ ที่ไม่ได้ใช้ MetricCard เต็มรูปแบบ
// null = ไม่มีข้อมูลเดือนก่อนให้เทียบ (เช่น เลือกเดือนแรกสุดที่มีข้อมูล) จึงไม่แสดงป้ายเลย ไม่ใช่แสดง 0%
function MoMBadge({ delta, goodDirection = "up" }) {
  if (delta == null || !Number.isFinite(delta)) return null;
  const isUp = delta > 0;
  const isFlat = Math.abs(delta) < 0.05;
  const isGood = isFlat ? null : isUp === (goodDirection === "up");
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[10px] font-semibold ${
        isFlat ? "text-slate-400" : isGood ? "text-emerald-600" : "text-rose-600"
      }`}
    >
      {!isFlat && (isUp ? <ArrowUp size={9} /> : <ArrowDown size={9} />)}
      {Math.abs(delta).toFixed(1)}% เทียบเดือนก่อน
    </span>
  );
}

// ป้าย % เทียบ Compare แบบตัวเลขใหญ่ชิดขวา — เหมือนสไตล์ ROAS บนหน้า ยอดขาย (ตัวเลขใหญ่ด้านขวาของกล่อง
// ส่วนคำอธิบาย "เทียบเดือนก่อน" ย้ายไปอยู่ใต้ยอดเงินฝั่งซ้ายแทน — ดู <MoMCaption> คู่กัน)
function MoMBadgeLarge({ delta, goodDirection = "up" }) {
  if (delta == null || !Number.isFinite(delta)) return null;
  const isUp = delta > 0;
  const isFlat = Math.abs(delta) < 0.05;
  const isGood = isFlat ? null : isUp === (goodDirection === "up");
  return (
    <p
      className={`text-2xl font-bold shrink-0 flex items-center gap-1 ${
        isFlat ? "text-slate-400" : isGood ? "text-emerald-600" : "text-rose-600"
      }`}
    >
      {!isFlat && (isUp ? <ArrowUp size={18} /> : <ArrowDown size={18} />)}
      {Math.abs(delta).toFixed(1)}%
    </p>
  );
}
// คำอธิบายเล็กๆ ใต้ยอดเงิน คู่กับ MoMBadgeLarge — แสดงเฉพาะตอนมีค่าเทียบจริง (delta != null) เหมือนกัน
function MoMCaption({ delta }) {
  if (delta == null || !Number.isFinite(delta)) return null;
  return <p className="text-[11px] text-slate-400 mt-1">เทียบเดือนก่อน</p>;
}

// ============================================================
// เปรียบเทียบช่วงเวลา (Compare) — คำนวณ exec metrics (ยอดขายรวม/ยอดขาย FB/
// ค่าโฆษณา FB/Ads ต่อยอดขาย/ROAS) สำหรับช่วงวันที่ใดก็ได้ ใช้ตรรกะเดียวกับ
// rangeTotals/rangeSpend/activeFbSurgery ในตัว component หลัก แต่แยกเป็นฟังก์ชัน
// บริสุทธิ์ (pure function) รับ range เข้ามาแทนการอิง dateRange ตรงๆ เพื่อให้เรียกซ้ำ
// ได้ทั้งช่วงหลักและช่วงเทียบ (compare) โดยไม่ต้องแตะโค้ดเดิม
// ============================================================
const MONTH_BOUNDS = {
  oct25: ["2025-10-01", "2025-10-31"],
  nov25: ["2025-11-01", "2025-11-30"],
  dec25: ["2025-12-01", "2025-12-31"],
  jan26: ["2026-01-01", "2026-01-31"],
  feb26: ["2026-02-01", "2026-02-28"],
  mar26: ["2026-03-01", "2026-03-31"],
  apr26: ["2026-04-01", "2026-04-30"],
  may26: ["2026-05-01", "2026-05-31"],
  jun26: ["2026-06-01", "2026-06-30"],
  jul26: ["2026-07-01", "2026-07-31"],
  aug26: ["2026-08-01", "2026-08-25"],
};

// ============================================================
// ค่าโฆษณาแยกตามหัตถการ สำหรับช่วงวันที่ใดๆ — ใช้ร่วมกันทั้ง rangeSpend, activeFbSurgery
// (การ์ด "ต้นทุนต่อการซื้อ") และ computeExecMetricsForRange เพื่อไม่ให้ตัวเลขเพี้ยนกันระหว่างจุดต่างๆ
// เดือนที่ adSpend.json มี breakdown รายหัตถการจริง (มิ.ย.-ส.ค. 2026) ใช้ตัวเลขจริงเฉลี่ยตามสัดส่วนวันที่
// ทับซ้อน · เดือนอื่นที่มีแค่ยอดรวม ประมาณโดยใช้สัดส่วนหัตถการของเดือนมิ.ย. (CATEGORIES) แทน
// ============================================================
// "inter" ไม่ใช่บัญชีโฆษณาแยก แต่เป็นแคมเปญย่อยในบัญชี Nose Open 02 อยู่แล้ว (ดูคอมเมนต์ jul26 ด้านบน)
// ดังนั้น "all" ต้องอิงยอดรวมเดือนจริง (MONTHLY_DATA[mk].spend อ่านจากฟิลด์ "total" ใน adSpend.json) ตรงๆ
// ห้ามเอา perCategory มาบวกกันเอง เพราะจะนับ Inter ซ้ำเข้าไปในยอด Nose Open อีกที
const SPEND_CATEGORY_KEYS = ["nose_open", "nose_semi", "breast_lipo", "brow_hairline", "inter"];
function categorySpendForRange(range) {
  const result = Object.fromEntries(SPEND_CATEGORY_KEYS.map((k) => [k, 0]));
  let all = 0;
  Object.entries(MONTH_BOUNDS).forEach(([mk, [monthStart, monthEnd]]) => {
    const overlapStart = range.start > monthStart ? range.start : monthStart;
    const overlapEnd = range.end < monthEnd ? range.end : monthEnd;
    if (overlapStart > overlapEnd) return;
    const overlapDays = Math.round((new Date(overlapEnd) - new Date(overlapStart)) / 86400000) + 1;
    const totalDaysInMonth = Math.round((new Date(monthEnd) - new Date(monthStart)) / 86400000) + 1;
    const frac = overlapDays / totalDaysInMonth;
    all += (MONTHLY_DATA[mk]?.spend || 0) * frac;
    const monthCat = adSpendData?.months?.[MONTH_ISO[mk]];
    const hasBreakdown = monthCat && SPEND_CATEGORY_KEYS.some((k) => typeof monthCat[k] === "number");
    SPEND_CATEGORY_KEYS.forEach((k) => {
      if (hasBreakdown) {
        result[k] += (monthCat[k] || 0) * frac;
      } else {
        const ratio = CATEGORIES[k].spend / GRAND_TOTAL.spend;
        result[k] += (MONTHLY_DATA[mk]?.spend || 0) * frac * ratio;
      }
    });
  });
  const rounded = Object.fromEntries(Object.entries(result).map(([k, v]) => [k, Math.round(v)]));
  rounded.all = Math.round(all);
  return rounded;
}

function computeExecMetricsForRange(range, proc) {
  const isFullJun = range.start === "2026-06-01" && range.end === "2026-06-30";
  const txInRange = RAW_TX.filter((t) => t.d >= range.start && t.d <= range.end);
  const txByProc = proc === "all" ? txInRange : txInRange.filter((t) => t.p === proc);

  const sales = isFullJun
    ? proc === "all"
      ? GRAND_TOTAL.sales
      : CATEGORIES[proc].sales
    : txByProc.reduce((s, t) => s + t.tot, 0);

  const fbSales = isFullJun
    ? proc === "all"
      ? FB_TOTAL.total
      : FB_BY_KEY[proc]?.total ?? 0
    : txInRange.filter((t) => t.ch === "Facebook" && (proc === "all" || t.p === proc)).reduce((s, t) => s + t.tot, 0);

  const fbSpend = (() => {
    if (isFullJun) return proc === "all" ? GRAND_TOTAL.spend : CATEGORIES[proc].spend;
    const spendByCat = categorySpendForRange(range);
    return proc === "all" ? spendByCat.all : spendByCat[proc] ?? 0;
  })();

  const ratio = fbSales > 0 ? fbSpend / fbSales : 0;
  const roas = fbSpend > 0 ? fbSales / fbSpend : 0;
  return { sales, fbSales, fbSpend, ratio, roas };
}

// เป้าหมายยอดขายรายเดือน (CATEGORIES[key].target) เป็นตัวเลขต่อ 1 เดือนเต็ม — ประมาณค่าเป้าหมายสำหรับช่วงวันที่ใดๆ
// โดยเฉลี่ยตามสัดส่วนวันที่ทับซ้อนกับแต่ละเดือนปฏิทิน (วิธีเดียวกับที่ใช้ประมาณ fbSpend ด้านบน)
function computeProratedTarget(range, monthlyTarget) {
  let total = 0;
  Object.values(MONTH_BOUNDS).forEach(([monthStart, monthEnd]) => {
    const overlapStart = range.start > monthStart ? range.start : monthStart;
    const overlapEnd = range.end < monthEnd ? range.end : monthEnd;
    if (overlapStart <= overlapEnd) {
      const overlapDays = Math.round((new Date(overlapEnd) - new Date(overlapStart)) / 86400000) + 1;
      const totalDaysInMonth = Math.round((new Date(monthEnd) - new Date(monthStart)) / 86400000) + 1;
      total += monthlyTarget * (overlapDays / totalDaysInMonth);
    }
  });
  return Math.round(total);
}

// หัตถการที่มีข้อมูลยอดขายจริงระดับรายวันใน RAW_TX (Inter ไม่ได้แท็กแยกในไฟล์ธุรกรรม จึงใช้ได้เฉพาะเดือนมิ.ย.เต็มเดือนเท่านั้น)
const DAILY_CATEGORY_KEYS = ["nose_open", "nose_semi", "breast_lipo", "brow_hairline"];

// รวมค่าจาก array รายวัน (index 0 = วันที่ 1 ของเดือนนั้น) เฉพาะวันที่ทับซ้อนกับช่วงที่เลือก — คืนค่า null ถ้าไม่มี array (เช่น dailyOr ของ ก.ค.)
function sumDailyOverlap(range, monthStart, monthEnd, dailyArr) {
  if (!dailyArr) return null;
  const overlapStart = range.start > monthStart ? range.start : monthStart;
  const overlapEnd = range.end < monthEnd ? range.end : monthEnd;
  if (overlapStart > overlapEnd) return 0;
  const startDay = Number(overlapStart.slice(8, 10));
  const endDay = Number(overlapEnd.slice(8, 10));
  let sum = 0;
  for (let d = startDay; d <= endDay; d++) sum += dailyArr[d - 1] || 0;
  return sum;
}

// เดือนที่ 1 (index 0) ของ array รายวันแต่ละเดือนที่มีข้อมูล Sales Funnel (มิ.ย.-ส.ค. 2569)
const FUNNEL_MONTH_STARTS = { jun: "2026-06-01", jul: "2026-07-01", aug: "2026-08-01" };
// คืน "วันที่ (1-31 ของเดือน)" ทุกวันที่ผู้ใช้เลือกจริงบน Filter ด้านบน ที่ทับซ้อนกับเดือนนั้น (monthKey) —
// ไม่ตัดตาม len ของ array ข้อมูล เพื่อให้กราฟแสดงครบทุกวันที่ขอจริง (เช่น เลือก 7 วัน ต้องมี 7 แท่ง/จุดบนแกน
// เสมอ ต่อให้บางวันท้ายช่วงยังไม่มีข้อมูลกรอกในไฟล์ต้นฉบับก็ตาม — ไม่ใช่หายไปเงียบๆ จนดูเหมือนกราฟพัง)
function calendarDayNumsInRange(monthKey, range) {
  const monthStart = FUNNEL_MONTH_STARTS[monthKey];
  if (!monthStart) return [];
  const monthEndDay = new Date(Number(monthStart.slice(0, 4)), Number(monthStart.slice(5, 7)), 0).getDate();
  const monthEnd = `${monthStart.slice(0, 8)}${String(monthEndDay).padStart(2, "0")}`;
  const overlapStart = range.start > monthStart ? range.start : monthStart;
  const overlapEnd = range.end < monthEnd ? range.end : monthEnd;
  if (overlapStart > overlapEnd) return [];
  const startDay = Number(overlapStart.slice(8, 10));
  const endDay = Number(overlapEnd.slice(8, 10));
  const days = [];
  for (let d = startDay; d <= endDay; d++) days.push(d);
  return days;
}
// แปลง (monthKey, วันที่ 1-31) กลับเป็น ISO date — ใช้บอกว่า "ข้อมูลล่าสุดถึงวันที่เท่าไหร่"
function isoForMonthDay(monthKey, dayNum) {
  const monthStart = FUNNEL_MONTH_STARTS[monthKey];
  if (!monthStart) return null;
  return `${monthStart.slice(0, 8)}${String(dayNum).padStart(2, "0")}`;
}
// FUNNEL_DATA[_JUL/_AUG] ของเดือนนั้นๆ — ใช้ตอนช่วงวันที่ที่เลือกครอบคลุมมากกว่า 1 เดือน (เช่น "30 วันที่ผ่านมา"
// ใกล้ต้นเดือนจะย้อนไปถึงเดือนก่อน) เพื่อไม่ให้ตัดข้อมูลของเดือนก่อนทิ้งไปเฉยๆ เหมือนตอนอ้างอิงแค่ activeMonthKey เดียว
// dailyAds/dailyInbox สดจาก src/data/adDaily.json (Facebook Marketing API จริง, อัปเดตทุกคืน — ดู
// scripts/fetch-fb-daily.mjs) มาแทนของเดิมที่มาจากไฟล์ Excel "ยอดขาย Online S45 Clinic" ที่กรอกมือช้ากว่าจริง
// 1-3 วันเสมอ · "all" รวมจาก 5 หมวดที่มีข้อมูลสด (ไม่รวม legacy "Inter" ในบัญชี Nose Open 02 ก่อน ส.ค. 2569
// เหมือน adDaily.json เอง) — คืน null ถ้าเดือนนั้นยังไม่มีข้อมูลสด (เช่นเดือนเก่ากว่าที่ไฟล์เก็บไว้)
const AD_DAILY_LIVE_CATEGORIES = ["nose_open", "nose_semi", "breast_lipo", "brow_hairline", "inter"];
function liveDailyForMonth(monthIso, categoryKey) {
  const monthData = AD_DAILY.months?.[monthIso];
  if (!monthData) return null;
  if (categoryKey !== "all") return monthData[categoryKey] || null;
  const present = AD_DAILY_LIVE_CATEGORIES.filter((c) => monthData[c]);
  if (present.length === 0) return null;
  const len = Math.min(...present.map((c) => monthData[c].dailyAds.length));
  const dailyAds = Array.from({ length: len }, (_, i) => present.reduce((s, c) => s + (monthData[c].dailyAds[i] || 0), 0));
  const dailyInbox = Array.from({ length: len }, (_, i) => present.reduce((s, c) => s + (monthData[c].dailyInbox[i] || 0), 0));
  return { dailyAds, dailyInbox };
}
function funnelSourceForMonth(monthKey) {
  const base = monthKey === "aug" ? FUNNEL_DATA_AUG : monthKey === "jul" ? FUNNEL_DATA_JUL : monthKey === "jun" ? FUNNEL_DATA : null;
  if (!base) return null;
  const monthIso = monthKey === "aug" ? "2026-08" : monthKey === "jul" ? "2026-07" : "2026-06";
  const merged = {};
  for (const [key, val] of Object.entries(base)) {
    const live = liveDailyForMonth(monthIso, key);
    merged[key] = live ? { ...val, dailyAds: live.dailyAds, dailyInbox: live.dailyInbox } : val;
  }
  return merged;
}
// ทุกวันที่ (ข้าม 1-3 เดือนได้) ที่ผู้ใช้เลือกจริงบน Filter ด้านบน ที่ทับซ้อนกับ มิ.ย.-ส.ค. 2569 (เดือนที่มีข้อมูล
// Sales Funnel รายวัน) เรียงตามลำดับเวลา — ใช้แทนการอ้างอิง activeMonthKey เดียว เพื่อให้ช่วงที่ข้ามเดือน (เช่น
// "30 วันที่ผ่านมา" ตอนต้นเดือน ที่ย้อนไปถึงเดือนก่อน) ยังกรองข้อมูลได้ครบ ไม่ตัดวันของเดือนก่อนทิ้ง
function datesInRangeAcrossFunnelMonths(range) {
  const result = [];
  for (const monthKey of ["jun", "jul", "aug"]) {
    for (const day of calendarDayNumsInRange(monthKey, range)) {
      result.push({ monthKey, day, iso: isoForMonthDay(monthKey, day) });
    }
  }
  return result;
}

// เปอร์เซ็นต์เปลี่ยนแปลงจากช่วงเทียบ (compare) ไปช่วงปัจจุบัน — null ถ้าฐานเป็น 0 (เทียบไม่ได้)
function pctDelta(current, previous) {
  if (!previous) return null;
  return ((current - previous) / previous) * 100;
}

// ช่วงก่อนหน้าที่มีจำนวนวันเท่ากัน ต่อจากปลายช่วงหลักย้อนกลับไปทันที (ค่าเริ่มต้นของ Compare)
function previousPeriodRange(range) {
  const start = new Date(`${range.start}T00:00:00`);
  const end = new Date(`${range.end}T00:00:00`);
  const days = Math.round((end - start) / 86400000) + 1;
  const prevEnd = new Date(start);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - (days - 1));
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { start: iso(prevStart), end: iso(prevEnd) };
}

// ช่วงเดียวกันของเดือนก่อนหน้า (เลื่อนทั้ง start/end ถอยไป 1 เดือน)
function previousMonthRange(range) {
  const shift = (iso) => {
    const d = new Date(`${iso}T00:00:00`);
    d.setMonth(d.getMonth() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  return { start: shift(range.start), end: shift(range.end) };
}

const COMPARE_PRESETS = [
  ["prev_period", "ช่วงก่อนหน้า"],
  ["prev_month", "เดือนก่อนหน้า (วันเดียวกัน)"],
  ["custom", "กำหนดเอง"],
];

function ThemeToggle({ dark, onToggle }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      onClick={onToggle}
      title={dark ? "สลับเป็นโหมดสว่าง" : "สลับเป็นโหมดมืด"}
      className={`relative inline-flex items-center h-8 w-14 rounded-full shrink-0 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
        dark ? "bg-indigo-600 focus:ring-indigo-400" : "bg-slate-200 focus:ring-slate-300"
      }`}
    >
      <span className="sr-only">สลับโหมดมืด/สว่าง</span>
      <Sun size={12} className={`absolute left-1.5 text-amber-400 transition-opacity duration-200 ${dark ? "opacity-0" : "opacity-100"}`} />
      <Moon size={12} className={`absolute right-1.5 text-indigo-200 transition-opacity duration-200 ${dark ? "opacity-100" : "opacity-0"}`} />
      <span
        className={`absolute top-1 left-1 h-6 w-6 rounded-full bg-white shadow-md flex items-center justify-center transition-transform duration-300 ease-out ${
          dark ? "translate-x-6" : "translate-x-0"
        }`}
      >
        {dark ? <Moon size={13} className="text-indigo-600" /> : <Sun size={13} className="text-amber-500" />}
      </span>
    </button>
  );
}

const NAV_ITEMS = [
  { key: "overview", label: "ภาพรวม", icon: LayoutGrid },
  { key: "sales", label: "ยอดขาย", icon: TrendingUp },
  { key: "doctors", label: "หมอ", icon: Stethoscope },
  { key: "ads", label: "Ads / โฆษณา", icon: Megaphone },
  { key: "inbox", label: "Inbox & Bad Lead", icon: MessageCircle },
];

function Sidebar({ activePage, setActivePage, mobileOpen, setMobileOpen }) {
  return (
    <>
      {mobileOpen && <div className="fixed inset-0 bg-slate-900/40 z-30 sm:hidden" onClick={() => setMobileOpen(false)} />}
      <aside
        className={`fixed sm:sticky top-0 z-40 h-screen w-64 shrink-0 bg-white border-r border-slate-100 flex flex-col transition-transform duration-200 sm:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-5 py-5 border-b border-slate-100">
          <div className="flex items-center gap-2 min-w-0">
            <img src={S45_LOGO} alt="" className="w-7 h-7 rounded-md object-contain shrink-0" />
            <span className="text-sm font-bold text-slate-800 truncate">S45 Clinic</span>
          </div>
          <button className="sm:hidden text-slate-400" onClick={() => setMobileOpen(false)}>
            <X size={18} />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {NAV_ITEMS.map(({ key, label, icon: Icon }) => {
            const active = activePage === key;
            return (
              <button
                key={key}
                onClick={() => {
                  setActivePage(key);
                  setMobileOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  active ? "bg-indigo-50 text-indigo-700" : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                }`}
              >
                <Icon size={17} className={active ? "text-indigo-600" : "text-slate-400"} />
                {label}
              </button>
            );
          })}
        </nav>
        <div className="px-5 py-4 border-t border-slate-100 text-[11px] text-slate-400">Ads Performance Dashboard</div>
      </aside>
    </>
  );
}

// ============================================================
// DateRangePicker — dual-month calendar + presets + Compare
// (GA-style) แทนที่ dropdown แบบเดิมที่ใช้ input[type=date] ล้วนๆ
// ============================================================
const CAL_WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const CAL_MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function MonthCalendar({ y, m, draft, onDayClick, onJump, yearOptions }) {
  const isoOf = (d) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const firstDow = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="min-w-0">
      <div className="flex items-center justify-center gap-1 mb-2">
        <select
          value={m}
          onChange={(e) => onJump(y, Number(e.target.value))}
          className="bg-transparent text-sm font-semibold text-slate-700 cursor-pointer focus:outline-none"
        >
          {CAL_MONTHS_EN.map((lbl, i) => (
            <option key={i} value={i}>{lbl}</option>
          ))}
        </select>
        <select
          value={y}
          onChange={(e) => onJump(Number(e.target.value), m)}
          className="bg-transparent text-sm font-semibold text-slate-700 cursor-pointer focus:outline-none"
        >
          {yearOptions.map((yy) => (
            <option key={yy} value={yy}>{yy}</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-7 gap-y-1">
        {CAL_WEEKDAYS.map((d) => (
          <div key={d} className="text-[10px] text-slate-400 font-medium text-center">{d}</div>
        ))}
        {cells.map((d, i) => {
          if (d === null) return <div key={i} />;
          const iso = isoOf(d);
          const inRange = draft.start && draft.end && iso >= draft.start && iso <= draft.end;
          const isEdge = iso === draft.start || iso === draft.end;
          return (
            <div key={i} className="flex items-center justify-center py-0.5">
              <button
                type="button"
                onClick={() => onDayClick(iso)}
                className={`h-7 w-7 text-xs rounded-full flex items-center justify-center transition-colors ${
                  isEdge ? "bg-indigo-600 text-white font-semibold" : inRange ? "bg-indigo-100 text-indigo-700" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {d}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DateRangePicker({ value, compareEnabled, compareValue, onApply, presets, fmtDate }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [selectingEnd, setSelectingEnd] = useState(false);
  const [draftCompareOn, setDraftCompareOn] = useState(compareEnabled);
  const [draftCompare, setDraftCompare] = useState(compareValue);
  const [comparePreset, setComparePreset] = useState("prev_period");
  const [viewMonth, setViewMonth] = useState({ y: 2026, m: 5 });

  const yearOptions = [2025, 2026, 2027];

  const openPicker = () => {
    setDraft(value);
    setSelectingEnd(false);
    setDraftCompareOn(compareEnabled);
    setDraftCompare(compareValue);
    const d = new Date(`${value.end}T00:00:00`);
    d.setMonth(d.getMonth() - 1);
    setViewMonth({ y: d.getFullYear(), m: d.getMonth() });
    setOpen(true);
  };

  const rightMonth = viewMonth.m === 11 ? { y: viewMonth.y + 1, m: 0 } : { y: viewMonth.y, m: viewMonth.m + 1 };

  // ถ้า Compare ยังผูกกับ preset อยู่ (ไม่ใช่ "กำหนดเอง") ต้องคำนวณช่วงเทียบใหม่ทุกครั้งที่ผู้ใช้
  // เปลี่ยนช่วงหลักด้วย — ไม่งั้นค่าจะค้างที่ช่วงเดิม ไม่ขยับตามช่วงหลักที่เพิ่งเลือก
  const syncCompareToDraft = (newDraft) => {
    if (comparePreset === "prev_period") setDraftCompare(previousPeriodRange(newDraft));
    else if (comparePreset === "prev_month") setDraftCompare(previousMonthRange(newDraft));
  };

  const handleDayClick = (iso) => {
    if (!selectingEnd) {
      const next = { start: iso, end: iso };
      setDraft(next);
      syncCompareToDraft(next);
      setSelectingEnd(true);
    } else {
      const next = iso < draft.start ? { start: iso, end: draft.start } : { start: draft.start, end: iso };
      setDraft(next);
      syncCompareToDraft(next);
      setSelectingEnd(false);
    }
  };

  const jumpTo = (side) => (y, m) => {
    if (side === "left") setViewMonth({ y, m });
    else setViewMonth(m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 });
  };

  const applyComparePreset = (key) => {
    setComparePreset(key);
    if (key === "prev_period") setDraftCompare(previousPeriodRange(draft));
    else if (key === "prev_month") setDraftCompare(previousMonthRange(draft));
  };

  const commit = () => {
    onApply({ range: draft, compareEnabled: draftCompareOn, compareRange: draftCompareOn ? draftCompare : compareValue });
    setOpen(false);
  };

  const rangeLabel = value.start === value.end ? fmtDate(value.start) : `${fmtDate(value.start)} – ${fmtDate(value.end)}`;

  return (
    <div className="relative">
      <button
        onClick={() => (open ? setOpen(false) : openPicker())}
        className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:border-slate-300"
      >
        <Calendar size={16} className="text-slate-400" />
        <span>
          {rangeLabel}
          {compareEnabled && (
            <span className="text-slate-400 font-normal"> vs {fmtDate(compareValue.start)}–{fmtDate(compareValue.end)}</span>
          )}
        </span>
        <ChevronDown size={16} className="text-slate-400" />
      </button>
      {open && (
        <div className="absolute z-30 mt-2 right-0 bg-white border border-slate-200 rounded-xl shadow-lg flex flex-col sm:flex-row overflow-hidden w-[92vw] max-w-[640px] sm:w-[640px]">
          <div className="w-full sm:w-40 border-b sm:border-b-0 sm:border-r border-slate-100 p-3 shrink-0">
            <p className="text-xs font-semibold text-slate-400 mb-2 px-1">ใช้ล่าสุด</p>
            <div className="flex sm:block gap-1 sm:gap-0 space-y-0 sm:space-y-0.5 overflow-x-auto sm:overflow-visible max-h-none sm:max-h-72">
              {presets.map((p) => {
                const r = p.range();
                const isSelected = draft.start === r.start && draft.end === r.end;
                return (
                  <button
                    key={p.key}
                    onClick={() => {
                      setDraft(r);
                      syncCompareToDraft(r);
                      setSelectingEnd(false);
                      const d = new Date(`${r.end}T00:00:00`);
                      d.setMonth(d.getMonth() - 1);
                      setViewMonth({ y: d.getFullYear(), m: d.getMonth() });
                    }}
                    className={`shrink-0 sm:block sm:w-full text-left text-xs sm:text-sm px-2 py-1.5 rounded-lg whitespace-nowrap ${
                      isSelected ? "bg-indigo-50 text-indigo-700 font-semibold" : "hover:bg-slate-50 text-slate-600"
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex-1 p-4 min-w-0">
            <div className="flex items-center gap-2">
              <button onClick={() => setViewMonth((v) => (v.m === 0 ? { y: v.y - 1, m: 11 } : { y: v.y, m: v.m - 1 }))} className="text-slate-400 hover:text-slate-600 p-1 shrink-0">
                <ChevronLeft size={18} />
              </button>
              <div className="flex-1 grid grid-cols-2 gap-4 min-w-0">
                <MonthCalendar y={viewMonth.y} m={viewMonth.m} draft={draft} onDayClick={handleDayClick} onJump={jumpTo("left")} yearOptions={yearOptions} />
                <MonthCalendar y={rightMonth.y} m={rightMonth.m} draft={draft} onDayClick={handleDayClick} onJump={jumpTo("right")} yearOptions={yearOptions} />
              </div>
              <button onClick={() => setViewMonth((v) => (v.m === 11 ? { y: v.y + 1, m: 0 } : { y: v.y, m: v.m + 1 }))} className="text-slate-400 hover:text-slate-600 p-1 shrink-0">
                <ChevronRight size={18} />
              </button>
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-600 mt-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={draftCompareOn}
                onChange={(e) => {
                  setDraftCompareOn(e.target.checked);
                  if (e.target.checked && !draftCompare) setDraftCompare(previousPeriodRange(draft));
                }}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              Compare — เปรียบเทียบช่วงเวลา
            </label>

            {draftCompareOn && (
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <Select icon={ArrowUpDown} value={comparePreset} onChange={applyComparePreset} options={COMPARE_PRESETS} />
                <input
                  type="date"
                  value={draftCompare.start}
                  onChange={(e) => {
                    setComparePreset("custom");
                    setDraftCompare((d) => ({ ...d, start: e.target.value }));
                  }}
                  className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs"
                />
                <span className="text-slate-300">–</span>
                <input
                  type="date"
                  value={draftCompare.end}
                  onChange={(e) => {
                    setComparePreset("custom");
                    setDraftCompare((d) => ({ ...d, end: e.target.value }));
                  }}
                  className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs"
                />
              </div>
            )}

            <div className="flex items-center gap-2 mt-3">
              <input readOnly value={fmtDate(draft.start)} className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs flex-1 bg-slate-50 text-slate-600" />
              <span className="text-slate-300">–</span>
              <input readOnly value={fmtDate(draft.end)} className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs flex-1 bg-slate-50 text-slate-600" />
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setOpen(false)} className="text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50">
                ยกเลิก
              </button>
              <button onClick={commit} className="text-xs font-medium px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">
                อัปเดต
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdsDashboard() {
  const [procFilter, setProcFilter] = useState("all");
  const [doctorSort, setDoctorSort] = useState("cases"); // "cases" | "deposit"
  const [doctorProcFilter, setDoctorProcFilter] = useState("all");
  const [doctorNameFilter, setDoctorNameFilter] = useState("all");
  const [funnelFilter, setFunnelFilter] = useState("all");
  const [loaChannel, setLoaChannel] = useState("normal");
  const [otherChannelFilter, setOtherChannelFilter] = useState("line");
  const [inboxDailyFilter, setInboxDailyFilter] = useState("all");
  const [budgetBoostPct, setBudgetBoostPct] = useState(20);
  const [staffBoostPct, setStaffBoostPct] = useState(20);
  const [growthTab, setGrowthTab] = useState("budget"); // "budget" | "staff"
  const [heroCaseFilter, setHeroCaseFilter] = useState("doctor_tee");
  const [interDoctorFilter, setInterDoctorFilter] = useState("all");
  const [interProcFilter, setInterProcFilter] = useState("all");
  const [dateRange, setDateRange] = useState({ start: "2026-06-01", end: "2026-06-30" });
  // ค่าเริ่มต้นเปิด Compare ไว้เลย เทียบมิถุนายนกับพฤษภาคมเต็มเดือน (ไม่ใช้ previousPeriodRange เพราะพ.ค. มี 31 วัน
  // ยาวกว่ามิ.ย. 1 วัน จะเลื่อนไปเริ่ม 2 พ.ค. แทนที่จะเป็นทั้งเดือน) — ผู้ใช้ยังปรับช่วงเทียบเองได้ตามปกติจาก Date Picker
  const [compareEnabled, setCompareEnabled] = useState(true);
  const [compareRange, setCompareRange] = useState({ start: "2026-05-01", end: "2026-05-31" });
  const monthFilter = "jun26"; // คงไว้เพื่อความเข้ากันได้กับส่วนที่ล็อกไว้ที่มิถุนายน (Sales Funnel/Inbox/LOA/Bad Lead/Inter)

  // ---- Sidebar navigation + dark mode ----
  const [activePage, setActivePage] = useState("overview");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [dark, setDark] = useState(() => {
    if (typeof window === "undefined") return false;
    const saved = window.localStorage.getItem("s45-dark-mode");
    if (saved !== null) return saved === "1";
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
  });
  React.useEffect(() => {
    window.localStorage.setItem("s45-dark-mode", dark ? "1" : "0");
  }, [dark]);

  // ---- ข้อมูลตามช่วงวันที่ที่เลือกจริง (คำนวณสดจากไฟล์ธุรกรรม RAW_TX ทุกแถว วันต่อวัน) ----
  const PROC_LABELS_SHORT = { nose_open: "Nose Open", nose_semi: "Semi Open", brow_hairline: "Brow Lift", breast_lipo: "Breast" };
  const LEAD_TIME_LABELS = { nose_open: "Nose Open", nose_semi: "Semi Open", brow_hairline: "ยกคิ้ว", breast_lipo: "เสริมหน้าอก/ดูดไขมัน", all: "รวมทุกหัตถการ" };
  const OTHER_PROC_LABELS = { nose_open: "Nose Open", brow_hairline: "Brow Lift", breast_lipo: "Breast", nose_semi: "Semi Open", other: "อื่นๆ (Eye ฯลฯ)" };
  // ชื่อตัวแปรคงไว้ (isJunFull) แต่ตอนนี้เช็คช่วงเต็มเดือน ก.ค. แล้ว — CATEGORIES/FB_SURGERY/DOCTOR_PROC/
  // OTHER_CHANNEL_DATA/OR_LEAD_TIME_DAYS ทั้งหมดอัปเดตเป็นข้อมูล ก.ค. 2026 แล้ว (เดือนที่ "ล็อก" ไว้ใช้ตอนเลือกเต็มเดือนพอดี)
  const isJunFull = dateRange.start === "2026-07-01" && dateRange.end === "2026-07-31";

  const txInRange = RAW_TX.filter((t) => t.d >= dateRange.start && t.d <= dateRange.end);

  const activeFbSurgery = isJunFull
    ? FB_SURGERY
    : (() => {
        const fb = txInRange.filter((t) => t.ch === "Facebook");
        const spendByCat = categorySpendForRange(dateRange);
        return ["nose_open", "nose_semi", "brow_hairline", "breast_lipo"].map((k) => {
          const rows = fb.filter((t) => t.p === k);
          return {
            key: k,
            label: PROC_LABELS_SHORT[k],
            spend: spendByCat[k] ?? null,
            cases: rows.length,
            deposit: rows.reduce((s, r) => s + r.dep, 0),
            online: rows.reduce((s, r) => s + r.onl, 0),
            total: rows.reduce((s, r) => s + r.tot, 0),
          };
        });
      })();
  const activeFbByKey = Object.fromEntries(activeFbSurgery.map((r) => [r.key, r]));
  const activeFbTotal = activeFbSurgery.reduce(
    (acc, r) => ({ cases: acc.cases + r.cases, total: acc.total + r.total, online: acc.online + r.online, deposit: acc.deposit + r.deposit }),
    { cases: 0, total: 0, online: 0, deposit: 0 }
  );

  const activeDoctors = isJunFull
    ? null
    : (() => {
        const byProc = doctorProcFilter === "all" ? txInRange : txInRange.filter((t) => t.p === doctorProcFilter);
        const withDeposit = byProc.filter((t) => t.dep > 0);
        const byDoc = {};
        withDeposit.forEach((t) => {
          if (!byDoc[t.doc]) byDoc[t.doc] = { name: t.doc, cases: 0, deposit: 0, total: 0 };
          byDoc[t.doc].cases += 1;
          byDoc[t.doc].deposit += t.dep;
          byDoc[t.doc].total += t.tot;
        });
        return Object.values(byDoc).sort((a, b) => b.cases - a.cases);
      })();

  const activeLeadTime = (() => {
    if (isJunFull) return OR_LEAD_TIME_DAYS;
    const withOr = txInRange.filter((t) => t.or && t.or >= t.d);
    const calc = (rows) => {
      if (rows.length === 0) return null;
      const days = rows.map((t) => Math.round((new Date(t.or) - new Date(t.d)) / 86400000)).sort((a, b) => a - b);
      const mid = Math.floor(days.length / 2);
      const median = days.length % 2 ? days[mid] : (days[mid - 1] + days[mid]) / 2;
      return { median, min: days[0], max: days[days.length - 1], n: days.length };
    };
    const result = {};
    ["nose_open", "nose_semi", "brow_hairline", "breast_lipo"].forEach((k) => {
      const r = calc(withOr.filter((t) => t.p === k));
      result[k] = r ? { label: LEAD_TIME_LABELS[k], medianDays: r.median, minDays: r.min, maxDays: r.max, n: r.n } : { label: LEAD_TIME_LABELS[k], medianDays: null, n: null };
    });
    const rAll = calc(withOr);
    result.all = rAll ? { label: LEAD_TIME_LABELS.all, medianDays: rAll.median, minDays: rAll.min, maxDays: rAll.max, n: rAll.n } : { label: LEAD_TIME_LABELS.all, medianDays: null, n: null };
    return result;
  })();

  // เดือนที่ใช้แสดงผลทั้งหน้า Ads/โฆษณา และหน้า Inbox & Bad Lead มาจาก Filter วันที่หลักด้านบนโดยตรง
  // ไม่มี Dropdown เดือนแยกของแต่ละหน้าอีกต่อไป — เลือกเดือนจากปลายช่วงวันที่ก่อน ถ้าปลายไม่อยู่ใน 3
  // เดือนที่มีข้อมูล (มิ.ย.-ส.ค. 2569) ลองต้นช่วงแทน ถ้ายังไม่เจอถือว่าไม่มีข้อมูลสำหรับช่วงที่เลือก
  const monthKeyFromRange = (range) => {
    const key = (iso) => (iso.startsWith("2026-06") ? "jun" : iso.startsWith("2026-07") ? "jul" : iso.startsWith("2026-08") ? "aug" : null);
    return key(range.end) || key(range.start);
  };
  const activeMonthKey = monthKeyFromRange(dateRange);
  const funnelSource =
    activeMonthKey === "aug" ? FUNNEL_DATA_AUG : activeMonthKey === "jul" ? FUNNEL_DATA_JUL : activeMonthKey === "jun" ? FUNNEL_DATA : null;
  const funnelMonthLabel =
    activeMonthKey === "aug" ? "สิงหาคม 2569" : activeMonthKey === "jul" ? "กรกฎาคม 2569" : activeMonthKey === "jun" ? "มิถุนายน 2569" : null;
  const funnelMonthShortLabel = activeMonthKey === "aug" ? "ส.ค." : activeMonthKey === "jul" ? "ก.ค." : activeMonthKey === "jun" ? "มิ.ย." : "";
  // Sales Funnel Performance (หน้า Ads/โฆษณา) — ยอดยิง Ads/Inbox รวมเฉพาะวันที่ทับซ้อนกับช่วง Filter ที่เลือกจริง
  // (ไม่ใช่ยอดรวมทั้งเดือนเหมือนเดิม) ส่วนยอดขาย/OR/Basket/Close Rate/%Ads Cost คำนวณสดจาก RAW_TX เฉพาะช่วงที่
  // เลือก+หัตถการนั้น (นิยาม "เคสปิดแล้ว" = dep>0 ตามมาตรฐานเดียวกับหน้ายอดขาย/หน้าหมอ) — Inter ไม่มีแท็กแยกใน
  // ไฟล์ธุรกรรม จึงมีให้เฉพาะยอดยิง Ads/Inbox เท่านั้น เหมือนเดิม
  // ทุกวันที่ผู้ใช้เลือกจริงบน Filter ด้านบน ที่ทับซ้อนกับ มิ.ย.-ส.ค. 2569 เรียงตามเวลา — ข้ามได้หลายเดือน (เช่น
  // "30 วันที่ผ่านมา" ตอนต้นเดือนจะย้อนไปเดือนก่อน) ต่างจากเดิมที่ผูกกับ activeMonthKey เดียวแล้วตัดวันของเดือน
  // ก่อนทิ้งไปเงียบๆ จนกราฟ/ยอดรวมของช่วงที่ข้ามเดือนแสดงผลไม่ครบ
  const funnelDates = datesInRangeAcrossFunnelMonths(dateRange);
  const funnelLabel = (() => {
    for (const { monthKey } of funnelDates) {
      const src = funnelSourceForMonth(monthKey)?.[funnelFilter];
      if (src) return src.label;
    }
    return null;
  })();
  // ads/inbox เป็น null สำหรับวันที่ยังไม่มีข้อมูลกรอกในไฟล์ "ยอดขาย Online S45 Clinic" (กรอกช้ากว่าไฟล์ธุรกรรม
  // RAW_TX ที่ sales/or ด้านล่างใช้อยู่เสมอ 1-3 วัน) — ใช้แยกระหว่าง "ยิงแอด 0 บาทจริง" กับ "ยังไม่มีข้อมูล"
  const funnelDailyPoints = funnelDates.map(({ monthKey, day, iso }) => {
    const src = funnelSourceForMonth(monthKey)?.[funnelFilter];
    return {
      iso,
      day,
      ads: src && day <= src.dailyAds.length ? src.dailyAds[day - 1] : null,
      inbox: src && day <= src.dailyInbox.length ? src.dailyInbox[day - 1] : null,
    };
  });
  const funnelDaysWithAdsData = funnelDailyPoints.filter((p) => p.ads != null).length;
  const funnelLastAdsDataIso = (() => {
    const withData = funnelDailyPoints.filter((p) => p.ads != null);
    return withData.length > 0 ? withData[withData.length - 1].iso : null;
  })();
  const funnel = funnelLabel
    ? (() => {
        const ads = funnelDailyPoints.reduce((s, p) => s + (p.ads || 0), 0);
        const inbox = funnelDailyPoints.reduce((s, p) => s + (p.inbox || 0), 0);
        let sales = null,
          orRevenue = null,
          basket = null,
          closeRate = null,
          adsCost = null,
          adsCostOr = null;
        if (funnelFilter !== "inter") {
          const procKey = funnelFilter === "all" ? null : funnelFilter;
          const rowsInRange = procKey ? txInRange.filter((t) => t.p === procKey) : txInRange.filter((t) => DAILY_CATEGORY_KEYS.includes(t.p));
          const closedCases = rowsInRange.filter((t) => t.dep > 0);
          sales = closedCases.reduce((s, t) => s + t.tot, 0);
          const rowsAll = procKey ? RAW_TX.filter((t) => t.p === procKey) : RAW_TX.filter((t) => DAILY_CATEGORY_KEYS.includes(t.p));
          const orCases = rowsAll.filter((t) => t.or && t.or >= dateRange.start && t.or <= dateRange.end);
          orRevenue = orCases.reduce((s, t) => s + t.tot, 0);
          basket = closedCases.length > 0 ? sales / closedCases.length : null;
          closeRate = inbox > 0 ? closedCases.length / inbox : null;
          adsCost = sales > 0 ? ads / sales : null;
          adsCostOr = orRevenue > 0 ? ads / orRevenue : null;
        }
        return {
          label: funnelLabel,
          ads,
          inbox,
          or: orRevenue,
          sales,
          basket,
          closeRate,
          adsCost,
          adsCostOr,
          daysRequested: funnelDailyPoints.length,
          daysWithAdsData: funnelDaysWithAdsData,
          lastAdsDataIso: funnelLastAdsDataIso,
        };
      })()
    : null;
  // กราฟแสดง "ทุกวันที่ขอจริง" เสมอ (แกน X ครบตามช่วง Filter แม้ข้ามเดือน) — วันที่ยังไม่มีข้อมูลเป็นช่องว่าง
  // (ads/inbox = null) แทนที่จะหายไปจากแกนจนกราฟดูเหมือนแสดงผลไม่ครบ
  const funnelChartData = funnelDailyPoints;

  // ระยะเวลาปิด OR สำหรับ "หน้า Inbox & Bad Lead" — ใช้ activeLeadTime ที่คำนวณสดจาก txInRange อยู่แล้ว
  // (กรองตามช่วงวันที่ Filter หลักด้านบนจริง ไม่ผูกกับ มิ.ย.-ส.ค.เท่านั้น เพราะ RAW_TX มีข้อมูลย้อนไปถึง ม.ค. 2569)
  const funnelLeadTime = activeLeadTime;

  // ยอดขายรวม (deposit/online/sales) ในช่วงวันที่เลือก + ค่าโฆษณา (ประมาณจากยอดรายเดือนจริง เฉลี่ยตามสัดส่วนวันที่ทับซ้อน)
  // แก้บั๊ก: เดิมไม่กรองตาม procFilter ทำให้สลับหัตถการแล้วยอดไม่เปลี่ยนเมื่อช่วงวันที่ไม่ใช่เดือนมิ.ย.เต็มเดือน
  const txInRangeByProc = procFilter === "all" ? txInRange : txInRange.filter((t) => t.p === procFilter);
  const rangeTotals = isJunFull
    ? procFilter === "all"
      ? { deposit: GRAND_TOTAL.deposit, online: GRAND_TOTAL.online, sales: GRAND_TOTAL.sales }
      : { deposit: CATEGORIES[procFilter].deposit, online: CATEGORIES[procFilter].online, sales: CATEGORIES[procFilter].sales }
    : {
        deposit: txInRangeByProc.reduce((s, t) => s + t.dep, 0),
        online: txInRangeByProc.reduce((s, t) => s + t.onl, 0),
        sales: txInRangeByProc.reduce((s, t) => s + t.tot, 0),
      };
  const rangeSpend = (() => {
    if (isJunFull) return procFilter === "all" ? GRAND_TOTAL.spend : CATEGORIES[procFilter].spend;
    const spendByCat = categorySpendForRange(dateRange);
    return procFilter === "all" ? spendByCat.all : spendByCat[procFilter] ?? 0;
  })();

  const THAI_MONTHS_SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  const fmtDateTh = (iso) => {
    const [y, m, d] = iso.split("-").map(Number);
    return `${d} ${THAI_MONTHS_SHORT[m - 1]} ${y + 543}`;
  };
  const rangeLabel = dateRange.start === dateRange.end ? fmtDateTh(dateRange.start) : `${fmtDateTh(dateRange.start)} – ${fmtDateTh(dateRange.end)}`;

  // ---- วันนี้แบบเรียลไทม์: อ่านจากนาฬิกาเครื่องจริง (new Date()) ทุกครั้งที่ render แทนการล็อกวันที่ไว้ตายตัว ----
  // ใช้วันนี้จริงเสมอสำหรับ preset ต่างๆ (เช่น "เดือนนี้" ต้องขึ้นถึงวันที่จริงวันนี้ เช่น 27 ก็คือ 27
  // ต่อให้ไฟล์ข้อมูลยังไม่มีของวันนั้นเข้ามาก็ตาม) — ไม่ cap ไว้ที่ "วันที่มีข้อมูลล่าสุด" อีกต่อไป
  const toIsoDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const REAL_TODAY = toIsoDate(new Date());

  const isoDaysAgo = (n) => {
    const d = new Date(`${REAL_TODAY}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - n);
    return d.toISOString().slice(0, 10);
  };
  const thisMonthStart = `${REAL_TODAY.slice(0, 7)}-01`;
  const thisMonthNum = Number(REAL_TODAY.slice(5, 7));
  const thisYearNum = Number(REAL_TODAY.slice(0, 4));
  const lastMonthNum = thisMonthNum === 1 ? 12 : thisMonthNum - 1;
  const lastMonthYear = thisMonthNum === 1 ? thisYearNum - 1 : thisYearNum;
  const lastMonthStart = `${lastMonthYear}-${String(lastMonthNum).padStart(2, "0")}-01`;
  const lastMonthEndDay = new Date(lastMonthYear, lastMonthNum, 0).getDate();
  const lastMonthEnd = `${lastMonthYear}-${String(lastMonthNum).padStart(2, "0")}-${String(lastMonthEndDay).padStart(2, "0")}`;
  // ไม่ใส่ชื่อย่อเดือนในป้าย "เดือนนี้"/"เดือนที่แล้ว" เพราะระบบนี้ใช้งานต่อเนื่องไปเรื่อยๆ ทุกเดือน
  // การ hardcode ชื่อเดือนไว้ในป้ายจะทำให้เข้าใจผิดว่าระบบหยุดอัปเดตที่เดือนนั้นเดือนเดียว
  const DATE_PRESETS = [
    { key: "today", label: "วันนี้", range: () => ({ start: REAL_TODAY, end: REAL_TODAY }) },
    { key: "yesterday", label: "เมื่อวาน", range: () => ({ start: isoDaysAgo(1), end: isoDaysAgo(1) }) },
    { key: "7d", label: "7 วันที่ผ่านมา", range: () => ({ start: isoDaysAgo(6), end: REAL_TODAY }) },
    { key: "14d", label: "14 วันที่ผ่านมา", range: () => ({ start: isoDaysAgo(13), end: REAL_TODAY }) },
    { key: "30d", label: "30 วันที่ผ่านมา", range: () => ({ start: isoDaysAgo(29), end: REAL_TODAY }) },
    { key: "thismonth", label: "เดือนนี้", range: () => ({ start: thisMonthStart, end: REAL_TODAY }) },
    { key: "lastmonth", label: "เดือนที่แล้ว", range: () => ({ start: lastMonthStart, end: lastMonthEnd }) },
    { key: "may", label: "พฤษภาคม 2569", range: () => ({ start: "2026-05-01", end: "2026-05-31" }) },
    { key: "q2", label: "ไตรมาส เม.ย.–มิ.ย. 2569", range: () => ({ start: "2026-04-01", end: "2026-06-30" }) },
    { key: "ytd", label: "ตั้งแต่ต้นปี 2569", range: () => ({ start: "2026-01-01", end: REAL_TODAY }) },
  ];


  const procOptions = [["all", "รวมทุกหัตถการ"], ...Object.entries(CATEGORIES).map(([k, v]) => [k, v.label])];

  const totals = useMemo(() => {
    if (procFilter === "all") {
      return {
        spend: GRAND_TOTAL.spend,
        sales: GRAND_TOTAL.sales,
        deposit: GRAND_TOTAL.deposit,
        online: GRAND_TOTAL.online,
        target: Object.values(CATEGORIES).reduce((s, c) => s + c.target, 0),
      };
    }
    const c = CATEGORIES[procFilter];
    return { spend: c.spend, sales: c.sales, deposit: c.deposit, online: c.online, target: c.target };
  }, [procFilter]);

  // ROAS ทุกช่องทาง เทียบกับยอดมัดจำ / ยอดขายรวม (Total Price) / Online Price
  const roasDeposit = totals.spend > 0 ? totals.deposit / totals.spend : 0;
  const roasSales = totals.spend > 0 ? totals.sales / totals.spend : 0;
  const roasOnline = totals.spend > 0 ? totals.online / totals.spend : 0;

  // ยอดขายรวม — Facebook only, summed from the Total Price column (highlighted rows) of the real transaction log
  const fbSales = useMemo(() => {
    if (procFilter === "all") return FB_TOTAL.total;
    return FB_BY_KEY[procFilter]?.total ?? 0;
  }, [procFilter]);

  const fbSummary = useMemo(() => {
    if (procFilter === "all") return FB_TOTAL;
    return FB_BY_KEY[procFilter] ?? { total: 0, online: 0, deposit: 0, cases: 0 };
  }, [procFilter]);

  // % เทียบกับ compareRange (การ์ดสรุป "ยอดขายจาก Facebook แยกตามหัตถการ") — ใช้ compareRange เดียวกับที่ตั้งไว้
  // บน DateRangePicker ด้านบน ไม่ใช่ "เดือนก่อนหน้า" ตายตัว
  const fbCompareTotals = compareEnabled ? computeFbTotalsForRange(compareRange) : null;
  const fbActiveTotal = isJunFull ? fbSummary : activeFbTotal;
  const fbTotalMoM = fbCompareTotals ? pctDelta(fbActiveTotal.total, fbCompareTotals.total) : null;
  const fbOnlineMoM = fbCompareTotals ? pctDelta(fbActiveTotal.online, fbCompareTotals.online) : null;
  const fbDepositMoM = fbCompareTotals ? pctDelta(fbActiveTotal.deposit, fbCompareTotals.deposit) : null;

  // ค่าโฆษณาที่ใช้ไป — คอลัมน์ Spend ในชีต Budget Allocate คือ Facebook เท่านั้น
  const fbSpend = totals.spend;

  const ratio = fbSales > 0 ? fbSpend / fbSales : 0;
  const roas = fbSpend > 0 ? fbSales / fbSpend : 0;
  const overThreshold = ratio > AD_COST_THRESHOLD;

  // เมตริกสรุปบน Metric Cards ด้านบน — ปรับตามช่วงวันที่ (dateRange) + procFilter ที่เลือกจริง
  // ต่างจาก totals/fbSales/fbSpend/ratio/roas ด้านบนซึ่งใช้ในข้อความสรุป insight ที่ล็อกไว้ที่เดือนมิถุนายนเสมอ
  const execSales = isJunFull ? totals.sales : rangeTotals.sales ?? 0;
  const execFbSales = isJunFull
    ? fbSales
    : procFilter === "all"
    ? activeFbTotal.total
    : activeFbByKey[procFilter]?.total ?? 0;
  const execFbSpend = isJunFull ? fbSpend : rangeSpend;
  const execRatio = execFbSales > 0 ? execFbSpend / execFbSales : 0;
  const execRoas = execFbSpend > 0 ? execFbSales / execFbSpend : 0;
  const execOverThreshold = execRatio > AD_COST_THRESHOLD;

  // ---- Compare (เปรียบเทียบช่วงเวลา) — ใช้ computeExecMetricsForRange (pure function)
  // คำนวณ metric ชุดเดียวกันสำหรับ compareRange แล้วหาค่า % เปลี่ยนแปลงเทียบกับช่วงหลัก
  // แสดงเป็น badge บน Metric Cards เมื่อผู้ใช้เปิด Compare จาก DateRangePicker ----
  const compareMetrics = compareEnabled ? computeExecMetricsForRange(compareRange, procFilter) : null;
  const salesDelta = compareMetrics ? pctDelta(execSales, compareMetrics.sales) : null;
  const fbSalesDelta = compareMetrics ? pctDelta(execFbSales, compareMetrics.fbSales) : null;
  const fbSpendDelta = compareMetrics ? pctDelta(execFbSpend, compareMetrics.fbSpend) : null;
  const ratioDelta = compareMetrics ? pctDelta(execRatio, compareMetrics.ratio) : null;
  const roasDeltaCompare = compareMetrics ? pctDelta(execRoas, compareMetrics.roas) : null;
  const compareRangeLabel =
    compareRange.start === compareRange.end ? fmtDateTh(compareRange.start) : `${fmtDateTh(compareRange.start)} – ${fmtDateTh(compareRange.end)}`;

  // ทั้ง 2 ตัวนี้อิงช่วงวันที่ที่เลือกจริง (dateRange) — เดือนมิ.ย.เต็มเดือนใช้ตัวเลขทางการจาก CATEGORIES เหมือนเดิม
  // ช่วงอื่นคำนวณยอดขายจาก RAW_TX จริงรายวัน + ประมาณค่าโฆษณา/เป้าหมายตามสัดส่วนวันที่ทับซ้อนกับแต่ละเดือน
  // "Inter" ไม่มีแท็กแยกในไฟล์ธุรกรรมรายวัน จึงโชว์ได้เฉพาะตอนเลือกเต็มเดือนมิ.ย. เท่านั้น
  const chartData = isJunFull
    ? Object.entries(CATEGORIES).map(([key, c]) => ({ key, label: c.label, spend: c.spend, sales: c.sales }))
    : DAILY_CATEGORY_KEYS.map((key) => {
        const m = computeExecMetricsForRange(dateRange, key);
        return { key, label: CATEGORIES[key].label, spend: m.fbSpend, sales: m.sales };
      });

  const targetRanking = useMemo(() => {
    if (isJunFull) {
      return Object.entries(CATEGORIES).map(([key, c]) => ({ key, ...c })).sort((a, b) => b.targetPct - a.targetPct);
    }
    return DAILY_CATEGORY_KEYS.map((key) => {
      const m = computeExecMetricsForRange(dateRange, key);
      const target = computeProratedTarget(dateRange, CATEGORIES[key].target);
      const targetPct = target > 0 ? m.sales / target : 0;
      return { key, label: CATEGORIES[key].label, sales: m.sales, spend: m.fbSpend, target, targetPct };
    }).sort((a, b) => b.targetPct - a.targetPct);
  }, [dateRange, isJunFull]);

  // สรุปเคสแยกตามหมอ — กรองตามหัตถการที่เลือกได้ (dropdown แยกจากหัตถการด้านบน)
  const sortedDoctors = useMemo(() => {
    const rows =
      doctorProcFilter === "all"
        ? Object.values(
            DOCTOR_PROC.reduce((acc, r) => {
              if (!acc[r.doctor]) acc[r.doctor] = { name: r.doctor, cases: 0, deposit: 0, online: 0, total: 0 };
              acc[r.doctor].cases += r.cases;
              acc[r.doctor].deposit += r.deposit;
              acc[r.doctor].online += r.online;
              acc[r.doctor].total += r.total;
              return acc;
            }, {})
          )
        : DOCTOR_PROC.filter((r) => r.key === doctorProcFilter).map((r) => ({
            name: r.doctor,
            cases: r.cases,
            deposit: r.deposit,
            online: r.online,
            total: r.total,
          }));
    return [...rows].sort((a, b) => (doctorSort === "cases" ? b.cases - a.cases : b.deposit - a.deposit));
  }, [doctorProcFilter, doctorSort]);

  const maxCases = Math.max(...sortedDoctors.map((d) => d.cases), 1);
  const maxDeposit = Math.max(...sortedDoctors.map((d) => d.deposit), 1);

  const funnelOptions = Object.entries(FUNNEL_DATA).map(([k, v]) => [k, v.label]);
  const otherChannelOptions = Object.entries(OTHER_CHANNEL_META).map(([k, v]) => [k, v.label]);
  const otherChannelRows = OTHER_CHANNEL_DATA[otherChannelFilter];

  const activeOtherChannelRows = isJunFull
    ? otherChannelRows
    : (() => {
        const chMatch =
          otherChannelFilter === "line"
            ? (t) => t.ch === "Line"
            : otherChannelFilter === "whatsapp"
            ? (t) => t.ch === "WhatsApp"
            : (t) => t.ch === "Sale หาเอง" || t.ch === "ช่องทางส่วนตัว BA";
        const rows = txInRange.filter(chMatch);
        return ["nose_open", "brow_hairline", "breast_lipo", "nose_semi", "other"].map((k) => {
          const sub = rows.filter((t) => t.p === k);
          return {
            key: k,
            label: OTHER_PROC_LABELS[k],
            cases: sub.length,
            deposit: sub.reduce((s, r) => s + r.dep, 0),
            online: sub.reduce((s, r) => s + r.onl, 0),
            total: sub.reduce((s, r) => s + r.tot, 0),
          };
        });
      })();
  const activeOtherChannelTotal = otherChannelTotalOf(activeOtherChannelRows);
  const otherChannelTotal = otherChannelTotalOf(otherChannelRows);

  // % เทียบกับ compareRange (การ์ดสรุป "ยอดขายจากช่องทางอื่น แยกตามหัตถการ")
  const otherCompareTotals = compareEnabled ? computeOtherChannelTotalsForRange(compareRange, otherChannelFilter) : null;
  const otherTotalMoM = otherCompareTotals ? pctDelta(activeOtherChannelTotal.total, otherCompareTotals.total) : null;
  const otherOnlineMoM = otherCompareTotals ? pctDelta(activeOtherChannelTotal.online, otherCompareTotals.online) : null;
  const otherDepositMoM = otherCompareTotals ? pctDelta(activeOtherChannelTotal.deposit, otherCompareTotals.deposit) : null;

  // เป้าหมาย Inbox ต่อวัน แยกตามหัตถการ (ตัวเลขจริงที่ทีมกำหนด)
  // เทียบกับ Inbox ที่ทำได้จริงรายวัน ในเดือนมิถุนายน (จาก Sales Funnel data) — เลือกหัตถการผ่าน Dropdown
  const INBOX_DAILY_TARGET = {
    nose_open: 120,
    nose_semi: 35,
    brow_hairline: 130,
    breast_lipo: 25,
    inter: 10,
  };
  const INBOX_DAILY_TARGET_ALL = Object.values(INBOX_DAILY_TARGET).reduce((s, v) => s + v, 0); // รวมทุกหัตถการ รวม Inter แล้ว
  const inboxDailyOptions = Object.entries(FUNNEL_DATA).map(([k, v]) => [k, v.label]);
  const heroCaseOptions = Object.entries(DOCTOR_HERO_CASES).map(([k, v]) => [k, v.label]);
  // Inter แยกตามหมอ — ผูกกับ Filter วันที่หลักด้านบน (activeMonthKey) แทน Dropdown เดือนแยกเดิม (มีข้อมูลแค่
  // มิ.ย./ก.ค. 2569 เท่านั้น) · interProcFilter กรองตารางที่ปกติแสดงทุกหัตถการของหมอคนนั้นให้เหลือหัตถการเดียว
  const interMonthKey = activeMonthKey === "jun" || activeMonthKey === "jul" ? activeMonthKey : null;
  const interMonthDataKey = interMonthKey === "jun" ? "jun26" : interMonthKey === "jul" ? "jul26" : null;
  const interDoctorRowsAll = interMonthDataKey ? INTER_BY_DOCTOR_MONTH[interMonthDataKey]?.[interDoctorFilter] || [] : [];
  const interDoctorRows = interProcFilter === "all" ? interDoctorRowsAll : interDoctorRowsAll.filter((r) => r.key === interProcFilter);
  const interDoctorTotal = interDoctorRows.reduce(
    (acc, r) => ({ cases: acc.cases + r.cases, deposit: acc.deposit + r.deposit, total: acc.total + r.total }),
    { cases: 0, deposit: 0, total: 0 }
  );
  // % เทียบกับ compareRange (การ์ดสรุป "Inter แยกตามหมอ + หัตถการ") — Inter มีข้อมูลแค่ยอดรวมทั้งเดือน มิ.ย./ก.ค.
  // เท่านั้น (ไม่มีรายวัน) จึงเทียบได้เฉพาะตอน compareRange ตกอยู่ในเดือนใดเดือนหนึ่งใน 2 เดือนนี้พอดี
  const interCompareMonthKey = (() => {
    const k = monthKeyFromRange(compareRange);
    return k === "jun" || k === "jul" ? k : null;
  })();
  const interCompareDataKey = interCompareMonthKey === "jun" ? "jun26" : interCompareMonthKey === "jul" ? "jul26" : null;
  const interCompareRowsAll = interCompareDataKey ? INTER_BY_DOCTOR_MONTH[interCompareDataKey]?.[interDoctorFilter] || [] : [];
  const interCompareRows = interProcFilter === "all" ? interCompareRowsAll : interCompareRowsAll.filter((r) => r.key === interProcFilter);
  const interCompareTotal = interCompareRows.reduce(
    (acc, r) => ({ cases: acc.cases + r.cases, deposit: acc.deposit + r.deposit, total: acc.total + r.total }),
    { cases: 0, deposit: 0, total: 0 }
  );
  const interCasesMoM = compareEnabled && interCompareDataKey ? pctDelta(interDoctorTotal.cases, interCompareTotal.cases) : null;
  const interDepositMoM = compareEnabled && interCompareDataKey ? pctDelta(interDoctorTotal.deposit, interCompareTotal.deposit) : null;
  const interTotalMoM = compareEnabled && interCompareDataKey ? pctDelta(interDoctorTotal.total, interCompareTotal.total) : null;
  const selectedHeroDoctor = DOCTOR_HERO_CASES[heroCaseFilter];
  const inboxDailyFunnel = funnelSource ? funnelSource[inboxDailyFilter] : null;
  const inboxHasSalesData = inboxDailyFunnel?.dailyConsult != null;
  const inboxDailyTargetPerDay = inboxDailyFilter === "all" ? INBOX_DAILY_TARGET_ALL : INBOX_DAILY_TARGET[inboxDailyFilter] ?? null;
  // ทุกวันที่ผู้ใช้เลือกจริงบน Filter ด้านบน ข้ามได้หลายเดือน (เหมือน Sales Funnel Performance ด้านบน) — ไม่ผูก
  // กับ activeMonthKey เดียวอีกต่อไป เพื่อให้ช่วงที่ข้ามเดือน (เช่น "30 วันที่ผ่านมา" ตอนต้นเดือน) ไม่ตัดข้อมูล
  // ของเดือนก่อนทิ้ง · inboxDailyData ใช้รวมยอด (เฉพาะวันที่มีข้อมูลจริง) ส่วน inboxChartData ใช้วาดกราฟ (ครบ
  // ทุกวันที่ขอ วันที่ยังไม่มีข้อมูลเป็นช่องว่างแทนที่จะหายไปจากแกนจนกราฟดูเหมือนแสดงผลไม่ครบ)
  const inboxDates = datesInRangeAcrossFunnelMonths(dateRange);
  const inboxLabel = (() => {
    for (const { monthKey } of inboxDates) {
      const src = funnelSourceForMonth(monthKey)?.[inboxDailyFilter];
      if (src) return src.label;
    }
    return null;
  })();
  const inboxDailyPointsRaw = inboxDates.map(({ monthKey, day, iso }) => {
    const src = funnelSourceForMonth(monthKey)?.[inboxDailyFilter];
    const hasData = src && day <= src.dailyInbox.length;
    return {
      iso,
      day,
      hasData,
      target: inboxDailyTargetPerDay,
      actual: hasData ? src.dailyInbox[day - 1] : null,
      consult: hasData ? src.dailyConsult?.[day - 1] ?? null : null,
      deposit: hasData ? src.dailyDeposit?.[day - 1] ?? null : null,
      or: hasData ? src.dailyOrCases?.[day - 1] ?? null : null,
    };
  });
  const inboxDaysWithData = inboxDailyPointsRaw.filter((p) => p.hasData).length;
  const inboxLastDataIso = (() => {
    const withData = inboxDailyPointsRaw.filter((p) => p.hasData);
    return withData.length > 0 ? withData[withData.length - 1].iso : null;
  })();
  const inboxDailyData = inboxDailyPointsRaw.filter((p) => p.hasData);
  const inboxChartData = inboxDailyPointsRaw;
  const inboxDailyTotals = inboxDailyData.reduce(
    (acc, r) => ({
      target: acc.target + (r.target ?? 0),
      actual: acc.actual + r.actual,
      consult: acc.consult + r.consult,
      deposit: acc.deposit + r.deposit,
      or: acc.or + r.or,
    }),
    { target: 0, actual: 0, consult: 0, deposit: 0, or: 0 }
  );
  const daysAboveTarget = inboxDailyTargetPerDay != null ? inboxDailyData.filter((r) => r.actual >= r.target).length : 0;

  // เทียบกับ "ช่วงวันที่เดียวกัน" ของเดือนก่อนหน้าติดกัน (มิ.ย.←ก.ค.←ส.ค.) เช่น เลือก 1-7 ส.ค. จะเทียบกับ 1-7 ก.ค.
  // ไม่ใช่ยอดรวมทั้งเดือนก่อนหน้าเหมือนเดิม (ไม่งั้นเทียบกันคนละสเกล ตัวเลข % จะไม่มีความหมาย) — ไม่มีข้อมูล
  // ก่อน มิ.ย. 2569 จึงไม่มีเดือนก่อนหน้าให้เทียบตอนเลือกมิ.ย. (null = ไม่แสดงป้าย ไม่ใช่ 0%)
  const prevFunnelSource = activeMonthKey === "aug" ? FUNNEL_DATA_JUL : activeMonthKey === "jul" ? FUNNEL_DATA : null;
  const prevMonthKey = activeMonthKey === "aug" ? "jul" : activeMonthKey === "jul" ? "jun" : null;
  const prevInboxDailyFunnel = prevFunnelSource ? prevFunnelSource[inboxDailyFilter] : null;
  const sumDailyAt = (arr, idxs) => (arr ? idxs.reduce((s, i) => s + (arr[i] || 0), 0) : null);
  // เทียบเฉพาะวันของ "เดือนหลัก" (activeMonthKey, มาจากปลายช่วง Filter) กับเดือนก่อนหน้า แม้ยอดรวมด้านบนจะรวม
  // ข้ามเดือนแล้วก็ตาม (การเทียบเดือนก่อนต้องมีเดือนหลักเดียวที่ชัดเจนจึงจะมีความหมาย)
  const activeMonthDayIdxs = activeMonthKey ? inboxDates.filter((d) => d.monthKey === activeMonthKey).map((d) => d.day - 1) : [];
  const prevInboxDailyIdxs =
    prevInboxDailyFunnel && prevMonthKey ? activeMonthDayIdxs.filter((i) => i < prevInboxDailyFunnel.dailyInbox.length) : [];
  const prevInboxDailyTotals = prevInboxDailyFunnel
    ? {
        actual: sumDailyAt(prevInboxDailyFunnel.dailyInbox, prevInboxDailyIdxs),
        consult: sumDailyAt(prevInboxDailyFunnel.dailyConsult, prevInboxDailyIdxs),
        deposit: sumDailyAt(prevInboxDailyFunnel.dailyDeposit, prevInboxDailyIdxs),
        or: sumDailyAt(prevInboxDailyFunnel.dailyOrCases, prevInboxDailyIdxs),
      }
    : null;
  const inboxActualMoM = prevInboxDailyTotals ? pctDelta(inboxDailyTotals.actual, prevInboxDailyTotals.actual) : null;
  const inboxConsultMoM = prevInboxDailyTotals ? pctDelta(inboxDailyTotals.consult, prevInboxDailyTotals.consult) : null;
  const inboxDepositMoM = prevInboxDailyTotals ? pctDelta(inboxDailyTotals.deposit, prevInboxDailyTotals.deposit) : null;
  const inboxOrMoM = prevInboxDailyTotals ? pctDelta(inboxDailyTotals.or, prevInboxDailyTotals.or) : null;

  // "ปิดปรึกษา/ปิดมัดจำ แยกตามหัตถการ (เทียบ Inbox)" — คำนวณสดตามช่วงวันที่ที่เลือกจริงแล้ว (เดิมเป็นยอดรวมทั้งเดือน
  // เพราะไม่มีข้อมูล Inbox รายวันจริง ตอนนี้มีแล้วจาก adDaily.json) · เคสปิดแล้ว = dep>0 ตามมาตรฐานเดียวกับที่ใช้
  // ทั้งแอป (activeDoctors/activeFbSurgery/Sales Funnel Performance) · "ปิดปรึกษา" กว้างกว่า "ปิดมัดจำ" เล็กน้อย
  // เพราะรวมเคสที่มีชื่อ Sale Consult กำกับด้วย (RAW_TX แทบทุกแถวมีอยู่แล้ว จึงใกล้เคียงกับปิดมัดจำมาก)
  const closeTableDates = datesInRangeAcrossFunnelMonths(dateRange);
  const closeTableInboxByProc = {};
  DAILY_CATEGORY_KEYS.forEach((k) => {
    closeTableInboxByProc[k] = closeTableDates.reduce((sum, { monthKey, day }) => {
      const src = funnelSourceForMonth(monthKey)?.[k];
      return sum + (src && day <= src.dailyInbox.length ? src.dailyInbox[day - 1] : 0);
    }, 0);
  });
  const closeCountsLive = (() => {
    const calc = (rows) => {
      const depositRows = rows.filter((t) => t.dep > 0);
      return {
        consult: rows.length,
        deposit: depositRows.length,
        consultValue: rows.reduce((s, t) => s + t.tot, 0),
        depositValue: depositRows.reduce((s, t) => s + t.tot, 0),
      };
    };
    const result = {};
    DAILY_CATEGORY_KEYS.forEach((k) => {
      result[k] = calc(txInRange.filter((t) => t.p === k));
    });
    result.all = calc(txInRange.filter((t) => DAILY_CATEGORY_KEYS.includes(t.p)));
    return result;
  })();
  const closeTableAllInbox = DAILY_CATEGORY_KEYS.reduce((s, k) => s + closeTableInboxByProc[k], 0);
  const closeTableLabelFor = (procKey) => {
    for (const { monthKey } of closeTableDates) {
      const src = funnelSourceForMonth(monthKey)?.[procKey];
      if (src) return src.label.replace(/\s*\(.*\)/, "");
    }
    return procKey === "inter" ? "Inter" : procKey;
  };

  // ทีม Online: 5 คน ตอบทุกหัตถการหลัก + 1 คน ตอบเฉพาะ Inter
  const ONLINE_TEAM_MAIN = 5;
  const ONLINE_TEAM_INTER = 1;
  const onlineStaffCount = inboxDailyFilter === "inter" ? ONLINE_TEAM_INTER : ONLINE_TEAM_MAIN;
  const avgChatsPerAgentPerDay = inboxDailyTotals.actual / inboxDailyData.length / onlineStaffCount;
  const avgChatsPerAgentPerMonth = inboxDailyTotals.actual / onlineStaffCount;

  // ============================================================
  // Option การกระตุ้นยอดขาย
  // Option 1a: เพิ่มงบโฆษณาอย่างเดียว (คนตอบคงที่ 5 คน) — Inbox โตตาม %งบ แต่ภาระงาน/คนเพิ่มขึ้น
  //            ทำให้ Close Rate ลดลงบ้างตาม elasticity ⇒ ยอดปิดโตน้อยกว่า %งบที่เพิ่มเล็กน้อย (diminishing returns)
  // Option 1b: เพิ่มคนตอบอย่างเดียว (งบ/Inbox คงที่) — ภาระงาน/คนลดลง ⇒ Close Rate เพิ่มขึ้นตาม elasticity
  //            แต่ปริมาณ Inbox ไม่เพิ่ม
  // Option 2: ไม่เพิ่มงบ แต่ย้ายทีม Online ไปตอบเฉพาะกลุ่ม — Nose Open+Semi Open = 4 คน, ยกคิ้ว+เสริมหน้าอก = 4 คน
  // ============================================================
  const REALLOC_ELASTICITY = 0.4;

  const budgetOnlyRows = Object.entries(FUNNEL_DATA)
    .filter(([k]) => k !== "all")
    .map(([k, v]) => {
      const c = FUNNEL_CLOSE_COUNTS[k];
      const volumeMult = 1 + budgetBoostPct / 100;
      const closeRateMult = Math.pow(volumeMult, -REALLOC_ELASTICITY); // ภาระงาน/คนเพิ่มขึ้น (คนตอบคงที่) ⇒ Close Rate ลดลงเล็กน้อย
      const netMult = volumeMult * closeRateMult;
      return {
        key: k,
        label: v.label.replace(/\s*\(.*\)/, ""),
        consultNow: c.consult,
        depositNow: c.deposit,
        consultNew: c.consult * netMult,
        depositNew: c.deposit * netMult,
        consultValueNow: c.consultValue,
        depositValueNow: c.depositValue,
        consultValueNew: c.consultValue * netMult,
        depositValueNew: c.depositValue * netMult,
      };
    });
  const budgetOnlyTotal = budgetOnlyRows.reduce(
    (acc, r) => ({
      consultNow: acc.consultNow + r.consultNow,
      depositNow: acc.depositNow + r.depositNow,
      consultNew: acc.consultNew + r.consultNew,
      depositNew: acc.depositNew + r.depositNew,
      consultValueNow: acc.consultValueNow + r.consultValueNow,
      depositValueNow: acc.depositValueNow + r.depositValueNow,
      consultValueNew: acc.consultValueNew + r.consultValueNew,
      depositValueNew: acc.depositValueNew + r.depositValueNew,
    }),
    { consultNow: 0, depositNow: 0, consultNew: 0, depositNew: 0, consultValueNow: 0, depositValueNow: 0, consultValueNew: 0, depositValueNew: 0 }
  );

  const staffOnlyRows = Object.entries(FUNNEL_DATA)
    .filter(([k]) => k !== "all")
    .map(([k, v]) => {
      const c = FUNNEL_CLOSE_COUNTS[k];
      const staffMult = 1 + staffBoostPct / 100;
      const closeRateMult = Math.pow(staffMult, REALLOC_ELASTICITY); // คนตอบเพิ่ม ภาระงาน/คนลดลง ⇒ Close Rate เพิ่มขึ้น, Inbox เท่าเดิม
      return {
        key: k,
        label: v.label.replace(/\s*\(.*\)/, ""),
        consultNow: c.consult,
        depositNow: c.deposit,
        consultNew: c.consult * closeRateMult,
        depositNew: c.deposit * closeRateMult,
        consultValueNow: c.consultValue,
        depositValueNow: c.depositValue,
        consultValueNew: c.consultValue * closeRateMult,
        depositValueNew: c.depositValue * closeRateMult,
      };
    });
  const staffOnlyTotal = staffOnlyRows.reduce(
    (acc, r) => ({
      consultNow: acc.consultNow + r.consultNow,
      depositNow: acc.depositNow + r.depositNow,
      consultNew: acc.consultNew + r.consultNew,
      depositNew: acc.depositNew + r.depositNew,
      consultValueNow: acc.consultValueNow + r.consultValueNow,
      depositValueNow: acc.depositValueNow + r.depositValueNow,
      consultValueNew: acc.consultValueNew + r.consultValueNew,
      depositValueNew: acc.depositValueNew + r.depositValueNew,
    }),
    { consultNow: 0, depositNow: 0, consultNew: 0, depositNew: 0, consultValueNow: 0, depositValueNow: 0, consultValueNew: 0, depositValueNew: 0 }
  );

  const currentAgentsMain = ONLINE_TEAM_MAIN; // 5 คนตอบทุกหัตถการหลักรวมกันในปัจจุบัน
  const currentMainInbox =
    FUNNEL_DATA.nose_open.inbox + FUNNEL_DATA.nose_semi.inbox + FUNNEL_DATA.brow_hairline.inbox + FUNNEL_DATA.breast_lipo.inbox;
  const currentWorkloadPerAgent = currentMainInbox / currentAgentsMain;

  const option2Groups = [
    {
      key: "groupA",
      label: "Nose Open + Semi Open",
      agents: 4,
      inbox: FUNNEL_DATA.nose_open.inbox + FUNNEL_DATA.nose_semi.inbox,
      consultNow: FUNNEL_CLOSE_COUNTS.nose_open.consult + FUNNEL_CLOSE_COUNTS.nose_semi.consult,
      depositNow: FUNNEL_CLOSE_COUNTS.nose_open.deposit + FUNNEL_CLOSE_COUNTS.nose_semi.deposit,
      consultValueNow: FUNNEL_CLOSE_COUNTS.nose_open.consultValue + FUNNEL_CLOSE_COUNTS.nose_semi.consultValue,
      depositValueNow: FUNNEL_CLOSE_COUNTS.nose_open.depositValue + FUNNEL_CLOSE_COUNTS.nose_semi.depositValue,
    },
    {
      key: "groupB",
      label: "ยกคิ้ว + เสริมหน้าอก",
      agents: 4,
      inbox: FUNNEL_DATA.brow_hairline.inbox + FUNNEL_DATA.breast_lipo.inbox,
      consultNow: FUNNEL_CLOSE_COUNTS.brow_hairline.consult + FUNNEL_CLOSE_COUNTS.breast_lipo.consult,
      depositNow: FUNNEL_CLOSE_COUNTS.brow_hairline.deposit + FUNNEL_CLOSE_COUNTS.breast_lipo.deposit,
      consultValueNow: FUNNEL_CLOSE_COUNTS.brow_hairline.consultValue + FUNNEL_CLOSE_COUNTS.breast_lipo.consultValue,
      depositValueNow: FUNNEL_CLOSE_COUNTS.brow_hairline.depositValue + FUNNEL_CLOSE_COUNTS.breast_lipo.depositValue,
    },
  ].map((g) => {
    const newWorkloadPerAgent = g.inbox / g.agents;
    const multiplier = Math.pow(currentWorkloadPerAgent / newWorkloadPerAgent, REALLOC_ELASTICITY);
    return {
      ...g,
      workloadPerAgent: newWorkloadPerAgent,
      multiplier,
      consultNew: g.consultNow * multiplier,
      depositNew: g.depositNow * multiplier,
      consultValueNew: g.consultValueNow * multiplier,
      depositValueNew: g.depositValueNow * multiplier,
    };
  });
  const option2Total = option2Groups.reduce(
    (acc, g) => ({
      consultNow: acc.consultNow + g.consultNow,
      depositNow: acc.depositNow + g.depositNow,
      consultNew: acc.consultNew + g.consultNew,
      depositNew: acc.depositNew + g.depositNew,
      consultValueNow: acc.consultValueNow + g.consultValueNow,
      depositValueNow: acc.depositValueNow + g.depositValueNow,
      consultValueNew: acc.consultValueNew + g.consultValueNew,
      depositValueNew: acc.depositValueNew + g.depositValueNew,
    }),
    { consultNow: 0, depositNow: 0, consultNew: 0, depositNew: 0, consultValueNow: 0, depositValueNow: 0, consultValueNew: 0, depositValueNew: 0 }
  );

  const loaTotal = LOA_JUNE.reduce(
    (acc, r) => ({ budgetUsed: acc.budgetUsed + r.budgetUsed, budgetLeft: acc.budgetLeft + r.budgetLeft, quotaLeft: acc.quotaLeft + r.quotaLeft }),
    { budgetUsed: 0, budgetLeft: 0, quotaLeft: 0 }
  );
  const loaWithTimesUsed = LOA_JUNE.map((r) => ({ ...r, timesUsed: r.broadcastReach / LOA_PEOPLE_PER_BROADCAST }));
  const loaByUsedDesc = [...loaWithTimesUsed].sort((a, b) => b.budgetUsed - a.budgetUsed);
  const loaByTimesUsedDesc = [...loaWithTimesUsed].sort((a, b) => b.timesUsed - a.timesUsed);
  const loaMostUsed = loaByUsedDesc[0];
  const loaLeastUsed = loaByUsedDesc[loaByUsedDesc.length - 1];
  const loaMostTimesUsed = loaByTimesUsedDesc[0];
  const loaMostLeft = [...LOA_JUNE].sort((a, b) => b.budgetLeft - a.budgetLeft)[0];
  const loaMostUrgent = [...LOA_JUNE].sort((a, b) => a.timesLeft - b.timesLeft)[0];
  const maxLoaBudget = Math.max(...LOA_JUNE.map((r) => r.budgetUsed + r.budgetLeft));

  // จำนวนครั้งการ Broadcast: ใช้จริง vs ทำได้ทั้งหมด (ใช้จริง + เหลือ) แยกตามหัตถการ
  const loaCountCompare = LOA_JUNE.map((r) => {
    const used = Math.round(r.broadcastReach / LOA_PEOPLE_PER_BROADCAST);
    const left = Math.round(r.timesLeft);
    return { key: r.key, label: r.label, used, left, total: used + left };
  }).sort((a, b) => b.total - a.total);
  const loaCountTotals = loaCountCompare.reduce(
    (acc, r) => ({ used: acc.used + r.used, left: acc.left + r.left, total: acc.total + r.total }),
    { used: 0, left: 0, total: 0 }
  );
  const maxLoaCountTotal = Math.max(...loaCountCompare.map((r) => r.total));

  // ---- เลือกช่องทาง LOA สำหรับการ์ด Broadcast บนหน้า Ads (แยกจาก loaTotal/LOA_JUNE ด้านบนซึ่งใช้เฉพาะสรุปมิถุนายนบนหน้าภาพรวม) ----
  // Filter ตามช่วงวันที่ที่เลือกจริง (loaRangeRows รวม dailyReach ข้ามเดือนได้) ไม่ใช่แค่ยอดรวมทั้งเดือนอีกต่อไป
  const loaChannelMeta = LOA_CHANNEL_META[loaChannel];
  const loaDefs = loaChannel === "aftercare" ? LOA_AFTERCARE_DEFS : LOA_NORMAL_DEFS;
  const loaSelSource = loaRangeRows(loaChannel, dateRange, loaDefs);
  // budgetLeft/quotaLeft/timesLeft อาจเป็น null ได้ถ้าช่วงที่เลือกสิ้นสุดในเดือนที่ไม่มีข้อมูล "งบตั้งไว้"
  // อ้างอิง (เช่น เลือกช่วงที่ยื่นออกไปก่อน มิ.ย./หลัง ส.ค.) — ตัดแถวเหล่านั้นออกจากการเรียง/รวมงบ แต่ยัง
  // นับ broadcastReach/budgetUsed ได้ตามปกติ (ไม่ต้องมี "งบตั้งไว้" ก็รู้ว่ายิงบรอดไปเท่าไรในช่วงนั้น)
  const loaSelTotal = loaSelSource
    ? loaSelSource.reduce(
        (acc, r) => ({
          budgetUsed: acc.budgetUsed + r.budgetUsed,
          budgetLeft: acc.budgetLeft + (r.budgetLeft ?? 0),
          quotaLeft: acc.quotaLeft + (r.quotaLeft ?? 0),
        }),
        { budgetUsed: 0, budgetLeft: 0, quotaLeft: 0 }
      )
    : null;
  const loaSelWithTimesUsed = loaSelSource ? loaSelSource.map((r) => ({ ...r, timesUsed: r.broadcastReach / loaChannelMeta.peoplePerBroadcast })) : [];
  const loaSelByUsedDesc = [...loaSelWithTimesUsed].sort((a, b) => b.budgetUsed - a.budgetUsed);
  const loaSelMostUsed = loaSelByUsedDesc[0] || null;
  const loaSelRowsWithBudgetLeft = loaSelSource ? loaSelSource.filter((r) => r.budgetLeft != null) : [];
  const loaSelRowsWithTimesLeft = loaSelSource ? loaSelSource.filter((r) => r.timesLeft != null) : [];
  const loaSelMostLeft = loaSelRowsWithBudgetLeft.length ? [...loaSelRowsWithBudgetLeft].sort((a, b) => b.budgetLeft - a.budgetLeft)[0] : null;
  const loaSelMostUrgent = loaSelRowsWithTimesLeft.length ? [...loaSelRowsWithTimesLeft].sort((a, b) => a.timesLeft - b.timesLeft)[0] : null;
  const maxLoaSelBudget = loaSelSource ? Math.max(...loaSelSource.map((r) => r.budgetUsed + (r.budgetLeft ?? 0))) : 0;
  const loaSelCountCompare = loaSelSource
    ? loaSelSource
        .map((r) => {
          const used = Math.round(r.broadcastReach / loaChannelMeta.peoplePerBroadcast);
          const left = r.timesLeft != null ? Math.round(r.timesLeft) : 0;
          return { key: r.key, label: r.label, used, left, total: used + left };
        })
        .sort((a, b) => b.total - a.total)
    : [];
  const loaSelCountTotals = loaSelCountCompare.reduce(
    (acc, r) => ({ used: acc.used + r.used, left: acc.left + r.left, total: acc.total + r.total }),
    { used: 0, left: 0, total: 0 }
  );
  const maxLoaSelCountTotal = Math.max(0, ...loaSelCountCompare.map((r) => r.total));
  const loaSelMostUsedPctRow = [...loaSelCountCompare].filter((r) => r.total > 0).sort((a, b) => b.used / b.total - a.used / a.total)[0];
  const loaSelSheetNote =
    loaChannel === "aftercare"
      ? `ไฟล์ "S45 - ยอดบลอดแคส LINE OA After Care.xlsx" `
      : `ไฟล์ "S45 - ยอดบลอดแคส LINE OA After Care.xlsx" (มิ.ย. 2569) และ Google Sheet "S45 - สรุปค่าใช้จ่ายให้บัญชี" (ก.ค. 2569 เป็นต้นไป) `;
  // ช่วงเดือนที่ช่องทางนี้มีข้อมูลรายวันจริงให้ Filter ได้ (ใช้ในข้อความ "ไม่มีข้อมูล...")
  const loaAvailableRangeLabel = loaChannel === "aftercare" ? "ก.ค. 2569 เป็นต้นไป" : "มิ.ย. 2569 เป็นต้นไป";

  const channelMixSorted = [...CHANNEL_MIX].sort((a, b) => b.budget - a.budget);
  const maxChannelBudget = Math.max(...CHANNEL_MIX.map((c) => c.budget));
  const tiktokChannel = CHANNEL_MIX.find((c) => c.key === "tiktok");
  // ยอดขายรวมทุกช่องทาง / Facebook / ROAS ในสรุปภาพรวม — ใช้ตัวเลขเดียวกับ Metric Cards ด้านบน (ตามช่วงวันที่ที่เลือกจริง, มุมมอง "รวมทุกหัตถการ")
  const summaryAllSales = execSales;
  const summaryFbSales = execFbSales;
  const summaryFbSpend = execFbSpend;
  const summaryRoas = execRoas;
  // เคสมัดจำในช่วงที่เลือก — เดือนมิ.ย.เต็มเดือนใช้ DOCTOR_TOTAL ทางการ ช่วงอื่นรวมจาก RAW_TX จริง (activeDoctors)
  const summaryDoctorCases = isJunFull ? DOCTOR_TOTAL.cases : (activeDoctors || []).reduce((s, d) => s + d.cases, 0);
  // Funnel (Inbox/OR) มีข้อมูลรายวันแค่ มิ.ย. (FUNNEL_DATA) ก.ค. (FUNNEL_DATA_JUL) และ ส.ค. ถึงวันที่ 23
  // (FUNNEL_DATA_AUG) — รวมเฉพาะวันที่ทับซ้อนกับ 3 เดือนนี้
  const hasJuneOverlap = dateRange.start <= "2026-06-30" && dateRange.end >= "2026-06-01";
  const hasJulyOverlap = dateRange.start <= "2026-07-31" && dateRange.end >= "2026-07-01";
  const hasAugustOverlap = dateRange.start <= "2026-08-31" && dateRange.end >= "2026-08-01";
  const hasFunnelCoverage = hasJuneOverlap || hasJulyOverlap || hasAugustOverlap;
  const summaryInboxTotal =
    sumDailyOverlap(dateRange, "2026-06-01", "2026-06-30", FUNNEL_DATA.all.dailyInbox) +
    sumDailyOverlap(dateRange, "2026-07-01", "2026-07-31", FUNNEL_DATA_JUL.all.dailyInbox) +
    sumDailyOverlap(dateRange, "2026-08-01", "2026-08-31", FUNNEL_DATA_AUG.all.dailyInbox);
  // OR มีข้อมูลรายวันครอบคลุม มิ.ย.-ส.ค. เท่านั้น — ถ้าช่วงที่เลือกไม่ทับซ้อนเดือนใดเลย ให้ถือว่า "ไม่มีข้อมูล" ไม่ใช่ 0
  const summaryOrTotal = hasFunnelCoverage
    ? sumDailyOverlap(dateRange, "2026-06-01", "2026-06-30", FUNNEL_DATA.all.dailyOr) +
      sumDailyOverlap(dateRange, "2026-07-01", "2026-07-31", FUNNEL_DATA_JUL.all.dailyOr) +
      sumDailyOverlap(dateRange, "2026-08-01", "2026-08-31", FUNNEL_DATA_AUG.all.dailyOr)
    : null;
  // ถ้าช่วงที่เลือกยื่นออกไปนอก มิ.ย.-ส.ค. (หรือเกินวันที่ 23 ส.ค.) ตัวเลข OR ด้านบน (ถ้ามี) จะไม่รวมส่วนที่ยื่นออกไปนั้น
  const summaryOrMissingRange = dateRange.start < "2026-06-01" || dateRange.end > "2026-08-23";
  // LOA (LINE OA Broadcast) สรุปช่องทาง "ปกติ" ตามช่วงวันที่ที่เลือกจริง (เหมือนการ์ดบนหน้า Ads)
  const loaSummarySource = loaRangeRows("normal", dateRange, LOA_NORMAL_DEFS);
  const loaSummaryTotal = loaSummarySource
    ? loaSummarySource.reduce((acc, r) => ({ budgetUsed: acc.budgetUsed + r.budgetUsed, budgetLeft: acc.budgetLeft + (r.budgetLeft ?? 0) }), { budgetUsed: 0, budgetLeft: 0 })
    : null;
  const loaSummaryRowsWithTimesLeft = loaSummarySource ? loaSummarySource.filter((r) => r.timesLeft != null) : [];
  const loaSummaryMostUrgent = loaSummaryRowsWithTimesLeft.length ? [...loaSummaryRowsWithTimesLeft].sort((a, b) => a.timesLeft - b.timesLeft)[0] : null;

  const targetTone = (pct) => {
    if (pct >= 0.7) return { bar: "bg-emerald-500", text: "text-emerald-600" };
    if (pct >= 0.3) return { bar: "bg-amber-400", text: "text-amber-600" };
    return { bar: "bg-rose-400", text: "text-rose-500" };
  };

  const insight = useMemo(() => {
    if (procFilter === "all") {
      const best = targetRanking[0];
      const worst = targetRanking[targetRanking.length - 1];
      const interNote = isJunFull ? "" : " (ไม่รวม Inter เนื่องจากไม่มีข้อมูลยอดขายรายวันแยกหัตถการนี้ในไฟล์ธุรกรรม)";
      const rankNote =
        best && worst
          ? ` หัตถการที่ทำเป้าหมายยอดขายได้ดีที่สุดคือ ${best.label} (${(best.targetPct * 100).toFixed(0)}% ของเป้า) ส่วน ${worst.label} ยังทำได้เพียง ${(worst.targetPct * 100).toFixed(0)}%`
          : "";
      return `${rangeLabel} ยอดขายรวมทุกช่องทาง ฿${fmtTHB(execSales)} เทียบค่าโฆษณา Facebook ฿${fmtTHB(execFbSpend)} โดย Facebook ทำยอดขายได้ ฿${fmtTHB(execFbSales)} (Ads/ยอดขาย Facebook ${(execRatio * 100).toFixed(1)}%, ROAS Facebook ${execRoas.toFixed(1)}x)${rankNote}${interNote}`;
    }
    if (procFilter === "inter" && !isJunFull) {
      return `หัตถการ Inter ไม่มีข้อมูลยอดขายรายวันแยกในไฟล์ธุรกรรม จึงดูได้เฉพาะช่วงเดือนมิถุนายน 2026 เต็มเดือนเท่านั้น — เลือก "เดือนที่แล้ว (มิ.ย.)" จากปุ่มเลือกวันที่ด้านบน`;
    }
    if (isJunFull) {
      const c = CATEGORIES[procFilter];
      return `${c.label} ในเดือนมิถุนายน ยอดขายรวมทุกช่องทาง ฿${fmtTHB(c.sales)} เทียบค่าโฆษณา Facebook ฿${fmtTHB(c.spend)} โดย Facebook ทำยอดขายได้ ฿${fmtTHB(execFbSales)} (ROAS Facebook ${execRoas.toFixed(1)}x) คิดเป็น ${(c.targetPct * 100).toFixed(0)}% ของเป้าหมายยอดขาย ฿${fmtTHB(c.target)}`;
    }
    const m = computeExecMetricsForRange(dateRange, procFilter);
    const target = computeProratedTarget(dateRange, CATEGORIES[procFilter].target);
    const targetPct = target > 0 ? m.sales / target : 0;
    return `${CATEGORIES[procFilter].label} ช่วง ${rangeLabel} ยอดขายรวมทุกช่องทาง ฿${fmtTHB(m.sales)} เทียบค่าโฆษณา Facebook ฿${fmtTHB(m.fbSpend)} โดย Facebook ทำยอดขายได้ ฿${fmtTHB(m.fbSales)} (ROAS Facebook ${m.roas.toFixed(1)}x) คิดเป็นประมาณ ${(targetPct * 100).toFixed(0)}% ของเป้าหมายยอดขายช่วงนี้ (≈฿${fmtTHB(target)})`;
  }, [procFilter, isJunFull, dateRange, rangeLabel, targetRanking, execSales, execFbSales, execFbSpend, execRatio, execRoas]);

  return (
    <div className={dark ? "dark" : ""}>
      <div className="min-h-screen bg-slate-50 flex relative">
        <img
          src={S45_LOGO}
          alt=""
          aria-hidden="true"
          className="fixed top-1/2 left-1/2 sm:left-[calc(50%+8rem)] -translate-x-1/2 -translate-y-1/2 w-[600px] sm:w-[900px] opacity-[0.05] pointer-events-none select-none z-0"
        />
        <Sidebar activePage={activePage} setActivePage={setActivePage} mobileOpen={mobileNavOpen} setMobileOpen={setMobileNavOpen} />
        <div className="flex-1 min-w-0 p-4 sm:p-8 relative overflow-hidden">
      <div className="max-w-5xl mx-auto relative z-10">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileNavOpen(true)}
              className="sm:hidden shrink-0 text-slate-500 border border-slate-200 rounded-lg p-2 bg-white"
            >
              <Menu size={18} />
            </button>
            <div>
              <p className="text-xs font-semibold text-slate-400 tracking-wide uppercase mb-1">S45 Clinic</p>
              <h1 className="text-2xl font-bold text-slate-800">Ads Performance Dashboard</h1>
              <p className="text-sm text-slate-400 mt-0.5">ข้อมูลจริง — เลือกช่วงวันที่ได้อิสระ</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle dark={dark} onToggle={() => setDark((d) => !d)} />
            <DateRangePicker
              value={dateRange}
              compareEnabled={compareEnabled}
              compareValue={compareRange}
              presets={DATE_PRESETS}
              fmtDate={fmtDateTh}
              onApply={({ range, compareEnabled: ce, compareRange: cr }) => {
                setDateRange(range);
                setCompareEnabled(ce);
                setCompareRange(cr);
              }}
            />
          </div>
        </div>

        {/* ---- All-channel totals + ROAS breakdown (แถว "รวม" สีน้ำตาลในชีตต้นฉบับ) ---- */}
{activePage === "sales" && (
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm mb-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <TrendingUp size={16} />
              </div>
              <h2 className="text-sm font-semibold text-slate-700">ยอดขายรวมทุกช่องทาง — {rangeLabel}</h2>
            </div>
            <Select icon={Stethoscope} value={procFilter} onChange={setProcFilter} options={procOptions} />
          </div>
          <p className="text-xs text-slate-400 mb-4 ml-10">
            {isJunFull
              ? (procFilter === "all" ? 'อ้างอิงแถว "รวม" ท้ายชีต Budget Allocate ทุกหัตถการ' : CATEGORIES[procFilter].label) + ` · ยอดขายทุกช่องทาง · เทียบค่าโฆษณา Facebook ฿${fmtTHB(totals.spend)}`
              : (procFilter === "all" ? "รวมทุกหัตถการ" : CATEGORIES[procFilter].label + " (ค่าโฆษณาประมาณการตามสัดส่วนของหัตถการนี้)") + ` · ยอดขายทุกช่องทาง · เทียบค่าโฆษณา Facebook ฿${fmtTHB(rangeSpend)}`}
          </p>

          <div className="grid grid-cols-3 gap-3">
            <div className="bg-amber-50 rounded-xl p-3 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[11px] text-amber-600 font-medium mb-0.5">ยอดมัดจำรวม</p>
                <p className="text-lg font-bold text-amber-700 truncate">
                  {isJunFull ? `฿${fmtTHB(totals.deposit)}` : rangeTotals.deposit != null ? `฿${fmtTHB(rangeTotals.deposit)}` : "ไม่มีข้อมูล"}
                </p>
                <p className="text-[11px] text-amber-500 mt-1">ROAS ต่อยอดมัดจำ</p>
              </div>
              <p className="text-2xl font-bold text-amber-700 shrink-0">
                {isJunFull
                  ? roasDeposit.toFixed(2)
                  : rangeTotals.deposit != null && rangeSpend > 0
                  ? (rangeTotals.deposit / rangeSpend).toFixed(2)
                  : "—"}
                x
              </p>
            </div>
            <div className="bg-sky-50 rounded-xl p-3 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[11px] text-sky-600 font-medium mb-0.5">ยอด Online Price</p>
                <p className="text-lg font-bold text-sky-700 truncate">
                  {isJunFull ? `฿${fmtTHB(totals.online)}` : rangeTotals.online != null ? `฿${fmtTHB(rangeTotals.online)}` : "ไม่มีข้อมูล"}
                </p>
                <p className="text-[11px] text-sky-500 mt-1">ROAS ต่อ Online Price</p>
              </div>
              <p className="text-2xl font-bold text-sky-700 shrink-0">
                {isJunFull
                  ? roasOnline.toFixed(2)
                  : rangeTotals.online != null && rangeSpend > 0
                  ? (rangeTotals.online / rangeSpend).toFixed(2)
                  : "—"}
                x
              </p>
            </div>
            <div className="bg-emerald-50 rounded-xl p-3 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[11px] text-emerald-600 font-medium mb-0.5">ยอดขายรวม (Total Price)</p>
                <p className="text-lg font-bold text-emerald-700 truncate">
                  {isJunFull ? `฿${fmtTHB(totals.sales)}` : rangeTotals.sales != null ? `฿${fmtTHB(rangeTotals.sales)}` : "ไม่มีข้อมูล"}
                </p>
                <p className="text-[11px] text-emerald-500 mt-1">ROAS ต่อยอดขายรวม</p>
              </div>
              <p className="text-2xl font-bold text-emerald-700 shrink-0">
                {isJunFull
                  ? roasSales.toFixed(2)
                  : rangeTotals.sales != null && rangeSpend > 0
                  ? (rangeTotals.sales / rangeSpend).toFixed(2)
                  : "—"}
                x
              </p>
            </div>
          </div>
          {!isJunFull && (
            <div className="mt-4 pt-4 border-t border-slate-100 flex items-start gap-2 text-xs text-slate-500">
              <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />
              <p>
                กล่องนี้และอีกหลายส่วนด้านล่าง (Facebook breakdown, ช่องทางอื่น, สรุปหมอ, ระยะเวลาปิด OR) คำนวณสดตามช่วงวันที่ที่เลือกแล้ว แต่บางส่วนของ
                Dashboard (Sales Funnel รายวัน, Inbox เป้าหมายรายวัน, LINE OA Broadcast, Bad Lead) ยังคงแสดงเฉพาะข้อมูลเดือนมิถุนายน
                2026 เท่านั้น เนื่องจากเป็นไฟล์ที่มีข้อมูลรายวันของเดือนนั้นเดือนเดียว
                {txInRange.length === 0 && " (ไม่พบข้อมูลธุรกรรมในช่วงวันที่นี้ — ไฟล์ธุรกรรมครอบคลุม ม.ค.–25 ส.ค. 2026 เท่านั้น)"}
              </p>
            </div>
          )}
        </div>
)}

        {/* ---- Facebook-only sales breakdown ---- */}
{activePage === "sales" && (
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm mb-6">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Megaphone size={16} />
            </div>
            <h2 className="text-sm font-semibold text-slate-700">ยอดขายจาก Facebook แยกตามหัตถการ</h2>
          </div>
          <p className="text-xs text-slate-400 mb-4 ml-10">
            เฉพาะ Channel = Facebook · {rangeLabel} ·{" "}
            {isJunFull
              ? procFilter === "all"
                ? `${FB_TOTAL.cases} เคส`
                : `${CATEGORIES[procFilter].label} · ${FB_BY_KEY[procFilter]?.cases ?? 0} เคส`
              : `${activeFbTotal.cases} เคส`}
          </p>

          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="bg-emerald-50 rounded-xl p-3 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[11px] text-emerald-600 font-medium mb-0.5">ยอดขายรวม</p>
                <p className="text-lg font-bold text-emerald-700 truncate">฿{fmtTHB(isJunFull ? fbSummary.total : activeFbTotal.total)}</p>
                <MoMCaption delta={fbTotalMoM} />
              </div>
              <MoMBadgeLarge delta={fbTotalMoM} />
            </div>
            <div className="bg-sky-50 rounded-xl p-3 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[11px] text-sky-600 font-medium mb-0.5">ยอดขายออนไลน์</p>
                <p className="text-lg font-bold text-sky-700 truncate">฿{fmtTHB(isJunFull ? fbSummary.online : activeFbTotal.online)}</p>
                <MoMCaption delta={fbOnlineMoM} />
              </div>
              <MoMBadgeLarge delta={fbOnlineMoM} />
            </div>
            <div className="bg-amber-50 rounded-xl p-3 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[11px] text-amber-600 font-medium mb-0.5">ยอดมัดจำ</p>
                <p className="text-lg font-bold text-amber-700 truncate">฿{fmtTHB(isJunFull ? fbSummary.deposit : activeFbTotal.deposit)}</p>
                <MoMCaption delta={fbDepositMoM} />
              </div>
              <MoMBadgeLarge delta={fbDepositMoM} />
            </div>
          </div>

          {activeFbSurgery.length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">ไม่มีข้อมูลธุรกรรมสำหรับเดือนนี้ (ไฟล์ธุรกรรมครอบคลุมเฉพาะ ม.ค.–25 ส.ค. 2026)</p>
          ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] text-slate-400 border-b border-slate-100">
                  <th className="pb-2 font-medium">หัตถการ</th>
                  <th className="pb-2 font-medium text-right">เคส</th>
                  <th className="pb-2 font-medium text-right">ยอดขายรวม</th>
                  <th className="pb-2 font-medium text-right">ยอดขายออนไลน์</th>
                  <th className="pb-2 font-medium text-right">ยอดมัดจำ</th>
                </tr>
              </thead>
              <tbody>
                {activeFbSurgery.map((r) => {
                  const isSelected = procFilter === "all" || procFilter === r.key;
                  return (
                    <tr
                      key={r.label}
                      className={`border-b border-slate-50 last:border-0 ${!isSelected ? "opacity-35" : ""} ${
                        procFilter === r.key ? "bg-blue-50/60" : ""
                      }`}
                    >
                      <td className="py-2 text-slate-600">{r.label}</td>
                      <td className="py-2 text-right text-slate-500">{r.cases}</td>
                      <td className="py-2 text-right font-semibold text-slate-700">฿{fmtTHB(r.total)}</td>
                      <td className="py-2 text-right text-slate-500">฿{fmtTHB(r.online)}</td>
                      <td className="py-2 text-right text-slate-500">฿{fmtTHB(r.deposit)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {procFilter !== "all" && !activeFbByKey[procFilter] && (
              <p className="text-xs text-amber-600 mt-3">
                ไม่มีข้อมูลยอดขาย Facebook แยกตามหัตถการนี้ในไฟล์ธุรกรรม (เช่น กลุ่ม Inter ไม่ได้ระบุประเภทหัตถการไว้)
              </p>
            )}

            {/* ต้นทุนต่อการซื้อ (CPA) แยกตามหัตถการ — เทียบเป็น % ห่างจากค่าเฉลี่ยของทุกหัตถการที่แสดง ถ้าห่าง
                เกิน 10% (แพงกว่า/ถูกกว่าค่าเฉลี่ย) ใช้สีบอกแทนคำว่า "เพิ่มขึ้น/ลดลง" — แพงกว่าเฉลี่ย = แดง (ต้นทุน
                สูงกว่าปกติ ไม่ดี), ถูกกว่าเฉลี่ย = เขียว (ต้นทุนต่ำกว่าปกติ ดี), ใกล้เคียงเฉลี่ย (±10%) = เทาปกติ */}
            <div className="mt-4 pt-3 border-t border-slate-100">
              <p className="text-[11px] text-slate-400 font-medium mb-2 flex items-center gap-1.5">
                <Wallet size={12} className="text-slate-400" />
                ต้นทุนต่อการซื้อ (ค่าโฆษณา Facebook ÷ จำนวนเคส) — ใช้เงินเท่าไหร่เพื่อให้ได้ 1 ยอดซื้อ · เทียบ % จากค่าเฉลี่ย
              </p>
              {(() => {
                const cpaRows = activeFbSurgery.map((r) => ({ ...r, cpa: r.spend != null && r.cases > 0 ? r.spend / r.cases : null }));
                const validCpas = cpaRows.filter((r) => r.cpa != null).map((r) => r.cpa);
                const avgCpa = validCpas.length > 0 ? validCpas.reduce((s, v) => s + v, 0) / validCpas.length : null;
                return (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {cpaRows.map((r) => {
                      const isSelected = procFilter === "all" || procFilter === r.key;
                      const pctFromAvg = r.cpa != null && avgCpa > 0 ? ((r.cpa - avgCpa) / avgCpa) * 100 : null;
                      const isHigh = pctFromAvg != null && pctFromAvg > 10;
                      const isLow = pctFromAvg != null && pctFromAvg < -10;
                      const boxTone = isHigh ? "bg-rose-50 border-rose-200" : isLow ? "bg-emerald-50 border-emerald-200" : "bg-slate-50 border-slate-200";
                      const labelTone = isHigh ? "text-rose-500" : isLow ? "text-emerald-500" : "text-slate-400";
                      const valueTone = isHigh ? "text-rose-700" : isLow ? "text-emerald-700" : "text-slate-700";
                      const pctTone = isHigh ? "text-rose-600" : isLow ? "text-emerald-600" : "text-slate-400";
                      return (
                        <div key={r.key} className={`rounded-xl border px-3 py-2.5 ${boxTone} ${!isSelected ? "opacity-40" : ""}`}>
                          <p className={`text-[11px] font-medium ${labelTone}`}>{r.label}</p>
                          <p className={`text-base font-bold ${valueTone}`}>{r.cpa != null ? `฿${fmtTHB(r.cpa)}` : "ไม่มีข้อมูล"}</p>
                          {pctFromAvg != null && (
                            <p className={`text-[11px] font-semibold mt-0.5 ${pctTone}`}>
                              {pctFromAvg > 0 ? "+" : ""}
                              {pctFromAvg.toFixed(0)}% จากค่าเฉลี่ย
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
          )}
        </div>
)}

        {/* ---- Inter แยกตามหมอ + หัตถการ (เคสจริง) ---- */}
{activePage === "sales" && (
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm mt-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Users size={16} />
              </div>
              <h2 className="text-sm font-semibold text-slate-700">Inter แยกตามหมอ + หัตถการ (เคสจริง)</h2>
            </div>
            <div className="flex items-center gap-2">
              <Select icon={Stethoscope} value={interProcFilter} onChange={setInterProcFilter} options={INTER_PROC_OPTIONS} />
              <Select icon={UserCircle2} value={interDoctorFilter} onChange={setInterDoctorFilter} options={INTER_DOCTOR_OPTIONS} />
            </div>
          </div>
          <p className="text-xs text-slate-400 mb-4 ml-10">
            จากไฟล์ Inter Sale เดือน{interMonthKey === "jul" ? "กรกฎาคม (ถึง 29/7) 2569" : interMonthKey === "jun" ? "มิถุนายน 2569" : "— ไม่มีข้อมูลสำหรับช่วงวันที่นี้"}{" "}
            · {INTER_DOCTOR_LABELS[interDoctorFilter]} · รวม {interDoctorTotal.cases} เคส
          </p>

          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="bg-indigo-50 rounded-xl p-3 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[11px] text-indigo-600 font-medium mb-0.5">จำนวนเคส</p>
                <p className="text-lg font-bold text-indigo-700 truncate">{interDoctorTotal.cases} เคส</p>
                <MoMCaption delta={interCasesMoM} />
              </div>
              <MoMBadgeLarge delta={interCasesMoM} />
            </div>
            <div className="bg-amber-50 rounded-xl p-3 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[11px] text-amber-600 font-medium mb-0.5">ยอดมัดจำ (Online + Medical check up)</p>
                <p className="text-lg font-bold text-amber-700 truncate">฿{fmtTHB(interDoctorTotal.deposit)}</p>
                <MoMCaption delta={interDepositMoM} />
              </div>
              <MoMBadgeLarge delta={interDepositMoM} />
            </div>
            <div className="bg-emerald-50 rounded-xl p-3 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[11px] text-emerald-600 font-medium mb-0.5">ยอด OR (Total)</p>
                <p className="text-lg font-bold text-emerald-700 truncate">฿{fmtTHB(interDoctorTotal.total)}</p>
                <MoMCaption delta={interTotalMoM} />
              </div>
              <MoMBadgeLarge delta={interTotalMoM} />
            </div>
          </div>

          {interDoctorRows.length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">
              {interMonthKey == null
                ? "ไม่มีข้อมูล Inter สำหรับช่วงวันที่ที่เลือก (มีข้อมูลเฉพาะ มิ.ย.–ก.ค. 2569) — เปลี่ยนช่วงวันที่ด้านบนเพื่อดูข้อมูล"
                : "ไม่มีเคสของหมอคนนี้ (ตามหัตถการที่เลือก) ในเดือนนี้"}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] text-slate-400 border-b border-slate-100">
                    <th className="pb-2 font-medium">หัตถการ</th>
                    <th className="pb-2 font-medium text-right">เคส</th>
                    <th className="pb-2 font-medium text-right">ยอดมัดจำ</th>
                    <th className="pb-2 font-medium text-right">ยอด OR (Total)</th>
                  </tr>
                </thead>
                <tbody>
                  {interDoctorRows.map((r) => (
                    <tr key={r.key} className="border-b border-slate-50 last:border-0">
                      <td className="py-2 text-slate-600">{r.label}</td>
                      <td className="py-2 text-right text-slate-500">{r.cases}</td>
                      <td className="py-2 text-right text-slate-600">฿{fmtTHB(r.deposit)}</td>
                      <td className="py-2 text-right font-semibold text-slate-700">฿{fmtTHB(r.total)}</td>
                    </tr>
                  ))}
                  <tr className="border-t border-slate-200">
                    <td className="py-2 font-semibold text-slate-700">รวม</td>
                    <td className="py-2 text-right font-semibold text-slate-700">{interDoctorTotal.cases}</td>
                    <td className="py-2 text-right font-semibold text-slate-700">฿{fmtTHB(interDoctorTotal.deposit)}</td>
                    <td className="py-2 text-right font-semibold text-slate-700">฿{fmtTHB(interDoctorTotal.total)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-slate-100 flex items-start gap-2 text-xs text-slate-500">
            <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />
            <p>
              ยอดมัดจำ = Online Price + Medical check up Etc. (ไม่รวม Top up) · ยอด OR = คอลัมน์ Total ในไฟล์ต้นฉบับ · เลือก "ทุกคน (รวม)" เพื่อดูภาพรวมทุกหมอ
              หรือเลือกหมอรายคนเพื่อดูเฉพาะเคสของหมอคนนั้น (ชื่อหมออ้างอิงตามที่ระบุในไฟล์ต้นฉบับ)
            </p>
          </div>
        </div>
)}


        {/* ---- NEW: ยอดขายจากช่องทางอื่น แยกตามหัตถการ (LINE / WhatsApp / Sale หรือ BA) ---- */}
{activePage === "sales" && (
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm mb-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-green-50 text-green-600 flex items-center justify-center">
                <MessageCircle size={16} />
              </div>
              <h2 className="text-sm font-semibold text-slate-700">ยอดขายจากช่องทางอื่น แยกตามหัตถการ</h2>
            </div>
            <Select icon={Store} value={otherChannelFilter} onChange={setOtherChannelFilter} options={otherChannelOptions} />
          </div>
          <p className="text-xs text-slate-400 mb-4 ml-10">
            เฉพาะ Channel = {OTHER_CHANNEL_META[otherChannelFilter].label} · {rangeLabel} · {activeOtherChannelTotal.cases} เคส
          </p>

          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="bg-emerald-50 rounded-xl p-3 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[11px] text-emerald-600 font-medium mb-0.5">ยอดขายรวม</p>
                <p className="text-lg font-bold text-emerald-700 truncate">฿{fmtTHB(activeOtherChannelTotal.total)}</p>
                <MoMCaption delta={otherTotalMoM} />
              </div>
              <MoMBadgeLarge delta={otherTotalMoM} />
            </div>
            <div className="bg-sky-50 rounded-xl p-3 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[11px] text-sky-600 font-medium mb-0.5">ยอดขายออนไลน์</p>
                <p className="text-lg font-bold text-sky-700 truncate">฿{fmtTHB(activeOtherChannelTotal.online)}</p>
                <MoMCaption delta={otherOnlineMoM} />
              </div>
              <MoMBadgeLarge delta={otherOnlineMoM} />
            </div>
            <div className="bg-amber-50 rounded-xl p-3 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[11px] text-amber-600 font-medium mb-0.5">ยอดมัดจำ</p>
                <p className="text-lg font-bold text-amber-700 truncate">฿{fmtTHB(activeOtherChannelTotal.deposit)}</p>
                <MoMCaption delta={otherDepositMoM} />
              </div>
              <MoMBadgeLarge delta={otherDepositMoM} />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] text-slate-400 border-b border-slate-100">
                  <th className="pb-2 font-medium">หัตถการ</th>
                  <th className="pb-2 font-medium text-right">เคส</th>
                  <th className="pb-2 font-medium text-right">ยอดขายรวม</th>
                  <th className="pb-2 font-medium text-right">ยอดขายออนไลน์</th>
                  <th className="pb-2 font-medium text-right">ยอดมัดจำ</th>
                </tr>
              </thead>
              <tbody>
                {activeOtherChannelRows.map((r) => (
                  <tr key={r.key} className="border-b border-slate-50 last:border-0">
                    <td className="py-2 text-slate-600">{r.label}</td>
                    <td className="py-2 text-right text-slate-500">{r.cases}</td>
                    <td className="py-2 text-right font-semibold text-slate-700">฿{fmtTHB(r.total)}</td>
                    <td className="py-2 text-right text-slate-500">฿{fmtTHB(r.online)}</td>
                    <td className="py-2 text-right text-slate-500">฿{fmtTHB(r.deposit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {activeOtherChannelTotal.cases === 0 && (
              <p className="text-xs text-amber-600 mt-3">
                {`ไม่พบเคสจากช่องทาง ${OTHER_CHANNEL_META[otherChannelFilter].label} ใน${rangeLabel} จากไฟล์ธุรกรรม`}
              </p>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500">
            "ช่องทางอื่น (Sale หรือ BA)" รวมข้อมูลจาก Channel = "Sale หาเอง" และ "ช่องทางส่วนตัว BA" เข้าด้วยกัน (คนไข้ที่มาจากทีมขายหรือ BA
            หาเอง ไม่ได้มาจากโฆษณา) · ข้อมูล Line/WhatsApp/Sale-BA ทั้งหมดมาจากไฟล์ธุรกรรมจริง (Data_S45_Clinic) กรองตามคอลัมน์ Channel
          </div>
        </div>
)}

        {/* Metric cards */}
{activePage === "overview" && (
        <div className="mb-6">
          {compareEnabled && (
            <p className="text-xs text-slate-400 mb-2 flex items-center gap-1.5">
              <ArrowUpDown size={12} /> เทียบกับ {compareRangeLabel}
            </p>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <MetricCard
            icon={TrendingUp}
            label="ยอดขายรวม (ทุกช่องทาง)"
            value={`฿${fmtTHB(execSales)}`}
            sub={
              isJunFull
                ? procFilter === "all"
                  ? 'อ้างอิงแถว "รวม" ในชีตต้นฉบับ'
                  : "Total Price ของหัตถการนี้"
                : rangeLabel
            }
            tone="indigo"
            delta={salesDelta}
          />
          <MetricCard
            icon={Megaphone}
            label="ยอดขายรวม (Facebook)"
            value={`฿${fmtTHB(execFbSales)}`}
            sub="รวมจาก Total Price เท่านั้น"
            tone="green"
            delta={fbSalesDelta}
          />
          <MetricCard
            icon={Wallet}
            label="ค่าโฆษณาที่ใช้ไป (Facebook)"
            value={`฿${fmtTHB(execFbSpend)}`}
            sub={isJunFull ? "จากคอลัมน์ Spend ในชีต Budget Allocate" : "ประมาณการตามสัดส่วนวันที่เลือก"}
            tone="blue"
            delta={fbSpendDelta}
            goodDirection="down"
          />
          <MetricCard
            icon={Percent}
            label="Ads / ยอดขาย (Facebook)"
            value={`${(execRatio * 100).toFixed(1)}%`}
            sub={execOverThreshold ? "สูงกว่าเกณฑ์ 10%" : "อยู่ในเกณฑ์ปกติ"}
            tone={execOverThreshold ? "red" : "slate"}
            delta={ratioDelta}
            goodDirection="down"
          />
          <MetricCard icon={Target} label="ROAS (Facebook)" value={`${execRoas.toFixed(1)}x`} tone="slate" delta={roasDeltaCompare} />
          </div>
        </div>
)}

        {/* Chart */}
{activePage === "overview" && (
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm mb-6">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">
            ยอดขาย เทียบ ค่าโฆษณา ต่อหัตถการ — {rangeLabel} (ทุกช่องทาง{isJunFull ? "" : " · ไม่รวม Inter"})
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#d9f2ee" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} interval={0} angle={-15} textAnchor="end" height={60} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`} />
              <Tooltip formatter={(v) => `฿${fmtTHB(v)}`} contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 13 }} />
              <Legend formatter={(v) => (v === "sales" ? "ยอดขาย" : "ค่าโฆษณา")} wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="sales" radius={[6, 6, 0, 0]} maxBarSize={44}>
                {chartData.map((d) => <Cell key={d.key} fill="#0d9488" opacity={procFilter === "all" || procFilter === d.key ? 1 : 0.25} />)}
              </Bar>
              <Bar dataKey="spend" radius={[6, 6, 0, 0]} maxBarSize={44}>
                {chartData.map((d) => <Cell key={d.key} fill="#99f6e4" opacity={procFilter === "all" || procFilter === d.key ? 1 : 0.25} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
)}

{activePage === "overview" && (
        <div className="grid sm:grid-cols-2 gap-6">
          {/* Target achievement ranking */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Trophy size={16} className="text-amber-500" />
              <h2 className="text-sm font-semibold text-slate-700">% ยอดขาย เทียบเป้าหมาย</h2>
            </div>
            <div className="space-y-3">
              {targetRanking.map((c) => {
                const tone = targetTone(c.targetPct);
                return (
                  <div key={c.key} className="flex items-center gap-3">
                    <div className="w-28 shrink-0"><p className="text-xs font-medium text-slate-600 truncate">{c.label}</p></div>
                    <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${Math.max(c.targetPct * 100, 1.5)}%` }} />
                    </div>
                    <div className="w-12 text-right shrink-0"><p className={`text-sm font-bold ${tone.text}`}>{(c.targetPct * 100).toFixed(0)}%</p></div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* AI Insight */}
          <div className="bg-blue-50/60 rounded-2xl border border-blue-100 p-5 shadow-sm flex flex-col">
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb size={16} className="text-blue-500" />
              <h2 className="text-sm font-semibold text-slate-700">AI Insight</h2>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">{insight}</p>
          </div>
        </div>
)}

        {/* ---- Doctor deposit-case summary (real, all channels, June) ---- */}
{activePage === "doctors" && (
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm mt-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
            <div className="flex items-center gap-2">
              <Users size={16} className="text-slate-500" />
              <h2 className="text-sm font-semibold text-slate-700">สรุปเคสมัดจำแยกตามหมอ</h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select
                icon={Stethoscope}
                value={doctorProcFilter}
                onChange={setDoctorProcFilter}
                options={DOCTOR_PROC_OPTIONS}
              />
              <Select
                icon={Users}
                value={doctorNameFilter}
                onChange={setDoctorNameFilter}
                options={DOCTOR_NAME_OPTIONS}
              />
              <button
                onClick={() => setDoctorSort(doctorSort === "cases" ? "deposit" : "cases")}
                className="flex items-center gap-1.5 text-xs font-medium text-slate-500 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg px-3 py-1.5"
              >
                <ArrowUpDown size={13} />
                เรียงตาม {doctorSort === "cases" ? "จำนวนเคส" : "ยอดมัดจำ"}
              </button>
            </div>
          </div>
          <p className="text-xs text-slate-400 mb-4">
            คนไข้ที่มัดจำเข้ามาช่วง {rangeLabel} ทุกช่องทาง
            {!isJunFull ? (
              <> · รวม {(activeDoctors || []).reduce((s, d) => s + d.cases, 0)} เคส · ยอดมัดจำรวม ฿
                {fmtTHB((activeDoctors || []).reduce((s, d) => s + d.deposit, 0))}
                {doctorProcFilter !== "all" ? ` · เฉพาะ ${DOCTOR_PROC_LABELS[doctorProcFilter]}` : ""}</>
            ) : doctorProcFilter === "all" ? (
              <> · รวม {DOCTOR_TOTAL.cases} เคส · ยอดมัดจำรวม ฿{fmtTHB(DOCTOR_TOTAL.deposit)}</>
            ) : (
              <> · เฉพาะ {DOCTOR_PROC_LABELS[doctorProcFilter]}</>
            )}
          </p>

          {(() => {
            const allRows = isJunFull ? sortedDoctors : [...(activeDoctors || [])].sort((a, b) => (doctorSort === "cases" ? b.cases - a.cases : b.deposit - a.deposit));
            const doctorRows = doctorNameFilter === "all" ? allRows : allRows.filter((d) => d.name === doctorNameFilter);
            const maxC = isJunFull ? maxCases : Math.max(...allRows.map((d) => d.cases), 1);
            const maxD = isJunFull ? maxDeposit : Math.max(...allRows.map((d) => d.deposit), 1);
            if (doctorRows.length === 0) {
              return (
                <p className="text-sm text-slate-400 py-4 text-center">
                  {doctorNameFilter !== "all"
                    ? `ไม่มีเคสมัดจำของ ${doctorNameFilter} ในช่วงนี้`
                    : `ไม่มีเคสมัดจำในเดือนนี้ ${!isJunFull && activeDoctors && activeDoctors.length === 0 ? "(ไม่มีข้อมูลในช่วงวันที่นี้)" : ""}`}
                </p>
              );
            }
            return (
              <div className="space-y-3">
                {doctorRows.map((d) => {
                  const barWidth = doctorSort === "cases" ? `${Math.max((d.cases / maxC) * 100, 3)}%` : `${Math.max((d.deposit / maxD) * 100, 3)}%`;
                  return (
                    <div key={d.name} className="flex items-center gap-3">
                      <div className="w-24 sm:w-28 shrink-0">
                        <p className="text-sm font-semibold text-slate-700 truncate">{d.name}</p>
                      </div>
                      <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-teal-500" style={{ width: barWidth }} />
                      </div>
                      <div className="w-16 text-right shrink-0">
                        <p className="text-sm font-bold text-teal-600">{d.cases} เคส</p>
                      </div>
                      <div className="w-44 text-right shrink-0 hidden sm:block">
                        <p className="text-xs text-slate-500">
                          มัดจำ ฿{fmtTHB(d.deposit)} <span className="text-slate-300">·</span> Total Price ฿{fmtTHB(d.total)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          <div className="mt-4 pt-4 border-t border-slate-100 flex items-start gap-2 text-xs text-slate-500">
            <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />
            <p>
              เมตริกด้านบน: ยอดขาย (มัดจำ/Online/Total Price) เป็นยอดรวมทุกช่องทาง ส่วนค่าโฆษณา (Spend) ในชีต Budget Allocate เป็นของ Facebook เท่านั้น · Facebook breakdown และสรุปเคสมัดจำแยกตามหมอ มาจากไฟล์ธุรกรรมจริง (Data_S45_Clinic) กรองตามช่วงวันที่ที่เลือกด้านบน ({rangeLabel})
            </p>
          </div>
        </div>
)}

        {/* ---- NEW: Sales Funnel Performance (Ads → Inbox → Sales → OR), รายวัน มิ.ย. 2026 ---- */}
{activePage === "ads" && (
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm mt-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
            <div className="flex items-center gap-2">
              <Activity size={16} className="text-slate-500" />
              <h2 className="text-sm font-semibold text-slate-700">Sales Funnel Performance</h2>
            </div>
            <div className="flex items-center gap-2">
              <Select icon={Stethoscope} value={funnelFilter} onChange={setFunnelFilter} options={funnelOptions} />
            </div>
          </div>
          {!funnel ? (
            <p className="text-sm text-slate-400 py-6 text-center">
              ไม่มีข้อมูล Sales Funnel สำหรับช่วงวันที่ที่เลือก (มีข้อมูลรายวันเฉพาะ มิ.ย.–ส.ค. 2569 เท่านั้น) — เปลี่ยนช่วงวันที่ด้านบนเพื่อดูข้อมูล
            </p>
          ) : (
          <>
          <p className="text-xs text-slate-400 mb-4">
            {funnel.label} · ยอดยิง Ads → Inbox{funnel.sales != null ? " → ปิดบิล (มัดจำ+ปรึกษา) → ยอด OR จริง" : ""} · {rangeLabel}
          </p>

          {/* Funnel metric cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            <div className="bg-slate-50 rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Megaphone size={12} className="text-slate-400" />
                <p className="text-[11px] text-slate-500 font-medium">ยอดยิง Ads</p>
              </div>
              <p className="text-base font-bold text-slate-700">{funnel.daysWithAdsData > 0 ? `฿${fmtTHB(funnel.ads)}` : "—"}</p>
            </div>
            <div className="bg-sky-50 rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <PhoneCall size={12} className="text-sky-500" />
                <p className="text-[11px] text-sky-600 font-medium">Inbox</p>
              </div>
              <p className="text-base font-bold text-sky-700">{funnel.daysWithAdsData > 0 ? fmtTHB(funnel.inbox) : "—"}</p>
            </div>
            <div className="bg-amber-50 rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Wallet size={12} className="text-amber-500" />
                <p className="text-[11px] text-amber-600 font-medium">ยอดขาย (มัดจำ+ปรึกษา)</p>
              </div>
              <p className="text-base font-bold text-amber-700">{funnel.sales != null ? `฿${fmtTHB(funnel.sales)}` : "—"}</p>
            </div>
            <div className="bg-emerald-50 rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingUp size={12} className="text-emerald-500" />
                <p className="text-[11px] text-emerald-600 font-medium">ยอด OR จริง</p>
              </div>
              <p className="text-base font-bold text-emerald-700">{funnel.or != null ? `฿${fmtTHB(funnel.or)}` : "—"}</p>
            </div>
          </div>

          {/* Secondary ratios */}
          {funnel.basket != null && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5 text-center">
            <div>
              <p className="text-[11px] text-slate-400">Basket Size</p>
              <p className="text-sm font-bold text-slate-700">฿{fmtTHB(funnel.basket)}</p>
            </div>
            <div>
              <p className="text-[11px] text-slate-400">อัตราปิดการขายรวม</p>
              <p className="text-sm font-bold text-slate-700">{(funnel.closeRate * 100).toFixed(2)}%</p>
            </div>
            <div>
              <p className="text-[11px] text-slate-400">%Ads Cost</p>
              <p className={`text-sm font-bold ${funnel.adsCost > AD_COST_THRESHOLD ? "text-rose-500" : "text-slate-700"}`}>
                {(funnel.adsCost * 100).toFixed(2)}%
              </p>
            </div>
            <div>
              <p className="text-[11px] text-slate-400">%Ads Cost OR</p>
              <p className="text-sm font-bold text-slate-700">{(funnel.adsCostOr * 100).toFixed(2)}%</p>
            </div>
          </div>
          )}

          {/* Daily Ads vs Inbox chart */}
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={funnelChartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#d9f2ee" />
              <XAxis dataKey="iso" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={(iso) => iso.slice(8, 10)} />
              <YAxis
                yAxisId="ads"
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
              />
              <YAxis yAxisId="inbox" orientation="right" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(v, name) => (name === "ads" ? `฿${fmtTHB(v)}` : `${v} inbox`)}
                labelFormatter={(iso) => fmtDateTh(iso)}
                contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 13 }}
              />
              <Legend formatter={(v) => (v === "ads" ? "ยอดยิง Ads" : "Inbox")} wrapperStyle={{ fontSize: 12 }} />
              <Bar yAxisId="ads" dataKey="ads" fill="#99f6e4" radius={[4, 4, 0, 0]} maxBarSize={16} />
              <Line yAxisId="inbox" dataKey="inbox" stroke="#0891b2" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>

          <div className="mt-4 pt-4 border-t border-slate-100 flex items-start gap-2 text-xs text-slate-500">
            <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />
            <p>
              ข้อมูลชุดนี้มาจากไฟล์ "ยอดขาย Online S45 Clinic" ชีตเดือน
              {activeMonthKey === "aug"
                ? "สิงหาคม 2569 (มีเฉพาะยอดยิง Ads กับ Inbox รายวันจากไฟล์นี้ตรงๆ ส่วนยอดขาย/OR แยกรายวันคำนวณจากไฟล์ธุรกรรม Data S45 Clinic แทน)"
                : activeMonthKey === "jul"
                  ? "กรกฎาคม 2026 (มีเฉพาะยอดยิง Ads กับ Inbox รายวัน ยังไม่มียอดขาย/OR แยกรายวันในไฟล์นี้)"
                  : "มิถุนายน 2569 เท่านั้น · \"ยอดขาย (มัดจำ+ปรึกษา)\" คือมูลค่าบิลที่ปิดได้ (ไม่เท่ากับยอด OR ซึ่งเป็นรายรับจากการผ่าตัดจริง)"}
            </p>
          </div>
          </>
          )}
        </div>
)}

        {/* ---- NEW: LINE OA Broadcast cost (LOA-มิถุนายน) ---- */}
{activePage === "ads" && (
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm mt-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Megaphone size={16} />
              </div>
              <h2 className="text-sm font-semibold text-slate-700">
                ค่าใช้จ่าย LINE OA Broadcast — {loaChannelMeta.label} {loaSelSource ? `(${rangeLabel})` : "(ไม่มีข้อมูลสำหรับช่วงวันที่นี้)"}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <Select icon={Megaphone} value={loaChannel} onChange={setLoaChannel} options={LOA_CHANNEL_OPTIONS} />
            </div>
          </div>
          <p className="text-xs text-slate-400 mb-4 ml-10">
            งบ Broadcast ทั้งเดือน ฿{fmtTHB(loaChannelMeta.monthlyBudget)} · โควตาส่ง {fmtTHB(loaChannelMeta.monthlyQuota)} ครั้ง/คน แยกตามหัตถการ
          </p>
          {!loaSelSource ? (
            <p className="text-sm text-slate-400 py-6 text-center">
              ไม่มีข้อมูล LOA Broadcast ({loaChannelMeta.label}) สำหรับช่วงวันที่ที่เลือก
              (มีข้อมูลตั้งแต่ {loaAvailableRangeLabel}) — เปลี่ยนช่วงวันที่ด้านบนเพื่อดูข้อมูล
            </p>
          ) : (
          <>
          {/* Overview cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
            <div className="bg-amber-50 rounded-xl p-3">
              <p className="text-[11px] text-amber-600 font-medium mb-0.5">งบที่ใช้ไปแล้ว</p>
              <p className="text-lg font-bold text-amber-700">฿{fmtTHB(loaSelTotal.budgetUsed)}</p>
              <p className="text-[11px] text-amber-500 mt-0.5">{((loaSelTotal.budgetUsed / loaChannelMeta.monthlyBudget) * 100).toFixed(1)}% ของงบเดือน</p>
            </div>
            <div className="bg-sky-50 rounded-xl p-3">
              <p className="text-[11px] text-sky-600 font-medium mb-0.5">งบคงเหลือ</p>
              <p className="text-lg font-bold text-sky-700">฿{fmtTHB(loaSelTotal.budgetLeft)}</p>
              <p className="text-[11px] text-sky-500 mt-0.5">{((loaSelTotal.budgetLeft / loaChannelMeta.monthlyBudget) * 100).toFixed(1)}% ของงบเดือน</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-[11px] text-slate-500 font-medium mb-0.5">โควตาบลอดคงเหลือ</p>
              <p className="text-lg font-bold text-slate-700">{fmtTHB(loaSelTotal.quotaLeft)} คน</p>
              <p className="text-[11px] text-slate-400 mt-0.5">{((loaSelTotal.quotaLeft / loaChannelMeta.monthlyQuota) * 100).toFixed(1)}% ของโควตาเดือน</p>
            </div>
          </div>

          {/* Standout badges: ใครใช้มาก / ใครเหลือมาก / ต้องเติมงบเร่งด่วน */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
            <div className="rounded-xl border border-rose-100 bg-rose-50/60 p-3">
              <p className="text-[11px] text-rose-500 font-medium mb-0.5">ใช้ Broadcast มากที่สุด</p>
              <p className="text-sm font-bold text-rose-700">{loaSelMostUsed.label}</p>
              <p className="text-xs text-rose-500 mt-0.5">
                ฿{fmtTHB(loaSelMostUsed.budgetUsed)} · {loaSelTotal.budgetUsed > 0 ? ((loaSelMostUsed.budgetUsed / loaSelTotal.budgetUsed) * 100).toFixed(0) : "0"}% ของงบที่ใช้ไปทั้งหมด
              </p>
            </div>
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3">
              <p className="text-[11px] text-emerald-600 font-medium mb-0.5">เหลืองบมากที่สุด</p>
              {loaSelMostLeft ? (
                <>
                  <p className="text-sm font-bold text-emerald-700">{loaSelMostLeft.label}</p>
                  <p className="text-xs text-emerald-600 mt-0.5">
                    ฿{fmtTHB(loaSelMostLeft.budgetLeft)} · ยังบลอดได้อีก {Math.round(loaSelMostLeft.timesLeft)}x
                  </p>
                </>
              ) : (
                <p className="text-xs text-slate-400 mt-0.5">ไม่มีข้อมูลงบตั้งไว้ของเดือนนี้</p>
              )}
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3">
              <p className="text-[11px] text-amber-600 font-medium mb-0.5">⚠ ควรเติมงบเร่งด่วน</p>
              {loaSelMostUrgent ? (
                <>
                  <p className="text-sm font-bold text-amber-700">{loaSelMostUrgent.label}</p>
                  <p className="text-xs text-amber-600 mt-0.5">
                    เหลือ ฿{fmtTHB(loaSelMostUrgent.budgetLeft)} · บลอดได้อีกแค่ {Math.round(loaSelMostUrgent.timesLeft)}x
                  </p>
                </>
              ) : (
                <p className="text-xs text-slate-400 mt-0.5">ไม่มีข้อมูลงบตั้งไว้ของเดือนนี้</p>
              )}
            </div>
          </div>

          {/* Ranked used-vs-left comparison bars */}
          <p className="text-xs font-medium text-slate-500 mb-2">เปรียบเทียบงบที่ใช้ไป vs คงเหลือ (เรียงจากใช้มาก → น้อย)</p>
          <div className="space-y-3 mb-5">
            {loaSelByUsedDesc.map((r) => {
              const budgetTotal = r.budgetUsed + (r.budgetLeft ?? 0);
              const usedPct = budgetTotal > 0 ? (r.budgetUsed / budgetTotal) * 100 : 100;
              return (
                <div key={r.key} className="flex items-center gap-3">
                  <div className="w-32 sm:w-40 shrink-0">
                    <p className="text-sm font-semibold text-slate-700 truncate">{r.label}</p>
                  </div>
                  <div className="flex-1">
                    <div className="h-3 bg-sky-100 rounded-full overflow-hidden flex" style={{ width: `${Math.max((budgetTotal / maxLoaSelBudget) * 100, 6)}%` }}>
                      <div className={`h-full ${usedPct > 90 ? "bg-rose-400" : "bg-amber-400"}`} style={{ width: `${Math.min(Math.max(usedPct, 0), 100)}%` }} />
                    </div>
                  </div>
                  <div className="w-40 text-right shrink-0 hidden sm:block">
                    <p className="text-xs text-slate-600">
                      ใช้ ฿{fmtTHB(r.budgetUsed)} <span className="text-slate-300">·</span> เหลือ {r.budgetLeft != null ? `฿${fmtTHB(r.budgetLeft)}` : "ไม่มีข้อมูล"}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Per-procedure table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] text-slate-400 border-b border-slate-100">
                  <th className="pb-2 font-medium">หัตถการ</th>
                  <th className="pb-2 font-medium text-right">จำนวนบรอดแคสต์ (คนสะสม)</th>
                  <th className="pb-2 font-medium text-right">งบใช้ไป</th>
                  <th className="pb-2 font-medium text-right">งบคงเหลือ</th>
                  <th className="pb-2 font-medium text-right">บลอดคงเหลือ (คน)</th>
                  <th className="pb-2 font-medium text-right">บลอดได้อีก (ครั้ง)</th>
                </tr>
              </thead>
              <tbody>
                {loaSelWithTimesUsed.map((r) => {
                  const budgetTotal = r.budgetUsed + (r.budgetLeft ?? 0);
                  const pctUsed = budgetTotal > 0 ? r.budgetUsed / budgetTotal : 1;
                  return (
                    <tr key={r.key} className="border-b border-slate-50 last:border-0">
                      <td className="py-2 text-slate-600">{r.label}</td>
                      <td className="py-2 text-right text-slate-500">{fmtTHB(r.broadcastReach)}</td>
                      <td className="py-2 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden hidden sm:block">
                            <div
                              className={`h-full rounded-full ${pctUsed > 0.9 ? "bg-rose-400" : "bg-emerald-400"}`}
                              style={{ width: `${Math.min(Math.max(pctUsed * 100, 0), 100)}%` }}
                            />
                          </div>
                          <span className="font-semibold text-slate-700">฿{fmtTHB(r.budgetUsed)}</span>
                        </div>
                      </td>
                      <td className="py-2 text-right text-slate-500">{r.budgetLeft != null ? `฿${fmtTHB(r.budgetLeft)}` : "—"}</td>
                      <td className="py-2 text-right text-slate-500">{r.quotaLeft != null ? fmtTHB(r.quotaLeft) : "—"}</td>
                      <td className={`py-2 text-right font-semibold ${r.timesLeft != null && r.timesLeft < 1 ? "text-rose-500" : "text-slate-700"}`}>
                        {r.timesLeft != null ? `${Math.round(r.timesLeft)}x` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 flex items-start gap-2 text-xs text-slate-500">
            <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />
            <p>
              "บลอดได้อีก (ครั้ง)" คือจำนวนครั้งที่ยังส่งได้อีกด้วยงบที่เหลือ · ข้อมูลจาก{loaSelSheetNote}เท่านั้น (งบใช้ไป+คงเหลือรวม ฿
              {fmtTHB(loaSelTotal.budgetUsed + loaSelTotal.budgetLeft)} ต่างจากงบตั้งไว้ ฿{fmtTHB(loaChannelMeta.monthlyBudget)} เล็กน้อยตามชีตต้นฉบับ)
            </p>
          </div>
          </>
          )}
        </div>
)}

        {/* ---- NEW: จำนวนครั้งการ Broadcast แยกตามหัตถการ (ทำได้ทั้งหมด vs ใช้จริง) ---- */}
{activePage === "ads" && (
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm mt-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Megaphone size={16} />
              </div>
              <h2 className="text-sm font-semibold text-slate-700">
                จำนวนครั้งการ Broadcast แยกตามหัตถการ — {loaChannelMeta.label} {loaSelSource ? `(${rangeLabel})` : "(ไม่มีข้อมูลสำหรับช่วงวันที่นี้)"}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <Select icon={Megaphone} value={loaChannel} onChange={setLoaChannel} options={LOA_CHANNEL_OPTIONS} />
            </div>
          </div>
          <p className="text-xs text-slate-400 mb-5 ml-10">
            เทียบจำนวนครั้งที่ "ใช้จริงไปแล้ว" กับ "ทำได้ทั้งหมด" (ใช้จริง + เหลือ) ต่อหัตถการ · หน่วย: ครั้ง
          </p>
          {!loaSelSource ? (
            <p className="text-sm text-slate-400 py-6 text-center">
              ไม่มีข้อมูล LOA Broadcast ({loaChannelMeta.label}) สำหรับช่วงวันที่ที่เลือก
              (มีข้อมูลตั้งแต่ {loaAvailableRangeLabel}) — เปลี่ยนช่วงวันที่ด้านบนเพื่อดูข้อมูล
            </p>
          ) : (
          <>
          {/* Overview cards */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="bg-indigo-50 rounded-xl p-3 text-center">
              <p className="text-[11px] text-indigo-500 font-medium mb-0.5">ใช้จริงไปแล้ว</p>
              <p className="text-xl font-bold text-indigo-700">{loaSelCountTotals.used} ครั้ง</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 text-center">
              <p className="text-[11px] text-slate-500 font-medium mb-0.5">เหลือ</p>
              <p className="text-xl font-bold text-slate-700">{loaSelCountTotals.left} ครั้ง</p>
            </div>
            <div className="bg-emerald-50 rounded-xl p-3 text-center">
              <p className="text-[11px] text-emerald-600 font-medium mb-0.5">ทำได้ทั้งหมด</p>
              <p className="text-xl font-bold text-emerald-700">{loaSelCountTotals.total} ครั้ง</p>
            </div>
          </div>

          {/* Stacked comparison bars: ใช้จริง (เข้ม) + เหลือ (อ่อน) = ทำได้ทั้งหมด */}
          <div className="space-y-4 mb-2">
            {loaSelCountCompare.map((r) => (
              <div key={r.key}>
                <div className="flex items-baseline justify-between mb-1">
                  <p className="text-sm font-semibold text-slate-700">{r.label}</p>
                  <p className="text-xs text-slate-500">
                    ใช้จริง <span className="font-semibold text-teal-600">{r.used}</span> / ทำได้ทั้งหมด{" "}
                    <span className="font-semibold text-slate-700">{Math.max(r.total, r.used)}</span> ครั้ง
                  </p>
                </div>
                <div className="h-4 bg-slate-100 rounded-full overflow-hidden flex" style={{ width: `${Math.max((Math.max(r.total, r.used, 1) / maxLoaSelCountTotal) * 100, 8)}%` }}>
                  <div
                    className="h-full bg-teal-500 flex items-center justify-end pr-1"
                    style={{ width: `${r.total > 0 ? Math.min((r.used / r.total) * 100, 100) : 0}%` }}
                  />
                  {r.total > 0 && r.left > 0 && <div className="h-full bg-teal-100" style={{ width: `${(r.left / r.total) * 100}%` }} />}
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 mb-5 text-[11px] text-slate-400">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-teal-500 inline-block" /> ใช้จริงไปแล้ว</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-teal-100 inline-block" /> เหลือ (ทำได้อีก)</span>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] text-slate-400 border-b border-slate-100">
                  <th className="pb-2 font-medium">หัตถการ</th>
                  <th className="pb-2 font-medium text-right">ใช้จริงไปแล้ว (ครั้ง)</th>
                  <th className="pb-2 font-medium text-right">เหลือ (ครั้ง)</th>
                  <th className="pb-2 font-medium text-right">ทำได้ทั้งหมด (ครั้ง)</th>
                  <th className="pb-2 font-medium text-right">% ใช้ไปแล้ว</th>
                </tr>
              </thead>
              <tbody>
                {loaSelCountCompare.map((r) => (
                  <tr key={r.key} className="border-b border-slate-50 last:border-0">
                    <td className="py-2 text-slate-600">{r.label}</td>
                    <td className="py-2 text-right font-semibold text-indigo-600">{r.used}</td>
                    <td className="py-2 text-right text-slate-500">{r.left}</td>
                    <td className="py-2 text-right font-semibold text-slate-700">{r.total}</td>
                    <td className={`py-2 text-right font-semibold ${r.total > 0 && r.used / r.total > 0.9 ? "text-rose-500" : "text-slate-700"}`}>
                      {r.total > 0 ? `${((r.used / r.total) * 100).toFixed(0)}%` : "—"}
                    </td>
                  </tr>
                ))}
                <tr className="border-t border-slate-200">
                  <td className="py-2 font-semibold text-slate-700">รวมทุกหัตถการ</td>
                  <td className="py-2 text-right font-semibold text-indigo-600">{loaSelCountTotals.used}</td>
                  <td className="py-2 text-right text-slate-500">{loaSelCountTotals.left}</td>
                  <td className="py-2 text-right font-semibold text-slate-700">{loaSelCountTotals.total}</td>
                  <td className="py-2 text-right font-semibold text-slate-700">
                    {loaSelCountTotals.total > 0 ? `${((loaSelCountTotals.used / loaSelCountTotals.total) * 100).toFixed(0)}%` : "—"}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 flex items-start gap-2 text-xs text-slate-500">
            <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />
            <p>
              "ใช้จริงไปแล้ว" คำนวณจากจำนวนบรอดแคสต์สะสม ÷ {loaChannelMeta.peoplePerBroadcast.toLocaleString()} คน/ครั้ง · "ทำได้ทั้งหมด" = ใช้จริง + เหลือ
              (จากงบที่ตั้งไว้ทั้งเดือนของแต่ละหัตถการ)
              {loaSelMostUsedPctRow &&
                ` · ${loaSelMostUsedPctRow.label} ใช้ไปแล้ว ${loaSelMostUsedPctRow.used}/${loaSelMostUsedPctRow.total} ครั้ง (${((loaSelMostUsedPctRow.used / loaSelMostUsedPctRow.total) * 100).toFixed(0)}%) คือหัตถการที่ใช้โควตาไปมากที่สุด`}
            </p>
          </div>
          </>
          )}
        </div>
)}

        {/* ---- Recommendations (ย้ายมาไว้ล่างสุดของ Dashboard) ---- */}
{activePage === "overview" && (
        <div className="mt-6 rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Lightbulb size={16} className="text-blue-500" />
            <h3 className="text-sm font-semibold text-slate-700">คำแนะนำเกี่ยวกับการ Broadcast</h3>
          </div>
          <ul className="space-y-1.5 text-sm text-slate-600 list-disc list-inside">
            <li>
              <span className="font-semibold">Open</span> บลอดไปแล้ว {Math.round(loaWithTimesUsed.find((r) => r.key === "open").timesUsed)} ครั้ง
              (มากที่สุด) ใช้งบไปแล้ว {((loaMostUsed.budgetUsed / loaTotal.budgetUsed) * 100).toFixed(0)}% ของงบ Broadcast ทั้งหมดในเดือนนี้
              แต่ยังเหลือพอส่งได้อีก {Math.round(LOA_JUNE.find((r) => r.key === "open").timesLeft)}x —
              ควรกระจายรอบการส่งให้พอดีจนถึงสิ้นเดือน ไม่ยิงรัวจนงบหมดเร็วเกินไป
            </li>
            <li>
              <span className="font-semibold text-rose-600">ยกคิ้ว/เลื่อนไรผม</span> บลอดไปแล้ว{" "}
              {Math.round(loaWithTimesUsed.find((r) => r.key === "brow").timesUsed)} ครั้ง (มากเป็นอันดับ 2)
              แต่เหลืองบไม่พอส่งได้อีกเต็มรอบ (0x) — แนะนำเติมงบเพิ่ม หรือลดจำนวนคนที่ส่งต่อรอบเพื่อยืดโควตาที่เหลือ
            </li>
            <li>
              <span className="font-semibold text-emerald-600">แบรนด์ดิ้ง</span> บลอดไปแล้วเพียง{" "}
              {Math.round(loaWithTimesUsed.find((r) => r.key === "branding").timesUsed)} ครั้ง (น้อยที่สุด) ใช้งบน้อยที่สุดและเหลือมากที่สุด
              (ยังบลอดได้อีก 4x) — มีช่องว่างให้เพิ่มความถี่ broadcast เพื่อสร้าง brand awareness โดยไม่เสียงบเปล่า
            </li>
            <li>
              <span className="font-semibold">หน้าอก/ดูดไขมัน</span> กับ <span className="font-semibold">Semi</span> บลอดไปแล้วพอๆกัน (
              {Math.round(loaWithTimesUsed.find((r) => r.key === "breast").timesUsed)} และ{" "}
              {Math.round(loaWithTimesUsed.find((r) => r.key === "semi").timesUsed)} ครั้งตามลำดับ) ใช้งบใกล้เคียงกัน (~2,350–2,360 บาท)
              แต่หน้าอกเหลือโควตาคนน้อยกว่ามาก (38,709 vs 116,758 คน) และบลอดได้อีกแค่ 1x — ควรเติมงบให้หน้าอกก่อน Semi
            </li>
            <li>
              รวมทั้งเดือนบลอดไปแล้ว {Math.round(loaWithTimesUsed.reduce((s, r) => s + r.timesUsed, 0))} ครั้ง ใช้งบไปแล้ว{" "}
              {((loaTotal.budgetUsed / LOA_MONTHLY_BUDGET) * 100).toFixed(1)}% ควรเผื่องบสำหรับสัปดาห์สุดท้ายของเดือนไว้ด้วย
            </li>
          </ul>
        </div>
)}

        {/* ---- FINAL: Executive Summary ทั้ง Dashboard + สัดส่วนงบตามช่องทางโฆษณา ---- */}
{activePage === "overview" && (
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm mt-6">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-slate-800 text-white flex items-center justify-center">
              <Activity size={16} />
            </div>
            <h2 className="text-sm font-semibold text-slate-700">สรุปภาพรวม Dashboard — {rangeLabel}</h2>
          </div>
          <p className="text-xs text-slate-400 mb-5 ml-10">รวบรวมตัวเลขสำคัญจากทุกส่วนด้านบนไว้ในที่เดียว ตามช่วงวันที่ที่เลือก</p>

          {/* Recap grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-[11px] text-slate-500 font-medium mb-0.5">ยอดขายรวมทุกช่องทาง</p>
              <p className="text-base font-bold text-slate-800">฿{fmtTHB(summaryAllSales)}</p>
            </div>
            <div className="bg-emerald-50 rounded-xl p-3">
              <p className="text-[11px] text-emerald-600 font-medium mb-0.5">ยอดขาย Facebook</p>
              <p className="text-base font-bold text-emerald-700">฿{fmtTHB(summaryFbSales)}</p>
            </div>
            <div className="bg-blue-50 rounded-xl p-3">
              <p className="text-[11px] text-blue-600 font-medium mb-0.5">ค่าโฆษณา Facebook</p>
              <p className="text-base font-bold text-blue-700">฿{fmtTHB(summaryFbSpend)}</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-[11px] text-slate-500 font-medium mb-0.5">ROAS Facebook</p>
              <p className="text-base font-bold text-slate-800">{summaryRoas.toFixed(1)}x</p>
            </div>
            <div className="bg-indigo-50 rounded-xl p-3">
              <p className="text-[11px] text-indigo-600 font-medium mb-0.5">เคสมัดจำ (ช่วงที่เลือก)</p>
              <p className="text-base font-bold text-indigo-700">{fmtTHB(summaryDoctorCases)} เคส</p>
            </div>
            <div className="bg-amber-50 rounded-xl p-3">
              <p className="text-[11px] text-amber-600 font-medium mb-0.5">
                ยอด OR จริง (Funnel){summaryOrTotal != null && summaryOrMissingRange ? " · ไม่รวมช่วงนอก มิ.ย.-ก.ค." : ""}
              </p>
              <p className="text-base font-bold text-amber-700">{summaryOrTotal != null ? `฿${fmtTHB(summaryOrTotal)}` : "—"}</p>
            </div>
            <div className="bg-sky-50 rounded-xl p-3">
              <p className="text-[11px] text-sky-600 font-medium mb-0.5">Inbox (Funnel)</p>
              <p className="text-base font-bold text-sky-700">{hasFunnelCoverage ? fmtTHB(summaryInboxTotal) : "—"}</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-[11px] text-slate-500 font-medium mb-0.5">งบ LINE OA Broadcast ใช้ไป</p>
              <p className="text-base font-bold text-slate-800">
                {loaSummaryTotal ? `${((loaSummaryTotal.budgetUsed / LOA_MONTHLY_BUDGET) * 100).toFixed(0)}%` : "—"}
              </p>
            </div>
            <div className="bg-rose-50 rounded-xl p-3">
              <p className="text-[11px] text-rose-500 font-medium mb-0.5">Broadcast ใช้โควตามากที่สุด</p>
              <p className="text-base font-bold text-rose-700">
                {loaSummaryMostUrgent
                  ? `${loaSummaryMostUrgent.label} (${loaSummaryMostUrgent.timesLeft <= 0 ? "ครบ/เกินโควตา" : `เหลือ ${Math.round(loaSummaryMostUrgent.timesLeft)}x`})`
                  : "—"}
              </p>
            </div>
          </div>
          {(!hasFunnelCoverage || !loaSummarySource) && (
            <p className="text-[11px] text-slate-400 -mt-3 mb-6">
              * Funnel (OR/Inbox) และ LINE OA Broadcast มีข้อมูลรายวัน/รายเดือนแค่มิถุนายนกับกรกฎาคม 2026 เท่านั้น — ช่วงวันที่ที่เลือกไม่ตรงกับข้อมูลที่มี
              จึงแสดง "—"
            </p>
          )}

          {/* Channel budget mix */}
          <p className="text-xs font-medium text-slate-500 mb-2">
            สัดส่วนงบโฆษณาแยกตามช่องทาง (ทุกหัตถการรวมกัน) — <span className="font-semibold">ข้อมูลเดือนมิถุนายน 2569 เท่านั้น</span> (ยังไม่มีข้อมูลสัดส่วนช่องทางของเดือนอื่น)
          </p>
          <div className="space-y-3 mb-3">
            {channelMixSorted.map((c) => {
              const pct = (c.budget / CHANNEL_MIX_TOTAL) * 100;
              const isTiktok = c.key === "tiktok";
              return (
                <div key={c.key} className="flex items-center gap-3">
                  <div className="w-32 shrink-0">
                    <p className={`text-sm font-semibold ${isTiktok ? "text-rose-600" : "text-slate-700"}`}>{c.label}</p>
                  </div>
                  <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${isTiktok ? "bg-rose-400" : "bg-slate-400"}`}
                      style={{ width: `${Math.max((c.budget / maxChannelBudget) * 100, 2)}%` }}
                    />
                  </div>
                  <div className="w-32 text-right shrink-0">
                    <p className={`text-xs font-semibold ${isTiktok ? "text-rose-600" : "text-slate-600"}`}>
                      ฿{fmtTHB(c.budget)} ({pct.toFixed(1)}%)
                    </p>
                  </div>
                </div>
              );
            })}
          </div>


          <div className="mt-4 pt-4 border-t border-slate-100 flex items-start gap-2 text-xs text-slate-500">
            <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />
            <p>
              สัดส่วนงบตามช่องทางอ้างอิงจากชีต "June26" (แถว Total ของ Facebook/Line Broadcast/Line Ads/Tiktok/Google) เท่านั้น — ยังไม่มีไฟล์เทียบเท่าของเดือนอื่น
              ส่วนตัวเลขสรุปด้านบน (ยอดขาย/ค่าโฆษณา/ROAS/เคสมัดจำ) จะเปลี่ยนตามช่วงวันที่ที่เลือกจริง
            </p>
          </div>
        </div>
)}

        {/* ---- NEW: เป้าหมาย Inbox vs Inbox ที่ทำได้จริง รายวัน — มิถุนายน 2569 ---- */}
{activePage === "inbox" && (
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm mt-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
                <PhoneCall size={16} />
              </div>
              <h2 className="text-sm font-semibold text-slate-700">เป้าหมาย Inbox เทียบกับ Inbox ที่ทำได้จริง (รายวัน)</h2>
            </div>
            <div className="flex items-center gap-2">
              <Select icon={Stethoscope} value={inboxDailyFilter} onChange={setInboxDailyFilter} options={inboxDailyOptions} />
            </div>
          </div>
          {!inboxLabel ? (
            <p className="text-sm text-slate-400 py-6 text-center">
              ไม่มีข้อมูล Inbox รายวันสำหรับช่วงวันที่ที่เลือก (มีข้อมูลเฉพาะ มิ.ย.–ส.ค. 2569 เท่านั้น) — เปลี่ยนช่วงวันที่ด้านบนเพื่อดูข้อมูล
            </p>
          ) : (
          <>
          <p className="text-xs text-slate-400 mb-5 ml-10">
            {inboxLabel} · {rangeLabel} ·{" "}
            {inboxDailyTargetPerDay != null
              ? `เป้าหมาย ${fmtTHB(inboxDailyTargetPerDay)} แชท/วัน (ตัวเลขจริงที่ทีมกำหนด)`
              : "หัตถการนี้ยังไม่มีเป้าหมาย Inbox ต่อวันที่กำหนดไว้"}
          </p>

          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-[11px] text-slate-500 font-medium mb-0.5">เป้าหมายรวมตามช่วงที่เลือก</p>
              <p className="text-base font-bold text-slate-700">
                {inboxDailyTargetPerDay != null && inboxDaysWithData > 0 ? fmtTHB(inboxDailyTotals.target) : "—"}
              </p>
            </div>
            <div className="bg-sky-50 rounded-xl p-3">
              <p className="text-[11px] text-sky-600 font-medium mb-0.5">Inbox จริงรวมตามช่วงที่เลือก</p>
              <p className="text-base font-bold text-sky-700">{inboxDaysWithData > 0 ? fmtTHB(inboxDailyTotals.actual) : "—"}</p>
              <MoMBadge delta={inboxActualMoM} />
            </div>
            <div className="bg-emerald-50 rounded-xl p-3">
              <p className="text-[11px] text-emerald-600 font-medium mb-0.5">% เทียบเป้า</p>
              <p className="text-base font-bold text-emerald-700">
                {inboxDailyTargetPerDay != null && inboxDailyTotals.target > 0
                  ? `${((inboxDailyTotals.actual / inboxDailyTotals.target) * 100).toFixed(0)}%`
                  : "—"}
              </p>
            </div>
            <div className="bg-amber-50 rounded-xl p-3">
              <p className="text-[11px] text-amber-600 font-medium mb-0.5">วันที่ทำได้เกินเป้า</p>
              <p className="text-base font-bold text-amber-700">
                {inboxDailyTargetPerDay != null ? `${daysAboveTarget} / ${inboxDailyData.length} วัน` : "—"}
              </p>
            </div>
          </div>

          {/* ยอดปิดปรึกษา / ยอดปิดมัดจำ / จำนวนเคสที่ปิด OR รวมตามมุมมองที่เลือก */}
          {inboxHasSalesData ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
            <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-3">
              <p className="text-[11px] text-amber-600 font-medium mb-0.5">ยอดปิดปรึกษา (ตามช่วงที่เลือก)</p>
              <p className="text-xl font-bold text-amber-700">{inboxDaysWithData > 0 ? `${fmtTHB(inboxDailyTotals.consult)} เคส` : "—"}</p>
              <MoMBadge delta={inboxConsultMoM} />
            </div>
            <div className="rounded-xl border border-violet-100 bg-violet-50/60 p-3">
              <p className="text-[11px] text-violet-600 font-medium mb-0.5">ยอดปิดมัดจำ (ตามช่วงที่เลือก)</p>
              <p className="text-xl font-bold text-violet-700">{inboxDaysWithData > 0 ? `${fmtTHB(inboxDailyTotals.deposit)} เคส` : "—"}</p>
              <MoMBadge delta={inboxDepositMoM} />
            </div>
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3">
              <p className="text-[11px] text-emerald-600 font-medium mb-0.5">จำนวนเคสที่ปิด OR (ตามช่วงที่เลือก)</p>
              <p className="text-xl font-bold text-emerald-700">{inboxDaysWithData > 0 ? `${fmtTHB(inboxDailyTotals.or)} เคส` : "—"}</p>
              <MoMBadge delta={inboxOrMoM} />
            </div>
          </div>
          ) : (
          <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 mb-5 text-xs text-slate-400">
            ไฟล์ข้อมูลเดือนนี้มีเฉพาะยอด Ads/Inbox รายวัน — ยังไม่มีข้อมูลยอดปิดปรึกษา/มัดจำ/OR แยกรายวัน
          </div>
          )}

          {/* ระยะเวลาที่ใช้ปิด OR (Date → OR Date) แยกตามหัตถการ — ใช้มัธยฐานเพราะข้อมูลมี outlier สูงมาก */}
          <div className="rounded-xl border border-cyan-100 bg-cyan-50/50 p-4 mb-5">
            <div className="flex items-center gap-2 mb-3">
              <Clock size={14} className="text-cyan-600" />
              <h3 className="text-sm font-semibold text-slate-700">
                ระยะเวลาที่ใช้ปิด OR (จากวันที่ทัก → วันผ่าตัดจริง) — {rangeLabel}
              </h3>
            </div>
            {!funnelLeadTime ? (
              <p className="text-sm text-slate-400 py-4 text-center">ไม่มีข้อมูลสำหรับเดือนนี้</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {Object.entries(funnelLeadTime).map(([key, r]) => (
                  <div key={key} className="bg-white rounded-lg p-3 border border-cyan-100 text-center">
                    <p className="text-[11px] text-slate-500 font-medium mb-0.5">{r.label}</p>
                    <p className="text-lg font-bold text-cyan-700">{r.medianDays != null ? `${r.medianDays} วัน` : "—"}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {r.n != null ? `n=${r.n} เคส${r.minDays != null ? ` · ${r.minDays}-${r.maxDays} วัน` : ""}` : "ไม่มีข้อมูล"}
                    </p>
                  </div>
                ))}
              </div>
            )}
            <p className="text-[11px] text-slate-400 mt-3">
              ตัวเลขหลักคือ<span className="font-semibold">มัธยฐาน (Median)</span> ไม่ใช่ค่าเฉลี่ย เพราะข้อมูลจริงมีบางเคสที่ใช้เวลานานผิดปกติ
              ซึ่งจะดึงค่าเฉลี่ยให้สูงเกินค่าปกติทั่วไปมาก มัธยฐานจึงสะท้อนระยะเวลาที่ "คนไข้ทั่วไปเจอจริง" ได้แม่นยำกว่า —
              ตัวเลขเล็กด้านล่างคือช่วงต่ำสุด-สูงสุดที่พบจริง · นับเฉพาะเคสที่ "Date" อยู่ในเดือนที่เลือก และมี "OR Date" บันทึกแล้วจริง
            </p>
          </div>

          {/* กราฟที่ 1: เป้าหมาย Inbox vs Inbox จริง — แยกจากกราฟยอดปิดด้านล่างเพราะสเกลต่างกันมาก
              (Inbox หลักร้อย ส่วนยอดปิดหลักสิบ) ถ้ารวมแกน Y เดียวกัน เส้นยอดปิดจะแบนติดพื้นจนอ่านไม่ออก */}
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={inboxChartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#d9f2ee" />
              <XAxis dataKey="iso" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={(iso) => iso.slice(8, 10)} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(v, name) => [`${fmtTHB(v)} แชท/วัน`, name === "target" ? "เป้าหมาย Inbox" : "Inbox จริง"]}
                labelFormatter={(iso) => fmtDateTh(iso)}
                contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 13 }}
              />
              <Legend
                formatter={(v) => (v === "target" ? "เป้าหมาย Inbox" : "Inbox ที่ทำได้จริง")}
                wrapperStyle={{ fontSize: 12 }}
              />
              <Area type="monotone" dataKey="actual" stroke="#0d9488" strokeWidth={2.5} fill="#5eead4" fillOpacity={0.28} dot={{ r: 3 }} />
              {inboxDailyTargetPerDay != null && (
                <Line type="monotone" dataKey="target" stroke="#f59e0b" strokeDasharray="5 4" strokeWidth={2} dot={false} />
              )}
            </ComposedChart>
          </ResponsiveContainer>

          {/* กราฟที่ 2: ยอดปิดปรึกษา/ปิดมัดจำ/จำนวนเคสที่ปิด OR — แกน Y ของตัวเอง (สเกล 0-70 ประมาณ) */}
          {inboxHasSalesData && (
            <>
              <h4 className="text-xs font-semibold text-slate-500 mt-5 mb-2">ยอดปิดปรึกษา / ปิดมัดจำ / จำนวนเคสที่ปิด OR รายวัน</h4>
              <ResponsiveContainer width="100%" height={200}>
                <ComposedChart data={inboxChartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#d9f2ee" />
                  <XAxis dataKey="iso" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={(iso) => iso.slice(8, 10)} />
                  <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(v, name) => {
                      const labels = { consult: "ยอดปิดปรึกษา", deposit: "ยอดปิดมัดจำ", or: "จำนวนเคสที่ปิด OR" };
                      return [`${fmtTHB(v)} ${name === "or" ? "เคส" : "เคส/ครั้ง"}`, labels[name] || name];
                    }}
                    labelFormatter={(iso) => fmtDateTh(iso)}
                    contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 13 }}
                  />
                  <Legend
                    formatter={(v) => ({ consult: "ยอดปิดปรึกษา", deposit: "ยอดปิดมัดจำ", or: "จำนวนเคสที่ปิด OR" }[v] || v)}
                    wrapperStyle={{ fontSize: 12 }}
                  />
                  <Line type="monotone" dataKey="consult" stroke="#0891b2" strokeWidth={2} dot={{ r: 2 }} />
                  <Line type="monotone" dataKey="deposit" stroke="#7c3aed" strokeWidth={2} dot={{ r: 2 }} />
                  <Line type="monotone" dataKey="or" stroke="#db2777" strokeWidth={2} dot={{ r: 2 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </>
          )}
          <p className="text-[11px] text-slate-400 mt-2 mb-5">
            เป้าหมาย Inbox/วัน: Nose Open 120 แชท · Semi Open 35 แชท · ยกคิ้ว 130 แชท · เสริมหน้าอก 25 แชท · Inter 10 แชท (ตัวเลขจริงที่ทีมกำหนด) —
            "รวมทุกหัตถการ" ใช้ผลรวมของทั้ง 5 หัตถการ ({fmtTHB(INBOX_DAILY_TARGET_ALL)} แชท/วัน)
            {inboxHasSalesData
              ? ` · ยอดปิดปรึกษา/ปิดมัดจำ มาจากไฟล์ Sales Funnel เดียวกับ Inbox (ไม่ได้แยกช่องทาง จึงเป็นยอดรวมทุกช่องทาง ไม่ใช่ Facebook อย่างเดียว) ส่วน "จำนวนเคสที่ปิด OR" นับจากวันที่ระบุในคอลัมน์ OR Date ของไฟล์ธุรกรรมจริง (Data_S45_Clinic) เดือนมิถุนายน 2569 — ก็ไม่ได้แยกช่องทางเช่นกัน`
              : " · Inbox รายวันมาจากไฟล์ \"ยอดขาย Online S45 Clinic\" ชีตกรกฎาคม 2569 (ไม่ได้แยกช่องทาง จึงเป็นยอดรวมทุกช่องทาง ไม่ใช่ Facebook อย่างเดียว)"}
          </p>

          {/* ทีม Online: กำลังคนและภาระงานเฉลี่ยต่อคน */}
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4 mb-5">
            <div className="flex items-center gap-2 mb-3">
              <Users size={14} className="text-indigo-500" />
              <h3 className="text-sm font-semibold text-slate-700">ทีม Online ที่ตอบ Inbox</h3>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              ทีม Online รวม <span className="font-semibold text-indigo-600">{ONLINE_TEAM_MAIN} คน</span> ตอบทุกหัตถการหลัก
              และอีก <span className="font-semibold text-indigo-600">{ONLINE_TEAM_INTER} คน</span> ตอบเฉพาะ Inter — มุมมองที่เลือกอยู่ตอนนี้ (
              {inboxDailyFunnel.label}) คำนวณจากทีม {onlineStaffCount} คน
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-lg p-3 border border-indigo-100">
                <p className="text-[11px] text-slate-500 font-medium mb-0.5">เฉลี่ยแชท/คน/วัน</p>
                <p className="text-lg font-bold text-indigo-700">{inboxDailyData.length > 0 ? avgChatsPerAgentPerDay.toFixed(1) : "—"} แชท</p>
              </div>
              <div className="bg-white rounded-lg p-3 border border-indigo-100">
                <p className="text-[11px] text-slate-500 font-medium mb-0.5">เฉลี่ยแชท/คน/เดือน</p>
                <p className="text-lg font-bold text-indigo-700">{fmtTHB(avgChatsPerAgentPerMonth)} แชท</p>
              </div>
            </div>
          </div>
          </>
          )}

          {/* Bad Lead เทียบ Inbox ทั้งหมด */}
          <div className="rounded-xl border border-rose-100 bg-rose-50/50 p-4 mb-5">
            <div className="flex items-center gap-2 mb-3">
              <XCircle size={14} className="text-rose-500" />
              <h3 className="text-sm font-semibold text-slate-700">Bad Lead เทียบ Inbox ทั้งหมด — กรกฎาคม 2569</h3>
            </div>
            <p className="text-[11px] text-amber-600 mb-2">
              ⚠ การ์ดนี้ตรึงไว้ที่ ก.ค. 2569 เสมอ ไม่ขยับตาม Filter วันที่ด้านบน เพราะไฟล์ Bad Lead ต้นฉบับมีข้อมูลเดือนกรกฎาคมเดือนเดียว
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-lg p-3 border border-rose-100">
                <p className="text-[11px] text-slate-500 font-medium mb-0.5">จำนวน Bad Lead</p>
                <p className="text-lg font-bold text-rose-700">{BAD_LEAD_TOTAL} แชท</p>
              </div>
              <div className="bg-white rounded-lg p-3 border border-rose-100">
                <p className="text-[11px] text-slate-500 font-medium mb-0.5">% จาก Inbox ทั้งหมด</p>
                <p className="text-lg font-bold text-rose-700">{((BAD_LEAD_TOTAL / FUNNEL_DATA_JUL.all.inbox) * 100).toFixed(2)}%</p>
              </div>
            </div>
            <p className="text-[11px] text-slate-400 mt-2">
              ไฟล์ Bad Lead ต้นฉบับไม่ได้ระบุหัตถการต่อแชท จึงแสดงเป็นยอดรวมทุกหัตถการเทียบกับ Inbox รวมทั้งหมด ({fmtTHB(FUNNEL_DATA_JUL.all.inbox)}{" "}
              แชท เดือน ก.ค. 2569) ไม่สามารถแยก Scale ตามหัตถการได้เหมือนอีก 2 รายการด้านล่าง
            </p>
          </div>

          {/* ปิดปรึกษา / ปิดมัดจำ แยกตามหัตถการ เทียบ Inbox — คำนวณสดตามช่วงวันที่ที่เลือกแล้ว (ทั้ง Inbox และปิดปรึกษา/มัดจำ) */}
          {closeTableDates.length === 0 ? (
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4 mb-5">
              <p className="text-sm text-slate-400 py-2 text-center">
                ไม่มีข้อมูลปิดปรึกษา/ปิดมัดจำสำหรับช่วงวันที่ที่เลือก (มีข้อมูล Inbox รายวันเฉพาะ มิ.ย.–ส.ค. 2569 เท่านั้น)
              </p>
            </div>
          ) : (
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4 mb-5">
            <div className="flex items-center gap-2 mb-3">
              <ClipboardCheck size={14} className="text-emerald-600" />
              <h3 className="text-sm font-semibold text-slate-700">ปิดปรึกษา / ปิดมัดจำ แยกตามหัตถการ (เทียบ Inbox) — {rangeLabel}</h3>
            </div>

            {/* ยอดรวมเป็นบาท ทุกหัตถการ */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
              <div className="bg-white rounded-lg p-3 border border-emerald-100">
                <p className="text-[11px] text-slate-500 font-medium mb-0.5">ยอดปิดปรึกษา รวมทุกหัตถการ</p>
                <p className="text-lg font-bold text-emerald-700">฿{fmtTHB(closeCountsLive.all.consultValue)}</p>
              </div>
              <div className="bg-white rounded-lg p-3 border border-emerald-100">
                <p className="text-[11px] text-slate-500 font-medium mb-0.5">ยอดปิดมัดจำ รวมทุกหัตถการ</p>
                <p className="text-lg font-bold text-emerald-700">฿{fmtTHB(closeCountsLive.all.depositValue)}</p>
              </div>
              <div className="bg-emerald-100/60 rounded-lg p-3 border border-emerald-200 col-span-2 sm:col-span-1">
                <p className="text-[11px] text-emerald-700 font-medium mb-0.5">รวมทั้งสองอย่าง</p>
                <p className="text-lg font-bold text-emerald-800">
                  ฿{fmtTHB(closeCountsLive.all.consultValue + closeCountsLive.all.depositValue)}
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] text-slate-400 border-b border-slate-100">
                    <th className="pb-2 font-medium">หัตถการ</th>
                    <th className="pb-2 font-medium text-right">Inbox</th>
                    <th className="pb-2 font-medium text-right">ปิดปรึกษา</th>
                    <th className="pb-2 font-medium text-right">% ปิดปรึกษา</th>
                    <th className="pb-2 font-medium text-right">ปิดมัดจำ</th>
                    <th className="pb-2 font-medium text-right">% ปิดมัดจำ</th>
                  </tr>
                </thead>
                <tbody>
                  {[...DAILY_CATEGORY_KEYS, "inter"].map((k) => {
                    const c = closeCountsLive[k];
                    const inboxForRow = k === "inter" ? null : closeTableInboxByProc[k];
                    const label = closeTableLabelFor(k);
                    return (
                      <tr key={k} className="border-b border-slate-50 last:border-0">
                        <td className="py-2 text-slate-600">{label}</td>
                        <td className="py-2 text-right text-slate-500">{inboxForRow != null ? fmtTHB(inboxForRow) : "—"}</td>
                        {!c ? (
                          <>
                            <td className="py-2 text-right text-slate-400" colSpan={2}>
                              ไม่มีข้อมูล
                            </td>
                            <td className="py-2 text-right text-slate-400" colSpan={2}>
                              ไม่มีข้อมูล
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="py-2 text-right">
                              <p className="font-semibold text-slate-700">{c.consult}</p>
                              <p className="text-[11px] text-slate-400">฿{fmtTHB(c.consultValue)}</p>
                            </td>
                            <td className="py-2 text-right text-emerald-600 font-semibold">
                              {inboxForRow > 0 ? ((c.consult / inboxForRow) * 100).toFixed(2) : "0.00"}%
                            </td>
                            <td className="py-2 text-right">
                              <p className="font-semibold text-slate-700">{c.deposit}</p>
                              <p className="text-[11px] text-slate-400">฿{fmtTHB(c.depositValue)}</p>
                            </td>
                            <td className="py-2 text-right text-emerald-600 font-semibold">
                              {inboxForRow > 0 ? ((c.deposit / inboxForRow) * 100).toFixed(2) : "0.00"}%
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                  <tr className="border-t border-slate-200">
                    <td className="py-2 font-semibold text-slate-700">รวมทุกหัตถการ</td>
                    <td className="py-2 text-right font-semibold text-slate-700">{fmtTHB(closeTableAllInbox)}</td>
                    <td className="py-2 text-right">
                      <p className="font-semibold text-slate-700">{closeCountsLive.all.consult}</p>
                      <p className="text-[11px] text-slate-400">฿{fmtTHB(closeCountsLive.all.consultValue)}</p>
                    </td>
                    <td className="py-2 text-right font-semibold text-emerald-600">
                      {closeTableAllInbox > 0 ? ((closeCountsLive.all.consult / closeTableAllInbox) * 100).toFixed(2) : "0.00"}%
                    </td>
                    <td className="py-2 text-right">
                      <p className="font-semibold text-slate-700">{closeCountsLive.all.deposit}</p>
                      <p className="text-[11px] text-slate-400">฿{fmtTHB(closeCountsLive.all.depositValue)}</p>
                    </td>
                    <td className="py-2 text-right font-semibold text-emerald-600">
                      {closeTableAllInbox > 0 ? ((closeCountsLive.all.deposit / closeTableAllInbox) * 100).toFixed(2) : "0.00"}%
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-slate-400 mt-2">
              กรองตามช่วงวันที่ที่เลือกจริงแล้วทั้งตาราง (Inbox จาก Facebook API จริง · ปิดปรึกษา/ปิดมัดจำคำนวณสดจากไฟล์ธุรกรรม Data_S45_Clinic
              เฉพาะเคสที่ "Date" อยู่ในช่วงที่เลือก) · Inter ยังไม่มีข้อมูลปิดปรึกษา/ปิดมัดจำ (ไฟล์ธุรกรรมไม่ได้แท็ก Inter แยกเป็นหัตถการของตัวเอง) —
              "รวมทุกหัตถการ" ด้านบนจึงรวมเฉพาะ 4 หัตถการที่มีข้อมูลจริงเท่านั้น
            </p>
          </div>
          )}

          {/* Option การกระตุ้นยอดขาย */}
          <div className="rounded-xl border border-violet-100 bg-violet-50/40 p-4 mb-5">
            <div className="flex items-center gap-2 mb-3">
              <Rocket size={14} className="text-violet-500" />
              <h3 className="text-sm font-semibold text-slate-700">Option การกระตุ้นยอดขายให้มากขึ้น</h3>
            </div>

            {/* Option 1: เพิ่มงบ / เพิ่มคน แยกแท็บ */}
            <div className="bg-white rounded-lg border border-violet-100 p-4 mb-4">
              <p className="text-sm font-semibold text-slate-700 mb-1">1. เพิ่มงบโฆษณา หรือ เพิ่มจำนวนคนตอบ (แยกตามหัตถการ)</p>

              <div className="flex gap-2 mb-3">
                <button
                  onClick={() => setGrowthTab("budget")}
                  className={`text-xs font-medium px-3 py-1.5 rounded-lg border ${
                    growthTab === "budget" ? "bg-teal-600 text-white border-teal-600" : "bg-white text-slate-500 border-slate-200"
                  }`}
                >
                  เพิ่มงบโฆษณา
                </button>
                <button
                  onClick={() => setGrowthTab("staff")}
                  className={`text-xs font-medium px-3 py-1.5 rounded-lg border ${
                    growthTab === "staff" ? "bg-teal-600 text-white border-teal-600" : "bg-white text-slate-500 border-slate-200"
                  }`}
                >
                  เพิ่มคนตอบ
                </button>
              </div>

              {growthTab === "budget" ? (
                <>
                  <p className="text-xs text-slate-500 mb-3">
                    สมมติฐาน: เพิ่มงบ Ads กี่ % Inbox จะโตตาม % นั้น แต่คนตอบยังคงที่ 5 คน ภาระงาน/คนจึงเพิ่มขึ้น ทำให้ Close Rate ลดลงบ้างตาม
                    elasticity ({REALLOC_ELASTICITY}) ⇒ ยอดปิดปรึกษา/ปิดมัดจำโตน้อยกว่า %งบที่เพิ่มเล็กน้อย (diminishing returns)
                  </p>
                  <div className="flex items-center gap-3 mb-4">
                    <label className="text-xs text-slate-500 shrink-0">เพิ่มงบโฆษณา:</label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={budgetBoostPct}
                      onChange={(e) => setBudgetBoostPct(Number(e.target.value))}
                      className="flex-1 accent-violet-500"
                    />
                    <span className="text-sm font-bold text-violet-700 w-14 text-right">+{budgetBoostPct}%</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-[11px] text-slate-400 border-b border-slate-100">
                          <th className="pb-2 font-medium">หัตถการ</th>
                          <th className="pb-2 font-medium text-right">ปิดปรึกษาปัจจุบัน → ใหม่</th>
                          <th className="pb-2 font-medium text-right">ปิดมัดจำปัจจุบัน → ใหม่</th>
                        </tr>
                      </thead>
                      <tbody>
                        {budgetOnlyRows.map((r) => (
                          <tr key={r.key} className="border-b border-slate-50 last:border-0">
                            <td className="py-2 text-slate-600">{r.label}</td>
                            <td className="py-2 text-right text-slate-600">
                              <p>
                                {r.consultNow} → <span className="font-semibold text-violet-600">{r.consultNew.toFixed(1)}</span>
                              </p>
                              <p className="text-[11px] text-slate-400">
                                ฿{fmtTHB(r.consultValueNow)} → ฿{fmtTHB(r.consultValueNew)}
                              </p>
                            </td>
                            <td className="py-2 text-right text-slate-600">
                              <p>
                                {r.depositNow} → <span className="font-semibold text-violet-600">{r.depositNew.toFixed(1)}</span>
                              </p>
                              <p className="text-[11px] text-slate-400">
                                ฿{fmtTHB(r.depositValueNow)} → ฿{fmtTHB(r.depositValueNew)}
                              </p>
                            </td>
                          </tr>
                        ))}
                        <tr className="border-t border-slate-200">
                          <td className="py-2 font-semibold text-slate-700">รวมทุกหัตถการ</td>
                          <td className="py-2 text-right font-semibold text-violet-700">
                            <p>
                              {budgetOnlyTotal.consultNow} → {budgetOnlyTotal.consultNew.toFixed(1)} (
                              {(((budgetOnlyTotal.consultNew - budgetOnlyTotal.consultNow) / budgetOnlyTotal.consultNow) * 100).toFixed(1)}%)
                            </p>
                            <p className="text-[11px] font-normal text-violet-400">
                              ฿{fmtTHB(budgetOnlyTotal.consultValueNow)} → ฿{fmtTHB(budgetOnlyTotal.consultValueNew)} (+฿
                              {fmtTHB(budgetOnlyTotal.consultValueNew - budgetOnlyTotal.consultValueNow)})
                            </p>
                          </td>
                          <td className="py-2 text-right font-semibold text-violet-700">
                            <p>
                              {budgetOnlyTotal.depositNow} → {budgetOnlyTotal.depositNew.toFixed(1)} (
                              {(((budgetOnlyTotal.depositNew - budgetOnlyTotal.depositNow) / budgetOnlyTotal.depositNow) * 100).toFixed(1)}%)
                            </p>
                            <p className="text-[11px] font-normal text-violet-400">
                              ฿{fmtTHB(budgetOnlyTotal.depositValueNow)} → ฿{fmtTHB(budgetOnlyTotal.depositValueNew)} (+฿
                              {fmtTHB(budgetOnlyTotal.depositValueNew - budgetOnlyTotal.depositValueNow)})
                            </p>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-xs text-slate-500 mb-3">
                    สมมติฐาน: เพิ่มจำนวนคนตอบกี่ % โดยงบโฆษณา/ปริมาณ Inbox คงเดิม ภาระงาน/คนจะลดลง ทำให้ Close Rate เพิ่มขึ้นตาม elasticity (
                    {REALLOC_ELASTICITY}) ⇒ ยอดปิดปรึกษา/ปิดมัดจำเพิ่มขึ้น แต่ปริมาณ Inbox ไม่เพิ่ม (เพดานจำกัดที่จำนวน Lead เท่าเดิม)
                  </p>
                  <div className="flex items-center gap-3 mb-4">
                    <label className="text-xs text-slate-500 shrink-0">เพิ่มคนตอบ:</label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={staffBoostPct}
                      onChange={(e) => setStaffBoostPct(Number(e.target.value))}
                      className="flex-1 accent-violet-500"
                    />
                    <span className="text-sm font-bold text-violet-700 w-14 text-right">+{staffBoostPct}%</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-[11px] text-slate-400 border-b border-slate-100">
                          <th className="pb-2 font-medium">หัตถการ</th>
                          <th className="pb-2 font-medium text-right">ปิดปรึกษาปัจจุบัน → ใหม่</th>
                          <th className="pb-2 font-medium text-right">ปิดมัดจำปัจจุบัน → ใหม่</th>
                        </tr>
                      </thead>
                      <tbody>
                        {staffOnlyRows.map((r) => (
                          <tr key={r.key} className="border-b border-slate-50 last:border-0">
                            <td className="py-2 text-slate-600">{r.label}</td>
                            <td className="py-2 text-right text-slate-600">
                              <p>
                                {r.consultNow} → <span className="font-semibold text-violet-600">{r.consultNew.toFixed(1)}</span>
                              </p>
                              <p className="text-[11px] text-slate-400">
                                ฿{fmtTHB(r.consultValueNow)} → ฿{fmtTHB(r.consultValueNew)}
                              </p>
                            </td>
                            <td className="py-2 text-right text-slate-600">
                              <p>
                                {r.depositNow} → <span className="font-semibold text-violet-600">{r.depositNew.toFixed(1)}</span>
                              </p>
                              <p className="text-[11px] text-slate-400">
                                ฿{fmtTHB(r.depositValueNow)} → ฿{fmtTHB(r.depositValueNew)}
                              </p>
                            </td>
                          </tr>
                        ))}
                        <tr className="border-t border-slate-200">
                          <td className="py-2 font-semibold text-slate-700">รวมทุกหัตถการ</td>
                          <td className="py-2 text-right font-semibold text-violet-700">
                            <p>
                              {staffOnlyTotal.consultNow} → {staffOnlyTotal.consultNew.toFixed(1)} (
                              {(((staffOnlyTotal.consultNew - staffOnlyTotal.consultNow) / staffOnlyTotal.consultNow) * 100).toFixed(1)}%)
                            </p>
                            <p className="text-[11px] font-normal text-violet-400">
                              ฿{fmtTHB(staffOnlyTotal.consultValueNow)} → ฿{fmtTHB(staffOnlyTotal.consultValueNew)} (+฿
                              {fmtTHB(staffOnlyTotal.consultValueNew - staffOnlyTotal.consultValueNow)})
                            </p>
                          </td>
                          <td className="py-2 text-right font-semibold text-violet-700">
                            <p>
                              {staffOnlyTotal.depositNow} → {staffOnlyTotal.depositNew.toFixed(1)} (
                              {(((staffOnlyTotal.depositNew - staffOnlyTotal.depositNow) / staffOnlyTotal.depositNow) * 100).toFixed(1)}%)
                            </p>
                            <p className="text-[11px] font-normal text-violet-400">
                              ฿{fmtTHB(staffOnlyTotal.depositValueNow)} → ฿{fmtTHB(staffOnlyTotal.depositValueNew)} (+฿
                              {fmtTHB(staffOnlyTotal.depositValueNew - staffOnlyTotal.depositValueNow)})
                            </p>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>

            {/* Option 2 */}
            <div className="bg-white rounded-lg border border-violet-100 p-4">
              <p className="text-sm font-semibold text-slate-700 mb-1">2. ขยายทีม Online ตอบ Inbox เฉพาะกลุ่ม (4+4 คน)</p>
              <p className="text-xs text-slate-500 mb-3">
                กระจายทีม Online ใหม่: Nose Open + Semi Open = 4 คน, ยกคิ้ว + เสริมหน้าอก = 4 คน (รวม 8 คน เพิ่มจากทีมเดิม 5 คนตอบทุกหัตถการรวมกัน ~
                {fmtTHB(currentWorkloadPerAgent)} Inbox/คน) — สมมติฐาน: Close Rate แปรผกผันกับภาระงาน (Inbox/คน) แบบลดทอน
              </p>
              <div className="overflow-x-auto mb-3">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] text-slate-400 border-b border-slate-100">
                      <th className="pb-2 font-medium">กลุ่ม</th>
                      <th className="pb-2 font-medium text-right">คน</th>
                      <th className="pb-2 font-medium text-right">Inbox/คน</th>
                      <th className="pb-2 font-medium text-right">ปิดปรึกษา → ใหม่</th>
                      <th className="pb-2 font-medium text-right">ปิดมัดจำ → ใหม่</th>
                    </tr>
                  </thead>
                  <tbody>
                    {option2Groups.map((g) => (
                      <tr key={g.key} className="border-b border-slate-50 last:border-0">
                        <td className="py-2 text-slate-600">{g.label}</td>
                        <td className="py-2 text-right text-slate-500">{g.agents}</td>
                        <td className="py-2 text-right text-slate-500">{fmtTHB(g.workloadPerAgent)}</td>
                        <td className="py-2 text-right text-slate-600">
                          <p>
                            {g.consultNow} →{" "}
                            <span className={`font-semibold ${g.multiplier >= 1 ? "text-emerald-600" : "text-rose-500"}`}>
                              {g.consultNew.toFixed(1)}
                            </span>
                          </p>
                          <p className="text-[11px] text-slate-400">
                            ฿{fmtTHB(g.consultValueNow)} → ฿{fmtTHB(g.consultValueNew)}
                          </p>
                        </td>
                        <td className="py-2 text-right text-slate-600">
                          <p>
                            {g.depositNow} →{" "}
                            <span className={`font-semibold ${g.multiplier >= 1 ? "text-emerald-600" : "text-rose-500"}`}>
                              {g.depositNew.toFixed(1)}
                            </span>
                          </p>
                          <p className="text-[11px] text-slate-400">
                            ฿{fmtTHB(g.depositValueNow)} → ฿{fmtTHB(g.depositValueNew)}
                          </p>
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t border-slate-200">
                      <td className="py-2 font-semibold text-slate-700" colSpan={2}>
                        รวม
                      </td>
                      <td className="py-2"></td>
                      <td className="py-2 text-right font-semibold text-emerald-600">
                        <p>
                          {option2Total.consultNow.toFixed(0)} → {option2Total.consultNew.toFixed(1)} (
                          {(((option2Total.consultNew - option2Total.consultNow) / option2Total.consultNow) * 100).toFixed(1)}%)
                        </p>
                        <p className="text-[11px] font-normal text-emerald-500">
                          ฿{fmtTHB(option2Total.consultValueNow)} → ฿{fmtTHB(option2Total.consultValueNew)} (+฿
                          {fmtTHB(option2Total.consultValueNew - option2Total.consultValueNow)})
                        </p>
                      </td>
                      <td className="py-2 text-right font-semibold text-emerald-600">
                        <p>
                          {option2Total.depositNow.toFixed(0)} → {option2Total.depositNew.toFixed(1)} (
                          {(((option2Total.depositNew - option2Total.depositNow) / option2Total.depositNow) * 100).toFixed(1)}%)
                        </p>
                        <p className="text-[11px] font-normal text-emerald-500">
                          ฿{fmtTHB(option2Total.depositValueNow)} → ฿{fmtTHB(option2Total.depositValueNew)} (+฿
                          {fmtTHB(option2Total.depositValueNew - option2Total.depositValueNow)})
                        </p>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-slate-400">
                ทั้งสองกลุ่มมีภาระงานต่อคนต่ำกว่าค่าเฉลี่ยเดิม (1,440 Inbox/คน) จึง Close Rate เพิ่มขึ้นทั้งคู่ — กลุ่ม Nose Open+Semi Open เหลือ
                ~978 Inbox/คน และกลุ่มยกคิ้ว+เสริมหน้าอก เหลือ ~822 Inbox/คน รวมสุทธิ (8 คน) คาดว่ายอดปิดปรึกษาเพิ่มขึ้น ~19% และปิดมัดจำเพิ่มขึ้น
                ~20%
              </p>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 flex items-start gap-2 text-xs text-slate-500">
            <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />
            <p>
              ทุก Option เป็น<span className="font-semibold">แบบจำลองประมาณการ</span>ตามสมมติฐานที่ระบุไว้ (เพิ่มงบ: Inbox โตตาม %งบ แต่คนตอบคงที่ทำให้
              Close Rate ลดลงบ้าง · เพิ่มคนตอบ: Inbox คงเดิม แต่ Close Rate เพิ่มขึ้นจากภาระงาน/คนที่ลดลง · Option 2: Close Rate
              แปรผกผันกับภาระงาน/คน แบบลดทอน กำลัง {REALLOC_ELASTICITY} ทุกกรณีใช้ elasticity เดียวกัน) ไม่ใช่ตัวเลขที่รับประกันผลจริง
              ควรทดลองจริงและวัดผลเทียบกับประมาณการนี้
            </p>
          </div>
        </div>
)}

        {/* ---- NEW: Bad Lead รวมทุกหัตถการ — กรกฎาคม 2569 ---- */}
{activePage === "inbox" && (
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm mt-6">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <XCircle size={16} />
            </div>
            <h2 className="text-sm font-semibold text-slate-700">Bad Lead (แชทขยะ/กดลิงก์) รวมทุกหัตถการ — กรกฎาคม 2569</h2>
          </div>
          <p className="text-xs text-slate-400 mb-5 ml-10">รวมทุกหัตถการ ไม่แยกตามหัตถการ (ไฟล์ต้นฉบับไม่ได้ระบุหัตถการต่อแชท)</p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            <div className="bg-rose-50 rounded-xl p-3">
              <p className="text-[11px] text-rose-500 font-medium mb-0.5">Bad Lead ทั้งเดือน</p>
              <p className="text-xl font-bold text-rose-700">{BAD_LEAD_TOTAL} แชท</p>
            </div>
            <div className="bg-rose-50 rounded-xl p-3">
              <p className="text-[11px] text-rose-500 font-medium mb-0.5">% จาก Inbox ทั้งหมด</p>
              <p className="text-xl font-bold text-rose-700">{((BAD_LEAD_TOTAL / FUNNEL_DATA_JUL.all.inbox) * 100).toFixed(2)}%</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-[11px] text-slate-500 font-medium mb-0.5">กลุ่มอายุที่ระบุได้</p>
              <p className="text-sm font-bold text-slate-700">ไม่สามารถระบุได้แน่ชัด</p>
            </div>
            <div className="bg-amber-50 rounded-xl p-3">
              <p className="text-[11px] text-amber-600 font-medium mb-0.5">ลักษณะบัญชีส่วนใหญ่</p>
              <p className="text-sm font-bold text-amber-700">ไม่มีรูป/บอทที่น่าจะเป็นไปได้</p>
            </div>
          </div>

          {/* Sample gallery */}
          <p className="text-xs font-medium text-slate-500 mb-2">
            ตัวอย่าง 6 จาก {BAD_LEAD_TOTAL} แชท (ไม่แสดงทั้งหมดเพราะไฟล์ภาพจะใหญ่เกินไปสำหรับแดชบอร์ด)
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-5">
            {BAD_LEAD_SAMPLES.map((src, i) => (
              <img key={i} src={src} alt={`Bad lead sample ${i + 1}`} className="w-full h-auto rounded-lg border border-slate-100 object-cover" />
            ))}
          </div>

          {/* Analysis */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="rounded-xl border border-slate-100 p-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-2">กลุ่มอายุ</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                จากตัวอย่างที่ตรวจสอบ บัญชีส่วนใหญ่ใช้รูปโปรไฟล์เริ่มต้น (ไม่มีรูปจริง) และไม่มีข้อมูลประวัติ/ไบโอที่จะระบุช่วงอายุได้อย่างแม่นยำ
                จึง <span className="font-semibold">ไม่สามารถสรุปกลุ่มอายุที่ชัดเจนได้</span> จากข้อมูลแชทเพียงอย่างเดียว หากต้องการข้อมูลกลุ่มอายุที่แม่นยำ
                แนะนำให้ดึงจาก Meta Ads Manager (Breakdown by Age) ของแคมเปญที่มี Bad Lead สูง แทนการอ่านจากภาพแชท
              </p>
            </div>
            <div className="rounded-xl border border-slate-100 p-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-2">ลักษณะการโต้ตอบ</h3>
              <ul className="space-y-1.5 text-sm text-slate-600 list-disc list-inside">
                <li>ข้อความสั้นมาก เช่น ทักทายคำเดียว หรือไม่มีข้อความเลยหลังกดลิงก์</li>
                <li>ไม่มีการถามคำถามเกี่ยวกับหัตถการ ราคา หรือความสนใจใดๆ ที่เกี่ยวกับคลินิก</li>
                <li>ไม่ตอบกลับหลังข้อความอัตโนมัติของเพจ (one-way conversation)</li>
                <li>บางส่วนมีลิงก์/ข้อความที่ไม่เกี่ยวข้องกับธุรกิจคลินิกเลย เข้าข่ายบอทหรือสแปม</li>
              </ul>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 flex items-start gap-2 text-xs text-slate-500">
            <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />
            <p>
              วิเคราะห์จากการสุ่มตรวจสอบตัวอย่างภาพแชทที่แนบมา ({BAD_LEAD_TOTAL} ภาพ) ไม่ใช่การวิเคราะห์ด้วยระบบอัตโนมัติ ตัวเลขกลุ่มอายุ/เพศที่แม่นยำ
              ควรอ้างอิงจาก Meta Ads Manager โดยตรง
            </p>
          </div>
        </div>
)}

        {/* ---- NEW: แผนการดำเนินงานลด Bad Lead ---- */}
{activePage === "inbox" && (
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm mt-6">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <ClipboardCheck size={16} />
            </div>
            <h2 className="text-sm font-semibold text-slate-700">แผนการดำเนินงานของ Digital ต่อการลดจำนวน Bad Lead</h2>
          </div>
          <p className="text-xs text-slate-400 mb-5 ml-10">
            Digital Team ได้พูดคุยและตั้งใจลดจำนวน Bad Lead ด้วยขั้นตอนดังต่อไปนี้
          </p>

          <div className="space-y-3">
            <div className="flex items-start gap-3 rounded-xl border border-slate-100 p-4">
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <XCircle size={16} />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700">1. Mark Lead เป็น "คุณสมบัติไม่ครบ"</p>
                <p className="text-sm text-slate-600 mt-0.5">เมื่อเกิด Bad Lead ขึ้น ให้ทำการ Mark Lead ให้เป็นสถานะ "คุณสมบัติไม่ครบ" ทันที</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-xl border border-slate-100 p-4">
              <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <Ban size={16} />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700">2. บล็อกและแบนออกจากเพจ</p>
                <p className="text-sm text-slate-600 mt-0.5">ดำเนินการบล็อกและแบนบัญชีดังกล่าวออกจากเพจ เพื่อป้องกันไม่ให้กลับมาทักซ้ำ</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-xl border border-slate-100 p-4">
              <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                <ArrowRightCircle size={16} />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700">3. ย้ายแชทไปยัง Spam Chat</p>
                <p className="text-sm text-slate-600 mt-0.5">ย้ายแชทของ Bad Lead ไปยังกล่อง Spam Chat เพื่อแยกออกจากแชทเคสจริง</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-xl border border-slate-100 p-4">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <Search size={16} />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700">4. ค้นหา Tag จากทีม Online ใน Plus Connect</p>
                <p className="text-sm text-slate-600 mt-0.5">
                  ทีม Digital ค้นหา Tag ที่ทีม Online ติดไว้ใน Plus Connect เพื่อช่วยระบุและคัดกรอง Bad Lead ได้แม่นยำขึ้นในขั้นตอนถัดไป
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 flex items-start gap-2 text-xs text-slate-500">
            <Layers size={14} className="text-slate-400 mt-0.5 shrink-0" />
            <p>แผนงานนี้เป็นแนวทางที่ทีม Digital ตกลงร่วมกัน ยังไม่ใช่ผลการดำเนินงานจริง — ใช้เป็นแนวทางติดตามผลเทียบกับจำนวน Bad Lead ในรอบถัดไป</p>
          </div>
        </div>
)}

        {/* ---- NEW: Solution กระตุ้นยอด Inbox Nose Open ด้วยกลยุทธ์กองทัพมด ---- */}
{activePage === "inbox" && (
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm mt-6">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Zap size={16} />
            </div>
            <h2 className="text-sm font-semibold text-slate-700">Solution: กระตุ้นยอด Inbox Nose Open ด้วยกลยุทธ์กองทัพมด</h2>
          </div>
          <p className="text-xs text-slate-400 mb-5 ml-10">แนวทางที่ทีม Digital ดำเนินการแก้ไขปัญหายอด Inbox ของ Nose Open</p>

          <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-4 mb-5">
            <p className="text-sm text-slate-700 leading-relaxed">
              ทีม Digital ใช้กลยุทธ์ <span className="font-semibold text-amber-700">"กองทัพมด"</span> — สร้างโฆษณา (Ads) จำนวนมากในเวลาสั้นๆ
              โดยนำ <span className="font-semibold">Organic Engage Post</span> ที่ได้รับยอด Engagement ต่างๆ ค่อนข้างดีอยู่แล้วตามธรรมชาติ
              มาทำเป็น Ads ในรูปแบบ <span className="font-semibold">Messenger</span> เพิ่มเติมจากทีม Digital เอง เพื่อกระตุ้นยอด Inbox ของ Nose Open
              ให้เพิ่มขึ้นในระยะเวลาอันสั้น โดยอาศัยโพสต์ที่พิสูจน์แล้วว่าคนสนใจ/มีปฏิสัมพันธ์ดีอยู่แล้ว มาช่วยลดความเสี่ยงเรื่องครีเอทีฟที่ไม่ทราบผลล่วงหน้า
            </p>
          </div>

          <p className="text-xs font-medium text-slate-500 mb-2">โพสต์ / วิดีโอ Organic ที่นำมาทำ Ads Messenger ({ANT_ARMY_LINKS.length} ลิงก์)</p>
          <div className="grid sm:grid-cols-2 gap-2">
            {ANT_ARMY_LINKS.map((url, i) => (
              <a
                key={url}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs text-blue-600 hover:text-blue-700 hover:underline bg-slate-50 rounded-lg px-3 py-2 truncate"
              >
                <ExternalLink size={12} className="shrink-0" />
                <span className="truncate">โพสต์ #{i + 1} — {url.replace("https://www.facebook.com/", "")}</span>
              </a>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 flex items-start gap-2 text-xs text-slate-500">
            <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />
            <p>
              ลิงก์เหล่านี้เป็นลิงก์ไปยัง Facebook (โพสต์/Insight) ซึ่งต้องล็อกอินเพื่อดูเนื้อหา ระบบไม่สามารถเข้าถึงหรือดึงรูปภาพ/วิดีโอจากลิงก์เหล่านี้มา
              แสดงในแดชบอร์ดได้โดยอัตโนมัติ (Facebook บล็อกการเข้าถึงแบบอัตโนมัติ) จึงแสดงเป็นรายการลิงก์ให้กดเข้าไปดูโดยตรงแทน
            </p>
          </div>
        </div>
)}

        {/* ---- NEW: เคสเด่นคุณหมอ เพื่อกระตุ้น Inbox Nose Open ---- */}
{activePage === "doctors" && (
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm mt-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-pink-50 text-pink-600 flex items-center justify-center">
                <UserCircle2 size={16} />
              </div>
              <h2 className="text-sm font-semibold text-slate-700">เคสเด่นคุณหมอ — กระตุ้น Inbox Nose Open</h2>
            </div>
            <Select icon={Stethoscope} value={heroCaseFilter} onChange={setHeroCaseFilter} options={heroCaseOptions} />
          </div>
          <p className="text-xs text-slate-400 mb-5 ml-10">
            {selectedHeroDoctor.label} · {selectedHeroDoctor.cases.length} เคส — เลือกคุณหมอจาก Dropdown เพื่อดูเคสเด่นของแต่ละคน
          </p>

          <div className="grid sm:grid-cols-2 gap-3">
            {selectedHeroDoctor.cases.map((c, i) => (
              <a
                key={i}
                href={c.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex flex-col rounded-xl border border-slate-100 overflow-hidden hover:border-pink-200 transition-colors"
              >
                <div className="aspect-[4/3] bg-gradient-to-br from-pink-50 to-slate-50 flex flex-col items-center justify-center gap-2">
                  <ImageIcon size={28} className="text-pink-300" />
                  <span className="text-[11px] text-slate-400">รูปภาพเคสจากโพสต์ Facebook</span>
                </div>
                <div className="p-3">
                  <p className="text-sm font-semibold text-slate-700">
                    {selectedHeroDoctor.label} · เคส{c.patient}
                  </p>
                  <p className="text-xs text-blue-600 group-hover:underline flex items-center gap-1 mt-1">
                    <ExternalLink size={11} /> เปิดดูโพสต์ต้นฉบับ
                  </p>
                </div>
              </a>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 flex items-start gap-2 text-xs text-slate-500">
            <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />
            <p>
              ระบบไม่สามารถดึงรูปภาพจริงจากโพสต์ Facebook มาแสดงในแดชบอร์ดได้โดยอัตโนมัติ (Facebook บล็อกการเข้าถึงแบบอัตโนมัติ) การ์ดด้านบนจึง
              เป็นตัวแทนลิงก์ให้กดเข้าไปดูรูป/วิดีโอเคสจริงที่โพสต์นั้นโดยตรง — หากต้องการให้รูปเคสแสดงในแดชบอร์ดจริง สามารถ Screenshot รูปจากโพสต์
              แล้วอัปโหลดไฟล์ภาพมาให้ฝังแทนได้
            </p>
          </div>
        </div>
)}

        {/* ---- NEW: Digital Plan Ads Hero July 26 แยกตามหมอ ---- */}
{activePage === "ads" && (
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm mt-6">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Zap size={16} />
            </div>
            <h2 className="text-sm font-semibold text-slate-700">Digital Plan: Ads Hero July 26 แยกตามหมอ</h2>
          </div>
          <p className="text-xs text-slate-400 mb-5 ml-10">
            นำเคสเด่นของแต่ละคุณหมอมากระตุ้นให้เกิด Viral อีกครั้ง เพื่อเพิ่มปริมาณ Inbox ของ Nose Open ให้มากขึ้น
          </p>

          <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-4 mb-5">
            <p className="text-sm text-slate-700 leading-relaxed">
              ใช้แนวทางเดียวกับ <span className="font-semibold">"กองทัพมด"</span> — นำเคสเด่น (Hero Case) ของคุณหมอแต่ละคนที่มี Engagement
              ดีอยู่แล้วตามธรรมชาติ มาทำเป็น Ads รูปแบบ Messenger ซ้ำอีกรอบในเดือนกรกฎาคม เพื่อกระตุ้นให้เกิดกระแส Viral รอบใหม่ และดันปริมาณ
              Inbox ของ Nose Open ให้เพิ่มขึ้น โดยแยกทำเป็นชุดโฆษณาตามคุณหมอแต่ละคน เพื่อให้วัดผลเปรียบเทียบได้ว่าเคสของหมอคนไหนกระตุ้น Inbox ได้ดีที่สุด
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            {Object.entries(DOCTOR_HERO_CASES).map(([key, d]) => (
              <div key={key} className="rounded-xl border border-slate-100 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <UserCircle2 size={14} className="text-pink-500" />
                  <p className="text-sm font-semibold text-slate-700">{d.label}</p>
                </div>
                <ul className="space-y-1 text-xs text-slate-500 list-disc list-inside">
                  {d.cases.map((c, i) => (
                    <li key={i}>
                      เคส{c.patient} — Re-run เป็น Ads Messenger ใหม่ กรกฎาคม 2026
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 flex items-start gap-2 text-xs text-slate-500">
            <Layers size={14} className="text-slate-400 mt-0.5 shrink-0" />
            <p>แผนงานนี้เป็นแนวทางที่ทีม Digital วางไว้สำหรับเดือนกรกฎาคม 2026 ยังไม่ใช่ผลการดำเนินงานจริง — ใช้ติดตามผล Inbox Nose Open เทียบกับก่อนเริ่ม Re-run</p>
          </div>
        </div>
)}

        {/* ---- NEW: Ads Plan Aug 2026 ---- */}
{activePage === "ads" && (
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm mt-6">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center">
              <Rocket size={16} />
            </div>
            <h2 className="text-sm font-semibold text-slate-700">แผนโฆษณา Digital — Ads Plan Aug 2026</h2>
          </div>
          <p className="text-xs text-slate-400 mb-5 ml-10">แผนการดำเนินงานโฆษณาเดือนสิงหาคม 2026</p>

          {/* KPI targets */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
            <div className="rounded-xl border border-violet-100 bg-violet-50/60 p-3">
              <p className="text-[11px] text-violet-500 font-medium mb-0.5">เป้าหมาย CPR</p>
              <p className="text-xl font-bold text-violet-700">≤ ฿300</p>
              <p className="text-[11px] text-violet-400 mt-0.5">ต่อแชท</p>
            </div>
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3">
              <p className="text-[11px] text-emerald-600 font-medium mb-0.5">เป้าหมาย Quality Lead</p>
              <p className="text-xl font-bold text-emerald-700">≥ 10%</p>
              <p className="text-[11px] text-emerald-500 mt-0.5">ของแชททั้งหมดต่อเดือน</p>
            </div>
            <div className="rounded-xl border border-sky-100 bg-sky-50/60 p-3">
              <p className="text-[11px] text-sky-600 font-medium mb-0.5">เป้าหมายปริมาณ Inbox</p>
              <p className="text-xl font-bold text-sky-700">9,600</p>
              <p className="text-[11px] text-sky-500 mt-0.5">Inbox ต่อเดือน รวมทุกหัตถการ · เฉลี่ย {fmtTHB(9600 / 31)}/วัน</p>
            </div>
          </div>

          {/* Plan groups */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="rounded-xl border border-slate-100 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Rocket size={14} className="text-violet-500" />
                <h3 className="text-sm font-semibold text-slate-700">รูปแบบโฆษณา &amp; งบประมาณ</h3>
              </div>
              <ul className="space-y-1.5 text-sm text-slate-600 list-disc list-inside">
                <li>
                  ปล่อย Ads รูปแบบ <span className="font-semibold">Sale + Messenger</span> และ{" "}
                  <span className="font-semibold">Engagement + Messenger</span>
                </li>
                <li>
                  เพิ่ม <span className="font-semibold">Engagement Post</span> ทุกครั้งที่มีการขึ้น Ads ราคา ทั้งแบบ{" "}
                  <span className="font-semibold">Dark Post</span> และ <span className="font-semibold">Page Post</span>
                </li>
                <li>เฉลี่ยงบ Ads ให้พอดีกับหัตถการ และจำนวนคุณหมอที่ดูแลหัตถการนั้นๆ</li>
                <li>
                  เพิ่ม Engage Post ในส่วนของเคส<span className="font-semibold">คุณหมอตี้</span> (แบบไม่เห็นหน้าคุณหมอตี้หรือไม่มีภาพคุณหมอตี้)
                </li>
              </ul>
            </div>

            <div className="rounded-xl border border-slate-100 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Users size={14} className="text-emerald-500" />
                <h3 className="text-sm font-semibold text-slate-700">กลุ่มเป้าหมาย</h3>
              </div>
              <ul className="space-y-1.5 text-sm text-slate-600 list-disc list-inside">
                <li>
                  ปรับกลุ่มเป้าหมายเป็น{" "}
                  <span className="font-semibold">Interest + Behavior + Interest Luxury Brandname</span>
                </li>
                <li>
                  <span className="font-semibold">Nose Open</span> — กลุ่มอายุ 25-45 ปี ใช้รูปแบบ Specific Ads (ไม่ใช้ Advantage+)
                </li>
                <li>
                  <span className="font-semibold">Semi-Open</span> — กลุ่มอายุ 25-45 ปี ใช้กลุ่ม Interest Self Confidence + Shopping
                </li>
                <li>
                  <span className="font-semibold">Brow-lift</span> — ใช้กลุ่ม Interest Anti-Aging, Luxury Brandname
                </li>
                <li>
                  <span className="font-semibold">Face-Lift</span> — ใช้กลุ่ม Interest Anti-Aging, Luxury Brand
                </li>
                <li>
                  <span className="font-semibold">Breast</span> — ใช้กลุ่ม Interest Female Body Building
                </li>
                <li>
                  <span className="font-semibold">Inter</span> — ใช้กลุ่มหลักตามแบบของไทย ส่วนกลุ่ม Scale ใช้ Interest High Value
                  Purchase (Indo) + Location Indonesia
                </li>
              </ul>
            </div>

            <div className="rounded-xl border border-slate-100 p-4">
              <div className="flex items-center gap-2 mb-2">
                <MapPin size={14} className="text-rose-500" />
                <h3 className="text-sm font-semibold text-slate-700">พื้นที่การยิงโฆษณา</h3>
              </div>
              <ul className="space-y-1.5 text-sm text-slate-600 list-disc list-inside">
                <li>
                  <span className="font-semibold">กลุ่มระยะใกล้</span> — Location The Klinique รัศมี{" "}
                  <span className="font-semibold">20-40 กม.</span>
                </li>
                <li>
                  <span className="font-semibold">กลุ่มระยะไกล</span> — Location ประเทศไทย เน้นจังหวัด{" "}
                  <span className="font-semibold">เชียงใหม่, ขอนแก่น, อุบลราชธานี, พัทยา, ภูเก็ต, กรุงเทพฯ</span>
                </li>
              </ul>
            </div>

            <div className="rounded-xl border border-slate-100 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Calendar size={14} className="text-amber-500" />
                <h3 className="text-sm font-semibold text-slate-700">Workflow การ Monitor &amp; Optimize</h3>
              </div>
              <ul className="space-y-1.5 text-sm text-slate-600 list-disc list-inside">
                <li>
                  ระยะ Approve <span className="font-semibold">1 วัน</span> · ระยะรัน{" "}
                  <span className="font-semibold">3 วัน</span> · ระยะผ่านการเรียนรู้ (Learning) <span className="font-semibold">7 วัน</span>
                </li>
                <li>วันที่ 1: ปล่อย Ads ใหม่ + Re-new Ads เดิม</li>
                <li>
                  วันที่ 2: เช็คค่า Ads ทั้งหมด รวมถึง Ads ที่ทำงานผิดปกติ / ตัดเงินผิดปกติ / รันแล้วไม่มี Result เพื่อกำหนดวันถัดไปว่าจะ
                  Re-new ตัวเดิม หรือลบเพื่อทำตัวใหม่แทน (จากตัวที่เพิ่ง Re-new มา)
                </li>
              </ul>
            </div>

            <div className="rounded-xl border border-slate-100 p-4 sm:col-span-2">
              <div className="flex items-center gap-2 mb-2">
                <ClipboardCheck size={14} className="text-indigo-500" />
                <h3 className="text-sm font-semibold text-slate-700">Tracking &amp; ความแม่นยำของข้อมูล</h3>
              </div>
              <ul className="space-y-1.5 text-sm text-slate-600 list-disc list-inside">
                <li>
                  Track ข้อมูล Lead ให้ตรงกลุ่มจาก Meta Business Suite โดยอ้างอิงข้อมูลของ Plus Connect ที่ทีม Online Tag ไว้
                </li>
                <li>
                  เพื่อ Track ROAS จากโฆษณารายตัวได้แม่นยำขึ้น ต้องเพิ่มการบันทึกชำระเงินบน Meta เมื่อลูกค้ามัดจำออนไลน์ เพื่อให้ระบบขึ้น
                  Purchase Value ถูกต้อง
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 flex items-start gap-2 text-xs text-slate-500">
            <Layers size={14} className="text-slate-400 mt-0.5 shrink-0" />
            <p>แผนงานนี้เป็นแผนการดำเนินงานที่ทีมวางไว้สำหรับเดือนสิงหาคม 2026 ยังไม่ใช่ผลจริง — ใช้เป็นแนวทางติดตามเทียบกับผลลัพธ์เมื่อถึงรอบรายงานเดือนถัดไป</p>
          </div>
        </div>
)}

        {/* ---- NEW: แผนเพิ่มเติม Nose Open หมอจิ๊จ๊ะ ---- */}
{activePage === "ads" && (
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm mt-6">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-pink-50 text-pink-600 flex items-center justify-center">
              <Megaphone size={16} />
            </div>
            <h2 className="text-sm font-semibold text-slate-700">แผนเพิ่มเติม Nose Open หมอจิ๊จ๊ะ</h2>
          </div>
          <p className="text-xs text-slate-400 mb-5 ml-10">Funnel Ads ใหม่ทั้งหมดสำหรับคุณหมอจิ๊จ๊ะ — สิงหาคม 2026</p>

          <div className="rounded-xl border border-pink-100 bg-pink-50/50 p-4">
            <ul className="space-y-1.5 text-sm text-slate-600 list-disc list-inside">
              <li>
                ทำ <span className="font-semibold">Funnel Ads ใหม่ทั้งหมด</span> ของหมอจิ๊จ๊ะ โดยเริ่มจาก{" "}
                <span className="font-semibold">Engagement Post</span> เพื่อดึงให้คนเข้าถึงราคา{" "}
                <span className="font-semibold text-pink-600">79,000 บาท</span> เนื่องจากยังไม่มีคนรู้จักราคานี้
              </li>
              <li>
                นำ Creative ของคุณหมอจิ๊จ๊ะที่เป็น <span className="font-semibold">Vlog</span> และ{" "}
                <span className="font-semibold">เปิดตัวหมอ</span> เข้ามาทำ Engagement เพิ่ม
              </li>
              <li>
                ทำ Engagement Post ของ <span className="font-semibold">Dark Post Ads</span> ราคา 79,000 บาท
              </li>
              <li>
                ปล่อยอัดโพสต์เคสเด่นของคุณหมอจิ๊จ๊ะเพิ่ม พร้อม <span className="font-semibold">Ads Messenger</span>
              </li>
            </ul>
          </div>
        </div>
)}

        {/* ---- NEW: แผนการแยกเพจของหัตถการ ---- */}
{activePage === "ads" && (
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm mt-6">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
              <Layers size={16} />
            </div>
            <h2 className="text-sm font-semibold text-slate-700">แผนการแยกเพจของหัตถการ</h2>
          </div>
          <p className="text-xs text-slate-400 mb-5 ml-10">
            ลดการปนกันของกลุ่มเป้าหมายระหว่างหัตถการ
          </p>

          <div className="rounded-xl border border-sky-100 bg-sky-50/50 p-4 mb-5">
            <p className="text-sm text-slate-700 leading-relaxed">
              เพจหลักของคลินิกปัจจุบันมีกลุ่มเป้าหมายส่วนใหญ่เป็นกลุ่มที่สนใจ <span className="font-semibold">Nose Open</span> ทำให้เมื่อยิงโฆษณา
              หัตถการอื่นบนเพจเดียวกัน กลุ่มเป้าหมายของหัตถการนั้นๆ ปนกับกลุ่มเป้าหมาย Nose Open จึงวางแผน{" "}
              <span className="font-semibold">แยกเพจเฉพาะ</span> สำหรับ Semi Open, ยกคิ้ว, และเสริมหน้าอก ออกจากเพจหลัก
              เพื่อให้ยิงโฆษณาหากลุ่มเป้าหมายเฉพาะของแต่ละหัตถการได้แม่นยำขึ้น ไม่ปนกับกลุ่มเป้าหมาย Nose Open
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-start gap-3 rounded-xl border border-emerald-100 bg-emerald-50/40 p-4">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                <CheckCircle2 size={16} />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-700">Semi Open</p>
                  <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100 rounded-full px-2 py-0.5">
                    Phase 2 — กำลังดำเนินการ
                  </span>
                </div>
                <p className="text-sm text-slate-600 mt-0.5">ผ่าน Phase 1 แล้ว และกำลังดำเนินการ Phase 2 สำหรับแผนของเพจรอง</p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-xl border border-amber-100 bg-amber-50/40 p-4">
              <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                <Clock size={16} />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-700">ยกคิ้ว/เลื่อนไรผม</p>
                  <span className="text-[11px] font-semibold text-amber-700 bg-amber-100 rounded-full px-2 py-0.5">
                    กำลังดำเนินการ
                  </span>
                </div>
                <p className="text-sm text-slate-600 mt-0.5">ดำเนินการมาอย่างต่อเนื่อง แต่ยังไม่ทำ Funnel Structure ใหม่</p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-xl border border-amber-100 bg-amber-50/40 p-4">
              <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                <Clock size={16} />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-700">เสริมหน้าอก/ดูดไขมัน</p>
                  <span className="text-[11px] font-semibold text-amber-700 bg-amber-100 rounded-full px-2 py-0.5">
                    กำลังดำเนินการ
                  </span>
                </div>
                <p className="text-sm text-slate-600 mt-0.5">อยู่ระหว่างไล่ดำเนินการแยกเพจ</p>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 flex items-start gap-2 text-xs text-slate-500">
            <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />
            <p>สถานะนี้เป็นความคืบหน้าที่ทีม Digital รายงาน ณ ปัจจุบัน ควรอัปเดตทุกครั้งที่มีความคืบหน้าเพิ่มเติม</p>
          </div>
        </div>
)}
      </div>
        </div>
      </div>
    </div>
  );
}
