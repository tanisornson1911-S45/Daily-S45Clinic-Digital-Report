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
import DOCTOR_HERO_POSTS_DATA from "./data/doctorHeroPosts.json";
import ANT_ARMY_POSTS_DATA from "./data/antArmyPosts.json";
import BAD_LEAD_DATA from "./data/badLead.json";
import OR_SALES_DATA from "./data/orSales.json";
import INTER_SALE_DATA from "./data/interSale.json";
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
// และชื่อจริงทั้งหมดที่พบในไฟล์ธุรกรรม RAW_TX (ครอบคลุมทุกเดือน) มีหมอบางคนที่ไม่มีเคสมัดจำในมิ.ย.เลยจึงไม่อยู่ใน
// DOCTOR_PROC แต่มีเคสในเดือนอื่น ตัดค่า "รอระบุ" ออกเพราะไม่ใช่ชื่อหมอจริง (แปลว่ายังไม่ได้ระบุ) · ชื่อที่ผู้กรอกพิมพ์
// สะกดต่างกัน (เช่น "หมอจิจ๊ะ" vs "หมอจิ๊จ๊ะ") ถูก normalize รวมเป็นชื่อเดียวไว้ตั้งแต่ scripts/build-raw-tx.mjs แล้ว
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
// เดือนอื่นนอกจาก มิ.ย. คำนวณสดจาก INTER_SALE_DATA (src/data/interSale.json — สร้างอัตโนมัติทุกคืนโดย
// scripts/build-inter.mjs จากไฟล์ "Inter S45 2026 - Sale part.xlsx" จริง) กรองตามช่วงวันที่ที่เลือกได้อิสระ
// เหมือน RAW_TX แล้ว · มิ.ย. ยังคงใช้ INTER_BY_DOCTOR_MONTH.jun26 (พิมพ์มือ ยืนยันแล้ว) เพราะไฟล์ต้นฉบับไม่มีชีต
// ของเดือนนี้ให้ดึงสด (ดูคอมเมนต์ใน build-inter.mjs)
const INTER_PROC_LABELS = {
  nose_open: "Nose Open",
  nose_semi: "Semi Open",
  breast: "Breast",
  endotine: "Endotine",
  etc: "ETC. (ดูดไขมันหน้า/ตัดกระพุ้งแก้ม)",
  brow_lift: "Brow Lift",
  lipo_face: "Lipo (Face)",
  other: "อื่นๆ (Filler/Forehead/Eye/Fat transfer/Lips)",
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
// เพิ่มโค้ดหมอใหม่ที่เจอในข้อมูลสดแต่ไม่มีในลิสต์ข้างบน (พิมพ์มือไว้แค่ 7 คนแรกจากยุค มิ.ย./ก.ค.) — ตั้งชื่อ
// ป้ายแบบเดียวกัน "หมอ <CODE>" ไม่พยายามเดาว่าโค้ดไหนตรงกับหมอชื่อไทยคนไหนในระบบอื่น (ดูคอมเมนต์ build-inter.mjs)
for (const [code, raw] of Object.entries(INTER_SALE_DATA.doctorLabels)) {
  if (!(code in INTER_DOCTOR_LABELS)) INTER_DOCTOR_LABELS[code] = `หมอ ${raw}`;
}
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
  // ก.ค. 2569 เอาออกแล้ว — เดี๋ยวนี้คำนวณสดจาก INTER_SALE_DATA (ยืนยันแล้วว่ายอดรวมตรงกับที่เคยพิมพ์มือไว้ที่นี่
  // เป๊ะ: nose_open 6 เคส deposit 3,530,840/total 4,086,820 + lipo_face 1 เคส deposit 4,590/total 150,060)
};

// รวม case rows ของ Inter (จาก INTER_SALE_DATA.cases) ให้เป็น array แบบเดียวกับ INTER_BY_DOCTOR_MONTH เดิม
// (จัดกลุ่มตามหัตถการ) — ใช้ทั้งกับ dateRange หลักและ compareRange (pure function เหมือน computeFbTotalsForRange)
function interRowsFromCases(cases, doctorFilter) {
  const filtered = doctorFilter === "all" ? cases : cases.filter((c) => c.doctor === doctorFilter);
  const byProc = new Map();
  for (const c of filtered) {
    const e = byProc.get(c.proc) || { key: c.proc, label: INTER_PROC_LABELS[c.proc] || c.proc, cases: 0, deposit: 0, total: 0 };
    e.cases += 1;
    e.deposit += c.deposit;
    e.total += c.total;
    byProc.set(c.proc, e);
  }
  return [...byProc.values()];
}
function mergeInterRows(a, b) {
  const byProc = new Map();
  for (const r of [...a, ...b]) {
    const e = byProc.get(r.key) || { key: r.key, label: r.label, cases: 0, deposit: 0, total: 0 };
    e.cases += r.cases;
    e.deposit += r.deposit;
    e.total += r.total;
    byProc.set(r.key, e);
  }
  return [...byProc.values()];
}
// ช่วงที่เลือกไม่ว่าจะเป็นอะไรก็ตาม ดึงเคสสด (Jan/Feb/Mar/Apr/May/Jul/Aug) ที่ตรงเงื่อนไขมาก่อน แล้วถ้าช่วงนั้น
// ครอบคลุมทั้งเดือน มิ.ย. เต็มเดือนพอดี ค่อยรวมยอด มิ.ย. แบบพิมพ์มือ (INTER_BY_DOCTOR_MONTH.jun26) เข้าไปด้วย —
// ไม่มีความเสี่ยงนับซ้ำเพราะ INTER_SALE_DATA ไม่มีเคสเดือน มิ.ย. อยู่แล้ว (ไม่มีชีตต้นฉบับ)
function computeInterRowsForRange(range, doctorFilter) {
  const liveCases = INTER_SALE_DATA.cases.filter((c) => c.d >= range.start && c.d <= range.end);
  let rows = interRowsFromCases(liveCases, doctorFilter);
  const juneFullyIncluded = range.start <= "2026-06-01" && range.end >= "2026-06-30";
  if (juneFullyIncluded) {
    const juneRows = INTER_BY_DOCTOR_MONTH.jun26?.[doctorFilter] || [];
    rows = mergeInterRows(rows, juneRows);
  }
  return rows;
}

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
// SOURCE 6 — Bad Lead จริงจาก Plus Connect (ทุกแชทที่ทีม Digital ติดแท็ก "คุณสมบัติไม่ครบ") ดึงอัตโนมัติ
// ทุกคืนผ่าน scripts/build-bad-lead.mjs — แทนชุดตัวอย่าง 159 แชท/รูปหน้าจอคัดมือเดิมที่ตรึงไว้ที่ ก.ค. 2569
// เดียว ไม่มีข้อมูลตัวตนบุคคล (ชื่อ/เบอร์/รูปโปรไฟล์) ติดมาด้วย — ดูคอมเมนต์ในสคริปต์
// ============================================================
const BAD_LEAD_LEADS = BAD_LEAD_DATA.leads;

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
// โพสต์ Organic จริงจากเพจ (ดึงอัตโนมัติผ่าน Facebook Graph API — ดู
// scripts/fetch-fb-doctor-posts.mjs) แยกตามหัตถการ ใช้เลือกโพสต์ที่เข้าถึง/มี
// Engagement ดีมาต่อยอดเป็น Ads Messenger (กลยุทธ์กองทัพมด กระตุ้นยอด Inbox Nose Open)
// แทนรายการลิงก์คัดมือแบบเดิม
// ============================================================
const ANT_ARMY_POSTS = ANT_ARMY_POSTS_DATA.procedures;
const ANT_ARMY_PAGE_SIZE = 12; // จำนวนโพสต์ต่อหน้าก่อนกด "ดูเพิ่มเติม" — กันหน้ายาวเกินไปเมื่อโพสต์เยอะ
const S45_LOGO ="data:image/webp;base64,UklGRm4VAABXRUJQVlA4TGIVAAAv88FSEJegoG0byfuPP7DDp7aRpGYeGxISUYDrvz0UtJEU9V7AvytUKYokxVk/yEcCFnjxCpeThgvgr/+Fi4QhUeAzh3X09p1Z8733kCOB7euCQaBGIsi2Wf3BnxtEREaf6e223bytbVtLvlEELL78/19rkUQHlFkKuF6JiP7Dom0lqHSDp4QyOpGVmf7Lkm03bqOIBMgi9r9iiQMGkl3+aiCi/7Jo2wra6GA6JnnN8C6PB0Gt/z9bvv3ff/z3H3vydfJuo9dyn2h7HYn7M2w17zR/ImbaaV7SPmsF2maWaJN5u6kDHNF2mCHaX95u6uWD4m57y9tN15dVtK+83XTVT2w35S/rqe8om9CGc0Tpu8lmtJdsSDvJlnRt43Ac263mXWRr2kKEOe5rB/W3Bvv6QrdvOfKe44XdfROzbbip67aX99AUE4cVviX82tpCoaTfCDKKpXOo5S3UcPr9bsQ2sS92UNG+enpw1Dt5Kh3vYK9vfB5MxNq9Qzj0+m6hlfQ7RxR7FyXbQSP9E2Og3DnsXcj7Jw6df0/ilTPByVZyRNm7xLlEzCKe6huTPfHuu/cyTxLHp0WZhXD/FPGJScSJzhGxf4qAXUqIS/Io5q3TrAASJ9gH2+5ZnRJLxLMLbijiE3gw70PkyegWDs1h2a0U4e4Zve5QiIT638aIuUfEZaRRinQkDMW0NJpbRL+yk3W1PO3Gqdl4BB7LiRHZGq18hupH863qenRLd8jGIPECgsgSLCt1l0flVd1tPjK2fXQi0ikgwGgUr6TqnlTlK9Y64QavR32OsZE/JGNoLmkRJ49f5YAqH+pqKAZJcz2rY4wlkQIlgiWg/4My/g+mS5tC5cHbxMBBiXTHWGwEOMmQQ5Uhwec5DZ7pUFUOTCc7T7B4jLPQzW8J2Xm66PS3eBsa+i+vTu1+mzpQGUI+UtaRKooikE4BrM83AzcxNJXTnZMb5vqxwgn+yJGlQhOQ7Hqw5gqwuolNqDvxg0boST+Q8zqjHsskQZBhL2k3wMkOUbM/P1yenSWgYwy6rORdH1KFawYaqQnuDHIxRcII9dmE/4ToI3o+YfVtrU+Bn+sNNUwC1rKm1OhlKdwOFlwFbiHExCgCbZ0K5N4LGAk+TAJ7DgFUFrtgxBKJwSkoK8TGKNlX6FZQHfoGNlWEAmwUOmTdGvXnOEu0xiHFud1voagYArz2V2U9/ak551RzBCkOdCyJaQlQrqv5b1TVPOxQ+ZxmB4WBitVh7WDgfWDNeM2ZhFrayD6dZUr3Ejbujo67haAprOSl6x8j2a0d/ZpLewWX96IVECe9gXcEiq+rrKy6S3wBJxSX8X6rEGCLUCVw+rVHzR6bE9gMGgMN9NwkIjHmHdctswQ72V1GbSCT4gQPoLArYOuBNIytbQ2yR40mmRi/kOcq+k3M/kNoMUWnlmFl1asKJVVsMea5XVn8Fewa0IHqvaFx64TvLAeHgFMc6BIi4YdA3wiBkdpZaZwqMsk4oTjeITho0ATs7v5C+olfsHqNcGoXIGgAc6AcQjCZY2w9tyZV7Z2wenYFFyRIjHfH5LJGDCC0gOomzFr21iCdP0AV9N60QBDmGV1fL6vOP6+Jb1Hw8kENqwmtwNgFIPRsbdWNAzYMb+cb5r6cZhDmGNetq9OXrTQeFXnYcBI62xEDM4Kx9r9pLMTEQ6WNNI58p8cUadgoGIvEQEs/El/t0QTCvm3KRcHEU6UXtVZZdaaC1q4VwynPMvGycUcMcFqi4ZcyJsiDmZLU3mhkRxplgroCxuJYTR/ahmBAMPaqNVALo08TdJVxnywfdjwmt/VIhBg+7LkuQFMnkJgaZk2tGbPqOFERw85ykebmPQM0iPEF5hVt5iTVa641GgGsek6UY6oN8AbCz/VensZjlBv+kMJJUSe0hQNkx2WWYwYRxHhFmq37w0+IlakjHGRS66Dwmgx5BfiGRWWGkmygZOxalSIYGyoXk2cLLkxWtV7m9h6t2CoSlERqWLtFiQYLaGpaexCFXaWFQZeuSxPlHu/d7SJLIoaPfS6cCGv628iS7xrW+UlWW/biVMKU4qUI4Zf1fhN/7/DQ1ItiW8eCauuXK9fRDvpuKQwzrZv5il2sGGv6+/oCFmQWG7p/g+O+XLqIj2HWx0tWVC6MMla/gVcxu7yaJYMc2ClkmvUp2WhA85yOpqZFue3yqp8TvPc6F8iaNFljQZZ38O3hudB2edfdAR7ckGHxiqyqCBl6QS6TBTw25dXMN+lVQs1NWdEI2bX2fUwUlMKsTbHs6HXg8FvLtia+FISNnQBTcwJyAXk1cceSfdaI+KZpRqkfjpDalGVaddy1ZJ81zpdqtkk9+6iQ146dS29kffp3TVJHkvIas3fphaRBwdUi5NUNwxu8HXROqdFM3iJFuc9rvBP02LNdZDGffiIec+bsXio2LQps72+aO192MNVXWpS/bK70Hx9vrVq2KH/eXGnZ0QsyLxd8g+39I8w9S4o5fB3uiq2C/Y8wN9U4//y/pC1fPWK0df6ZNfa4oWchdLkr6PxD7NVVL9TxdV9QXy+EDpj7y/Y83+eblzGVub9lT/9ux9XvcG3MvW3P6h2up9nYnL0967EafuYXzFnckAr2jGlDOEzHXnIAMFK6n7EvZyPYaoz1/G3UC9FN4Cnv9CEMF7NvKX5j+eXMDkQvK+aIRd4xdoLe/WbK9dSLXd4Qv4085t9GjgW3z9p8GrfJ+/Y30O357H30T/gbaGXU0bzOC8WmicpM5zpYFfjgWb1MuRrnnWeimec0Ka/NaYIndfKcJk2ZF0vx4txFLM1dZJu1OhMB59WkWM5Rhqbuf2KOspA+mS7ZmbDLK7uJZi7CGywNOBehVVYfzUVo+76lTHktYysGU19FN+foiqaIWVY3Dtrp8cLcwrEoZTDc1OdqOLcwmdZ5GLQz/EUfThz/1+YQPxZziC/d1XDnWM27Zi9ObWB1QR8dQ+T7Ajt9/vRaAc2N3QEmF3Tip3TAsa+YB3OKX8K8IqZqprUTPbW25Li7+2YwWUe0KeZWaGUBTX1Zrf0j1Elf66HasQh82QWUNGf34B4Ql4w1Wn9uja85xaKuHl7LLwgoUjB+rsdT/q9/fDG4hdlafozXepXeh+KFjYqjhOeSGU3d7j+2ZudZxdai82R9JCYfkG/k/u7avBRJTgGh+k6GI5HmZbCnsx7n6GAH3+Okm7IGd1YOzxg21CXOimuWHzpnRJqvPOWCmjW8RstKh0tH63T1ECzFjQUxfsxjcqEJhyaHxG9fbG4bnCk2o6NKyA084217n3t0ZwRjnhHrWtmRE43m+gc4KjiwK61AUzOEN2xsRm402gGrZk+My2J1zHlphUOYa+SypISQ0dcVnpUVngDdIITQJHFaN0blkqqsJccq4qV9oTjJQ3CemFomxtzyurVNGJuIlzet6p7hGD/e/Z7xuwaBflk/SiK3imETas/8Cg7Mp6mE6SwCoEuo66vnVbHZhFof6NjDx8LHSGwr7i41bjrjYWPUqTIl1Dp0a9DkxiLNSKB3NNGpXxG7y6y+IYfiSh438ISxAGPOed1KChuFVzVKvi/McTmJPydA96hyU/aGIrvUKksIxm/estCJu8DKb6A0XfbrN4z6S7xu+46gYPlQY8xpjWVmuUsoF5nsEc2/nX/Biia9CR6DINDSKlszG1SXdv7xEkGKs7vfMEDHqYoWjpN5xju7y6oRhGMPp74KWNT4rBCgj1aknusfhxrtYQ1SXMRz/QghhiTdfyieUmldUYeKzRrBMsoFthIJBcNFBsgaJXt2mEZiJET78STAnlOz4sJGxri7PzXBCgtRweuC4F4PYGdtil1MtojmUJCGM3hZ4ATjMNoutIfAoocV/CqouMkNEo6Qb/r0FOxP4TQj6DkH4JzCblWgIUqGqNmhg3NIOujImIt+i7L0Y/QqsFfAxe1wN4/OHU3QMb/rhbdSonNJrheKp7vcClZfj/I5VzWIcBItlNouVSOVdGBN113uwroRQ4HJIFa715ZWV6/RQUs+FZgf7BJlADpR9z/gBMrC/2AabutQFdez0kEdx7IMQBNU5f+gHoWurHUuVdXcI6IFfGxDDJU4IhT/g6emOW5Qt/Z5N6oUj2BG+NWC7OqUsYfYW9B5UnVJqnL92IIksIzDxo/0geucqop7fhjUQyUHa4duVovuqhvR+VYVEd2kb0EVps/7OE/1H91mbNc9A3Qspdh+tm2rOlkZ3H3f0DSh+gOJkncFhgrN5YMk0HIE3b4hF7xTAHVBWms2UIF/XUVi4uXkFNunUHXpkxTsnAwM1iDwG0rEAK3krVMASM9nsxIhYt86nLqSFYNzmZbB0uruGSUgGb4zeNTsHa57CMW9mp2JJs3miQNWexU0l21hdfeM0nKvJpImcZD3jzhZDYSnNAbl2j/kVtL0ZGhB8UUdefvSEIsx1d+IOdH+GTHe2hYiPtaoeyib4+4biPyV91u8/lWCPd+96dn2OyjXHiJXW/7u20UyTrSPZMo7SRvO51zVhr89AptJxYj3kzacz+lq+vKekjq+3/TlbaVbxftN9Wdrt3bDc/rvLqG8vYTxBhPCO0wA7zGJvN1Ur59tRm4C73O03ueUln82e7v6lX+2fPs/x9hutFJ/8Ed+4OeG4Em/9w98vPzcj5oeoB/cKJra4OOtlvg9ZgTevkKubqQSY1EQcqTHYQthnG6S0C4vYyuQU1dyOJZKikYqMRbPWNBQl/p6MFem0dJLX7bZrAn1KkjTIgsRd19XmlNZcnUZz4v0Cm84vD6/JbrAiIxVyQj5nuA8xiYUu47AceFtoTqJEsxdgbfV3uL+CRhIHA9grN+8gmWo+7QU4mvdVbyrt3vn3UuZuO0zb7wZyHiUBbyujp5Sw/x0L1QdI+InHmZJzYTat0yX9qJPWaMbuQxkNS8rUw7oVFy1PxIXYAQJfZXhlaokY8xlPIdITyyUbb10RcFIEDstuGQy6QifD/F2vlU+XLVnfF166mx8Xb2ytCpfTphWsMsJjVelwo589ImHkQfvWpdqpm5/7hSSyAh8GU96VF56QDEokaYwu3tkAykJ+73G6aU9OK1jw0lyaEJnGoxSMNJ4Q51c2ErqvKOFO3WMGGhkJ+MpD97oQaBBSZKawfLzugTa3GA/ct90zGbjNA6FWhpradG067qr1L7wvvvEGKVCGYMr40nUxHSwhZwmWgSirPd58nDuR3RBc68bHPV6ae6pwn4CJGyvwp+lZBLKKKsVHAFldndAsd8kWwSqw9TI/Csviqcz0bUri7KCHVACxQMehfq3F37aAlsZD3nNM3G1zNI4SFVUKVTXzCrL4pqyC3XYUpVRBVjJSHgIBAJpQOh3EaqWx++CO+wDSWWLtiXNxwlJM8JWxgNokrGryPxuIVOtRaZtHoMDshbfk3d6NdpsQ1nErsiZA4hHQEvhQiOZN2UHRZLSelR5Yk8mHjjaYCvjCe+I+nAVzRNmqlFjNeQOvWRI6qAxKNZdoYmNCbYyHgD2i7sWERqzFevKyT7mz8eW1hpVd8VHm9S2QFXGU3AwOz2jPyJQOM9hh7FuEORkJjaZDBDIeBMSc/ASGk0brGgNhuqu9YnvaKY2BtjKeMTLFirApJrAbQrQR7KOdjiO45KQPnwZT4Sr2LCrbbSA40sAlqiGy38EY8icDo02VR2+jMczV7M/xKRqtIJ/aLw/8+T9VbMeEPVgll0xN20EMl7k6aBnaWpG9MdmnokXx7BrsxEj0/l4mSwJmVIu8JyR72Y7GgYEXzdZwktZ67eUv+/mcXp9NksbU+D432bJswoJ0jBawznryXqHBinwAsyXhHThyniXiyFWIVFIWEf8k9OdRcrbQdJWolwBnx3lUYUt41W25SAQgp32GXHgnS7enSG5/tXctHh64g5Mj/JowpbxKqXBw9jhG7U/Lsx6vr/6mhpspSedDsMGNWHLeJlSss5OfH2Ej8B0OIlcdc6MA+1wODZFEbaMtykN1/kfGtOIh65XeF8WR3nsudDO+v+onD9pQEx0h61Ur8vqKI85N9pZfkwsM+s3C7CAs6pyR7juOPw7WF/HwR30y5catOF20nplaJDCi6WJz7jbhAKXRsY46i2Dlbt80PoojxJ8Ga+4E3VhZA6FWtqoN4AfRZ7bVusCl1ocgoWROV65mgvaFU9GNg9SQVfG6xzwmYiOX4RI0P4H1erncBd8tEEV2DLecsNRwig1Vs9KDINPQF80ciaqxSaMC0dXgHWURwO2jKdv2l28PNKiOCnUNkz1fNhLQhpcx1D5G11QXwluGUeevqDGGxK4I+8VYB7lUeBSb2g3BjVeGeaYMFSDNGJIIjk7Cx+NzEaBuz1tLs0FqQkbTL3b1B7VdaNzEU+vihi2jOUSj5RJ8Pa+hAak2SNrbIvQpkqxlfGA2YIomLakDK5s9U/LsCdyPTIJMZSRMuxPEbkPfY/YCxRZmg29+ChCEDZw5/6gjKOijAeAoq6IfRxtBWXW3ECcvVFKTZrUB3bAYdxkWMp4CCAUte5F9JNm7S+pVR6RyIczmKMJgqM8LsJWxiMIEmkatBcgW98RpOEmrJsm9TGCH08uw1DGU0hVJGn5M4TdxUB/ZcKBRJ6wwRfWnD32wKsGdjIegsS50uX/rSCQn2XN/maF1MMenIsW8QXHJjgqYCvjGaTGdbyr0VaU4bWdNnj4AFvHXSCQYyQjPocQkgzYBcZWROofyhuu8zBvzsAbrYnTzjvhLYsxkjEdhQd3gqHhNQiU5fZvAx1paIBcBW0TlTVYp8o73TcRY9ZfuWqGQsfhEmOom8q4Hez+EIXREWROrxssSOdhJmPk8bJ87pljuay/fnNas41NTIxJP/LaQiVlIhccQr2Zyrg/hCzX6RMkmk6l17MhmcRRzaRJgzZ1GiqF0WbkzSvML79t3tWlu3xnBU0qmBZ/BpzcW819dcT3BYERVkx/GpPbyXjCVnMaLnmnySVOvMsj193BfXrtRQB6V1NRKgVVGbl9L3J/Q4VwGDvjbI91B5KIvLowFzoNutuerP6qv9fJ7ULSpDoRss7e8oLAlTfe3R+EDGQ8plQcXgBH/wQLDacn3TMiXCGPToLXcGeWI2axgJWWwxvrXJLwmFEmR1nGSk6isA+fdb2LrLnSHHh47lQzGQ8xL7N7D3nROemi9qU7Y2Mogr1knSvHtPf1g1EbZIjzuc86m+T7OSm9xizJgntGirQBME1pTHdMZDzsLd/zFmPU7cHsM/8pd3Uj+4SwnYzXaAzMz7f3O9+kuQ2vfPOhX5gW/RR0nJL8xkT//Wfy3q/8o8b73k9e/kOMAw==";

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
// เคสเด่นคุณหมอ (Hero Case) ที่นำมากระตุ้นยอด Inbox Nose Open — ดึงจาก src/data/doctorHeroPosts.json
// (สร้างโดย scripts/fetch-fb-doctor-posts.mjs ทุกคืน) เลือกโพสต์จริงจากเพจที่มี Engagement สูงสุดต่อหมอ
// ============================================================
const DOCTOR_HERO_POSTS = DOCTOR_HERO_POSTS_DATA.doctors;

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

// ยอด "ขายรวมทุกช่องทาง" จริง — อิงยอดปิด OR จริงจากชีต "ยอดORจริง+Forecast (พี่เปา)" (src/data/orSales.json,
// สร้างโดย scripts/build-or-sales.mjs) แทน RAW_TX.tot (คอลัมน์ Total price ในชีต "มัดจำ 2026") เพราะเช็คแล้วว่า
// มัดจำ 2026 นับยอดขายจริงตกหล่นไปมาก (ก.ค. 2569: มัดจำ 2026 ให้ ฿16.4M แต่ชีต พี่เปา ให้ ฿24.2M — ต่างกัน ~47%)
function computeOrSalesForRange(range, proc) {
  const rows = OR_SALES_DATA.entries.filter((e) => e.d >= range.start && e.d <= range.end && (proc === "all" || e.proc === proc));
  return rows.reduce((s, e) => s + e.amount, 0);
}

function computeExecMetricsForRange(range, proc) {
  // ชื่อตัวแปรแก้จาก isFullJun เป็น isFullJul แล้ว — เดิมเช็คช่วงเต็มเดือน มิ.ย. ทั้งที่ GRAND_TOTAL/CATEGORIES
  // เป็นข้อมูล ก.ค. ที่ยืนยันแล้ว (ไม่ตรงกับ isJunFull ระดับ component ที่เช็ค ก.ค. อยู่แล้ว) ทำให้ถ้าเลือกช่วง
  // มิ.ย. เป๊ะๆ (หรือ compareRange ตกที่ มิ.ย. เป๊ะๆ) จะโชว์ตัวเลข ก.ค. ผิดเดือนไปแบบเงียบๆ — แก้ให้ตรงกันแล้ว
  const isFullJul = range.start === "2026-07-01" && range.end === "2026-07-31";
  const txInRange = RAW_TX.filter((t) => t.d >= range.start && t.d <= range.end);

  const sales = isFullJul
    ? proc === "all"
      ? GRAND_TOTAL.sales
      : CATEGORIES[proc].sales
    : computeOrSalesForRange(range, proc);

  const fbSales = isFullJul
    ? proc === "all"
      ? FB_TOTAL.total
      : FB_BY_KEY[proc]?.total ?? 0
    : txInRange.filter((t) => t.ch === "Facebook" && (proc === "all" || t.p === proc)).reduce((s, t) => s + t.tot, 0);

  const fbSpend = (() => {
    if (isFullJul) return proc === "all" ? GRAND_TOTAL.spend : CATEGORIES[proc].spend;
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

// นับจำนวนอาร์เรย์แยกตามคีย์ (เช่น tag/platform/ผู้รับผิดชอบ) เรียงจากมากไปน้อย — ใช้กับสรุป Bad Lead
function tallyBy(arr, keyFn) {
  const m = new Map();
  for (const item of arr) {
    const k = keyFn(item);
    if (!k) continue;
    m.set(k, (m.get(k) || 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
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

function Sidebar({ activePage, setActivePage, mobileOpen, setMobileOpen, collapsed, setCollapsed }) {
  return (
    <>
      {mobileOpen && <div className="fixed inset-0 bg-slate-900/40 z-30 sm:hidden" onClick={() => setMobileOpen(false)} />}
      <aside
        className={`fixed sm:sticky top-0 z-40 h-screen ${collapsed ? "sm:w-20" : "sm:w-64"} w-64 shrink-0 bg-white border-r border-slate-100 flex flex-col transition-all duration-200 sm:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* ปุ่มพับ/กางเมนู — เฉพาะจอ sm+ (แท็บเล็ต/เดสก์ท็อป) เพราะมือถือใช้ปุ่ม Hamburger/X แบบเดิมอยู่แล้ว
            ช่วยให้ใช้งานบน iPad แนวตั้งได้สะดวกขึ้น (พับเก็บเมนูเพื่อให้พื้นที่อ่านข้อมูลกว้างขึ้น) */}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="hidden sm:flex items-center justify-center absolute -right-3 top-8 w-6 h-6 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-slate-600 hover:border-slate-300 shadow-sm z-10"
          title={collapsed ? "กางเมนู" : "พับเมนู"}
        >
          {collapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
        </button>
        <div className={`flex items-center ${collapsed ? "sm:justify-center" : "justify-between"} px-5 py-5 border-b border-slate-100`}>
          <div className={`flex items-center gap-2 min-w-0 ${collapsed ? "sm:gap-0" : ""}`}>
            <img src={S45_LOGO} alt="" className="w-7 h-7 rounded-md object-contain shrink-0" />
            <span className={`text-sm font-bold text-slate-800 truncate ${collapsed ? "sm:hidden" : ""}`}>S45 Clinic</span>
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
                title={collapsed ? label : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  collapsed ? "sm:justify-center sm:px-0" : ""
                } ${active ? "bg-indigo-50 text-indigo-700" : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"}`}
              >
                <Icon size={17} className={`shrink-0 ${active ? "text-indigo-600" : "text-slate-400"}`} />
                <span className={collapsed ? "sm:hidden" : ""}>{label}</span>
              </button>
            );
          })}
        </nav>
        <div className={`px-5 py-4 border-t border-slate-100 text-[11px] text-slate-400 ${collapsed ? "sm:hidden" : ""}`}>Ads Performance Dashboard</div>
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

// ค่าเริ่มต้นของ dateRange/compareRange เมื่อเปิดหน้าเว็บ — ต้องเป็น "เดือนนี้" เสมอ (อ่านจากนาฬิกาเครื่องจริง
// new Date()) ยกเว้นตอนเพิ่งขึ้นเดือนใหม่แล้วไฟล์ธุรกรรม (RAW_TX) ยังไม่มีข้อมูลของเดือนนี้เลยสักแถวเดียว (ปกติ
// sync ล่าช้า 1-3 วันหลังขึ้นเดือนใหม่) กรณีนั้นเปิดด้วย "เดือนที่แล้ว" แทนชั่วคราวจนกว่าจะมีข้อมูลจริงเข้ามา —
// ไม่งั้นหน้าแรกจะดูเหมือนพังเพราะทุกอย่างเป็น 0 ทั้งที่จริงแค่ไฟล์ยังไม่อัปเดต (พบจริง 2569-09-01: เดือนนี้ยังไม่มี
// ข้อมูลเลยสักแถว หน้า "หมอ" เลยว่างเปล่า) · compareRange เทียบกับเดือนก่อนเดือนอ้างอิงเสมอไม่ว่าจะ fallback หรือไม่
function defaultDateRanges() {
  const pad = (n) => String(n).padStart(2, "0");
  const monthRange = (y, m) => {
    const lastDay = new Date(y, m, 0).getDate();
    return { start: `${y}-${pad(m)}-01`, end: `${y}-${pad(m)}-${pad(lastDay)}` };
  };
  const now = new Date();
  const thisY = now.getFullYear();
  const thisM = now.getMonth() + 1;
  const todayIso = `${thisY}-${pad(thisM)}-${pad(now.getDate())}`;
  const hasDataThisMonth = RAW_TX.some((t) => t.d >= `${thisY}-${pad(thisM)}-01` && t.d <= todayIso);
  const refY = hasDataThisMonth ? thisY : thisM === 1 ? thisY - 1 : thisY;
  const refM = hasDataThisMonth ? thisM : thisM === 1 ? 12 : thisM - 1;
  const dateRange = hasDataThisMonth ? { start: `${thisY}-${pad(thisM)}-01`, end: todayIso } : monthRange(refY, refM);
  const prevM = refM === 1 ? 12 : refM - 1;
  const prevY = refM === 1 ? refY - 1 : refY;
  return { dateRange, compareRange: monthRange(prevY, prevM) };
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
  const [antArmyProcFilter, setAntArmyProcFilter] = useState("all");
  const [antArmyVisibleCount, setAntArmyVisibleCount] = useState(ANT_ARMY_PAGE_SIZE);
  const [interDoctorFilter, setInterDoctorFilter] = useState("all");
  const [interProcFilter, setInterProcFilter] = useState("all");
  // ดูคอมเมนต์ที่ defaultDateRanges() ด้านบน — ปกติเป็น "เดือนนี้" เสมอ ยกเว้นตอนเพิ่งขึ้นเดือนใหม่แล้ว RAW_TX
  // ยังไม่มีข้อมูลเลยจะ fallback ไปเดือนที่แล้วชั่วคราว
  const [dateRange, setDateRange] = useState(() => defaultDateRanges().dateRange);
  // ค่าเริ่มต้นเปิด Compare ไว้เลย เทียบกับเดือนก่อนเดือนอ้างอิงเต็มเดือน (ไม่ใช้ previousPeriodRange เพราะบางคู่เดือน
  // จำนวนวันไม่เท่ากัน จะเลื่อนวันเริ่มผิดไป) — ผู้ใช้ยังปรับช่วงเทียบเองได้ตามปกติจาก Date Picker
  const [compareEnabled, setCompareEnabled] = useState(true);
  const [compareRange, setCompareRange] = useState(() => defaultDateRanges().compareRange);
  const monthFilter = "jun26"; // คงไว้เพื่อความเข้ากันได้กับส่วนที่ล็อกไว้ที่มิถุนายน (Sales Funnel/Inbox/LOA/Bad Lead/Inter)

  // ---- Sidebar navigation + dark mode ----
  const [activePage, setActivePage] = useState("overview");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  // จำสถานะพับ/กางเมนูไว้ใน localStorage เหมือน dark mode — เปิดแอปครั้งต่อไปจะยังคงสถานะเดิมไว้
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("s45-sidebar-collapsed") === "1";
  });
  React.useEffect(() => {
    window.localStorage.setItem("s45-sidebar-collapsed", sidebarCollapsed ? "1" : "0");
  }, [sidebarCollapsed]);
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
        // ยอดขายรวมทุกช่องทาง = ยอดปิด OR จริงจากชีต "ยอดORจริง+Forecast (พี่เปา)" ไม่ใช่ RAW_TX.tot อีกต่อไป
        // (ดูคอมเมนต์ที่ computeOrSalesForRange ด้านบน — RAW_TX นับยอดขายจริงตกหล่นไปมาก)
        sales: computeOrSalesForRange(dateRange, procFilter),
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
  const heroCaseOptions = Object.entries(DOCTOR_HERO_POSTS).map(([k, v]) => [k, v.label]);
  // Inter แยกตามหมอ — คำนวณสดจาก INTER_SALE_DATA ตามช่วงวันที่ที่เลือกจริง (เหมือน RAW_TX แล้ว ไม่ล็อกแค่ มิ.ย./
  // ก.ค. อีกต่อไป) รวม มิ.ย. แบบยอดพิมพ์มือเข้าไปเมื่อช่วงที่เลือกครอบคลุมทั้งเดือนนั้นเต็มเดือน (ดู
  // computeInterRowsForRange) · interProcFilter กรองตารางที่ปกติแสดงทุกหัตถการของหมอคนนั้นให้เหลือหัตถการเดียว
  const interDoctorRowsAll = computeInterRowsForRange(dateRange, interDoctorFilter);
  const interDoctorRows = interProcFilter === "all" ? interDoctorRowsAll : interDoctorRowsAll.filter((r) => r.key === interProcFilter);
  const interDoctorTotal = interDoctorRows.reduce(
    (acc, r) => ({ cases: acc.cases + r.cases, deposit: acc.deposit + r.deposit, total: acc.total + r.total }),
    { cases: 0, deposit: 0, total: 0 }
  );
  // % เทียบกับ compareRange (การ์ดสรุป "Inter แยกตามหมอ + หัตถการ") — คำนวณสดแบบเดียวกันทั้งสองช่วงแล้ว
  const interCompareRowsAll = computeInterRowsForRange(compareRange, interDoctorFilter);
  const interCompareRows = interProcFilter === "all" ? interCompareRowsAll : interCompareRowsAll.filter((r) => r.key === interProcFilter);
  const interCompareTotal = interCompareRows.reduce(
    (acc, r) => ({ cases: acc.cases + r.cases, deposit: acc.deposit + r.deposit, total: acc.total + r.total }),
    { cases: 0, deposit: 0, total: 0 }
  );
  const interCasesMoM = compareEnabled ? pctDelta(interDoctorTotal.cases, interCompareTotal.cases) : null;
  const interDepositMoM = compareEnabled ? pctDelta(interDoctorTotal.deposit, interCompareTotal.deposit) : null;
  const interTotalMoM = compareEnabled ? pctDelta(interDoctorTotal.total, interCompareTotal.total) : null;
  const selectedHeroDoctor = DOCTOR_HERO_POSTS[heroCaseFilter];
  const antArmyProcOptions = [["all", "ทุกหัตถการ"], ...Object.entries(ANT_ARMY_POSTS).map(([k, v]) => [k, v.label])];
  // "ทุกหัตถการ" รวมโพสต์จากทุกหมวดแล้ว dedupe ด้วย postId (โพสต์เดียวอาจเข้าได้หลายหัตถการ) กรองด้วย
  // dateRange หลักที่เลือกอยู่จริง (เทียบวันที่แบบ Asia/Bangkok เพราะ createdTime จาก Graph API เป็น UTC)
  // แล้วเรียงตามคะแนน Engagement มากไปน้อย ไม่มีการตัดจำนวน (ผู้ใช้ระบุ "เอามาทุกตัวเลยนะ")
  const antArmyPosts = (() => {
    const cats = antArmyProcFilter === "all" ? Object.values(ANT_ARMY_POSTS) : [ANT_ARMY_POSTS[antArmyProcFilter]].filter(Boolean);
    const byId = new Map();
    for (const cat of cats) for (const p of cat.posts || []) if (!byId.has(p.postId)) byId.set(p.postId, p);
    return Array.from(byId.values())
      .filter((p) => {
        const thDate = new Date(p.createdTime).toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
        return thDate >= dateRange.start && thDate <= dateRange.end;
      })
      .sort((a, b) => b.engagementScore - a.engagementScore);
  })();
  // รีเซ็ตจำนวนที่แสดง (ปุ่ม "ดูเพิ่มเติม") กลับไปหน้าแรกทุกครั้งที่เปลี่ยนหัตถการหรือช่วงวันที่ ไม่งั้นจะค้าง
  // จำนวนเดิมไว้ทั้งที่รายการเปลี่ยนไปแล้ว
  React.useEffect(() => {
    setAntArmyVisibleCount(ANT_ARMY_PAGE_SIZE);
  }, [antArmyProcFilter, dateRange.start, dateRange.end]);
  const antArmyVisiblePosts = antArmyPosts.slice(0, antArmyVisibleCount);
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
  // Bad Lead — คำนวณสดจาก BAD_LEAD_LEADS (Plus Connect) ตามช่วงวันที่ที่เลือกจริง เทียบ % กับ summaryInboxTotal
  // เดียวกับที่ใช้ทั้งหน้า (มีความหมายเฉพาะตอนช่วงที่เลือกทับซ้อน มิ.ย.-ส.ค. ที่มีข้อมูล Inbox รายวัน)
  const badLeadInRange = BAD_LEAD_LEADS.filter((l) => l.d >= dateRange.start && l.d <= dateRange.end);
  const badLeadTotal = badLeadInRange.length;
  const badLeadJunkCount = badLeadInRange.filter((l) => l.junk).length;
  const badLeadPct = hasFunnelCoverage && summaryInboxTotal > 0 ? (badLeadTotal / summaryInboxTotal) * 100 : null;
  const badLeadTagTally = tallyBy(badLeadInRange.flatMap((l) => l.tags), (t) => t).slice(0, 8);
  const badLeadPlatformTally = tallyBy(
    badLeadInRange,
    (l) => (l.platform === "FACEBOOKFANPAGE" ? "Facebook" : l.platform === "INSTAGRAM" ? "Instagram" : l.platform || "ไม่ระบุ")
  );
  const badLeadAssigneeTally = tallyBy(badLeadInRange, (l) => l.assignee || "ยังไม่มอบหมาย").slice(0, 6);
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
        <Sidebar
          activePage={activePage}
          setActivePage={setActivePage}
          mobileOpen={mobileNavOpen}
          setMobileOpen={setMobileNavOpen}
          collapsed={sidebarCollapsed}
          setCollapsed={setSidebarCollapsed}
        />
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
            จากไฟล์ Inter Sale ช่วง {rangeLabel} · {INTER_DOCTOR_LABELS[interDoctorFilter]} · รวม {interDoctorTotal.cases} เคส
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
              ไม่มีเคส Inter ของหมอ/หัตถการที่เลือกในช่วงวันที่นี้ — ลองเปลี่ยนตัวกรองหรือขยายช่วงวันที่ดู
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

          {/* Bad Lead เทียบ Inbox ทั้งหมด — คำนวณสดจาก Plus Connect ตามช่วงวันที่ที่เลือกจริง */}
          <div className="rounded-xl border border-rose-100 bg-rose-50/50 p-4 mb-5">
            <div className="flex items-center gap-2 mb-3">
              <XCircle size={14} className="text-rose-500" />
              <h3 className="text-sm font-semibold text-slate-700">Bad Lead เทียบ Inbox ทั้งหมด — {rangeLabel}</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-lg p-3 border border-rose-100">
                <p className="text-[11px] text-slate-500 font-medium mb-0.5">จำนวน Bad Lead</p>
                <p className="text-lg font-bold text-rose-700">{fmtTHB(badLeadTotal)} แชท</p>
              </div>
              <div className="bg-white rounded-lg p-3 border border-rose-100">
                <p className="text-[11px] text-slate-500 font-medium mb-0.5">% จาก Inbox ทั้งหมด</p>
                <p className="text-lg font-bold text-rose-700">{badLeadPct != null ? `${badLeadPct.toFixed(2)}%` : "—"}</p>
              </div>
            </div>
            <p className="text-[11px] text-slate-400 mt-2">
              ไฟล์ Bad Lead ต้นฉบับไม่ได้ระบุหัตถการต่อแชท จึงแสดงเป็นยอดรวมทุกหัตถการเทียบกับ Inbox รวมทั้งหมด
              {hasFunnelCoverage ? ` (${fmtTHB(summaryInboxTotal)} แชท ช่วง ${rangeLabel})` : " (มี Inbox รายวันเฉพาะ มิ.ย.-ส.ค. 2569 เท่านั้น จึงยังไม่มี % ให้เทียบนอกช่วงนี้)"}{" "}
              ไม่สามารถแยก Scale ตามหัตถการได้เหมือนอีก 2 รายการด้านล่าง
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

        {/* ---- NEW: Bad Lead รวมทุกหัตถการ — คำนวณสดจาก Plus Connect ---- */}
{activePage === "inbox" && (
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm mt-6">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <XCircle size={16} />
            </div>
            <h2 className="text-sm font-semibold text-slate-700">Bad Lead (แชทคุณสมบัติไม่ครบ) รวมทุกหัตถการ — {rangeLabel}</h2>
          </div>
          <p className="text-xs text-slate-400 mb-5 ml-10">รวมทุกหัตถการ ไม่แยกตามหัตถการ (ไฟล์ต้นฉบับไม่ได้ระบุหัตถการต่อแชท)</p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            <div className="bg-rose-50 rounded-xl p-3">
              <p className="text-[11px] text-rose-500 font-medium mb-0.5">Bad Lead ช่วงที่เลือก</p>
              <p className="text-xl font-bold text-rose-700">{fmtTHB(badLeadTotal)} แชท</p>
            </div>
            <div className="bg-rose-50 rounded-xl p-3">
              <p className="text-[11px] text-rose-500 font-medium mb-0.5">% จาก Inbox ทั้งหมด</p>
              <p className="text-xl font-bold text-rose-700">{badLeadPct != null ? `${badLeadPct.toFixed(2)}%` : "—"}</p>
            </div>
            <div className="bg-amber-50 rounded-xl p-3">
              <p className="text-[11px] text-amber-600 font-medium mb-0.5">ขยะ/สแปมชัดเจน</p>
              <p className="text-xl font-bold text-amber-700">
                {badLeadTotal > 0 ? `${((badLeadJunkCount / badLeadTotal) * 100).toFixed(0)}%` : "—"}
                <span className="text-xs font-medium text-amber-500 ml-1">({fmtTHB(badLeadJunkCount)} แชท)</span>
              </p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-[11px] text-slate-500 font-medium mb-0.5">แพลตฟอร์มหลัก</p>
              <p className="text-sm font-bold text-slate-700">
                {badLeadPlatformTally[0] ? `${badLeadPlatformTally[0][0]} (${fmtTHB(badLeadPlatformTally[0][1])})` : "—"}
              </p>
            </div>
          </div>

          {badLeadTotal === 0 ? (
            <p className="text-sm text-slate-400 py-8 text-center">ไม่มี Bad Lead ในช่วงวันที่เลือก</p>
          ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="rounded-xl border border-slate-100 p-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-2">แท็กที่พบบ่อย (นอกเหนือจากแท็กปี/เดือน/วัน)</h3>
              {badLeadTagTally.length === 0 ? (
                <p className="text-sm text-slate-400">ไม่มีแท็กเพิ่มเติมนอกจาก "คุณสมบัติไม่ครบ" ในช่วงนี้</p>
              ) : (
                <ul className="space-y-1.5">
                  {badLeadTagTally.map(([tag, count]) => (
                    <li key={tag} className="flex items-center justify-between text-sm">
                      <span className="text-slate-600 truncate mr-2">{tag}</span>
                      <span className="font-semibold text-slate-700 shrink-0">{fmtTHB(count)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="rounded-xl border border-slate-100 p-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-2">ผู้รับผิดชอบแชท (Assignee)</h3>
              <ul className="space-y-1.5">
                {badLeadAssigneeTally.map(([name, count]) => (
                  <li key={name} className="flex items-center justify-between text-sm">
                    <span className="text-slate-600 truncate mr-2">{name}</span>
                    <span className="font-semibold text-slate-700 shrink-0">{fmtTHB(count)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          )}

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
          <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                <Zap size={16} />
              </div>
              <h2 className="text-sm font-semibold text-slate-700">Solution: กระตุ้นยอด Inbox Nose Open ด้วยกลยุทธ์กองทัพมด</h2>
            </div>
            <Select icon={Stethoscope} value={antArmyProcFilter} onChange={setAntArmyProcFilter} options={antArmyProcOptions} />
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

          <p className="text-xs font-medium text-slate-500 mb-2">
            โพสต์ Organic ที่เข้าถึง/มี Engagement ดี — แสดง {Math.min(antArmyVisibleCount, antArmyPosts.length)} จาก {antArmyPosts.length} โพสต์ — ช่วง {rangeLabel}
          </p>

          {antArmyPosts.length === 0 ? (
            <p className="text-sm text-slate-400 py-8 text-center">
              ไม่พบโพสต์ที่ตรงกับหัตถการนี้ในช่วงวันที่เลือก — ลองเปลี่ยนหัตถการหรือขยายช่วงวันที่ดู
            </p>
          ) : (
          <>
          <div className="grid sm:grid-cols-2 gap-3">
            {antArmyVisiblePosts.map((p) => (
              <a
                key={p.postId}
                href={p.permalinkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex flex-col rounded-xl border border-slate-100 overflow-hidden hover:border-amber-200 transition-colors"
              >
                <div className="aspect-[4/3] bg-slate-100 overflow-hidden">
                  {p.fullPicture ? (
                    <img src={p.fullPicture} alt="Ant army post" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-amber-50 to-slate-50 flex flex-col items-center justify-center gap-2">
                      <ImageIcon size={28} className="text-amber-300" />
                      <span className="text-[11px] text-slate-400">ไม่มีรูปภาพ</span>
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <p className="text-sm text-slate-700 line-clamp-2">{p.message || "โพสต์"}</p>
                  <p className="text-xs text-slate-400 mt-1.5 flex items-center gap-2">
                    <span>❤️ {fmtTHB(p.reactions)}</span>
                    <span>💬 {fmtTHB(p.comments)}</span>
                    <span>🔁 {fmtTHB(p.shares)}</span>
                    <span>👆 {fmtTHB(p.clicks ?? 0)}</span>
                  </p>
                  <p className="text-xs text-blue-600 group-hover:underline flex items-center gap-1 mt-1.5">
                    <ExternalLink size={11} /> เปิดดูโพสต์ต้นฉบับ
                  </p>
                </div>
              </a>
            ))}
          </div>
          {antArmyVisibleCount < antArmyPosts.length && (
            <div className="flex justify-center mt-4">
              <button
                onClick={() => setAntArmyVisibleCount((n) => n + ANT_ARMY_PAGE_SIZE)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors"
              >
                ดูเพิ่มเติม ({antArmyPosts.length - antArmyVisibleCount} โพสต์ที่เหลือ)
              </button>
            </div>
          )}
          </>
          )}

          <div className="mt-4 pt-4 border-t border-slate-100 flex items-start gap-2 text-xs text-slate-500">
            <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />
            <p>
              ดึงจากโพสต์จริงบนเพจ "S45 Clinic เสริมจมูกสไตล์เกาหลี By หมอตี้" ย้อนหลัง 180 วัน อัตโนมัติทุกคืน — จับคู่โพสต์กับหัตถการจากคำที่พบในแคปชั่น
              แล้วกรองด้วยช่วงวันที่ที่เลือกอยู่ (Filter ด้านบนของแดชบอร์ด) เรียงตามคะแนน Engagement (Reaction + Comment×3 + Share×5 + Click×4) มากไปน้อย
              ไม่มีการตัดจำนวนโพสต์ที่ค้นเจอ (ทุกโพสต์ที่ตรงเงื่อนไขถูกนำมาคำนวณ) เพียงแต่แสดงผลทีละ {ANT_ARMY_PAGE_SIZE} โพสต์ กด "ดูเพิ่มเติม" เพื่อโหลดต่อ
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
            {selectedHeroDoctor.label} · {selectedHeroDoctor.cases.length} เคส — ดึงจากโพสต์จริงบนเพจที่มี Engagement สูงสุด
            เลือกคุณหมอจาก Dropdown เพื่อดูเคสเด่นของแต่ละคน
          </p>

          {selectedHeroDoctor.cases.length === 0 ? (
            <p className="text-sm text-slate-400 py-8 text-center">
              ยังไม่พบโพสต์ที่มีชื่อ "{selectedHeroDoctor.label}" อยู่ในแคปชั่นช่วง 180 วันที่ผ่านมา — ลองแท็กชื่อคุณหมอในโพสต์ถัดไปเพื่อให้ระบบดึงมาแสดงได้
            </p>
          ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {selectedHeroDoctor.cases.map((c, i) => (
              <a
                key={c.postId || i}
                href={c.permalinkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex flex-col rounded-xl border border-slate-100 overflow-hidden hover:border-pink-200 transition-colors"
              >
                <div className="aspect-[4/3] bg-slate-100 overflow-hidden">
                  {c.fullPicture ? (
                    <img src={c.fullPicture} alt={`${selectedHeroDoctor.label} case`} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-pink-50 to-slate-50 flex flex-col items-center justify-center gap-2">
                      <ImageIcon size={28} className="text-pink-300" />
                      <span className="text-[11px] text-slate-400">ไม่มีรูปภาพ</span>
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <p className="text-sm text-slate-700 line-clamp-2">{c.message || `${selectedHeroDoctor.label} · โพสต์`}</p>
                  <p className="text-xs text-slate-400 mt-1.5 flex items-center gap-2">
                    <span>❤️ {fmtTHB(c.reactions)}</span>
                    <span>💬 {fmtTHB(c.comments)}</span>
                    <span>🔁 {fmtTHB(c.shares)}</span>
                    <span>👆 {fmtTHB(c.clicks ?? 0)}</span>
                  </p>
                  <p className="text-xs text-blue-600 group-hover:underline flex items-center gap-1 mt-1.5">
                    <ExternalLink size={11} /> เปิดดูโพสต์ต้นฉบับ
                  </p>
                </div>
              </a>
            ))}
          </div>
          )}

          <div className="mt-4 pt-4 border-t border-slate-100 flex items-start gap-2 text-xs text-slate-500">
            <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />
            <p>
              ดึงจากโพสต์จริงบนเพจ "S45 Clinic เสริมจมูกสไตล์เกาหลี By หมอตี้" ย้อนหลัง 180 วัน อัตโนมัติทุกคืน — จับคู่โพสต์กับคุณหมอจากชื่อ/แฮชแท็กที่พบใน
              แคปชั่น แล้วเลือก 3 อันดับแรกต่อคนตามคะแนน Engagement (Reaction + Comment×3 + Share×5 + Click×4) ยิ่งคะแนนสูงยิ่งเป็นเคสที่คนสนใจมาก เหมาะเอาไป Re-run
              เป็น Ads กระตุ้น Inbox ต่อ
            </p>
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
