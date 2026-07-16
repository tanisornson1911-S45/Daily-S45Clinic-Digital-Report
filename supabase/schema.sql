-- Facebook Ads Dashboard — Supabase schema
-- Run this once against a new Supabase project (SQL Editor -> paste -> Run).
-- Populated by api/sync-facebook-ads.js on a schedule (see vercel.json), using
-- a Meta System User token — no per-user OAuth login required.

create table if not exists ad_accounts (
  id text primary key,              -- Facebook ad account id, e.g. "225618075"
  name text not null,
  currency text not null default 'THB',
  budget numeric not null default 0,      -- optional manual budget target (THB)
  updated_at timestamptz not null default now()
);

create table if not exists campaigns (
  id text primary key,
  account_id text not null references ad_accounts(id) on delete cascade,
  name text not null,
  status text not null,              -- 'Active' | 'Paused' | ...
  daily_budget numeric,
  updated_at timestamptz not null default now()
);

create table if not exists ads (
  id text primary key,
  account_id text not null references ad_accounts(id) on delete cascade,
  campaign_id text references campaigns(id) on delete cascade,
  name text not null,
  updated_at timestamptz not null default now()
);

-- Daily insight rows keyed by entity + level, so the same table serves
-- account/campaign/ad trend lines without three separate schemas.
create table if not exists insights_daily (
  entity_level text not null check (entity_level in ('account', 'campaign', 'ad')),
  entity_id text not null,
  account_id text not null references ad_accounts(id) on delete cascade,
  date date not null,
  spend numeric not null default 0,
  impressions bigint not null default 0,
  reach bigint not null default 0,
  clicks bigint not null default 0,
  ctr numeric not null default 0,
  messaging_conversations bigint not null default 0,
  purchases bigint not null default 0,
  primary key (entity_level, entity_id, date)
);

create index if not exists insights_daily_account_date_idx on insights_daily (account_id, date);

-- Single-row table the sync job stamps on every run so the UI can show
-- "last synced" without needing direct Graph API access from the browser.
create table if not exists sync_state (
  id int primary key default 1,
  last_synced_at timestamptz,
  last_status text,          -- 'ok' | 'error'
  last_error text,
  check (id = 1)
);
insert into sync_state (id) values (1) on conflict (id) do nothing;

-- Row Level Security: dashboard reads via the anon key, writes only via the
-- service-role key from the serverless sync job.
alter table ad_accounts enable row level security;
alter table campaigns enable row level security;
alter table ads enable row level security;
alter table insights_daily enable row level security;
alter table sync_state enable row level security;

create policy "public read ad_accounts" on ad_accounts for select using (true);
create policy "public read campaigns" on campaigns for select using (true);
create policy "public read ads" on ads for select using (true);
create policy "public read insights_daily" on insights_daily for select using (true);
create policy "public read sync_state" on sync_state for select using (true);
