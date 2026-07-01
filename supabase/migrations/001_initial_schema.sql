-- ============================================================
-- Whatsify Dashboard — Initial Database Schema
-- Migration: 001_initial_schema.sql
-- ============================================================

-- ============================================================
-- 1. PROFILES TABLE
-- ============================================================
create table if not exists profiles (
  id              uuid primary key default gen_random_uuid(),
  user_name       text not null default 'Dharmender',
  role            text not null default 'Owner',
  business_name   text not null default 'Kairali Ayurvedic Treatment Centres',
  wallet_amount   numeric(12, 2) not null default 950.00,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ============================================================
-- 2. WA_ACCOUNTS TABLE
-- ============================================================
create table if not exists wa_accounts (
  id              uuid primary key default gen_random_uuid(),
  profile_id      uuid references profiles(id) on delete cascade,
  number          text not null,
  unique_id       text not null unique,
  allow_incoming  boolean not null default false,
  status          text not null default 'disconnected'
                  check (status in ('connected', 'disconnected')),
  provider        text not null default 'official_cloud_api',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists wa_accounts_profile_id_idx on wa_accounts(profile_id);
create index if not exists wa_accounts_status_idx on wa_accounts(status);

-- ============================================================
-- 3. INCOMING_MESSAGES TABLE
-- ============================================================
create table if not exists incoming_messages (
  id              uuid primary key default gen_random_uuid(),
  wa_account_id   uuid references wa_accounts(id) on delete set null,
  from_number     text,
  sender_name     text,
  message_type    text,
  message_text    text,
  raw_payload     jsonb,
  received_at     timestamptz not null default now()
);

create index if not exists incoming_messages_wa_account_id_idx on incoming_messages(wa_account_id);
create index if not exists incoming_messages_received_at_idx on incoming_messages(received_at desc);

-- ============================================================
-- 4. CAMPAIGN_ROWS TABLE
-- ============================================================
create table if not exists campaign_rows (
  id              uuid primary key default gen_random_uuid(),
  profile_id      uuid references profiles(id) on delete cascade,
  phone_number    text not null,
  message         text not null,
  status          text not null default 'pending'
                  check (status in ('pending', 'processing', 'sent', 'failed')),
  source          text not null default 'google_sheet',
  error_message   text,
  sent_at         timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists campaign_rows_profile_id_idx on campaign_rows(profile_id);
create index if not exists campaign_rows_status_idx on campaign_rows(status);
create index if not exists campaign_rows_created_at_idx on campaign_rows(created_at desc);

-- ============================================================
-- 5. UPDATED_AT TRIGGER FUNCTION
-- ============================================================
create or replace function handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Apply updated_at trigger to profiles
drop trigger if exists set_profiles_updated_at on profiles;
create trigger set_profiles_updated_at
  before update on profiles
  for each row execute function handle_updated_at();

-- Apply updated_at trigger to wa_accounts
drop trigger if exists set_wa_accounts_updated_at on wa_accounts;
create trigger set_wa_accounts_updated_at
  before update on wa_accounts
  for each row execute function handle_updated_at();

-- Apply updated_at trigger to campaign_rows
drop trigger if exists set_campaign_rows_updated_at on campaign_rows;
create trigger set_campaign_rows_updated_at
  before update on campaign_rows
  for each row execute function handle_updated_at();

-- ============================================================
-- 6. ROW LEVEL SECURITY (RLS) — enable but allow service role
-- ============================================================
alter table profiles enable row level security;
alter table wa_accounts enable row level security;
alter table incoming_messages enable row level security;
alter table campaign_rows enable row level security;

-- Service role bypasses RLS; add user-scoped policies here when auth is implemented
-- Example (uncomment when Supabase Auth is configured):
-- create policy "Users can read own profile" on profiles
--   for select using (auth.uid() = id);
