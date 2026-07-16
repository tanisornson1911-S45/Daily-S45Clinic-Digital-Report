import React, { useState } from "react";
import AdsDashboard from "./App.jsx";
import FacebookAdsDashboard from "./FacebookAdsDashboard.jsx";

const TABS = [
  { key: "report", label: "Daily Digital Report" },
  { key: "fbads", label: "Facebook Ads Dashboard" },
];

export default function Root() {
  const [tab, setTab] = useState("report");

  return (
    <div>
      <div className="sticky top-0 z-30 flex gap-1 bg-slate-900 px-3 py-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg ${tab === t.key ? "bg-white text-slate-900" : "text-slate-300 hover:bg-slate-800"}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "report" ? <AdsDashboard /> : <FacebookAdsDashboard />}
    </div>
  );
}
