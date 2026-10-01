# رَصْد | RASD
### منصة تسجيل المبيعات والنواقص وإدارة طلبات قطع الغيار
**Automotive & Heavy Equipment Spare Parts Sales & Shortages Management Platform**

[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](https://nextjs.org/)
[![NestJS](https://img.shields.io/badge/NestJS-10-E0234E?logo=nestjs)](https://nestjs.com/)
[![Prisma](https://img.shields.io/badge/Prisma-5-2D3748?logo=prisma)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql)](https://www.postgresql.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## 📋 نظرة عامة (Overview)

نظام **رَصْد (RASD)** هو منصة رقمية متطورة وسريعة موجهة لشركات ومحلات قطع الغيار لتسجيل المبيعات اليومية بغير فاتورة، ومتابعة النواقص والقطع المطلوبة من العملاء، وتتبع الطلبات وإدارتها بكفاءة ودقة عالية.

### ✨ أبرز المميزات:
- **تسجيل مبيعات سريع:** إضافة قطع الغيار مع دعم البحث المباشر برقم القطعة الأساسي والبديل.
- **إدارة النواقص والطلبات:** تسجيل النواقص وتتبعها وإغلاقها تلقائياً عند وصول الكميات.
- **تطابق الأرقام البديلة المتداخلة (Reciprocal Part Numbers):** دعم أرقام القطع التبادلية بدون تعارض.
- **استيراد وتحديث إكسل ذكي:** فحص ملفات Excel الكبيرة ومعالجة التحديثات والإضافات مع فلاتر فرز متقدمة.
- **طباعة كشوفات A4 احترافية:** كشف فوري يدعم رمز الريال السعودي المعتمد (⃁) وإخفاء الأسعار تلقائياً لموظفي المبيعات (Operators).
- **جلسة ممتدة وخاصية "تذكّر هذا الجهاز":** بقاء الجلسة نشطة لمدة أسبوع كامل مع تعبئة تلقائية للبيانات.
- **استيراد واستعادة نسخ احتياطية كاملة:** أخذ واستعادة النسخ الاحتياطية بنقرة واحدة لقاعدة البيانات مع فحص الجاهزية وسلامة البيانات.
- **صلاحيات وأدوار دقيقة:** مدير منصة، مدير شركة، ومشغّل/بائع مبيعات.

---

## 🔑 بيانات الدخول الافتراضية (Default Credentials)

تم إعداد حساب مدير المنصة العام في قاعدة البيانات من أصل النظام:

| الدور (Role) | اسم المستخدم (Username) | كلمة المرور (Password) | الاسم الكامل (Full Name) | الصلاحية |
| :--- | :--- | :--- | :--- | :--- |
| **مدير المنصة العام** | `omaradmin` | `Al-1234567` | عمر العمودي | إدارة الشركات والمشرفين |

> 💡 **ملاحظة:** يمكن لاحقاً تعديل كلمة المرور أو تحديث بيانات الحساب بعد تسجيل الدخول. الحساب يتم إنشاؤه افتراضياً عند تهيئة النظام (`seed`).

---

## 🛠️ بنية النظام والتقنيات (Architecture & Stack)

المشروع مبني كـ Monorepo منظّم ومقسّم إلى:
```
rasd/
├── apps/
│   ├── api/             # Backend: NestJS 10, Prisma ORM, JWT, PostgreSQL
│   └── web/             # Frontend: Next.js 14 App Router, Tailwind CSS, Lucide
├── packages/            # Shared types and utility modules
├── render.yaml          # Render.com Blueprint Infrastructure
├── README.md            # توثيق المشروع
├── LICENSE              # ترخيص MIT
└── .gitignore           # ملف الاستثناءات
```

---

## 🚀 التشغيل المحلي (Local Development)

### 1. المتطلبات:
- **Node.js**: إصدار 20 أو أحدث
- **PostgreSQL**: قاعدة بيانات جاهزة تعمل محلياً

### 2. تثبيت الحزم:
```bash
# تثبيت حزم الـ Backend
cd apps/api
npm install

# تثبيت حزم الـ Frontend
cd ../web
npm install
```

### 3. إعداد متغيرات البيئة:
أنشئ ملف `.env` داخل `apps/api/`:
```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/rasd_db?schema=public"
PORT=4000
NODE_ENV=development
API_PREFIX=api/v1
FRONTEND_URL=http://localhost:3001
JWT_SECRET=rasd_jwt_secret_key_production_2026_secured_b2b
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=rasd_jwt_refresh_secret_key_production_2026_b2b
JWT_REFRESH_EXPIRES_IN=7d
```

### 4. تهيئة قاعدة البيانات:
```bash
cd apps/api
npx prisma db push
npx ts-node prisma/seed.ts
```

### 5. تشغيل السيرفرات:
```bash
# تشغيل الـ API (المنفذ 4000)
cd apps/api
npm run start:dev

# في نافذة طرفية أخرى، تشغيل واجهة الويب (المنفذ 3001)
cd apps/web
npm run dev
```

افتح المتصفح على: `http://localhost:3001`

---

## ☁️ النشر على منصة Render (Deploy to Render)

المشروع مهيأ بالكامل للنشر على **Render.com** إما عبر ملف الـ Blueprint (`render.yaml`) أو بإنشاء الخدمات يدوياً:

### الطريقة الأولى: النشر التلقائي عبر Blueprint (موصى بها)
1. سجّل الدخول إلى حسابك في [Render Dashboard](https://dashboard.render.com).
2. اضغط على **New +** ثم اختر **Blueprint**.
3. اربط مستودع GitHub: `https://github.com/Alamod1omar/rasd`.
4. سيتعرّف Render تلقائياً على ملف `render.yaml` وسيقوم بإنشاء:
   - قاعدة بيانات PostgreSQL مدارة (`rasd-postgres`).
   - خادم الـ API للواجهة الخلفية (`rasd-api`).
   - تطبيق واجهة المستخدم (`rasd-web`).
5. اضغط **Apply** لبدء النشر التلقائي.

### الطريقة الثانية: النشر اليدوي للخدمات

#### 1. إنشاء قاعدة البيانات (PostgreSQL):
- في Render Dashboard اختر **New + > PostgreSQL**.
- الاسم: `rasd-postgres`
- قاعدة البيانات: `rasd_db`
- انسخ رابط الاتصال الداخلي والخارجي (`Internal Database URL`).

#### 2. إنشاء خدمة الـ API (Web Service):
- **Name:** `rasd-api`
- **Root Directory:** `apps/api`
- **Environment:** `Node`
- **Build Command:**
  ```bash
  npm install && npx prisma generate && npm run build
  ```
- **Start Command:**
  ```bash
  npx prisma db push && node dist/main
  ```
- **Environment Variables:**
  - `DATABASE_URL`: رابط قاعدة البيانات من الخطوة السابقة
  - `JWT_SECRET`: مفتاح أمان عشوائي قوي
  - `JWT_EXPIRES_IN`: `7d`
  - `JWT_REFRESH_SECRET`: مفتاح أمان عشوائي آخر
  - `JWT_REFRESH_EXPIRES_IN`: `7d`
  - `NODE_ENV`: `production`
  - `PORT`: `10000`

#### 3. إنشاء خدمة الواجهة (Web Service):
- **Name:** `rasd-web`
- **Root Directory:** `apps/web`
- **Environment:** `Node`
- **Build Command:**
  ```bash
  npm install && npm run build
  ```
- **Start Command:**
  ```bash
  npm run start
  ```
- **Environment Variables:**
  - `NEXT_PUBLIC_API_URL`: رابط خدمة الـ API متبوعاً بـ `/api/v1` (مثال: `https://rasd-api.onrender.com/api/v1`)
  - `NODE_ENV`: `production`

---

## 📤 الرفع على GitHub (Pushing to GitHub)

لرفع الكود على المستودع الخاص بك على GitHub (`https://github.com/Alamod1omar/rasd`):

```bash
# 1. تهيئة المستودع
git init

# 2. إضافة جميع الملفات
git add .

# 3. حفظ الالتزام الأول
git commit -m "feat: complete rasd platform v1.0.0 with render config and omaradmin"

# 4. تعيين الفرع الرئيسي
git branch -M main

# 5. ربط المستودع البعيد
git remote add origin https://github.com/Alamod1omar/rasd.git

# 6. الرفع إلى GitHub
git push -u origin main
```

---

## 📄 الترخيص (License)
هذا المشروع مرخص بموجب رخصة [MIT License](LICENSE).
جميع الحقوق محفوظة © 2026 **عمر العمودي (Omar Alamodi)**.
