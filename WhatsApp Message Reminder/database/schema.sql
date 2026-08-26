-- WhatsApp Reminders - full schema.
-- Run this in the Supabase SQL editor (Dashboard > SQL Editor > New query).
-- Idempotent: safe to re-run on a fresh OR an existing database.

create extension if not exists pgcrypto;

/* ------------------------------- tables ------------------------------ */

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.whatsapp_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  account_name text,
  qr_code text,
  session_data text,          -- legacy, unused: auth now lives on disk via LocalAuth
  is_authenticated boolean not null default false,
  last_ready_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  phone text not null,
  name text not null,
  tags text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.message_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.scheduled_sends (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete cascade,
  template_id uuid not null references public.message_templates(id) on delete cascade,
  send_type text not null check (send_type in ('immediate', 'once', 'daily', 'weekly')),
  schedule_time timestamptz,
  last_sent timestamptz,
  status text not null default 'active' check (status in ('active', 'completed', 'cancelled', 'failed')),
  created_at timestamptz not null default now()
);

create table if not exists public.delivery_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  message_body text not null,
  error text,
  sent_at timestamptz not null default now(),
  status text not null check (status in ('success', 'failed'))
);

/* -------------------- migrations for existing databases -------------- */
-- Each block is guarded, so running this file against the original schema
-- upgrades it in place without touching your data.

-- customers.tags: lets one schedule target a whole group of clients.
alter table public.customers
  add column if not exists tags text[] not null default '{}';

-- whatsapp_sessions.last_ready_at: when the linked phone was last confirmed online.
alter table public.whatsapp_sessions
  add column if not exists last_ready_at timestamptz;

-- scheduled_sends: bulk targeting, weekday selection, crash-safe job claiming.
alter table public.scheduled_sends
  add column if not exists target_type text not null default 'customer',
  add column if not exists target_tag text,
  add column if not exists weekly_day smallint,
  add column if not exists locked_at timestamptz,
  add column if not exists attempts integer not null default 0,
  add column if not exists last_error text;

-- customer_id must be nullable now: tag/all targets resolve recipients at send time.
alter table public.scheduled_sends
  alter column customer_id drop not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'scheduled_sends_target_type_check'
  ) then
    alter table public.scheduled_sends
      add constraint scheduled_sends_target_type_check
      check (target_type in ('customer', 'tag', 'all'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'scheduled_sends_weekly_day_check'
  ) then
    alter table public.scheduled_sends
      add constraint scheduled_sends_weekly_day_check
      check (weekly_day is null or (weekly_day >= 0 and weekly_day <= 6));
  end if;

  -- A 'customer' target needs a customer_id; 'tag' needs a tag. Enforce it in the DB
  -- so a bad API call can never create a schedule that resolves to nobody.
  if not exists (
    select 1 from pg_constraint where conname = 'scheduled_sends_target_shape_check'
  ) then
    alter table public.scheduled_sends
      add constraint scheduled_sends_target_shape_check
      check (
        (target_type = 'customer' and customer_id is not null)
        or (target_type = 'tag' and target_tag is not null)
        or (target_type = 'all')
      );
  end if;
end $$;

-- delivery_logs.schedule_id: trace every message back to the schedule that sent it.
alter table public.delivery_logs
  add column if not exists schedule_id uuid references public.scheduled_sends(id) on delete set null;

/* ----------------------------- indexes ------------------------------ */

create index if not exists idx_sessions_user on public.whatsapp_sessions (user_id);
create index if not exists idx_customers_user on public.customers (user_id);
create index if not exists idx_customers_tags on public.customers using gin (tags);
create index if not exists idx_templates_user on public.message_templates (user_id);
create index if not exists idx_schedules_user on public.scheduled_sends (user_id);
create index if not exists idx_schedules_status on public.scheduled_sends (status);
create index if not exists idx_schedules_due on public.scheduled_sends (status, schedule_time)
  where status = 'active';
create index if not exists idx_logs_user on public.delivery_logs (user_id, sent_at desc);
create index if not exists idx_logs_schedule on public.delivery_logs (schedule_id);

-- One phone number per account. Prevents the same client being messaged twice
-- because they were added under two slightly different names.
create unique index if not exists uq_customers_user_phone
  on public.customers (user_id, phone);

-- The backend keeps exactly one live WhatsApp connection per user, so the table
-- must agree. Remove any duplicate rows left by earlier versions first, keeping
-- the most recent, otherwise the unique index below cannot be created.
delete from public.whatsapp_sessions s
 where exists (
   select 1 from public.whatsapp_sessions newer
    where newer.user_id = s.user_id
      and newer.created_at > s.created_at
 );

create unique index if not exists uq_whatsapp_sessions_user
  on public.whatsapp_sessions (user_id);

/* -------------------- row level security policies -------------------- */
-- IMPORTANT, please read before changing anything here.
--
-- This app does NOT use Supabase Auth. It has its own `users` table and signs its
-- own JWTs, so `auth.uid()` is always NULL for any request that arrives through
-- PostgREST. That means these policies deny everything to the anon/public key --
-- which is exactly what we want: nobody should be reaching these tables directly.
--
-- The backend connects with the SERVICE ROLE key, which bypasses RLS entirely.
-- So RLS is a lock on the front door, not the thing that separates one account
-- from another. Per-account isolation is enforced in server.js, where every
-- query is filtered by user_id. Never expose the service role key to a browser.

alter table public.users enable row level security;
alter table public.whatsapp_sessions enable row level security;
alter table public.customers enable row level security;
alter table public.message_templates enable row level security;
alter table public.scheduled_sends enable row level security;
alter table public.delivery_logs enable row level security;

-- Recreated on every run so re-running this file never errors on a duplicate name.
drop policy if exists "deny anon users" on public.users;
drop policy if exists "deny anon whatsapp sessions" on public.whatsapp_sessions;
drop policy if exists "deny anon customers" on public.customers;
drop policy if exists "deny anon templates" on public.message_templates;
drop policy if exists "deny anon schedules" on public.scheduled_sends;
drop policy if exists "deny anon logs" on public.delivery_logs;

-- Older policy names from the first version of this file.
drop policy if exists "users select own profile" on public.users;
drop policy if exists "users own whatsapp sessions" on public.whatsapp_sessions;
drop policy if exists "users own customers" on public.customers;
drop policy if exists "users own templates" on public.message_templates;
drop policy if exists "users own schedules" on public.scheduled_sends;
drop policy if exists "users own logs" on public.delivery_logs;

create policy "deny anon users" on public.users
  for all to anon, authenticated using (false) with check (false);
create policy "deny anon whatsapp sessions" on public.whatsapp_sessions
  for all to anon, authenticated using (false) with check (false);
create policy "deny anon customers" on public.customers
  for all to anon, authenticated using (false) with check (false);
create policy "deny anon templates" on public.message_templates
  for all to anon, authenticated using (false) with check (false);
create policy "deny anon schedules" on public.scheduled_sends
  for all to anon, authenticated using (false) with check (false);
create policy "deny anon logs" on public.delivery_logs
  for all to anon, authenticated using (false) with check (false);

/* ---------------------- one-off data corrections ---------------------- */
-- Fixes rows created by the previous buggy version of the backend.

-- 'immediate' schedules were left 'active' and silently rescheduled a week out,
-- so they kept re-sending forever. Anything already sent is complete.
update public.scheduled_sends
   set status = 'completed'
 where send_type = 'immediate'
   and status = 'active'
   and last_sent is not null;

-- 'immediate' rows that never sent are stale; nobody is waiting on them.
update public.scheduled_sends
   set status = 'cancelled'
 where send_type = 'immediate'
   and status = 'active'
   and last_sent is null;

-- Recurring schedules that were killed by a single transient failure or by a
-- server restart can be revived: the new backend retries instead of giving up.
update public.scheduled_sends
   set status = 'active', attempts = 0, locked_at = null
 where send_type in ('daily', 'weekly')
   and status = 'failed';
