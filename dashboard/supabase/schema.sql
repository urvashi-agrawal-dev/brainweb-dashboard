-- BrainWeb anonymous usage analytics schema
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor).
-- Creates two tables with Row Level Security enabled and no public access.

create table if not exists public.installations (
  install_id      uuid primary key,
  first_seen_at   timestamptz not null default now(),
  last_seen_at    timestamptz not null default now()
);

create table if not exists public.daily_activity (
  install_id      uuid not null references public.installations (install_id) on delete cascade,
  activity_date   date not null,
  created_at      timestamptz not null default now(),
  primary key (install_id, activity_date)
);

-- Row Level Security: enabled, no policies = no client access.
-- All reads/writes go through the server-only service role key.
alter table public.installations enable row level security;
alter table public.daily_activity enable row level security;

-- Optional indexes for aggregate queries (DAU/WAU/MAU).
create index if not exists daily_activity_activity_date_idx
  on public.daily_activity (activity_date);
