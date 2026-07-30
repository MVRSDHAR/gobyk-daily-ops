-- ============================================================
-- GOBYK DAILY OPS — SUPABASE DATABASE SETUP
-- Run this entire file in Supabase → SQL Editor → New Query → Run
-- ============================================================

-- 1. BRANCHES TABLE
create table branches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text unique not null,
  has_4w_split boolean default false,   -- true only for Pragathinagar
  created_at timestamptz default now()
);

insert into branches (name, code, has_4w_split) values
  ('KPHB', 'GBK-KPHB', false),
  ('Chandanagar', 'GBK-CHD', false),
  ('Kondapur', 'GBK-KND', false),
  ('Kukatpally', 'GBK-KKP', false),
  ('Gandimaisamma', 'GBK-GDM', false),
  ('Pragathinagar', 'GBK-PRG', true),
  ('Borabanda', 'GBK-BRB', false);

-- 2. USERS TABLE (links Supabase Auth logins to a role + branch)
create table users (
  id uuid primary key default gen_random_uuid(),
  auth_id uuid references auth.users(id) unique,
  name text not null,
  role text not null check (role in ('manager','ho_manager','admin')),
  branch_id uuid references branches(id),   -- null for ho_manager/admin
  status text default 'active' check (status in ('active','inactive','pending_first_login')),
  must_change_pin boolean default true,      -- forces the change-PIN screen
  created_at timestamptz default now()
);

-- 3. DAILY_ENTRIES TABLE (the core data table — one row per branch per day)
create table daily_entries (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid references branches(id) not null,
  entry_date date not null,
  entry_mode text default 'daily' check (entry_mode in ('daily','monthly_bulk')),

  inward_volume integer default 0,
  delivered_volume integer default 0,
  revenue numeric default 0,
  amc_count integer default 0,
  google_reviews integer default 0,

  cash numeric default 0,
  card numeric default 0,
  scan numeric default 0,
  neft numeric default 0,
  paytm numeric default 0,
  credit numeric default 0,
  advance numeric default 0,
  third_party_revenue numeric default 0,

  parts numeric default 0,
  labour numeric default 0,

  counter_sale_volume integer default 0,
  counter_sale_revenue numeric default 0,
  scheme_7rs_count integer default 0,

  -- Pragathinagar-only optional fields
  vehicle_2w_volume integer,
  vehicle_2w_revenue numeric,
  vehicle_4w_volume integer,
  vehicle_4w_revenue numeric,

  created_by uuid references users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  unique(branch_id, entry_date)   -- one row per branch per date, prevents duplicates
);

-- 4. GUEST ACCESS TABLE (which branches/sections a guest login can see)
create table guest_access (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) not null,
  branch_id uuid references branches(id),   -- null = all branches
  section text not null check (section in ('overview','payments','parts_labour','amc_reviews','counter_sale'))
);

-- 5. MTD / ROLLUP VIEW — never store these, always calculate
create view branch_mtd_summary as
select
  branch_id,
  date_trunc('month', entry_date) as month,
  sum(delivered_volume) as mtd_volume,
  sum(revenue) as mtd_revenue,
  sum(amc_count) as mtd_amc,
  sum(google_reviews) as mtd_reviews,
  sum(parts) as mtd_parts,
  sum(labour) as mtd_labour,
  round(sum(revenue) / nullif(sum(delivered_volume),0), 2) as per_jc_revenue,
  max(entry_date) as latest_entry_date
from daily_entries
group by branch_id, date_trunc('month', entry_date);

-- ============================================================
-- ROW LEVEL SECURITY — this is what enforces confidentiality
-- ============================================================

alter table daily_entries enable row level security;
alter table users enable row level security;
alter table guest_access enable row level security;

-- Helper: get the logged-in user's role
create or replace function my_role() returns text as $$
  select role from users where auth_id = auth.uid();
$$ language sql stable security definer;

-- Helper: get the logged-in user's branch
create or replace function my_branch() returns uuid as $$
  select branch_id from users where auth_id = auth.uid();
$$ language sql stable security definer;

-- MANAGER: read + write only their own branch
create policy manager_own_branch on daily_entries
for all
using ( my_role() = 'manager' and branch_id = my_branch() )
with check ( my_role() = 'manager' and branch_id = my_branch() );

-- HO MANAGER: read all branches, no write
create policy ho_read_all on daily_entries
for select
using ( my_role() = 'ho_manager' );

-- ADMIN: full access everywhere
create policy admin_full_access on daily_entries
for all
using ( my_role() = 'admin' )
with check ( my_role() = 'admin' );

-- USERS TABLE: only Admin can view/manage the full user list
create policy admin_manage_users on users
for all
using ( my_role() = 'admin' );

-- Every user can see their own row (needed so the app knows who's logged in)
create policy self_read on users
for select
using ( auth_id = auth.uid() );

-- GUEST ACCESS: only Admin manages it; guests can read their own scope
alter table guest_access enable row level security;
create policy admin_manage_guest_access on guest_access
for all using ( my_role() = 'admin' );

-- ============================================================
-- DONE. Next: create logins in Supabase Auth (see guide below),
-- then insert matching rows into the `users` table for each one.
-- ============================================================
