# Drill Platform — Setup Guide

## 1. สร้าง Supabase Project

1. ไปที่ https://supabase.com/dashboard
2. คลิก **New Project**
3. ตั้งชื่อ: `drill-platform`
4. เลือก region ที่ใกล้ที่สุด (แนะนำ Singapore)
5. รอ project พร้อม (~2 นาที)

## 2. รับ API Keys

ไปที่ **Settings → API** แล้วคัดลอก:
- `Project URL` → ใส่ใน `NEXT_PUBLIC_SUPABASE_URL`
- `anon public` key → ใส่ใน `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `service_role` key → ใส่ใน `SUPABASE_SERVICE_ROLE_KEY`

แก้ไขไฟล์ `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6...
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=Drill Platform
```

## 3. รัน Database Migrations

ไปที่ **SQL Editor** ใน Supabase Dashboard แล้วรัน SQL ตามลำดับ:

### ขั้นที่ 1: Schema
คัดลอกเนื้อหาจาก `supabase/migrations/001_initial_schema.sql` → รันใน SQL Editor

### ขั้นที่ 2: RLS Policies
คัดลอกจาก `supabase/migrations/002_rls_policies.sql` → รัน

### ขั้นที่ 3: Seed Data (Demo)
คัดลอกจาก `supabase/migrations/003_seed_data.sql` → รัน

## 4. ตั้งค่า Auth (Supabase Dashboard)

ไปที่ **Authentication → URL Configuration**:
- Site URL: `http://localhost:3000`
- Redirect URLs: `http://localhost:3000/auth/callback`

## 5. รัน Development Server

```bash
npm run dev
```

เปิด http://localhost:3000

## 6. สร้าง Admin User

1. ไปที่ http://localhost:3000/register
2. สมัครด้วย email/password
3. ไปที่ Supabase Dashboard → **Table Editor → profiles**
4. แก้ไข `role` ของ user เป็น `admin`

## โครงสร้าง Roles

| Role | ความสามารถ |
|------|-----------|
| `admin` | จัดการทุกอย่างในระบบ |
| `commander` | สร้าง/จัดการ Drills, บันทึก Events |
| `observer` | สังเกตการณ์, บันทึก Event Log, สร้าง AAR |
| `participant` | ดูงาน Drills ที่ตัวเองเข้าร่วม |
| `guest` | ดู content สาธารณะ (ไม่ต้อง login) |

## Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **Database**: PostgreSQL on Supabase
- **Auth**: Supabase Auth
- **Real-time**: Supabase Realtime (พร้อมใช้งาน)
