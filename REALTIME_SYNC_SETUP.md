# ทำให้ Dashboard อัพเดตข้อมูลอัตโนมัติ (Ads spend)

ไฟล์ที่เพิ่ม/แก้เข้ามา:

- `scripts/fetch-fb-spend.mjs` — ดึงยอด spend จริงจาก Facebook Marketing API
  ของบัญชีโฆษณา S45 แล้วเขียนเป็น `src/data/adSpend.json`
- `.github/workflows/update-dashboard-data.yml` — รันสคริปต์ข้างบนอัตโนมัติ
  ทุกวัน 01:00 (เวลาไทย) แล้ว commit + push ถ้าข้อมูลเปลี่ยน
- `src/data/adSpend.json` — ข้อมูล seed ครบ 10 เดือน (ต.ค. 2025 – ก.ค. 2026)
  เดือน 2026-06 มี breakdown รายหมวดจริงที่ดึงวันนี้ (12 ก.ค. 2026) ส่วนเดือน
  อื่นเป็นยอดรวมที่มาจากค่าที่เคย pull ไว้แล้วในไฟล์เดิม
- **`src/App.jsx` แก้เสร็จแล้ว** — `CATEGORIES`, `GRAND_TOTAL`, `MONTHLY_DATA`
  (ครบทั้ง 10 เดือน) และ `FB_SURGERY` ตอนนี้อ่านค่า spend จาก
  `src/data/adSpend.json` ก่อน ถ้าไม่มีข้อมูลเดือนนั้นค่อย fallback ไปใช้เลข
  เดิมที่ hardcode ไว้ — เช็ค bracket/brace แล้วไฟล์ยังสมบูรณ์ แต่ยังไม่ได้รัน
  `npm run build` จริงเพราะ sandbox นี้ต่อเน็ตไม่ได้ ควรรันที่เครื่องคุณก่อน push

## หมวด "Inter" — แก้ไขแล้วตามที่ยืนยันจากทีม

รอบก่อนหน้าผม map บัญชีโฆษณา "Nose Open | Freelance Nett" เข้ากับหมวด `inter`
แบบเดา ๆ ซึ่งผิด — ตอนนี้แก้ตามที่ยืนยันแล้วว่า **"Inter" คือแคมเปญที่ชื่อมีคำว่า
"Inter" อยู่ภายในบัญชีโฆษณา Nose Open 02** (ไม่ใช่ทั้งบัญชี) `scripts/fetch-fb-spend.mjs`
ตอนนี้ดึงข้อมูลระดับแคมเปญจากบัญชี Nose Open 02 แล้วกรองเฉพาะชื่อที่มีคำว่า
"Inter" (case-insensitive) มารวมกัน

ยอดจริงที่ดึงมาสำหรับ มิ.ย. 2026 (12 ก.ค. 2026): พบ 8 แคมเปญที่มีข้อมูล spend
และชื่อมีคำว่า "Inter" รวม **฿18,679** (บางแคมเปญในบัญชีชื่อมี Inter แต่ไม่มี
ข้อมูล spend ให้ดึง — API แจ้ง "Not available" ซึ่งนับเป็น 0 ในผลรวมนี้)
ตัวเลขนี้ต่างจากเลข fallback เดิม (28,636) พอสมควร แนะนำเช็คกับทีมอีกครั้งว่า
สมเหตุสมผลไหมก่อนเชื่อ 100%

## ต้องทำอะไรต่อ (ในเครื่องคุณ/repo จริง)

1. **สร้าง System User access token** ที่
   business.facebook.com/settings/system-users สำหรับ business
   "เสริมจมูกเกาหลี By หมอตี๋" ให้สิทธิ์ `ads_read` บนบัญชีโฆษณา S45
2. เพิ่ม token เป็น GitHub secret: repo → Settings → Secrets and variables →
   Actions → New repository secret → ชื่อ `FB_ACCESS_TOKEN`
3. วางไฟล์ทั้งหมดในนี้ทับ/เพิ่มใน repo จริงของคุณ (รวม `src/App.jsx` ที่แก้แล้ว)
   แล้ว `npm install && npm run build` เช็คก่อน push ขึ้น GitHub
4. ไป Actions tab → เลือก workflow "Update dashboard ad-spend data" →
   Run workflow เพื่อทดสอบครั้งแรก

## เรื่องที่ต้องรู้ก่อนต่อยอดฝั่งข้อมูลยอดขาย (SharePoint)

ตอนดึงไฟล์ `Data S45 Clinic (5)(มัดจำ 2026).csv` มาเทียบ พบว่าคอลัมน์ `Month`
ไม่ตรงกับวันที่จริงในบางแถว (เช่น แถวที่ label "Mar" มีวันที่เดือนอื่นปน, และมี
แถว "May" ที่วันที่เป็นเดือนมิถุนายน) — ถ้าจะดึงยอดขาย/เคสจาก SharePoint มา
อัตโนมัติด้วย ควร filter จากคอลัมน์วันที่จริง (`Date`/`OR Date`) แทนคอลัมน์
`Month` ที่พิมพ์มือ ไม่งั้นยอดจะเพี้ยนได้ (ส่วนนี้ยังไม่ได้ทำ — deposit/online/
sales ใน `App.jsx` ยังเป็นค่าคงที่ทั้งหมด)
