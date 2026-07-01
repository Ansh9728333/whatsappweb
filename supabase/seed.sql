-- ============================================================
-- Whatsify Dashboard — Seed Data
-- supabase/seed.sql
-- Run after migration: psql <connection_string> -f supabase/seed.sql
-- Or via Supabase Dashboard → SQL Editor
-- ============================================================

-- Seed a default profile
insert into profiles (user_name, role, business_name, wallet_amount)
values ('Dharmender', 'Owner', 'Kairali Ayurvedic Treatment Centres', 950.00)
on conflict do nothing
returning id;

-- Seed wa_accounts linked to the first profile
-- We use a sub-select to get the profile id
insert into wa_accounts (profile_id, number, unique_id, allow_incoming, status, created_at)
select
  p.id,
  v.number,
  v.unique_id,
  v.allow_incoming,
  v.status,
  v.created_at
from profiles p
cross join (
  values
    ('918595021137', '17784736507786f', true,  'connected',    '2026-05-11 10:17:00+05:30'::timestamptz),
    ('919211440675', '1778155289b69f4', false, 'disconnected', '2026-05-07 17:34:00+05:30'::timestamptz),
    ('918796250111', '1776857604bba78', false, 'disconnected', '2026-04-22 17:46:00+05:30'::timestamptz),
    ('919810926800', '17632801379f202', false, 'connected',    '2025-11-16 13:33:00+05:30'::timestamptz),
    ('919810926800', '1742193706259b3', false, 'connected',    '2025-03-17 12:13:00+05:30'::timestamptz)
) as v(number, unique_id, allow_incoming, status, created_at)
where p.user_name = 'Dharmender'
limit 1
on conflict (unique_id) do nothing;
