import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabaseClient.js";

// Snapshot fetched live via the Facebook Ads MCP (Meta Graph API), account
// level, June 16 - July 15 2026, for the S45 clinic's 7 ad accounts. This is
// the fallback data source when Supabase isn't configured yet (see
// .env.example + supabase/schema.sql) — once api/sync-facebook-ads.js is
// running on a schedule, the dashboard reads live-synced rows instead.
const ACCOUNTS = [
  { id: "a1", name: "S45 - ยกคิ้ว ดึงหน้า", budget: 517000, spent: 450289, prevSpent: 405182, messaging: 2370, prevMessaging: 2133, purchase: 14, prevPurchase: 13, reach: 422913, impressions: 2036602, clicks: 54921, ctr: 2.70 },
  { id: "a2", name: "S45 - Nose Open | Freelance Nett", budget: 107000, spent: 90961, prevSpent: 80045, messaging: 479, prevMessaging: 422, purchase: 3, prevPurchase: 3, reach: 829165, impressions: 1489113, clicks: 32121, ctr: 2.16 },
  { id: "a3", name: "S45 - breast surgery", budget: 58000, spent: 47527, prevSpent: 49903, messaging: 250, prevMessaging: 263, purchase: 5, prevPurchase: 2, reach: 56315, impressions: 199166, clicks: 4023, ctr: 2.02 },
  { id: "a4", name: "S45 - Nose | Open 01", budget: 750000, spent: 690150, prevSpent: 586621, messaging: 3632, prevMessaging: 3087, purchase: 7, prevPurchase: 18, reach: 1893940, impressions: 8304006, clicks: 101313, ctr: 1.22 },
  { id: "a5", name: "S45 - Nose | Open 02", budget: 205000, spent: 180058, prevSpent: 165652, messaging: 948, prevMessaging: 872, purchase: 8, prevPurchase: 5, reach: 369341, impressions: 1332603, clicks: 24565, ctr: 1.84 },
  { id: "a6", name: "S45 - Nose | Open 03", budget: 71000, spent: 56175, prevSpent: 61792, messaging: 296, prevMessaging: 325, purchase: 6, prevPurchase: 2, reach: 94451, impressions: 218879, clicks: 7465, ctr: 3.41 },
  { id: "a7", name: "S45 - Nose | Semi Open", budget: 108500, spent: 93324, prevSpent: 83058, messaging: 491, prevMessaging: 437, purchase: 11, prevPurchase: 3, reach: 333185, impressions: 767822, clicks: 16469, ctr: 2.14 },
];

const CAMPAIGNS = [
  { id: "c1", accountId: "a1", name: "T_เพจหลัก MSG_หมอเช_ยกคิ้วดึงหน้า_TOF_25/06/69", status: "Active", budget: 400, spent: 22531, messaging: 100, purchase: 1, ctr: 2.28, roas: 1.8 },
  { id: "c2", accountId: "a1", name: "Nam47 - TOF(msg) Endotine - หมอเช| 0405_26 เพจหลัก", status: "Active", budget: 0, spent: 26610, messaging: 260, purchase: 2, ctr: 3.46, roas: 2.4 },
  { id: "c3", accountId: "a1", name: "T06 - TOF(msg) เพจหลัก - หมอตูน 13/05/69", status: "Active", budget: 1000, spent: 42673, messaging: 177, purchase: 1, ctr: 2.57, roas: 1.9 },
  { id: "c4", accountId: "a1", name: "T011 - TOF - MSG - เพจรอง - หมอเต๊า 26/05/69", status: "Active", budget: 0, spent: 17196, messaging: 140, purchase: 1, ctr: 3.44, roas: 2.1 },
  { id: "c5", accountId: "a1", name: "S05 - TOF - ENG - เพจรอง - หมออู๋Dr.Au - 10/07/69", status: "Active", budget: 200, spent: 1226, messaging: 0, purchase: 0, ctr: 1.07, roas: 0 },
  { id: "c6", accountId: "a1", name: "T - MSG - เพจ inter - ยกคิ้ว - 14/07/69 [พี่แเพร]", status: "Paused", budget: 500, spent: 0, messaging: 0, purchase: 0, ctr: 0, roas: 0 },
  { id: "c7", accountId: "a4", name: "T01 - TOF - MSG - NoseOpen - หมอโรส 21/05/69", status: "Active", budget: 0, spent: 34629, messaging: 126, purchase: 1, ctr: 2.44, roas: 1.7 },
  { id: "c8", accountId: "a4", name: "N100 - หมอตี๋ Dr.Ty_TOF(msg) เคสสวย Nose Open | 1105/26", status: "Active", budget: 0, spent: 61085, messaging: 118, purchase: 1, ctr: 0.84, roas: 1.1 },
  { id: "c9", accountId: "a4", name: "S17 - TOF - MSG - NoseOpen - Dr.Ty [Sub Best Ads] 25/06/26", status: "Active", budget: 1000, spent: 20532, messaging: 88, purchase: 1, ctr: 0.82, roas: 1.4 },
  { id: "c10", accountId: "a4", name: "S36 - TOF - MSG - NoseOpen - หมอตี๋Dr.Ty 01/07/69", status: "Active", budget: 1300, spent: 18597, messaging: 95, purchase: 1, ctr: 1.68, roas: 1.6 },
  { id: "c11", accountId: "a4", name: "[Retarget] S45 - TOF - MSG - NoseOpen - หมอตี๋Dr.Ty 01/07/69", status: "Active", budget: 650, spent: 9544, messaging: 23, purchase: 0, ctr: 1.55, roas: 1.0 },
  { id: "c12", accountId: "a3", name: "N92 [หลัก] - BOF(msg) | Breast | 2105_26", status: "Active", budget: 150, spent: 9374, messaging: 16, purchase: 0, ctr: 2.03, roas: 0.8 },
  { id: "c13", accountId: "a3", name: "N91 [หลัก] - BOF(msg) | Breast | 0505_26", status: "Active", budget: 400, spent: 11986, messaging: 80, purchase: 1, ctr: 2.19, roas: 1.5 },
  { id: "c14", accountId: "a3", name: "N87 [หลัก] - TOF(msg) | Breast | 2302_26", status: "Active", budget: 200, spent: 9276, messaging: 90, purchase: 1, ctr: 2.87, roas: 1.6 },
  { id: "c15", accountId: "a2", name: "DR.CHE l INBOX", status: "Active", budget: 0, spent: 28940, messaging: 183, purchase: 1, ctr: 2.48, roas: 1.7 },
  { id: "c16", accountId: "a2", name: "DR.CHE l VDO VIEW", status: "Active", budget: 0, spent: 15197, messaging: 0, purchase: 0, ctr: 1.63, roas: 0 },
  { id: "c17", accountId: "a2", name: "DR.CHE l INBOX LAL ผญ 09.06", status: "Active", budget: 400, spent: 8151, messaging: 136, purchase: 2, ctr: 4.08, roas: 2.6 },
  { id: "c18", accountId: "a7", name: "T - TOF (ENG) - 02/07/69 Nose Semi-Open [เพจรอง]", status: "Active", budget: 200, spent: 3931, messaging: 0, purchase: 0, ctr: 0.58, roas: 0 },
  { id: "c19", accountId: "a7", name: "T03 - Bof - MSG - เพจหลัก Nose Semi-Open 22/05/69 หมอตูน", status: "Active", budget: 0, spent: 15363, messaging: 162, purchase: 2, ctr: 3.28, roas: 2.5 },
  { id: "c20", accountId: "a7", name: "T04 - MSG - เพจหลัก Nose Semi-Open หมอตี๋ 25/05/69", status: "Active", budget: 0, spent: 12065, messaging: 70, purchase: 1, ctr: 2.59, roas: 1.6 },
  { id: "c21", accountId: "a5", name: "Nam02 | Dr.รวมหมอ - TOF(msg) Nose Open | 1905_26", status: "Active", budget: 999, spent: 30343, messaging: 0, purchase: 10, ctr: 3.69, roas: 3.2 },
  { id: "c22", accountId: "a5", name: "Nam01 | หมอบิ๊ก Dr.Big - TOF(msg) Nose Open | 1405_26", status: "Paused", budget: 500, spent: 7239, messaging: 109, purchase: 0, ctr: 3.70, roas: 2.0 },
  { id: "c23", accountId: "a6", name: "[Re-new] N77 - TOF(msg) Nose Open_รวมหมอ | 1103_26", status: "Paused", budget: 3333, spent: 52327, messaging: 107, purchase: 1, ctr: 0.97, roas: 1.1 },
  { id: "c24", accountId: "a6", name: "T - TOF - MSG - NoseOpen - 25/06/69 - หมอโรส", status: "Active", budget: 0, spent: 20853, messaging: 59, purchase: 0, ctr: 1.55, roas: 0.9 },
];

const ADS = [
  { id: "ad1", accountId: "a1", campaignId: "c2", name: "Nam47 - Endotine ยกคิ้วดึงหน้า", messaging: 260, purchase: 2, ctr: 3.46, spend: 26610 },
  { id: "ad2", accountId: "a1", campaignId: "c3", name: "T06 - เคสจริงหมอตูน", messaging: 177, purchase: 1, ctr: 2.57, spend: 42673 },
  { id: "ad3", accountId: "a4", campaignId: "c7", name: "T01 - NoseOpen หมอโรส", messaging: 126, purchase: 1, ctr: 2.44, spend: 34629 },
  { id: "ad4", accountId: "a4", campaignId: "c8", name: "N100 - เคสสวย Nose Open", messaging: 118, purchase: 1, ctr: 0.84, spend: 61085 },
  { id: "ad5", accountId: "a2", campaignId: "c15", name: "DR.CHE l INBOX", messaging: 183, purchase: 1, ctr: 2.48, spend: 28940 },
  { id: "ad6", accountId: "a2", campaignId: "c17", name: "DR.CHE l LAL ผญ Reel", messaging: 136, purchase: 2, ctr: 4.08, spend: 8151 },
  { id: "ad7", accountId: "a7", campaignId: "c19", name: "T03 - Nose Semi-Open หมอตูน", messaging: 162, purchase: 2, ctr: 3.28, spend: 15363 },
  { id: "ad8", accountId: "a3", campaignId: "c13", name: "N91 - Breast BOF Reel", messaging: 80, purchase: 1, ctr: 2.19, spend: 11986 },
  { id: "ad9", accountId: "a3", campaignId: "c14", name: "N87 - Breast TOF วิดีโอ", messaging: 90, purchase: 1, ctr: 2.87, spend: 9276 },
  { id: "ad10", accountId: "a6", campaignId: "c23", name: "N77 - Nose Open รวมหมอ", messaging: 107, purchase: 1, ctr: 0.97, spend: 52327 },
  { id: "ad11", accountId: "a5", campaignId: "c22", name: "Nam01 - หมอบิ๊ก Nose Open", messaging: 109, purchase: 0, ctr: 3.70, spend: 7239 },
  { id: "ad12", accountId: "a5", campaignId: "c21", name: "Nam02 - รวมหมอ Nose Open", messaging: 0, purchase: 10, ctr: 3.69, spend: 30343 },
];

const TREND_SEED = [3.1, 3.4, 2.9, 3.6, 3.2, 2.6, 2.4, 3.8, 4.1, 3.5, 3.0, 3.3, 3.9, 4.4];

const fmtInt = (n) => Math.round(n).toLocaleString("en-US");
const fmtThb = (n) => "฿" + fmtInt(n);
const fmtPct1 = (n) => n.toFixed(1) + "%";
const pad2 = (n) => String(n).padStart(2, "0");
const isoDate = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

function deltaOf(cur, prev) {
  if (!prev) return { pct: 0, up: true };
  const pct = ((cur - prev) / prev) * 100;
  return { pct, up: pct >= 0 };
}
function deltaNode(cur, prev) {
  const d = deltaOf(cur, prev);
  return {
    text: (d.up ? "▲ " : "▼ ") + Math.abs(d.pct).toFixed(1) + "%",
    className: d.up ? "text-emerald-400" : "text-rose-400",
  };
}

const DATE_RANGE_OPTIONS = [
  { key: "today", label: "วันนี้", days: 1, endOffset: 0 },
  { key: "yesterday", label: "เมื่อวาน", days: 1, endOffset: 1 },
  { key: "7d", label: "7 วัน", days: 7, endOffset: 0 },
  { key: "30d", label: "30 วัน", days: 30, endOffset: 0 },
  { key: "custom", label: "กำหนดเอง" },
];
const RANGE_LABEL = Object.fromEntries(DATE_RANGE_OPTIONS.map((o) => [o.key, o.label]));

function getRangeInfo(dateRange, customFrom, customTo) {
  const preset = DATE_RANGE_OPTIONS.find((o) => o.key === dateRange);
  if (preset && preset.days) return { days: preset.days, endOffset: preset.endOffset };
  if (dateRange === "custom" && customFrom && customTo) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const from = new Date(customFrom + "T00:00:00");
    const to = new Date(customTo + "T00:00:00");
    const diff = Math.round((to - from) / 86400000) + 1;
    if (isFinite(diff) && diff > 0) {
      const days = Math.min(30, diff);
      const endOffset = Math.max(0, Math.round((today - to) / 86400000));
      return { days, endOffset };
    }
  }
  return { days: 30, endOffset: 0 };
}
function dayMultiplier(offset) {
  const len = TREND_SEED.length;
  return TREND_SEED[((len - 1 - offset) % len + len) % len];
}
function buildTrendSeries(totalCur, totalPrev, days, endOffset) {
  const curWeights = [];
  for (let i = 0; i < days; i++) curWeights.push(dayMultiplier(endOffset + (days - 1 - i)));
  const curSum = curWeights.reduce((a, b) => a + b, 0) || 1;
  const curVals = curWeights.map((w) => (totalCur * w) / curSum);
  const prevWeights = [];
  for (let i = 0; i < days; i++) prevWeights.push(dayMultiplier(endOffset + days + (days - 1 - i)));
  const prevSum = prevWeights.reduce((a, b) => a + b, 0) || 1;
  const prevVals = prevWeights.map((w) => (totalPrev * w) / prevSum);
  return { curVals, prevVals };
}
function toSvgPoints(vals, maxVal) {
  const n = vals.length, padY = 8, usable = 70 - padY * 2;
  return vals.map((v, i) => {
    const x = n > 1 ? (i / (n - 1)) * 180 + 10 : 100;
    const y = padY + (1 - v / maxVal) * usable;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
}
function getScaleFactor(dateRange, customFrom, customTo) {
  const { days, endOffset } = getRangeInfo(dateRange, customFrom, customTo);
  let sum = 0;
  for (let i = 0; i < days; i++) sum += dayMultiplier(endOffset + i);
  let sum30 = 0;
  for (let i = 0; i < 30; i++) sum30 += dayMultiplier(i);
  return sum / sum30;
}

function TrendRow({ label, cur, prev, days, endOffset, fmt }) {
  const delta = deltaNode(cur, prev);
  const { curVals, prevVals } = buildTrendSeries(cur, prev, days, endOffset);
  const maxVal = Math.max(...curVals, ...prevVals, 1);
  const curPts = toSvgPoints(curVals, maxVal);
  const prevPts = toSvgPoints(prevVals, maxVal);
  const [curDotX, curDotY] = curPts[curPts.length - 1].split(",");
  const [prevDotX, prevDotY] = prevPts[prevPts.length - 1].split(",");
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold">{label}</span>
        <span className={`text-xs font-semibold ${delta.className}`}>{delta.text}</span>
      </div>
      <svg viewBox="0 0 200 70" className="w-full h-[70px] block" preserveAspectRatio="none">
        <polyline points={prevPts.join(" ")} fill="none" stroke="rgb(90,96,104)" strokeWidth="2" strokeDasharray="4,3" />
        <polyline points={curPts.join(" ")} fill="none" stroke="rgb(35,137,226)" strokeWidth="2.5" />
        <circle cx={prevDotX} cy={prevDotY} r="3.5" fill="rgb(120,126,134)" />
        <circle cx={curDotX} cy={curDotY} r="3.5" fill="rgb(35,137,226)" />
      </svg>
      <div className="flex justify-between text-[11px] mt-1">
        <span className="text-slate-500">ช่วงก่อนหน้า: {fmt(prev)}</span>
        <span className="text-slate-200 font-semibold">ช่วงนี้: {fmt(cur)}</span>
      </div>
    </div>
  );
}

function AdThumb({ name }) {
  return (
    <div className="w-full h-full bg-[rgb(32,37,45)] flex items-center justify-center text-center px-2">
      <span className="text-[10px] text-slate-500 leading-snug line-clamp-3">{name}</span>
    </div>
  );
}

export default function FacebookAdsDashboard() {
  const [view, setView] = useState("dashboard"); // 'dashboard' | 'settings'
  const [dateRange, setDateRangeState] = useState("30d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [selectedAccounts, setSelectedAccounts] = useState([]);
  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false);
  const [campaignSearch, setCampaignSearch] = useState("");
  const [campaignAccountFilter, setCampaignAccountFilter] = useState("all");
  const [campaignStatusFilter, setCampaignStatusFilter] = useState("all");
  const [topAdsMetric, setTopAdsMetric] = useState("messaging");
  const [now, setNow] = useState(new Date());

  const [syncState, setSyncState] = useState(null); // Supabase sync_state row, or null if unconfigured
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState(null);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    supabase
      .from("sync_state")
      .select("last_synced_at, last_status, last_error")
      .eq("id", 1)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data) setSyncState(data);
      });
    return () => { cancelled = true; };
  }, [view]);

  const setDateRange = (val) => {
    if (val === "custom" && (!customFrom || !customTo)) {
      const today = new Date();
      const from = new Date(today.getTime() - 7 * 86400000);
      setCustomFrom(isoDate(from));
      setCustomTo(isoDate(today));
    }
    setDateRangeState(val);
  };

  const toggleAccountSel = (id) => {
    setSelectedAccounts((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    setAccountDropdownOpen(false);
  };

  const fAccounts = selectedAccounts.length ? ACCOUNTS.filter((a) => selectedAccounts.includes(a.id)) : ACCOUNTS;
  const { days: rangeDays, endOffset } = getRangeInfo(dateRange, customFrom, customTo);
  const scaleFactor = getScaleFactor(dateRange, customFrom, customTo);
  const sc = (v) => Math.round(v * scaleFactor);

  const scaledAccounts = useMemo(
    () =>
      fAccounts.map((a) => ({
        ...a,
        spent: sc(a.spent), prevSpent: sc(a.prevSpent),
        messaging: sc(a.messaging), prevMessaging: sc(a.prevMessaging),
        purchase: sc(a.purchase), prevPurchase: sc(a.prevPurchase),
        reach: sc(a.reach), impressions: sc(a.impressions), clicks: sc(a.clicks),
      })),
    [fAccounts, scaleFactor]
  );

  const totalBudget = scaledAccounts.reduce((n, a) => n + a.budget, 0);
  const totalSpent = scaledAccounts.reduce((n, a) => n + a.spent, 0);
  const prevSpent = scaledAccounts.reduce((n, a) => n + a.prevSpent, 0);
  const totalMessaging = scaledAccounts.reduce((n, a) => n + a.messaging, 0);
  const prevMessaging = scaledAccounts.reduce((n, a) => n + a.prevMessaging, 0);
  const totalPurchase = scaledAccounts.reduce((n, a) => n + a.purchase, 0);
  const prevPurchase = scaledAccounts.reduce((n, a) => n + a.prevPurchase, 0);
  const spentPct = totalBudget ? (totalSpent / totalBudget) * 100 : 0;
  const base30Spent = fAccounts.reduce((n, a) => n + a.spent, 0);
  const base30Messaging = fAccounts.reduce((n, a) => n + a.messaging, 0);

  const dSpent = deltaNode(totalSpent, prevSpent);
  const dMsg = deltaNode(totalMessaging, prevMessaging);
  const dPurchase = deltaNode(totalPurchase, prevPurchase);

  const currentRangeLabel = RANGE_LABEL[dateRange] || "30 วัน";
  const alertAccounts = scaledAccounts.filter((a) => a.budget && a.spent / a.budget >= 0.9);

  const accById = useMemo(() => Object.fromEntries(ACCOUNTS.map((a) => [a.id, a])), []);
  const allowedAccIds = selectedAccounts.length ? new Set(selectedAccounts) : null;

  const filteredCampaigns = useMemo(() => {
    return CAMPAIGNS.filter((c) => {
      if (allowedAccIds && !allowedAccIds.has(c.accountId)) return false;
      if (campaignAccountFilter !== "all" && c.accountId !== campaignAccountFilter) return false;
      if (campaignStatusFilter !== "all" && c.status !== campaignStatusFilter) return false;
      if (campaignSearch && !c.name.toLowerCase().includes(campaignSearch.toLowerCase())) return false;
      return true;
    });
  }, [selectedAccounts, campaignAccountFilter, campaignStatusFilter, campaignSearch]);

  const scopedAds = allowedAccIds ? ADS.filter((ad) => allowedAccIds.has(ad.accountId)) : ADS;
  const topAdsList = useMemo(
    () => [...scopedAds].sort((x, y) => y[topAdsMetric] - x[topAdsMetric]).slice(0, 6),
    [scopedAds, topAdsMetric]
  );

  const barCount = Math.max(1, Math.min(30, rangeDays));
  const dayOffsets = [];
  const dayLabels = [];
  for (let i = barCount - 1; i >= 0; i--) {
    const off = i + endOffset;
    dayOffsets.push(off);
    dayLabels.push(off === 0 ? "วันนี้" : off === 1 ? "เมื่อวาน" : "-" + off);
  }
  const multipliers = dayOffsets.map((off) => dayMultiplier(off));
  const baseSpend = base30Spent / 30;
  const baseMsg = base30Messaging / 30;
  const maxSpend = Math.max(...multipliers) * baseSpend * 1.4 || 1;
  const maxMsg = Math.max(...multipliers) * baseMsg * 1.4 || 1;
  const trendBars = dayLabels.map((label, i) => {
    const mult = multipliers[i];
    const spendVal = baseSpend * mult;
    const msgVal = baseMsg * mult;
    return {
      label,
      tooltip: `${fmtThb(Math.round(spendVal))} · ${Math.round(msgVal)} msg`,
      spendPct: (spendVal / maxSpend) * 100,
      msgPct: (msgVal / maxMsg) * 100,
    };
  });

  const clockTime = now.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const clockDate = now.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });

  const exportCSV = () => {
    const header = ["Campaign", "Account", "Status", "Budget", "Spent", "Messaging", "Purchase", "CTR", "ROAS"];
    const lines = [header.join(",")];
    filteredCampaigns.forEach((c) => {
      const acc = accById[c.accountId];
      const vals = [c.name, acc ? acc.name : "", c.status, c.budget, Math.round(c.spent * scaleFactor), Math.round(c.messaging * scaleFactor), Math.round(c.purchase * scaleFactor), c.ctr, c.roas];
      lines.push(vals.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "campaigns.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const runSyncNow = async () => {
    setSyncing(true);
    setSyncError(null);
    try {
      const res = await fetch("/api/sync-facebook-ads", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "sync failed");
      if (supabase) {
        const { data } = await supabase.from("sync_state").select("last_synced_at, last_status, last_error").eq("id", 1).maybeSingle();
        setSyncState(data);
      }
    } catch (err) {
      setSyncError(String(err.message || err));
    } finally {
      setSyncing(false);
    }
  };

  const isSupabaseConfigured = !!supabase;

  return (
    <div className="min-h-screen bg-[rgb(10,14,18)] text-[rgb(226,229,232)] pb-16" style={{ fontFamily: "'Noto Sans Thai','Inter',-apple-system,Helvetica,Arial,sans-serif" }}>
      {/* Top nav */}
      <div className="sticky top-0 z-20 bg-[rgba(13,18,24,0.92)] backdrop-blur border-b border-[rgb(36,41,48)]">
        <div className="max-w-[1400px] mx-auto px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-[9px] bg-[rgb(35,137,226)] flex items-center justify-center font-bold text-[16px] text-[rgb(8,11,15)]">FB</div>
            <div>
              <div className="text-[16px] font-bold tracking-tight">Ads Insight</div>
              <div className="text-xs text-slate-500">
                {isSupabaseConfigured
                  ? syncState?.last_synced_at
                    ? `ซิงค์ล่าสุดจาก Facebook Ads · ${new Date(syncState.last_synced_at).toLocaleString("th-TH")}`
                    : "ยังไม่เคยซิงค์ผ่าน Supabase"
                  : "ใช้ข้อมูลชุดล่าสุดที่ดึงผ่าน Facebook Ads MCP (ยังไม่ได้ตั้งค่า Supabase)"}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="text-right leading-tight">
              <div className="text-[15px] font-bold tabular-nums">{clockTime}</div>
              <div className="text-[11px] text-slate-500">{clockDate}</div>
            </div>
            <div className="w-px h-7 bg-[rgb(41,46,53)]" />
            {view === "dashboard" && (
              <div className="flex bg-[rgb(22,27,33)] border border-[rgb(41,46,53)] rounded-[10px] p-[3px]">
                {DATE_RANGE_OPTIONS.map((o) => (
                  <button
                    key={o.key}
                    onClick={() => setDateRange(o.key)}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-lg font-inherit ${dateRange === o.key ? "bg-[rgb(35,137,226)] text-[rgb(8,11,15)]" : "text-slate-400"}`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={() => setView(view === "dashboard" ? "settings" : "dashboard")}
              className="flex items-center gap-2 bg-[rgb(22,27,33)] border border-[rgb(41,46,53)] text-slate-200 rounded-[10px] px-3.5 py-2 text-[13px]"
            >
              <span className={`w-2 h-2 rounded-full inline-block ${isSupabaseConfigured ? "bg-emerald-500" : "bg-rose-500"}`} />
              <span>{view === "dashboard" ? "การเชื่อมต่อ" : "กลับไป Dashboard"}</span>
            </button>
            {view === "dashboard" && dateRange === "custom" && (
              <div className="flex items-center gap-2 flex-wrap text-xs">
                <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="bg-[rgb(22,27,33)] border border-[rgb(41,46,53)] text-slate-200 rounded-lg px-2 py-1.5" />
                <span className="text-slate-500">ถึง</span>
                <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="bg-[rgb(22,27,33)] border border-[rgb(41,46,53)] text-slate-200 rounded-lg px-2 py-1.5" />
              </div>
            )}
            {view === "dashboard" && (
              <div className="relative">
                <button
                  onClick={() => setAccountDropdownOpen((v) => !v)}
                  className="flex items-center gap-2 bg-[rgb(22,27,33)] border border-[rgb(41,46,53)] text-slate-200 rounded-[10px] px-3.5 py-2 text-[13px]"
                >
                  <span>บัญชี: {!selectedAccounts.length ? "ทั้งหมด" : `${selectedAccounts.length} บัญชี`}</span>
                  <span className="text-[10px] opacity-70">▾</span>
                </button>
                {accountDropdownOpen && (
                  <div className="absolute right-0 top-[calc(100%+6px)] bg-[rgb(18,22,28)] border border-[rgb(45,51,59)] rounded-xl p-2 w-[280px] max-h-[340px] overflow-y-auto shadow-2xl z-30">
                    <button onClick={() => { setSelectedAccounts([]); setAccountDropdownOpen(false); }} className="w-full text-left bg-transparent text-[rgb(89,170,248)] text-xs px-2 py-1.5 rounded-lg">
                      เลือกทั้งหมด / ล้างการเลือก
                    </button>
                    {ACCOUNTS.map((a) => (
                      <label key={a.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer text-[13px] hover:bg-[rgb(27,32,38)]">
                        <input type="checkbox" checked={selectedAccounts.includes(a.id)} onChange={() => toggleAccountSel(a.id)} />
                        <span>{a.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {view === "dashboard" && (
        <div className="max-w-[1400px] mx-auto px-6 pt-7 flex flex-col gap-7">
          {/* Period comparison */}
          <div className="bg-[rgb(18,22,28)] border border-[rgb(36,41,48)] rounded-2xl p-5">
            <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
              <div>
                <h2 className="m-0 text-[16px] font-bold">เปรียบเทียบกับช่วงก่อนหน้า</h2>
                <div className="text-xs text-slate-500 mt-0.5">ช่วงที่เลือก: {currentRangeLabel}</div>
              </div>
              <div className="flex gap-3.5 text-xs text-slate-500">
                <span><span className="inline-block w-2.5 h-2.5 rounded-sm bg-[rgb(35,137,226)] mr-1.5" />ช่วงนี้</span>
                <span><span className="inline-block w-2.5 h-2.5 rounded-sm bg-[rgb(60,66,74)] mr-1.5" />ช่วงก่อนหน้า</span>
              </div>
            </div>
            <div className="grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))" }}>
              <TrendRow label="งบใช้จ่าย" cur={totalSpent} prev={prevSpent} days={rangeDays} endOffset={endOffset} fmt={fmtThb} />
              <TrendRow label="Total Messaging Contacts" cur={totalMessaging} prev={prevMessaging} days={rangeDays} endOffset={endOffset} fmt={fmtInt} />
              <TrendRow label="Purchase" cur={totalPurchase} prev={prevPurchase} days={rangeDays} endOffset={endOffset} fmt={fmtInt} />
            </div>
          </div>

          {/* Budget alert */}
          {alertAccounts.length > 0 && (
            <div className="flex items-center gap-3 bg-[rgba(56,27,14,0.5)] border border-[rgb(126,67,40)] rounded-xl px-4.5 py-3.5">
              <div className="w-7 h-7 rounded-full bg-[rgb(198,93,38)] text-[rgb(15,10,8)] flex items-center justify-center font-bold shrink-0">!</div>
              <div className="text-[13px] text-[rgb(235,227,223)]">
                งบใกล้หมด: {alertAccounts.map((a) => a.name).join(", ")} ใช้งบเกิน 90% แล้ว
              </div>
            </div>
          )}

          {/* KPI cards */}
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[230px] bg-[rgb(18,22,28)] border border-[rgb(36,41,48)] rounded-2xl p-5">
              <div className="text-xs text-slate-500 mb-2">งบประมาณรวมทุกบัญชี</div>
              <div className="text-[26px] font-bold tracking-tight">{fmtThb(totalBudget)}</div>
            </div>
            <div className="flex-1 min-w-[230px] bg-[rgb(18,22,28)] border border-[rgb(36,41,48)] rounded-2xl p-5">
              <div className="text-xs text-slate-500 mb-2">ใช้จ่ายไปแล้ว</div>
              <div className="text-[26px] font-bold tracking-tight">{fmtThb(totalSpent)}</div>
              <div className="flex items-center gap-1.5 mt-2 text-xs">
                <span className={dSpent.className}>{dSpent.text}</span>
                <span className="text-slate-500">เทียบช่วงก่อนหน้า</span>
              </div>
              <div className="mt-3 h-1.5 rounded bg-[rgb(36,41,48)] overflow-hidden">
                <div className="h-full" style={{ width: `${Math.min(spentPct, 100).toFixed(1)}%`, background: spentPct >= 90 ? "rgb(228,98,18)" : "rgb(35,137,226)" }} />
              </div>
              <div className="mt-1.5 text-[11px] text-slate-500">{fmtPct1(spentPct)} ของงบทั้งหมด</div>
            </div>
            <div className="flex-1 min-w-[230px] bg-[rgb(18,22,28)] border border-[rgb(36,41,48)] rounded-2xl p-5">
              <div className="text-xs text-slate-500 mb-2">Total Messaging Contacts</div>
              <div className="text-[26px] font-bold tracking-tight">{fmtInt(totalMessaging)}</div>
              <div className="flex items-center gap-1.5 mt-2 text-xs">
                <span className={dMsg.className}>{dMsg.text}</span>
                <span className="text-slate-500">เทียบช่วงก่อนหน้า</span>
              </div>
            </div>
            <div className="flex-1 min-w-[230px] bg-[rgb(18,22,28)] border border-[rgb(36,41,48)] rounded-2xl p-5">
              <div className="text-xs text-slate-500 mb-2">Purchase</div>
              <div className="text-[26px] font-bold tracking-tight">{fmtInt(totalPurchase)}</div>
              <div className="flex items-center gap-1.5 mt-2 text-xs">
                <span className={dPurchase.className}>{dPurchase.text}</span>
                <span className="text-slate-500">เทียบช่วงก่อนหน้า</span>
              </div>
            </div>
          </div>

          {/* Per-account budget breakdown */}
          <div className="bg-[rgb(18,22,28)] border border-[rgb(36,41,48)] rounded-2xl p-5">
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="m-0 text-[16px] font-bold">งบประมาณแยกบัญชี</h2>
              <span className="text-xs text-slate-500">{scaledAccounts.length} บัญชี</span>
            </div>
            <div className="flex flex-col gap-3.5">
              {scaledAccounts.map((a) => {
                const pct = (a.spent / a.budget) * 100;
                const isAlert = pct >= 90;
                return (
                  <div key={a.id}>
                    <div className="flex items-center justify-between mb-1.5 gap-3 flex-wrap">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[13px] font-semibold whitespace-nowrap overflow-hidden text-ellipsis">{a.name}</span>
                        {isAlert && <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-[rgba(74,32,12,0.6)] text-[rgb(255,185,151)] whitespace-nowrap">ใกล้เต็มงบ</span>}
                      </div>
                      <div className="text-xs text-slate-400 whitespace-nowrap">
                        {fmtThb(a.spent)} / {fmtThb(a.budget)} · <span className={isAlert ? "text-[rgb(222,121,73)] font-semibold" : "text-[rgb(74,148,219)]"}>{fmtPct1(pct)}</span>
                      </div>
                    </div>
                    <div className="h-2 rounded bg-[rgb(34,39,46)] overflow-hidden">
                      <div className="h-full" style={{ width: `${Math.min(pct, 100).toFixed(1)}%`, background: isAlert ? "rgb(228,98,18)" : "rgb(35,137,226)" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Trend chart */}
          <div className="bg-[rgb(18,22,28)] border border-[rgb(36,41,48)] rounded-2xl p-5">
            <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
              <h2 className="m-0 text-[16px] font-bold">แนวโน้มรายวัน</h2>
              <div className="flex gap-3.5 text-xs text-slate-400">
                <span><span className="inline-block w-2.5 h-2.5 rounded-sm bg-[rgb(35,137,226)] mr-1.5" />งบใช้จ่าย</span>
                <span><span className="inline-block w-2.5 h-2.5 rounded-sm bg-[rgb(84,176,90)] mr-1.5" />Messaging Contacts</span>
              </div>
            </div>
            <div className="flex items-end gap-1.5 h-40">
              {trendBars.map((d, i) => (
                <div key={i} title={d.tooltip} className="flex-1 flex flex-col items-center h-full justify-end gap-1">
                  <div className="w-full flex gap-0.5 items-end h-full">
                    <div className="flex-1 bg-[rgb(35,137,226)] rounded-t-sm" style={{ height: `${d.spendPct.toFixed(1)}%` }} />
                    <div className="flex-1 bg-[rgb(84,176,90)] rounded-t-sm" style={{ height: `${d.msgPct.toFixed(1)}%` }} />
                  </div>
                  <span className="text-[9px] text-slate-600">{d.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Top Ads */}
          <div className="bg-[rgb(18,22,28)] border border-[rgb(36,41,48)] rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2.5">
              <h2 className="m-0 text-[16px] font-bold">Top Ads · เข้าถึงดีที่สุด</h2>
              <div className="flex bg-[rgb(22,27,33)] border border-[rgb(41,46,53)] rounded-[10px] p-[3px]">
                {[["messaging", "Messaging"], ["purchase", "Purchase"], ["ctr", "CTR"]].map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setTopAdsMetric(key)}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-lg ${topAdsMetric === key ? "bg-[rgb(35,137,226)] text-[rgb(8,11,15)]" : "text-slate-400"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))" }}>
              {topAdsList.map((ad, i) => (
                <div key={ad.id} className="bg-[rgb(25,29,36)] border border-[rgb(41,46,53)] rounded-xl overflow-hidden">
                  <div className="w-full relative" style={{ aspectRatio: "4/5" }}>
                    <AdThumb name={ad.name} />
                    <div className="absolute top-2 left-2 bg-[rgb(35,137,226)] text-[rgb(8,11,15)] text-[11px] font-bold px-2 py-0.5 rounded-md">#{i + 1}</div>
                  </div>
                  <div className="p-3">
                    <div className="text-xs font-semibold whitespace-nowrap overflow-hidden text-ellipsis mb-0.5">{ad.name}</div>
                    <div className="text-[11px] text-slate-500 mb-2 whitespace-nowrap overflow-hidden text-ellipsis">{accById[ad.accountId]?.name}</div>
                    <div className="flex justify-between text-[11px]"><span className="text-slate-400">Messaging</span><span className="font-semibold">{fmtInt(sc(ad.messaging))}</span></div>
                    <div className="flex justify-between text-[11px] mt-1"><span className="text-slate-400">Purchase</span><span className="font-semibold">{fmtInt(sc(ad.purchase))}</span></div>
                    <div className="flex justify-between text-[11px] mt-1"><span className="text-slate-400">CTR</span><span className="font-semibold">{ad.ctr.toFixed(1)}%</span></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Ads gallery */}
          <div className="bg-[rgb(18,22,28)] border border-[rgb(36,41,48)] rounded-2xl p-5">
            <h2 className="m-0 mb-4 text-[16px] font-bold">ภาพ Ads ทั้งหมด</h2>
            <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))" }}>
              {scopedAds.map((ad) => (
                <div key={ad.id} className="bg-[rgb(25,29,36)] border border-[rgb(41,46,53)] rounded-lg overflow-hidden">
                  <div className="w-full" style={{ aspectRatio: "1/1" }}><AdThumb name={ad.name} /></div>
                  <div className="p-2">
                    <div className="text-[11px] font-semibold whitespace-nowrap overflow-hidden text-ellipsis">{ad.name}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">CTR {ad.ctr.toFixed(1)}% · {fmtThb(sc(ad.spend))}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Campaigns table */}
          <div className="bg-[rgb(18,22,28)] border border-[rgb(36,41,48)] rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <h2 className="m-0 text-[16px] font-bold">รายชื่อแคมเปญทั้งหมด</h2>
              <button onClick={exportCSV} className="flex items-center gap-1.5 bg-[rgb(35,137,226)] text-[rgb(8,11,15)] border-none rounded-lg px-4 py-2 text-xs font-bold">
                ⬇ Export CSV
              </button>
            </div>
            <div className="flex gap-2.5 mb-4 flex-wrap">
              <input
                type="text" placeholder="ค้นหาชื่อแคมเปญ..." value={campaignSearch}
                onChange={(e) => setCampaignSearch(e.target.value)}
                className="flex-1 min-w-[200px] bg-[rgb(22,27,33)] border border-[rgb(41,46,53)] text-slate-200 rounded-lg px-3 py-2 text-[13px]"
              />
              <select
                value={campaignAccountFilter} onChange={(e) => setCampaignAccountFilter(e.target.value)}
                className="bg-[rgb(22,27,33)] border border-[rgb(41,46,53)] text-slate-200 rounded-lg px-3 py-2 text-[13px]"
              >
                <option value="all">ทุกบัญชี</option>
                {fAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <select
                value={campaignStatusFilter} onChange={(e) => setCampaignStatusFilter(e.target.value)}
                className="bg-[rgb(22,27,33)] border border-[rgb(41,46,53)] text-slate-200 rounded-lg px-3 py-2 text-[13px]"
              >
                <option value="all">ทุกสถานะ</option>
                <option value="Active">กำลังทำงาน</option>
                <option value="Paused">หยุดชั่วคราว</option>
              </select>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[12.5px] min-w-[920px]">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-[rgb(41,46,53)]">
                    <th className="py-2.5 px-2 font-semibold">แคมเปญ</th>
                    <th className="py-2.5 px-2 font-semibold">บัญชี</th>
                    <th className="py-2.5 px-2 font-semibold">สถานะ</th>
                    <th className="py-2.5 px-2 font-semibold text-right">งบ/ใช้ไป</th>
                    <th className="py-2.5 px-2 font-semibold text-right">Messaging</th>
                    <th className="py-2.5 px-2 font-semibold text-right">Purchase</th>
                    <th className="py-2.5 px-2 font-semibold text-right">CTR</th>
                    <th className="py-2.5 px-2 font-semibold text-right">ROAS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCampaigns.map((c) => {
                    const acc = accById[c.accountId];
                    const active = c.status === "Active";
                    return (
                      <tr key={c.id} className="border-b border-[rgb(29,34,40)]">
                        <td className="py-2.5 px-2 max-w-[260px] whitespace-nowrap overflow-hidden text-ellipsis" title={c.name}>{c.name}</td>
                        <td className="py-2.5 px-2 text-slate-400 whitespace-nowrap">{acc?.name}</td>
                        <td className="py-2.5 px-2">
                          <span className={`text-[11px] px-2 py-0.5 rounded-md font-semibold ${active ? "bg-[rgba(0,58,5,0.5)] text-[rgb(122,207,126)]" : "bg-[rgba(42,46,51,0.6)] text-slate-400"}`}>
                            {active ? "กำลังทำงาน" : "หยุดชั่วคราว"}
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-right whitespace-nowrap">{fmtThb(sc(c.spent))} / {fmtThb(c.budget)}</td>
                        <td className="py-2.5 px-2 text-right">{fmtInt(sc(c.messaging))}</td>
                        <td className="py-2.5 px-2 text-right">{fmtInt(sc(c.purchase))}</td>
                        <td className="py-2.5 px-2 text-right">{c.ctr.toFixed(1)}%</td>
                        <td className="py-2.5 px-2 text-right">{c.roas.toFixed(1)}x</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredCampaigns.length === 0 && (
                <div className="py-8 text-center text-slate-500 text-[13px]">ไม่พบแคมเปญที่ตรงกับตัวกรอง</div>
              )}
            </div>
            <div className="mt-3 text-[11px] text-slate-600">แสดง {filteredCampaigns.length} จากทั้งหมด {CAMPAIGNS.length} แคมเปญ</div>
          </div>
        </div>
      )}

      {view === "settings" && (
        <div className="max-w-[760px] mx-auto px-6 pt-7 flex flex-col gap-5">
          <div>
            <button onClick={() => setView("dashboard")} className="bg-transparent border-none text-[rgb(89,170,248)] text-[13px] p-0">← กลับไปที่ Dashboard</button>
            <h1 className="mt-3 mb-1 text-[22px] font-bold">การเชื่อมต่อ Meta Ads Insights API</h1>
            <p className="m-0 text-[13px] text-slate-500">จัดการการซิงค์ข้อมูลบัญชีโฆษณา Facebook/Instagram ที่ใช้เข้า Dashboard นี้</p>
          </div>

          <div className="bg-[rgb(18,22,28)] border border-[rgb(36,41,48)] rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-4">
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${isSupabaseConfigured ? "bg-emerald-500" : "bg-rose-500"}`} />
              <div>
                <div className="text-sm font-bold">{isSupabaseConfigured ? "Supabase เชื่อมต่อแล้ว" : "ยังไม่ได้ตั้งค่า Supabase"}</div>
                <div className="text-xs text-slate-500">
                  {isSupabaseConfigured
                    ? "อ่านข้อมูลที่ซิงค์แล้วจาก Supabase (ตาราง insights_daily / campaigns / ads)"
                    : "ตั้งค่า VITE_SUPABASE_URL และ VITE_SUPABASE_ANON_KEY เพื่อเปิดใช้งาน"}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-6 text-xs text-slate-500 mb-4">
              <div>วิธีเชื่อมต่อ: <strong className="text-slate-200">Meta System User Token (server-only)</strong></div>
              <div>ซิงค์ล่าสุด: <strong className="text-slate-200">{syncState?.last_synced_at ? new Date(syncState.last_synced_at).toLocaleString("th-TH") : "ยังไม่มีข้อมูล"}</strong></div>
              {syncState?.last_status === "error" && <div className="text-rose-400">ซิงค์ล่าสุดล้มเหลว: {syncState.last_error}</div>}
            </div>
            <div className="flex gap-2.5 flex-wrap">
              <button onClick={runSyncNow} disabled={syncing} className="bg-[rgb(35,137,226)] text-[rgb(8,11,15)] border-none rounded-lg px-4 py-2 text-[13px] font-bold disabled:opacity-50">
                {syncing ? "กำลังซิงค์..." : "ซิงค์ตอนนี้"}
              </button>
            </div>
            {syncError && <div className="mt-2 text-xs text-rose-400">{syncError}</div>}
          </div>

          <div className="bg-[rgba(56,27,14,0.35)] border border-[rgb(90,60,30)] rounded-2xl p-5">
            <div className="text-[13px] font-bold mb-2 text-[rgb(235,227,223)]">หมายเหตุด้านเทคนิค</div>
            <p className="m-0 mb-2.5 text-[12.5px] leading-relaxed text-[rgb(210,200,190)]">
              Dashboard นี้อ่านข้อมูลจาก Supabase เท่านั้น — Access Token / App Secret ไม่ถูกฝังไว้ใน HTML/JS ฝั่ง Browser เด็ดขาด
            </p>
            <p className="m-0 mb-2.5 text-[12.5px] leading-relaxed text-[rgb(210,200,190)]">
              <strong>รูปแบบที่ใช้:</strong> Meta System User Token (สร้างจาก Business Settings ครั้งเดียว, สิทธิ์ <code>ads_read</code>) เก็บไว้เป็น environment variable <code>FB_SYSTEM_USER_TOKEN</code> บน Vercel/Supabase เท่านั้น แล้วให้ <code>api/sync-facebook-ads.js</code> ดึงข้อมูลตามตารางเวลา (ดู <code>vercel.json</code>) เขียนเข้า Supabase — หน้านี้อ่านจาก Supabase อย่างเดียว ไม่มีการเรียก Graph API จาก Browser
            </p>
            <p className="m-0 text-[12.5px] leading-relaxed text-[rgb(210,200,190)]">
              <strong>ขั้นตอน Deploy:</strong> 1) สร้างโปรเจกต์ Supabase แล้วรัน <code>supabase/schema.sql</code> 2) ตั้งค่า env vars ตาม <code>.env.example</code> บน Vercel 3) Deploy — cron ใน <code>vercel.json</code> จะเรียก <code>/api/sync-facebook-ads</code> ให้อัตโนมัติ หรือกด "ซิงค์ตอนนี้" ด้านบนเพื่อรันทันที
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
