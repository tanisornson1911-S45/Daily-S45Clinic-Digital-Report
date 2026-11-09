import React, { useState } from "react";

// หน้าล็อกอินเล็กๆ ก่อนเข้าแดชบอร์ด (production เท่านั้น) — ใช้ username/password ชุดเดียวกับ Basic Auth ของ
// Vercel middleware (DASH_USER/DASH_PASS) ส่งต่อให้ Worker API ตรวจสอบอีกชั้น จำเป็นต้องถามซ้ำที่นี่เพราะ JS ฝั่ง
// browser "อ่าน" credential ที่ browser ใช้ตอบ Basic Auth ของตัวหน้าเว็บเองไม่ได้ (เป็นข้อจำกัดด้าน security ของ
// Basic Auth เอง ไม่ใช่บั๊ก) — กรอกครั้งเดียวต่อ session (เก็บไว้ใน sessionStorage จนกว่าจะปิดแท็บ)
export default function WorkerLogin({ onSubmit, errorMessage }) {
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    await onSubmit(user, pass);
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <h1 className="text-lg font-semibold text-slate-800 mb-1">S45 Clinic Dashboard</h1>
        <p className="text-sm text-slate-500 mb-5">กรอกบัญชีเดียวกับที่ใช้เข้าเว็บนี้ เพื่อดึงข้อมูล</p>
        <label className="block text-xs font-medium text-slate-600 mb-1">Username</label>
        <input
          type="text"
          value={user}
          onChange={(e) => setUser(e.target.value)}
          autoFocus
          autoComplete="username"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
        <label className="block text-xs font-medium text-slate-600 mb-1">Password</label>
        <input
          type="password"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          autoComplete="current-password"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
        {errorMessage && <p className="text-sm text-rose-600 mb-4">{errorMessage}</p>}
        <button
          type="submit"
          disabled={submitting || !user || !pass}
          className="w-full rounded-lg bg-teal-600 text-white text-sm font-medium py-2 disabled:opacity-50"
        >
          {submitting ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
        </button>
      </form>
    </div>
  );
}
