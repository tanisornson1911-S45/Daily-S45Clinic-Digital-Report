// liveData.js — เก็บข้อมูลที่ดึงมาจาก Worker API (production) หรือ import ไฟล์ local ตรงๆ (dev) ไว้ในตัวแปร
// module-level เดียว ให้ src/App.jsx อ่านแบบ sync ได้เหมือนตอน import ไฟล์ JSON ตรงๆ (ของเดิม) — เหตุผลที่ต้อง
// ทำแบบนี้แทนการ fetch ใน useEffect ของ App เอง: App.jsx มีค่าคงที่ระดับโมดูล (CATEGORIES/RAW_TX/FUNNEL_DATA ฯลฯ
// อีกเป็นพันบรรทัด) ที่คำนวณจากข้อมูลพวกนี้ทันทีตอน import โมดูล — ถ้าไม่มีข้อมูล sync พร้อมอยู่ก่อนโค้ดพวกนั้นรัน
// ต้องรื้อเขียนใหม่ทั้งไฟล์ วิธีนี้แทนคือ: src/main.jsx ดึง/โหลดข้อมูลให้เสร็จก่อน แล้วค่อย dynamic import("./App.jsx")
// (โมดูลของ App.jsx จะยังไม่ถูก evaluate จนกว่าจะ import ตอนนั้น) ทำให้ getLiveData() มีของพร้อมเสมอตอนที่ App.jsx
// เริ่มรัน โดยไม่ต้องแตะโค้ดคำนวณเดิมเลย
let _data = null;

export function setLiveData(data) {
  _data = data;
}

export function getLiveData() {
  if (!_data) {
    throw new Error("getLiveData() called before data was loaded — src/main.jsx must call setLiveData() first.");
  }
  return _data;
}
